# 能力台账（capabilities）

> 回答三个问题：这个能力在哪些项目落地了？权威实现在哪？还没落地的项目缺什么？
> 台账只登记与扫描，不复制实现。

## 1 能力分类

| 类型 | 含义 | 扩散方式 |
| :--- | :--- | :--- |
| `A-rule` | 纯流程规则，无部署物 | 随 L0 技能 / 规范自动到达 |
| `B-template` | 政策 + 项目自建实现（脚本、台账、参数不同） | 规范给政策，模板给结构，项目自行实现 |
| `B-implementation` | 有可复用实现（action / 包） | 引用统一实现，删本地副本 |
| `B-convention` | 已由模板或项目约定收敛，没有统一实现 | 只做漂移检测，不要求改造 |
| `C-project` | 项目特化，不扩散 | 只登记差异与 optOut 理由 |

`channel` 取值：`l0-reference`、`standard-template`、`action-or-package`、`project-workflow`。

## 2 字段

| 字段 | 说明 |
| :--- | :--- |
| `id` | 稳定标识，用于提案、扫描、引用 |
| `canonical` | 权威实现或政策所在的仓库路径 |
| `template` | `B-template` 的结构模板路径 |
| `mature` | 已验证过的项目（通常 1 个，作为样板） |
| `applies_to` | 适用栈，用于过滤（如 `node`、`pnpm`） |
| `status` | `experiment` → `candidate` → `upstream` → `adopted` → `deprecated` |
| `markers` | 采纳标记数组：`{ kind: scripts\|files\|text, required, values, param? }`；`present` 要求所有 `required` 组命中 |
| `projectParams` | 项目变量（不自动提取，由项目 `AGENTS.md` 定义）；扫描提取的参数由 marker 上的 `param` 声明（如 `command` / `ledgerPath`） |
| `optOut` | 明确不采纳的项目与理由，条目形如 `{ project, items?, reason, decidedAt }`；`items` 用于按检查项 / 子能力跳过 |
| `repo` / `path` | 权威实现在外部仓库时使用（如 `dependfix/dependfix` + `action.yml`） |
| `proposal` | 政策尚未定稿时，指向对应提案 |

## 3 扫描

```bash
# 从本仓库根目录执行，路径指向各项目
node scripts/check-capabilities.mjs \
  --projects ../caomei-auth,../caomei-ui,../dependfix,../momei
```

输出为「能力 × 项目」矩阵（`✅ 证据数` / `— (缺 required 类型)`），并列出检测到的参数。`--json` 供 CI 或脚本消费；退出码 0 成功、2 参数或目录错误、1 运行时错误。

扫描只回答「有没有 / 在哪」，不做代码比对；判断「实现是否漂移」由提案、评审或项目自建检查完成。扫描时机见 [standards/proposals.md](../standards/proposals.md) §4。

扫描范围限于 `AGENTS.md`、`README.md`、`docs/standards/*.md`（规则会被加载的位置）+ `package.json` scripts + 标记文件；不读 `.github/agents`、`.github/skills`，那里的提及不等于项目已采纳规则。

## 4 维护规则

- 新增能力：先在成熟项目验证 ≥ 1 个发布周期，再登记为 `candidate`；`markers` 必须能被上面的扫描器命中。
- 转 `upstream`：政策进 `standards/`，实现进包 / action / 技能，项目侧只留参数。
- `optOut`：不采纳的项目必须写理由（不适用 / 成本高于收益 / 已有等价实现），否则「没做」和「决定不做」无法区分；字段在 `registry.json` 的能力条目上。条目格式固定为 `{ project, items?, reason, decidedAt }`：只跳过部分检查项时写 `items`（如 `#5 弃用引用扫描`），整项不采纳时省略；`decidedAt` 记决策日期，便于复查。
- 退役：`deprecated` + 移除标记 + 在提案或规范里登记替代。

## 5 与 standards / experience 的关系

- `standards/` 写**规则**（应该怎么做），项目经验档案写**案例**（踩过什么；上游统一的 `experience/` 尚未建立），本台账写**落地状态**（谁有、在哪、缺什么）。
- 三者互相引用，不互相复制正文。
