import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
    renderProposalBlock,
    renderReadmeBlock,
    upsertBlock,
    validateStatus,
} from './check-proposals.mjs'

function makeStatus(overrides = {}) {
    return {
        version: 1,
        updatedAt: '2026-11-09',
        projects: ['a', 'b'],
        proposals: [
            {
                id: 'demo',
                title: '演示提案',
                file: '2026-11-02-demo.md',
                stage: 'notified',
                notifiedAt: '2026-11-02',
                notifiedVia: 'local-batch',
                affectedProjects: ['a', 'b'],
                projects: {
                    a: { status: 'adopted', basis: 'feedback', decidedAt: '2026-11-03', note: '已落地' },
                    b: { status: 'pending', note: '等排期' },
                },
            },
        ],
        feedback: [],
        ...overrides,
    }
}

function createStatus(proposalOverrides = {}) {
    const status = makeStatus()
    status.proposals[0] = { ...status.proposals[0], ...proposalOverrides }
    return status
}

describe('validateStatus', () => {
    it('合法的已通知状态通过校验', () => {
        expect(validateStatus(makeStatus())).toBeTruthy()
    })

    it('已结案但仍有待研判项目时报错', () => {
        const status = createStatus({ stage: 'concluded', concludedAt: '2026-11-09' })
        expect(() => validateStatus(status)).toThrow('仍待研判')
    })

    it('非待研判状态缺少日期时报错', () => {
        const status = makeStatus()
        status.proposals[0].projects.a = { status: 'adopted' }
        expect(() => validateStatus(status)).toThrow('decidedAt')
    })

    it('不采纳缺少理由时报错', () => {
        const status = makeStatus()
        status.proposals[0].projects.a = { status: 'declined', basis: 'record', decidedAt: '2026-11-03' }
        expect(() => validateStatus(status)).toThrow('理由')
    })

    it('项目结论不在 affectedProjects 内时报错', () => {
        const status = makeStatus()
        status.proposals[0].projects.c = { status: 'pending' }
        expect(() => validateStatus(status)).toThrow('不在 affectedProjects')
    })

    it('issue 编号格式非法时报错', () => {
        const status = makeStatus()
        status.proposals[0].issues = { a: { id: '222', url: 'https://example.com/222' } }
        expect(() => validateStatus(status)).toThrow('#123')
    })

    it('提案文件不存在时报错', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'proposals-'))
        expect(() => validateStatus(makeStatus(), { baseDir: root })).toThrow('不存在')
    })

    it('已撤回缺少原因时报错', () => {
        const status = createStatus({
            stage: 'withdrawn',
            concludedAt: '2026-11-09',
        })
        delete status.proposals[0].notifiedAt
        delete status.proposals[0].notifiedVia
        status.proposals[0].projects.b = { status: 'declined', basis: 'record', decidedAt: '2026-11-03', note: '不适用' }
        expect(() => validateStatus(status)).toThrow('reason')
    })

    it('非待研判缺少 basis 时报错', () => {
        const status = makeStatus()
        status.proposals[0].projects.a = { status: 'adopted', decidedAt: '2026-11-03' }
        expect(() => validateStatus(status)).toThrow('basis')
    })

    it('非法日历日期时报错', () => {
        const status = makeStatus()
        status.proposals[0].projects.a = { status: 'adopted', basis: 'scan', observedAt: '2026-13-45' }
        expect(() => validateStatus(status)).toThrow('有效日期')
    })

    it('草案不应有结案日期', () => {
        const status = createStatus({ stage: 'draft', concludedAt: '2026-11-09' })
        delete status.proposals[0].notifiedAt
        delete status.proposals[0].notifiedVia
        expect(() => validateStatus(status)).toThrow('草案')
    })

    it('已通知提案必须声明通知方式', () => {
        const status = makeStatus()
        delete status.proposals[0].notifiedVia
        expect(() => validateStatus(status)).toThrow('notifiedVia')
    })

    it('走 issue 通知时每个项目都要有 issue', () => {
        const status = makeStatus()
        status.proposals[0].notifiedVia = 'issue'
        status.proposals[0].issues = { a: { id: '#1', url: 'https://example.com/1' } }
        expect(() => validateStatus(status)).toThrow('缺少 issue')
    })

    it('feedback 文件越出 docs/proposals 时报错', () => {
        const status = makeStatus({
            feedback: [{ project: 'a', date: '2026-11-03', file: '../outside.md' }],
        })
        expect(() => validateStatus(status)).toThrow('相对路径')
    })

    it('updatedAt 非法时报错', () => {
        const status = makeStatus({ updatedAt: '2026-02-30' })
        expect(() => validateStatus(status)).toThrow('updatedAt')
    })

    it('feedback 不是数组时报错', () => {
        const status = makeStatus({ feedback: {} })
        expect(() => validateStatus(status)).toThrow('feedback')
    })
})

describe('renderReadmeBlock', () => {
    it('按项目列出结论，未涉及的项目显示占位', () => {
        const block = renderReadmeBlock(makeStatus())
        expect(block).toContain('| 提案 | 能力 | 阶段 | a | b |')
        expect(block).toContain('已采纳')
        expect(block).toContain('待研判')
        expect(block).toContain('[演示提案](./2026-11-02-demo.md)')
    })

    it('登记 issue 时附加链接', () => {
        const status = makeStatus()
        status.proposals[0].issues = { a: { id: '#1', url: 'https://example.com/1' } }
        expect(renderReadmeBlock(status)).toContain('[#1](https://example.com/1)')
    })

    it('标题中的竖线会被转义，避免破坏表格', () => {
        const status = makeStatus()
        status.proposals[0].title = 'a | b'
        expect(renderReadmeBlock(status)).toContain('a \\| b')
    })
})

describe('renderProposalBlock', () => {
    it('输出项目结论表与备注', () => {
        const status = makeStatus()
        const block = renderProposalBlock(status, status.proposals[0])
        expect(block).toContain('## 项目研判结论（自动生成）')
        expect(block).toContain('| a | 已采纳 | 2026-11-03 | 项目反馈 |')
        expect(block).toContain('- **b**：等排期')
    })
})

describe('upsertBlock', () => {
    it('替换已有标记之间的内容', () => {
        const markdown = '# 标题\n\n<!-- x:start -->\n旧内容\n<!-- x:end -->\n\n尾部'
        const result = upsertBlock(markdown, 'x', '<!-- x:start -->\n新内容\n<!-- x:end -->')
        expect(result).toContain('新内容')
        expect(result).not.toContain('旧内容')
        expect(result).toContain('尾部')
    })

    it('没有标记时追加到文末', () => {
        const result = upsertBlock('# 标题\n', 'x', '<!-- x:start -->\n新内容\n<!-- x:end -->')
        expect(result).toBe('# 标题\n\n<!-- x:start -->\n新内容\n<!-- x:end -->\n')
    })

    it('标记不成对时报错', () => {
        expect(() => upsertBlock('<!-- x:start -->\n', 'x', '')).toThrow('不成对')
    })
})

describe('CLI', () => {
    function createRoot() {
        const root = mkdtempSync(path.join(tmpdir(), 'proposals-cli-'))
        const dir = path.join(root, 'docs', 'proposals')
        mkdirSync(dir, { recursive: true })
        writeFileSync(
            path.join(dir, 'README.md'),
            '# 提案\n\n<!-- proposals-status:start -->\n旧索引\n<!-- proposals-status:end -->\n',
        )
        writeFileSync(path.join(dir, '2026-11-02-demo.md'), '# 演示提案\n\n正文\n')
        const status = makeStatus()
        status.proposals[0].projects.b = { status: 'declined', basis: 'record', decidedAt: '2026-11-03', note: '成本高于收益' }
        status.proposals[0].stage = 'concluded'
        status.proposals[0].concludedAt = '2026-11-09'
        writeFileSync(path.join(dir, 'status.json'), JSON.stringify(status))
        return { root, dir }
    }

    it('生成内容不一致时退出码为 1，--write 后为 0', () => {
        const { root, dir } = createRoot()
        const script = path.resolve('scripts/check-proposals.mjs')
        let code = 0
        try {
            execFileSync(process.execPath, [script, '--root', root], { stdio: 'pipe' })
        } catch (error) {
            code = error.status
        }
        expect(code).toBe(1)

        execFileSync(process.execPath, [script, '--root', root, '--write'], { stdio: 'pipe' })
        expect(readFileSync(path.join(dir, 'README.md'), 'utf8')).toContain('## 索引')
        expect(readFileSync(path.join(dir, '2026-11-02-demo.md'), 'utf8')).toContain('proposal-status:start')

        const readmeAfter = readFileSync(path.join(dir, 'README.md'), 'utf8')
        execFileSync(process.execPath, [script, '--root', root, '--write'], { stdio: 'pipe' })
        expect(readFileSync(path.join(dir, 'README.md'), 'utf8')).toBe(readmeAfter)

        const output = execFileSync(process.execPath, [script, '--root', root, '--json'], { stdio: 'pipe' }).toString()
        expect(JSON.parse(output).ok).toBe(true)

        expect(() => execFileSync(process.execPath, [script, '--root', root], { stdio: 'pipe' })).not.toThrow()
    })

    it('--help 退出码为 0', () => {
        const output = execFileSync(process.execPath, ['scripts/check-proposals.mjs', '--help'], { stdio: 'pipe' }).toString()
        expect(output).toContain('--write')
    })

    it('--root= 空值时退出码为 2', () => {
        let code = 0
        try {
            execFileSync(process.execPath, ['scripts/check-proposals.mjs', '--root='], { stdio: 'pipe' })
        } catch (error) {
            code = error.status
        }
        expect(code).toBe(2)
    })
})
