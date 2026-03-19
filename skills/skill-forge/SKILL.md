---
name: skill-forge
description: 设计、创建、翻译、重构、评审、封装、评测和优化技能时使用。只要用户提到 create skill、build skill、new skill、write SKILL.md、improve skill、refactor skill、package skill、benchmark skill、trigger tuning、description optimization、evals、skill workflow 或要把现有经验沉淀为技能，都应优先使用本技能。它统一了 skill-forge 的结构设计方法与 skill-creator 的评测迭代工具链。
---

# Skill Forge

铁律：不要再产出只有 Capabilities、Instructions、Usage Example 的旧模板技能。技能必须同时具备可触发的 description、可执行的工作流、必要的确认门、反模式和交付前检查。

## 工作流

- [ ] Step 1: 明确技能目标 ⚠️ REQUIRED
  - [ ] 1.1 提炼用户真正要沉淀的能力边界。
  - [ ] 1.2 收集至少 3 个真实触发示例，优先从当前对话或现有技能中提取。
  - [ ] 1.3 明确输出是什么，哪些内容必须稳定、哪些允许自由发挥。
- [ ] Step 2: 盘点现状
  - [ ] 2.1 如果是改造已有技能，先审计 SKILL.md、scripts/、references/、assets/。
  - [ ] 2.2 区分应该保留、迁移、删除和兼容保留的旧内容。
- [ ] Step 3: 设计技能架构 ⚠️ REQUIRED
  - [ ] 3.1 决定哪些规则留在 SKILL.md，哪些拆到 references/。
  - [ ] 3.2 决定哪些操作值得做成 scripts/，哪些只保留为流程指引。
  - [ ] 3.3 如果需要参数系统，先定义参数，再写正文。
- [ ] Step 4: 编写触发面
  - [ ] 4.1 先写 frontmatter 的 description，用关键词覆盖真实触发语句。
  - [ ] 4.2 所有 when-to-use 信息都放进 description，不放在正文里。
- [ ] Step 5: 编写 SKILL.md 主体 ⚠️ REQUIRED
  - [ ] 5.1 先写铁律，阻止该技能最常见的错误。
  - [ ] 5.2 再写可跟踪的工作流清单，标注 ⚠️ REQUIRED 或 ⛔ BLOCKING。
  - [ ] 5.3 在 destructive 或高成本步骤前加入确认门。
  - [ ] 5.4 补上反模式与交付前检查。
- [ ] Step 6: 构建资源
  - [ ] 6.1 使用本目录 references/ 处理结构设计、描述写法和工作流模式。
  - [ ] 6.2 需要评测、benchmark、trigger tuning 时，复用 ../skill-creator/ 下的脚本与资源。
- [ ] Step 7: 评测与迭代 (conditional)
  - [ ] 7.1 轻量任务可只做人工审阅。
  - [ ] 7.2 复杂技能必须补 2 到 3 个真实 eval prompt，并决定是否做 baseline 对比。
  - [ ] 7.3 需要量化评估时，使用 skill-creator 的 benchmark 和 viewer 工具链。
- [ ] Step 8: 收口与交付 ⚠️ REQUIRED
  - [ ] 8.1 总结本次保留、删除、重命名和兼容策略。
  - [ ] 8.2 包装前运行自检，必要时执行 package_skill.py。

## 资源装载策略

### 本目录资源

- references/description-guide.md：写 description 前加载。
- references/workflow-patterns.md：设计工作流、确认门和输出节奏时加载。
- references/writing-techniques.md：写铁律、反模式和问题式指令时加载。
- references/output-patterns.md：设计交付模板和自检清单时加载。
- references/parameter-system.md：需要参数或 partial execution 时加载。
- references/architecture-guide.md：规划 references/、scripts/、assets/ 分层时加载。
- scripts/init_skill.py：初始化新技能骨架。
- scripts/package_skill.py：打包前校验并封装技能。

### 复用 skill-creator 工具链

- ../skill-creator/references/schemas.md：编写 evals、grading、benchmark JSON 时加载。
- ../skill-creator/scripts/run_eval.py：需要批量跑 eval 时使用。
- ../skill-creator/scripts/aggregate_benchmark.py：需要聚合 benchmark 时使用。
- ../skill-creator/scripts/run_loop.py：需要做 description trigger optimization 时使用。
- ../skill-creator/eval-viewer/generate_review.py：需要让用户对多轮输出进行可视化评审时使用。
- ../skill-creator/agents/analyzer.md、grader.md、comparator.md：需要分析 benchmark、做断言评估或盲测比较时加载。

## 关键约束

- SKILL.md 保持精炼，超出主体骨架的知识尽量下沉到 references/。
- 只有会稳定节省 token 或提升一致性的操作，才值得写成 scripts/。
- description 是技能发现面，正文不是。
- 如果只是单次小修，不要硬套完整 benchmark 流程。

## 确认门

- 在删除目录、覆盖旧技能、批量重写 references/ 前，先征求用户确认。
- 在生成大批 eval、运行耗时 benchmark、替换兼容技能名时，先说明成本和影响。
- 在保留兼容壳技能时，明确哪个目录是“单一事实来源”。

## 反模式

- 把所有规则塞进一个超长 SKILL.md。
- 让 description 只写“一个用于 X 的技能”，没有触发关键词。
- 没有工作流，任由模型自由发挥。
- 明明需要渐进加载，却把细节全写进正文。
- 为了凑完整度而强行引入 benchmark，而不是按任务复杂度选择评测强度。
- 保留两个互相冲突的技能创建流程，导致后续维护分叉。

## 交付前检查

- [ ] description 已覆盖真实触发语句和场景，而不是抽象概括。
- [ ] SKILL.md 具备铁律、工作流、确认门、反模式和交付前检查。
- [ ] 已明确哪些内容留在本目录，哪些复用 ../skill-creator/ 工具链。
- [ ] 如果保留兼容别名，已说明 canonical skill 是哪个。
- [ ] 如有 eval 或 benchmark，目录结构与 JSON schema 已对齐。
