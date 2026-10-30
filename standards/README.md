# 规范上游（standards）

> 面向项目治理的规范骨架。项目按 `<!-- TODO: 项目填充 -->` 补正文；本仓库只维护概念、判定规则与默认阈值，不承载具体项目正文。

## 1 单点边界（一条规则只写一次）

| 内容 | 归属 |
| :--- | :--- |
| 单技能的执行流程与判定 | `skills/<name>/SKILL.md` 或 `references/` |
| 多个技能 / 多个项目共用的治理规则 | 本目录 |
| 项目可变参数（命令、路径、角色实例、覆盖后的阈值） | 项目 `AGENTS.md` |
| 与上游不同的行为 | 项目 `.ai/overrides/` |
| 长篇项目正文 | 项目 `docs/standards/*` |

判定方法：问「这条规则不写在这里，谁会找不到？」只有跨技能、跨项目才进本目录。同一规则已经写在技能里时，本目录只留一行指针。

**引用约定**：本目录提到技能时写 `skills/<name>` 路径形式，不写裸名——裸名会被解析到全局同名技能。

## 2 文件索引

| 文件 | 管什么 | 收敛度 |
| :--- | :--- | :--- |
| [authority.md](./authority.md) | 事实源层级与冲突顺序 | 3/4 项目（dependfix 无独立章节） |
| [roles.md](./roles.md) | 角色矩阵、默认路径、阶段去重、主定义/镜像治理 | 3/4 项目（dependfix 无角色矩阵） |
| [gates.md](./gates.md) | 发布前安全门禁、产物证据、绕过判定 | 4/4 项目有测试门禁；安全门禁 2/4 |
| [intake.md](./intake.md) | 外部技能准入与库存变更同步 | 3/4 项目 |
| [memory.md](./memory.md) | 经验沉淀载体与蒸馏补充触发 | 2/4 项目 |

## 3 什么不进本目录

以下内容已有唯一归属，本目录不得复述：

- Review Gate 的结论分级、验证矩阵与 audit-depth：`skills/code-reviewer`
- 门禁命令的选择逻辑：`skills/quality-guardian`
- PDTFC 六阶段的步骤与交接协议：`skills/full-stack-master`
- 单条 CVE / 安全公告的影响面判定：`skills/security-guardian` 的 `runtime-cve-impact-check`
- 提交消息格式与拆分粒度默认值：`skills/conventional-committer`（含 `commit-splitting`）

具体命令、路径、豁免文件与项目实际阈值放项目 `AGENTS.md`；本目录给的是**可被项目覆盖的默认值**。

## 4 怎么分发（当前不自动）

`standards/` **不参与 L0 自动分发**（模板只植入技能与 agent）。项目接入方式：

1. 新建项目：复制需要的文件到 `docs/standards/`，按 `TODO` 填正文；
2. 已有自己 `docs/standards/*` 的项目：不要整目录复制，按文件主题合并（如把 `authority.md` 并入项目 `ai-governance.md`），并在项目 `AGENTS.md` 写一行来源与版本；
3. 任何情况下都不在项目里维护第二份「同一规则」的正文。

<!-- TODO: 若要改为自动分发，需要扩展 cmyr-template-cli 对 l0Selection.files 的支持，并先确定项目侧路径。 -->

## 5 写作要求

- 每条规则写成**可判定**的一句话（什么条件、怎么判、判错怎么办），不写背景故事。
- 项目侧变量用 `<!-- TODO: 项目填充 -->` 标出，并在同文件给默认值或「未填时按技能默认」。
- 改动本目录前先确认没有在技能里重复定义同一条规则；发现重复时删一处、另一处改指针。
- 新增文件前先问：它是否只是另一个文件的章节？是就并入，不新建。
