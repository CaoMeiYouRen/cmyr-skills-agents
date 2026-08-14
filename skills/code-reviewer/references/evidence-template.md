# Review Gate 证据模板

默认审查记录写入 `artifacts/review-gate/`（已纳入 `.gitignore`），用于多轮 review 的延续与对账。

推荐文件命名：`artifacts/review-gate/YYYY-MM-DD-<scope>.md`

## 使用方式

1. 首轮 review 创建一份记录，字段按下方模板预填。
2. 每轮 review 在同一文件追加一个新的 `Round N` 章节。
3. 问题编号使用 `RG-B01`（blocker）/ `RG-W01`（warning）/ `RG-S01`（suggest）系列，递增编号；问题关闭时记录关闭轮次。

## 模板

```md
# Review Gate Record

- 范围:
- 关联 Todo:
- 改动类型:
- 风险等级: 低 / 中 / 高
- audit-depth:（quick / standard / deep，调用方声明）
- 记录路径:

## Round 1（第 1 轮）

### 审查范围
- 文件清单:
- 关键入口:

### 最低验证要求
- 目标层级:（对照 SKILL.md 最低验证矩阵）
- 必要命令:

### 已执行验证
- 命令:
- 结果:

### Findings
#### blocker
1. RG-B01 标题
   - 位置:
   - 风险:
   - 修复方向:

#### warning

#### suggest

### Review Gate
- 结论: Pass | Reject
- 失败原因或通过条件:
- 实际用时 / 是否超时间盒:（由调用方宿主时钟事后实测回填，审计方不自报时长）
- 本轮新增问题:
- 本轮已关闭问题:
- 仍待复查问题:

### 未覆盖边界

### 后续补跑计划
```

## 多轮延续规则

- Round 2+ 只复查上轮未关闭问题编号对应的修复点 diff，不重读全量 diff。
- 已关闭问题在对应编号旁标注关闭轮次；未关闭问题保持编号不变。
- 最终交付时，`Review Gate` 结论与复查基线必须与证据记录一致。
