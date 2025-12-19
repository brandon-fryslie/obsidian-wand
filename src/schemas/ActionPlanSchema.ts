import { z } from "zod";

/**
 * Zod schema for ActionPlan validation
 * Based on PROJECT_SPEC/ActionPlan_JSON_Schema.md
 */

// Tool names enum
export const ToolNameSchema = z.enum([
  // Vault operations
  "vault.ensureFolder",
  "vault.createFile",
  "vault.readFile",
  "vault.writeFile",
  "vault.rename",
  "vault.delete",
  "vault.searchText",
  "vault.listFiles",
  // Editor operations
  "editor.getSelection",
  "editor.replaceSelection",
  "editor.insertAtCursor",
  "editor.getActiveFilePath",
  // Workspace operations
  "workspace.openFile",
  "workspace.getContext",
  // Command operations
  "commands.list",
  "commands.run",
  // Dataview operations (requires Dataview plugin)
  "dataview.status",
  "dataview.query",
  "dataview.pages",
  "dataview.tasks",
  // Templater operations (requires Templater plugin)
  "templater.status",
  "templater.run",
  "templater.insert",
  "templater.create",
  // Utility functions
  "util.parseMarkdownBullets",
  "util.slugifyTitle",
]);

// OnError enum
export const OnErrorSchema = z.enum(["stop", "skip", "retry"]);

// RetryPolicy schema
export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10),
  backoffMs: z.number().int().min(0).max(600000).default(250),
});

// ForEach schema
export const ForEachSchema = z.object({
  from: z.string().min(1),
  itemName: z.string().regex(/^[A-Za-z][A-Za-z0-9_\-]*$/),
  indexName: z.string().regex(/^[A-Za-z][A-Za-z0-9_\-]*$/).optional(),
  concurrency: z.number().int().min(1).optional(),
});

// Step schema
export const StepSchema = z.object({
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_\-]*$/),
  tool: ToolNameSchema,
  args: z.record(z.any()),
  preview: z.string().min(1).optional(),
  dependsOn: z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9_\-]*$/)).optional().default([]),
  foreach: ForEachSchema.optional(),
  captureAs: z.string().regex(/^[A-Za-z][A-Za-z0-9_\-\.]*$/).optional(),
  onError: OnErrorSchema.optional(),
  retry: RetryPolicySchema.optional(),
  timeoutMs: z.number().int().min(1).optional(),
  tags: z.array(z.string().min(1)).optional().default([]),
});

// ContextRequest schema
export const ContextRequestSchema = z.object({
  kind: z.enum([
    "activeFilePath",
    "selection",
    "cursor",
    "workspaceContext",
    "commandList",
    "vaultFileList",
  ]),
  options: z.record(z.any()).optional().default({}),
});

// Defaults schema
export const DefaultsSchema = z.object({
  onError: OnErrorSchema.optional(),
  retry: RetryPolicySchema.optional(),
});

// Outputs schema
export const OutputsSchema = z.object({
  showCreatedFiles: z.boolean().optional().default(true),
  showModifiedFiles: z.boolean().optional().default(true),
  showCommandRuns: z.boolean().optional().default(true),
});

// UIHints schema
export const UIHintsSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
});

// Main ActionPlan schema
export const ActionPlanSchema = z.object({
  version: z.string().regex(/^[0-9]+\.[0-9]+(\.[0-9]+)?$/),
  goal: z.string().min(1),
  assumptions: z.array(z.string().min(1)).optional().default([]),
  riskLevel: z.enum(["read-only", "writes", "commands"]),
  contextRequests: z.array(ContextRequestSchema).optional().default([]),
  defaults: DefaultsSchema.optional().default({}),
  steps: z.array(StepSchema).min(1),
  outputs: OutputsSchema.optional().default({}),
  uiHints: UIHintsSchema.optional().default({}),
});

// Type inference from schema
export type ActionPlanSchemaType = z.infer<typeof ActionPlanSchema>;
export type StepSchemaType = z.infer<typeof StepSchema>;
export type ForEachSchemaType = z.infer<typeof ForEachSchema>;
export type RetryPolicySchemaType = z.infer<typeof RetryPolicySchema>;
export type OnErrorSchemaType = z.infer<typeof OnErrorSchema>;
export type ContextRequestSchemaType = z.infer<typeof ContextRequestSchema>;
export type DefaultsSchemaType = z.infer<typeof DefaultsSchema>;
export type OutputsSchemaType = z.infer<typeof OutputsSchema>;
export type UIHintsSchemaType = z.infer<typeof UIHintsSchema>;
export type ToolNameSchemaType = z.infer<typeof ToolNameSchema>;
