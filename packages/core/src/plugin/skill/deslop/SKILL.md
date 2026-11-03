---
name: deslop
description: Use when code changes in git status or diffs contain AI-generated slop such as extra comments, odd try/catch blocks, swallowed exceptions, lazy any types, or deep nesting added to force tests to pass
argument-hint: "[optional file or pattern]"
version: 1.1.0
---

# Deslop: Strip AI Junk and Scaffolding from Code Diffs

## Overview
AI coding assistants often produce functional code contaminated with "AI slop" — conversational commentary, redundant syntax narration, defensive `try/catch` wrappers, swallowed exceptions, lazy `any` types, and deeply nested `if/else` ladders introduced under pressure to pass a test.

`/deslop` surgically audits and strips this junk from files modified in `git status`, leaving clean, idiomatic, human-quality code without breaking functionality or touching unaffected files.

---

## Strict Scope Boundaries

```
[git status --porcelain]
       │
       ├── Untouched files ──────► DO NOT TOUCH (zero churn on baseline code)
       │
       └── Modified / Added files (M, A, MM, AM)
               │
               └── Inspect git diff (-U3)
                       │
                       ├── Domain "why", type contracts, real boundaries ──► PRESERVE
                       │
                       └── 5 Slop Categories (comments, catches, any, etc.) ► SURGICALLY DESLOP
```

1. **Only Touch Files in Git Status**: Never scan, refactor, or format files that are clean in `git status`.
2. **Focus on Diff Context**: Target lines added or edited in the active diff (`git diff -U3`) or immediately affected by new changes.
3. **Behavioral Invariance**: Eliminating slop must not break tests or alter intended business behavior. Always run test suites after deslopping.

---

## The 5 Slop Hunting Categories

### 1. Extra Comments & AI Commentary
LLMs tend to echo what the code already says, explain past bugs, or add chatty narration.
- ❌ **Slop Examples**:
  ```typescript
  // Loop through items and filter out inactive ones
  for (const item of items) { ... }

  // Check if user is authenticated before proceeding
  if (!user) return null;

  // Previously this threw an error because res was undefined, so now we check res first
  if (res?.data) { ... }

  // ==================== State & Handlers ====================
  // Step 2: Update local state with the returned payload
  ```
- ✂️ **Fix**: Delete the comments. Clean up redundant blank lines. Let clean naming and clear syntax speak for itself.

---

### 2. Odd Try / Catch Blocks
LLMs frequently wrap innocent, synchronous, or simple property lookups in defensive `try/catch` blocks instead of validating data structures properly, or re-throw without adding value.
- ❌ **Slop Examples**:
  ```typescript
  // Slop: defensive try/catch around trivial parsing or mapping
  let parsed = null;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    parsed = {};
  }

  // Slop: useless re-throw or losing original error context
  try {
    await fetchUser(id);
  } catch (error) {
    throw error; // Or: throw new Error("Failed"); losing stack trace
  }
  ```
- ✂️ **Fix**:
  - For parsing/optional operations, use explicit guard functions or schemas (e.g., Zod / validator / explicit fallback helper).
  - Eliminate pass-through `try/catch` blocks that don't translate or enrich errors. Allow exceptions to bubble to natural boundary handlers.

---

### 3. Swallowed Error Exceptions & Silent Failures
Under pressure to prevent tests from failing, AI models often swallow errors with empty `catch` blocks or fake default objects.
- ❌ **Slop Examples**:
  ```typescript
  try {
    doRiskyOperation();
  } catch (e) {
    // ignore
  }

  try {
    validateConfig(cfg);
  } catch (err: any) {
    return true; // Fake pass to silence test failure
  }
  ```
- ✂️ **Fix**: Either handle the specific expected error branch explicitly (e.g., checking `err instanceof NotFoundError`), log with appropriate level, or let the error bubble up. Never silently mask unexpected programmer errors (`TypeError`, `ReferenceError`).

---

### 4. Lazy `any` Types & Missing Type Narrowing
When TypeScript complains, AI models frequently reach for `any` or blind casts `(data as any)` instead of defining types or narrowing properly.
- ❌ **Slop Examples**:
  ```typescript
  function processEvent(event: any) {
    return event.payload.data[0].id;
  }

  const result = (response as any).data?.user;
  ```
- ✂️ **Fix**:
  - Replace `any` with `unknown` and use type guards / narrowing (`typeof`, `in`, `instanceof`).
  - Use proper interfaces, generics, or schema inference (`z.infer<typeof Schema>`).
  - If a temporary cast is truly unavoidable due to an external untyped library, use `unknown as TargetType` accompanied by an explicit explanation.

---

### 5. Deep Nesting to Brute-Force Tests (Pyramid of Doom)
When multiple test cases fail, AI models often patch each case by adding another nested `if/else` block, creating a 4–6 level deep pyramid of ad-hoc checks.
- ❌ **Slop Examples**:
  ```typescript
  function calculateDiscount(user: User, cart: Cart) {
    if (user) {
      if (user.isActive) {
        if (cart) {
          if (cart.items.length > 0) {
            if (user.isVip) {
              return cart.total * 0.2;
            } else {
              return cart.total * 0.1;
            }
          }
        }
      }
    }
    return 0;
  }
  ```
- ✂️ **Fix**: Flatten control flow using **Guard Clauses** and **Early Returns**:
  ```typescript
  function calculateDiscount(user: User | null, cart: Cart | null): number {
    if (!user?.isActive || !cart || cart.items.length === 0) {
      return 0;
    }
    return user.isVip ? cart.total * 0.2 : cart.total * 0.1;
  }
  ```

---

## Protected Constructs (What to KEEP)

Do **NOT** remove:
- ✅ **Domain "Why" Comments**: Explaining non-obvious business logic, vendor limitations, or hardware quirks (e.g. `// retry 3x — vendor drops ~2% under load`).
- ✅ **Linter & Compiler Directives**: `// @ts-expect-error: pending API v2 migration`, `/* eslint-disable ... */`.
- ✅ **Public API TSDoc Contracts**: JSDoc/TSDoc on exported functions, types, and library entry points.
- ✅ **Intentional Error Boundaries**: Structured application-level error boundaries or transactional rollback logic.
- ✅ **Tracked TODOs**: `// TODO(ticket-123): remove when upstream fixes schema`.

---

## Execution Workflow

When invoked via `/deslop` or when reviewing changes:

### Step 1: Detect Changed Files
```bash
git status --porcelain
```
Filter for source code files (`.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, `.svelte`, `.py`, `.go`, `.rs`, etc.). Ignore lockfiles, minified files, and vendor assets.

### Step 2: Run Slop Scan
Run the bundled detector script or inspect the diff directly:
```bash
bash claude/skills/deslop/scripts/detect-slop.sh
git diff -U3
```

### Step 3: Surgical Deslopping
Apply targeted edits using the 5 Slop Hunting Categories:
1. Strip line narration, historical comments, and conversational essays.
2. Remove odd `try/catch` and useless re-throws; expose or properly handle exceptions.
3. Replace empty catch blocks with intentional error flow.
4. Replace `any` with `unknown` + narrowing or explicit interfaces.
5. Invert deep `if` trees into clean early guard returns.

### Step 4: Verification Gate
Always ensure functionality remains intact:
```bash
# Verify no syntax or type breakages
npm test # or pnpm test / vitest run / cargo test / pytest
tsc --noEmit # or equivalent typechecker
```
Inspect diff to confirm zero logic regression:
```bash
git diff -U1
```

### Step 5: Report Results
Provide a clear, bulleted summary of slop eliminated:
- Files cleaned.
- Counts and types of slop removed (e.g., 8 AI comment lines deleted, 2 empty try/catches refactored, 3 `any` types replaced with strict narrowing, 1 nested function flattened).
- Confirmation that tests and linters pass 100%.
