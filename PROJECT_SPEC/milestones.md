Below is a straight, linear milestone plan from A → B, with no detours, no premature optimization, no “ship early” framing. Each milestone exists because it is structurally required for the final system to be correct, reliable, and pleasant to use. Nothing is included “just to see if it works.”

I’ll frame each milestone with:
	•	Purpose (why it must exist)
	•	What is built
	•	Acceptance criteria (how we know it’s done, not just “implemented”)

⸻

Milestone Plan: Embedded Tool-Calling Agent for Obsidian

⸻

Milestone 0 — Conceptual & Contract Foundations

Purpose

Lock down the shape of the system before touching code so later work is additive, not corrective.

What is built
	•	Finalized tool surface (Vault, Editor, Workspace, Commands, Utility)
	•	Finalized ActionPlan JSON schema
	•	Finalized execution semantics:
	•	step ordering
	•	foreach
	•	dependency resolution
	•	error handling rules
	•	Finalized safety rules:
	•	path sandboxing
	•	collision policies
	•	confirmation rules
	•	Written, human-readable agent instruction contract
	•	“You are an Obsidian automation planner…”
	•	strict JSON-only output rules
	•	tool usage guidelines

Acceptance criteria
	•	A single document/spec answers:
	•	“What can the agent do?”
	•	“How does it express intent?”
	•	“What can’t it do?”
	•	No ambiguity about:
	•	where execution happens
	•	where responsibility lies (model vs host)
	•	You could hand this spec to another engineer and get the same architecture.

⸻

Milestone 1 — Core Obsidian Capability Layer (No AI)

Purpose

Ensure every action the agent might perform is already rock-solid without an LLM.

What is built
	•	Vault operations via Obsidian’s Vault API:
	•	create/read/write/rename/delete/search/list
	•	Editor operations:
	•	get selection
	•	replace selection
	•	insert text
	•	get active file path
	•	Workspace operations:
	•	open file
	•	get active context
	•	Commands:
	•	list commands
	•	execute command by ID
	•	Deterministic return values for every tool
	•	Centralized error normalization

Acceptance criteria
	•	Every tool:
	•	works independently
	•	returns structured, predictable results
	•	fails loudly and clearly
	•	You can write non-AI test scripts that:
	•	create folders
	•	generate notes
	•	modify selections
	•	run commands
	•	No UI yet, no LLM yet—and nothing feels “stubby.”

⸻

Milestone 2 — Execution Engine (Plan Runner)

Purpose

Create the heart of the system: a deterministic executor that turns plans into reality.

What is built
	•	Plan validator:
	•	schema validation
	•	tool allowlist
	•	argument sanity checks
	•	Step scheduler:
	•	dependency resolution
	•	sequential execution
	•	foreach expansion
	•	Execution controller:
	•	progress tracking
	•	cancellation
	•	retry logic
	•	Result propagation:
	•	step outputs addressable by later steps
	•	Undo journal (best-effort)

Acceptance criteria
	•	Given a static JSON plan, the engine:
	•	executes it exactly once
	•	produces identical results every time
	•	Partial failure behaves exactly as specified
	•	Undo works for all supported write operations
	•	The executor never calls the LLM.

⸻

Milestone 3 — Human-Readable Plan Rendering & Confirmation

Purpose

Guarantee trust and clarity before any AI is allowed to touch the vault.

What is built
	•	Plan → human summary renderer:
	•	files created/modified
	•	folders affected
	•	commands executed
	•	Risk classification:
	•	read-only / writes / commands
	•	Confirmation UI:
	•	approve
	•	cancel
	•	optional “edit parameters” hooks
	•	Execution preview mode (dry run)

Acceptance criteria
	•	A non-technical user can understand exactly what will happen
	•	Nothing executes without explicit approval
	•	Preview matches execution 1:1
	•	This UI works even when plans are authored manually.

⸻

Milestone 4 — LLM Integration (Planner Only)

Purpose

Introduce intelligence without giving up control.

What is built
	•	Provider abstraction (OpenAI / Anthropic / custom endpoint)
	•	API key management in plugin settings
	•	Prompt assembly:
	•	system rules
	•	tool schemas
	•	context snapshot
	•	user message
	•	Strict JSON parsing + rejection
	•	Retry-on-invalid-plan logic (planner side only)

Acceptance criteria
	•	The LLM can:
	•	turn natural language into a valid ActionPlan
	•	respect tool boundaries
	•	Invalid output never reaches the executor
	•	Planner failures are surfaced cleanly to the user
	•	No execution happens automatically after planning.

⸻

Milestone 5 — Conversational Chat Interface

Purpose

Make the system pleasant and natural to use, not just powerful.

What is built
	•	Side panel chat UI:
	•	message history
	•	streaming assistant responses
	•	“Use selection” affordance
	•	Clear separation between:
	•	conversation
	•	plan preview
	•	execution log
	•	Inline status updates during execution

Acceptance criteria
	•	The chat feels responsive and calm
	•	Streaming never corrupts state
	•	Users can interrupt/cancel cleanly
	•	Conversation history does not affect execution determinism.

⸻

Milestone 6 — Saved Actions (Palette / Macros)

Purpose

Convert discovery into durable productivity.

What is built
	•	Save successful plans as reusable actions
	•	Parameter binding system (selection, folder name, etc.)
	•	Offline execution (no LLM required)
	•	Palette UI:
	•	list actions
	•	run
	•	rename
	•	delete
	•	Command palette integration

Acceptance criteria
	•	Saved actions behave identically to their original run
	•	Missing context is prompted for minimally
	•	No hidden dependency on the LLM once saved
	•	Actions are portable (export/import).

⸻

Milestone 7 — Community Plugin Awareness (Advisory Only)

Purpose

Enhance the agent’s judgment without expanding its authority.

What is built
	•	Fetch + cache official community plugin manifest
	•	Search index over name/description
	•	Planner hinting:
	•	“A plugin exists that might help with X”
	•	UI affordance to:
	•	open plugin settings
	•	copy plugin name/id

Acceptance criteria
	•	No plugin installation occurs automatically
	•	Recommendations are clearly labeled as suggestions
	•	Agent never assumes a plugin is installed
	•	Offline behavior degrades gracefully.

⸻

Milestone 8 — Polishing the Edges (Correctness & UX)

Purpose

Eliminate friction, ambiguity, and surprises.

What is built
	•	Consistent error language
	•	Clear recovery suggestions
	•	Improved defaults (naming, collision handling)
	•	Visual diff previews (where applicable)
	•	Keyboard shortcuts and focus management
	•	Accessibility pass (keyboard, contrast, screen readers)

Acceptance criteria
	•	Common workflows feel “obvious”
	•	Errors never feel mysterious
	•	Power does not come at the cost of confidence
	•	UX is calm, not clever.

⸻

Milestone 9 — Hardening & Closure

Purpose

Reach B: feature complete, stable, trustworthy.

What is built
	•	Exhaustive internal test scenarios
	•	Fuzzing of planner output
	•	Stress tests on large vaults
	•	Security review of tool boundaries
	•	Documentation:
	•	user guide
	•	mental model
	•	limitations

Acceptance criteria
	•	No known correctness bugs
	•	No undefined behavior paths
	•	Clear understanding of what the agent will never do
	•	The system feels boring in the best possible way.

⸻

Final State (B)

At completion:
	•	The agent feels like a native Obsidian power feature
	•	Natural language → deliberate action → predictable results
	•	Nothing surprising, nothing fragile
	•	Users trust it enough to let it touch their notes

