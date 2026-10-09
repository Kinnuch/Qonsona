/**
 * 生成苏格兰盖尔语词典库 resources/data/gd/dict.sqlite（不入库）：
 *   node scripts/data/run-ts.mjs scripts/data/gd/build.ts
 * 然后校验：node scripts/data/run-ts.mjs scripts/lang/validate.ts gd
 *
 * 步骤：下载（.cache/data/gd/，已有的跳过）→ 维基词典词条整理（kaikki.ts）→ 中文释义与盖尔语释义（zh.ts）
 * → 三份语料的词频（freq.ts）→ 分级（levels.ts）→ Tatoeba 例句（examples.ts）→ 写库 → data/gd/zh-todo.txt。
 * 来源与许可见 sources.ts 与 docs/lang/gd.md。
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CEFR_LEVELS, type CefrLevel, type LexEntryData } from '../../../src/shared/lang/types'
import { gdKey } from '../../../src/shared/lang/gd/rules'
import { LexDbWriter, ROOT } from '../../lang/lexdb-writer'
import { readTatoeba } from './examples'
import {
  FormIndex,
  WEIGHTS,
  combine,
  countArcosg,
  countForms,
  countWikiForms,
  readLearnGaelic
} from './freq'
import { addPhraseParts, buildEntries, finishEntry, readKaikki, refoldOrphans } from './kaikki'
import { CUTOFFS, assignLevels, readCore, resolveCore } from './levels'
import { CACHE, SRC, fetchAll, linguaLibre, untarGz } from './sources'
import { readSupplement } from './supplement'
import { Wordnet } from './wordnet'
import { T2S, applyZhWiktionary } from './zh'

const t0 = Date.now()
const log = (msg: string): void => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`)

const files = await fetchAll()

// ───────────────────────── 词条 ─────────────────────────

const { entries, stats } = buildEntries(readKaikki(files.kaikki))
log(
  `维基词典：读 ${stats.read} 页，成 ${stats.entries} 个词条；「某词的某形式」${stats.folded} 页并进原形，` +
    `${stats.orphanForms} 个找不到原形的单独成条；变形表去掉 ${stats.formsDropped} 个模板残留`
)

// Lingua Libre 的录音（维基词典上没挂的）
const ll = await linguaLibre()
let llAdded = 0
{
  const byKey = new Map<string, number[]>()
  entries.forEach((e, i) => {
    const k = gdKey(e.data.w)
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k)!.push(i)
  })
  for (const r of ll) {
    const ids = byKey.get(gdKey(r.word))
    if (!ids) continue
    for (const i of ids.slice(0, 1)) {
      const d = entries[i].data
      if (d.au?.some((a) => a.url === r.url)) continue
      ;(d.au ??= []).push({
        url: r.url,
        label: r.word,
        license: 'CC BY-SA 4.0',
        credit: `${r.speaker}（Lingua Libre / Wikimedia Commons）`
      })
      if (!d.src?.includes('commons')) d.src = [...(d.src ?? []), 'commons']
      llAdded++
    }
  }
}
log(`Lingua Libre：${ll.length} 条录音，补上 ${llAdded} 条`)

// ───────────────────────── 中文与盖尔语释义 ─────────────────────────

const t2s = new T2S(files.openccPhrases, files.openccChars)
const zhUsed = applyZhWiktionary(entries, readKaikki(files.kaikkiZh), t2s)
log(`中文维基词典：${zhUsed} 个词条有人写的中文释义`)
const sm = untarGz(files.sensemap, [
  '2.1to3.0.noun.mono',
  '2.1to3.0.noun.poly',
  '2.1to3.0.verb.mono',
  '2.1to3.0.verb.poly'
])
const wordnet = new Wordnet({
  usgwZip: files.usgw,
  wiktGla: files.wiktGla,
  pwn: files.pwn,
  cow: files.cow,
  cmnSentences: files.tatoebaCmn,
  sensemap: [
    { text: sm.get('2.1to3.0.noun.mono') ?? '', pos: 'n', poly: false },
    { text: sm.get('2.1to3.0.noun.poly') ?? '', pos: 'n', poly: true },
    { text: sm.get('2.1to3.0.verb.mono') ?? '', pos: 'v', poly: false },
    { text: sm.get('2.1to3.0.verb.poly') ?? '', pos: 'v', poly: true }
  ]
})
const wnBase = wordnet.stats()
const wn = wordnet.enrich(entries)
log(
  `词网：盖尔语 ${wnBase.gdWords} 个词、${wnBase.synsets} 个同义词集；维基词典的 ${wn.entriesZh} 个词条（${wn.sensesZh} 个义项）对出中文，` +
    `${wn.sensesMono} 个义项有盖尔语释义`
)
const extra = wordnet.newEntries(entries)
for (const e of extra.entries) finishEntry(e)
entries.push(...extra.entries)
log(
  `词网里维基词典没收的词：另成 ${extra.entries.length} 个词条，${extra.alternatives} 个当作异体并进已有词条`
)

// 手写的补充词条（维基词典与词网都没收、语料里又常见的词）
const sup = readSupplement(join(ROOT, 'data', 'gd', 'supplement.tsv'))
for (const e of sup) finishEntry(e)
entries.push(...sup)
log(`补充词条：${sup.length} 个`)
const refolded = refoldOrphans(entries)
log(`原来找不到原形的词形，这回并进原形：${refolded} 个`)
const parts = addPhraseParts(entries)
log(`多词条目里不单独成词的一段挂成词形：${parts} 个（mu dheidhinn 的 dheidhinn……）`)

// ───────────────────────── 词频 ─────────────────────────

const index = new FormIndex(entries)
const arc = countArcosg([files.udTrain, files.udDev, files.udTest], index)
log(`ARCOSG：${arc.tokens} 词，${arc.unmatched} 个对不上词条`)
const lg = countForms(readLearnGaelic(files.freqLearnGaelic), index, arc.counts)
log(`LearnGaelic 词频表：${Math.round(lg.tokens)} 词，${Math.round(lg.unmatched)} 个对不上`)
const wikiForms = countWikiForms(files.gdwiki, join(CACHE, 'gdwiki-forms.json'))
const wiki = countForms(wikiForms, index, arc.counts)
log(`维基百科：${wiki.tokens} 词（出现 3 次以上的词形），${wiki.unmatched} 个对不上`)
const score = combine(
  [
    { c: arc, w: WEIGHTS.arcosg },
    { c: lg, w: WEIGHTS.learngaelic },
    { c: wiki, w: WEIGHTS.wiki }
  ],
  entries.length
)
const ranked = entries
  .map((e, i) => ({ i, s: score[i], len: e.data.w.length }))
  .filter((x) => x.s > 0)
  .sort((a, b) => b.s - a.s || a.len - b.len)
const rank: (number | null)[] = entries.map(() => null)
ranked.forEach((x, r) => (rank[x.i] = r + 1))
log(`有词频的词条 ${ranked.length} 个`)

// ───────────────────────── 分级 ─────────────────────────

const themes = readCore(join(ROOT, 'data', 'gd', 'core-a1.txt'))
const lv = assignLevels(entries, rank, themes, index)
log(
  `分级：${CEFR_LEVELS.map((l) => `${l} ${lv.counts[l] ?? 0}`).join('，')}` +
    (lv.coreMissing.length ? `；核心词表查不到：${lv.coreMissing.join('、')}` : '')
)

// ───────────────────────── 例句 ─────────────────────────

const tat = readTatoeba(
  {
    gla: files.tatoebaGla,
    glaEng: files.tatoebaGlaEng,
    eng: files.tatoebaEng,
    engCmn: files.tatoebaEngCmn,
    cmn: files.tatoebaCmn
  },
  index
)
log(
  `Tatoeba：${tat.total} 句，收 ${tat.examples.length} 句（不在可靠名单 ${tat.untrusted}，有查不到的词 ${tat.unknownWord}，没有英文翻译 ${tat.noEnglish}）`
)

/** 一句例句的难度：句中词条的最高等级 */
const ORDER: CefrLevel[] = [...CEFR_LEVELS]
const levelOfIds = (ids: number[]): string | null => {
  let best = -1
  for (const i of ids) {
    const l = lv.level[i]
    if (l) best = Math.max(best, ORDER.indexOf(l))
  }
  return best >= 0 ? ORDER[best] : null
}

// ───────────────────────── 写库 ─────────────────────────

const db = new LexDbWriter('gd')
for (const s of Object.values(SRC)) db.source(s)

// 维基词典例句先写（义项要引用例句 id）
let wiktExamples = 0
for (const e of entries)
  e.examples.forEach((list, si) => {
    const ids: number[] = []
    for (const x of list) {
      const words = x.text.split(/\s+/).map((w) => w.replace(/[.,!?;:"“”‘’()]/g, ''))
      const lvs = words.flatMap((w) => index.resolve(w).slice(0, 1))
      ids.push(db.example({ text: x.text, en: x.en, src: 'wiktionary', lv: levelOfIds(lvs) }))
      wiktExamples++
    }
    if (ids.length) e.data.s[si].ex = ids
  })

const dbId: number[] = []
entries.forEach((e, i) => {
  const data: LexEntryData = { ...e.data }
  if (rank[i] !== null) data.fr = rank[i]!
  if (lv.level[i]) data.lv = { cefr: lv.level[i]! }
  // 义项里一条释义都没有的去掉（kaikki 偶尔有空的）
  data.s = data.s.filter((s) => s.en?.length || s.zh?.length || s.mono?.length)
  if (!data.s.length) {
    dbId[i] = -1
    return
  }
  dbId[i] = db.entry(data)
})

// 维基词典例句挂回词条
entries.forEach((e, i) => {
  if (dbId[i] < 0) return
  for (const s of e.data.s) for (const x of s.ex ?? []) db.link(x, dbId[i])
})

// Tatoeba 例句
for (const x of tat.examples) {
  const ids = x.entries.map((i) => dbId[i]).filter((id) => id > 0)
  db.example(
    {
      text: x.text,
      en: x.en,
      zh: x.zh ?? null,
      zs: x.zh ? 'tatoeba-via-en' : null,
      src: 'tatoeba',
      lv: levelOfIds(x.entries)
    },
    ids
  )
}

// 主题词本（A1 核心词表的各个主题）
for (const th of themes)
  th.words.forEach((w, r) => {
    for (const i of resolveCore(w, index, rank))
      if (dbId[i] > 0) db.list(`theme:${th.id}`, dbId[i], r + 1)
  })
db.meta(
  'themes',
  themes.map((t) => ({ id: t.id, title: t.title }))
)
db.meta('grading', {
  primary: 'cefr',
  a1: 'data/gd/core-a1.txt + 词频前 150 的虚词',
  cutoffs: Object.fromEntries(CUTOFFS),
  weights: WEIGHTS,
  counts: lv.counts
})
const out = db.finish()
log(
  `写好 ${out.file}：${(out.bytes / 1048576).toFixed(1)} MB，词条 ${out.entries}，查词键 ${out.forms}，例句 ${out.examples}（维基词典 ${wiktExamples}）`
)

// ───────────────────────── 要补中文的常用词 ─────────────────────────

const todo = entries
  .map((e, i) => ({ e, i }))
  .filter(({ e, i }) => dbId[i] > 0 && rank[i] !== null && !e.data.s.some((s) => s.zh?.length))
  .sort((a, b) => rank[a.i]! - rank[b.i]!)
  .slice(0, 8000)
  .map(
    ({ e }) =>
      `${e.data.w}\t${e.data.p[0]}\t${e.data.s.map((s) => (s.en ?? []).join('; ')).join(' | ')}`
  )
writeFileSync(join(ROOT, 'data', 'gd', 'zh-todo.txt'), todo.join('\n') + '\n')
log(`zh-todo.txt：${todo.length} 个常用词还没有中文释义`)

// 对不上的语料词（补词、查规则用）
writeFileSync(
  join(CACHE, 'unmatched.json'),
  JSON.stringify(
    { arcosg: arc.topUnmatched, learngaelic: lg.topUnmatched, wiki: wiki.topUnmatched },
    null,
    1
  )
)
