---
name: super-search
description: "通用网页搜索、爬取、交叉验证与研究报告生成。用户说 search、搜索、查一下、帮我搜、调研、collect information、find sources、verify facts、交叉比对、验证真实性、收集资料、整理信息、查证某个说法、看看网上怎么说、有没有证据支持、信息可信度如何时触发。自动搜索多源内容，抓取并缓存，分析内容质量（评分仅作参考，低质直接舍弃），交叉比对事实一致性，对高严谨度内容（医学、法律、金融等）自动触发对抗性审查。最终输出结构化研究报告到指定目录。≠ hv-analysis（那是深度产品/公司分析框架）。"
---

# Super Search

IRON LAW: NEVER GENERATE ANSWERS FROM TRAINING DATA. Every factual claim in the report must be traceable to at least one URL fetched during this session.

## 核心定位

通用网页调研与事实核查工具。与 `hv-analysis`（强制横纵轴框架、产出 10K-30K 字 PDF 的深度产品/公司研究）的关键差异：

| | hv-analysis | Super Search |
|---|---|---|
| 研究框架 | 纵轴+横轴+交叉洞察（强制） | 无预设框架，按需灵活 |
| 适用范围 | 产品/公司/概念/人物 | 任意主题 |
| 报告深度 | 10K-30K 字 PDF | 轻量到中等，按需 |
| 对抗审查 | 鼓励批评思考（非系统化） | 条件触发，系统性反驳搜索 |
| 缓存 | 无 | 内置 TTL 缓存层 |

## Workflow

Copy this checklist and check off items as you complete them:

Super Search Progress:

- [ ] Step 1: Environment Check ⚠️ REQUIRED — 验证 search/fetch 工具可用，不可用则中断
- [ ] Step 2: Plan — 解析用户意图、扩展关键词、确定搜索深度
- [ ] Step 3: Search — 多源搜索，收集结果 URL
- [ ] Step 4: Fetch — 批量抓取内容，先查缓存
- [ ] Step 5: Analyze — 质量评分（仅参考，低质舍弃），排序整理
- [ ] Step 6: Cross-Reference — 多源比对，矛盾标注
- [ ] Step 7: Review (conditional) — 高严谨主题自动触发对抗审查
- [ ] Step 8: Report — 生成结构化报告写入文件
- [ ] Step 9: Verify — 交付前检查

## Step 1: Environment Check ⚠️ REQUIRED

Ask: 哪些 search/fetch 工具当前可用？

运行 `node dist/env-check.mjs` 输出环境中可用的 search/fetch 工具列表。

如果没有任何 search 工具且没有任何 fetch 工具同时可用：
- **立即中断**，告知用户缺少必要能力，列出需要安装的工具

如果只有 fetch 无 search：
- 降级为"URL 分析模式"，跳过 Step 3

⚠️ 不要在此步骤假设任何工具的可用性。

## Step 2: Plan

解析用户输入，确定：
- 核心主题与搜索关键词
- 搜索深度：`quick`（3-5 源）、`normal`（8-12 源）、`deep`（15-20 源）
- 是否需要对抗审查（见 `references/review-triggers.md`）
- 输出文件路径（用户指定或默认 `./research-output/{topic-slug}-{date}.md`）
- 缓存目录（用户指定或默认 `~/.super-search-cache/`）

Ask: "对以下问题，我应该额外搜索哪些对立面/反面/批评性关键词？"
例如：搜索"AI 取代程序员"时，同时搜索"AI 不会取代程序员的理由""AI 编程工具的局限性"。

## Step 3: Search

运行 `node dist/search.mjs --topic '...' --depth normal --cache-dir '...'` 生成搜索计划。

根据计划执行搜索（使用可用工具：tinyfish-search_search 等）。

收集所有搜索结果 URL，去重。

## Step 4: Fetch

运行 `node dist/fetch.mjs --cache-dir '...'` 检查缓存。

- 命中缓存 → 直接使用缓存内容（`node dist/cache.mjs get --url "..." --type fetch`）
- 未命中 → 使用可用 fetch 工具抓取（tinyfish-search_fetch、webfetch 等）
- 抓取后**必须立即**回写缓存：

```bash
# 方式 1: 管道传入数据（推荐，避免跨 shell 引号问题）
echo '{"title":"...","content":"..."}' | node dist/cache.mjs set --url "https://..." --type fetch --data -

# 方式 2: 直接传参
node dist/cache.mjs set --url "https://..." --type fetch --data '{"title":"...","content":"..."}'
```

可用的缓存 CLI 命令：
```bash
node dist/cache.mjs set --url "..." --type fetch --data '{"title":"...","content":"..."}'
node dist/cache.mjs get --url "..." --type fetch
node dist/cache.mjs has --url "..." --type fetch
node dist/cache.mjs stats
node dist/cache.mjs purge
```

默认 TTL：搜索结果 30min，网页内容 24h。

## Step 5: Analyze

运行 `node dist/analyze.mjs` 对每条内容评分。

质量评估维度（见 `references/quality-criteria.md`）：
- 来源权威度（**官方 > 知名媒体 > 个人博客 > 不可信**；涉及数值/规格/定价时，必须优先采用官方页面数据）
- 信息完整度（日期、作者、引用、数据）
- 内容新鲜度
- 语言质量（排除机翻/低质内容）

评分仅作**相对参考**，评估后明确低价值的内容直接舍弃。

## Step 6: Cross-Reference

对关键事实进行多源比对：
- 一致 → 标注"多源确认"
- 矛盾 → **立即触发事实核查**：直接 fetch 各方引用的原始来源/官方页面，以官方第一手数据为准裁定。多个第三方来源的一致意见不能覆盖官方页面的明文数据
- 孤立 → 只有一个源提及，标注"待验证"，同时尝试搜索官方来源确认

输出置信度矩阵。

**事实核查铁律**：当数值/规格类声明出现矛盾时，必须直接抓取官方定价页/规格页作为终极裁决依据，不得仅凭第三方文章数量做判断。

## Step 7: Review (conditional)

触发条件（详见 `references/review-triggers.md`）：

**自动触发**：
- 医学、法律、金融、安全等高风险主题
- 物理、化学、数学等科学主题（从基础原理出发核查）
- 关键发现置信度低于阈值
- **Step 6 交叉验证中发现矛盾或孤立声明**（触发补充搜索和官方源核查）

**手动触发**：
- 用户明确要求

运行 `node dist/review.mjs` 执行对抗审查：
- 对每个主要结论搜索反驳证据
- 检查来源多样性
- 标注遗漏风险
- 如发现重大疏漏，回到 Step 3 补充搜索

## Step 8: Report

运行 `node dist/report.mjs --output 'path/to/report.md'` 生成报告。

报告模板见 `references/report-templates.md`。

## Step 9: Verify

交付前检查：
- [ ] 报告中每条事实声明都有可追溯的 URL
- [ ] 低质量来源（评分低于阈值）已排除
- [ ] 矛盾点已通过官方来源核查并标注结论
- [ ] 高严谨主题已完成对抗审查
- [ ] 输出文件已写入指定位置
- [ ] 对比表/关键数据优先链向官方页面而非第三方文章

## Anti-Patterns

- 不检查环境可用性就直接搜索
- 用模型训练数据代替实际搜索结果
- 只看第一条搜索结果就下结论
- 跳过缓存检查重复抓取同一 URL
- 对医学/法律/金融声明不触发对抗审查
- 把质量评分当绝对标准而非相对参考
- 报告中的事实声明不附来源 URL
- 对高严谨主题不标注置信度
- 引用第三方文章中的数值而不核实官方来源
- 交叉验证发现矛盾时不抓取官方页面做二次确认
- 在对比表/详情中优先使用第三方链接而非官方链接
- 发现孤立声明后不做补充搜索就直接标注"待验证"并放过

## 脚本设计原则

- 脚本输出 JSON 指令，由 AI 执行实际的 search/fetch 工具调用
- 脚本不直接依赖任何具体的 search/fetch API
- 缓存路径可由用户通过 `--cache-dir` 覆盖
- 所有时间敏感操作记录时间戳
