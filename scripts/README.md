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

### `setup-ai.ps1`

创建符号链接，将项目中的 agents / skills 目录映射到常见 AI 助手的配置目录。

```powershell
.\scripts\setup-ai.ps1
```

创建的链接映射：

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
