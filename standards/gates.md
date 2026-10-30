# 门禁与证据（gates）

> 验证矩阵与阈值以 `skills/code-reviewer` 为唯一权威，命令选择见 `skills/quality-guardian`，项目命令与路径见项目 `AGENTS.md`。本文件只补它们不管的部分：最小充分原则、发布前安全门禁、产物证据、绕过判定。

## 1 最小充分原则

- 基线是 lint + typecheck；按改动类型增减测试、构建、冒烟，不要求每次跑全套。
- 需要生成物的项目（Nuxt / VitePress）先 prepare 再 typecheck，否则会报与改动无关的解析错误。
- 具体矩阵、diff 规模阈值与证据分级不在本文件重述：见 `skills/code-reviewer`。

## 2 发布前安全告警门禁

- `critical`：必须修复，**不允许豁免**；豁免清单对 critical 不生效。
- `high`：默认阻塞。仅在上游无可用修复版本或修复成本过高时豁免，且必须登记**原因、追踪项（Issue / 待办）、失效条件**；到期自动失效并重新阻塞，修复后删除豁免。
- `medium` / `low`：不阻塞，在门禁报告里记录，随后续升级消解。
- Dependabot 与 Code Scanning 用同一口径，不因来源不同而放宽。
- **扫描未完成视为未通过**：token 失效、权限不足、网络异常时，不得把「未扫描」当成「无告警」。

项目需定义：门禁命令、豁免登记文件、执行时机（发布前 / 每周回归）。

<!-- TODO: 项目填充：命令、豁免文件路径、CI job 名称。 -->

## 3 产物证据

- 只报 exit code 不足以定位：失败时附脱敏后的 stdout/stderr 摘要（长日志取失败命令前后各 ~50 行）与可复现命令。
- 「构建绿」不等于「可运行」：涉及发布产物时，必须对实际产物跑一次最小真实调用。
- 证据要能回答三件事：跑了什么、结果是什么、哪一行输出能证明它。

## 4 什么不算绕过

- 不允许用关闭校验的方式让门禁**通过**：跳过 hook、注释测试、长期关掉 frozen-lockfile。
- 例外是**重建动作**：锁文件冲突后重新生成（`pnpm install --no-frozen-lockfile`，见 `skills/conventional-committer/references/commit-splitting.md`），以及环境不兼容时先修 hook 再提交——两者的目的都是让校验重新可信，而不是跳过它。
- 同一问题的修复失败处理（何时转搜索优先、何时声明方案失败）以 `skills/full-stack-master` 的「失败自检」为准，本文件不复述阈值与动作。
