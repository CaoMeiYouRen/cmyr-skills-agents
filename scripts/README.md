# Scripts

## 可用脚本

### `sync-skills.mjs`

将项目 `skills/` 目录下的技能增量同步到全局技能目录。只同步有更新（文件较新）或新增的技能，不删除目标目录中已有的其他文件。

```bash
# 预览同步计划（不实际复制）
node scripts/sync-skills.mjs --dry-run

# 执行同步（自动发现目标目录）
node scripts/sync-skills.mjs

# 指定目标目录
node scripts/sync-skills.mjs --target C:\Users\CaoMeiYouRen\.claude\skills

# 强制覆盖（忽略文件时间比较）
node scripts/sync-skills.mjs --force
```

**参数**：

| 参数 | 说明 |
|------|------|
| `--target, -t <path>` | 手动指定目标目录（默认自动发现） |
| `--dry-run, -n` | 预览模式，不实际复制文件 |
| `--force, -f` | 强制覆盖，忽略文件时间比较 |
| `--help, -h` | 显示帮助信息 |

**目标目录自动发现顺序**：

1. `~/.copilot/skills`
2. `~/.claude/skills`
3. `~/.config/opencode/skills`
4. 若均不存在 → 提示通过 `--target` 手动指定

### `sync-agents-md.mjs`

将 `global/AGENTS.md` 同步到各 AI 工具的全局配置目录。只在源文件比目标文件更新时才覆盖。

```bash
# 预览同步计划（不实际复制）
node scripts/sync-agents-md.mjs --dry-run

# 执行同步（自动发现所有已安装工具的配置目录）
node scripts/sync-agents-md.mjs

# 指定单个目标文件
node scripts/sync-agents-md.mjs --target ~/.config/opencode/AGENTS.md

# 强制覆盖（忽略文件时间比较）
node scripts/sync-agents-md.mjs --force
```

**参数**：

| 参数 | 说明 |
|------|------|
| `--target, -t <path>` | 手动指定目标文件路径（默认同步到所有已发现的目录） |
| `--dry-run, -n` | 预览模式，不实际复制文件 |
| `--force, -f` | 强制覆盖，忽略文件时间比较 |
| `--help, -h` | 显示帮助信息 |

**自动发现的目标**：

1. `~/.claude/CLAUDE.md`
2. `~/.config/opencode/AGENTS.md`
3. `~/.copilot/AGENTS.md`
4. `~/.cursorrules`

### `setup-ai.mjs`

创建符号链接，将项目中的 agents / skills 目录与 AGENTS.md 映射到常见 AI 助手的配置目录。跨平台（Windows 使用 junction / 文件符号链接，POSIX 使用相对路径符号链接），自动遍历所有 git worktree。

```bash
node scripts/setup-ai.mjs
```

创建的链接映射（权威源为顶层 `agents/`、`skills/`、`AGENTS.md`）：

| 目标 | 源 |
|------|-----|
| `.github/agents` | `agents/` |
| `.github/skills` | `skills/` |
| `.claude/agents` | `agents/` |
| `.claude/skills` | `skills/` |
| `.agents/agents` | `agents/` |
| `.agents/skills` | `skills/` |
| `.opencode/agents` | `agents/` |
| `.opencode/skills` | `skills/` |
| `CLAUDE.md` | `AGENTS.md` |

> Windows 下文件符号链接（`CLAUDE.md`）需要开发者模式或管理员权限；目录链接使用 junction 无需特权。

### `check-proposals.mjs`

校验 `docs/proposals/status.json`，并在 README 索引与各提案文末渲染「项目研判结论」，保证提案状态只有一个事实源。

```bash
# 校验状态合法且生成内容与文件一致（CI 执行）
node scripts/check-proposals.mjs

# 更新 status.json 后重新生成 README 索引与提案结论块
node scripts/check-proposals.mjs --write

# 输出机器可读结果
node scripts/check-proposals.mjs --json
```

**参数**：

| 参数 | 说明 |
|------|------|
| `--root <path>` | 仓库根目录，默认当前目录 |
| `--status <path>` | 状态文件，默认 `docs/proposals/status.json` |
| `--readme <path>` | 索引文件，默认 `docs/proposals/README.md` |
| `--write` | 写回生成内容 |
| `--json` | 输出 JSON 摘要 |

**退出码**：`0` 通过；`1` 状态校验失败或生成内容不一致；`2` 参数、文件或标记错误。

### `scan-proposal-issues.mjs`

读取 `docs/proposals/status.json` 登记的 proposal issue，通过 `gh` 查询状态与评论，标出逾期未回执与需要回读的已关闭 issue。只输出报告，不修改 issue。

```bash
# 例行扫描：open 且静默超过 7 天算逾期
node scripts/scan-proposal-issues.mjs

# 存在逾期时退出码为 1，便于定时任务告警
node scripts/scan-proposal-issues.mjs --strict

# 指定基准日期，便于复现
node scripts/scan-proposal-issues.mjs --now 2026-11-09 --overdue-days 7
```

**参数**：

| 参数 | 说明 |
|------|------|
| `--status <path>` | 状态文件，默认 `docs/proposals/status.json` |
| `--now <YYYY-MM-DD>` | 计算天数用的基准日期 |
| `--overdue-days <n>` | 静默超过多少天算逾期，默认 7 |
| `--strict` | 有逾期时退出码 1（待回读只报告） |
| `--json` | 输出 JSON |

**退出码**：`0` 报告完成；`1` `--strict` 下存在逾期；`2` 参数、文件或 `gh` 调用错误。
