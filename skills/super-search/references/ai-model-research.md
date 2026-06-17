# AI 模型调研工作流

用于深度调研一个 AI/大语言模型的发布、能力、定价、开源状态和社区反馈。适合 `depth=normal` 或 `deep` 模式。

---

## 信源搜索优先级（按顺序执行）

### 第一轮：官方源（获取事实基础）

| # | 搜索目标 | 搜索词示例 | 目的 |
|---|---------|-----------|------|
| 1 | **官方发布博客** | `{model} blog release` 或直接 URL | 获取最权威的 benchmark、架构、定位 |
| 2 | **开发者文档** | `docs.{provider}.com {model}` | 获取上下文窗口、输出限制、API 调用方式 |
| 3 | **GitHub 官方 repo** | `site:github.com {org}/{model}` | 检查开源协议、star 数、README、deploy 指南 |
| 4 | **HuggingFace / ModelScope** | `huggingface.co/{org}/{model}` | 获取模型卡、benchmark 表、权重下载链接 |
| 5 | **arXiv 论文** | `arxiv.org {model} technical report` | 获取论文原文，含详细训练/评估设置 |

### 第二轮：独立媒体与竞品（交叉验证 + 定价）

| # | 搜索目标 | 搜索词示例 | 目的 |
|---|---------|-----------|------|
| 6 | **权威科技媒体** | `{model} VentureBeat TechCrunch` 或 `site:venturebeat.com {model}` | 独立评测、定价汇总、业界定位 |
| 7 | **权威财经媒体（如涉及上市公司）** | `{company} SCMP Reuters {model}` | 股价、行业格局、地缘政治背景 |
| 8 | **竞品对比** | `{model} vs {competitor} comparison benchmark` | 横向对比，了解差异化定位 |

### 第三轮：深度分析（社区测试 + 使用体验）

| # | 搜索目标 | 搜索词示例 | 目的 |
|---|---------|-----------|------|
| 9 | **深度分析** | 知乎、Medium、DataCamp、CodingFleet | 配置指南、使用体验、挖坑 |
| 10 | **社区反馈** | Reddit r/LocalLLaMA / r/singularity、Hacker News | 真实用户评价、服务品质反馈 |

### 第四轮：对抗性搜索（强制）

| # | 搜索目标 | 搜索词示例 | 目的 |
|---|---------|-----------|------|
| 11 | **限制搜索** | `{model} limitations / issues / problems / criticism` | 刻意寻找负面反馈 |
| 12 | **工具链兼容性** | `{model} tool call malformed JSON` / `{model} OpenCode issue` | 检查工具调用等工程问题 |

### 第五轮：补充抓取

| # | 搜索目标 | 搜索词示例 | 目的 |
|---|---------|-----------|------|
| 13 | **Models.dev / LLM Stats** | `models.dev {model}` / `llm-stats.com {model}` | 规格聚合（上下文、定价、能力标签） |
| 14 | **OpenRouter 对比** | `openrouter.ai/compare/{provider}/{model}` | 跨模型定价和 benchmark 快速对比 |

---

## 最新发布模型（<1 周内）的特殊处理

当被调研的模型发布时间少于 1 周时：

### 风险清单

- [ ] **官方 benchmark 是唯一来源**——截至发布日 + 3-5 天，可能只有官方博客含完整 benchmark
- [ ] **weights/API 可能尚未完全开放**——发布时承诺"下周开源/API 上线"在实际日期前无法验证
- [ ] **VentureBeat 等媒体通常在 24-48h 内发布分析**——这些是早期独立验证的最好来源
- [ ] **社区评测以 anecdotal 为主**——Reddit/HN 的"一晚上实测"有价值但不替代标准评测
- [ ] **早期 hype 会淹没真实问题**——必须刻意执行对抗性搜索

### 交叉验证策略

| 数据类别 | 信任策略 |
|---------|---------|
| **架构/参数量** | 以官方博客为准，媒体可能有四舍五入差异（如 744B vs 753B）→ 注释说明 |
| **Benchmark 分数** | 官方数据可引用但标注"来源: 官方"。寻找 ❓是否有媒体/社区进行了独立复测 |
| **API 定价** | 以官方定价页为准。VentureBeat 等媒体的定价汇总表通常准确且可交叉验证 |
| **开源协议** | 确认 GitHub 仓库 LICENSE 文件 + HuggingFace 模型卡。非纯文本来源可信度降低 |
| **服务稳定性** | 以 Reddit/HN 真实用户反馈为准。多个独立用户的一致投诉比官方 FAQ 更可信 |

### 报告中的标注规范

- 所有官方 benchmark 附加标注 `✅ 来源：官方博客`
- 如有第三方独立复测，附加 `✅ 第三方交叉验证（来源：{media_name}）`
- 如果某个基准数据只有官方来源，在交叉验证矩阵中标注 `⚠️ 仅官方单源`
- 首发期间社区反馈标注 `4️⃣ 社区体验（单次/初始）`

---

## 常见坑

- ❌ 将同一模型系列早期版本的 benchmakr 数据直接贴在最新版名称下
- ❌ 只采信官方博客 hype 而不做对抗性搜索
- ❌ 把 Reddit 上单个用户的 hype 帖当作"广泛好评"
- ❌ 在 weights/API 未实际开放前就断言"完全可用"
- ❌ 不区分"官方声明"和"独立验证"就在报告中混用数据
