/**
 * 西班牙语词典数据：resources/data/es/dict.sqlite（不入库）。
 *   node scripts/data/run-ts.mjs scripts/data/es/build.ts
 * 原始文件下到 .cache/data/es/（已有的跳过）；做完写一份 data/es/zh-todo.txt（要补中文的常用词，入库）。
 *
 * 1. 词条：英文维基词典的西语词条（英文释义、性、IPA、变位与变形表、标签、用法例句）。
 * 2. 词频与分级：wordfreq + doozan 两份词频排名次；按名次切 CEFR 六级，主题词表提级，粗俗与地区词压级（levels.ts）。
 * 3. 中文：中文维基词典的人工条目（义项数对得上时逐条对应，对不上时只把第一个挂在第一个义项）；
 *    没有的用西语维基词典翻译表里第一个义项的汉语对译词；Wikidata 词位按英文名字对上的义项补；
 *    剩下的义项由主线按英文释义补译（data/es/zh-mt.jsonl，LexDbWriter 自动补，标「译自英文」）。
 * 4. 西语释义：西语维基词典第一个义项的释义（挂在第一个义项上；性要对得上）。
 * 5. 发音：维基词典的 IPA（音位标音，标上 distinción / seseo 等口音）；没有的按拼读规则推（phonology.ts）。
 *    录音：Lingua Libre、西语与英文维基词典里的维基共享资源文件。
 * 6. 例句：Tatoeba 西中、西英对照，按难度与长度给每个词挑几句；维基词典的用法例句挂在义项上。
 * 7. 词表：CEFR 各级、词频分档、主题词表（theme:）、西班牙 / 美洲用词（x:es-ES、x:es-419）。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LexDbWriter, ROOT } from '../../lang/lexdb-writer'
import { rules } from '../../../src/shared/lang/es/rules'
import { ipaVariants } from '../../../src/shared/lang/es/phonology'
import { FREQ_BANDS } from '../../../src/shared/lang/es/spec'
import type {
  AudioRef,
  CefrLevel,
  LexEntryData,
  LexSense,
  PosTag
} from '../../../src/shared/lang/types'
import { SRC, cached, need } from './sources'
import { readWiktionary, toPos, type WAlias, type WEntry, type WForm } from './wiktionary'
import { loadOpenCC, readZhWiktionary, type ZhEntry } from './zh'
import { readEsWiktionary, type EsEntry } from './eswikt'
import { scoreEntries } from './freq'
import {
  FEM_DET,
  MASC_DET,
  countPhrases,
  genderCounts,
  loadTatoeba,
  type TSentence
} from './tatoeba'
import { commonsMp3, lingualibreFiles, parseLlName } from './audio'
import { calibrate } from './calibrate'
import { matchSense, readWikidata } from './wikidata'
import {
  CUTS,
  LEVELS,
  easier,
  eligible,
  floorOf,
  harder,
  isFixedPhrase,
  levelAt,
  loadThemes,
  regionOf
} from './levels'

const t0 = Date.now()
const lap = (msg: string): void => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${msg}`)

/** 每个词条最多几个义项、几条录音、几句 Tatoeba 例句 */
const MAX_SENSES = 30
const MAX_AUDIO = 3
const EX_LEVELED = 6
const EX_OTHER = 3
/** 西语释义只给这么常用的词（省体积） */
const MONO_RANK = 60000

// ───────────────────────── 下载 ─────────────────────────

lap('原始数据（.cache/data/es/）')
const files = {
  wiktEn: await need('wiktEn'),
  wiktZhHans: await need('wiktZhHans'),
  wiktZhHant: await need('wiktZhHant'),
  wiktEs: await need('wiktEs'),
  spa: await need('spaSentences'),
  cmn: await need('cmnSentences'),
  eng: await need('engSentences'),
  spaCmn: await need('spaCmnLinks'),
  spaEng: await need('spaEngLinks'),
  engCmn: await need('engCmnLinks'),
  wordfreq: await need('wordfreq'),
  doozan: await need('doozanFreq'),
  openccChars: await need('openccChars'),
  openccPhrases: await need('openccPhrases')
}

// ───────────────────────── 词条 ─────────────────────────

lap('读英文维基词典的西语词条')
const wikt = await readWiktionary(files.wiktEn)
const entries = wikt.entries.filter(
  (e) => e.kpos !== 'punct' && !e.senses.every((s) => s.tags.includes('misspelling'))
)
lap(`词条 ${entries.length}，异体 ${wikt.aliases.length}，词形条目 ${wikt.formOf.size}`)

// ───────────────────────── 词频 ─────────────────────────

lap('读 Tatoeba')
const tat = await loadTatoeba({
  spa: files.spa,
  cmn: files.cmn,
  eng: files.eng,
  spaCmn: files.spaCmn,
  spaEng: files.spaEng,
  engCmn: files.engCmn
})
lap(`西语句子 ${tat.all.length}，带翻译的 ${tat.examples.length}`)
const phrases = countPhrases(
  tat.all,
  entries.filter((e) => e.word.includes(' ')).map((e) => e.word),
  new Set(entries.filter(isFixedPhrase).map((e) => e.word))
)
// 词头 → 词条（主题词表、中文、西语维基词典都按词头找）
const byWord = new Map<string, number[]>()
entries.forEach((e, i) => {
  let l = byWord.get(e.word)
  if (!l) byWord.set(e.word, (l = []))
  l.push(i)
})

/**
 * 异体条目（gran ← grande、mi ← mío 的短尾形）、词形条目（mis ← mi 的复数）：找到同词性的词条，
 * 记成那个词条的额外词形（查词键，也算进它的词频）。目标本身又是异体的往下追（mis → mi → mío）。
 */
const FUNC_GROUP: Record<string, string> = {
  det: 'det',
  pron: 'det',
  article: 'det',
  prep: 'prep',
  contraction: 'prep'
}
const samePos = (a: string, b: string): boolean =>
  a === b || (!!FUNC_GROUP[a] && FUNC_GROUP[a] === FUNC_GROUP[b])
const aliasOf = new Map<string, WAlias[]>()
for (const a of wikt.aliases) {
  let l = aliasOf.get(a.alias)
  if (!l) aliasOf.set(a.alias, (l = []))
  l.push(a)
}
function resolveLink(lemma: string, kpos: string, depth = 0): number | undefined {
  const cands = (byWord.get(lemma) ?? []).filter((i) => samePos(entries[i].kpos, kpos))
  if (cands.length) return cands.find((i) => entries[i].kpos === kpos) ?? cands[0]
  if (depth < 2)
    for (const a of aliasOf.get(lemma) ?? []) {
      if (!samePos(a.kpos, kpos)) continue
      const r = resolveLink(a.target, kpos, depth + 1)
      if (r !== undefined) return r
    }
  return undefined
}
/** 词条 → 额外的词形（alias：异体，查词键总是要；不是异体的，存了变形表的词条才要） */
const extras = new Map<number, (WForm & { alias: boolean })[]>()
{
  const own = new Map<number, Set<string>>()
  const ownKeys = (i: number): Set<string> => {
    let s = own.get(i)
    if (!s) {
      s = new Set([rules.key(entries[i].word), ...entries[i].forms.map((f) => rules.key(f.form))])
      own.set(i, s)
    }
    return s
  }
  const add = (i: number | undefined, form: string, tags: string[], alias: boolean): void => {
    if (i === undefined || ownKeys(i).has(rules.key(form))) return
    ownKeys(i).add(rules.key(form))
    let l = extras.get(i)
    if (!l) extras.set(i, (l = []))
    l.push({ form, tags, alias })
  }
  for (const a of wikt.aliases) add(resolveLink(a.target, a.kpos), a.alias, a.tags, true)
  for (const [form, list] of wikt.formOf)
    for (const fo of list) add(resolveLink(fo.lemma, fo.kpos), form, fo.tags, false)
}

lap('算词频')
const scores = scoreEntries(
  entries.map((e, i) => ({
    word: e.word,
    kpos: e.kpos,
    forms: [...e.forms, ...(extras.get(i) ?? [])].map((f) => f.form)
  })),
  files.wordfreq,
  files.doozan,
  phrases
)
/**
 * 阴阳性不同的同形名词（el capital 资本 / la capital 首都、el orden 顺序 / la orden 命令）：
 * 两份词频分不出是哪一个，按 Tatoeba 里前面紧挨着的阳性、阴性限定词的比例重分两条的分数（没统计到的平分）
 */
const genderGroups = new Map<string, number[]>()
for (const [word, list] of byWord) {
  const nouns = list.filter(
    (i) => entries[i].kpos === 'noun' && /^[mf]$/.test(entries[i].gender ?? '')
  )
  if (nouns.some((i) => entries[i].gender === 'm') && nouns.some((i) => entries[i].gender === 'f'))
    genderGroups.set(word, nouns)
}
{
  const forms = new Map<string, string>()
  for (const [word, list] of genderGroups)
    for (const i of list)
      for (const f of [word, ...entries[i].forms.map((x) => x.form)])
        forms.set(f.toLocaleLowerCase('es'), word)
  const gc = genderCounts(tat.all, forms)
  for (const [word, list] of genderGroups) {
    const total = list.reduce((a, i) => a + scores[i], 0)
    const [m, f] = gc.get(word) ?? [0, 0]
    const fem = m + f >= 5 ? f / (m + f) : 0.5
    const nf = list.filter((i) => entries[i].gender === 'f').length
    const nm = list.length - nf
    for (const i of list)
      scores[i] = entries[i].gender === 'f' ? (total * fem) / nf : (total * (1 - fem)) / nm
  }
}
/** 阴阳性不同的同形名词：按前面的限定词挑（la capital → 首都） */
function pickGender(i: number, prev: string | undefined): number {
  const group = genderGroups.get(entries[i].word)
  if (!group || !prev) return i
  const p = prev.toLocaleLowerCase('es')
  const want = FEM_DET.has(p) ? 'f' : MASC_DET.has(p) ? 'm' : null
  if (!want || entries[i].gender === want) return i
  return group.find((j) => entries[j].gender === want) ?? i
}

/** 词频名次（全部有分数的词条） */
const fr = new Int32Array(entries.length)
{
  const order = entries.map((_, i) => i).filter((i) => scores[i] > 0)
  order.sort((a, b) => scores[b] - scores[a])
  order.forEach((i, k) => (fr[i] = k + 1))
}

// ───────────────────────── 分级 ─────────────────────────

lap('分级')
const { themes, words: themeWords } = loadThemes(join(ROOT, 'data/es/themes.json'))
/** 能分级的词按分数排的名次（专名、词缀不算） */
const levelRank = new Int32Array(entries.length)
{
  const order = entries.map((_, i) => i).filter((i) => scores[i] > 0 && eligible(entries[i]))
  order.sort((a, b) => scores[b] - scores[a])
  order.forEach((i, k) => (levelRank[i] = k + 1))
}
const cefr: (CefrLevel | null)[] = entries.map((e, i) => {
  const base = levelRank[i] ? levelAt(levelRank[i]) : null
  const floor = floorOf(e)
  return base && floor ? harder(base, floor) : base
})
const freqBand: (string | null)[] = entries.map((_, i) => {
  const r = levelRank[i]
  if (!r) return null
  for (const [id, top] of FREQ_BANDS) if (r <= top) return id
  return null
})

const bestOf = (list: number[]): number =>
  list.reduce((a, b) => ((fr[a] || 1e9) <= (fr[b] || 1e9) ? a : b))

// 主题词表：提级，记进 theme:<id>
const themeLists = new Map<string, number[]>()
const themeMissing: string[] = []
for (const th of themes) {
  const list: number[] = []
  for (const tw of themeWords.get(th.id) ?? []) {
    let cands = byWord.get(tw.word) ?? []
    if (tw.kpos) cands = cands.filter((i) => entries[i].kpos === tw.kpos)
    if (tw.gender) cands = cands.filter((i) => entries[i].gender === tw.gender)
    if (!cands.length) {
      themeMissing.push(`${th.id}:${tw.word}`)
      continue
    }
    const i = bestOf(cands)
    list.push(i)
    cefr[i] = cefr[i] ? easier(cefr[i]!, tw.level) : tw.level
  }
  themeLists.set(th.id, list)
}
if (themeMissing.length)
  console.log(`  主题词表里词典没有的词（${themeMissing.length}）：${themeMissing.join('，')}`)
const levelCounts = Object.fromEntries(LEVELS.map((l) => [l, cefr.filter((x) => x === l).length]))
lap(`分级（切分点 ${CUTS.join(' / ')}）：${JSON.stringify(levelCounts)}`)
if (process.argv.includes('--calibrate'))
  calibrate(
    cached('elelex-calibration-only.tsv'),
    entries.map((e, i) => ({ word: e.word, kpos: e.kpos, rank: levelRank[i] })),
    CUTS
  )

/**
 * 存不存变形表（变形表里的每个形式都进查词键，体积大半在这里）：
 * - 动词：分了级的、不规则的、词干变元音的（规则倒推不出来）全存；没分级的规则动词不存——
 *   阅读器查它的变位形式时由 rules.lemmaCandidates 按规则倒推（abaratábamos → abaratar），结果一样；
 *   词典里要显示它的变位表，用 src/shared/lang/es/conjugate.ts 按规则现推（见文档「要框架做的」）；
 * - 别的词：分了级的、在语料里出现过的才存（少见名词的复数、阴性也由规则倒推）。
 */
const keepForms = (i: number): boolean => {
  const e = entries[i]
  if (cefr[i]) return true
  if (e.kpos === 'verb') return e.irregular || e.classes.length > 0
  return fr[i] > 0
}

// ───────────────────────── 中文 ─────────────────────────

lap('中文：中文维基词典、西语维基词典')
const t2s = loadOpenCC(files.openccChars, files.openccPhrases)
const zhWikt = await readZhWiktionary([files.wiktZhHans, files.wiktZhHant], t2s)
/** 词条 → 中文维基词典的条目 */
const zhOf = new Map<number, ZhEntry>()
for (const [word, zes] of zhWikt) {
  // 只认大小写完全一样的词头（AL「拉丁美洲」不是 al）
  const cands = byWord.get(word) ?? []
  if (!cands.length) continue
  for (const ze of zes) {
    let ok = cands.filter((i) => !ze.kpos.length || ze.kpos.includes(entries[i].kpos))
    if (!ok.length) continue
    if (ze.gender) {
      const g = ok.filter((i) => entries[i].gender === ze.gender)
      if (g.length) ok = g
    }
    // 同一个词性有几条（阴阳性不同）、没写性的：给最常用的那条
    const i = ze.kpos.length
      ? ok.sort(
          (a, b) =>
            ze.kpos.indexOf(entries[a].kpos) - ze.kpos.indexOf(entries[b].kpos) ||
            (fr[a] || 1e9) - (fr[b] || 1e9)
        )[0]
      : bestOf(ok)
    const prev = zhOf.get(i)
    if (prev) prev.senses.push(...ze.senses)
    else zhOf.set(i, { ...ze, senses: [...ze.senses] })
  }
}
const esWikt = await readEsWiktionary(files.wiktEs, new Set(byWord.keys()), t2s)
const wdSenses = await readWikidata(
  cached('wikidata-lexemes.json'),
  cached('wikidata-items.json'),
  t2s
)
/**
 * 词条 → 西语维基词典的条目。性要对得上：西语维基词典「阴阳性」（mf，gato / gata、estudiante）的条目
 * 对我们哪种性都行；阳性、阴性的条目只对同性的（el pariente「丈夫」不是 el / la pariente「亲戚」）。
 * 一个词条对上几个西语条目时，取性最合适、排在前面的那个。
 */
const genderFit = (es: EsEntry['gender'], ours: string | undefined): number => {
  if (!es || !ours || es === 'mf') return 2
  return es === ours ? 2 : ours === 'mf' ? 1 : 0
}
const esOf = new Map<number, EsEntry>()
{
  const fit = new Map<number, number>()
  for (const [word, ees] of esWikt.entries) {
    const cands = byWord.get(word) ?? []
    for (const ee of ees) {
      const ok = cands.filter(
        (i) =>
          (!ee.kpos.length || ee.kpos.includes(entries[i].kpos)) &&
          genderFit(ee.gender, entries[i].gender) > 0
      )
      if (!ok.length) continue
      const best = Math.max(...ok.map((i) => genderFit(ee.gender, entries[i].gender)))
      const i = bestOf(ok.filter((j) => genderFit(ee.gender, entries[j].gender) === best))
      const prev = esOf.get(i)
      if (!prev || best > (fit.get(i) ?? 0)) {
        esOf.set(i, { ...ee, mono: [...ee.mono], zh: [...ee.zh] })
        fit.set(i, best)
      } else if (best === fit.get(i))
        for (const z of ee.zh) if (!prev.zh.includes(z)) prev.zh.push(z)
    }
  }
}
lap(`中文维基词典对上 ${zhOf.size} 条，西语维基词典 ${esOf.size} 条`)

// ───────────────────────── 录音 ─────────────────────────

lap('录音：Lingua Libre')
const llFiles = await lingualibreFiles(cached('lingualibre-spa.json'))
const llByWord = new Map<string, AudioRef[]>()
for (const f of llFiles) {
  const r = parseLlName(f, (w) => byWord.has(w))
  if (!r) continue
  let l = llByWord.get(r.word)
  if (!l) llByWord.set(r.word, (l = []))
  l.push({
    url: commonsMp3(r.file),
    label: `Lingua Libre · ${r.speaker}${r.accent ? `（${r.accent}）` : ''}`,
    license: 'CC BY-SA 4.0',
    credit: r.speaker
  })
}
lap(`Lingua Libre 对上 ${llByWord.size} 个词`)

function audioFor(e: WEntry): AudioRef[] {
  const out: AudioRef[] = []
  const add = (a: AudioRef): void => {
    if (out.length < MAX_AUDIO && !out.some((x) => x.url === a.url)) out.push(a)
  }
  for (const a of llByWord.get(e.word) ?? []) add(a)
  for (const a of esWikt.audio.get(e.word) ?? [])
    add({ url: a.url, label: a.label, license: '见维基共享资源文件页', credit: a.file })
  for (const a of e.audio)
    add({
      url: a.url,
      label: a.tags.join(', ') || undefined,
      license: '见维基共享资源文件页',
      credit: a.file
    })
  return out
}

// ───────────────────────── IPA ─────────────────────────

/**
 * 维基词典的音位标音（/…/）与口音标签；没有的按规则推。
 * 口音标签：z、ce、ci 读 θ 的是 distinción（西班牙中北部），读 s 的是 seseo（拉美、加那利、安达卢西亚大部）；
 * ll、y 读 ʝ 的是 yeísmo（多数地区），ll 读 ʎ 的是 lleísmo，读 ʃ / ʒ 的是拉普拉塔的 sheísmo / zheísmo。
 * 词条的 ipa 只放两种主要读法（西班牙标准、拉美通行），全部读法连同标签放在 x.ipaAll 里。
 */
function ipaFor(e: WEntry): { ipa: string[]; all: [string, string][]; generated: boolean } {
  const lower = e.word.toLocaleLowerCase('es')
  const theta = /z|c[eiéí]/.test(lower)
  const palatal = /ll|y[aeiouáéíóú]/.test(lower)
  const all: [string, string][] = []
  const seen = new Set<string>()
  for (const s of e.ipa) {
    if (!s.ipa.startsWith('/') || seen.has(s.ipa)) continue
    seen.add(s.ipa)
    const parts: string[] = []
    if (theta) parts.push(s.ipa.includes('θ') ? 'distinción' : 'seseo')
    if (palatal)
      parts.push(
        s.ipa.includes('ʎ')
          ? 'lleísmo'
          : s.ipa.includes('ʃ')
            ? 'sheísmo'
            : s.ipa.includes('ʒ')
              ? 'zheísmo'
              : s.ipa.includes('ʝ')
                ? 'yeísmo'
                : ''
      )
    const tags = s.tags.filter((t) => !/^(phoneme|letter|name|standard)$/.test(t))
    all.push([s.ipa, [...parts, ...tags].filter(Boolean).join(' ')])
  }
  let generated = false
  if (!all.length) {
    if (!/^[\p{L} ]+$/u.test(e.word) || e.word.split(' ').length > 4)
      return { ipa: [], all: [], generated: false }
    for (const v of ipaVariants(e.word)) all.push([v.ipa, v.v])
    generated = true
  }
  // 主要读法：西班牙标准（distinción、yeísmo）一个，拉美通行（seseo、yeísmo）一个；没有这种区分的取第一个
  const plain = all.filter(([, l]) => !/lleísmo|sheísmo|zheísmo|dialectal|Andalusia|Canary/.test(l))
  const main: string[] = []
  const spain = plain.find(([, l]) => !l.includes('seseo')) ?? all[0]
  if (spain) main.push(spain[0])
  const latam = plain.find(([, l]) => l.includes('seseo'))
  if (latam && !main.includes(latam[0])) main.push(latam[0])
  return { ipa: main, all, generated }
}

// ───────────────────────── 义项 ─────────────────────────

/** 中文挂到义项上：义项数一样就逐条对应，不一样就整条挂在第一个义项 */
function attachZh(senses: LexSense[], i: number): string[] {
  const used: string[] = []
  const ze = zhOf.get(i)
  if (ze?.senses.length) {
    const zs = ze.senses.map((s) => s.zh)
    // 义项数一样的逐条对应（中文维基词典的新条目多半照英文维基词典的义项顺序译）；
    // 不一样的只把第一个义项挂到第一个义项上——全挂上去会把别的义项（甚至粗俗义）混进主义项里，
    // 剩下的义项由主线按英文释义补译
    if (zs.length === senses.length) senses.forEach((s, k) => (s.zh = [zs[k]]))
    else senses[0].zh = [zs[0]]
    for (const s of senses) if (s.zh?.length) s.zs = 'zhwikt'
    used.push('zhwikt')
  } else {
    const ee = esOf.get(i)
    if (ee?.zh.length) {
      senses[0].zh = [ee.zh.slice(0, 4).join('，')]
      senses[0].zs = 'eswikt'
      used.push('eswikt')
    }
  }
  // Wikidata 词位：条目的英文名字对上哪个义项就挂哪个义项，只补还没有中文的义项；
  // 一个义项只用一个（词位里排在前面的义项）：casa 的「住宅」与「占星宫位」两个条目英文都叫 house
  const e = entries[i]
  const filled = new Set<number>()
  for (const wd of wdSenses.get(e.word) ?? []) {
    if (wd.kpos.length && !wd.kpos.includes(e.kpos)) continue
    // 形容词连到了民族、人群的条目（nicaragüense →「尼加拉瓜人」）：中文是名词，不当形容词的释义
    if (e.kpos === 'adj' && /[人族]$/.test(wd.zh)) continue
    const k = matchSense(wd.en, senses)
    if (k < 0) continue
    const s = senses[k]
    if (s.zh?.length || filled.has(k)) continue
    filled.add(k)
    s.zh = [wd.zh]
    s.zs = 'wikidata'
    if (!used.includes('wikidata')) used.push('wikidata')
  }
  return used
}

// ───────────────────────── 写库 ─────────────────────────

/**
 * 变形表里不进查词键的个别形式：阅读器遇到同形词按词条词频挑，这几个形式会把更常见的读法挤掉
 * （No sé 的 sé 是 saber，不是 ser 的命令式）。框架以后能按词形频率挑时再放回来。
 */
const DROP_FORMS = new Map<string, string[]>([['ser', ['sé']]])

lap('写库')
const db = new LexDbWriter('es')
for (const s of Object.values(SRC)) db.source(s)

const entryId = new Int32Array(entries.length)
const regionList = { 'es-ES': [] as number[], 'es-419': [] as number[] }
let withZh = 0
let withWd = 0
/** 写进库的词条有没有中文（zh-todo 用） */
const hasZh = new Uint8Array(entries.length)
let withMono = 0
let withAudio = 0
let genIpa = 0
for (let i = 0; i < entries.length; i++) {
  const e = entries[i]
  const senses: LexSense[] = []
  for (const s of e.senses.slice(0, MAX_SENSES)) {
    const ls: LexSense = { en: s.en }
    if (s.tags.length) ls.t = s.tags
    if (s.dom.length) ls.dom = s.dom
    if (s.syn.length) ls.syn = s.syn
    if (s.ant.length) ls.ant = s.ant
    if (s.formOf) ls.see = [s.formOf]
    // 维基词典的用法例句
    const ex: number[] = []
    for (const x of s.examples)
      ex.push(db.example({ text: x.text, en: x.en ?? null, src: 'wiktionary' }))
    if (ex.length) ls.ex = ex
    senses.push(ls)
  }
  const src = new Set<string>(['wiktionary'])
  const zs = attachZh(senses, i)
  for (const id of zs) src.add(id)
  if (zs.length) withZh++
  if (zs.includes('wikidata')) withWd++
  hasZh[i] = senses.some((x) => x.zh?.length) ? 1 : 0
  const ee = esOf.get(i)
  if (ee?.mono.length && (cefr[i] || (fr[i] && fr[i] <= MONO_RANK))) {
    // 西语释义只放第一条（西语维基词典第一个义项，对应主义项）：后面几条跟英文维基词典的义项对不上
    senses[0].mono = ee.mono.slice(0, 1)
    src.add('eswikt')
    withMono++
  }
  const { ipa, all: ipaAll, generated } = ipaFor(e)
  if (generated) genIpa++
  const au = audioFor(e)
  if (au.length) {
    src.add('commons')
    withAudio++
  }
  if (fr[i]) {
    src.add('wordfreq')
    src.add('doozan')
  }
  const lv: Record<string, string> = {}
  if (cefr[i]) lv.cefr = cefr[i]!
  if (freqBand[i]) lv.freq = freqBand[i]!
  const x: Record<string, unknown> = {}
  if (ipaAll.length > ipa.length || ipaAll.some(([, l]) => l)) x.ipaAll = ipaAll
  if (generated) x.ipaGen = 1
  const region = regionOf(e)
  if (region) x.region = region
  if (e.pluralOnly) x.pluralOnly = 1
  if (e.pronominal) x.pronominal = 1
  const pos: PosTag = toPos(e.kpos, e.word)
  const cls: string[] = []
  if (e.kpos === 'verb') {
    const m = /(ar|er|ir|ír)(se)?$/.exec(e.word)
    if (m && !e.word.includes(' ')) cls.push(`-${m[1]}`)
    for (const c of e.classes) cls.push(c.replace(/ alternation$/, ''))
    if (e.irregular) cls.push('irregular')
  }
  const data: LexEntryData = {
    w: e.word,
    p: [pos],
    s: senses,
    src: [...src]
  }
  if (e.gender) data.g = e.gender
  if (ipa.length) data.ipa = ipa
  if (au.length) data.au = au
  if (e.forms.length && keepForms(i))
    data.f = e.forms
      .filter((f) => !DROP_FORMS.get(e.word)?.includes(f.form))
      .map((f) => [f.form, ...f.tags])
  else if (e.forms.length && e.kpos === 'verb') x.noTable = 1
  if (cls.length) data.cls = cls
  if (Object.keys(lv).length) data.lv = lv
  if (fr[i]) data.fr = fr[i]
  if (Object.keys(x).length) data.x = x
  const id = db.entry(data)
  entryId[i] = id
  for (const s of senses) for (const exId of s.ex ?? []) db.link(exId, id)
  if (region && (cefr[i] || (fr[i] && fr[i] <= 30000))) regionList[region].push(i)
}
lap(
  `词条写完：有中文 ${withZh}（其中用到 Wikidata 的 ${withWd}），西语释义 ${withMono}，录音 ${withAudio}，推出来的 IPA ${genIpa}`
)

// 异体写法、词形条目里另有的形式：补查词键（没存变形表的词，词形条目里的形式也不补，规则倒推得出来）
let extraForms = 0
for (const [i, list] of extras)
  for (const f of list) {
    if (!f.alias && !keepForms(i)) continue
    db.form(entryId[i], f.form, f.tags)
    extraForms++
  }
lap(`补查词键 ${extraForms}`)

// ───────────────────────── 例句 ─────────────────────────

lap('Tatoeba 例句：切词、对词条')
/** 查词：严格键 → 宽松键 → 猜原形；同一个键几个词条时取最常用的 */
const strict = new Map<string, number>()
const loose = new Map<string, number>()
const better = (a: number | undefined, b: number): number =>
  a === undefined || (fr[b] || 1e9) < (fr[a] || 1e9) ? b : a
entries.forEach((e, i) => {
  for (const f of [e.word, ...e.forms.map((x) => x.form)]) {
    const k = rules.key(f)
    strict.set(k, better(strict.get(k), i))
    const l = rules.looseKey!(f)
    loose.set(l, better(loose.get(l), i))
  }
})
const resolveCache = new Map<string, number>()
function resolve(word: string): number {
  const k = rules.key(word)
  const hit = resolveCache.get(k)
  if (hit !== undefined) return hit
  let r = strict.get(k) ?? loose.get(rules.looseKey!(word)) ?? -1
  if (r < 0)
    for (const g of rules.lemmaCandidates!(word)) {
      const s = strict.get(rules.key(g.lemma))
      if (s !== undefined) {
        r = s
        break
      }
    }
  resolveCache.set(k, r)
  return r
}
const NO_LEVEL = new Set(['name', 'num', 'symbol', 'character', 'intj'])
const lvIndex = (l: CefrLevel | null): number => (l ? LEVELS.indexOf(l) : 6)

interface Cand {
  s: TSentence
  /** 句子里最难的词的级（0 = A1 … 6 = 没分级） */
  hard: number
  len: number
}
const perEntry = new Map<number, Cand[]>()
for (const s of tat.examples) {
  const toks = rules.tokenize!(s.text).filter((t) => t.kind === 'word')
  const found = new Set<number>()
  let hard = 0
  let unknown = 0
  for (let k = 0; k < toks.length; k++) {
    const r = resolve(toks[k].text)
    if (r < 0) {
      unknown++
      continue
    }
    const i = pickGender(r, toks[k - 1]?.text)
    found.add(i)
    if (!NO_LEVEL.has(entries[i].kpos)) hard = Math.max(hard, lvIndex(cefr[i]))
  }
  if (unknown > 1 || !found.size) continue
  const c: Cand = { s, hard, len: s.text.length }
  for (const i of found) {
    let l = perEntry.get(i)
    if (!l) perEntry.set(i, (l = []))
    l.push(c)
  }
}
lap(`有例句候选的词条 ${perEntry.size}`)
/** 例句好不好：有直接的中文翻译最好，经英文的次之；用词不比这个词难太多；短的好 */
const quality = (c: Cand, own: number): number =>
  (c.s.zs === 'tatoeba' ? 3 : c.s.zs ? 2 : 0) +
  (c.s.en ? 1 : 0) -
  Math.max(0, c.hard - Math.max(own, 1) - 1) * 1.5 -
  c.len / 50
const chosen = new Map<TSentence, number[]>()
for (const [i, cands] of perEntry) {
  const own = lvIndex(cefr[i])
  const k = cefr[i] ? EX_LEVELED : EX_OTHER
  cands.sort((a, b) => quality(b, own) - quality(a, own))
  for (const c of cands.slice(0, k)) {
    let l = chosen.get(c.s)
    if (!l) chosen.set(c.s, (l = []))
    l.push(i)
  }
}
const exLevel = (c: Cand): string | null => (c.hard < 6 ? LEVELS[c.hard] : null)
for (const [s, list] of chosen) {
  const toks = rules.tokenize!(s.text).filter((t) => t.kind === 'word')
  let hard = 0
  for (const t of toks) {
    const i = resolve(t.text)
    if (i >= 0 && !NO_LEVEL.has(entries[i].kpos)) hard = Math.max(hard, lvIndex(cefr[i]))
  }
  const id = db.example(
    {
      text: s.text,
      en: s.en ?? null,
      // Tatoeba 的中文句子有繁有简，统一成简体
      zh: s.zh ? t2s(s.zh) : null,
      zs: s.zs ?? null,
      src: 'tatoeba',
      lv: exLevel({ s, hard, len: 0 })
    },
    list.map((i) => entryId[i])
  )
  void id
}
lap(`Tatoeba 例句 ${chosen.size} 句`)

// ───────────────────────── 词表 ─────────────────────────

for (const [id, list] of themeLists)
  for (const i of list) db.list(`theme:${id}`, entryId[i], fr[i] || undefined)
for (const [name, list] of Object.entries(regionList))
  for (const i of list) db.list(`x:${name}`, entryId[i], fr[i] || undefined)
db.meta(
  'themes',
  themes.map((t) => ({ id: t.id, title: t.title, level: t.level }))
)
db.meta('lists_info', [
  {
    name: 'x:es-ES',
    title: { zh: '西班牙用词（拉美少用或不用）', en: 'Spain-only words' }
  },
  {
    name: 'x:es-419',
    title: { zh: '拉丁美洲用词（西班牙少用或不用）', en: 'Latin American words' }
  }
])
db.meta('levelCuts', CUTS)
db.meta('build', {
  wiktionary: 'kaikki.org Spanish (en.wiktionary dump 2026-10-01)',
  tatoeba: '2026-10-03',
  levelCounts
})

try {
  const stats = db.finish()
  lap(
    `完成：${stats.file}  ${(stats.bytes / 1048576).toFixed(1)} MB，词条 ${stats.entries}，查词键 ${stats.forms}，例句 ${stats.examples}`
  )
} catch (e) {
  // resources/data 是各分支共用的目录联接：谁开着软件，软件就会打开各语言的 dict.sqlite，Windows 上删不掉、换不了
  if (
    (e as NodeJS.ErrnoException).code !== 'EPERM' &&
    (e as NodeJS.ErrnoException).code !== 'EBUSY'
  )
    throw e
  console.log(
    `  ${db.file} 正被别的程序打开（软件开着？），新库留在 ${db.file}.building：` +
      `可以先用 validate.ts es ${db.file}.building 检查，关掉软件后改名换上`
  )
}

// ───────────────────────── 要补中文的常用词 ─────────────────────────

const todo = entries
  .map((e, i) => ({ e, i }))
  .filter(({ e, i }) => fr[i] && !hasZh[i] && e.kpos !== 'name')
  .sort((a, b) => fr[a.i] - fr[b.i])
  .slice(0, 8000)
mkdirSync(join(ROOT, 'data/es'), { recursive: true })
writeFileSync(
  join(ROOT, 'data/es/zh-todo.txt'),
  '# 要补中文释义的常用词（按词频排，前 8000 个）：词头\t词性（性）\t英文释义（前两个义项）\n' +
    todo
      .map(({ e }) => {
        const pos = toPos(e.kpos, e.word) + (e.gender ? ` ${e.gender}` : '')
        const en = e.senses
          .slice(0, 2)
          .map((s) => s.en.join(', '))
          .join(' | ')
        return `${e.word}\t${pos}\t${en}`
      })
      .join('\n') +
    '\n'
)
lap(`data/es/zh-todo.txt：${todo.length} 个词`)
