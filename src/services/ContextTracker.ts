/**
 * ContextTracker - Estimates and tracks context window usage
 *
 * Provides a breakdown of token usage similar to Claude Code's /context command.
 * Uses a simple heuristic for token estimation (~4 chars per token for English).
 */

import { ChatMessage } from "./ChatController";
import { OBSIDIAN_TOOL_SCHEMAS } from "../agents/ObsidianMCPServer";

// Model context limits (in tokens)
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Claude models
  "claude-opus-4-20250514": 200000,
  "claude-opus-4-5-20251101": 200000,
  "claude-sonnet-4-20250514": 200000,
  "claude-sonnet-4-5-20251022": 200000,
  "claude-3-5-sonnet-20241022": 200000,
  "claude-3-5-haiku-20241022": 200000,
  "claude-3-opus-20240229": 200000,
  "claude-3-sonnet-20240229": 200000,
  "claude-3-haiku-20240307": 200000,
  // OpenAI models
  "gpt-4-turbo-preview": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4": 8192,
  "gpt-3.5-turbo": 16385,
  // Default fallback
  "default": 128000,
};

// Autocompact buffer (reserved for summarization overhead)
const AUTOCOMPACT_BUFFER_RATIO = 0.225; // 22.5% like Claude Code

export interface ContextBreakdown {
  model: string;
  contextLimit: number;

  // Token counts by category
  systemPrompt: number;
  toolDefinitions: number;
  mcpTools: number;
  messages: number;

  // Calculated values
  totalUsed: number;
  freeSpace: number;
  autocompactBuffer: number;

  // Percentages
  usagePercent: number;

  // Individual tool costs
  toolCosts: { name: string; tokens: number }[];

  // Message breakdown
  messageBreakdown: { role: string; tokens: number; count: number }[];
}

export class ContextTracker {
  private systemPromptTokens: number = 0;

  /**
   * Estimate tokens for a string using simple heuristic
   * ~4 characters per token for English text
   * JSON/code tends to be slightly more tokens per char
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    // More conservative estimate: ~3.5 chars per token for mixed content
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Set the system prompt for tracking
   */
  setSystemPrompt(prompt: string): void {
    this.systemPromptTokens = this.estimateTokens(prompt);
  }

  /**
   * Get context limit for a model
   */
  getContextLimit(model: string): number {
    // Try exact match first
    if (MODEL_CONTEXT_LIMITS[model]) {
      return MODEL_CONTEXT_LIMITS[model];
    }

    // Try partial match
    const lowerModel = model.toLowerCase();
    for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
      if (lowerModel.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerModel)) {
        return limit;
      }
    }

    return MODEL_CONTEXT_LIMITS["default"];
  }

  /**
   * Calculate tool definition tokens
   */
  calculateToolTokens(): { total: number; breakdown: { name: string; tokens: number }[] } {
    const breakdown: { name: string; tokens: number }[] = [];
    let total = 0;

    for (const tool of OBSIDIAN_TOOL_SCHEMAS) {
      const toolJson = JSON.stringify(tool);
      const tokens = this.estimateTokens(toolJson);
      breakdown.push({ name: tool.name, tokens });
      total += tokens;
    }

    // Sort by token count descending
    breakdown.sort((a, b) => b.tokens - a.tokens);

    return { total, breakdown };
  }

  /**
   * Calculate message tokens with breakdown by role
   */
  calculateMessageTokens(messages: ChatMessage[]): {
    total: number;
    breakdown: { role: string; tokens: number; count: number }[]
  } {
    const byRole: Record<string, { tokens: number; count: number }> = {
      user: { tokens: 0, count: 0 },
      assistant: { tokens: 0, count: 0 },
      system: { tokens: 0, count: 0 },
    };

    for (const msg of messages) {
      const tokens = this.estimateTokens(msg.content);
      const thinkingTokens = msg.thinking ? this.estimateTokens(msg.thinking) : 0;

      if (!byRole[msg.role]) {
        byRole[msg.role] = { tokens: 0, count: 0 };
      }

      byRole[msg.role].tokens += tokens + thinkingTokens;
      byRole[msg.role].count += 1;
    }

    const breakdown = Object.entries(byRole)
      .filter(([_, data]) => data.count > 0)
      .map(([role, data]) => ({ role, ...data }));

    const total = breakdown.reduce((sum, item) => sum + item.tokens, 0);

    return { total, breakdown };
  }

  /**
   * Get full context breakdown
   */
  getContextBreakdown(model: string, messages: ChatMessage[]): ContextBreakdown {
    const contextLimit = this.getContextLimit(model);
    const autocompactBuffer = Math.floor(contextLimit * AUTOCOMPACT_BUFFER_RATIO);
    const effectiveLimit = contextLimit - autocompactBuffer;

    const toolData = this.calculateToolTokens();
    const messageData = this.calculateMessageTokens(messages);

    const totalUsed = this.systemPromptTokens + toolData.total + messageData.total;
    const freeSpace = Math.max(0, effectiveLimit - totalUsed);
    const usagePercent = Math.round((totalUsed / contextLimit) * 100);

    return {
      model,
      contextLimit,

      systemPrompt: this.systemPromptTokens,
      toolDefinitions: 0, // Built-in tools (we don't have separate ones)
      mcpTools: toolData.total,
      messages: messageData.total,

      totalUsed,
      freeSpace,
      autocompactBuffer,

      usagePercent,

      toolCosts: toolData.breakdown,
      messageBreakdown: messageData.breakdown,
    };
  }

  /**
   * Format context breakdown for display (text version)
   */
  formatBreakdown(breakdown: ContextBreakdown): string {
    const lines: string[] = [];

    // Header with visual bar
    const barLength = 10;
    const filledBlocks = Math.round((breakdown.usagePercent / 100) * barLength);
    const bar = "⛁".repeat(filledBlocks) + "⛝".repeat(barLength - filledBlocks);

    lines.push("Context Usage");
    lines.push(`${bar}  ${breakdown.model}`);
    lines.push(`${this.formatTokens(breakdown.totalUsed)}/${this.formatTokens(breakdown.contextLimit)} tokens (${breakdown.usagePercent}%)`);
    lines.push("");

    // Category breakdown
    if (breakdown.systemPrompt > 0) {
      lines.push(`⛁ System prompt: ${this.formatTokens(breakdown.systemPrompt)} (${this.percent(breakdown.systemPrompt, breakdown.contextLimit)}%)`);
    }
    lines.push(`⛁ MCP tools: ${this.formatTokens(breakdown.mcpTools)} (${this.percent(breakdown.mcpTools, breakdown.contextLimit)}%)`);
    lines.push(`⛁ Messages: ${this.formatTokens(breakdown.messages)} (${this.percent(breakdown.messages, breakdown.contextLimit)}%)`);
    lines.push(`⛶ Free space: ${this.formatTokens(breakdown.freeSpace)} (${this.percent(breakdown.freeSpace, breakdown.contextLimit)}%)`);
    lines.push(`⛝ Autocompact buffer: ${this.formatTokens(breakdown.autocompactBuffer)} (${this.percent(breakdown.autocompactBuffer, breakdown.contextLimit)}%)`);

    // Message breakdown
    if (breakdown.messageBreakdown.length > 0) {
      lines.push("");
      lines.push("Messages by role:");
      for (const msg of breakdown.messageBreakdown) {
        lines.push(`  └ ${msg.role}: ${msg.count} messages, ${this.formatTokens(msg.tokens)} tokens`);
      }
    }

    // Top tools by token cost
    lines.push("");
    lines.push("MCP tools (top 10 by size):");
    for (const tool of breakdown.toolCosts.slice(0, 10)) {
      lines.push(`  └ ${tool.name}: ${this.formatTokens(tool.tokens)}`);
    }

    return lines.join("\n");
  }

  private formatTokens(tokens: number): string {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return `${tokens}`;
  }

  private percent(value: number, total: number): string {
    return ((value / total) * 100).toFixed(1);
  }
}

// Singleton instance
export const contextTracker = new ContextTracker();
