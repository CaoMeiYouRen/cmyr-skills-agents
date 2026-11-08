# 提案：AI 基建治理检查对齐（ai:check）

> 能力：`ai-check`（B 类：检查项统一，脚本由项目自持）
> 发起：2026-11-02 ｜ 状态：已结案（逐项目结论见文末生成块，数据源 [status.json](./status.json)）
> 注：§2–§4 是 2026-11-02 的核验快照；caomei-ui 的 references 索引此后已补齐，现状与跳过项以文末生成块为准。

## 1 变更摘要

三个项目各有一份 `scripts/ai/check-governance.mjs`，检查项重叠但覆盖不同；dependfix 用的是文档治理脚本。本提案只统一「检查哪些项、输出什么、退出码怎么定」，不要求统一脚本实现。

- 能力台账：`capabilities/registry.json` 的 `ai-check`
- 上游既有规则：#1 以 `scripts/verify-manifest.mjs` 为准；#2 以 `standards/roles.md` §4 为准；#4 与 `verify-manifest` 同款思路（references 必须被索引）

## 2 背景与证据（按脚本实测）

```bash
node scripts/check-capabilities.mjs --projects ../dependfix,../caomei-auth,../momei,../caomei-ui
for p in caomei-auth caomei-ui momei; do
  grep -nE "function check|metadata\.internal|missing-link-target|checkSkillReferences|deprecated" "$p/scripts/ai/check-governance.mjs"
done
```

| 项目 | frontmatter 必填 | metadata.internal | 主定义/镜像一致 | 死链 | references 索引 | 弃用引用扫描 | 能力标记 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| caomei-auth | ✅ name/description | ✅（仅要求 `internal:true`，未比对 manifest） | ✅ 内容一致 | ✅ | — | — | — |
| caomei-ui | ✅ name/description | — | ✅ 仅校验 symlink 目标 | — | —（`checkSkillReferences` 查的是 skill 名引用，不是 references 文件） | — | — |
| momei | ✅ name/description | ✅（仅要求 `internal:true`，未比对 manifest） | ✅ 内容一致 | ✅ | —（只查「未被引用的 skill/agent」） | — | — |
| dependfix | —（结构性检查在 `check-doc-governance.mjs`） | — | — | 部分（文档索引链接） | — | — | — |

结论：同一类问题四套判定，覆盖项与报错格式都不同；没有任何项目检查「references 是否被索引」「弃用引用」「能力标记」。

## 3 建议改动（与 §2 的缺口一一对应）

| 项目 | 建议 | 说明 |
| :--- | :--- | :--- |
| caomei-auth | **建议：补 3 项** | references 索引、弃用引用、能力标记 |
| caomei-ui | **建议：补 4 项** | metadata.internal、死链、references 索引、弃用引用（能力标记可选） |
| momei | **建议：补 3 项** | references 索引、弃用引用、能力标记 |
| dependfix | **建议：补入口与 4 项** | 暴露 `ai:check` 入口，补 frontmatter/metadata.internal、镜像、references 索引、弃用引用；能力标记可选 |
| 其他项目 | 可跳过 | 无 AI 基建库存时登记 `optOut` |

## 4 建议对齐的检查项

| # | 检查项 | 级别 | 权威口径 |
| :--- | :--- | :--- | :--- |
| 1 | skill frontmatter 必填字段（`name`、`description`、`metadata.internal`） | P0 | 以上游 `verify-manifest` 规则为准（附 URL / commit） |
| 2 | 主定义（`.github/`）与平台镜像逐文件一致 | P0 | 以 `standards/roles.md` §4 为准；镜像形态（symlink / copy）项目自定 |
| 3 | 文档相对链接可解析 | P0 | 现有项目脚本 |
| 4 | 技能 `references/*.md` 被执行入口索引 | P0 | 与 `verify-manifest` 同款规则 |
| 5 | 非弃用文件不得引用已弃用技能 / agent | P1 | 先 warning，稳定后升级 |
| 6 | 能力标记检查（读 `capabilities/registry.json`，可选） | P1 | 缺 required 标记只提示 |

输出：默认人类可读；`--json` 输出 `{ ok, errors[], warnings[] }`；退出码 0 通过、1 有 error、2 参数 / 环境错误。

## 5 需要项目 agent 研判的问题

1. **P1 是否阻断**：弃用引用扫描与能力标记检查，先 warning 还是直接 error。
2. **能力台账读取**：允许联网 / 读兄弟仓库路径吗？离线时跳过并 warning 的降级是否可接受。
3. **镜像形态**：symlink 与 copy 两种实现是否统一；统一不了时如何定义「一致」。
4. **输出兼容**：现有 CI 是否依赖当前文本输出；切 JSON 是否需要过渡。
5. **dependfix**：新增 `ai:check` 入口，还是包装现有 `check-doc-governance.mjs`。

## 6 验收标准（fixture）

- [ ] 缺 `metadata.internal` → 失败并指出文件。
- [ ] 镜像与主定义不一致 → 失败。
- [ ] 文档死链 → 失败并给出目标路径。
- [ ] 技能 `references/orphan.md` 未被索引 → 失败。
- [ ] 非弃用文件引用已弃用技能 → 按项目决定 warning 或失败，但必须出现。
- [ ] `--json` 可被 CI 解析；退出码符合约定。

## 7 回滚

- 新增检查项先以 warning 上线，稳定后升级为 error。
- 能力台账读取失败必须降级为 warning，不得让治理检查本身阻塞发布（P0 项除外）。

## 8 本项目不做什么

- 不提供统一脚本或 npm 包。
- 不修改任何下游文件。
- 不规定 CI job 名称与执行时机。

## 9 回炉结论（2026-11-09）

按 [standards/proposals.md](../../standards/proposals.md) §2.1：`#5 弃用引用扫描` 与 `#6 能力标记` 均被 3/4 项目以结构性理由 optOut，判定为提案设计问题，不再作为后续批次的对齐项。

- `#5` 撤回：各项目的 deprecated 形态不同，且多数没有机器可读清单；需要时由项目在自身生命周期表内实现。
- `#6` 撤回：项目侧读取上游 registry 会形成第二事实源且离线不可用。若未来仍需跨项目能力视图，改为上游发布只读快照，项目只消费快照。
- `optOut` 记录保留为历史，不删除；其余检查项（frontmatter、镜像、死链、references 索引）继续有效。

<!-- proposal-status:start -->
## 项目研判结论（自动生成）

> 数据源 `docs/proposals/status.json`；由 `node scripts/check-proposals.mjs --write` 生成，请勿手工编辑。

| 项目 | 结论 | 日期 | 依据 |
| :--- | :--- | :--- | :--- |
| dependfix | 部分采纳 | 2026-11-08 | 上游登记 |
| momei | 部分采纳 | 2026-11-03 | 项目反馈 |
| caomei-ui | 部分采纳 | 2026-11-09 | 扫描标记 |
| caomei-auth | 部分采纳 | 2026-11-02 | 上游登记 |

- **dependfix**：其余检查项现状合规，机检补强登记为项目候选
- **momei**：只采纳 #4 references 索引
- **caomei-ui**：frontmatter 与 references 索引已机检；无书面结论，跳过项未登记
- **caomei-auth**：其余检查项已对齐
<!-- proposal-status:end -->
