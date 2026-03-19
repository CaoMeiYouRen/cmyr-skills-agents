---
name: full-stack-master
description: 需要统筹需求澄清、上下文扫描、技术方案、前后端实现、UI 验证、测试、质量审查、文档同步和提交节奏时使用。它负责编排多技能协作，而不是亲自替代所有专业技能。用户提到 end-to-end workflow、全流程开发、从需求到提交、PDTFC+、多技能编排时都应触发。
---

# Full Stack Master

铁律：不要跳过规划和质量门，直接从需求冲到实现和提交。全链路编排的价值就在于减少返工，而不是增加速度幻觉。

## 标准工作流

- [ ] Step 1: 建立项目上下文 ⚠️ REQUIRED
    - [ ] 1.1 先用 context-analyzer 读取 AGENTS.md、README、package.json 和任务相关文件。
    - [ ] 1.2 如需求模糊，交给 requirement-analyst 做最小必要澄清。
- [ ] Step 2: 产出技术方案 ⚠️ REQUIRED
    - [ ] 2.1 使用 technical-architect 规划文件映射、模块边界和风险。
    - [ ] 2.2 明确由 backend-expert、frontend-expert 或其他技能接手的部分。
- [ ] Step 3: 组织实现
    - [ ] 3.1 后端改动交给 backend-expert。
    - [ ] 3.2 前端改动交给 frontend-expert。
    - [ ] 3.3 文档变更交给 documentation-specialist。
- [ ] Step 4: 做专项验证
    - [ ] 4.1 UI 改动交给 ui-validator 做真实渲染验证。
    - [ ] 4.2 测试补齐与失败排查交给 test-engineer。
    - [ ] 4.3 安全敏感改动交给 security-guardian。
- [ ] Step 5: 质量门与审查 ⚠️ REQUIRED
    - [ ] 5.1 用 quality-guardian 选择并执行最小充分检查。
    - [ ] 5.2 用 code-reviewer 做结构化审查。
- [ ] Step 6: 交付与提交
    - [ ] 6.1 需要提交时，先让 git-flow-manager 规划批次。
    - [ ] 6.2 再由 conventional-committer 生成并执行提交。

## 编排原则

- 总控技能负责阶段切换和依赖顺序，不替代专业技能内部规则。
- 能并行的阶段并行，必须串行的阶段明确依赖。
- 每进入新阶段，都要确认上阶段产物是否足够。

## 技能映射

- context-analyzer：建立上下文。
- requirement-analyst：澄清需求。
- technical-architect：设计方案。
- backend-expert / frontend-expert：实施改动。
- documentation-specialist：同步文档。
- ui-validator：验证界面。
- test-engineer：补测试与查失败。
- security-guardian：补安全审计。
- quality-guardian：运行质量门。
- code-reviewer：做结构化审查。
- git-flow-manager / conventional-committer：管理交付和提交。

## 反模式

- 总控技能亲自接管所有实现细节，导致专业技能失效。
- 在需求仍然模糊时就启动代码改动。
- 质量门和 code review 只走形式，不影响后续阶段。

## 交付前检查

- [ ] 已完成上下文、方案、实现、验证、审查和交付的最小闭环。
- [ ] 每个阶段都有明确负责技能。
- [ ] 没有跳过质量门或审查。
- [ ] 输出中已说明当前进度、风险和下一步。









