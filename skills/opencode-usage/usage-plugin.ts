import type { TuiPlugin } from "@opencode-ai/plugin/tui"
import { buildReport, dbPath, loadMessages } from "./usage.mjs"

const tui: TuiPlugin = async (api) => {
  const register = api.command?.register
  if (!register) return

  register(() => [
    {
      title: "Usage",
      value: "usage.show",
      description: "Show your OpenCode token + cost usage",
      category: "Usage",
      suggested: true,
      slash: { name: "usage", aliases: ["cost", "tokens"] },
      async onSelect(dialog) {
        const stack = dialog ?? api.ui.dialog

        let report: string
        try {
          const messages = await loadMessages()
          report = buildReport(messages, { period: "summary", now: Date.now() })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          report = `Could not read OpenCode usage.\n\nDatabase: ${dbPath()}\nError: ${message}`
        }

        stack.setSize?.("large")
        stack.replace(() =>
          api.ui.DialogAlert({
            title: "OpenCode Usage",
            message: report,
            onConfirm: () => stack.clear(),
          }),
        )
      },
    },
  ])
}

export default { id: "opencode-usage", tui }
