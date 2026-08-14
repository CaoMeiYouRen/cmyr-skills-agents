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
        writeFileSync(path.join(dir, `${name}.agent.md`), '---\n---\n')
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

function writeSkill(repoRoot, name, internal) {
    writeFileSync(
        path.join(repoRoot, 'skills', name, 'SKILL.md'),
        `---\nname: ${name}\nmetadata:\n  internal: ${internal}\n---\n`,
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
})
