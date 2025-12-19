import { ToolAgentSettings } from "../types/settings";
import { Step, ToolName } from "../types/ActionPlan";
import { minimatch } from "minimatch";

export type ApprovalDecision = "allow" | "deny" | "ask";

export interface ApprovalRequest {
  step: Step;
  reason: string;
  affectedPaths?: string[];
}

export interface ApprovalResult {
  decision: ApprovalDecision;
  reason: string;
  // If true, remember this decision for the session
  remember?: boolean;
  // If set, add tool to permanent allowlist
  addToAllowlist?: boolean;
}

export class ApprovalService {
  private settings: ToolAgentSettings;
  // Session-level approvals (tool -> decision)
  private sessionApprovals: Map<string, ApprovalDecision> = new Map();

  constructor(settings: ToolAgentSettings) {
    this.settings = settings;
  }

  updateSettings(settings: ToolAgentSettings) {
    this.settings = settings;
  }

  /**
   * Check if a step needs approval before execution
   */
  checkApproval(step: Step): ApprovalDecision {
    const tool = step.tool;

    // Mode: yolo = approve everything
    if (this.settings.approval.mode === "yolo") {
      return "allow";
    }

    // Check denied tools first (always blocked)
    if (this.settings.approval.deniedTools.includes(tool)) {
      return "deny";
    }

    // Mode: paranoid = ask for everything
    if (this.settings.approval.mode === "paranoid") {
      return "ask";
    }

    // Mode: ask (smart defaults)
    // Check session approvals
    if (this.settings.approval.sessionMemory) {
      const sessionDecision = this.sessionApprovals.get(tool);
      if (sessionDecision) {
        return sessionDecision;
      }
    }

    // Check permanent allowlist
    if (this.settings.approval.allowedTools.includes(tool)) {
      return "allow";
    }

    // Check path-based allowlist for file operations
    const path = this.getAffectedPath(step);
    if (path && this.isPathAllowed(path)) {
      return "allow";
    }

    // Default: ask for approval
    return "ask";
  }

  /**
   * Get the path affected by a step (if any)
   */
  private getAffectedPath(step: Step): string | null {
    const pathTools = [
      "vault.createFile",
      "vault.writeFile",
      "vault.readFile",
      "vault.delete",
      "vault.rename",
      "vault.ensureFolder",
    ];

    if (pathTools.includes(step.tool)) {
      return step.args?.path || null;
    }

    return null;
  }

  /**
   * Check if a path matches any allowed path patterns
   */
  private isPathAllowed(path: string): boolean {
    for (const pattern of this.settings.approval.allowedPaths) {
      if (minimatch(path, pattern, { matchBase: true })) {
        return true;
      }
    }
    return false;
  }

  /**
   * Record an approval decision for a tool
   */
  recordDecision(tool: string, decision: ApprovalDecision, options?: {
    remember?: boolean;
    addToAllowlist?: boolean;
  }) {
    // Add to session memory
    if (options?.remember && this.settings.approval.sessionMemory) {
      this.sessionApprovals.set(tool, decision);
    }

    // Add to permanent allowlist (requires external save)
    if (options?.addToAllowlist && decision === "allow") {
      if (!this.settings.approval.allowedTools.includes(tool)) {
        this.settings.approval.allowedTools.push(tool);
      }
    }
  }

  /**
   * Clear session approvals
   */
  clearSessionApprovals() {
    this.sessionApprovals.clear();
  }

  /**
   * Get a human-readable description of why a tool needs approval
   */
  getApprovalReason(step: Step): string {
    const tool = step.tool;
    const args = step.args || {};

    switch (tool) {
      case "vault.createFile":
        return `Create file: ${args.path}`;
      case "vault.writeFile":
        return `Overwrite file: ${args.path}`;
      case "vault.delete":
        return `Delete: ${args.path}`;
      case "vault.rename":
        return `Rename: ${args.from} → ${args.to}`;
      case "vault.ensureFolder":
        return `Create folder: ${args.path}`;
      case "editor.replaceSelection":
        return `Replace selected text`;
      case "editor.insertAtCursor":
        return `Insert text at cursor`;
      case "commands.run":
        return `Run command: ${args.commandId}`;
      default:
        return `Execute: ${tool}`;
    }
  }

  /**
   * Get the risk level for a tool
   */
  getToolRisk(tool: ToolName): "safe" | "moderate" | "dangerous" {
    const safeTools = [
      "vault.readFile",
      "vault.searchText",
      "vault.listFiles",
      "editor.getSelection",
      "editor.getActiveFilePath",
      "workspace.getContext",
      "workspace.openFile",
      "commands.list",
      "util.parseMarkdownBullets",
      "util.slugifyTitle",
    ];

    const dangerousTools = [
      "vault.delete",
      "vault.rename",
      "commands.run",
    ];

    if (safeTools.includes(tool)) return "safe";
    if (dangerousTools.includes(tool)) return "dangerous";
    return "moderate";
  }

  /**
   * Create an approval request that can be shown to the user
   */
  createApprovalRequest(step: Step): ApprovalRequest {
    return {
      step,
      reason: this.getApprovalReason(step),
      affectedPaths: this.getAffectedPath(step) ? [this.getAffectedPath(step)!] : undefined,
    };
  }

  /**
   * Check if the current settings allow a tool to be added to allowlist
   */
  canAddToAllowlist(): boolean {
    return this.settings.approval.mode === "ask";
  }

  /**
   * Get tools that are currently in session memory
   */
  getSessionApprovals(): Map<string, ApprovalDecision> {
    return new Map(this.sessionApprovals);
  }
}
