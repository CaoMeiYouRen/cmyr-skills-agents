---
name: multi-repo-alert-remediator
description: 批量拉取当前用户所有 GitHub 仓库的 Dependabot / Code Scanning 安全告警，并按仓库落地到本地逐仓库修复。用户提到 batch fix security alerts、multi-repo security、批量修复告警、多仓库安全告警、跨仓库 Dependabot 修复、扫描所有仓库安全漏洞、all repos security alerts、GitHub security alerts 批量处理时都应触发。多仓库跑时默认委托子 agent 逐仓库执行以避免主上下文膨胀；环境中存在 dependfix-remediator 技能时优先使用 dependfix 进行依赖修复，否则复用 security-alert-remediator 流程。适用于同时在多个项目中维护依赖安全、定期巡检所有个人仓库安全状况、或需要在多仓库间按优先级逐仓库修复告警的场景。

metadata:
  internal: true
---

# Multi-Repo Alert Remediator

铁律：先汇总、再排序、逐仓库修、每仓一提交、绝不推送。不要在一个脏工作区里开始，也不要把多仓库修复结果混进一个提交。

铁律二：**子 agent 优先**。主 agent 只负责收集告警、排序、确认列表、映射仓库与汇总报告；逐仓库修复细节一律委托子 agent 执行，禁止主 agent 亲自进入每个仓库操作，避免主上下文过度膨胀。主 agent 只保留每个子 agent 返回的结果摘要。

铁律三：**dependfix 优先**。环境中存在 `dependfix-remediator` 技能时，单仓库依赖修复优先使用 dependfix-remediator（`npx dependfix fix`）；不存在时回退到 `security-alert-remediator` 的脚本流程。两条后端都遵守"每仓一提交、绝不推送"。

## 路径解析约定

- 本技能中出现的 `scripts/` 和 `references/` 都是相对于本技能目录的路径。
- `../security-alert-remediator/` 指向同仓库下的单仓库安全告警修复 skill 目录，作为 dependfix-remediator 不可用时的回退后端。
- `dependfix-remediator` 是环境级技能（不在本仓库内），基于 `npx dependfix` CLI。探测方式：检查当前会话技能列表，或全局技能目录（如 `~/.config/opencode/skills/dependfix-remediator/`、`~/.copilot/skills/dependfix-remediator/`）是否存在。存在即优先使用，详见「执行后端选择（dependfix 优先）」。
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
  - [ ] 4.3 ⚠️ 注意非标准路径：部分仓库可能在非常用根目录下（如 `D:\Projects\electron\electron-vite-template`、`D:\Projects\rss-impact\rss-impact-server`）。如果 glob 找不到，用 `Get-ChildItem -Recurse -Depth 3 -Directory` 在上级搜索目录中深度查找。
  - [ ] 4.4 将映射结果整理为 `[{ remoteName, remoteUrl, localPath, status }]` 列表，status 为 `mapped | skipped | manual-needed`。
- [ ] Step 5: 逐仓库修复（子 agent 优先）⚠️ REQUIRED
  - [ ] 5.1 主 agent 调度：按 Step 2 确定的优先级顺序，将 Step 3 确认后的仓库列表组织成任务队列，为每个仓库创建一个子 agent 任务。主 agent 给子 agent 的输入只包含：`{ remoteName, remoteUrl, localPath, severityFocus }`，并明确告知子 agent「执行后端探测规则」与「返回结果摘要格式」。
  - [ ] 5.2 分组与并发（延续既有策略）：
    - **简单组**：仅需添加 `brace-expansion`、`ini`、`esbuild` 等通用 overrides 的仓库（模式高度一致），并行分发 5-6 个子 agent。
    - **复杂组**：每个仓库需要不同 overrides 配置（如 `unplugin-dynamic-import`、`afdian-linker`），分组并行，每组 3-4 个。
    - **大仓库**（依赖 > 500，如 Nuxt/Electron）：串行执行，单独一个子 agent，超时 600s。
    - ⚠️ 并发的是子 agent 任务，不是主 agent 亲自并行操作仓库；主 agent 只等待结果并汇总。
  - [ ] 5.3 子 agent 任务契约（每个子 agent 对单个仓库执行）：
    - [ ] 5.3.1 执行仓库预检：运行 `<sardir>/scripts/check-git-preflight.mjs`，确认仓库干净且可快进；异常时返回 `blocked` 状态与原因，不自行深挖。
    - [ ] 5.3.2 执行后端选择：探测 dependfix-remediator 是否可用（见「执行后端选择（dependfix 优先）」小节）：
      - **dependfix 可用 → 优先使用**：在仓库目录内运行 `npx dependfix fix --repo <owner>/<repo> --severity-threshold <level>` 完成修复与验证；报告留在 `dependfix-reports/`（已被 .gitignore 忽略，属可审计产物）。
      - **dependfix 不可用 → 回退 security-alert-remediator**：按 5.3.3 的脚本流程执行。
    - [ ] 5.3.3 回退流程（`<sardir>` 脚本）：
      - [ ] 5.3.3.1 运行 `<sardir>/scripts/collect-security-alerts.mjs` 收集当前仓库告警（若已有从 Step 2 的全局告警数据可复用，则跳过此步）。
      - [ ] 5.3.3.2 按 `<sardir>/references/severity-policy.md` 决定聚焦级别。
      - [ ] 5.3.3.3 使用 `<sardir>/scripts/update-pnpm-dependency.mjs` 执行单包或关联包升级。
      - [ ] 5.3.3.4 若遇到 lockfile 不一致或 `ERR_PNPM_IGNORED_BUILDS`，使用 `<sardir>/scripts/repair-frozen-lockfile.mjs` 修复。
      - [ ] 5.3.3.5 每次升级后运行项目真实存在的 lint / test / build / typecheck 质量门。
    - [ ] 5.3.4 提交（两条后端通用）：在**该仓库目录内**执行：
      - [ ] 5.3.4.1 `git add` 变更文件。
      - [ ] 5.3.4.2 生成 Conventional Commit 格式的提交消息（推荐使用 `conventional-committer` skill）。
      - [ ] 5.3.4.3 `git commit` 提交，**不执行 `git push`**。
    - [ ] 5.3.5 返回结构化摘要给主 agent：`{ remoteName, localPath, status: ok | blocked | skipped, fixedAlerts, unfixedHighPlus, commitHash?, qualityGates, reason? }`。⚠️ 子 agent 只返回摘要，不把完整日志/中间输出回传给主 agent。
  - [ ] 5.4 主 agent 汇总：收集所有子 agent 结果，按 status 分组；`blocked` 与 `skipped` 的仓库记录原因，供 Step 6 报告。
  - [ ] 5.5 如果某个仓库的修复引入破坏性变更：子 agent 记录该仓库为 `blocked`，回退变更，主 agent 继续调度下一个仓库。
  - [ ] 5.6 ⚠️ 分支分叉处理：子 agent 执行 `git pull --rebase` 因分叉失败（pnpm-lock.yaml 冲突）时，尝试 `git checkout --theirs pnpm-lock.yaml` 接受远端锁文件，然后 `GIT_EDITOR=true git rebase --continue`。仍失败则标记为 `blocked` 并汇报。
- [ ] Step 6: 汇总报告 ⚠️ REQUIRED
  - [ ] 6.1 汇总所有仓库的处理结果：成功修复数、跳过数、阻塞数。
  - [ ] 6.2 列出所有已 commit 但未 push 的仓库及对应的 commit hash，提醒用户 review。
  - [ ] 6.3 对 `blocked` 仓库列出阻塞原因和建议的下一步。
  - [ ] 6.4 对 `skipped`（无法映射到本地）的仓库，列出仓库名与 URL，提醒用户手动处理或指定本地路径后重新运行。
  - [ ] 6.5 删除临时告警快照文件。
- [ ] Step 7: 推送与 CI 验证 ⚠️ REQUIRED（用户要求推送时才执行）
  - [ ] 7.1 逐一推送每个仓库的 commit：`git push`（在仓库目录内执行）。
  - [ ] 7.2 检查每个仓库的 GitHub Actions CI 状态：`gh run list -R <owner>/<repo> --json conclusion,displayTitle,event,headBranch`。
  - [ ] 7.3 将 CI 失败分为三类：
    - **本次变更导致**（minimumReleaseAge 违规、Dockerfile 缺少 pnpm-workspace.yaml、commitlint hook 因升级损坏）→ 立即修复
    - **Dependabot 自动更新失败**（event=dynamic）→ 预存问题，非本次引起
    - **基础设施问题**（NPM_TOKEN 过期、Docker 认证失败）→ 记录并通知用户
  - [ ] 7.4 修复后重新推送，直至对应仓库的最新 push 触发 CI 通过。

## 执行后端选择（dependfix 优先）

- **探测时机**：主 agent 在 Step 5 分发前完成一次后端探测，并把结果写进每个子 agent 的输入；子 agent 也可自行复核。
- **探测方式**：检查当前会话是否加载了 `dependfix-remediator` 技能（技能列表中存在），或全局技能目录存在：`~/.config/opencode/skills/dependfix-remediator/`、`~/.copilot/skills/dependfix-remediator/`。
- **dependfix 可用 → 优先使用**：
  - 逐仓库执行：在仓库目录内运行 `npx dependfix fix --repo <owner>/<repo> --severity-threshold <level>`（`<level>` 按 `<sardir>/references/severity-policy.md` 的聚焦级别决定）。
  - 默认只做本地验证（install + lint + build），不提交不推送；提交仍走 5.3.4 的 Conventional Commit 流程（或 dependfix 的 `--commit`，与 `conventional-committer` 规范一致时可用）。
  - 报告落盘在仓库的 `dependfix-reports/`，属于可审计产物，保留不删除。
  - 也可以在用户明确同意时使用 dependfix 的场景 D（`--owner` / `--repos-file`）做整批修复，但仍须遵守"每仓一提交、绝不推送"铁律，且同样建议委托子 agent 执行。
- **dependfix 不可用 → 回退**：按 Step 5.3.3 的 `<sardir>` 脚本流程执行。
- **两条后端一致约束**：无论哪条后端，质量门必须跑项目真实存在的 lint/test/build/typecheck；修复结果只回传摘要，不把完整日志回传给主 agent。

## 提交策略

- **每仓库独立提交**：不同仓库的修复绝对不合并在同一个 commit 里。
- **不自动推送**：所有 commit 仅存在于本地，等待用户 review 后手动 `git push`。
- **仓库内分批提交**：如果单个仓库内有多个独立的安全升级，可按 `security-alert-remediator` 的 Step 6 规则分批提交。
- **提交消息规范**：优先使用 Conventional Commit 格式，如 `fix(deps): upgrade lodash to 4.17.21 for CVE-2024-XXXXX`。

## 批量执行超时与并发策略

- **并发对象是子 agent**：并行/串行均指子 agent 任务的调度，主 agent 不亲自并行操作仓库，只等待结果并汇总；每分配一个子 agent 任务即把该仓库上下文从主 agent 中剥离。
- **仓库分类**：修复前先根据项目规模（依赖数量、是否包含 Nuxt/Electron）分类。
  - 大仓库（依赖 > 500，如 Nuxt/Electron 项目）：**串行执行**，超时 600s。
  - 小仓库（依赖 < 200，纯库/工具包）：可并行 3–4 个，超时 120s。
- **避免全量并行**：Windows 下 5+ 个仓库同时 `pnpm install`（1000+ 包/仓库）极易在 10 分钟内超时，必须分批串行或小批量并行。
- **`--ignore-scripts` 加速**：如果质量门后续会真实执行构建验证，可在 `pnpm install` 时加 `--ignore-scripts` 跳过构建脚本以节省时间。
- **超时不可无限等**：任一仓库 `pnpm install` 超过 10 分钟仍无结果，立即标记为 `blocked`，不要阻塞整个批处理流程。

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
- `<sardir>/scripts/check-ci-status.mjs`：批量检查多个仓库的 GitHub Actions CI 状态，区分 push 触发和 Dependabot 触发的运行，标记待处理的失败。
  ```
  node <sardir>/scripts/check-ci-status.mjs repo1 repo2 repo3
  node <sardir>/scripts/check-ci-status.mjs --owner MyOrg repo1 repo2
  ```
- 可选后端（dependfix-remediator 存在时优先）：`npx dependfix fix --repo <owner>/<repo> --severity-threshold <level>`，单仓库修复与验证；报告在仓库的 `dependfix-reports/`。

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
- 大仓库（Nuxt/Electron）与小仓库无差别并行执行 `pnpm install`，导致所有任务都因超时而失败。
- 添加 override 前不检查项目中是否有测试对依赖版本做断言，提交后 CI 测试阶段才暴露。
- 修改 `minimumReleaseAgeExclude` 后不同步更新 Dockerfile，导致 Docker 构建时报 `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`。
- 推送后只看 Dependabot 自动更新失败（event=dynamic）的邮件通知就认为自己的变更引入了问题，跳过排查就回退。
- 串行处理所有仓库，不考虑使用 sub-agent 并行加速简单组仓库的修复。
- 主 agent 亲自进入每个仓库执行修复细节，导致主上下文膨胀、子 agent 空闲。
- 环境中已存在 dependfix-remediator 技能，仍全部走 `<sardir>` 脚本流程，不使用 dependfix 后端。
- 子 agent 返回后，主 agent 把完整日志/中间输出全量载入上下文，而不是只保留结果摘要。

## 交付前检查

- [ ] 全局告警 JSON 已成功生成，且覆盖了所有符合条件的仓库。
- [ ] 仓库优先级已按 severity 排序，critical 优先于 high。
- [ ] 用户已 review 并确认仓库列表，无未确认的仓库进入修复流程。
- [ ] 逐仓库修复已由子 agent 执行，主 agent 仅保留结果摘要，未亲自进入仓库操作。
- [ ] 已探测 dependfix-remediator：存在时优先使用 dependfix 后端，不存在时明确走 `<sardir>` 回退流程。
- [ ] 每个已修复仓库的质量门（lint / test / build / typecheck）已通过。
- [ ] 每个仓库的修复已独立提交，提交消息符合 Conventional Commit 格式。
- [ ] 所有 commit 均未推送到远程。
- [ ] 已汇总 blocked / skipped 仓库及其原因。
- [ ] 临时告警快照文件已删除。
- [ ] 推送后已检查各仓库的 CI 状态，区分了 "本次变更导致" vs "预存问题" vs "基础设施问题"。
- [ ] 本次变更导致的 CI 失败已全部修复。
