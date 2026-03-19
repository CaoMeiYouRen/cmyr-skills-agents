---
name: code-review-expert
description: 兼容旧触发词 code review expert、deep review、SOLID review、security scan。需要更深层的结构化审查时，加载 code-reviewer 的统一工作流，并按需使用本目录 references 中的 SOLID、安全、代码质量与 removal checklist。
---

# Code Review Expert

铁律：不要把它当成另一套 code review 技能。它是 code-reviewer 的深度审查模式和兼容入口。

## 工作流

- [ ] Step 1: 先加载 ../code-reviewer/SKILL.md ⚠️ REQUIRED
  - [ ] 1.1 继承统一的严重级别、输出格式和 review-first 原则。
- [ ] Step 2: 根据用户要求加深审查维度
  - [ ] 2.1 需要看设计问题时，加载 references/solid-checklist.md。
  - [ ] 2.2 需要看安全与可靠性时，加载 references/security-checklist.md。
  - [ ] 2.3 需要看边界条件、性能和异常处理时，加载 references/code-quality-checklist.md。
  - [ ] 2.4 需要评估删减和后续计划时，加载 references/removal-plan.md。
- [ ] Step 3: 输出更深的论证
  - [ ] 3.1 不只指出问题，还说明为什么这是结构性风险。
  - [ ] 3.2 需要重构时，优先给最小安全拆分方案。

## 适用场景

- 审查大 diff、跨模块改动或明显架构调整。
- 用户明确要求 deep review、senior review、SOLID review。
- 需要对 code-reviewer 的 findings 再做一层论证或补充证据。

## 反模式

- 复读 code-reviewer 已经做过的浅层检查。
- 只贴 checklist，不结合当前 diff 解释影响。
- 越过 review-first 原则，直接开始改代码。

## 交付前检查

- [ ] 已先走 code-reviewer 的统一流程。
- [ ] 已明确本次深度审查额外增加了哪些维度。
- [ ] 每个高级别问题都给出结构性原因和最小修复方案。
