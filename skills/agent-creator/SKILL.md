---
name: agent-creator
description: 创建、重构、审计和治理本项目自定义 agent 时使用。用户提到 create agent、new agent、build agent、write .agent.md、custom agent、agent mode、agent workflow、agent governance、判断应该做成 skill 还是 agent、审计 agent 安全与准入标准时都应触发。它负责先判断该需求应由 skill 还是 agent 承载，再在需要时创建或更新 agent，并审计重叠、规范与安全。

metadata:
  internal: false
---

# Agent Creator

铁律：不要先写新 agent，再思考它是不是其实应该是 skill，或者只是现有角色的一次补充。

## 工作流

- [ ] Step 1: 判断应由 skill 还是 agent 承载 ⚠️ REQUIRED
  - [ ] 1.1 加载 references/admission-guide.md，先判断这是可复用工作流，还是需要上下文隔离与多角色编排。
  - [ ] 1.2 如果 skill 更合适，停止新建 agent，转交 skill-creator。
- [ ] Step 2: 审计现有能力 ⚠️ REQUIRED
  - [ ] 2.1 扫描 AGENTS.md、agents/ 与 skills/，确认是否已有高重叠角色。
  - [ ] 2.2 如果只是现有 agent 或 skill 的补充，优先补到原文件，不新增目录。
- [ ] Step 3: 设计 agent 边界
  - [ ] 3.1 明确 agent 的职责、输入、输出、接棒关系和不负责的事项。
  - [ ] 3.2 明确它集成哪些 skills，是否需要调用其他 agents。
  - [ ] 3.3 判断是否需要 Why 层：高复用、有设计债或易被误删的 agent，补 `agents/.rationale/<name>.md`，按 [skill-creator 的 rationale 模板](../skill-creator/references/rationale-template.md) 写（放在点目录，避免被 agent 加载器当成 subagent 扫描）。
  - [ ] 3.4 标出项目覆盖锚点：把项目可变参数（阈值、路径、角色矩阵）从正文剥离为默认值，声明覆盖读取位置与「默认 < 项目 < 会话」优先级。
- [ ] Step 4: 编写或更新 .agent.md ⚠️ REQUIRED
  - [ ] 4.1 保持 frontmatter 可触发，正文包含角色设定、集成技能、参考文档、核心职责和协作工作流。
  - [ ] 4.2 不使用不存在的文档路径作为强制参考资料。
- [ ] Step 5: 审计安全与准入
  - [ ] 5.1 检查是否与现有 agents / skills 高度重复。
  - [ ] 5.2 检查是否引导越权操作、危险命令或模糊职责。
  - [ ] 5.3 需要审查时，联动 code-reviewer 做结构与安全审计。
- [ ] Step 6: 同步项目索引
  - [ ] 6.1 更新 AGENTS.md 中的 agent/skill 列表与定位说明。
  - [ ] 6.2 如果新增的是治理型角色，明确其准入规则与管理边界。

## 核心规则

- 需要上下文隔离、多角色协作、分阶段接棒或专门治理职责时，优先考虑 agent。
- 只是一个可复用工作流、检查清单或带 references/scripts 的任务时，优先考虑 skill。
- 发现与现有能力高重叠时，默认补充现有 skill 或 agent，而不是创建新项。
- 执行信息（做什么）与设计理由（为什么）分层：Why 层写入 `agents/.rationale/<name>.md`，只在重构、合并、降级或删除时加载，不内联进正文。
- 每个 agent 都要能回答"什么条件下应删除或合并"；存在理由消失即进入弃用。
- 项目可变参数写入项目 `AGENTS.md`（数据多时链到 `docs/standards/*`），agent 只保留默认值，不硬编码、不双写。
- 项目内已有同名技能时，用相对路径链接到项目内定义，禁止裸名引用（裸名会解析到全局同名技能）。

## 反模式

- 用 agent 解决其实是 skill 更适合的问题。
- 为了“看起来完整”创建一个和现有角色几乎重复的新 agent。
- 把 agent 写成一个没有边界的万能执行器。
- 在 agent 里引用不存在的 docs/ 路径或虚构流程。
- 把"为什么"内联进 agent 正文，或把项目阈值、路径硬编码进角色定义。

## 交付前检查

- [ ] 已明确这是 skill 问题还是 agent 问题。
- [ ] 已审计现有 skills / agents，确认不是高重叠新增。
- [ ] .agent.md 中职责、边界、接棒关系和集成技能清晰。
- [ ] 高复用、高设计债或易被误删的 agent，已补 `agents/.rationale/<name>.md` 并写明失效判据。
- [ ] 项目可变参数已剥离为默认值，覆盖位置与「默认 < 项目 < 会话」优先级已声明。
- [ ] 已同步 AGENTS.md 或其他必要索引。
