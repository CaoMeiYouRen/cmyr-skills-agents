<h1 align="center">cmyr-skills-agents </h1>
<p>
  <img alt="Version" src="https://img.shields.io/github/package-json/v/CaoMeiYouRen/cmyr-skills-agents.svg" />
  <a href="https://github.com/CaoMeiYouRen/cmyr-skills-agents/actions?query=workflow%3ARelease" target="_blank">
    <img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/CaoMeiYouRen/cmyr-skills-agents/release.yml?branch=master">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-blue.svg" />
  <a href="https://github.com/CaoMeiYouRen/cmyr-skills-agents#readme" target="_blank">
    <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
  </a>
  <a href="https://github.com/CaoMeiYouRen/cmyr-skills-agents/graphs/commit-activity" target="_blank">
    <img alt="Maintenance" src="https://img.shields.io/badge/Maintained%3F-yes-green.svg" />
  </a>
  <a href="https://github.com/CaoMeiYouRen/cmyr-skills-agents/blob/master/LICENSE" target="_blank">
    <img alt="License: MIT" src="https://img.shields.io/github/license/CaoMeiYouRen/cmyr-skills-agents?color=yellow" />
  </a>
</p>


> 草梅友仁的个性化 AI 技能库和 AI 智能体库

## ✨ 这是什么

这是一个面向 AI 编码助手的 Skills 与 Agents 仓库，重点覆盖以下两类能力：

- 项目治理：skill-creator、agent-creator、code-reviewer、quality-guardian
- 开发执行：frontend-expert、backend-expert、test-engineer、devops-specialist

如果你想快速查看仓库里已经有哪些能力，先看 [AGENTS.md](./AGENTS.md)。其中包含当前可用的 agents、skills、治理规则与项目偏好。

## 🧠 使用方法论

这个仓库默认采用 Agent-First 的使用方式：用户应该直接把目标交给 Agent，而不是先花精力区分 script、skill 和 agent。理想状态下，任务入口永远是 Agent；一次性需求由 Agent 直接完成，可复用流程由 Agent 沉淀为 skill，具体自动化步骤再继续下沉为 skill 内部的 script。

这也意味着 skills 不是静态清单，而是随任务持续演化的工作资产。当某类请求被反复处理时，Agent 应结合历史记忆主动抽象出稳定的输入、边界和步骤，并将其整理为新的或更新后的 skill。换句话说，执行任务与沉淀能力是同一条工作流的前后两个阶段。

## 🧩 如何使用这些 Skills

本仓库既可以作为技能仓库被安装到支持 Agent Skills 的助手环境中，也可以作为本地工作区直接被 AI 助手读取。

### 方式一：通过 skills CLI 安装本仓库

如果你使用的是支持 Agent Skills 的工具链，可以直接安装本仓库中的 skills。

```sh
# 从 GitHub 安装整个仓库中的可用 skills
npx skills add CaoMeiYouRen/cmyr-skills-agents

# 或者使用完整仓库地址
npx skills add https://github.com/CaoMeiYouRen/cmyr-skills-agents
```

### 方式二：只安装某个 skill

如果你只想安装单个技能，可以指定 `--skill`。

```sh
# 只安装 skill-creator
npx skills add CaoMeiYouRen/cmyr-skills-agents --skill skill-creator

# 只安装 code-reviewer
npx skills add CaoMeiYouRen/cmyr-skills-agents --skill code-reviewer
```

### 方式三：安装到指定 agent

如果你只想把技能装到某个 agent，例如 GitHub Copilot、Claude Code 或 Codex，可以指定 `--agent`。

```sh
# 安装到 GitHub Copilot
npx skills add CaoMeiYouRen/cmyr-skills-agents --agent github-copilot

# 安装到 Claude Code
npx skills add CaoMeiYouRen/cmyr-skills-agents --agent claude-code

# 非交互安装，适合脚本或 CI
npx skills add CaoMeiYouRen/cmyr-skills-agents --skill skill-creator --agent github-copilot -y
```

### 方式四：从本地路径安装

如果你已经把本仓库 clone 到本地，也可以直接从本地路径安装。

```sh
npx skills add ./cmyr-skills-agents

# 只安装一个本地 skill
npx skills add ./cmyr-skills-agents --skill code-reviewer
```

### 常用维护命令

```sh
# 查看已安装 skills
npx skills list

# 搜索技能
npx skills find review

# 检查更新
npx skills check

# 更新已安装技能
npx skills update
```

## 💡 如何在对话中触发这些 Skills

这些 skills 的触发主要依赖 `SKILL.md` 中的 `description`。实际使用时，尽量直接说任务意图，而不是只说一个模糊名词。

示例：

- `帮我做一次 code review，重点看安全和架构风险` → 触发 `code-reviewer`
- `帮我创建一个新的 skill，并按当前仓库规范设计` → 触发 `skill-creator`
- `帮我判断这件事应该做成 skill 还是 agent` → 触发 `agent-creator`
- `帮我找找这个项目里哪里实现了权限检查` → 触发 `qa-assistant`
- `帮我补齐这个模块的 Vitest 测试` → 触发 `test-engineer`
- `帮我检查这个页面的响应式和暗色模式` → 触发 `ui-validator`

建议优先用“目标 + 场景 + 约束”的说法，例如：

- `帮我审查这个 PR，重点看安全和回归风险`
- `帮我设计这个需求的技术方案，并给出文件映射`
- `帮我只做前端实现，不改后端`

这样更容易让助手加载正确的 skill 或 agent。

## 🗂️ 推荐使用顺序

对于新任务，建议按下面的顺序使用：

1. 先看 [AGENTS.md](./AGENTS.md) 确认现有能力边界。
2. 如果只是一个可复用工作流，优先使用已有 skill。
3. 如果需要独立角色、阶段接棒或治理职责，再考虑 agent。
4. 如果仓库里没有合适能力，优先用 `skill-creator` 或 `agent-creator` 扩展，而不是重复新增。

## 🏠 主页

[https://github.com/CaoMeiYouRen/cmyr-skills-agents#readme](https://github.com/CaoMeiYouRen/cmyr-skills-agents#readme)


## 📦 依赖要求


- node >=20

## 🚀 安装

```sh
npm install
```

## 👨‍💻 使用

```sh
npm run start
```

## 🛠️ 开发

```sh
npm run dev
```

## 🔧 编译

```sh
npm run build
```

## 🔍 Lint

```sh
npm run lint
```

## 💾 Commit

```sh
npm run commit
```


## 👤 作者


**CaoMeiYouRen**

* Website: [https://blog.cmyr.ltd/](https://blog.cmyr.ltd/)

* GitHub: [@CaoMeiYouRen](https://github.com/CaoMeiYouRen)


## 🤝 贡献

欢迎 贡献、提问或提出新功能！<br />如有问题请查看 [issues page](https://github.com/CaoMeiYouRen/cmyr-skills-agents/issues). <br/>贡献或提出新功能可以查看[contributing guide](https://github.com/CaoMeiYouRen/cmyr-skills-agents/blob/master/CONTRIBUTING.md).

## 💰 支持

如果觉得这个项目有用的话请给一颗⭐️，非常感谢

<a href="https://afdian.com/@CaoMeiYouRen">
  <img src="https://oss.cmyr.dev/images/202306192324870.png" width="312px" height="78px" alt="在爱发电支持我">
</a>


## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=CaoMeiYouRen/cmyr-skills-agents&type=Date)](https://star-history.com/#CaoMeiYouRen/cmyr-skills-agents&Date)

## 📝 License

Copyright © 2026 [CaoMeiYouRen](https://github.com/CaoMeiYouRen).<br />
This project is [MIT](https://github.com/CaoMeiYouRen/cmyr-skills-agents/blob/master/LICENSE) licensed.

***
_This README was generated with ❤️ by [cmyr-template-cli](https://github.com/CaoMeiYouRen/cmyr-template-cli)_
