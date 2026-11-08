#!/usr/bin/env node
/**
 * 提案状态校验与索引生成：读取 docs/proposals/status.json，校验各提案的项目结论，
 * 并把 README 索引与提案正文的结论块渲染为同一份数据，避免三处手工双写。
 *
 * 用法：
 *   node scripts/check-proposals.mjs [--root .] [--write] [--json]
 * 退出码：0 通过；1 校验失败或生成内容不一致；2 参数或文件错误。
 * 导出 validateStatus / render* 纯函数便于单测。
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const DEFAULT_STATUS = path.join('docs', 'proposals', 'status.json')
const DEFAULT_README = path.join('docs', 'proposals', 'README.md')

const STAGES = ['draft', 'notified', 'concluded', 'withdrawn']
const PROJECT_STATUSES = ['pending', 'adopted', 'partial', 'deferred', 'declined']
const BASES = ['feedback', 'issue', 'scan', 'record']
const NOTIFIED_VIA = ['issue', 'local-batch']

export const STAGE_LABELS = {
    draft: '草案',
    notified: '已通知',
    concluded: '已结案',
    withdrawn: '已撤回',
}

export const PROJECT_STATUS_LABELS = {
    pending: '待研判',
    adopted: '已采纳',
    partial: '部分采纳',
    deferred: '延后',
    declined: '不采纳',
}

export const BASIS_LABELS = {
    feedback: '项目反馈',
    issue: 'issue 回复',
    scan: '扫描标记',
    record: '上游登记',
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function assertDate(value, label) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
        throw new Error(`${label} 必须是 YYYY-MM-DD 格式`)
    }
    const date = new Date(`${value}T00:00:00Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new Error(`${label} 不是有效日期：${value}`)
    }
}

function assertUnique(values, label) {
    if (new Set(values).size !== values.length) {
        throw new Error(`${label} 存在重复项`)
    }
}

function validateProjectEntry(proposal, project, entry) {
    const label = `${proposal.id}.${project}`
    if (!entry || typeof entry !== 'object') {
        throw new Error(`${label} 的项目结论必须是对象`)
    }
    if (!PROJECT_STATUSES.includes(entry.status)) {
        throw new Error(`${label}.status 非法：${entry.status}`)
    }
    if (entry.status === 'pending') {
        if (entry.decidedAt || entry.observedAt) {
            throw new Error(`${label} 为待研判，不应有 decidedAt / observedAt`)
        }
    } else if (!entry.decidedAt && !entry.observedAt) {
        throw new Error(`${label} 非待研判状态必须有 decidedAt 或 observedAt`)
    }
    if (entry.decidedAt) {
        assertDate(entry.decidedAt, `${label}.decidedAt`)
    }
    if (entry.observedAt) {
        assertDate(entry.observedAt, `${label}.observedAt`)
    }
    if (entry.status !== 'pending' && !BASES.includes(entry.basis)) {
        throw new Error(`${label}.basis 必须是 ${BASES.join(' / ')} 之一`)
    }
    if (entry.basis !== undefined && !BASES.includes(entry.basis)) {
        throw new Error(`${label}.basis 非法：${entry.basis}`)
    }
    if (entry.declinedItems !== undefined) {
        if (!Array.isArray(entry.declinedItems) || entry.declinedItems.length === 0) {
            throw new Error(`${label}.declinedItems 必须是非空数组`)
        }
        if (!['partial', 'declined'].includes(entry.status)) {
            throw new Error(`${label}.declinedItems 只允许出现在部分采纳或不采纳`)
        }
    }
    if (entry.status === 'declined' && !entry.note) {
        throw new Error(`${label} 不采纳必须写 note 说明理由`)
    }
}

function validateIssues(proposal, affected) {
    const issues = proposal.issues ?? {}
    if (typeof issues !== 'object' || Array.isArray(issues)) {
        throw new Error(`${proposal.id}.issues 必须是对象`)
    }
    for (const [project, issue] of Object.entries(issues)) {
        if (!affected.includes(project)) {
            throw new Error(`${proposal.id}.issues.${project} 不在 affectedProjects 中`)
        }
        if (!issue || typeof issue.id !== 'string' || !/^#\d+$/.test(issue.id)) {
            throw new Error(`${proposal.id}.issues.${project}.id 必须形如 #123`)
        }
        if (typeof issue.url !== 'string' || !/^https?:\/\//.test(issue.url)) {
            throw new Error(`${proposal.id}.issues.${project}.url 必须是 http(s) 地址`)
        }
    }
}

function validateProposal(proposal, projectSet, baseDir) {
    if (!proposal || typeof proposal !== 'object') {
        throw new Error('提案条目必须是对象')
    }
    if (typeof proposal.id !== 'string' || !/^[a-z0-9-]+$/.test(proposal.id)) {
        throw new Error(`提案 id 非法：${proposal.id}`)
    }
    const label = proposal.id
    if (typeof proposal.title !== 'string' || proposal.title.trim() === '') {
        throw new Error(`${label} 缺少 title`)
    }
    if (typeof proposal.file !== 'string' || !/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(proposal.file)) {
        throw new Error(`${label}.file 必须形如 YYYY-MM-DD-<slug>.md`)
    }
    if (baseDir && !existsSync(path.join(baseDir, proposal.file))) {
        throw new Error(`${label}.file 不存在：${proposal.file}`)
    }
    if (!STAGES.includes(proposal.stage)) {
        throw new Error(`${label}.stage 非法：${proposal.stage}`)
    }
    const affected = proposal.affectedProjects ?? []
    if (!Array.isArray(affected)) {
        throw new Error(`${label}.affectedProjects 必须是数组`)
    }
    assertUnique(affected, `${label}.affectedProjects`)
    for (const project of affected) {
        if (!projectSet.has(project)) {
            throw new Error(`${label}.affectedProjects 含未知项目：${project}`)
        }
    }
    if (['notified', 'concluded', 'withdrawn'].includes(proposal.stage) && affected.length === 0) {
        throw new Error(`${label} 处于 ${proposal.stage}，affectedProjects 不能为空`)
    }
    if (proposal.notifiedVia !== undefined && !NOTIFIED_VIA.includes(proposal.notifiedVia)) {
        throw new Error(`${label}.notifiedVia 必须是 ${NOTIFIED_VIA.join(' / ')} 之一`)
    }
    if (proposal.notifiedAt) {
        assertDate(proposal.notifiedAt, `${label}.notifiedAt`)
    }
    if (proposal.concludedAt) {
        assertDate(proposal.concludedAt, `${label}.concludedAt`)
    }
    if (proposal.notifiedAt && proposal.concludedAt && proposal.notifiedAt > proposal.concludedAt) {
        throw new Error(`${label}.notifiedAt 不能晚于 concludedAt`)
    }
    if (proposal.stage === 'draft') {
        if (proposal.notifiedAt || proposal.concludedAt) {
            throw new Error(`${label} 仍是草案，不应有 notifiedAt / concludedAt`)
        }
        const decided = affected.filter((project) => (proposal.projects?.[project]?.status ?? 'pending') !== 'pending')
        if (decided.length > 0) {
            throw new Error(`${label} 仍是草案，${decided.join(', ')} 不应已有结论`)
        }
    }
    if (['notified', 'concluded'].includes(proposal.stage)) {
        if (!proposal.notifiedAt) {
            throw new Error(`${label} 处于 ${proposal.stage}，必须有 notifiedAt`)
        }
        if (!proposal.notifiedVia) {
            throw new Error(`${label} 处于 ${proposal.stage}，必须声明 notifiedVia（issue / local-batch）`)
        }
    }
    if (proposal.stage === 'withdrawn' && !proposal.reason) {
        throw new Error(`${label} 已撤回，必须写 reason`)
    }
    const entries = proposal.projects ?? {}
    if (typeof entries !== 'object' || Array.isArray(entries)) {
        throw new Error(`${label}.projects 必须是对象`)
    }
    for (const project of Object.keys(entries)) {
        if (!affected.includes(project)) {
            throw new Error(`${label}.projects.${project} 不在 affectedProjects 中`)
        }
    }
    for (const project of affected) {
        if (!entries[project]) {
            throw new Error(`${label} 缺少 ${project} 的项目结论`)
        }
        validateProjectEntry(proposal, project, entries[project])
    }
    validateIssues(proposal, affected)
    if (['notified', 'concluded'].includes(proposal.stage) && proposal.notifiedVia === 'issue') {
        const missingIssues = affected.filter((project) => !proposal.issues?.[project])
        if (missingIssues.length > 0) {
            throw new Error(`${label} 走 issue 通知，${missingIssues.join(', ')} 缺少 issue 链接`)
        }
    }
    if (proposal.stage === 'draft' && Object.keys(proposal.issues ?? {}).length > 0) {
        throw new Error(`${label} 仍是草案，不应登记 issue`)
    }
    if (['concluded', 'withdrawn'].includes(proposal.stage)) {
        if (!proposal.concludedAt) {
            throw new Error(`${label} 处于 ${proposal.stage}，必须有 concludedAt`)
        }
        const pending = affected.filter((project) => entries[project].status === 'pending')
        if (pending.length > 0) {
            throw new Error(`${label} 已结案但 ${pending.join(', ')} 仍待研判`)
        }
    }
}

export function validateStatus(status, options = {}) {
    const { baseDir } = options
    if (!status || typeof status !== 'object') {
        throw new Error('status.json 根节点必须是对象')
    }
    if (status.version !== 1) {
        throw new Error(`status.version 必须为 1，当前为 ${status.version}`)
    }
    assertDate(status.updatedAt, 'status.updatedAt')
    if (!Array.isArray(status.projects) || status.projects.length === 0) {
        throw new Error('status.projects 必须是非空数组')
    }
    assertUnique(status.projects, 'status.projects')
    const projectSet = new Set(status.projects)
    if (!Array.isArray(status.proposals) || status.proposals.length === 0) {
        throw new Error('status.proposals 必须是非空数组')
    }
    if (status.feedback !== undefined && !Array.isArray(status.feedback)) {
        throw new Error('status.feedback 必须是数组')
    }
    assertUnique(
        status.proposals.map((proposal) => proposal?.id),
        'status.proposals 的 id',
    )
    for (const proposal of status.proposals) {
        validateProposal(proposal, projectSet, baseDir)
    }
    for (const item of status.feedback ?? []) {
        if (!projectSet.has(item?.project)) {
            throw new Error(`feedback 含未知项目：${item?.project}`)
        }
        assertDate(item.date, `feedback(${item.project}).date`)
        if (!item.file && !item.issue) {
            throw new Error(`feedback(${item.project}) 至少要有 file 或 issue`)
        }
        if (item.file) {
            const segments = item.file.split(/[\\/]/)
            if (!item.file.endsWith('.md') || path.isAbsolute(item.file) || segments.includes('..')) {
                throw new Error(`feedback(${item.project}).file 必须是 docs/proposals 下的 .md 相对路径`)
            }
            if (baseDir) {
                const resolved = path.resolve(baseDir, item.file)
                if (!resolved.startsWith(`${path.resolve(baseDir)}${path.sep}`)) {
                    throw new Error(`feedback(${item.project}).file 越出 docs/proposals：${item.file}`)
                }
                if (!existsSync(resolved)) {
                    throw new Error(`feedback(${item.project}).file 不存在：${item.file}`)
                }
            }
        }
        if (item.issue) {
            if (typeof item.issue.id !== 'string' || !/^#\d+$/.test(item.issue.id)) {
                throw new Error(`feedback(${item.project}).issue.id 必须形如 #123`)
            }
            if (typeof item.issue.url !== 'string' || !/^https?:\/\//.test(item.issue.url)) {
                throw new Error(`feedback(${item.project}).issue.url 必须是 http(s) 地址`)
            }
        }
    }
    return status
}

function formatProjectCell(entry, issue) {
    const parts = [PROJECT_STATUS_LABELS[entry.status]]
    if (issue) {
        parts.push(`[${issue.id}](${issue.url})`)
    }
    if (entry.declinedItems?.length) {
        parts.push(`跳过 ${entry.declinedItems.length} 项`)
    }
    return parts.join(' · ')
}

function escapeCell(value) {
    return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function renderTable(headers, rows) {
    return [
        `| ${headers.map(escapeCell).join(' | ')} |`,
        `| ${headers.map(() => ':---').join(' | ')} |`,
        ...rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`),
    ]
}

export function renderProposalBlock(status, proposal) {
    const entries = proposal.projects ?? {}
    const rows = proposal.affectedProjects.map((project) => {
        const entry = entries[project]
        return [
            project,
            PROJECT_STATUS_LABELS[entry.status],
            entry.decidedAt ?? entry.observedAt ?? '—',
            entry.basis ? BASIS_LABELS[entry.basis] : '—',
        ]
    })
    const notes = proposal.affectedProjects
        .filter((project) => entries[project].note)
        .map((project) => `- **${project}**：${escapeCell(entries[project].note)}`)
    return [
        '<!-- proposal-status:start -->',
        '## 项目研判结论（自动生成）',
        '',
        '> 数据源 `docs/proposals/status.json`；由 `node scripts/check-proposals.mjs --write` 生成，请勿手工编辑。',
        '',
        ...renderTable(['项目', '结论', '日期', '依据'], rows),
        ...(notes.length > 0 ? ['', ...notes] : []),
        '<!-- proposal-status:end -->',
    ].join('\n')
}

function formatFeedbackRecord(item) {
    if (item.file) {
        return `[${item.file}](./${item.file})`
    }
    if (item.issue?.url) {
        return `[${item.issue.id}](${item.issue.url})`
    }
    return item.issue.id
}

export function renderReadmeBlock(status) {
    const rows = status.proposals.map((proposal) => {
        const issues = proposal.issues ?? {}
        return [
            `[${proposal.title}](./${proposal.file})`,
            proposal.capability ? `\`${proposal.capability}\`` : '—',
            STAGE_LABELS[proposal.stage],
            ...status.projects.map((project) =>
                proposal.affectedProjects.includes(project) ? formatProjectCell(proposal.projects[project], issues[project]) : '—',
            ),
        ]
    })
    const feedbackRows = (status.feedback ?? []).map((item) => [
        item.project,
        item.scope ?? '—',
        item.date,
        formatFeedbackRecord(item),
    ])
    return [
        '<!-- proposals-status:start -->',
        '## 索引',
        '',
        '> 阶段：草案 / 已通知 / 已结案 / 已撤回。项目结论由 `status.json` 生成；扫描命中的「已采纳 / 部分采纳」只代表标记存在，语义一致性仍需项目研判。',
        '',
        ...renderTable(['提案', '能力', '阶段', ...status.projects], rows),
        '',
        '> 多仓库提案按项目列出 issue；有 issue 的以 GitHub 为准，本地批次以 `status.json` 的项目记录为准。',
        '',
        '## 下游研判记录',
        '',
        ...(feedbackRows.length > 0
            ? renderTable(['项目', '范围', '日期', '记录'], feedbackRows)
            : ['（暂无）']),
        '<!-- proposals-status:end -->',
    ].join('\n')
}

export function upsertBlock(markdown, name, block) {
    const start = `<!-- ${name}:start -->`
    const end = `<!-- ${name}:end -->`
    const startIndex = markdown.indexOf(start)
    const endIndex = markdown.indexOf(end)
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        return markdown.slice(0, startIndex) + block + markdown.slice(endIndex + end.length)
    }
    if (startIndex !== -1 || endIndex !== -1) {
        throw new Error(`${name} 标记不成对`)
    }
    return `${markdown.trimEnd()}\n\n${block}\n`
}

function readText(filePath, label) {
    try {
        return readFileSync(filePath, 'utf8')
    } catch (error) {
        const wrapped = new Error(`无法读取${label}：${filePath}（${error.message}）`)
        wrapped.exitCode = 2
        throw wrapped
    }
}

function buildPlan(options) {
    const root = path.resolve(options.root)
    if (!existsSync(root) || !statSync(root).isDirectory()) {
        const error = new Error(`--root 不是目录：${root}`)
        error.exitCode = 2
        throw error
    }
    const statusPath = path.resolve(root, options.status)
    const readmePath = path.resolve(root, options.readme)
    let status
    try {
        status = JSON.parse(readText(statusPath, 'status.json'))
    } catch (error) {
        if (error.exitCode) {
            throw error
        }
        const wrapped = new Error(`status.json 不是合法 JSON：${error.message}`)
        wrapped.exitCode = 2
        throw wrapped
    }
    const baseDir = path.dirname(statusPath)
    try {
        validateStatus(status, { baseDir })
    } catch (error) {
        error.exitCode = 1
        throw error
    }
    const readme = readText(readmePath, 'README.md')
    let readmeNext
    try {
        readmeNext = upsertBlock(readme, 'proposals-status', renderReadmeBlock(status))
    } catch (error) {
        error.exitCode = 2
        throw error
    }
    const files = [{ path: readmePath, label: 'README 索引', before: readme, after: readmeNext }]
    for (const proposal of status.proposals) {
        const filePath = path.join(baseDir, proposal.file)
        const before = readText(filePath, `提案 ${proposal.file}`)
        let after
        try {
            after = upsertBlock(before, 'proposal-status', renderProposalBlock(status, proposal))
        } catch (error) {
            error.exitCode = 2
            throw error
        }
        files.push({ path: filePath, label: `提案 ${proposal.file}`, before, after })
    }
    return { status, files }
}

function requireValue(value, flag) {
    if (!value || value.startsWith('--')) {
        const error = new Error(`${flag} 缺少参数值`)
        error.exitCode = 2
        throw error
    }
    return value
}

function takeValue(argv, index, flag) {
    return requireValue(argv[index + 1], flag)
}

function parseArgs(argv) {
    const options = { root: '.', status: DEFAULT_STATUS, readme: DEFAULT_README, write: false, json: false }
    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index]
        if (arg === '--root') {
            options.root = takeValue(argv, index++, arg)
        } else if (arg.startsWith('--root=')) {
            options.root = requireValue(arg.slice('--root='.length), '--root')
        } else if (arg === '--status') {
            options.status = takeValue(argv, index++, arg)
        } else if (arg.startsWith('--status=')) {
            options.status = requireValue(arg.slice('--status='.length), '--status')
        } else if (arg === '--readme') {
            options.readme = takeValue(argv, index++, arg)
        } else if (arg.startsWith('--readme=')) {
            options.readme = requireValue(arg.slice('--readme='.length), '--readme')
        } else if (arg === '--write') {
            options.write = true
        } else if (arg === '--json') {
            options.json = true
        } else if (arg === '--help' || arg === '-h') {
            console.info('用法：node scripts/check-proposals.mjs [--root .] [--write] [--json]')
            process.exit(0)
        } else {
            const error = new Error(`未知参数：${arg}`)
            error.exitCode = 2
            throw error
        }
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
    let plan
    try {
        plan = buildPlan(options)
    } catch (error) {
        console.error(error.message)
        process.exit(error.exitCode ?? 1)
    }
    const drifted = plan.files.filter((file) => file.before !== file.after)
    if (options.write) {
        for (const file of drifted) {
            writeFileSync(file.path, file.after)
        }
        console.info(`提案状态：${plan.status.proposals.length} 份提案，更新 ${drifted.length} 个文件`)
        process.exit(0)
    }
    if (options.json) {
        console.info(
            JSON.stringify(
                {
                    ok: drifted.length === 0,
                    drifted: drifted.map((file) => file.label),
                    proposals: plan.status.proposals.map((proposal) => ({
                        id: proposal.id,
                        stage: proposal.stage,
                        projects: proposal.projects,
                    })),
                },
                null,
                2,
            ),
        )
    } else if (drifted.length > 0) {
        console.error(`提案状态与生成内容不一致：${drifted.map((file) => file.label).join('、')}`)
        console.error('运行 node scripts/check-proposals.mjs --write 后提交生成结果。')
    } else {
        console.info(`提案状态：${plan.status.proposals.length} 份提案，索引与结论块均为最新`)
    }
    process.exit(drifted.length === 0 ? 0 : 1)
}
