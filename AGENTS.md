# Agents & Skills

## 简介
这是一个草梅友仁的自定义、个性化 Node.js/JS/Vue Agents/Skills 仓库（参考 antfu/skills）。本仓库的目标是为 AI 助手提供边界清晰、可治理、可复用的角色与工作流能力。

## 核心理念
本项目分为两大部分：
1.  **最佳实践（Best Practices）**：通用、可复用、符合行业标准的开发与协作模式。
2.  **个性化（Opinionated）**：围绕草梅友仁个人偏好的技术栈与协作方式沉淀能力。

### 项目偏好
-   **核心语言**：TypeScript、Node.js、JavaScript。
-   **前端生态**：优先 Vue 3，兼容 React。
-   **后端生态**：纯 API 倾向 Hono；全栈项目倾向 Nuxt。
-   **数据存储**：优先 PostgreSQL，兼容 MySQL、SQLite，可选 MongoDB。
-   **基础设施**：优先 Docker，倾向 Vercel 与 Cloudflare Serverless 生态。
-   **包管理与构建**：优先 pnpm，构建使用 tsdown。
-   **包发布**：优先使用 semantic-release 做自动化版本发布。
-   **Docker 镜像发布**：默认同时推送到 docker.io、ghcr.io 和 registry.cn-hangzhou.aliyuncs.com。
-   **文档站点构建**：优先使用 VitePress。
-   **测试框架**：优先 Vitest。
-   **质量红线**：ESLint、commitlint、stylelint、Markdown lint 必须通过。

### 治理规则
-   **禁止高重叠新增**：如果现有 skill 或 agent 已足够接近，优先补充原有能力。
-   **先分流再创建**：先判断该需求应由 skill 还是 agent 承载，再决定是否新增。
-   **真实依赖原则**：只能引用仓库中真实存在的文件、目录、技能和角色。
-   **角色收壳原则**：agent 负责身份、边界和接棒关系；具体规则优先下沉到 skill。
-   **问答能力下沉**：只读问答由 [QA Assistant](./skills/qa-assistant/SKILL.md) skill 承载，不再保留独立 QA agent。
-   **性能下限原则**：新增或准入的智能体，其基础能力不应低于 Gemini 3 Flash / Claude Sonnet 4.5 / GPT-5 这一档的大模型水平。

## 项目架构
-   **[Skills (技能)](./skills/)**：原子化工作流能力，存放在 `skills/` 目录下，每个技能包含一个 `SKILL.md`。
-   **[Agents (智能体)](./agents/)**：带角色视角和接棒边界的实体，存放在 `agents/` 目录下，以 `.agent.md` 结尾。

## Agents 索引

### 治理与总控
-   **[Skill & Agent Governor](./agents/skill-agent-governor.agent.md)**：skills 与 agents 的准入判断、创建编排、规范审计与安全治理入口。
-   **[Full Stack Master](./agents/full-stack-master.agent.md)**：跨阶段、跨角色的端到端编排者。

### 规划与设计
-   **[Product Manager](./agents/product-manager.agent.md)**：负责需求澄清、范围收敛与验收标准定义。
-   **[System Architect](./agents/system-architect.agent.md)**：负责技术方案、文件映射与风险预判。

### 开发执行
-   **[Frontend Developer](./agents/frontend-developer.agent.md)**：负责前端实现，适用于只有前端或前端为主的开发任务。
-   **[Backend Developer](./agents/backend-developer.agent.md)**：负责后端实现，适用于只有后端或后端为主的开发任务。

### 验证与审查
-   **[UI Validator](./agents/ui-validator.agent.md)**：负责浏览器侧视觉与交互验证。
-   **[Test Engineer](./agents/test-engineer.agent.md)**：负责测试设计、补齐与失败分析。
-   **[Quality Guardian](./agents/quality-guardian.agent.md)**：负责质量门执行与放行判断。
-   **[Code Reviewer](./agents/code-reviewer.agent.md)**：负责结构化代码审查与安全审计。

### 文档与交付
-   **[Documentation Specialist](./agents/documentation-specialist.agent.md)**：负责文档同步、对齐和审校。
-   **[Release Manager](./agents/release-manager.agent.md)**：负责提交边界、提交消息与发布准备。

## Skills 索引

### 治理与创建
-   **[Agent Creator](./skills/agent-creator/SKILL.md)**：判断应由 skill 还是 agent 承载，并创建或重构 agent。
-   **[Skill Creator](./skills/skill-creator/SKILL.md)**：技能创建、重构、评测、打包与文本资产回收入口。
-   **[Find Skills](./skills/find-skills/SKILL.md)**：检索本仓库与外部生态中的可用技能。

### 上下文、规划与问答
-   **[Context Analyzer](./skills/context-analyzer/SKILL.md)**：扫描上下文、约束与关键文件。
-   **[Requirement Analyst](./skills/requirement-analyst/SKILL.md)**：把模糊需求转成清晰目标与验收标准。
-   **[Technical Architect](./skills/technical-architect/SKILL.md)**：输出技术方案、文件映射和风险边界。
-   **[QA Assistant](./skills/qa-assistant/SKILL.md)**：只读问答、查证事实与解释实现。
-   **[Documentation Specialist](./skills/documentation-specialist/SKILL.md)**：文档生成、更新、对齐与审校。
-   **[Full Stack Master](./skills/full-stack-master/SKILL.md)**：多技能协作的全流程编排 skill。

### 开发与安全
-   **[Frontend Expert](./skills/frontend-expert/SKILL.md)**：前端页面、组件、样式、交互与 i18n 实现。
-   **[Backend Expert](./skills/backend-expert/SKILL.md)**：后端 API、服务层、数据库与权限实现。
-   **[Security Guardian](./skills/security-guardian/SKILL.md)**：鉴权、权限、输入处理和数据写入的安全审计。

### 验证与评审
-   **[UI Validator](./skills/ui-validator/SKILL.md)**：真实页面验证、截图留证与视觉回归检查。
-   **[Test Engineer](./skills/test-engineer/SKILL.md)**：测试设计、补齐与运行。
-   **[Quality Guardian](./skills/quality-guardian/SKILL.md)**：lint、测试等质量门执行与结果判断。
-   **[Code Reviewer](./skills/code-reviewer/SKILL.md)**：结构化代码审查与技能设计审查。

### 交付与运维
-   **[Git Flow Manager](./skills/git-flow-manager/SKILL.md)**：拆分提交边界、维护提交顺序与冲突预判。
-   **[Conventional Committer](./skills/conventional-committer/SKILL.md)**：生成并执行符合 commitlint 预期的提交消息。
-   **[DevOps Specialist](./skills/devops-specialist/SKILL.md)**：部署、CI/CD、容器和运行时配置变更。

## 规范与参考
-   [About custom agents for GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-custom-agents)
-   [About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills?versionId=free-pro-team%40latest&productId=copilot&restPage=concepts%2Cagents%2Ccoding-agent%2Cabout-custom-agents)

---
*Powered by CaoMeiYouRen*
