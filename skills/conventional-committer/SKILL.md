---
name: conventional-committer
description: 需要生成 Conventional Commit 提交消息并执行单次提交时使用；多步交付需要拆分提交、安排顺序、预判冲突、整理 changelog 或准备 release 时也使用。适用于 feat、fix、docs、refactor、test、build、ci、chore 等常规提交场景。用户提到 staging、split commits、changelog、release prep、冲突预警时也应触发。

metadata:
  internal: false
---

# Conventional Committer

铁律：不要在不了解本次实际变更范围和质量状态的前提下直接 git add . 然后提交。

> 项目覆盖：若存在 `.ai/overrides/skills/conventional-committer.md`，先加载并按其规则执行；冲突时以覆盖文件为准（优先级：会话 > 项目覆盖 > 核心默认）。

## 工作流

- [ ] Step 1: 确认是否允许提交 ⚠️ REQUIRED
	- [ ] 1.1 检查用户是否明确要求提交。
	- [ ] 1.2 确认质量检查已经完成，或明确告知仍有风险。
- [ ] Step 2: 审视变更范围 ⚠️ REQUIRED
	- [ ] 2.1 查看 git status 和 diff，识别应该提交的文件。
	- [ ] 2.2 排除临时文件、生成物和无关改动。
- [ ] Step 3: 生成提交消息 ⚠️ REQUIRED
	- [ ] 3.1 先判断 type，再决定是否需要 scope（详见「消息格式规范」）。
	- [ ] 3.2 主题与正文聚焦“为什么”和“本次改了什么”，保持简洁可读。
	- [ ] 3.3 主题、正文必须使用简体中文（或用户显式指定的其他语言），type / scope 必须为英文。
	- [ ] 3.4 多类型变更时按 feat > refactor/perf > fix > 其他 选取主类型，其余改动沉到正文。
	- [ ] 3.5 最终消息必须通过「交付前检查」与「消息格式规范」中的硬性约束。
	- [ ] 3.6 判定是否为破坏性提交（`!` 头部或 `BREAKING CHANGE:` footer）；是则先取得用户人工确认，未确认不得进入 Step 4。
	- [ ] 3.7 确认后按「破坏性提交」写入 `Breaking-Review:` 行，置于 `BREAKING CHANGE:` 之前。
- [ ] Step 4: 执行提交 (conditional)
	- [ ] 4.1 只有在用户明确允许时才执行 git add / git commit。
	- [ ] 4.2 提交后复查消息是否符合 commitlint 习惯。
	- [ ] 4.3 若 husky hook 因旧版 Node 或工具链不兼容失败，先修 hook 本身；确无替代时需用户明确同意才可 `--no-verify`，并在交付说明里写明原因。
	- [ ] 4.4 依赖类批量修复统一使用中文格式：`chore(deps): xxx`，让提交消息能跨项目复用。

## 多提交交付

一次交付包含多个逻辑变更时，先拆分、再逐条生成消息：

- 拆分粒度、依赖顺序、锁文件冲突与变更记录见 [references/commit-splitting.md](./references/commit-splitting.md)。
- 单次提交不需要加载它；拆出的每个提交仍按本文件的消息格式规范生成。

## 常见 type

- feat
- fix
- docs
- refactor
- test
- build
- ci
- chore
- perf
- revert

## 消息格式规范

> 以下规范为本项目 commit message 的默认基线（参考 `without_gitmoji.md`）。当用户显式声明其他规则时，以用户声明为准；未声明时强制执行本规范。

### 结构

单一类型修改：

```
<类型>(<作用域>): <主题>
<空行>
<正文>
```

多类型修改：选择最大类型作为主类型（顺序 `feat > refactor/perf > fix > 其他`），其余改动写入正文。

```
<主类型>(<作用域>): <主题>
<空行>
- 类型1的正文
- 类型2的正文
```

特例：

- `README` / `API` / `*.md` / `markdown` 及其改动一律视为 `docs`。
- `unit` / `e2e` / `test` 及其改动一律视为 `test`。
- 无法归类时一律视为 `chore`。

### 主题行（subject）

- 主类型与作用域必须为英文。
- 采用祈使语气，首字母不大写，末尾不加句点。
- 最长 100 个字符。
- 必须使用简体中文（除非用户显式指定其他语言）。
- 无必要时不要在主题中使用括号备注；备注类信息沉到正文。

### 正文（body）

- 以 `-` 加一个空格作为列表符号。
- 每行最长 120 个字符，内容应精简。
- 简单说明「做了什么」以及「为什么这么做」。
- 必须使用简体中文（除非用户显式指定其他语言）。
- 改动简单时可不写正文；不要堆砌过多条目。

### 硬性要求

1. 只能输出提交信息本身，禁止附加解释、问题、注释、格式说明或元数据。
2. 默认使用简体中文；用户明确指定其他语言时跟随用户。
3. type / scope 永远使用英文。
4. 破坏性提交必须同时含 `Breaking-Review:` 与 `BREAKING CHANGE:` footer，且前者在前；缺少人工确认记录不得提交。

### 示例

```
refactor(server): 优化服务器端口配置

- 将端口变量重命名为大写形式（PORT）
```

## 破坏性提交

破坏性提交指消息含 `!` 头部（`<type>(<scope>)!:`）或 `BREAKING CHANGE:` footer 的提交。

- **提交前人工确认**：确认对象是最终 diff 与最终提交消息；AI 自查与 Review Gate 不替代，未确认不得提交。
- **记录格式**：`Breaking-Review: <确认人标识> <YYYY-MM-DD> <approved|approved-with-migration>`。标识为单个 token（无空格，默认 `owner`）；`approved-with-migration` 须在正文或项目文档给出迁移路径。
- **位置**：`Breaking-Review:` 必须位于 `BREAKING CHANGE:` 之前；写在之后会被并入发布说明的 note 文本。
- **只写 `!` 不合规**：部分发布链不识别 `!`，会出现版本已 bump 但发布说明缺破坏面描述；`BREAKING CHANGE:` footer 才是稳定标记。
- **重确认**：确认后提交树或消息文本有变化（含 amend）需重新确认；`Breaking-Review:` 行本身不计入比较。
- **合并与回退**：squash / rebase merge 时由合并者把记录带进落库消息；revert 保留原记录，不回补。

示例：

```text
feat(api): 移除 v1 响应包装

- 响应体改为直接返回业务数据

Breaking-Review: owner 2026-11-21 approved
BREAKING CHANGE: 移除 { code, message, data } 包装，客户端需按新结构解析。
```

## 反模式

- 不看 diff，直接用模糊消息如 update files。
- 把多类变更混成一个没有 scope 的提交。
- 在质量检查未完成时默认提交。
- 在 husky hook 兼容的环境下滥用 `--no-verify`，跳过了本应生效的检查。
- 破坏性提交未经人工确认就落库，或只写 `!` 而不写 `BREAKING CHANGE:` footer。
- 主题或正文出现英文长句，违反默认简体中文约定。
- 在主题里塞括号备注（如 `feat(api): 新增支付接口（兼容老逻辑）`），备注应沉到正文。
- 多类型变更没有收敛主类型，导致 type 难以反映本次主体意图。

## 交付前检查

- [ ] 已确认本次允许提交。
- [ ] 暂存范围只包含相关变更。
- [ ] 提交消息符合 Conventional Commits 语义。
- [ ] type / scope 使用英文，主题与正文使用简体中文（或用户指定语言）。
- [ ] 多类型变更已收敛主类型，其余改动写入正文。
- [ ] 主题 ≤ 100 字符，正文每行 ≤ 120 字符，未在主题中夹带括号备注。
- [ ] 已说明任何未完成的质量风险。









