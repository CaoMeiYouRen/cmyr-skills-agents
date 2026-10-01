---
name: pnpm-major-migrator
description: 迁移 pnpm 大版本（major）及其项目配置时使用。适用于用户提到 upgrade pnpm major、pnpm v10 to v11、pnpm v11 to v12、pnpm migration、迁移 pnpm 版本、lockfile 升级、pnpm-workspace.yaml 迁移、.npmrc 配置迁移、GitHub Actions pnpm 版本对齐、allowBuilds 迁移、corepack 换装 pnpm。当前覆盖 v10 到 v11 与 v11 到 v12，并保留后续 v13+ 的可扩展流程。

metadata:
  internal: true
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
  - [ ] 2.2 如果是 `v10 -> v11` 或 `v10 -> v12`，必须执行 references/v10-to-v11-checklist.md 的专项清单。
  - [ ] 2.3 如果是 `v11 -> v12`，必须执行 references/v11-to-v12-checklist.md 的专项清单（无 codemod，以行为差异核对为主）。
  - [ ] 2.4 如果是其他版本，先使用 references/version-profiles.md 的通用框架，再补充目标版本 changelog 差异。
- [ ] Step 3: 执行自动化迁移
  - [ ] 3.1 仅在从 v10 起跳时运行官方 codemod：`pnpx codemod run pnpm-v10-to-v11`。`v11 -> v12` 没有 codemod，不要重复运行 v10 的 codemod。
  - [ ] 3.2 将机械化改动集中处理：配置字段迁移、键名重命名、lockfile 重生成，并在“原先已存在 `packageManager` 字段”时才对齐该字段。`v11 -> v12` 的唯一代码级改动通常就是这个字段。
  - [ ] 3.3 对 CI 里的 pnpm 版本策略做显式化，仅固定 major（例如 `10`、`11`、`12`），不固定 minor/patch，且避免 `latest` 漂移；若 CI 与容器通过 `packageManager` 取值，则不要在多处重复 pin。
  - [ ] 3.4 若项目使用 `Dockerfile`/`Dockerfile.*` 构建，统一更新镜像内 pnpm 安装与缓存配置，保证与仓库目标 major 一致。
  - [ ] 3.5 若项目用 Corepack 承载 pnpm 版本，评估替换为独立安装脚本或 `pnpm/setup`（v12 起官方已不再推荐 Corepack 路径）。
- [ ] Step 4: 处理人工确认项 ⚠️ REQUIRED
  - [ ] 4.1 审核 codemod 无法覆盖的项（例如 CVE -> GHSA 映射、环境变量前缀迁移）。
  - [ ] 4.2 审核脚本名与 pnpm 内置命令冲突风险（如 clean/setup/deploy/rebuild）。
  - [ ] 4.3 审核破坏性行为变化（例如 link/server/全局安装语义变化）对现有流程的影响。
  - [ ] 4.4 审核被移除或语义变化的命令行参数（`v11 -> v12` 涉及 `--resolution-only` 与显式 `--frozen-lockfile true|false`）。
  - [ ] 4.5 审核 lockfile 的一次性重排 diff，确认变化符合“体积变小、无功能回归”的预期。
  - [ ] 4.6 审核 pnpm 分发与安装链路（Corepack / 独立脚本 / GitHub Action / 容器基镜像），确认升级后仍能拿到目标 major。
- [ ] Step 5: 验证与回滚保障 ⚠️ REQUIRED
  - [ ] 5.1 先验证依赖安装是否成功（无异常退出、无缺失依赖、工作区安装完整），再运行最小充分质量门；涉及 CI/锁文件/配置迁移时升级为完整质量门。
  - [ ] 5.2 校验 `pnpm-lock.yaml` 是否按预期更新，并确认未引入新的报错/告警（含 `ERR_PNPM_IGNORED_BUILDS`、`ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS`、脚本执行失败、类型错误、lint/test 回归）。
  - [ ] 5.3 人工复查 `pnpm-workspace.yaml` 中 `allowBuilds` 每个 key 的 value 是否为 `true`/`false`，而非占位符字符串。占位符在 YAML 与类型校验上都是合法字符串，但等同于未审批，必须修正。
  - [ ] 5.4 清理已废弃的构建配置键（`onlyBuiltDependencies` 等），确认 `allowBuilds` 是唯一生效来源。
  - [ ] 5.5 若可用，运行 `pnpm doctor` 确认安装方式、store/缓存目录、文件系统链接策略与 registry 连通性无 fail。
  - [ ] 5.6 若出现新问题，先修复再交付；修复后重复执行安装与质量门，直到通过或形成明确阻塞说明。
  - [ ] 5.7 输出迁移报告：变更文件、人工遗留项、风险等级、回滚方式。
  - [ ] 5.8 若质量门失败且短期不可修复，优先回退到最近稳定提交并拆分批次重试。

## 当前优先画像：v10 到 v11

- 必须使用 references/v10-to-v11-checklist.md。
- 重点检查以下高风险面：
  - `package.json#pnpm` 是否已迁移到 `pnpm-workspace.yaml`。
  - `.npmrc` 中非 auth/registry 配置是否已迁移到 `pnpm-workspace.yaml`。
  - 构建依赖相关配置是否统一到 `allowBuilds` 语义（见下一节的修正说明）。
  - 确认 `pnpm-workspace.yaml` 中的 `allowBuilds` 覆盖了所有需要构建脚本的依赖（如 esbuild、sharp、workerd 等），否则 `pnpm install` 会报 `ERR_PNPM_IGNORED_BUILDS`，导致本地与 CI 均无法构建。
  - ⚠️ **校验 `allowBuilds` 值均为 `true`/`false`**：不能残留字符串占位符（如 `set this to true or false`）。占位符在 YAML 与类型上都是合法字符串，但 pnpm 不会将其解释为允许构建，`pnpm install` 仍会报错。
  - 旧 strictness 配置是否迁移到 `pmOnFail`。
  - `auditConfig.ignoreCves` 是否改为 `auditConfig.ignoreGhsas`，并补做 CVE 到 GHSA 的人工映射。

### `allowBuilds` 与 `onlyBuiltDependencies` 的关系（修正）

- **`allowBuilds` 是唯一生效的构建审批配置，不需要与 `onlyBuiltDependencies` 配对。**
- `onlyBuiltDependencies`、`onlyBuiltDependenciesFile`、`neverBuiltDependencies`、`ignoredBuiltDependencies`、`ignoreDepScripts` 自 v11 起即被忽略（上游生效键只有 `allowBuilds` 与 `dangerouslyAllowAllBuilds`），v12 沿用。
- 实跑结论（11.17.0 与 12.8.1 各验证一次）：
  - 只写 `allowBuilds: { esbuild: true }` → 构建脚本正常执行。
  - 只写 `onlyBuiltDependencies: [esbuild]` → 报 `ERR_PNPM_IGNORED_BUILDS`。
  - 同时写 `allowBuilds: { esbuild: false }` 与 `onlyBuiltDependencies: [esbuild]` → 构建**不**执行，`allowBuilds` 胜出。
- 因此遗留键属于 v10 迁移残留，可安全删除；保留也不会触发“未识别键”报错（它们在“已知但已废弃”名单内），但会造成“看起来生效、实际无效”的误判。`pnpm approve-builds` 在 v12 已会自动清理这些键。
- 正确写法：

  ```yaml
  # pnpm-workspace.yaml（非 workspace 项目同样适用）
  allowBuilds:
    esbuild: true
    sharp: true
    core-js: false
  ```

## 当前优先画像：v11 到 v12

- 必须使用 references/v11-to-v12-checklist.md。
- 预期管理：官方仅列出 8 处差异（6 处改变结果、2 处拒绝命令行语法），没有 codemod，唯一的代码级改动通常是 `packageManager` 字段。
- 重点检查以下高风险面：
  - 命令行：`--resolution-only`（改用 `pnpm peers check`）与 `--frozen-lockfile true|false`（改用 `--no-frozen-lockfile`）。
  - 配置：`pnpm-workspace.yaml` 未识别键在“pin 被满足”时会致命（`ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS`）；`allowBuilds` 值类型收紧。
  - lockfile：首次重新解析会产生一次性 peer 变体重排，需逐行确认 diff。
  - 分发：pnpm 12 是原生可执行文件（Node 支持面反而变宽到 18/20/22/24/26），但 Corepack 路径已被官方弃用，需核对 Dockerfile / devcontainer / CI 的安装方式。
  - 平台：Vercel 等托管构建平台对 pnpm 12 的识别可能滞后于官方发布，必须实跑一次 preview 部署而不是推断。

## 后续版本扩展位

- 迁移画像扩展：在 references/version-profiles.md 增加 `v12 -> v13` 专项节。
- 规则扩展：将新版本破坏性变更按“自动化可处理/需人工确认/需业务决策”三类归档。
- 验证扩展：为常见 CI 平台（GitHub Actions、Docker、Vercel、Cloudflare）补充最小验证矩阵。
- 事实源约定：pnpm 官方博客中的版本指引可能滞后于 npm registry 的 `dist-tags`（例如“latest 仍指向 v11”的说明已过期）。迁移前先实测 `dist-tags`，再决定安装来源。

## 反模式

- 只升级 `packageManager` 字段，不同步 lockfile 与 CI。
- 在原本没有 `packageManager` 的项目里强行新增该字段。
- 未清点 `.npmrc` 与 `pnpm-workspace.yaml` 的职责边界，导致配置失效。
- 更新了 workspace/CI 配置但遗漏 `Dockerfile`，导致容器构建与本地环境版本漂移。
- 未记录人工遗留项就宣告迁移完成。
- 在 `latest` 模式下跑迁移并提交，造成后续不可复现。
- 迁移后未确认 `allowBuilds` 配置是否覆盖关键构建依赖，导致 CI 中出现 `ERR_PNPM_IGNORED_BUILDS`。
- `allowBuilds` 的 value 残留占位符文本（如 `"set this to true or false"`），在 YAML 语法上合法但 pnpm 无法识别，等同于未配置。
- 使用 `-replace` 或字符串操作修改 YAML 文件（如 `pnpm-workspace.yaml`）时，缩进错误会导致整个文件解析失败。修改 YAML 的正确做法：先 `Get-Content -Raw` 读全文件检查 key 是否已存在，插入时确保缩进与已有条目对齐（2 空格）；或用 Write 工具全量覆写。

### v11 -> v12 专属反模式

- 用更新提示里的 `pnpm add -g pnpm` 升级 pnpm 本体（该路径已被官方废弃，应使用 `pnpm self-update`）。
- 在已 pin pnpm 的项目内执行 `pnpm self-update` 并以为全局 pnpm 也被升级（实际只改了 `package.json` 的 pin）。
- 回滚时只降级本地 pnpm 本体而不改 `packageManager`：pin 会让 pnpm 反向切换回被 pin 的版本。
- 对纯 v11 项目重复运行 `pnpx codemod run pnpm-v10-to-v11`（v11 -> v12 没有 codemod）。
- 继续维护 `onlyBuiltDependencies` 等废弃键，误以为它们与 `allowBuilds` 共同生效。
- 保留 `allowBuilds` 里的占位符字符串并通过类型校验就宣告完成（占位符等同于未审批）。
- 在 `pnpm-workspace.yaml` 里长期保留拼错或为更高版本预留的键，直到某个仓库一旦 pin 就被 `ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS` 卡死。
- 假设容器基镜像里的 pnpm 能读到新版本：musl/多架构预编译二进制存在，但基镜像的安装方式必须实跑 `pnpm --version` 验证。
- 凭官方文档推断托管平台（如 Vercel）已支持 pnpm 12，而不实跑一次 preview 部署。

## 交付前检查

- [ ] 已明确当前版本、目标版本和迁移画像。
- [ ] 已执行对应版本专项清单（v10 -> v11、v11 -> v12）或通用画像清单（其他版本）。
- [ ] 已完成安装成功性检查、lockfile 更新检查与质量门验证，并修复新增问题或给出阻塞说明。
- [ ] 已人工复查 `allowBuilds` 的所有 value 是否为 `true`/`false`，无占位符字符串残留，且已清理废弃的构建配置键。
- [ ] 已实测确认升级后不存在“被移除参数/被收紧的配置校验”导致的硬失败（`--resolution-only`、显式 `--frozen-lockfile` 取值、未识别 workspace 键）。
- [ ] CI 中 pnpm 版本策略已显式可复现，且仅固定 major。
- [ ] 若项目使用 Docker 构建，容器内 pnpm 版本策略已同步到目标 major，并已在镜像内实跑验证。
- [ ] 回滚方案已同时覆盖 pnpm 本体、`packageManager` pin 与 lockfile，且已知 lockfile 格式在相邻 major 间可互读。
