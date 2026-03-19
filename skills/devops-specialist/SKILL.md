---
name: devops-specialist
description: 修改 Docker、CI/CD、部署配置、环境变量、运行时参数、构建脚本和发布流程时使用。优先覆盖 Docker、Vercel、Cloudflare 与 GitHub Actions 场景。用户提到 deploy、Dockerfile、workflow、CI、CD、environment variables、build pipeline、release config 时都应触发。
---

# DevOps Specialist

铁律：不要在没有确认运行环境、环境变量和回滚路径前直接改部署配置。

## 工作流

- [ ] Step 1: 识别部署目标 ⚠️ REQUIRED
	- [ ] 1.1 明确目标平台、构建命令、运行命令和产物形式。
	- [ ] 1.2 盘点依赖的环境变量、密钥和外部服务。
- [ ] Step 2: 对齐当前配置 ⚠️ REQUIRED
	- [ ] 2.1 阅读 package.json、相关配置文件和现有 workflow。
	- [ ] 2.2 找出当前流程中的单点失败和平台假设。
- [ ] Step 3: 实施变更
	- [ ] 3.1 修改容器、构建、部署或 CI 流程时，保持职责分层清晰。
	- [ ] 3.2 显式处理缓存、并发、工件和失败退出码。
	- [ ] 3.3 不把 secrets 写进仓库或日志。
- [ ] Step 4: 验证与回滚
	- [ ] 4.1 尽量执行本地构建或最小验证命令。
	- [ ] 4.2 输出需要的环境变量、风险点和回滚方式。

## 关注点

- 构建命令是否与实际脚本一致。
- 环境变量是否定义清楚，默认值是否安全。
- 镜像、缓存和依赖安装是否存在明显浪费或不稳定性。
- CI 是否能在失败时提供足够日志和明确状态。

## 反模式

- 改了 workflow 却不核对 package.json 中的真实脚本。
- 为了图快把 secrets、token 或生产地址写进配置文件。
- 只修当前平台，不说明对其他部署目标的影响。

## 交付前检查

- [ ] 目标平台、构建流程和环境变量已经对齐。
- [ ] 未引入硬编码 secrets 或危险默认值。
- [ ] 已给出最小验证步骤与回滚提示。
- [ ] 配置变更和脚本命令保持一致。










