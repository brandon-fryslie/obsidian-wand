import { z } from "zod";

/**
 * Tool input/output schemas for validation
 * Based on PROJECT_SPEC/tool-input-output-schema-conventions.md
 */

// Common field schemas
const PathSchema = z.string().min(1);
const PathsSchema = z.array(z.string().min(1));

// ============================================================================
// VAULT TOOLS
// ============================================================================

// vault.ensureFolder
export const VaultEnsureFolderInputSchema = z.object({
  path: PathSchema,
});

export const VaultEnsureFolderOutputSchema = z.object({
  path: PathSchema,
  created: z.boolean(),
});

// vault.listFiles
export const VaultListFilesInputSchema = z.object({
  prefix: z.string().optional(),
  recursive: z.boolean().optional(),
  extensions: z.array(z.string()).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export const FileEntrySchema = z.object({
  path: PathSchema,
  kind: z.enum(["file", "folder"]),
  sizeBytes: z.number().int().nonnegative().optional(),
  mtimeMs: z.number().int().nonnegative().optional(),
  ctimeMs: z.number().int().nonnegative().optional(),
  etag: z.string().optional(),
});

export const VaultListFilesOutputSchema = z.object({
  items: z.array(FileEntrySchema),
  nextOffset: z.number().int().nonnegative().optional(),
  truncated: z.boolean(),
});

// vault.readFile
export const VaultReadFileInputSchema = z.object({
  path: PathSchema,
  maxBytes: z.number().int().positive().optional(),
  range: z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  }).optional(),
  as: z.enum(["text", "base64"]).default("text"),
});

export const VaultReadFileOutputSchema = z.object({
  path: PathSchema,
  content: z.string(),
  etag: z.string().optional(),
  mtimeMs: z.number().int().nonnegative().optional(),
  truncated: z.boolean().optional(),
  encoding: z.string().optional(),
});

// vault.createFile
export const VaultCreateFileInputSchema = z.object({
  path: PathSchema,
  content: z.string(),
  ifNotExists: z.boolean().default(true),
  collisionStrategy: z.enum(["error", "create-unique", "overwrite"]).optional(),
  frontmatter: z.record(z.any()).optional(),
});

export const VaultCreateFileOutputSchema = z.object({
  path: PathSchema,
  created: z.boolean(),
  etag: z.string().optional(),
  mtimeMs: z.number().int().nonnegative().optional(),
});

// vault.writeFile
export const VaultWriteFileInputSchema = z.object({
  path: PathSchema,
  content: z.string(),
  mode: z.enum(["overwrite", "append"]).optional(),
  expectedEtag: z.string().optional(),
});

export const VaultWriteFileOutputSchema = z.object({
  path: PathSchema,
  etag: z.string().optional(),
  mtimeMs: z.number().int().nonnegative().optional(),
  bytesWritten: z.number().int().nonnegative().optional(),
});

// vault.rename
export const VaultRenameInputSchema = z.object({
  fromPath: PathSchema,
  toPath: PathSchema,
  collisionStrategy: z.enum(["error", "overwrite", "create-unique"]).optional(),
});

export const VaultRenameOutputSchema = z.object({
  fromPath: PathSchema,
  toPath: PathSchema,
});

// vault.delete
export const VaultDeleteInputSchema = z.object({
  path: PathSchema,
  trash: z.boolean().default(true),
  requireExists: z.boolean().default(true),
});

export const VaultDeleteOutputSchema = z.object({
  path: PathSchema,
  deleted: z.boolean(),
  trashed: z.boolean().optional(),
});

// vault.searchText
export const VaultSearchTextInputSchema = z.object({
  query: z.string(),
  mode: z.enum(["plain", "regex"]).default("plain"),
  paths: PathsSchema.optional(),
  caseSensitive: z.boolean().optional(),
  limit: z.number().int().positive().default(50),
  snippetLength: z.number().int().positive().default(120),
});

export const SearchMatchSchema = z.object({
  path: PathSchema,
  line: z.number().int().nonnegative().optional(),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
  snippet: z.string(),
});

export const VaultSearchTextOutputSchema = z.object({
  matches: z.array(SearchMatchSchema),
  truncated: z.boolean(),
});

// ============================================================================
// EDITOR TOOLS
// ============================================================================

export const EditorRangeSchema = z.object({
  from: z.object({
    line: z.number().int().nonnegative(),
    ch: z.number().int().nonnegative(),
  }),
  to: z.object({
    line: z.number().int().nonnegative(),
    ch: z.number().int().nonnegative(),
  }),
});

// editor.getSelection
export const EditorGetSelectionInputSchema = z.object({});

export const EditorGetSelectionOutputSchema = z.object({
  text: z.string(),
  isEmpty: z.boolean(),
  range: EditorRangeSchema.optional(),
  filePath: z.string().optional(),
  mode: z.enum(["source", "preview", "unknown"]).optional(),
});

// editor.replaceSelection
export const EditorReplaceSelectionInputSchema = z.object({
  text: z.string(),
  preserveIndent: z.boolean().optional(),
});

export const EditorReplaceSelectionOutputSchema = z.object({
  filePath: PathSchema,
  range: EditorRangeSchema,
  insertedChars: z.number().int().nonnegative(),
});

// editor.insertAtCursor
export const EditorInsertAtCursorInputSchema = z.object({
  text: z.string(),
});

export const EditorInsertAtCursorOutputSchema = z.object({
  filePath: PathSchema,
  cursorAfter: z.object({
    line: z.number().int().nonnegative(),
    ch: z.number().int().nonnegative(),
  }),
  insertedChars: z.number().int().nonnegative(),
});

// editor.getActiveFilePath
export const EditorGetActiveFilePathInputSchema = z.object({});

export const EditorGetActiveFilePathOutputSchema = z.object({
  path: z.string().optional(),
});

// ============================================================================
// WORKSPACE TOOLS
// ============================================================================

// workspace.getContext
export const WorkspaceGetContextInputSchema = z.object({
  includeOpenLeaves: z.boolean().optional(),
  includeActiveViewState: z.boolean().optional(),
});

export const WorkspaceGetContextOutputSchema = z.object({
  activeFilePath: z.string().optional(),
  activeViewType: z.string().optional(),
  isMarkdown: z.boolean().optional(),
  openLeaves: z.array(z.object({
    id: z.string(),
    viewType: z.string(),
    title: z.string().optional(),
  })).optional(),
  selectionSummary: z.object({
    isEmpty: z.boolean(),
    length: z.number().int().nonnegative(),
  }).optional(),
});

// workspace.openFile
export const WorkspaceOpenFileInputSchema = z.object({
  path: PathSchema,
  newLeaf: z.boolean().optional(),
  focus: z.boolean().optional(),
});

export const WorkspaceOpenFileOutputSchema = z.object({
  path: PathSchema,
  opened: z.boolean(),
  leafId: z.string().optional(),
});

// ============================================================================
// COMMANDS TOOLS
// ============================================================================

// commands.list
export const CommandsListInputSchema = z.object({
  query: z.string().optional(),
  prefix: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

export const CommandDescriptorSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerHint: z.string().optional(),
  ownerType: z.enum(["core", "community", "unknown"]).optional(),
  confidence: z.enum(["high", "low"]).optional(),
});

export const CommandsListOutputSchema = z.object({
  commands: z.array(CommandDescriptorSchema),
  truncated: z.boolean(),
});

// commands.run
export const CommandsRunInputSchema = z.object({
  id: z.string(),
});

export const CommandsRunOutputSchema = z.object({
  id: z.string(),
  executed: z.boolean(),
  errorMessage: z.string().optional(),
});

// ============================================================================
// UTILITY TOOLS
// ============================================================================

// util.parseMarkdownBullets
export const UtilParseMarkdownBulletsInputSchema = z.object({
  text: z.string(),
  allowNested: z.boolean().optional(),
});

export const UtilParseMarkdownBulletsOutputSchema = z.object({
  items: z.array(z.object({
    text: z.string(),
    raw: z.string(),
    depth: z.number().int().nonnegative(),
  })),
  count: z.number().int().nonnegative(),
});

// util.slugifyTitle
export const UtilSlugifyTitleInputSchema = z.object({
  title: z.string(),
  maxLength: z.number().int().positive().optional(),
});

export const UtilSlugifyTitleOutputSchema = z.object({
  slug: z.string(),
});

// ============================================================================
// DATAVIEW TOOLS (requires Dataview plugin)
// ============================================================================

// dataview.status
export const DataviewStatusInputSchema = z.object({});

export const DataviewStatusOutputSchema = z.object({
  available: z.boolean(),
  version: z.string().optional(),
  indexed: z.boolean(),
  pageCount: z.number().int().nonnegative().optional(),
});

// dataview.query
export const DataviewQueryInputSchema = z.object({
  dql: z.string().describe("Dataview Query Language (DQL) query string"),
  originFile: z.string().optional().describe("File path to use as context for relative queries"),
});

export const DataviewQueryOutputSchema = z.object({
  type: z.enum(["list", "table", "task", "calendar", "error"]),
  values: z.array(z.any()),
  headers: z.array(z.string()).optional(),
  available: z.boolean(),
});

// dataview.pages
export const DataviewPagesInputSchema = z.object({
  source: z.string().optional().describe("Dataview source expression: #tag, \"folder\", [[link]], or combination"),
  where: z.record(z.any()).optional().describe("Additional field filters to apply"),
});

export const DataviewPageSchema = z.object({
  path: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  frontmatter: z.record(z.any()),
  modified: z.string().nullable(),
});

export const DataviewPagesOutputSchema = z.object({
  pages: z.array(DataviewPageSchema),
  count: z.number().int().nonnegative(),
  available: z.boolean(),
});

// dataview.tasks
export const DataviewTasksInputSchema = z.object({
  options: z.object({
    completed: z.boolean().optional().describe("Filter by completion status"),
    source: z.string().optional().describe("Dataview source expression to search in"),
    tags: z.array(z.string()).optional().describe("Filter tasks by tags"),
    dueBefore: z.string().optional().describe("ISO date string for due date upper bound"),
    dueAfter: z.string().optional().describe("ISO date string for due date lower bound"),
  }).optional(),
});

export const DataviewTaskSchema = z.object({
  text: z.string(),
  completed: z.boolean(),
  path: z.string(),
  tags: z.array(z.string()),
  due: z.string().optional(),
});

export const DataviewTasksOutputSchema = z.object({
  tasks: z.array(DataviewTaskSchema),
  count: z.number().int().nonnegative(),
  available: z.boolean(),
});

// ============================================================================
// TEMPLATER TOOLS (requires Templater plugin)
// ============================================================================

// templater.status
export const TemplaterStatusInputSchema = z.object({});

export const TemplaterStatusOutputSchema = z.object({
  available: z.boolean(),
  enabled: z.boolean(),
  templatesFolder: z.string().optional().describe("Path to the configured templates folder"),
});

// templater.run
export const TemplaterRunInputSchema = z.object({
  templatePath: PathSchema.describe("Path to the template file"),
  targetFile: z.string().optional().describe("File path to use as context for template variables"),
});

export const TemplaterRunOutputSchema = z.object({
  content: z.string().describe("Generated template content"),
  available: z.boolean(),
});

// templater.insert
export const TemplaterInsertInputSchema = z.object({
  templatePath: PathSchema.describe("Path to the template file"),
});

export const TemplaterInsertOutputSchema = z.object({
  success: z.boolean(),
  content: z.string().describe("Generated content that was inserted"),
  available: z.boolean(),
});

// templater.create
export const TemplaterCreateInputSchema = z.object({
  templatePath: PathSchema.describe("Path to the template file"),
  outputPath: PathSchema.describe("Path where the new note should be created"),
  openNote: z.boolean().optional().describe("Whether to open the created note (default: false)"),
  folderPath: z.string().optional().describe("Folder to create the note in (overrides outputPath directory)"),
});

export const TemplaterCreateOutputSchema = z.object({
  path: PathSchema.describe("Path to the created file"),
  created: z.boolean(),
  available: z.boolean(),
});

// ============================================================================
// TASKS TOOLS (requires Tasks plugin)
// ============================================================================

// tasks.status
export const TasksStatusInputSchema = z.object({});

export const TasksStatusOutputSchema = z.object({
  available: z.boolean(),
  version: z.string().optional().describe("Version of the Tasks plugin"),
  enabled: z.boolean(),
});

// tasks.create
export const TasksCreateInputSchema = z.object({
  openModal: z.boolean().optional().describe("Whether to open the Tasks modal UI (default: true)"),
});

export const TasksCreateOutputSchema = z.object({
  taskLine: z.string().describe("The created task line in markdown format, or empty string if cancelled"),
  created: z.boolean().describe("Whether a task was actually created (false if cancelled)"),
  available: z.boolean(),
});

// tasks.edit
export const TasksEditInputSchema = z.object({
  taskLine: z.string().describe("The existing task line to edit"),
});

export const TasksEditOutputSchema = z.object({
  editedLine: z.string().describe("The edited task line, or empty string if cancelled"),
  modified: z.boolean().describe("Whether the task was actually modified (false if cancelled)"),
  available: z.boolean(),
});

// tasks.toggle
export const TasksToggleInputSchema = z.object({
  line: z.string().describe("The task line content"),
  path: z.string().describe("The file path containing the task"),
});

export const TasksToggleOutputSchema = z.object({
  newLine: z.string().describe("The task line after toggling"),
  toggled: z.boolean().describe("Whether the task was successfully toggled"),
  available: z.boolean(),
});

// ============================================================================
// ADVANCED TABLES TOOLS (requires Advanced Tables plugin)
// ============================================================================

// advancedtables.status
export const AdvancedTablesStatusInputSchema = z.object({});

export const AdvancedTablesStatusOutputSchema = z.object({
  available: z.boolean(),
  enabled: z.boolean(),
});

// advancedtables.format
export const AdvancedTablesFormatInputSchema = z.object({
  allTables: z.boolean().optional().describe("If true, format all tables in file. If false or omitted, format only current table (cursor must be in table)"),
});

export const AdvancedTablesFormatOutputSchema = z.object({
  success: z.boolean().describe("Whether the format operation succeeded"),
  available: z.boolean(),
});

// advancedtables.insertRow
export const AdvancedTablesInsertRowInputSchema = z.object({});

export const AdvancedTablesInsertRowOutputSchema = z.object({
  success: z.boolean().describe("Whether a row was inserted"),
  available: z.boolean(),
});

// advancedtables.insertColumn
export const AdvancedTablesInsertColumnInputSchema = z.object({});

export const AdvancedTablesInsertColumnOutputSchema = z.object({
  success: z.boolean().describe("Whether a column was inserted"),
  available: z.boolean(),
});

// advancedtables.sort
export const AdvancedTablesSortInputSchema = z.object({
  direction: z.enum(["asc", "desc"]).describe("Sort direction: 'asc' for ascending, 'desc' for descending"),
});

export const AdvancedTablesSortOutputSchema = z.object({
  success: z.boolean().describe("Whether the sort operation succeeded"),
  available: z.boolean(),
});

// advancedtables.align
export const AdvancedTablesAlignInputSchema = z.object({
  alignment: z.enum(["left", "center", "right"]).describe("Column alignment"),
});

export const AdvancedTablesAlignOutputSchema = z.object({
  success: z.boolean().describe("Whether the alignment was set"),
  available: z.boolean(),
});

// ============================================================================
// EXCALIDRAW TOOLS (requires Excalidraw plugin)
// ============================================================================

// excalidraw.status
export const ExcalidrawStatusInputSchema = z.object({});

export const ExcalidrawStatusOutputSchema = z.object({
  available: z.boolean(),
  enabled: z.boolean(),
  version: z.string().optional().describe("Version of the Excalidraw plugin"),
});

// excalidraw.create
export const ExcalidrawCreateInputSchema = z.object({
  filename: z.string().optional().describe("Name for the drawing file (default: 'Drawing')"),
  foldername: z.string().optional().describe("Folder to create the drawing in"),
  templatePath: z.string().optional().describe("Path to an Excalidraw template file to use"),
  onNewPane: z.boolean().optional().describe("Whether to open in a new pane (default: true)"),
});

export const ExcalidrawCreateOutputSchema = z.object({
  path: z.string().describe("Path to the created drawing file"),
  created: z.boolean(),
  available: z.boolean(),
});

// excalidraw.exportSVG
export const ExcalidrawExportSVGInputSchema = z.object({
  drawingPath: z.string().optional().describe("Path to specific drawing file. If not provided, uses active file"),
});

export const ExcalidrawExportSVGOutputSchema = z.object({
  svg: z.string().describe("SVG representation of the drawing"),
  available: z.boolean(),
});

// excalidraw.exportPNG
export const ExcalidrawExportPNGInputSchema = z.object({
  drawingPath: z.string().optional().describe("Path to specific drawing file. If not provided, uses active file"),
});

export const ExcalidrawExportPNGOutputSchema = z.object({
  png: z.string().describe("Base64-encoded PNG image data"),
  available: z.boolean(),
});

// ============================================================================
// TOOL REGISTRY TYPE
// ============================================================================

export interface ToolSchema {
  name: string;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
}

export const TOOL_SCHEMAS: Record<string, ToolSchema> = {
  "vault.ensureFolder": {
    name: "vault.ensureFolder",
    inputSchema: VaultEnsureFolderInputSchema,
    outputSchema: VaultEnsureFolderOutputSchema,
  },
  "vault.listFiles": {
    name: "vault.listFiles",
    inputSchema: VaultListFilesInputSchema,
    outputSchema: VaultListFilesOutputSchema,
  },
  "vault.readFile": {
    name: "vault.readFile",
    inputSchema: VaultReadFileInputSchema,
    outputSchema: VaultReadFileOutputSchema,
  },
  "vault.createFile": {
    name: "vault.createFile",
    inputSchema: VaultCreateFileInputSchema,
    outputSchema: VaultCreateFileOutputSchema,
  },
  "vault.writeFile": {
    name: "vault.writeFile",
    inputSchema: VaultWriteFileInputSchema,
    outputSchema: VaultWriteFileOutputSchema,
  },
  "vault.rename": {
    name: "vault.rename",
    inputSchema: VaultRenameInputSchema,
    outputSchema: VaultRenameOutputSchema,
  },
  "vault.delete": {
    name: "vault.delete",
    inputSchema: VaultDeleteInputSchema,
    outputSchema: VaultDeleteOutputSchema,
  },
  "vault.searchText": {
    name: "vault.searchText",
    inputSchema: VaultSearchTextInputSchema,
    outputSchema: VaultSearchTextOutputSchema,
  },
  "editor.getSelection": {
    name: "editor.getSelection",
    inputSchema: EditorGetSelectionInputSchema,
    outputSchema: EditorGetSelectionOutputSchema,
  },
  "editor.replaceSelection": {
    name: "editor.replaceSelection",
    inputSchema: EditorReplaceSelectionInputSchema,
    outputSchema: EditorReplaceSelectionOutputSchema,
  },
  "editor.insertAtCursor": {
    name: "editor.insertAtCursor",
    inputSchema: EditorInsertAtCursorInputSchema,
    outputSchema: EditorInsertAtCursorOutputSchema,
  },
  "editor.getActiveFilePath": {
    name: "editor.getActiveFilePath",
    inputSchema: EditorGetActiveFilePathInputSchema,
    outputSchema: EditorGetActiveFilePathOutputSchema,
  },
  "workspace.getContext": {
    name: "workspace.getContext",
    inputSchema: WorkspaceGetContextInputSchema,
    outputSchema: WorkspaceGetContextOutputSchema,
  },
  "workspace.openFile": {
    name: "workspace.openFile",
    inputSchema: WorkspaceOpenFileInputSchema,
    outputSchema: WorkspaceOpenFileOutputSchema,
  },
  "commands.list": {
    name: "commands.list",
    inputSchema: CommandsListInputSchema,
    outputSchema: CommandsListOutputSchema,
  },
  "commands.run": {
    name: "commands.run",
    inputSchema: CommandsRunInputSchema,
    outputSchema: CommandsRunOutputSchema,
  },
  "util.parseMarkdownBullets": {
    name: "util.parseMarkdownBullets",
    inputSchema: UtilParseMarkdownBulletsInputSchema,
    outputSchema: UtilParseMarkdownBulletsOutputSchema,
  },
  "util.slugifyTitle": {
    name: "util.slugifyTitle",
    inputSchema: UtilSlugifyTitleInputSchema,
    outputSchema: UtilSlugifyTitleOutputSchema,
  },
  // Dataview tools
  "dataview.status": {
    name: "dataview.status",
    inputSchema: DataviewStatusInputSchema,
    outputSchema: DataviewStatusOutputSchema,
  },
  "dataview.query": {
    name: "dataview.query",
    inputSchema: DataviewQueryInputSchema,
    outputSchema: DataviewQueryOutputSchema,
  },
  "dataview.pages": {
    name: "dataview.pages",
    inputSchema: DataviewPagesInputSchema,
    outputSchema: DataviewPagesOutputSchema,
  },
  "dataview.tasks": {
    name: "dataview.tasks",
    inputSchema: DataviewTasksInputSchema,
    outputSchema: DataviewTasksOutputSchema,
  },
  // Templater tools
  "templater.status": {
    name: "templater.status",
    inputSchema: TemplaterStatusInputSchema,
    outputSchema: TemplaterStatusOutputSchema,
  },
  "templater.run": {
    name: "templater.run",
    inputSchema: TemplaterRunInputSchema,
    outputSchema: TemplaterRunOutputSchema,
  },
  "templater.insert": {
    name: "templater.insert",
    inputSchema: TemplaterInsertInputSchema,
    outputSchema: TemplaterInsertOutputSchema,
  },
  "templater.create": {
    name: "templater.create",
    inputSchema: TemplaterCreateInputSchema,
    outputSchema: TemplaterCreateOutputSchema,
  },
  // Tasks tools
  "tasks.status": {
    name: "tasks.status",
    inputSchema: TasksStatusInputSchema,
    outputSchema: TasksStatusOutputSchema,
  },
  "tasks.create": {
    name: "tasks.create",
    inputSchema: TasksCreateInputSchema,
    outputSchema: TasksCreateOutputSchema,
  },
  "tasks.edit": {
    name: "tasks.edit",
    inputSchema: TasksEditInputSchema,
    outputSchema: TasksEditOutputSchema,
  },
  "tasks.toggle": {
    name: "tasks.toggle",
    inputSchema: TasksToggleInputSchema,
    outputSchema: TasksToggleOutputSchema,
  },
  // Advanced Tables tools
  "advancedtables.status": {
    name: "advancedtables.status",
    inputSchema: AdvancedTablesStatusInputSchema,
    outputSchema: AdvancedTablesStatusOutputSchema,
  },
  "advancedtables.format": {
    name: "advancedtables.format",
    inputSchema: AdvancedTablesFormatInputSchema,
    outputSchema: AdvancedTablesFormatOutputSchema,
  },
  "advancedtables.insertRow": {
    name: "advancedtables.insertRow",
    inputSchema: AdvancedTablesInsertRowInputSchema,
    outputSchema: AdvancedTablesInsertRowOutputSchema,
  },
  "advancedtables.insertColumn": {
    name: "advancedtables.insertColumn",
    inputSchema: AdvancedTablesInsertColumnInputSchema,
    outputSchema: AdvancedTablesInsertColumnOutputSchema,
  },
  "advancedtables.sort": {
    name: "advancedtables.sort",
    inputSchema: AdvancedTablesSortInputSchema,
    outputSchema: AdvancedTablesSortOutputSchema,
  },
  "advancedtables.align": {
    name: "advancedtables.align",
    inputSchema: AdvancedTablesAlignInputSchema,
    outputSchema: AdvancedTablesAlignOutputSchema,
  },
  // Excalidraw tools
  "excalidraw.status": {
    name: "excalidraw.status",
    inputSchema: ExcalidrawStatusInputSchema,
    outputSchema: ExcalidrawStatusOutputSchema,
  },
  "excalidraw.create": {
    name: "excalidraw.create",
    inputSchema: ExcalidrawCreateInputSchema,
    outputSchema: ExcalidrawCreateOutputSchema,
  },
  "excalidraw.exportSVG": {
    name: "excalidraw.exportSVG",
    inputSchema: ExcalidrawExportSVGInputSchema,
    outputSchema: ExcalidrawExportSVGOutputSchema,
  },
  "excalidraw.exportPNG": {
    name: "excalidraw.exportPNG",
    inputSchema: ExcalidrawExportPNGInputSchema,
    outputSchema: ExcalidrawExportPNGOutputSchema,
  },
};
