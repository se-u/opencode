import { describe, expect, test } from "bun:test"
import { addTask, deleteTask, readTasks, updateTask, type TaskItem } from "../../src/feature-plugins/sidebar/task-storage"
import path from "node:path"
import os from "node:os"
import fs from "node:fs/promises"

describe("task-storage project tasks", () => {
  test("adds and updates tasks with detailed file and line descriptions", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-tasks-test-"))
    const opencodeDir = path.join(tmpDir, ".opencode")
    await fs.mkdir(opencodeDir, { recursive: true })
    const tasksFile = path.join(opencodeDir, "tasks.json")

    try {
      // Initially empty
      const initial = await readTasks(tasksFile)
      expect(initial).toEqual([])

      // Add a task with detailed file:line description
      const added = await addTask(tasksFile, {
        id: "task-1",
        title: "Update SessionDirectory component",
        status: "in_progress",
        priority: 1,
        description: "packages/tui/src/routes/session/index.tsx:1391-1405 - wrap directory text in clickable component",
      })

      expect(added).toHaveLength(1)
      expect(added[0].id).toBe("task-1")
      expect(added[0].status).toBe("in_progress")
      expect(added[0].description).toBe(
        "packages/tui/src/routes/session/index.tsx:1391-1405 - wrap directory text in clickable component",
      )

      // Update task status and description
      const updated = await updateTask(tasksFile, "task-1", {
        status: "done",
        description: "packages/tui/src/routes/session/index.tsx:1391-1405 - completed and verified",
      })

      expect(updated[0].status).toBe("done")
      expect(updated[0].description).toBe(
        "packages/tui/src/routes/session/index.tsx:1391-1405 - completed and verified",
      )

      // Re-read from disk to ensure persistence
      const reRead = await readTasks(tasksFile)
      expect(reRead).toHaveLength(1)
      expect(reRead[0].status).toBe("done")
      expect(reRead[0].description).toContain("packages/tui/src/routes/session/index.tsx:1391-1405")

      // Delete task
      const remaining = await deleteTask(tasksFile, "task-1")
      expect(remaining).toHaveLength(0)

      const afterDelete = await readTasks(tasksFile)
      expect(afterDelete).toEqual([])
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})
