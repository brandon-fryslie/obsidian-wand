Embedded Tool-Calling Agent for Obsidian

A desktop Obsidian plugin that adds a lightweight chat panel. Users type natural-language instructions (“read the selection and…”) and the plugin uses an LLM to turn that into a structured plan made of tool calls (Obsidian APIs + command execution). The plugin shows the plan, asks for confirmation, then executes it with progress + undo.

External fetching is limited to:
	1.	your chosen LLM provider, and
	2.	the official Obsidian community plugin manifest list (community-plugins.json) for recommendations only (no repo scraping).  ￼

⸻

1) Goals and non-goals

Goals
	•	Natural language → tool-call plan → confirm → execute.
	•	Cover “everyday Obsidian actions” with:
	•	Vault operations via the official Vault API (app.vault).  ￼
	•	Workspace/editor operations via public APIs where available.
	•	Commands as a broad compatibility layer (core + community), executed by ID (not formally typed in the public API, but widely used in practice).  ￼
	•	Let users save a successful action as a one-click button (a “palette macro”) that can run offline (no LLM).
	•	Simple chat interface with streaming output and step-by-step execution logs.
	•	User supplies and controls their LLM API key.

Non-goals (for this “simple” version)
	•	No plugin repo processing or deep plugin-specific guidance.
	•	No automatic plugin install/uninstall (recommend only).
	•	No arbitrary JS/DOM automation (keep to Obsidian APIs + commands).

⸻

2) User experience

UI surfaces
	1.	Side panel view (chat)

	•	Conversation transcript
	•	“Use selection” indicator (shows a snippet + token estimate)
	•	Run / Dry-run / Cancel buttons
	•	Execution log and progress bar

	2.	Command palette entry

	•	“Open Embedded Agent”
	•	“Run Saved Action: ” for each saved palette button

	3.	Ribbon icon (optional)

	•	Quick open

Typical flow
	1.	User selects text (e.g., 10 bullets)
	2.	User types: “Read the selection… create notes in folder XYZ…”
	3.	Plugin gathers context (selection + active file path + vault constraints)
	4.	Plugin calls LLM to produce a structured plan
	5.	Plugin shows plan preview and asks for confirmation
	6.	On approval: executes steps; updates note(s); reports results
	7.	User can “Save as button” → appears in a small palette and as a command

⸻

3) Architecture

Components
	1.	Chat Controller

	•	Maintains conversation state
	•	Builds the model prompt (instructions + tool schemas + context)
	•	Handles streaming tokens from provider into UI

	2.	Planner

	•	Requests a plan from the LLM in a strict JSON schema
	•	Validates plan shape + sanity checks (paths, allowed tools)

	3.	Executor

	•	Runs validated steps deterministically
	•	Supports loops (foreach), retries, cancellation, and progress
	•	Records an undo journal (best-effort)

	4.	Tools Layer

	•	A set of callable functions representing “capabilities”:
	•	Vault tools (create/read/write/rename/delete/search)
	•	Editor tools (get selection, replace selection, insert text)
	•	Workspace tools (open file, focus pane)
	•	Command tools (list commands; run command by ID)

	5.	Macro Store (Palette)

	•	Saves a “frozen” action definition:
	•	template prompt OR finalized plan OR parameterized macro
	•	Allows running without LLM by replaying the stored plan with runtime context bindings

	6.	Community Plugin Index (recommendations only)

	•	Fetches and caches community-plugins.json via Obsidian’s requestUrl helper (bypasses CORS).  ￼
	•	Provides search by keywords for “maybe install plugin X”

⸻

4) Tool calling model

Two-phase “Plan then Execute”

Phase A: Plan

LLM produces a single JSON object matching ActionPlan (below).

Phase B: Confirm

Plugin renders a human-readable summary:
	•	files to be created/modified
	•	folder changes
	•	commands to be executed
	•	estimated number of steps + risk level

User must approve once per plan execution (configurable: “always confirm” vs “confirm only on writes”).

Phase C: Execute

Plugin executes steps; collects results; updates UI.

⸻

5) ActionPlan schema

The plugin enforces a strict schema so the model cannot “invent” arbitrary operations.

ActionPlan
	•	goal: string
	•	assumptions: string[] (e.g., “Selection contains markdown bullets”)
	•	riskLevel: "read-only" | "writes" | "commands"
	•	steps: Step[]

Step
	•	id: string
	•	tool: ToolName
	•	args: object
	•	Optional control fields:
	•	foreach?: { from: string, itemName: string }
	•	dependsOn?: string[]
	•	onError?: "stop" | "skip" | "retry"
	•	retry?: { maxAttempts: number, backoffMs: number }
	•	preview?: string (human explanation)

ToolName (initial set)

Vault
	•	vault.ensureFolder
	•	vault.createFile
	•	vault.readFile
	•	vault.writeFile
	•	vault.rename
	•	vault.delete
	•	vault.searchText
	•	vault.listFiles

Editor (active note)
	•	editor.getSelection
	•	editor.replaceSelection
	•	editor.insertAtCursor
	•	editor.getActiveFilePath

Workspace
	•	workspace.openFile
	•	workspace.getContext

Commands
	•	commands.list
	•	commands.run

Utility (no external data)
	•	util.parseMarkdownBullets (simple local parser)
	•	util.slugifyTitle

The Vault API is the preferred file interface.  ￼

⸻

6) Commands integration (simple, practical)

Listing commands
	•	Provide commands.list({query?, prefix?})
	•	Used to ground the agent: “these commands exist in this vault”

In practice, Obsidian exposes command listing/execution internally (app.commands.listCommands() / executeCommandById() are commonly used from devtools and plugins, even if not fully typed in the public API).  ￼

Executing commands
	•	commands.run({id}) -> { ok, error? }
	•	Executor records failures and can:
	•	stop, skip, or retry based on plan

Precondition handling (lightweight)
	•	If command fails, return error plus current workspace context (active file/view) so the user can adjust prompt or rerun.

⸻

7) LLM provider integration

Settings
	•	Provider: OpenAI / Anthropic / “Custom endpoint”
	•	Model name
	•	API key (stored in Obsidian plugin settings)
	•	Streaming on/off
	•	Max tokens, temperature
	•	Safety toggles:
	•	“Require confirmation for writes”
	•	“Allow command execution”
	•	“Allow deletes/renames”

Networking
	•	Use Obsidian’s requestUrl to avoid CORS issues and to work consistently across platforms.  ￼

Prompting strategy (simple but robust)
	•	System instruction: “You are an Obsidian automation planner. Output only valid JSON matching schema.”
	•	Provide:
	•	tool schemas
	•	vault constraints (root path, forbidden patterns like ..)
	•	active file path + selection excerpt (bounded)
	•	user’s instruction verbatim

⸻

8) Confirmation & safety model

Plan preview UI

Before executing:
	•	“Will create N files under folder XYZ”
	•	“Will modify: ”
	•	“Will run commands: …”
	•	“Will delete/rename: …” (highlighted)

User actions:
	•	Approve once
	•	Cancel
	•	“Edit plan” (advanced: let user tweak folder name, etc.)

Guardrails
	•	Path sandbox: only within vault
	•	Filename sanitization
	•	Collision policy: create-unique default (e.g., “Title (2).md”)
	•	Disable delete by default (opt-in)

Undo journal (best-effort)
	•	For each write:
	•	store previous contents (or diff) in memory and optionally in a temp file
	•	Provide “Revert last run” button

⸻

9) Saved Actions Palette

What gets saved

A saved action is either:
	1.	Parameter-free plan template (recommended)

	•	A validated plan with placeholders like ${selectionBullets} or ${folderName}.
	•	When run, the plugin binds placeholders from current context.

	2.	Fixed plan

	•	For one-off repetitive tasks that don’t depend on selection.

Running offline (no LLM)
	•	Saved actions execute using the same Executor.
	•	If required inputs are missing (no selection), the UI prompts for minimal parameters.

Management
	•	Create from a successful run (“Save to palette”)
	•	Rename/reorder
	•	Export/import JSON

⸻

10) Community plugin recommendations (no auto-install)

Data source
	•	Fetch official plugin directory list from obsidianmd/obsidian-releases/community-plugins.json. Obsidian itself uses this list for community plugins browsing/search.  ￼

Features
	•	plugins.search({query}) → show top matches (name/author/description)
	•	Agent can say: “There’s a community plugin that may help: X”
	•	UI provides:
	•	“Open Community Plugins settings”
	•	“Copy plugin name/id”
User installs manually.

⸻

11) Inputs and outputs

Inputs
	•	User message (natural language)
	•	Current context snapshot:
	•	active file path
	•	selection text (bounded)
	•	optional: vault file list (bounded) if needed for naming collisions
	•	Plugin settings (provider, model, safety toggles)
	•	Official community plugin manifest list (cached)

Outputs
	•	Chat responses (assistant messages)
	•	Plan JSON (internal)
	•	Executed changes to vault and editor
	•	Execution log + summary
	•	Saved actions (palette)

⸻

12) Failure handling
	•	Step-level errors surfaced in UI with:
	•	tool name
	•	arguments (redacted if needed)
	•	error message
	•	Retry policy controlled by the plan but capped by settings.
	•	Partial completion allowed:
	•	e.g., 7/10 notes created; user can rerun for remaining items.

⸻

13) Implementation constraints (keeping it simple)
	•	Prefer official Obsidian APIs for file ops (Vault API).  ￼
	•	Commands execution/listing is treated as “best-effort internal API” (works widely, not guaranteed by typings).  ￼
	•	Only external fetches: LLM provider + community plugin list (via requestUrl).  ￼

⸻
