#!/usr/bin/env node

/**
 * sync-skills.mjs
 *
 * 将项目 skills/ 目录下的技能增量同步到全局技能目录。
 * 只同步有更新（文件较新）或新增的技能，不删除目标目录中已有的其他文件。
 *
 * 用法：
 *   node scripts/sync-skills.mjs [--target <path>] [--dry-run] [--force]
 *
 * 参数：
 *   --target <path>   手动指定全局技能目录（覆盖自动发现）
 *   --dry-run          仅预览将要同步的内容，不实际复制
 *   --force            忽略时间比较，强制覆盖所有技能
 */

import { readdirSync, statSync, existsSync, mkdirSync, cpSync } from 'node:fs'
import { resolve, relative, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

// ── 参数解析 ──────────────────────────────────────────

function parseArgs(args) {
    const opts = { target: null, dryRun: false, force: false }
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--target': case '-t': opts.target = args[++i]; break
            case '--dry-run': case '-n': opts.dryRun = true; break
            case '--force': case '-f': opts.force = true; break
            case '--help': case '-h': printHelp(); process.exit(0)
        }
    }
    return opts
}

function printHelp() {
    console.log(`
sync-skills.mjs — 增量同步项目技能到全局技能目录

用法:
  node scripts/sync-skills.mjs [options]

选项:
  --target, -t <path>  手动指定目标目录（默认自动发现）
  --dry-run, -n        预览模式，不实际复制文件
  --force, -f          强制覆盖，忽略文件时间比较
  --help, -h           显示帮助信息

自动发现顺序:
  1. ~/.copilot/skills
  2. ~/.claude/skills
  3. ~/.config/opencode/skills
  4. 若均不存在，提示用户通过 --target 指定
`.trim())
}

// ── 自动发现目标目录 ──────────────────────────────────

function discoverTargetDir() {
    const home = homedir()
    const candidates = [
        join(home, '.copilot', 'skills'),
        join(home, '.claude', 'skills'),
        join(home, '.config', 'opencode', 'skills'),
    ]

    for (const dir of candidates) {
        if (existsSync(dir)) {
            return dir
        }
    }

    return null
}

// ── 被忽略的目录 ──────────────────────────────────────

const IGNORED_DIRS = new Set(['research-output'])

// ── 收集技能目录 ──────────────────────────────────────

function collectSourceSkills(sourceDir) {
    const entries = readdirSync(sourceDir, { withFileTypes: true })
    return entries
        .filter((e) => e.isDirectory() && !IGNORED_DIRS.has(e.name))
        .map((e) => {
            const skillDir = join(sourceDir, e.name)
            const skillMd = join(skillDir, 'SKILL.md')
            return {
                name: e.name,
                dir: skillDir,
                hasSkillMd: existsSync(skillMd),
            }
        })
        .filter((s) => s.hasSkillMd)
}

// ── 文件时间比较 ──────────────────────────────────────

function collectFileTimestamps(dir) {
    /** @type {Map<string, number>} */
    const map = new Map()
    walkDir(dir, (filePath) => {
        const rel = relative(dir, filePath)
        map.set(rel, statSync(filePath).mtimeMs)
    })
    return map
}

function walkDir(dir, callback) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) continue
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
            walkDir(fullPath, callback)
        } else {
            callback(fullPath)
        }
    }
}

// ── 技能需要同步? ─────────────────────────────────────

function needsSync(sourceDir, targetDir, force) {
    if (force) return { reason: 'forced' }

    if (!existsSync(targetDir)) {
        return { reason: 'new-skill' }
    }

    const sourceTimes = collectFileTimestamps(sourceDir)
    const targetTimes = collectFileTimestamps(targetDir)

    const changedFiles = []

    for (const [relPath, srcMtime] of sourceTimes) {
        const tgtMtime = targetTimes.get(relPath)
        if (tgtMtime === undefined) {
            changedFiles.push({ path: relPath, reason: 'new-file' })
        } else if (srcMtime > tgtMtime) {
            changedFiles.push({ path: relPath, reason: 'newer' })
        }
    }

    if (changedFiles.length > 0) {
        return { reason: 'changed', changedFiles }
    }

    return null
}

// ── 同步单个技能 ──────────────────────────────────────

function syncSkill(skillName, sourceDir, targetDir, opts) {
    const result = needsSync(sourceDir, join(targetDir, skillName), opts.force)

    if (!result) {
        return { name: skillName, status: 'skipped', reason: 'up-to-date' }
    }

    if (opts.dryRun) {
        return {
            name: skillName,
            status: 'would-sync',
            reason: result.reason,
            changedFiles: result.changedFiles,
        }
    }

    try {
        const dest = join(targetDir, skillName)
        mkdirSync(dest, { recursive: true })
        cpSync(sourceDir, dest, { recursive: true, force: true })
        return { name: skillName, status: 'synced', reason: result.reason }
    } catch (err) {
        return { name: skillName, status: 'error', reason: err.message }
    }
}

// ── 入口 ──────────────────────────────────────────────

function main() {
    const opts = parseArgs(process.argv.slice(2))

    // 确定来源目录
    const scriptDir = dirname(fileURLToPath(import.meta.url))
    const projectRoot = resolve(scriptDir, '..')
    const sourceDir = join(projectRoot, 'skills')

    if (!existsSync(sourceDir)) {
        console.error(`[sync-skills] Source directory not found: ${sourceDir}`)
        process.exit(1)
    }

    // 确定目标目录
    const targetDir = opts.target || discoverTargetDir()

    if (!targetDir) {
        console.error('[sync-skills] Could not auto-discover a global skills directory.')
        console.error('[sync-skills] Please specify one with --target <path>.')
        console.error('[sync-skills] Candidates checked: ~/.copilot/skills, ~/.claude/skills, ~/.config/opencode/skills')
        process.exit(1)
    }

    if (!existsSync(targetDir)) {
        console.error(`[sync-skills] Target directory does not exist: ${targetDir}`)
        console.error('[sync-skills] Create it first or specify a different path with --target.')
        process.exit(1)
    }

    console.error(`[sync-skills] Source: ${sourceDir}`)
    console.error(`[sync-skills] Target: ${targetDir}`)
    if (opts.dryRun) console.error('[sync-skills] Mode: dry-run (preview only)')
    if (opts.force) console.error('[sync-skills] Mode: force (ignore timestamps)')
    console.error('')

    // 收集源技能
    const skills = collectSourceSkills(sourceDir)
    console.error(`[sync-skills] Found ${skills.length} skills in source\n`)

    // 逐技能同步
    const results = []
    let syncedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const skill of skills) {
        const result = syncSkill(skill.name, skill.dir, targetDir, opts)
        results.push(result)

        switch (result.status) {
            case 'synced':
                syncedCount++
                console.error(`  ✓ ${skill.name} — ${result.reason}`)
                break
            case 'would-sync':
                syncedCount++
                console.error(`  ○ ${skill.name} — would sync (${result.reason})`)
                if (result.changedFiles) {
                    for (const f of result.changedFiles) {
                        console.error(`      ${f.reason}: ${f.path}`)
                    }
                }
                break
            case 'skipped':
                skippedCount++
                break
            case 'error':
                errorCount++
                console.error(`  ✗ ${skill.name} — ERROR: ${result.reason}`)
                break
        }
    }

    console.error(`\n[sync-skills] Done: ${syncedCount} synced/would-sync, ${skippedCount} skipped, ${errorCount} errors`)

    if (errorCount > 0) process.exitCode = 1
}

main()
