import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION_WRITE from "./todowrite.txt"
import { SessionTodo } from "@opencode-ai/schema/session-todo"
import { InstanceState } from "@/effect/instance-state"
import path from "path"
import { existsSync, promises as fs } from "node:fs"

export const Parameters = Schema.Struct({
  todos: Schema.mutable(Schema.Array(SessionTodo.Info)).annotate({ description: "The updated todo list" }),
})

type Metadata = {
  todos: SessionTodo.Info[]
}

export const TodoWriteTool = Tool.define<typeof Parameters, Metadata, never>(
  "todowrite",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION_WRITE,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "todowrite",
            patterns: ["*"],
            always: ["*"],
            metadata: {},
          })

          const instance = yield* InstanceState.context
          const tasksFile = path.join(instance.directory, ".opencode", "tasks.json")

          const existingTasks = yield* Effect.promise(async () => {
            if (!existsSync(tasksFile)) return [] as Array<{ id: string; title: string; created_at: number; [key: string]: any }>
            try {
              const content = await Bun.file(tasksFile).json()
              return Array.isArray(content?.tasks) ? content.tasks : []
            } catch {
              return [] as Array<{ id: string; title: string; created_at: number; [key: string]: any }>
            }
          }).pipe(Effect.orDie)

          const existingMap = new Map<string, { id: string; title: string; created_at: number; [key: string]: any }>(
            existingTasks.map((t: { id: string; title: string; created_at: number; [key: string]: any }) => [t.title, t]),
          )

          const seenTitles = new Set(params.todos.map((todo) => todo.content))
          const unmentionedTasks = existingTasks.filter((t: { id: string; title: string; created_at: number; [key: string]: any }) => !seenTitles.has(t.title))

          const tasks = [
            ...params.todos.map((todo, idx) => {
              const existing = existingMap.get(todo.content)
              const now = Date.now()
              return {
                id: existing?.id ?? `task-${existingTasks.length + idx + 1}`,
                title: todo.content,
                status:
                  todo.status === "completed"
                    ? "done"
                    : todo.status === "in_progress"
                      ? "in_progress"
                      : todo.status === "cancelled"
                        ? "closed"
                        : "todo",
                priority: todo.priority === "high" ? 1 : todo.priority === "low" ? 3 : 2,
                description: todo.description,
                created_at: existing?.created_at ?? now,
                updated_at: now,
              }
            }),
            ...unmentionedTasks,
          ]

          yield* Effect.promise(async () => {
            const dir = path.dirname(tasksFile)
            if (!existsSync(dir)) {
              await fs.mkdir(dir, { recursive: true })
            }
            await Bun.write(tasksFile, JSON.stringify({ version: 1, tasks }, null, 2))
          }).pipe(Effect.ignore)

          return {
            title: `${params.todos.filter((x) => x.status !== "completed").length} todos`,
            output: JSON.stringify(params.todos, null, 2),
            metadata: {
              todos: params.todos,
            },
          }
        }),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)

