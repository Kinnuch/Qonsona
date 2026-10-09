#!/usr/bin/env node
/**
 * 生成日语词典数据库 resources/data/ja/dict.sqlite（不入库，打包前先跑：npm run data:ja）。
 *
 * 数据：JMdict（词条、英文释义、Tatoeba 例句编号）、JLPT 词汇分级、KANJIDIC2 + kanji-data（汉字）、
 * KanjiVG（笔顺）、Tatoeba 日中对照（例句的中文翻译）、data/zh/ 下的中文释义（见 zh.mjs）。
 * 来源与许可见 sources.mjs，写进 meta 表，软件的「关于」里列出来。
 */
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { SOURCES, fetchAll, readBz2Text, readGzipText, readZipText, root } from './sources.mjs'
import { loadChinese } from './zh.mjs'

const OUT_DIR = join(root, 'resources/data/ja')
const OUT = join(OUT_DIR, 'dict.sqlite')

const t0 = Date.now()
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`)

const files = await fetchAll()

// ───────────────────────── 读原始数据 ─────────────────────────

const jm = JSON.parse(readZipText(files.jmdict))
log(`JMdict ${jm.version} / ${jm.dictDate}：${jm.words.length} 个词条`)

/** JLPT：jmdict_seq → 5..1（N5 = 5）；同一个词在几级里出现时取最容易的 */
const jlpt = new Map()
/**
 * 表里只写了假名的词（それ、これ）→ 等级。表把它们对到了冷僻的纯假名词条（感叹词「それ」），
 * 常用的「其れ」「此れ」却只在 N1 表里——建词条时按假名再对一次，见下面的 level
 */
const jlptKana = new Map()
files.jlpt.forEach((path, i) => {
  const level = 5 - i
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/).slice(1)) {
    const [seqText, kana, kanji] = line.split(',')
    const seq = Number(seqText)
    if (seq && !(jlpt.get(seq) >= level)) jlpt.set(seq, level)
    if (seq && kana && !kanji && !(jlptKana.get(kana) >= level)) jlptKana.set(kana, level)
  }
})
log(`JLPT 词汇：${jlpt.size} 个词条`)

/** Tatoeba：日语句子编号 → 中文翻译（取第一条） */
const cmn = new Map()
for (const line of readBz2Text(files.tatoebaCmn).split('\n')) {
  const [id, , text] = line.split('\t')
  if (id && text) cmn.set(id, text)
}
const jaToZh = new Map()
for (const line of readBz2Text(files.tatoebaLinks).split('\n')) {
  const [ja, zh] = line.split('\t')
  if (ja && zh && cmn.has(zh.trim()) && !jaToZh.has(ja)) jaToZh.set(ja, cmn.get(zh.trim()))
}
log(`Tatoeba：${jaToZh.size} 个日语句子有中文翻译`)

const zhGloss = loadChinese()
log(`自己翻译的中文释义：${zhGloss.size} 个词条`)

/**
 * Tomoshi 开放数据：自己没翻译的词条用它的中文释义；例句的中文翻译补 Tatoeba 没有的；
 * 另有中日同形词对照、汉字中文字义、自他动词配对。
 */
const tomo = new DatabaseSync(files.tomoshi, { readOnly: true })
const tomoDefs = tomo.prepare("SELECT data FROM zh_defs WHERE entry_id = ? AND locale = 'zh-CN'")
/** Tomoshi 一个词条：[{ glosses: 中文, examples: [例句中文翻译] }]（按义项顺序） */
function tomoshiSenses(id) {
  const row = tomoDefs.get(String(id))
  if (!row) return []
  const senses = JSON.parse(row.data).senses ?? {}
  return Object.keys(senses)
    .sort((a, b) => a - b)
    .map((k) => ({
      text: (senses[k].glosses ?? []).map((g) => g.text).join('；'),
      examples: Object.keys(senses[k].examples ?? {})
        .sort((a, b) => a - b)
        .map((i) => senses[k].examples[i])
    }))
}

// ───────────────────────── 建库 ─────────────────────────

mkdirSync(OUT_DIR, { recursive: true })
if (existsSync(OUT)) rmSync(OUT)
const db = new DatabaseSync(OUT)
db.exec(`
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- 词条：data 是 deflate-raw 压缩的紧凑 JSON（见 src/shared/dict.ts 的 RawEntry）
CREATE TABLE entry (
  id INTEGER PRIMARY KEY,
  head TEXT NOT NULL,
  reading TEXT NOT NULL,
  common INTEGER NOT NULL,
  jlpt INTEGER,
  score INTEGER NOT NULL,
  data BLOB NOT NULL
);
-- 每个写法（汉字写法、假名写法）一行，查词先查这里；按主键存，不另建索引
CREATE TABLE form (
  text TEXT NOT NULL, entry INTEGER NOT NULL, kana INTEGER NOT NULL, common INTEGER NOT NULL,
  PRIMARY KEY (text, entry, kana)
) WITHOUT ROWID;
-- 释义整条对上（英文去掉开头的 to、小写；中文按分号拆开）
CREATE TABLE gloss_key (
  key TEXT NOT NULL, lang TEXT NOT NULL, entry INTEGER NOT NULL,
  PRIMARY KEY (key, lang, entry)
) WITHOUT ROWID;
-- 英文释义按单词全文检索。不存原文，rowid 就是词条号，同一个词条的几条释义拼成一行。
-- 中文释义不进全文检索（汉字逐字建索引太大），靠 gloss_key 整条或开头对上
CREATE VIRTUAL TABLE gloss USING fts5(text, content = '', columnsize = 0, detail = 'none', tokenize = 'unicode61 remove_diacritics 2');
-- 例句：zh 是 Tatoeba 上人工翻译的中文，zh_mt 是 Tomoshi 的机器翻译（没有人工翻译时用）
CREATE TABLE example (id INTEGER PRIMARY KEY, ja TEXT NOT NULL, en TEXT, zh TEXT, zh_mt TEXT);
CREATE TABLE kanji (ch TEXT PRIMARY KEY, data TEXT NOT NULL, strokes BLOB);
CREATE TABLE kanji_word (ch TEXT NOT NULL, entry INTEGER NOT NULL, rank INTEGER NOT NULL);
-- 中日同形词对照：中文说法 → 日语里该用哪个词（Tomoshi）
CREATE TABLE cn_contrast (cn TEXT PRIMARY KEY, summary TEXT NOT NULL, items TEXT NOT NULL);
-- 自他动词配对（Tomoshi）：role 是这个词条自己的角色（transitive / intransitive）
CREATE TABLE verb_pair (entry INTEGER NOT NULL, other INTEGER NOT NULL, role TEXT NOT NULL);
`)

const insEntry = db.prepare('INSERT INTO entry VALUES (?, ?, ?, ?, ?, ?, ?)')
const insForm = db.prepare('INSERT OR IGNORE INTO form VALUES (?, ?, ?, ?)')
const insKey = db.prepare('INSERT OR IGNORE INTO gloss_key VALUES (?, ?, ?)')
const insGloss = db.prepare('INSERT INTO gloss (rowid, text) VALUES (?, ?)')
const insExample = db.prepare('INSERT OR IGNORE INTO example VALUES (?, ?, ?, ?, ?)')

/** 英文释义的匹配键：小写、去掉开头的 to / a / an / the 与括号注 */
const enKey = (s) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^\s*(to|a|an|the)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
const zhKeys = (s) =>
  s
    .split(/[；;，,、／/]/)
    .map((x) => x.replace(/[（(][^）)]*[）)]/g, '').trim())
    .filter(Boolean)

/** 只在拼写检索里用、不显示的写法（sK / sk），显示时跳过 */
const hidden = (tags) => tags.includes('sK') || tags.includes('sk')

/** 压缩存储：JSON → deflate-raw（笔顺这种大块的直接压） */
const pack = (o) => deflateRawSync(Buffer.from(JSON.stringify(o)), { level: 9 })

/**
 * 词条每条只有一百多字节，单独压几乎压不动；先从样本里挑出常见片段做一份预置字典（存进 meta.zdict），
 * 每条压缩、解压都用它，数据小四成左右。
 */
function buildDictionary(strings) {
  const counts = new Map()
  strings.forEach((s, idx) => {
    if (idx % 50) return
    for (const n of [6, 10, 16])
      for (let i = 0; i + n <= s.length; i += 2) {
        const g = s.slice(i, i + n)
        counts.set(g, (counts.get(g) ?? 0) + 1)
      }
  })
  const top = [...counts.entries()]
    .filter(([, c]) => c > 20)
    .sort((a, b) => b[1] * b[0].length - a[1] * a[0].length)
    .slice(0, 4000)
    .map(([g]) => g)
  // 越常见的放越后面（离要压的数据越近，引用距离越短）
  let dict = ''
  for (const g of top.reverse()) {
    if (!dict.includes(g)) dict += g
    if (dict.length > 32000) break
  }
  return Buffer.from(dict)
}

const compact = (o) => {
  for (const k of Object.keys(o)) if (Array.isArray(o[k]) && !o[k].length) delete o[k]
  return o
}

/** 写法：没有标记时只存文字；有时存 [文字, 常用, 标记, 只配哪几个汉字写法]，末尾空的省掉 */
function slimForm(text, common, tags, applies = []) {
  const a = [text, common ? 1 : 0, tags, applies]
  while (a.length > 1 && (Array.isArray(a.at(-1)) ? !a.at(-1).length : !a.at(-1))) a.pop()
  return a.length === 1 ? text : a
}

let examples = 0
/** 先把每个词条算好，建完预置字典再一起写 */
const rows = []
db.exec('BEGIN')
for (const w of jm.words) {
  const id = Number(w.id)
  const kanji = w.kanji.filter((k) => !hidden(k.tags))
  const kana = w.kana.filter((k) => !hidden(k.tags))
  const head = (kanji[0] ?? kana[0] ?? w.kana[0]).text
  const reading = (kana[0] ?? w.kana[0]).text
  const common = w.kanji.some((k) => k.common) || w.kana.some((k) => k.common) ? 1 : 0
  // 常用、通常写假名（第一个义项标 uk）的词条，按假名也对一次 JLPT 表，取容易的那级
  const kanaLevel = common && w.sense[0]?.misc?.includes('uk') ? (jlptKana.get(reading) ?? 0) : 0
  const level = Math.max(jlpt.get(id) ?? 0, kanaLevel) || null
  const tomoSenses = tomoshiSenses(id)
  let exampleCount = 0
  const senses = w.sense.map((s, si) => {
    // Tomoshi 的例句翻译按 JMdict 里例句的先后对应（它的例句就是 JMdict 这份）
    const tomoEx = tomoSenses[si]?.examples ?? []
    const ex = (s.examples ?? [])
      .map((e, ei) => {
        if (e.source?.type !== 'tatoeba') return null
        const ja = e.sentences.find((x) => x.lang === 'jpn')?.text
        const en = e.sentences.find((x) => x.lang === 'eng')?.text ?? null
        if (!ja) return null
        const zh = jaToZh.get(e.source.value) ?? null
        insExample.run(Number(e.source.value), ja, en, zh, zh ? null : (tomoEx[ei] ?? null))
        exampleCount++
        return Number(e.source.value)
      })
      .filter(Boolean)
    return compact({
      p: s.partOfSpeech,
      g: s.gloss.map((g) => g.text),
      m: s.misc,
      f: s.field,
      d: s.dialect,
      i: s.info,
      x: s.related.map((r) => r.filter((v) => typeof v === 'string').join('・')),
      a: s.antonym.map((r) => r.filter((v) => typeof v === 'string').join('・')),
      k: s.appliesToKanji[0] === '*' ? [] : s.appliesToKanji,
      r: s.appliesToKana[0] === '*' ? [] : s.appliesToKana,
      e: ex
    })
  })
  examples += exampleCount
  // 中文释义：自己翻译过的用自己的，没翻译的用 Tomoshi 的（义项数对得上才用）。
  // 存进词条数据：z 与义项一一对应，zs 是来源
  const own = zhGloss.get(id) ?? []
  let z = null
  let zs = null
  if (own.length) {
    z = w.sense.map((_, i) =>
      own
        .filter((x) => x.sense === i)
        .map((x) => x.text)
        .join('；')
    )
    zs = own[0].source
  } else if (tomoSenses.length === w.sense.length && tomoSenses.some((t) => t.text)) {
    z = tomoSenses.map((t) => t.text)
    zs = 'tomoshi'
  }
  for (const text of z ?? []) for (const k of zhKeys(text)) insKey.run(k, 'zh', id)
  const data = compact({
    k: w.kanji.map((k) => slimForm(k.text, k.common, k.tags)),
    r: w.kana.map((k) =>
      slimForm(k.text, k.common, k.tags, k.appliesToKanji[0] === '*' ? [] : k.appliesToKanji)
    ),
    s: senses,
    z: z ?? [],
    zs: zs ? [zs] : []
  })
  // 排序分：常用词、JLPT（越基础越前）、例句多的在前
  const score = common * 1000 + (level ? 200 + level * 20 : 0) + Math.min(exampleCount, 50)
  rows.push([id, head, reading, common, level, score, JSON.stringify(data)])
  for (const k of w.kanji) insForm.run(k.text, id, 0, k.common ? 1 : 0)
  for (const k of w.kana) insForm.run(k.text, id, 1, k.common ? 1 : 0)
  const glosses = w.sense.flatMap((s) => s.gloss.map((g) => g.text))
  insGloss.run(id, glosses.join(' ‖ '))
  for (const g of glosses) if (enKey(g)) insKey.run(enKey(g), 'en', id)
}
const zdict = buildDictionary(rows.map((r) => r[6]))
for (const r of rows)
  insEntry.run(...r.slice(0, 6), deflateRawSync(Buffer.from(r[6]), { level: 9, dictionary: zdict }))
db.exec('COMMIT')
log(`词条写完，例句引用 ${examples} 处；预置字典 ${zdict.length} 字节`)

// ───────────────────────── 汉字 ─────────────────────────

const kd = JSON.parse(readZipText(files.kanjidic))
const kdata = JSON.parse(readFileSync(files.kanjiLevels, 'utf8'))
const vg = readGzipText(files.kanjivg)
const strokes = new Map()
for (const m of vg.matchAll(/<kanji id="kvg:kanji_([0-9a-f]+)">([\s\S]*?)<\/kanji>/g)) {
  const ch = String.fromCodePoint(parseInt(m[1], 16))
  const paths = [...m[2].matchAll(/<path [^>]*\bd="([^"]+)"/g)].map((p) => p[1])
  if (paths.length) strokes.set(ch, paths)
}
log(`KanjiVG：${strokes.size} 个字有笔顺`)

/** 拼音的数字调号换成调号符号：shi2 → shí */
function pinyin(s) {
  const tone = Number(s.slice(-1))
  let base = /[1-5]$/.test(s) ? s.slice(0, -1) : s
  base = base.replace('u:', 'ü').replace('v', 'ü')
  if (!(tone >= 1 && tone <= 4)) return base
  const marks = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' }
  const at = /[ae]/.exec(base) ?? /ou/.exec(base) ?? /[aeiouü](?=[^aeiouü]*$)/.exec(base)
  if (!at) return base
  const v = base[at.index]
  return base.slice(0, at.index) + marks[v][tone - 1] + base.slice(at.index + 1)
}

const insKanji = db.prepare('INSERT INTO kanji VALUES (?, ?, ?)')
const kanjiZh = new Map(
  tomo
    .prepare("SELECT literal, zho FROM kanji_gloss WHERE locale = 'zh-CN'")
    .all()
    .map((r) => [r.literal, JSON.parse(r.zho)])
)
const seenKanji = new Set()
db.exec('BEGIN')
for (const c of kd.characters) {
  const g = c.readingMeaning?.groups ?? []
  const readings = g.flatMap((x) => x.readings)
  const extra = kdata[c.literal]
  const data = compact({
    on: readings.filter((r) => r.type === 'ja_on').map((r) => r.value),
    kun: readings.filter((r) => r.type === 'ja_kun').map((r) => r.value),
    nanori: c.readingMeaning?.nanori ?? [],
    en: g.flatMap((x) => x.meanings.filter((m) => m.lang === 'en').map((m) => m.value)),
    // 中文字义（Tomoshi，由 KANJIDIC2 的英文字义翻译）
    zh: kanjiZh.get(c.literal) ?? [],
    py: [...new Set(readings.filter((r) => r.type === 'pinyin').map((r) => pinyin(r.value)))],
    sc: c.misc.strokeCounts[0] ?? null,
    gr: c.misc.grade ?? null,
    fr: c.misc.frequency ?? null,
    // 新 JLPT（N5–N1）优先用 kanji-data 的，没有就空着（KANJIDIC2 里的是 2010 年以前的四级制）
    jl: extra?.jlpt_new ?? null,
    rad: c.radicals.find((r) => r.type === 'classical')?.value ?? null
  })
  seenKanji.add(c.literal)
  const s = strokes.get(c.literal)
  insKanji.run(c.literal, JSON.stringify(data), s ? pack(s) : null)
}
// 假名等 KANJIDIC2 里没有、KanjiVG 里有的字：只存笔顺
for (const [ch, s] of strokes)
  if (!seenKanji.has(ch)) insKanji.run(ch, JSON.stringify({ sc: s.length }), pack(s))
db.exec('COMMIT')
log(`汉字：${kd.characters.length} 个`)

// 每个汉字最常用的 40 个词
db.exec('BEGIN')
const insKW = db.prepare('INSERT INTO kanji_word VALUES (?, ?, ?)')
const byKanji = new Map()
for (const row of db
  .prepare(
    'SELECT f.text, f.entry, e.score FROM form f JOIN entry e ON e.id = f.entry WHERE f.kana = 0'
  )
  .iterate()) {
  for (const ch of new Set(row.text)) {
    if (!seenKanji.has(ch)) continue
    let list = byKanji.get(ch)
    if (!list) byKanji.set(ch, (list = new Map()))
    const prev = list.get(row.entry)
    if (prev === undefined || prev < row.score) list.set(row.entry, row.score)
  }
}
for (const [ch, list] of byKanji)
  [...list.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 40)
    .forEach(([entry], i) => insKW.run(ch, entry, i))
db.exec('COMMIT')

// ───────────────────────── Tomoshi 的对照与配对 ─────────────────────────

db.exec('BEGIN')
const insContrast = db.prepare('INSERT OR IGNORE INTO cn_contrast VALUES (?, ?, ?)')
for (const r of tomo
  .prepare("SELECT cn, summary, items FROM cn_contrast WHERE locale = 'zh-CN'")
  .iterate())
  insContrast.run(r.cn, r.summary, r.items)
const insPair = db.prepare('INSERT INTO verb_pair VALUES (?, ?, ?)')
for (const r of tomo
  .prepare('SELECT entry_id, counterpart_entry_id, role FROM verb_pairs')
  .iterate())
  insPair.run(Number(r.entry_id), Number(r.counterpart_entry_id), r.role)
db.exec('COMMIT')
tomo.close()
log('中日同形词对照、自他动词配对写完')

// ───────────────────────── 索引与说明 ─────────────────────────

db.exec(`
CREATE INDEX kanji_word_ch ON kanji_word (ch, rank);
CREATE INDEX verb_pair_entry ON verb_pair (entry);
`)
const insMeta = db.prepare('INSERT INTO meta VALUES (?, ?)')
insMeta.run('jmdict', `${jm.version} (${jm.dictDate})`)
insMeta.run('zdict', zdict.toString('base64'))
insMeta.run('tags', JSON.stringify(jm.tags))
insMeta.run(
  'sources',
  JSON.stringify(
    Object.values(SOURCES)
      .filter((s) => s.name)
      .map(({ name, license, credit, home }) => ({ name, license, credit, home }))
      .concat(loadChinese.sources())
  )
)
insMeta.run('builtAt', new Date().toISOString())
db.exec('ANALYZE; VACUUM;')
db.close()
log(`写好 ${OUT}：${(statSync(OUT).size / 1e6).toFixed(1)} MB`)
