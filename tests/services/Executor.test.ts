import { Executor } from "../../src/services/Executor";
import { ToolsLayer } from "../../src/services/ToolsLayer";
import { ExecutionContext } from "../../src/types/ActionPlan";
import { App } from "obsidian";

describe("Executor", () => {
  let executor: Executor;
  let toolsLayer: ToolsLayer;
  let mockApp: App;
  let context: ExecutionContext;

  beforeEach(() => {
    mockApp = createMockApp();
    toolsLayer = new ToolsLayer(mockApp);
    executor = new Executor(toolsLayer);
    context = {
      vaultPath: "/test/vault",
      variables: {},
      stepResults: new Map(),
      availableCommands: [],
    };
  });

  describe("sequential execution", () => {
    it("should execute steps in order", async () => {
      const plan = {
        goal: "Sequential test",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "input.md" },
          },
          {
            id: "step2",
            tool: "vault.readFile" as const,
            args: { path: "output.md" },
          },
        ],
      };

      // Mock the tool execution
      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      executeSpy.mockResolvedValueOnce({ path: "input.md", content: "test1" });
      executeSpy.mockResolvedValueOnce({ path: "output.md", content: "test2" });

      const results = await executor.execute(plan, context);

      expect(results).toHaveLength(2);
      expect(results[0].stepId).toBe("step1");
      expect(results[0].success).toBe(true);
      expect(results[1].stepId).toBe("step2");
      expect(results[1].success).toBe(true);
    });

    it("should stop execution on error when onError is 'stop'", async () => {
      const plan = {
        goal: "Test error handling",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "input.md" },
            onError: "stop" as const,
          },
          {
            id: "step2",
            tool: "vault.readFile" as const,
            args: { path: "output.md" },
          },
        ],
      };

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      executeSpy.mockRejectedValueOnce(new Error("File not found"));

      const results = await executor.execute(plan, context);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain("File not found");
    });

    it("should continue execution when onError is 'skip'", async () => {
      const plan = {
        goal: "Test error skipping",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "input.md" },
            onError: "skip" as const,
          },
          {
            id: "step2",
            tool: "vault.readFile" as const,
            args: { path: "output.md" },
          },
        ],
      };

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      executeSpy.mockRejectedValueOnce(new Error("File not found"));
      executeSpy.mockResolvedValueOnce({ path: "output.md", content: "test" });

      const results = await executor.execute(plan, context);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });

    it("should track execution duration", async () => {
      const plan = {
        goal: "Timing test",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "input.md" },
          },
        ],
      };

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      executeSpy.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ path: "input.md", content: "test" }), 10);
          })
      );

      const results = await executor.execute(plan, context);

      expect(results[0].duration).toBeGreaterThan(0);
    });
  });

  describe("dependency resolution", () => {
    it("should execute steps respecting dependsOn", async () => {
      const plan = {
        goal: "Dependency test",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step2",
            tool: "vault.writeFile" as const,
            args: { path: "output.md", content: "processed" },
            dependsOn: ["step1"],
          },
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "input.md" },
          },
        ],
      };

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      const executionOrder: string[] = [];

      executeSpy.mockImplementation(async (_tool, args) => {
        executionOrder.push(args.path);
        return { path: args.path, content: "test" };
      });

      await executor.execute(plan, context);

      // step1 should execute before step2
      expect(executionOrder[0]).toBe("input.md");
      expect(executionOrder[1]).toBe("output.md");
    });

    it("should handle multiple dependencies", async () => {
      const plan = {
        goal: "Multi-dependency test",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "a.md" },
          },
          {
            id: "step2",
            tool: "vault.readFile" as const,
            args: { path: "b.md" },
          },
          {
            id: "step3",
            tool: "vault.writeFile" as const,
            args: { path: "c.md", content: "combined" },
            dependsOn: ["step1", "step2"],
          },
        ],
      };

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      executeSpy.mockResolvedValue({ path: "test", content: "test" });

      const results = await executor.execute(plan, context);

      expect(results).toHaveLength(3);
      expect(results[2].stepId).toBe("step3");
    });

    it("should wait for all dependencies before executing", async () => {
      const plan = {
        goal: "Dependency wait test",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "final",
            tool: "vault.writeFile" as const,
            args: { path: "final.md", content: "done" },
            dependsOn: ["a", "b", "c"],
          },
          {
            id: "a",
            tool: "vault.readFile" as const,
            args: { path: "a.md" },
          },
          {
            id: "b",
            tool: "vault.readFile" as const,
            args: { path: "b.md" },
          },
          {
            id: "c",
            tool: "vault.readFile" as const,
            args: { path: "c.md" },
          },
        ],
      };

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      const executionOrder: string[] = [];

      executeSpy.mockImplementation(async (_tool, args) => {
        executionOrder.push(args.path);
        return { path: args.path };
      });

      await executor.execute(plan, context);

      const finalIndex = executionOrder.indexOf("final.md");
      expect(finalIndex).toBe(3); // Should be last
    });
  });

  describe("foreach expansion", () => {
    it("should execute step for each item in array", async () => {
      const plan = {
        goal: "Foreach test",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "$vars.file" },
            foreach: {
              from: "files",
              itemName: "file",
            },
          },
        ],
      };

      context.variables.files = ["a.md", "b.md", "c.md"];

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      executeSpy.mockResolvedValue({ path: "test", content: "test" });

      const results = await executor.execute(plan, context);

      expect(results).toHaveLength(3);
      expect(executeSpy).toHaveBeenCalledTimes(3);
    });

    it("should provide item and index variables", async () => {
      const plan = {
        goal: "Foreach with index",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.writeFile" as const,
            args: {
              path: "$vars.file",
              content: "$vars.idx",
            },
            foreach: {
              from: "files",
              itemName: "file",
              indexName: "idx",
            },
          },
        ],
      };

      context.variables.files = ["a.md", "b.md"];

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      const capturedArgs: any[] = [];

      executeSpy.mockImplementation(async (_tool, args) => {
        capturedArgs.push({ ...args });
        return { path: args.path };
      });

      await executor.execute(plan, context);

      expect(capturedArgs[0].path).toBe("a.md");
      expect(capturedArgs[0].content).toBe(0);
      expect(capturedArgs[1].path).toBe("b.md");
      expect(capturedArgs[1].content).toBe(1);
    });

    it("should use default index name if not specified", async () => {
      const plan = {
        goal: "Foreach default index",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "$vars.file" },
            foreach: {
              from: "files",
              itemName: "file",
            },
          },
        ],
      };

      context.variables.files = ["a.md"];

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      let contextSnapshot: any;

      executeSpy.mockImplementation(async (_tool, args, ctx) => {
        contextSnapshot = { ...ctx.variables };
        return { path: args.path };
      });

      await executor.execute(plan, context);

      expect(contextSnapshot.index).toBe(0);
    });

    it("should handle empty arrays", async () => {
      const plan = {
        goal: "Empty foreach",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "$vars.file" },
            foreach: {
              from: "files",
              itemName: "file",
            },
          },
        ],
      };

      context.variables.files = [];

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");

      const results = await executor.execute(plan, context);

      expect(results).toHaveLength(0);
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("should fail gracefully if foreach path is not an array", async () => {
      const plan = {
        goal: "Invalid foreach",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "$vars.file" },
            foreach: {
              from: "notAnArray",
              itemName: "file",
            },
          },
        ],
      };

      context.variables.notAnArray = "string value";

      const results = await executor.execute(plan, context);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain("not an array");
    });
  });

  describe("variable interpolation", () => {
    it("should interpolate $steps.* references", async () => {
      const plan = {
        goal: "Variable interpolation",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "input.md" },
          },
          {
            id: "step2",
            tool: "vault.writeFile" as const,
            args: {
              path: "output.md",
              content: "$steps.step1.content",
            },
          },
        ],
      };

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      executeSpy.mockResolvedValueOnce({ path: "input.md", content: "Hello World" });
      let step2Args: any;
      executeSpy.mockImplementation(async (_tool, args) => {
        step2Args = args;
        return { path: args.path };
      });

      await executor.execute(plan, context);

      expect(step2Args.content).toBe("Hello World");
    });

    it("should interpolate $vars.* references", async () => {
      const plan = {
        goal: "Variable interpolation",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "$vars.filename" },
          },
        ],
      };

      context.variables.filename = "test.md";

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      let capturedArgs: any;
      executeSpy.mockImplementation(async (_tool, args) => {
        capturedArgs = args;
        return { path: args.path };
      });

      await executor.execute(plan, context);

      expect(capturedArgs.path).toBe("test.md");
    });

    it("should interpolate nested properties", async () => {
      const plan = {
        goal: "Nested interpolation",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.listFiles" as const,
            args: { prefix: "notes/" },
          },
          {
            id: "step2",
            tool: "vault.readFile" as const,
            args: { path: "$steps.step1.files.0" },
          },
        ],
      };

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      executeSpy.mockResolvedValueOnce({ files: ["notes/a.md", "notes/b.md"] });
      let step2Args: any;
      executeSpy.mockImplementation(async (_tool, args) => {
        step2Args = args;
        return { path: args.path };
      });

      await executor.execute(plan, context);

      expect(step2Args.path).toBe("notes/a.md");
    });

    it("should interpolate arrays", async () => {
      const plan = {
        goal: "Array interpolation",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { paths: ["$vars.file1", "$vars.file2"] },
          },
        ],
      };

      context.variables.file1 = "a.md";
      context.variables.file2 = "b.md";

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      let capturedArgs: any;
      executeSpy.mockImplementation(async (_tool, args) => {
        capturedArgs = args;
        return { result: "ok" };
      });

      await executor.execute(plan, context);

      expect(capturedArgs.paths).toEqual(["a.md", "b.md"]);
    });

    it("should interpolate nested objects", async () => {
      const plan = {
        goal: "Object interpolation",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.createFile" as const,
            args: {
              path: "$vars.path",
              content: "$vars.content",
              frontmatter: {
                title: "$vars.title",
                tags: ["$vars.tag1", "$vars.tag2"],
              },
            },
          },
        ],
      };

      context.variables.path = "note.md";
      context.variables.content = "# Note";
      context.variables.title = "My Note";
      context.variables.tag1 = "important";
      context.variables.tag2 = "todo";

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      let capturedArgs: any;
      executeSpy.mockImplementation(async (_tool, args) => {
        capturedArgs = args;
        return { path: args.path };
      });

      await executor.execute(plan, context);

      expect(capturedArgs.frontmatter.title).toBe("My Note");
      expect(capturedArgs.frontmatter.tags).toEqual(["important", "todo"]);
    });
  });

  describe("retry mechanism", () => {
    it("should retry on failure", async () => {
      const plan = {
        goal: "Retry test",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "test.md" },
            retry: {
              maxAttempts: 3,
              backoffMs: 10,
            },
          },
        ],
      };

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      let attemptCount = 0;
      executeSpy.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("Temporary failure");
        }
        return { path: "test.md", content: "success" };
      });

      const results = await executor.execute(plan, context);

      expect(attemptCount).toBe(3);
      expect(results[0].success).toBe(true);
    });

    it("should fail after max attempts", async () => {
      const plan = {
        goal: "Retry failure test",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "test.md" },
            retry: {
              maxAttempts: 2,
              backoffMs: 10,
            },
          },
        ],
      };

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      executeSpy.mockRejectedValue(new Error("Persistent failure"));

      const results = await executor.execute(plan, context);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain("Persistent failure");
      expect(executeSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("progress reporting", () => {
    it("should report progress during execution", async () => {
      const plan = {
        goal: "Progress test",
        assumptions: [],
        riskLevel: "writes" as const,
        steps: [
          {
            id: "step1",
            tool: "vault.readFile" as const,
            args: { path: "a.md" },
            preview: "Read file A",
          },
          {
            id: "step2",
            tool: "vault.readFile" as const,
            args: { path: "b.md" },
            preview: "Read file B",
          },
        ],
      };

      const executeSpy = jest.spyOn(toolsLayer, "executeTool");
      executeSpy.mockResolvedValue({ path: "test", content: "test" });

      const progressUpdates: any[] = [];
      const onProgress = (progress: any) => {
        progressUpdates.push({ ...progress });
      };

      await executor.execute(plan, context, onProgress);

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].currentStep).toBe(1);
      expect(progressUpdates[0].totalSteps).toBe(2);
      expect(progressUpdates[0].currentAction).toContain("Read file A");
    });
  });

  describe("undo journal", () => {
    it("should track operations in undo journal", async () => {
      const journal = executor.getUndoJournal();
      expect(journal).toEqual([]);
    });

    it("should clear undo journal", () => {
      executor.clearUndoJournal();
      expect(executor.getUndoJournal()).toEqual([]);
    });
  });
});
