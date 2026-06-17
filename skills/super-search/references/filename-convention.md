# 输出文件命名规范

> 最后更新：2026-06-12

## 格式

```
./research-output/{YYYY-MM-DD}-{topic-slug}.md
```

日期在前，便于按时间排序和检索。

## Slug 生成规则

```typescript
function slugify(text: string): string {
  return text
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')  // 移除特殊字符，保留中日韩文字
    .trim()
    .replace(/\s+/g, '-')                     // 空格转连字符
    .slice(0, 64)                             // 最长 64 字符
}
```

## 版本后缀

当同一天对同一主题进行多次调研时（如追加搜索、数据更新），自动追加版本后缀：

```
首次：workspace/2026-06-12-llm-pricing.md
二次：workspace/2026-06-12-llm-pricing-v2.md
三次：workspace/2026-06-12-llm-pricing-v3.md
```

**跳过规则**：当通过 `--output` 参数手动指定了完整路径时，不追加版本后缀（用户期望精确控制文件名）。

## 实现位置

- `scripts/report.ts` — `main()` 中的 `formatDateSlug()` + 碰撞循环
- `dist/report.mjs` — 编译版本，逻辑相同
- `SKILL.md` Step 2 — AI 读取的默认路径文档
- `references/report-templates.md` — 模板输出路径规则
