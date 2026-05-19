import { cacheHas, cacheGet, cacheSet } from './cache.js'
import type { FetchPlan, FetchedContent } from './types.js'

async function main(): Promise<void> {
  const urlsJson = process.env.SUPER_SEARCH_URLS
  if (!urlsJson) {
    console.log(JSON.stringify({
      phase: 'fetch',
      status: 'pending',
      instruction: {
        action: 'FETCH_INPUT',
        description: '请提供需要抓取的 URL 列表（JSON 数组），通过环境变量 SUPER_SEARCH_URLS 传入'
      }
    }, null, 2))
    return
  }

  let urls: string[]
  try {
    urls = JSON.parse(urlsJson)
  } catch {
    console.error('Invalid JSON in SUPER_SEARCH_URLS')
    process.exit(1)
  }

  const cachedUrls: { url: string; content: unknown }[] = []
  const urlsToFetch: string[] = []
  const skipReasons: Record<string, string> = {}

  for (const url of urls) {
    const hasCached = await cacheHas(url, 'fetch')
    if (hasCached) {
      const cached = await cacheGet(url, 'fetch')
      cachedUrls.push({ url, content: cached })
    } else {
      urlsToFetch.push(url)
    }
  }

  const plan: FetchPlan = {
    urlsToFetch,
    cachedUrls: cachedUrls.map(c => c.url),
    skipReasons: Object.keys(skipReasons).length > 0 ? skipReasons : undefined
  }

  console.log(JSON.stringify({
    phase: 'fetch',
    status: 'ready',
    plan,
    cachedContent: cachedUrls,
    instruction: {
      action: 'FETCH',
      description: `需要抓取 ${urlsToFetch.length} 个 URL（${cachedUrls.length} 个已缓存）`,
      urlsToFetch,
      note: '对 urlsToFetch 中的每个 URL 使用可用的 fetch 工具抓取内容。抓取后将原始内容通过 SUPER_SEARCH_FETCHED 环境变量传入下一阶段。同时将结果存入缓存。',
      cacheInstruction: '每个 URL 抓取成功后，调用 cache.mjs 的 cacheSet 方法保存。fetch 类型默认 TTL 为 24 小时。'
    }
  }, null, 2))
}

main()
