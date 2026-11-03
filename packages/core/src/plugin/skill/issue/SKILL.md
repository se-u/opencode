---
name: issue
description: Capture non-trivial bug reports, feature requests, stack traces, or deferred problems into structured tasks with exact file:line code locations. Trivial issues (typos, quick single-line fixes) skip issue creation and take the direct fix path. Triggers on "ada bug", "tambah issue", "issue", "catat issue", "rekam bug", "tambah ke issue", "computer:issue", or pasted error stack-traces.
---

# Issue — Capture Issues with Code Locations

When a user reports an issue, this skill locates the exact file:line context using native search tools and records it into the project's task registry (`.opencode/tasks.json` or `.beads/`).

---

## Triage Fast-Path (Zero-Overhead Rule)

Before creating an issue, evaluate the scope of work:

- **Direct Fix Path (Skip Issue Creation):** If an issue is trivial (e.g., typo, single-line syntax/import error, obvious fix taking <2 minutes) in the active session, **DO NOT** create an issue. Fix it directly.
- **Tracked Issue Path (Create Issue):** Create a tracked issue only when the task requires deeper investigation, affects multiple files/subsystems, or is being deferred/backlogged.

---

## Workflow

### Step 1 — Parse the Issue
Extract from the user's input:
- **What**: The symptom or problem description.
- **Where**: File path, function name, error string, or stack frame mentioned.
- **Severity**:
  - `urgent`: Keywords "urgent", "critical", "down", "broken", "production"
  - `bug`: Keywords "bug", "error", "fail", "crash", "exception", "TypeError"
  - `feature`: Keywords "add", "new", "feature", "should have", "missing", "tambah"
  - `low`: Default

### Step 2 — Find the Exact Code Location & 1-Step Trace Back (Zero-Discovery Anchor)
Locate the exact code target so downstream execution does not waste token search cycles:

1. **Distinguish Crash Site vs. Root Cause Site**:
   - **Crash / Failure Site**: The file and line where the exception or error explodes.
   - **Root Cause Site**: The upstream caller or subsystem that passed invalid state, unvalidated arguments, or unexpected data.
2. **1-Step Trace Back**:
   - For `TypeError`, null/undefined dereferences, or invalid argument errors, do not just inspect the line that crashed. Inspect 1 frame up the call stack (the immediate caller).
   - Identify both the crash site and the upstream caller/scope to avoid symptom-patching.
3. **Code Search (Native Tools)**:
   - Use `Grep` or `Glob` to locate exact symbols, error messages, function definitions, or file paths.
   - For semantic exploration when symbol names are unknown, use repository code search tools (`dkcontext search` or MCP search if available).
4. **Inspect Context**:
   - Inspect the file with `Read` to identify the precise line number and grab 3–5 lines of surrounding context.
   - If the issue is a new feature or project-wide without an existing file, use `[<module/subsystem>]` as anchor (e.g., `[auth/oauth]`).

### Step 3 — Record Issue

**Title Format:**
`[<relative-path>:<line>] <Action Verb> <Concise Imperative Title>`  
*Example:* `[src/auth/jwt.ts:45] Fix token expiration calculation`

#### Task Tracking Storage:
1. **If using `bd` (Beads)**:
   ```bash
   bd create "[<file-path>:<line>] <Action Verb> <Title>" --description "$(cat <<'EOF'
   ### Crash / Failure Site
   - File: `<file-path>`
   - Line: <line-number>
   - Context:
   ```<lang>
   <3-5 lines of code context>
   ```

   ### Suspected Investigation Scope
   - Suspected Upstream: <caller file/subsystem or N/A>
   - Context Notes: <why it might originate upstream>

   ### Problem Statement
   <Clear explanation of what fails or what needs to be added>

   ### Acceptance Criteria
   - [ ] Confirm upstream root cause before patching crash site
   - [ ] Reproduce with failing test or verification command
   - [ ] <Concrete condition for fix completion>
   EOF
   )"
   ```

2. **If using `.opencode/tasks.json`**:
   Append a structured task entry to `.opencode/tasks.json` with an incremented ID, title, priority, and description.

### Step 4 — Confirm to User
Print a single confirmation line:
> ✅ Recorded issue: **[<file>:<line>] <Title>**
