---
name: skill-creator
description: 兼容旧触发词 create skill、skill creator、optimize skill、run skill evals、benchmark skill、description tuning。凡是用户要创建或迭代技能时，统一遵循 skill-forge 的设计流程；当需要跑评测、benchmark、viewer 或 trigger optimization 时，使用本目录的工具链。
---

# Skill Creator

铁律：不要维护第二套互相冲突的技能创建规范。skill-forge 是统一设计流程，本目录是评测与优化工具箱。

## 使用方式

- [ ] Step 1: 先加载 ../skill-forge/SKILL.md ⚠️ REQUIRED
  - [ ] 1.1 用 skill-forge 完成技能目标澄清、结构设计和 SKILL.md 编写。
  - [ ] 1.2 不在这里重复定义另一套正文模板。
- [ ] Step 2: 选择评测模式
  - [ ] 2.1 简单修改可只做人工 review。
  - [ ] 2.2 复杂修改使用 evals、benchmark 和 viewer。
- [ ] Step 3: 运行工具链 (conditional)
  - [ ] 3.1 使用 references/schemas.md 约束 eval 和 benchmark 数据结构。
  - [ ] 3.2 使用 scripts/run_eval.py、aggregate_benchmark.py、run_loop.py 完成评测与 description 优化。
  - [ ] 3.3 使用 eval-viewer/generate_review.py 给用户查看多轮输出。
- [ ] Step 4: 回写 canonical skill ⚠️ REQUIRED
  - [ ] 4.1 把最终设计回写到目标技能，避免结果只留在测试工件里。
  - [ ] 4.2 如保留兼容别名，明确说明 canonical 目录。

## 本目录负责什么

- eval prompt 与断言 schema。
- with-skill / baseline 对比。
- benchmark 聚合与分析。
- blind comparison 与 reviewer viewer。
- description trigger optimization。

## 本目录不负责什么

- 不单独定义新的技能正文规范。
- 不替代 skill-forge 的结构设计职责。
- 不要求所有技能都跑重型 benchmark。

## 反模式

- 在 skill-forge 之外再写一份完整但不同步的创建流程。
- 还没明确技能目标，就先搭 benchmark。
- 只看 benchmark 分数，不读真实输出与用户反馈。

## 交付前检查

- [ ] 已先用 skill-forge 定义技能结构。
- [ ] 如运行 eval，JSON schema 与目录结构已对齐。
- [ ] benchmark 结果已和真实输出一起分析，而不是只看分数。
- [ ] 已把最终结论回写到目标技能，而不是停留在实验目录。
