# 项目迁移与 WSL 内构建/开发

## 1. 项目迁移到 WSL 内部文件系统

目标：项目放在 `~/projects/`（ext4），构建、install、git 操作在 WSL 终端执行。

### 方式一：git clone（推荐，有远端仓库时）

```bash
cd ~
mkdir -p projects && cd projects
git clone git@github.com:<用户名>/<项目>.git
cd <项目>
corepack use pnpm@latest
pnpm install
```

### 方式二：从 Windows 拷贝（无远端或需要带未提交改动时）

```powershell
# Windows 侧先拷贝（在 PowerShell 执行，跨边界只发生这一次）
wsl bash -lc "mkdir -p ~/projects && cp -r /mnt/d/Projects/<项目> ~/projects/"
```

> 拷贝方式会形成 Windows 侧与 WSL 侧两份代码，后续改动需手动同步；有 git 历史时优先方式一。

### 迁移后注意

- pnpm store 在 ext4 上重建（虚拟存储 + 硬链接），首次 `pnpm install` 稍慢，之后增量快。
- 若项目 Windows 侧有 CRLF 历史：`git config core.autocrlf input`。

## 2. WSL 内构建/开发命令

Windows 侧 PowerShell 通过 `wsl` 转发（agent 推荐路径）：

```powershell
# 构建
wsl -d Ubuntu bash -lc "cd ~/projects/<项目> && pnpm build"

# 开发（前台常驻，建议在 WSL 终端运行）
wsl -d Ubuntu bash -lc "cd ~/projects/<项目> && pnpm dev"
```

WSL 内直接执行：

```bash
cd ~/projects/<项目>
corepack use pnpm@latest && pnpm install && pnpm build
```

## 3. 构建产物

- Nuxt 构建产物在 `~/projects/<项目>/.output/`。
- 需要取回 Windows 侧时，WSL 内执行 `explorer.exe .` 或复制到共享盘；不要在 `/mnt/c` 上执行构建。

## 4. 开发体验（VS Code 联动）

```powershell
# VS Code 打开 WSL 路径（会自动用 WSL 扩展 + WSL 里的 node/pnpm）
code \\wsl$\Ubuntu\home\<用户名>\projects\<项目>
# 或装 "WSL" 扩展后，在 WSL 终端里直接：code .
```

代码编辑可在 Windows 侧 VS Code（WSL 远程 / `\\wsl$\` 路径），构建、install、git 操作在 WSL 终端执行。VS Code 官方建议源码放 WSL2 文件系统：<https://code.visualstudio.com/remote/advancedcontainers/improve-performance>

## 5. 红线

| ❌ 做法 | 后果 |
|---|---|
| 项目留在 `D:\...`，用 `wsl` 进去在 `/mnt/d/...` 构建 | 比 Windows 原生还慢（9P 跨边界 + NTFS 双重开销） |
| Windows 侧装 node，WSL 里调用 `/mnt/c/.../node.exe` | 混合工具链，IO 依旧跨边界，权限/路径混乱 |
| 项目在 ext4 但 node_modules 用符号链接指到 /mnt/c | 破坏 pnpm 的 store 结构，得不偿失 |
