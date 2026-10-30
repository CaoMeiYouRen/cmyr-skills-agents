# 容器镜像契约

面向 Dockerfile 与 docker-compose 的变更。目标是：构建可复现、镜像可回滚、运行期不靠运气。

## 1 基础镜像

### 1.1 选来源，不要用 `apk add nodejs`

- 版本以项目 `engines` / `.nvmrc` 为准，Dockerfile 用 `ARG NODE_VERSION` 传，别把某一年的补丁号抄死。**2026-10-30 观测**：26 是 active LTS（10-28 起），24 与 22 已进入 maintenance（24 的 active 支持 10-20 结束）。
- 运行时来源优先官方 `node:<version>-alpine<alpine>`：多架构 manifest 齐全，OpenSSL / brotli / c-ares 静态链接，补丁随上游发布。
- **不要写 `node:<version>-alpine`（不带 Alpine 小版本）**：它现在会落到 Alpine 3.24+，在未知 / 老宿主上正好踩 §1.2 的坑。
- **安装 pnpm 时以 `packageManager` 为准**：有该字段时 pnpm 会读它取精确版本（构建期需能取到该版本）；没有该字段就钉补丁号，别写浮动的 `pnpm@11`。
- **不要用 `apk add nodejs` 当运行时来源**：nodejs 包随 aports 打包节奏走，安全公告后重建能否拿到修复版取决于打包者，且 Node 的 CVE 常需要 nodejs 与 brotli-libs 两侧同时更新（观测：2026-10-22 时 Alpine 3.24 还是 24.18.1，10-30 已是 24.22.1——版本会漂，但不由你控制）。
- **不要用官方 musl tarball 做多架构**：`linux-x64-musl` 有，`linux-arm64-musl` 没有；多架构只能走官方镜像（或自行编译）。
- **Node 25+ 官方镜像不再内置 corepack，26+ 连 yarn 也没有**：镜像里要 pnpm 就显式装（`npm i -g pnpm@11`），别指望 `corepack enable`。
- 钉 digest 保证可复现（`node:24.22.2-alpine3.23@sha256:…`）；tag 只到 major.minor 时看不出补丁，按 [runtime-cve-impact-check](../../security-guardian/references/runtime-cve-impact-check.md) 的方法换算真实版本。
- Docker Hub 拉取受限时，`public.ecr.aws/docker/library/node` 是同一份镜像（同一 digest）。

### 1.2 Alpine / musl 与宿主内核

- **Alpine 3.24 起（musl 1.2.6）把 `pwrite()` 改走 `pwritev2(RWF_NOAPPEND)`**。在「内核 < 4.6 + libseccomp 过旧」的老宿主上，Docker seccomp 会把它拦成 `EPERM` 且 musl 不会回退（musl 只对 `EOPNOTSUPP` / `ENOSYS` 退让）：症状是 PHP session 丢失、SQLite `disk I/O error`、Node 带 offset 的写入 `EPERM`（注意是 `EPERM` 不是 `EACCES`）。保守边界按 libseccomp < 2.3.3 处理（2.3.2 的 syscall 表已含 Linux 4.10，实际边界以目标宿主实测为准）。
- 面向未知 / 老宿主的镜像把 Alpine 固定在 3.23（musl 1.2.5）；确定宿主是新内核才跟最新。判定用**功能探测**（在目标宿主真跑一次 `pwrite()`），不能只看版本号。
- Alpine 3.23 的支持期到 **2027-11**；到期后的升级路径：等上游给出 musl 修复 → 用 x64 musl tarball（仅 amd64）→ 自编译 musl Node → 退回 glibc 基底 → 接受风险并在目标宿主做运行期自检。
- 既要安全补丁又要避开该问题：用官方 `node:<ver>-alpine3.23`——Node 二进制静态链接，不依赖 Alpine 的 nodejs / brotli-libs 包。

### 1.3 体积构成（官方镜像为什么大）

官方镜像比 `apk add nodejs` 大，主要不是静态链接。以下是 2026-10、Node 24.x 上的量级（原口径：minimize rootfs 的 `du` 差值，四项不可直接相加）：

| 来源 | 量级 | 说明 |
| --- | --- | --- |
| 完整 ICU 数据 | +29 MiB | Alpine 默认只装 `icu-data-en` |
| 未 strip 的调试符号 | +17 MiB | Alpine 包是 stripped，官方二进制不是 |
| 额外工具 | +16 MiB | npm / corepack / yarn / headers；Node 26 起 corepack、yarn 已移除，这一项会缩水 |

静态链接本身净增约 2 MiB。`+16 MiB` 那一行是 full 镜像口径（不属于 minimize 差值）；minimize 另有 section / 重定位等约 +12.6 MiB 未列出。要瘦先看前两项，别盲目 strip 或改 tarball。

### 1.4 构建期安全基线

- 在 Dockerfile 里断言运行时版本不低于当前安全基线（低于就 `exit 1`），防止基础镜像 tag 回退把旧 Node 带回来：

  ```dockerfile
  ARG NODE_MIN_VERSION=24.22.1
  RUN node -e "const need=process.env.NODE_MIN_VERSION.split('.').map(Number),cur=process.versions.node.split('.').map(Number);const lt=cur[0]<need[0]||(cur[0]===need[0]&&(cur[1]<need[1]||(cur[1]===need[1]&&cur[2]<need[2])));if(lt){console.error('Node '+process.versions.node+' 低于安全基线 '+process.env.NODE_MIN_VERSION);process.exit(1)}"
  ```

- 断言用**版本号**：cherry-pick 的安全修复常常不改 `process.versions` 里的组件版本（如 brotli 修复前后都是 `1.2.0`），拿它判定会把未修复的镜像当成已修复。
- `NODE_MIN_VERSION` 随安全公告更新，取值见公告的修复版本（2026-10 的三条线：22.23.4 / 24.22.1 / 26.12.1）；换 Node 大版本时同步换基线，改它要连同消费方镜像一起重建。

### 1.5 架构与原生模块

- 本地 Apple Silicon 默认构建 arm64，推到 amd64 服务器会 `exec format error`；多架构用 `docker buildx build --platform linux/amd64,linux/arm64 --push`（多架构只能 `--push`；`--load` 仅单架构或 containerd image store 可用）。
- `sharp` / `bcrypt` / `better-sqlite3` 这类原生模块依赖 musl 预编译变体（如 `@img/sharp-linuxmusl-*`）；变体缺失时安装会静默跳过可选依赖、到运行时才报错。需要时用 pnpm 的 `supportedArchitectures.libc` 声明目标平台，或换 slim 并在镜像内实测一次真实启动。

## 2 Dockerfile 结构

```dockerfile
# 版本、Alpine、镜像源都走 ARG；默认值是起点，按项目 engines/.nvmrc 覆盖
ARG NODE_IMAGE=node
ARG NODE_VERSION=24.22.2
ARG ALPINE_VERSION=3.23
ARG NODE_MIN_VERSION=24.22.1

FROM ${NODE_IMAGE}:${NODE_VERSION}-alpine${ALPINE_VERSION} AS base
ARG NODE_MIN_VERSION
WORKDIR /app
# 安全基线：低于公告修复版直接失败
RUN node -e "const need=process.env.NODE_MIN_VERSION.split('.').map(Number),cur=process.versions.node.split('.').map(Number);const lt=cur[0]<need[0]||(cur[0]===need[0]&&(cur[1]<need[1]||(cur[1]===need[1]&&cur[2]<need[2])));if(lt){console.error('Node '+process.versions.node+' 低于安全基线 '+process.env.NODE_MIN_VERSION);process.exit(1)}"
# Node 25+ 官方镜像已无 corepack：pnpm 显式装，大版本与 packageManager 对齐
RUN npm i -g pnpm@11 && npm cache clean --force
COPY package.json pnpm-lock.yaml ./

FROM base AS deps
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

# 生产依赖：单独一层，避免把 devDependencies 带进镜像
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile

# 运行层：不含 pnpm，也不含 devDependencies
FROM ${NODE_IMAGE}:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/index.mjs"]
```

`node:<ver>-alpine<alpine>` 不含 pnpm，Node 25+ 也不含 corepack：运行层若还要跑 `pnpm install` 会 `/bin/sh: pnpm: not found`，所以生产依赖放在 `prod-deps` 装好再拷。

monorepo 版。注意：workspace 下只拷根 manifest 会让 `pnpm install --frozen-lockfile` 直接返回 `Already up to date`、`node_modules` 为空，**不报错**——`--frozen-lockfile` 只校验锁文件与 manifest 一致，不校验「workspace 包清单是否齐全」：

```dockerfile
ARG NODE_IMAGE=node
ARG NODE_VERSION=24.22.2
ARG ALPINE_VERSION=3.23
ARG NODE_MIN_VERSION=24.22.1

FROM ${NODE_IMAGE}:${NODE_VERSION}-alpine${ALPINE_VERSION} AS base
ARG NODE_MIN_VERSION
WORKDIR /app
RUN node -e "const need=process.env.NODE_MIN_VERSION.split('.').map(Number),cur=process.versions.node.split('.').map(Number);const lt=cur[0]<need[0]||(cur[0]===need[0]&&(cur[1]<need[1]||(cur[1]===need[1]&&cur[2]<need[2])));if(lt){console.error('Node '+process.versions.node+' 低于安全基线 '+process.env.NODE_MIN_VERSION);process.exit(1)}"
RUN npm i -g pnpm@11 && npm cache clean --force
COPY . .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# 先构建再 deploy：deploy 只复制现有产物，不会替你跑 build
# `...` 表示连同 workspace 依赖一起构建；少了它，依赖包的 dist 不会生成
FROM base AS pruned
RUN pnpm --filter <pkg>... build
RUN pnpm --filter <pkg> deploy --prod /out

FROM ${NODE_IMAGE}:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=pruned /out ./
USER node
EXPOSE 3000
CMD ["node", "dist/index.mjs"]
```

- 不要默认加 `pnpm fetch` + `--offline`：仓库带 `packageManager` 时，pnpm 还要解析自身版本，纯离线 install 会失败（实测 `Failed to resolve pnpm@11.28.5`）；缓存交给 `--mount=type=cache` 即可。

- `pnpm deploy` 在 pnpm 10 需要 `inject-workspace-packages: true`（或加 `--legacy`）；pnpm 11+ 直接可用。
- `pnpm deploy` 产出的是可直接运行的目录（含该包生产依赖），但其中的 `workspace:` 依赖会写成 `file:` 路径，**不保证该目录还能重新 `pnpm install`**。
- 构建层不要把 `.env` 拷进去，`.dockerignore` 兜底。
- `--mount=type=cache` 需要 BuildKit（默认已开）；CI 里若用旧 builder 要显式 `DOCKER_BUILDKIT=1`。

## 3 `.dockerignore` 必含

```
node_modules
dist
.output
.nuxt
.git
.github
.env*
coverage
*.log
```

漏掉 `node_modules` 会让构建上下文暴涨，且可能把本地平台相关的二进制带进去。

## 4 运行期契约

- **非 root**：`USER node`。需要写盘时只挂 `tmpfs` 或显式卷，不要在容器里写工作目录。
- **信号**：容器里的 PID 1 默认不处理 SIGTERM，`docker stop` 会等超时后 SIGKILL。用 compose 的 `init: true`、`tini`，或在应用里监听 SIGTERM 做优雅退出。
- **健康检查**：优先复用真实业务端点，没有再加轻量探针，例如

  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  ```

- **compose**：`depends_on` 配 `condition: service_healthy`，否则「起来了」不代表「能连上」；`env_file` 与平台 secret 不要双写。

## 5 tag 与推送

- 每次构建产生三个 tag：`<version>`、`sha-<完整 sha>`、`latest`。`latest` 只是方便拉取，**回滚依据是版本 tag 或 digest**。
- 同一 digest 打多个 tag，不要为不同仓库重复构建。
- 镜像发布目标按项目 `AGENTS.md` 的镜像发布约定执行（常见组合是 docker.io + ghcr.io + 可选国内镜像仓），本技能不重复维护该清单。
- 多仓推送用一条 build-push：每个 registry 各自 login，并把 tag 行换成该仓的 `IMAGE` 前缀（示例只展示一个仓），复用同一份构建与缓存。多架构构建需要 buildx：

  ```yaml
  - uses: docker/setup-buildx-action@<sha>
  - uses: docker/login-action@<sha>        # 每个 registry 一次
  - uses: docker/build-push-action@<sha>
    with:
      platforms: linux/amd64,linux/arm64
      push: true
      tags: |
        ${{ env.IMAGE }}:${{ github.ref_name }}
        ${{ env.IMAGE }}:sha-${{ github.sha }}
        ${{ env.IMAGE }}:latest
      cache-from: type=gha
      cache-to: type=gha,mode=max
  ```

  `latest` 不要用 step 级 `if:` 去限制（那会把整个构建/推送步骤一起跳过）；要么用 `docker/metadata-action` 的 `type=raw,value=latest,enable={{is_default_branch}}`，要么在 `tags` 里条件化该行。action 一律钉不可变版本（见项目 `AGENTS.md` 的 Actions 版本钉定规则）。
- 自建镜像的 tag 可能只到 `major.minor`，甚至只有日期，看不出补丁版本；线上真实版本以容器内 `node -v` 为准。
- 回滚 = 用旧 tag 部署。`docker compose restart` **不会**换镜像；`up -d` 在 tag 未变时也不会重新 pull（默认 pull policy 是 `missing`）。回滚要显式 `docker compose pull && docker compose up -d`，或用 `up -d --pull always`。

## 6 常见硬失败

| 现象 | 根因 | 处理 |
| --- | --- | --- |
| `ERR_PNPM_IGNORED_BUILDS` | `pnpm-workspace.yaml` 缺 `allowBuilds` | 按 [pnpm-major-migrator](../../pnpm-major-migrator/SKILL.md) 修配置，不要关校验 |
| `exec format error` | 构建架构与部署架构不一致 | buildx `--platform` 对齐 |
| 写文件报 `EPERM`（不是 `EACCES`） | Alpine ≥ 3.24 的 musl 在老内核 + 旧 seccomp 上 `pwritev2` 被拦且不回退 | 换 `-alpine3.23` 基底，见 §1.2 |
| 安全公告后重建，`node -v` 仍是旧版 | 基底用 `apk add nodejs`，补丁随 aports 打包节奏，重建不一定拿到修复版 | 改用官方 `node:<ver>-alpine` 基底，见 §1.1 |
| 镜像体积异常 | 把 `node_modules` / 源码 / `.git` 拷进运行层 | 多阶段 + `deploy`，检查 `.dockerignore` |
| 启动即退出 | `CMD` 指向未构建产物，或权限不足 | `docker run --rm -it <img> sh` 手动执行 CMD 复现 |
| 改了代码但没生效 | 用了 `restart`，或 `up -d` 没重新 pull | `up -d --build` / `compose pull && up -d` |

## 7 验证清单

- [ ] `docker build` 成功，`docker run` 后健康检查通过
- [ ] `docker exec <c> node -v` 与预期运行时一致（不是 tag 名推断出来的）
- [ ] 基础镜像同时钉住 Node 与 Alpine 版本（或 digest），可追溯到具体一次构建
- [ ] 多架构发布前，`docker buildx imagetools inspect <img>` 能看到目标架构
- [ ] 构建阶段镜像内 `pnpm -v` 与 `packageManager` 一致；运行层 `command -v pnpm` 应为空
- [ ] 宿主可能是老内核时，已在目标宿主做过一次写文件探测（见 §1.2）
- [ ] 以非 root 运行（`docker exec <c> id -u` 不为 0）
- [ ] 镜像内没有 `.env`，也没有 devDependencies
- [ ] 至少保留一个可回滚的旧 tag / digest
