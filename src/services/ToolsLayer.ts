import { App, TFile, TFolder, MarkdownView } from "obsidian";
import { ToolName, ExecutionContext, CommandInfo } from "../types/ActionPlan";
import { DataviewService } from "./DataviewService";
import { TemplaterService } from "./TemplaterService";
import { TasksService } from "./TasksService";
import { AdvancedTablesService } from "./AdvancedTablesService";
import { ExcalidrawService } from "./ExcalidrawService";
import { PluginManagerService } from "./PluginManagerService";
import { SkillService } from "./SkillService";

export class ToolsLayer {
  private app: App;
  private dataviewService: DataviewService;
  private templaterService: TemplaterService;
  private tasksService: TasksService;
  private advancedTablesService: AdvancedTablesService;
  private excalidrawService: ExcalidrawService;
  private pluginManagerService: PluginManagerService;
  private skillService: SkillService;

  constructor(app: App) {
    this.app = app;
    this.dataviewService = new DataviewService(app);
    this.templaterService = new TemplaterService(app);
    this.tasksService = new TasksService(app);
    this.advancedTablesService = new AdvancedTablesService(app);
    this.excalidrawService = new ExcalidrawService(app);
    this.pluginManagerService = new PluginManagerService(app);
    this.skillService = new SkillService(app, this.pluginManagerService);
  }

  /**
   * Initialize async services
   */
  async initialize(): Promise<void> {
    await this.skillService.initialize();
  }

  /**
   * Get the skill service for direct access
   */
  getSkillService(): SkillService {
    return this.skillService;
  }

  async executeTool(toolName: ToolName, args: any, context: ExecutionContext): Promise<any> {
    console.log(`[Wand] Executing tool: ${toolName}`, { args });
    const startTime = Date.now();

    try {
      const result = await this.executeToolInternal(toolName, args, context);
      console.log(`[Wand] Tool ${toolName} completed in ${Date.now() - startTime}ms`, { result });
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Wand] Tool ${toolName} failed after ${Date.now() - startTime}ms:`, errorMsg);
      throw error;
    }
  }

  private async executeToolInternal(toolName: ToolName, args: any, context: ExecutionContext): Promise<any> {
    switch (toolName) {
      // Vault operations
      case "vault.ensureFolder":
        return await this.ensureFolder(args.path, context);

      case "vault.createFile":
        return await this.createFile(args.path, args.content, context);

      case "vault.readFile":
        return await this.readFile(args.path, context);

      case "vault.writeFile":
        return await this.writeFile(args.path, args.content, context);

      case "vault.rename":
        return await this.rename(args.oldPath, args.newPath, context);

      case "vault.delete":
        return await this.delete(args.path, context);

      case "vault.searchText":
        return await this.searchText(args.query, args.options, context);

      case "vault.listFiles":
        // Support both 'path' and 'folder' arg names for flexibility
        return await this.listFiles(args.path || args.folder, args.recursive, context);

      // Editor operations
      case "editor.getSelection":
        return await this.getSelection(context);

      case "editor.replaceSelection":
        return await this.replaceSelection(args.text, context);

      case "editor.insertAtCursor":
        return await this.insertAtCursor(args.text, context);

      case "editor.getActiveFilePath":
        return await this.getActiveFilePath(context);

      // Workspace operations
      case "workspace.openFile":
        return await this.openFile(args.path, args.newLeaf, context);

      case "workspace.getContext":
        return await this.getWorkspaceContext(context);

      // Command operations
      case "commands.list":
        return await this.listCommands(args.query, args.prefix);

      case "commands.run":
        return await this.runCommand(args.id);

      // Dataview operations
      case "dataview.query":
        return await this.dataviewQuery(args.dql, args.originFile);

      case "dataview.pages":
        return await this.dataviewPages(args.source, args.where);

      case "dataview.tasks":
        return await this.dataviewTasks(args.options);

      case "dataview.status":
        return await this.dataviewStatus();

      // Templater operations
      case "templater.status":
        return await this.templaterStatus();

      case "templater.run":
        return await this.templaterRun(args.templatePath, args.targetFile);

      case "templater.insert":
        return await this.templaterInsert(args.templatePath);

      case "templater.create":
        return await this.templaterCreate(args.templatePath, args.outputPath, args.openNote, args.folderPath);

      // Tasks operations
      case "tasks.status":
        return await this.tasksStatus();

      case "tasks.create":
        return await this.tasksCreate(args.openModal);

      case "tasks.edit":
        return await this.tasksEdit(args.taskLine);

      case "tasks.toggle":
        return await this.tasksToggle(args.line, args.path);

      // Advanced Tables operations
      case "advancedtables.status":
        return await this.advancedTablesStatus();

      case "advancedtables.format":
        return await this.advancedTablesFormat(args.allTables);

      case "advancedtables.insertRow":
        return await this.advancedTablesInsertRow();

      case "advancedtables.insertColumn":
        return await this.advancedTablesInsertColumn();

      case "advancedtables.sort":
        return await this.advancedTablesSort(args.direction);

      case "advancedtables.align":
        return await this.advancedTablesAlign(args.alignment);

      // Excalidraw operations
      case "excalidraw.status":
        return await this.excalidrawStatus();

      case "excalidraw.create":
        return await this.excalidrawCreate(args.filename, args.foldername, args.templatePath, args.onNewPane);

      case "excalidraw.exportSVG":
        return await this.excalidrawExportSVG(args.drawingPath);

      case "excalidraw.exportPNG":
        return await this.excalidrawExportPNG(args.drawingPath);

      // Utility functions
      case "util.parseMarkdownBullets":
        return this.parseMarkdownBullets(args.text);

      case "util.slugifyTitle":
        return this.slugifyTitle(args.title);

      // Plugin Manager operations
      case "plugins.search":
        return await this.pluginsSearch(args.query, args.limit);

      case "plugins.list":
        return await this.pluginsList();

      case "plugins.install":
        return await this.pluginsInstall(args.pluginId);

      case "plugins.uninstall":
        return await this.pluginsUninstall(args.pluginId);

      case "plugins.enable":
        return await this.pluginsEnable(args.pluginId);

      case "plugins.disable":
        return await this.pluginsDisable(args.pluginId);

      // Skill operations
      case "skills.list":
        return await this.skillsList();

      case "skills.get":
        return await this.skillsGet(args.skillId);

      case "skills.generate":
        return await this.skillsGenerate(args.pluginId);

      case "skills.delete":
        return await this.skillsDelete(args.skillId);

      case "skills.refresh":
        return await this.skillsRefresh(args.skillId);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async listCommands(query?: string, prefix?: string): Promise<CommandInfo[]> {
    // Type assertion for internal API
    const commands = (this.app as any).commands?.commands || {};
    const commandList: CommandInfo[] = [];

    for (const [id, command] of Object.entries(commands)) {
      const cmd = command as any;
      if (prefix && !id.startsWith(prefix)) continue;
      if (query && !cmd.name?.toLowerCase().includes(query.toLowerCase())) continue;

      commandList.push({
        id,
        name: cmd.name || id,
        editorCallback: !!cmd.editorCallback,
        callback: cmd.callback,
      });
    }

    return commandList.sort((a, b) => a.name.localeCompare(b.name));
  }

  async runCommand(commandId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const commands = (this.app as any).commands;
      if (!commands) {
        return { ok: false, error: "Commands API not available" };
      }

      const command = commands.commands?.[commandId];
      if (!command) {
        return { ok: false, error: `Command not found: ${commandId}` };
      }

      // Execute the command
      commands.executeCommandById(commandId);

      return { ok: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { ok: false, error: errorMsg };
    }
  }

  private async ensureFolder(folderPath: string, _context: ExecutionContext): Promise<{ path: string; created: boolean }> {
    const fullPath = this.resolvePath(folderPath);

    try {
      const existing = this.app.vault.getAbstractFileByPath(fullPath);
      if (existing instanceof TFolder) {
        return { path: fullPath, created: false };
      }

      await this.app.vault.createFolder(fullPath);
      return { path: fullPath, created: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("Folder already exists")) {
        return { path: fullPath, created: false };
      }
      throw error;
    }
  }

  private async createFile(filePath: string, content: string, context: ExecutionContext): Promise<{ path: string }> {
    const fullPath = this.resolvePath(filePath);
    const dir = this.getParentPath(fullPath);

    // Ensure parent folder exists
    if (dir && dir !== ".") {
      await this.ensureFolder(dir, context);
    }

    const file = await this.app.vault.create(fullPath, content || "");
    return { path: file.path };
  }

  private async readFile(filePath: string, _context: ExecutionContext): Promise<{ path: string; content: string }> {
    const fullPath = this.resolvePath(filePath);
    const file = this.app.vault.getAbstractFileByPath(fullPath);

    if (!(file instanceof TFile)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const content = await this.app.vault.read(file);
    return { path: file.path, content };
  }

  private async writeFile(filePath: string, content: string, _context: ExecutionContext): Promise<{ path: string }> {
    const fullPath = this.resolvePath(filePath);
    const file = this.app.vault.getAbstractFileByPath(fullPath);

    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
      return { path: file.path };
    } else {
      // Create new file
      const newFile = await this.app.vault.create(fullPath, content || "");
      return { path: newFile.path };
    }
  }

  private async rename(oldPath: string, newPath: string, _context: ExecutionContext): Promise<{ from: string; to: string }> {
    const fullOldPath = this.resolvePath(oldPath);
    const fullNewPath = this.resolvePath(newPath);
    const file = this.app.vault.getAbstractFileByPath(fullOldPath);

    if (!file) {
      throw new Error(`File not found: ${fullOldPath}`);
    }

    await this.app.fileManager.renameFile(file, fullNewPath);
    return { from: fullOldPath, to: fullNewPath };
  }

  private async delete(filePath: string, _context: ExecutionContext): Promise<{ path: string }> {
    const fullPath = this.resolvePath(filePath);
    const file = this.app.vault.getAbstractFileByPath(fullPath);

    if (!file) {
      throw new Error(`File not found: ${fullPath}`);
    }

    await this.app.vault.delete(file);
    return { path: fullPath };
  }

  private async searchText(query: string, _options: any, _context: ExecutionContext): Promise<{ results: Array<{ path: string; matches: string[] }> }> {
    const results: Array<{ path: string; matches: string[] }> = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      const matches: string[] = [];

      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(query.toLowerCase())) {
          matches.push(`Line ${index + 1}: ${line.trim()}`);
        }
      });

      if (matches.length > 0) {
        results.push({ path: file.path, matches });
      }
    }

    return { results };
  }

  private async listFiles(folderPath: string | undefined, recursive: boolean = false, _context: ExecutionContext): Promise<{ files: string[] }> {
    // Default to root folder if no path provided
    console.log("[Wand:ToolsLayer] listFiles called with folderPath:", folderPath, "recursive:", recursive);
    const targetPath = folderPath || "/";
    // Handle various ways to specify root: "/", "", empty, undefined
    const isRoot = !targetPath || targetPath === "/" || targetPath === "";
    const fullPath = isRoot ? "" : this.resolvePath(targetPath);
    console.log("[Wand:ToolsLayer] listFiles targetPath:", targetPath, "isRoot:", isRoot, "fullPath:", fullPath);
    const folder = isRoot ? this.app.vault.getRoot() : this.app.vault.getAbstractFileByPath(fullPath);

    if (!folder || !(folder instanceof TFolder)) {
      throw new Error(`Folder not found: ${fullPath}`);
    }

    const files: string[] = [];
    const traverse = (folder: TFolder) => {
      for (const child of folder.children) {
        if (child instanceof TFile) {
          files.push(child.path);
        } else if (child instanceof TFolder && recursive) {
          traverse(child);
        }
      }
    };

    traverse(folder);
    return { files };
  }

  private async getSelection(_context: ExecutionContext): Promise<{ text: string }> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const selection = activeView?.editor?.getSelection();
    return { text: selection || "" };
  }

  private async replaceSelection(text: string, _context: ExecutionContext): Promise<{ replaced: string }> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.editor) {
      throw new Error("No active markdown editor");
    }

    const oldText = activeView.editor.getSelection();
    activeView.editor.replaceSelection(text);
    return { replaced: oldText || "" };
  }

  private async insertAtCursor(text: string, _context: ExecutionContext): Promise<{ inserted: string }> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.editor) {
      throw new Error("No active markdown editor");
    }

    const cursor = activeView.editor.getCursor();
    activeView.editor.replaceRange(text, cursor);
    return { inserted: text };
  }

  private async getActiveFilePath(_context: ExecutionContext): Promise<{ path: string }> {
    const activeFile = this.app.workspace.getActiveFile();
    return { path: activeFile?.path || "" };
  }

  private async openFile(filePath: string, newLeaf: boolean = false, _context: ExecutionContext): Promise<{ path: string }> {
    const fullPath = this.resolvePath(filePath);
    const file = this.app.vault.getAbstractFileByPath(fullPath);

    if (!(file instanceof TFile)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const leaf = this.app.workspace.getLeaf(newLeaf);
    await leaf.openFile(file);
    return { path: file.path };
  }

  private async getWorkspaceContext(_context: ExecutionContext): Promise<{ activeFile?: string; openFiles: string[] }> {
    const activeFile = this.app.workspace.getActiveFile()?.path;
    const openFiles = this.app.workspace.getLeavesOfType('markdown')
      .map(leaf => {
        const view = leaf.view;
        if (view instanceof MarkdownView) {
          return view.file?.path;
        }
        return undefined;
      })
      .filter((path): path is string => path !== undefined);

    return { activeFile, openFiles };
  }

  // Dataview tool implementations

  private async dataviewQuery(dql: string, originFile?: string): Promise<{
    type: string;
    values: any[];
    headers?: string[];
    available: boolean;
  }> {
    if (!this.dataviewService.isAvailable()) {
      return {
        type: "error",
        values: [],
        available: false,
      };
    }

    const result = await this.dataviewService.query(dql, originFile);
    return {
      ...result,
      available: true,
    };
  }

  private async dataviewPages(source?: string, where?: Record<string, any>): Promise<{
    pages: Array<{
      path: string;
      name: string;
      tags: string[];
      frontmatter: Record<string, any>;
      modified: string | null;
    }>;
    count: number;
    available: boolean;
  }> {
    if (!this.dataviewService.isAvailable()) {
      return {
        pages: [],
        count: 0,
        available: false,
      };
    }

    let pages = await this.dataviewService.pages(source);

    // Apply where filters if provided
    if (where) {
      pages = pages.filter((page) => {
        for (const [key, value] of Object.entries(where)) {
          // Check frontmatter
          if (page.frontmatter[key] !== value) {
            // Also check if it's a tag filter
            if (key === "tag" || key === "tags") {
              const tags = Array.isArray(value) ? value : [value];
              if (!tags.some((t: string) => page.tags.includes(t))) {
                return false;
              }
            } else {
              return false;
            }
          }
        }
        return true;
      });
    }

    return {
      pages: pages.map((p) => ({
        path: p.path,
        name: p.name,
        tags: p.tags,
        frontmatter: p.frontmatter,
        modified: p.modified?.toISOString() || null,
      })),
      count: pages.length,
      available: true,
    };
  }

  private async dataviewTasks(options?: {
    completed?: boolean;
    source?: string;
    tags?: string[];
    dueBefore?: string;
    dueAfter?: string;
  }): Promise<{
    tasks: Array<{
      text: string;
      completed: boolean;
      path: string;
      tags: string[];
      due?: string;
    }>;
    count: number;
    available: boolean;
  }> {
    if (!this.dataviewService.isAvailable()) {
      return {
        tasks: [],
        count: 0,
        available: false,
      };
    }

    const taskOptions = options
      ? {
          ...options,
          dueBefore: options.dueBefore ? new Date(options.dueBefore) : undefined,
          dueAfter: options.dueAfter ? new Date(options.dueAfter) : undefined,
        }
      : undefined;

    const tasks = await this.dataviewService.tasks(taskOptions);

    return {
      tasks: tasks.map((t) => ({
        text: t.text,
        completed: t.completed,
        path: t.path,
        tags: t.tags,
        due: t.due?.toISOString(),
      })),
      count: tasks.length,
      available: true,
    };
  }

  private async dataviewStatus(): Promise<{
    available: boolean;
    version?: string;
    indexed: boolean;
    pageCount?: number;
  }> {
    return this.dataviewService.getStatus();
  }

  // Templater tool implementations

  private async templaterStatus(): Promise<{
    available: boolean;
    enabled: boolean;
    templatesFolder?: string;
  }> {
    return this.templaterService.getStatus();
  }

  private async templaterRun(templatePath: string, targetFile?: string): Promise<{
    content: string;
    available: boolean;
  }> {
    if (!this.templaterService.isAvailable()) {
      return {
        content: "",
        available: false,
      };
    }

    // Get target file if specified
    let targetTFile: TFile | undefined;
    if (targetFile) {
      const file = this.app.vault.getAbstractFileByPath(targetFile);
      if (file instanceof TFile) {
        targetTFile = file;
      }
    }

    const content = await this.templaterService.runTemplate(templatePath, targetTFile);
    return {
      content,
      available: true,
    };
  }

  private async templaterInsert(templatePath: string): Promise<{
    success: boolean;
    content: string;
    available: boolean;
  }> {
    if (!this.templaterService.isAvailable()) {
      return {
        success: false,
        content: "",
        available: false,
      };
    }

    const result = await this.templaterService.insertTemplate(templatePath);
    return {
      ...result,
      available: true,
    };
  }

  private async templaterCreate(
    templatePath: string,
    outputPath: string,
    openNote: boolean = false,
    folderPath?: string
  ): Promise<{
    path: string;
    created: boolean;
    available: boolean;
  }> {
    if (!this.templaterService.isAvailable()) {
      return {
        path: "",
        created: false,
        available: false,
      };
    }

    const file = await this.templaterService.createFromTemplate(templatePath, outputPath, openNote, folderPath);
    return {
      path: file.path,
      created: true,
      available: true,
    };
  }

  // Tasks tool implementations

  private async tasksStatus(): Promise<{
    available: boolean;
    version?: string;
    enabled: boolean;
  }> {
    return this.tasksService.getStatus();
  }

  private async tasksCreate(_openModal?: boolean): Promise<{
    taskLine: string;
    created: boolean;
    available: boolean;
  }> {
    if (!this.tasksService.isAvailable()) {
      return {
        taskLine: "",
        created: false,
        available: false,
      };
    }

    const taskLine = await this.tasksService.createTask();
    return {
      taskLine,
      created: taskLine.length > 0,
      available: true,
    };
  }

  private async tasksEdit(taskLine: string): Promise<{
    editedLine: string;
    modified: boolean;
    available: boolean;
  }> {
    if (!this.tasksService.isAvailable()) {
      return {
        editedLine: "",
        modified: false,
        available: false,
      };
    }

    const editedLine = await this.tasksService.editTask(taskLine);
    return {
      editedLine,
      modified: editedLine.length > 0 && editedLine !== taskLine,
      available: true,
    };
  }

  private async tasksToggle(line: string, path: string): Promise<{
    newLine: string;
    toggled: boolean;
    available: boolean;
  }> {
    if (!this.tasksService.isAvailable()) {
      return {
        newLine: line,
        toggled: false,
        available: false,
      };
    }

    const newLine = this.tasksService.toggleTask(line, path);
    return {
      newLine,
      toggled: newLine !== line,
      available: true,
    };
  }

  // Advanced Tables tool implementations

  private async advancedTablesStatus(): Promise<{
    available: boolean;
    enabled: boolean;
  }> {
    return this.advancedTablesService.getStatus();
  }

  private async advancedTablesFormat(allTables?: boolean): Promise<{
    success: boolean;
    available: boolean;
  }> {
    if (!this.advancedTablesService.isAvailable()) {
      return {
        success: false,
        available: false,
      };
    }

    const success = await this.advancedTablesService.formatTable(allTables || false);
    return {
      success,
      available: true,
    };
  }

  private async advancedTablesInsertRow(): Promise<{
    success: boolean;
    available: boolean;
  }> {
    if (!this.advancedTablesService.isAvailable()) {
      return {
        success: false,
        available: false,
      };
    }

    const success = await this.advancedTablesService.insertRow();
    return {
      success,
      available: true,
    };
  }

  private async advancedTablesInsertColumn(): Promise<{
    success: boolean;
    available: boolean;
  }> {
    if (!this.advancedTablesService.isAvailable()) {
      return {
        success: false,
        available: false,
      };
    }

    const success = await this.advancedTablesService.insertColumn();
    return {
      success,
      available: true,
    };
  }

  private async advancedTablesSort(direction: "asc" | "desc"): Promise<{
    success: boolean;
    available: boolean;
  }> {
    if (!this.advancedTablesService.isAvailable()) {
      return {
        success: false,
        available: false,
      };
    }

    const success = direction === "asc"
      ? await this.advancedTablesService.sortAscending()
      : await this.advancedTablesService.sortDescending();

    return {
      success,
      available: true,
    };
  }

  private async advancedTablesAlign(alignment: "left" | "center" | "right"): Promise<{
    success: boolean;
    available: boolean;
  }> {
    if (!this.advancedTablesService.isAvailable()) {
      return {
        success: false,
        available: false,
      };
    }

    const success = await this.advancedTablesService.alignColumn(alignment);
    return {
      success,
      available: true,
    };
  }

  // Excalidraw tool implementations

  private async excalidrawStatus(): Promise<{
    available: boolean;
    enabled: boolean;
    version?: string;
  }> {
    return this.excalidrawService.getStatus();
  }

  private async excalidrawCreate(
    filename?: string,
    foldername?: string,
    templatePath?: string,
    onNewPane?: boolean
  ): Promise<{
    path: string;
    created: boolean;
    available: boolean;
  }> {
    if (!this.excalidrawService.isAvailable()) {
      return {
        path: "",
        created: false,
        available: false,
      };
    }

    const path = await this.excalidrawService.createDrawing({
      filename,
      foldername,
      templatePath,
      onNewPane,
    });

    return {
      path,
      created: true,
      available: true,
    };
  }

  private async excalidrawExportSVG(drawingPath?: string): Promise<{
    svg: string;
    available: boolean;
  }> {
    if (!this.excalidrawService.isAvailable()) {
      return {
        svg: "",
        available: false,
      };
    }

    const svg = await this.excalidrawService.exportToSVG(drawingPath);
    return {
      svg,
      available: true,
    };
  }

  private async excalidrawExportPNG(drawingPath?: string): Promise<{
    png: string;
    available: boolean;
  }> {
    if (!this.excalidrawService.isAvailable()) {
      return {
        png: "",
        available: false,
      };
    }

    const png = await this.excalidrawService.exportToPNG(drawingPath);
    return {
      png,
      available: true,
    };
  }

  // Utility methods

  private parseMarkdownBullets(text: string): { items: string[] } {
    const lines = text.split("\n");
    const items: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[-*+]\s+/)) {
        items.push(trimmed.replace(/^[-*+]\s+/, ""));
      }
    }

    return { items };
  }

  private slugifyTitle(title: string): { slug: string } {
    return {
      slug: title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
    };
  }

  private resolvePath(inputPath: string): string {
    // Remove any leading slashes
    let cleanedPath = inputPath.replace(/^[/\\]+/, "");

    // Prevent directory traversal
    if (cleanedPath.includes("..")) {
      throw new Error("Path traversal not allowed");
    }

    // If path doesn't have an extension, assume .md
    const ext = this.getExtension(cleanedPath);
    if (!ext && !cleanedPath.endsWith("/")) {
      cleanedPath += ".md";
    }

    return cleanedPath;
  }

  private getParentPath(filePath: string): string {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    if (lastSlash === -1) {
      return '.';
    }
    return filePath.substring(0, lastSlash);
  }

  private getExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    if (lastDot === -1 || lastDot < lastSlash) {
      return '';
    }
    return filePath.substring(lastDot);
  }

  async undoOperation(entry: any): Promise<void> {
    // Implementation for undo operations
    // This would store inverse operations for each tool execution
    console.log("Undo operation:", entry);
  }

  // Plugin Manager tool implementations

  private async pluginsSearch(query: string, limit?: number): Promise<{
    results: Array<{
      id: string;
      name: string;
      author: string;
      description: string;
      installed: boolean;
      enabled: boolean;
    }>;
    count: number;
  }> {
    const results = await this.pluginManagerService.searchPlugins(query, limit);
    return {
      results,
      count: results.length,
    };
  }

  private async pluginsList(): Promise<{
    plugins: Array<{
      id: string;
      name: string;
      version: string;
      enabled: boolean;
      author?: string;
      description?: string;
    }>;
    count: number;
  }> {
    const plugins = this.pluginManagerService.listInstalledPlugins();
    return {
      plugins,
      count: plugins.length,
    };
  }

  private async pluginsInstall(pluginId: string): Promise<{
    success: boolean;
    message: string;
    pluginId: string;
  }> {
    return await this.pluginManagerService.installPlugin(pluginId);
  }

  private async pluginsUninstall(pluginId: string): Promise<{
    success: boolean;
    message: string;
    pluginId: string;
  }> {
    return await this.pluginManagerService.uninstallPlugin(pluginId);
  }

  private async pluginsEnable(pluginId: string): Promise<{
    success: boolean;
    message: string;
    pluginId: string;
  }> {
    return await this.pluginManagerService.enablePlugin(pluginId);
  }

  private async pluginsDisable(pluginId: string): Promise<{
    success: boolean;
    message: string;
    pluginId: string;
  }> {
    return await this.pluginManagerService.disablePlugin(pluginId);
  }

  // Skill tool implementations

  private async skillsList(): Promise<{
    skills: Array<{
      id: string;
      name: string;
      description: string;
      pluginId?: string;
      tokenEstimate: number;
      updatedAt: string;
    }>;
    count: number;
  }> {
    const skills = await this.skillService.getSkills();
    return {
      skills: skills.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        pluginId: s.pluginId,
        tokenEstimate: s.tokenEstimate,
        updatedAt: s.updatedAt.toISOString(),
      })),
      count: skills.length,
    };
  }

  private async skillsGet(skillId: string): Promise<{
    found: boolean;
    skill?: {
      id: string;
      name: string;
      description: string;
      content: string;
      pluginId?: string;
      tokenEstimate: number;
    };
  }> {
    const skill = this.skillService.getSkill(skillId);
    if (!skill) {
      return { found: false };
    }
    return {
      found: true,
      skill: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        content: skill.content,
        pluginId: skill.pluginId,
        tokenEstimate: skill.tokenEstimate,
      },
    };
  }

  private async skillsGenerate(pluginId: string): Promise<{
    success: boolean;
    message: string;
    skill?: {
      id: string;
      name: string;
      tokenEstimate: number;
    };
  }> {
    try {
      const skill = await this.skillService.generateSkillFromPlugin(pluginId);
      return {
        success: true,
        message: `Generated skill for "${skill.name}" (~${skill.tokenEstimate} tokens)`,
        skill: {
          id: skill.id,
          name: skill.name,
          tokenEstimate: skill.tokenEstimate,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to generate skill: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async skillsDelete(skillId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await this.skillService.deleteSkill(skillId);
      return {
        success: true,
        message: `Deleted skill "${skillId}"`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete skill: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async skillsRefresh(skillId: string): Promise<{
    success: boolean;
    message: string;
    skill?: {
      id: string;
      name: string;
      tokenEstimate: number;
    };
  }> {
    try {
      const skill = await this.skillService.refreshSkill(skillId);
      return {
        success: true,
        message: `Refreshed skill "${skill.name}" (~${skill.tokenEstimate} tokens)`,
        skill: {
          id: skill.id,
          name: skill.name,
          tokenEstimate: skill.tokenEstimate,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to refresh skill: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
