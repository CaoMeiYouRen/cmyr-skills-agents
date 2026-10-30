# Agents & Skills

## 简介
这是一个草梅友仁的自定义、个性化 Node.js/JS/Vue Agents/Skills 仓库（参考 antfu/skills）。本仓库的目标是为 AI 助手提供边界清晰、可治理、可复用的角色与工作流能力。

## 核心理念
本项目分为两大部分：
1.  **最佳实践（Best Practices）**：通用、可复用、符合行业标准的开发与协作模式。
2.  **个性化（Opinionated）**：围绕草梅友仁个人偏好的技术栈与协作方式沉淀能力。

### Agent-First 方法论
-   **默认只对 Agent 提需求**：理想交互中，用户不需要先刻意区分 script、skill 和 agent，再决定该怎么下指令。
-   **分流责任在 Agent 内部**：agent 负责把一次性任务直接执行，把可复用工作流沉淀为 skill，把具体自动化步骤收敛为 skill 内部的 script 或脚本资产。
-   **高频任务主动抽象**：当某类请求被反复处理时，agent 应结合历史记忆主动总结稳定输入、边界和步骤，将其整理为可维护、可复用的 skill，而不是持续要求用户重复描述。
-   **skills 持续演化**：skill 不是一次性产物。每次任务执行后的复盘、纠偏和补充，都应成为更新既有 skills 的触发条件。

### 项目偏好
-   **核心语言**：TypeScript、Node.js、JavaScript。
-   **视觉识别**：需要视觉识别能力（看图问答 / OCR / 文档解析）时，若检测到 vision-augment skill 或 vision-augment MCP，优先使用。
-   **生态选型**：核心依赖、关键依赖基于 Python 生态时，优先基于 Python 生态开发项目，而不是一定要使用 Node.js 生态。
-   **Python 生态**：优先 Python 3（不支持 Python 2，覆盖最新几个版本）；包管理优先 uv（兼容 pip），测试优先 pytest，代码检查优先 ruff，打包 exe 优先 PyInstaller。
-   **Python 构建与发布**：src layout + hatchling + uv，`uv.lock` 提交入库、CI `uv sync --locked`；发布用 `uv build` + `python-semantic-release` + PyPI Trusted Publisher（OIDC 免 token）。
-   **前端生态**：优先 Vue 3，兼容 React。
-   **后端生态**：纯 API 倾向 Hono；全栈项目倾向 Nuxt。
-   **数据存储**：优先 PostgreSQL，兼容 MySQL、SQLite，可选 MongoDB。
-   **基础设施**：优先 Docker，倾向 Vercel 与 Cloudflare Serverless 生态。
-   **包管理与构建**：优先 pnpm，构建使用 tsdown。
-   **包发布**：优先使用 semantic-release 做自动化版本发布。
-   **Docker 镜像发布**：默认同时推送到 docker.io、ghcr.io 和 registry.cn-hangzhou.aliyuncs.com。
-   **文档站点构建**：优先使用 VitePress。
-   **测试框架**：优先 Vitest。
-   **质量红线**：ESLint、commitlint、stylelint、Markdown lint（`lint-md`，`@lint-md/cli`）必须通过；Python 项目另需 ruff、pytest 通过。

### 治理规则
-   **禁止高重叠新增**：如果现有 skill 或 agent 已足够接近，优先补充原有能力。
-   **先分流再创建**：先判断该需求应由 skill 还是 agent 承载，再决定是否新增。
-   **真实依赖原则**：只能引用仓库中真实存在的文件、目录、技能和角色。
-   **技能引用路径**：项目内已有同名技能时，技能/agent 必须用相对路径链接到项目内定义，禁止裸名引用（裸名会解析到全局同名技能）。
-   **脚本内聚原则**：script 是 skill 的实现资产，不应要求用户在任务入口层面单独理解和选择。
-   **角色收壳原则**：agent 负责身份、边界和接棒关系；具体规则优先下沉到 skill。
-   **问答能力下沉**：只读问答由 [Context Analyzer](./skills/context-analyzer/SKILL.md) 的「问答模式（只读）」承载，不再保留独立 QA agent。
-   **性能下限原则**：新增或准入的智能体，其基础能力不应低于 Gemini 3 Flash / Claude Sonnet 4.5 / GPT-5 这一档的大模型水平。
-   **成本纪律原则**：默认低成本模型（如 Flash 档）主力执行，按需切换更强模型；监控渠道/项目用量，防止单一模型消耗失控（历史教训：单月 96% 额度被单一模型消耗）。
-   **Why 层原则**：技能/agent 的执行信息（做什么）与设计理由（为什么）分层。执行只读正文；高复用、有设计债或易被误删的能力补 Why 层文件（技能 `references/rationale.md`，agent `agents/.rationale/<name>.md`），记录存在理由、关键假设、失效判据与取舍，仅在重构、合并、降级或删除时加载。
-   **存在性判据原则**：每个技能/agent 都要能回答"什么条件下应删除或合并"。存在理由消失（场景不再存在，或能力已被模型、自动化门禁覆盖）即进入弃用，不以"以后可能用得上"长期保留。
-   **项目配置外置原则**：技能只保留通用默认；项目特有的阈值、路径、门禁、输出格式写入项目 `AGENTS.md`（数据多时由它一行链到 `docs/standards/*`），技能以锚点引用，不硬编码、不双写。优先级为「技能默认 < 项目覆盖 < 会话覆盖」。
-   **项目覆盖层原则**：通用能力只在本仓库维护；对单个能力的行为差异写入项目 `.ai/overrides/skills/<name>.md` 或 `.ai/overrides/agents/<name>.md`，只写差异、不抄核心条款。跨能力全局参数写项目 `AGENTS.md`，项目规范写 `docs/standards/*`。约定见 [project-overlay.md](./skills/skill-creator/references/project-overlay.md)。
-   **上游反馈原则**：下游项目发现通用改进时向本仓库提 issue，由上游更新 canonical 定义；不在下游 fork 中长期保留通用改动。
-   **弃用生命周期**：能力存在理由消失（不再需要独立载体、已被模型或自动化覆盖）时进入 `deprecated`——保留文件、移出索引与分发清单，写明替代方案与移除条件，见 `manifest.json` 的 `deprecated` 字段。

## 项目架构
-   **[Skills (技能)](./skills/)**：原子化工作流能力，存放在 `skills/` 目录下，每个技能包含一个 `SKILL.md`。
-   **[Agents (智能体)](./agents/)**：带角色视角和接棒边界的实体，存放在 `agents/` 目录下，以 `.agent.md` 结尾。
-   **Why 层文件**：维护者专用的设计理由，技能放 `skills/<name>/references/rationale.md`，agent 放 `agents/.rationale/<name>.md`；不参与触发，执行时不加载。

## Agents 索引

### 治理与总控
-   **[Skill & Agent Governor](./agents/skill-agent-governor.agent.md)**：skills 与 agents 的准入判断、创建编排、规范审计与安全治理入口。
-   **[Full Stack Master](./agents/full-stack-master.agent.md)**：跨阶段、跨角色的端到端编排者。

### 保留角色
-   **[Product Manager](./agents/product-manager.agent.md)**：负责需求澄清、范围收敛与验收标准定义。
-   **[UI Validator](./agents/ui-validator.agent.md)**：负责浏览器侧视觉与交互验证。
-   **[Code Reviewer](./agents/code-reviewer.agent.md)**：负责结构化代码审查与安全审计。

### 已弃用（deprecated）

以下 agent 的能力已由同名 skill 直接承载，保留文件但移出索引与分发清单（详见 `manifest.json` 的 `deprecated` 字段）：

-   System Architect → `technical-architect` skill
-   Frontend Developer / Backend Developer → 项目特化实现技能（上游通用版已弃用）
-   Test Engineer → `test-engineer` skill
-   Quality Guardian → `quality-guardian` skill
-   Documentation Specialist → `documentation-specialist` skill
-   Release Manager → `conventional-committer` skill

## Skills 索引

### 治理与创建
-   **[Agent Creator](./skills/agent-creator/SKILL.md)**：判断应由 skill 还是 agent 承载，并创建或重构 agent。
-   **[Skill Creator](./skills/skill-creator/SKILL.md)**：技能创建、重构、评测、打包与文本资产回收入口。
-   **[Find Skills](./skills/find-skills/SKILL.md)**：检索本仓库与外部生态中的可用技能。

### 上下文、规划与问答
-   **[Context Analyzer](./skills/context-analyzer/SKILL.md)**：扫描上下文、约束与关键文件。
-   **[Requirement Analyst](./skills/requirement-analyst/SKILL.md)**：把模糊需求转成清晰目标与验收标准。
-   **[Technical Architect](./skills/technical-architect/SKILL.md)**：输出技术方案、文件映射和风险边界。
-   **[Documentation Specialist](./skills/documentation-specialist/SKILL.md)**：文档生成、更新、对齐与审校。
-   **[Full Stack Master](./skills/full-stack-master/SKILL.md)**：多技能协作的全流程编排 skill。
-   **[Super Search](./skills/super-search/SKILL.md)**：通用网页搜索、爬取、交叉验证、对抗审查与研究报告生成。

### 开发与安全
-   **[Security Guardian](./skills/security-guardian/SKILL.md)**：鉴权、权限、输入处理和数据写入的安全审计；以及单条 CVE / 安全公告的影响面判定。

### 验证与评审
-   **[UI Validator](./skills/ui-validator/SKILL.md)**：真实页面验证、截图留证与视觉回归检查。
-   **[Test Engineer](./skills/test-engineer/SKILL.md)**：测试设计、补齐与运行。
-   **[Quality Guardian](./skills/quality-guardian/SKILL.md)**：lint、测试等质量门执行与结果判断。
-   **[Code Reviewer](./skills/code-reviewer/SKILL.md)**：结构化代码审查与技能设计审查。

### 交付与运维
-   **[Conventional Committer](./skills/conventional-committer/SKILL.md)**：生成并执行符合 commitlint 预期的提交消息。
-   **[GitHub CLI](./skills/gh-cli/SKILL.md)**：通过 `gh` 命令行管理仓库、Issue、PR、Workflow、Release、Project、Codespace、API 与认证配置。
-   **[DevOps Specialist](./skills/devops-specialist/SKILL.md)**：部署、CI/CD、容器和运行时配置变更；含反代 / 网关层（nginx / OpenResty / NPM）迁移评估。
-   **[Pnpm Major Migrator](./skills/pnpm-major-migrator/SKILL.md)**：迁移 pnpm 大版本及相关配置，当前覆盖 v10 到 v11 与 v11 到 v12，并保留后续版本迁移扩展位。
-   **[Nuxt WSL2 Build](./skills/nuxt-wsl2-build/SKILL.md)**：检测 Nuxt 构建/开发环境是否就绪（Windows 下强制 WSL2 + ext4），就绪则通过 WSL 执行构建/开发，未就绪则提醒配置或自主初始化；项目使用 Nuxt 但任务未涉及构建/开发时仅输出建议性告警。

### 已弃用（deprecated）

以下技能保留文件供回溯，已移出索引、L0 分发与推荐路径（权威清单见 `manifest.json` 的 `deprecated.skills`）：

-   **Frontend Expert** → 项目特化技能（`nuxt-code-editor` / `vue-component-expert` / `vue-frontend-expert`）与项目 `docs/standards`；Nuxt 构建走 [Nuxt WSL2 Build](./skills/nuxt-wsl2-build/SKILL.md)。
-   **Backend Expert** → 项目特化技能（如 `backend-logic-expert`）与项目 `docs/standards`。
-   **Git Flow Manager** → 提交拆分、顺序与锁文件冲突处理已并入 [Conventional Committer](./skills/conventional-committer/SKILL.md) 的 `references/commit-splitting.md`。
-   **QA Assistant** → 只读问答已并入 [Context Analyzer](./skills/context-analyzer/SKILL.md) 的「问答模式（只读）」。
-   **Security Alert Remediator** → dependfix 项目本体能力（`@dependfix/skills` 的 `dependfix-remediator`）。
-   **Multi-Repo Alert Remediator** → 同上（dependfix 的多仓库模式）。
-   **Opencode Usage** → 直接使用对应 CLI / 插件，不需要技能封装。

## 规范与参考
-   [规范上游 standards](./standards/README.md)：事实源与冲突顺序、角色矩阵与阶段去重、门禁与证据、外部技能准入、经验沉淀。项目按骨架填充正文，同一规则只写一次。
-   [下游项目迁移参考方案](./docs/downstream-migration.md)：把项目内 fork 的能力迁移到「核心 + 覆盖层」，提高跨项目复用率。
-   [项目覆盖层约定](./skills/skill-creator/references/project-overlay.md)：`.ai/overrides/{skills,agents}/<name>.md` 的写法与组合语义。
-   [About custom agents for GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-custom-agents)
-   [About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills?versionId=free-pro-team%40latest&productId=copilot&restPage=concepts%2Cagents%2Ccoding-agent%2Cabout-custom-agents)

---
*Powered by CaoMeiYouRen*
