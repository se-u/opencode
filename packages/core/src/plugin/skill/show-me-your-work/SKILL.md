---
name: show-me-your-work
description: Use when conducting long-running, autonomous, or unattended tasks where an auditable decision trail (decisions.tsv) is required to reconstruct technical choices, reasons, evidence, and results
argument-hint: "[optional log file path or task name]"
version: 1.0.0
---

# /show-me-your-work — Decision Trail & Flight Recorder

## Overview
When an agent works autonomously for extended periods (e.g. running background migrations, executing multi-phase plans, or working while the human is away), the human needs to reconstruct what was decided, why, and on what evidence without reading hundreds of pages of raw terminal transcripts.

`/show-me-your-work` records an append-only **flight recorder** log in TSV (Tab-Separated Values) format: `decisions.tsv`.

---

## When to Use
- Running long autonomous tasks (`/loop`, overnight runs, or multi-hour refactors).
- Complex technical explorations where multiple approaches or spikes are tested.
- Whenever the user explicitly asks: `/show-me-your-work`, *"keep a decision log"*, or *"show me your work"*.
- Working on a Beads issue (`bd`) that requires an auditable decision history before closure.

### When NOT to Use
- Quick single-line fixes, typos, or trivial 2-minute edits.
- Standard conversational questions that do not change code or architecture.

---

## The 6-Column TSV Format

The log lives in a single TSV file (`decisions.tsv` by default, or `.audit/<task-slug>.tsv`). TSV is chosen because GitHub automatically renders it as a clean, sortable table in Pull Requests, and terminals render it neatly via:
```bash
column -s$'\t' -t decisions.tsv
```

| Column | Description | Example |
|---|---|---|
| **`ts`** | ISO8601 UTC timestamp | `2026-10-29T09:15:00Z` |
| **`phase`** | Current workstream or phase | `prototype`, `migration`, `harness`, `verify` |
| **`decision`** | 1-line summary of what was chosen or done | `Switched from synchronous Map to LRU cache` |
| **`why`** | Plain human reason (no buzzwords) | `Memory grew unbounded with 50k mock entities` |
| **`evidence`** | Concrete pointer (commit SHA, `file:line`, log path) | `scripts/bench.log`, `commit a3b2c1` |
| **`result`** | Empirical outcome | `memory capped at 48MB`, `tests green`, `reverted` |

---

## How to Log a Decision

Always use the bundled helper script to ensure clean escaping and formula-injection safety:
```bash
bash claude/skills/show-me-your-work/scripts/log.sh decisions.tsv "<phase>" "<decision>" "<why>" "<evidence>" "<result>"
```

### What Deserves a Row:
- **Architecture Forks:** Choosing between two database drivers or cache strategies.
- **Hypothesis Failure & Reverts:** An approach that failed runtime verification and was rolled back (`result: reverted`).
- **Verifiable Checkpoints:** Completing a migration milestone with tests passing (`result: tests green`).
- **Major Trade-offs:** Adding a temporary fallback shim for legacy callers.

*Skip trivial edits (fixing a lint error, renaming a local variable).*

---

## Integration with Beads (`bd`)

1. **At Task Start:**
   Claim the Beads issue:
   ```bash
   bd update <id> --claim
   ```
2. **During Autonomous Execution:**
   Append rows to `decisions.tsv` as key decisions are made and verified.
3. **At Task Close:**
   - Run verification and `/deslop` quality gate.
   - Present the `decisions.tsv` summary table to the user.
   - Record the final core insight to Beads memory:
     ```bash
     bd remember "<core insight learned from this work>"
     ```
   - Close the issue:
     ```bash
     bd close <id>
     ```

---

## Verification & Honesty Rule
- **Never fabricate evidence:** Every link, file path, commit hash, or log in the `evidence` column must physically exist.
- **Append-Only:** Never rewrite history. If a prior decision was wrong, log a new row explaining why it was superseded.
