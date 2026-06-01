import type { MultiLanguageQueries, SearchPlan } from './types.js'

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

// ---------------------------------------------------------------------------
// Multi-Language Query Expansion
// ---------------------------------------------------------------------------

interface LanguageStrategy {
  languages: string[]
  label: string
  rationale: string
}

interface TermMapping {
  zh: string
  en: string
  ja?: string
  ko?: string
}

/**
 * Detect topic domain based on keyword matching.
 * Returns a list of language strategies to apply.
 */
function detectLanguageStrategies(topic: string): LanguageStrategy[] {
  const strategies: LanguageStrategy[] = []

  // Tech / AI / Programming — always add English
  if (/人工智能|AI|机器学习|深度学习|LLM|大模型|GPT|ChatGPT|Claude|编程|代码|开源|API|框架|前端|后端|数据库|云计算|DevOps|容器|Kubernetes|Docker|Serverless|芯片|GPU|半导体|量子|区块链|Web3|算法|神经网络|NLP|CV|自动驾驶|React|Vue|Angular|Next\.?js|Nuxt|TypeScript|JavaScript|Node\.?js|npm|Rust|Python|Golang|Java\s|Spring|TensorFlow|PyTorch|Hugging\s?Face|LangChain|VS\s?Code|GitHub|Copilot|Vite|Webpack|ESLint|Prettier|CI\/CD|PostgreSQL|MySQL|MongoDB|Redis|GraphQL|REST\s?API|gRPC|Microservice|IaC|Terraform|Pulumi|Linux\s|Ubuntu|macOS|Windows/i.test(topic)) {
    strategies.push({
      languages: ['en'],
      label: 'Tech & AI',
      rationale: '科技/AI 相关内容的主要信息源为英文，使用英文关键词可获取更多一手资料'
    })
  }

  // Anime / Manga / ACG — add Japanese + romaji + English
  if (/动漫|动画|漫画|番剧|新番|角色|声优|二次元|ACG|轻小说|手办|漫展|cosplay|本子|同人|galgame|视觉小说|VOCALOID|东方|VTuber|虚拟主播|hololive|にじさんじ|剧场版|OVA|原作|改编|监督|放送|首播|番外|霸权|制作委员会|制作进行|原画|作画|分镜|人设|角色设计|最终季|第[一二三四五六七八九十]季|TV版|Web版|蓝光|Anime|Manga|Season\s*\d/i.test(topic)) {
    strategies.push({
      languages: ['ja', 'en'],
      label: 'Anime & ACG',
      rationale: '日本动漫/ACG 内容的原始来源为日文，同时英文社区也有大量讨论和资料'
    })
  }

  // Japanese culture / Games / Nintendo — add Japanese + English
  if (/日本|东京|大阪|任天堂|Nintendo|PS5|PlayStation|索尼|万代|JRPG|日式|寿司|拉面|樱花|和服|富士山/i.test(topic)) {
    strategies.push({
      languages: ['ja', 'en'],
      label: 'Japanese Culture & Games',
      rationale: '日本文化/游戏的原始信息来源为日文，使用日文关键词可获取一手资料'
    })
  }

  // Korean pop culture — add Korean + English
  if (/韩国|韩剧|K-pop|Kpop|BTS|BLACKPINK|韩漫|webtoon|条漫|韩综|韩国电影/i.test(topic)) {
    strategies.push({
      languages: ['ko', 'en'],
      label: 'Korean Culture',
      rationale: '韩国文化/娱乐内容的原始来源为韩文，同时英文社区也有广泛讨论'
    })
  }

  // General: if no specific domain matched, still add English (fallback)
  if (strategies.length === 0) {
    strategies.push({
      languages: ['en'],
      label: 'General',
      rationale: '英文为互联网主要语言，添加英文搜索可极大扩展信息来源范围'
    })
  }

  return strategies
}

// Common Chinese→English term translations for tech/AI topics
// Tech term translations: ordered longest-first so compound terms are matched before sub-terms
const TECH_EN_MAP: TermMapping[] = [
  { zh: '大语言模型', en: 'large language model' },
  { zh: '生成式人工智能', en: 'generative AI' },
  { zh: '自然语言处理', en: 'natural language processing' },
  { zh: '计算机视觉', en: 'computer vision' },
  { zh: '检索增强生成', en: 'retrieval augmented generation' },
  { zh: '服务网格', en: 'service mesh' },
  { zh: '边缘计算', en: 'edge computing' },
  { zh: '函数计算', en: 'serverless computing' },
  { zh: '推理加速', en: 'inference acceleration' },
  { zh: '基准测试', en: 'benchmark' },
  { zh: '强化学习', en: 'reinforcement learning' },
  { zh: '向量数据库', en: 'vector database' },
  { zh: '提示工程', en: 'prompt engineering' },
  { zh: '开源模型', en: 'open source model' },
  { zh: '前端框架', en: 'frontend framework' },
  { zh: '后端框架', en: 'backend framework' },
  { zh: '人工智能', en: 'artificial intelligence' },
  { zh: '机器学习', en: 'machine learning' },
  { zh: '深度学习', en: 'deep learning' },
  { zh: '神经网络', en: 'neural network' },
  { zh: '安全漏洞', en: 'security vulnerability' },
  { zh: '零日漏洞', en: 'zero-day vulnerability' },
  { zh: '数据泄露', en: 'data breach' },
  { zh: '预训练', en: 'pre-training' },
  { zh: '多模态', en: 'multimodal' },
  { zh: '智能体', en: 'agent' },
  { zh: '容器化', en: 'containerization' },
  { zh: '微服务', en: 'microservices' },
  { zh: '大模型', en: 'large language model' },
  { zh: '生成式', en: 'generative' },
  { zh: '安全对齐', en: 'safety alignment' },
  { zh: '模型对齐', en: 'model alignment' },
  { zh: '后训练', en: 'post-training' },
  { zh: '推理链', en: 'chain of thought' },
  { zh: '思维链', en: 'chain of thought' },
  { zh: '蒸馏', en: 'distillation' },
  { zh: '剪枝', en: 'pruning' },
  { zh: '混合专家', en: 'mixture of experts' },
  { zh: '小模型', en: 'small language model' },
  { zh: '世界模型', en: 'world model' },
  { zh: '具身智能', en: 'embodied intelligence' },
  { zh: '视频生成', en: 'video generation' },
  { zh: '图像生成', en: 'image generation' },
  { zh: '语音合成', en: 'speech synthesis' },
  { zh: '语音识别', en: 'speech recognition' },
  { zh: '代码生成', en: 'code generation' },
  { zh: '模型架构', en: 'model architecture' },
  { zh: '注意力机制', en: 'attention mechanism' },
  { zh: '自回归', en: 'autoregressive' },
  { zh: '扩散模型', en: 'diffusion model' },
  { zh: '训练数据', en: 'training data' },
  { zh: '数据隐私', en: 'data privacy' },
  { zh: '监督微调', en: 'supervised fine-tuning' },
  { zh: '人类反馈', en: 'human feedback' },
  { zh: '强化学习人类反馈', en: 'RLHF' },
  { zh: '上下文窗口', en: 'context window' },
  { zh: '评测基准', en: 'evaluation benchmark' },
  { zh: '开源生态', en: 'open source ecosystem' },
  { zh: '闭源模型', en: 'closed source model' },
  { zh: '治理', en: 'governance' },
  { zh: '监管', en: 'regulation' },
  { zh: '对抗攻击', en: 'adversarial attack' },
  { zh: '越狱', en: 'jailbreak' },
  { zh: '红队测试', en: 'red teaming' },
  { zh: '安全', en: 'safety' },
  { zh: '对齐', en: 'alignment' },
  { zh: '推理', en: 'reasoning' },
  { zh: '微调', en: 'fine-tuning' },
  { zh: '评测', en: 'evaluation' },
  { zh: '部署', en: 'deployment' },
  { zh: '量化', en: 'quantization' },
  { zh: '芯片', en: 'chip' },
  { zh: '算力', en: 'compute' },
  { zh: '幻觉', en: 'hallucination' },
]

// Common Chinese→English term translations for anime/game topics
const ANIME_EN_MAP: TermMapping[] = [
  { zh: '新番', en: 'new anime' },
  { zh: '动漫', en: 'anime' },
  { zh: '漫画', en: 'manga' },
  { zh: '轻小说', en: 'light novel' },
  { zh: '声优', en: 'voice actor', ja: '声優' },
  { zh: '角色', en: 'character', ja: 'キャラクター' },
  { zh: '动画制作', en: 'anime production', ja: 'アニメ制作' },
  { zh: '动画公司', en: 'anime studio', ja: 'アニメスタジオ' },
  { zh: '霸权', en: 'top anime' },
  { zh: '销量', en: 'sales', ja: '売上' },
  { zh: 'BD', en: 'Blu-ray', ja: 'ブルーレイ' },
  { zh: '手办', en: 'figure', ja: 'フィギュア' },
  { zh: '周边', en: 'merchandise', ja: 'グッズ' },
  { zh: '漫展', en: 'comic convention', ja: 'コミケ' },
  { zh: '同人志', en: 'doujinshi', ja: '同人誌' },
  { zh: '本子', en: 'doujinshi', ja: '同人誌' },
  { zh: '游戏', en: 'game', ja: 'ゲーム' },
  { zh: '主机游戏', en: 'console game', ja: 'コンソールゲーム' },
  { zh: '独立游戏', en: 'indie game', ja: 'インディーゲーム' },
  { zh: '手游', en: 'mobile game', ja: 'スマホゲーム' },
]

/**
 * Translate Chinese terms found in topic to target language keywords.
 * Returns the translated topic string and any additional keyword expansions.
 */
function translateTopic(topic: string, lang: 'en' | 'ja' | 'ko'): { translated: string; extraKeywords: string[] } {
  let result = topic
  const extraKeywords: string[] = []

  let termMap: TermMapping[] = []

  if (lang === 'en') {
    termMap = [...TECH_EN_MAP, ...ANIME_EN_MAP]
  } else if (lang === 'ja') {
    // For Japanese, use both direct JA translations and romaji
    const jaTerms = ANIME_EN_MAP.filter(t => t.ja)
    for (const term of jaTerms) {
      if (result.includes(term.zh) && term.ja) {
        result = result.replace(term.zh, term.ja)
      }
    }
    // Also generate romaji variants (simplified approach)
    if (/动漫|アニメ/.test(result)) {
      extraKeywords.push(result.replace(/动漫/g, 'アニメ'))
    }
    if (/游戏|ゲーム/.test(result)) {
      extraKeywords.push(result.replace(/游戏/g, 'ゲーム'))
    }
  }

  if (lang === 'en') {
    for (const term of termMap) {
      if (result.includes(term.zh)) {
        result = result.replace(term.zh, `${term.en} `)
      }
    }
    // Normalize whitespace: collapse multiple spaces and trim
    result = result.replace(/\s+/g, ' ').trim()
  }

  // Also try to detect untranslated Chinese terms and add them as extra
  // For EN: extract any remaining Chinese and add extra mixed queries
  if (lang === 'en' && /[\u4e00-\u9fff]/.test(result)) {
    // If there's still Chinese left, add mixed CN-EN queries
    extraKeywords.push(result)
  }

  return { translated: result, extraKeywords: [...new Set(extraKeywords)] }
}

/**
 * Generate multi-language queries for the given topic based on detected
 * language strategies. Returns a list of language-specific query groups.
 */
function generateMultiLanguageQueries(
  topic: string,
  depth: 'quick' | 'normal' | 'deep'
): MultiLanguageQueries[] {
  const strategies = detectLanguageStrategies(topic)
  const results: MultiLanguageQueries[] = []

  for (const strategy of strategies) {
    const queries: string[] = []

    for (const lang of strategy.languages) {
      if (lang === 'en') {
        const { translated, extraKeywords } = translateTopic(topic, 'en')

        // Base English query
        queries.push(translated)

        // English perspective queries (depth-dependent)
        if (depth !== 'quick') {
          queries.push(`${translated} latest`)
          queries.push(`${translated} review`)
          queries.push(`${translated} analysis`)
          queries.push(`${translated} comparison`)
          queries.push(`${translated} official`)
        }

        if (depth === 'deep') {
          queries.push(`criticism of ${translated}`)
          queries.push(`${translated} controversy`)
          queries.push(`${translated} limitations`)
          queries.push(`${translated} vs`)
        }

        // Add extra keyword expansions
        for (const kw of extraKeywords) {
          queries.push(kw)
        }

        // Add mixed-language queries for bilingual searches
        if (/[\u4e00-\u9fff]/.test(topic)) {
          queries.push(`${topic} site:en.wikipedia.org`)
          queries.push(`${translated} Reddit`)
          if (depth === 'deep') {
            queries.push(`${translated} research paper`)
            queries.push(`${translated} arXiv`)
          }
        }
      }

      if (lang === 'ja') {
        const { translated, extraKeywords } = translateTopic(topic, 'ja')
        queries.push(translated)
        if (depth !== 'quick') {
          queries.push(`${translated} 最新`)
          queries.push(`${translated} まとめ`)
          queries.push(`${translated} レビュー`)
        }
        for (const kw of extraKeywords) {
          queries.push(kw)
        }
      }

      if (lang === 'ko') {
        // Korean: transliterate common terms (simplified)
        queries.push(topic)
        if (depth !== 'quick') {
          queries.push(`${topic} 최신`)
          queries.push(`${topic} 리뷰`)
        }
      }
    }

    results.push({
      language: strategy.languages.join('+'),
      label: strategy.label,
      queries: [...new Set(queries)],
      rationale: strategy.rationale
    })
  }

  return results
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

  const multiLanguageQueries = generateMultiLanguageQueries(topic, depth)

  const plan: SearchPlan = {
    topic,
    depth,
    queries,
    counterQueries,
    targetSourceCount,
    multiLanguageQueries
  }

  const allQueries = [
    ...queries,
    ...multiLanguageQueries.flatMap(ml => ml.queries)
  ]

  console.log(JSON.stringify({
    phase: 'search',
    status: 'ready',
    plan,
    instruction: {
      action: 'SEARCH',
      description: `对以下 ${queries.length} 个主查询 + ${allQueries.length - queries.length} 个多语言查询（共 ${allQueries.length} 个）执行搜索，每个查询取前 ${depth === 'quick' ? 3 : depth === 'deep' ? 8 : 5} 条结果`,
      queries,
      multiLanguageQueries,
      targetSourceCount,
      note: '多语言扩展搜索可帮助发现非中文一手信息源和原始来源。收集所有搜索结果的 URL，去重后传递给 fetch 阶段。优先保留来自官方、权威媒体的结果。'
    }
  }, null, 2))
}

main()
