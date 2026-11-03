import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { RGBA } from "@opentui/core"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, For, Show, createSignal, onMount, onCleanup, createEffect } from "solid-js"
import { existsSync } from "node:fs"
import path from "node:path"
import { useTuiPaths } from "../../context/runtime"
import { findTasksFile, readTasks, updateTask, addTask, deleteTask, type TaskItem, type TaskStatus } from "./task-storage"

const id = "internal:sidebar-todo"

export type { TaskItem, TaskStatus }

function TaskDetailDialog(props: {
  task: TaskItem
  filePath: string
  api: TuiPluginApi
  onClose: () => void
  onUpdate: () => void
}) {
  const [status, setStatus] = createSignal(props.task.status)

  const handleStatusChange = async (newStatus: TaskItem["status"]) => {
    setStatus(newStatus)
    await updateTask(props.filePath, props.task.id, { status: newStatus })
    props.onUpdate()
  }

  const handleTitleChange = async (newTitle: string) => {
    if (!newTitle.trim()) return
    await updateTask(props.filePath, props.task.id, { title: newTitle.trim() })
    props.onUpdate()
    props.api.ui.dialog.clear()
  }

  const handleDescriptionChange = async (newDesc: string) => {
    await updateTask(props.filePath, props.task.id, { description: newDesc.trim() || undefined })
    props.onUpdate()
    props.api.ui.dialog.clear()
  }

  const options = createMemo(() => [
    {
      title: "Edit Title",
      value: "edit",
      description: "Change the task title",
      onSelect: () => {
        props.api.ui.dialog.replace(() => (
          <props.api.ui.DialogPrompt
            title={`Edit Task: ${props.task.id}`}
            value={props.task.title}
            placeholder="Enter new task title..."
            onConfirm={(val) => {
              handleTitleChange(val)
            }}
            onCancel={() => {
              props.api.ui.dialog.clear()
            }}
          />
        ))
      },
    },
    {
      title: props.task.description ? "Edit Description / Location" : "Add Description / Location",
      value: "description",
      description: props.task.description || "Set exact file location and line numbers (e.g. src/file.ts:42)",
      onSelect: () => {
        props.api.ui.dialog.replace(() => (
          <props.api.ui.DialogPrompt
            title={`Edit Description: ${props.task.id}`}
            value={props.task.description ?? ""}
            placeholder="e.g. packages/tui/src/routes/session/index.tsx:1391-1405"
            onConfirm={(val) => {
              handleDescriptionChange(val)
            }}
            onCancel={() => {
              props.api.ui.dialog.clear()
            }}
          />
        ))
      },
    },
    {
      title: `Set Status: Backlog (${status() === "backlog" ? "current" : ""})`,
      value: "backlog",
      description: "Mark task as backlog",
      onSelect: () => handleStatusChange("backlog"),
    },
    {
      title: `Set Status: Todo (${status() === "todo" || status() === "open" ? "current" : ""})`,
      value: "todo",
      description: "Mark task as ready to do",
      onSelect: () => handleStatusChange("todo"),
    },
    {
      title: `Set Status: In Progress (${status() === "in_progress" ? "current" : ""})`,
      value: "in_progress",
      description: "Mark task as in progress",
      onSelect: () => handleStatusChange("in_progress"),
    },
    {
      title: `Set Status: Review (${status() === "review" ? "current" : ""})`,
      value: "review",
      description: "Mark task as ready for review",
      onSelect: () => handleStatusChange("review"),
    },
    {
      title: `Set Status: Done (${status() === "done" || status() === "closed" ? "current" : ""})`,
      value: "done",
      description: "Mark task as completed / done",
      onSelect: () => handleStatusChange("done"),
    },
    {
      title: "Delete Task",
      value: "delete",
      description: `Permanently delete task ${props.task.id}`,
      onSelect: () => {
        props.api.ui.dialog.replace(() => (
          <props.api.ui.DialogConfirm
            title={`Delete Task: ${props.task.id}`}
            message={`Are you sure you want to delete "${props.task.title}"?`}
            onConfirm={async () => {
              await deleteTask(props.filePath, props.task.id)
              props.onUpdate()
              props.api.ui.dialog.clear()
            }}
            onCancel={() => {
              props.api.ui.dialog.clear()
            }}
          />
        ))
      },
    },
  ])

  return (
    <props.api.ui.DialogSelect
      title={`Task: ${props.task.id} — ${props.task.title}`}
      options={options()}
      renderFilter={false}
      onSelect={(opt) => opt.onSelect?.()}
    />
  )
}

function View(props: { api: TuiPluginApi; session_id: string }) {
  const paths = useTuiPaths()
  const [open, setOpen] = createSignal(true)
  const [inProgressOpen, setInProgressOpen] = createSignal(true)
  const [reviewOpen, setReviewOpen] = createSignal(true)
  const [todoOpen, setTodoOpen] = createSignal(true)
  const [backlogOpen, setBacklogOpen] = createSignal(true)
  const [doneOpen, setDoneOpen] = createSignal(false)
  const [taskList, setTaskList] = createSignal<TaskItem[]>([])
  const theme = () => props.api.theme.current

  const session = createMemo(() => props.api.state.session.get(props.session_id))
  const workdir = createMemo(() => session()?.directory || props.api.state.path.directory || paths.cwd)

  const resolveTasksPath = () => {
    const rawDir = workdir()
    if (!rawDir) return path.join(paths.cwd, ".opencode", "tasks.json")
    const existing = findTasksFile(rawDir)
    if (existing) return existing
    return path.join(rawDir, ".opencode", "tasks.json")
  }

  const checkAndFetchTasks = async () => {
    const filePath = resolveTasksPath()
    if (!filePath || !existsSync(filePath)) {
      setTaskList([])
      return
    }

    const list = await readTasks(filePath)
    setTaskList(list)
  }

  const handleCreateTask = () => {
    const filePath = resolveTasksPath()
    if (!filePath) return

    props.api.ui.dialog.replace(() => (
      <props.api.ui.DialogPrompt
        title="Create New Task"
        placeholder="Enter task title..."
        onConfirm={async (val) => {
          if (!val.trim()) return
          await addTask(filePath, {
            title: val.trim(),
            status: "todo",
            priority: 2,
          })
          await checkAndFetchTasks()
          props.api.ui.dialog.clear()
        }}
        onCancel={() => {
          props.api.ui.dialog.clear()
        }}
      />
    ))
  }

  onMount(() => {
    checkAndFetchTasks()
    const interval = setInterval(checkAndFetchTasks, 3000)
    onCleanup(() => clearInterval(interval))
  })

  createEffect(() => {
    workdir()
    checkAndFetchTasks()
  })

  const backlogTasks = createMemo(() =>
    taskList().filter((x) => x.status === "backlog" || x.status === "deferred")
  )
  const todoTasks = createMemo(() =>
    taskList().filter((x) => x.status === "todo" || x.status === "open")
  )
  const inProgressTasks = createMemo(() =>
    taskList().filter((x) => x.status === "in_progress")
  )
  const reviewTasks = createMemo(() =>
    taskList().filter((x) => x.status === "review" || x.status === "blocked")
  )
  const doneTasks = createMemo(() =>
    taskList().filter((x) => x.status === "done" || x.status === "closed")
  )

  const activeCount = createMemo(
    () => backlogTasks().length + todoTasks().length + inProgressTasks().length + reviewTasks().length
  )

  const getPriorityBadge = (p: number) => `P${p}`

  const openTaskDetail = (item: TaskItem) => {
    const filePath = resolveTasksPath()
    if (!filePath) return
    props.api.ui.dialog.replace(() => (
      <TaskDetailDialog
        task={item}
        filePath={filePath}
        api={props.api}
        onClose={() => props.api.ui.dialog.clear()}
        onUpdate={() => {
          checkAndFetchTasks()
        }}
      />
    ))
  }

  function TaskRow(p: {
    item: TaskItem
    badgeColor: RGBA | string
    badge: string
    showPriority?: boolean
    isMuted?: boolean
  }) {
    return (
      <box
        flexDirection="column"
        onMouseUp={(e: { stopPropagation: () => void }) => {
          e.stopPropagation()
          openTaskDetail(p.item)
        }}
      >
        <box flexDirection="row" gap={1}>
          <text fg={p.badgeColor} flexShrink={0}>
            {p.badge}
          </text>
          <text fg={p.isMuted ? theme().textMuted : theme().text} flexGrow={1} wrapMode="word">
            <Show when={p.showPriority}>
              <span style={{ fg: theme().accent }}>{getPriorityBadge(p.item.priority)} </span>
            </Show>
            {p.item.title}
          </text>
        </box>
        <Show when={p.item.description}>
          <box paddingLeft={2}>
            <text fg={theme().textMuted} wrapMode="word">
              ↳ {p.item.description}
            </text>
          </box>
        </Show>
      </box>
    )
  }

  return (
    <box>
      <box flexDirection="row" gap={1} onMouseDown={() => setOpen((x) => !x)}>
        <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
        <text fg={theme().text}>
          <b>Project Tasks</b>
        </text>
        <text fg={theme().textMuted}>
          ({activeCount()}/{taskList().length})
        </text>
        <text
          fg={theme().accent}
          onMouseDown={(e: { stopPropagation: () => void }) => {
            e.stopPropagation()
            handleCreateTask()
          }}
        >
          [+]
        </text>
      </box>

      <Show when={open()}>
        <Show when={taskList().length === 0}>
          <box marginTop={1}>
            <text fg={theme().textMuted}>No tasks yet. Click [+] to add a task.</text>
          </box>
        </Show>

        <box marginTop={1}>
          <box
            flexDirection="row"
            gap={1}
            onMouseDown={() => setInProgressOpen((x) => !x)}
          >
            <text fg={theme().warning}>{inProgressOpen() ? "▼" : "▶"}</text>
            <text fg={theme().warning}>
              <b>● In Progress ({inProgressTasks().length})</b>
            </text>
          </box>
          <Show when={inProgressOpen() && inProgressTasks().length > 0}>
            <For each={inProgressTasks()}>
              {(item) => <TaskRow item={item} badgeColor={theme().warning} badge={`[${item.id}]`} />}
            </For>
          </Show>
        </box>

        <box marginTop={1}>
          <box
            flexDirection="row"
            gap={1}
            onMouseDown={() => setReviewOpen((x) => !x)}
          >
            <text fg={theme().accent}>{reviewOpen() ? "▼" : "▶"}</text>
            <text fg={theme().accent}>
              <b>◎ Review ({reviewTasks().length})</b>
            </text>
          </box>
          <Show when={reviewOpen() && reviewTasks().length > 0}>
            <For each={reviewTasks()}>
              {(item) => <TaskRow item={item} badgeColor={theme().accent} badge={`[${item.id}]`} />}
            </For>
          </Show>
        </box>

        <box marginTop={1}>
          <box
            flexDirection="row"
            gap={1}
            onMouseDown={() => setTodoOpen((x) => !x)}
          >
            <text fg={theme().primary}>{todoOpen() ? "▼" : "▶"}</text>
            <text fg={theme().primary}>
              <b>○ Todo ({todoTasks().length})</b>
            </text>
          </box>
          <Show when={todoOpen() && todoTasks().length > 0}>
            <For each={todoTasks()}>
              {(item) => (
                <TaskRow
                  item={item}
                  badgeColor={theme().primary}
                  badge={`[${item.id}]`}
                  showPriority={true}
                />
              )}
            </For>
          </Show>
        </box>

        <box marginTop={1}>
          <box
            flexDirection="row"
            gap={1}
            onMouseDown={() => setBacklogOpen((x) => !x)}
          >
            <text fg={theme().textMuted}>{backlogOpen() ? "▼" : "▶"}</text>
            <text fg={theme().textMuted}>
              <b>◌ Backlog ({backlogTasks().length})</b>
            </text>
          </box>
          <Show when={backlogOpen() && backlogTasks().length > 0}>
            <For each={backlogTasks()}>
              {(item) => (
                <TaskRow
                  item={item}
                  badgeColor={theme().textMuted}
                  badge={`[${item.id}]`}
                  showPriority={true}
                  isMuted={true}
                />
              )}
            </For>
          </Show>
        </box>

        <box marginTop={1}>
          <box
            flexDirection="row"
            gap={1}
            onMouseDown={() => setDoneOpen((x) => !x)}
          >
            <text fg={theme().success}>{doneOpen() ? "▼" : "▶"}</text>
            <text fg={theme().success}>
              <b>✓ Done ({doneTasks().length})</b>
            </text>
          </box>
          <Show when={doneOpen() && doneTasks().length > 0}>
            <For each={doneTasks()}>
              {(item) => (
                <TaskRow
                  item={item}
                  badgeColor={theme().success}
                  badge="✓"
                  isMuted={true}
                />
              )}
            </For>
          </Show>
        </box>
      </Show>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 400,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
