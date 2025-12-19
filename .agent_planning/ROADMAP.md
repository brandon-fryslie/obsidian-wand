# Obsidian Wand - Product Roadmap

> **Vision**: Transform Obsidian from a note-taking app into a **programmable knowledge operating system** where AI agents automate complex workflows, connect ideas, and amplify human thinking.

---

## Current State (v0.1)

The foundation is solid:
- Natural language → deterministic execution pipeline
- 20+ tools across vault, editor, workspace, and commands
- Plan generation, approval workflow, and execution engine
- Templates with parameter substitution
- Plan dependencies with conflict detection
- Risk-based approval levels

---

## Phase 1: The Research Powerhouse
*"Your AI research assistant that never forgets"*

### 1.1 Literature Synthesis Engine
**Use Case**: Researchers drowning in papers, articles, and sources

- **Smart Import**: Drop a PDF/URL → auto-extract highlights, create structured note
- **Concept Extraction**: Identify key terms, authors, methodologies across multiple sources
- **Synthesis Matrix**: Auto-generate comparison tables across frameworks/papers
- **Citation Graph**: Visualize how sources connect via shared concepts
- **Meta-Notes**: AI-generated summaries that link primary sources

**Example Plan**: "Synthesize my 12 papers on distributed systems into a literature review outline"

### 1.2 Zettelkasten Auto-Linker
**Use Case**: PKM enthusiasts who want their vault to "think for them"

- **Concept Detection**: Scan notes for key entities, ideas, claims
- **Smart Backlinks**: Auto-suggest bidirectional links with context snippets
- **Cluster Discovery**: Find emergent themes across unconnected notes
- **Index Generation**: Auto-create MOC (Map of Content) notes for concept clusters
- **Gap Analysis**: "You have 47 notes on X but none connecting it to Y"

**Example Plan**: "Find all notes about 'mental models' and create an index with connections"

### 1.3 Book Reading Workflow
**Use Case**: Serious readers who want structured engagement with books

- **One-Click Setup**: Enter book title → generates complete reading environment
  - Chapter outline structure
  - Highlights & annotations folder
  - Questions to explore tracker
  - Theme emergence log
  - Reading progress journal
- **Spaced Repetition**: Generate review plans for key concepts
- **Book Connections**: Link to other books/notes on similar themes

**Example Plan**: "Set up a reading environment for 'Thinking in Systems' by Donella Meadows"

---

## Phase 2: The Content Engine
*"From idea to published in one workflow"*

### 2.1 Content Calendar Pipeline
**Use Case**: Content creators, bloggers, newsletter writers

- **Calendar Parser**: Read content calendar → generate draft structures
- **Outline Generator**: Create detailed outlines with research prompts
- **Asset Tracker**: Track images, links, references needed per piece
- **Editorial Workflow**: Dependent plans for draft → review → publish
- **Repurposing**: One content piece → multiple format variations

**Example Plan**: "Generate Q1 content structure from my editorial calendar"

### 2.2 Audience-Adaptive Templates
**Use Case**: Writers serving multiple audiences

- **Audience Profiles**: Define technical vs. beginner, B2B vs. B2C
- **Smart Adaptation**: Same content structure, different language/depth
- **Style Guides**: Auto-apply tone, vocabulary, complexity per audience
- **A/B Variants**: Generate multiple versions for testing

**Example Plan**: "Create technical deep-dive AND executive summary from this architecture doc"

### 2.3 Writing Session State Machine
**Use Case**: Long-form writers who need context continuity

- **Session Context**: Load where you left off, current section, blockers
- **Research Companion**: Auto-gather related notes into "working set"
- **Progress Tracking**: Word count, section completion, momentum metrics
- **Distraction-Free Setup**: Close unrelated tabs, load relevant references

**Example Plan**: "Prepare my writing environment for Chapter 7"

---

## Phase 3: The Project Command Center
*"Manage complexity without losing your mind"*

### 3.1 Agile Sprint Automation
**Use Case**: Solo developers, small teams using Obsidian for project management

- **Sprint Setup**: Read backlog → generate sprint board structure
- **Issue Templates**: Create notes with acceptance criteria, estimates
- **Burndown Tracking**: Auto-update progress metrics
- **Standup Generator**: Daily summary of changes, blockers
- **Retrospective Scaffolding**: Dependent plan triggers at sprint end

**Example Plan**: "Set up Sprint 14 from my product backlog"

### 3.2 Meeting Lifecycle Manager
**Use Case**: Anyone who has too many meetings

- **Pre-Meeting**: Generate agenda, async input collection, context links
- **During**: Decision log structure, action item capture
- **Post-Meeting**: Summary generator, action assignment, follow-up scheduler
- **Accountability**: Dependent plans check action item completion

**Example Plan**: "Prepare tomorrow's architecture review meeting"

### 3.3 Project Post-Mortem System
**Use Case**: Teams that want to learn from every project

- **Auto-Generate Structure**: Post-mortem template from project notes
- **Cross-Project Learning**: Search vault for related lessons learned
- **Categorization**: Process, technical, communication, team dynamics
- **Action Pipeline**: Dependent plans for each improvement category

**Example Plan**: "Generate post-mortem for the Q4 platform migration"

---

## Phase 4: The Data Alchemist
*"Transform raw data into structured knowledge"*

### 4.1 Bulk Transformation Engine
**Use Case**: Power users with large, messy vaults

- **Smart Refactoring**: Normalize metadata, headings, tags across folders
- **Format Migration**: Convert between frontmatter styles, link formats
- **Before/After Diffs**: Preview all changes before execution
- **Staged Execution**: Dependent plans for verify → backup → transform → validate

**Example Plan**: "Standardize all daily notes to use the new template format"

### 4.2 Vault Health Dashboard
**Use Case**: Maintainers of large knowledge bases

- **Health Metrics**: Dead links, orphans, duplicates, inconsistencies
- **Automated Fixes**: One-click repair for common issues
- **Growth Analytics**: Note creation patterns, link density trends
- **Optimization Suggestions**: "These 15 notes could be merged"

**Example Plan**: "Generate vault health report and queue fixes"

### 4.3 Data Import Workbench
**Use Case**: Migrating from other tools or importing external data

- **Multi-Format Support**: JSON, CSV, Notion, Roam, Bear exports
- **Smart Mapping**: Auto-detect structure, suggest Obsidian format
- **Validation Pipeline**: Check consistency before commit
- **Rollback Safety**: Dependent plan for undo if issues found

**Example Plan**: "Import my Notion workspace into Obsidian"

---

## Phase 5: The Automation Layer
*"Your vault works while you sleep"*

### 5.1 Smart Periodic Notes
**Use Case**: Everyone who uses daily/weekly/monthly notes

- **Context-Aware Daily Notes**:
  - Yesterday's incomplete tasks
  - Calendar events (via integration)
  - Weather, quote, or custom data
  - Relevant notes from exactly 1 year ago
- **Weekly Aggregation**: Auto-summarize accomplishments, patterns
- **Monthly Retrospective**: Metrics, highlights, goals review
- **Quarterly Planning**: Dependent plans for strategic review

**Example Plan**: "Set up intelligent daily note generation"

### 5.2 Scheduled Maintenance
**Use Case**: Power users who want a self-maintaining vault

- **Scheduled Scans**: Regular health checks, cleanup tasks
- **Auto-Archive**: Move stale notes to archive based on rules
- **Tag Gardening**: Normalize, merge, or split tags automatically
- **Link Maintenance**: Fix broken links, update renamed references

**Example Plan**: "Run weekly vault maintenance"

### 5.3 Event-Driven Workflows
**Use Case**: Advanced automation enthusiasts

- **File Triggers**: New file in folder → execute plan
- **Time Triggers**: Daily at 9am, weekly on Monday
- **Content Triggers**: Note contains #review → queue for processing
- **External Webhooks**: API call triggers plan execution

**Example Plan**: "When I add a note to /inbox, auto-process and file it"

---

## Phase 6: The Connected Brain
*"Break out of the single-vault silo"*

### 6.1 External API Integration
**Use Case**: Users who want real-world data in their vault

- **Weather Service**: Daily notes with local weather
- **Calendar Sync**: Import events, create meeting notes
- **RSS/News Feeds**: Auto-import articles of interest
- **Task Managers**: Sync with Todoist, Things, Reminders
- **Read-Later Services**: Import from Pocket, Instapaper

**Example Plan**: "Import this week's calendar events as meeting prep notes"

### 6.2 Multi-Vault Orchestration
**Use Case**: Users with work/personal/project vaults

- **Sync Manifests**: Define what syncs between vaults
- **Conflict Resolution**: Smart merging of shared content
- **Cross-Vault Search**: Find related notes across all vaults
- **Selective Sharing**: Push specific notes to shared vault

**Example Plan**: "Sync my 'public learnings' folder to my blog vault"

### 6.3 Collaboration Features
**Use Case**: Teams using shared Obsidian vaults

- **Template Sharing**: Publish templates for team use
- **Plan Suggestions**: "Alice ran this plan successfully, try it?"
- **Conflict Avoidance**: Warn when plans touch same files
- **Activity Feed**: See what plans teammates are running

---

## Phase 7: The Intelligence Layer
*"AI that learns how you work"*

### 7.1 Plan Analytics & Learning
- **Usage Patterns**: Which plans run most, which fail, which get modified
- **Suggestion Engine**: "You usually run X after Y, want to chain them?"
- **Template Evolution**: Auto-improve templates based on user edits
- **Performance Insights**: "This plan is slow because of step 3"

### 7.2 Predictive Assistance
- **Proactive Suggestions**: "It's Monday, want to run your weekly review?"
- **Context-Aware Plans**: Suggest plans based on current file/folder
- **Error Prevention**: "This plan might conflict with your in-progress work"
- **Smart Defaults**: Learn your preferences for approvals, risk levels

### 7.3 Natural Language Improvements
- **Ambiguity Resolution**: Ask clarifying questions before planning
- **Intent Understanding**: Better grasp of complex, multi-step requests
- **Recovery Suggestions**: "Plan failed, here's how to fix it"
- **Explanation Mode**: "Here's why I generated this plan"

---

## Phase 8: Plugin Ecosystem & Developer Tools
*"Play nice with others, help others play"*

### Topics

| Topic | Directory | Epic | State |
|-------|-----------|------|-------|
| Excalidraw Integration | `integration-excalidraw/` | `obsidian-toolagent-2xq` | PROPOSED |
| Dataview Integration | `integration-dataview/` | `obsidian-toolagent-zr6` | PROPOSED |
| Templater Integration | `integration-templater/` | `obsidian-toolagent-inv` | PROPOSED |
| Tasks Integration | `integration-tasks/` | `obsidian-toolagent-zx9` | PROPOSED |
| Advanced Tables Integration | `integration-advanced-tables/` | `obsidian-toolagent-4ox` | PROPOSED |
| Plugin Scaffold Generator | `plugin-scaffold-generator/` | `obsidian-toolagent-1on` | PROPOSED |

---

### 8.1 Excalidraw Integration (5M+ downloads)
**Directory**: `integration-excalidraw/`
**Use Case**: Visual thinkers who sketch ideas before/during/after writing

- **Plan Visualization**: Auto-generate Excalidraw diagrams from plan steps
- **Sketch-to-Plan**: Convert hand-drawn flowcharts into executable plans
- **Embedded Previews**: Show Excalidraw drawings in plan previews
- **Visual Dependencies**: Render plan dependencies as connected diagrams

**Example Plan**: "Create a visual workflow diagram for my content pipeline"

---

### 8.2 Dataview Integration (3.5M+ downloads)
**Directory**: `integration-dataview/`
**Use Case**: Power users who query their vault like a database

- **DQL as Input**: Use Dataview queries to select files for bulk operations
- **Query Generation**: Natural language → Dataview query
- **Live Data Plans**: Plans that operate on dynamic query results
- **Table Manipulation**: Transform Dataview tables into new notes/structures

**Example Plan**: "For all notes where status = 'draft' and created > 30 days ago, add #stale tag"

---

### 8.3 Templater Integration (3.4M+ downloads)
**Directory**: `integration-templater/`
**Use Case**: Users with complex template workflows

- **Templater Aware**: Recognize and preserve `<% %>` syntax in plans
- **Template Execution**: Trigger Templater templates as plan steps
- **Migration Path**: Convert Templater scripts to Wand plans
- **Coexistence**: Clear guidance on when to use Templater vs Wand

**Example Plan**: "Apply my 'project-setup' Templater template to this folder"

---

### 8.4 Tasks Integration (3M+ downloads)
**Directory**: `integration-tasks/`
**Use Case**: Task-heavy users managing todos across notes

- **Task Queries**: Find tasks by status, due date, tags, priority
- **Bulk Task Ops**: Mark complete, reschedule, move tasks across notes
- **Task Generation**: Create tasks from plan steps automatically
- **Progress Sync**: Update plan status based on task completion

**Example Plan**: "Find all overdue tasks and move them to today's daily note"

---

### 8.5 Advanced Tables Integration (2.5M+ downloads)
**Directory**: `integration-advanced-tables/`
**Use Case**: Users working with structured tabular data

- **Table-Aware Plans**: Parse and manipulate markdown tables
- **CSV Import/Export**: Convert between tables and external formats
- **Table Generation**: Create tables from vault queries
- **Column Operations**: Add, remove, transform table columns

**Example Plan**: "Add a 'Status' column to all tables in my Projects folder"

---

### 8.6 Obsidian Plugin Scaffold Generator
**Directory**: `plugin-scaffold-generator/`
**Use Case**: Developers who want to build Obsidian plugins with AI assistance

A command that generates a complete, ready-to-develop Obsidian plugin template with:

#### Project Structure
- TypeScript + esbuild configuration (like Wand)
- Svelte component setup for UI
- Proper `manifest.json` and `versions.json`
- `.gitignore` and basic repo structure

#### AI Development Integration
- **Debug Launch Script**: `bin/launch-obsidian.sh` that starts Obsidian with `--remote-debugging-port=9222`
- **Just Recipes**: `just obsidian` to launch debug mode, `just build`, `just dev`
- **MCP Configuration**: `.mcp.json` pre-configured with Chrome DevTools MCP server
- **CLAUDE.md**: Instructions for Claude Code on how to debug/test the plugin

#### Development Helpers
- Test vault setup script
- Hot reload configuration
- Basic plugin boilerplate (main.ts, settings, views)
- Example Svelte component

**Example Command**: `wand:scaffold my-awesome-plugin`

**Generated `.mcp.json`**:
```json
{
  "mcpServers": {
    "chromedevtools/chrome-devtools-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--browserUrl", "http://127.0.0.1:9222"]
    }
  }
}
```

**Generated `bin/launch-obsidian.sh`**:
```bash
#!/bin/bash
# Kill any existing Obsidian debug sessions
pkill -f "Obsidian.*--remote-debugging-port" 2>/dev/null
# Launch with debug port
/Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222 &
echo "Obsidian launched with debug port 9222"
echo "Connect Claude Code via Chrome DevTools MCP"
```

---

## Technical Milestones

### Infrastructure
- [ ] **Custom Tool SDK**: Let power users add their own tools
- [ ] **Plugin API**: Third-party extensions to Wand
- [ ] **Performance Mode**: Parallel execution for bulk operations
- [ ] **Offline Mode**: Queue plans when LLM unavailable

### Integrations
- [ ] **Dataview Integration**: Use DQL queries as plan inputs
- [ ] **Templater Compatibility**: Work alongside Templater
- [ ] **Git Integration**: Version control for plans and vault changes
- [ ] **Mobile Support**: Execute plans on Obsidian Mobile

### Developer Experience
- [ ] **Plan Debugger**: Step-through execution with breakpoints
- [ ] **Dry Run Mode**: Preview all changes without executing
- [ ] **Plan Diff**: Compare two plans or plan versions
- [ ] **Test Framework**: Automated testing for custom templates

---

## Success Metrics

### User Value
- Time saved per week on repetitive tasks
- Vault connectivity score (links per note)
- Content creation velocity
- Knowledge retrieval speed

### Product Health
- Plans executed per user per week
- Template reuse rate
- Plan success rate (no failures)
- User retention at 30/60/90 days

### Community Growth
- Shared templates in marketplace
- Community-contributed tools
- Integration requests and contributions
- Discord/forum engagement

---

## The North Star

**Wand transforms Obsidian from a tool you *use* into a system that *works for you*.**

The ultimate goal: Users describe what they want in natural language, Wand handles the complexity, and the vault becomes a living, self-organizing knowledge system that amplifies human thinking rather than creating busywork.

---

*This roadmap is a living document. Priorities will evolve based on user feedback, technical discoveries, and community contributions.*
