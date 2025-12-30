import { Agent, AgentDependencies } from "./Agent";
import { AgentFactory, AgentInfo } from "./AgentRegistry";
import { MiniAgent } from "./MiniAgent";

/**
 * Factory for creating MiniAgent instances.
 */
export class MiniAgentFactory implements AgentFactory {
  create(deps: AgentDependencies): Agent {
    return new MiniAgent(deps);
  }

  getInfo(): AgentInfo {
    return {
      type: "mini",
      name: "Mini Agent",
      description: "Direct action agent - quick single-step execution with minimal planning",
    };
  }
}
