# 任务开局检查（规范入口）

> 规则正文（触发条件、结论映射、降级与验收）只在 [skills/full-stack-master/references/task-start.md](../skills/full-stack-master/references/task-start.md)。
> 本文件不复述判定，只登记收敛度与项目参数。

## 1 收敛度

- 已落地：1/4 项目（dependfix）。
- 其余项目在重新播种 / 同步 L0 后随 `full-stack-master` 获得该步骤；项目侧只需核对参数。

## 2 项目参数

| 参数 | 默认 | 说明 |
| :--- | :--- | :--- |
| 默认分支 | 仓库默认分支 | 仅在 `gh` 不支持 `--commit` 时作为 fallback（见规则正文第 2 步） |
| 任务态文件 | `.session/current-task.yaml` | 未引入 session 的项目需先补齐 |
| 展示位置 | 任务开局 briefing | 也可只在失败时输出 |

<!-- 项目填充：实际默认分支、session 路径、briefing 模板位置。 -->

## 3 采纳验收

见规则正文第 6 节；项目侧只需在 briefing 中验证四项：通过、失败、无相关 run、不可用。
