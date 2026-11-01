# 提案：任务开局 CI 回执检查

> 能力：`task-start-ci-receipt`（A 类，随 L0 技能分发）
> 发起：2026-11-02 ｜ 状态：待各项目 agent 研判

## 1 变更摘要

新任务开始时（工作区干净、无进行中任务），先看最近一次 GitHub Actions 结果，再进入规划或实现；失败属于本次推送时优先处理，严重失败先请示用户。

- 规则正文：`skills/full-stack-master/references/task-start.md`（随技能分发）
- 上游技能：`skills/full-stack-master` 的「新 Session 开局」已加入该步骤
- 项目侧：核对参数与 briefing 格式，不复制规则正文

## 2 背景与证据

可复现检查：

```bash
grep -rn "CI 回执" <项目>/AGENTS.md <项目>/docs/standards
node scripts/check-capabilities.mjs --projects ../dependfix,../caomei-auth,../momei,../caomei-ui
```

当前扫描结果：

| 项目 | 规则文本 | session 文件 | 结论 |
| :--- | :--- | :--- | :--- |
| dependfix | 有（AGENTS 的「任务开局 CI 回执检查」） | 有 | 已落地 |
| momei | 无（规则只在 agent 文件里提过） | 有 | 未落地 |
| caomei-ui | 无 | 有 | 未落地 |
| caomei-auth | 无 | 无 | 未落地（已决定引入 session） |

## 3 建议改动（按项目）

| 项目 | 建议 | 说明 |
| :--- | :--- | :--- |
| dependfix | **必须：核对** | 规则已有；确认每次新任务 briefing 都出现 CI 回执行 |
| momei | **建议：采纳** | 有 `.session`；更新 full-stack-master（L0）后开局自动生效，`AGENTS.md` 引用 `skills/full-stack-master/references/task-start.md` |
| caomei-ui | **建议：采纳** | 同上，注意默认分支与 briefing 位置 |
| caomei-auth | **必须：先引入 session** | 已决定引入 `.session`；建议最小两件套 `current-task.yaml` + `wisdom.md`，再启用 CI 回执 |
| 其他项目 | 可跳过 | 无 GitHub 协作或无 session 需求时，登记 `optOut` 与理由 |

## 4 需要项目 agent 研判的问题

1. **session 形态**：caomei-auth 用最小两件套还是完整三件套（`current-task.yaml` / `runtime-state.json` / `wisdom.md`）；`.session/` 的 gitignore 与首次投递时机。
2. **迁移顺序**：先建 session 再加规则，还是同一次改动完成；历史任务是否需要补写。
3. **briefing 位置**：CI 回执行放在开局 briefing 的哪一步、是否只在失败时输出。
4. **报告长度**：briefing 行数上限是否因新增一行而调整。
5. **默认分支**：项目默认分支与 `@{u}` 的关系；monorepo / 多分支发布是否要额外过滤。

## 5 验收标准

- [ ] 每次新任务 briefing 都出现 `CI 回执：通过 / 失败（run 链接）/ 无相关 run / 不可用（原因）`。
- [ ] 失败 run 只处理命中 `HEAD` 或 `@{u}` 的；历史失败标注「非本次推送」。
- [ ] 进行中的任务不触发该检查。
- [ ] `gh` 不可用时继续任务，但没有被当成通过。
- [ ] caomei-auth 的 `.session` 已建立并进入 `.gitignore`。

## 6 回滚

- 只读检查：回滚 = 移除项目 `AGENTS.md` 的引用或关闭该步骤，不影响构建与发布。
- briefing 变长影响体验时，可降级为「仅失败时输出」。

## 7 本项目不做什么

- 不修改任何下游文件，不创建 `.session` 目录。
- 不规定 briefing 的具体措辞与行数上限。
- 不把 CI 回执当成质量门或发布门禁。
