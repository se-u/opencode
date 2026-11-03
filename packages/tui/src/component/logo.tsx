import { RGBA } from "@opentui/core"
import { For } from "solid-js"
import { witchBallGrid } from "../logo"

const COLOR_MAP: Record<string, RGBA> = {
  L: new RGBA(new Uint16Array([216, 180, 254, 255])),
  P: new RGBA(new Uint16Array([168, 85, 247, 255])),
  V: new RGBA(new Uint16Array([126, 34, 206, 255])),
  " ": new RGBA(new Uint16Array([0, 0, 0, 0])),
}

export function Logo() {
  const pairedRows = []
  for (let i = 0; i < witchBallGrid.length; i += 2) {
    pairedRows.push({
      topRow: witchBallGrid[i],
      bottomRow: witchBallGrid[i + 1] || " ".repeat(witchBallGrid[i].length),
    })
  }

  return (
    <box>
      <For each={pairedRows}>
        {({ topRow, bottomRow }) => (
          <box flexDirection="row">
            {Array.from(topRow).map((topChar, index) => {
              const bottomChar = bottomRow[index] || " "

              const fgColor = COLOR_MAP[topChar] || COLOR_MAP[" "]
              const bgColor = COLOR_MAP[bottomChar] || COLOR_MAP[" "]

              if (topChar === " " && bottomChar === " ") {
                return (
                  <text fg={fgColor} bg={bgColor} selectable={false}>
                    {" "}
                  </text>
                )
              }

              return (
                <text fg={fgColor} bg={bgColor} selectable={false}>
                  ▀
                </text>
              )
            })}
          </box>
        )}
      </For>
    </box>
  )
}