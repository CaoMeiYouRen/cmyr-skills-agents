---
name: multi-repo-alert-remediator
description: 批量拉取当前用户所有 GitHub 仓库的 Dependabot / Code Scanning 安全告警，并按仓库落地到本地逐仓库修复。用户提到 batch fix security alerts、multi-repo security、批量修复告警、多仓库安全告警、跨仓库 Dependabot 修复、扫描所有仓库安全漏洞、all repos security alerts、GitHub security alerts 批量处理时都应触发。适用于同时在多个项目中维护依赖安全、定期巡检所有个人仓库安全状况、或需要在多仓库间按优先级逐仓库修复告警的场景。
---

# Multi-Repo Alert Remediator

铁律：先汇总、再排序、逐仓库修、每仓一提交、绝不推送。不要在一个脏工作区里开始，也不要把多仓库修复结果混进一个提交。

## 路径解析约定

- 本技能中出现的 `scripts/` 和 `references/` 都是相对于本技能目录的路径。
- `../security-alert-remediator/` 指向同仓库下的单仓库安全告警修复 skill 目录，本技能复用其修复脚本。
- 下文命令示例里的 `<skill-dir>` 表示本技能目录；`<sardir>` 表示 `../security-alert-remediator` 目录。

## 工作流

- [ ] Step 1: 全局预检 ⚠️ REQUIRED
  - [ ] 1.1 确认 `GITHUB_TOKEN` 或 `GH_TOKEN` 环境变量可用，且具有 `repo` + `security_events` 权限。
  - [ ] 1.2 确认当前工作区没有未提交的改动；如果当前在某个仓库内，先确保该仓库干净。
  - [ ] 1.3 加载 `references/repo-mapping-guide.md`，了解仓库映射策略与用户交互协议。
- [ ] Step 2: 批量收集告警 ⚠️ REQUIRED
  - [ ] 2.1 运行 `<skill-dir>/scripts/collect-multi-repo-alerts.mjs --output-json <path>`，收集当前用户所有仓库的 Dependabot alerts。
  - [ ] 2.2 读取 JSON 输出，按 `critical > high > medium > low` 排序形成仓库优先级列表。
  - [ ] 2.3 将 JSON 输出中的 `repos` 数组作为后续逐仓库修复的调度队列。
  - [ ] 2.4 ⚠️ 临时文件的清理：修复流程全部完成后，删除 `--output-json` 和 `--output-markdown` 生成的快照文件，不得提交到 Git。
- [ ] Step 3: 用户确认仓库列表 ⚠️ REQUIRED
  - [ ] 3.1 将 Step 2 收集到的仓库列表（含每个仓库的 alert 数量、severity 分布）呈现给用户。
  - [ ] 3.2 等待用户 review 并确认。用户可以：
    - 直接确认全部仓库，进入下一步。
    - 排除部分仓库（如暂时不处理的、不想自动修改的）。
    - 调整优先级顺序（如将某个高优先仓库提前或延后）。
    - 要求重新收集（如调整 `--updated-after` 时间范围后重新运行 Step 2）。
    - 完全取消本次操作。
  - [ ] 3.3 只有在用户明确确认仓库列表后，才进入后续的映射和修复步骤。
  - [ ] 3.4 用户确认的最终仓库列表将作为 Step 4 和 Step 5 的调度依据。
- [ ] Step 4: 建立仓库映射 ⚠️ REQUIRED
  - [ ] 4.1 对 Step 3 确认后的每个远程仓库，尝试在本地文件系统中找到对应目录。
  - [ ] 4.2 映射发现策略详见 `references/repo-mapping-guide.md`：先按 `{repoName}` 在常用根目录下搜索；找不到时请用户指定搜索根目录；仍无法匹配则 skip 并通知用户。
  - [ ] 4.3 将映射结果整理为 `[{ remoteName, remoteUrl, localPath, status }]` 列表，status 为 `mapped | skipped | manual-needed`。
- [ ] Step 5: 逐仓库修复 ⚠️ REQUIRED
  - [ ] 5.1 按 Step 2 确定的优先级顺序遍历仓库列表。
  - [ ] 5.2 对每个已映射到本地的仓库，按 `security-alert-remediator` 的单仓库修复流程执行：
    - [ ] 5.2.1 运行 `<sardir>/scripts/check-git-preflight.mjs` 做仓库预检。
    - [ ] 5.2.2 运行 `<sardir>/scripts/collect-security-alerts.mjs` 收集当前仓库告警（若已有从 Step 2 的全局告警数据可复用，则跳过此步）。
    - [ ] 5.2.3 按 `<sardir>/references/severity-policy.md` 决定聚焦级别。
    - [ ] 5.2.4 使用 `<sardir>/scripts/update-pnpm-dependency.mjs` 执行单包或关联包升级。
    - [ ] 5.2.5 若遇到 lockfile 不一致或 `ERR_PNPM_IGNORED_BUILDS`，使用 `<sardir>/scripts/repair-frozen-lockfile.mjs` 修复。
    - [ ] 5.2.6 每次升级后运行项目真实存在的 lint / test / build / typecheck 质量门。
  - [ ] 5.3 每个仓库修复完成后，在**该仓库目录内**执行：
    - [ ] 5.3.1 `git add` 变更文件。
    - [ ] 5.3.2 生成 Conventional Commit 格式的提交消息（推荐使用 `conventional-committer` skill）。
    - [ ] 5.3.3 `git commit` 提交，**不执行 `git push`**。
  - [ ] 5.4 如果某个仓库的修复引入破坏性变更：记录该仓库为 `blocked`，回退变更，继续处理下一个仓库。
- [ ] Step 6: 汇总报告 ⚠️ REQUIRED
  - [ ] 6.1 汇总所有仓库的处理结果：成功修复数、跳过数、阻塞数。
  - [ ] 6.2 列出所有已 commit 但未 push 的仓库及对应的 commit hash，提醒用户 review。
  - [ ] 6.3 对 `blocked` 仓库列出阻塞原因和建议的下一步。
  - [ ] 6.4 对 `skipped`（无法映射到本地）的仓库，列出仓库名与 URL，提醒用户手动处理或指定本地路径后重新运行。
  - [ ] 6.5 删除临时告警快照文件。

## 提交策略

- **每仓库独立提交**：不同仓库的修复绝对不合并在同一个 commit 里。
- **不自动推送**：所有 commit 仅存在于本地，等待用户 review 后手动 `git push`。
- **仓库内分批提交**：如果单个仓库内有多个独立的安全升级，可按 `security-alert-remediator` 的 Step 6 规则分批提交。
- **提交消息规范**：优先使用 Conventional Commit 格式，如 `fix(deps): upgrade lodash to 4.17.21 for CVE-2024-XXXXX`。

## 可用脚本

- `<skill-dir>/scripts/collect-multi-repo-alerts.mjs`：批量拉取用户所有仓库的 Dependabot alerts，输出 JSON 和 Markdown 报告。
  ```
  node <skill-dir>/scripts/collect-multi-repo-alerts.mjs --output-json alerts.json --output-markdown alerts.md
  ```
- `<sardir>/scripts/check-git-preflight.mjs`：检查单个仓库的 Git 工作区前置条件。
- `<sardir>/scripts/collect-security-alerts.mjs`：单仓库告警采集。
- `<sardir>/scripts/update-pnpm-dependency.mjs`：执行 pnpm 依赖升级。
- `<sardir>/scripts/repair-frozen-lockfile.mjs`：修复 lockfile 不一致、损坏及 `ERR_PNPM_IGNORED_BUILDS` 问题。
- `<sardir>/scripts/remove-pnpm-override.mjs`：在用户显式要求时移除过时 override。

## 参考文档

- `<skill-dir>/references/repo-mapping-guide.md`：远程仓库到本地目录的映射策略。
- `<sardir>/references/severity-policy.md`：单仓库修复的严重级别聚焦策略。
- `<sardir>/references/remediation-playbook.md`：单仓库修复的批次规划与耦合处理规则。

## 反模式

- 在没有 `GITHUB_TOKEN` 或 token 权限不足时直接开始。
- 把多个仓库的修复混在一个 commit 里。
- 修复完成后自动 `git push`，跳过用户 review 环节。
- 对每个仓库都从零开始收集告警，忽略 Step 2 已拉取的全局告警数据。
- 跳过用户确认仓库列表的步骤，直接进入映射和修复。
- 在用户未确认本地仓库根目录前，凭借猜测强行映射路径。
- 遇到无法映射的仓库时静默跳过，不通知用户。
- 在某个仓库修复失败时，不清除残留的未提交变更就跳到下一个仓库。
- 提交临时告警快照文件到 Git。
- 在仓库中不存在 pnpm lockfile 时仍然机械运行升级脚本。
- 跨仓库批量修复时，某仓库出现 `ERR_PNPM_IGNORED_BUILDS` 后只跳过不修复 `allowBuilds` 配置，导致该仓库后续 CI 持续失败。

## 交付前检查

- [ ] 全局告警 JSON 已成功生成，且覆盖了所有符合条件的仓库。
- [ ] 仓库优先级已按 severity 排序，critical 优先于 high。
- [ ] 用户已 review 并确认仓库列表，无未确认的仓库进入修复流程。
- [ ] 每个已修复仓库的质量门（lint / test / build / typecheck）已通过。
- [ ] 每个仓库的修复已独立提交，提交消息符合 Conventional Commit 格式。
- [ ] 所有 commit 均未推送到远程。
- [ ] 已汇总 blocked / skipped 仓库及其原因。
- [ ] 临时告警快照文件已删除。
