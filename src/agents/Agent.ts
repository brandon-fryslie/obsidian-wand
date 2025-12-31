import { App } from "obsidian";
import { ToolAgentSettings, AgentConfig } from "../types/settings";
import { ActionPlan } from "../types/ActionPlan";
import { LLMProvider } from "../services/LLMProvider";
import { Executor } from "../services/Executor";
import { ToolsLayer } from "../services/ToolsLayer";
import { ApprovalService } from "../services/ApprovalService";

/**
 * Context provided to the agent for processing user requests.
 * Contains information about the current workspace state.
 */
export interface AgentContext {
  /** Path to the currently active file, if any */
  activeFile?: string;
  /** Currently selected text in the editor, if any */
  selection?: string;
  /** Root path of the vault */
  vaultPath: string;
}

/**
 * Response from the agent after processing a user message.
 * The type field determines how the response should be handled.
 */
export interface AgentResponse {
  /** Type of response: plan to execute, message to display, or error */
  type: "plan" | "message" | "error";
  /** Action plan to execute (when type is "plan") */
  plan?: ActionPlan;
  /** Message to display to user (when type is "message") */
  message?: string;
  /** Error message (when type is "error") */
  error?: string;
  /** Extended thinking content from Claude (optional) */
  thinking?: string;
}

/**
 * Current state of the agent.
 * Used to track agent activity and communicate status to the UI.
 */
export interface AgentState {
  /** Current status of the agent */
  status: "idle" | "thinking" | "executing" | "error";
  /** The plan currently being worked on, if any */
  currentPlan?: ActionPlan;
  /** Last error encountered, if any */
  lastError?: string;
}

/**
 * Dependencies required by all agents.
 * Injected during agent construction to enable testing and flexibility.
 */
export interface AgentDependencies {
  /** Obsidian app instance */
  app: App;
  /** Plugin settings */
  settings: ToolAgentSettings;
  /** Agent-specific configuration (tools and LLM overrides) */
  agentConfig: AgentConfig;
  /** LLM provider for generating plans and responses */
  llmProvider: LLMProvider;
  /** Executor for running action plans */
  executor: Executor;
  /** Tools layer for accessing Obsidian functionality */
  toolsLayer: ToolsLayer;
  /** Approval service for checking permissions */
  approvalService: ApprovalService;
}

/**
 * Agent interface defining the contract between agent implementations
 * and the plugin infrastructure.
 *
 * An Agent is responsible for:
 * - Understanding user requests
 * - Generating action plans
 * - Formatting responses
 * - Managing its own state
 *
 * The agent should NOT be responsible for:
 * - Executing plans (handled by Executor)
 * - Managing message history (handled by ChatController)
 * - Approval workflows (handled by ChatController + ApprovalService)
 * - UI rendering (handled by view components)
 */
export interface Agent {
  /**
   * Initialize the agent.
   * Called once when the agent is created.
   * Use this to set up any necessary state or resources.
   */
  initialize(): Promise<void>;

  /**
   * Process a user message and return a response.
   * This is the main entry point for agent functionality.
   *
   * @param message - The user's message/request
   * @param context - Current workspace context
   * @returns A response containing either a plan, message, or error
   */
  handleUserMessage(message: string, context: AgentContext): Promise<AgentResponse>;

  /**
   * Abort any in-progress operations.
   * Should cancel LLM calls and return to idle state.
   */
  abort(): void;

  /**
   * Clean up resources when the agent is being destroyed.
   * Called when the plugin is unloaded or agent is replaced.
   */
  cleanup(): void;

  /**
   * Get the agent's display name.
   * @returns Human-readable name for the agent
   */
  getName(): string;

  /**
   * Get a description of what this agent does.
   * @returns Human-readable description of agent capabilities
   */
  getDescription(): string;

  /**
   * Get the current state of the agent.
   * @returns Current agent state
   */
  getState(): AgentState;

  /**
   * Register a callback to be notified of state changes.
   * @param callback - Function to call when state changes
   */
  onStateChange(callback: (state: AgentState) => void): void;

  /**
   * Get the list of tools configured for this agent.
   * @returns Array of tool names this agent can use
   */
  getConfiguredTools(): string[];
}
