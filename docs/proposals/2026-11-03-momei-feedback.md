# momei 对 2026-11-02 提案批次的研判记录

> 项目：`CaoMeiYouRen/momei` ｜ 研判：2026-11-03 ｜ 依据：[提案接收与反馈](../standards/proposals.md)
> 本文只记录 momei 的结论与落地范围；提案正文与其它项目的结论仍以各自文件为准。

## 1 结论总览

| 提案 | 状态 | momei 采纳范围 | 落地/复查 |
| :--- | :--- | :--- | :--- |
| [任务开局 CI 回执](./2026-11-02-task-start-ci-receipt.md) | 已采纳 | 新 Session 开局增加 CI 回执行；briefing 增加一行；参数固定为 `master` + `.session/current-task.yaml` | `.github/agents/full-stack-master.agent.md`；`gh` 不可用时记「不可用 + 原因」，空 conclusion 记「进行中」 |
| [发布前安全门禁](./2026-11-02-release-security-gate.md) | 已采纳（过渡期） | open + dismissed 双读；critical dismissed 阻断；dismissed high 仅 `false-positive`；台账 v2；数据源 fail-closed；open 告警既有阻断不变 | `scripts/security/*`、`.github/security/security-alert-exceptions.json`、`docs/standards/security.md` §5.3；一个发布周期后移除 `--transition-mode` |
| [AI 基建治理检查](./2026-11-02-governance-check-alignment.md) | 部分采纳 | 采纳 #4 references 索引；#5 弃用引用、#6 能力标记、#1 的 manifest 比对子项 optOut | `scripts/ai/check-governance.mjs`；先修复既有 anchor 红灯并接入 CI 后再扩展 |
| [standards 骨架接入](./2026-11-02-standards-skeleton-adoption.md) | 本轮不采纳 | `AGENTS.md` §2 已有三层事实源、§6.3 已有主定义/镜像治理，再引入正文会形成第二权威 | 等 dependfix 试点结论；届时只考虑「来源可追溯」（URL + commit）标注，不搬正文 |

## 2 optOut 登记

`ai-check` 的 optOut 已写入 `capabilities/registry.json`：

- `#5 弃用引用扫描`：momei 的 `ai-governance.md` 只有生命周期表，没有机器可读的 `deprecated` 标记/清单，当前也无弃用资产。
- `#6 能力标记`：读取上游 `capabilities/registry.json` 跨仓且离线不可用，项目侧重复读取会形成第二事实源；该台账由上游 `check-capabilities` 统一审计。
- `#1 的 manifest 比对子项`：momei 没有 `manifest.json`；本地 `name` / `description` / `metadata.internal` 检查已覆盖等价规则。

## 3 采纳依据与验证

### 3.1 任务开局 CI 回执

- 现状：`.session/current-task.yaml` / `runtime-state.json` / `wisdom.md` 已存在且 `.gitignore`；agent 已有 Session 协议，缺 CI 回执。
- 验证：`gh run list --commit <sha>` 可用；空 `conclusion` 映射为「进行中」；进行中的任务跳过；失败 run 只处理命中 `HEAD` / `@{u}` 的。

### 3.2 发布前安全门禁

- 实测缺口：原实现固定 `state=open`；`gateConclusion` 不统计 `sourceStatuses`；台账只有自由文本 `temporaryException`。
- 已落地：双状态拉取、dismissed 分类、台账 v2（`id` / `severity` / `category` / `target` / `review` / `tracking` / `expiresAt`，Code Scanning 另需 `location`）、数据源 fail-closed（非数组 / 缺失 sourceStatuses / 部分失败保留已读取告警）、transition 模式。
- 保留：critical 完全不可豁免、双台账分工、`tests/` 路径 Code Scanning 范围外；仅缺少 Dependabot token 时回退 `pnpm audit` 并标记 `fallback`，权限 / 网络 / 响应异常仍按失败处理。
- 迁移：mjml / quill 过期条目保留并标记 `expiresAt`；已 fixed 且 medium 的 code-scanning 30 / 31 移除。
- 过渡：`security:alerts` 追加 `--transition-mode`，dismissed / fail-closed 只报告；一个发布周期后移除。dismissed #43（`scripts/docs/check-doc-markers.mjs`）需在切阻断前修复或补 `false-positive` 依据。

### 3.3 AI 基建治理检查

- 采纳：references 索引检查，按「本技能 SKILL.md 或同名 agent」判定，避免其它文件顶包。
- 既有红灯：`pnpm ai:check` 原有 3 条 `skill-anchor-link` 已修复；检查已接入 `ci:precheck` 的 release / test profile。
- 不采纳：`--json` 输出暂不引入（当前无消费者）；弃用引用与能力标记见 §2。

### 3.4 standards 骨架

- 不采纳理由与 caomei-auth 一致：`AGENTS.md` 已有等价正文，引入上游正文会违反「同一规则只有一处正文」。
- 复查条件：dependfix 试点结论出来后，只评估「规范来源可追溯」标注。

## 4 反馈

- 上游无需为 momei 提供补丁或统一实现；本轮全部由项目侧自持。
- 能力台账只登记 optOut 与成熟样板；已采纳 / 过渡期的项目状态留在 momei 的 `docs/design/governance/2026-11-03-release-security-gate-dismissed-fail-closed.md` 与 `docs/standards/security.md`。
