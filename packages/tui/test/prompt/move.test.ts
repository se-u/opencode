import { describe, expect, test } from "bun:test"
import path from "path"

describe("working directory command parsing", () => {
  const pattern = /^\/(?:cd|wd|move|dir)(?:\s+(.*))?$/

  test("matches commands without argument", () => {
    expect("/cd".match(pattern)?.[1]).toBeUndefined()
    expect("/wd".match(pattern)?.[1]).toBeUndefined()
    expect("/move".match(pattern)?.[1]).toBeUndefined()
    expect("/dir".match(pattern)?.[1]).toBeUndefined()
  })

  test("matches commands with argument", () => {
    expect("/cd packages/tui".match(pattern)?.[1]?.trim()).toBe("packages/tui")
    expect("/wd /custom/path".match(pattern)?.[1]?.trim()).toBe("/custom/path")
    expect("/move ../other".match(pattern)?.[1]?.trim()).toBe("../other")
    expect("/dir ~/project".match(pattern)?.[1]?.trim()).toBe("~/project")
  })

  test("does not match non-directory commands", () => {
    expect("/cde".match(pattern)).toBeNull()
    expect("/wdx".match(pattern)).toBeNull()
    expect("/models".match(pattern)).toBeNull()
    expect("hello world".match(pattern)).toBeNull()
  })

  test("resolves paths with home and relative directories", () => {
    const home = "/Users/testuser"
    const base = "/Users/testuser/project"

    function resolveTarget(target: string) {
      const raw = target.trim()
      const expanded = raw.startsWith("~") ? path.join(home, raw.slice(1)) : raw
      return path.resolve(base, expanded)
    }

    expect(resolveTarget("packages/tui")).toBe("/Users/testuser/project/packages/tui")
    expect(resolveTarget("../")).toBe("/Users/testuser")
    expect(resolveTarget("~/other")).toBe("/Users/testuser/other")
    expect(resolveTarget("/absolute/path")).toBe("/absolute/path")
  })
})
