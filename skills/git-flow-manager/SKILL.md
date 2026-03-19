---
name: git-flow-manager
description: 管理暂存策略、拆分提交、检查变更边界、维护提交顺序、生成变更记录和预判冲突时使用。适合多步交付而不只是单次 commit message 生成。用户提到 staging、split commits、git flow、changelog、release prep、冲突预警时都应触发。
---

# Git Flow Manager

铁律：不要把一串无关改动塞进同一次提交，也不要在没有质量门结果时安排提交流程。

## 工作流

- [ ] Step 1: 划分变更批次 ⚠️ REQUIRED
	- [ ] 1.1 按功能、测试、文档、配置变更拆分提交单元。
	- [ ] 1.2 标记用户已有改动与当前任务改动，避免误暂存。
- [ ] Step 2: 安排提交流程
	- [ ] 2.1 明确哪些提交必须先于其他提交进入仓库。
	- [ ] 2.2 如果只是生成提交消息，交给 conventional-committer 执行。
- [ ] Step 3: 风险检查
	- [ ] 3.1 先确认 quality-guardian 已完成必要检查。
	- [ ] 3.2 识别可能引起冲突的共享文件和长生命周期分支风险。
- [ ] Step 4: 变更记录 (conditional)
	- [ ] 4.1 需要 changelog 或 release note 时，按提交批次汇总。
	- [ ] 4.2 说明哪些更改适合单独提交，哪些适合压缩。

## 反模式

- 为了省事把功能、测试、格式化和重命名全部混在一起。
- 不区分用户已有改动和当前任务改动。
- 提交顺序没有解释，后续无法稳定 cherry-pick 或回滚。

## 交付前检查

- [ ] 已按功能边界拆分提交计划。
- [ ] 已识别无关改动和潜在冲突点。
- [ ] 质量门状态清晰。
- [ ] 如需提交消息，已明确交给 conventional-committer。









