import { existsSync } from "node:fs"
import path from "node:path"

export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done"

export interface TaskItem {
  id: string
  title: string
  status: TaskStatus | "open" | "blocked" | "deferred" | "closed"
  priority: number
  description?: string
  created_at?: number
  updated_at?: number
}

export interface TasksData {
  version: number
  tasks: TaskItem[]
}

export function findTasksFile(startDir: string): string | null {
  let current = path.resolve(startDir)
  while (true) {
    const candidate = path.join(current, ".opencode", "tasks.json")
    if (existsSync(candidate)) return candidate
    if (existsSync(path.join(current, ".opencode"))) return candidate

    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return null
}

export async function readTasks(filePath: string): Promise<TaskItem[]> {
  const file = Bun.file(filePath)
  if (!(await file.exists())) return []
  const parsed = await file.json().catch(() => null)
  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed?.tasks)) return parsed.tasks
  return []
}

export async function writeTasks(filePath: string, tasks: TaskItem[]): Promise<void> {
  const data: TasksData = {
    version: 1,
    tasks,
  }
  await Bun.write(filePath, JSON.stringify(data, null, 2))
}

export async function updateTask(
  filePath: string,
  taskId: string,
  patch: Partial<Omit<TaskItem, "id">>
): Promise<TaskItem[]> {
  const tasks = await readTasks(filePath)
  const index = tasks.findIndex((t) => t.id === taskId)
  if (index === -1) return tasks

  tasks[index] = {
    ...tasks[index],
    ...patch,
    updated_at: Date.now(),
  }

  await writeTasks(filePath, tasks)
  return tasks
}

export async function addTask(
  filePath: string,
  task: Omit<TaskItem, "id"> & { id?: string }
): Promise<TaskItem[]> {
  const tasks = await readTasks(filePath)
  const newTask: TaskItem = {
    id: task.id ?? `task-${Date.now().toString(36)}`,
    title: task.title,
    status: task.status ?? "open",
    priority: task.priority ?? 2,
    description: task.description,
    created_at: Date.now(),
    updated_at: Date.now(),
  }
  tasks.push(newTask)
  await writeTasks(filePath, tasks)
  return tasks
}

export async function deleteTask(
  filePath: string,
  taskId: string
): Promise<TaskItem[]> {
  const tasks = await readTasks(filePath)
  const filtered = tasks.filter((t) => t.id !== taskId)
  if (filtered.length !== tasks.length) {
    await writeTasks(filePath, filtered)
  }
  return filtered
}
