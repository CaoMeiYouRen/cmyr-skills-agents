# Domain Detector — 搜索前强制决策门

在进入搜索阶段之前，**必须**回答以下 5 个问题并输出决策 JSON。未通过此门禁不得进入 Step 3。

## 5 个探测问题

对用户搜索主题逐一判断：

### Q1: 涉及 GitHub/开源项目？

> 关键词触发：github、开源项目、open source、repo、仓库、star、fork、⭐、GitHub Trending、npm、pypi

**命中 → 强制**：
- 所有引用的 GitHub 项目必须抓取原始 repo 页面确认 star 数、许可证、last commit
- 涉及选型/对比 → 必须扫描 Issues 前 1-2 页
- 报告中所有 star 数必须标注获取日期

### Q2: 涉及金融/投资/金钱？

> 关键词触发：金融、股票、投资、基金、理财、保险、贷款、利率、finance、stock、investment、trading、价格、定价、费用、pricing

**命中 → 强制**：
- 触发完整对抗审查（`references/review-triggers.md` 第 1 节）
- 所有定价/费率数据必须双源确认
- 报告必须包含风险矩阵和免责声明

### Q3: 涉及医学/法律/安全？

> 关键词触发：医学、医疗、药物、legal、law、安全漏洞、vulnerability、hack、exploit

**命中 → 强制**：
- 触发完整对抗审查
- 科学声明必须从基础原理核查
- 置信度标注必须贯穿全文

### Q4: 涉及产品/工具/竞品对比？

> 关键词触发：对比、比较、哪个好、排行、推荐、选型、vs、versus、pricing、套餐、竞品、替代品、alternatives、competitors、为什么选、migrate、迁移

**命中 → 强制**：
- 每个产品的关键数据（价格、规格）必须从官方页面抓取
- 对比表中优先使用官方链接而非第三方文章
- 涉及工具/框架竞品对比 → **必须触发安全态势调查**（查询 CVE、供应链攻击史、安全审计报告），详见 `references/competitive-analysis.md`
- 涉及工具迁移场景 → 搜索 `<target> migrate from <source>` 检查迁移工具/兼容性

### Q5: 时效性敏感？

> 关键词触发：最新、2026、近期、最新版、recent、latest、trending

**命中 → 强制**：
- 所有数据来源必须标注日期
- 来源日期 > 6 个月前的必须标注「⚠️ 可能过时」
- 涉及「trending/最新」的 → 补充搜索确认是否有更新版本

---

## 决策 JSON 输出格式

完成 5 个问题的判断后，**必须在进入 Step 3 之前**输出以下 JSON：

```json
{
  "topic": "用户搜索主题",
  "domains": ["github", "ai"],
  "triggers_fired": ["github-verification"],
  "depth": "normal",
  "multi_language": ["en"],
  "counter_queries": ["...反面搜索词..."],
  "verification_actions": [
    "抓取所有引用 GitHub repo 确认 star/license/activity",
    "标注所有 star 数获取日期"
  ]
}
```

### 字段说明

| 字段 | 必填 | 说明 |
|------|:---:|------|
| `topic` | ✅ | 搜索主题摘要 |
| `domains` | ✅ | 从 `[github, finance, medical, legal, security, product-compare, science, general]` 中选择 |
| `triggers_fired` | ✅ | 从 `[github-verification, financial-review, adversarial-review, pricing-verification, date-verification]` 中选择 |
| `depth` | ✅ | `quick` / `normal` / `deep`（按命中数自动确定） |
| `multi_language` | ✅ | 需要扩展的语言列表（至少 `["en"]`） |
| `counter_queries` | - | 对抗性搜索词（至少 1 个） |
| `verification_actions` | ✅ | 具体要执行的验证动作列表 |

### 深度自动确定规则

- 0 个触发器命中 → `quick`（3-5 源，单源可接受）
- 1 个命中（非金融/医学）→ `normal`（8-12 源）
- 命中 `financial-review` 或 `adversarial-review` 或 2+ 个命中 → `deep`（强制对抗审查）

---

## 决策门通过标准

满足以下条件才可进入 Step 3：

1. ✅ 5 个问题全部回答
2. ✅ JSON 中 `domains` 和 `triggers_fired` 不为空
3. ✅ `verification_actions` 列表与触发的规则一致
4. ✅ 如果命中 Q1（GitHub），必须包含「抓取原始 repo」动作
5. ✅ 如果命中 Q2（金融），`depth` 必须是 `deep`
