---
name: typescript-best-practices
description: Use when authoring, refactoring, or applying Test-Driven Development (TDD) workflows in TypeScript projects requiring strict type safety, clean abstractions, and customizable architectural standards
argument-hint: "[optional file, module, or test target]"
version: 1.0.0
---

# TypeScript Best Practices & TDD Workflow

## Overview
High-quality TypeScript blends compile-time static type guarantees with rigorous runtime unit tests. In TypeScript, Test-Driven Development (TDD) is a **contract-first design workflow**: you specify the public types and test behaviors first, watch them fail, implement the minimal compliant logic, and refactor toward clean, immutable, and easily testable abstractions.

This skill guides you through the full TypeScript TDD lifecycle while enforcing modern TypeScript best practices, with a dedicated customization interface for your specific project conventions.

---

## When to Use
- When creating new features, services, domain utilities, or modules in TypeScript from scratch.
- When fixing bugs using a reproducer test first.
- When refactoring legacy or loose JavaScript/TypeScript to strict, modern types without regressions.
- When establishing clean architectural boundaries and testability in full-stack or frontend/backend TypeScript codebases.

### When NOT to Use
- Quick throwaway scripts or single-line configuration tweaks.
- Pure CSS or styling-only modifications.
- Prototyping where type signatures are still completely unknown (though even here, exploratory TDD is recommended).

---

## The TypeScript TDD Cycle (Red - Green - Refactor)

```
       ┌────────────────────────────────────────────────────────┐
       │ 1. RED: Define Type Contract & Write Failing Test     │
       │    • Define input/output types & interfaces            │
       │    • Write test for expected behavior & edge cases     │
       │    • Assert compile-time types (expectTypeOf)          │
       │    • Verify failure: test runner fails or ts error     │
       └──────────────────────────┬─────────────────────────────┘
                                  │
                                  ▼
       ┌────────────────────────────────────────────────────────┐
       │ 2. GREEN: Minimal Implementation                       │
       │    • Write minimal code to satisfy type checker        │
       │    • Pass tests without premature abstractions         │
       │    • ZERO 'any' types or hacky workarounds             │
       └──────────────────────────┬─────────────────────────────┘
                                  │
                                  ▼
       ┌────────────────────────────────────────────────────────┐
       │ 3. REFACTOR: Harden Types & Simplify Logic             │
       │    • Guard clauses / early returns (flatten nesting)   │
       │    • Immutability (`readonly`, `as const`, `satisfies`)│
       │    • Functional error handling (Result pattern)        │
       │    • Run tests to confirm zero regressions             │
       └────────────────────────────────────────────────────────┘
```

---

## Core TypeScript Best Practice Invariants

### 1. Make Illegal States Unrepresentable (Discriminated Unions)
Avoid independent boolean flags that allow conflicting states:
```typescript
// ❌ BAD: Can be loading AND have error simultaneously
interface AsyncState<T> {
  isLoading: boolean;
  error?: Error;
  data?: T;
}

// ✅ GOOD: State machine is mathematically sound
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

### 2. Result Pattern over Unchecked Exceptions
For domain/business errors that callers are expected to handle, return an explicit `Result` type rather than throwing raw exceptions:
```typescript
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

### 3. Exhaustiveness Checking with `assertNever`
Ensure all branches of a union are handled at compile time:
```typescript
export function assertNever(x: never, message = 'Unexpected unreachable branch'): never {
  throw new Error(`${message}: ${JSON.stringify(x)}`);
}

// In switch / if statements:
switch (state.status) {
  case 'idle': return renderIdle();
  case 'loading': return renderSpinner();
  case 'success': return renderData(state.data);
  case 'error': return renderError(state.error);
  default: return assertNever(state); // Compiler flags unhandled new statuses!
}
```

### 4. `satisfies` over Blind Type Assertions
Use `satisfies` to validate a shape against a type without losing precise literal types:
```typescript
type Palette = Record<string, string | number[]>;

// ❌ 'as Palette' widens types to string | number[], losing auto-complete
// ❌ ': Palette' also widens keys
const theme = {
  primary: '#1D4ED8',
  secondary: [29, 78, 216],
} satisfies Palette;

// 'theme.primary' retains literal '#1D4ED8', enabling string methods directly!
```

### 5. Strict Type Narrowing & `unknown` over `any`
Treat external/untrusted data as `unknown`, then validate with Zod or custom type guards:
```typescript
// ❌ BAD:
function parsePayload(raw: any) {
  return raw.user.id;
}

// ✅ GOOD:
function isUserPayload(val: unknown): val is { user: { id: string } } {
  return (
    typeof val === 'object' &&
    val !== null &&
    'user' in val &&
    typeof (val as Record<string, unknown>).user === 'object' &&
    (val as any).user !== null &&
    typeof (val as any).user.id === 'string'
  );
}
```

### 6. Immutability by Default
Mark function parameters and data structures with `readonly` to prevent accidental mutations:
```typescript
function sortUsers(users: readonly User[]): User[] {
  // users.sort() will trigger a compiler error because sort() mutates!
  return [...users].sort((a, b) => a.name.localeCompare(b.name));
}
```

---

## Worked Example: TDD Walkthrough

### Scenario
We need a `PricingCalculator` that computes total cost, applies discount vouchers, enforces minimum thresholds, and returns a structured `Result`.

#### Step 1: RED (Define Contract and Failing Test)
File: `src/pricing/pricing.test.ts`
```typescript
import { describe, it, expect, expectTypeOf } from 'vitest';
import { calculateTotal, type CartItem, type Voucher } from './pricing';

describe('calculateTotal (TDD)', () => {
  it('returns exact sum for items without voucher', () => {
    const items: readonly CartItem[] = [
      { id: '1', price: 100, quantity: 2 },
      { id: '2', price: 50, quantity: 1 },
    ];

    const result = calculateTotal(items);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.total).toBe(250);
      expect(result.value.discount).toBe(0);
      expectTypeOf(result.value.total).toBeNumber();
    }
  });

  it('rejects expired vouchers with explicit error result', () => {
    const items: readonly CartItem[] = [{ id: '1', price: 100, quantity: 1 }];
    const expiredVoucher: Voucher = { code: 'SAVE10', discountPercent: 10, isExpired: true };

    const result = calculateTotal(items, expiredVoucher);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('EXPIRED_VOUCHER');
    }
  });
});
```
*Run tests*: `vitest run src/pricing/pricing.test.ts` -> **FAILS (RED)** (module doesn't exist yet).

---

#### Step 2: GREEN (Minimal Implementation)
File: `src/pricing/pricing.ts`
```typescript
export interface CartItem {
  readonly id: string;
  readonly price: number;
  readonly quantity: number;
}

export interface Voucher {
  readonly code: string;
  readonly discountPercent: number;
  readonly isExpired: boolean;
}

export type PricingError =
  | { code: 'EXPIRED_VOUCHER'; message: string }
  | { code: 'INVALID_QUANTITY'; message: string };

export type PricingResult =
  | { ok: true; value: { total: number; discount: number } }
  | { ok: false; error: PricingError };

export function calculateTotal(
  items: readonly CartItem[],
  voucher?: Voucher
): PricingResult {
  if (voucher?.isExpired) {
    return { ok: false, error: { code: 'EXPIRED_VOUCHER', message: 'Voucher is expired' } };
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = voucher ? (subtotal * voucher.discountPercent) / 100 : 0;

  return {
    ok: true,
    value: {
      total: subtotal - discount,
      discount,
    },
  };
}
```
*Run tests*: `vitest run src/pricing/pricing.test.ts` -> **PASSES (GREEN)**.

---

#### Step 3: REFACTOR (Tighten Types & Invariants)
- Add guard against negative prices or invalid quantities.
- Extract calculation helper into pure, composable sub-functions.
- Run tests again: ensure 100% green without regressions.

---

## Customization Guide: Tailoring to Your Project

This skill is designed to adapt to your specific stack and architectural guidelines. You can add project-specific rules in a `.typescript-rules.md` file in your repository root, or configure the sections below.

### 1. Framework & Environment Adapters

#### A. Backend / Node.js (Hono, NestJS, Express, Fastify)
- **Validation**: Prefer runtime schema validation at the HTTP boundary using Zod, TypeBox, or Valibot:
  ```typescript
  import { z } from 'zod';
  export const UserSchema = z.object({ id: z.string().uuid(), email: z.string().email() });
  export type User = z.infer<typeof UserSchema>;
  ```
- **Service Layer**: Keep services pure and mock-free by passing repository interfaces:
  ```typescript
  export interface UserRepository {
    findById(id: string): Promise<User | null>;
  }
  ```

#### B. Frontend (React / Next.js)
- **Hooks & State**: Test custom hooks with `@testing-library/react` (`renderHook`, `act`).
- **Server Actions**: Define explicit input/output payload types; handle errors via serialized `Result` shapes rather than throwing across the network boundary.
- **Props**: Use `type Props = ComponentPropsWithoutRef<'button'> & { variant: ... }`.

### 2. Test Runner Selection
Customize your test command based on your project setup:
- **Vitest**: `vitest run <target>` (Fast, native ESM & TS support, in-source testing).
- **Jest / ts-jest**: `jest --runInBand <target>`.
- **Node Test Runner**: `node --test --loader ts-node/esm`.

### 3. Customizing Project Rules
To define overrides for this skill in your project:
1. Create a `.claude/ts-rules.md` or `.agents/ts-rules.md` in your repo root.
2. Specify team conventions (e.g., "Always use Zod for API schemas", "Never use enums; prefer union literals").
3. When invoking `/typescript-best-practices`, the agent will automatically merge those rules with this core workflow.

---

## Anti-Pattern vs. Best Practice Quick Reference

| Anti-Pattern | TypeScript Best Practice | Why |
|---|---|---|
| `data: any` | `data: unknown` + type guard / Zod | Prevents uncaught runtime crashes. |
| `data as TargetType` | `satisfies TargetType` or validation | Type assertions blind the compiler. |
| `enum Direction { Up, Down }` | `type Direction = 'Up' \| 'Down'` | Enums emit noisy JS runtime objects; string unions are zero-cost and clean. |
| `throw new Error("User missing")` | Return `{ ok: false, error: ... }` | Callers are forced by types to handle the error case. |
| Nested `if (a) { if (b) { ... } }` | Early return `if (!a || !b) return` | Reduces cyclomatic complexity and improves legibility. |
| Mocking everything in unit tests | Test pure business logic directly | Over-mocking tests the mock implementation, not your actual code. |
| `key: string` dictionary | `Record<ValidKeyUnion, Value>` | Avoids indexing undefined keys without compiler warning. |

---

## Checklist for Every TypeScript Feature (TDD)
- [ ] **Contract First**: Type definitions, function signatures, and Result shapes defined before coding.
- [ ] **Test Written First**: Failing test covering the happy path and edge cases.
- [ ] **Type Assertion Included**: Tests verify both runtime outputs and static types (`expectTypeOf`).
- [ ] **Zero Slop**: No `any`, no odd `try/catch` wrappers, no swallowed errors, no deep nesting.
- [ ] **Strict Compiler Check**: `tsc --noEmit` passes with zero warnings.
- [ ] **Suite Verified**: All tests passing cleanly in test runner.
