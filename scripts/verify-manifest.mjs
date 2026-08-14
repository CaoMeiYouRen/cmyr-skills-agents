/**
 * 校验 manifest.json 与仓库实际状态的一致性（防漂移）。
 *
 * 校验范围：
 * 1. skills/ 目录集合与 manifest.skills 一一对应（缺/多均报错）
 * 2. 每个技能 SKILL.md frontmatter 的 metadata.internal 与 manifest 一致
 * 3. agents/ 目录集合与 manifest.agents 一一对应
 * 4. l0Selection 引用的文件、技能、agent 均真实存在
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
