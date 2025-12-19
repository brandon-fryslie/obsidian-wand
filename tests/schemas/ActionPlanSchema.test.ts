import { ActionPlanSchema, StepSchema, ForEachSchema } from "../../src/schemas/ActionPlanSchema";

describe("ActionPlanSchema", () => {
  describe("valid plans", () => {
    it("should parse a minimal valid plan", () => {
      const plan = {
        version: "1.0",
        goal: "Create a test file",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.createFile",
            args: { path: "test.md", content: "# Test" },
          },
        ],
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.goal).toBe("Create a test file");
        expect(result.data.steps).toHaveLength(1);
      }
    });

    it("should parse a plan with all optional fields", () => {
      const plan = {
        version: "1.0.0",
        goal: "Complex operation",
        assumptions: ["User has write access", "Folder exists"],
        riskLevel: "commands",
        contextRequests: [
          { kind: "activeFilePath" },
          { kind: "selection" },
        ],
        defaults: {
          onError: "skip",
          retry: { maxAttempts: 3, backoffMs: 1000 },
        },
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: { path: "input.md" },
            preview: "Read input file",
            captureAs: "fileContent",
            onError: "stop",
            retry: { maxAttempts: 2, backoffMs: 500 },
            timeoutMs: 5000,
            tags: ["io", "read"],
          },
        ],
        outputs: {
          showCreatedFiles: true,
          showModifiedFiles: true,
          showCommandRuns: false,
        },
        uiHints: {
          title: "My Operation",
          summary: "This performs a complex operation",
        },
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assumptions).toHaveLength(2);
        expect(result.data.contextRequests).toHaveLength(2);
        expect(result.data.defaults?.onError).toBe("skip");
      }
    });

    it("should parse plan with foreach loops", () => {
      const plan = {
        version: "1.0",
        goal: "Process multiple files",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.listFiles",
            args: { prefix: "notes/" },
            captureAs: "fileList",
          },
          {
            id: "step2",
            tool: "vault.readFile",
            args: { path: "$vars.file" },
            foreach: {
              from: "fileList.files",
              itemName: "file",
              indexName: "idx",
              concurrency: 5,
            },
          },
        ],
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.steps[1].foreach).toBeDefined();
        expect(result.data.steps[1].foreach?.itemName).toBe("file");
      }
    });

    it("should parse plan with dependencies", () => {
      const plan = {
        version: "1.0",
        goal: "Sequential operations",
        riskLevel: "writes",
        steps: [
          {
            id: "createFolder",
            tool: "vault.ensureFolder",
            args: { path: "output" },
          },
          {
            id: "createFile",
            tool: "vault.createFile",
            args: { path: "output/result.md", content: "# Result" },
            dependsOn: ["createFolder"],
          },
        ],
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.steps[1].dependsOn).toContain("createFolder");
      }
    });
  });

  describe("invalid plans", () => {
    it("should reject missing required fields", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        // Missing riskLevel
        steps: [],
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it("should reject invalid version format", () => {
      const plan = {
        version: "v1.0", // Invalid format
        goal: "Test",
        riskLevel: "writes",
        steps: [{ id: "s1", tool: "vault.readFile", args: {} }],
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it("should reject empty goal", () => {
      const plan = {
        version: "1.0",
        goal: "",
        riskLevel: "writes",
        steps: [{ id: "s1", tool: "vault.readFile", args: {} }],
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it("should reject empty steps array", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [],
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it("should reject invalid risk level", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "dangerous", // Invalid value
        steps: [{ id: "s1", tool: "vault.readFile", args: {} }],
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it("should reject invalid tool name", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [{ id: "s1", tool: "invalid.tool", args: {} }],
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it("should reject invalid step ID format", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [{ id: "123-invalid", tool: "vault.readFile", args: {} }], // Cannot start with number
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it("should reject invalid onError value", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "s1",
            tool: "vault.readFile",
            args: {},
            onError: "ignore", // Invalid value
          },
        ],
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });
  });

  describe("StepSchema", () => {
    it("should validate step with all required fields", () => {
      const step = {
        id: "myStep",
        tool: "vault.readFile",
        args: { path: "test.md" },
      };

      const result = StepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should reject invalid step ID patterns", () => {
      // Regex: /^[A-Za-z][A-Za-z0-9_\-]*$/
      // Must start with letter, then letters/numbers/underscore/hyphen
      // Note: trailing hyphens ARE allowed by this regex
      const invalidIds = ["1step", "step.id", "step id", ""];

      invalidIds.forEach((id) => {
        const step = {
          id,
          tool: "vault.readFile",
          args: {},
        };
        const result = StepSchema.safeParse(step);
        expect(result.success).toBe(false);
      });
    });

    it("should accept valid step ID patterns", () => {
      const validIds = ["step1", "myStep", "step_1", "step-id", "a", "step-id-"];

      validIds.forEach((id) => {
        const step = {
          id,
          tool: "vault.readFile",
          args: {},
        };
        const result = StepSchema.safeParse(step);
        expect(result.success).toBe(true);
      });
    });

    it("should accept valid captureAs patterns", () => {
      const validNames = ["result", "result1", "my_result", "my-result", "result.data"];

      validNames.forEach((name) => {
        const step = {
          id: "step1",
          tool: "vault.readFile",
          args: {},
          captureAs: name,
        };
        const result = StepSchema.safeParse(step);
        expect(result.success).toBe(true);
      });
    });

    it("should validate retry policy", () => {
      const step = {
        id: "step1",
        tool: "vault.readFile",
        args: {},
        retry: {
          maxAttempts: 5,
          backoffMs: 1000,
        },
      };

      const result = StepSchema.safeParse(step);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.retry?.maxAttempts).toBe(5);
        expect(result.data.retry?.backoffMs).toBe(1000);
      }
    });

    it("should reject invalid retry policy", () => {
      const step = {
        id: "step1",
        tool: "vault.readFile",
        args: {},
        retry: {
          maxAttempts: 0, // Must be at least 1
          backoffMs: -100, // Cannot be negative
        },
      };

      const result = StepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });
  });

  describe("ForEachSchema", () => {
    it("should validate valid foreach configuration", () => {
      const foreach = {
        from: "results.items",
        itemName: "item",
        indexName: "i",
        concurrency: 10,
      };

      const result = ForEachSchema.safeParse(foreach);
      expect(result.success).toBe(true);
    });

    it("should reject invalid item name patterns", () => {
      // Regex: /^[A-Za-z][A-Za-z0-9_\-]*$/
      // Must start with letter, then letters/numbers/underscore/hyphen
      const invalidNames = ["1item", ""];

      invalidNames.forEach((itemName) => {
        const foreach = {
          from: "array",
          itemName,
        };
        const result = ForEachSchema.safeParse(foreach);
        expect(result.success).toBe(false);
      });
    });

    it("should accept valid item name patterns", () => {
      const validNames = ["item", "x", "element1", "my_item", "item-name", "item-name-"];

      validNames.forEach((itemName) => {
        const foreach = {
          from: "array",
          itemName,
        };
        const result = ForEachSchema.safeParse(foreach);
        expect(result.success).toBe(true);
      });
    });

    it("should require non-empty from path", () => {
      const foreach = {
        from: "",
        itemName: "item",
      };

      const result = ForEachSchema.safeParse(foreach);
      expect(result.success).toBe(false);
    });

    it("should make indexName and concurrency optional", () => {
      const foreach = {
        from: "array",
        itemName: "item",
      };

      const result = ForEachSchema.safeParse(foreach);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.indexName).toBeUndefined();
        expect(result.data.concurrency).toBeUndefined();
      }
    });

    it("should validate concurrency is positive", () => {
      const foreach = {
        from: "array",
        itemName: "item",
        concurrency: 0,
      };

      const result = ForEachSchema.safeParse(foreach);
      expect(result.success).toBe(false);
    });
  });

  describe("default values", () => {
    it("should apply default values for optional fields", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: {},
          },
        ],
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assumptions).toEqual([]);
        expect(result.data.contextRequests).toEqual([]);
        expect(result.data.defaults).toEqual({});
        // outputs has defaults defined in schema
        expect(result.data.outputs).toEqual({
          showCreatedFiles: true,
          showModifiedFiles: true,
          showCommandRuns: true,
        });
        expect(result.data.uiHints).toEqual({});
        expect(result.data.steps[0].dependsOn).toEqual([]);
        expect(result.data.steps[0].tags).toEqual([]);
      }
    });

    it("should apply default backoffMs for retry policy", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: {},
            retry: {
              maxAttempts: 3,
            },
          },
        ],
      };

      const result = ActionPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.steps[0].retry?.backoffMs).toBe(250);
      }
    });
  });
});
