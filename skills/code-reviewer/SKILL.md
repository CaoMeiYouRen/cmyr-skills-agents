---
name: code-reviewer
description: 审查当前 git 变更、PR、提交范围、技能定义文件、架构调整或安全敏感代码时使用。覆盖正确性、安全、架构、SOLID、可删除代码、性能、异常处理与测试风险；默认只输出 review，不直接修改代码。用户提到 review、code review、PR 审查、deep review、code review expert、senior review、security audit、merge ready、SOLID、架构审查时都应触发。
---

# Code Reviewer

铁律：先给 findings，再给总结。不要因为测试通过、代码能跑或改动量小，就跳过正确性、安全和架构审查。

## 工作流

- [ ] Step 1: 建立审查上下文 ⚠️ REQUIRED
    - [ ] 1.1 读取 git 状态、diff 范围和受影响文件。
    - [ ] 1.2 确认入口、关键路径和高风险区域，如鉴权、数据写入、外部调用、配置变更。
    - [ ] 1.3 如果没有 diff，明确告诉用户并询问是否改看 staged changes 或指定范围。
- [ ] Step 2: 加载约束与相关资料 ⚠️ REQUIRED
    - [ ] 2.1 优先读取与改动直接相关的根目录文档、配置文件和模块实现，而不是假设存在 docs/。
    - [ ] 2.2 如果改动涉及 skills/*/SKILL.md、agents/*.agent.md 或 AGENTS.md，额外加载 skill-creator，按技能设计规范审查触发面、工作流和资源布局。
- [ ] Step 3: 进行结构化审查
    - [ ] 3.1 使用本目录 references/solid-checklist.md 检查职责边界、扩展点和耦合度。
    - [ ] 3.2 使用本目录 references/security-checklist.md 检查鉴权、注入、密钥泄露、日志和资源滥用风险。
    - [ ] 3.3 使用本目录 references/code-quality-checklist.md 检查错误处理、边界条件、性能与可维护性。
    - [ ] 3.4 使用本目录 references/removal-plan.md 判断冗余代码是可立即删除，还是需要后续迭代计划。
    - [ ] 3.5 当用户要求 deep review、SOLID review 或 senior review 时，必须同时覆盖性能热点、异常处理、边界条件和删除计划，而不是只做浅层意见汇总。
- [ ] Step 4: 判定严重级别 ⚠️ REQUIRED
    - [ ] 4.1 P0：安全漏洞、数据损坏、明显 correctness bug。
    - [ ] 4.2 P1：逻辑错误、重大架构问题、显著回归风险。
    - [ ] 4.3 P2：维护性、可读性、轻度设计问题。
    - [ ] 4.4 P3：风格、命名、非阻塞建议。
- [ ] Step 5: 输出审查结果
    - [ ] 5.1 Findings 必须按严重级别排序，并附具体文件位置与修复方向。
    - [ ] 5.2 明确给出 APPROVE、REQUEST_CHANGES 或 COMMENT。
    - [ ] 5.3 如果无问题，也要说明检查范围与残余风险。
- [ ] Step 6: 确认后续动作
    - [ ] 6.1 默认停在 review，不直接改代码。
    - [ ] 6.2 只有用户明确要求修复时，才进入实现阶段。

## 输出格式

```markdown
## Code Review Summary

**Files reviewed**: X files
**Overall assessment**: [APPROVE / REQUEST_CHANGES / COMMENT]

## Findings

### P0 - Critical
1. [file:line] 问题标题
     - 风险说明
     - 修复建议

### P1 - High
...

## Removal / Follow-up Plan

## Residual Risks
```

## 技能文件专项审查

当改动涉及技能体系时，额外检查：

- description 是否真的能触发技能，而不是抽象介绍。
- 正文是否具备铁律、工作流、确认门、反模式和交付前检查。
- references/、scripts/、assets/ 是否职责清晰，是否存在跨目录重复定义。
- 是否保留了兼容别名，以及 canonical skill 是否唯一明确。
- 如果技能刚经历模板化重构，是否通过 git diff 或提交历史保留了旧版中的项目特化规则。

## 深度审查模式

当用户要求 deep review、code review expert 或 senior review 时：

- 使用 references/solid-checklist.md 审查职责边界、扩展性与耦合。
- 使用 references/security-checklist.md 审查鉴权、注入、密钥、SSRF、路径问题和竞态。
- 使用 references/code-quality-checklist.md 审查 swallowed exceptions、async error、N+1、缓存和边界条件。
- 使用 references/removal-plan.md 判断死代码是立即可删还是需要迁移计划。
- 解释为什么这是结构性风险，而不是只给表面建议。

## 确认门

- 没有用户确认时，不直接实现审查意见。
- 审查范围过大时，先和用户确认是全量 review 还是重点 review。

## 反模式

- 只给笼统评价，如“看起来不错”“代码质量还行”。
- 按文件顺序复述 diff，而不是提炼真正的问题。
- 用“可能”掩盖已经足够明确的风险。
- 审查技能文件时，继续沿用旧模板标准而忽略 skill-creator。

## 交付前检查

- [ ] Findings 排在总结前面。
- [ ] 每个阻塞问题都说明了风险和修复方向。
- [ ] 已覆盖正确性、安全、架构、性能和测试风险。
- [ ] 如果审查了技能文件，已按 skill-creator 规范补充设计审查。
- [ ] 如为深度审查，已显式使用四份 checklist 而不是只给摘要。
- [ ] 未经用户确认，不包含自动实施修改。









