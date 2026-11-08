# 门禁与证据（gates）

> 验证矩阵与阈值以 `skills/code-reviewer` 为唯一权威，命令选择见 `skills/quality-guardian`，项目命令与路径见项目 `AGENTS.md`。本文件只补它们不管的部分：最小充分原则、发布前安全门禁、产物证据、绕过判定。

## 1 最小充分原则

- 基线是 lint + typecheck；按改动类型增减测试、构建、冒烟，不要求每次跑全套。
- 需要生成物的项目（Nuxt / VitePress）先 prepare 再 typecheck，否则会报与改动无关的解析错误。
- 具体矩阵、diff 规模阈值与证据分级不在本文件重述：见 `skills/code-reviewer`。

## 2 发布前安全告警门禁

> 各项目的实现不同（token、台账路径、脚本名），本节是**共同政策基线**；项目侧段落用 `standards/templates/release-security-gate.md` 的结构，参数写进项目 `AGENTS.md`。

### 2.1 扫描范围

- Dependabot alerts 与 Code Scanning alerts，`open` 与 `dismissed` **都要看**。
- `auto_dismissed`（已自动关闭、不再适用）不参与阻断。

### 2.2 严重级取值

- 所有来源的 `medium` 一律归一为 `moderate`；Dependabot 取 `security_advisory.severity`。
- Code Scanning 取 `rule.security_severity_level`；为空时用 `rule.severity` 映射：`error → high`、`warning → moderate`、`note / none → low`。
- 两者都取不到 → **fail-closed**，不得默认放行。

### 2.3 分级

| 级别 | 规则 |
| :--- | :--- |
| `critical` | 一律不得存在；**被 dismiss 也算存在**（dismiss 不能替代修复）。无修复版本时必须移除 / 替换依赖或下线受影响能力，不允许任何豁免 |
| `high` | 原则上阻断。`open` 仅 `no-fix`（上游无可用修复版本）/ `hard-fix`（本发布窗口无法完成）可豁免；`dismissed` 仅可按 `false-positive` 登记。Code Scanning 必须按实例 `location` 登记，同一 rule 的其他实例不连带放行 |
| `moderate` / `low` | 不阻断，记录后随版本升级消解 |

### 2.4 豁免台账

- 必须机器可读，字段：`source`、`id`、`severity`（仅 high）、`category`（`no-fix` / `hard-fix` / `false-positive`）、`target`、`path`（依赖路径）、`reason`、`review`（复核条件）、`tracking`；Code Scanning 另需 `location`（实例文件路径），**`path` 与 `location` 不可互替**，缺失即台账非法。
- `false-positive` 的 `reason` 必须写明原 dismiss 原因。
- 必须有**复核条件**（`expiresAt` 或等价字段）：日期形式到期即失效并重新阻塞，无需人工删除；条件形式（上游发版 / 截止版本）由**发布前人工复核**；门禁报告至少给出豁免计数，条目明细以台账为准（是否逐条列出或另出 warning 由项目决定）。缺复核条件即台账非法。
- 人工批准：**AI 不得自行豁免**。批准人（`approvedBy` 或等价）为建议字段；项目已有更严格的批准规则时保留，不因对齐模板而删除。
- 多台账：允许项目按来源分文件（如 alerts 豁免 / audit allowlist），但必须写清分工与字段映射；**`pnpm audit` 绿灯不等于可发布，`audit.ignore` 不构成发布豁免**。
- `critical` 与 `moderate` / `low` 不得登记进豁免台账。

### 2.5 fail-closed

- token 缺失、401 / 403 / 404、请求超时、429 / 5xx 重试耗尽、响应非数组、严重级别无法判定 → 一律判失败，**不得视为「无告警」**；404 通常表示该仓库未启用对应告警源。
- Dependabot 读取需要具备 alerts 读权限的 PAT（`GITHUB_TOKEN` 恒 403）；Code Scanning 在 Actions 中可用 `GITHUB_TOKEN` + `security-events: read`，本地回退 PAT。
- token 按来源分离，不共用一个变量。
- 台账存在但没有匹配任何告警（过期未清理）→ 输出 warning 并继续，不阻断；warning 必须出现在门禁报告里。

### 2.6 执行位置

- 在发布动作之前（release、镜像推送、手动 dispatch）执行。
- 在版本提升之前做一次只读预检，避免定时发布先提版本再被拦下。
- 周回归复用全量质量门 + 同一门禁，覆盖「主分支长期带病」。

<!-- 项目填充：台账路径、命令、secret 名、执行 job 名、周回归频率。 -->

## 3 产物证据

- 只报 exit code 不足以定位：失败时附脱敏后的 stdout/stderr 摘要（长日志取失败命令前后各 ~50 行）与可复现命令。
- 「构建绿」不等于「可运行」：涉及发布产物时，必须对实际产物跑一次最小真实调用。
- 证据要能回答三件事：跑了什么、结果是什么、哪一行输出能证明它。

## 4 什么不算绕过

- 不允许用关闭校验的方式让门禁**通过**：跳过 hook、注释测试、长期关掉 frozen-lockfile。
- 例外是**重建动作**：锁文件冲突后重新生成（`pnpm install --no-frozen-lockfile`，见 `skills/conventional-committer/references/commit-splitting.md`），以及环境不兼容时先修 hook 再提交——两者的目的都是让校验重新可信，而不是跳过它。
- 同一问题的修复失败处理（何时转搜索优先、何时声明方案失败）以 `skills/full-stack-master` 的「失败自检」为准，本文件不复述阈值与动作。
