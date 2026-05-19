const REQUIRED_CAPABILITIES = {
  search: [
    'tinyfish-search_search',
    'web_search',
    'search'
  ],
  fetch: [
    'tinyfish-search_fetch',
    'webfetch',
    'web_fetch',
    'fetch'
  ]
}

interface EnvCheckResult {
  searchTools: string[]
  fetchTools: string[]
  hasSearch: boolean
  hasFetch: boolean
  mode: 'full' | 'fetch-only' | 'none'
}

function main(): void {
  const result: EnvCheckResult = {
    searchTools: [],
    fetchTools: [],
    hasSearch: false,
    hasFetch: false,
    mode: 'none'
  }

  const instruction = {
    action: 'ENV_CHECK',
    description: '验证当前环境中可用的 search 和 fetch 工具',
    steps: [
      '检查是否有以下 search 工具可用: tinyfish-search_search, web_search, 或其他 search MCP',
      '检查是否有以下 fetch 工具可用: tinyfish-search_fetch, webfetch, 或其他 fetch MCP',
      '将可用工具列表填入结果并返回'
    ],
    expectedTools: {
      search: REQUIRED_CAPABILITIES.search,
      fetch: REQUIRED_CAPABILITIES.fetch
    }
  }

  console.log(JSON.stringify({
    phase: 'env-check',
    status: 'pending',
    instruction,
    result
  }, null, 2))
}

main()
