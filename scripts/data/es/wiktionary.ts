/**
 * 读英文维基词典的西班牙语词条（kaikki.org 的 wiktextract JSONL），整理成管线用的形状：
 *
 * - 词形条目（全部义项都是 form_of：dámelo、hablaba、casas……）不另立词条：变位表、复数在原形的 forms 里，
 *   带附着代词的组合形由 rules.lemmaCandidates 拆；
 * - 异体条目（全部义项都是 alt_of：旧拼写、误拼、发音拼写）不另立词条，挂到原形上当查词键；
 * - 同一个词、同一个词性、同一个性的几个词源（gato¹ 猫、gato² 蛋糕……）并成一条，义项按词源顺序排；
 *   性不同的分开（el capital 资本 / la capital 首都、el cometa 彗星 / la cometa 风筝），
 *   西班牙语里性不同常常就是两个词，学的人要分清；
 * - 变位表去掉重复的格子：表头摘要（hablo、hablé、hablado）、「usted 命令式」的两种标法只留 formal 那种、
 *   否定命令式（no hables，跟虚拟式现在时同形）、带前置代词的自复变位（te fueras、se diese）。
 */
import type { PosTag } from '../../../src/shared/lang/types'
import { readLines } from './util'

export interface WExample {
  text: string
  en?: string
}

export interface WSense {
  /** 英文释义（几条，按顶层逗号、分号拆开） */
  en: string[]
  tags: string[]
  /** 领域（维基词典的 topics：medicine、zoology……） */
  dom: string[]
  examples: WExample[]
  syn: string[]
  ant: string[]
  /** 这个义项是「X 的变形 / 异体」 */
  formOf?: string
}

export interface WForm {
  form: string
  tags: string[]
}

export interface WSound {
  ipa: string
  tags: string[]
}

export interface WAudio {
  file: string
  url: string
  tags: string[]
}

export interface WEntry {
  word: string
  /** kaikki 的词性（noun、verb、name、prep_phrase……） */
  kpos: string
  /** 名词的性：m、f、c（通性，随所指的人：el / la estudiante）、mf（两可：el / la mar） */
  gender?: string
  /** 只有复数（gafas、vacaciones） */
  pluralOnly?: boolean
  /** 动词另有代词式（meter → meterse）的变位表 */
  pronominal?: boolean
  senses: WSense[]
  forms: WForm[]
  ipa: WSound[]
  audio: WAudio[]
  /** 变位类别（o-ue alternation……）与是否不规则 */
  classes: string[]
  irregular: boolean
  /** 并进来的几个词源的编号（调试用） */
  etyms: number[]
  /** 维基词典的同义、派生词（词头），给以后的「相关词」 */
  related: string[]
}

/** 异体：alias 是 target 的另一种写法 */
export interface WAlias {
  alias: string
  target: string
  tags: string[]
  /** 这个异体条目自己的词性（找目标词条时只认同词性的） */
  kpos: string
}

/** 词形条目：form 是 lemma 的什么形式 */
export interface WFormOf {
  lemma: string
  tags: string[]
  kpos: string
}

// ───────────────────────── 词性 ─────────────────────────

/** 从属连词（其余的连词算并列连词）；以 que 结尾的连词短语（ya que、para que……）也算 */
const SCONJ = new Set(
  (
    'que|si|porque|aunque|cuando|como|mientras|pues|conque|apenas|según|donde|luego|' +
    'en cuanto|tan pronto como|aun cuando|siquiera|cuanto|cual|mas'
  ).split('|')
)
const SCONJ_MULTI = / que$/

export function toPos(kpos: string, word: string): PosTag {
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
    case 'det':
    case 'article':
      return 'det'
    case 'prep':
    case 'contraction':
      return 'adp'
    case 'conj':
      return SCONJ.has(word) || SCONJ_MULTI.test(word) ? 'sconj' : 'cconj'
    case 'num':
      return 'num'
    case 'intj':
      return 'intj'
    case 'particle':
      return 'part'
    case 'phrase':
    case 'prep_phrase':
    case 'adv_phrase':
      return 'phrase'
    case 'proverb':
      return 'proverb'
    case 'suffix':
    case 'prefix':
    case 'interfix':
    case 'infix':
      return 'affix'
    case 'symbol':
    case 'punct':
    case 'character':
      return 'symbol'
    default:
      return 'other'
  }
}

// ───────────────────────── 性 ─────────────────────────

/**
 * 名词表头模板的第一个参数（m、f、mfbysense、m-p、m,f<q:…>……）→ 性。用框架的几种（tags.ts 的 GENDER_LABELS）：
 * m、f；c（通性：阴阳同形、随所指的人，el / la estudiante）；mf（两可、意思不变：el / la mar、el / la sartén）。
 * 「m 或（口语）f」这种带限定的，取前面那个主要的。
 */
function parseGender(arg: unknown, expansion: string): { g?: string; pl?: boolean } {
  let a = typeof arg === 'string' ? arg : ''
  if (!a || a === 'es' || a === '?') {
    // 从展开的文字里找：「pie m (plural pies)」「aboriginal m or f by sense」
    const m = / (m or f by sense|m or f|f or m|m pl|f pl|m|f)\b/.exec(expansion)
    a = m
      ? m[1].replace(' or f by sense', 'fbysense').replace(/ or /, ',').replace(' pl', '-p')
      : ''
  }
  const qualified = /<[^>]*>/.test(a)
  a = a.replace(/<[^>]*>/g, '')
  const parts = a.split(',').map((s) => s.trim())
  const first = parts[0]
  const pl = parts.every((p) => p.endsWith('-p'))
  const base = (p: string): string => p.replace(/-p$/, '')
  if (base(first) === 'mfbysense') return { g: 'c', pl }
  if (base(first) === 'mf' || base(first) === 'mfequiv') return { g: 'mf', pl }
  const g1 = base(first)
  if (parts.length > 1 && !qualified) {
    const g2 = base(parts[1])
    if ((g1 === 'm' && g2 === 'f') || (g1 === 'f' && g2 === 'm')) return { g: 'mf', pl }
  }
  return { g: g1 === 'm' || g1 === 'f' ? g1 : undefined, pl }
}

// ───────────────────────── 释义 ─────────────────────────

/** 不要的义项标签：词形、词源性质的，跟性重复的另外处理 */
const DROP_TAGS = new Set([
  'form-of',
  'alt-of',
  'morpheme',
  'error-unknown-tag',
  'no-gloss',
  'empty-gloss',
  'table-tags',
  'class',
  'error-unrecognized-form'
])

/** 顶层（括号外）的分号拆开；逗号拆开后每段都短（≤ 4 个词）才拆 */
export function splitGloss(gloss: string): string[] {
  const top = (s: string, sep: string): string[] => {
    const out: string[] = []
    let depth = 0
    let cur = ''
    for (const c of s) {
      if (c === '(' || c === '[') depth++
      else if (c === ')' || c === ']') depth = Math.max(0, depth - 1)
      if (c === sep && depth === 0) {
        out.push(cur)
        cur = ''
      } else cur += c
    }
    out.push(cur)
    return out.map((x) => x.trim()).filter(Boolean)
  }
  const out: string[] = []
  for (const part of top(gloss, ';')) {
    const pieces = top(part, ',')
    const short = pieces.every(
      (p) =>
        p
          .replace(/\([^)]*\)/g, '')
          .trim()
          .split(/\s+/).length <= 4
    )
    if (pieces.length > 1 && short) out.push(...pieces)
    else out.push(part)
  }
  return out
}

const clean = (s: unknown): string =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()

interface RawSense {
  glosses?: string[]
  raw_glosses?: string[]
  tags?: string[]
  raw_tags?: string[]
  examples?: {
    text?: string
    english?: string
    translation?: string
    type?: string
    ref?: string
  }[]
  synonyms?: { word?: string }[]
  antonyms?: { word?: string }[]
  form_of?: { word?: string }[]
  alt_of?: { word?: string }[]
  topics?: string[]
}

function parseSense(s: RawSense): WSense | null {
  const gloss = clean(s.glosses?.at(-1) ?? s.raw_glosses?.at(-1))
  if (!gloss) return null
  const tags = (s.tags ?? []).filter((t) => !DROP_TAGS.has(t))
  // 没对成标签的限定语（with ser、of a person……）放到释义前面
  const raw = (s.raw_tags ?? []).map(clean).filter(Boolean)
  const en = splitGloss(gloss)
  if (raw.length) en[0] = `(${raw.join(', ')}) ${en[0]}`
  const examples: WExample[] = []
  for (const e of s.examples ?? []) {
    const text = clean(e.text)
    const tr = clean(e.english ?? e.translation)
    // 只要短的用法例句；文学引文（有出处 ref 的）太长、拼法也旧
    if (!text || e.ref || e.type === 'quotation' || text.length > 160 || !tr) continue
    examples.push({ text, en: tr })
    if (examples.length >= 2) break
  }
  const words = (xs?: { word?: string }[]): string[] =>
    [...new Set((xs ?? []).map((x) => clean(x.word)).filter(Boolean))].slice(0, 8)
  return {
    en,
    tags,
    dom: [...new Set(s.topics ?? [])].slice(0, 3),
    examples,
    syn: words(s.synonyms),
    ant: words(s.antonyms),
    formOf: clean(s.form_of?.[0]?.word ?? s.alt_of?.[0]?.word) || undefined
  }
}

// ───────────────────────── 变形 ─────────────────────────

const CLITIC_PREFIX = /^(me|te|se|nos|os|lo|la|los|las|le|les)( (lo|la|los|las|le|les))? \S+$/

/** 整理一个词条的 forms：去掉重复的格子、带前置代词的形式；记下变位类别 */
function parseForms(
  o: { word: string; pos: string; forms?: { form?: string; tags?: string[]; source?: string }[] },
  classes: string[]
): { forms: WForm[]; irregular: boolean; pronominal: boolean } {
  const raw = o.forms ?? []
  const hasConj = raw.some((f) => f.source === 'conjugation')
  const multiWordEntry = o.word.includes(' ')
  let irregular = false
  /** 正在读代词式动词的第二张表（meter 后面的 meterse：metiéndose、métete、meterme……）：不收，规则拆得开 */
  let inPronominal = false
  let pronominal = false
  const seen = new Set<string>()
  const out: WForm[] = []
  for (const f of raw) {
    let form = clean(f.form)
    let tags = [...(f.tags ?? [])]
    // 没有这个形式的格子（llover 没有第二人称）写着 -
    if (!form || /^[-–—]+$/.test(form)) continue
    if (f.source === 'conjugation' && tags.length === 1 && tags[0] === 'infinitive') {
      inPronominal = form !== o.word && /se$/.test(form) && !/se$/.test(o.word)
      if (inPronominal) pronominal = true
    }
    if (inPronominal && f.source === 'conjugation') continue
    if (tags.includes('table-tags')) {
      if (form === 'irregular') irregular = true
      continue
    }
    if (tags.includes('class')) {
      if (!classes.includes(form)) classes.push(form)
      continue
    }
    if (tags.includes('combined-form') || tags.includes('inflection-template')) continue
    // 动词：有变位表时，表头摘要的几个（hablo、hablé、hablado）跟表里重复；异体（fablar）留着
    if (o.pos === 'verb' && hasConj && f.source !== 'conjugation' && !tags.includes('alternative'))
      continue
    // 否定命令式跟虚拟式现在时同形；usted 命令式有带 formal 与不带的两种标法，只留 formal 的
    if (tags.includes('imperative') && tags.includes('negative')) continue
    if (
      tags.includes('imperative') &&
      tags.includes('third-person') &&
      !tags.includes('formal') &&
      !tags.includes('first-person')
    )
      continue
    // usted / ustedes 的命令式：留 formal 与第三人称，「语义上是第二人称」这个标签界面上没有叫法，去掉
    tags = tags.filter((t) => t !== 'second-person-semantically' && t !== 'with-voseo')
    // 「before a noun buen」→ buen（apocopic）
    const before = /^before a (?:masculine |feminine )?(?:singular )?noun (\S+)$/.exec(form)
    if (before) {
      form = before[1]
      if (!tags.includes('apocopic')) tags = [...tags, 'apocopic']
    }
    if (!multiWordEntry && form.includes(' ')) {
      // 单个词的变形里带空格的：自复变位（te fueras）、否定命令（no hables）、冠词（la Biblia）不要；
      // 形容词的 más bueno 这类比较级留着
      if (CLITIC_PREFIX.test(form) || /^no /.test(form)) continue
      if (!tags.includes('comparative') && !tags.includes('superlative')) continue
    }
    if (form === o.word && (tags.includes('infinitive') || tags.length === 0)) continue
    const k = form + '|' + tags.join(' ')
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ form, tags })
  }
  return { forms: out, irregular, pronominal }
}

// ───────────────────────── 读整个文件 ─────────────────────────

interface RawEntry {
  word: string
  pos: string
  lang_code?: string
  etymology_number?: number
  head_templates?: { name?: string; args?: Record<string, string>; expansion?: string }[]
  senses?: RawSense[]
  forms?: { form?: string; tags?: string[]; source?: string }[]
  sounds?: {
    ipa?: string
    tags?: string[]
    raw_tags?: string[]
    audio?: string
    mp3_url?: string
    ogg_url?: string
  }[]
  synonyms?: { word?: string }[]
  derived?: { word?: string }[]
  related?: { word?: string }[]
}

export interface WiktData {
  entries: WEntry[]
  aliases: WAlias[]
  /** 词形条目：form → [{ lemma, tags }]（原形的变形表里没有的才有用） */
  formOf: Map<string, WFormOf[]>
}

export async function readWiktionary(file: string): Promise<WiktData> {
  const groups = new Map<string, WEntry>()
  const order: string[] = []
  const aliases: WAlias[] = []
  const formOf = new Map<string, WFormOf[]>()
  for await (const line of readLines(file)) {
    if (!line) continue
    const o = JSON.parse(line) as RawEntry
    if (o.lang_code && o.lang_code !== 'es') continue
    const word = clean(o.word)
    if (!word) continue
    const rawSenses = o.senses ?? []
    // 全是变形、全是异体的条目不另立
    if (rawSenses.length && rawSenses.every((s) => s.form_of?.length && !s.alt_of?.length)) {
      for (const s of rawSenses) {
        // 动词连写代词的组合形（dámelo、hacerlo、irse）由 rules.lemmaCandidates 拆，不另记
        const st = s.tags ?? []
        if (
          st.includes('combined-form') ||
          st.some((t) => t.startsWith('object-') || t === 'accusative' || t === 'dative') ||
          (s.glosses ?? []).some((g) => /combined with/.test(g))
        )
          continue
        const lemma = clean(s.form_of?.[0]?.word)
        if (!lemma || lemma === word) continue
        let list = formOf.get(word)
        if (!list) formOf.set(word, (list = []))
        list.push({ lemma, tags: (s.tags ?? []).filter((t) => !DROP_TAGS.has(t)), kpos: o.pos })
      }
      continue
    }
    if (rawSenses.length && rawSenses.every((s) => s.alt_of?.length)) {
      for (const s of rawSenses) {
        const target = clean(s.alt_of?.[0]?.word)
        if (target && target !== word)
          aliases.push({
            alias: word,
            target,
            tags: ['alternative', ...(s.tags ?? []).filter((t) => !DROP_TAGS.has(t))],
            kpos: o.pos
          })
      }
      continue
    }
    const senses = rawSenses.map(parseSense).filter((s): s is WSense => !!s)
    if (!senses.length) continue
    const head = o.head_templates?.[0]
    const { g, pl } =
      o.pos === 'noun' || o.pos === 'name'
        ? parseGender(head?.args?.['1'], clean(head?.expansion))
        : { g: undefined, pl: false }
    // 义项上跟词条的性一样的 masculine / feminine 不用重复
    if (g === 'm' || g === 'f') {
      const same = g === 'm' ? 'masculine' : 'feminine'
      for (const s of senses) s.tags = s.tags.filter((t) => t !== same)
    }
    const classes: string[] = []
    const { forms, irregular, pronominal } = parseForms(o, classes)
    const ipa: WSound[] = []
    const audio: WAudio[] = []
    for (const s of o.sounds ?? []) {
      const tags = [...(s.tags ?? []), ...(s.raw_tags ?? [])]
      if (s.ipa && /^[/[]/.test(s.ipa)) ipa.push({ ipa: s.ipa, tags })
      if (s.audio && (s.mp3_url || s.ogg_url))
        audio.push({ file: s.audio, url: s.mp3_url ?? s.ogg_url ?? '', tags })
    }
    const related = [
      ...new Set([...(o.synonyms ?? []), ...(o.related ?? [])].map((x) => clean(x.word)))
    ]
      .filter(Boolean)
      .slice(0, 12)
    const key = `${word}\t${o.pos}\t${g ?? ''}`
    const prev = groups.get(key)
    const etym = Number(o.etymology_number ?? 1)
    if (!prev) {
      groups.set(key, {
        word,
        kpos: o.pos,
        gender: g,
        pluralOnly: pl || undefined,
        pronominal: pronominal || undefined,
        senses,
        forms,
        ipa,
        audio,
        classes,
        irregular,
        etyms: [etym],
        related
      })
      order.push(key)
    } else {
      prev.senses.push(...senses)
      prev.etyms.push(etym)
      const have = new Set(prev.forms.map((f) => f.form + '|' + f.tags.join(' ')))
      for (const f of forms) if (!have.has(f.form + '|' + f.tags.join(' '))) prev.forms.push(f)
      for (const s of ipa) if (!prev.ipa.some((x) => x.ipa === s.ipa)) prev.ipa.push(s)
      for (const a of audio) if (!prev.audio.some((x) => x.file === a.file)) prev.audio.push(a)
      for (const c of classes) if (!prev.classes.includes(c)) prev.classes.push(c)
      if (pronominal) prev.pronominal = true
      prev.irregular ||= irregular
      for (const r of related) if (!prev.related.includes(r)) prev.related.push(r)
    }
  }
  return { entries: order.map((k) => groups.get(k)!), aliases, formOf }
}
