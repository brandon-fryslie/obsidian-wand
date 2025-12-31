import { Agent, AgentDependencies } from "./Agent";
import { AgentFactory, AgentInfo } from "./AgentRegistry";
import { ClaudeCodeAgent } from "./ClaudeCodeAgent";

/**
 * Factory for creating ClaudeCodeAgent instances.
 *
 * The ClaudeCodeAgent uses the Claude Agent SDK to run Claude Code's
 * autonomous agent loop with Obsidian vault tools instead of filesystem tools.
 */
export class ClaudeCodeAgentFactory implements AgentFactory {
  create(deps: AgentDependencies): Agent {
    return new ClaudeCodeAgent(deps);
  }

  getInfo(): AgentInfo {
    return {
      type: "claude-code",
      name: "Claude Code Agent",
      description: "Full Claude Code agent with autonomous multi-step execution on your vault",
    };
  }
}
