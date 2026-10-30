# DevOps Specialist — 设计理由（Why）

> 面向维护者。调用本技能时不需要读本文件；只有重构、合并、降级或删除时才需要。
> 触发看 `SKILL.md` 的 `description`，工作流看 `SKILL.md` 正文；本文件只回答"为什么存在、何时该消失"。

## 1. 存在理由

旧版正文是「确认目标平台」「保持职责分层」这类无法判定的叙述，执行者拿不到动作；同时把 `allowBuilds` 写了四遍，与 `pnpm-major-migrator`、`security-alert-remediator` 三方重复。

没有本技能时，可观察的损失有三类：workflow / Dockerfile / `scripts` 形成多套命令；镜像只打 `latest` 导致无法回滚；`lint + typecheck + build` 全绿就发布，external 依赖的问题在上线后才暴露。

## 2. 设计哲学

部署变更的每一步都要能指向一个**可核对的真源**或一条**可复现的命令**；指不到的，就是注释，不是契约。

## 3. 关键假设

- 项目以 `package.json#scripts` 作为命令入口。
- 目标平台是 Docker / GitHub Actions / Vercel / Cloudflare 之一。
- 项目特有参数（镜像仓、部署目标、健康检查路径）由项目 `AGENTS.md` 承载。

前提被破坏时：真源规则退化为口号；平台差异被按 VPS 假设处理。

## 4. 失效场景与删除判据

- CI 由平台完全托管生成（不需要人写 workflow）→ `references/ci-workflows.md` 降级为指针。
- 模型默认就能产出多阶段 + 非 root + 健康检查 → `references/docker-image.md` 的模板段可删，只保留失败表。
- 裸机 nginx 全部迁完且不再维护 → `references/reverse-proxy-gateway.md` 移出本技能。

降级或删除前必须确认：项目 `AGENTS.md` / `docs/standards` 里已有等价的可执行门禁（脚本、检查清单或 CI 规则），且历史事故类型已被覆盖；未覆盖的不可推断项（见第 5 节）必须迁到项目规范后再删。

## 5. 能力替代 vs 不可推断

- **能力替代型**（模型普遍掌握，可随能力提升删减）：多阶段构建、`.dockerignore`、非 root、缓存挂载、超时与并发设置。
- **不可推断型**（必须保留）：workspace 安装静默空装、`--filter` 不建依赖、external 只在运行时暴露、prepare 顺序、镜像更新语义、Actions 钉版本。具体契约只写在 `docker-image.md` / `ci-workflows.md` 的失败表与检查项里，本文件不复制。
- 减法顺序：先删能力替代项，保留不可推断项与失败表。

## 6. 项目覆盖锚点

- 可变项：镜像仓清单、部署目标、健康检查路径、Node 版本、缓存策略。
- 写在项目 `AGENTS.md`（数据多时由它一行链到 `docs/standards/*`）；本技能只给检查点与默认做法。
- 无覆盖时的默认值：不推任何 registry、单架构、无 HEALTHCHECK、Node 版本取镜像 tag、不做缓存挂载。
- 优先级：技能默认 < 项目覆盖 < 会话覆盖。

## 7. 关键取舍

- 不追「平台大全」：只覆盖 Docker / GitHub Actions / Serverless 三条主线，K8s、Nomad 一类遇到时按 Step 1 的真源方法现场确认。
- 契约只写一次：正文做分流与检查，细节放 references，避免 SKILL.md 与 reference 双写。
