import { useSync } from "../../context/sync"
import { createMemo, createSignal, For, Show } from "solid-js"
import type { InputRenderable } from "@opentui/core"
import path from "node:path"
import { useTheme } from "../../context/theme"
import { useTuiConfig } from "../../config"
import { useRoute } from "../../context/route"
import { useLocal } from "../../context/local"
import { useSDK } from "../../context/sdk"
import { useDialog } from "../../ui/dialog"
import { useToast } from "../../ui/toast"
import { DialogConfirm } from "../../ui/dialog-confirm"
import { errorMessage } from "../../util/error"
import { Spinner } from "../../component/spinner"
import { Locale } from "../../util/locale"
import type { Session } from "@opencode-ai/sdk/v2"

import { getScrollAcceleration } from "../../util/scroll"
import { SplitBorder } from "../../ui/border"

export function Sidebar(props: { sessionID?: string; overlay?: boolean }) {
  const sync = useSync()
  const route = useRoute()
  const local = useLocal()
  const sdk = useSDK()
  const dialog = useDialog()
  const toast = useToast()
  const { theme } = useTheme()
  const tuiConfig = useTuiConfig()

  const [search, setSearch] = createSignal("")
  let searchInput: InputRenderable | undefined
  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))

  const rootSessions = createMemo(() =>
    sync.data.session
      .filter((s) => s.parentID === undefined)
      .toSorted((a, b) => b.time.updated - a.time.updated),
  )

  const filteredSessions = createMemo(() => {
    const query = search().trim().toLowerCase()
    const all = rootSessions()
    if (!query) return all
    return all.filter((s) => (s.title || "Untitled").toLowerCase().includes(query))
  })

  const pinnedSet = createMemo(() => new Set(local.session.pinned()))
  const pinnedSessions = createMemo(() => filteredSessions().filter((s) => pinnedSet().has(s.id)))
  const recentSessions = createMemo(() => filteredSessions().filter((s) => !pinnedSet().has(s.id)))

  const confirmDelete = (sessionToDelete: Session) => {
    dialog.replace(() => (
      <DialogConfirm
        title="Delete Session"
        message={`Are you sure you want to delete "${sessionToDelete.title || "Untitled"}"?`}
        onConfirm={async () => {
          const res = await sdk.client.session
            .delete({ sessionID: sessionToDelete.id })
            .catch((err: unknown) => ({ error: err }))
          if (res.error) {
            toast.show({
              variant: "error",
              title: "Failed to delete session",
              message: errorMessage(res.error),
            })
          }
        }}
      />
    ))
  }

  const SessionRow = (rowProps: { readonly session: Session }) => {
    const s = () => rowProps.session
    const isSelected = () => props.sessionID === s().id
    const [hover, setHover] = createSignal(false)
    const [deleteHover, setDeleteHover] = createSignal(false)
    const status = () => sync.session.status(s().id)
    const isWorking = () => status() === "working" || sync.data.session_status?.[s().id]?.type === "busy"
    const hasAlert = () =>
      (sync.data.permission?.[s().id]?.length ?? 0) > 0 || (sync.data.question?.[s().id]?.length ?? 0) > 0
    const dirName = () => {
      if (!s().directory) return ""
      return path.basename(s().directory) || s().directory
    }

    const navigate = () => {
      if (!isSelected()) {
        route.navigate({ type: "session", sessionID: s().id })
      }
    }

    return (
      <box
        flexDirection="column"
        border={["left"]}
        borderColor={isSelected() ? theme.accent : hover() ? theme.borderActive : theme.backgroundPanel}
        customBorderChars={SplitBorder.customBorderChars}
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={isSelected() || hover() ? theme.backgroundElement : undefined}
        onMouseOver={() => setHover(true)}
        onMouseOut={() => setHover(false)}
        onMouseDown={navigate}
        onMouseUp={navigate}
      >
        <box flexDirection="row" justifyContent="space-between" alignItems="center">
          <box flexDirection="row" gap={1} flexGrow={1} minWidth={0} alignItems="center">
            <Show when={isWorking()}>
              <Spinner />
            </Show>
            <Show when={!isWorking() && hasAlert()}>
              <text fg={theme.warning}>!</text>
            </Show>
            <text fg={theme.text} wrapMode="none">
              {isSelected()
                ? <b>{Locale.truncate(s().title || "Untitled", 30)}</b>
                : Locale.truncate(s().title || "Untitled", 30)}
            </text>
          </box>
          <box
            paddingLeft={1}
            flexShrink={0}
            onMouseOver={() => setDeleteHover(true)}
            onMouseOut={() => setDeleteHover(false)}
            onMouseDown={(evt: { stopPropagation(): void }) => {
              evt.stopPropagation()
            }}
            onMouseUp={(evt: { stopPropagation(): void }) => {
              evt.stopPropagation()
              setTimeout(() => confirmDelete(s()), 0)
            }}
          >
            <text fg={deleteHover() ? theme.error : theme.textMuted}>×</text>
          </box>
        </box>
        <box flexDirection="row" justifyContent="space-between" alignItems="center">
          <box flexGrow={1} minWidth={0}>
            <Show when={dirName()} fallback={<text> </text>}>
              <text fg={theme.textMuted} wrapMode="none">
                📁 {Locale.truncate(dirName(), 20)}
              </text>
            </Show>
          </box>
          <text fg={theme.textMuted} wrapMode="none" flexShrink={0}>
            {Locale.time(s().time.updated)}
          </text>
        </box>
      </box>
    )
  }

  return (
    <box
      backgroundColor={theme.backgroundPanel}
      width={42}
      height="100%"
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
      position={props.overlay ? "absolute" : "relative"}
    >
      <box flexDirection="row" alignItems="center" gap={1} paddingBottom={1}>
        <box
          flexGrow={1}
          backgroundColor={theme.backgroundElement}
          paddingLeft={1}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          onMouseDown={() => searchInput?.focus()}
          onMouseUp={() => searchInput?.focus()}
        >
          <input
            ref={(r) => (searchInput = r)}
            flexGrow={1}
            placeholder="Search..."
            placeholderColor={theme.textMuted}
            cursorColor={theme.primary}
            focusedBackgroundColor={theme.backgroundElement}
            onInput={(val: string) => setSearch(val)}
            onMouseDown={() => searchInput?.focus()}
          />
        </box>
        <box
          paddingLeft={1}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          backgroundColor={theme.backgroundElement}
          onMouseDown={() => route.navigate({ type: "home" })}
          onMouseUp={() => route.navigate({ type: "home" })}
        >
          <text fg={theme.accent}>
            <b>+</b>
          </text>
        </box>
      </box>

      <scrollbox
        flexGrow={1}
        scrollAcceleration={scrollAcceleration()}
        verticalScrollbarOptions={{
          visible: true,
          trackOptions: {
            backgroundColor: theme.background,
            foregroundColor: theme.borderActive,
          },
        }}
      >
        <box flexShrink={0} gap={1} paddingRight={1}>
          <Show when={pinnedSessions().length > 0}>
            <text fg={theme.textMuted}>
              <b>Pinned</b>
            </text>
            <box gap={1}>
              <For each={pinnedSessions()}>{(item) => <SessionRow session={item} />}</For>
            </box>
          </Show>

          <Show when={pinnedSessions().length > 0 && recentSessions().length > 0}>
            <text fg={theme.textMuted}>
              <b>Recent</b>
            </text>
          </Show>
          <box gap={1}>
            <For each={recentSessions()}>{(item) => <SessionRow session={item} />}</For>
          </box>

          <Show when={filteredSessions().length === 0}>
            <box paddingLeft={1} paddingTop={1}>
              <text fg={theme.textMuted}>No chats found</text>
            </box>
          </Show>
        </box>
      </scrollbox>
    </box>
  )
}
