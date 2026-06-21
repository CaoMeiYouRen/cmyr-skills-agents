# 仓库映射指南

## 目标

将从 GitHub API 拉取的远程仓库列表映射到用户本地文件系统中的实际目录路径，以便逐仓库执行安全修复。

## 映射策略

### 自动发现（优先）

1. 从 GitHub API 返回的仓库数据中提取 `name`（如 `cmyr-skills-agents`）。
2. 使用 `glob` 或文件系统搜索在常用根目录下查找同名目录：
   - Windows: `D:\Projects\`, `D:\Projects\typescript-projects\`, `%USERPROFILE%\Projects\`
   - macOS/Linux: `~/Projects/`, `~/projects/`, `~/code/`, `~/src/`, `~/dev/`
3. 验证找到的目录是否为有效的 Git 仓库（存在 `.git` 目录），且 remote origin URL 与 GitHub 仓库匹配。
4. 如果只有一个匹配项且验证通过，直接使用。

### 用户指定根目录（次选）

当自动发现无法匹配到仓库时：

1. 汇总所有未匹配的仓库列表，显示仓库名和 GitHub URL。
2. 请用户指定一个或多个本地根目录用于搜索。
3. 在用户指定的根目录下递归搜索同名目录（深度限制 3 层）。
4. 验证匹配结果（Git 仓库 + remote 匹配）。

### 跳过（兜底）

当用户指定的根目录也无法匹配到仓库时：

1. 将该仓库标记为 `skipped`。
2. 在汇总报告中列出该仓库名、URL 和跳过原因。
3. 提示用户：如果后续将仓库 clone 到本地，可重新运行本流程并指定映射关系。

## 用户交互协议

- 不会静默猜测路径。
- 自动发现成功时不打扰用户，仅在汇总报告中列出映射关系供确认。
- 需要对多个仓库请求根目录时，一次性汇总提问，而不是逐个仓库打断。

## 映射结果数据结构

```
type RepoMapping = {
  remoteName: string       // 如 "cmyr-skills-agents"
  remoteUrl: string        // 如 "https://github.com/CaoMeiYouRen/cmyr-skills-agents"
  cloneUrl: string         // 如 "https://github.com/CaoMeiYouRen/cmyr-skills-agents.git"
  localPath: string | null // 如 "D:\\Projects\\typescript-projects\\cmyr-skills-agents"
  status: 'mapped' | 'skipped' | 'manual-needed'
  skipReason?: string
}
```

## 特殊处理

- 如果仓库在本地同时存在于多个路径（罕见），优先选择最近修改过的那个。
- 如果仓库 localPath 存在但 `.git` 目录缺失或 remote 不匹配，视为 `skipped`。
- 如果仓库目录存在但工作区不干净（有未提交改动），标记为 `blocked` 而非 `skipped`。
