---
name: pnpm-major-migrator
description: 迁移 pnpm 大版本（major）及其项目配置时使用。适用于用户提到 upgrade pnpm major、pnpm v10 to v11、pnpm migration、迁移 pnpm 版本、lockfile 升级、pnpm-workspace.yaml 迁移、.npmrc 配置迁移、GitHub Actions pnpm 版本对齐。当前优先覆盖 v10 到 v11，并保留后续 v12+ 的可扩展流程。
---

# Pnpm Major Migrator

铁律：不要在未完成基线采集、回滚预案和最小质量门之前直接升级 pnpm major。

## 工作流

- [ ] Step 1: 做迁移基线与目标确认 ⚠️ REQUIRED
  - [ ] 1.1 确认当前 pnpm 版本、目标版本、Node 版本范围和 CI 运行环境。
  - [ ] 1.2 盘点仓库中的 pnpm 相关配置入口：`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`.npmrc`、`.github/workflows/*`、`Dockerfile*`。
  - [ ] 1.3 记录并锁定当前可用质量门命令（lint/test/build/typecheck）。
- [ ] Step 2: 判断迁移画像（Migration Profile） ⚠️ REQUIRED
  - [ ] 2.1 根据当前 major 与目标 major，选择对应迁移画像。
  - [ ] 2.2 如果是 `v10 -> v11`，必须执行 references/v10-to-v11-checklist.md 的专项清单。
  - [ ] 2.3 如果是其他版本，先使用 references/version-profiles.md 的通用框架，再补充目标版本 changelog 差异。
- [ ] Step 3: 执行自动化迁移
  - [ ] 3.1 在仓库根目录运行官方 codemod（如适用）：`pnpx codemod run pnpm-v10-to-v11`。
  - [ ] 3.2 将机械化改动集中处理：配置字段迁移、键名重命名、lockfile 重生成，并在“原先已存在 `packageManager` 字段”时才对齐该字段。
  - [ ] 3.3 对 CI 里的 pnpm 版本策略做显式化，仅固定 major（例如 `10`、`11`），不固定 minor/patch，且避免 `latest` 漂移。
  - [ ] 3.4 若项目使用 `Dockerfile`/`Dockerfile.*` 构建，统一更新镜像内 pnpm 安装与缓存配置，保证与仓库目标 major 一致。
- [ ] Step 4: 处理人工确认项 ⚠️ REQUIRED
  - [ ] 4.1 审核 codemod 无法覆盖的项（例如 CVE -> GHSA 映射、环境变量前缀迁移）。
  - [ ] 4.2 审核脚本名与 pnpm 内置命令冲突风险（如 clean/setup/deploy/rebuild）。
  - [ ] 4.3 审核破坏性行为变化（例如 link/server/全局安装语义变化）对现有流程的影响。
- [ ] Step 5: 验证与回滚保障 ⚠️ REQUIRED
  - [ ] 5.1 先验证依赖安装是否成功（无异常退出、无缺失依赖、工作区安装完整），再运行最小充分质量门；涉及 CI/锁文件/配置迁移时升级为完整质量门。
  - [ ] 5.2 校验 `pnpm-lock.yaml` 是否按预期更新，并确认未引入新的报错/告警（含 `ERR_PNPM_IGNORED_BUILDS`、脚本执行失败、类型错误、lint/test 回归）。
  - [ ] 5.3 若出现新问题，先修复再交付；修复后重复执行安装与质量门，直到通过或形成明确阻塞说明。
  - [ ] 5.4 输出迁移报告：变更文件、人工遗留项、风险等级、回滚方式。
  - [ ] 5.5 若质量门失败且短期不可修复，优先回退到最近稳定提交并拆分批次重试。

## 当前优先画像：v10 到 v11

- 必须使用 references/v10-to-v11-checklist.md。
- 重点检查以下高风险面：
  - `package.json#pnpm` 是否已迁移到 `pnpm-workspace.yaml`。
  - `.npmrc` 中非 auth/registry 配置是否已迁移到 `pnpm-workspace.yaml`。
  - 构建依赖相关配置是否统一到 `allowBuilds` 语义（注意：v11 中 `allowBuilds` 取代了 `onlyBuiltDependencies` 和 `ignoredBuiltDependencies`，配置位置在 `pnpm-workspace.yaml`）。
  - 确认 `pnpm-workspace.yaml` 中的 `allowBuilds` 覆盖了所有需要构建脚本的依赖（如 esbuild、sharp、workerd 等），否则 `pnpm install` 会报 `ERR_PNPM_IGNORED_BUILDS`，导致本地与 CI 均无法构建。
  - 旧 strictness 配置是否迁移到 `pmOnFail`。
  - `auditConfig.ignoreCves` 是否改为 `auditConfig.ignoreGhsas`，并补做 CVE 到 GHSA 的人工映射。

## 后续版本扩展位

- 迁移画像扩展：在 references/version-profiles.md 增加 `v11 -> v12`、`v12 -> v13` 专项节。
- 规则扩展：将新版本破坏性变更按“自动化可处理/需人工确认/需业务决策”三类归档。
- 验证扩展：为常见 CI 平台（GitHub Actions、Docker、Cloudflare）补充最小验证矩阵。

## 反模式

- 只升级 `packageManager` 字段，不同步 lockfile 与 CI。
- 在原本没有 `packageManager` 的项目里强行新增该字段。
- 未清点 `.npmrc` 与 `pnpm-workspace.yaml` 的职责边界，导致配置失效。
- 更新了 workspace/CI 配置但遗漏 `Dockerfile`，导致容器构建与本地环境版本漂移。
- 未记录人工遗留项就宣告迁移完成。
- 在 `latest` 模式下跑迁移并提交，造成后续不可复现。
- 迁移后未确认 `allowBuilds` 配置是否覆盖关键构建依赖，导致 CI 中出现 `ERR_PNPM_IGNORED_BUILDS`。

## 交付前检查

- [ ] 已明确当前版本、目标版本和迁移画像。
- [ ] 已执行对应版本专项清单（v10 -> v11）或通用画像清单（其他版本）。
- [ ] 已完成安装成功性检查、lockfile 更新检查与质量门验证，并修复新增问题或给出阻塞说明。
- [ ] CI 中 pnpm 版本策略已显式可复现，且仅固定 major。
- [ ] 若项目使用 Docker 构建，容器内 pnpm 版本策略已同步到目标 major。
