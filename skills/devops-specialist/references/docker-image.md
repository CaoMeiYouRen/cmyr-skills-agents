# 容器镜像契约

面向 Dockerfile 与 docker-compose 的变更。目标是：构建可复现、镜像可回滚、运行期不靠运气。

## 1 基础镜像

- 与运行时对齐：`FROM node:22-alpine` 要与 `engines` / `.nvmrc` 指向同一大版本；自建镜像的 tag 常看不出真实版本，先换算（方法见 [runtime-cve-impact-check](../../security-guardian/references/runtime-cve-impact-check.md)）。
- alpine 用的是 musl，`sharp` / `bcrypt` / `better-sqlite3` 这类原生模块依赖对应的 musl 预编译变体（如 `@img/sharp-linuxmusl-*`）；变体缺失时安装会静默跳过可选依赖、到运行时才报错。需要用 pnpm 的 `supportedArchitectures.libc` 声明目标平台，或换 slim 并在镜像内实测一次真实启动。
- 架构：本地 Apple Silicon 默认构建 arm64，推到 amd64 服务器会 `exec format error`；多架构用 `docker buildx build --platform linux/amd64,linux/arm64 --push`（多架构只能 `--push`；`--load` 仅单架构或 containerd image store 可用）。

## 2 Dockerfile 结构

```dockerfile
# 依赖层：只拷 manifest，最大化缓存复用（构建阶段可启用 corepack）
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# 构建层
FROM deps AS build
COPY . .
RUN pnpm build

# 生产依赖：单独一层，避免把 devDependencies 带进镜像
FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile

# 运行层：不含 pnpm，也不含 devDependencies
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/index.mjs"]
```

`node:22-alpine` 默认没有 pnpm：运行层若还要跑 `pnpm install`，会直接 `/bin/sh: pnpm: not found`；所以生产依赖放在构建阶段的 `prod-deps` 里装好再拷。

monorepo 版。注意：workspace 下只拷根 manifest 会让 `pnpm install --frozen-lockfile` 直接返回 `Already up to date`、`node_modules` 为空，**不报错**——`--frozen-lockfile` 只校验锁文件与 manifest 一致，不校验「workspace 包清单是否齐全」：

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile

# 先构建再 deploy：deploy 只复制现有产物，不会替你跑 build
# `...` 表示连同 workspace 依赖一起构建；少了它，依赖包的 dist 不会生成
FROM deps AS pruned
RUN pnpm --filter <pkg>... build
RUN pnpm --filter <pkg> deploy --prod /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=pruned /out ./
USER node
EXPOSE 3000
CMD ["node", "dist/index.mjs"]
```

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
- 回滚 = 用旧 tag 部署。`docker compose restart` **不会**换镜像；`up -d` 在 tag 未变时也不会重新 pull（默认 pull policy 是 `missing`）。回滚要显式 `docker compose pull && docker compose up -d`，或用 `up -d --pull always`。

## 6 常见硬失败

| 现象 | 根因 | 处理 |
| --- | --- | --- |
| `ERR_PNPM_IGNORED_BUILDS` | `pnpm-workspace.yaml` 缺 `allowBuilds` | 按 [pnpm-major-migrator](../../pnpm-major-migrator/SKILL.md) 修配置，不要关校验 |
| `exec format error` | 构建架构与部署架构不一致 | buildx `--platform` 对齐 |
| 镜像体积异常 | 把 `node_modules` / 源码 / `.git` 拷进运行层 | 多阶段 + `deploy`，检查 `.dockerignore` |
| 启动即退出 | `CMD` 指向未构建产物，或权限不足 | `docker run --rm -it <img> sh` 手动执行 CMD 复现 |
| 改了代码但没生效 | 用了 `restart`，或 `up -d` 没重新 pull | `up -d --build` / `compose pull && up -d` |

## 7 验证清单

- [ ] `docker build` 成功，`docker run` 后健康检查通过
- [ ] `docker exec <c> node -v` 与预期运行时一致
- [ ] 以非 root 运行（`docker exec <c> id -u` 不为 0）
- [ ] 镜像内没有 `.env`，也没有 devDependencies
- [ ] 至少保留一个可回滚的旧 tag / digest
