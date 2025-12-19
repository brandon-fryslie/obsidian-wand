import { PlanValidator } from "../../src/services/PlanValidator";

describe("PlanValidator", () => {
  let validator: PlanValidator;

  beforeEach(() => {
    validator = new PlanValidator();
  });

  describe("valid plan validation", () => {
    it("should validate a simple valid plan", () => {
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

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.summary).toBeDefined();
      expect(result.summary?.goal).toBe("Create a test file");
    });

    it("should generate accurate summary", () => {
      const plan = {
        version: "1.0",
        goal: "Complex file operations",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.ensureFolder",
            args: { path: "output" },
          },
          {
            id: "step2",
            tool: "vault.createFile",
            args: { path: "output/file1.md", content: "# File 1" },
          },
          {
            id: "step3",
            tool: "vault.writeFile",
            args: { path: "output/file2.md", content: "# File 2" },
          },
          {
            id: "step4",
            tool: "vault.delete",
            args: { path: "old.md" },
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
      expect(result.summary).toBeDefined();

      if (result.summary) {
        expect(result.summary.estimatedSteps).toBe(4);
        expect(result.summary.foldersCreated).toContain("output");
        expect(result.summary.filesCreated).toContain("output/file1.md");
        expect(result.summary.filesModified).toContain("output/file2.md");
        expect(result.summary.filesDeleted).toContain("old.md");
        expect(result.summary.toolsUsed).toContain("vault.ensureFolder");
        expect(result.summary.toolsUsed).toContain("vault.createFile");
      }
    });

    it("should detect loops in summary", () => {
      const plan = {
        version: "1.0",
        goal: "Process multiple files",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.listFiles",
            args: { prefix: "notes/" },
            captureAs: "files",
          },
          {
            id: "step2",
            tool: "vault.readFile",
            args: { path: "$vars.file" },
            foreach: {
              from: "files",
              itemName: "file",
            },
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
      expect(result.summary?.hasLoops).toBe(true);
    });

    it("should detect dependencies in summary", () => {
      const plan = {
        version: "1.0",
        goal: "Sequential operations",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: { path: "input.md" },
          },
          {
            id: "step2",
            tool: "vault.writeFile",
            args: { path: "output.md", content: "processed" },
            dependsOn: ["step1"],
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
      expect(result.summary?.hasDependencies).toBe(true);
    });

    it("should estimate complexity correctly", () => {
      const lowComplexityPlan = {
        version: "1.0",
        goal: "Simple task",
        riskLevel: "writes",
        steps: [
          { id: "s1", tool: "vault.readFile", args: { path: "test.md" } },
        ],
      };

      const mediumComplexityPlan = {
        version: "1.0",
        goal: "Medium task",
        riskLevel: "writes",
        steps: Array.from({ length: 7 }, (_, i) => ({
          id: `step${i}`,
          tool: "vault.readFile",
          args: { path: `file${i}.md` },
        })),
      };

      const highComplexityPlan = {
        version: "1.0",
        goal: "Complex task",
        riskLevel: "writes",
        steps: Array.from({ length: 15 }, (_, i) => ({
          id: `step${i}`,
          tool: "vault.readFile",
          args: { path: `file${i}.md` },
        })),
      };

      expect(validator.validate(lowComplexityPlan).summary?.estimatedComplexity).toBe("low");
      expect(validator.validate(mediumComplexityPlan).summary?.estimatedComplexity).toBe("medium");
      expect(validator.validate(highComplexityPlan).summary?.estimatedComplexity).toBe("high");
    });
  });

  describe("schema validation", () => {
    it("should reject invalid schema", () => {
      const plan = {
        version: "invalid",
        goal: "Test",
        riskLevel: "unknown",
        steps: [],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.type === "schema")).toBe(true);
    });

    it("should provide clear error messages for schema violations", () => {
      const plan = {
        version: "1.0",
        goal: "",
        riskLevel: "writes",
        steps: [{ id: "s1", tool: "vault.readFile", args: {} }],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("goal"))).toBe(true);
    });
  });

  describe("tool validation", () => {
    it("should reject unknown tools", () => {
      // Unknown tools fail schema validation first, producing "schema" errors
      // The ToolNameSchema enum only allows specific tool names
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "unknown.tool",
            args: {},
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      // Schema validation catches unknown tools first
      expect(result.errors.some((e) => e.type === "schema")).toBe(true);
      expect(result.errors.some((e) => e.message.includes("tool"))).toBe(true);
    });

    it("should validate multiple unknown tools", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          { id: "s1", tool: "fake.tool1", args: {} },
          { id: "s2", tool: "fake.tool2", args: {} },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      // Schema validation catches these
      expect(result.errors.filter((e) => e.type === "schema")).toHaveLength(2);
    });
  });

  describe("tool argument validation", () => {
    it("should validate arguments against tool schema", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: {}, // Missing required 'path' argument
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.type === "argument")).toBe(true);
    });

    it("should validate correct arguments", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: { path: "test.md" },
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
    });

    it("should validate complex argument types", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.createFile",
            args: {
              path: "test.md",
              content: "# Test",
              ifNotExists: true,
            },
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
    });
  });

  describe("dependency validation", () => {
    it("should validate that referenced steps exist", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: { path: "test.md" },
            dependsOn: ["nonexistent"],
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.type === "dependency")).toBe(true);
      expect(result.errors.some((e) => e.message.includes("nonexistent"))).toBe(true);
    });

    it("should detect circular dependencies", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: { path: "a.md" },
            dependsOn: ["step2"],
          },
          {
            id: "step2",
            tool: "vault.readFile",
            args: { path: "b.md" },
            dependsOn: ["step1"],
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.type === "dependency")).toBe(true);
      expect(result.errors.some((e) => e.message.toLowerCase().includes("circular"))).toBe(true);
    });

    it("should detect complex circular dependencies", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: { path: "a.md" },
            dependsOn: ["step3"],
          },
          {
            id: "step2",
            tool: "vault.readFile",
            args: { path: "b.md" },
            dependsOn: ["step1"],
          },
          {
            id: "step3",
            tool: "vault.readFile",
            args: { path: "c.md" },
            dependsOn: ["step2"],
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.type === "dependency")).toBe(true);
    });

    it("should accept valid dependency chains", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: { path: "a.md" },
          },
          {
            id: "step2",
            tool: "vault.readFile",
            args: { path: "b.md" },
            dependsOn: ["step1"],
          },
          {
            id: "step3",
            tool: "vault.readFile",
            args: { path: "c.md" },
            dependsOn: ["step2"],
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
    });
  });

  describe("path safety validation", () => {
    it("should reject path traversal attempts", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: { path: "../../etc/passwd" },
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.type === "path")).toBe(true);
      expect(result.errors.some((e) => e.message.toLowerCase().includes("traversal"))).toBe(true);
    });

    it("should check all path arguments", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.rename",
            args: { fromPath: "safe.md", toPath: "../../../danger.md" },
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.type === "path")).toBe(true);
    });

    it("should warn about delete operations", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.delete",
            args: { path: "file.md" },
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.type === "safety")).toBe(true);
      expect(result.warnings.some((w) => w.message.toLowerCase().includes("delete"))).toBe(true);
    });

    it("should accept safe paths", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: { path: "notes/daily/2024-01-01.md" },
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
      expect(result.errors.filter((e) => e.type === "path")).toHaveLength(0);
    });
  });

  describe("risk level validation", () => {
    it("should warn when risk level doesn't match operations", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "read-only",
        steps: [
          {
            id: "step1",
            tool: "vault.createFile",
            args: { path: "test.md", content: "# Test" },
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.type === "risk-mismatch")).toBe(true);
    });

    it("should warn when read-only plan executes commands", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "read-only",
        steps: [
          {
            id: "step1",
            tool: "commands.run",
            args: { id: "editor:toggle-bold" },
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.type === "risk-mismatch")).toBe(true);
    });

    it("should warn when writes plan executes commands", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "commands.run",
            args: { id: "editor:toggle-bold" },
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.type === "risk-mismatch")).toBe(true);
      expect(
        result.warnings.some((w) => w.message.toLowerCase().includes('should be "commands"'))
      ).toBe(true);
    });

    it("should not warn when risk level matches operations", () => {
      const readOnlyPlan = {
        version: "1.0",
        goal: "Read files",
        riskLevel: "read-only",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: { path: "test.md" },
          },
        ],
      };

      const writesPlan = {
        version: "1.0",
        goal: "Create files",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.createFile",
            args: { path: "test.md", content: "# Test" },
          },
        ],
      };

      const commandsPlan = {
        version: "1.0",
        goal: "Execute commands",
        riskLevel: "commands",
        steps: [
          {
            id: "step1",
            tool: "commands.run",
            args: { id: "editor:toggle-bold" },
          },
        ],
      };

      expect(
        validator.validate(readOnlyPlan).warnings.filter((w) => w.type === "risk-mismatch")
      ).toHaveLength(0);
      expect(
        validator.validate(writesPlan).warnings.filter((w) => w.type === "risk-mismatch")
      ).toHaveLength(0);
      expect(
        validator.validate(commandsPlan).warnings.filter((w) => w.type === "risk-mismatch")
      ).toHaveLength(0);
    });
  });

  describe("safety warnings", () => {
    it("should warn about command execution", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "commands",
        steps: [
          {
            id: "step1",
            tool: "commands.run",
            args: { id: "editor:toggle-bold" },
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.warnings.some((w) => w.type === "safety")).toBe(true);
      expect(result.warnings.some((w) => w.message.toLowerCase().includes("command"))).toBe(true);
    });

    it("should warn about high step count", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: Array.from({ length: 25 }, (_, i) => ({
          id: `step${i}`,
          tool: "vault.readFile",
          args: { path: `file${i}.md` },
        })),
      };

      const result = validator.validate(plan);
      expect(result.warnings.some((w) => w.type === "performance")).toBe(true);
    });

    it("should warn about foreach without concurrency limit", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: { path: "$vars.file" },
            foreach: {
              from: "files",
              itemName: "file",
            },
          },
        ],
      };

      const result = validator.validate(plan);
      expect(result.warnings.some((w) => w.type === "performance")).toBe(true);
      expect(result.warnings.some((w) => w.message.toLowerCase().includes("concurrency"))).toBe(
        true
      );
    });
  });

  describe("formatValidationResult", () => {
    it("should format valid result with summary", () => {
      const plan = {
        version: "1.0",
        goal: "Create test file",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.createFile",
            args: { path: "test.md", content: "# Test" },
          },
        ],
      };

      const result = validator.validate(plan);
      const formatted = validator.formatValidationResult(result);

      expect(formatted).toContain("Plan Summary");
      expect(formatted).toContain("Create test file");
      expect(formatted).toContain("✓ Plan is valid");
    });

    it("should format errors clearly", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "writes",
        steps: [
          {
            id: "step1",
            tool: "vault.readFile",
            args: {}, // Missing path
          },
        ],
      };

      const result = validator.validate(plan);
      const formatted = validator.formatValidationResult(result);

      expect(formatted).toContain("Errors");
      expect(formatted).toContain("✗ Plan has errors");
    });

    it("should format warnings", () => {
      const plan = {
        version: "1.0",
        goal: "Test",
        riskLevel: "read-only",
        steps: [
          {
            id: "step1",
            tool: "vault.createFile",
            args: { path: "test.md", content: "# Test" },
          },
        ],
      };

      const result = validator.validate(plan);
      const formatted = validator.formatValidationResult(result);

      expect(formatted).toContain("Warnings");
      expect(formatted).toContain("risk-mismatch");
    });
  });
});
