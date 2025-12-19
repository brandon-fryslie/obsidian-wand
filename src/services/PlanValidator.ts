import { ActionPlanSchema, StepSchemaType, ActionPlanSchemaType } from "../schemas/ActionPlanSchema";
import { TOOL_SCHEMAS } from "../schemas/toolSchemas";
import { validateVaultPath } from "../utils/pathValidation";

/**
 * Validation result for an ActionPlan
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary?: PlanSummary;
}

export interface ValidationError {
  type: "schema" | "tool" | "dependency" | "path" | "argument";
  message: string;
  stepId?: string;
  field?: string;
}

export interface ValidationWarning {
  type: "deprecation" | "performance" | "safety" | "risk-mismatch" | "placeholder";
  message: string;
  stepId?: string;
  field?: string;
}

export interface PlanSummary {
  goal: string;
  riskLevel: string;
  estimatedSteps: number;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  foldersCreated: string[];
  commandsExecuted: string[];
  toolsUsed: string[];
  hasLoops: boolean;
  hasDependencies: boolean;
  estimatedComplexity: "low" | "medium" | "high";
}

/**
 * Service for validating ActionPlans before execution
 */
export class PlanValidator {
  /**
   * Validates an ActionPlan comprehensively
   * @param plan - The plan object to validate (untyped input)
   * @returns Validation result with errors, warnings, and summary
   */
  validate(plan: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. Validate against Zod schema
    const schemaResult = ActionPlanSchema.safeParse(plan);

    if (!schemaResult.success) {
      // Convert Zod errors to our format
      schemaResult.error.errors.forEach((err) => {
        errors.push({
          type: "schema",
          message: `${err.path.join(".")}: ${err.message}`,
          field: err.path.join("."),
        });
      });

      return { valid: false, errors, warnings };
    }

    const validatedPlan = schemaResult.data;

    // 2. Validate all tools exist
    this.validateToolsExist(validatedPlan.steps, errors);

    // 3. Validate tool arguments against schemas
    this.validateToolArguments(validatedPlan.steps, errors);

    // 4. Validate dependencies form a valid DAG
    this.validateDependencies(validatedPlan.steps, errors);

    // 5. Validate path safety for vault tools
    this.validatePathSafety(validatedPlan.steps, errors, warnings);

    // 6. Generate summary
    const summary = this.generateSummary(validatedPlan);

    // 7. Add safety warnings based on risk level
    this.addSafetyWarnings(validatedPlan, summary, warnings);

    // 8. Validate risk level matches actual operations
    this.validateRiskLevel(validatedPlan, summary, warnings);

    // 9. Detect placeholder values in step arguments
    // These are warnings that trigger iterative resolution, not hard errors
    this.detectPlaceholders(validatedPlan.steps, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      summary,
    };
  }

  /**
   * Validates that all referenced tools exist in the registry
   */
  private validateToolsExist(steps: StepSchemaType[], errors: ValidationError[]): void {
    steps.forEach((step) => {
      if (!TOOL_SCHEMAS[step.tool]) {
        errors.push({
          type: "tool",
          message: `Unknown tool: ${step.tool}`,
          stepId: step.id,
        });
      }
    });
  }

  /**
   * Validates tool arguments against their schemas
   */
  private validateToolArguments(
    steps: StepSchemaType[],
    errors: ValidationError[]
  ): void {
    steps.forEach((step) => {
      const toolSchema = TOOL_SCHEMAS[step.tool];
      if (!toolSchema) {
        return; // Already reported as unknown tool
      }

      const result = toolSchema.inputSchema.safeParse(step.args);
      if (!result.success) {
        result.error.errors.forEach((err) => {
          errors.push({
            type: "argument",
            message: `Invalid argument for ${step.tool}: ${err.path.join(".")}: ${err.message}`,
            stepId: step.id,
            field: `args.${err.path.join(".")}`,
          });
        });
      }
    });
  }

  /**
   * Validates that step dependencies form a valid DAG (no cycles)
   */
  private validateDependencies(
    steps: StepSchemaType[],
    errors: ValidationError[]
  ): void {
    const stepIds = new Set(steps.map((s) => s.id));

    // Check all referenced dependencies exist
    steps.forEach((step) => {
      if (step.dependsOn) {
        step.dependsOn.forEach((depId) => {
          if (!stepIds.has(depId)) {
            errors.push({
              type: "dependency",
              message: `Step ${step.id} depends on non-existent step: ${depId}`,
              stepId: step.id,
            });
          }
        });
      }
    });

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      visited.add(stepId);
      recursionStack.add(stepId);

      const step = steps.find((s) => s.id === stepId);
      if (step?.dependsOn) {
        for (const depId of step.dependsOn) {
          if (!visited.has(depId)) {
            if (hasCycle(depId)) {
              return true;
            }
          } else if (recursionStack.has(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        if (hasCycle(step.id)) {
          errors.push({
            type: "dependency",
            message: `Circular dependency detected involving step: ${step.id}`,
            stepId: step.id,
          });
          break;
        }
      }
    }
  }

  /**
   * Validates path safety for vault operations
   */
  private validatePathSafety(
    steps: StepSchemaType[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const vaultTools = [
      "vault.ensureFolder",
      "vault.createFile",
      "vault.readFile",
      "vault.writeFile",
      "vault.rename",
      "vault.delete",
    ];

    steps.forEach((step) => {
      if (!vaultTools.includes(step.tool)) {
        return;
      }

      // Check path arguments
      const pathArgs = ["path", "fromPath", "toPath"];
      pathArgs.forEach((argName) => {
        const pathValue = step.args[argName];
        if (typeof pathValue === "string") {
          try {
            validateVaultPath(pathValue);
          } catch (err) {
            errors.push({
              type: "path",
              message: `Invalid path in ${step.tool}: ${err instanceof Error ? err.message : String(err)}`,
              stepId: step.id,
              field: `args.${argName}`,
            });
          }
        }
      });

      // Warn about delete operations
      if (step.tool === "vault.delete") {
        warnings.push({
          type: "safety",
          message: `Step ${step.id} will delete a file. Ensure user confirmation is enabled.`,
          stepId: step.id,
        });
      }
    });
  }

  /**
   * Generates a human-readable summary of the plan
   */
  private generateSummary(plan: ActionPlanSchemaType): PlanSummary {
    const toolsUsed = [...new Set(plan.steps.map((s) => s.tool))];
    const hasLoops = plan.steps.some((s) => s.foreach !== undefined);
    const hasDependencies = plan.steps.some(
      (s) => s.dependsOn && s.dependsOn.length > 0
    );

    // Extract file and folder operations
    const filesCreated: string[] = [];
    const filesModified: string[] = [];
    const filesDeleted: string[] = [];
    const foldersCreated: string[] = [];
    const commandsExecuted: string[] = [];

    plan.steps.forEach((step) => {
      const pathArg = step.args.path as string | undefined;

      switch (step.tool) {
        case "vault.createFile":
          if (pathArg) filesCreated.push(pathArg);
          break;
        case "vault.writeFile":
          // writeFile could be creating or modifying
          if (pathArg) filesModified.push(pathArg);
          break;
        case "vault.delete":
          if (pathArg) filesDeleted.push(pathArg);
          break;
        case "vault.ensureFolder":
          if (pathArg) foldersCreated.push(pathArg);
          break;
        case "commands.run":
          const commandId = step.args.id as string | undefined;
          if (commandId) commandsExecuted.push(commandId);
          break;
      }
    });

    // Estimate complexity
    let estimatedComplexity: "low" | "medium" | "high" = "low";
    if (plan.steps.length > 10 || hasLoops) {
      estimatedComplexity = "high";
    } else if (plan.steps.length > 5 || hasDependencies) {
      estimatedComplexity = "medium";
    }

    return {
      goal: plan.goal,
      riskLevel: plan.riskLevel,
      estimatedSteps: plan.steps.length,
      filesCreated,
      filesModified,
      filesDeleted,
      foldersCreated,
      commandsExecuted,
      toolsUsed,
      hasLoops,
      hasDependencies,
      estimatedComplexity,
    };
  }

  /**
   * Validates that the declared risk level matches actual operations
   */
  private validateRiskLevel(
    plan: ActionPlanSchemaType,
    summary: PlanSummary,
    warnings: ValidationWarning[]
  ): void {
    const hasWrites =
      summary.filesCreated.length > 0 ||
      summary.filesModified.length > 0 ||
      summary.filesDeleted.length > 0 ||
      summary.foldersCreated.length > 0;

    const hasCommands = summary.commandsExecuted.length > 0;

    // Check for risk level mismatches
    if (plan.riskLevel === "read-only" && hasWrites) {
      warnings.push({
        type: "risk-mismatch",
        message: `Plan declares "read-only" risk but performs ${summary.filesCreated.length + summary.filesModified.length + summary.filesDeleted.length + summary.foldersCreated.length} write operations`,
      });
    }

    if (plan.riskLevel === "read-only" && hasCommands) {
      warnings.push({
        type: "risk-mismatch",
        message: `Plan declares "read-only" risk but executes ${summary.commandsExecuted.length} commands`,
      });
    }

    if (plan.riskLevel === "writes" && hasCommands) {
      warnings.push({
        type: "risk-mismatch",
        message: `Plan declares "writes" risk but executes ${summary.commandsExecuted.length} commands - should be "commands"`,
      });
    }
  }

  /**
   * Adds safety warnings based on plan characteristics
   */
  private addSafetyWarnings(
    plan: ActionPlanSchemaType,
    summary: PlanSummary,
    warnings: ValidationWarning[]
  ): void {
    // Warn about command execution
    if (summary.commandsExecuted.length > 0) {
      warnings.push({
        type: "safety",
        message: `Plan includes ${summary.commandsExecuted.length} command(s). Ensure command permissions are configured correctly.`,
      });
    }

    // Warn about high complexity
    if (plan.steps.length > 20) {
      warnings.push({
        type: "performance",
        message: `Plan has ${plan.steps.length} steps. Consider breaking into smaller plans.`,
      });
    }

    // Warn about foreach without concurrency limit
    plan.steps.forEach((step) => {
      if (step.foreach && !step.foreach.concurrency) {
        warnings.push({
          type: "performance",
          message: `Step ${step.id} has foreach without concurrency limit. Will execute sequentially.`,
          stepId: step.id,
        });
      }
    });
  }

  /**
   * Detects placeholder values in step arguments that LLM may have generated
   */
  private detectPlaceholders(
    steps: StepSchemaType[],
    warnings: ValidationWarning[]
  ): void {
    // Patterns that indicate placeholder values
    const placeholderPatterns = [
      /^this will be (?:updated|filled|replaced|determined)/i,
      /^(?:updated|new|modified|actual)_?content/i,
      /^path_to_/i,
      /^(?:your|the)_/i,
      /\[.*(?:placeholder|insert|replace|fill).*\]/i,
      /\{.*(?:placeholder|insert|replace|fill).*\}/i,
      /^<.*>$/,  // Values like <content> or <path>
      /based on (?:the )?(?:analysis|results|previous|above)/i,
      /will be (?:determined|decided|set|preserved|added|inserted)/i,
      /to be (?:determined|decided|updated|preserved|added)/i,
      /^TBD$/i,
      /^TODO$/i,
      /^placeholder$/i,
      /^PLACEHOLDER$/i,
      /^placeholder_/i,  // Values like placeholder_path, placeholder_content
      /^xxx+$/i,
      /^___+$/i,
      // Common LLM placeholder phrases
      /content (?:will be |to be )?(?:preserved|added|inserted|updated)/i,
      /(?:original|existing|current) content (?:here|goes here|will be preserved)/i,
      /\.\.\.$/,  // Content ending with "..." often indicates truncation/placeholder
      /^#\s+\w+\s*\n+(?:content|text|body)/i,  // "# Title\n\nContent..." pattern
      /(?:insert|add|put) (?:content|text|tags?) here/i,
      /(?:file|note) content (?:here|goes here)/i,
      /rest of (?:the )?(?:content|file|document)/i,
      /remaining content/i,
      /\[\.\.\.?\]/,  // "[...]" or "[..]" patterns
      /^\.\.\.\s*$/,  // Just "..." on its own
      // Template expressions that reference other steps
      /#step-\d+\.output/i,  // References like #step-1.output
      /#step-\d+\./i,  // Any reference to another step's data
      /\$\{step-\d+/i,  // Template literals like ${step-1.output}
      /\{\{step-\d+/i,  // Handlebars-style templates
      // More LLM placeholder phrases
      /(?:while )?preserving (?:all |the )?(?:content|data|text)/i,  // "preserving all content"
      /will (?:be )?(?:replace|update|modify|change)/i,  // "will replace X with Y"
      /(?:replace|update|modify|change).+(?:while|with|and) preserv/i, // "replace X while preserving"
      /^(?:updated|modified|new) (?:content|file|version)/i,  // "Updated content for..."
      /(?:same|identical|existing) (?:as|to) (?:before|original)/i,  // "same as before"
      /^This (?:will|should|would)/i,  // Sentences describing what will happen instead of actual content
      /^(?:The|A|An) (?:new|updated|modified) (?:version|content)/i,  // Descriptions not content
    ];

    steps.forEach((step) => {
      this.checkArgsForPlaceholders(step.id, step.args, "", placeholderPatterns, warnings);
    });
  }

  /**
   * Recursively check arguments for placeholder patterns
   */
  private checkArgsForPlaceholders(
    stepId: string,
    args: Record<string, any>,
    prefix: string,
    patterns: RegExp[],
    warnings: ValidationWarning[]
  ): void {
    for (const [key, value] of Object.entries(args)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;

      if (typeof value === "string") {
        // Check if the string matches any placeholder pattern
        for (const pattern of patterns) {
          if (pattern.test(value)) {
            warnings.push({
              type: "placeholder",
              message: `Step "${stepId}" has a placeholder value in "${fieldPath}": "${this.truncateString(value, 60)}"`,
              stepId,
              field: `args.${fieldPath}`,
            });
            break; // Only report one warning per field
          }
        }
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        // Recursively check nested objects
        this.checkArgsForPlaceholders(stepId, value, fieldPath, patterns, warnings);
      }
    }
  }

  /**
   * Truncate a string for display
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + "...";
  }

  /**
   * Check if a validation result has placeholder warnings
   */
  hasPlaceholders(result: ValidationResult): boolean {
    return result.warnings.some(w => w.type === "placeholder");
  }

  /**
   * Get all placeholder warnings from a validation result
   */
  getPlaceholderWarnings(result: ValidationResult): ValidationWarning[] {
    return result.warnings.filter(w => w.type === "placeholder");
  }

  /**
   * Formats validation result as human-readable text
   */
  formatValidationResult(result: ValidationResult): string {
    const lines: string[] = [];

    if (result.summary) {
      lines.push("=== Plan Summary ===");
      lines.push(`Goal: ${result.summary.goal}`);
      lines.push(`Risk Level: ${result.summary.riskLevel}`);
      lines.push(`Steps: ${result.summary.estimatedSteps}`);
      lines.push(`Complexity: ${result.summary.estimatedComplexity}`);
      lines.push(`Tools: ${result.summary.toolsUsed.join(", ")}`);

      if (result.summary.filesCreated.length > 0) {
        lines.push(`Files to create: ${result.summary.filesCreated.join(", ")}`);
      }
      if (result.summary.filesModified.length > 0) {
        lines.push(`Files to modify: ${result.summary.filesModified.join(", ")}`);
      }
      if (result.summary.filesDeleted.length > 0) {
        lines.push(`Files to delete: ${result.summary.filesDeleted.join(", ")}`);
      }
      if (result.summary.foldersCreated.length > 0) {
        lines.push(`Folders to create: ${result.summary.foldersCreated.join(", ")}`);
      }
      if (result.summary.commandsExecuted.length > 0) {
        lines.push(`Commands to execute: ${result.summary.commandsExecuted.join(", ")}`);
      }
      lines.push("");
    }

    if (result.errors.length > 0) {
      lines.push("=== Errors ===");
      result.errors.forEach((err, i) => {
        lines.push(
          `${i + 1}. [${err.type}] ${err.message}${err.stepId ? ` (step: ${err.stepId})` : ""}`
        );
      });
      lines.push("");
    }

    if (result.warnings.length > 0) {
      lines.push("=== Warnings ===");
      result.warnings.forEach((warn, i) => {
        lines.push(
          `${i + 1}. [${warn.type}] ${warn.message}${warn.stepId ? ` (step: ${warn.stepId})` : ""}`
        );
      });
      lines.push("");
    }

    if (result.valid) {
      lines.push("✓ Plan is valid and ready for execution");
    } else {
      lines.push("✗ Plan has errors and cannot be executed");
    }

    return lines.join("\n");
  }
}
