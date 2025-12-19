Below is a complete ActionPlan JSON Schema you can use as the contract between the LLM “planner” and your Obsidian plugin executor.

It’s written in JSON Schema 2020-12 form. It is intentionally:
	•	strict (rejects unknown fields),
	•	explicit about control flow (foreach, dependsOn, onError, retry),
	•	and designed to support deterministic execution + clean UI previews.

You’ll still define the tool argument schemas separately (next section includes a placeholder structure so you can plug them in).

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/obsidian-embedded-agent/action-plan.schema.json",
  "title": "Obsidian Embedded Agent ActionPlan",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "goal", "riskLevel", "steps"],
  "properties": {
    "version": {
      "type": "string",
      "description": "Schema version for the plan format (not the plugin version).",
      "pattern": "^[0-9]+\\.[0-9]+(\\.[0-9]+)?$",
      "examples": ["1.0", "1.1.0"]
    },
    "goal": {
      "type": "string",
      "description": "A concise human-readable statement of what the plan intends to accomplish.",
      "minLength": 1
    },
    "assumptions": {
      "type": "array",
      "description": "Assumptions the planner is making about the current Obsidian state (selection exists, active note is markdown, etc.).",
      "items": { "type": "string", "minLength": 1 },
      "default": []
    },
    "riskLevel": {
      "type": "string",
      "description": "Planner-declared risk category used for UI confirmation and policy enforcement.",
      "enum": ["read-only", "writes", "commands"]
    },
    "contextRequests": {
      "type": "array",
      "description": "Optional: declare what runtime context the planner expects to use. The host can prefetch and/or validate availability.",
      "items": { "$ref": "#/$defs/ContextRequest" },
      "default": []
    },
    "defaults": {
      "type": "object",
      "description": "Optional defaults applied by the executor when a step omits certain control fields.",
      "additionalProperties": false,
      "properties": {
        "onError": { "$ref": "#/$defs/OnError" },
        "retry": { "$ref": "#/$defs/RetryPolicy" }
      },
      "default": {}
    },
    "steps": {
      "type": "array",
      "description": "Ordered list of steps. The executor runs steps in order, subject to dependsOn and foreach expansion.",
      "minItems": 1,
      "items": { "$ref": "#/$defs/Step" }
    },
    "outputs": {
      "type": "object",
      "description": "Optional: planner-declared outputs that should be presented to the user (e.g., list of created notes).",
      "additionalProperties": false,
      "properties": {
        "showCreatedFiles": { "type": "boolean", "default": true },
        "showModifiedFiles": { "type": "boolean", "default": true },
        "showCommandRuns": { "type": "boolean", "default": true }
      },
      "default": {}
    },
    "uiHints": {
      "type": "object",
      "description": "Optional: hints that improve readability in the plan preview UI. Never used for execution logic.",
      "additionalProperties": false,
      "properties": {
        "title": { "type": "string", "minLength": 1 },
        "summary": { "type": "string", "minLength": 1 }
      },
      "default": {}
    }
  },
  "$defs": {
    "ContextRequest": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind"],
      "properties": {
        "kind": {
          "type": "string",
          "description": "Known context the planner expects.",
          "enum": [
            "activeFilePath",
            "selection",
            "cursor",
            "workspaceContext",
            "commandList",
            "vaultFileList"
          ]
        },
        "options": {
          "type": "object",
          "description": "Optional request parameters (e.g., limits for vault file list).",
          "additionalProperties": true,
          "default": {}
        }
      }
    },

    "Step": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "tool", "args"],
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique step identifier within this plan.",
          "pattern": "^[A-Za-z][A-Za-z0-9_\\-]*$"
        },
        "tool": {
          "type": "string",
          "description": "Name of the tool to invoke. Must match a tool exposed by the host."
        },
        "args": {
          "type": "object",
          "description": "Arguments for the tool call. Tool-specific schema is validated by the host's tool registry.",
          "additionalProperties": true
        },

        "preview": {
          "type": "string",
          "description": "Human-friendly description of what this step will do (for plan UI).",
          "minLength": 1
        },

        "dependsOn": {
          "type": "array",
          "description": "Step IDs that must complete successfully before this step runs.",
          "items": { "type": "string", "pattern": "^[A-Za-z][A-Za-z0-9_\\-]*$" },
          "uniqueItems": true,
          "default": []
        },

        "foreach": {
          "$ref": "#/$defs/ForEach"
        },

        "captureAs": {
          "type": "string",
          "description": "Optional alias for this step's output in the executor's runtime context.",
          "pattern": "^[A-Za-z][A-Za-z0-9_\\-\\.]*$"
        },

        "onError": {
          "$ref": "#/$defs/OnError"
        },
        "retry": {
          "$ref": "#/$defs/RetryPolicy"
        },

        "timeoutMs": {
          "type": "integer",
          "description": "Optional per-step timeout enforced by the host.",
          "minimum": 1
        },

        "tags": {
          "type": "array",
          "description": "Optional labels for UI grouping and logging.",
          "items": { "type": "string", "minLength": 1 },
          "default": []
        }
      }
    },

    "ForEach": {
      "type": "object",
      "additionalProperties": false,
      "required": ["from", "itemName"],
      "properties": {
        "from": {
          "type": "string",
          "description": "A reference to an array in the runtime context, e.g. '$steps.parseBullets.items' or '$vars.notes'.",
          "minLength": 1
        },
        "itemName": {
          "type": "string",
          "description": "Name bound to each item during iteration; may be referenced in args via templating.",
          "pattern": "^[A-Za-z][A-Za-z0-9_\\-]*$"
        },
        "indexName": {
          "type": "string",
          "description": "Optional name bound to the loop index.",
          "pattern": "^[A-Za-z][A-Za-z0-9_\\-]*$"
        },
        "concurrency": {
          "type": "integer",
          "description": "Optional max concurrent iterations; host may clamp to a safe maximum. If omitted, executor runs sequentially.",
          "minimum": 1
        }
      }
    },

    "OnError": {
      "type": "string",
      "description": "How the executor should respond if this step fails.",
      "enum": ["stop", "skip", "retry"]
    },

    "RetryPolicy": {
      "type": "object",
      "additionalProperties": false,
      "required": ["maxAttempts"],
      "properties": {
        "maxAttempts": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10,
          "description": "Total attempts including the first try."
        },
        "backoffMs": {
          "type": "integer",
          "minimum": 0,
          "maximum": 600000,
          "default": 250,
          "description": "Base backoff delay between retries. Executor may apply jitter."
        }
      }
    }
  }
}

Notes on how this schema is intended to be used
	•	Tool argument validation is done by your tool registry, not by this schema. This schema ensures the plan structure is valid; the host then validates args for each tool against that tool’s schema.
	•	foreach.from is deliberately a string “reference” so you can support simple conventions like:
	•	$steps.<stepId> (output of a step)
	•	$vars.<name> (executor variables)
	•	captureAs lets the planner name outputs; otherwise the executor can automatically store step outputs under $steps.<id>.

If you want, next I can provide:
	•	a recommended tool registry schema format (JSON Schema per tool),
	•	a concise templating/reference spec for resolving $steps.* and loop variables inside args,
	•	and an end-to-end example plan for your “10 selected bullets → create notes in folder XYZ → replace selection with links” workflow.
