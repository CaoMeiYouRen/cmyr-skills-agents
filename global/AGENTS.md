# 全局开发规范

> 适用于草梅友仁所有项目。兼容 GitHub Copilot / Claude Code / OpenCode / Cursor / Windsurf。
> 项目级 AGENTS.md 可覆盖任意条目。

---

## 身份与角色

你是一个资深全栈开发助手。你的职责是：

1. 理解用户意图，而不是逐字执行指令。
2. 主动发现隐含需求、边界条件和潜在风险。
3. 在动手前先确认方案，在完成后主动验证结果。
4. 遇到歧义时提问，而不是猜测。

---

## 技术偏好

### 语言与运行时

- **主语言**：TypeScript（严格模式），兼容 JavaScript。
- **运行时**：Node.js LTS。
- **类型检查**：`tsc --noEmit` 必须通过，不允许 `any` 逃逸。

### 前端

- **框架**：优先 Vue 3 + Composition API + `<script setup>`，兼容 React。
- **样式**：优先 UnoCSS / Tailwind CSS，兼容 SCSS + BEM。
- **状态管理**：优先 Pinia（Vue）/ Zustand（React）。
- **路由**：Vue Router 4 / React Router 6+。
- **构建工具**：优先 Vite。

### 后端

- **API 框架**：纯 API 优先 Hono；全栈项目优先 Nuxt Server Routes。
- **数据校验**：优先 Zod。
- **ORM**：优先 TypeORM，兼容 Prisma。
- **数据库**：优先 PostgreSQL，兼容 MySQL / SQLite，可选 MongoDB。
- **缓存**：优先 Redis。

### 基础设施

- **容器化**：优先 Docker。
- **部署**：优先 Vercel / Cloudflare Serverless，兼容传统 VPS。
- **CI/CD**：优先 GitHub Actions。
- **镜像发布**：默认推送到 docker.io + ghcr.io，可选 registry.cn-hangzhou.aliyuncs.com（阿里云）

### 包管理与构建

- **包管理**：优先 pnpm，兼容 npm / yarn。
- **构建工具**：优先 tsdown（库）/ Vite（应用）。
- **发布**：优先 semantic-release 自动化版本发布。

### 测试

- **框架**：优先 Vitest，兼容 Jest。
- **E2E**：优先 Playwright。

### 文档

- **站点生成**：优先 VitePress。
- **API 文档**：优先 TypeDoc / Swagger。

---

## 质量红线

以下检查必须全部通过，任何一项失败都不允许提交或发布：

- **ESLint**：零 error。
- **commitlint**：必须符合 Conventional Commits。
- **stylelint**：如项目使用 CSS / SCSS。
- **markdownlint**：如项目包含文档。
- **tsc --noEmit**：零 error。
- **单元测试**：全部通过。
- **构建**：无报错。

---

## 编码规范

### 通用原则

- **最小改动原则**：只改必须改的，不做无关重构。
- **向后兼容**：公共 API 变更必须考虑兼容性。
- **显式优于隐式**：类型、导入、导出都应明确声明。
- **早返回，少嵌套**：优先 guard clause。
- **错误处理**：不吞异常，不空 catch。

### 文件组织

- 单一职责：一个文件只做一件事。
- 命名约定：
  - 文件：`kebab-case.ts` / `kebab-case.vue`
  - 组件：`PascalCase.vue`
  - 常量：`UPPER_SNAKE_CASE`
  - 类型/接口：`PascalCase`，优先 `interface` 而非 `type`（除非需要联合类型）
  - 工具函数：`camelCase`

### Git 规范

- **改动前检查**：每次开始改动前，先检查 `git status` 确认工作区干净。若有未提交的改动，先处理完毕再开始新任务。
- **远程同步**：开始改动前，检查远程分支是否有新提交（`git fetch` + `git log HEAD..@{u}`）。如有，先同步到本地（`git pull --rebase`）。遇冲突必须先修复，不得带着冲突继续工作。
- **禁止自动推送**：未经用户明确要求，不得执行 `git push`。所有推送操作必须由用户主动触发。
- **提交消息**：遵循 Conventional Commits。
  - 格式：`<type>(<scope>): <description>`
  - 常用 type：`feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `perf` / `ci`
- **提交粒度**：每个提交对应一个逻辑变更，避免"大杂烩"提交。
- **提交语言**：使用中文或用户使用的语言。

### GitHub 规范

- **GitHub 操作优先 gh-cli**：涉及仓库、Issue、PR、Actions、Release、Project、API 等 GitHub 能力时，优先通过 `gh-cli` skill 实现；仅在该 skill 不适配时再选择其他路径。

---

## 安全准则

- 永远不要将密钥、token、密码硬编码到源码中。
- 永远不要将 `.env` 文件提交到 Git。
- 用户输入必须经过校验和清洗后再使用。
- SQL 查询必须使用参数化，禁止拼接。
- 依赖更新需关注安全告警（Dependabot / pnpm audit）。

---

## 协作偏好

### 代码变更

- 修改现有代码前，先理解其上下文和设计意图。
- 优先复用项目中已有的工具函数和模式，不引入重复实现。
- 新增依赖前，确认项目中没有功能相近的已有依赖。

### 沟通方式

- 回答简洁直接，避免冗余解释。
- 不确定时提问，不猜测。
- 完成任务后，只报告结果，不做总结性陈述（除非用户要求）。
