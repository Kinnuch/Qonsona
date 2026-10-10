/**
 * 英文维基词典的法语词条（kaikki.org 的 French，wiktextract 抽取）→ 词条草稿。
 *
 * 词典的骨架用它：英文释义简短、按义项分好，带语体标签、例句（有英译）、性、IPA、录音、变位与变格表。
 * - 「某词的变形」「某词的异体」（form_of / alt_of）不单独成词条，记下来挂到原词上当变形；
 * - 同一个词、同一个词性、同一个性的几条（不同词源）并成一条（chat「猫」与 chat「网聊」）；性不同的分开
 *   （le livre「书」、la livre「磅」）；
 * - 变位表里的「avoir + 过去分词」这类复合形式不进变形表，只用来看复合时态用 avoir 还是 être。
 */
import { join } from 'node:path'
import type { AudioRef, PosTag } from '../../../src/shared/lang/types'
import { frKey } from '../../../src/shared/lang/fr/rules'
import { CACHE } from './fetch'
import { DOWNLOADS } from './sources'
import { cached, log, readJsonl } from './io'

// ───────────────────────── 原始数据的形状（只列用到的） ─────────────────────────

interface WxSound {
  ipa?: string
  audio?: string
  mp3_url?: string
  ogg_url?: string
  tags?: string[]
  raw_tags?: string[]
  note?: string
}
interface WxExample {
  text?: string
  english?: string
  translation?: string
  type?: string
}
interface WxSense {
  glosses?: string[]
  raw_glosses?: string[]
  tags?: string[]
  topics?: string[]
  examples?: WxExample[]
  synonyms?: { word: string }[]
  antonyms?: { word: string }[]
  form_of?: { word: string }[]
  alt_of?: { word: string }[]
}
interface WxForm {
  form: string
  tags?: string[]
}
interface WxEntry {
  word: string
  pos: string
  lang_code: string
  etymology_number?: number | string
  senses?: WxSense[]
  forms?: WxForm[]
  sounds?: WxSound[]
  head_templates?: { name?: string; expansion?: string }[]
  synonyms?: { word: string }[]
  antonyms?: { word: string }[]
}

// ───────────────────────── 词条草稿 ─────────────────────────

export interface DraftExample {
  text: string
  en?: string
}

export interface DraftSense {
  en: string[]
  t: string[]
  dom: string[]
  ex: DraftExample[]
  syn: string[]
  ant: string[]
}

export interface Draft {
  w: string
  /** 规整过的词头（frKey） */
  k: string
  p: PosTag
  /** wiktextract 原来的词性（noun、verb、prep_phrase……） */
  wpos: string
  g?: string
  ipa: string[]
  au: AudioRef[]
  senses: DraftSense[]
  /** [形式, ...标签] */
  f: string[][]
  /** 复合时态的助动词 */
  aux?: string[]
  /** 不及物、代词式等整条的标签 */
  tags: string[]
}

/** 别的词条的变形、异体：挂到原词上 */
export interface Pointer {
  /** 这个写法 */
  form: string
  /** 原词 */
  of: string
  pos: PosTag
  tags: string[]
}

// ───────────────────────── 对照表 ─────────────────────────

const COORD = new Set(['et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'soit', 'puis'])
const ARTICLE_CONTRACTIONS = new Set(['au', 'aux', 'du', 'des', 'ès'])

/** wiktextract 的词性 → UPOS（不收的返回 null） */
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
    case 'adv_phrase':
      return 'adv'
    case 'pron':
      return 'pron'
    case 'det':
    case 'article':
      return 'det'
    case 'num':
      return 'num'
    case 'prep':
    case 'postp':
    case 'prep_phrase':
      return 'adp'
    case 'conj':
      return COORD.has(frKey(word)) ? 'cconj' : 'sconj'
    case 'intj':
      return 'intj'
    case 'particle':
      return 'part'
    case 'phrase':
      return 'phrase'
    case 'proverb':
      return 'proverb'
    case 'prefix':
    case 'suffix':
    case 'infix':
    case 'interfix':
      return 'affix'
    case 'contraction':
      return ARTICLE_CONTRACTIONS.has(frKey(word)) ? 'det' : 'other'
    default:
      // character、symbol、punct：不是学习者要查的词
      return null
  }
}

/** 义项上保留的标签（Wiktextract 的标签词；界面按 tags.ts 翻成中文） */
const SENSE_TAGS = new Set([
  'colloquial',
  'informal',
  'slang',
  'vulgar',
  'derogatory',
  'offensive',
  'pejorative',
  'familiar',
  'formal',
  'literary',
  'poetic',
  'archaic',
  'obsolete',
  'dated',
  'rare',
  'figuratively',
  'humorous',
  'euphemistic',
  'childish',
  'transitive',
  'intransitive',
  'pronominal',
  'reflexive',
  'impersonal',
  'countable',
  'uncountable',
  'plural',
  'singular',
  'masculine',
  'feminine',
  'invariable',
  'Quebec',
  'Canada',
  'Belgium',
  'Switzerland',
  'Africa',
  'France',
  'Louisiana',
  'Acadia',
  'Internet',
  'abbreviation',
  'acronym',
  'initialism',
  'auxiliary',
  'ironic',
  'nonstandard',
  'proscribed',
  'regional',
  'Verlan',
  'Anglicism'
])

/** 变形表里不要的：表格说明、模板名、复合形式、转写 */
const SKIP_FORM_TAGS = new Set([
  'table-tags',
  'inflection-template',
  'multiword-construction',
  'romanization',
  'class'
])
/** 混进变形表的 IPA（manger 表里的 mɑ\u0303ʒ） */
const IPA_CHARS = /[ɑɛɔəøœʁʒʃɲŋɥɡˈˌː]|\u0303/

/**
 * 变形标签整理：简单过去时英文维基词典写成 historic + past，框架的标签词是 past-historic；
 * canonical（只是标出词头的写法）不要
 */
function formTags(tags: string[]): string[] {
  const t = tags.filter((x) => x !== 'canonical')
  if (t.includes('historic') && t.includes('past'))
    return ['past-historic', ...t.filter((x) => x !== 'historic' && x !== 'past')]
  return t
}

/** wiktextract 自动加上的上级领域（科学、生活方式、爱好……），跟具体领域重复，不要 */
const UMBRELLA = new Set([
  'sciences',
  'natural-sciences',
  'human-sciences',
  'physical-sciences',
  'social-science',
  'lifestyle',
  'hobbies',
  'entertainment',
  'science'
])

/** 整条都是「某词的变形 / 异体」时仍当词条收的词性（虚词） */
const KEEP_FORM_POS = new Set(['contraction', 'article', 'det', 'pron', 'prep', 'conj', 'particle'])

const isFormOf = (s: WxSense): boolean =>
  !!(s.form_of?.length || s.alt_of?.length) ||
  !!s.tags?.some((t) => t === 'form-of' || t === 'alt-of')

/** 「chat m (plural chats, feminine chatte)」里词头后面的性 */
function genderOf(e: WxEntry, senses: WxSense[]): string | undefined {
  const head = e.head_templates?.[0]?.expansion ?? ''
  const after = head.startsWith(e.word) ? head.slice(e.word.length) : head
  const m = /^\s*(m or f|f or m|m and f|mf|m|f|n)\b(?: or (m|f)\b)?/.exec(after)
  if (m) {
    const g = m[1] + (m[2] ? m[2] : '')
    if (/m.*f|f.*m|mf/.test(g)) return 'mf'
    if (g === 'm' || g === 'f') return g
  }
  if (e.pos !== 'noun' && e.pos !== 'name') return undefined
  const tags = new Set(senses.flatMap((s) => s.tags ?? []))
  if (tags.has('masculine') && tags.has('feminine')) return 'mf'
  if (tags.has('masculine')) return 'm'
  if (tags.has('feminine')) return 'f'
  return undefined
}

/** 录音：带 mp3 地址的；标签是地区（France、Paris、Canada……） */
function audioOf(sounds: WxSound[]): AudioRef[] {
  const out: AudioRef[] = []
  for (const s of sounds) {
    const url = s.mp3_url ?? s.ogg_url
    if (!s.audio || !url || !/^https:\/\/upload\.wikimedia\.org\//.test(url)) continue
    out.push(audioRef(url, s.audio, [...(s.tags ?? []), ...(s.raw_tags ?? [])], s.note))
  }
  return out
}

/** 录音地区里认得的国家（法语、英语的叫法）→ 统一的英文名 */
const COUNTRIES: [RegExp, string][] = [
  [/^(France|Paris)$/i, 'France'],
  [/^(Belgique|Belgium)$/i, 'Belgium'],
  [/^(Suisse|Switzerland)$/i, 'Switzerland'],
  [/^(Canada|Québec|Quebec)$/i, 'Canada'],
  [/^(Louisiane|Louisiana|États-Unis|United States|USA)$/i, 'United States'],
  [/^(Luxembourg)$/i, 'Luxembourg'],
  [/^(Monaco)$/i, 'Monaco'],
  [/^(Haïti|Haiti)$/i, 'Haiti'],
  [/^(Sénégal|Senegal)$/i, 'Senegal'],
  [/^(Côte d['’]Ivoire|Ivory Coast)$/i, "Côte d'Ivoire"],
  [/^(Cameroun|Cameroon)$/i, 'Cameroon'],
  [/^(Congo|RDC|République démocratique du Congo|DR Congo)$/i, 'Congo'],
  [/^(Maroc|Morocco)$/i, 'Morocco'],
  [/^(Algérie|Algeria)$/i, 'Algeria'],
  [/^(Tunisie|Tunisia)$/i, 'Tunisia'],
  [
    /^(Mali|Bénin|Benin|Togo|Madagascar|Burkina Faso|Niger|Gabon|Guinée|Guinea|Rwanda|Burundi)$/i,
    ''
  ],
  [/^(Liban|Lebanon)$/i, 'Lebanon'],
  [/^(La Réunion|Réunion|Martinique|Guadeloupe|Guyane|Nouvelle-Calédonie|Mayotte)$/i, 'France']
]

/** 「Paris (France)」「Suisse (canton du Valais)」「France · Agen」统一写成「France (Paris)」「Switzerland (Valais)」 */
export function placeLabel(parts: string[]): string {
  const flat = parts
    .flatMap((p) => p.split(/[()（）,，·]/))
    .map((p) =>
      p
        .replace(/^(canton|région|province|département|ville) (du|de la|de l['’]|de|des) /i, '')
        .trim()
    )
    .filter((p) => p && !/^(audio|音频|音頻|prononciation)$/i.test(p))
  let country = ''
  const places: string[] = []
  for (const p of flat) {
    const hit = COUNTRIES.find(([re]) => re.test(p))
    // Paris、Québec、海外省这些本身也是地名：国家没定就顺带定下国家，地名照样记下
    const isPlace =
      /^(Paris|Québec|Quebec|Louisiane|Louisiana)$/i.test(p) ||
      (hit?.[1] === 'France' && !/^France$/i.test(p))
    if (hit && !country) country = hit[1] || p
    if ((!hit || isPlace) && !places.includes(p)) places.push(p)
  }
  const place = places.slice(0, 1).join('')
  if (country) return place ? `${country} (${place})` : country
  return places.join(' · ')
}

/** Lingua Libre 的文件名是「LL-Q150 (fra)-说话人-词.wav」，一律 CC BY-SA 4.0 */
export function audioRef(url: string, file: string, tags: string[], note?: string): AudioRef {
  const ll = /^LL-Q150 \(fra\)-([^-]+)-/.exec(file)
  const place = placeLabel([...tags, ...(note ? [note] : [])])
  return {
    url,
    ...(place ? { label: place } : {}),
    ...(ll
      ? { license: 'CC BY-SA 4.0', credit: `Lingua Libre · ${ll[1]}` }
      : { credit: 'Wikimedia Commons' })
  }
}

/** IPA：音位的 /…/ 在前，标了地区（Louisiana、Canada）的放后面 */
function ipaOf(sounds: WxSound[]): string[] {
  const main: string[] = []
  const regional: string[] = []
  for (const s of sounds) {
    if (!s.ipa) continue
    const ipa = s.ipa.trim()
    if (s.tags?.length) regional.push(ipa)
    else main.push(ipa)
  }
  return [...new Set([...main, ...regional])].slice(0, 3)
}

/** 一条释义：去掉括号里的语体说明重复、首尾空白 */
function cleanGloss(g: string): string {
  return g.replace(/\s+/g, ' ').trim()
}

// ───────────────────────── 解析 ─────────────────────────

export interface EnWikt {
  drafts: Draft[]
  pointers: Pointer[]
}

/** 例句最长多少字（太长的文学引文不适合学习者） */
const MAX_EXAMPLE = 120

export async function loadEnWikt(): Promise<EnWikt> {
  const file = join(CACHE, DOWNLOADS.enwikt.file)
  return cached('enwikt', 7, [file], async () => {
    log('读英文维基词典的法语词条…')
    const byKey = new Map<string, Draft>()
    const pointers: Pointer[] = []
    let records = 0
    for await (const e of readJsonl<WxEntry>(file)) {
      if (e.lang_code !== 'fr' || !e.word) continue
      const pos = mapPos(e.pos, e.word)
      if (!pos) continue
      records++
      const senses = e.senses ?? []
      // 变形、异体的义项：记成指向原词的变形
      for (const s of senses) {
        if (!isFormOf(s)) continue
        const of = s.form_of?.[0]?.word ?? s.alt_of?.[0]?.word
        if (!of) continue
        const tags = (s.tags ?? []).filter((t) => t !== 'form-of' && t !== 'alt-of')
        if (s.alt_of?.length && !tags.includes('alternative')) tags.push('alternative')
        pointers.push({ form: e.word, of, pos, tags })
      }
      // 缩合冠词（au = à + le）、省音形式（l'、qu'）、限定词的变形（cette）这些虚词，英文维基词典记成
      // 「某词的异体 / 变形」，但学习者要能单独查到：整条都是变形的虚词，把这些义项当正式义项收
      const keepForms = KEEP_FORM_POS.has(e.pos) && senses.every(isFormOf)
      const real = senses.filter(
        (s) => (keepForms || !isFormOf(s)) && (s.glosses?.length || s.raw_glosses?.length)
      )
      if (!real.length) continue
      const g = pos === 'noun' || pos === 'propn' ? genderOf(e, real) : undefined
      const key = `${frKey(e.word)}|${pos}|${g ?? ''}`
      let d = byKey.get(key)
      if (!d) {
        d = {
          w: e.word,
          k: frKey(e.word),
          p: pos,
          wpos: e.pos,
          ...(g ? { g } : {}),
          ipa: [],
          au: [],
          senses: [],
          f: [],
          tags: []
        }
        byKey.set(key, d)
      }
      const sounds = e.sounds ?? []
      // IPA 只取第一条记录的：几个词源并在一起时，后面的读音多是方言或外来词（chat「网聊」/tʃat/）
      if (!d.ipa.length) d.ipa.push(...ipaOf(sounds))
      for (const a of audioOf(sounds)) if (!d.au.some((x) => x.url === a.url)) d.au.push(a)
      // 变形
      for (const f of e.forms ?? []) {
        const tags = f.tags ?? []
        if (!f.form || tags.some((t) => SKIP_FORM_TAGS.has(t))) {
          // 「avoir + past participle」：复合时态用哪个助动词
          if (tags.includes('multiword-construction')) {
            const aux = /^(avoir|être)\b/.exec(f.form)?.[1]
            if (aux) (d.aux ??= []).includes(aux) || d.aux.push(aux)
          }
          continue
        }
        if (IPA_CHARS.test(f.form) || f.form === '-' || f.form === '—') continue
        if (pos === 'verb' && / /.test(f.form) && !/^(?:me|te|se|s'|m'|t')/.test(f.form)) continue
        const ft = formTags(tags)
        if (tags.includes('canonical') && frKey(f.form) === d.k) continue
        if (!d.f.some((x) => x[0] === f.form && x.slice(1).join(' ') === ft.join(' ')))
          d.f.push([f.form, ...ft])
      }
      // 义项
      for (const s of real) {
        const gl = s.glosses ?? s.raw_glosses ?? []
        const en = cleanGloss(gl[gl.length - 1] ?? '')
        // 「Used other than figuratively or idiomatically: see à, la.」这种只是说字面意思见各个词，不算义项
        if (!en || /^Used other than figuratively or idiomatically/i.test(en)) continue
        const t = [
          ...new Set(
            (s.tags ?? []).filter((x) => SENSE_TAGS.has(x) && !(keepForms && x === 'abbreviation'))
          )
        ]
        // 跟词条的性一样的不必每个义项都标
        const st =
          g && g !== 'mf' ? t.filter((x) => x !== (g === 'm' ? 'masculine' : 'feminine')) : t
        const ex: DraftExample[] = []
        for (const x of s.examples ?? []) {
          const text = x.text?.replace(/\s+/g, ' ').trim()
          if (!text || text.length > MAX_EXAMPLE || ex.length >= 2) continue
          if (x.type === 'quotation' && text.length > 80) continue
          const tr = (x.english ?? x.translation)?.replace(/\s+/g, ' ').trim()
          ex.push({ text, ...(tr ? { en: tr } : {}) })
        }
        d.senses.push({
          en: [en],
          t: st,
          dom: [...new Set((s.topics ?? []).filter((t) => !UMBRELLA.has(t)))].slice(0, 3),
          ex,
          syn: [...new Set((s.synonyms ?? []).map((x) => x.word))].slice(0, 6),
          ant: [...new Set((s.antonyms ?? []).map((x) => x.word))].slice(0, 6)
        })
      }
    }
    const drafts = [...byKey.values()].filter((d) => d.senses.length)
    log(
      `英文维基词典：${records} 条记录 → ${drafts.length} 个词条草稿，${pointers.length} 个变形指向`
    )
    return { drafts, pointers }
  })
}
