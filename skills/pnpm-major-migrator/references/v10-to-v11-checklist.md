# v10 -> v11 Migration Checklist

本清单对齐 pnpm 官方迁移说明：https://pnpm.io/migration

## 1) 自动化可处理项

- [ ] 运行 codemod：`pnpx codemod run pnpm-v10-to-v11`
- [ ] 将 `package.json#pnpm` 配置迁移到 `pnpm-workspace.yaml`
- [ ] 将 `.npmrc` 中非 auth/registry 配置迁移到 `pnpm-workspace.yaml`（键名改为 camelCase）
- [ ] 仅在 `package.json` 原先已存在 `packageManager` 字段时，才将其升级到目标 v11 版本
- [ ] 重新生成 lockfile 并验证 `pnpm install --frozen-lockfile`
- [ ] 若项目使用 `Dockerfile`/`Dockerfile.*` 构建，更新容器内 pnpm 安装方式与缓存配置到目标 major

## 2) 需要人工确认项

- [ ] `auditConfig.ignoreCves` -> `auditConfig.ignoreGhsas` 后，逐条将 CVE 映射为 GHSA
- [ ] 检查并处理被移除配置：`ignorePatchFailures`
- [ ] **`allowBuilds` 迁移**：v11 用 `allowBuilds` 取代 v10 的 `onlyBuiltDependencies` 和 `ignoredBuiltDependencies`；必须将所有需要构建脚本的包（如 esbuild、sharp、workerd、@swc/core、protobufjs、puppeteer 等）加入 `pnpm-workspace.yaml` 的 `allowBuilds` 列表，否则 `pnpm install` 会报 `ERR_PNPM_IGNORED_BUILDS`
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

- [ ] GitHub Actions 中 `pnpm/action-setup` 改为显式 major 版本，不使用 `latest`，且不固定 minor/patch
- [ ] Node 版本、pnpm 版本与 lockfile 版本在本地与 CI 保持一致
- [ ] 发布工作流和测试工作流都执行 frozen-lockfile 安装验证
- [ ] 确认 CI 中使用的 `pnpm-workspace.yaml` 已包含 `allowBuilds` 配置，确保 CI 构建不因 `ERR_PNPM_IGNORED_BUILDS` 失败

## 5) 验证与收口

- [ ] 验证依赖安装成功（安装过程无异常退出、无缺失依赖、工作区安装完整）
- [ ] 确认 `pnpm-lock.yaml` 已按预期更新，且与目标 major 一致
- [ ] 跑最小充分质量门：lint/test/build/typecheck（按项目真实脚本）
- [ ] 检查是否引入新问题（lint/typecheck/test/build 回归、脚本报错、CI 配置漂移）
- [ ] 若发现新问题，先修复并重复执行“安装验证 + 质量门”
- [ ] 输出迁移报告：改动清单 + 风险清单 + 未决事项
- [ ] 如失败，按“配置迁移 -> lockfile -> CI 对齐”分批回滚与重试
