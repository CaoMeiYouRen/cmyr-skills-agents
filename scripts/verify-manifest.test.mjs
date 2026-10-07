import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { verifyManifest } from './verify-manifest.mjs'

function createFixtureRepo({ manifest, skills = [], agents = [], files = [] }) {
    const root = mkdtempSync(path.join(tmpdir(), 'verify-manifest-'))
    writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest))
    for (const name of skills) {
        const dir = path.join(root, 'skills', name)
        mkdirSync(dir, { recursive: true })
    }
    for (const name of agents) {
        const dir = path.join(root, 'agents')
        mkdirSync(dir, { recursive: true })
        writeFileSync(
            path.join(dir, `${name}.agent.md`),
            `---\nname: ${name}\n---\n\n> 项目覆盖：若存在 \`.ai/overrides/agents/${name}.md\`，先加载并按其规则执行。\n`,
        )
    }
    for (const file of files) {
        const fullPath = path.join(root, file)
        mkdirSync(path.dirname(fullPath), { recursive: true })
        writeFileSync(fullPath, '')
    }
    return root
}

function validManifest() {
    return {
        version: 1,
        skills: [
            { name: 'code-reviewer', internal: false },
            { name: 'full-stack-master', internal: true },
        ],
        agents: ['code-reviewer', 'full-stack-master'],
        l0Selection: {
            files: ['global/AGENTS.template.md'],
            skills: ['code-reviewer'],
            agents: ['full-stack-master'],
        },
    }
}

function writeSkill(repoRoot, name, internal, { withOverlayAnchor = true } = {}) {
    const anchor = withOverlayAnchor
        ? `\n> 项目覆盖：若存在 \`.ai/overrides/skills/${name}.md\`，先加载并按其规则执行。\n`
        : ''
    writeFileSync(
        path.join(repoRoot, 'skills', name, 'SKILL.md'),
        `---\nname: ${name}\nmetadata:\n  internal: ${internal}\n---\n${anchor}`,
    )
}

describe('verifyManifest', () => {
    it('全部一致时校验通过', () => {
        const root = createFixtureRepo({
            manifest: validManifest(),
            skills: ['code-reviewer', 'full-stack-master'],
            agents: ['code-reviewer', 'full-stack-master'],
            files: ['global/AGENTS.template.md'],
        })
        writeSkill(root, 'code-reviewer', false)
        writeSkill(root, 'full-stack-master', true)

        const result = verifyManifest(root)
        expect(result.ok).toBe(true)
        expect(result.errors).toEqual([])

        rmSync(root, { recursive: true, force: true })
    })

    it('SKILL.md internal 与 manifest 不一致时报错', () => {
        const root = createFixtureRepo({
            manifest: validManifest(),
            skills: ['code-reviewer', 'full-stack-master'],
            agents: ['code-reviewer', 'full-stack-master'],
            files: ['global/AGENTS.template.md'],
        })
        writeSkill(root, 'code-reviewer', true)
        writeSkill(root, 'full-stack-master', true)

        const result = verifyManifest(root)
        expect(result.ok).toBe(false)
        expect(result.errors.some((e) => e.includes('code-reviewer') && e.includes('不一致'))).toBe(true)

        rmSync(root, { recursive: true, force: true })
    })

    it('manifest 缺技能或多出技能时报错', () => {
        const root = createFixtureRepo({
            manifest: validManifest(),
            skills: ['code-reviewer'],
            agents: ['code-reviewer', 'full-stack-master'],
            files: ['global/AGENTS.template.md'],
        })
        writeSkill(root, 'code-reviewer', false)

        const result = verifyManifest(root)
        expect(result.ok).toBe(false)
        expect(result.errors.some((e) => e.includes('缺少技能: full-stack-master'))).toBe(true)

        rmSync(root, { recursive: true, force: true })
    })

    it('l0Selection 引用不存在时报错', () => {
        const root = createFixtureRepo({
            manifest: validManifest(),
            skills: ['code-reviewer', 'full-stack-master'],
            agents: ['code-reviewer', 'full-stack-master'],
        })
        writeSkill(root, 'code-reviewer', false)
        writeSkill(root, 'full-stack-master', true)

        const result = verifyManifest(root)
        expect(result.ok).toBe(false)
        expect(result.errors.some((e) => e.includes('l0Selection 文件不存在'))).toBe(true)

        rmSync(root, { recursive: true, force: true })
    })

    it('manifest 为无效 JSON 时报错', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'verify-manifest-'))
        writeFileSync(path.join(root, 'manifest.json'), '{invalid')

        const result = verifyManifest(root)
        expect(result.ok).toBe(false)
        expect(result.errors.some((e) => e.includes('无法读取'))).toBe(true)

        rmSync(root, { recursive: true, force: true })
    })

    it('deprecated 存在且不在 l0Selection 时校验通过', () => {
        const manifest = validManifest()
        manifest.agents = ['code-reviewer', 'full-stack-master', 'release-manager']
        manifest.deprecated = { skills: [], agents: ['release-manager'] }

        const root = createFixtureRepo({
            manifest,
            skills: ['code-reviewer', 'full-stack-master'],
            agents: ['code-reviewer', 'full-stack-master', 'release-manager'],
            files: ['global/AGENTS.template.md'],
        })
        writeSkill(root, 'code-reviewer', false)
        writeSkill(root, 'full-stack-master', true)

        const result = verifyManifest(root)
        expect(result.ok).toBe(true)
        expect(result.errors).toEqual([])

        rmSync(root, { recursive: true, force: true })
    })

    it('deprecated 引用不存在的 agent 时报错', () => {
        const manifest = validManifest()
        manifest.deprecated = { skills: [], agents: ['release-manager'] }

        const root = createFixtureRepo({
            manifest,
            skills: ['code-reviewer', 'full-stack-master'],
            agents: ['code-reviewer', 'full-stack-master'],
            files: ['global/AGENTS.template.md'],
        })
        writeSkill(root, 'code-reviewer', false)
        writeSkill(root, 'full-stack-master', true)

        const result = verifyManifest(root)
        expect(result.ok).toBe(false)
        expect(result.errors.some((e) => e.includes('deprecated agent 不存在: release-manager'))).toBe(true)
        // 该 agent 同时不在 manifest.agents 中，也会触发"manifest 缺少 agents"
        rmSync(root, { recursive: true, force: true })
    })

    it('deprecated 进入 l0Selection 时报错', () => {
        const manifest = validManifest()
        manifest.agents = ['code-reviewer', 'full-stack-master']
        manifest.deprecated = { skills: [], agents: ['full-stack-master'] }

        const root = createFixtureRepo({
            manifest,
            skills: ['code-reviewer', 'full-stack-master'],
            agents: ['code-reviewer', 'full-stack-master'],
            files: ['global/AGENTS.template.md'],
        })
        writeSkill(root, 'code-reviewer', false)
        writeSkill(root, 'full-stack-master', true)

        const result = verifyManifest(root)
        expect(result.ok).toBe(false)
        expect(result.errors.some((e) => e.includes('deprecated agent 不得进入 l0Selection: full-stack-master'))).toBe(true)

        rmSync(root, { recursive: true, force: true })
    })

    it('L0 技能缺少项目覆盖锚点时报错', () => {
        const root = createFixtureRepo({
            manifest: validManifest(),
            skills: ['code-reviewer', 'full-stack-master'],
            agents: ['code-reviewer', 'full-stack-master'],
            files: ['global/AGENTS.template.md'],
        })
        writeSkill(root, 'code-reviewer', false, { withOverlayAnchor: false })
        writeSkill(root, 'full-stack-master', true)

        const result = verifyManifest(root)
        expect(result.ok).toBe(false)
        expect(result.errors.some((e) => e.includes('L0 技能缺少项目覆盖锚点: code-reviewer'))).toBe(true)

        rmSync(root, { recursive: true, force: true })
    })

    it('L0 agent 缺少项目覆盖锚点时报错', () => {
        const manifest = validManifest()
        manifest.l0Selection.agents = ['full-stack-master']

        const root = createFixtureRepo({
            manifest,
            skills: ['code-reviewer', 'full-stack-master'],
            agents: ['code-reviewer', 'full-stack-master'],
            files: ['global/AGENTS.template.md'],
        })
        writeSkill(root, 'code-reviewer', false)
        writeSkill(root, 'full-stack-master', true)
        // 覆盖写入一个缺少锚点的 agent 文件
        writeFileSync(path.join(root, 'agents', 'full-stack-master.agent.md'), '---\nname: full-stack-master\n---\n')

        const result = verifyManifest(root)
        expect(result.ok).toBe(false)
        expect(result.errors.some((e) => e.includes('L0 agent 缺少项目覆盖锚点: full-stack-master'))).toBe(true)

        rmSync(root, { recursive: true, force: true })
    })
})
