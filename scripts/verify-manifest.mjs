/**
 * 校验 manifest.json 与仓库实际状态的一致性（防漂移）。
 *
 * 校验范围：
 * 1. skills/ 目录集合与 manifest.skills 一一对应（缺/多均报错）
 * 2. 每个技能 SKILL.md frontmatter 的 metadata.internal 与 manifest 一致
 * 3. agents/ 目录集合与 manifest.agents 一一对应
 * 4. l0Selection 引用的文件、技能、agent 均真实存在
 * 5. manifest.deprecated 中的技能/agent 必须真实存在，且不得进入 l0Selection
 * 6. l0Selection 中的技能/agent 必须声明项目覆盖锚点（.ai/overrides/...），保证覆盖层可被加载
 * 7. skills/<name>/references/ 下的 .md 必须被执行入口索引（本技能 SKILL.md 或 agents/<name>.agent.md 写 `references/<相对路径>`，
 *    或根索引文件以 `skills/<name>/references/...` 全路径引用），否则该文件对执行者不可达
 *    （历史问题：孤儿 reference 连续多轮无人发现）。仅校验平铺与嵌套的 .md，不覆盖 json/ps1 等资产。
 *
 * 用法：node scripts/verify-manifest.mjs
 * 导出 verifyManifest 纯函数便于单测。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const MANIFEST_FILE = 'manifest.json'
const SKILLS_DIR = 'skills'
const AGENTS_DIR = 'agents'
const INTERNAL_PATTERN = /^metadata:\n  internal: (true|false)$/m

function listDirNames(dirPath) {
    return readdirSync(dirPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
}

function listAgentNames(agentsDir) {
    return readdirSync(agentsDir)
        .filter((file) => file.endsWith('.agent.md'))
        .map((file) => file.replace(/\.agent\.md$/, ''))
        .sort()
}

function listMarkdownFiles(dirPath) {
    if (!existsSync(dirPath)) {
        return []
    }
    const files = []
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
            files.push(...listMarkdownFiles(fullPath))
        } else if (entry.name.endsWith('.md')) {
            files.push(fullPath)
        }
    }
    return files
}

/**
 * 技能自身的执行入口：本技能 SKILL.md + 同名 agent（agents/<name>.agent.md）。
 * 只认这两个位置，避免通用文案（如 AGENTS.md 里的 `references/rationale.md`）
 * 或别的技能把这一个 reference 顶包成"已索引"。
 */
function collectSkillEntryTexts(repoRoot, skill) {
    const files = [
        path.join(repoRoot, SKILLS_DIR, skill, 'SKILL.md'),
        path.join(repoRoot, AGENTS_DIR, `${skill}.agent.md`),
    ]
    return files.filter((file) => existsSync(file)).map((file) => readFileSync(file, 'utf8'))
}

/** 仓库级索引文件：只接受带技能名的全路径引用（skills/<name>/references/...）。 */
function collectRepoEntryTexts(repoRoot) {
    const files = [path.join(repoRoot, 'AGENTS.md'), path.join(repoRoot, 'README.md')]
    files.push(...listMarkdownFiles(path.join(repoRoot, 'global')))
    return files.filter((file) => existsSync(file)).map((file) => readFileSync(file, 'utf8'))
}

const REGEXP_SPECIAL_PATTERN = /[.*+?^${}()|[\]\\]/g

/**
 * 生成锚点匹配式：不允许 `../` 跨技能引用，也不允许 `x.md` 命中 `x.mdx`。
 * 允许 `./references/x.md` 与行内代码包裹等常见写法。
 */
function buildAnchorPattern(anchor) {
    const escaped = anchor.replace(REGEXP_SPECIAL_PATTERN, '\\$&')
    return new RegExp(`(?<!\\.\\./)(?<![\\w-])${escaped}(?![\\w-])`)
}

function mentionsAnchor(texts, anchor) {
    const pattern = buildAnchorPattern(anchor)
    return texts.some((text) => pattern.test(text))
}

function diffLists(expected, actual) {
    const missing = expected.filter((name) => !actual.includes(name))
    const extra = actual.filter((name) => !expected.includes(name))
    return { missing, extra }
}

export function verifyManifest(repoRoot) {
    const errors = []
    const manifestPath = path.join(repoRoot, MANIFEST_FILE)

    let manifest
    try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    } catch (error) {
        return { ok: false, errors: [`无法读取 ${MANIFEST_FILE}: ${error.message}`] }
    }

    const skillsDir = path.join(repoRoot, SKILLS_DIR)
    const agentsDir = path.join(repoRoot, AGENTS_DIR)

    const actualSkills = listDirNames(skillsDir)
    const manifestSkills = (manifest.skills ?? []).map((skill) => skill.name).sort()
    const { missing: missingSkills, extra: extraSkills } = diffLists(manifestSkills, actualSkills)
    if (missingSkills.length > 0) {
        errors.push(`manifest 缺少技能: ${missingSkills.join(', ')}`)
    }
    if (extraSkills.length > 0) {
        errors.push(`manifest 多出技能: ${extraSkills.join(', ')}`)
    }

    for (const skill of manifest.skills ?? []) {
        const skillMdPath = path.join(skillsDir, skill.name, 'SKILL.md')
        if (!existsSync(skillMdPath)) {
            errors.push(`${skill.name}: SKILL.md 不存在`)
            continue
        }
        const content = readFileSync(skillMdPath, 'utf8')
        const match = content.match(INTERNAL_PATTERN)
        if (!match) {
            errors.push(`${skill.name}: SKILL.md 缺少 metadata.internal 标记`)
            continue
        }
        if (match[1] !== String(skill.internal)) {
            errors.push(`${skill.name}: manifest internal=${skill.internal} 与 SKILL.md internal=${match[1]} 不一致`)
        }
    }

    const actualAgents = listAgentNames(agentsDir)
    const manifestAgents = [...(manifest.agents ?? [])].sort()
    const { missing: missingAgents, extra: extraAgents } = diffLists(manifestAgents, actualAgents)
    if (missingAgents.length > 0) {
        errors.push(`manifest 缺少 agents: ${missingAgents.join(', ')}`)
    }
    if (extraAgents.length > 0) {
        errors.push(`manifest 多出 agents: ${extraAgents.join(', ')}`)
    }

    for (const file of manifest.l0Selection?.files ?? []) {
        if (!existsSync(path.join(repoRoot, file))) {
            errors.push(`l0Selection 文件不存在: ${file}`)
        }
    }
    for (const skill of manifest.l0Selection?.skills ?? []) {
        if (!manifestSkills.includes(skill)) {
            errors.push(`l0Selection 技能不存在于 manifest: ${skill}`)
        }
    }
    for (const agent of manifest.l0Selection?.agents ?? []) {
        if (!manifestAgents.includes(agent)) {
            errors.push(`l0Selection agent 不存在于 manifest: ${agent}`)
        }
    }

    // 弃用清单校验：必须真实存在，且不得进入 l0Selection
    const deprecatedSkills = manifest.deprecated?.skills ?? []
    const deprecatedAgents = manifest.deprecated?.agents ?? []
    const l0Skills = manifest.l0Selection?.skills ?? []
    const l0Agents = manifest.l0Selection?.agents ?? []

    for (const name of deprecatedSkills) {
        if (!actualSkills.includes(name)) {
            errors.push(`deprecated skill 不存在: ${name}（已删除的定义应移出 deprecated 清单）`)
        }
        if (l0Skills.includes(name)) {
            errors.push(`deprecated skill 不得进入 l0Selection: ${name}`)
        }
    }
    for (const name of deprecatedAgents) {
        if (!actualAgents.includes(name)) {
            errors.push(`deprecated agent 不存在: ${name}（已删除的定义应移出 deprecated 清单）`)
        }
        if (l0Agents.includes(name)) {
            errors.push(`deprecated agent 不得进入 l0Selection: ${name}`)
        }
    }

    // L0 能力必须声明项目覆盖锚点，否则覆盖层无法被加载
    for (const skill of l0Skills) {
        const skillMdPath = path.join(skillsDir, skill, 'SKILL.md')
        if (!existsSync(skillMdPath)) {
            continue
        }
        if (!readFileSync(skillMdPath, 'utf8').includes(`.ai/overrides/skills/${skill}.md`)) {
            errors.push(`L0 技能缺少项目覆盖锚点: ${skill}（应声明 .ai/overrides/skills/${skill}.md）`)
        }
    }
    for (const agent of l0Agents) {
        const agentPath = path.join(agentsDir, `${agent}.agent.md`)
        if (!existsSync(agentPath)) {
            continue
        }
        if (!readFileSync(agentPath, 'utf8').includes(`.ai/overrides/agents/${agent}.md`)) {
            errors.push(`L0 agent 缺少项目覆盖锚点: ${agent}（应声明 .ai/overrides/agents/${agent}.md）`)
        }
    }

    // references 可达性校验：未被执行入口索引的 reference 等于死文件
    const repoEntryTexts = collectRepoEntryTexts(repoRoot)
    for (const skill of actualSkills) {
        const referenceDir = path.join(skillsDir, skill, 'references')
        if (!existsSync(referenceDir)) {
            continue
        }
        const skillEntryTexts = collectSkillEntryTexts(repoRoot, skill)
        for (const filePath of listMarkdownFiles(referenceDir)) {
            const relativePath = path.relative(referenceDir, filePath).split(path.sep).join('/')
            const anchor = `references/${relativePath}`
            const qualifiedAnchor = `skills/${skill}/${anchor}`
            const indexed = mentionsAnchor(skillEntryTexts, anchor)
                || mentionsAnchor(repoEntryTexts, qualifiedAnchor)
            if (!indexed) {
                errors.push(`${skill}: references/${relativePath} 未被索引引用（在本技能 SKILL.md 或 agents/${skill}.agent.md 增加 \`${anchor}\` 指引，或删除该文件）`)
            }
        }
    }

    return { ok: errors.length === 0, errors }
}

function isExecutedDirectly(metaUrl) {
    if (!process.argv[1]) {
        return false
    }
    return path.resolve(process.argv[1]) === fileURLToPath(metaUrl)
}

if (isExecutedDirectly(import.meta.url)) {
    const { ok, errors } = verifyManifest(process.cwd())
    for (const error of errors) {
        console.error(`✗ ${error}`)
    }
    if (ok) {
        console.info('manifest 校验通过')
    }
    process.exit(ok ? 0 : 1)
}
