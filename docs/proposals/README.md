# 改动提案（proposals）

> 上游只发起提案，不直接修改下游项目。下游由各自 agent 研判后决定采纳范围与实现方式。

## 写法

每份提案必须包含：

1. **变更摘要**：要做什么、涉及哪些文件类别。
2. **背景与证据**：当前各项目的实际状态（可复现的检查方式）。
3. **建议改动**：按项目列出，标明「必须 / 建议 / 可跳过」。
4. **需要项目 agent 研判的问题**：上游无法替项目决定的事项（凭据、路径、迁移风险、发布窗口）。
5. **验收标准**：可逐条勾选的行为。
6. **回滚方式**：出问题怎么退回。
7. **本项目不做什么**：明确边界，避免提案被当成命令。

## 发起流程

1. **起草**：按下面的「写法」新建 `YYYY-MM-DD-<slug>.md`。
2. **优化审查**：按「提交前优化审查」完成作者自检 + 独立复核；未通过不进入下一步。
3. **授权**：由用户确认是否通知、通知哪些项目；agent 不自行开 issue。
4. **通知**：按 [standards/proposals.md](../../standards/proposals.md) §5，向每个受影响仓库各开一个 issue；标题用 `[提案] <主题>`，正文只带该项目对应的分档与完整提案链接。同一仓库一个提案一个 issue，相关或不可拆分的提案可合并并列出覆盖清单。
5. **登记**：在 `status.json` 登记 issue 链接与项目结论，运行 `node scripts/check-proposals.mjs --write` 生成索引；有 issue 时项目状态以 issue 为准，本地批次以本项目记录为准。

## 提交前优化审查

审查结论写入提案头部：`> 审查：YYYY-MM-DD 通过（blocker 0 / warning 0 / suggest N；warning 理由：…）`；未通过需改完再提交。该格式自 2026-11-07 起适用于新提案，存量提案不追溯。

- [ ] **单一目的**：一个提案只解决一类问题；相关且无法拆分的提案已合并，避免下游重复研判。
- [ ] **无重复**：与已有提案、`capabilities/registry.json` 和项目现有实现比对，写清差异。
- [ ] **证据可复现**：给出命令、路径（含行号）或 run 链接，不写「据观察」。
- [ ] **按项目分档**：每个受影响项目都有「必须 / 建议 / 可跳过」与理由。
- [ ] **边界清楚**：写清本项目不做什么；不携带补丁，不替项目决定实现。
- [ ] **验收可判定**：每条可勾选，并写清失败判据。
- [ ] **回滚可执行**：写明回到什么状态、如何验证已回滚。
- [ ] **正文自包含**：issue 正文脱离上游仓库也能读懂，含提案链接与 commit。
- [ ] **易变信息标日期**：runner 名称、action 版本、计费 / 配额等标注核验日期。

审查结论分 blocker / warning / suggest：blocker 必须修复后才能提交；warning 可带理由放行并记入提案头部；suggest 记录不阻塞。审查只针对提案文本与证据，不代替项目侧技术研判。

审查主体为「作者自检 + 独立复核」：独立复核可由另一个 agent 或用户完成，结论与遗留项记录在提案 §8「提交前优化审查记录」。

## 接收与反馈

接收时机、状态、上游通知、下游反馈与上游扫描见 [standards/proposals.md](../../standards/proposals.md)；本文只定义提案写法、审查、边界与索引。

项目结论登记在 [`status.json`](./status.json)，索引与各提案文末的「项目研判结论」由 `node scripts/check-proposals.mjs --write` 生成。详细项目结论以该文件为准；提案头部只写一句话摘要，不重复逐项目状态。

```bash
# 校验状态与生成内容一致（CI 执行）
node scripts/check-proposals.mjs

# 更新状态后重新生成 README 索引与提案结论块
node scripts/check-proposals.mjs --write

# 例行扫描登记的 issue：逾期未回执 / 已关闭但需回读评论
node scripts/scan-proposal-issues.mjs --strict
```

字段口径：

- `stage`：`draft` → `notified` → `concluded`，不再推进的提案（含草案）用 `withdrawn` 并写 `reason`。
- 项目状态：`pending` / `adopted` / `partial` / `deferred` / `declined`；非 `pending` 必须有 `decidedAt`（项目书面结论）或 `observedAt`（上游扫描核验日期），并用 `basis` 标明来源（`feedback` / `issue` / `scan` / `record`）。
- `declined` 必须有 `note` 写理由；部分采纳且有明确跳过项时用 `declinedItems` 列出，能力已登记到 `registry` 时与其 `optOut` 对齐。
- 已结案 / 已撤回不允许残留 `pending`；结案日期记 `concludedAt`。
- 未开 issue、由用户转交的本地批次用 `notifiedVia: local-batch` 记录，不计入已按 issue 通知。

## 边界

- 提案不携带补丁、不附带「照做」的命令序列；实现由项目决定。
- 上游规则（`standards/`）与提案分开：规则是共同基线，提案是「是否/何时采纳」。
- 项目不采纳时，在能力台账登记 `optOut` 与理由（能力已登记到 `registry` 时），而不是静默跳过。

<!-- proposals-status:start -->
## 索引

> 阶段：草案 / 已通知 / 已结案 / 已撤回。项目结论由 `status.json` 生成；扫描命中的「已采纳 / 部分采纳」只代表标记存在，语义一致性仍需项目研判。

| 提案 | 能力 | 阶段 | dependfix | momei | caomei-ui | caomei-auth |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [任务开局 CI 回执检查](./2026-11-02-task-start-ci-receipt.md) | `task-start-ci-receipt` | 已通知 | 已采纳 | 已采纳 | 已采纳 | 待研判 |
| [发布前安全告警门禁](./2026-11-02-release-security-gate.md) | `release-security-gate` | 已结案 | 已采纳 | 已采纳 | 已采纳 | 已采纳 |
| [AI 基建治理检查对齐](./2026-11-02-governance-check-alignment.md) | `ai-check` | 已结案 | 部分采纳 · 跳过 2 项 | 部分采纳 · 跳过 3 项 | 部分采纳 | 部分采纳 · 跳过 2 项 |
| [standards 骨架接入（已撤回）](./2026-11-02-standards-skeleton-adoption.md) | — | 已撤回 | 不采纳 | 不采纳 | 不采纳 | 不采纳 |
| [Docker 镜像原生多架构构建](./2026-11-07-native-multiarch-docker.md) | `docker-workflow` | 已通知 | 已采纳 · [#222](https://github.com/dependfix/dependfix/issues/222) | 待研判 · [#1002](https://github.com/CaoMeiYouRen/momei/issues/1002) | — | 待研判 · [#718](https://github.com/CaoMeiYouRen/caomei-auth/issues/718) |

> 多仓库提案按项目列出 issue；有 issue 的以 GitHub 为准，本地批次以 `status.json` 的项目记录为准。

## 下游研判记录

| 项目 | 范围 | 日期 | 记录 |
| :--- | :--- | :--- | :--- |
| momei | 2026-11-02 批次 | 2026-11-03 | [2026-11-03-momei-feedback.md](./2026-11-03-momei-feedback.md) |
| dependfix | Docker 原生多架构 | 2026-11-07 | [#222](https://github.com/dependfix/dependfix/issues/222) |
<!-- proposals-status:end -->
