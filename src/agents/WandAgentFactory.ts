import { Agent, AgentDependencies } from "./Agent";
import { AgentFactory, AgentInfo } from "./AgentRegistry";
import { WandAgent } from "./WandAgent";

/**
 * Factory for creating WandAgent instances.
 */
export class WandAgentFactory implements AgentFactory {
  create(deps: AgentDependencies): Agent {
    return new WandAgent(deps);
  }

  getInfo(): AgentInfo {
    return {
      type: "wand",
      name: "Wand Agent",
      description: "Plan-based automation agent that breaks tasks into thoughtful, step-by-step plans",
    };
  }
}
