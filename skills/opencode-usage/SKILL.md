# opencode-usage

OpenCode Token 消耗统计插件。读取 OpenCode 本地 SQLite 数据库，生成 token 和费用消耗报表。

## 功能

- **TUI 斜杠命令**：在 OpenCode TUI 中键入 `/usage`（或别名 `/cost`、`/tokens`）弹出统计弹窗
- **时段统计**：今日 / 本周 / 本月 / 总计
- **每日明细**：最近 30 天逐日统计
- **模型维度**：按 provider/model 逐模型拆分
- **CLI 模式**：也可作为独立命令行脚本运行

## CLI 用法

```sh
node .opencode/skills/opencode-usage/usage.mjs            # 总览
node .opencode/skills/opencode-usage/usage.mjs daily      # 每日明细（近 30 天）
node .opencode/skills/opencode-usage/usage.mjs models     # 按模型统计
node .opencode/skills/opencode-usage/usage.mjs today      # 仅今日
node .opencode/skills/opencode-usage/usage.mjs week       # 仅本周
node .opencode/skills/opencode-usage/usage.mjs month      # 仅本月
node .opencode/skills/opencode-usage/usage.mjs all        # 全部
```

## 数据来源

读取 OpenCode 的 SQLite 数据库：

| 环境变量 | 用途 |
|---|---|
| `OPENCODE_DB` | 指定完整数据库路径 |
| `OPENCODE_DATA_DIR` | 指定数据目录 |
| `XDG_DATA_HOME` | XDG 数据目录（Linux/macOS） |
| `APPDATA` / `XDG_DATA_HOME` | 数据目录（默认 `~/.local/share/opencode`） |

## 安装

插件已声明在 `.opencode/tui.json` 中，OpenCode TUI 会自动加载该插件。

### 全局安装（可选）

若要在所有项目中都可用，可将 plugin 声明添加到 `~/.config/opencode/tui.json`：

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["/absolute/path/to/cmyr-skills-agents/.opencode/skills/opencode-usage/usage-plugin.ts"]
}
```

## 依赖

- `@opencode-ai/plugin` — OpenCode TUI 插件 API
