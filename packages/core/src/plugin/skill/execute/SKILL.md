---
name: execute
description: Pick up and execute open issues from bd (Beads) issue tracker, claim them, implement fixes/features, close issues, and log progress to computer:brain. Supports single-issue fast tracking and automated multi-wave parallel batch execution. Triggers on "kerjakan issue", "lanjut kerjaan", "pick up", "fix", "execute", "computer:execute", "execute batch", "batch execute", "kerjakan batch", "what's next", "ada kerjaan apa".
---

# Computer Execute — Drain and Complete Issues from Beads (`bd`)

`computer:execute` connects the developer/assistant directly to the **`bd` (Beads)** issue tracker to systematically pick up, claim, implement, and close issues for the active project. Supports both single-issue focused execution and multi-agent wave-based batch execution.

---

## Workflow A — Single Issue Execution

### Step 1 — Verify Project `bd` ID & Fetch Open Issues
1. Obtain project ID from `.beads/metadata.json` (`proj_XXXXXXXX`).
2. Run `bd ready` via bash to fetch available open issues.
3. If user specified an issue ID (e.g. `bd-12` or `12`):
   - Verify it exists using `bd show <id>`.
4. If no issue ID specified:
   - Pick the top open issue by priority from `bd ready`.
   - If no issues are open in `bd ready`, inform the user:
     > ✅ No open issues in `bd ready`. Project backlog is clear!

### Step 2 — Claim the Issue
Run `bd update <id> --claim` to mark the issue as claimed/in-progress.

Print execution header:
> 🎯 Working on **[<id>] <Title>** at `<file>:<line>`

### Step 3 — Implement Code Fix or Feature (Zero-Discovery Fast Track)
1. **Extract Anchor**:
   - Check if the title has an anchor prefix: `[<file>:<line>] <Title>`.
   - Read full task details via `bd show <id>` to inspect `### Target Location` and `### Acceptance Criteria`.
2. **Direct Targeted Read**:
   - Immediately open the target file using `Read` tool at the specified line number.
   - **DO NOT** run exploratory grep/glob/search tools when the anchor is already present—jump directly into understanding the target code.
   - *Only if* no anchor is found, use `jbcontext search` as a single semantic bootstrap to locate the code.
3. **Targeted Implementation**:
   - Apply minimal, surgical edits to satisfy each item in `### Acceptance Criteria`.
   - Never add unsolicited refactoring or speculative features.
4. **Verification**:
   - Run tests or verification commands specified in the acceptance criteria.

### Step 4 — Close Issue in `bd`
1. Close the issue in `bd`:
   ```bash
   bd close <id>
   ```
2. Add resolution notes if needed:
   ```bash
   bd comment <id> --message "Resolved: <one-line summary of fix>"
   ```

### Step 5 — Log Activity to `computer:brain`
Log the completed task automatically into project history:
- Record entry: `Completed issue [<id>] <Title> at <file>:<line>`
- Update `computer:brain` history log.

### Step 6 — Confirm Completion
Print summary:
> ✅ **[<id>] <Title>** closed in `bd` and logged to `computer:brain`.

---

## Workflow B — Wavefront Batch Execution (`computer:execute batch`)

When invoked with `batch` or requested to clear all backlog tasks, orchestrate tasks through an automated, dependency-aware multi-wave pipeline:

```
[Fetch bd ready] ──► [Filter Zero-Overlap Wave] ──► [Parallel Subagents Fan-out] ──► [Barrier Sync & Close]
       ▲                                                                                     │
       └─────────────────────────── [Repeat until bd ready is empty] ◄───────────────────────┘
```

### Wave Lifecycle Protocol

1. **Step 1: Scan Ready Queue (`bd ready`)**
   - Run `bd ready` to retrieve all currently unblocked issues.
   - If no ready issues remain:
     - Check `bd blocked` to ensure no orphaned deadlocks.
     - If all tasks are completed, output final batch summary and finish.

2. **Step 2: Partition Wave & Detect File Conflicts (Zero-Overlap Rule)**
   - Extract the target file path from each task title's anchor (`[<file-path>:<line>]`).
   - Group tasks into the current **Wave**: select all ready tasks whose target files do not overlap.
   - *Rule:* If two tasks target the same file, include only the higher priority task in the current wave and defer the other to the subsequent wave to prevent Git merge collisions.

3. **Step 3: Concurrent Subagent Fan-Out**
   - Announce wave start:
     > 🌊 **Starting Wave N: Spawning X concurrent subagent(s)...**
   - Launch subagents concurrently via the `Agent` tool (one subagent per task).
   - Each subagent is prompted with:
     - Task ID and Title (`[<id>] [<file>:<line>] <Title>`).
     - Explicit instructions to claim the issue (`bd update <id> --claim`).
     - Target location and acceptance criteria extracted from `bd show <id>`.
     - Direct targeted edit and test verification rules (zero-discovery fast-track).
     - Instruction to close the issue upon completion (`bd close <id>`).

4. **Step 4: Barrier Synchronization & Health Check**
   - Main orchestrator waits for all subagents in the wave to report back.
   - Verify that all claimed issues in the wave were successfully closed in `bd`.
   - If any subagent reports a blocking error or failed test, halt batch execution, leave the issue open, and surface the blockage to the user.

5. **Step 5: Wavefront Progression & Iteration**
   - As tasks close, Beads automatically resolves dependencies and unblocks downstream tasks.
   - Loop back to **Step 1** to fetch the newly unblocked tasks for the next wave.
   - Continue until `bd ready` returns 0 issues.

6. **Step 6: Batch Finalization & Brain Logging**
   - Summarize total completed tasks and total waves executed.
   - Log batch completion entry to `computer:brain`.
   - Present final report:
     > 🎉 **Batch Execution Completed**: X task(s) closed across Y wave(s).

---

## Subcommands

- **`computer:execute`**: Pick up the single top ready issue from `bd` and execute it.
- **`computer:execute <id>`**: Work specifically on issue `<id>`.
- **`computer:execute batch`**: Run automated multi-wave parallel batch execution across all ready/unblocked issues until backlog is drained.
- **`computer:execute list`**: Show open issues ready to be executed (`bd ready`).
