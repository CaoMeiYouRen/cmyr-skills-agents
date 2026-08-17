---
name: nuxt-wsl2-build
description: 在 Windows 上构建或开发 Nuxt 项目时使用。适用于 nuxt build、nuxt dev、pnpm build、pnpm dev（Nuxt 项目）、Windows 上 Nuxt 构建慢、构建提速、WSL2 环境检测与初始化、把 Nuxt 项目迁移到 WSL 内部文件系统。当任务需要执行 Nuxt 构建/开发时强制检查是否运行在 WSL2 + ext4 环境，不满足则提醒用户配置或自主初始化相关环境；当项目（含子项目）使用 Nuxt 但当前任务未涉及构建/开发时，输出建议性告警（不强制配置环境、不中断任务）。

metadata:
  internal: true
---

# Nuxt WSL2 Build

铁律：在 Windows 上执行 Nuxt 构建（`nuxt build` / `pnpm build`）或开发（`nuxt dev` / `pnpm dev`）前，必须先确认运行在 WSL2 + ext4（WSL 内部文件系统）环境，使用 WSL 内的 Linux 版 Node/pnpm；项目位于 `/mnt/c`、`/mnt/d`（9P 协议）时禁止直接构建——跨边界比 Windows 原生还慢。

## 工作流

- [ ] Step 1: 判断任务是否涉及 Nuxt 构建/开发 ⚠️ REQUIRED
  - [ ] 1.1 任务的执行目标是否包含 `nuxt build`、`nuxt dev`、`pnpm build`、`pnpm dev`、`nuxt preview`、`pnpm preview` 等针对 Nuxt 项目的命令。
- [ ] Step 2: 检测项目是否使用 Nuxt（含子项目） ⚠️ REQUIRED
  - [ ] 2.1 运行 `scripts/check-wsl2-env.ps1 -ProjectPath <项目路径>`，读取 `is_nuxt_project` 与 `nuxt_project_paths`。
  - [ ] 2.2 未检测到 Nuxt → 本技能流程到此结束，不输出告警。
- [ ] Step 3: 环境检测 ⚠️ REQUIRED
  - [ ] 3.1 读取同一脚本输出：`inside_wsl`、`wsl_installed`、`default_distro`、`project_location`、`wsl_node_installed`、`wsl_pnpm_installed`。
- [ ] Step 4: 按任务是否涉及构建/开发分派处理 ⚠️ REQUIRED
  - [ ] 4.1 涉及构建/开发，且环境已就绪（WSL2 + ext4 + Linux node/pnpm）→ 直接通过 `wsl` 转发执行，命令见 references/project-in-wsl.md。
  - [ ] 4.2 涉及构建/开发，但 WSL 内缺 Linux node/pnpm → 自主初始化（`corepack enable` + pnpm），完成后按 4.1 执行。
  - [ ] 4.3 涉及构建/开发，但 WSL 未安装 → 提醒用户以管理员身份执行 `wsl --install -d Ubuntu`（首次需重启），后续步骤见 references/wsl2-environment-setup.md；环境就绪前不强行构建。
  - [ ] 4.4 涉及构建/开发，但项目位于 `/mnt/c`、`/mnt/d` 或 Windows 盘 → 红线告警：先迁移项目到 WSL 内部（`~/projects/`，迁移步骤见 references/project-in-wsl.md），迁移后再构建；除非用户明确接受慢速原生构建，否则不跨边界构建。
  - [ ] 4.5 不涉及构建/开发，但项目使用 Nuxt → 输出一条建议性告警（如"本项目是 Nuxt 项目，Windows 原生构建慢（13-15min），后续需要构建/开发时建议走 WSL2 + ext4"），不强制配置、不中断任务。
- [ ] Step 5: 执行与验证
  - [ ] 5.1 构建/开发命令在 WSL 终端执行（`wsl -d <distro> bash -lc "cd ~/projects/<项目> && pnpm build"`）。
  - [ ] 5.2 验证退出码与产物（`.output/` 目录）；dev server 依赖 `.wslconfig` 的 `localhostForwarding=true`，Windows 浏览器访问 `localhost:3000`。

## 关键规则

- 唯一红线：项目必须放 WSL 内部文件系统（`~/`，ext4），绝不在 `/mnt/c`、`/mnt/d`（9P）下构建——实测比 Windows 原生还慢。
- 工具链必须用 WSL 内的 Linux 版 Node/pnpm，不跨边界调用 Windows 的 node.exe / pnpm.cmd。
- 实测基线（caomei-auth）：WSL2 构建 12-24s vs Windows 原生 13-15min（约 60-70×）；npm install 8min → 25s（19×）。
- 解除条件：nitro v3 / Nuxt 5 发布并验证 Windows 原生构建恢复正常后，重新评估是否保留本规范。

## 反模式

- 项目留在 `D:\...`，进 WSL 后在 `/mnt/d` 构建——9P 跨边界 + NTFS 双重开销，比 Windows 原生更慢。
- WSL 里调用 `/mnt/c/.../node.exe` 或 Windows 侧 pnpm 混合工具链，IO 依旧跨边界。
- 未检测环境就直接跑 `pnpm build`，让用户空等 13-15min。
- 在需要管理员权限 + 重启的 WSL 安装场景强行"自主完成"——应提醒用户执行并等待确认。
- 用户明确拒绝迁移项目时，仍强制迁移或替用户删改项目位置。
- 项目在 ext4 但 node_modules 用符号链接指回 /mnt/c，破坏 pnpm store 结构。

## 交付前检查

- [ ] 已明确任务是否涉及 Nuxt 构建/开发。
- [ ] 已检测项目（含子项目）是否使用 Nuxt，未使用则未输出任何告警。
- [ ] 涉及构建/开发时，已确认 WSL2 + ext4 + Linux 工具链就绪，或已向用户给出明确的环境配置/项目迁移指引。
- [ ] 不涉及构建/开发时，仅输出建议性告警，未强制配置环境、未中断任务。
