import yargs, { type CommandModule } from "yargs"
import { hideBin } from "yargs/helpers"
import { UI } from "./cli/ui"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { FormatError } from "./cli/error"
import { EOL } from "os"
import { errorMessage } from "./util/error"
import { Heap } from "./cli/heap"

const args = hideBin(process.argv)

interface CommandModuleLike {
  command?: string | readonly string[]
  describe?: string | false
  aliases?: string | readonly string[]
  builder?: unknown
  handler: (...args: any[]) => any
}

type CommandLoader = () => Promise<CommandModuleLike>

const COMMANDS: Record<string, CommandLoader> = {
  acp: () => import("./cli/cmd/acp").then((m) => m.AcpCommand),
  mcp: () => import("./cli/cmd/mcp").then((m) => m.McpCommand),
  attach: () => import("./cli/cmd/attach").then((m) => m.AttachCommand),
  run: () => import("./cli/cmd/run").then((m) => m.RunCommand),
  generate: () => import("./cli/cmd/generate").then((m) => m.GenerateCommand),
  debug: () => import("./cli/cmd/debug").then((m) => m.DebugCommand),
  account: () => import("./cli/cmd/account").then((m) => m.ConsoleCommand),
  providers: () => import("./cli/cmd/providers").then((m) => m.ProvidersCommand),
  auth: () => import("./cli/cmd/providers").then((m) => m.ProvidersCommand),
  agent: () => import("./cli/cmd/agent").then((m) => m.AgentCommand),
  upgrade: () => import("./cli/cmd/upgrade").then((m) => m.UpgradeCommand),
  uninstall: () => import("./cli/cmd/uninstall").then((m) => m.UninstallCommand),
  serve: () => import("./cli/cmd/serve").then((m) => m.ServeCommand),
  web: () => import("./cli/cmd/web").then((m) => m.WebCommand),
  models: () => import("./cli/cmd/models").then((m) => m.ModelsCommand),
  stats: () => import("./cli/cmd/stats").then((m) => m.StatsCommand),
  export: () => import("./cli/cmd/export").then((m) => m.ExportCommand),
  import: () => import("./cli/cmd/import").then((m) => m.ImportCommand),
  github: () => import("./cli/cmd/github").then((m) => m.GithubCommand),
  pr: () => import("./cli/cmd/pr").then((m) => m.PrCommand),
  session: () => import("./cli/cmd/session").then((m) => m.SessionCommand),
  plug: () => import("./cli/cmd/plug").then((m) => m.PluginCommand),
  plugin: () => import("./cli/cmd/plug").then((m) => m.PluginCommand),
  db: () => import("./cli/cmd/db").then((m) => m.DbCommand),
}

const ALL_COMMAND_LOADERS: CommandLoader[] = [
  () => import("./cli/cmd/acp").then((m) => m.AcpCommand),
  () => import("./cli/cmd/mcp").then((m) => m.McpCommand),
  () => import("./cli/cmd/tui").then((m) => m.TuiThreadCommand),
  () => import("./cli/cmd/attach").then((m) => m.AttachCommand),
  () => import("./cli/cmd/run").then((m) => m.RunCommand),
  () => import("./cli/cmd/generate").then((m) => m.GenerateCommand),
  () => import("./cli/cmd/debug").then((m) => m.DebugCommand),
  () => import("./cli/cmd/account").then((m) => m.ConsoleCommand),
  () => import("./cli/cmd/providers").then((m) => m.ProvidersCommand),
  () => import("./cli/cmd/agent").then((m) => m.AgentCommand),
  () => import("./cli/cmd/upgrade").then((m) => m.UpgradeCommand),
  () => import("./cli/cmd/uninstall").then((m) => m.UninstallCommand),
  () => import("./cli/cmd/serve").then((m) => m.ServeCommand),
  () => import("./cli/cmd/web").then((m) => m.WebCommand),
  () => import("./cli/cmd/models").then((m) => m.ModelsCommand),
  () => import("./cli/cmd/stats").then((m) => m.StatsCommand),
  () => import("./cli/cmd/export").then((m) => m.ExportCommand),
  () => import("./cli/cmd/import").then((m) => m.ImportCommand),
  () => import("./cli/cmd/github").then((m) => m.GithubCommand),
  () => import("./cli/cmd/pr").then((m) => m.PrCommand),
  () => import("./cli/cmd/session").then((m) => m.SessionCommand),
  () => import("./cli/cmd/plug").then((m) => m.PluginCommand),
  () => import("./cli/cmd/db").then((m) => m.DbCommand),
]

function show(out: string) {
  const text = out.trimStart()
  if (!text.startsWith("opencode ")) {
    process.stderr.write(UI.logo() + EOL + EOL)
    process.stderr.write(text + EOL)
    return
  }
  process.stderr.write(out)
}

const cli = yargs(args)
  .parserConfiguration({ "populate--": true })
  .scriptName("opencode")
  .wrap(100)
  .help("help", "show help")
  .alias("help", "h")
  .version("version", "show version number", InstallationVersion)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .option("pure", {
    describe: "run without external plugins",
    type: "boolean",
  })
  .middleware(async (opts) => {
    if (opts.printLogs) process.env.OPENCODE_PRINT_LOGS = "1"
    if (opts.logLevel) process.env.OPENCODE_LOG_LEVEL = opts.logLevel
    if (opts.pure) {
      process.env.OPENCODE_PURE = "1"
    }

    Heap.start()

    process.env.AGENT = "1"
    process.env.OPENCODE = "1"
    process.env.OPENCODE_PID = String(process.pid)
  })
  .usage("")
  .completion("completion", "generate shell completion script")

const firstCmd = args.find((a) => !a.startsWith("-"))

if (firstCmd && firstCmd in COMMANDS) {
  const cmd = await COMMANDS[firstCmd]()
  cli.command(cmd as any)
} else if (args.includes("-h") || args.includes("--help")) {
  const all = await Promise.all(ALL_COMMAND_LOADERS.map((fn) => fn()))
  for (const cmd of all) {
    cli.command(cmd as any)
  }
} else {
  const { TuiThreadCommand } = await import("./cli/cmd/tui")
  cli.command(TuiThreadCommand)
}

cli
  .fail((msg, err) => {
    if (
      msg?.startsWith("Unknown argument") ||
      msg?.startsWith("Not enough non-option arguments") ||
      msg?.startsWith("Invalid values:")
    ) {
      if (err) throw err
      cli.showHelp(show)
    }
    if (err) throw err
    process.exit(1)
  })
  .strict()

try {
  if (args.includes("-h") || args.includes("--help")) {
    await cli.parse(args, (err: Error | undefined, _argv: unknown, out: string) => {
      if (err) throw err
      if (!out) return
      show(out)
    })
  } else {
    await cli.parse()
  }
} catch (e) {
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("Unexpected error" + EOL)
    process.stderr.write(errorMessage(e) + EOL)
  }
  process.exitCode = 1
} finally {
  // Some subprocesses don't react properly to SIGTERM and similar signals.
  // Most notably, some docker-container-based MCP servers don't handle such signals unless
  // run using `docker run --init`.
  // Explicitly exit to avoid any hanging subprocesses.
  process.exit()
}
