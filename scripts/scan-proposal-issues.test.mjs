import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import { collectProposalIssues, parseIssueUrl, summarizeIssues } from './scan-proposal-issues.mjs'

const status = {
    proposals: [
        {
            id: 'demo',
            title: '演示提案',
            issues: {
                a: { id: '#1', url: 'https://github.com/o/r/issues/1' },
            },
        },
        {
            id: 'draft',
            title: '无 issue 提案',
            issues: {},
        },
    ],
}

const url = 'https://github.com/o/r/issues/1'

describe('parseIssueUrl', () => {
    it('解析 owner / repo / number', () => {
        expect(parseIssueUrl(url)).toEqual({ owner: 'o', repo: 'r', number: 1 })
    })

    it('非 issue 链接返回 null', () => {
        expect(parseIssueUrl('https://example.com/1')).toBeNull()
        expect(parseIssueUrl(undefined)).toBeNull()
    })
})

describe('collectProposalIssues', () => {
    it('只收集登记了 issue 的提案', () => {
        const rows = collectProposalIssues(status)
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ proposal: 'demo', project: 'a', owner: 'o', repo: 'r', number: 1 })
    })
})

describe('summarizeIssues', () => {
    const entries = collectProposalIssues(status)

    it('open 且静默超过阈值时标为逾期', () => {
        const rows = summarizeIssues(
            entries,
            { [url]: { state: 'OPEN', createdAt: '2026-11-01T00:00:00Z', closedAt: null, comments: [] } },
            { now: '2026-11-10', overdueDays: 7 },
        )
        expect(rows[0].overdue).toBe(true)
        expect(rows[0].silentDays).toBe(9)
    })

    it('有新评论时不判逾期', () => {
        const rows = summarizeIssues(
            entries,
            {
                [url]: {
                    state: 'OPEN',
                    createdAt: '2026-11-01T00:00:00Z',
                    closedAt: null,
                    comments: [{ createdAt: '2026-11-08T00:00:00Z' }],
                },
            },
            { now: '2026-11-10', overdueDays: 7 },
        )
        expect(rows[0].overdue).toBe(false)
        expect(rows[0].comments).toBe(1)
    })

    it('已关闭且有评论时标为待回读', () => {
        const rows = summarizeIssues(
            entries,
            {
                [url]: {
                    state: 'CLOSED',
                    createdAt: '2026-11-01T00:00:00Z',
                    closedAt: '2026-11-03T00:00:00Z',
                    comments: [{ createdAt: '2026-11-03T00:00:00Z' }],
                },
            },
            { now: '2026-11-10', overdueDays: 7 },
        )
        expect(rows[0].needsReview).toBe(true)
        expect(rows[0].overdue).toBe(false)
        expect(rows[0].openDays).toBe(2)
    })

    it('查询失败时保留错误且不误判', () => {
        const rows = summarizeIssues(entries, { [url]: { error: 'gh 调用失败' } }, { now: '2026-11-10' })
        expect(rows[0].state).toBe('ERROR')
        expect(rows[0].overdue).toBe(false)
    })
})

describe('CLI', () => {
    it('--help 退出码为 0', () => {
        const output = execFileSync(process.execPath, ['scripts/scan-proposal-issues.mjs', '--help'], { stdio: 'pipe' }).toString()
        expect(output).toContain('--overdue-days')
    })

    it('--status 缺值退出码为 2', () => {
        let code = 0
        try {
            execFileSync(process.execPath, ['scripts/scan-proposal-issues.mjs', '--status'], { stdio: 'pipe' })
        } catch (error) {
            code = error.status
        }
        expect(code).toBe(2)
    })
})
