# Competitive Analysis Research — 竞品对比调研方法论

当用户要求比较两款或多款工具/产品/框架时，常规的 super-search 流程不足以覆盖竞品分析所需的深度。本参考文件补充了专门用于竞品对比调研的步骤、检查清单和维度框架。

## 触发条件

以下场景应激活本参考文件（叠加在 super-search 的 Q1-Q5 域探测器之上）：

- 用户要求「对比」「vs」「versus」「哪个好」「选型」「如何选择」两款或多款产品
- 用户问「为什么选 X 而不是 Y」或「X 有什么风险」
- 调研涉及替换/迁移/弃用一个现有工具
- 用户提到「竞品」「替代品」「alternatives」「competitors」

## 对比调研的 7 个维度

对每个被比较的产品/工具，按以下 7 个维度收集数据：

### 1. 官方信息
| 子项 | 方法 | 说明 |
|------|------|------|
| 官网 & 文档 | 抓取首页 + 文档站点 | 了解定位、功能、定价 |
| 许可证 | GitHub repo LICENSE 文件 | MIT / Apache 2.0 / AGPL 等 |
| GitHub ⭐ & 活跃度 | 抓取 repo 页面 | ⭐ 数、last commit、open/closed issues ratio |
| 创建时间 & 版本历史 | CHANGELOG / Releases 页 | 快速迭代 vs 稳定发布 |

### 2. 安全态势（重点 ⚠️）
| 子项 | 方法 | 说明 |
|------|------|------|
| CVE 数据库查询 | 搜索 `cve <project>`、`<project> CVE`、`<project> CVSS`、`<project> security advisory` | 公开漏洞和历史严重度。记录具体 CVE 编号和 CVSS 分数 |
| 独立安全研究机构报告 | 搜索 `<project> security audit`、`<project> penetration test`、`<project> security research`、`<project> security review`、`AI security firm <project>` | 优先查找独立安全咨询公司（如 innFactory、Koi Security）的公开审计报告，而非仅依赖厂商自述 |
| 供应链安全 | 搜索 `<project> malicious package`、`<project> supply chain attack`、`<project> malicious skill`、`<project> plugin malware` | 技能/插件市场的投毒历史。注意 typosquatting、dependency confusion、恶意 skill 批量上传等具体攻击模式 |
| 实例暴露 | 搜索 `<project> exposed instances`、`<project> shodan`、`<project> SecurityScorecard` | 默认配置下公网暴露程度 |
| 微软/Google/CISA 安全公告 | 搜索 `<project> microsoft advisory`、`<project> CISA`、`<project> CVE`（加 year） | 官方安全组织的评估 |
| 安全设计 | 检查文档中「security」「permissions」「sandbox」「container hardening」「isolation」「read-only」「namespace」相关章节 | 安全是内建的还是事后补的；检查是否有命令审批/沙箱/快照回滚等机制 |

> 安全信息可能分散在多个来源。优先使用独立安全研究机构的报告，其次是官方安全公告。至少需要 2 个独立来源交叉确认。
>
> **真实案例参考**（Hermes Agent vs OpenClaw 调研，2026-06）：
> - CVE 查询结果：CVE-2026-25253（CVSS 9.1，Skill 沙箱逃逸）、CVE-2026-25891（CVSS 8.4，MCP 认证绕过）、CVE-2026-26102（CVSS 7.8，身份文件注入）、CVE-2026-24763/25157（CVSS 7.5，命令注入）—— 共 6 个 CVE
> - 供应链攻击：ClawHavoc 攻击活动（1,184 恶意包、23 个被黑账号、15k-25k 次安装，payload 包括 AMOS Stealer、XMRig 矿工、凭据窃取）
> - 独立审计：Koi Security 审计 2,857 个 ClawHub skill，发现 341 个恶意条目（335 个来自同一攻击活动）
> - 实例暴露：SecurityScorecard 报告数万个公网暴露实例
> - 微软安全公告（2026.2.6）：早期版本 "overly permissive for enterprise environments"
>
> 这些具体数字和 CVE 编号可以用于对比表的「安全 CVE」和「Skills 供应链」行。注意 ⭐ 数、CVE 编号、攻击统计数据会随时间变化，每次调研必须重新搜索确认。

### 3. 生态与社区
| 子项 | 方法 | 说明 |
|------|------|------|
| 社区规模 | Reddit 订阅数、Discord 成员数、GitHub 贡献者数 | 社区活跃度 |
| 技能/插件市场 | 总技能数、审核机制、恶意插件历史 | 生态丰富度与安全性 |
| 第三方集成 | 搜索 `<project> integration with <X>`、MCP 支持、API 可扩展性 | 生态开放度 |
| 教程/文档质量 | 搜索 `<project> tutorial`、`<project> guide`、`<project> getting started` | 上手难度 |

### 4. 功能对位
| 子项 | 方法 | 说明 |
|------|------|------|
| 核心能力 | 从官方文档提取关键功能列表 | 按类别分组：记忆、工具调用、多平台、定时任务 |
| 差异化功能 | 对比双方有/无的功能 | 关键决策点 |
| 缺失功能 | 从社区讨论和 Issues 中发现 | 官方路线图可佐证 |

### 5. 迁移路径
| 子项 | 方法 | 说明 |
|------|------|------|
| 官方迁移工具 | 搜索 `<target> migrate from <source>`、`<target> import <source>` | 是否有内置迁移命令 |
| 数据格式兼容性 | 检查配置/记忆/技能的文件格式 | 手动迁移可行性 |
| 用户迁移报告 | 搜索 `migrate from <source> to <target> experience`、Reddit 讨论 | 实际迁移者的经验 |

### 6. 创作者与治理
| 子项 | 方法 | 说明 |
|------|------|------|
| 创作者背景 | 作者/团队背景、所属机构 | 个人项目 vs 机构背书 |
| 所有权变更 | 是否有基金会化/收购/移交 | 长期可持续性 |
| 商业化路径 | SaaS、企业版、捐赠模式 | 开源项目的商业模式 |
| 治理模型 | BDFL / 基金会 / 公司主导 | 决策透明度 |

### 7. 用户感受与口碑
| 子项 | 方法 | 说明 |
|------|------|------|
| Reddit/HN 讨论 | 搜索 `<project> reddit review`、`<project> HN` | 真实用户反馈 |
| 批评意见 | 搜索 `<project> problems`、`<project> cons`、`<project> issues`、`<project> limitations` | 不能只看优点 |
| 独立评测 | 搜索 `<project> vs <competitor> comparison`、`<project> review 2026` | 第三方对比评测 |
| 社区情绪聚合 | 搜索 `<project> reddit review site:reddit.com` 或查找已聚合分析的第三方文章（如 "analysis of 1,300+ Reddit comments across 25 threads" 级别的系统调研） | 单条 Reddit 讨论有偏差，聚合数百条评论的趋势分析才有统计意义。注意区分自然用户吐槽与可能的水军/astroturfing 内容——发现大量新账号发模板化正面内容时标注「可能存在 Astroturfing」 |

## 对比矩阵构建方法

### 1. 收集原始数据
对每个产品，按上述 7 维度收集数据。每个数据点必须**附带来源 URL**。

### 2. 确定对比维度
从 7 个维度中筛选用户最关心的 5-8 个维度放入最终对比表。筛选标准：
- 该维度是否有实质差异（双方相近的维度可以不放入主表）
- 该维度是否与用户使用场景直接相关
- 安全、记忆、成本等「决策敏感」维度必须包含

### 3. 构建对比表
格式示例（飞书 Markdown 表格规则）：

```
| 对比维度 | Product A | Product B | 判断 |
|---------|----------|----------|------|
| 记忆系统 | SQLite + FTS5 | 文件存储 | A 胜 |
| 安全 CVE | 0 已知 | CVE-202X-XXXXX（CVSS 8.8）| A 胜 |
| 技能生态 | 118 内置 | 13,700+ 社区 | B 胜（但质量堪忧）|
```

### 4. 写判断说明
每个对比维度的「判断」列应附简短理由，让读者理解评分的依据。避免武断的「A 胜」「B 败」，使用「A 胜：…」「B 胜：但…」「各有优势」等带语境的表述。

## 决策框架合成

对比分析后，应输出一个「为什么选 X」的决策框架。推荐格式：

```
### 为什么选 X，而不是 Y

**🔴 原因一：核心差异化**
[X 的核心优势 1]——[具体解释]

**🔴 原因二：风险规避**
[Y 的不可接受风险]——[具体解释 + 证据链接]

**🔴 原因三：组合优势**
[X 独有的能力组合]——[为什么这种组合对你的场景根本]

**🟡 原因四（次要）：迁移成本**
[迁移成本分析]

**🟢 补充：Y 的优势**
[Y 的值得学习的亮点/未来可借鉴处]

**一句话总结**：[简洁的决策建议]
```

### 决策框架写作原则

- **引用具体证据**：每条原因必须有来源支持（CVE 编号、审计报告、官方文档引文）
- **承认竞品的优点**：提供客观的竞品优势对比，避免「只说自家好」
- **风险要量化**：不写「有安全风险」，写「已公开 CVE-202X-XXXXX（CVSS 9.1）」+ 攻击案例
- **结合用户场景**：解释为什么这些差距对「你的场景」重要
- **区分「硬上限」和「软选择」**：安全漏洞是硬上限，生态丰富度是软选择——硬上限优先于软选择

## 检查清单

交付竞品对比报告前，逐项确认：

- [ ] 每个竞品的 GitHub 原始 repo 已抓取（非第三方转述的 ⭐ 数）
- [ ] CVE 数据库已查询（使用搜索引擎：`cve <project>`、`<project> CVSS`），记录具体编号和分数
- [ ] 供应链安全事件已检查（搜索 `<project> malicious`、`<project> supply chain`、`<project> typosquatting`）
- [ ] 安全审计报告已检查（搜索 `<project> security audit report`、`<project> security review`），至少找到 1 份独立第三方审计
- [ ] 独立安全研究机构/博客的评估已纳入（不只是厂商自己的安全页面）
- [ ] 所有 ⭐ 数和定价标注了获取日期
- [ ] 对比表中的每条数据有可点击的来源 URL
- [ ] 引用第三方评测时标注了来源和日期
- [ ] 至少搜索了 1 个「竞品批评/limitations」来源
- [ ] 决策框架包含竞品的客观优势（不回避）
- [ ] 报告针对用户的实际场景给出了个性化建议
- [ ] 迁移工具/路径已检查（搜索 `<target> migrate from <source>`，记录是否有 `hermes claw migrate` 这类内置迁移命令）
- [ ] 创作者治理状态已检查（原作者是否仍在维护、是否移交基金会/收购、商业化路径与许可证是否一致）
