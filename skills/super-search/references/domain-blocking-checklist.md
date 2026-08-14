# Domain Blocking Checklist — 全局封禁域名的系统化操作

当用户要求「屏蔽 X 站点，不在任何文章中使用」时，按此清单逐项操作。单靠 tinyfish MCP 过滤是不够的——`web_search`、`web_extract`、RSS 采集等入口都能绕过。

## 操作流程

### Step 1: 全局扫描

```bash
# 找到所有引用该域名的位置
rg -rn "csdn\.net|CSDN" /opt/data/skills/super-search/ /opt/data/scripts/
```

### Step 2: 逐入口封禁

| # | 入口 | 文件 | 操作 |
|---|------|------|------|
| 1 | 超级搜索 - 质量分析 | `scripts/analyze.ts` | 从 UGC 组分离，评分设为 0（低于 DISCARD_THRESHOLD=30 自动淘汰） |
| 2 | 超级搜索 - 编译输出 | `dist/analyze.mjs` | 同步修改，缩进用 tab，正则不用多余转义 |
| 3 | 超级搜索 - 信源分层 | `references/source-priority.md` | 列入 ❌ 不可用层级，标注「全局封禁」 |
| 4 | 超级搜索 - 质量评分 | `references/quality-criteria.md` | 从原评分行分离，独立写一行标注「封禁」 |
| 5 | 超级搜索 - 主规则 | `SKILL.md` | 在「信源分层检查」中写明确认声明；在 Anti-Patterns 中添加对应反模式 |
| 6 | 超级搜索 - 域名黑名单 | 本文件 | 更新下方「已封禁域名列表」 |
| 7 | 内容策展采集 | `/opt/data/scripts/content-curator.py` | 在 `BLOCKED_DOMAINS` 列表中添加域名及其子域；`is_blocked_domain()` 覆盖子域名匹配 |
| 8 | Memory | `memory` 工具 | 记录封禁规则，标注涉及的文件列表 |

### Step 3: 验证

- [ ] `analyze.mjs` 语法正确（`node -e "import('./dist/analyze.mjs')"` 无报错）
- [ ] `content-curator.py` 语法正确（`python3 -c "import py_compile; py_compile.compile(...)"`）
- [ ] 搜索 `rg "被封禁域名" /opt/data/skills/ /opt/data/scripts/` 确认所有引用已处理

## 设计原则

1. **硬拦截，不靠「某工具会自动过滤」**——tinyfish 只是搜索后端之一，`web_search`、RSS、直接抓取都可能绕过
2. **评分 0 而非删除规则**——保留规则行方便未来审计，但评分 0 确保它永远被淘汰
3. **子域名全覆盖**——`blog.csdn.net`、`ask.csdn.net`、`download.csdn.net` 都是 `csdn.net` 的子域
4. **同步编译输出**——改 `.ts` 必须同步改 `.mjs`，否则编译产物覆盖手动修改

## 已封禁域名

| 域名 | 封禁范围 | 原因 |
|------|---------|------|
| `csdn.net` | 全局（含 `blog.`、`ask.`、`download.` 子域） | 内容农场、机翻、低质转载、无原创 |

## 案例：CSDN 封禁（2026-06-12）

用户指令：「把CSDN屏蔽了，不在任何文章中使用来自CSDN的文章」

执行结果：
- 6 个文件修改（analyze.ts / analyze.mjs / quality-criteria.md / source-priority.md / SKILL.md / content-curator.py）
- `analyze.mjs` 修复了双反斜杠转义和缩进不一致（初次 patch 时 old_string tab 匹配失败导致）
- TODO 驱动执行，逐项完成 + 验证
