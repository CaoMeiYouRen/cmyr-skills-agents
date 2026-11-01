# 提案：发布前安全告警门禁（政策对齐 + 模板）

> 能力：`release-security-gate`（B 类：政策统一、实现由项目自建）
> 发起：2026-11-02 ｜ 状态：待各项目 agent 研判

## 1 变更摘要

四个项目都已有发布前安全检查，但**扫描范围与边界条件不同**。本轮只统一「政策 + 结构模板」，不统一实现：脚本、台账路径、token 仍由项目自持。

- 上游政策：`standards/gates.md` §2（open + dismissed、critical 被 dismiss 仍阻断、high 三类豁免、fail-closed、到期重新阻塞）
- 上游模板：`standards/templates/release-security-gate.md`（结构 + 占位 + 验收，不写判定）
- 项目侧：按模板补/改自己的 `docs/standards/security.md` 与 `AGENTS.md`

## 2 背景与证据

可复现检查：

```bash
node scripts/check-capabilities.mjs --projects ../dependfix,../caomei-auth,../momei,../caomei-ui
grep -n "security" <项目>/.github/workflows/release.yml
```

| 维度 | dependfix | caomei-auth | momei | caomei-ui |
| :--- | :--- | :--- | :--- | :--- |
| 门禁入口 | `check:release-security`（release.yml 内） | `security:alerts`（release.yml 内） | `security:alerts` + `security:audit-deps`（release.yml 内） | `check:security-alerts` + 独立 `security-alerts.yml`，**release.yml 未接线** |
| 扫描范围 | open + dismissed | open | open | open（§2.1 文本） |
| critical 被 dismiss | 阻断 | 未规定 | 未规定 | 未规定 |
| high 豁免 | no-fix / hard-fix / false-positive | 自由文本 reason | temporaryException / allowlist | 维护者批准 + backlog + 发布说明 |
| 台账 | `.github/release-security-exemptions.json` | `.github/security-alert-exemptions.json` | `.github/security/security-alert-exceptions.json` + `dependency-risk-allowlist.json` | `.github/security-alerts-exemptions.json` |
| fail-closed | 明确（超时 / 429 / 404 / 非数组） | 明确 | 数据源缺口写入证据 | token 缺失时 job 失败 |

## 3 建议改动（按项目）

| 项目 | 建议 | 说明 |
| :--- | :--- | :--- |
| dependfix | **必须：核对** | 政策基线；条件形式复核由发布前人工完成，报告给出豁免计数、明细以台账为准（warning 可选），不改实现 |
| caomei-auth | **建议：补政策** | 补 dismissed 处理、到期重新阻塞；台账路径保留；复核条件沿用现有 `expiresAt`，字段向 §2.4 全字段对齐 |
| momei | **建议：补政策** | 两套台账写清分工；critical dismissed 需阻断；与 audit 的关系写明 |
| caomei-ui | **建议：接线** | 已有脚本、台账、§2.1；缺的是 `release.yml` 接线与 dismissed 语义。保留其更严格的「人工批准 + 发布说明披露」 |
| 其他项目 | 可跳过 | 若无发布流程，登记 `optOut` 与理由 |

## 4 需要项目 agent 研判的问题

1. **实现形态**：沿用现有脚本、改用 dependfix 的实现，还是自建薄脚本？（本轮不提供统一包）
2. **台账迁移**：现有条目是否迁到 §2.4 全字段；迁移期间旧条目如何处置（阻塞 / 一次性白名单 / 重新登记）。
3. **token**：确认 Dependabot 是否具备 alerts 读权限的 PAT、Code Scanning 是否可用 `GITHUB_TOKEN` + `security-events: read`；政策要求按来源分离，若当前共用需说明补齐与轮换方式。
4. **fail-closed 风险**：切换阻断后可能立刻卡住下一次发布；是否接受 report-only 过渡期，长度多少。
5. **范围外告警**：`tests/` 路径的 Code Scanning 等是否列入范围外，以及依据。
6. **保留项**：项目已有的更严格规则（人工批准、发布说明披露、双台账）是否保留——保留时不得因对齐模板而删除。

## 5 验收标准

用 fixture / mock，不依赖真实告警：

- [ ] mock high `open` → 阻断；登记 `hard-fix` → 放行。
- [ ] mock critical `dismissed` → 仍阻断。
- [ ] mock high `dismissed` 登记 `false-positive`（reason 含原 dismiss 原因）→ 放行。
- [ ] mock 台账缺复核条件 / Code Scanning 缺 `location` → 判失败。
- [ ] mock 401 / 非数组 / 级别未知 → 判失败。
- [ ] 预检发生在版本提升之前；阻断步骤在发布动作之前。
- [ ] 项目政策文本与 `standards/gates.md` §2 在「扫描范围 / dismissed / 豁免分类 / fail-closed」四处一致，差异只剩参数。

## 6 回滚

- 回滚 = 把阻断步骤改回 report-only，或临时跳过该 step，并在发布记录写明原因；不建议删除已登记豁免，应标记失效。
- 政策文本按项目 git 历史回退。

## 7 本项目不做什么

- 不统一台账路径、命令名、token 变量名（项目参数）。
- 不提供统一脚本或 action（本轮只给政策与模板）。
- 不修改任何下游文件，不替项目决定 report-only 时长。
