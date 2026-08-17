# 性能原理与实测数据

## 1. 为什么 WSL2 快：文件系统原理

| 位置 | 协议 | 性能 | 说明 |
|---|---|---|---|
| `~/`（WSL 内部） | **ext4**（VHDX 虚拟磁盘内） | **近原生 Linux 速度** | 所有 FS 调用留在 Linux 内核内，不跨 Windows↔Linux 边界 |
| `/mnt/c`、`/mnt/d` | **9P（Plan 9）协议** | 每个操作有协议开销（msize=64KB 上限），小文件密集时每轮往返都背开销 | 文件访问跨 Windows↔Linux 边界，被延迟击穿 |

核心洞察：WSL2 方案不是「在 Windows 里跑 Linux」，而是「把项目放进 Linux 原生文件系统（ext4）」，让所有 FS 调用留在 Linux 内核内，完全不跨边界。唯一红线：项目若放在 `/mnt/c`，WSL2 反而更慢——9P 协议的开销比原生 Windows NTFS 还大。

9P → virtiofs 是微软持续优化方向，但 virtiofs 仍要跨 VM 边界，对 node_modules 海量小文件场景，最优解永远是「不跨界」——项目放 ext4。

## 2. 实测基准

来源：WSL2 gotchas 实测基准表 <https://dev.to/alvarito1983/the-wsl2-guide-i-wish-i-had-4-gotchas-that-will-eat-your-afternoon-5aal>

| 操作 | `/mnt/c`（9P） | WSL 原生（ext4） |
|---|---:|---:|
| npm install | ~8 min | ~25 s |
| git status（10k 文件） | ~4 s | <100 ms |
| docker build context | ~90 s | ~3 s |

## 3. Nuxt 构建实测（nuxt/nuxt#34753，2026-03-31 开，2026-05-10 close）

Issue：Windows 11 + NTFS + NVMe SSD + Yarn 4，Nitro 构建阶段 148.8s（总 3m16s 的 76%）。根因 `nitro:node-externals` 的 resolveId + @vercel/nft 文件追踪，上游 not planned（Windows 文件系统小文件密集场景被击穿）。

同项目 WSL2 对比：

| 测试者 | Windows 原生 | WSL2（Ubuntu/Debian） | 加速比 |
|---|---:|---:|---:|
| quantix-dev | ~2 min | 38 s | 3.2× |
| ywenhao | 148.61 s | **23.77 s** | **6.25×** |

danielroe（Nuxt 核心）close 结论：nitro 上游问题，**nitro v3 已修复**，Nuxt 5 受益。当前 Nuxt 4.x 在 Windows 上仍受困，WSL2 是立即可用的缓解方案。

## 4. 本地实测基线（caomei-auth，2026-08-16）

| 环境 | 构建耗时 |
|---|---:|
| Windows 原生（PowerShell） | 13-15 min（Nitro 占 96%） |
| **WSL2（ext4）** | **12.31 s**（约 60-70×） |

## 5. 方案对比定位

| 方案 | 构建耗时（caomei-auth 参考） | 适用 |
|---|---|---|
| Windows 原生（现状） | 13-15 min（Nitro 占 96%） | 当前 |
| Windows 原生 + Defender 排除 | 预计减 30-70% IO 时间 | 先做（零成本） |
| **WSL2 + ext4** | **2-4 min 以内**（实测 12-24s） | **推荐主方案** |
| CI（GitHub Actions ubuntu） | 最快（同 WSL2 级别） | 发布用 |
| nitro v3 / Nuxt 5 | 上游修复，长期 | 等更新 |

组合拳建议：Defender 排除（Windows 侧其他工具用）+ WSL2 构建（本地构建主路径）+ CI（发布）——三者不冲突。

## 6. 解除条件

nitro v3 / Nuxt 5 发布并验证 Windows 原生构建恢复正常后，重新评估本技能是否保留强制检测逻辑（届时可回归 Windows 原生）。

## 来源清单

- [nuxt/nuxt#34753：Build is 40x slower on Windows](https://github.com/nuxt/nuxt/issues/34753)
- [WSL2 Gotchas（/mnt/c vs ext4 基准表）](https://dev.to/alvarito1983/the-wsl2-guide-i-wish-i-had-4-gotchas-that-will-eat-your-afternoon-5aal)
- [微软官方：WSL 配置文档](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)
- [VS Code 官方：Improve disk performance](https://code.visualstudio.com/remote/advancedcontainers/improve-performance)
- [WSL 2 文件访问演进（9P→virtiofs）](https://www.boxofcables.dev/wsl2-per-device-swiotlb-pools-for-virtiofs-and-virtioproxy/)
- [StackOverflow：WSL 为什么慢](https://stackoverflow.com/questions/68972448/why-is-wsl-extremely-slow-when-compared-with-native-windows-npm-yarn-processing)
- [Docker 官方：WSL2 后端](https://docs.docker.com/desktop/wsl/)
