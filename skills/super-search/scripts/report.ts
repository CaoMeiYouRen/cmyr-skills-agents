import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

interface ReportInput {
  topic: string
  searchDepth: 'quick' | 'normal' | 'deep'
  analysisResults?: Array<{
    url: string
    title: string
    overallScore: number
    included: boolean
    keyExcerpts: string[]
    discardReason?: string
  }>
  crossReference?: Array<{
    claim: string
    sources: string[]
    agreement: 'confirmed' | 'contested' | 'isolated'
    confidence: 'high' | 'medium' | 'low'
  }>
  reviewResult?: {
    reviewed: boolean
    triggeredBy: string
    triggerReason?: string
    findings?: Array<{
      mainClaim: string
      counterEvidence: Array<{ url: string; summary: string }>
      gapsIdentified: string[]
    }>
  }
}

function parseArgs(): { output?: string; topic?: string } {
  const args = process.argv.slice(2)
  let output: string | undefined
  let topic: string | undefined

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
      output = args[i + 1]
      i++
    } else if ((args[i] === '--topic' || args[i] === '-t') && args[i + 1]) {
      topic = args[i + 1]
      i++
    }
  }

  return { output, topic }
}

function parseInput(): ReportInput {
  const inputJson = process.env.SUPER_SEARCH_REPORT_INPUT
  if (!inputJson) {
    return {
      topic: parseArgs().topic || 'unknown',
      searchDepth: 'normal'
    }
  }

  try {
    return JSON.parse(inputJson)
  } catch {
    return {
      topic: parseArgs().topic || 'unknown',
      searchDepth: 'normal'
    }
  }
}

function slugify(text: string): string {
  return text
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64)
}

function formatDate(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function scoreToLabel(score: number): string {
  if (score >= 80) return '🟢 高'
  if (score >= 50) return '🟡 中'
  return '🔴 低'
}

function buildReport(input: ReportInput): string {
  const { topic, searchDepth, analysisResults = [], crossReference = [], reviewResult } = input

  const lines: string[] = [
    `# 研究报告: ${topic}`,
    '',
    `> 生成时间: ${formatDate()} | 搜索深度: ${searchDepth} | 来源数量: ${analysisResults.filter(r => r.included).length}`,
    '',
    '---',
    '',
    '## 摘要',
    '',
    '_（请根据下方分析结果手动填写摘要）_',
    '',
    '---',
    '',
    '## 信息来源与质量评估',
    '',
    '| # | 来源 | 质量评分 | 状态 |',
    '|---|---|---|---|',
  ]

  analysisResults.forEach((r, i) => {
    const scoreLabel = scoreToLabel(r.overallScore)
    const status = r.included ? '✅ 采用' : `❌ 舍弃: ${r.discardReason || '低质'}`
    lines.push(`| ${i + 1} | [${r.title || r.url}](${r.url}) | ${r.overallScore} ${scoreLabel} | ${status} |`)
  })

  const discarded = analysisResults.filter(r => !r.included)
  if (discarded.length > 0) {
    lines.push('', '### 已舍弃的来源', '')
    discarded.forEach(r => {
      lines.push(`- [${r.title || r.url}](${r.url}) — ${r.discardReason || '评分过低'}`)
    })
  }

  lines.push('', '---', '', '## 关键发现', '')

  const included = analysisResults.filter(r => r.included && r.keyExcerpts.length > 0)
  if (included.length > 0) {
    included.forEach((r, i) => {
      lines.push(`### 来源 ${i + 1}: ${r.title || '未知标题'}`)
      lines.push('')
      r.keyExcerpts.forEach(excerpt => {
        lines.push(`> ${excerpt}`)
      })
      lines.push('', `— 来源: [${r.url}](${r.url})`, '')
    })
  } else {
    lines.push('_（暂无高质量来源可展示）_', '')
  }

  if (crossReference.length > 0) {
    lines.push('---', '', '## 交叉验证', '')
    crossReference.forEach(cr => {
      const icon = cr.agreement === 'confirmed' ? '✅' : cr.agreement === 'contested' ? '⚠️' : '❓'
      lines.push(`### ${icon} ${cr.claim}`)
      lines.push(`- 一致性: ${cr.agreement === 'confirmed' ? '多源确认' : cr.agreement === 'contested' ? '存在矛盾' : '孤立声明'}`)
      lines.push(`- 置信度: ${cr.confidence}`)
      lines.push(`- 来源: ${cr.sources.map(s => `[链接](${s})`).join(', ')}`)
      lines.push('')
    })
  }

  if (reviewResult?.reviewed) {
    lines.push('---', '', '## 对抗审查', '')
    lines.push(`- 触发方式: ${reviewResult.triggeredBy}`)
    if (reviewResult.triggerReason) {
      lines.push(`- 触发原因: ${reviewResult.triggerReason}`)
    }
    lines.push('')
    if (reviewResult.findings) {
      reviewResult.findings.forEach(f => {
        lines.push(`### 审查: ${f.mainClaim}`)
        if (f.counterEvidence.length > 0) {
          lines.push('', '**反驳证据:**')
          f.counterEvidence.forEach(ce => {
            lines.push(`- [${ce.url}](${ce.url}): ${ce.summary}`)
          })
        }
        if (f.gapsIdentified.length > 0) {
          lines.push('', '**发现的疏漏:**')
          f.gapsIdentified.forEach(g => lines.push(`- ${g}`))
        }
        lines.push('')
      })
    }
  }

  lines.push('---', '', '*报告由 Super Search 自动生成。评分仅作相对参考，不承诺信息百分百准确。*', '')

  return lines.join('\n')
}

async function main(): Promise<void> {
  const args = parseArgs()
  const input = parseInput()

  const outputPath = args.output
    || join(process.cwd(), 'research-output', `${slugify(input.topic)}-${formatDate().replace(/[:\s]/g, '-')}.md`)

  const report = buildReport(input)

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, report, 'utf-8')

  console.log(JSON.stringify({
    phase: 'report',
    status: 'complete',
    outputPath,
    topic: input.topic,
    sourceCount: input.analysisResults?.filter(r => r.included).length || 0,
    instruction: {
      action: 'REPORT_DONE',
      description: `报告已写入 ${outputPath}`
    }
  }, null, 2))
}

main()
