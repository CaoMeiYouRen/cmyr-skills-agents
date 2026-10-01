# v11 -> v12 迁移清单

本清单覆盖 pnpm 11 -> pnpm 12。内容基于官方发布说明、官方文档、上游源码与本地实跑交叉核对，核对时间 2026-10-01（实跑版本：pnpm 12.8.1 与 11.17.0）。

## 0) 先建立正确预期

- pnpm 12 是用 Rust 重写的 pnpm，但刻意保留 v11 的命令、参数、配置、lockfile 格式与 `node_modules` 布局；官方定位是“升级不该感觉像迁移”。
- 官方 “What's different in pnpm 12” 只列出 8 处差异：6 处改变结果，2 处直接拒绝 v11 原本接受的命令行写法。其余差异散落在 12.x 的 minor/patch 发布说明里。
- **没有 v11 -> v12 的 codemod**。`pnpx codemod run pnpm-v10-to-v11` 只服务于从 v10 起跳的项目（v12 沿用 v11 的配置模型），不要对纯 v11 项目重新跑一遍。
- 实际工作量 = 改 `packageManager` 一个字段 + 处理一次性 lockfile 重排 + 逐条核对下面的行为差异。

## 1) 硬失败项（会直接中断安装/构建，必须逐个清零）

- [ ] `pnpm install --resolution-only` 已被移除。实测 12.8.1 报 `error: unexpected argument '--resolution-only' found`。替代方案是 `pnpm peers check`（直接读 lockfile，不需要重新解析或安装）。
  - 排查范围：CI workflow、`Dockerfile*`、shell 脚本、Makefile、`package.json#scripts`、文档中的示例命令。
- [ ] `--frozen-lockfile true|false` 这种显式取值形式不再被接受。实测 12.8.1 中 `pnpm install --frozen-lockfile false` 会把 `false` 当成包名，最终落到 `pnpm add` 的用法报错。
  - 替代写法：关闭用 `--no-frozen-lockfile`，开启用裸 `--frozen-lockfile`（不带 `true`）。
- [ ] `pnpm-workspace.yaml` 中未被识别的键不再静默忽略，并且是否致命取决于版本 pin：
  - 项目 pin 的 pnpm 版本被当前运行版本满足 → 直接失败并报 `ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS`（实测 12.8.1 复现，错误信息会给出“did you mean ...”建议）。
  - 无 pin 或 pin 不被满足 → 仅打印 `[WARN] The following settings in pnpm-workspace.yaml are not recognized by this version of pnpm and were ignored`（实测 12.8.1 复现），命令继续执行。
  - `pnpm config` 子命令永远不会因此失败，可用于抢救被写坏的配置文件。
  - 排查重点：拼错的键、为更高版本预留的键、从 v10 带过来的历史键。
- [ ] `allowBuilds` 值类型收紧：只接受 `true`/`false`/字符串。值不是对象、或某个值不是这三类时，v12 会直接以配置错误中断安装，而 v11 是静默忽略。
  - 上游 changeset 记录的错误码为 `ERR_PNPM_INVALID_ALLOW_BUILDS`；实测 12.8.1 传入数字值时报的是配置解析错误 `data did not match any variant of untagged enum AllowBuild`，传入数组时报 `expected mapping start`。症状都是安装无法开始，而不是构建被跳过。
- [ ] `pnpm setup`、`pnpm self-update` 等会改动全局安装的命令在 `sudo` 下失败并报 `ERR_PNPM_SUDO_NOT_SUPPORTED`。只读的全局命令（如 `pnpm bin --global`）不受影响。
  - 排查范围：容器构建脚本、CI 里习惯性加 `sudo` 的步骤。
- [ ] 开启 `engineStrict` 时，引擎不兼容的包不再因为整棵子树挂在 `optionalDependencies` 下而豁免，安装会直接失败（v11 只打印 install-check 告警）。仅通过 optional 边可达的包在 v11/v12 中仍会被跳过，行为未变。
- [ ] `pnpmfile` 的 `hooks.filterLog` 被忽略并告警，改用 `loglevel` 设置。
- [ ] 若 `ignoreScripts` 之外还依赖“关闭全部构建”的旧习惯，确认已切到 `allowBuilds`/`dangerouslyAllowAllBuilds`（见第 3 节）。

## 2) 结果变化项（不报错，但产物/行为不同，需人工确认）

- [ ] **一次性 lockfile 重排**：v12 在固定切点打断循环依赖，lockfile 只取决于依赖图，重排 workspace glob、重排 `package.json` 条目或重复安装都产出同样的字节。带循环的 workspace 解析 peer 快 2-3 倍、内存约降 25%、lockfile 变小。首次“重新解析”的 install 会重写循环包的 peer 变体，属于预期 diff；已有的 lockfile 在 `--frozen-lockfile` 下原样可用，不重新解析就不会被改写。
- [ ] **Git 依赖统一按 HTTPS 解析**：GitHub/GitLab/Bitbucket 的 specifier 只表示“要哪个仓库”，lockfile 永不再记录 SSH URL。旧 lockfile 里的 `git@github.com:...` 条目仍能安装，但重新解析时会改写。
  - 私有仓库要走 SSH，需改为机器级 Git 配置：`git config --global url."git@github.com:".insteadOf https://github.com/`
  - 未知主机的 URL 与内嵌凭据的 URL 仍按原样保留。
- [ ] `packageImportMethod: auto` 在 Linux 改为硬链接优先（btrfs 上物化 `node_modules` 约快 2 倍；ext4 本来就走硬链接，无变化）。若流程会直接编辑 `node_modules` 内的文件，显式改为 `clone`。
- [ ] 内置兼容性数据库删除了“静态分析”条目，部分只为类型而存在的依赖不再被自动安装；极端情况下可能影响个别包的解析，遇到“以前能装现在装不上”先回看这一条。
- [ ] `pnpm add <yarn|node|deno|bun>` 的语义变化：名字代表“那个工具”而不是同名 npm 包。`pnpm add -g yarn` 装当前 Yarn 主线；`pnpm add yarn@4` 会往 `package.json` 写 `packageManager` 字段。要装同名 npm 包需显式写源（`pnpm add yarn@npm:yarn@1.22.22`）。
- [ ] 全局 `node`/`deno`/`bun` shim 变为项目感知（`globalShims`，默认 `{node: true, deno: true, bun: true}`）；12.7 起还会跟随最近的 `.nvmrc` / `.node-version`。若曾用 pnpm 装过全局 node，行为会变。
- [ ] `pnpm install --force` 不再安装 `os`/`cpu`/`libc` 不匹配的 optional 依赖（12.7+），旧行为需 `forceIgnoresPlatform: true`。
- [ ] `pnpm install --frozen-lockfile` 不再安装已从 `pnpm-workspace.yaml` 移除的项目的依赖（12.6+）。
- [ ] 升级后所有带构建脚本的包会重建一次（12.8 起 side-effects cache 会恢复构建脚本创建的符号链接）→ 首次安装变慢属正常。
- [ ] CI 上显式 `preferFrozenLockfile: true` 不再允许用过期 lockfile 完成安装（12.8+）→ 必须保证 lockfile 已提交且与 `package.json` 一致。
- [ ] 仓库没有 `pnpm-workspace.yaml` 但 `package.json` 有 `workspaces` 字段时，v12 会据此自动创建 `pnpm-workspace.yaml`（12.7+）。确认这是期望行为，否则改用 `--ignore-workspace`。
- [ ] `pnpm pack` / `pnpm publish` 在产物包含未被 `files` 列出的 `.env` / `.env.*` 时告警（12.8+），模板文件如 `.env.example` 不告警。

## 3) 构建脚本审批（allowBuilds）

这一节是最容易踩坑、也最容易带着错误认知迁移的部分，务必以实测为准。

- [ ] **v12 只读 `allowBuilds`**。`onlyBuiltDependencies`、`onlyBuiltDependenciesFile`、`neverBuiltDependencies`、`ignoredBuiltDependencies`、`ignoreDepScripts` 自 v11 起就已经被忽略（上游源码中生效的 deps build 配置键只有 `allowBuilds` 与 `dangerouslyAllowAllBuilds`），v12 沿用该行为。
  - 实测（11.17.0 与 12.8.1 各一次）：同时写 `allowBuilds: {esbuild: false}` 与 `onlyBuiltDependencies: [esbuild]`，esbuild 的 postinstall **不执行** → `allowBuilds` 胜出，遗留键完全不生效。
  - 实测（11.17.0）：只写 `onlyBuiltDependencies: [esbuild]` → 报 `ERR_PNPM_IGNORED_BUILDS`。
  - 实测（11.17.0）：只写 `allowBuilds: {esbuild: true}` → 构建脚本正常执行，**不需要**配对写 `onlyBuiltDependencies`。
  - 结论：`onlyBuiltDependencies` 等键是 v10 迁移遗留物，可安全删除；保留也不会触发“未识别键”报错（它们仍在“已知但已废弃”名单内）。`pnpm approve-builds` 在 v12 已会自动清理这些遗留键。
- [ ] 占位符值必须清零。`pnpm install` 遇到未审批的构建依赖时，可能把该依赖以占位符字符串（如 `set this to true or false`）写进 `allowBuilds`。
  - 占位符是字符串，能通过 v12 的类型校验，但不会被当作 `true`，等同于未审批，仍会 `ERR_PNPM_IGNORED_BUILDS`。
  - 12.7 起 CI / 无终端环境不再自动写入占位符；交互式终端仍可能写入，因此仍需人工复查。
- [ ] 验证动作：删掉遗留键后跑一次 install，确认 `allowBuilds` 覆盖了所有需要构建脚本的依赖（如 esbuild、sharp、workerd、@parcel/watcher、better-sqlite3 等），且没有新增 `Ignored build scripts` 告警。可用 `pnpm approve-builds` / `pnpm install --allow-build=<pkg>` 补齐。

## 4) 版本、分发与安装方式

- [ ] Node 支持面变宽而非变窄：pnpm 11 只支持 Node 22+；pnpm 12 官方支持表为 Node 18/20/22/24/26。
- [ ] pnpm 12 是原生可执行文件，安装完成后不需要 Node.js；只有“通过 npm 安装 pnpm 本身”这一步需要 Node 22.13+。
  - 反向注意：`pnpm@11.x` 的 npm 包 `engines` 是 `>=22.13`，因此在 Node 20 环境里用 npm/corepack 安装或运行 pnpm 11 会失败，而 v12 的原生二进制绕开了这一约束。
- [ ] 平台矩阵（12.4.0 起）：Linux glibc `x64`/`arm64`/`riscv64`/`ppc64le`/`s390x`、Linux musl `x64`/`arm64`、macOS `arm64`/`x64`、Windows `x64`/`arm64`、FreeBSD `x64`、Android `arm64`/`x64`。没有预编译二进制的目标只能继续用 JavaScript 版 pnpm 11。
- [ ] 升级命令：`pnpm self-update`（要求当前版本 >= 11.10.0）。
  - ⚠️ 在**已 pin pnpm**的项目里执行 `pnpm self-update` 只改 `package.json` 里的 pin，不安装全局；要升级全局 pnpm 必须在项目外执行。
  - ⚠️ 不使用更新提示里的 `pnpm add -g pnpm`，该路径已被官方废弃并指向 `self-update`。
- [ ] Corepack：官方在 v12 中已移除对 `COREPACK_ENABLE_STRICT=0` 的支持，并在贡献指南中明确要求不要用 Corepack 安装 pnpm —— Corepack 只 shim `pnpm`/`pnpx`，不创建 `pn`/`pnx` 别名，会在脚本里报 `pn: Permission denied`。
  - `pnpm doctor`（v11.14.0+）会直接报告 pnpm 正被 Corepack 运行，并提示 `self-update` 不可用。
  - 若仓库的 `Dockerfile*`、`.devcontainer`、CI 里使用 corepack，迁移时优先改成独立安装脚本或 `pnpm/setup`。

## 5) CI 与容器

- [ ] GitHub Actions：`pnpm/action-setup`（现为 v6.x）仍可用；官方 CI 文档已改为推荐 `pnpm/setup`，它在一步内安装 pnpm 与运行时。两者都不写 `version` 时，版本取自 `package.json` 的 `packageManager` 或 `devEngines.packageManager` —— 这是升级时**唯一**需要改动的版本杠杆，不要在多处重复 pin。
- [ ] Docker：v12 提供 `linux-x64-musl` 与 `linux-arm64-musl` 预编译二进制，Alpine/musl 与多架构构建可用。但自建基镜像内 pnpm 的安装方式未知，必须实跑确认，而不是假设。
  - 验证动作：在基镜像内执行 `pnpm --version`，并跑一次 `pnpm install --frozen-lockfile`。
- [ ] CI 在检测到 lockfile 由**更新的 major** 写出时会直接失败而不是静默重写 → CI 与本地使用的 major 必须一致。
- [ ] 独立安装脚本（`get.pnpm.io/install.sh`）不依赖 Node，可作为容器与 CI 的兜底路径。
- [ ] 全局 node/deno/bun shim 变为项目感知后，若 CI 依赖 `node` 走全局版本，需确认 `globalShims` 与 `devEngines.runtime` 的交互符合预期。

## 6) 推荐迁移顺序

1. 先在小仓库或工具仓试点，再切 Docker 仓库，最后才动带 Vercel 部署与巨型 lockfile 的 workspace 仓库。
2. 单仓库执行：

  ```bash
  # 1) 升级 pnpm 本体（>= 11.10.0 可直接升；不要在已 pin 的项目里期望它装全局）
  pnpm self-update
  pnpm --version            # 期望 12.x

  # 2) 唯一代码级改动：package.json 的 packageManager 字段
  #    "packageManager": "pnpm@12.x.y"
  #    仅在该字段原本已存在时才改；原本没有就不要新增

  # 3) 重组依赖并生成新 lockfile
  rm -rf node_modules
  pnpm install
  git diff --stat pnpm-lock.yaml     # 检查一次性 peer 变体重写

  # 4) 诊断 + 最小充分质量门
  pnpm doctor
  pnpm lint && pnpm typecheck && pnpm test && pnpm build

  # 5) 提交 pin + lockfile，推分支跑一次 CI
  ```

3. Docker 仓库额外验证镜像内 `pnpm --version` 与一次 frozen install；Vercel 类平台额外跑一次 preview 部署。

## 7) 验证与回滚

- [ ] 验证顺序：安装成功 → `pnpm doctor` 无 fail → lockfile diff 符合预期 → 最小充分质量门 → CI。涉及 CI/锁文件/配置迁移时升级为完整质量门。
- [ ] 回滚：`git revert` pin + lockfile 提交，再把 pnpm 本体退回 11 线。
  - lockfile 格式未变，回滚不需要手写 lockfile。实测两者均为 `lockfileVersion: '9.0'`，且 pnpm 11.17.0 能以 `--frozen-lockfile` 直接安装 pnpm 12.8.1 写出的 lockfile。
- [ ] ⚠️ pin 会反向生效：在 pin 为 `pnpm@12.x` 的项目里执行 pnpm 11，pnpm 会下载并切换到 pin 的版本运行（实测表现为命令结束时打印 `using pnpm v12.8.1`）。因此回滚必须**同时**改 `packageManager` 字段，只降级本地 pnpm 本体无效。

## 8) 来源

1. pnpm 12.0 发布说明 <https://pnpm.io/blog/releases/12.0>
2. What's different in pnpm 12 <https://pnpm.io/blog/whats-different-in-pnpm-12>
3. 安装文档（平台矩阵、Node 要求） <https://pnpm.io/installation>
4. 迁移指南（v10 -> v11/v12 配置模型） <https://pnpm.io/migration>
5. 12.6 / 12.7 / 12.8 发布说明 <https://pnpm.io/blog/releases/12.6>、<https://pnpm.io/blog/releases/12.7>、<https://pnpm.io/blog/releases/12.8>
6. 构建设置文档（`allowBuilds`、`strictDepBuilds`） <https://pnpm.io/settings/build>
7. 持续集成文档（`pnpm/setup`、CI 下的 lockfile 行为） <https://pnpm.io/continuous-integration>
8. `pnpm self-update` 与 `pnpm doctor` 文档 <https://pnpm.io/cli/self-update>、<https://pnpm.io/cli/doctor>
9. 上游源码与 changeset（`DEPS_BUILD_CONFIG_KEYS`、`ERR_PNPM_INVALID_ALLOW_BUILDS`、`approve-builds` 清理遗留键） <https://github.com/pnpm/pnpm>
10. Corepack 相关决策 <https://github.com/pnpm/pnpm/issues/13884>、<https://github.com/pnpm/pnpm/pull/14159>
11. npm registry 元数据实测（12.8.1 的 `bin`、`engines`、`optionalDependencies`；11.17.0 的 `engines`）
12. 本地实跑（12.8.1 / 11.17.0）：命令行拒绝、未知键告警与报错、`allowBuilds` 优先级、lockfile 互读
