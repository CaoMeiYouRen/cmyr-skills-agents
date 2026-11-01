#!/usr/bin/env node
/**
 * 能力台账扫描：读取 capabilities/registry.json，检查各项目是否已落地某个能力。
 *
 * 判定规则：能力的所有 required 标记组都要命中；optional 组只记证据。
 * 只做「有没有 / 在哪」的判定，不做代码比对。
 *
 * 用法：
 *   node scripts/check-capabilities.mjs --projects /path/a,/path/b [--json]
 * 退出码：0 成功；2 参数错误或项目目录不存在；1 运行时错误。
 * 导出 scanCapabilities / detectCapabilities 纯函数便于单测。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REGISTRY_FILE = path.join('capabilities', 'registry.json')

function readText(filePath) {
    try {
        return readFileSync(filePath, 'utf8')
    } catch {
        return ''
    }
}

/**
 * 只读「规则会被加载」的位置：AGENTS / README / docs/standards。
 * 不读 .github/agents 与 .github/skills——那里的提及不等于项目已采纳规则。
 */
function readProjectText(projectPath) {
    const parts = [readText(path.join(projectPath, 'AGENTS.md')), readText(path.join(projectPath, 'README.md'))]
    const standardsDir = path.join(projectPath, 'docs', 'standards')
    if (existsSync(standardsDir)) {
        for (const entry of readdirSync(standardsDir)) {
            if (entry.endsWith('.md')) {
                parts.push(readText(path.join(standardsDir, entry)))
            }
        }
    }
    return parts.join('\n')
}

function readScriptNames(projectPath) {
    try {
        const pkg = JSON.parse(readFileSync(path.join(projectPath, 'package.json'), 'utf8'))
        return new Set(Object.keys(pkg.scripts ?? {}))
    } catch {
        return new Set()
    }
}

function evaluateMarker(marker, context) {
    const hits = []
    const { kind, values = [] } = marker
    if (kind === 'scripts') {
        for (const value of values) {
            if (context.scripts.has(value)) {
                hits.push(`script:${value}`)
                if (marker.param) {
                    context.params[marker.param] ??= value
                }
            }
        }
    } else if (kind === 'files') {
        for (const value of values) {
            if (existsSync(path.join(context.projectPath, value))) {
                hits.push(`file:${value}`)
                if (marker.param) {
                    context.params[marker.param] ??= value
                }
            }
        }
    } else if (kind === 'text') {
        for (const value of values) {
            if (context.text.includes(value)) {
                hits.push(`text:${value}`)
            }
        }
    }
    return hits
}

/** 扫描单个项目，返回 { capabilityId: { present, evidence, params, missing } } */
export function detectCapabilities(projectPath, registry) {
    const text = readProjectText(projectPath)
    const scripts = readScriptNames(projectPath)
    const result = {}
    for (const capability of registry.capabilities ?? []) {
        const evidence = []
        const params = {}
        const missing = []
        const context = { projectPath, text, scripts, params }
        const requiredCount = (capability.markers ?? []).filter((marker) => marker.required).length
        for (const marker of capability.markers ?? []) {
            const hits = evaluateMarker(marker, context)
            evidence.push(...hits)
            if (hits.length === 0 && marker.required) {
                missing.push(marker.kind)
            }
        }
        result[capability.id] = { present: requiredCount > 0 && missing.length === 0, evidence, params, missing }
    }
    return result
}

export function scanCapabilities(registry, projectDirs) {
    return projectDirs.map((dir) => ({
        project: path.basename(dir),
        directory: dir,
        capabilities: detectCapabilities(dir, registry),
    }))
}

export function validateRegistry(registry) {
    if (!Array.isArray(registry?.capabilities)) {
        throw new Error('registry 缺少 capabilities 数组')
    }
    const ids = new Set()
    for (const capability of registry.capabilities) {
        if (!capability.id) {
            throw new Error('capability 缺少 id')
        }
        if (ids.has(capability.id)) {
            throw new Error(`capability id 重复: ${capability.id}`)
        }
        ids.add(capability.id)
        if (!Array.isArray(capability.markers) || capability.markers.length === 0) {
            throw new Error(`${capability.id} 缺少 markers`)
        }
        for (const marker of capability.markers) {
            if (!['scripts', 'files', 'text'].includes(marker.kind)) {
                throw new Error(`${capability.id} 的 marker.kind 非法: ${marker.kind}`)
            }
            if (!Array.isArray(marker.values) || marker.values.length === 0) {
                throw new Error(`${capability.id} 的 marker.values 为空`)
            }
        }
        if (!capability.markers.some((marker) => marker.required)) {
            throw new Error(`${capability.id} 至少需要一个 required 标记`)
        }
    }
    return registry
}

function parseArgs(argv) {
    const options = { projects: [], json: false }
    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index]
        if (arg === '--projects') {
            options.projects = (argv[index + 1] ?? '').split(',').filter(Boolean)
            index++
        } else if (arg.startsWith('--projects=')) {
            options.projects = arg.slice('--projects='.length).split(',').filter(Boolean)
        } else if (arg === '--json') {
            options.json = true
        } else if (arg === '--help' || arg === '-h') {
            console.info('用法：node scripts/check-capabilities.mjs --projects /path/a,/path/b [--json]')
            process.exit(0)
        }
    }
    return options
}

function isExecutedDirectly(metaUrl) {
    return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(metaUrl)
}

if (isExecutedDirectly(import.meta.url)) {
    const options = parseArgs(process.argv.slice(2))
    if (options.projects.length === 0) {
        console.error('用法：node scripts/check-capabilities.mjs --projects /path/a,/path/b [--json]')
        process.exit(2)
    }
    const missingDirs = options.projects.filter((dir) => !existsSync(dir))
    if (missingDirs.length > 0) {
        console.error(`项目目录不存在：${missingDirs.join(', ')}`)
        process.exit(2)
    }

    let registry
    try {
        registry = validateRegistry(JSON.parse(readFileSync(REGISTRY_FILE, 'utf8')))
    } catch (error) {
        console.error(`无法读取能力台账：${error.message}`)
        process.exit(1)
    }

    const rows = scanCapabilities(registry, options.projects)
    if (options.json) {
        console.info(JSON.stringify({ registryVersion: registry.version, rows }, null, 2))
    } else {
        const ids = registry.capabilities.map((capability) => capability.id)
        console.info(['能力'.padEnd(28), ...rows.map((row) => row.project.padEnd(14))].join(' '))
        for (const id of ids) {
            const cells = rows.map((row) => {
                const hit = row.capabilities[id]
                const label = hit.present ? `✅ ${hit.evidence.length}` : `— (缺 ${hit.missing.join('/')})`
                return label.padEnd(14)
            })
            console.info([id.padEnd(28), ...cells].join(' '))
        }
        for (const row of rows) {
            const params = Object.entries(row.capabilities)
                .flatMap(([id, hit]) => Object.entries(hit.params).map(([key, value]) => `${id}.${key}=${value}`))
            if (params.length > 0) {
                console.info(`\n${row.project}: ${params.join(', ')}`)
            }
        }
    }
}
