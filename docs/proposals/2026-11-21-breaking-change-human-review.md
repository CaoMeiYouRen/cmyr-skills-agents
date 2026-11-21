# 提案：破坏性提交人工审查

> 能力：—（规则类约定；采纳后只落在 `conventional-committer`，不登记为独立能力）
> 发起：2026-11-21 ｜ 状态：草案（未通知，待用户授权）
> 审查：2026-11-21 通过（blocker 0 / warning 0 / suggest 3；三轮独立复核，前两轮共 12 项 blocker、16 项 warning 全部关闭，见 §8）
> 注：§2 为 2026-11-21 的本机快照，行号、提交计数与工具链行为以当日检出为准。

## 1 变更摘要

在破坏性提交（Conventional Commits 的 `!` 头部或 `BREAKING CHANGE:` footer）进入本地历史**之前**，增加一道**人工审查**：由项目所有者（或其明确授权的人）确认破坏性语义、影响面与迁移说明，并把确认结果以固定 footer 写进提交消息。AI 的 Review Gate 与作者自检都不替代这道确认。

- 上游（本提案通过后新增）：`skills/conventional-committer/SKILL.md` 增硬性要求与工作流步骤。规则只写这一处，`standards/gates.md` 不加章节（一条规则只写一次，见 `standards/README.md` §3）。
- 项目侧：提交规范所在小节、`.husky/commit-msg` 机检（可选）、PR 模板（squash 合并场景）。

三条原则：

1. **提交前确认**：确认发生在 `git commit` 之前，审查对象是最终 diff 与最终提交消息；确认后内容有变即重新确认。
2. **记录形态统一**：`BREAKING CHANGE:` footer 是跨工具链唯一稳定的识别形态；`!` 只是意图表达，各发布链对它的处理并不一致（见 §2.2），因此不承担识别职责。
3. **记录随提交走**：确认结果写进提交消息（`Breaking-Review:`），不依赖会话记录、PR 评论或外部台账；squash 合并时由合并者负责把它带进落库消息。

## 2 背景与证据

### 2.1 现状：四个项目都没有破坏性提交的专门门槛

可复现检查（在各项目根目录执行，计数口径见下方表格说明）：

```bash
# 头部 `!`（输出行数应等于表中 `!` 列）
git log master --format='%h %ad %s' --date=short | grep -E '^[0-9a-f]+ [0-9-]+ [a-zA-Z]+(\([^)]*\))?!:'
# footer（提案 §3.1 的识别口径）
git log master --format=%B | grep -c '^BREAKING CHANGE:'
```

读数快照（2026-11-21，分支 `master`）：

| 项目 | footer 提交 | `!` 头部提交 | 标记形态 | 专门门槛 | 现有 review 前置 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| dependfix | 4 | 3 | 3 笔 `!`+footer；1 笔 footer-only（`7a915018`） | 无 | `docs/standards/git.md:15`「任何改动进入 commit 前必须经过至少一轮 review」 |
| momei | 0 | 0 | —（3 处 `BREAKING CHANGE` 命中均为正文叙述，非 footer） | 无 | `docs/standards/git.md:59`（§3 合并与集成）同上 |
| caomei-ui | 2 | 2 | 2 笔 `!`+footer | 无 | `docs/standards/git.md:21`「确认 Review Gate 已放行」 |
| caomei-auth | 0 | 0 | — | 无 | `docs/standards/git.md:18` 同上 |

「现有 review 前置」全部是 AI / Review Gate 口径（dependfix、caomei-auth 由 §3 质量前置指向 A 阶段 `Code Auditor`，caomei-ui 写作 `@code-reviewer`）；没有任何位置要求**人**确认破坏性语义。即破坏性提交与普通 fix 走同一条门禁。

补充：momei 的提交规范主体不在 `git.md`，而在 `docs/standards/development.md:261`（§2.7 提交规范）与 `AGENTS.md:148`（§7.4）；`git.md` §3 只是合并与集成里的 review 前置。

### 2.2 工具链对破坏性标记的识别不一致

| 事实 | 证据（2026-11-21 实测） |
| :--- | :--- |
| cmyr 预设的 `headerPattern` 不含 `!` | `conventional-changelog-cmyr-config/src/parser.ts:11` 为 `/^(\w*)(?:\((.*)\))?: (.*)$/` |
| 未打补丁时 `type(scope)!:` 提交整条不进 changelog | dependfix 3 笔 `!` 提交（`81f7b11d`、`31334ab2`、`b33746f4`）在 `CHANGELOG.md` 中均无条目——其中前两笔已被 0.5.0 / 0.6.0 包含，`b33746f4` 尚未发布；同期 footer-only 的 `7a915018` 出现在 0.6.0「📦 代码重构」组 |
| caomei-ui 已自行打补丁绕开 | `scripts/release/generate-changelog.mjs:117-118` 注释「预置 headerPattern 不含 `!`……整条丢弃；补 `!?`」；`a869b8f7` 出现在 0.2.0「✨ 新功能」组、`4dd97147` 出现在 0.1.0「📦 代码重构」组，两者的 footer 均进入对应版本的「💥 BREAKING CHANGES」段 |
| 版本影响逐项目不同：dependfix 自研计划显式识别 `!` 与 footer，0.x 阶段只升 minor | `scripts/create-release-plan.mjs:7`、`:51-55`（preMajor 与 engines-only 两种降级） |
| semantic-release + cmyr 预设实测：footer → major；纯 `!` 无 footer → 不触发 | `src/release-pipeline.spec.ts:62-66`；本机用同一 analyzer 复现：`feat!: x` → null，`feat(api)!: x` + footer → major |
| 连字符 `BREAKING-CHANGE:` 不被识别 | `parser.ts:17` 的 `noteKeywords` 只有空格形式 |
| `Breaking-Review:` 放在 `BREAKING CHANGE:` 之后会被并入 note 文本 | 用 semantic-release 实际依赖的 conventional-commits-parser 6.4.0 实测：note.text 变成两行，污染发布说明（7.x 行为不同，故本提案按 6.x 写） |

结论：同一种「破坏性意图」在四个项目、三条发布链上得到三种结果——不进日志但升版本（dependfix 自研计划的 `!` 提交）、打补丁后既升版本又进日志（caomei-ui）、纯 `!` 完全不触发（momei / caomei-auth 共用的 semantic-release + cmyr 预设）。而三条链都没有在提交前把这件事交给人决定。

### 2.3 机检现状

四个项目的 `.husky/commit-msg` 都只有 `commitlint --edit "$1"`，没有与破坏性标记相关的判断。`pre-commit` 分别是：dependfix = identity-guard + lint-staged；momei / caomei-auth = lint-staged；caomei-ui = review-gate 工件新鲜度 + 暂存区卫生 + lint-staged。机检落点明确，但规则不存在。

与本仓库既有能力的关系：`capabilities/registry.json` 无提交类能力；`standards/gates.md` 只覆盖验证与发布前安全门禁；`skills/conventional-committer` 只规定消息格式与拆分，完全未提破坏性提交。本提案不与它们重复。

## 3 建议改动

### 3.1 判定口径

- **触发**（满足任一即视为破坏性提交，需人工确认）：头部含 `!`；消息含 `BREAKING CHANGE:` footer。
- **记录落点**：确认结果写 `Breaking-Review:` footer，破坏面与迁移写 `BREAKING CHANGE:` footer；两者同在 footer 区且前者在前。只因 `!` 就认为「已经表达了破坏性」不成立（§2.2）。
- **非触发但须补标**：改动实际破坏公共契约（导出、协议、配置项、数据格式）却未打标记的，由 A 阶段或人工审查发现后补 footer 再提交；不得为强调而给 `chore` / `docs` 等内部改动标 `!`。
- **禁用**连字符 `BREAKING-CHANGE:`（工具链不识别）。
- **0.x 阶段同样适用**：是否做人工确认与版本号无关；具体升 minor 还是 major 由项目发布链决定（dependfix preMajor 升 minor），本规则不介入。

### 3.2 审查与记录

提交消息格式（`Breaking-Review:` 必须在 `BREAKING CHANGE:` **之前**，否则会被并入 note 文本）：

```text
<type>(<scope>): <主题>

- 正文说明改了什么、为什么

Breaking-Review: <确认人标识> <YYYY-MM-DD> <approved|approved-with-migration>
BREAKING CHANGE: <破坏面与迁移方式，一段话>
```

| 项 | 要求 |
| :--- | :--- |
| 时机 | `git add` 之后、`git commit` 之前；审查对象 = 最终树 + 最终提交消息 |
| 主体 | 项目所有者或用户明确授权的人；AI 自查与 A 阶段 Review Gate 不算 |
| 结论 | `approved` / `approved-with-migration`；后者须在正文或项目文档给出迁移路径 |
| 标识 | 单个 token，无空格（默认 `owner`，也可用 GitHub 用户名或无空格姓名标识），公开仓库需权衡隐私 |
| 重确认 | 「内容」= 提交树 + 提交消息文本（`Breaking-Review:` 行本身不计入比较）；二者任一变化即重新确认；amend / rebase 后二者均未变可沿用 |
| 可选用法 | 结论后可追加 `@<短哈希>` 指向被确认的树；机检只校验该后缀格式，不校验哈希是否对应被确认的树 |
| 合并 | squash / rebase merge 时，落库消息必须含该记录；本地确认不随 squash 传递，由合并者核对。无法保证时须声明该场景不在覆盖范围 |
| revert | 保留原提交与记录，不回补、不删除；revert 提交本身不含破坏性标记时无需记录 |
| 历史 | 已推送提交保留原记录；改写未推送历史按「重确认」判定 |

示例（按 dependfix `7a915018` 改写，仅示意格式；原提交不含 `Breaking-Review:` 行）：

```text
refactor(engine): 锁文件修复调用方适配异步签名

- tryLockfileRepair 改为异步，收尾管线同步 await

Breaking-Review: owner 2026-10-17 approved
BREAKING CHANGE: @dependfix/engine 的 tryLockfileRepair 由同步改为异步（返回 Promise）。
```

### 3.3 机检

| 规则 | 判定 | 分档 |
| :--- | :--- | :--- |
| 有破坏性标记但无 `Breaking-Review:` | exit ≠ 0 | 启用机检的项目必须 |
| `Breaking-Review:` 不匹配 `^\S+ \d{4}-\d{2}-\d{2} (approved\|approved-with-migration)(\s+@[0-9a-f]{7,40})?$` | exit ≠ 0 | 必须 |
| `Breaking-Review:` 出现在第一个 `BREAKING CHANGE:` 之后 | exit ≠ 0 | 必须 |
| 含 `!` 但无 `BREAKING CHANGE:` footer | exit ≠ 0 | 必须（否则「批准」与「发布语义」脱钩） |
| 出现 `BREAKING-CHANGE:` | exit ≠ 0 | 必须 |
| `BREAKING CHANGE:` 文本为空 | exit ≠ 0 | 必须 |

落点：`commit-msg` hook（与既有 commitlint 同钩子追加一段）或 CI PR 检查；两者都做更稳（hook 可被本地绕过，CI 只覆盖推送后）。

机检只能验证「记录存在且格式合法」，**不能验证「人真的看过」，也不能验证 `approved-with-migration` 是否真给了迁移路径**；这两项靠审查记录与会话记录人工核对，属于已知边界。

### 3.4 按项目分档

| 项目 | 分档 | 落点 | 成本 |
| :--- | :--- | :--- | :--- |
| dependfix | **必须** | `docs/standards/git.md` §3 增条目；`commit-msg` 机检 | 低（自研发布计划已读 footer） |
| caomei-ui | **必须** | `docs/standards/git.md` §2（消息格式）+ §3（流程）增条目；机检接入既有 governance 脚本栈；`!?` 补丁保留 | 低 |
| momei | **建议** | `docs/standards/development.md` §2.7 与 `AGENTS.md` §7.4 增一条；先落人工纪律，机检后置 | 极低 |
| caomei-auth | **建议** | `docs/standards/git.md` §3 增条目；同上 | 极低 |

理由：dependfix 与 caomei-ui 产出公开消费物（npm 包、镜像），破坏性变更直接改变下游可解析版本；momei 与 caomei-auth 是应用，版本号不对外承诺，但破坏性改动同样改变线上行为。历史证据见 §2.1。

## 4 需要项目 agent 研判的问题

1. 确认人标识取值与隐私取舍（`owner` / GitHub 用户名 / 无空格姓名标识）。
2. 是否需要第四种结论（如「同意但延后到下一窗口」），以及它与「先不提交」的边界。
3. 机检落点：`commit-msg` / CI / 两者。
4. 破坏性提交是否一律独立成批（上游建议是：混批会让回滚粒度与版本语义错位）。
5. 合并策略：squash merge 的仓库（momei、caomei-auth 均以 PR 收口）如何把记录带进落库消息——PR 模板强制字段、合并时手工补写，或明确排除该场景。
6. 机器人 PR（Dependabot / dependfix）出现在自动合并路径上的破坏性升级如何处置（阻断自动合并转人工 / 另案）。人工发起的依赖升级破坏性提交（dependfix 2 笔 `build(deps)!`）按本提案需要确认。

## 5 验收标准

- [ ] 项目提交规范所在小节（`git.md` / `development.md` / `AGENTS.md`）含「破坏性提交需人工审查」条目，写明时机、主体、记录格式与重确认条件。
- [ ] 破坏性提交消息同时含 `Breaking-Review:` 与 `BREAKING CHANGE:`，且前者在前。
- [ ] `git log -1 --format=%B` 能直接读出确认人、日期与结论。
- [ ] 启用机检的项目：缺记录 exit ≠ 0；位置错误 exit ≠ 0；`!` 无 footer exit ≠ 0；合法消息 exit 0。
- [ ] 连字符 `BREAKING-CHANGE:` 被机检拒绝，或规范明令禁用并有评审记录。
- [ ] squash 合并的仓库：落库消息含记录，或规范写明该场景的处理方式。
- [ ] 历史提交不回补记录，不被本条追溯。
- [ ] 失败判据：破坏性提交无审查记录、审查行被并入 `BREAKING CHANGE` 文本、`!` 无 footer 却放行、`approved-with-migration` 未给迁移路径——任一出现即判未达标。

## 6 回滚

回滚需要指名对象，三类分别执行：

1. **规范**：revert 各项目提交规范小节的条目提交，回到「只有通用 review 前置」的状态；已带记录的历史提交不回改。
2. **机检**：先降为 warning 一个发布周期（按项目自己的发布节奏，无发布节奏的按 30 天），再移除 `commit-msg` 钩子；移除后对一笔历史破坏性提交重放消息，确认 exit 0 且无警告。
3. **记录**：`Breaking-Review:` 历史条目保留，不批量清洗。

不通过 reset / rebase 回退已推送历史。

## 7 本项目不做什么

- 不替项目决定确认人、标识形态、机检落点与结论枚举。
- 不提供脚本或 hook 实现，不贴补丁。
- 不改 `conventional-changelog-cmyr-config` / `semantic-release-cmyr-config`；`!` 头部不匹配 `headerPattern` 是独立缺陷，另案处理，跟踪条件是「headerPattern 支持 `!` 后本提案哪些条款可简化」。
- 不改变 A 阶段 Review Gate 定义；人工确认是额外一道，不能替代审计。
- 不要求历史提交补记录，不追溯已发布版本。
- 不改变机器人 PR 的合并路径；该场景作为 §4 问题 6 单列，不在本提案强制范围内。

## 8 提交前优化审查记录

### 8.1 作者自检（2026-11-21）

- [x] **单一目的**：只解决「破坏性提交缺人工确认 + 标记形态不统一」，不涉及版本策略与发布链改造。
- [x] **无重复**：与既有 6 份提案、`capabilities/registry.json` 7 项能力、`standards/gates.md`、`conventional-committer` 逐项比对，无等价条目。
- [x] **证据可复现**：提交计数、`parser.ts` / `release-pipeline.spec.ts` 行号、三条发布链行为、`commit-msg` 现状均可按 §2 命令复算。
- [x] **按项目分档**：四个受影响项目均有必须 / 建议与落点、成本。
- [x] **边界清楚**：不提供实现、不改工具链、不追溯历史、不覆盖机器人 PR。
- [x] **验收可判定**：8 条可勾选，末条给出四种失败判据。
- [x] **回滚可执行**：按规范 / 机检 / 记录三类指名对象与验证方式。
- [x] **正文自包含**：issue 正文只需带 §1–§7，脱离上游仓库可读。
- [x] **易变信息标日期**：提交计数、行号、parser 版本（6.4.0）均标 2026-11-21。

### 8.2 独立复核（2026-11-21）

复核方式：另一个 agent 只读核验，逐条复跑 §2 命令并核对行号、CHANGELOG 归属与 parser 行为。

首轮结论：**不通过**。7 项 blocker 全部成立并已修复：

| # | blocker | 处置 |
| :--- | :--- | :--- |
| B1 | dependfix 按 footer 应为 4 笔而非 3 笔，且漏掉 footer-only 的 `7a915018`；原命令混入正文叙述 | §2.1 改为 footer / `!` 双列计数，命令只匹配头部 `!:` 与 footer（第二轮发现该正则仍写成 `!?:`，已订正，见 8.3） |
| B2 | `a869b8f7` 不在 0.1.0（实为 v0.2.0~29），且 caomei-ui 已补 `headerPattern` | 改用 dependfix 的缺失条目 + caomei-ui 的补丁注释作为证据 |
| B3 | 「`!` 不触发发布」不成立：dependfix 自研计划认 `!`，版本会升但提交从 changelog 消失 | §2.2 改为「不进日志但升版本」，并补 caomei-ui 与 semantic-release 两种路径 |
| B4 | 「`!` 无 footer 只 warning」与「含 `!` 即触发」不自洽，会放行「已批准但发布说明无破坏面」 | 机检表改为 exit ≠ 0 |
| B5 | momei 无「git.md 提交规范」小节，验收项对其不可判定 | 落点改为 `development.md` §2.7 + `AGENTS.md` §7.4，验收改为「提交规范所在小节」 |
| B6 | 同一条规则同时落 `gates.md` 与 `conventional-committer`，违反单点 | §1 改为只落 `conventional-committer`，`gates.md` 不加章节 |
| B7 | amend「必须重新确认」与「内容不变可沿用」互相否定 | 定义「内容」= 树 + 消息文本，二者任一变化才重确认 |

warning 处置（10 项，均已改文或写明理由）：

1. `Breaking-Review` 位置结论依赖 parser 版本 → 标注 6.4.0 与核验日期，并说明 7.x 行为不同。
2. `release-pipeline.spec.ts` 行号偏差 → 订正为 62-66。
3. 机检缺「位置」规则 → 已加（exit ≠ 0）。
4. 未覆盖 squash merge → §3.2 增「合并」行，§4 增问题 5，§5 增验收项。
5. 标识格式与正则冲突 → 限定为单 token。
6. 回滚对象与「一个发布周期」不可判定 → §6 按三类指名对象，并给无发布节奏项目的 30 天口径。
7. 机器人 PR 与 §4 依存升级问题冲突 → §4 问题 6 与 §7 边界改为一致表述。
8. 0.x 时 footer 不一定升 major → §2.2 与 §3.1 写明由项目发布链决定。
9. §2.3「分别是」表述不精确 → 已按项目逐一列明。
10. 头部与 §8 未填 → 本轮补齐。

suggest（6 项，记录不阻塞）：

1. 允许 `@<短哈希>` 固化被确认的树 —— 已作为可选写法纳入 §3.2。
2. 机检边界补齐「迁移路径无法验证」 —— 已写入 §3.3。
3. 写明 revert 语义 —— 已写入 §3.2。
4. 给工具链缺陷写跟踪条件 —— 已写入 §7。
5. 注明 review 前置是 AI 口径 —— 已写入 §2.1。
6. 示例换真实提交 —— 已改用 `7a915018`，并标注为示意改写。

### 8.3 第二轮独立复核（2026-11-21）

复核结论：B2–B7 与 W1–W9 已关闭；B1 未真正关闭（正则写成 `!?:`，`!` 变为可选，匹配到全部 conventional 提交），并新增 3 处内部矛盾与 1 处事实错误。处置如下：

| # | 问题 | 处置 |
| :--- | :--- | :--- |
| NB1 | `!?:` 使 `!` 可选，命令匹配全部提交 | 改为 `(\([^)]*\))?!:`，并注明「输出行数应等于表中 `!` 列」 |
| NB2 | `4dd97147` 不在 0.1.0 新功能组，而在代码重构组 | 订正为「0.2.0 新功能组 / 0.1.0 代码重构组」 |
| NB3 | §3.1 写成把确认结果放进 `BREAKING CHANGE:`，与 §3.2 矛盾 | 改为「确认写 `Breaking-Review:`、破坏面写 `BREAKING CHANGE:`，同区且前者在前」 |
| NB4 | 可选 `@<短哈希>` 会被强制正则拒绝 | 正则补 `(\\s+@[0-9a-f]{7,40})?$` |
| NB5 | 头部与 §8.2 提前断言「通过」 | 待第三轮复核确认后写入最终结论；本节记录全部轮次 |
| W-A/W-B | momei 的 `git.md:59` 属 §3 非 §4；dependfix 的 `Code Auditor` 在 §3 而非 L15 | 已订正节号与出处 |
| W-C | `b33746f4` 尚未发布，缺失属预期 | 已在 §2.2 注明「其中前两笔已被 0.5.0 / 0.6.0 包含」 |
| W-D | 示例与 `7a915018` 原文不符 | 已标注「按 `7a915018` 改写，仅示意格式」 |
| W-E | 「独立成批」既是必须动作又是待研判问题 | 从 §3.4 移除，保留为 §4 问题 4 |
| W-F | 「内容 = 树 + 消息文本」读起来自指 | 已补「`Breaking-Review:` 行本身不计入比较」 |

suggest 处置：改为「四个项目、三条链路」；验收 #1 补 `AGENTS.md`；多 footer 语义改为「第一个 `BREAKING CHANGE:` 之前」。

### 8.4 第三轮复核（2026-11-21）

结论：blocker 0 / warning 0 / suggest 3。suggest 为「头部补全轮次数字」「§8.4 补计数」「§3.2 的短哈希措辞」，均已按建议修订。

<!-- proposal-status:start -->
## 项目研判结论（自动生成）

> 数据源 `docs/proposals/status.json`；由 `node scripts/check-proposals.mjs --write` 生成，请勿手工编辑。

| 项目 | 结论 | 日期 | 依据 |
| :--- | :--- | :--- | :--- |
| dependfix | 待研判 | — | — |
| momei | 待研判 | — | — |
| caomei-ui | 待研判 | — | — |
| caomei-auth | 待研判 | — | — |
<!-- proposal-status:end -->
