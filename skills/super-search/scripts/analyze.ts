const DISCARD_THRESHOLD = 30

interface QualityDimensions {
  authority: { score: number; reason: string }
  completeness: { score: number; reason: string }
  freshness: { score: number; reason: string }
  languageQuality: { score: number; reason: string }
}

interface AnalysisResult {
  url: string
  title: string
  overallScore: number
  dimensions: QualityDimensions
  included: boolean
  discardReason?: string
  keyExcerpts: string[]
}

const AUTHORITY_PATTERNS: { pattern: RegExp; score: number; label: string }[] = [
  { pattern: /\.gov\.cn|\.gov\b|\.edu\.cn|\.edu\b|\.org\b/i, score: 90, label: '官方/机构域名' },
  { pattern: /wikipedia\.org|wiki\b/i, score: 75, label: '维基百科' },
  { pattern: /github\.com|npmjs\.com|pypi\.org/i, score: 75, label: '开源平台' },
  { pattern: /nature\.com|science\.org|ieee\.org|acm\.org|arxiv\.org/i, score: 95, label: '学术期刊' },
  { pattern: /reuters\.com|apnews\.com|bbc\.com|bloomberg\.com/i, score: 85, label: '权威媒体' },
  { pattern: /zhihu\.com|jianshu\.com|csdn\.net|juejin\.cn|segmentfault\.com/i, score: 40, label: '个人/UGC 平台' },
  { pattern: /medium\.com|dev\.to|hashnode\.com/i, score: 35, label: '博客平台' },
]

const LOW_QUALITY_PATTERNS: RegExp[] = [
  /自动翻译|机器翻译|本文翻译自|translated by/i,
  /采集|爬虫|自动生成|AI 生成|由 AI|powered by AI/i,
  /广告|推广|sponsored|advertisement/i,
  /内容农|content farm|伪原创/i,
]

function parseInput(): Array<{ url: string; title?: string; content?: string; markdown?: string }> {
  const fetchedJson = process.env.SUPER_SEARCH_FETCHED
  const cachedJson = process.env.SUPER_SEARCH_CACHED

  const results: Array<{ url: string; title?: string; content?: string; markdown?: string }> = []

  if (fetchedJson) {
    try { results.push(...JSON.parse(fetchedJson)) } catch { /* ignore */ }
  }
  if (cachedJson) {
    try { results.push(...JSON.parse(cachedJson)) } catch { /* ignore */ }
  }

  return results
}

function assessAuthority(url: string, content: string): { score: number; reason: string } {
  for (const { pattern, score, label } of AUTHORITY_PATTERNS) {
    if (pattern.test(url)) {
      return { score, reason: `域名匹配 ${label}` }
    }
  }

  if (/官方|authority|official|gov/i.test(content.slice(0, 500))) {
    return { score: 60, reason: '内容提及官方/权威性关键词' }
  }

  return { score: 50, reason: '未匹配已知权威模式，默认中等评分' }
}

function assessCompleteness(content: string, title?: string): { score: number; reason: string } {
  const hasDate = /\d{4}[年/-]\d{1,2}[月/-]\d{1,2}/.test(content.slice(0, 1000))
  const hasAuthor = /作者[：:]|author|by\s+\w+/i.test(content.slice(0, 500))
  const hasReferences = /参考|引用|来源|reference|source/i.test(content)
  const wordCount = content.length
  const hasDataPoints = (content.match(/\d+%|\d+\.\d+|统计数据/g) || []).length

  let score = 40
  const reasons: string[] = []

  if (hasDate) { score += 15; reasons.push('含日期') }
  if (hasAuthor) { score += 15; reasons.push('含作者') }
  if (hasReferences) { score += 15; reasons.push('含引用/来源') }
  if (wordCount > 2000) { score += 10; reasons.push('内容较丰富') }
  if (wordCount < 200) { score -= 20; reasons.push('内容过短') }
  if (hasDataPoints > 2) { score += 5; reasons.push('含数据支撑') }

  return { score: Math.min(100, Math.max(0, score)), reason: reasons.join('; ') || '基础评分' }
}

function assessFreshness(content: string): { score: number; reason: string } {
  const dateMatch = content.slice(0, 1000).match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/)
  if (dateMatch) {
    const year = parseInt(dateMatch[1])
    const month = parseInt(dateMatch[2])
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    const monthsAgo = (currentYear - year) * 12 + (currentMonth - month)

    if (monthsAgo <= 1) return { score: 95, reason: `发布于近 1 个月内 (${year}-${month})` }
    if (monthsAgo <= 3) return { score: 85, reason: `发布于近 3 个月内 (${year}-${month})` }
    if (monthsAgo <= 6) return { score: 75, reason: `发布于近 6 个月内 (${year}-${month})` }
    if (monthsAgo <= 12) return { score: 60, reason: `发布于 1 年内 (${year}-${month})` }
    if (monthsAgo <= 24) return { score: 40, reason: `发布于 2 年内 (${year}-${month})` }
    return { score: 20, reason: `发布于 ${year}-${month}，超过 2 年` }
  }

  return { score: 30, reason: '未找到发布日期' }
}

function assessLanguageQuality(content: string): { score: number; reason: string } {
  for (const pattern of LOW_QUALITY_PATTERNS) {
    if (pattern.test(content.slice(0, 2000))) {
      return { score: 10, reason: `匹配低质模式: ${pattern.source.slice(0, 40)}` }
    }
  }

  const sample = content.slice(0, 500)
  const gibberishRatio = (sample.match(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g) || []).length / Math.max(1, sample.length)
  if (gibberishRatio > 0.1) {
    return { score: 5, reason: '内容包含大量乱码' }
  }

  const emptyRatio = (content.match(/^\s*$/gm) || []).length / Math.max(1, content.split('\n').length)
  if (emptyRatio > 0.5) {
    return { score: 30, reason: '内容稀疏，空行过多' }
  }

  return { score: 80, reason: '语言质量无异常' }
}

function extractKeyExcerpts(content: string, maxExcerpts: number = 5): string[] {
  const sentences = content
    .replace(/[\n\r]+/g, ' ')
    .split(/[。！？.!?]/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 500)
    .filter(s => !/^(广告|推广|点击|关注|订阅)/.test(s))

  const scored = sentences.map(s => ({
    text: s,
    score: (s.match(/\d+/g) || []).length * 2
      + (/重要|关键|核心|发现|结论|研究|数据|统计/i.test(s) ? 3 : 0)
      + (s.length > 100 ? 1 : 0)
  }))

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, maxExcerpts).map(s => s.text)
}

function main(): void {
  const items = parseInput()

  if (items.length === 0) {
    console.log(JSON.stringify({
      phase: 'analyze',
      status: 'pending',
      instruction: {
        action: 'ANALYZE_INPUT',
        description: '没有收到待分析内容。请将抓取结果通过 SUPER_SEARCH_FETCHED 和 SUPER_SEARCH_CACHED 环境变量传入。'
      }
    }, null, 2))
    return
  }

  const results: AnalysisResult[] = items.map(item => {
    const content = item.content || item.markdown || ''
    const title = item.title || ''

    const authority = assessAuthority(item.url, content)
    const completeness = assessCompleteness(content, title)
    const freshness = assessFreshness(content)
    const languageQuality = assessLanguageQuality(content)

    const weights = { authority: 0.35, completeness: 0.20, freshness: 0.20, languageQuality: 0.25 }
    const overall = Math.round(
      authority.score * weights.authority
      + completeness.score * weights.completeness
      + freshness.score * weights.freshness
      + languageQuality.score * weights.languageQuality
    )

    const dimensions: QualityDimensions = { authority, completeness, freshness, languageQuality }
    const included = overall >= DISCARD_THRESHOLD

    const result: AnalysisResult = {
      url: item.url,
      title,
      overallScore: overall,
      dimensions,
      included,
      discardReason: included ? undefined : `综合评分 ${overall} 低于阈值 ${DISCARD_THRESHOLD}`,
      keyExcerpts: included ? extractKeyExcerpts(content) : []
    }

    return result
  })

  results.sort((a, b) => b.overallScore - a.overallScore)

  const included = results.filter(r => r.included)
  const discarded = results.filter(r => !r.included)

  console.log(JSON.stringify({
    phase: 'analyze',
    status: 'complete',
    summary: {
      total: results.length,
      included: included.length,
      discarded: discarded.length,
      threshold: DISCARD_THRESHOLD
    },
    results: included,
    discarded,
    note: '评分仅作相对参考。低质内容（评分 < 阈值）已舍弃。如需调整阈值，请手动排查 discarded 列表。'
  }, null, 2))
}

main()
