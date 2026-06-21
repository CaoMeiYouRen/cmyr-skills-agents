#!/usr/bin/env node

/**
 * collect-multi-repo-alerts.mjs
 *
 * 批量收集当前用户所有仓库的 Dependabot alerts，按严重级别和仓库排序后输出 JSON。
 *
 * 用法：
 *   node <skill-dir>/scripts/collect-multi-repo-alerts.mjs [--output-json <path>] [--output-markdown <path>] [--updated-after <date>]
 *
 * 环境变量：
 *   GITHUB_TOKEN / GH_TOKEN — GitHub personal access token，必须（权限：repo + security_events）。
 *
 * 默认行为：
 *   - 拉取当前用户所有非私有、非 fork、非归档、非禁用的仓库
 *   - 默认只包含最近 3 个月内有更新的仓库（可通过 --updated-after 覆盖）
 *   - 每个仓库拉取 open 状态的 Dependabot alerts
 *   - 跳过无 alerts 的仓库
 *   - 按 critical > high > medium > low > unknown 优先级排序
 *
 * 输出 JSON 结构：
 *   {
 *     generatedAt: "ISO 8601",
 *     totalAlerts: number,
 *     severityCounts: { critical, high, medium, low, unknown },
 *     repos: [
 *       {
 *         fullName, htmlUrl, cloneUrl, defaultBranch,
 *         total, critical, high, medium, low, unknown,
 *         alerts: [
 *           { packageName, severity, patchedVersion, advisorySummary, htmlUrl }
 *         ]
 *       }
 *     ]
 *   }
 */

import { Octokit } from '@octokit/core'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ── 配置 ──────────────────────────────────────────────

const REPO_PAGE_SIZE = 100
const ALERT_PAGE_SIZE = 100

// ── 参数解析 ──────────────────────────────────────────

function parseArgs(args) {
    const opts = { outputJson: null, outputMarkdown: null, updatedAfter: null }
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--output-json' && args[i + 1]) opts.outputJson = resolve(args[++i])
        else if (args[i] === '--output-markdown' && args[i + 1]) opts.outputMarkdown = resolve(args[++i])
        else if (args[i] === '--updated-after' && args[i + 1]) opts.updatedAfter = args[++i]
    }
    return opts
}

// ── 时间范围解析 ──────────────────────────────────────

function parseUpdatedAfter(raw) {
    if (!raw) {
        // 默认：最近 3 个月
        const d = new Date()
        d.setMonth(d.getMonth() - 3)
        return d
    }

    // 相对表达式：3months, 6months, 1year, 30days 等
    const relMatch = raw.match(/^(\d+)\s*(months?|month|years?|year|days?|day|weeks?|week)$/i)
    if (relMatch) {
        const n = parseInt(relMatch[1], 10)
        const unit = relMatch[2].toLowerCase()
        const d = new Date()
        switch (unit) {
            case 'year': case 'years': d.setFullYear(d.getFullYear() - n); break
            case 'months': case 'month': d.setMonth(d.getMonth() - n); break
            case 'weeks': case 'week': d.setDate(d.getDate() - n * 7); break
            case 'days': case 'day': d.setDate(d.getDate() - n); break
        }
        return d
    }

    // ISO / 日期字符串：2024-01-15, 2024-01-15T00:00:00Z 等
    const d = new Date(raw)
    if (!isNaN(d.getTime())) return d

    console.error(`[collect-multi-repo-alerts] Invalid --updated-after value: "${raw}", falling back to 3 months`)
    const fallback = new Date()
    fallback.setMonth(fallback.getMonth() - 3)
    return fallback
}

function formatDateFilter(threshold) {
    return threshold.toISOString().slice(0, 10)
}

// ── Octokit ───────────────────────────────────────────

function createOctokit() {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    if (!token) throw new Error('Missing GITHUB_TOKEN or GH_TOKEN environment variable')
    return new Octokit({ auth: token, request: { timeout: 15_000 } })
}

// ── 仓库拉取 ──────────────────────────────────────────

async function fetchAllUserRepos(octokit) {
    const repos = []
    let page = 1

    while (true) {
        const response = await octokit.request('GET /user/repos', {
            type: 'owner',
            sort: 'updated',
            per_page: REPO_PAGE_SIZE,
            page,
        })
        const data = response.data
        repos.push(...data)
        if (data.length < REPO_PAGE_SIZE) break
        page++
    }

    return repos.filter(
        (r) => !r.private && !r.fork && !r.archived && !r.disabled,
    )
}

// ── Alert 拉取（基于游标分页）────────────────────────

function extractNextCursor(linkHeader) {
    if (!linkHeader) return null
    const nextPart = linkHeader.split(',').find((p) => p.includes('rel="next"'))
    if (!nextPart) return null
    const match = nextPart.match(/<([^>]+)>/)
    if (!match) return null
    return new URL(match[1]).searchParams.get('after')
}

async function fetchRepoAlerts(octokit, owner, repo) {
    const alerts = []
    let after

    while (true) {
        const response = await octokit.request('GET /repos/{owner}/{repo}/dependabot/alerts', {
            owner,
            repo,
            state: 'open',
            per_page: ALERT_PAGE_SIZE,
            after,
            headers: {
                accept: 'application/vnd.github+json',
                'x-github-api-version': '2022-11-28',
            },
        })
        alerts.push(...response.data)

        const nextCursor = extractNextCursor(response.headers.link)
        if (!nextCursor) break
        after = nextCursor
    }

    return alerts
}

// ── 归一化 ────────────────────────────────────────────

function normalizeAlert(raw) {
    return {
        packageName:
            raw.dependency?.package?.name ||
            raw.security_vulnerability?.package?.name ||
            'unknown-package',
        severity: raw.security_vulnerability?.severity || 'unknown',
        patchedVersion: raw.security_vulnerability?.first_patched_version?.identifier || null,
        advisorySummary: raw.security_advisory?.summary || 'No summary',
        htmlUrl: raw.html_url || null,
    }
}

// ── 排序 ──────────────────────────────────────────────

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 }

function rankSeverity(s) {
    return SEVERITY_ORDER[s] ?? 4
}

function sortRepoBySeverity(a, b) {
    if (b.critical !== a.critical) return b.critical - a.critical
    if (b.high !== a.high) return b.high - a.high
    if (b.medium !== a.medium) return b.medium - a.medium
    return b.low - a.low
}

// ── Markdown 报告生成 ─────────────────────────────────

function escapeMd(text) {
    return String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function buildMarkdownReport(repoResults, severityCounts, filterInfo) {
    const lines = []
    lines.push('# Multi-Repo Security Alert Summary')
    lines.push('')
    lines.push(`- Generated at: ${new Date().toISOString()}`)
    lines.push(`- Updated-after filter: repos updated since ${filterInfo}`)
    lines.push(`- Repositories with open alerts: ${repoResults.length}`)
    lines.push(`- Total open alerts: ${severityCounts.critical + severityCounts.high + severityCounts.medium + severityCounts.low + severityCounts.unknown}`)
    lines.push('')
    lines.push('## Global Severity Distribution')
    lines.push('')
    lines.push('| Severity | Count |')
    lines.push('| --- | ---: |')
    for (const [sev, count] of Object.entries(severityCounts)) {
        lines.push(`| ${sev} | ${count} |`)
    }
    lines.push('')
    lines.push('## Repository Summary')
    lines.push('')
    lines.push('| Repository | Total | Critical | High | Medium | Low | Unknown |')
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |')

    for (const r of repoResults.sort(sortRepoBySeverity)) {
        lines.push(`| [${escapeMd(r.fullName)}](${r.htmlUrl}) | ${r.total} | ${r.critical} | ${r.high} | ${r.medium} | ${r.low} | ${r.unknown} |`)
    }

    lines.push('')
    lines.push('## Per-Repository Alert Details')
    lines.push('')

    for (const r of repoResults.sort(sortRepoBySeverity)) {
        lines.push(`### [${escapeMd(r.fullName)}](${r.htmlUrl}) — ${r.total} alerts`)
        lines.push('')
        lines.push('| Package | Severity | Patched Version | Advisory |')
        lines.push('| --- | --- | --- | --- |')
        for (const a of r.alerts.sort((a, b) => rankSeverity(a.severity) - rankSeverity(b.severity))) {
            lines.push(`| ${escapeMd(a.packageName)} | ${a.severity} | ${a.patchedVersion || '—'} | ${escapeMd(a.advisorySummary.slice(0, 80))} |`)
        }
        lines.push('')
    }

    return lines.join('\n')
}

// ── 入口 ──────────────────────────────────────────────

async function main() {
    const opts = parseArgs(process.argv.slice(2))
    const octokit = createOctokit()

    const updatedAfterThreshold = parseUpdatedAfter(opts.updatedAfter)
    console.error(`[collect-multi-repo-alerts] Updated-after filter: ${formatDateFilter(updatedAfterThreshold)}`)

    console.error('[collect-multi-repo-alerts] Fetching user repositories...')
    const allRepos = await fetchAllUserRepos(octokit)
    const repos = allRepos.filter((r) => new Date(r.updated_at) >= updatedAfterThreshold)
    console.error(`[collect-multi-repo-alerts] Filtered repos: ${repos.length} (of ${allRepos.length} total)`)

    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 }
    const repoResults = []

    for (const repo of repos) {
        const { owner, name, full_name, html_url, clone_url, default_branch } = repo
        console.error(`[collect-multi-repo-alerts] Fetching alerts for ${full_name}...`)

        try {
            const rawAlerts = await fetchRepoAlerts(octokit, owner.login, name)
            if (rawAlerts.length === 0) {
                console.error(`[collect-multi-repo-alerts]   → no open alerts, skipped`)
                continue
            }

            const alerts = rawAlerts.map(normalizeAlert)
            const sev = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 }
            for (const a of alerts) {
                const s = a.severity
                sev[s] = (sev[s] || 0) + 1
                severityCounts[s] = (severityCounts[s] || 0) + 1
            }

            repoResults.push({
                fullName: full_name,
                htmlUrl: html_url,
                cloneUrl: clone_url,
                defaultBranch: default_branch,
                total: alerts.length,
                ...sev,
                alerts,
            })

            console.error(`[collect-multi-repo-alerts]   → ${alerts.length} alerts (c:${sev.critical} h:${sev.high} m:${sev.medium} l:${sev.low})`)
        } catch (err) {
            const reason = err.status ? `HTTP ${err.status}` : err.message
            console.error(`[collect-multi-repo-alerts]   → FAILED: ${reason}`)
        }
    }

    const totalAlerts = repoResults.reduce((sum, r) => sum + r.total, 0)

    const output = { generatedAt: new Date().toISOString(), totalAlerts, severityCounts, repos: repoResults }

    // 输出 JSON
    if (opts.outputJson) {
        writeFileSync(opts.outputJson, JSON.stringify(output, null, 2), 'utf8')
        console.error(`[collect-multi-repo-alerts] JSON written to ${opts.outputJson}`)
    } else {
        console.log(JSON.stringify(output, null, 2))
    }

    // 输出 Markdown
    if (opts.outputMarkdown) {
        const md = buildMarkdownReport(repoResults, severityCounts, formatDateFilter(updatedAfterThreshold))
        writeFileSync(opts.outputMarkdown, md, 'utf8')
        console.error(`[collect-multi-repo-alerts] Markdown written to ${opts.outputMarkdown}`)
    }

    // 退出码：有 critical 告警时返回 2，方便 CI 感知
    if (severityCounts.critical > 0) {
        console.error(`[collect-multi-repo-alerts] ⚠️  ${severityCounts.critical} critical alerts found`)
        process.exitCode = 2
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
