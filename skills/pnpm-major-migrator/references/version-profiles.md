# Version Profiles

用于维护 pnpm major 迁移画像，避免将技能绑定到单一版本。

## 画像模板

每个版本迁移画像建议包含以下字段：

- From/To：源版本与目标版本
- Breaking Changes：破坏性变更摘要
- Auto-Migrations：可由 codemod 或脚本自动处理的项
- Manual Follow-ups：必须人工确认的项
- CI Impact：对 GitHub Actions/Docker/Cloud 的影响
- Validation Gate：最小验证与完整验证命令集合
- Rollback Trigger：触发回滚的条件

## 当前画像

- `v10 -> v11`：见 `v10-to-v11-checklist.md`

## 待补充画像

- `v11 -> v12`
- `v12 -> v13`

新增画像时，优先补充“变化类型分层”：

1. 自动可迁移
2. 需人工确认
3. 需业务决策
