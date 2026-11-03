import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { SessionID } from "./schema"
import { Effect, Layer, Context } from "effect"
import { SessionTodo } from "@opencode-ai/schema/session-todo"

export const Info = SessionTodo.Info
export type Info = SessionTodo.Info

export const Event = SessionTodo.Event

export interface Interface {
  readonly update: (input: { sessionID: SessionID; todos: ReadonlyArray<Info> }) => Effect.Effect<void>
  readonly get: (sessionID: SessionID) => Effect.Effect<Info[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionTodo") {}

const layer = Layer.succeed(
  Service,
  Service.of({
    update: Effect.fn("Todo.update")(() => Effect.void),
    get: Effect.fn("Todo.get")(() => Effect.succeed([])),
  }),
)

export const node = LayerNode.make({ service: Service, layer: layer, deps: [] })

export * as Todo from "./todo"

