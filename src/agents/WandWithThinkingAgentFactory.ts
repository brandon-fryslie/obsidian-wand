import { Agent, AgentDependencies } from "./Agent";
import { AgentFactory, AgentInfo } from "./AgentRegistry";
import { WandWithThinkingAgent } from "./WandWithThinkingAgent";

/**
 * Factory for creating WandWithThinkingAgent instances.
 *
 * This agent uses direct Anthropic API calls with tool use to implement
 * an autonomous agent loop with extended thinking capabilities.
 */
export class WandWithThinkingAgentFactory implements AgentFactory {
  create(deps: AgentDependencies): Agent {
    return new WandWithThinkingAgent(deps);
  }

  getInfo(): AgentInfo {
    return {
      type: "wand-thinking",
      name: "Wand with Thinking",
      description: "Autonomous agent with extended thinking - multi-turn execution with reasoning",
    };
  }
}
