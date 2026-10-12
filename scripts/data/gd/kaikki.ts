/**
 * 读英文维基词典的盖尔语词条（kaikki.org / wiktextract 的 JSONL），整理成词典库的词条。
 *
 * - 词性对到 UPOS；名词的性来自义项标签；IPA 分通用与方言（方言的放进 x.ipaDialects）。
 * - 变形表：去掉维基模板的残留（表头、模板名、「tha e / i」被拆开留下的单个代词、^(N 1)) 这类脚注），
 *   短语形（an cat、chan eil mi、nas fheàrr）拆出里面的那个词；标签换成界面认得的标签词。
 * - 「某词的某形式」页（chunnaic = faic 的过去式、bhàta = bàta 的弱化形、dé = dè 的旧写法）不单独成条，
 *   并进原形的变形表——阅读器、查词靠变形表找回原形；找不到原形的才单独留下。
 * - 动名词（dol、dèanamh）只有「某动词的动名词」一个意思的，并进动词；另有意思的照样成条，x.vnOf 记着动词。
 */
import { readFileSync } from 'node:fs'
import type { AudioRef, LexEntryData, LexSense, PosTag } from '../../../src/shared/lang/types'
import { canLenite, lenite } from '../../../src/shared/lang/gd/mutation'
import { gdKey } from '../../../src/shared/lang/gd/rules'

// ───────────────────────── kaikki 的形状（只列用到的） ─────────────────────────

interface KForm {
  form: string
  tags?: string[]
  source?: string
}
interface KExample {
  text?: string
  translation?: string
  english?: string
  type?: string
  ref?: string
}
interface KSense {
  glosses?: string[]
  raw_glosses?: string[]
  tags?: string[]
  topics?: string[]
  qualifier?: string
  form_of?: { word: string; extra?: string }[]
  alt_of?: { word: string; extra?: string }[]
  examples?: KExample[]
  synonyms?: { word: string }[]
  antonyms?: { word: string }[]
}
interface KSound {
  ipa?: string
  note?: string
  tags?: string[]
  audio?: string
  ogg_url?: string
  mp3_url?: string
}
export interface KEntry {
  word: string
  pos: string
  senses: KSense[]
  forms?: KForm[]
  sounds?: KSound[]
  etymology_text?: string
  synonyms?: { word: string }[]
  antonyms?: { word: string }[]
}

// ───────────────────────── 整理后的词条 ─────────────────────────

/** 一条还没写进库的维基词典例句（写库时换成例句 id） */
export interface PendingExample {
  text: string
  en: string
}

export interface GdEntry {
  /** 词典库的词条（fr、lv 由 build.ts 算好再填） */
  data: LexEntryData
  /** kaikki 的词性名（noun、verb、prep……），对语料词性、核心词表用 */
  kpos: string
  /** 每个义项挂的维基词典例句 */
  examples: PendingExample[][]
  /** 找不到原形、暂时单独成条的「某词的某形式」：原形的词头与这个词形的标签 */
  orphan?: { targets: string[]; tags: string[] }
}

// ───────────────────────── 词性 ─────────────────────────

/** 从属连词（其余的连词算并列连词） */
const SUBORDINATORS = new Set([
  'gun',
  'gum',
  'gu',
  'nach',
  'nuair',
  'ma',
  'mas',
  'mura',
  'mur',
  'ged',
  'mus',
  'gus',
  'nan',
  'nam',
  'on',
  'bhon',
  'o',
  'seach',
  'mar',
  'oir',
  'a chionn',
  'air sgàth',
  'an àite',
  'cho luath',
  'fhad',
  'fhad is',
  'dar'
])

export function mapPos(kpos: string, word: string): PosTag {
  switch (kpos) {
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
    case 'prep':
    case 'prep_phrase':
      return 'adp'
    case 'conj':
      return SUBORDINATORS.has(word.toLowerCase()) ? 'sconj' : 'cconj'
    case 'det':
    case 'article':
      return 'det'
    case 'particle':
      return 'part'
    case 'num':
      return 'num'
    case 'intj':
      return 'intj'
    case 'phrase':
      return 'phrase'
    case 'proverb':
      return 'proverb'
    case 'prefix':
    case 'suffix':
    case 'combining_form':
      return 'affix'
    case 'character':
      return 'symbol'
    default:
      return 'other'
  }
}

// ───────────────────────── 标签 ─────────────────────────

/** kaikki 的标签 → 界面的标签词（见 src/shared/lang/tags.ts）；null 表示丢掉 */
const TAG_MAP: Record<string, string | null> = {
  'prothesis-h': 'h-prothesis',
  'prothesis-t': 't-prothesis',
  'noun-from-verb': 'verbal-noun',
  autonomous: 'impersonal',
  mutation: null,
  'mutation-radical': null,
  personal: null,
  'error-unrecognized-form': null,
  'error-unknown-tag': null,
  'table-tags': null,
  'inflection-template': null,
  canonical: null,
  uppercase: null,
  lowercase: null,
  'form-of': null,
  'alt-of': null,
  morpheme: null,
  also: null,
  'in-compounds': null
}

export function normTags(tags: string[] | undefined): string[] {
  const out: string[] = []
  for (const t of tags ?? []) {
    const m = t in TAG_MAP ? TAG_MAP[t] : t
    if (m && !out.includes(m)) out.push(m)
  }
  return out
}

/** 义项上保留的用法标签（语法性的 masculine、genitive 这类不放义项上） */
const SENSE_TAGS = new Set([
  'dated',
  'archaic',
  'obsolete',
  'rare',
  'colloquial',
  'informal',
  'formal',
  'literary',
  'poetic',
  'dialectal',
  'slang',
  'vulgar',
  'derogatory',
  'offensive',
  'euphemistic',
  'humorous',
  'figuratively',
  'idiomatic',
  'historical',
  'transitive',
  'intransitive',
  'with-dative',
  'with-genitive',
  'with-nominative',
  'triggers-lenition',
  'triggers-eclipsis',
  'no-plural',
  'uncountable',
  'collective',
  'in-plural',
  'indeclinable',
  'copulative',
  'auxiliary',
  'impersonal',
  'abbreviation',
  'contraction',
  'diminutive',
  'Lewis',
  'Canada',
  'Ireland',
  'Internet'
])

// ───────────────────────── 释义 ─────────────────────────

/** 按顶层（括号外）的分隔符拆开 */
function splitTop(text: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    if (ch === sep && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim()).filter(Boolean)
}

const wordCount = (s: string): number =>
  s
    .replace(/\([^)]*\)/g, ' ')
    .trim()
    .split(/\s+/).length

/**
 * 一条英文释义拆成几条：分号一律拆；逗号只在每段都很短（≤ 3 个词）时拆（dog, hound → dog | hound），
 * 句子式的释义（Used to indicate …, feelings and …）不拆
 */
export function splitGloss(gloss: string): string[] {
  const out: string[] = []
  for (const part of splitTop(gloss, ';')) {
    const sub = splitTop(part, ',')
    if (sub.length > 1 && sub.every((s) => wordCount(s) <= 3)) out.push(...sub)
    else out.push(part)
  }
  return [...new Set(out)]
}

// ───────────────────────── 变形表 ─────────────────────────

/** 变位表里跟在动词后的人称代词（系词表里还有弱化的 mhi、强调的 mise……） */
const PRONOUNS = new Set([
  'mi',
  'mhi',
  'thu',
  'tu',
  'e',
  'i',
  'sinn',
  'sibh',
  'iad',
  'mise',
  'thusa',
  'tusa',
  'esan',
  'ise',
  'sinne',
  'sibhse',
  'iadsan'
])
/** 短语形前头的虚词：冠词、否定与疑问小品词、比较级的 nas / as、过去时的 do */
const LEADING = new Set([
  'an',
  'am',
  'na',
  'nan',
  'nam',
  "a'",
  'cha',
  'chan',
  'nach',
  'a',
  'gun',
  'gum',
  'mura',
  'mur',
  'do',
  "dh'",
  'nas',
  'as',
  'bu',
  'na bu',
  'ro'
])
/** 表里注在词后的用法：(archaic) 等 */
const NOTE_RE = /\s*\((archaic|dated|obsolete|rare|dialectal|poetic|literary)\)\s*/g

/**
 * 变形表里的一格 → 一个词形（拆不出来时给 null）：
 * (a') chait → chait；an t-uisge → t-uisge；chan eil mi → eil；nas fheàrr → fheàrr；bithidh e → bithidh
 */
export function cleanForm(raw: string, tags: string[]): { form: string; tags: string[] } | null {
  let text = raw.replace(/\^\(.*$/, '').trim()
  const extra: string[] = []
  text = text.replace(NOTE_RE, (_, note: string) => {
    extra.push(note)
    return ' '
  })
  text = text
    .replace(/[?!]+$/, '')
    .replace(/^\(a'\)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
  // 表里的说明（after "an"）、脚注、数字都不是词形
  if (!text || text === '-' || /[()[\]{}<>=|/\\0-9"“”]/.test(text)) return null
  let words = text.split(' ')
  if (words.length > 1) {
    // 先去后头的人称代词，再去前头的冠词、小品词（bu mhi → bu，不能先去 bu 剩下 mhi）
    while (words.length > 1 && PRONOUNS.has(words[words.length - 1].toLowerCase()))
      words = words.slice(0, -1)
    while (words.length > 1 && LEADING.has(words[0].toLowerCase())) words = words.slice(1)
  }
  // 还剩几个词的：最多三个词的短语留着（ceart gu leòr），长的是表头说明
  if (words.length > 3) return null
  // 只剩一个人称代词：变位表里「tha e / i」「bithidh e / i」被拆开留下的（标着时态、式）；
  // 代词自己的表（mi 的强调形 mise）不在此列
  if (
    words.length === 1 &&
    PRONOUNS.has(words[0].toLowerCase()) &&
    (tags.some((t) => VERB_TAGS.has(t)) || !tags.includes('emphatic'))
  )
    return null
  return { form: words.join(' '), tags: [...tags, ...extra] }
}

/** 动词变位表的标签（时、式、独立 / 从属） */
const VERB_TAGS = new Set([
  'present',
  'past',
  'future',
  'conditional',
  'imperative',
  'independent',
  'dependent',
  'interrogative',
  'negative',
  'impersonal',
  'relative'
])

/** 名词变格类别（III masculine noun → III） */
function cleanClass(raw: string): string | null {
  const m = /^([IVX]+)\b/.exec(raw.trim())
  return m ? `declension ${m[1]}` : null
}

// ───────────────────────── 读、整理 ─────────────────────────

export function readKaikki(file: string): KEntry[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as KEntry)
}

const isFormSense = (s: KSense): boolean => !!(s.form_of?.length || s.alt_of?.length)

/** 粘进 form_of 目标里的英文释义尾巴（aig at him） */
const EN_TAIL = new Set([
  'at',
  'him',
  'her',
  'it',
  'them',
  'me',
  'you',
  'us',
  'of',
  'to',
  'for',
  'with',
  'from',
  'by',
  'on',
  'in',
  'the',
  'about',
  'over',
  'under',
  'upon',
  'into',
  'out'
])

/** 释义里只用文字写着「某词的某形式」的（维基词典没用模板）：认出来补成 form_of */
const TEXT_FORM_RE =
  /^(.*?\b(?:form|plural|singular|genitive|dative|vocative|nominative|lenited|prothesized|eclipsed|inflection|past|future|conditional|participle|person|emphatic|comparative|superlative|tense|degree))\b[^.;]*?\bof ([\p{L}'’-]+)(?:\s*[(:“"].*)?$/u
/** 释义里的语法词 → kaikki 的标签词（normTags 再换成界面的） */
const TEXT_TAGS: Record<string, string> = {
  genitive: 'genitive',
  vocative: 'vocative',
  dative: 'dative',
  nominative: 'nominative',
  singular: 'singular',
  plural: 'plural',
  comparative: 'comparative',
  superlative: 'superlative',
  past: 'past',
  future: 'future',
  present: 'present',
  conditional: 'conditional',
  imperative: 'imperative',
  participle: 'participle',
  emphatic: 'emphatic',
  dependent: 'dependent',
  independent: 'independent',
  relative: 'relative',
  question: 'interrogative',
  interrogative: 'interrogative',
  negative: 'negative',
  masculine: 'masculine',
  feminine: 'feminine',
  'first-person': 'first-person',
  'second-person': 'second-person',
  'third-person': 'third-person',
  lenited: 'lenition',
  't-prothesized': 'prothesis-t',
  'h-prothesized': 'prothesis-h',
  eclipsed: 'eclipsis'
}

/**
 * 维基词典有一百来页只用文字写「某词的某形式」（vocative/genitive singular of salann、
 * t-prothesized form of uisge、Sutherland form of thoir）：补成 form_of 与标签，后面一并并进原形
 */
export function structureTextualForms(raw: KEntry[]): number {
  const words = new Set(raw.map((k) => k.word))
  let n = 0
  for (const k of raw)
    for (const s of k.senses) {
      if (isFormSense(s)) continue
      const g = s.glosses?.[s.glosses.length - 1] ?? ''
      const m = TEXT_FORM_RE.exec(g)
      if (!m || !words.has(m[2]) || m[2] === k.word) continue
      const tags = m[1]
        .toLowerCase()
        .split(/[\s/,]+/)
        .map((w) => TEXT_TAGS[w])
        .filter((t): t is string => !!t)
      if (!tags.length) {
        tags.push('alternative')
        // Sutherland form of、Lewis form of：方言形
        if (/^\p{Lu}/u.test(m[1])) tags.push('dialectal')
      }
      s.form_of = [{ word: m[2] }]
      s.tags = [...new Set([...(s.tags ?? []), ...tags])]
      n++
    }
  return n
}

/** 去掉音标两边的斜线 / 方括号以外的杂质，空的给 null */
function cleanIpa(ipa: string | undefined): string | null {
  const t = ipa?.trim()
  return t && /[/[]/.test(t) ? t : null
}

/** 维基共享资源的录音：mp3 优先（体积小、到处能放） */
function audioOf(s: KSound): AudioRef | null {
  const url = s.mp3_url ?? s.ogg_url
  if (!url) return null
  const ll = /^LL-Q\d+ \(gla\)-([^-]+)-/.exec(s.audio ?? '')
  const label = [s.note, ...(s.tags ?? []).filter((t) => t !== 'Scotland')]
    .filter(Boolean)
    .join(' ')
  return {
    url,
    ...(label ? { label } : {}),
    license: 'CC BY-SA',
    credit: ll ? `${ll[1]}（Lingua Libre / Wikimedia Commons）` : 'Wikimedia Commons'
  }
}

/** 词条整理时数下来的情况，build.ts 写进汇报 */
export interface KaikkiStats {
  read: number
  entries: number
  folded: number
  orphanForms: number
  formsDropped: number
  /** 只用文字写着「某词的某形式」、补成 form_of 的义项 */
  textualForms: number
}

/**
 * 整理全部词条：返回词条（每个「词头 + 词性 + 词源」一条，「某词的某形式」并进原形）和统计
 */
export function buildEntries(raw: KEntry[]): { entries: GdEntry[]; stats: KaikkiStats } {
  const stats: KaikkiStats = {
    read: raw.length,
    entries: 0,
    folded: 0,
    orphanForms: 0,
    formsDropped: 0,
    textualForms: structureTextualForms(raw)
  }
  // 先把每个页面拆成「自己的义项」与「某词的某形式」两部分
  const own: { k: KEntry; senses: KSense[] }[] = []
  const formSenses: { k: KEntry; s: KSense }[] = []
  for (const k of raw) {
    const mine = k.senses.filter((s) => !isFormSense(s) && s.glosses?.length)
    for (const s of k.senses) if (isFormSense(s)) formSenses.push({ k, s })
    if (mine.length) own.push({ k, senses: mine })
  }

  const entries: GdEntry[] = []
  const byWord = new Map<string, GdEntry[]>()
  const byPage = new Map<KEntry, GdEntry>()
  for (const { k, senses } of own) {
    const e = makeEntry(k, senses, stats)
    entries.push(e)
    byPage.set(k, e)
    const key = gdKey(k.word)
    if (!byWord.has(key)) byWord.set(key, [])
    byWord.get(key)!.push(e)
  }

  // 「某词的某形式」并进原形：按词性挑目标（动名词、分词 → 动词；比较级 → 形容词；介词代词 → 介词）
  const formOnly = new Map<string, KEntry>()
  for (const k of raw) if (k.senses.every((s) => isFormSense(s))) formOnly.set(gdKey(k.word), k)
  const resolve = (word: string, depth = 0): GdEntry[] => {
    const hit = byWord.get(gdKey(word))
    if (hit?.length) return hit
    // wiktextract 偶尔把英文释义的后半截粘进目标词（aige 的目标成了「aig at him」）：后面都是英文虚词时
    // 取第一个词再试；「an Giblean」「an t-Ollamh」这种带冠词的盖尔语目标不能这么拆
    const [first, ...tail] = word.trim().split(/\s+/)
    if (tail.length && tail.every((w) => EN_TAIL.has(w)) && byWord.get(gdKey(first))?.length)
      return byWord.get(gdKey(first))!
    if (depth >= 3) return []
    const k = formOnly.get(gdKey(word))
    const next = k?.senses.flatMap((s) => [...(s.form_of ?? []), ...(s.alt_of ?? [])]) ?? []
    return next.flatMap((t) => resolve(t.word, depth + 1))
  }
  const orphans = new Map<string, { k: KEntry; senses: KSense[] }>()
  for (const { k, s } of formSenses) {
    const targets = [...(s.form_of ?? []), ...(s.alt_of ?? [])].map((t) => t.word.trim())
    const tags = normTags(s.tags).filter((t) => !['masculine', 'feminine'].includes(t))
    if (s.alt_of?.length && !tags.includes('alternative')) tags.unshift('alternative')
    const want = wantPos(k.pos, s.tags ?? [])
    let placed = false
    for (const t of targets) {
      const cands = resolve(t)
      const same = cands.filter((c) => want.includes(c.kpos))
      for (const c of same.length ? same : cands) {
        addForm(c, k.word, tags)
        // 这一页的 IPA 是这个词形的读音（chunnaic、bhàta）：记进 fi，阅读器给这个形注音、变形表里显示
        const ipa = k.sounds?.map((x) => cleanIpa(x.ipa)).find(Boolean)
        if (ipa && gdKey(k.word) !== gdKey(c.data.w)) (c.data.fi ??= {})[k.word] ??= ipa
        for (const snd of k.sounds ?? []) {
          const au = audioOf(snd)
          if (au) {
            au.label = k.word + (au.label ? ` · ${au.label}` : '')
            ;(c.data.au ??= []).push(au)
          }
        }
        placed = true
        // 自己另有意思的动名词（dèanamh 还是「做法」）：记着它是哪个动词的动名词
        const mine = byPage.get(k)
        if (mine && tags.includes('verbal-noun') && c.kpos === 'verb')
          (mine.data.x ??= {}).vnOf = c.data.w
      }
    }
    if (placed) stats.folded++
    else {
      // 找不到原形：这个义项留在它自己的词条里（释义就是「X 的某形式」）
      const key = `${k.word}|${k.pos}`
      if (!orphans.has(key)) orphans.set(key, { k, senses: [] })
      orphans.get(key)!.senses.push(s)
      stats.orphanForms++
    }
  }
  for (const { k, senses } of orphans.values()) {
    const e = makeEntry(k, senses, stats)
    e.orphan = {
      targets: senses.flatMap((s) =>
        [...(s.form_of ?? []), ...(s.alt_of ?? [])].map((t) => t.word)
      ),
      tags: normTags(senses[0].tags).filter((t) => !['masculine', 'feminine'].includes(t))
    }
    entries.push(e)
    const key = gdKey(k.word)
    if (!byWord.has(key)) byWord.set(key, [])
    byWord.get(key)!.push(e)
  }

  untangle(entries, byWord)
  // 收尾：变形表去重、弱化形（x.len）、动名词（x.vn）
  for (const e of entries) finishEntry(e)
  stats.entries = entries.length
  return { entries, stats }
}

/** 系词自己的形式（别的词头也有这几个写法时照样留给系词） */
const COPULA_FORMS = new Set(['is', 'bu', "b'", "'s"])
/** 虚词的 kaikki 词性 */
const FUNCTION_KPOS = new Set(['article', 'det', 'particle', 'prep', 'conj', 'pron'])
/** 人称代词（不带强调的）：只能是代词自己的词形 */
const BASIC_PRONOUNS = new Set(['mi', 'mhi', 'thu', 'tu', 'e', 'i', 'sinn', 'sibh', 'iad'])
/** 动词前的小品词（chan e、nach e 拆剩的）：不当 bi 的变形 */
const PARTICLES = new Set([
  'cha',
  'chan',
  'nach',
  'an',
  'am',
  'gun',
  'gum',
  'gu',
  'mura',
  'mur',
  'ma',
  'mas',
  'a'
])

/**
 * 维基词典的几处互相抄了一份的变形表：
 * - 系词 is 的页面带着 bi 的整张变位表（tha、bha、bidh……），bi 的表里又有系词的 is、bu：各归各的，
 *   不然正文里的 Is 会被认成 bi；系词表里拆出来、又是别的词头的（an、cha、nach）也不留，免得抢了冠词、否定小品词；
 * - 介词 an「在」的表里有「在我的」nam、「在他的」na……，这些另有词条，留在介词表里会让 na（冠词）被认成介词
 */
function untangle(entries: GdEntry[], byWord: Map<string, GdEntry[]>): void {
  // nach、cha、an（疑问系词）、thathar 的页面也套了系词与 bi 的变位模板，表是抄来的：整张不要
  for (const w of ['nach', 'cha', 'chan', 'an', 'thathar'])
    for (const e of byWord.get(w) ?? []) if (e.kpos === 'verb') delete e.data.f
  const bi = byWord.get('bi')?.find((e) => e.kpos === 'verb')
  const cop = byWord.get('is')?.find((e) => e.kpos === 'verb')
  /** 这个写法是不是别的虚词的词头（冠词、小品词、介词、连词、代词、限定词） */
  const otherFunctionWord = (k: string, self: GdEntry): boolean =>
    (byWord.get(k) ?? []).some((o) => o !== self && FUNCTION_KPOS.has(o.kpos))
  if (bi?.data.f && cop?.data.f) {
    const biForms = new Set(bi.data.f.map(([f]) => gdKey(f)))
    cop.data.f = cop.data.f.filter(([f]) => {
      const k = gdKey(f)
      if (COPULA_FORMS.has(k)) return true
      return !biForms.has(k) && !otherFunctionWord(k, cop)
    })
    // bi 的表里系词拆剩的 an、cha（an e?、cha mhi）也是别的虚词：不留，免得正文的 An、Cha 被认成 bi
    bi.data.f = bi.data.f.filter(([f]) => {
      const k = gdKey(f)
      return !COPULA_FORMS.has(k) && !PARTICLES.has(k) && !otherFunctionWord(k, bi)
    })
  }
  for (const e of entries) {
    if (e.kpos !== 'prep' || !e.data.f) continue
    e.data.f = e.data.f.filter(
      ([f, ...t]) =>
        !(t.includes('possessive') && (byWord.get(gdKey(f)) ?? []).some((o) => o !== e))
    )
  }
  // 实词的「别的写法」撞上虚词词头的（arsa 的 as）：正文里几乎都是那个虚词，不留
  for (const e of entries) {
    if (FUNCTION_KPOS.has(e.kpos) || !e.data.f) continue
    e.data.f = e.data.f.filter(
      ([f, ...t]) => !(t.includes('alternative') && otherFunctionWord(gdKey(f), e))
    )
    if (!e.data.f.length) delete e.data.f
  }
}

/** 「某词的某形式」要并进哪种词性的原形 */
function wantPos(kpos: string, tags: string[]): string[] {
  if (tags.includes('noun-from-verb') || tags.includes('participle')) return ['verb']
  if (tags.includes('comparative') || tags.includes('superlative')) return ['adj']
  if (kpos === 'pron') return ['prep', 'pron']
  if (kpos === 'article') return ['article', 'det']
  return [kpos]
}

/** 并进来的词形：原形的变形表里已经有这个词形（标签更全）就不再加 */
function addForm(e: GdEntry, form: string, tags: string[]): void {
  const f = (e.data.f ??= [])
  const k = gdKey(form)
  if (k === gdKey(e.data.w) && !tags.length) return
  if (f.some(([x]) => gdKey(x) === k)) return
  f.push([form, ...tags] as [string, ...string[]])
}

function makeEntry(k: KEntry, senses: KSense[], stats: KaikkiStats): GdEntry {
  const p = mapPos(k.pos, k.word)
  // 性：义项都标阳性 → m，都标阴性 → f，两种都有 → mf
  let g: string | undefined
  if (k.pos === 'noun' || k.pos === 'name') {
    const m = senses.some((s) => s.tags?.includes('masculine'))
    const fem = senses.some((s) => s.tags?.includes('feminine'))
    g = m && fem ? 'mf' : m ? 'm' : fem ? 'f' : undefined
  }
  // IPA：没有方言注的是通用读音；有注的另记
  const ipa: string[] = []
  const dialects: [string, string][] = []
  for (const s of k.sounds ?? []) {
    const v = cleanIpa(s.ipa)
    if (!v) continue
    const note = [s.note, ...(s.tags ?? [])].filter(Boolean).join(', ')
    if (note) dialects.push([v, note])
    else if (!ipa.includes(v)) ipa.push(v)
  }
  if (!ipa.length && dialects.length) ipa.push(dialects[0][0])
  const au = (k.sounds ?? []).map(audioOf).filter((a): a is AudioRef => !!a)

  const examples: PendingExample[][] = []
  const s: LexSense[] = senses.map((ks) => {
    const glosses = ks.glosses ?? []
    // 嵌套义项：kaikki 把上级义项放在前面，最后一条才是这个义项本身
    const gloss = glosses[glosses.length - 1] ?? ''
    let en = splitGloss(gloss)
    if (ks.qualifier && en.length) en = [`(${ks.qualifier}) ${en[0]}`, ...en.slice(1)]
    const sense: LexSense = { en }
    const t = (ks.tags ?? []).filter((x) => SENSE_TAGS.has(x))
    if (t.length) sense.t = t
    if (ks.topics?.length) sense.dom = ks.topics
    const notSelf = (w: string): boolean => !!w && gdKey(w) !== gdKey(k.word)
    const syn = (ks.synonyms ?? []).map((x) => x.word).filter(notSelf)
    if (syn.length) sense.syn = [...new Set(syn)]
    const ant = (ks.antonyms ?? []).map((x) => x.word).filter(notSelf)
    if (ant.length) sense.ant = [...new Set(ant)]
    // 例句：要有英文翻译；文学引文太长的不要
    const ex: PendingExample[] = []
    for (const x of ks.examples ?? []) {
      const text = x.text?.trim()
      const tr = (x.translation ?? x.english)?.trim()
      if (!text || !tr) continue
      if (text.length > (x.type === 'quotation' ? 120 : 160)) continue
      ex.push({ text, en: tr })
    }
    examples.push(ex)
    return sense
  })
  // 页面级的近义、反义词挂到第一个义项上
  const pageSyn = (k.synonyms ?? []).map((x) => x.word).filter((w) => w && w !== k.word)
  if (pageSyn.length) s[0].syn = [...new Set([...(s[0].syn ?? []), ...pageSyn])]
  const pageAnt = (k.antonyms ?? []).map((x) => x.word).filter((w) => w && w !== k.word)
  if (pageAnt.length) s[0].ant = [...new Set([...(s[0].ant ?? []), ...pageAnt])]

  // 变形表
  const f: [string, ...string[]][] = []
  const cls: string[] = []
  let irregular = false
  for (const kf of k.forms ?? []) {
    const raw = kf.tags ?? []
    if (raw.includes('table-tags')) {
      if (kf.form === 'irregular') irregular = true
      continue
    }
    if (raw.includes('inflection-template')) continue
    if (raw.includes('class')) {
      const c = cleanClass(kf.form)
      if (c && !cls.includes(c)) cls.push(c)
      continue
    }
    // 词头模板里的说明文字（of consonants and Dh-prothesis of vowels）
    if (raw.some((t) => t.startsWith('triggers-') || t.startsWith('with-'))) {
      stats.formsDropped++
      continue
    }
    if (raw.includes('canonical') || raw.includes('error-unknown-tag')) continue
    const cleaned = cleanForm(kf.form, normTags(raw))
    // 变位表拆剩的人称代词（bithidh e / i 的 i）与动词前的小品词（chan abair 的 chan）不是这个词的形
    const bare = cleaned?.form.toLowerCase() ?? ''
    if (
      !cleaned ||
      (k.pos !== 'pron' && BASIC_PRONOUNS.has(bare)) ||
      (k.pos === 'verb' && PARTICLES.has(bare))
    ) {
      stats.formsDropped++
      continue
    }
    if (!f.some(([x, ...t]) => x === cleaned.form && t.join(' ') === cleaned.tags.join(' ')))
      f.push([cleaned.form, ...cleaned.tags])
  }
  if (irregular) cls.push('irregular')

  const data: LexEntryData = { w: k.word, p: [p], s, src: ['wiktionary'] }
  if (g) data.g = g
  if (ipa.length) data.ipa = ipa.slice(0, 3)
  if (au.length) data.au = au
  if (f.length) data.f = f
  if (cls.length) data.cls = cls
  const x: Record<string, unknown> = {}
  if (dialects.length) x.ipaDialects = dialects.slice(0, 6)
  const ety = k.etymology_text?.trim()
  if (ety) x.ety = ety.length > 400 ? ety.slice(0, 397).replace(/\s+\S*$/, '') + '…' : ety
  if (Object.keys(x).length) data.x = x
  return { data, kpos: k.pos, examples }
}

/**
 * 词网、补充词条加进来以后，原来找不到原形的「某词的某形式」再试一次（bhith「bith 的弱化形」→ bith）。
 * 并进去的从词条表里拿掉；返回并进去的个数
 */
export function refoldOrphans(entries: GdEntry[]): number {
  const byKey = new Map<string, GdEntry[]>()
  for (const e of entries) {
    if (e.orphan) continue
    const k = gdKey(e.data.w)
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k)!.push(e)
  }
  let n = 0
  for (let i = entries.length - 1; i >= 0; i--) {
    const o = entries[i]
    if (!o.orphan) continue
    const targets = o.orphan.targets.flatMap((t) => byKey.get(gdKey(t)) ?? [])
    if (!targets.length) continue
    for (const t of targets) {
      addForm(t, o.data.w, o.orphan.tags)
      const ipa = o.data.ipa?.[0]
      if (ipa) (t.data.fi ??= {})[o.data.w] ??= ipa
    }
    entries.splice(i, 1)
    n++
  }
  return n
}

/** 虚词性的多词条目（sam bith、mu dheidhinn、's dòcha、an-diugh） */
const PHRASAL_POS = new Set([
  'phrase',
  'prep',
  'prep_phrase',
  'adv',
  'det',
  'pron',
  'conj',
  'intj',
  'particle',
  // 多词地名、人名：Dùn Èideann 的 Èideann、Obar Dheathain 的 Dheathain
  'name'
])

/**
 * 多词条目里自己不成词的那一段，挂成这个条目的词形：阅读器一个词一个词地查，
 * mu dheidhinn 的 dheidhinn、sam bith 的 sam、旧写法 an diugh 的 diugh 才能找回整个说法。
 * 那一段本身是词（或者别的词的变形）的不挂。要在所有词条都齐了以后做
 */
export function addPhraseParts(entries: GdEntry[]): number {
  const known = new Set<string>()
  for (const e of entries) {
    known.add(gdKey(e.data.w))
    for (const [f] of e.data.f ?? []) known.add(gdKey(f))
  }
  let added = 0
  for (const e of entries) {
    // 旧拼写把 a-nis、an-diugh、am-bliadhna 分开写（a nis、an diugh）：分写的也收成词形，阅读器对短语时认得
    const spaced = /^(a|an|am)-(\p{L}.*)$/u.exec(e.data.w)
    if (spaced) {
      const v = `${spaced[1]} ${spaced[2]}`
      if (!known.has(gdKey(v))) {
        ;(e.data.f ??= []).push([v, 'alternative'])
        known.add(gdKey(v))
        added++
      }
    }
    if (!PHRASAL_POS.has(e.kpos)) continue
    const parts = gdKey(e.data.w)
      .split(/[\s-]+/)
      .map((p) => p.replace(/^'+|'+$/g, ''))
    if (parts.length < 2 || parts.length > 3) continue
    for (const p of parts) {
      if (p.length < 3 || known.has(p)) continue
      ;(e.data.f ??= []).push([p])
      known.add(p)
      added++
    }
  }
  return added
}

/**
 * 跟词头一样、标签只说它就是原形（不定指 / 定指、主格、单数、阳性 / 阴性……）的那几行不要：
 * 不然查原形时阅读器会说「也可能是 不定指·主格·单数」，还会因此不给原形注音。
 * 属格、与格、呼格、将来时从属式……跟词头同形的照留（bàta 的属格单数也是 bàta，值得知道）
 */
const BASE_TAGS = new Set([
  'indefinite',
  'definite',
  'nominative',
  'singular',
  'masculine',
  'feminine',
  'positive'
])

/** 收尾：变形表去掉跟词头一样、没有新信息的项；读音表；弱化形、动名词、录音来源 */
export function finishEntry(e: GdEntry): void {
  const d = e.data
  const head = gdKey(d.w)
  if (d.f) {
    d.f = d.f.filter(
      ([form, ...tags]) => !(gdKey(form) === head && tags.every((t) => BASE_TAGS.has(t)))
    )
    if (!d.f.length) delete d.f
  }
  // 原形自己也进读音表：查原形时要是还对上别的几行（属格也是这个形），阅读器按 fi 注音
  if (d.ipa?.length) (d.fi ??= {})[d.w] ??= d.ipa[0]
  // 弱化形：变形表里有的用表里的，没有的按规则算（名词、形容词、动词、专名、数词）
  const len = d.f?.find(([, ...t]) => t.length === 1 && t[0] === 'lenition')?.[0]
  const x = (d.x ??= {})
  if (len) x.len = len
  else if (['noun', 'adj', 'verb', 'propn', 'num'].includes(d.p[0]) && canLenite(d.w)) {
    x.len = lenite(d.w)
    ;(d.f ??= []).push([lenite(d.w), 'lenition'])
  }
  // 动名词
  const vn = d.f?.find(([, ...t]) => t.includes('verbal-noun'))?.[0]
  if (vn && d.p[0] === 'verb') {
    x.vn = vn
    // a dhol、a dhèanamh：「去做」的 a 让动名词弱化。表里补上，免得被猜成别的词
    if (canLenite(vn)) {
      const lv = lenite(vn)
      if (!d.f!.some(([f]) => gdKey(f) === gdKey(lv))) d.f!.push([lv, 'verbal-noun', 'lenition'])
    }
  }
  if (d.au?.length && !d.src?.includes('commons')) d.src = [...(d.src ?? []), 'commons']
  if (!Object.keys(x).length) delete d.x
  // 词首音变（弱化、加 t- / h- / n-）排在变形表前头：阅读器一个词形对上几行时取第一行的标签，
  // bhàta 先说「弱化」（看得见的变化），比「定指属格单数」（要看上下文）对学的人有用；
  // 动词不动：动词的弱化形就是过去式（sheall），表里过去式本来就在前头
  if (d.f && d.p[0] !== 'verb') {
    const MUT = new Set(['lenition', 'h-prothesis', 't-prothesis', 'eclipsis'])
    const isMut = (tags: string[]): boolean => tags.length > 0 && tags.every((t) => MUT.has(t))
    d.f = [...d.f.filter(([, ...t]) => isMut(t)), ...d.f.filter(([, ...t]) => !isMut(t))]
  }
}

/**
 * 写库前把 x 里给程序用的结构换成界面直接能显示的文字：ipaDialects [[ipa, 注]] → ['ipa（注）']。
 * 变形的读音放在词条的 fi（{ 词形: IPA }），不在 x 里
 */
export function presentX(data: LexEntryData): void {
  const x = data.x
  if (!x) return
  if (Array.isArray(x.ipaDialects))
    x.ipaDialects = (x.ipaDialects as unknown[]).map((d) =>
      Array.isArray(d) ? `${d[0]}（${d[1]}）` : String(d)
    )
}
