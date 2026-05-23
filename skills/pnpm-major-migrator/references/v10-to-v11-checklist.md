# v10 -> v11 Migration Checklist

本清单对齐 pnpm 官方迁移说明：https://pnpm.io/migration

## 1) 自动化可处理项

- [ ] 运行 codemod：`pnpx codemod run pnpm-v10-to-v11`
- [ ] 将 `package.json#pnpm` 配置迁移到 `pnpm-workspace.yaml`
- [ ] 将 `.npmrc` 中非 auth/registry 配置迁移到 `pnpm-workspace.yaml`（键名改为 camelCase）
- [ ] 将 `package.json#packageManager` 升级到目标 v11 版本
- [ ] 重新生成 lockfile 并验证 `pnpm install --frozen-lockfile`

## 2) 需要人工确认项

- [ ] `auditConfig.ignoreCves` -> `auditConfig.ignoreGhsas` 后，逐条将 CVE 映射为 GHSA
- [ ] 检查并处理被移除配置：`ignorePatchFailures`
- [ ] 检查环境变量前缀：`npm_config_*` -> `pnpm_config_*`
- [ ] 检查 `pnpm link <pkg-name>` 语义变化是否影响现有脚本
- [ ] 检查 `pnpm install -g`（无参数）旧行为是否还被使用
- [ ] 检查 `pnpm server` 相关命令是否仍在文档或脚本中

## 3) 脚本与命令冲突检查

以下脚本名在 v11 里会优先命中 package scripts，而非内置命令：

- `clean`
- `setup`
- `deploy`
- `rebuild`

若存在冲突，内置命令改用：`pnpm pm <command>`。

## 4) CI 与发布一致性

- [ ] GitHub Actions 中 `pnpm/action-setup` 改为显式版本，不使用 `latest`
- [ ] Node 版本、pnpm 版本与 lockfile 版本在本地与 CI 保持一致
- [ ] 发布工作流和测试工作流都执行 frozen-lockfile 安装验证

## 5) 验证与收口

- [ ] 跑最小充分质量门：lint/test/build/typecheck（按项目真实脚本）
- [ ] 输出迁移报告：改动清单 + 风险清单 + 未决事项
- [ ] 如失败，按“配置迁移 -> lockfile -> CI 对齐”分批回滚与重试
