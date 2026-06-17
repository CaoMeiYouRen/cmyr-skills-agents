# Source Priority — 信源质量评估与优先级

搜索质量的上限由信源质量决定。不是「搜到什么用什么」，而是「先圈定高质量源，再从高质量源里搜」。

---

## 信源质量分层

| 层级 | 质量 | 特征 | 示例 |
|:---:|:---:|------|------|
| 🥇 **一手/官方** | 最高 | 项目仓库、官方文档、官方博客、论文 | GitHub README、arXiv、官方定价页 |
| 🥈 **权威社区** | 高 | 有审核机制的社区、知名独立博客 | HN、Reddit r/MachineLearning、lobste.rs、Simon Willison's blog |
| 🥉 **聚合/周报** | 中 | 高质量人工策展、定期更新 | TommyZ Weekly、RadarAI、devflokers |
| 4️⃣ **技术社区** | 中低 | UGC 平台，质量参差 | Dev.to、SegmentFault（冴羽等知名作者除外） |
| ⚠️ **转载/聚合站** | 低 | SEO 优化内容、机翻、无原创 | 博客园、Medium 转载 |
| ❌ **不可用** | 禁用 | 内容农场、纯营销、无作者信息 | **csdn.net、blog.csdn.net（全局封禁）**；ask.csdn.net 同样排除；jianshu、163.com 转载需人工判断 |

> 注意：tinyfish MCP 已在源头上过滤了 csdn.net 等低质站点。但其他转载站（如 jianshu、163.com 转载）仍需人工判断。

---

## 按领域推荐信源

### 开源/GitHub 项目调研

| 优先级 | 信源 | 用途 |
|:---:|------|------|
| 🥇 | GitHub repo 页面（README + Insights） | 一手数据：⭐、license、activity、contributors |
| 🥇 | GitHub Issues（前 2 页） | 真实用户反馈、bug 报告、维护者响应速度 |
| 🥈 | GitHub Topics / Trending | 发现同类项目 |
| 🥈 | OSSInsight / Star History | ⭐ 增长趋势 |
| 🥉 | 高质量周报（TommyZ、devflokers） | 社区视角和对比 |
| 4️⃣ | HN/Reddit 讨论 | 真实用户使用体验 |

### AI/LLM/模型

| 优先级 | 信源 | 用途 |
|:---:|------|------|
| 🥇 | 官方博客 + 开发者文档 | 架构细节、benchmark、发布公告、API 规格 |
| 🥇 | 官方模型卡（HuggingFace / ModelScope） | 参数量、权重可用性、使用限制、开源协议 |
| 🥇 | GitHub 官方 repo + Issues | 部署代码、已知问题、社区讨论 |
| 🥇 | arXiv / 论文原文 | 技术细节、训练方法、评估设置 |
| 🥈 | 权威科技媒体（VentureBeat、TechCrunch、The Verge） | 独立分析、定价汇总、业界定位——模型发布后 24-48h 内最早的外部深度评测 |
| 🥈 | 权威财经媒体（SCMP、Reuters、Bloomberg） | 股价影响、行业格局、地缘政治背景 |
| 🥉 | 深度分析博客（知乎 Codex 级、DataCamp、CodingFleet） | 社区测试、配置指南、使用体验、挖坑 |
| 🥉 | **对抗性信源**（搜索 {model} limitations / problems / issues / criticism） | 刻意收集负面反馈和已知限制，平衡官方 hype |
| 🥉 | TheSequence、Import AI、AI Weekly（邮件通讯） | 趋势解读、行业汇总 |
| 4️⃣ | Reddit r/LocalLLaMA / r/singularity / r/MachineLearning | 真实用户体验、服务品质反馈、自部署报告 |
| 4️⃣ | Hacker News | 技术社区的评价、质疑和讨论 |
| 4️⃣ | X/Twitter（作者本人账号） | 一手公告、社区反应（也含大量 hype） |

**⚠️ 最新发布模型（<1 周内）的特殊处理**:
- 🥇 官方博客和文档是主要数据源——这是唯一含完整 benchmark 的地方
- 🥈 VentureBeat 等科技媒体通常在 24-48h 内发布独立分析文章，是早期交叉验证的关键
- 4️⃣ Reddit/HN 的真实体验反馈对评估服务质量非常关键，但需谨慎对待纯 hype 个人帖
- **必须执行对抗性搜索**（`{model} limitations / issues / problems`），早期的 hype 浪潮会淹没真实问题
- **明确区分官方自测 vs 独立第三方复测**——在报告中标注每条 benchmark 的来源类型

> 💡 内置领域探测器参考表：将 AI/LLM 信源表与 `references/ai-model-research.md` 的完整工作流配合使用。

### 金融/财经数据

| 优先级 | 信源 | 用途 |
|:---:|------|------|
| 🥇 | 官方交易所/监管机构 | 一手数据 |
| 🥇 | 项目官方 GitHub + Issues | 数据源可靠性、已知风险 |
| 🥈 | 央行/统计局官网 | 宏观经济数据 |
| 🥉 | 东方财富/新浪财经（akshare 数据源） | ⚠️ 需标注「第三方，非官方」 |
| ❌ | 任何声称「稳赚/高收益/无风险」的内容 | 直接排除 |

### 产品/价格对比

| 优先级 | 信源 | 用途 |
|:---:|------|------|
| 🥇 | 官方定价页 | 价格、套餐 |
| 🥇 | 官方文档 | 功能规格 |
| 🥈 | G2/Capterra/ProductHunt 评价 | 用户反馈 |
| 🥉 | 对比文章（知名作者） | 横向对比 |

---

## 排除规则

以下类型的内容**不纳入报告**（即使 web_search 返回）：

| 类型 | 判定 | 处理 |
|------|------|------|
| 无作者/无日期的匿名文章 | 无法验证 | 排除 |
| 纯营销/软文（「最佳」「必看」「终极指南」+ 推广链接） | 动机可疑 | 排除 |
| 机翻内容（语法错误多、术语翻译不一致） | 信息失真 | 排除 |
| 已被 tinyfish MCP 过滤的站点 | 自动过滤 | 无需处理 |

---

## 整合到搜索流程

### Step 0 决策门：根据 domains 加载对应信源优先级

```
domains: ["github"] → 加载「开源/GitHub」信源表
domains: ["ai"] → 加载「AI/LLM」信源表
domains: ["finance"] → 加载「金融/财经」信源表
```

### Step 3 搜索：优先用高信源

1. 先用 🥇 信源定向搜索（如 `site:github.com`、`arXiv`）
2. 如果 🥇 信源数据不足，下探到 🥈
3. 🥉 及以下只在前面都不够时使用

### Step 6 交叉验证：信源多样性检查

报告中来源类型的分布必须满足：
- 🥇 一手/官方 ≥ 1 个
- 🥇+🥈 合计 ≥ 总数 50%
- ⚠️ 聚合/转载 ≤ 总数 30%

---

## 信源标注格式

报告中的每条引用在来源表中标注质量层级：

```
| # | 来源 | 质量 | URL |
|---|------|:---:|-----|
| 1 | akshare GitHub README | 🥇 官方 | github.com/akfamily/akshare |
| 2 | akshare GitHub Issues | 🥇 官方 | github.com/akfamily/akshare/issues |
| 3 | TommyZ Weekly 2026-06-07 | 🥉 聚合 | tommyz.blog |
```
