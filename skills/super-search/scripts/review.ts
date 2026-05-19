interface ReviewInput {
  topic: string
  claims: Array<{ claim: string; sources: string[] }>
  depth: 'quick' | 'normal' | 'deep'
}

interface ReviewInstruction {
  phase: 'review'
  status: 'pending'
  topic: string
  triggers: string[]
  sourceDiversityCheck: string[]
  counterSearchQueries: string[]
  scientificCheck?: string[]
  instruction: {
    action: 'REVIEW'
    steps: string[]
    note: string
  }
}

const HIGH_RISK_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /医学|医疗|药物|疾病|治疗|手术|临床|药效|副作用|health|medical|drug|treatment|disease/i, label: '医学/健康' },
  { pattern: /法律|诉讼|合同|判决|法规|违法|犯罪|律师|法院|legal|law|court|contract/i, label: '法律' },
  { pattern: /金融|股票|投资|基金|理财|保险|贷款|利率|finance|stock|investment/i, label: '金融/投资' },
  { pattern: /安全|漏洞|攻击|黑客|加密|认证|security|vulnerability|hack|exploit/i, label: '安全' },
]

const SCIENCE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /物理|physics|力学|量子|相对论|电磁|热力学/i, label: '物理学' },
  { pattern: /化学|chemistry|分子|元素|反应|化合物|催化/i, label: '化学' },
  { pattern: /数学|math|定理|公式|证明|算法复杂度/i, label: '数学' },
  { pattern: /生物|biology|基因|细胞|进化|DNA|RNA/i, label: '生物学' },
]

function parseInput(): ReviewInput {
  const inputJson = process.env.SUPER_SEARCH_ANALYSIS
  if (!inputJson) {
    return { topic: 'unknown', claims: [], depth: 'normal' }
  }

  try {
    const parsed = JSON.parse(inputJson)
    return {
      topic: parsed.topic || 'unknown',
      claims: parsed.claims || [],
      depth: parsed.depth || 'normal'
    }
  } catch {
    return { topic: 'unknown', claims: [], depth: 'normal' }
  }
}

function main(): void {
  const input = parseInput()
  const topic = input.topic
  const triggers: string[] = []
  const counterSearchQueries: string[] = []

  for (const { pattern, label } of HIGH_RISK_PATTERNS) {
    if (pattern.test(topic)) {
      triggers.push(`高风险主题: ${label}`)
      counterSearchQueries.push(`反对 ${topic}`, `${topic} 风险`, `${topic} 争议`, `${topic} 最新研究质疑`)
    }
  }

  const scientificChecks: string[] = []
  for (const { pattern, label } of SCIENCE_PATTERNS) {
    if (pattern.test(topic)) {
      triggers.push(`科学主题: ${label}`)
      scientificChecks.push(
        `验证 ${topic} 是否符合基础科学原理`,
        `查找 ${topic} 的官方/学术机构说明`,
        `检查 ${topic} 是否存在常见科学误解`
      )
    }
  }

  const claimsInput = input.claims || []
  if (claimsInput.length > 0) {
    for (const c of claimsInput.slice(0, 5)) {
      counterSearchQueries.push(`"${c.claim}" 反驳`, `"${c.claim}" 质疑`)
    }
  }

  if (triggers.length === 0 && process.argv.includes('--force')) {
    triggers.push('手动触发对抗审查')
  }

  const instruction: ReviewInstruction = {
    phase: 'review',
    status: 'pending',
    topic,
    triggers,
    sourceDiversityCheck: [
      '检查来源是否过度集中在单一立场或平台',
      '是否缺少官方/学术/权威来源',
      '是否缺少反对或质疑性观点'
    ],
    counterSearchQueries: [...new Set(counterSearchQueries)],
    instruction: {
      action: 'REVIEW',
      steps: [
        '对每个主要结论，使用 counterSearchQueries 搜索反驳证据',
        '检查来源多样性，确保包含至少 2 个不同立场的来源',
        '如为主题涉及科学原理，从基础原理出发检查常识性错误',
        '标注所有存疑声明及其置信度',
        '如发现重大疏漏，输出 supplementarySearches 建议补充搜索'
      ],
      note: triggers.length > 0
        ? `对抗审查已自动触发，原因: ${triggers.join('; ')}`
        : '未触发自动对抗审查。如需强制审查，请使用 --force 参数。'
    }
  }

  if (scientificChecks.length > 0) {
    instruction.scientificCheck = scientificChecks
  }

  console.log(JSON.stringify(instruction, null, 2))
}

main()
