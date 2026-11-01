import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import { detectCapabilities, scanCapabilities, validateRegistry } from './check-capabilities.mjs'

const registry = {
    capabilities: [
        {
            id: 'release-security-gate',
            markers: [
                {
                    kind: 'files',
                    required: true,
                    param: 'ledgerPath',
                    values: ['.github/security-alert-exemptions.json'],
                },
                {
                    kind: 'scripts',
                    required: false,
                    param: 'command',
                    values: ['security:alerts'],
                },
                { kind: 'text', required: false, values: ['发布前安全告警门禁'] },
            ],
        },
        {
            id: 'task-start-ci-receipt',
            markers: [
                { kind: 'text', required: true, values: ['CI 回执'] },
                { kind: 'files', required: true, values: ['.session/current-task.yaml'] },
            ],
        },
        {
            id: 'security-auto-fix',
            markers: [{ kind: 'files', required: true, values: ['.github/workflows/security-auto-fix.yml'] }],
        },
    ],
}

function createProject(files = {}) {
    const root = mkdtempSync(path.join(tmpdir(), 'capabilities-'))
    for (const [relativePath, content] of Object.entries(files)) {
        const fullPath = path.join(root, relativePath)
        mkdirSync(path.dirname(fullPath), { recursive: true })
        writeFileSync(fullPath, content)
    }
    return root
}

describe('detectCapabilities', () => {
    it('必需标记命中时判定为已落地，并提取参数', () => {
        const root = createProject({
            'package.json': JSON.stringify({ scripts: { 'security:alerts': 'node x.mjs' } }),
            '.github/security-alert-exemptions.json': '[]',
            'docs/standards/security.md': '### 发布前安全告警门禁',
        })

        const result = detectCapabilities(root, registry)
        expect(result['release-security-gate'].present).toBe(true)
        expect(result['release-security-gate'].params.command).toBe('security:alerts')
        expect(result['release-security-gate'].params.ledgerPath).toBe('.github/security-alert-exemptions.json')
    })

    it('必需标记缺失时判定为未落地，并记录缺失类型', () => {
        const root = createProject({
            '.github/security-alert-exemptions.json': '[]',
        })

        const result = detectCapabilities(root, registry)
        expect(result['task-start-ci-receipt'].present).toBe(false)
        expect(result['task-start-ci-receipt'].missing).toContain('files')
    })

    it('只有 session 文件、没有规则文本时不算采纳', () => {
        const root = createProject({ '.session/current-task.yaml': 'progress: []' })

        const result = detectCapabilities(root, registry)
        expect(result['task-start-ci-receipt'].present).toBe(false)
        expect(result['task-start-ci-receipt'].missing).toContain('text')
    })

    it('规则文本与 session 同时存在才算采纳', () => {
        const root = createProject({
            'AGENTS.md': '- 任务开局检查 CI 回执。',
            '.session/current-task.yaml': 'progress: []',
        })

        const result = detectCapabilities(root, registry)
        expect(result['task-start-ci-receipt'].present).toBe(true)
    })

    it('门禁 workflow 不会被当成自动修复能力', () => {
        const root = createProject({
            '.github/workflows/security-alerts.yml': 'name: gate',
            '.github/security-alert-exemptions.json': '[]',
        })

        const result = detectCapabilities(root, registry)
        expect(result['security-auto-fix'].present).toBe(false)
        expect(result['release-security-gate'].present).toBe(true)
    })
})

describe('scanCapabilities', () => {
    it('按项目输出能力矩阵', () => {
        const withGate = createProject({
            'package.json': JSON.stringify({ scripts: { 'security:alerts': 'x' } }),
            '.github/security-alert-exemptions.json': '[]',
        })
        const without = createProject({ 'README.md': '# none' })

        const rows = scanCapabilities(registry, [withGate, without])
        expect(rows).toHaveLength(2)
        expect(rows[0].capabilities['release-security-gate'].present).toBe(true)
        expect(rows[1].capabilities['release-security-gate'].present).toBe(false)
    })
})

describe('CLI', () => {
    it('项目目录不存在时退出码为 2', () => {
        let code = 0
        try {
            execFileSync(process.execPath, ['scripts/check-capabilities.mjs', '--projects', '/nonexistent'], { stdio: 'pipe' })
        } catch (error) {
            code = error.status
        }
        expect(code).toBe(2)
    })

    it('--help 退出码为 0', () => {
        const output = execFileSync(process.execPath, ['scripts/check-capabilities.mjs', '--help'], { stdio: 'pipe' }).toString()
        expect(output).toContain('--projects')
    })
})

describe('validateRegistry', () => {
    it('id 重复时报错', () => {
        expect(() => validateRegistry({ capabilities: [{ id: 'x', markers: [{ kind: 'text', required: true, values: ['a'] }] }, { id: 'x', markers: [{ kind: 'text', required: true, values: ['a'] }] }] })).toThrow('重复')
    })

    it('markers 为空时报错', () => {
        expect(() => validateRegistry({ capabilities: [{ id: 'x', markers: [] }] })).toThrow('缺少 markers')
    })

    it('marker.kind 非法时报错', () => {
        expect(() => validateRegistry({ capabilities: [{ id: 'x', markers: [{ kind: 'paths', required: true, values: ['a'] }] }] })).toThrow('marker.kind')
    })

    it('全部标记为 optional 时报错（否则空证据也会被判定已落地）', () => {
        expect(() => validateRegistry({ capabilities: [{ id: 'x', markers: [{ kind: 'text', values: ['a'] }] }] })).toThrow('required')
    })

    it('marker.values 为空时报错', () => {
        expect(() => validateRegistry({ capabilities: [{ id: 'x', markers: [{ kind: 'text', required: true, values: [] }] }] })).toThrow('values')
    })
})
