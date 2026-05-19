# Report Templates

## 默认模板：标准研究报告

```markdown
# 研究报告: {topic}

> 生成时间: {datetime} | 搜索深度: {depth} | 来源数量: {count}

---

## 摘要

{brief_summary}

---

## 信息来源与质量评估

| # | 来源 | 质量评分 | 状态 |
|---|---|---|---|
| 1 | [title](url) | 85 🟢 高 | ✅ 采用 |
| 2 | [title](url) | 45 🟡 中 | ✅ 采用 |
| 3 | [title](url) | 25 🔴 低 | ❌ 舍弃: 原因 |

### 已舍弃的来源
- [title](url) — 理由

---

## 关键发现

### 发现 1: {title}
> {excerpt}
— 来源: [url](url)

---

## 交叉验证

### ✅ 多源确认: {claim}
- 一致性: 多源确认
- 置信度: high
- 来源: [url1](url1), [url2](url2)

### ⚠️ 存在矛盾: {claim}
- 一致性: 存在矛盾
- 置信度: medium
- 来源: [url1](url1), [url2](url2)
- **矛盾说明**: {description}

### ❓ 待验证: {claim}
- 一致性: 孤立声明
- 置信度: low
- 来源: [url1](url1)

---

## 对抗审查

> 触发方式: auto | 触发原因: 高风险主题: 医学/健康

### 审查: {claim}
**反驳证据:**
- [url](url): summary

**发现的疏漏:**
- gap 1
- gap 2

---

*报告由 Super Search 自动生成。评分仅作相对参考，不承诺信息百分百准确。*
```

## 快速摘要模板（quick 模式）

适用于 depth=quick 的轻量搜索：

```markdown
# {topic} — 快速搜索摘要

> {datetime} | {count} 个来源

## 要点
- point 1 (来源: [url](url))
- point 2 (来源: [url](url))

## 不同观点
- view 1 (来源: [url](url))
- view 2 (来源: [url](url))

## 来源
1. [title](url) — 评分 {score}
2. [title](url) — 评分 {score}

---
*自动生成，仅供参考。*
```

## 深度研究报告模板（deep 模式）

适用于 depth=deep 的深度搜索，在标准模板基础上增加：

### 来源立场分析
```markdown
## 来源立场分布
| 立场 | 来源数 | 代表来源 |
|------|--------|----------|
| 支持 | 5 | [url1](url1), [url2](url2) |
| 中立 | 3 | [url3](url3) |
| 反对/批评 | 2 | [url4](url4) |
```

### 数据一致性分析
```markdown
## 数据一致性
| 数据点 | 来源数 | 数据范围 | 一致性 |
|--------|--------|----------|--------|
| 增长率 | 3 | 12% - 15% | 基本一致 |
```

### 信息来源图谱
```markdown
## 来源关系
- 官方来源: {count}
- 学术来源: {count}
- 媒体报道: {count}
- 个人/博客: {count}
```

## 输出路径规则

默认输出路径：`{cwd}/research-output/{topic-slug}-{datetime}.md`

用户可通过参数覆盖：
```bash
node dist/report.mjs --output ./custom/path/report.md
```
