#!/usr/bin/env node
/**
 * 提案 issue 例行扫描：读取 docs/proposals/status.json 登记的 issue，
 * 通过 gh 查询状态与评论，标出超期未回执与需要回读的已关闭 proposal。
 *
 * 用法：
 *   node scripts/scan-proposal-issues.mjs [--status <path>] [--now YYYY-MM-DD] [--overdue-days 7] [--strict] [--json]
 * 退出码：0 报告完成；1 使用 --strict 时存在逾期或待回读；2 参数、文件或 gh 调用错误。
 * 导出 parseIssueUrl / collectProposalIssues / summarizeIssues 纯函数便于单测。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const DEFAULT_STATUS = path.join('docs', 'proposals', 'status.json')
const DAY = 24 * 60 * 60 * 1000

export function parseIssueUrl(url) {
    const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/.exec(url ?? '')
    if (!match) {
        return null
    }
    return { owner: match[1], repo: match[2], number: Number(match[3]) }
}

export function collectProposalIssues(status) {
    const rows = []
    for (const proposal of status.proposals ?? []) {
        for (const [project, issue] of Object.entries(proposal.issues ?? {})) {
            const parsed = parseIssueUrl(issue.url)
            rows.push({
                proposal: proposal.id,
                title: proposal.title,
                project,
                issue: issue.id,
                url: issue.url,
                owner: parsed?.owner,
                repo: parsed?.repo,
                number: parsed?.number,
            })
        }
    }
    return rows
}

function daysBetween(from, to) {
    return Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / DAY)
}

export function summarizeIssues(entries, details, options = {}) {
    const now = options.now ? new Date(`${options.now}T00:00:00Z`) : new Date()
    const overdueDays = options.overdueDays ?? 7
    return entries.map((entry) => {
        const detail = details?.[entry.url]
        if (!detail) {
            return { ...entry, state: 'UNKNOWN', error: '未取得 issue 数据', overdue: false, needsReview: false }
        }
        if (detail.error) {
            return { ...entry, state: 'ERROR', error: detail.error, overdue: false, needsReview: false }
        }
        const comments = detail.comments ?? []
        const activity = [detail.createdAt, detail.closedAt, ...comments.map((comment) => comment.createdAt)].filter(Boolean).sort()
        const lastActivity = activity.at(-1) ?? detail.createdAt
        const end = detail.closedAt ? new Date(detail.closedAt) : now
        const openDays = Math.max(0, daysBetween(detail.createdAt, end))
        const silentDays = Math.max(0, daysBetween(lastActivity, now))
        const state = String(detail.state ?? '').toUpperCase()
        return {
            ...entry,
            state,
            openDays,
            silentDays,
            comments: comments.length,
            lastActivity,
            overdue: state === 'OPEN' && silentDays > overdueDays,
            needsReview: state === 'CLOSED' && comments.length > 0,
        }
    })
}

function fetchDetails(entries, exec = execFileSync) {
    const details = {}
    for (const entry of entries) {
        if (!entry.owner || !entry.repo || !entry.number) {
            details[entry.url] = { error: 'issue 链接无法解析' }
            continue
        }
        try {
            const output = exec(
                'gh',
                [
                    'issue',
                    'view',
                    String(entry.number),
                    '--repo',
                    `${entry.owner}/${entry.repo}`,
                    '--json',
                    'state,createdAt,closedAt,comments',
                ],
                { encoding: 'utf8' },
            )
            details[entry.url] = JSON.parse(output)
        } catch (error) {
            details[entry.url] = { error: `gh 调用失败：${error.message.split('\n')[0]}` }
        }
    }
    return details
}

function formatRow(row) {
    const flags = []
    if (row.error) {
        flags.push(row.error)
    }
    if (row.overdue) {
        flags.push('逾期未回执')
    }
    if (row.needsReview) {
        flags.push('需回读评论')
    }
    return [
        row.proposal.padEnd(30),
        row.project.padEnd(12),
        String(row.issue).padEnd(8),
        String(row.state).padEnd(8),
        row.openDays === undefined ? '—' : `${row.openDays}d`,
        row.silentDays === undefined ? '—' : `${row.silentDays}d`,
        flags.join('；') || '—',
    ].join(' ')
}

function parseArgs(argv) {
    const options = { status: DEFAULT_STATUS, now: undefined, overdueDays: 7, strict: false, json: false }
    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index]
        const value = argv[index + 1]
        if (arg === '--status') {
            options.status = value ?? ''
            index++
        } else if (arg === '--now') {
            options.now = value
            index++
        } else if (arg === '--overdue-days') {
            options.overdueDays = Number(value)
            index++
        } else if (arg === '--strict') {
            options.strict = true
        } else if (arg === '--json') {
            options.json = true
        } else if (arg === '--help' || arg === '-h') {
            console.info('用法：node scripts/scan-proposal-issues.mjs [--status <path>] [--now YYYY-MM-DD] [--overdue-days 7] [--strict] [--json]')
            process.exit(0)
        } else {
            const error = new Error(`未知参数：${arg}`)
            error.exitCode = 2
            throw error
        }
    }
    if (!options.status) {
        const error = new Error('--status 缺少参数值')
        error.exitCode = 2
        throw error
    }
    if (!Number.isInteger(options.overdueDays) || options.overdueDays < 0) {
        const error = new Error('--overdue-days 必须是非负整数')
        error.exitCode = 2
        throw error
    }
    if (options.now && !/^\d{4}-\d{2}-\d{2}$/.test(options.now)) {
        const error = new Error('--now 必须是 YYYY-MM-DD')
        error.exitCode = 2
        throw error
    }
    return options
}

function isExecutedDirectly(metaUrl) {
    return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(metaUrl)
}

if (isExecutedDirectly(import.meta.url)) {
    let options
    try {
        options = parseArgs(process.argv.slice(2))
    } catch (error) {
        console.error(error.message)
        process.exit(2)
    }
    let status
    try {
        status = JSON.parse(readFileSync(options.status, 'utf8'))
    } catch (error) {
        console.error(`无法读取提案状态：${options.status}（${error.message}）`)
        process.exit(2)
    }
    const entries = collectProposalIssues(status)
    const rows = summarizeIssues(entries, fetchDetails(entries), { now: options.now, overdueDays: options.overdueDays })
    const errors = rows.filter((row) => row.error)
    const overdue = rows.filter((row) => row.overdue)
    const review = rows.filter((row) => row.needsReview)

    if (options.json) {
        console.info(JSON.stringify({ rows, overdue: overdue.length, needsReview: review.length, errors: errors.length }, null, 2))
    } else if (rows.length === 0) {
        console.info('提案状态中没有登记 issue')
    } else {
        console.info(
            ['提案'.padEnd(30), '项目'.padEnd(12), 'issue'.padEnd(8), '状态'.padEnd(8), '已开'.padEnd(5), '静默'.padEnd(5), '备注'].join(' '),
        )
        for (const row of rows) {
            console.info(formatRow(row))
        }
        console.info(`\n合计 ${rows.length} 个 issue：逾期 ${overdue.length}，待回读 ${review.length}，查询失败 ${errors.length}`)
        if (overdue.length > 0) {
            console.info('逾期：open 且静默超过阈值。按 standards/proposals.md §4 提醒项目给出状态，不代项目研判。')
        }
        if (review.length > 0) {
            console.info('待回读：已关闭但有评论，需人工提取「已知偏差」并评估登记为 candidate。')
        }
    }

    if (errors.length > 0) {
        process.exit(2)
    }
    process.exit(options.strict && overdue.length > 0 ? 1 : 0)
}
