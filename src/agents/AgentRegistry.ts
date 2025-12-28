import { Agent, AgentDependencies } from "./Agent";

/**
 * Information about an agent type.
 * Used to display available agents in UI and documentation.
 */
export interface AgentInfo {
  /** Unique identifier for this agent type */
  type: string;
  /** Human-readable name */
  name: string;
  /** Description of what this agent does */
  description: string;
}

/**
 * Factory interface for creating agents.
 * Each agent type must provide a factory implementation.
 */
export interface AgentFactory {
  /**
   * Create a new instance of the agent.
   * @param deps - Dependencies required by the agent
   * @returns A new agent instance
   */
  create(deps: AgentDependencies): Agent;

  /**
   * Get information about this agent type.
   * @returns Agent metadata
   */
  getInfo(): AgentInfo;
}

/**
 * Registry for agent types.
 * Manages registration and creation of agents via factory pattern.
 *
 * Usage:
 * ```typescript
 * const registry = new AgentRegistry();
 * registry.register('wand', new WandAgentFactory());
 * const agent = registry.create('wand', dependencies);
 * ```
 */
export class AgentRegistry {
  private factories = new Map<string, AgentFactory>();

  /**
   * Register an agent factory.
   * @param type - Unique identifier for this agent type
   * @param factory - Factory instance for creating agents
   */
  register(type: string, factory: AgentFactory): void {
    if (this.factories.has(type)) {
      console.warn(`[AgentRegistry] Overwriting existing agent type: ${type}`);
    }
    this.factories.set(type, factory);
  }

  /**
   * Create an agent instance.
   * @param type - Agent type to create
   * @param deps - Dependencies to inject
   * @returns A new agent instance
   * @throws Error if agent type not found
   */
  create(type: string, deps: AgentDependencies): Agent {
    const factory = this.factories.get(type);
    if (!factory) {
      const available = Array.from(this.factories.keys()).join(", ");
      throw new Error(
        `Unknown agent type: "${type}". Available types: ${available || "none"}`
      );
    }
    return factory.create(deps);
  }

  /**
   * List all registered agent types.
   * @returns Array of agent information
   */
  list(): AgentInfo[] {
    return Array.from(this.factories.values()).map(f => f.getInfo());
  }

  /**
   * Check if an agent type is registered.
   * @param type - Agent type to check
   * @returns True if the type is registered
   */
  has(type: string): boolean {
    return this.factories.has(type);
  }
}
