import { App, MarkdownView } from "obsidian";
import { ToolAgentSettings } from "../types/settings";
import { ActionPlan, ExecutionContext } from "../types/ActionPlan";
import { LLMProvider } from "./LLMProvider";
import { PlanStore } from "./PlanStore";
import { PlanValidator } from "./PlanValidator";
import { Plan, PlanDraft } from "../types/Plan";
import { ToolsLayer } from "./ToolsLayer";

/**
 * Context information for plan generation
 */
export interface PlanContext {
  /** Path to the active file */
  activeFilePath?: string;
  /** Current selection */
  selection?: {
    text: string;
    source: string;
  };
}

/**
 * Service to generate plans from user prompts
 */
export class PlanGenerator {
  private app: App;
  private llmProvider: LLMProvider;
  private planStore: PlanStore;
  private toolsLayer: ToolsLayer;
  private validator: PlanValidator;
  private currentAbortController: AbortController | null = null;

  constructor(
    app: App,
    _settings: ToolAgentSettings,
    llmProvider: LLMProvider,
    planStore: PlanStore,
    toolsLayer: ToolsLayer
  ) {
    this.app = app;
    this.llmProvider = llmProvider;
    this.planStore = planStore;
    this.toolsLayer = toolsLayer;
    this.validator = new PlanValidator();
  }

  /**
   * Generate a plan from a user prompt
   */
  async generatePlan(
    prompt: string,
    context: PlanContext,
    onProgress?: (status: string) => void
  ): Promise<Plan> {
    this.currentAbortController = new AbortController();

    try {
      onProgress?.("Gathering context...");
      const executionContext = await this.gatherExecutionContext(context);

      onProgress?.("Generating plan...");
      let actionPlan = await this.generateActionPlan(
        prompt,
        executionContext
      );

      onProgress?.("Validating plan...");
      let validationResult = this.validator.validate(actionPlan);

      if (!validationResult.valid) {
        const errorDetails =
          this.validator.formatValidationResult(validationResult);
        throw new Error(`Invalid plan generated:\n${errorDetails}`);
      }

      // Check for placeholders and resolve them iteratively
      const maxResolutionAttempts = 3;
      let resolutionAttempt = 0;

      while (
        this.validator.hasPlaceholders(validationResult) &&
        resolutionAttempt < maxResolutionAttempts
      ) {
        resolutionAttempt++;
        onProgress?.(`Resolving placeholders (attempt ${resolutionAttempt})...`);

        // Execute read-only steps to gather data
        const readResults = await this.executeReadOnlySteps(actionPlan, executionContext);

        if (Object.keys(readResults).length === 0) {
          // No read steps to execute, can't resolve placeholders
          console.warn("[PlanGenerator] No read-only steps to execute, cannot resolve placeholders");
          break;
        }

        // Generate a new plan with the gathered data
        onProgress?.("Regenerating plan with gathered data...");
        actionPlan = await this.generateActionPlanWithContext(
          prompt,
          executionContext,
          actionPlan,
          readResults
        );

        // Revalidate
        validationResult = this.validator.validate(actionPlan);

        if (!validationResult.valid) {
          const errorDetails =
            this.validator.formatValidationResult(validationResult);
          throw new Error(`Invalid plan after resolution:\n${errorDetails}`);
        }
      }

      if (this.validator.hasPlaceholders(validationResult)) {
        const placeholders = this.validator.getPlaceholderWarnings(validationResult);
        const placeholderDetails = placeholders.map(p => p.message).join("\n");
        throw new Error(`Unable to resolve placeholders after ${maxResolutionAttempts} attempts:\n${placeholderDetails}`);
      }

      onProgress?.("Creating plan...");
      const planDraft: PlanDraft = {
        title: this.generateTitle(actionPlan.goal),
        goal: actionPlan.goal,
        actionPlan,
        priority: 3,
        tags: this.extractTags(prompt, actionPlan),
      };

      const plan = this.planStore.create(planDraft);
      onProgress?.("Plan created!");

      return plan;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Plan generation cancelled");
      }
      throw error;
    } finally {
      this.currentAbortController = null;
    }
  }

  /**
   * Cancel ongoing plan generation
   */
  cancel(): void {
    this.currentAbortController?.abort();
    this.llmProvider.abort();
  }

  /**
   * Gather execution context from Obsidian workspace
   */
  private async gatherExecutionContext(
    context: PlanContext
  ): Promise<ExecutionContext> {
    const activeFile = context.activeFilePath
      ? this.app.vault.getAbstractFileByPath(context.activeFilePath)
      : this.app.workspace.getActiveFile();

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const selection = context.selection?.text || activeView?.editor?.getSelection();

    // List available commands
    const availableCommands = await this.toolsLayer.listCommands();

    return {
      activeFile: activeFile?.path,
      selection: selection || undefined,
      vaultPath: this.app.vault.getRoot().path,
      variables: {},
      stepResults: new Map(),
      availableCommands,
    };
  }

  /**
   * Generate an action plan from the LLM
   */
  private async generateActionPlan(
    userPrompt: string,
    context: ExecutionContext,
    maxRetries: number = 2
  ): Promise<ActionPlan> {
    let lastError: Error | null = null;
    let feedbackMessages: string[] = [];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const systemPrompt = this.buildSystemPrompt();
        const fullUserPrompt = this.buildUserPrompt(
          userPrompt,
          context,
          feedbackMessages
        );

        console.log("[PlanGenerator] Generating plan, attempt:", attempt + 1);

        const response = await this.llmProvider.generatePlan(
          systemPrompt,
          fullUserPrompt
        );

        // Validate the response
        const validationResult = this.validator.validate(response);

        if (!validationResult.valid) {
          const errorDetails =
            this.validator.formatValidationResult(validationResult);
          feedbackMessages.push(
            `Previous attempt failed validation:\n${errorDetails}\n\nPlease fix these issues and generate a valid plan.`
          );
          lastError = new Error(
            `Invalid plan (attempt ${attempt + 1}/${maxRetries + 1}):\n${errorDetails}`
          );

          if (attempt < maxRetries) {
            console.log(
              `Plan validation failed, retrying (${attempt + 1}/${maxRetries})...`
            );
            continue;
          }
        } else {
          // Success!
          return response;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof Error && error.message.includes("JSON")) {
          feedbackMessages.push(
            `Previous attempt generated invalid JSON. Please ensure you output ONLY valid JSON matching the ActionPlan schema.`
          );
        }

        if (attempt < maxRetries) {
          console.log(
            `Plan generation failed, retrying (${attempt + 1}/${maxRetries})...`,
            error
          );
          continue;
        }
      }
    }

    throw (
      lastError || new Error("Failed to generate valid plan after retries")
    );
  }

  /**
   * Build system prompt for the LLM
   */
  private buildSystemPrompt(): string {
    return `You are Wand, an intelligent Obsidian automation assistant. You help users manage their knowledge base with thoughtfulness, precision, and genuine helpfulness.

## Your Core Philosophy

1. **Understand Before Acting**: Always gather context first. If the user says "tag my recent documents", first list what files exist, check what tags are already in use, then propose intelligent tagging based on actual content.

2. **Be Proactively Helpful**: Don't just do the minimum. If a user asks to create a daily note, also consider: Does a template exist? Should it link to related notes? Would tags be helpful?

3. **Think Step by Step**: Break complex tasks into logical phases:
   - Phase 1: Gather information (read files, list folders, search for context)
   - Phase 2: Analyze and plan based on what you found
   - Phase 3: Execute the changes

4. **Make Intelligent Suggestions**: Use what you learn from the vault to make smart recommendations. If you see existing patterns (naming conventions, folder structure, tag taxonomy), follow them.

5. **Be Safe but Not Timid**: You can be thorough without being reckless. Reading files is always safe. Creating new files is usually safe. Modifying or deleting existing content deserves more care.

## Planning Strategy

**For tasks involving existing content** (tagging, organizing, updating):
- ALWAYS start with vault.listFiles or vault.searchText to understand what exists
- ALWAYS read relevant files to understand their content before modifying
- Base your actions on ACTUAL content, not assumptions

**For tasks creating new content**:
- Check if similar content already exists (don't create duplicates)
- Follow existing naming patterns and folder structures
- Consider what frontmatter, tags, or links would be valuable

**For ambiguous requests**:
- State your assumptions clearly
- Choose the most useful interpretation
- Explain what you're doing and why in the preview field

## Available Tools

**Information Gathering (always safe, use freely):**
- vault.listFiles: List files in a folder (use recursive=true to see everything)
- vault.readFile: Read a file's content - USE THIS to understand context
- vault.searchText: Search for text patterns across the vault
- editor.getSelection: Get currently selected text
- editor.getActiveFilePath: Get the current file path
- workspace.getContext: Get workspace state

**Dataview Integration (if Dataview plugin is installed):**
- dataview.status: Check if Dataview is available and get its version/stats
- dataview.query: Execute any DQL query (LIST, TABLE, TASK, CALENDAR)
  - Example: dataview.query({ dql: 'LIST FROM #project WHERE status = "active"' })
  - Example: dataview.query({ dql: 'TABLE file.mtime, tags FROM "Projects"' })
- dataview.pages: Get pages matching a source with optional filters
  - Example: dataview.pages({ source: '#project' }) - all pages with #project tag
  - Example: dataview.pages({ source: '"Daily"' }) - all pages in Daily folder
  - Example: dataview.pages({ source: '#task', where: { status: 'active' } })
- dataview.tasks: Query tasks across the vault
  - Example: dataview.tasks({ options: { completed: false } }) - all incomplete tasks
  - Example: dataview.tasks({ options: { source: '#work', dueBefore: '2024-01-20' } })

**When to use Dataview vs vault.listFiles/searchText:**
- Use Dataview when you need to query by frontmatter fields, tags, or complex conditions
- Use Dataview when you need task-specific queries (completion status, due dates)
- Use vault.listFiles for simple file listing by folder
- Use vault.searchText for full-text content search
- Dataview is MUCH more powerful for structured queries - prefer it when available

**Templater Integration (if Templater plugin is installed):**
- templater.status: Check if Templater is available and get configuration
  - Returns: { available, enabled, templatesFolder }
  - Always check this before using other templater tools
- templater.run: Execute a template and get the result WITHOUT inserting it
  - Example: templater.run({ templatePath: 'Templates/Daily Note.md' })
  - Example with context: templater.run({ templatePath: 'Templates/Summary.md', targetFile: 'Notes/MyNote.md' })
  - Returns processed content with dynamic variables (dates, metadata) resolved
  - Use when you need the output to process further or use elsewhere
- templater.insert: Execute a template and insert at current cursor position
  - Example: templater.insert({ templatePath: 'Templates/Code Block.md' })
  - Inserts processed template content directly into the active editor
  - Requires an active editor with cursor position
- templater.create: Create a NEW note from a template
  - Example: templater.create({ templatePath: 'Templates/Project.md', outputPath: 'Projects/New Project.md' })
  - Example with folder: templater.create({ templatePath: 'Templates/Meeting.md', outputPath: 'standup.md', folderPath: 'Meetings/2024' })
  - Creates file with template variables resolved
  - Use openNote: true to open the created note

**When to use Templater tools:**
- "Create a daily note" → templater.create with daily note template
- "Add meeting notes template here" → templater.insert
- "Generate a summary from this template" → templater.run to get content programmatically
- "Set up a new project" → templater.create with project template
- "Insert a code snippet template" → templater.insert
- Creating notes with dynamic content (<%tp.date.now()%>, <%tp.file.title%>, etc.)

**When NOT to use Templater:**
- If user wants plain text without template processing → use vault.createFile or editor.insertAtCursor
- If Templater plugin is not installed → check templater.status first, fall back to vault tools

**Tasks Integration (if Tasks plugin is installed):**
- tasks.status: Check if Tasks plugin is available and get its version
  - Returns: { available, enabled, version }
  - Always check this before using other tasks tools
- tasks.create: Open the Tasks modal to create a new task interactively
  - Example: tasks.create({})
  - Opens the Tasks plugin's UI for creating rich tasks with dates, priorities, recurrence
  - Returns the task line in markdown format, or empty string if user cancels
  - The returned task line can be inserted into a file using editor.insertAtCursor or vault.writeFile
- tasks.edit: Open the Tasks modal to edit an existing task line
  - Example: tasks.edit({ taskLine: '- [ ] My task due 2024-01-15' })
  - Opens the Tasks UI pre-filled with the existing task for editing
  - Returns the edited task line, or empty string if user cancels
- tasks.toggle: Toggle a task's completion status (handles recurrence automatically)
  - Example: tasks.toggle({ line: '- [ ] My task', path: 'Notes/Tasks.md' })
  - Toggles between [ ] and [x], and automatically creates new instances of recurring tasks
  - Returns the new task line after toggling

**When to use Tasks vs Dataview:**
- Use tasks.create/edit when you want the rich Tasks UI (dates, priorities, recurrence, dependencies)
- Use tasks.toggle when you need to complete a task and respect recurrence rules
- Use dataview.tasks for QUERYING and FINDING tasks programmatically
- Tasks plugin provides USER INTERACTION, Dataview provides DATA QUERIES
- Example workflow: Use dataview.tasks to find overdue tasks, then tasks.toggle to complete them

**When to use Tasks tools:**
- "Create a new task" → tasks.create to use the rich UI
- "Mark this task as done" → tasks.toggle to handle recurrence
- "Edit this task's due date" → tasks.edit to use the UI
- "Find all tasks due today" → dataview.tasks for querying
- Tasks with recurrence rules (every day, every week, etc.) → MUST use tasks.toggle


**Advanced Tables Integration (if Advanced Tables plugin is installed):**
- advancedtables.status: Check if Advanced Tables is available
  - Returns: { available, enabled }
  - Always check this before using other advanced tables tools
- advancedtables.format: Format current table or all tables in file
  - Example: advancedtables.format({}) - formats current table (cursor must be in table)
  - Example: advancedtables.format({ allTables: true }) - formats all tables in file
  - Ensures consistent spacing, alignment, and clean table structure
- advancedtables.insertRow: Insert a new row before the current row
  - Example: advancedtables.insertRow({})
  - Cursor must be inside a table
- advancedtables.insertColumn: Insert a new column before the current column
  - Example: advancedtables.insertColumn({})
  - Cursor must be inside a table
- advancedtables.sort: Sort table rows by current column
  - Example: advancedtables.sort({ direction: 'asc' }) - sort ascending
  - Example: advancedtables.sort({ direction: 'desc' }) - sort descending
  - Cursor must be in the column to sort by
- advancedtables.align: Set column alignment
  - Example: advancedtables.align({ alignment: 'left' })
  - Example: advancedtables.align({ alignment: 'center' })
  - Example: advancedtables.align({ alignment: 'right' })
  - Cursor must be in the column to align

**When to use Advanced Tables:**
- "Format this table nicely" → advancedtables.format
- "Format all tables in this file" → advancedtables.format with allTables: true
- "Sort this table by the current column" → advancedtables.sort
- "Add a new row" → advancedtables.insertRow
- "Add a column" → advancedtables.insertColumn
- "Align this column to the right" → advancedtables.align

**Important:** Most Advanced Tables operations require the cursor to be positioned inside a markdown table.


**Excalidraw Integration (if Excalidraw plugin is installed):**
- excalidraw.status: Check if Excalidraw is available
  - Returns: { available, enabled, version? }
  - Always check this before using other Excalidraw tools
- excalidraw.create: Create a new Excalidraw drawing
  - Example: excalidraw.create({}) - creates a default drawing named "Drawing"
  - Example: excalidraw.create({ filename: 'diagram', foldername: 'Drawings' })
  - Example: excalidraw.create({ templatePath: 'Templates/flowchart.excalidraw' }) - use a template
  - Opens the drawing in a new pane by default (set onNewPane: false to use current pane)
  - Returns the path to the created drawing file
- excalidraw.exportSVG: Export a drawing to SVG format
  - Example: excalidraw.exportSVG({}) - exports the currently active drawing
  - Example: excalidraw.exportSVG({ drawingPath: 'Drawings/diagram.excalidraw' })
  - Returns an SVG string representation of the drawing
- excalidraw.exportPNG: Export a drawing to PNG format
  - Example: excalidraw.exportPNG({}) - exports the currently active drawing
  - Example: excalidraw.exportPNG({ drawingPath: 'Drawings/diagram.excalidraw' })
  - Returns a base64-encoded PNG image

**When to use Excalidraw:**
- "Create a diagram" → excalidraw.create
- "Draw a flowchart" → excalidraw.create with a flowchart template
- "Make a visual representation" → excalidraw.create
- "Export this drawing as an image" → excalidraw.exportPNG or excalidraw.exportSVG
- Visual thinking, sketching, wireframes, mindmaps, architecture diagrams
- Hand-drawn style illustrations and annotations

**Important:** 
- Export operations work on the active drawing file or a specified drawing path
- Excalidraw files have the .excalidraw extension and store drawing data in JSON format
- Templates are useful for creating consistent diagram styles (flowcharts, wireframes, etc.)


**Content Creation:**
- vault.ensureFolder: Create a folder structure
- vault.createFile: Create a new file with content (safe for new files)
- editor.insertAtCursor: Add text at cursor position

**Content Modification (use thoughtfully):**
- vault.writeFile: Overwrite file contents (careful - replaces everything)
- editor.replaceSelection: Replace selected text
- vault.rename: Rename or move a file

**Potentially Destructive:**
- vault.delete: Remove a file or folder permanently

**Utilities:**
- commands.list: List available Obsidian commands
- commands.run: Execute an Obsidian command by ID
- util.parseMarkdownBullets: Parse bullet list to array
- util.slugifyTitle: Convert text to filename-safe slug

## Critical: No Placeholder Values

You will be called multiple times as the plan executes. After read steps complete, you'll receive their results and can generate write steps with actual values.

**NEVER include steps with placeholder values like:**
- "path_to_recent_note_1" or "path_to_file"
- "updated_content_with_tags" or "new_content"
- Any value you're guessing or templating

**If a task requires information you don't have:**
1. Generate ONLY the read/search steps first
2. Stop there - don't include write steps with made-up values
3. You'll be called again with the results to generate the next steps

For example, if asked to "tag recent notes":
- DO: Generate steps to list files and search for existing tags
- DON'T: Include vault.writeFile steps with placeholder paths/content
- You'll be called again with the file list to generate the actual write steps

## Response Format

Output ONLY valid JSON matching this schema:

{
  "version": "1.0",
  "goal": "Clear description of what this plan accomplishes",
  "assumptions": [
    "State each assumption you're making",
    "Explain any interpretations of ambiguous requests",
    "Note what information you'd ideally have"
  ],
  "riskLevel": "read-only" | "writes" | "commands",
  "steps": [
    {
      "id": "step-1",
      "tool": "tool.name",
      "args": { "parameter": "value" },
      "preview": "Human-readable explanation of what this step does and why"
    }
  ]
}

Remember: You're not just executing commands - you're thoughtfully helping someone manage their knowledge. Take the time to understand the context, and your actions will be genuinely useful.`;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(
    userMessage: string,
    context: ExecutionContext,
    feedbackMessages: string[] = []
  ): string {
    let prompt = `User request: "${userMessage}"

Current context:
- Active file: ${context.activeFile || "None"}
- Selection: ${context.selection ? `"${context.selection.substring(0, 200)}${context.selection.length > 200 ? "..." : ""}"` : "None"}
- Vault path: ${context.vaultPath}`;

    if (feedbackMessages.length > 0) {
      prompt += "\n\n" + feedbackMessages.join("\n\n");
    }

    prompt += "\n\nGenerate an action plan to fulfill this request.";
    return prompt;
  }

  /**
   * Execute read-only steps from a plan to gather data for placeholder resolution
   */
  private async executeReadOnlySteps(
    plan: ActionPlan,
    context: ExecutionContext
  ): Promise<Record<string, any>> {
    const readOnlyTools = [
      "vault.listFiles",
      "vault.readFile",
      "vault.searchText",
      "editor.getSelection",
      "editor.getActiveFilePath",
      "workspace.getContext",
      "commands.list",
      // Dataview tools (all are read-only)
      "dataview.status",
      "dataview.query",
      "dataview.pages",
      "dataview.tasks",
      // Templater tools (read-only)
      "templater.status",
      // Tasks tools (read-only)
      "tasks.status",
    ];

    const results: Record<string, any> = {};

    for (const step of plan.steps) {
      if (readOnlyTools.includes(step.tool)) {
        try {
          console.log(`[PlanGenerator] Executing read-only step: ${step.id} (${step.tool})`);
          const result = await this.toolsLayer.executeTool(step.tool, step.args, context);
          results[step.id] = result;
          console.log(`[PlanGenerator] Step ${step.id} result:`, result);
        } catch (error) {
          console.warn(`[PlanGenerator] Failed to execute step ${step.id}:`, error);
          results[step.id] = { error: error instanceof Error ? error.message : String(error) };
        }
      }
    }

    return results;
  }

  /**
   * Generate a new action plan with context from previously executed read steps
   */
  private async generateActionPlanWithContext(
    userPrompt: string,
    context: ExecutionContext,
    previousPlan: ActionPlan,
    readResults: Record<string, any>
  ): Promise<ActionPlan> {
    const systemPrompt = this.buildSystemPromptForResolution();
    const fullUserPrompt = this.buildResolutionPrompt(
      userPrompt,
      context,
      previousPlan,
      readResults
    );

    console.log("[PlanGenerator] Generating resolved plan with context");

    const response = await this.llmProvider.generatePlan(
      systemPrompt,
      fullUserPrompt
    );

    return response;
  }

  /**
   * Build system prompt for plan resolution (when we have read step results)
   */
  private buildSystemPromptForResolution(): string {
    return `You are Wand, an intelligent Obsidian automation assistant. You are being called to COMPLETE a plan that was previously generated with placeholder values.

## Your Task

You previously generated a plan, but some steps had placeholder values. The read-only steps have now been executed and you have real data. Your job is to generate a COMPLETE plan with ACTUAL values - no more placeholders.

## Critical Requirements

1. **Use the provided data**: The results from read steps are provided below. Use these actual file paths, content, and other data.

2. **Generate complete write steps**: Now that you have real data, generate the write/modify steps with actual values.

3. **NO PLACEHOLDERS**: Every step must have real, concrete values. No "placeholder_path", "updated_content", or similar.

4. **Keep the same goal**: The plan should accomplish the same goal as before, just with real values.

## Available Tools

**Content Creation:**
- vault.ensureFolder: Create a folder structure
- vault.createFile: Create a new file with content
- editor.insertAtCursor: Add text at cursor position

**Content Modification:**
- vault.writeFile: Overwrite file contents
- editor.replaceSelection: Replace selected text
- vault.rename: Rename or move a file

**Potentially Destructive:**
- vault.delete: Remove a file or folder permanently

## Response Format

Output ONLY valid JSON matching this schema:

{
  "version": "1.0",
  "goal": "Same goal as before",
  "assumptions": ["Updated assumptions based on actual data"],
  "riskLevel": "read-only" | "writes" | "commands",
  "steps": [
    {
      "id": "step-1",
      "tool": "tool.name",
      "args": { "parameter": "ACTUAL_VALUE_NOT_PLACEHOLDER" },
      "preview": "Description of what this step does"
    }
  ]
}

IMPORTANT: Every value in args must be a real, concrete value based on the data provided.`;
  }

  /**
   * Build user prompt for plan resolution with read step results
   */
  private buildResolutionPrompt(
    userMessage: string,
    context: ExecutionContext,
    previousPlan: ActionPlan,
    readResults: Record<string, any>
  ): string {
    let prompt = `Original user request: "${userMessage}"

## Previous Plan Goal
${previousPlan.goal}

## Data from Read Steps
The following read operations were executed and returned these results:

`;

    for (const [stepId, result] of Object.entries(readResults)) {
      const step = previousPlan.steps.find(s => s.id === stepId);
      prompt += `### ${stepId}: ${step?.tool || "unknown"}\n`;
      prompt += `Arguments: ${JSON.stringify(step?.args || {})}\n`;
      prompt += `Result:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n\n`;
    }

    prompt += `## Current Context
- Active file: ${context.activeFile || "None"}
- Vault path: ${context.vaultPath}

## Your Task
Generate a COMPLETE plan to fulfill the original request. Use the ACTUAL data from the read steps above.

DO NOT use any placeholder values. Every path, every content value must be real and based on the data above.

If you need to write to multiple files, generate one step per file with the actual path and actual content.`;

    return prompt;
  }

  /**
   * Generate a short title from the goal
   */
  private generateTitle(goal: string): string {
    // Take first sentence or first 50 chars
    const firstSentence = goal.split(/[.!?]/)[0];
    const title = firstSentence.length > 50
      ? firstSentence.substring(0, 47) + "..."
      : firstSentence;

    return title.trim();
  }

  /**
   * Extract tags from prompt and action plan
   */
  private extractTags(prompt: string, actionPlan: ActionPlan): string[] {
    const tags: string[] = [];

    // Extract hashtags from prompt
    const hashtagMatches = prompt.match(/#[\w-]+/g);
    if (hashtagMatches) {
      tags.push(...hashtagMatches.map((tag) => tag.slice(1)));
    }

    // Add risk level as tag
    tags.push(actionPlan.riskLevel);

    // Add tool categories as tags
    const toolCategories = new Set<string>();
    actionPlan.steps.forEach((step) => {
      const category = step.tool.split(".")[0];
      toolCategories.add(category);
    });
    tags.push(...Array.from(toolCategories));

    return [...new Set(tags)]; // Remove duplicates
  }
}
