/**
 * 英文维基词典的俄语词条（kaikki.org / wiktextract 的 JSONL）→ 词条的中间形式。
 *
 * - 原形词条都收；「变形词条」（дома = дом 的属格）不另立词条，它们在原形的变格变位表里。
 * - kaikki 把一些独立的词也写成 form-of：指小（домик）、阴性（учительница）、-ся 被动（найтись）、
 *   最高级（лучший）、缩写（США、КГБ）、省略（Петербург）……这些另立词条（下面叫 derived）。
 * - 形动词的各格不收（几十万个），阅读器靠 rules.lemmaCandidates 先推回形动词，再在动词的变位表里找到。
 * - 「异体写法」（черный 之于 чёрный、旧正字法）不另立词条，记成目标词条的另一个写法。
 */
import type { AudioRef, PosTag } from '../../../src/shared/lang/types'
import { jsonl } from './read'

// ───────────────────────── kaikki 的形状（只列用到的） ─────────────────────────

interface KForm {
  form: string
  tags?: string[]
  source?: string
}
interface KExample {
  text?: string
  english?: string
  translation?: string
  type?: string
}
interface KSense {
  glosses?: string[]
  tags?: string[]
  topics?: string[]
  form_of?: { word: string }[]
  alt_of?: { word: string }[]
  examples?: KExample[]
}
interface KSound {
  ipa?: string
  tags?: string[]
  note?: string
  audio?: string
  ogg_url?: string
  mp3_url?: string
}
interface KRecord {
  word: string
  pos: string
  forms?: KForm[]
  senses?: KSense[]
  sounds?: KSound[]
  synonyms?: { word: string }[]
  antonyms?: { word: string }[]
}

// ───────────────────────── 中间形式 ─────────────────────────

/** 变形表的一格：[带重音的形式, ...标签] */
export type Cell = [string, ...string[]]

export interface WiktSense {
  en: string[]
  tags: string[]
  topics: string[]
  examples: { text: string; en: string }[]
  /** 指小、阴性、缩写……的原词（带重音） */
  of?: string
}

export interface WiktLemma {
  /** 词头（不带重音，保留 ё） */
  word: string
  /** 带重音的写法 */
  stressed: string
  pos: PosTag
  /** kaikki 的词性（noun、name、prep……） */
  rawPos: string
  gender?: string
  animacy?: 'animate' | 'inanimate' | 'both'
  /** 词头上的标签：imperfective、perfective、plural（只有复数）、indeclinable…… */
  headTags: string[]
  /** 体的配对（带重音） */
  partners: string[]
  /** 变格变位表 */
  cells: Cell[]
  /** 相关的派生词（关系形容词、指小、阴性、副词、动名词……，带重音） */
  related: string[]
  senses: WiktSense[]
  ipa: string[]
  audio: AudioRef[]
  /** 维基词典的变化类型：accent-b、velar-stem、4b、1a…… */
  classes: string[]
  synonyms: string[]
  antonyms: string[]
  /** derived：指小、阴性、缩写这类在 kaikki 里写成 form-of 的独立词 */
  derived: boolean
}

/** 异体写法：写法 → 目标词（带重音） */
export interface WiktAlias {
  word: string
  target: string
  pos: string
  tags: string[]
}

// ───────────────────────── 词性 ─────────────────────────

const SUBORDINATORS = new Set([
  'что',
  'чтобы',
  'чтоб',
  'если',
  'когда',
  'хотя',
  'потому что',
  'так как',
  'пока',
  'будто',
  'словно',
  'как будто',
  'ибо',
  'раз',
  'лишь',
  'едва',
  'коль',
  'коли',
  'ежели',
  'дабы',
  'нежели',
  'чем',
  'поскольку',
  'покуда',
  'дескать'
])

export function mapPos(pos: string, word: string): PosTag | null {
  switch (pos) {
    case 'noun':
      return 'noun'
    case 'name':
      return 'propn'
    case 'verb':
      return 'verb'
    case 'adj':
      return 'adj'
    case 'adv':
      return 'adv'
    case 'pron':
      return 'pron'
    case 'det':
      return 'det'
    case 'num':
      return 'num'
    case 'prep':
    case 'postp':
      return 'adp'
    case 'conj':
      return SUBORDINATORS.has(word.toLowerCase()) ? 'sconj' : 'cconj'
    case 'particle':
      return 'part'
    case 'intj':
      return 'intj'
    case 'phrase':
    case 'prep_phrase':
      return 'phrase'
    case 'proverb':
      return 'proverb'
    case 'prefix':
    case 'suffix':
    case 'infix':
    case 'interfix':
    case 'combining_form':
      return 'affix'
    case 'character':
    case 'symbol':
      return 'symbol'
    default:
      return null
  }
}

// ───────────────────────── 标签 ─────────────────────────

const CASES = [
  'nominative',
  'genitive',
  'dative',
  'accusative',
  'instrumental',
  'prepositional',
  'locative',
  'partitive',
  'vocative',
  'count-form'
]
const GENDERS = ['masculine', 'feminine', 'neuter']
const NUMBERS = ['singular', 'plural']
const PERSONS = ['first-person', 'second-person', 'third-person']
const ANIMACY = ['animate', 'inanimate']
const MOODS = ['infinitive', 'present', 'future', 'past', 'imperative']

/** 变形表里留下的标签（别的去掉：indicative 多余，体是整个词条的，irregular 只是注） */
const KEEP_TAGS = new Set([
  ...CASES,
  ...GENDERS,
  ...NUMBERS,
  ...PERSONS,
  ...ANIMACY,
  ...MOODS,
  'active',
  'passive',
  'adverbial',
  'participle',
  'short-form',
  'comparative',
  'possessive'
])

/** 标签排成固定的次序：体 → 时 / 式 → 主被动 → 分词 → 人称 → 格 → 性 → 数 → 有生 */
const TAG_ORDER = [
  'imperfective',
  'perfective',
  ...MOODS,
  'active',
  'passive',
  'adverbial',
  'participle',
  'short-form',
  'comparative',
  'possessive',
  ...PERSONS,
  ...CASES,
  ...GENDERS,
  ...NUMBERS,
  ...ANIMACY
]
const rank = (t: string): number => {
  const i = TAG_ORDER.indexOf(t)
  return i < 0 ? 99 : i
}
export const sortTags = (tags: string[]): string[] =>
  [...new Set(tags)].sort((a, b) => rank(a) - rank(b))

/** 一个标签属于哪一维（合并相同形式的格子时，只允许在一维上合并） */
const DIM: Record<string, string> = {}
for (const t of CASES) DIM[t] = 'case'
for (const t of GENDERS) DIM[t] = 'gender'
for (const t of NUMBERS) DIM[t] = 'number'
for (const t of PERSONS) DIM[t] = 'person'
for (const t of ANIMACY) DIM[t] = 'animacy'
for (const t of MOODS) DIM[t] = 'mood'

/**
 * 同一个形式的几格并成一项：两格只在一维上不同（主格 / 宾格、阳性 / 中性）就并，并出来的标签组合都真实存在
 * （красивого 是阳性、中性的属格，也是阳性有生的宾格：前两格并成一项，后一格单列）
 */
export function mergeCells(cells: Cell[]): Cell[] {
  const groups = new Map<string, Set<string>[]>()
  for (const [form, ...tags] of cells) {
    const list = groups.get(form) ?? []
    list.push(new Set(tags))
    groups.set(form, list)
  }
  const out: Cell[] = []
  for (const [form, sets] of groups) {
    let changed = true
    while (changed) {
      changed = false
      outer: for (let i = 0; i < sets.length; i++)
        for (let j = i + 1; j < sets.length; j++) {
          const a = sets[i]
          const b = sets[j]
          const diff = [...a].filter((t) => !b.has(t)).concat([...b].filter((t) => !a.has(t)))
          if (!diff.length) {
            sets.splice(j, 1)
            changed = true
            break outer
          }
          const dims = new Set(diff.map((t) => DIM[t] ?? `?${t}`))
          // 只差一维，而且两边在这一维上都有值（不把「有生」跟「没写有生」并在一起）
          const dim = [...dims][0]
          if (
            dims.size === 1 &&
            !dim.startsWith('?') &&
            [...a].some((t) => DIM[t] === dim) &&
            [...b].some((t) => DIM[t] === dim)
          ) {
            sets[i] = new Set([...a, ...b])
            sets.splice(j, 1)
            changed = true
            break outer
          }
        }
    }
    for (const s of sets) out.push([form, ...sortTags([...s])])
  }
  return out
}

// ───────────────────────── 清理 ─────────────────────────

/** 变形表里的形式：去掉脚注数字与「存疑」记号；拉丁字母（混进表里的转写）、旧写法的分音符号不要 */
function cleanForm(form: string, lemmaHasSpace: boolean): string | null {
  if (/[⟐▽*$\u{FFF0}-\u{FFFF}]/u.test(form)) return null
  // 比较级写成「(по)ху́же」：括号里的 по- 是口语里加的，不算进形式
  let f = form
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, '')
    .replace(/^\((по|наи)\)/, '')
    .trim()
  // 表里的「-」「—」是空格子（这个动词没有被动形动词之类）
  if (!f || /[a-zA-Z]/.test(f) || !/[\u{400}-\u{4FF}]/u.test(f)) return null
  if (f.includes(' ') && !lemmaHasSpace) return null
  f = f.normalize('NFC')
  // ё 以外的分音符号（旧写法 ея̈）
  if (
    f
      .normalize('NFD')
      .replace(/е\u{308}|Е\u{308}/gu, '')
      .includes('\u{308}')
  )
    return null
  return f
}

/** 释义里维基词典给的转写「молоко́ (molokó)」去掉，带着的意思留下「дом (dom, “house”)」→「дом (“house”)」 */
export function cleanGloss(g: string): string {
  // 只看紧跟在西里尔字母（或重音符号）后面的括号：英文里的「to eat (food)」不动
  return g
    .replace(
      /(?<=[\u{300}\u{301}\u{400}-\u{4FF}])\s\(([^()“”]*?)(?:, (“[^”]*”))?\)/gu,
      (m, tr: string, meaning: string | undefined) =>
        /^[\u{300}-\u{36F}a-zA-Zà-žÀ-Žəɛʹʺ'’ -]+$/u.test(tr) && /[a-z]/i.test(tr)
          ? meaning
            ? ` (${meaning})`
            : ''
          : m
    )
    .replace(/\s+/g, ' ')
    .trim()
}

const SENSE_TAGS = new Set([
  'colloquial',
  'informal',
  'formal',
  'literary',
  'poetic',
  'archaic',
  'obsolete',
  'dated',
  'rare',
  'slang',
  'vulgar',
  'derogatory',
  'offensive',
  'humorous',
  'ironic',
  'euphemistic',
  'figuratively',
  'dialectal',
  'regional',
  'nonstandard',
  'proscribed',
  'endearing',
  'diminutive',
  'augmentative',
  'pejorative',
  'idiomatic',
  'historical',
  'transitive',
  'intransitive',
  'impersonal',
  'uncountable',
  'imperfective',
  'perfective',
  'Internet',
  'childish',
  'Soviet',
  'Christianity',
  'Orthodox'
])

/** 判断一个 form-of 义项是「变形」（дома = дом 的属格）还是独立的词（指小、阴性、被动……） */
const INFLECTION_TAGS = new Set([
  ...KEEP_TAGS,
  'form-of',
  'alt-of',
  'indicative',
  'perfective',
  'imperfective',
  'dated',
  'rare',
  'paucal',
  'by-personal-gender',
  'personal',
  'stressed',
  'unstressed',
  'irregular',
  'obsolete',
  'predicative',
  'demonstrative'
])
const INFLECTION_CORE = new Set([
  ...CASES,
  ...PERSONS,
  ...MOODS,
  'participle',
  'adverbial',
  'short-form',
  'comparative'
])

function isInflectionSense(s: KSense): boolean {
  if (!s.form_of && !s.alt_of) return false
  // 「inflection of весь」：标签里常常只有 form-of，看释义开头就知道是变形
  if (s.form_of && /^inflection of /.test(s.glosses?.[0] ?? '')) return true
  const t = s.tags ?? []
  if (t.includes('passive') && !t.includes('participle')) return false
  return t.every((x) => INFLECTION_TAGS.has(x)) && t.some((x) => INFLECTION_CORE.has(x))
}

/** 旧正字法：ѣ і ѳ ѵ、辅音后词尾的 ъ、е 以外字母上的分音符号（NFD 之后） */
const PRE_REFORM = /[ѣіѳѵѢІѲѴ]|[бвгджзклмнпрстфхцчшщ]ъ(?![\p{L}\p{M}])|[^еЕ]\u{308}/u

/** 词头没有 canonical 时从义项标签里取的（性、有生、体、不变格） */
const HEAD_FROM_SENSES = [
  ...GENDERS,
  ...ANIMACY,
  'imperfective',
  'perfective',
  'indeclinable',
  'by-personal-gender'
]

/** 异体写法（不另立词条）：alternative、旧正字法、错拼、按读音的写法 */
const ALIAS_TAGS = ['alternative', 'dated', 'misspelling', 'pronunciation-spelling', 'obsolete']
/** 写成 alt-of 但要另立词条的：缩写、首字母缩略、省略、截短 */
const ABBR_TAGS = ['abbreviation', 'initialism', 'acronym', 'ellipsis', 'clipping']

// ───────────────────────── 读 ─────────────────────────

export interface WiktData {
  lemmas: WiktLemma[]
  aliases: WiktAlias[]
  /** 变形词条的数目（统计用） */
  inflections: number
  /** 变形词条的写法（OpenRussian 独有的词是不是别的词的变形：найдено、хуже……） */
  inflectionWords: Set<string>
}

const strip = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u{301}\u{300}]/gu, '')
    .normalize('NFC')

export async function readWiktionary(file: string): Promise<WiktData> {
  const lemmas: WiktLemma[] = []
  const aliases: WiktAlias[] = []
  let inflections = 0
  const inflectionWords = new Set<string>()
  for await (const o of jsonl<KRecord>(file)) {
    // 旧正字法的写法（ѣ、і、ѳ、ѵ、词尾的 ъ、я̈ 这类分音符号）不立词条：今天的文本里没有，宽松键也对得上
    if (!o.word || /[*$]/.test(o.word) || PRE_REFORM.test(o.word.normalize('NFD'))) continue
    const senses = o.senses ?? []
    const formish = senses.filter((s) => s.form_of || s.alt_of)
    const allForm = senses.length > 0 && formish.length === senses.length
    if (allForm && senses.every(isInflectionSense)) {
      inflections++
      inflectionWords.add(o.word)
      continue
    }
    const pos = mapPos(o.pos, o.word)
    if (!pos) continue
    // 全是 alt-of 的：缩写另立词条，异体写法记到目标词上
    if (allForm && senses.every((s) => s.alt_of && !s.form_of)) {
      const tags = senses.flatMap((s) => s.tags ?? [])
      if (!tags.some((t) => ABBR_TAGS.includes(t))) {
        if (tags.some((t) => ALIAS_TAGS.includes(t)) || !tags.length)
          for (const s of senses)
            aliases.push({
              word: o.word,
              target: s.alt_of![0].word,
              pos: o.pos,
              tags: s.tags ?? []
            })
        continue
      }
    }
    const lemma = toLemma(o, pos, allForm)
    if (lemma) lemmas.push(lemma)
  }
  return { lemmas, aliases, inflections, inflectionWords }
}

function toLemma(o: KRecord, pos: PosTag, derived: boolean): WiktLemma | null {
  const forms = o.forms ?? []
  const canon = forms.find((f) => f.tags?.includes('canonical'))
  const stressed = (canon?.form ?? o.word).replace(/[¹²³]/g, '').trim().normalize('NFC')
  const headTags = (canon?.tags ?? []).filter((t) => t !== 'canonical')
  // 单音节的词头不标重音（стол），kaikki 就不给 canonical，性、有生、体写在义项的标签上
  for (const s of o.senses ?? [])
    for (const t of s.tags ?? [])
      if (HEAD_FROM_SENSES.includes(t) && !headTags.includes(t)) headTags.push(t)
  const hasSpace = o.word.includes(' ')

  // 词义：变形义项（混在原形词条里的「…的属格」）不要
  const senses: WiktSense[] = []
  for (const s of o.senses ?? []) {
    if (isInflectionSense(s)) continue
    const raw = s.glosses ?? []
    if (!raw.length) continue
    const gloss = cleanGloss(raw[raw.length - 1])
    if (!gloss) continue
    const examples: { text: string; en: string }[] = []
    for (const e of s.examples ?? []) {
      const en = e.english ?? e.translation
      if (!e.text || !en || e.text.length > 120 || en.length > 160) continue
      if (e.type && e.type !== 'example') continue
      examples.push({ text: e.text.normalize('NFC'), en })
      if (examples.length >= 2) break
    }
    senses.push({
      en: [gloss],
      tags: (s.tags ?? []).filter((t) => SENSE_TAGS.has(t)),
      topics: (s.topics ?? []).slice(0, 2),
      examples,
      of: (s.form_of ?? s.alt_of)?.[0]?.word
    })
  }
  if (!senses.length) return null

  // 变格变位表
  const cells: Cell[] = []
  const related: string[] = []
  const partners: string[] = []
  const classes: string[] = []
  const tableForms = forms.filter((f) => f.source === 'declension' || f.source === 'conjugation')
  for (const f of forms) {
    const t = f.tags ?? []
    if (t.includes('class')) {
      classes.push(f.form)
      continue
    }
    if (t.some((x) => ['table-tags', 'inflection-template', 'romanization', 'dated'].includes(x)))
      continue
    if (f.source === 'declension' || f.source === 'conjugation') {
      const form = cleanForm(f.form, hasSpace)
      if (!form) continue
      let tags = t.filter((x) => KEEP_TAGS.has(x))
      // 过去时复数不分性（表里按三个性各写了一遍）
      if (tags.includes('past') && tags.includes('plural'))
        tags = tags.filter((x) => !GENDERS.includes(x))
      if (!tags.length) continue
      cells.push([form, ...sortTags(tags)])
      continue
    }
    if (f.source) continue
    // 词头那一行的形式
    if (t.includes('canonical')) continue
    const form = cleanForm(f.form, hasSpace)
    if (!form) continue
    if (t.includes('perfective') || t.includes('imperfective')) {
      if (pos === 'verb') partners.push(form)
    } else if (t.includes('comparative')) cells.push([form, 'comparative'])
    else if (t.includes('alternative')) cells.push([form, 'alternative'])
    else if (
      t.some((x) =>
        [
          'relational',
          'diminutive',
          'augmentative',
          'pejorative',
          'feminine',
          'masculine',
          'adverb',
          'abstract-noun',
          'noun-from-verb',
          'superlative',
          'endearing'
        ].includes(x)
      ) &&
      !t.some((x) => CASES.includes(x))
    )
      related.push(form)
    else if (!tableForms.length && t.some((x) => CASES.includes(x)))
      // 没有变格表的（表没解析出来）：用词头那行给的属格、复数
      cells.push([form, ...sortTags(t.filter((x) => KEEP_TAGS.has(x)))])
  }

  // 性、有生
  let gender: string | undefined
  if (headTags.includes('by-personal-gender')) gender = 'c'
  else {
    const g = GENDERS.filter((x) => headTags.includes(x))
    if (g.length === 1) gender = g[0][0]
    else if (g.length === 2 && g.includes('masculine') && g.includes('feminine')) gender = 'c'
  }
  const anim = headTags.includes('animate')
  const inan = headTags.includes('inanimate')
  const animacy = anim && inan ? 'both' : anim ? 'animate' : inan ? 'inanimate' : undefined

  // 发音
  const ipa: string[] = []
  for (const s of o.sounds ?? [])
    if (s.ipa && !s.note && !(s.tags ?? []).length && !ipa.length) ipa.push(s.ipa)
  if (!ipa.length) {
    const first = (o.sounds ?? []).find((s) => s.ipa)
    if (first?.ipa) ipa.push(first.ipa)
  }
  const audio: AudioRef[] = []
  for (const s of o.sounds ?? []) {
    const url = s.mp3_url ?? s.ogg_url
    if (!url || audio.some((a) => a.url === url)) continue
    audio.push({ url, credit: `维基共享资源 ${s.audio ?? ''}`.trim() })
    if (audio.length >= 3) break
  }

  const words = (list?: { word: string }[]): string[] =>
    [...new Set((list ?? []).map((x) => x.word).filter((w) => w && w !== o.word))].slice(0, 8)

  return {
    word: strip(o.word),
    stressed,
    pos,
    rawPos: o.pos,
    gender: pos === 'noun' || pos === 'propn' ? gender : undefined,
    animacy: pos === 'noun' || pos === 'propn' ? animacy : undefined,
    headTags,
    partners: [...new Set(partners)],
    cells: mergeCells(dedupeCells(cells)),
    related: [...new Set(related)].slice(0, 8),
    senses,
    ipa,
    audio,
    classes,
    synonyms: words(o.synonyms),
    antonyms: words(o.antonyms),
    derived
  }
}

function dedupeCells(cells: Cell[]): Cell[] {
  const seen = new Set<string>()
  return cells.filter((c) => {
    const k = c.join('|')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
