import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import type { CacheIndex, CacheEntry } from './types.js'

const DEFAULT_CACHE_DIR = join(homedir(), '.super-search-cache')
const CACHE_INDEX_FILE = 'index.json'
const CACHE_VERSION = 1

const DEFAULT_TTL: Record<string, number> = {
  search: 30 * 60 * 1000,
  fetch: 24 * 60 * 60 * 1000
}

function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16)
}

function getCacheDir(): string {
  const idx = process.argv.indexOf('--cache-dir')
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1]
  }
  return process.env.SUPER_SEARCH_CACHE_DIR || DEFAULT_CACHE_DIR
}

async function ensureCacheDir(dir: string): Promise<void> {
  try {
    await access(dir)
  } catch {
    await mkdir(dir, { recursive: true })
  }
}

async function loadIndex(dir: string): Promise<CacheIndex> {
  try {
    const raw = await readFile(join(dir, CACHE_INDEX_FILE), 'utf-8')
    const index: CacheIndex = JSON.parse(raw)
    if (index.version !== CACHE_VERSION) {
      return { version: CACHE_VERSION, entries: {} }
    }
    return index
  } catch {
    return { version: CACHE_VERSION, entries: {} }
  }
}

async function saveIndex(dir: string, index: CacheIndex): Promise<void> {
  await writeFile(join(dir, CACHE_INDEX_FILE), JSON.stringify(index, null, 2))
}

function isExpired(entry: CacheEntry, now: number): boolean {
  return now - entry.timestamp > entry.ttl
}

export async function cacheGet(url: string, type: 'search' | 'fetch'): Promise<unknown | null> {
  const dir = getCacheDir()
  await ensureCacheDir(dir)
  const index = await loadIndex(dir)
  const key = hashUrl(url)
  const entry = index.entries[key]

  if (entry && !isExpired(entry, Date.now()) && entry.type === type) {
    return entry.data
  }

  return null
}

export async function cacheSet(url: string, type: 'search' | 'fetch', data: unknown, ttl?: number): Promise<void> {
  const dir = getCacheDir()
  await ensureCacheDir(dir)
  const index = await loadIndex(dir)
  const key = hashUrl(url)

  index.entries[key] = {
    url,
    type,
    data,
    timestamp: Date.now(),
    ttl: ttl ?? DEFAULT_TTL[type]
  }

  await saveIndex(dir, index)
}

export async function cacheHas(url: string, type: 'search' | 'fetch'): Promise<boolean> {
  const dir = getCacheDir()
  await ensureCacheDir(dir)
  const index = await loadIndex(dir)
  const key = hashUrl(url)
  const entry = index.entries[key]

  if (entry && !isExpired(entry, Date.now()) && entry.type === type) {
    return true
  }

  return false
}

export async function cachePurgeExpired(): Promise<number> {
  const dir = getCacheDir()
  await ensureCacheDir(dir)
  const index = await loadIndex(dir)
  const now = Date.now()
  let purged = 0

  for (const [key, entry] of Object.entries(index.entries)) {
    if (isExpired(entry, now)) {
      delete index.entries[key]
      purged++
    }
  }

  if (purged > 0) {
    await saveIndex(dir, index)
  }

  return purged
}

export async function getCacheStats(): Promise<{ totalEntries: number; searchEntries: number; fetchEntries: number; cacheDir: string }> {
  const dir = getCacheDir()
  await ensureCacheDir(dir)
  const index = await loadIndex(dir)

  let searchEntries = 0
  let fetchEntries = 0

  for (const entry of Object.values(index.entries)) {
    if (!isExpired(entry, Date.now())) {
      if (entry.type === 'search') searchEntries++
      else fetchEntries++
    }
  }

  return {
    totalEntries: searchEntries + fetchEntries,
    searchEntries,
    fetchEntries,
    cacheDir: dir
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command) {
    const stats = await getCacheStats()
    console.log(JSON.stringify(stats, null, 2))
    return
  }

  switch (command) {
    case 'set': {
      const urlIdx = args.indexOf('--url')
      const typeIdx = args.indexOf('--type')
      const dataIdx = args.indexOf('--data')
      const ttlIdx = args.indexOf('--ttl')

      if (urlIdx === -1 || typeIdx === -1 || dataIdx === -1) {
        console.error('Usage: node cache.mjs set --url "..." --type fetch|search --data \'{"...":"..."}\' [--ttl 86400000]')
        console.error('       echo \'{"...":"..."}\' | node cache.mjs set --url "..." --type fetch --data -')
        process.exit(1)
      }

      const url = args[urlIdx + 1]
      const type = args[typeIdx + 1] as 'fetch' | 'search'

      let data: unknown
      if (args[dataIdx + 1] === '-') {
        const chunks: Buffer[] = []
        for await (const chunk of process.stdin) {
          chunks.push(Buffer.from(chunk))
        }
        data = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
      } else {
        data = JSON.parse(args[dataIdx + 1])
      }

      const ttl = ttlIdx !== -1 ? parseInt(args[ttlIdx + 1]) : undefined
      const resolvedTTL = ttl || (type === 'fetch' ? 86400000 : 1800000)
      await cacheSet(url, type, data, resolvedTTL)
      console.log(JSON.stringify({ status: 'cached', url, type, ttl: resolvedTTL }))
      break
    }

    case 'get': {
      const urlIdx = args.indexOf('--url')
      const typeIdx = args.indexOf('--type')

      if (urlIdx === -1 || typeIdx === -1) {
        console.error('Usage: node cache.mjs get --url "..." --type fetch|search')
        process.exit(1)
      }

      const url = args[urlIdx + 1]
      const type = args[typeIdx + 1] as 'fetch' | 'search'
      const result = await cacheGet(url, type)
      console.log(JSON.stringify({ hit: result !== null, url, type, data: result }))
      break
    }

    case 'has': {
      const urlIdx = args.indexOf('--url')
      const typeIdx = args.indexOf('--type')

      if (urlIdx === -1 || typeIdx === -1) {
        console.error('Usage: node cache.mjs has --url "..." --type fetch|search')
        process.exit(1)
      }

      const url = args[urlIdx + 1]
      const type = args[typeIdx + 1] as 'fetch' | 'search'
      const exists = await cacheHas(url, type)
      console.log(JSON.stringify({ exists, url, type }))
      break
    }

    case 'purge': {
      const purged = await cachePurgeExpired()
      console.log(JSON.stringify({ status: 'purged', expiredEntriesRemoved: purged }))
      break
    }

    case 'stats': {
      const stats = await getCacheStats()
      console.log(JSON.stringify(stats, null, 2))
      break
    }

    default:
      console.error(`Unknown command: ${command}`)
      console.error('Available: set, get, has, purge, stats')
      process.exit(1)
  }
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url)
if (isDirectExecution) {
  main()
}
