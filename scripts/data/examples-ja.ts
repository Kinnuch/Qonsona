/**
 * 语法课的例句：从词典里的 Tatoeba 例句（两万六千多句）挑出用到各个语法点的，每个点留最多 3 句。
 * 分词、认语法点跟阅读器同一套（kuromoji + src/shared/ja/grammar.ts）。
 *
 * 阅读器的「本文语法」宁多勿漏，课里的例句却不能错，所以另加几道筛：
 * - 有文语、方言活用的句子不要（kuromoji 把「いつから」切成 い/つ/から、「もやが」切成 も/や/が 这类误切多半露在这里）；
 * - 个别语法点另有条件，挡掉同形不同义的用法（名词后的から是「从」、どのような 不是「好像」……，见 RULES，
 *   N3 起的在 rules-n3.ts 这些文件里）；
 * - 只有机器翻译的句子，译文得跟原文有共同的汉字（防止译文对错了句）；学习软件里不放的内容不要。
 * 再按难度排：用到比这一级难的词、表外的词、比这一级难的别的语法点都扣分，太长也扣分，有人工中文翻译的优先。
 * 顺带记下每个语法点自带例句（和另写的例句）里那一段的起止。结果写到 data/ja/grammar-examples.json（入库）。
 *
 * 另外按 JLPT 等级挑一批例句给练习与模拟卷的读解、听解题：句子里的实词都在词表里、最难的正好是这一级，
 * 用到的语法也不比这一级难；写到 data/ja/level-sentences.json（入库）。
 *
 * 分词、查词最慢（十来分钟），结果存在 .cache/grammar-scan.json，词典没变就直接用；加 --rescan 重扫。
 * 认语法点每次现做，改了语法点、规则不用重扫。
 * 用法：npm run data:examples（先要有 npm run data:ja 生成的词典）
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { JaAnalyzer } from '../../src/main/ja-analyze'
import { JapaneseDict } from '../../src/main/dict'
import { GRAMMAR_BY_ID, matchGrammar } from '../../src/shared/ja/grammar'
import type { GrammarHit } from '../../src/shared/ja/reader'
import {
  GRAMMAR_COURSE_IDS,
  GRAMMAR_NOTES,
  type GrammarExampleData
} from '../../src/shared/ja/grammar-course'
import { UNSUITABLE, type LevelSentenceData } from '../../src/shared/ja/exam'
import type { Rule, RuleRow } from './rule-kit'
import { BASIC_RULES } from './rules-basic'
import { N3_RULES } from './rules-n3'
import { N3B_RULES } from './rules-n3b'
import { N2_RULES } from './rules-n2'
import { N2B_RULES } from './rules-n2b'
import { N1_RULES } from './rules-n1'
import { N1B_RULES } from './rules-n1b'

const ROOT = process.cwd()
const DB = resolve(ROOT, 'resources/data/ja/dict.sqlite')
const SCAN = resolve(ROOT, '.cache/grammar-scan.json')
const OUT = resolve(ROOT, 'data/ja/grammar-examples.json')
const LEVEL_OUT = resolve(ROOT, 'data/ja/level-sentences.json')
/** 每一级留几句 */
const LEVEL_KEEP = 200
/** 每个语法点留几句 */
const KEEP = 3
/** 太短的看不出用法，太长的初学读不下来 */
const MIN_LEN = 6
const MAX_LEN = 30

if (!existsSync(DB)) {
  console.error(`没有词典数据库 ${DB}：先跑 npm run data:ja`)
  process.exit(1)
}

/** 扫过的一句：分词、实词的 JLPT 等级（null 是表外的词） */
interface Scanned extends RuleRow {
  en: string | null
  zh: string | null
  zhMt: string | null
  levels: (number | null)[]
}

/** 缓存的格式：改了就重扫 */
const SCAN_VERSION = 2

/** 再加上认出的语法点（每次现认） */
interface Row extends Scanned {
  hits: GrammarHit[]
}

/** 不算难度的词性：助词、助动词、符号这些 */
const FUNCTION_POS = new Set(['助詞', '助動詞', '記号', 'フィラー', '接頭詞'])
const wanted = new Set(GRAMMAR_COURSE_IDS)

const analyzer = new JaAnalyzer(resolve(ROOT, 'node_modules/kuromoji/dict'))

/** 一句例句里某个语法点那一段的起止；认不出来是 null */
async function spanOf(id: string, ja: string): Promise<[number, number] | null> {
  const hit = (await analyzer.analyze(ja)).grammar.find((h) => h.id === id)
  if (!hit) console.warn(`自己写的例句里认不出 ${id}：${ja}`)
  return hit ? [hit.start, hit.end] : null
}

/** 分词、查词（一句话的、长短合适、有中文翻译的例句都扫，语法点不在这里认） */
async function scan(): Promise<Scanned[]> {
  const dict = new JapaneseDict(DB)
  const lookup = (base: string, reading: string, inflected: boolean) =>
    dict.word(base, reading, inflected)
  const db = new DatabaseSync(DB, { readOnly: true })
  const raw = db.prepare('SELECT id, ja, en, zh, zh_mt FROM example ORDER BY id').all() as {
    id: number
    ja: string
    en: string | null
    zh: string | null
    zh_mt: string | null
  }[]
  const rows: Scanned[] = []
  for (const r of raw) {
    const ja = r.ja.trim()
    if (ja.length < MIN_LEN || ja.length > MAX_LEN || (!r.zh && !r.zh_mt)) continue
    const a = await analyzer.analyze(ja, lookup)
    // 只要一句话的（分句后多于一句的不要）
    if (a.sentences.length !== 1) continue
    const s = a.sentences[0]
    rows.push({
      id: r.id,
      ja,
      en: r.en,
      zh: r.zh,
      zhMt: r.zh_mt,
      tokens: s.tokens.map(({ s: sf, b, pos, p1, p2, ct, cf, start, end }) => ({
        s: sf,
        b,
        pos,
        p1,
        p2,
        ct,
        cf,
        start,
        end
      })),
      levels: s.words.filter((w) => w.word && !FUNCTION_POS.has(w.pos)).map((w) => w.jlpt ?? null)
    })
  }
  return rows
}

const t0 = Date.now()
const cached = existsSync(SCAN) && statSync(SCAN).mtimeMs > statSync(DB).mtimeMs
const cache = cached
  ? (JSON.parse(readFileSync(SCAN, 'utf8')) as { version?: number; rows: Scanned[] })
  : null
let scannedRows: Scanned[]
if (cache?.version === SCAN_VERSION && !process.argv.includes('--rescan')) scannedRows = cache.rows
else {
  scannedRows = await scan()
  writeFileSync(SCAN, JSON.stringify({ version: SCAN_VERSION, rows: scannedRows }))
}

// 自带例句与另写的例句里语法点那一段
const builtin: Record<string, [number, number] | null> = {}
const more: Record<string, ([number, number] | null)[]> = {}
for (const id of GRAMMAR_COURSE_IDS) {
  builtin[id] = await spanOf(id, GRAMMAR_BY_ID.get(id)!.example)
  const extra = GRAMMAR_NOTES[id]?.more
  if (extra?.length) more[id] = await Promise.all(extra.map((m) => spanOf(id, m.ja)))
}

// 认语法点；用不到课里语法点的句子不要
const rows: Row[] = scannedRows
  .map((r) => ({ ...r, hits: matchGrammar(r.tokens) }))
  .filter((r) => r.hits.some((h) => wanted.has(h.id)))

// ── 筛 ──

/** 文语、方言的活用型 */
const ODD_CONJUGATION = /文語|下二|上二|四段|特殊・ヤ|特殊・ジャ|ラ変|ナ変/

/** 个别语法点的额外条件，挡掉同形不同义的用法（写法见 rule-kit.ts） */
const RULES: Record<string, Rule> = {
  ...BASIC_RULES,
  ...N3_RULES,
  ...N3B_RULES,
  ...N2_RULES,
  ...N2B_RULES,
  ...N1_RULES,
  ...N1B_RULES
}

/** 规则挡不住的成语、别的意思，按例句号去掉（虫がよすぎる、これよりほかに手はない） */
const EXCLUDE = new Set([126321, 194478])

const KANJI = /[㐀-鿿]/g
/** 只有机器翻译时，译文得跟原文有共同的汉字（原文有两个以上汉字才查） */
function translationPlausible(row: Scanned): boolean {
  if (row.zh) return true
  const ja = new Set(row.ja.match(KANJI) ?? [])
  if (ja.size < 2) return true
  return [...(row.zhMt ?? '')].some((c) => ja.has(c))
}

interface Candidate {
  row: Row
  hit: GrammarHit
  score: number
}

const byPoint = new Map<string, Candidate[]>()
for (const row of rows) {
  if (row.tokens.some((t) => ODD_CONJUGATION.test(t.ct))) continue
  if (EXCLUDE.has(row.id) || UNSUITABLE.test(row.ja) || !translationPlausible(row)) continue
  for (const id of new Set(row.hits.map((h) => h.id))) {
    if (!wanted.has(id)) continue
    const hit = row.hits.find((h) => h.id === id)!
    const i = row.tokens.findIndex((t) => t.start === hit.start)
    const j = row.tokens.findIndex((t) => t.end === hit.end)
    if (i < 0 || j < 0) continue
    const rule = RULES[id]
    if (rule && !rule(row.tokens[i - 1], row.tokens.slice(i, j + 1), row.tokens.slice(j + 1), row))
      continue
    const level = GRAMMAR_BY_ID.get(id)!.level
    // 比这一级难的词（JLPT 数字越小越难）、表外的词、比这一级难的别的语法点
    const hard = row.levels.filter((l) => l == null || l < level).length
    const harder = row.hits.filter(
      (h) => h.id !== id && (GRAMMAR_BY_ID.get(h.id)?.level ?? 5) < level
    ).length
    const score =
      hard * 3 + harder * 2 + Math.max(0, row.ja.length - 16) * 0.25 + (row.zh ? 0 : 2.5)
    const list = byPoint.get(id) ?? byPoint.set(id, []).get(id)!
    list.push({ row, hit, score })
  }
}

// 每个语法点挑分数最低的几句；标点去掉后一样的句子只留一句
const norm = (s: string): string => s.replace(/[、。！？「」『』（）\s]/g, '')
const points: GrammarExampleData['points'] = {}
for (const id of GRAMMAR_COURSE_IDS) {
  const picked: Candidate[] = []
  for (const c of (byPoint.get(id) ?? []).sort(
    (a, b) => a.score - b.score || a.row.id - b.row.id
  )) {
    if (picked.length >= KEEP) break
    if (picked.some((p) => norm(p.row.ja) === norm(c.row.ja))) continue
    picked.push(c)
  }
  points[id] = {
    builtin: builtin[id],
    ...(more[id] && { more: more[id] }),
    corpus: picked.map(({ row, hit }) => ({
      id: row.id,
      ja: row.ja,
      en: row.en,
      zh: row.zh ?? row.zhMt,
      zhMachine: !row.zh,
      start: hit.start,
      end: hit.end
    }))
  }
}

const out: GrammarExampleData = { generated: new Date().toISOString().slice(0, 10), points }
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')

// ── 按级挑的例句：实词都在词表里（没有表外的词）、最难的正好是这一级，语法也不比这一级难 ──
const levels: LevelSentenceData['levels'] = {}
for (const L of [5, 4, 3, 2, 1]) {
  const seen = new Set<string>()
  levels[L] = rows
    .filter(
      (r) =>
        r.levels.length >= 2 &&
        r.levels.every((l) => l != null) &&
        Math.min(...(r.levels as number[])) === L &&
        r.hits.every((h) => (GRAMMAR_BY_ID.get(h.id)?.level ?? 5) >= L) &&
        !r.tokens.some((t) => ODD_CONJUGATION.test(t.ct)) &&
        !EXCLUDE.has(r.id) &&
        !UNSUITABLE.test(r.ja) &&
        translationPlausible(r)
    )
    // 有人工中文翻译的在前，长短适中（16 个字上下）的在前
    .sort(
      (a, b) =>
        (a.zh ? 0 : 1) - (b.zh ? 0 : 1) ||
        Math.abs(a.ja.length - 16) - Math.abs(b.ja.length - 16) ||
        a.id - b.id
    )
    .filter((r) => !seen.has(norm(r.ja)) && !!seen.add(norm(r.ja)))
    .slice(0, LEVEL_KEEP)
    .map((r) => ({ id: r.id, ja: r.ja, zh: r.zh ?? r.zhMt, en: r.en, zhMachine: !r.zh }))
}
const levelOut: LevelSentenceData = { generated: out.generated, levels }
writeFileSync(LEVEL_OUT, JSON.stringify(levelOut, null, 1) + '\n')
const missing = GRAMMAR_COURSE_IDS.filter((id) => !points[id].corpus.length)
const unmatched = GRAMMAR_COURSE_IDS.filter(
  (id) => !builtin[id] || (more[id] ?? []).some((m) => !m)
)
console.log(
  `${rows.length} 句用到了课里的语法点，用时 ${((Date.now() - t0) / 1000).toFixed(0)} 秒；` +
    `${GRAMMAR_COURSE_IDS.length - missing.length} 个语法点找到例句` +
    (missing.length ? `，没找到：${missing.join(' ')}` : '') +
    (unmatched.length ? `；自己写的例句认不出：${unmatched.join(' ')}` : '') +
    `；按级的例句 ${[5, 4, 3, 2, 1].map((L) => `N${L} ${levels[L].length}`).join('、')}`
)
