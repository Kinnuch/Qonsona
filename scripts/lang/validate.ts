/**
 * 检查一门语言的词典数据库合不合 docs/lang-kit.md 的约定；不合格时退出码 1。
 *   node scripts/data/run-ts.mjs scripts/lang/validate.ts fr
 * 查：meta 齐不齐、来源写全没有、词条 JSON 的形状、词性与分级对不对得上 spec、查词键是不是 rules.key() 算的、
 * 例句与词表的引用有没有断的；最后列出数目、大小、有中文 / IPA / 录音的比例、各级多少词。
 */
import { DatabaseSync } from 'node:sqlite'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { LANGS, isLangCode } from '../../src/shared/lang/registry'
import { primarySystem } from '../../src/shared/lang/levels'
import type { LexEntryData, SourceRef } from '../../src/shared/lang/types'
import { SCHEMA_VERSION, unpackEntry } from '../../src/main/lang/lexdb-schema'
import { POS_TAGS, dataDir } from './lexdb-writer'

const code = process.argv[2] ?? ''
if (!isLangCode(code)) {
  console.error(
    `用法：node scripts/data/run-ts.mjs scripts/lang/validate.ts <${Object.keys(LANGS).join('|')}>`
  )
  process.exit(2)
}
const lang = LANGS[code]
const file = process.argv[3] ?? join(dataDir(code), 'dict.sqlite')
if (!existsSync(file)) {
  console.error(`没有 ${file}`)
  process.exit(1)
}
const db = new DatabaseSync(file, { readOnly: true })
const errors: string[] = []
const warn: string[] = []
const err = (m: string): void => void (errors.length < 60 && errors.push(m))

// meta
const meta = new Map(
  (db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[]).map((r) => [
    r.key,
    r.value
  ])
)
if (meta.get('schema') !== SCHEMA_VERSION)
  err(`meta.schema 是 ${meta.get('schema')}，应为 ${SCHEMA_VERSION}`)
if (meta.get('lang') !== code) err(`meta.lang 是 ${meta.get('lang')}`)
let sources: SourceRef[] = []
try {
  sources = JSON.parse(meta.get('sources') ?? '[]')
} catch {
  err('meta.sources 不是 JSON')
}
if (!sources.length) err('meta.sources 是空的')
for (const s of sources)
  for (const k of ['id', 'name', 'license', 'credit', 'home'] as const)
    if (!s[k]) err(`来源 ${s.id ?? '?'} 缺 ${k}`)
const sourceIds = new Set(sources.map((s) => s.id))

// 分级
const systems = new Map(
  lang.spec.levelSystems.map((s) => [s.id, new Set(s.levels.map((l) => l.id))])
)
const primary = primarySystem(lang.spec.levelSystems)

// 词条
const total = Number((db.prepare('SELECT COUNT(*) AS n FROM entry').get() as { n: number }).n)
if (!total) err('一个词条都没有')
const sample = db
  .prepare(
    `SELECT id, w, p, fr, lv, data FROM entry WHERE id IN (
       SELECT id FROM entry ORDER BY fr IS NULL, fr LIMIT 300
     ) OR id IN (SELECT id FROM entry ORDER BY random() LIMIT 700)`
  )
  .all() as {
  id: number
  w: string
  p: string
  fr: number | null
  lv: string | null
  data: Uint8Array
}[]
let withZh = 0
let withMtZh = 0
let withIpa = 0
let withAudio = 0
let withLevel = 0
let withForms = 0
for (const r of sample) {
  let d: LexEntryData
  try {
    d = unpackEntry(r.data)
  } catch (e) {
    err(`词条 ${r.id} 的 data 解不开：${e}`)
    continue
  }
  const where = `词条 ${r.id}「${d.w}」`
  if (d.w !== r.w) err(`${where}：entry.w 跟 data.w 不一样`)
  if (!Array.isArray(d.p) || !d.p.length || d.p.some((p) => !POS_TAGS.includes(p)))
    err(`${where}：词性 ${d.p}`)
  if (d.p[0] !== r.p) err(`${where}：entry.p 不是第一个词性`)
  if (!Array.isArray(d.s) || !d.s.length) err(`${where}：没有义项`)
  for (const s of d.s ?? []) {
    if (!s.en?.length && !s.zh?.length && !s.mono?.length) err(`${where}：有义项没有任何释义`)
    if (s.zh?.length && !s.zs) err(`${where}：有中文释义却没写来源 zs`)
    if (s.zs && !sourceIds.has(s.zs)) err(`${where}：中文释义的来源 ${s.zs} 没登记`)
    if (s.p?.some((p) => !POS_TAGS.includes(p))) err(`${where}：义项词性 ${s.p}`)
  }
  for (const id of d.src ?? []) if (!sourceIds.has(id)) err(`${where}：来源 ${id} 没登记`)
  for (const [system, value] of Object.entries(d.lv ?? {})) {
    const levels = systems.get(system)
    if (!levels) err(`${where}：分级体系 ${system} 不在 spec 里`)
    else
      for (const l of Array.isArray(value) ? value : [value])
        if (!levels.has(l)) err(`${where}：${system} 没有 ${l}`)
  }
  const pv = d.lv?.[primary.id]
  if ((Array.isArray(pv) ? pv[0] : (pv ?? null)) !== r.lv)
    err(`${where}：entry.lv（${r.lv}）跟主分级 ${primary.id} 对不上`)
  if (d.fr !== undefined && d.fr !== r.fr) err(`${where}：entry.fr 跟 data.fr 不一样`)
  for (const f of d.f ?? [])
    if (!Array.isArray(f) || typeof f[0] !== 'string')
      err(`${where}：变形表的一项不是 [形式, ...标签]`)
  if (d.s?.some((s) => s.zh?.length)) withZh++
  if (d.s?.some((s) => s.zs?.startsWith('mt-'))) withMtZh++
  if (d.ipa?.length) withIpa++
  if (d.au?.length) withAudio++
  if (d.lv && Object.keys(d.lv).length) withLevel++
  if (d.f?.length) withForms++
}

// 查词键
const forms = db
  .prepare('SELECT key, form, loose FROM form ORDER BY random() LIMIT 2000')
  .all() as {
  key: string
  form: string
  loose: number
}[]
for (const f of forms) {
  const want = f.loose ? lang.rules.looseKey?.(f.form) : lang.rules.key(f.form)
  if (want !== f.key)
    err(`查词键「${f.key}」不是 rules.${f.loose ? 'looseKey' : 'key'}(「${f.form}」) = 「${want}」`)
}
const orphanForms = Number(
  (
    db
      .prepare('SELECT COUNT(*) AS n FROM form WHERE entry NOT IN (SELECT id FROM entry)')
      .get() as { n: number }
  ).n
)
if (orphanForms) err(`${orphanForms} 个查词键指向不存在的词条`)

// 例句与词表
const exCount = Number((db.prepare('SELECT COUNT(*) AS n FROM example').get() as { n: number }).n)
const orphanEx = Number(
  (
    db
      .prepare(
        'SELECT COUNT(*) AS n FROM example_entry WHERE entry NOT IN (SELECT id FROM entry) OR example NOT IN (SELECT id FROM example)'
      )
      .get() as { n: number }
  ).n
)
if (orphanEx) err(`${orphanEx} 条例句挂接指向不存在的词条或例句`)
for (const r of db.prepare('SELECT zs, src, COUNT(*) AS n FROM example GROUP BY zs, src').all() as {
  zs: string | null
  src: string | null
  n: number
}[]) {
  if (r.zs && !sourceIds.has(r.zs)) err(`例句的中文来源 ${r.zs} 没登记`)
  if (r.src && !sourceIds.has(r.src)) err(`例句来源 ${r.src} 没登记`)
}
const lists = db
  .prepare('SELECT name, COUNT(*) AS n FROM list GROUP BY name ORDER BY name')
  .all() as {
  name: string
  n: number
}[]
for (const l of lists) {
  const [system, level] = l.name.split(':')
  if (system === 'theme' || system === 'x') continue
  if (!systems.get(system)?.has(level ?? ''))
    err(`词表 ${l.name} 不是 spec 里的分级，也不是 theme: / x: 开头`)
}
const orphanList = Number(
  (
    db
      .prepare('SELECT COUNT(*) AS n FROM list WHERE entry NOT IN (SELECT id FROM entry)')
      .get() as { n: number }
  ).n
)
if (orphanList) err(`${orphanList} 个词表条目指向不存在的词条`)
const primaryCounts = primary.levels.map((l) => {
  const n = Number(
    (db.prepare('SELECT COUNT(*) AS n FROM entry WHERE lv = ?').get(l.id) as { n: number }).n
  )
  if (!n) warn.push(`主分级 ${primary.id} 的 ${l.id} 一个词都没有`)
  return `${l.id} ${n}`
})

const pct = (n: number): string => `${Math.round((n / Math.max(1, sample.length)) * 100)}%`
console.log(`${code}：${file}  ${(statSync(file).size / 1048576).toFixed(1)} MB`)
console.log(
  `  词条 ${total}，查词键 ${Number((db.prepare('SELECT COUNT(*) AS n FROM form').get() as { n: number }).n)}，例句 ${exCount}`
)
console.log(
  `  抽查 ${sample.length} 条：有中文 ${pct(withZh)}（机器翻译 ${pct(withMtZh)}），IPA ${pct(withIpa)}，录音 ${pct(withAudio)}，有分级 ${pct(withLevel)}，有变形表 ${pct(withForms)}`
)
console.log(`  主分级 ${primary.id}：${primaryCounts.join('，')}`)
console.log(`  词表：${lists.map((l) => `${l.name} ${l.n}`).join('，') || '（没有）'}`)
console.log(`  来源：${sources.map((s) => `${s.id}（${s.license}）`).join('，')}`)
for (const w of warn) console.log(`  注意：${w}`)
if (errors.length) {
  console.log(`\n不合格（${errors.length}${errors.length >= 60 ? '+' : ''} 处）：`)
  for (const e of errors) console.log(`  - ${e}`)
  process.exit(1)
}
console.log('合格')
