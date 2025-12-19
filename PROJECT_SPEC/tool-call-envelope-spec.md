Tool Call Envelope Specification

A comprehensive internal spec for how your Obsidian embedded agent represents tool invocations and tool results during planning, execution, logging, and (optionally) model feedback. This sits under the ActionPlan and above the concrete tool implementations.

This is not user-facing; it’s the executor’s “wire format” between:
	•	Planner output (ActionPlan.steps)
	•	Executor scheduler
	•	Tool dispatcher
	•	Audit log
	•	UI progress/events
	•	Optional re-planning loop (if you later add iterative planning)

⸻

1) Goals
	•	Provide a consistent, structured representation of every tool invocation and its result.
	•	Support:
	•	step-level execution
	•	foreach expansion (iteration context)
	•	dependency tracking
	•	retries and timeouts
	•	cancellation
	•	auditability and replay
	•	Enable clean separation between:
	•	Plan (LLM-authored)
	•	Call (executor-issued)
	•	Result (tool-returned)
	•	Effects (observed side effects and changed artifacts)

⸻

2) Concepts and terminology

ActionPlan step

A single plan step from the ActionPlan JSON: { id, tool, args, foreach?, ... }

Tool call

A single invocation of a tool implementation with concrete arguments after:
	•	variable substitution (e.g., {item.path})
	•	context references (e.g., $steps.parse.items)
	•	foreach iteration binding

Tool result

The concrete result returned by the tool, normalized into a stable shape with:
	•	ok indicator
	•	data matching the tool’s output schema
	•	a structured error if not ok
	•	optional effects summary

⸻

3) Envelope types

3.1 ToolCall (executor → tool dispatcher)

Purpose

Represents a single executable tool invocation with all metadata needed for:
	•	UI rendering
	•	audit logging
	•	cancellation/retry
	•	replay

Shape (conceptual)
	•	Identity
	•	callId: string (globally unique within a run; UUID recommended)
	•	runId: string (identifier for one plan execution run)
	•	stepId: string (the originating ActionPlan step id)
	•	tool: string (tool name)
	•	Arguments
	•	args: object (fully materialized args after templating and references)
	•	argsHash?: string (stable hash for logging/dedup)
	•	Execution control
	•	attempt: number (1-based)
	•	timeoutMs?: number
	•	deadlineAt?: string (ISO-8601; optional convenience)
	•	cancellable: boolean
	•	Foreach context (optional)
	•	iteration?: { index: number, itemName: string, itemValue: any }
	•	loopId?: string (stable identifier for a foreach expansion group)
	•	Provenance
	•	createdAt: string (ISO-8601)
	•	plannerVersion?: string (optional)
	•	executorVersion: string
	•	toolRegistryVersion: string
	•	Preview/UI
	•	preview?: string (copied from step.preview or generated)
	•	riskLevel: "read-only"|"writes"|"commands" (tool’s risk level)
	•	category?: string (tool category)
	•	Policy snapshot
	•	policy: { confirmationsRequired: boolean, sandbox: {...}, limits: {...} }
	•	confirmationId?: string (links to the user approval event for this run)

Invariants
	•	args must already be validated against the tool’s inputSchema before dispatch.
	•	tool must exist in the tool registry.
	•	If a tool is disallowed by current policy, the call must not be dispatched (executor produces an immediate failure result with code: "POLICY_DENIED").

⸻

3.2 ToolResult (tool dispatcher → executor)

Purpose

Normalize all outcomes (success, failure, cancellation, timeout) into one shape.

Shape (conceptual)
	•	Identity
	•	callId: string
	•	runId: string
	•	stepId: string
	•	tool: string
	•	attempt: number
	•	Outcome
	•	status: "ok" | "error" | "timeout" | "cancelled" | "skipped"
	•	ok: boolean (redundant but convenient: status === "ok")
	•	Data
	•	data?: object (present only when ok; must validate against tool outputSchema)
	•	dataHash?: string (optional)
	•	Error (when not ok)
	•	error?: { code: string, message: string, details?: object, retryable?: boolean }
	•	Timing
	•	startedAt: string
	•	endedAt: string
	•	durationMs: number
	•	Effects (optional but strongly recommended)
	•	effects?: { sideEffectsObserved?: string[], created?: Array<{ path: string, kind: "file"|"folder" }>, modified?: Array<{ path: string, kind: "file", beforeEtag?: string, afterEtag?: string }>, deleted?: Array<{ path: string, kind: "file"|"folder", trashed?: boolean }>, renamed?: Array<{ from: string, to: string }> }
	•	User-facing messaging
	•	userMessage?: string (short; safe to show)
	•	debugMessage?: string (more verbose; logs)

Invariants
	•	If status === "ok", then data must exist and validate.
	•	If status !== "ok", then error must exist (except skipped, which may omit error and include reason in userMessage).
	•	Effects must reflect actual observed changes, not intended changes.

⸻

3.3 ExecutionEvent (executor → UI/log stream)

Purpose

Provide a consistent event stream for UI progress, logs, and telemetry.

Event types
	•	run.started
	•	run.confirmationRequested
	•	run.confirmed
	•	run.cancelled
	•	step.scheduled
	•	step.started
	•	step.progress (optional for streaming/long operations)
	•	step.finished
	•	step.failed
	•	run.finished

Common event fields
	•	runId
	•	timestamp
	•	level: "info"|"warn"|"error"
	•	message
	•	optional callId, stepId, tool
	•	optional payload (structured)

Rule

Every ToolCall should produce:
	•	step.started before dispatch
	•	step.finished on completion (or step.failed)

⸻

4) Referencing and templating rules (how args become concrete)

The envelope assumes the executor resolves references before creating a ToolCall.

Supported reference sources
	•	$steps.<stepId>: output of a completed step (ToolResult.data)
	•	$vars.<name>: executor variables (set from captureAs or internal computed values)
	•	foreach bindings: {item.<field>}, {index} based on foreach.itemName and foreach.indexName

Resolution requirements
	•	Missing references are fatal at validation time (before dispatch).
	•	Resolution is pure (no side effects).
	•	Resolved args are what gets hashed and logged.

⸻

5) Error classification and retry semantics

Standard error codes (recommended baseline)
	•	VALIDATION_ERROR (args fail schema)
	•	POLICY_DENIED (blocked by policy)
	•	NOT_FOUND (file/command not found)
	•	CONFLICT (etag mismatch/collision)
	•	PRECONDITION_FAILED (missing selection/active file)
	•	TIMEOUT
	•	CANCELLED
	•	INTERNAL_ERROR

Retry rules
	•	Retries are driven by:
	•	ActionPlan step retry + onError, and/or
	•	tool result error.retryable
	•	The executor must clamp retries to policy limits.
	•	Each attempt increments attempt and produces its own ToolCall/ToolResult pair (linked by same stepId and runId).

⸻

6) Confirmation model linkage

Even though confirmation is at the plan/run level, the envelope should carry:
	•	confirmationId (ties tool calls back to the user approval event)
	•	policy.confirmationsRequired (snapshot at time of call)

This makes audit logs provable: “this destructive operation was executed only after confirmation X.”

⸻

7) Audit log mapping

A single execution run should be reconstructable from:
	•	the original ActionPlan JSON
	•	the sequence of ToolCall envelopes
	•	the sequence of ToolResult envelopes
	•	the confirmation event

Recommended persisted artifacts:
	•	run.json (plan + policy snapshot + confirmation)
	•	calls.jsonl (ToolCall stream)
	•	results.jsonl (ToolResult stream)
	•	events.jsonl (ExecutionEvent stream; optional if calls/results are sufficient)

⸻

8) Minimal “comprehensive” envelope (JSON forms)

If you want concrete JSON shapes as a starting point, these are canonical:

ToolCall (canonical JSON)

{
  "callId": "uuid",
  "runId": "uuid",
  "stepId": "s5",
  "tool": "vault.createFile",
  "attempt": 1,
  "args": { "path": "XYZ/Foo.md", "content": "..." },
  "timeoutMs": 30000,
  "cancellable": true,
  "iteration": { "index": 3, "itemName": "item", "itemValue": { "path": "XYZ/Foo.md" } },
  "createdAt": "2025-12-16T18:12:00Z",
  "executorVersion": "1.0.0",
  "toolRegistryVersion": "1.0",
  "preview": "Create note “Foo” in folder XYZ",
  "riskLevel": "writes",
  "category": "vault",
  "policy": {
    "confirmationsRequired": true,
    "sandbox": { "enabled": true, "allowedRoots": ["/"], "denyPatterns": ["..","://"] },
    "limits": { "maxConcurrency": 4 }
  },
  "confirmationId": "uuid"
}

ToolResult (canonical JSON)

{
  "callId": "uuid",
  "runId": "uuid",
  "stepId": "s5",
  "tool": "vault.createFile",
  "attempt": 1,
  "status": "ok",
  "ok": true,
  "data": { "path": "XYZ/Foo.md", "etag": "abc123", "mtime": 1734372720000 },
  "startedAt": "2025-12-16T18:12:01Z",
  "endedAt": "2025-12-16T18:12:01Z",
  "durationMs": 240,
  "effects": {
    "sideEffectsObserved": ["create-file"],
    "created": [{ "path": "XYZ/Foo.md", "kind": "file" }]
  },
  "userMessage": "Created XYZ/Foo.md"
}

