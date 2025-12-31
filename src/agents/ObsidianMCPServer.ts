import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { App } from "obsidian";
import { ToolsLayer } from "../services/ToolsLayer";
import { ExecutionContext } from "../types/ActionPlan";

/**
 * Creates an MCP server that exposes Obsidian vault tools to the Claude Agent SDK.
 * This allows Claude Code's agent loop to operate on Obsidian vaults instead of filesystems.
 */
export function createObsidianMCPServer(app: App, toolsLayer: ToolsLayer) {
  // Default execution context for tool calls
  const getContext = (): ExecutionContext => ({
    vaultPath: (app.vault as any).adapter?.basePath || "",
    activeFile: app.workspace.getActiveFile()?.path,
    selection: undefined,
    variables: {},
    stepResults: new Map(),
    availableCommands: [],
  });

  return createSdkMcpServer({
    name: "obsidian-vault",
    version: "1.0.0",
    tools: [
      // ============================================
      // VAULT OPERATIONS (File System Equivalents)
      // ============================================

      tool(
        "vault_readFile",
        "Read the contents of a file from the Obsidian vault. Use this instead of the Read tool.",
        {
          path: z.string().describe("Path to the file relative to vault root (e.g., 'Daily Notes/2024-01-15.md')"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("vault.readFile", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "vault_writeFile",
        "Write or overwrite content to a file in the vault. Creates the file if it doesn't exist. Use this instead of the Write tool.",
        {
          path: z.string().describe("Path to the file relative to vault root"),
          content: z.string().describe("Content to write to the file"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("vault.writeFile", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "vault_createFile",
        "Create a new file in the vault. Fails if file already exists. Use this for new files.",
        {
          path: z.string().describe("Path for the new file relative to vault root"),
          content: z.string().describe("Initial content for the file"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("vault.createFile", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "vault_delete",
        "Delete a file or folder from the vault. Use with caution.",
        {
          path: z.string().describe("Path to the file or folder to delete"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("vault.delete", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "vault_rename",
        "Rename or move a file in the vault.",
        {
          oldPath: z.string().describe("Current path of the file"),
          newPath: z.string().describe("New path for the file"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("vault.rename", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "vault_listFiles",
        "List files in a folder. Use this instead of the Glob tool for vault navigation.",
        {
          path: z.string().optional().describe("Folder path (defaults to vault root if empty)"),
          recursive: z.boolean().optional().describe("Whether to list files recursively in subfolders"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("vault.listFiles", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "vault_searchText",
        "Search for text across all files in the vault. Use this instead of the Grep tool.",
        {
          query: z.string().describe("Text to search for (case-insensitive)"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("vault.searchText", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "vault_ensureFolder",
        "Create a folder if it doesn't exist. Use this instead of mkdir.",
        {
          path: z.string().describe("Folder path to ensure exists"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("vault.ensureFolder", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      // ============================================
      // EDITOR OPERATIONS
      // ============================================

      tool(
        "editor_getSelection",
        "Get the currently selected text in the active editor.",
        {},
        async () => {
          const result = await toolsLayer.executeTool("editor.getSelection", {}, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "editor_replaceSelection",
        "Replace the current selection with new text. Use this instead of Edit for selected text.",
        {
          text: z.string().describe("Text to replace the selection with"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("editor.replaceSelection", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "editor_insertAtCursor",
        "Insert text at the current cursor position.",
        {
          text: z.string().describe("Text to insert at cursor"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("editor.insertAtCursor", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "editor_getActiveFilePath",
        "Get the path of the currently active file in the editor.",
        {},
        async () => {
          const result = await toolsLayer.executeTool("editor.getActiveFilePath", {}, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      // ============================================
      // WORKSPACE OPERATIONS
      // ============================================

      tool(
        "workspace_openFile",
        "Open a file in the Obsidian editor.",
        {
          path: z.string().describe("Path to the file to open"),
          newLeaf: z.boolean().optional().describe("Whether to open in a new pane"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("workspace.openFile", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "workspace_getContext",
        "Get information about the current workspace state (active file, open files, etc).",
        {},
        async () => {
          const result = await toolsLayer.executeTool("workspace.getContext", {}, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      // ============================================
      // COMMAND OPERATIONS
      // ============================================

      tool(
        "commands_list",
        "List available Obsidian commands. Use to discover what actions are possible.",
        {
          query: z.string().optional().describe("Filter commands by name"),
          prefix: z.string().optional().describe("Filter by command ID prefix (e.g., 'editor:')"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("commands.list", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "commands_run",
        "Execute an Obsidian command by its ID. Powerful but use carefully.",
        {
          id: z.string().describe("Command ID to execute (e.g., 'editor:toggle-bold')"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("commands.run", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      // ============================================
      // DATAVIEW INTEGRATION
      // ============================================

      tool(
        "dataview_query",
        "Execute a Dataview DQL query. Requires Dataview plugin to be installed.",
        {
          dql: z.string().describe("Dataview Query Language query string"),
          originFile: z.string().optional().describe("File path for relative queries"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("dataview.query", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "dataview_pages",
        "Get pages matching a source filter. Requires Dataview plugin.",
        {
          source: z.string().optional().describe("Dataview source expression (e.g., '#tag' or '\"folder\"')"),
          where: z.record(z.any()).optional().describe("Additional field filters"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("dataview.pages", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "dataview_tasks",
        "Get tasks from the vault using Dataview. Requires Dataview plugin.",
        {
          completed: z.boolean().optional().describe("Filter by completion status"),
          source: z.string().optional().describe("Source filter expression"),
          tags: z.array(z.string()).optional().describe("Filter by task tags"),
          dueBefore: z.string().optional().describe("ISO date string - tasks due before this date"),
          dueAfter: z.string().optional().describe("ISO date string - tasks due after this date"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("dataview.tasks", { options: args }, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "dataview_status",
        "Check if Dataview plugin is available and get its status.",
        {},
        async () => {
          const result = await toolsLayer.executeTool("dataview.status", {}, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      // ============================================
      // TEMPLATER INTEGRATION
      // ============================================

      tool(
        "templater_status",
        "Check if Templater plugin is available.",
        {},
        async () => {
          const result = await toolsLayer.executeTool("templater.status", {}, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "templater_run",
        "Process a template and return the result. Requires Templater plugin.",
        {
          templatePath: z.string().describe("Path to the template file"),
          targetFile: z.string().optional().describe("Target file for template context"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("templater.run", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "templater_insert",
        "Insert a processed template at cursor position. Requires Templater plugin.",
        {
          templatePath: z.string().describe("Path to the template file"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("templater.insert", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "templater_create",
        "Create a new file from a template. Requires Templater plugin.",
        {
          templatePath: z.string().describe("Path to the template file"),
          outputPath: z.string().describe("Path for the new file"),
          openNote: z.boolean().optional().describe("Whether to open the created note"),
          folderPath: z.string().optional().describe("Folder for the new file"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("templater.create", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      // ============================================
      // TASKS PLUGIN INTEGRATION
      // ============================================

      tool(
        "tasks_status",
        "Check if Tasks plugin is available.",
        {},
        async () => {
          const result = await toolsLayer.executeTool("tasks.status", {}, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "tasks_create",
        "Create a new task using the Tasks plugin modal.",
        {
          openModal: z.boolean().optional().describe("Whether to open the task creation modal"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("tasks.create", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "tasks_toggle",
        "Toggle a task's completion status.",
        {
          line: z.string().describe("The task line text"),
          path: z.string().describe("Path to the file containing the task"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("tasks.toggle", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      // ============================================
      // ADVANCED TABLES INTEGRATION
      // ============================================

      tool(
        "advancedtables_status",
        "Check if Advanced Tables plugin is available.",
        {},
        async () => {
          const result = await toolsLayer.executeTool("advancedtables.status", {}, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "advancedtables_format",
        "Format markdown tables in the current file.",
        {
          allTables: z.boolean().optional().describe("Format all tables vs just current"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("advancedtables.format", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "advancedtables_insertRow",
        "Insert a new row in the current table.",
        {},
        async () => {
          const result = await toolsLayer.executeTool("advancedtables.insertRow", {}, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "advancedtables_insertColumn",
        "Insert a new column in the current table.",
        {},
        async () => {
          const result = await toolsLayer.executeTool("advancedtables.insertColumn", {}, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "advancedtables_sort",
        "Sort the current table by the selected column.",
        {
          direction: z.enum(["asc", "desc"]).describe("Sort direction"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("advancedtables.sort", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      // ============================================
      // EXCALIDRAW INTEGRATION
      // ============================================

      tool(
        "excalidraw_status",
        "Check if Excalidraw plugin is available.",
        {},
        async () => {
          const result = await toolsLayer.executeTool("excalidraw.status", {}, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "excalidraw_create",
        "Create a new Excalidraw drawing.",
        {
          filename: z.string().optional().describe("Name for the new drawing"),
          foldername: z.string().optional().describe("Folder for the new drawing"),
          templatePath: z.string().optional().describe("Template to use"),
          onNewPane: z.boolean().optional().describe("Open in new pane"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("excalidraw.create", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "excalidraw_exportSVG",
        "Export an Excalidraw drawing as SVG.",
        {
          drawingPath: z.string().optional().describe("Path to the drawing (uses active if not specified)"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("excalidraw.exportSVG", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "excalidraw_exportPNG",
        "Export an Excalidraw drawing as PNG.",
        {
          drawingPath: z.string().optional().describe("Path to the drawing (uses active if not specified)"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("excalidraw.exportPNG", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      // ============================================
      // UTILITY TOOLS
      // ============================================

      tool(
        "util_parseMarkdownBullets",
        "Parse bullet points from markdown text into a list.",
        {
          text: z.string().describe("Markdown text containing bullet points"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("util.parseMarkdownBullets", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),

      tool(
        "util_slugifyTitle",
        "Convert a title to a URL-safe slug.",
        {
          title: z.string().describe("Title to slugify"),
        },
        async (args) => {
          const result = await toolsLayer.executeTool("util.slugifyTitle", args, getContext());
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      ),
    ],
  });
}

/**
 * Get the list of all Obsidian tool names exposed via MCP.
 * These should be used with allowedTools in the Claude Agent SDK query options.
 */
export const OBSIDIAN_TOOL_NAMES = [
  // Vault operations
  "vault_readFile",
  "vault_writeFile",
  "vault_createFile",
  "vault_delete",
  "vault_rename",
  "vault_listFiles",
  "vault_searchText",
  "vault_ensureFolder",
  // Editor operations
  "editor_getSelection",
  "editor_replaceSelection",
  "editor_insertAtCursor",
  "editor_getActiveFilePath",
  // Workspace operations
  "workspace_openFile",
  "workspace_getContext",
  // Command operations
  "commands_list",
  "commands_run",
  // Dataview
  "dataview_query",
  "dataview_pages",
  "dataview_tasks",
  "dataview_status",
  // Templater
  "templater_status",
  "templater_run",
  "templater_insert",
  "templater_create",
  // Tasks
  "tasks_status",
  "tasks_create",
  "tasks_toggle",
  // Advanced Tables
  "advancedtables_status",
  "advancedtables_format",
  "advancedtables_insertRow",
  "advancedtables_insertColumn",
  "advancedtables_sort",
  // Excalidraw
  "excalidraw_status",
  "excalidraw_create",
  "excalidraw_exportSVG",
  "excalidraw_exportPNG",
  // Utilities
  "util_parseMarkdownBullets",
  "util_slugifyTitle",
] as const;

export type ObsidianToolName = (typeof OBSIDIAN_TOOL_NAMES)[number];

/**
 * Tool schemas for direct Anthropic API tool use.
 * These define the tools available to the ClaudeCodeAgent.
 */
export const OBSIDIAN_TOOL_SCHEMAS = [
  // Vault operations
  {
    name: "vault_readFile",
    description: "Read the contents of a file from the Obsidian vault.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file relative to vault root" },
      },
      required: ["path"],
    },
  },
  {
    name: "vault_writeFile",
    description: "Write or overwrite content to a file in the vault.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file relative to vault root" },
        content: { type: "string", description: "Content to write to the file" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "vault_createFile",
    description: "Create a new file in the vault. Fails if file already exists.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path for the new file" },
        content: { type: "string", description: "Initial content for the file" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "vault_delete",
    description: "Delete a file or folder from the vault.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file or folder to delete" },
      },
      required: ["path"],
    },
  },
  {
    name: "vault_rename",
    description: "Rename or move a file in the vault.",
    inputSchema: {
      type: "object",
      properties: {
        oldPath: { type: "string", description: "Current path of the file" },
        newPath: { type: "string", description: "New path for the file" },
      },
      required: ["oldPath", "newPath"],
    },
  },
  {
    name: "vault_listFiles",
    description: "List all files in a folder. Use to explore the vault structure.",
    inputSchema: {
      type: "object",
      properties: {
        folderPath: { type: "string", description: "Path to folder (empty for root)" },
        recursive: { type: "boolean", description: "Whether to list recursively" },
      },
      required: [],
    },
  },
  {
    name: "vault_searchText",
    description: "Search for text across the vault. Returns matching files.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        folder: { type: "string", description: "Optional folder to limit search" },
      },
      required: ["query"],
    },
  },
  {
    name: "vault_ensureFolder",
    description: "Create a folder if it doesn't exist.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the folder to create" },
      },
      required: ["path"],
    },
  },
  // Editor operations
  {
    name: "editor_getSelection",
    description: "Get the currently selected text in the editor.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "editor_replaceSelection",
    description: "Replace the current selection with new text.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to replace selection with" },
      },
      required: ["text"],
    },
  },
  {
    name: "editor_insertAtCursor",
    description: "Insert text at the current cursor position.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to insert" },
      },
      required: ["text"],
    },
  },
  {
    name: "editor_getActiveFilePath",
    description: "Get the path of the currently active file.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  // Workspace operations
  {
    name: "workspace_openFile",
    description: "Open a file in the editor.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file to open" },
        newLeaf: { type: "boolean", description: "Open in new pane" },
      },
      required: ["path"],
    },
  },
  {
    name: "workspace_getContext",
    description: "Get information about the current workspace context.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  // Command operations
  {
    name: "commands_list",
    description: "List all available Obsidian commands.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "commands_run",
    description: "Run an Obsidian command by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        commandId: { type: "string", description: "ID of the command to run" },
      },
      required: ["commandId"],
    },
  },
  // Dataview
  {
    name: "dataview_status",
    description: "Check if Dataview plugin is available.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "dataview_query",
    description: "Execute a Dataview query (DQL).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "DQL query to execute" },
      },
      required: ["query"],
    },
  },
  {
    name: "dataview_pages",
    description: "Get pages matching a source expression.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Source expression (folder, tag, etc.)" },
      },
      required: ["source"],
    },
  },
  {
    name: "dataview_tasks",
    description: "Get all tasks in the vault.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Optional source filter" },
        includeCompleted: { type: "boolean", description: "Include completed tasks" },
      },
      required: [],
    },
  },
  // Templater
  {
    name: "templater_status",
    description: "Check if Templater plugin is available.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "templater_run",
    description: "Execute Templater commands in the current file.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "templater_insert",
    description: "Insert a template at cursor position.",
    inputSchema: {
      type: "object",
      properties: {
        templatePath: { type: "string", description: "Path to template file" },
      },
      required: ["templatePath"],
    },
  },
  {
    name: "templater_create",
    description: "Create a new note from a template.",
    inputSchema: {
      type: "object",
      properties: {
        templatePath: { type: "string", description: "Path to template file" },
        filename: { type: "string", description: "Name for the new file" },
        folder: { type: "string", description: "Destination folder" },
      },
      required: ["templatePath"],
    },
  },
  // Tasks
  {
    name: "tasks_status",
    description: "Check if Tasks plugin is available.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "tasks_create",
    description: "Create a new task using the Tasks plugin.",
    inputSchema: {
      type: "object",
      properties: {
        openModal: { type: "boolean", description: "Open task creation modal" },
      },
      required: [],
    },
  },
  {
    name: "tasks_toggle",
    description: "Toggle a task's completion status.",
    inputSchema: {
      type: "object",
      properties: {
        line: { type: "string", description: "The task line text" },
        path: { type: "string", description: "Path to file containing the task" },
      },
      required: ["line", "path"],
    },
  },
  // Advanced Tables
  {
    name: "advancedtables_status",
    description: "Check if Advanced Tables plugin is available.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "advancedtables_format",
    description: "Format markdown tables in the current file.",
    inputSchema: {
      type: "object",
      properties: {
        allTables: { type: "boolean", description: "Format all tables" },
      },
      required: [],
    },
  },
  {
    name: "advancedtables_insertRow",
    description: "Insert a new row in the current table.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "advancedtables_insertColumn",
    description: "Insert a new column in the current table.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "advancedtables_sort",
    description: "Sort the current table by selected column.",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["asc", "desc"], description: "Sort direction" },
      },
      required: ["direction"],
    },
  },
  // Excalidraw
  {
    name: "excalidraw_status",
    description: "Check if Excalidraw plugin is available.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "excalidraw_create",
    description: "Create a new Excalidraw drawing.",
    inputSchema: {
      type: "object",
      properties: {
        filename: { type: "string", description: "Name for the drawing" },
        foldername: { type: "string", description: "Folder for the drawing" },
        templatePath: { type: "string", description: "Template to use" },
        onNewPane: { type: "boolean", description: "Open in new pane" },
      },
      required: [],
    },
  },
  {
    name: "excalidraw_exportSVG",
    description: "Export an Excalidraw drawing as SVG.",
    inputSchema: {
      type: "object",
      properties: {
        drawingPath: { type: "string", description: "Path to the drawing" },
      },
      required: [],
    },
  },
  {
    name: "excalidraw_exportPNG",
    description: "Export an Excalidraw drawing as PNG.",
    inputSchema: {
      type: "object",
      properties: {
        drawingPath: { type: "string", description: "Path to the drawing" },
      },
      required: [],
    },
  },
  // Utilities
  {
    name: "util_parseMarkdownBullets",
    description: "Parse bullet points from markdown text.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Markdown text with bullets" },
      },
      required: ["text"],
    },
  },
  {
    name: "util_slugifyTitle",
    description: "Convert a title to a URL-safe slug.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title to slugify" },
      },
      required: ["title"],
    },
  },
];
