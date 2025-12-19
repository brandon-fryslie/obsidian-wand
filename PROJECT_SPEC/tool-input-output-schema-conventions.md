Tool Input/Output Schema Conventions

A comprehensive set of conventions for designing the inputSchema and outputSchema of tools in your registry so that:
	•	the planner model can predict outputs,
	•	the executor can validate and log consistently,
	•	the UI can render previews and results cleanly,
	•	and tool results can be chained reliably ($steps.* references).

These are conventions, not a single JSON Schema. The intent is: all tools should “feel the same.”

⸻

1) Universal conventions for every tool

1.1 Inputs

Required structure
	•	Every tool inputSchema must be a JSON object schema:
	•	type: "object"
	•	additionalProperties: false (prefer strict)
	•	required: [...] explicitly listed

Common optional meta-fields (recommended)

Include these on tools where it makes sense:
	•	dryRun?: boolean
	•	If true, tool returns what it would do, without side effects.
	•	note?: string
	•	Human note for logging (“requested by user: …”). Executor may populate this.
	•	requestId?: string
	•	For tracing across layers.

Rule: the planner should not set requestId; the executor can.

1.2 Outputs

Required structure

Every tool outputSchema must be:
	•	type: "object"
	•	additionalProperties: false (prefer strict)

Standard top-level fields (strongly recommended)

For maximum uniformity, use a standard envelope inside data, but since you already have a ToolResult envelope, keep tool outputs clean and domain-specific. Still, these fields help:
	•	ok should NOT be in tool output (it lives in ToolResult).
	•	Prefer tool outputs that return:
	•	specific results (path, content, etc.)
	•	and lightweight metadata (etag, mtime)

Timestamps and times
	•	Use epoch milliseconds (mtimeMs) for file times to avoid timezone confusion, or use ISO-8601 consistently.
	•	Pick one; don’t mix. Recommended: mtimeMs: integer.

Identifiers
	•	For file paths, always use vault-relative paths with forward slashes:
	•	Folder/Note.md
	•	never absolute OS paths
	•	never URI strings unless explicitly needed

⸻

2) Referencing and determinism

2.1 Stable references

If a tool returns something that other steps might depend on, make it easy to reference:
	•	Use predictable field names:
	•	path, paths
	•	content
	•	items, matches
	•	selection
	•	Avoid deeply nested “result.result.data” shapes.

2.2 Idempotency signals (where applicable)

For write-like tools, support one of:
	•	expectedEtag?: string in input, and return etag in output
	•	ifNotExists?: boolean for create-only operations

This enables safe re-runs and reduces accidental overwrites.

⸻

3) Canonical domain schemas

3.1 Path and glob conventions

Path field naming
	•	path: string for a single file or folder
	•	paths: string[] for multiple
	•	fromPath, toPath for renames/moves

Pattern fields
	•	Use explicit names:
	•	query for text queries
	•	regex for regex pattern
	•	glob for glob patterns
	•	Never overload pattern to mean multiple things unless accompanied by mode.

⸻

3.2 Vault / filesystem tools

3.2.1 vault.ensureFolder

Input
	•	path: string

Output
	•	path: string
	•	created: boolean

Notes
	•	If folder already exists, created=false.

⸻

3.2.2 vault.listFiles

Input
	•	prefix?: string (folder path)
	•	recursive?: boolean
	•	extensions?: string[] (e.g., ["md"])
	•	limit?: integer
	•	offset?: integer (optional paging)

Output
	•	items: Array<FileEntry>
	•	nextOffset?: integer (if paging)
	•	truncated: boolean

FileEntry
	•	path: string
	•	kind: "file" | "folder"
	•	sizeBytes?: integer (files)
	•	mtimeMs?: integer (files)
	•	ctimeMs?: integer (optional)
	•	etag?: string (optional; only if cheap to compute)

⸻

3.2.3 vault.readFile

Input
	•	path: string
	•	maxBytes?: integer (guardrail)
	•	range?: { start: integer, end: integer } (optional)
	•	as?: "text" | "base64" (default "text")

Output
	•	path: string
	•	content: string (text or base64)
	•	etag?: string
	•	mtimeMs?: integer
	•	truncated?: boolean
	•	encoding?: string (e.g., utf-8)

Notes
	•	If truncated, caller should be able to request a range.

⸻

3.2.4 vault.createFile

Input
	•	path: string
	•	content: string
	•	ifNotExists?: boolean (default true in executor policy)
	•	collisionStrategy?: "error" | "create-unique" | "overwrite" (prefer policy default)
	•	frontmatter?: object (optional convenience; if included, tool inserts it)

Output
	•	path: string (actual path if unique name chosen)
	•	created: boolean
	•	etag?: string
	•	mtimeMs?: integer

⸻

3.2.5 vault.writeFile

Input
	•	path: string
	•	content: string
	•	mode?: "overwrite" | "append" (keep patching separate)
	•	expectedEtag?: string (optional optimistic concurrency)

Output
	•	path: string
	•	etag?: string
	•	mtimeMs?: integer
	•	bytesWritten?: integer

⸻

3.2.6 vault.patchFile (recommended separate tool)

Avoid “patch inside write” ambiguity.

Input
	•	path: string
	•	patch: FilePatch

Output
	•	path: string
	•	etag?: string
	•	mtimeMs?: integer
	•	applied: boolean

FilePatch (pick one strategy and standardize)
	•	Either:
	•	replaceRange: { start: integer, end: integer, text: string }
	•	Or:
	•	diff: string (unified diff) — harder for LLMs to get right
	•	Or:
	•	operations: Array<{ op: "insert"|"delete"|"replace", ... }> — most robust

For simplicity with LLMs: replaceRange + optional find-based replace tool.

⸻

3.2.7 vault.rename

Input
	•	fromPath: string
	•	toPath: string
	•	collisionStrategy?: "error" | "overwrite" | "create-unique"

Output
	•	fromPath: string
	•	toPath: string

⸻

3.2.8 vault.delete

Input
	•	path: string
	•	trash?: boolean (default true)
	•	requireExists?: boolean (default true)

Output
	•	path: string
	•	deleted: boolean
	•	trashed?: boolean

⸻

3.2.9 vault.searchText

Input
	•	query: string
	•	mode?: "plain" | "regex" (default plain)
	•	paths?: string[] (optional scope)
	•	caseSensitive?: boolean
	•	limit?: integer (default 50)
	•	snippetLength?: integer (default 120)

Output
	•	matches: Array<SearchMatch>
	•	truncated: boolean

SearchMatch
	•	path: string
	•	line?: integer
	•	start?: integer (char offset within file, if known)
	•	end?: integer
	•	snippet: string

⸻

3.3 Editor tools (active editor / selection)

General rule

Editor tools should return enough coordinates to support precise edits.

3.3.1 editor.getSelection

Input
	•	(none)

Output
	•	text: string
	•	isEmpty: boolean
	•	range?: EditorRange (present if known)
	•	filePath?: string (active file)
	•	mode?: "source" | "preview" | "unknown"

EditorRange
	•	from: { line: integer, ch: integer }
	•	to: { line: integer, ch: integer }

⸻

3.3.2 editor.replaceSelection

Input
	•	text: string
	•	preserveIndent?: boolean (optional)

Output
	•	filePath: string
	•	range: EditorRange (range that was replaced)
	•	insertedChars: integer

⸻

3.3.3 editor.insertAtCursor

Input
	•	text: string

Output
	•	filePath: string
	•	cursorAfter: { line: integer, ch: integer }
	•	insertedChars: integer

⸻

3.3.4 editor.replaceRange (recommended)

Input
	•	from: { line, ch }
	•	to: { line, ch }
	•	text: string

Output
	•	filePath: string
	•	range: EditorRange
	•	insertedChars: integer

⸻

3.4 Workspace tools

3.4.1 workspace.getContext

Input
	•	includeOpenLeaves?: boolean
	•	includeActiveViewState?: boolean

Output
	•	activeFilePath?: string
	•	activeViewType?: string
	•	isMarkdown?: boolean
	•	openLeaves?: Array<{ id: string, viewType: string, title?: string }>
	•	selectionSummary?: { isEmpty: boolean, length: integer } (optional)

⸻

3.4.2 workspace.openFile

Input
	•	path: string
	•	newLeaf?: boolean
	•	focus?: boolean

Output
	•	path: string
	•	opened: boolean
	•	leafId?: string

⸻

3.5 Commands tools

3.5.1 commands.list

Input
	•	query?: string
	•	prefix?: string
	•	limit?: integer

Output
	•	commands: Array<CommandDescriptor>
	•	truncated: boolean

CommandDescriptor
	•	id: string
	•	name: string
	•	ownerHint?: string (prefix before :)
	•	ownerType?: "core" | "community" | "unknown"
	•	confidence?: "high" | "low"

Even if you “ignore core plugins” conceptually, keeping ownerType is still useful for filtering and UI.

⸻

3.5.2 commands.run

Input
	•	id: string

Output
	•	id: string
	•	executed: boolean
	•	errorMessage?: string

⸻

3.6 Utility tools (local parsing/helpers)

3.6.1 util.parseMarkdownBullets

Input
	•	text: string
	•	allowNested?: boolean

Output
	•	items: Array<{ text: string, raw: string, depth: integer }>
	•	count: integer

⸻

3.6.2 util.slugifyTitle

Input
	•	title: string
	•	maxLength?: integer

Output
	•	slug: string

⸻

4) Error reporting conventions (tool-level)

Even though errors live in the ToolResult envelope, tools should throw/return internal errors in a way that can be mapped to the standard error codes.

Recommended mapping signals (internal, not schema):
	•	Not found → NOT_FOUND
	•	Precondition missing (no selection) → PRECONDITION_FAILED
	•	Path blocked → POLICY_DENIED
	•	Etag mismatch → CONFLICT

⸻

5) UI preview conventions (what the planner should populate)

Planner-generated step.preview strings should:
	•	start with a verb (“Create…”, “Replace…”, “Search…”)
	•	include the path or command name
	•	avoid implementation details
	•	remain true even if args are later templated (for foreach, mention “for each item…”)

⸻

6) Consistency checklist for adding a new tool

When defining a new tool, ensure:
	•	input is strict object schema (additionalProperties:false)
	•	output is strict object schema
	•	uses canonical field names (path, items, matches, etc.)
	•	returns enough metadata (etag, mtimeMs) for safe chaining
	•	declares riskLevel, sideEffects, and availability

