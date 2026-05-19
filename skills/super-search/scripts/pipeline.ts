import { getCacheStats, cachePurgeExpired } from './cache.js'

interface PipelineArgs {
  topic?: string
  depth: 'quick' | 'normal' | 'deep'
  output?: string
  cacheDir?: string
  forceReview: boolean
  action: 'full' | 'env-check' | 'search' | 'fetch' | 'analyze' | 'review' | 'report'
}

function parseArgs(): PipelineArgs {
  const args = process.argv.slice(2)
  const result: PipelineArgs = {
    depth: 'normal',
    forceReview: false,
    action: 'full'
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--topic':
      case '-t':
        result.topic = args[++i]
        break
      case '--depth':
      case '-d':
        result.depth = (args[++i] as PipelineArgs['depth']) || 'normal'
        break
      case '--output':
      case '-o':
        result.output = args[++i]
        break
      case '--cache-dir':
        result.cacheDir = args[++i]
        break
      case '--force-review':
        result.forceReview = true
        break
      case '--action':
        result.action = args[++i] as PipelineArgs['action']
        break
    }
  }

  return result
}

interface StageDescriptor {
  phase: string
  instruction: string
  description: string
  required: boolean
}

async function main(): Promise<void> {
  const args = parseArgs()

  const stageOrder = [
    'env-check',
    'search',
    'fetch',
    'analyze',
    'review',
    'report'
  ]

  const stages: Record<string, StageDescriptor> = {
    'env-check': {
      phase: 'env-check',
      instruction: 'Run: npx tsx scripts/env-check.ts',
      description: '验证环境中可用的 search/fetch 工具。如果没有任何工具可用则立即中断。',
      required: true
    },
    'search': {
      phase: 'search',
      instruction: `Run: npx tsx scripts/search.ts --topic "${args.topic || 'TBD'}" --depth ${args.depth}`,
      description: '生成搜索计划。执行搜索后，将收集到的 URL 列表通过 SUPER_SEARCH_URLS 环境变量传入 fetch 阶段。',
      required: true
    },
    'fetch': {
      phase: 'fetch',
      instruction: 'Run: SUPER_SEARCH_URLS="...json..." npx tsx scripts/fetch.ts --cache-dir "${CACHE_DIR}"',
      description: '检查缓存后获取需要抓取的 URL 列表。对未缓存的 URL 使用 fetch 工具抓取，将结果存为 JSON 并通过 SUPER_SEARCH_FETCHED 环境变量传入 analyze 阶段，同时写入缓存。',
      required: true
    },
    'analyze': {
      phase: 'analyze',
      instruction: 'Run: SUPER_SEARCH_FETCHED="...json..." SUPER_SEARCH_CACHED="...json..." npx tsx scripts/analyze.ts',
      description: '分析内容质量，评分并舍弃低质内容。仅作相对参考。',
      required: true
    },
    'review': {
      phase: 'review',
      instruction: `Run: SUPER_SEARCH_ANALYSIS='...json...' npx tsx scripts/review.ts${args.forceReview ? ' --force' : ''}`,
      description: '对抗性审查（条件触发）。自动检测高风险/科学主题，或手动 --force 触发。',
      required: false
    },
    'report': {
      phase: 'report',
      instruction: `Run: SUPER_SEARCH_REPORT_INPUT='...json...' npx tsx scripts/report.ts --topic "${args.topic || 'TBD'}" --output "${args.output || 'research-output/report.md'}"`,
      description: '生成结构化研究报告并写入文件。',
      required: true
    }
  }

  if (args.action !== 'full') {
    console.log(JSON.stringify(stages[args.action], null, 2))
    return
  }

  const stats = await getCacheStats()
  await cachePurgeExpired()

  console.log(JSON.stringify({
    phase: 'pipeline',
    status: 'ready',
    topic: args.topic || 'TBD',
    depth: args.depth,
    output: args.output || 'auto',
    cacheDir: args.cacheDir || stats.cacheDir,
    cache: {
      totalEntries: stats.totalEntries,
      searchEntries: stats.searchEntries,
      fetchEntries: stats.fetchEntries
    },
    stages: stageOrder.map(s => ({
      name: s,
      required: stages[s].required,
      description: stages[s].description,
      instruction: stages[s].instruction
    })),
    note: '脚本输出 JSON 指令，AI 按阶段依次执行。每个阶段完成后将结果传入下一阶段。'
  }, null, 2))
}

main()
