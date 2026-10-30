# CI 工作流契约（GitHub Actions）

面向 `.github/workflows/*` 的变更。目标是：本地能过、CI 也能过；失败时能定位；发布可重跑。

## 1 版本与锁文件

- `pnpm/action-setup` **优先不写 `version`**，让 `packageManager` 作单一真源（与 pnpm-major-migrator 的「不要多处重复 pin」一致）。必须写时就要与 `packageManager` 一致，否则 setup 步直接报 `Multiple versions of pnpm specified`；绕过 corepack 时 pnpm 自己会报 `This project is configured to use X of pnpm. Your current pnpm is vY`。
- `actions/setup-node` 的 `cache: pnpm` 必须放在 `pnpm/action-setup` **之后**，否则报 `Unable to locate executable file: pnpm`（这比缓存失效更常见）。
- CI 上 pnpm 默认 frozen：锁文件与 manifest 不一致会直接失败。**不要用 `--no-frozen-lockfile` 绕过**——先在本地 `pnpm install` 把锁文件一起提交；锁文件损坏的修复流程见 [security-alert-remediator](../../security-alert-remediator/SKILL.md)。
- 缓存 key 必须含 `pnpm-lock.yaml` 的哈希（`actions/setup-node` 的 `cache: pnpm` 已自动处理）；手写 `actions/cache` 时漏掉哈希=命中旧依赖，症状是「新装的包在 CI 里找不到」。
- Node 版本用 `node-version-file: .nvmrc` 或显式矩阵；`lts/*` 只保证取当时最新 LTS，不锁定补丁线，也不代表运行时一致。

## 2 权限与并发

- `permissions` 从最小开始：未声明时继承仓库 / 组织默认（新仓通常只读，老仓可能读写），不要假设只读；发布 job 单独给 `contents: write`（tag / Release）与 `id-token: write`（OIDC 发布）。
- `concurrency` 只在 PR 上取消旧运行，避免把 main 上跑到一半的发布掐掉：

  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: ${{ github.event_name == 'pull_request' }}
  ```

- 每个 job 设 `timeout-minutes`。挂死比失败更贵：默认 6 小时会把并发额度吃光。
- `uses:` 一律钉不可变版本（commit sha）；发布路径禁止 `@latest` 与浮动 major（见项目 `AGENTS.md` 的 Actions 版本钉定规则）。

## 3 矩阵与环境差异

- Python 项目测试矩阵必须含 `windows-latest`：路径分隔符、换行、编码问题只在 Windows 暴露。
- 不要在矩阵里跨 OS 复用同一段 shell 命令（`bash` 与 `pwsh` 的引号/变量展开不同）；需要跨平台时写 Node 脚本。
- 需要原生模块的步骤不要跨 OS 假设预编译产物可用。

## 4 发布 job

- 版本号走 semantic-release（或项目既有方案），不在 workflow 里手写版本，也不在 PR 里改 `version` 字段。
- 发布前对**实际产物**冒烟：`node dist/bin.mjs --help` 一类最小真实调用。`lint` / `typecheck` / `build` 全绿不代表可运行——`tsdown` 的 external 依赖只在运行时加载。
- **幂等**：tag / Release 已存在时跳过而不是失败；发布中断后重跑要能自愈（典型中间态：包已发布但 tag 缺失）。
- git 写操作（commit / tag）需要显式配置 committer 身份（`github-actions[bot]` 一类），不要依赖某个条件步骤顺手设置，否则手动触发时会出现 `Committer identity unknown`。
- 工作流依赖生成物时（Nuxt / VitePress），在 typecheck 前执行 prepare；缺 `.nuxt/tsconfig` 会报与改动无关的 TS 解析错误。

## 5 缓存、产物与 workspace

- `actions/upload-artifact` 的路径要与真实产物目录一致（`dist/`、`.output/`）；被 gitignore 的目录不会凭空出现在 runner 上。
- 缓存只缓存可重建的东西（包管理器 store、构建缓存），不要把 `node_modules` 与产物混在一个 key 里。
- workspace 新增运行时依赖时，同步所有构建链的 `--filter` 列表（test / Dockerfile / action / release 各一处）；`pnpm --filter X build` 不会自动构建依赖。

## 6 失败诊断

- 只报 exit code 无法定位：失败时输出脱敏后的 stdout/stderr 摘要（长日志取失败命令前后各 ~50 行，保留可复现命令）。
- 能本地复现的命令要写进 job 名字或 step 名，避免「CI 红了自己猜」。
- fork PR 拿不到 secrets：需要 secret 的 job 要显式跳过并说明，不能默认失败。

## 7 验证清单

- [ ] 未重复 pin pnpm 版本（`packageManager` 为单一真源）。
- [ ] 锁文件 frozen 且没有被绕过
- [ ] 缓存 key 含锁文件哈希
- [ ] `permissions` / `concurrency` / `timeout-minutes` 已设置
- [ ] 发布 job 有产物冒烟与幂等处理
- [ ] 失败时能定位到具体命令与输出
