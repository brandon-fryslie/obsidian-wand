import { Agent, AgentDependencies } from "./Agent";
import { AgentFactory, AgentInfo } from "./AgentRegistry";
import { ClaudeCodeAgent } from "./ClaudeCodeAgent";

export class ClaudeCodeAgentFactory implements AgentFactory {
  create(deps: AgentDependencies): Agent {
    return new ClaudeCodeAgent(deps);
  }

  getInfo(): AgentInfo {
    return {
      type: "claude-code",
      name: "Claude Code Agent",
      description: "Full autonomous agent powered by official SDK (Experimental - P0 Validation)",
    };
  }
}
