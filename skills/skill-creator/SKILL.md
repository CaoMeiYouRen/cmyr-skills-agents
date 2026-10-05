---
name: skill-creator
description: 创建、翻译、重构、评审、封装、评测和优化技能时使用。只要用户提到 create skill、build skill、new skill、write SKILL.md、improve skill、refactor skill、package skill、benchmark skill、trigger tuning、description optimization、run skill evals、skill workflow 或要把现有经验沉淀为技能，都应优先使用本技能。它同时负责技能设计流程、长文本拆分策略、评测工具链与触发优化。

metadata:
  internal: false
---

# Skill Creator

铁律：不要再维护第二套技能创建规范。skill-creator 就是唯一的技能设计、重构、评测与打包入口。

## 工作流

- [ ] Step 1: 明确技能目标 ⚠️ REQUIRED
  - [ ] 1.1 提炼用户真正要沉淀的能力边界、触发语句和输出类型。
  - [ ] 1.2 至少收集 3 个真实使用场景，优先从当前对话、历史技能或 git diff 中提取。
  - [ ] 1.3 如果需求本质上是在创建角色、上下文隔离流程或治理型编排者，转交 agent-creator，而不是继续创建 skill。
- [ ] Step 2: 审计现状与文本资产 ⚠️ REQUIRED
  - [ ] 2.1 如果是改造现有技能，先比对 git diff 或提交历史，找出被删掉但仍有价值的规则、示例、术语和资源引用。
  - [ ] 2.2 决定哪些内容保留在主 SKILL.md，哪些拆进 references/，哪些下沉到 scripts/。
- [ ] Step 3: 设计技能架构 ⚠️ REQUIRED
  - [ ] 3.1 先决定 description、铁律、工作流、确认门、反模式和交付前检查。
  - [ ] 3.2 再决定是否需要参数系统、eval、benchmark 和 viewer。
  - [ ] 3.3 判断是否需要 `references/rationale.md`：高复用、有设计债或容易被误删的技能必须补，按 [rationale-template.md](./references/rationale-template.md) 写；一次性、纯粹能力替代型的技能可以省略，并在正文说明省略理由。
  - [ ] 3.4 标出项目覆盖锚点：把项目可变参数（阈值、路径、门禁）从正文剥离为默认值，声明覆盖读取位置与优先级。
- [ ] Step 4: 编写触发面
  - [ ] 4.1 先写 description，覆盖真实触发语句和近义表达。
  - [ ] 4.2 所有 when-to-use 信息都放在 description，不放在正文。
- [ ] Step 5: 编写 SKILL.md 主体 ⚠️ REQUIRED
  - [ ] 5.1 保持正文精炼，只保留骨架与关键约束。
  - [ ] 5.2 长清单、案例、技巧说明和 schema 拆到 references/。
- [ ] Step 6: 构建资源
  - [ ] 6.1 确定性、可复用操作写入 scripts/。
  - [ ] 6.2 设计方法、长清单和格式定义写入 references/。
  - [ ] 6.3 模板或评审页面等输出资源写入 assets/ 或 eval-viewer/。
- [ ] Step 7: 选择评测模式 (conditional)
  - [ ] 7.1 简单改动可只做人工 review。
  - [ ] 7.2 复杂技能用 references/schemas.md、scripts/run_eval.mjs、scripts/aggregate_benchmark.mjs、scripts/run_loop.mjs 和 eval-viewer/generate_review.mjs 做评测与触发优化。
- [ ] Step 8: 打包与收口 ⚠️ REQUIRED
  - [ ] 8.1 使用 scripts/quick_validate.mjs 做快速结构检查。
  - [ ] 8.2 需要新建技能时，使用 scripts/init_skill.mjs 初始化骨架。
  - [ ] 8.3 需要交付时，使用 scripts/package_skill.mjs 打包。
  - [ ] 8.4 总结保留、迁移、删除和兼容策略。

## 本目录资源

- references/skill-design-overview.md：快速理解技能设计的 12 个核心技巧。
- references/description-guide.md：写 description 前加载。
- references/workflow-patterns.md：设计工作流、确认门和交付检查时加载。
- references/writing-techniques.md：写铁律、问题式指令和反模式时加载。
- references/output-patterns.md：设计输出模板与交付清单时加载。
- references/parameter-system.md：需要参数系统时加载。
- references/architecture-guide.md：规划 references/、scripts/、assets/ 分层时加载。
- references/rationale-template.md：编写 `references/rationale.md` 时加载。
- references/schemas.md：编写 evals、grading 和 benchmark 数据时加载。
- scripts/init_skill.mjs：初始化技能骨架。
- scripts/quick_validate.mjs：快速校验 frontmatter 与目录结构。
- scripts/package_skill.mjs：打包技能。
- scripts/run_eval.mjs、scripts/aggregate_benchmark.mjs、scripts/run_loop.mjs：评测、聚合和触发优化。
- agents/analyzer.md、agents/grader.md、agents/comparator.md：做 benchmark 分析、断言评分和盲测时加载。

## 正文与 references 的拆分原则

- 放在 SKILL.md：铁律、工作流主干、确认门、反模式、交付前检查。
- 放在 references/：长清单、案例、设计理论、schema、评测说明、`rationale.md`。
- 放在 scripts/：确定性、重复性高且值得节省 token 的操作。

## Why 层与项目覆盖层（治理约定）

技能内容按**读者**分四层，读者决定信息，而不是篇幅：

| 层 | 载体 | 读者 | 加载时机 |
| :--- | :--- | :--- | :--- |
| 触发面 | `frontmatter.description` | 调度器 | 每次 |
| 执行层（what/how） | `SKILL.md` 正文 | 执行者 | 每次 |
| Why 层 | `references/rationale.md` | 维护者 | 仅重构 / 合并 / 降级 / 删除时 |
| 项目覆盖层 | 项目 `AGENTS.md`（数据多时链到 `docs/standards/*`） | 项目 | 按需 |

- **Why 层**回答：为什么存在、依赖哪些假设、何时应删除、哪些内容会随模型变强而冗余。它不参与触发，也不出现在执行路径上。
- **项目覆盖层**只承载可变参数（阈值、路径、门禁、输出格式），默认读项目 `AGENTS.md`；优先级固定为「技能默认 < 项目覆盖 < 会话覆盖」，无覆盖时用技能默认值。
- **单一事实源**：项目规范不在技能里双写，技能用一行锚点引用；项目规范与技能冲突时以项目规范为准。
- **存在性判据**：技能的存在理由消失（场景不再存在、能力已被模型或自动化门禁覆盖）时，应进入弃用或删除，而不是以"以后可能用得上"长期保留。

## 设计原则

- 不要让正文变成第二份 README。
- 不要为了追求完整度把所有内容塞回 SKILL.md。
- 不要只做骨架改写而丢掉原技能里的项目特化规则。
- 不要把 benchmark 当成所有技能的必选项。
- 当需求本质是 agent 时，不要硬塞进 skill-creator 处理。
- 不要把"为什么"内联进 SKILL.md，也不要把项目阈值、路径硬编码进正文。

## 反模式

- 不比对旧版本文本，直接用新模板覆盖一切。
- 同时保留两个 canonical skill，造成职责分叉。
- 只保留抽象流程，不保留有价值的具体规则和术语。
- 只看 benchmark 分数，不看真实输出和用户反馈。

## 交付前检查

- [ ] 已通过 git diff 或历史版本比对回收有价值的旧文本。
- [ ] description 已覆盖触发场景和真实语句。
- [ ] 正文只保留骨架，长文本已合理拆入 references/。
- [ ] 高复用、高设计债或易被误删的技能，已补 `references/rationale.md`，并写明失效判据。
- [ ] 项目可变参数已剥离为默认值，覆盖位置与「默认 < 项目 < 会话」优先级已声明。
- [ ] 如运行 eval，JSON schema 与目录结构已对齐。
- [ ] benchmark 结果已和真实输出一起分析，而不是只看分数。
- [ ] 当前目录就是唯一 canonical skill 入口。
