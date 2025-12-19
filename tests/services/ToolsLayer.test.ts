import { ToolsLayer } from "../../src/services/ToolsLayer";
import { ExecutionContext, ToolName } from "../../src/types/ActionPlan";
import { App, TFile } from "obsidian";

// Helper to create a mock TFile that passes instanceof checks
function createMockTFile(path: string): TFile {
  const file = Object.create(TFile.prototype);
  file.path = path;
  file.name = path.split("/").pop() || path;
  const parts = file.name.split(".");
  file.extension = parts.length > 1 ? parts.pop() : "";
  file.basename = parts.join(".");
  file.stat = {
    ctime: Date.now(),
    mtime: Date.now(),
    size: 0,
  };
  file.vault = null;
  file.parent = null;
  return file;
}

describe("ToolsLayer", () => {
  let toolsLayer: ToolsLayer;
  let mockApp: App;
  let context: ExecutionContext;

  beforeEach(() => {
    mockApp = createMockApp();
    toolsLayer = new ToolsLayer(mockApp);
    context = {
      vaultPath: "/test/vault",
      variables: {},
      stepResults: new Map(),
      availableCommands: [],
    };
  });

  describe("vault.createFile", () => {
    it("should create a file with content", async () => {
      const mockFile = createMockTFile("test.md");
      mockApp.vault.create = jest.fn().mockResolvedValue(mockFile);

      const result = await toolsLayer.executeTool(
        "vault.createFile" as ToolName,
        { path: "test.md", content: "# Test" },
        context
      );

      expect(mockApp.vault.create).toHaveBeenCalledWith("test.md", "# Test");
      expect(result).toEqual({ path: "test.md" });
    });

    it("should ensure parent folder exists", async () => {
      const mockFile = createMockTFile("folder/test.md");
      mockApp.vault.create = jest.fn().mockResolvedValue(mockFile);
      mockApp.vault.createFolder = jest.fn().mockResolvedValue(undefined);

      await toolsLayer.executeTool(
        "vault.createFile" as ToolName,
        { path: "folder/test.md", content: "test" },
        context
      );

      // resolvePath adds .md to "folder" making it "folder.md"
      expect(mockApp.vault.createFolder).toHaveBeenCalledWith("folder.md");
    });
  });

  describe("editor.getSelection", () => {
    it("should return current selection", async () => {
      const mockEditor = {
        getSelection: jest.fn().mockReturnValue("selected text"),
      };
      mockApp.workspace.getActiveViewOfType = jest.fn().mockReturnValue({
        editor: mockEditor,
      });

      const result = await toolsLayer.executeTool(
        "editor.getSelection" as ToolName,
        {},
        context
      );

      expect(result).toEqual({ text: "selected text" });
    });

    it("should return empty string if no editor", async () => {
      mockApp.workspace.getActiveViewOfType = jest.fn().mockReturnValue(null);

      const result = await toolsLayer.executeTool(
        "editor.getSelection" as ToolName,
        {},
        context
      );

      expect(result).toEqual({ text: "" });
    });
  });

  describe("util.parseMarkdownBullets", () => {
    it("should parse bullet list", async () => {
      const text = `- First item
- Second item
- Third item`;

      const result = await toolsLayer.executeTool(
        "util.parseMarkdownBullets" as ToolName,
        { text },
        context
      );

      expect(result).toEqual({
        items: ["First item", "Second item", "Third item"],
      });
    });

    it("should handle empty input", async () => {
      const result = await toolsLayer.executeTool(
        "util.parseMarkdownBullets" as ToolName,
        { text: "" },
        context
      );

      expect(result).toEqual({ items: [] });
    });
  });

  describe("util.slugifyTitle", () => {
    it("should convert title to slug", async () => {
      const result = await toolsLayer.executeTool(
        "util.slugifyTitle" as ToolName,
        { title: "My Test Title!" },
        context
      );

      expect(result).toEqual({ slug: "my-test-title" });
    });

    it("should handle special characters", async () => {
      const result = await toolsLayer.executeTool(
        "util.slugifyTitle" as ToolName,
        { title: "File with spaces & symbols!" },
        context
      );

      expect(result).toEqual({ slug: "file-with-spaces-symbols" });
    });
  });

  describe("path sandboxing", () => {
    it("should block path traversal", async () => {
      await expect(
        toolsLayer.executeTool(
          "vault.readFile" as ToolName,
          { path: "../../../etc/passwd" },
          context
        )
      ).rejects.toThrow("Path traversal not allowed");
    });

    it("should add .md extension by default", async () => {
      const mockFile = createMockTFile("note.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
      mockApp.vault.read = jest.fn().mockResolvedValue("content");

      const result = await toolsLayer.executeTool(
        "vault.readFile" as ToolName,
        { path: "note" },
        context
      );

      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith("note.md");
      expect(result).toEqual({ path: "note.md", content: "content" });
    });
  });
});

function createMockApp(): App {
  const app = new App() as any;

  // Mock vault methods
  app.vault = {
    getAbstractFileByPath: jest.fn(),
    create: jest.fn(),
    read: jest.fn(),
    modify: jest.fn(),
    delete: jest.fn(),
    createFolder: jest.fn(),
    getMarkdownFiles: jest.fn(() => []),
  };

  // Mock workspace methods
  app.workspace = {
    getActiveViewOfType: jest.fn(),
    getActiveFile: jest.fn(),
    getLeaf: jest.fn(),
    getLeavesOfType: jest.fn(() => []),
  };

  // Mock fileManager
  app.fileManager = {
    renameFile: jest.fn(),
  };

  return app;
}
