---
name: react-best-practices
description: Use when authoring, structuring, or generating type-safe React modules, hooks, and API integration layers using TanStack Query, Zod schemas, and Query Key Factories from backend contracts
argument-hint: "[optional backend path or feature target]"
version: 1.1.0
---

# React Best Practices & Module Standardization (TanStack Query + Zod)

This skill inspects a backend repository (such as Laravel API at `/path/to/backend`) and generates standardized, end-to-end type-safe frontend architecture following the **TanStack Query + Zod** standard pattern.

---

## Standardization Architecture

Every generated module follows this file and folder structure under `src/features/<module>/` (or `src/api/<module>/`):

```
src/features/<module>/
  schemas/
    <entity>.schema.ts          ← Zod schemas (source of truth for types & runtime validation)
  api/
    <entity>Api.ts              ← Fetch services + Zod.parse (unwraps and validates responses)
  hooks/
    use<Entity>.ts              ← TanStack useQuery hook (reads)
    useCreate<Entity>.ts        ← TanStack useMutation hook (creates)
    useUpdate<Entity>.ts        ← TanStack useMutation hook (updates)
    useDelete<Entity>.ts        ← TanStack useMutation hook (deletes)
  keys.ts                       ← Query Key Factory object
  types.ts                      ← Inferred types (z.infer<typeof ...>)
```

### Zod Strictness Strategy
- **GET Response Schemas**: Default (strip unknown keys) — resilient against non-breaking backend changes.
- **Request Body / Mutation Input Schemas**: `.strict()` — catches typos, invalid fields, and illegal payload properties before HTTP dispatch.
- **Critical Financial / Security Responses**: `.strict()` — fail-fast when unexpected fields appear.

---

## Workflow Phases

### Phase 1: Backend Route & Model Discovery
1. **Detect Framework**:
   - **Laravel**: Check for `artisan`, `routes/api.php`, `app/Http/Controllers/`, `app/Models/`.
   - **Express / Fastify**: Check for `routes/`, `app.ts`, `server.ts`.
   - **NestJS**: Check for `*.controller.ts`, `*.service.ts`, `*.dto.ts`.
2. **Scan Routes**:
   - Extract HTTP verbs (GET, POST, PUT, DELETE, PATCH).
   - Match endpoint paths to their respective Controller methods.
3. **Analyze Controllers & FormRequests**:
   - Read validation rules (`$request->validate([...])`, FormRequest `rules()`, or controller `$rules`).
   - Extract URL parameters (`{id}`, `{uuid}`) and query string filters.
   - Note custom endpoints (e.g., `/move`, `/copy`, `/close`, `/escalate`, `/handover`).
4. **Analyze Database Models & Resources**:
   - Check `$fillable`, `$casts`, `$hidden`, `$appends`, and relations (`belongsTo`, `hasMany`).
   - Determine response shape and pagination defaults.

---

### Phase 2: Mapping Backend Rules to Zod Schemas

Map validation rules and field types to Zod definitions:

| Backend Type / Rule | Zod Definition |
|---|---|
| `required` | Standard schema field (no `.optional()`) |
| `nullable` | `.nullable()` |
| `string` | `z.string()` |
| `integer`, `numeric` | `z.number().int()` or `z.number()` |
| `boolean` | `z.boolean()` |
| `email` | `z.string().email()` |
| `min:N`, `max:N` | `.min(N)`, `.max(N)` |
| `in:a,b,c` / `Rule::in([...])` | `z.enum(['a', 'b', 'c'])` |
| `exists:table,id` | `z.string()` (or `z.union([z.string(), z.number()])`) |
| `array` | `z.array(...)` |
| `json` | `z.record(z.any())` or custom object schema |
| `datetime`, `date` | `z.string().datetime()` or `z.string()` |

**Generate `<entity>.schema.ts`**:
```typescript
import { z } from 'zod';

// Response Schema (default strip)
export const EntitySchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  // ... fields inferred from model & controller responses
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Entity = z.infer<typeof EntitySchema>;

// Mutation Inputs (.strict() for fail-fast validation)
export const CreateEntityInputSchema = z.object({
  name: z.string().min(1),
  // ... validation rules
}).strict();
export type CreateEntityInput = z.infer<typeof CreateEntityInputSchema>;

export const UpdateEntityInputSchema = CreateEntityInputSchema.partial();
export type UpdateEntityInput = z.infer<typeof UpdateEntityInputSchema>;
```

---

### Phase 3: Service Layer Generation (`<entity>Api.ts`)

Services must:
1. Use the configured Axios/Fetch client.
2. Validate incoming payloads if necessary, and parse responses with Zod schemas.
3. Unwrap standard API wrappers (e.g., `{ data: ... }`).

```typescript
import api from '@/lib/axios';
import { unwrapResponse } from '@/lib/api-utils';
import {
  EntitySchema,
  CreateEntityInputSchema,
  type Entity,
  type CreateEntityInput,
  type UpdateEntityInput,
} from '../schemas/entity.schema';

export const getEntityById = async (id: string | number): Promise<Entity> => {
  const { data } = await api.get(`/entities/${id}`);
  return EntitySchema.parse(unwrapResponse(data));
};

export const createEntity = async (input: CreateEntityInput): Promise<Entity> => {
  const validPayload = CreateEntityInputSchema.parse(input);
  const { data } = await api.post('/entities', validPayload);
  return EntitySchema.parse(unwrapResponse(data));
};
```

---

### Phase 4: TanStack Query Hooks & Key Factory

1. **Key Factory (`keys.ts`)**:
```typescript
export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...entityKeys.lists(), filters] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...entityKeys.details(), String(id)] as const,
};
```

2. **Query Hook (`useEntity.ts`)**:
```typescript
import { useQuery } from '@tanstack/react-query';
import { getEntityById } from '../api/entityApi';
import { entityKeys } from '../keys';

export function useEntity(id?: string | number | null) {
  return useQuery({
    queryKey: id ? entityKeys.detail(id) : entityKeys.all,
    queryFn: () => getEntityById(id!),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}
```

3. **Mutation Hooks (`useCreateEntity.ts`, `useUpdateEntity.ts`, etc.)**:
- Handles `onMutate` (optimistic updates if requested), `onError`, and query invalidation using the key factory.

---

## Instructions for Claude

When the user runs `/react-best-practices` (or `/api-to-frontend <backend_path>`):
1. Inspect the provided backend path (scan routes, controllers, and models).
2. Report the identified endpoints, entities, parameters, and validation rules.
3. Check the target frontend structure (`src/features/` or `src/api/`).
4. Generate or update files in order:
   - `schemas/<entity>.schema.ts`
   - `api/<entity>Api.ts`
   - `keys.ts`
   - `hooks/use<Entity>.ts`, `hooks/useCreate<Entity>.ts`, etc.
   - `types.ts`
5. Run TypeScript checks (`tsc --noEmit` or package build command) to verify end-to-end type safety.
