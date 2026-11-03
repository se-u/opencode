---
name: how
description: Use when answering questions about how a subsystem or flow works, conducting architectural code walkthroughs before modifying unfamiliar code, tracing runtime paths from input to output, or evaluating placement and layering decisions
argument-hint: "<subsystem, feature, or architectural question>"
version: 1.0.0
---

# /how — Subsystem Architecture & Runtime Flow Explainer

## Overview
Before modifying unfamiliar code, a developer needs a working mental model—not annotated source code or syntax narration. `/how` explores the codebase to trace runtime flows from trigger to effect, map architectural boundaries, and highlight non-obvious gotchas.

It operates in two modes:
1. **Explain Mode (default)**: Produces an onboarding-grade walkthrough of a feature, subsystem, or request lifecycle.
2. **Critique Mode**: Explains the system first, then performs an architectural critique evaluating boundaries, coupling, idempotency, and failure modes.

---

## When to Use
- Answering questions like *"How does authentication token refresh work?"* or *"Walk me through the checkout payment flow"*.
- Onboarding onto an unfamiliar subsystem before planning a refactor or new feature.
- Evaluating architectural placement (*"Where should this webhook handler live?"*, *"Which layer owns this domain validation?"*).
- Answering *"How does X work, and what are the architectural risks?"* (triggers Critique Mode).

### When NOT to Use
- Finding a specific typo or single-line bug (use direct grep/read).
- Recording a confirmed bug into Beads (use `/issue`).
- Reviewing a git diff for AI slop (use `/deslop`).

---

## Workflow: Explain Mode (Default)

```
[User Question: "How does X work?"]
        │
        ├── Step 1: Semantic Discovery (`dkcontext search`)
        │
        ├── Step 2: Complexity Triage
        │       ├── Simple (1-2 files) ──► Direct Read & Trace
        │       └── Complex (Subsystem) ─► Spawn Parallel Explorers (Explore agent)
        │
        ├── Step 3: Call-Chain Tracing (Input ──► Core ──► Boundary/Output)
        │
        └── Step 4: Synthesize & Present
```

### Step 1: Semantic Discovery Bootstrap
Always start exploration using `dkcontext search` to find the primary entry points semantically without guessing keywords:
```bash
dkcontext search "Where is the entry point and lifecycle handler for <feature/subsystem>?"
```
Locate:
- Public entry points (HTTP handlers, CLI commands, message consumers, event listeners).
- Core domain services and state machines.
- External adapters (database repositories, third-party API clients).

### Step 2: Complexity Triage & Exploration
- **Narrow / Simple**: A single utility or focused module. Read the entry point and callees directly in the main session.
- **Broad / Complex**: A cross-cutting subsystem or multi-service flow. Decompose the subsystem into 2–3 exploration slices (e.g., Data Model & Storage, Request Lifecycle & Validation, Side-effects & Error Recovery). Use `Agent` with `subagent_type: "Explore"` to inspect slices in parallel without clogging the main context window.

### Step 3: Trace the Call Chain
From the entry point, follow the thread through callers, callees, and data transformations:
1. What triggers the execution?
2. How is data parsed, validated, and normalized?
3. Where does state change, and how is it persisted?
4. What side effects (events, network calls, metrics) are dispatched?
5. How are errors caught, transformed, or bubbled?
*Never hand-wave any transition; cite concrete files and line numbers (`file_path:line`).*

### Step 4: Synthesize Output Structure
Deliver the walkthrough using this structured layout:

#### 1. Overview
1–2 concise paragraphs explaining what the subsystem does, why it exists, and its primary responsibility.

#### 2. Key Concepts & Types
Bullet points defining the core interfaces, domain entities, and data structures. Link each to its definition:
- `OrderState` (`src/orders/types.ts:14`): Discriminated union tracking payment and fulfillment lifecycle.

#### 3. How It Works (Step-by-Step Runtime Flow)
A chronological walkthrough from trigger to completion:
- **1. Ingestion / Trigger**: Entry point receives payload (`src/api/orders.ts:42`).
- **2. Validation**: Schema check with Zod (`src/orders/schema.ts:18`).
- **3. Domain Execution**: Pricing calculator and voucher application (`src/pricing/service.ts:85`).
- **4. Persistence & Events**: Transaction commit and async event dispatch.

#### 4. Where Things Live
A compact table or directory map showing the code topology:
| Layer | Files | Responsibility |
|---|---|---|
| Entry Point | `src/api/` | HTTP controllers & input parsing |
| Domain Core | `src/orders/` | Pure business rules & state transitions |
| Infrastructure | `src/infra/` | Database repositories & external clients |

#### 5. Gotchas & Edge Cases
Surprising, non-obvious behaviors that would trip up an engineer modifying this code:
- *Timing/Race conditions:* e.g. Webhook may arrive before DB commit completes.
- *Vendor quirks:* e.g. Payment gateway amounts must be sent in cents, not dollars.
- *Legacy compromises:* e.g. Why a fallback branch exists for v1 client schemas.

---

## Workflow: Critique Mode

Triggered when the user asks for architectural critique, risks, weaknesses, or refactoring guidance (*"How does X work and what's wrong with it?"*).

### Step 1: Complete Explain Walkthrough
Run the full Explain flow above first. You cannot critique an architecture you have not mapped out.

### Step 2: Evaluate Against Architectural Rubric
Audit the discovered architecture across four core dimensions:
1. **Boundary Discipline**:
   - Are database schemas or third-party SDK types leaking into the domain core?
   - Is external data validated strictly at the boundary?
2. **Coupling & Cohesion**:
   - Are modules tightly coupled through circular imports or hidden global state?
   - Does a change in one service force cascade edits across unrelated files?
3. **Failure Modes & Resilience**:
   - What happens if the database or external vendor drops 5% of requests?
   - Are operations idempotent, or can retries create duplicate charges/records?
4. **State Machine Invariants**:
   - Are states modeled with ambiguous booleans (`isLoading`, `hasFailed`), or sound discriminated unions?

### Step 3: Present Lead Verdict
Categorize architectural observations into actionable tiers:
- **🔴 Act On (High Impact)**: Real architectural flaws or data-loss risks that should be refactored before extending the feature.
- **🟡 Consider (Trade-offs)**: Valid architectural trade-offs that depend on business priority or expected scale.
- **⚪ Noted (Low Priority)**: Theoretical nitpicks or stylistic observations that do not impair reliability.
