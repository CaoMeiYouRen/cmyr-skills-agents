---
name: devops-specialist
description: 修改 Docker / docker-compose、CI/CD（GitHub Actions）、部署配置（Vercel / Cloudflare / VPS）、环境变量、运行时参数、构建脚本与发布流程时使用。用户提到 deploy、Dockerfile、镜像、registry、workflow、actions、CI、CD、environment variables、build pipeline、release、rollback、反代、nginx 时都应触发。

metadata:
  internal: false
---

# DevOps Specialist

铁律：没确认运行环境、命令真源和回滚路径之前，不动部署配置。

## 工作流

- [ ] Step 1: 对齐三个真源 ⚠️ REQUIRED
	- [ ] 1.1 命令真源 = `package.json#scripts`。workflow、Dockerfile、compose、文档里的构建与启动命令都必须调它，不能各写一份。
	- [ ] 1.2 包管理器真源 = `packageManager`，它是唯一的 pin：`pnpm/action-setup` 不写 `version`，Dockerfile 侧的 corepack 也读它（细则见 [references/ci-workflows.md](./references/ci-workflows.md) §1）。
	- [ ] 1.3 平台真源 = workflow / vercel.json / wrangler.toml / compose。相互冲突时先确认「线上实际按哪个跑」，不要把本地习惯当事实。
- [ ] Step 2: 盘点运行环境与回滚 ⚠️ REQUIRED
	- [ ] 2.1 运行时版本看镜像 tag / 平台 runtime，`engines` 只是声明；版本判定的口径见 [runtime-cve-impact-check](../security-guardian/references/runtime-cve-impact-check.md)。
	- [ ] 2.2 环境变量分构建期注入（进产物，改了要重新构建）与运行期注入（重启生效）。`NUXT_` 前缀的布尔 / 数字是字符串转来的，容易被解析成意外取值，改运行时配置时按项目 `AGENTS.md` 的约定核对。
	- [ ] 2.3 回滚点：上一版镜像 tag / 上一版部署是否还在；数据库迁移等不可逆点单独标注。
- [ ] Step 3: 实施变更
	- [ ] 3.1 容器：多阶段、非 root、`.dockerignore` 排除 `node_modules`/`dist`/`.git`/`.env*`、基础镜像与运行时对齐、tag 同时给版本与 sha（不能只有 `latest`）。细节见 [references/docker-image.md](./references/docker-image.md)。
	- [ ] 3.2 CI：缓存 key 含锁文件哈希、`permissions` 最小化、`concurrency` 取消过期运行、`timeout-minutes` 兜底；Python 项目测试矩阵必须含 Windows。细节见 [references/ci-workflows.md](./references/ci-workflows.md)。
	- [ ] 3.3 Serverless 边界：平台托管的 runtime 由平台打补丁；长任务、常驻进程、写本地盘、原生模块（`sharp` / `better-sqlite3` 类）都要先核实平台是否允许，不要按 VPS 假设写。
	- [ ] 3.4 secrets 只走平台 secret / OIDC；`docker build --build-arg` 传的值会留在镜像层历史里，不能当敏感注入。
- [ ] Step 4: 验证与回滚
	- [ ] 4.1 构建通过 ≠ 可运行：external 依赖只在运行时加载，发布前对实际产物跑一次最小真实调用（判据见 [references/ci-workflows.md](./references/ci-workflows.md) §4）。
	- [ ] 4.2 需要生成物的项目（Nuxt / VitePress）先跑 prepare 再 typecheck（顺序与症状见 §4）。
	- [ ] 4.3 workspace 新增运行时依赖时同步所有构建链的 `--filter`（原因与清单见 §5）。
	- [ ] 4.4 交付时写出验证过的命令与回滚动作，而不是「已部署」。

## 参考文档

- 容器镜像（多阶段、构建缓存、非 root、健康检查、tag 与三仓推送）→ [references/docker-image.md](./references/docker-image.md)
- CI 工作流（版本对齐、缓存、权限、矩阵、发布与冒烟）→ [references/ci-workflows.md](./references/ci-workflows.md)
- 反代 / 网关层（nginx ↔ OpenResty ↔ NPM、真实 IP、指纹头、灰度回滚）→ [references/reverse-proxy-gateway.md](./references/reverse-proxy-gateway.md)

## 反模式

- 在 Dockerfile / workflow 里重写一套构建命令，与 `scripts` 形成双源。
- CI 因锁文件或构建审批失败，就关掉 frozen-lockfile 或跳过脚本校验。
- 镜像只打 `latest`，出事回不到上一版。
- 构建全绿就宣布可发布（external 依赖的问题只在运行时暴露）。
- 把 serverless 当 VPS：常驻进程、写本地盘、跑长任务。
- 把 `allowBuilds` 缺失当 CI 问题处理——它属构建审批配置，见 [pnpm-major-migrator](../pnpm-major-migrator/SKILL.md)。

## 交付前检查

- [ ] 三个真源一致（scripts / packageManager / 平台配置）。
- [ ] 运行时版本与镜像 tag 可核对，回滚点存在。
- [ ] 未引入硬编码 secrets；生产默认值不是空凭据、通配或关闭鉴权。
- [ ] 产物已冒烟，或说明了为何无法冒烟。
- [ ] 给出验证命令与回滚方式。

## 维护者参考

重构、合并、降级或删除本技能前，先读 [references/rationale.md](./references/rationale.md)：存在理由、失效判据、能力替代与不可推断的划分。执行部署任务时不需要加载它。
