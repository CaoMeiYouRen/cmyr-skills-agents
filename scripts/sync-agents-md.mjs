#!/usr/bin/env node

/**
 * sync-agents-md.mjs
 *
 * 将 global/AGENTS.md 同步到各 AI 工具的全局配置目录。
 * 支持自动发现目标目录，也支持手动指定。
 *
 * 用法：
 *   node scripts/sync-agents-md.mjs [--target <path>] [--dry-run] [--force]
 *
 * 参数：
 *   --target <path>   手动指定目标文件（覆盖自动发现）
 *   --dry-run          仅预览将要同步的内容，不实际复制
 *   --force            忽略时间比较，强制覆盖
 */

import { existsSync, cpSync, statSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
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
sync-agents-md.mjs — 将全局 AGENTS.md 同步到各 AI 工具配置目录

用法:
  node scripts/sync-agents-md.mjs [options]

选项:
  --target, -t <path>  手动指定目标文件路径（默认同步到所有已发现的目录）
  --dry-run, -n        预览模式，不实际复制文件
  --force, -f          强制覆盖，忽略文件时间比较
  --help, -h           显示帮助信息

自动发现的目标:
  1. ~/.claude/CLAUDE.md
  2. ~/.config/opencode/AGENTS.md
  3. ~/.copilot/AGENTS.md
  4. ~/.cursorrules
`.trim())
}

// ── 自动发现目标 ──────────────────────────────────────

function discoverTargets() {
    const home = homedir()
    return [
        { path: join(home, '.claude', 'CLAUDE.md'), label: 'Claude Code' },
        { path: join(home, '.config', 'opencode', 'AGENTS.md'), label: 'OpenCode' },
        { path: join(home, '.copilot', 'AGENTS.md'), label: 'GitHub Copilot' },
        { path: join(home, '.cursorrules'), label: 'Cursor' },
    ]
}

// ── 文件是否需要更新 ──────────────────────────────────

function needsUpdate(sourceFile, targetFile, force) {
    if (force) return true
    if (!existsSync(targetFile)) return true

    const srcTime = statSync(sourceFile).mtimeMs
    const tgtTime = statSync(targetFile).mtimeMs
    return srcTime > tgtTime
}

// ── 同步单个目标 ──────────────────────────────────────

function syncToTarget(sourceFile, target, opts) {
    const targetFile = target.path

    if (!needsUpdate(sourceFile, targetFile, opts.force)) {
        return { ...target, status: 'skipped', reason: 'up-to-date' }
    }

    if (!existsSync(targetFile) && !existsSync(dirname(targetFile))) {
        // 目标目录不存在，跳过（不像 sync-skills 那样自动创建，避免污染用户 home）
        return { ...target, status: 'skipped', reason: 'target-dir-missing' }
    }

    if (opts.dryRun) {
        const reason = !existsSync(targetFile) ? 'new-file' : 'newer'
        return { ...target, status: 'would-sync', reason }
    }

    try {
        cpSync(sourceFile, targetFile, { force: true })
        return { ...target, status: 'synced' }
    } catch (err) {
        return { ...target, status: 'error', reason: err.message }
    }
}

// ── 入口 ──────────────────────────────────────────────

function main() {
    const opts = parseArgs(process.argv.slice(2))

    // 确定来源文件
    const scriptDir = dirname(fileURLToPath(import.meta.url))
    const projectRoot = resolve(scriptDir, '..')
    const sourceFile = join(projectRoot, 'global', 'AGENTS.md')

    if (!existsSync(sourceFile)) {
        console.error(`[sync-agents-md] Source file not found: ${sourceFile}`)
        process.exit(1)
    }

    console.error(`[sync-agents-md] Source: ${sourceFile}`)
    if (opts.dryRun) console.error('[sync-agents-md] Mode: dry-run (preview only)')
    if (opts.force) console.error('[sync-agents-md] Mode: force (ignore timestamps)')
    console.error('')

    // 确定目标
    let targets
    if (opts.target) {
        targets = [{ path: resolve(opts.target), label: 'manual' }]
    } else {
        targets = discoverTargets()
    }

    // 逐目标同步
    let syncedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const target of targets) {
        const result = syncToTarget(sourceFile, target, opts)

        switch (result.status) {
            case 'synced':
                syncedCount++
                console.error(`  ✓ ${result.label} — synced to ${result.path}`)
                break
            case 'would-sync':
                syncedCount++
                console.error(`  ○ ${result.label} — would sync (${result.reason}) → ${result.path}`)
                break
            case 'skipped':
                skippedCount++
                if (result.reason === 'target-dir-missing') {
                    console.error(`  - ${result.label} — skipped (target dir missing): ${result.path}`)
                }
                break
            case 'error':
                errorCount++
                console.error(`  ✗ ${result.label} — ERROR: ${result.reason}`)
                break
        }
    }

    console.error(`\n[sync-agents-md] Done: ${syncedCount} synced/would-sync, ${skippedCount} skipped, ${errorCount} errors`)

    if (errorCount > 0) process.exitCode = 1
}

main()
