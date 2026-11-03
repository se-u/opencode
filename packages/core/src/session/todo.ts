export * as SessionTodo from "./todo"

import { Context, Effect, Layer } from "effect"
import { SessionTodo } from "@opencode-ai/schema/session-todo"
import { makeLocationNode } from "../effect/app-node"
import { SessionSchema } from "./schema"

export const Info = SessionTodo.Info
export type Info = typeof Info.Type
export const Event = SessionTodo.Event

export interface Interface {
  readonly update: (input: {
    readonly sessionID: SessionSchema.ID
    readonly todos: ReadonlyArray<Info>
  }) => Effect.Effect<void>
  readonly get: (sessionID: SessionSchema.ID) => Effect.Effect<ReadonlyArray<Info>>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/SessionTodo") {}

const layer = Layer.succeed(
  Service,
  Service.of({
    update: Effect.fn("SessionTodo.update")(() => Effect.void),
    get: Effect.fn("SessionTodo.get")(() => Effect.succeed([])),
  }),
)

export const node = makeLocationNode({ service: Service, layer, deps: [] })

