/**
 * 写语法点时用的试跑工具：在词典里的 Tatoeba 例句（两万六千多句）上认语法点，看认出了哪些、
 * 规则（rules-basic.ts、rules-n3.ts …）放过了哪些；也可以把一句话的分词结果与认出的语法点打出来。
 * 分词结果存在 .cache/probe-tokens.json（词典没变就直接用），语法点、规则每次现认。
 *
 * 用法（先要有 npm run data:ja 生成的词典）：
 *   npm run grammar:probe -- --say "雨が降るにちがいない。"     一句话的词素与认出的语法点
 *   npm run grammar:probe -- nichigainai bekida                  这几个语法点在例句里认出的句子（每个最多 12 句）
 *   npm run grammar:probe -- nichigainai --max 40                多列一些
 *   npm run grammar:probe -- --level 3                            N3 每个语法点认出几句、规则放过几句
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { JaAnalyzer } from '../../src/main/ja-analyze'
import { GRAMMAR, GRAMMAR_BY_ID, matchGrammar } from '../../src/shared/ja/grammar'
import type { Rule, RuleRow, Tok } from './rule-kit'
import { BASIC_RULES } from './rules-basic'
import { N3_RULES } from './rules-n3'
import { N3B_RULES } from './rules-n3b'
import { N2_RULES } from './rules-n2'
import { N2B_RULES } from './rules-n2b'
import { N1_RULES } from './rules-n1'
import { N1B_RULES } from './rules-n1b'

const ROOT = process.cwd()
const DB = resolve(ROOT, 'resources/data/ja/dict.sqlite')
const CACHE = resolve(ROOT, '.cache/probe-tokens.json')
const RULES: Record<string, Rule> = {
  ...BASIC_RULES,
  ...N3_RULES,
  ...N3B_RULES,
  ...N2_RULES,
  ...N2B_RULES,
  ...N1_RULES,
  ...N1B_RULES
}

const args = process.argv.slice(2)
const flag = (name: string): string | null => {
  const i = args.indexOf(name)
  return i >= 0 ? (args[i + 1] ?? null) : null
}
const says: string[] = []
const ids: string[] = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--say') says.push(args[++i])
  else if (args[i] === '--max' || args[i] === '--level') i++
  else ids.push(args[i])
}
const max = Number(flag('--max') ?? 12)
const level = flag('--level')

const analyzer = new JaAnalyzer(resolve(ROOT, 'node_modules/kuromoji/dict'))
const show = (t: Tok): string => `${t.s}/${t.b}/${t.pos},${t.p1},${t.p2}/${t.ct}/${t.cf}`

for (const ja of says) {
  const tokens = await analyzer.tokens(ja)
  console.log(`\n${ja}`)
  console.log(tokens.map(show).join('  '))
  for (const h of matchGrammar(tokens))
    console.log(`  ${h.id}（${GRAMMAR_BY_ID.get(h.id)?.name}）：${ja.slice(h.start, h.end)}`)
}

if (ids.length || level) {
  for (const id of ids) if (!GRAMMAR_BY_ID.has(id)) console.warn(`没有这个语法点：${id}`)
  if (!existsSync(DB)) {
    console.error(`没有词典数据库 ${DB}：先跑 npm run data:ja`)
    process.exit(1)
  }
  const rows = await corpus()
  const wanted = level ? GRAMMAR.filter((g) => String(g.level) === level).map((g) => g.id) : ids
  const found = new Map<string, { row: RuleRow; from: number; to: number; ok: boolean }[]>()
  for (const row of rows)
    for (const h of matchGrammar(row.tokens)) {
      if (!wanted.includes(h.id)) continue
      const i = row.tokens.findIndex((t) => t.start === h.start)
      const j = row.tokens.findIndex((t) => t.end === h.end)
      const rule = RULES[h.id]
      const ok =
        !rule || rule(row.tokens[i - 1], row.tokens.slice(i, j + 1), row.tokens.slice(j + 1), row)
      const list = found.get(h.id) ?? found.set(h.id, []).get(h.id)!
      list.push({ row, from: h.start, to: h.end, ok })
    }
  if (level) {
    console.log(`\nN${level}：语法点 认出 规则放过（${rows.length} 句里）`)
    for (const id of wanted) {
      const list = found.get(id) ?? []
      console.log(
        `  ${id.padEnd(22)} ${String(list.length).padStart(5)} ${String(list.filter((x) => x.ok).length).padStart(5)}`
      )
    }
  }
  for (const id of ids) {
    const list = found.get(id) ?? []
    const pass = list.filter((x) => x.ok).length
    console.log(
      `\n${id}（${GRAMMAR_BY_ID.get(id)?.name}）：认出 ${list.length} 句，规则放过 ${pass} 句`
    )
    // 均匀地取几句，看得到各种用法
    const step = Math.max(1, list.length / max)
    for (let k = 0; k < Math.min(max, list.length); k++) {
      const x = list[Math.floor(k * step)]
      const ja = x.row.ja
      console.log(
        `  ${x.ok ? '✓' : '✗'} ${ja.slice(0, x.from)}【${ja.slice(x.from, x.to)}】${ja.slice(x.to)}  #${x.row.id}`
      )
    }
  }
}

/** 词典里的例句分好词（第一次十几秒，之后读缓存） */
async function corpus(): Promise<RuleRow[]> {
  if (existsSync(CACHE) && statSync(CACHE).mtimeMs > statSync(DB).mtimeMs)
    return JSON.parse(readFileSync(CACHE, 'utf8'))
  const db = new DatabaseSync(DB, { readOnly: true })
  const raw = db.prepare('SELECT id, ja FROM example ORDER BY id').all() as {
    id: number
    ja: string
  }[]
  const rows: RuleRow[] = []
  for (const r of raw) {
    const ja = r.ja.trim()
    const tokens = await analyzer.tokens(ja)
    rows.push({
      id: r.id,
      ja,
      tokens: tokens.map(({ s, b, pos, p1, p2, ct, cf, start, end }) => ({
        s,
        b,
        pos,
        p1,
        p2,
        ct,
        cf,
        start,
        end
      }))
    })
  }
  writeFileSync(CACHE, JSON.stringify(rows))
  return rows
}
