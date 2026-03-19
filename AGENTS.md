# Agents & Skills

## 简介
这是一个草梅友仁的自定义、个性化 Node.js/JS/Vue Agents/Skills 仓库（参考 antfu/skills）。本仓库旨在为 AI 助手提供高效、精准且具备个性化偏好的工具集。

## 核心理念
本项目分为两大部分：
1.  **最佳实践（Best Practices）**：包含通用的、符合行业标准的开发规范和解决思路。
2.  **个性化（Opinionated）**：包含草梅友仁个人的开发习惯和特定偏好：
    *   **核心语言**：偏好 TypeScript (Node.js/JavaScript)。
    *   **前端生态**：首选 **Vue 3**，兼容 React。
    *   **后端生态**：纯 API 项目首选 **Hono**；全栈项目首选 **Nuxt**。
    *   **数据存储**：优先使用 PostgreSQL, 兼容 MySQL、 SQLite, 可选 MongoDB。
    *   **基础设施**：优先使用 **Docker** 部署，倾向 **Vercel** 和 **Cloudflare** 的 Serverless 生态。
    *   **包管理与构建**：强制使用 **pnpm**；使用 **tsdown** 进行构建。
    *   **测试框架**：首选 **vitest**。
    *   **质量红线**：
        *   代码规范：必须遵循 `eslint-config-cmyr`。
        *   提交规范：必须通过 `commitlint`。
        *   样式规范：SCSS 必须通过 `stylelint`。
        *   文档规范：Markdown 必须通过 `@lint-md/cli`。
    *   **文档自动发现 (Auto-Discovery)**：
        *   **主动扫描**：所有 Agent/Skill 在启动或执行任务前，应主动扫描项目中（如 `docs/`、根目录或隐蔽目录下）的相关文档。
        *   **关联识别**：识别与自身职能相关的规范（如 `BACKEND_API.md`、`FRONTEND_UI.md`、`TESTING_GUIDE.md` 等）。
        *   **合规遵循**：必须优先遵守项目中搜寻到的特定规定。
        *   **冲突处理**：若未找到相关文档，应向用户询问或默认执行行业通用最佳实践（Best Practices）。

## 项目架构
本项目主要由以下两部分组成：
*   **[Skills (技能)](./skills/)**：原子化的功能模块，可被 Agent 调用执行特定任务。存储在 `skills/` 目录下，每个技能包含一个 `SKILL.md`。
*   **[Agents (智能体)](./agents/)**：具备特定角色定义和逻辑的实体。存储在 `agents/` 目录下，以 `.agent.md` 结尾。

### 目录结构说明

#### [Agents](./agents/)
包含各种预定义的智能体角色，例如：
*   **[Full Stack Master](./agents/full-stack-master.agent.md)**：全栈大师，负责全局开发工作流编排。
*   **[Product Manager](./agents/product-manager.agent.md)**：产品经理，负责需求分析与意图抽离。
*   **[System Architect](./agents/system-architect.agent.md)**：系统架构师，负责方案设计与架构对齐。
*   **[Frontend/Backend Developer](./agents/frontend-developer.agent.md)**：前/后端开发者，负责具体业务逻辑实现。
*   **[Quality Guardian](./agents/quality-guardian.agent.md)**：质量守护者，负责自动化测试与静态检查。
*   **[Skill & Agent Governor](./agents/skill-agent-governor.agent.md)**：技能与智能体治理官，负责 skills 与 agents 的准入判断、创建编排、规范审计与安全治理。

#### [Skills](./skills/)
包含可被重用的原子技能，例如：
*   **[Conventional Committer](./skills/conventional-committer/SKILL.md)**：规范化提交技能，确保 Git 提交符合规范。
*   **[Context Analyzer](./skills/context-analyzer/SKILL.md)**：上下文分析技能，帮助 AI 快速理解项目现状。
*   **[Security Guardian](./skills/security-guardian/SKILL.md)**：安全守护技能，进行安全审计与风险检查。
*   **[Test Engineer](./skills/test-engineer/SKILL.md)**：测试工程师技能，负责编写与执行测试用例。
*   **[Skill Creator](./skills/skill-creator/SKILL.md)**：技能创建与重构技能，负责 skill 的设计、文本资产回收、评测与打包。
*   **[Agent Creator](./skills/agent-creator/SKILL.md)**：Agent 创建技能，负责判断应由 skill 还是 agent 承载、创建或更新 agent，并审计准入标准与安全边界。

**特点**：
*   **组合性**：Skills 和 Agents 既可以独立运作，也可以组合起来使用。
*   **通用性**：定义的技能或智能体是通用的，不受调用者（Caller）的限制。

## 规范与标准
本项目遵循主流的 AI 智能体规范，参考文档如下：
*   [About custom agents for GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-custom-agents)
*   [About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills?versionId=free-pro-team%40latest&productId=copilot&restPage=concepts%2Cagents%2Ccoding-agent%2Cabout-custom-agents)

---
*Powered by CaoMeiYouRen*
