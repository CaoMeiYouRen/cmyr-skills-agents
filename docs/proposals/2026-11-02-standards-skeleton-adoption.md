# 草案：`standards/` 骨架接入（仅 dependfix 试点）

> 状态：**草案，未发起**。先在 dependfix 试点两节，验证后再决定是否向其余三个项目发正式提案。
> 能力：`standards-adoption`（尚未登记到能力台账，定稿后再登记）

## 1 为什么先试点

上游 `standards/` 已有 6 个文件（authority / roles / gates / task-start / intake / memory），但四个项目都是 0 引用（`ls <项目>/docs/standards/*.md | wc -l` 为 10–14）——每个项目各维护 10–14 份自有规范，同一规则存在多份表述。

一次性全量接入会改到每个项目的规范正文，成本高、也容易变成「复制一份上游文件」的第二权威。所以只选一个项目、两节内容试。

## 2 试点范围（dependfix）

| 上游文件 | 试点内容 | 合并去向（待研判） |
| :--- | :--- | :--- |
| `standards/authority.md` | 三层事实源 + 冲突顺序 | dependfix 的 `AGENTS.md` 或 `docs/standards/ai-governance.md` |
| `standards/roles.md` | 阶段主责、阶段去重、主定义/镜像治理 | `docs/standards/ai-collaboration.md` 或 `AGENTS.md` |

**只做合并，不复制**：项目保留自己的正文，上游只提供章节骨架与判定规则；同一规则在项目里只能有一处正文，另一处改指针。

## 3 试点要回答的问题

1. 合并后 `AGENTS.md` 是否变短、重复段落是否减少（对比合并前后的行数与重复条款）。
2. 角色矩阵与阶段去重放进 `ai-collaboration` 还是 `AGENTS.md`，哪种更符合「单一权威」。
3. 上游文件如何标注来源与版本（URL + commit），避免项目侧无法追溯。
4. `standards/` 不自动分发的前提下，项目是「复制骨架」还是「链接引用」；链接引用时离线/断网如何处理。
5. 合并后 `ai:check` 是否需要新增「规范来源可追溯」检查项（与 P3 联动）。

## 4 明确不做

- 本轮草案不修改 dependfix，只记录试点方案。
- 不把上游 6 个文件整目录复制进项目。
- 不替换项目已有的 `docs/standards/*` 正文。
- 不在试点结论出来前向其余三个项目发提案。
- 不改 `cmyr-template-cli` 的分发逻辑（等试点结论）。

## 5 试点验收（建议）

- [ ] 两节内容在项目里只有一处正文，其余为指针。
- [ ] `AGENTS.md` 的重复条款数量下降，且没有新增死链。
- [ ] 规则变更时只需改一处，评审能指出唯一权威位置。
- [ ] 记录合并前后行数与重复条款对比，作为是否推广的依据。

## 6 后续

试点通过后：
1. 向其余三个项目发正式提案（authority + roles 两节）；
2. 再评估 `gates` / `memory` / `intake` / `proposals` 是否作为第二批；
3. 决定是否把 `standards/` 纳入 `cmyr-template-cli` 的 `l0Selection.files`。

## 7 项目研判记录

| 项目 | 结论 | 理由 |
| :--- | :--- | :--- |
| caomei-auth | 本轮不采纳 | 草案尚未发起正式提案；项目 `AGENTS.md` §2（三层事实源与冲突顺序）与 §6.2（主定义 / 镜像治理）已有等价正文，再引入上游正文会违反「同一规则只有一处正文」。 |
| momei | 本轮不采纳 | 草案尚未发起；`AGENTS.md` §2 已有三层事实源与冲突顺序，§6.3 已有主定义 / 镜像治理，再引入上游正文会形成第二权威。 |
| caomei-ui | 本轮不采纳 | 草案尚未发起；`AGENTS.md` §2 已有三层事实源与冲突顺序、§8.2 已有主定义 / 镜像治理，且 `check:standards-redundant:strict` 禁止规范重复表述，搬运上游正文会直接触发本仓门禁。 |
| dependfix | 本轮不采纳 | 试点对象本身：`docs/standards/documentation.md §4` 已有三层事实源、冲突顺序与规范单点声明，`docs/standards/ai-governance.md §2` 已有主定义 / 符号链接镜像治理，`AGENTS.md` 已有角色矩阵；再引入上游正文会形成第二权威，且会触发 `check:standards-redundant:strict`（2026-11-08 研判）。 |

- 复查条件：四个项目均已给出结论（dependfix 2026-11-08 不采纳，口径与前三个项目一致）；仅当上游 `standards/` 变为可直接引用（发布为包 / submodule）或项目需要「规范来源可追溯」标注时重新评估，仍不搬运正文。
- 能力台账：`standards-adoption` 尚未登记，本轮不写入 `capabilities/registry.json`；若试点定稿后登记，结论在本表继续更新。
