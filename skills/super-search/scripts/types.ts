export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export interface FetchedContent {
  url: string
  title: string
  content: string
  markdown: string
  fetchedAt: number
}

export interface QualityScore {
  authority: number
  completeness: number
  freshness: number
  languageQuality: number
  overall: number
}

export interface ScoredResult {
  url: string
  title: string
  content: string
  score: QualityScore
  included: boolean
  discardReason?: string
}

export interface CrossReferenceFinding {
  claim: string
  sources: string[]
  agreement: 'confirmed' | 'contested' | 'isolated'
  contestedSources?: { url: string; claim: string }[]
  confidence: 'high' | 'medium' | 'low'
}

export interface ReviewFinding {
  mainClaim: string
  counterEvidence: { url: string; summary: string }[]
  sourceDiversity: { category: string; count: number }[]
  gapsIdentified: string[]
  recommendation: string
}

export interface ReviewResult {
  reviewed: boolean
  triggeredBy: 'auto' | 'manual' | 'none'
  triggerReason?: string
  findings: ReviewFinding[]
  supplementarySearches?: string[]
}

export interface ReportSection {
  heading: string
  level: number
  content: string
}

export interface ResearchReport {
  topic: string
  generatedAt: string
  searchDepth: 'quick' | 'normal' | 'deep'
  summary: string
  sources: { url: string; title: string; qualityScore: number; included: boolean }[]
  keyFindings: string[]
  crossReference: CrossReferenceFinding[]
  review?: ReviewResult
  sections: ReportSection[]
}

export interface CacheEntry {
  url: string
  type: 'search' | 'fetch'
  data: unknown
  timestamp: number
  ttl: number
}

export interface CacheIndex {
  version: number
  entries: Record<string, CacheEntry>
}

export interface MultiLanguageQueries {
  language: string
  label: string
  queries: string[]
  rationale: string
}

export interface SearchPlan {
  topic: string
  depth: 'quick' | 'normal' | 'deep'
  queries: string[]
  counterQueries: string[]
  targetSourceCount: number
  multiLanguageQueries?: MultiLanguageQueries[]
}

export interface FetchPlan {
  urlsToFetch: string[]
  cachedUrls: string[]
  skipReasons?: Record<string, string>
}

export interface EnvCheckResult {
  searchTools: string[]
  fetchTools: string[]
  hasSearch: boolean
  hasFetch: boolean
  mode: 'full' | 'fetch-only' | 'none'
}
