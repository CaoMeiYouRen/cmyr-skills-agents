import { mkdir, lstat, realpath, symlink } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

// 权威源：agents/、skills/、AGENTS.md（顶层目录），映射到常见 AI 助手配置目录
const dirLinkMappings = [
    { linkRelPath: '.github/agents', targetRelPath: 'agents' },
    { linkRelPath: '.github/skills', targetRelPath: 'skills' },
    { linkRelPath: '.claude/agents', targetRelPath: 'agents' },
    { linkRelPath: '.claude/skills', targetRelPath: 'skills' },
    { linkRelPath: '.agents/agents', targetRelPath: 'agents' },
    { linkRelPath: '.agents/skills', targetRelPath: 'skills' },
    { linkRelPath: '.opencode/agents', targetRelPath: 'agents' },
    { linkRelPath: '.opencode/skills', targetRelPath: 'skills' },
]

const fileLinkMappings = [
    { linkRelPath: 'CLAUDE.md', targetRelPath: 'AGENTS.md' },
]

function runGitWorktreeList() {
    return new Promise((resolve, reject) => {
        const child = spawn('git', ['worktree', 'list', '--porcelain'], {
            cwd: repoRoot,
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (chunk) => {
            stdout += chunk
        })

        child.stderr.on('data', (chunk) => {
            stderr += chunk
        })

        child.on('error', reject)
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr.trim() || `git worktree list failed with exit code ${code}`))
                return
            }

            const worktrees = stdout
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.startsWith('worktree '))
                .map((line) => line.slice('worktree '.length).trim())

            resolve(worktrees)
        })
    })
}

function toSymlinkTarget(linkPath, targetPath, isDir) {
    if (process.platform === 'win32' && isDir) {
        return targetPath
    }

    return path.relative(path.dirname(linkPath), targetPath)
}

async function ensureSymlink(linkPath, targetPath, isDir) {
    await mkdir(path.dirname(linkPath), { recursive: true })

    try {
        const existing = await lstat(linkPath)
        if (!existing.isSymbolicLink() && !existing.isDirectory()) {
            console.warn(`  跳过: ${path.relative(repoRoot, linkPath)} 已存在且不是链接`)
            return
        }

        const resolvedLink = await realpath(linkPath)
        const resolvedTarget = await realpath(targetPath)
        if (resolvedLink === resolvedTarget) {
            console.info(`  已存在: ${path.relative(repoRoot, linkPath)}`)
            return
        }

        console.warn(`  跳过: ${path.relative(repoRoot, linkPath)} 已指向其他目标`)
        return
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            throw error
        }
    }

    const symlinkType = isDir
        ? (process.platform === 'win32' ? 'junction' : 'dir')
        : 'file'
    const symlinkTarget = toSymlinkTarget(linkPath, targetPath, isDir)
    await symlink(symlinkTarget, linkPath, symlinkType)
    console.info(`  创建: ${path.relative(repoRoot, linkPath)} -> ${path.relative(repoRoot, targetPath)}`)
}

async function syncWorktree(worktree) {
    console.info(`\n处理工作树: ${worktree}`)

    for (const mapping of dirLinkMappings) {
        const linkPath = path.join(worktree, mapping.linkRelPath)
        const targetPath = path.join(worktree, mapping.targetRelPath)
        await ensureSymlink(linkPath, targetPath, true)
    }

    for (const mapping of fileLinkMappings) {
        const linkPath = path.join(worktree, mapping.linkRelPath)
        const targetPath = path.join(worktree, mapping.targetRelPath)
        await ensureSymlink(linkPath, targetPath, false)
    }
}

async function main() {
    const worktrees = await runGitWorktreeList()

    console.info(`发现 ${worktrees.length} 个工作树，开始同步...`)

    for (const worktree of worktrees) {
        await syncWorktree(worktree)
    }

    console.info('\n所有工作树同步完成！')
}

main().catch((error) => {
    console.error(error?.message || error)
    process.exit(1)
})
