#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// opencode-usage engine + CLI.
//
// Reads OpenCode's local SQLite database and turns assistant messages into
// daily / weekly / monthly / all-time token and cost stats.
//
// Used two ways:
//   1. Imported by ./usage-plugin.ts to back the `/usage` slash command.
//   2. Run directly as a CLI:
//        node usage.mjs            full overview
//        node usage.mjs daily      per-day table (last 30 days)
//        node usage.mjs models     per-model breakdown

import os from "node:os"
import path from "node:path"

const SQL = `
  SELECT
    json_extract(data,'$.providerID')           AS provider,
    json_extract(data,'$.modelID')              AS model,
    json_extract(data,'$.cost')                 AS cost,
    json_extract(data,'$.tokens.input')         AS input,
    json_extract(data,'$.tokens.output')        AS output,
    json_extract(data,'$.tokens.reasoning')     AS reasoning,
    json_extract(data,'$.tokens.cache.read')    AS cache_read,
    json_extract(data,'$.tokens.cache.write')   AS cache_write,
    COALESCE(json_extract(data,'$.time.completed'), json_extract(data,'$.time.created')) AS completed
  FROM message
  WHERE json_extract(data,'$.role') = 'assistant'
    AND COALESCE(json_extract(data,'$.time.completed'), json_extract(data,'$.time.created')) IS NOT NULL
`

export function dbPath() {
  if (process.env.OPENCODE_DB) return process.env.OPENCODE_DB
  const dataDir = process.env.OPENCODE_DATA_DIR
    ?? (process.env.XDG_DATA_HOME
      ? path.join(process.env.XDG_DATA_HOME, "opencode")
      : path.join(os.homedir(), ".local", "share", "opencode"))
  return path.join(dataDir, "opencode.db")
}

async function rawRows(file) {
  if (typeof globalThis.Bun !== "undefined") {
    const { Database } = await import("bun:sqlite")
    const db = new Database(file, { readonly: true })
    try {
      return db.query(SQL).all()
    } finally {
      db.close()
    }
  }
  const { DatabaseSync } = await import("node:sqlite")
  const db = new DatabaseSync(file, { readOnly: true })
  try {
    return db.prepare(SQL).all()
  } finally {
    db.close()
  }
}

export async function loadMessages(file = dbPath()) {
  const rows = await rawRows(file)
  return rows
    .map((r) => ({
      provider: r.provider ?? "unknown",
      model: r.model ?? "unknown",
      cost: r.cost ?? 0,
      input: r.input ?? 0,
      output: (r.output ?? 0) + (r.reasoning ?? 0),
      cache: (r.cache_read ?? 0) + (r.cache_write ?? 0),
      ts: r.completed,
    }))
    .filter((m) => m.cost > 0 || m.input > 0 || m.output > 0 || m.cache > 0)
}

// ---- aggregation ------------------------------------------------------------

const bucket = () => ({ msgs: 0, input: 0, output: 0, cache: 0, cost: 0 })

function add(b, m) {
  b.msgs += 1
  b.input += m.input
  b.output += m.output
  b.cache += m.cache
  b.cost += m.cost
}

const tokens = (b) => b.input + b.output + b.cache

function startOfDay(now) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfWeek(now) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

function startOfMonth(now) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(1)
  return d.getTime()
}

function dayKey(ts) {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

export function aggregate(messages, now = Date.now()) {
  const sToday = startOfDay(now)
  const sWeek = startOfWeek(now)
  const sMonth = startOfMonth(now)

  const windows = { today: bucket(), week: bucket(), month: bucket(), all: bucket() }
  const days = new Map()
  const models = new Map()

  for (const m of messages) {
    add(windows.all, m)
    if (m.ts >= sToday) add(windows.today, m)
    if (m.ts >= sWeek) add(windows.week, m)
    if (m.ts >= sMonth) add(windows.month, m)

    const dk = dayKey(m.ts)
    if (!days.has(dk)) days.set(dk, bucket())
    add(days.get(dk), m)

    const mk = `${m.provider}/${m.model}`
    if (!models.has(mk)) models.set(mk, bucket())
    add(models.get(mk), m)
  }

  return { windows, days, models, count: messages.length, now }
}

function modelsSince(messages, since) {
  const out = new Map()
  for (const m of messages) {
    if (m.ts < since) continue
    const mk = `${m.provider}/${m.model}`
    if (!out.has(mk)) out.set(mk, bucket())
    add(out.get(mk), m)
  }
  return out
}

// ---- formatting -------------------------------------------------------------

function fmtInt(n) {
  return Math.round(n).toLocaleString("en-US")
}

function fmtTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B"
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M"
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K"
  return String(Math.round(n))
}

function fmtCost(n) {
  if (n > 0 && n < 0.01) return "$" + n.toFixed(4)
  return "$" + n.toFixed(2)
}

function fmtClock(ts) {
  const d = new Date(ts)
  const p = (x) => String(x).padStart(2, "0")
  return `${dayKey(ts)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function table(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)))
  const line = (cells) =>
    cells.map((c, i) => (i === 0 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i]))).join("   ").trimEnd()
  return [line(headers), ...rows.map(line)].join("\n")
}

const HEAD = ["", "MSGS", "INPUT", "OUTPUT", "CACHE", "COST"]
const row = (label, b) => [label, fmtInt(b.msgs), fmtTokens(b.input), fmtTokens(b.output), fmtTokens(b.cache), fmtCost(b.cost)]

function summarySection(windows) {
  const rows = [
    row("Today", windows.today),
    row("This Week", windows.week),
    row("This Month", windows.month),
    row("All Time", windows.all),
  ]
  return table(HEAD, rows)
}

function daysSection(days, limit) {
  const keys = [...days.keys()].sort().reverse().slice(0, limit)
  if (!keys.length) return ""
  const rows = keys.map((k) => row(k, days.get(k)))
  return "RECENT DAYS\n" + table(HEAD, rows)
}

function modelsSection(models, limit) {
  const entries = [...models.entries()].sort((a, b) => b[1].cost - a[1].cost || tokens(b[1]) - tokens(a[1]))
  if (!entries.length) return ""
  const shown = limit ? entries.slice(0, limit) : entries
  const rows = shown.map(([name, b]) => row(name, b))
  return "MODELS\n" + table(HEAD, rows)
}

export function buildReport(messages, { period = "", now = Date.now() } = {}) {
  if (!messages.length) {
    return "OpenCode Usage\n\nNo assistant messages found in the database yet."
  }

  const agg = aggregate(messages, now)
  const all = agg.windows.all
  const header =
    `OpenCode Usage  ·  ${fmtInt(all.msgs)} messages  ·  ${fmtTokens(tokens(all))} tokens  ·  ${fmtCost(all.cost)} all-time\n` +
    `generated ${fmtClock(now)}`

  const p = period.trim().toLowerCase()
  const windowFor = {
    today: ["Today", startOfDay(now), agg.windows.today],
    day: ["Today", startOfDay(now), agg.windows.today],
    week: ["This Week", startOfWeek(now), agg.windows.week],
    weekly: ["This Week", startOfWeek(now), agg.windows.week],
    month: ["This Month", startOfMonth(now), agg.windows.month],
    monthly: ["This Month", startOfMonth(now), agg.windows.month],
    all: ["All Time", 0, agg.windows.all],
    "all-time": ["All Time", 0, agg.windows.all],
    alltime: ["All Time", 0, agg.windows.all],
    total: ["All Time", 0, agg.windows.all],
  }

  const parts = [header, ""]

  if (p === "daily") {
    parts.push(daysSection(agg.days, 30))
  } else if (p === "models" || p === "model") {
    parts.push(modelsSection(agg.models, 0))
  } else if (p === "summary" || p === "overview") {
    parts.push(summarySection(agg.windows))
    parts.push("")
    parts.push(modelsSection(agg.models, 8))
  } else if (windowFor[p]) {
    const [label, since, b] = windowFor[p]
    parts.push(table(HEAD, [row(label, b)]))
    parts.push("")
    parts.push(modelsSection(since ? modelsSince(messages, since) : agg.models, 0))
  } else {
    parts.push(summarySection(agg.windows))
    parts.push("")
    parts.push(daysSection(agg.days, 7))
    parts.push("")
    parts.push(modelsSection(agg.models, 12))
  }

  return parts.filter((s) => s !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()
}

export async function report(opts = {}) {
  const messages = await loadMessages(opts.file)
  return buildReport(messages, opts)
}

// ---- CLI --------------------------------------------------------------------
const argv1 = process.argv[1] ?? ""
const ranDirectly = import.meta.main === true || /usage\.mjs$/.test(argv1)
if (ranDirectly) {
  report({ period: process.argv[2] ?? "" })
    .then((r) => console.log(r))
    .catch((e) => {
      console.error("opencode-usage: " + (e?.message ?? e))
      console.error("database: " + dbPath())
      process.exit(1)
    })
}
