import type { SearchPlan } from './types.js'

function parseArgs(): { topic: string; depth: 'quick' | 'normal' | 'deep' } {
  const args = process.argv.slice(2)
  let topic = ''
  let depth: 'quick' | 'normal' | 'deep' = 'normal'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--topic' && args[i + 1]) {
      topic = args[i + 1]
      i++
    } else if (args[i] === '--depth' && args[i + 1]) {
      const d = args[i + 1]
      if (d === 'quick' || d === 'normal' || d === 'deep') {
        depth = d
      }
      i++
    }
  }

  if (!topic) {
    console.error('Usage: node search.mjs --topic "search keywords" --depth quick|normal|deep')
    process.exit(1)
  }

  return { topic, depth }
}

function generateQueries(topic: string, depth: 'quick' | 'normal' | 'deep'): string[] {
  const baseQueries = [topic]

  const perspectiveQueries = [
    `${topic} 最新`,
    `${topic} 观点`,
    `${topic} 分析`,
    `${topic} 数据`,
    `${topic} 官方`,
  ]

  const counterQueries = [
    `反对 ${topic}`,
    `${topic} 批评`,
    `${topic} 争议`,
    `${topic} 质疑`,
    `${topic} 局限性`,
  ]

  let queries: string[]

  switch (depth) {
    case 'quick':
      queries = [...baseQueries, ...perspectiveQueries.slice(0, 2)]
      break
    case 'deep':
      queries = [...baseQueries, ...perspectiveQueries, ...counterQueries]
      break
    case 'normal':
    default:
      queries = [...baseQueries, ...perspectiveQueries.slice(0, 3), ...counterQueries.slice(0, 2)]
      break
  }

  return [...new Set(queries)]
}

function main(): void {
  const { topic, depth } = parseArgs()

  const queries = generateQueries(topic, depth)
  const counterQueries = generateQueries(topic, depth).filter(q =>
    q.includes('反对') || q.includes('批评') || q.includes('争议') || q.includes('质疑') || q.includes('局限性')
  )

  const targetSourceCount = {
    quick: 5,
    normal: 12,
    deep: 20
  }[depth]

  const plan: SearchPlan = {
    topic,
    depth,
    queries,
    counterQueries,
    targetSourceCount
  }

  console.log(JSON.stringify({
    phase: 'search',
    status: 'ready',
    plan,
    instruction: {
      action: 'SEARCH',
      description: `对以下 ${queries.length} 个查询执行搜索，每个查询取前 ${depth === 'quick' ? 3 : depth === 'deep' ? 8 : 5} 条结果`,
      queries,
      targetSourceCount,
      note: '收集所有搜索结果的 URL，去重后传递给 fetch 阶段。优先保留来自官方、权威媒体的结果。'
    }
  }, null, 2))
}

main()
