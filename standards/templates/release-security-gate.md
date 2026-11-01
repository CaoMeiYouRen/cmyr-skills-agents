# 发布前安全门禁 · 项目段落模板

> 复制到项目 `docs/standards/security.md` 的一节，或作为 `AGENTS.md` 的 hard requirement 段。
> **判定口径只在上游仓库 `standards/gates.md` §2**（项目内没有该文件；复制模板时写明上游 URL 或 commit）。本模板只给结构、占位与验收。

## 1 适用范围

- 触发：`release.yml`、镜像发布、手动 `workflow_dispatch`、rc 预发布。
- 数据源与严重级取值：见上游 `standards/gates.md` §2.1 / §2.2，本文件不重复。

<!-- TODO: 项目填充：具体 workflow 文件名、触发条件、范围外告警（如 tests/ 路径）及依据。 -->

## 2 分级处置

直接引用上游 `standards/gates.md` §2.3 的三行判定，不在项目里改写。项目只补充：

- 本项目实际取严重级字段的位置（API 字段 / 脚本函数）；（TODO）
- 是否存在范围外告警，以及如何标注。（TODO）

## 3 台账

- 路径：`<!-- TODO -->`
- 字段：以上游 `standards/gates.md` §2.4 为准（含 `path` 与 `location` 的区别、复核条件、批准人）。
- 多台账（如 alerts 豁免 + audit allowlist）：写清分工与字段映射。`<!-- TODO -->`
- 同步：豁免条目同时登记到 `<!-- TODO: docs/plan/backlog.md -->`。

## 4 执行位置

- 命令：`<!-- TODO -->`
- 发布前步骤：`<!-- TODO: job 名与顺序 -->`
- **预检必须在版本提升之前**；阻断检查在发布动作之前。
- 周回归：复用全量质量门 + 同一门禁，频率 `<!-- TODO -->`。

## 5 fail-closed

- Dependabot token：`<!-- TODO -->`；Code Scanning token：`<!-- TODO -->`（分离要求见上游 §2.5）。
- 超时与重试：`<!-- TODO -->`
- 行为（未扫描 / 401 / 404 / 429 / 非数组 / 级别未知）以上游仓库 `standards/gates.md` §2.5 为准（附 URL / commit），本文件不复述判定。

## 6 验收（用 fixture，不依赖真实告警）

- [ ] mock 一条 high `open` → 阻断；登记 `hard-fix` → 放行。
- [ ] mock 一条 critical `dismissed` → **仍然阻断**。
- [ ] mock 一条 high `dismissed` 登记 `false-positive`（reason 含原 dismiss 原因）→ 放行。
- [ ] mock 台账缺复核条件 / Code Scanning 缺 `location` → 判失败。
- [ ] mock 401 / 非数组 / 级别未知 → 判失败。
- [ ] 预检发生在版本提升之前。
- [ ] 报告含各严重级的 open / dismissed 计数与 stale 台账 warning。

## 7 迁移方式

- 先 **report-only** 跑一个发布周期，确认无误判后再切阻断。
- 迁移期间只允许一个命令作为发布判据，避免双口径。
- 已存在的更严格项目规则（如人工批准、发布说明披露）不得因对齐模板而删除。
