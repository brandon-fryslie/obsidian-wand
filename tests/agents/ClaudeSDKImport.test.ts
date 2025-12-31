/**
 * P0-1: SDK Import Compatibility Test
 *
 * Validates that @anthropic-ai/claude-agent-sdk can be imported in an Obsidian
 * plugin context (Electron renderer process) without errors.
 *
 * This is the first critical validation step. If this fails, the entire
 * SDK integration approach is invalid.
 */

describe("P0-1: Claude SDK Import Compatibility", () => {
  it("should import SDK core functions without errors", async () => {
    // This import will fail if SDK is incompatible with Electron/Jest environment
    const sdk = await import("@anthropic-ai/claude-agent-sdk");

    expect(sdk).toBeDefined();
    expect(sdk.query).toBeDefined();
    expect(sdk.createSdkMcpServer).toBeDefined();
    expect(typeof sdk.query).toBe("function");
    expect(typeof sdk.createSdkMcpServer).toBe("function");
  });

  it("should import tool helper function", async () => {
    const { tool } = await import("@anthropic-ai/claude-agent-sdk");

    expect(tool).toBeDefined();
    expect(typeof tool).toBe("function");
  });

  it("should be able to create a basic MCP server definition", async () => {
    const { createSdkMcpServer, tool } = await import("@anthropic-ai/claude-agent-sdk");
    const { z } = await import("zod");

    // Create a minimal MCP server with one tool
    const serverConfig = createSdkMcpServer({
      name: "test-server",
      version: "1.0.0",
      tools: [
        tool(
          "test_echo",
          "Echo back the input string",
          {
            message: z.string().describe("Message to echo"),
          },
          async (args) => {
            return {
              content: [{ type: "text", text: args.message }],
            };
          }
        ),
      ],
    });

    expect(serverConfig).toBeDefined();
    expect(serverConfig.name).toBe("test-server");

    // The instance property should exist (SDK creates it inline)
    expect(serverConfig.instance).toBeDefined();
  });

  it("should verify ObsidianMCPServer imports successfully", async () => {
    // This validates that our existing ObsidianMCPServer.ts can be imported
    // It already uses createSdkMcpServer, so this confirms SDK compatibility
    const { createObsidianMCPServer, OBSIDIAN_TOOL_NAMES } = await import(
      "../../src/agents/ObsidianMCPServer"
    );

    expect(createObsidianMCPServer).toBeDefined();
    expect(typeof createObsidianMCPServer).toBe("function");
    expect(OBSIDIAN_TOOL_NAMES).toBeDefined();
    expect(Array.isArray(OBSIDIAN_TOOL_NAMES)).toBe(true);
    expect(OBSIDIAN_TOOL_NAMES.length).toBeGreaterThan(40);
  });
});
