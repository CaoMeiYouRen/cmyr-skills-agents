# CDN / 基础设施调研方法论

## 适用场景

当用户问及 CDN 路由、网络延迟、域名访问慢、不同地区访问差异、Cloudflare 节点分配等问题时使用。

## 调研工具链

### 1. 诊断端点实时数据

| 服务 | 端点 | 关键字段 |
|------|------|----------|
| Cloudflare | `https://<domain>/cdn-cgi/trace` | `colo`（接入数据中心，如 LAX/SJC/HKG/NRT/SIN）、`loc`（用户位置）、`http`（协议版本）、`tls`、`kex` |
| Cloudflare | `https://<domain>/cdn-cgi/colo` | 返回数据中心名称 |
| Cloudflare | HTTP 响应头 | `cf-ray`（末尾 -XX 为数据中心代码）、`cf-placement`、`server-timing: chlray` |

**数据中心代码速查**：LAX=洛杉矶, SJC=圣何塞, ORD=芝加哥, SEA=西雅图, HKG=香港, NRT=东京, SIN=新加坡, ICN=首尔, KIX=大阪

### 2. DNS 解析查 IP 段

```bash
curl -sL "https://dns.google/resolve?name=<domain>&type=A"
curl -sL "https://dns.google/resolve?name=<domain>&type=CNAME"
```

通过 IP 判断 CDN 提供商：
- Cloudflare 常见段：`104.16.0.0/13`、`172.64.0.0/13`、`162.158.0.0/15`
- CloudFront：`13.32.0.0/15`、`54.192.0.0/16` 等
- Fastly：`151.101.0.0/16` 等

### 3. HTTP 响应头识别

```bash
curl -sI "https://<domain>" | grep -i "server\|cf-ray\|x-cache\|x-amz\|x-served\|via"
```

| Header 特征 | CDN |
|-------------|-----|
| `server: cloudflare` + `cf-ray` | Cloudflare |
| `server: CloudFront` + `x-amz-cf-*` | AWS CloudFront |
| `server: Varnish` + `x-cache` | Fastly |
| `x-served-by` | Bunny CDN |
| `via: 1.1 google` | Google Cloud CDN |

### 4. 多节点测速平台

| 平台 | 用途 | URL |
|------|------|-----|
| chinaz | 国内多城市多 ISP ping + HTTP | https://tool.chinaz.com/speedtest |
| 17CE | 全球节点测速 | https://www.17ce.com |
| boce | 国内多节点监测 | https://www.boce.com |
| ITDOG | 全球 Ping | https://www.itdog.cn/ping |

### 5. 工具类

| 工具 | 用途 | URL |
|------|------|-----|
| CloudflareSpeedTest | 扫描 CF 所有 IP，找出从中国延迟最低的 | https://github.com/XIU2/CloudflareSpeedTest |
| BestTrace | MTR 路由跟踪可视化 | https://www.ipip.net/traceroute |

## Anycast 路由调研方法论

### 理解 Anycast 路由差异

不同用户访问同一个域名可能接入不同数据中心。原因：

1. **CF 分配了不同 IP 段给不同域名** — 免费套餐自动分配，不可控。不同 IP 段在中国 ISP 的 BGP 路由表中表现不同。例如 `172.65.90.x` 可能路由到香港，而 `104.21.x.x` 路由到美西。
2. **同一 IP 段的不同子段路由不同** — CF 的 BGP 宣告粒度可以精确到 /24 甚至 /32。
3. **同一域名从不同运营商/地区访问路由不同** — 电信/联通/移动各自独立的路由表。

### 验证方法

1. 从当前环境测：`curl -sL https://<domain>/cdn-cgi/trace` 看 `colo`
2. 从国内多节点测：使用 chinaz 多城市测速
3. 对比不同 CF IP 段：记录各域名的 A 记录 IP，看落在哪个段
4. 交叉验证：用 17CE/boce 确认

## CF 套餐对路由的影响

| 套餐 | 月费 | 对路由的影响 |
|------|------|-------------|
| Free | $0 | 共享 IP 池，路由由 ISP BGP 决定，无法控制 PoP |
| Pro | $20 | 同上 IP 池，但 Argo 优化边缘→源站路径（不影响用户→边缘） |
| Business | $200 | 同上 |
| Enterprise | 签约 | 专用 IP 段 + 可选中国网络（需 ICP） |

**核心认知**：除非 Enterprise + China Network，CF 不保证中国用户不绕路到美西。

## 控制 CF IP 路由的可行方案

### 核心限制

CF 的代理（橘云）要求 CF 必须是该记录的权威 DNS 提供商。

### 方案对比

| 方案 | 保留橘云 | 第三方分线路解析 | 成本 | 说明 |
|------|---------|----------------|------|------|
| DNS-Only + 第三方 DNS 指向优选 IP | ❌ 失去代理 | ✅ | 免费 | 失去 DDoS 防护和缓存 |
| Multi-Provider DNS | ❌ | ❌ | 免费 | 仅 DNS 冗余，不能分线路+橘云 |
| Cloudflare for SaaS | ⚠️ 子域名 | ✅ 子域名 | $0.10/主机名/月 | 第三方 DNS CNAME 到 CF 子域名，保留橘云 |
| Secondary DNS Override | ✅ | ✅ | Enterprise 仅限 | 第三方 DNS 做主 + CF 做从 DNS，月费 $5000+ |
| 前置亚太 CDN（CN2 GIA） | ✅ 保留 CF | — | $20-500/月 | CF 做安全层，前加 CN2 GIA CDN 做加速 |

### 路线选择指南

- **免费** → 保持 CF 橘云现状，或 DNS-Only + 第三方 DNS 指定优选 IP（牺牲安全）
- **$20-500/月** → 前置亚太 CN2 GIA CDN，CF 退为安全层
- **$5000+/月** → Secondary DNS Override（Enterprise）

## 免备案 CDN 方案对比

| CDN | 香港→中国延迟 | 路线 | 月费起 | 适用场景 |
|-----|-------------|------|--------|---------|
| CDN5 | 26-32ms | CN2 GIA 纯直连 | $499 | 国内用户加速、高防 |
| YewSafe | 28-37ms | CN2 GIA + 三网直连 | $499 | 金融/API 类高安全要求 |
| Bunny.net | 视路由 | 标准 BGP | 按量 | 价格敏感海外站 |
| Gcore | 170-210ms | 标准 BGP | $39 | 欧洲/亚太均衡覆盖 |

数据来源：https://www.yewsafe.com/guides/best-no-icp-cdn-providers-china-2026（2026-07-01）

## 真实案例：opencode.ai vs momei.app 路由差异

### 现象

| 域名 | CF IP | chinaz 国内测速 | 个人 /cdn-cgi/trace |
|------|-------|----------------|---------------------|
| opencode.ai | 172.65.90.x | ✅ 香港节点（多城市多 ISP） | SJC（取决于 ISP 出口） |
| momei.app | 104.21.10.33 / 172.67.189.226 | ❌ 美国 | LAX |
| up.cmyr.dev | 104.21.69.51 / 172.67.204.229 | ❌ 美国 | SJC |

### 根因

**不是 opencode.ai 做了特殊配置**，而是 CF 为它分配的 `172.65.90.x` 段在中国 ISP BGP 路由表中恰好指向香港，而 `104.21.x.x` / `172.67.x.x` 段指向美西。两者都属于 CF 免费/Pro 套餐的共享 IP 池，CF 分配不可控。

### 「抽签」的机制

CF 免费套餐自动从共享 IP 池中分配 IP，不同 IP 段在中国 ISP 的 BGP 路由表现不同：
- `172.64.x.x` / `172.65.x.x` — 某些子段在中国 ISP 路由表中路由到香港/东京
- `104.16.x.x`-`104.27.x.x` / `172.67.x.x` — 常见免费套餐段，路由到美西
- `162.158.x.x` — 老段路由质量不一

同一大段内不同 /24 子段的路由也可能不同（BGP 宣告粒度）。

### 验证方法

```bash
# 看当前接入点
curl -sL https://<domain>/cdn-cgi/trace | grep colo

# 看 IP 段
curl -sL "https://dns.google/resolve?name=<domain>&type=A"

# 看 HTTP 响应头 — cf-ray 末尾是数据中心代码，cf-placement 是回源路由
curl -sI https://<domain> | grep -i "cf-ray\|cf-placement\|server-timing"
```

注意 `cf-placement` 与 `colo` 不同：`cf-placement` 标注回源路由的数据中心（如 `remote-ORD`=回源经芝加哥），`cf-ray` 末尾是当前请求响应的数据中心（如 `-SEA`=西雅图）。

### 向用户解释的正确话术

> "opencode.ai 没什么特殊配置，它只是被 CF 分配到了 `172.65.90.x` 段，这个段在中国 ISP 路由表中恰好走到香港。你的域名被分配到了 `104.21.x.x` 段，走到美西。这不是谁做了配置，是 BGP Anycast 的抽签结果。重新接入 CF 可能换段，但不保证。"

## 常见陷阱

- ❌ 认为 CF 付费套餐会解决中国用户绕路问题 — Argo 不优化用户到边缘
- ❌ 认为 `172.65.x.x` 段比 `104.21.x.x` 段"好" — 只是当前 ISP 路由表不同，随时可能变化
- ❌ 认为同域名从任何地方都接入同一 PoP — Anycast 路由随 ISP 出口变化
- ❌ 认为可以用第三方 DNS 直接指向 CF IP 同时保留橘云 — 橘云要求 CF 是权威 DNS
- ❌ 认为 `opencode.ai` 的 HK 路由是配置出来的 — 它只是 IP 段抽签抽到好段
- ❌ 用 `/cdn-cgi/trace` 的一次结果推断全局路由 — 同一域名从不同 ISP/地区可能接入不同 PoP（如 opencode.ai 从杭州电信走 SJC，从电信其他节点走 HKG）
- ✅ 真正可控的国内加速方案是 CN2 GIA 精品线路的 CDN，非 CF 可解
