---
name: security-alert-remediator
description: 自动处理 GitHub security alerts 的依赖修复工作流。用户提到 auto fix security alerts、Dependabot alerts、code scanning、pnpm audit、frozen-lockfile、修复依赖漏洞、升级有安全告警的包、按 severity 过滤或优先处理 critical/high 告警时使用。支持从 GITHUB_TOKEN 读取 GitHub alerts，或在无 token 时回退到 pnpm audit；会先检查 Git 仓库是否干净、拉取远端更新、按严重级别和可修复性排序，再逐个依赖升级、修复 frozen-lockfile、执行 lint/test/build 并汇报未解决的 high+ 风险。用户显式要求时，也可启用更严格的过时 pnpm overrides 清理流程。
---

# Security Alert Remediator

铁律：不要在脏工作区里批量升级依赖，也不要把多个无关安全升级塞进同一批修复并跳过验证。

## 工作流

- [ ] Step 1: 做仓库预检 ⚠️ REQUIRED
  - [ ] 1.1 运行 scripts/check-git-preflight.mjs，确认当前仓库干净。
  - [ ] 1.2 若远端存在可快进更新，则先拉取；若已分叉、冲突或存在用户未提交改动，立即停止并让用户先处理。
  - [ ] 1.3 读取 package.json、pnpm-workspace.yaml、锁文件和现有质量门脚本，确认真实可用的 lint/test/build 命令。
- [ ] Step 2: 收集并排序安全告警 ⚠️ REQUIRED
  - [ ] 2.1 运行 scripts/collect-security-alerts.mjs。优先使用 GITHUB_TOKEN 或 GH_TOKEN 拉取 Dependabot / Code Scanning；没有 token 时回退到 pnpm audit 获取依赖告警。
  - [ ] 2.2 按 references/severity-policy.md 的规则决定当前聚焦级别：critical 优先于 high，high 优先于 medium，只有没有更高等级时才下探。
  - [ ] 2.3 拆分出三类对象：可直接升级的 Dependabot 依赖、需要代码修复的 Code Scanning 告警、无法直接升级但仍为 high+ 的遗留项。
- [ ] Step 3: 规划修复批次 ⚠️ REQUIRED
  - [ ] 3.1 默认一次只升级一个依赖。
  - [ ] 3.2 只有在包之间存在明确耦合、peer 约束或顺序依赖时，才允许成组升级。
  - [ ] 3.3 如果要成组升级，必须预先声明会执行完整 lint/test/build；一旦失败，回退到单包策略。
  - [ ] 3.4 overrides 清理默认不启用；只有用户显式要求时，才进入可选的 override-removal 分支。
- [ ] Step 4: 应用依赖升级
  - [ ] 4.1 优先处理造成 critical/high 告警且存在补丁版本的依赖。
  - [ ] 4.2 使用 scripts/update-pnpm-dependency.mjs 执行单包或关联包升级；需要更精确版本时，直接传入 package@version。
  - [ ] 4.3 若遇到 pnpm install --frozen-lockfile 失败，运行 scripts/repair-frozen-lockfile.mjs 修复并验证 lockfile 一致性。
- [ ] Step 5: 验证每个批次 ⚠️ REQUIRED
  - [ ] 5.1 每次升级后至少运行最小充分质量门，优先 lint，其次 test/build/typecheck，具体按项目已有脚本决定。
  - [ ] 5.2 如果升级引入破坏性变更，只允许做小范围、确定性的兼容修复；需要较大重构时，停止该批次并汇报。
  - [ ] 5.3 如果为了修复告警而改动了代码，执行一次 code-reviewer 风格自查，确认没有引入新的正确性或安全问题。
- [ ] Step 6: 安排提交节奏
  - [ ] 6.1 如果后续某个依赖升级变成破坏性更新，先把之前已经验证通过的安全升级单独提交。
  - [ ] 6.2 如果全部可修复依赖都已完成，再执行一次完整验证，然后根据变更边界决定总提交还是分批提交。
- [ ] Step 7: 汇报未解决项
  - [ ] 7.1 单独列出无法直接升级的 high+ 依赖告警，包含包名、严重级别、来源、缺失补丁或阻塞原因。
  - [ ] 7.2 单独列出需要人工代码修复的 Code Scanning 告警，不把它们伪装成依赖升级问题。

## Optional Override Cleanup

- 这个分支默认关闭，只有用户明确要求“评估或移除某个 pnpm override”时才启用。
- override 清理不是常规提速动作，而是对临时缓解措施做回收；验证强度必须高于新增 override。
- 只有当相关直接依赖已经升级、或有充分理由怀疑某个 override 已经失效时，才评估移除。
- 默认一次只移除一个 override selector；只有多个 selector 明确指向同一目标包且用户同意时，才允许成组清理。
- 使用 scripts/remove-pnpm-override.mjs 做机械化移除，并要求保留移除前后告警快照用于对比。
- 移除后必须执行完整质量门，不允许只凭 lockfile 变化就判定清理成功。

## Step 1: 仓库预检

- 运行 scripts/check-git-preflight.mjs。
- 如果脚本返回 dirty、diverged 或 pull-failed，直接停止，不要在当前工作区继续自动修复。
- 如果仓库不是 pnpm 项目，或缺少 package.json / pnpm-lock.yaml，需要先和用户确认是否仍按该技能继续。

## Step 2: 告警采集

- 运行 scripts/collect-security-alerts.mjs --output-json <path>。
- 读取输出中的 focusSeverity、packageCandidates、manualCodeScanning 和 unfixableHighDependencyAlerts。
- 只有在当前没有 high+ 告警时，才把 medium 告警纳入本轮修复范围。
- Code Scanning 默认只做分类和定位；只有定位清晰、修改面很小且能快速验证时，才自动改代码。

## Step 3: 批次规划

- 加载 references/severity-policy.md，决定当前轮次应该聚焦的最低严重级别。
- 加载 references/remediation-playbook.md，判断哪些包必须一起升级、哪些必须拆开。
- 同级别依赖不强制排序，但有关联的依赖必须放在同一决策里，按先后关系执行。

## Step 4: 升级执行

- 单包升级示例：node scripts/update-pnpm-dependency.mjs lodash
- 指定版本示例：node scripts/update-pnpm-dependency.mjs undici@7.16.0
- 关联包升级示例：node scripts/update-pnpm-dependency.mjs react react-dom
- 如果只是 lockfile 与 package.json 脱节，先运行 node scripts/repair-frozen-lockfile.mjs，再决定是否继续升级。

## Optional Override Cleanup: 执行与放行

- 先加载 references/remediation-playbook.md 中的 override 清理规则，再决定是否值得尝试移除。
- 精确移除单个 selector：node scripts/remove-pnpm-override.mjs lodash
- 按包名移除同一叶子包的多个 selector：node scripts/remove-pnpm-override.mjs picomatch --by-package true
- 默认会执行安装、frozen 校验和前后告警快照对比；只有用户明确要求人工接管时，才允许关闭其中任一项。
- 如果移除后重新引入目标包告警，或新增达到阈值的依赖告警，立即停止并回滚本次清理。
- 无论脚本是否通过，仍然需要补跑仓库真实存在的 lint/test/build/typecheck 质量门。

## Step 5: 验证与放行

- 快速验证优先使用项目现有的 lint、test、build、typecheck 脚本，不要臆造命令。
- 单包升级默认跑最小充分检查；多包升级、major 升级或伴随代码修复时，升级为完整检查。
- 如果失败原因来自上游依赖缺陷、peer 约束或不可接受的 API 破坏，保留证据并停止该批次。

## 可用脚本

- scripts/check-git-preflight.mjs：检查 Git 工作区是否干净、是否落后远端，并尝试安全的 fast-forward 拉取。
- scripts/collect-security-alerts.mjs：聚合 Dependabot、Code Scanning 和 pnpm audit fallback，输出当前优先级和候选依赖。
- scripts/remove-pnpm-override.mjs：在显式启用时移除一个或一组 pnpm override，并用前后告警快照、防回归比较和 lockfile 校验保护这次清理。
- scripts/update-pnpm-dependency.mjs：执行 pnpm up，并在需要时补做非 frozen 安装与 frozen 校验。
- scripts/repair-frozen-lockfile.mjs：自动修复 pnpm install --frozen-lockfile 失败导致的锁文件不同步问题。

## 反模式

- 在存在用户未提交改动时直接开始升级依赖。
- 因为告警很多，就一次升级所有可疑依赖。
- 没有用户显式要求，就顺手批量移除 overrides。
- 在相关直接依赖尚未追上前，就把 override 当成“看起来没用了”而直接删掉。
- 把 Code Scanning 告警错误地当成依赖升级就能解决的问题。
- 明明没有补丁版本，仍然机械地反复执行升级命令。
- 升级后只看 lockfile 变化，不跑任何质量门。
- 为了消除告警而接受大范围破坏性重构，却不单独评估收益和风险。

## 交付前检查

- [ ] 已确认工作区干净，且远端更新已同步或明确说明阻塞原因。
- [ ] 已按严重级别和可修复性排序，而不是平铺处理所有告警。
- [ ] 默认保持单依赖批次；多依赖批次已说明关联性和额外验证范围。
- [ ] 如启用 override 清理，已明确这是用户显式要求的可选分支，并保留了移除前后的告警对比结果。
- [ ] 每个已升级批次都执行了真实存在的质量门。
- [ ] 代码改动已做最小自查，未把破坏性大改混进安全升级里。
- [ ] 无法直接修复的 high+ 告警已单独列出并反馈给用户。
