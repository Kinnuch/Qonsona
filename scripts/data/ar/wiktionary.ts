/**
 * 读英文维基词典的阿拉伯语词条（kaikki.org 的 JSONL）：一条记录是一个词的一个词源下的一个词性。
 * 只留学习者要的：带元音的写法、词性、性、IPA、录音、义项（英文释义、标签、例句、近反义词）、
 * 变形表（变位、变格、介词接代词）、词根、派生式、名词的派生类型（动名词、主动名词……）。
 *
 * 不当成词条的：只有「……的变形」（form-of）的记录——变形表里已经有了，另外记下来补查词键；
 * 只有「……的异体 / 缩写」（alt-of）的记录——记成目标词条的一个写法。
 */
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'
import type { AudioRef, PosTag } from '../../../src/shared/lang/types'
import { arKey } from '../../../src/shared/lang/ar/rules'

export interface WiktExample {
  text: string
  en?: string
  /** example（编者写的用例）/ quotation（引文） */
  type?: string
}

export interface WiktSense {
  en: string
  /** 上一级义项的释义（kaikki 把嵌套义项写成 [上级, 本级]） */
  parent?: string
  tags: string[]
  examples: WiktExample[]
  syn: string[]
  ant: string[]
  /** 维基词典的主题分类（ar:Animals → Animals） */
  topics: string[]
}

export type Cell = [string, string[]]

export interface WiktEntry {
  /** 不带元音的写法（页面标题） */
  w: string
  /** 带元音的写法（第一个 canonical）；没有就跟 w 一样 */
  d: string
  /** 别的带元音写法（同一个词头模板里的第二、第三种念法） */
  dAlt: string[]
  /** 维基词典自己的转写（kitāb、ʔinglīziyy；ʔ ʕ ṯ ḵ ḏ š ḡ 的写法跟本软件的转写不同） */
  romWikt?: string
  pos: PosTag
  /** kaikki 的词性（noun、verb、name、character……） */
  kpos: string
  g?: string
  ipa: string[]
  au: AudioRef[]
  senses: WiktSense[]
  /** 词头模板里的主要形式：复数、阴性、未完成体、动名词……（标签照 Wiktextract） */
  head: Cell[]
  /** 变形表的每一格（标签清理过） */
  cells: Cell[]
  /** 词根：「ك ت ب」 */
  root?: string
  /** 动词的派生式：I、II……X、Iq…… */
  verbForm?: string
  /** 第一式动词的元音：过去式 ~ 现在式（a~u = kataba / yaktubu） */
  vowels?: string
  /** 名词、形容词的派生类型：verbal-noun、active-participle…… */
  deriv: string[]
  /** 名词的变格类型（triptote、diptote、invariable）、复数类型（broken-plural、sound-plural）…… */
  decl: string[]
  /** 词源里链接到的阿拉伯语页面（不带元音的标题）：派生名词没写词根时，从这里找它的动词 */
  etyLinks: string[]
  /** 记录里的分类名（nisba、方言……） */
  cats: string[]
}

/** 只有 alt-of / form-of 的记录：w 是目标词条的另一个写法或一个变形 */
export interface WiktRedirect {
  w: string
  kpos: string
  /** 目标词条带元音的写法 */
  target: string
  kind: 'alt' | 'form'
  tags: string[]
}

/** kaikki 的词性（英文版、中文版一样用英文代码）→ UPOS */
export const POS_OF: Record<string, PosTag> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adj',
  adv: 'adv',
  name: 'propn',
  phrase: 'phrase',
  prep_phrase: 'phrase',
  prep: 'adp',
  pron: 'pron',
  intj: 'intj',
  conj: 'cconj',
  num: 'num',
  particle: 'part',
  det: 'det',
  article: 'det',
  proverb: 'proverb',
  symbol: 'symbol',
  punct: 'symbol',
  character: 'symbol',
  suffix: 'affix',
  prefix: 'affix',
  interfix: 'affix',
  circumfix: 'affix',
  infix: 'affix',
  contraction: 'other',
  abbrev: 'abbr'
}

/** 从属连词（kaikki 的 conj 不分并列、从属） */
const SCONJ = new Set(
  [
    'أن',
    'إن',
    'لأن',
    'إذا',
    'إذ',
    'لو',
    'كي',
    'لكي',
    'حتى',
    'بينما',
    'عندما',
    'حينما',
    'كلما',
    'كأن',
    'لما',
    'لئلا',
    'كيلا',
    'حيث',
    'ريثما',
    'طالما',
    'مثلما',
    'كما',
    'إذن',
    'لولا',
    'متى',
    'أينما',
    'حيثما',
    'كيفما',
    'مهما'
  ].map(arKey)
)

/** 变形表标签里不要的：表格结构、维基内部的变格类名、出错标记；变格类型另记 */
const DROP_TAGS = new Set([
  'table-tags',
  'inflection-template',
  'canonical',
  'romanization',
  'error-unrecognized-form',
  'error-unknown-tag',
  'unknown',
  'triptote',
  'diptote',
  'invariable',
  'ar-infl-a',
  'ar-infl-in',
  'ar-infl-ah',
  'ar-infl-an-maksura',
  'ar-infl-an-alef',
  'ar-infl-awna',
  'form-i',
  'form-ii',
  'form-iii',
  'form-iv',
  'form-v',
  'form-vi',
  'form-vii',
  'form-viii',
  'form-ix',
  'form-x',
  'form-xi',
  'form-xii',
  'form-xiii',
  'form-xiv',
  'form-xv',
  'form-iq',
  'form-iiq',
  'form-iiiq',
  'form-ivq'
])
const DECL_TAGS = ['triptote', 'diptote', 'invariable']

/** 义项标签里留给学习者看的（语域、地区、及物性……）；派生式、form-of 之类不留 */
const SENSE_TAG_DROP = /^(form-|no-gloss|form-of|alt-of|alternative|error-|morpheme$)/

/** 名词派生类型：词源模板 → 代号 */
const DERIV: Record<string, string> = {
  'ar-verbal noun': 'verbal-noun',
  'ar-active participle': 'active-participle',
  'ar-passive participle': 'passive-participle',
  'ar-noun of place': 'noun-of-place',
  'ar-instance noun': 'instance-noun',
  'ar-elative': 'elative',
  'ar-tool noun': 'tool-noun',
  'ar-occupational noun': 'occupational-noun',
  'ar-color/defect adjective': 'color-defect-adjective'
}

const ROOT_CAT = /^Arabic terms belonging to the root (.+)$/
const ARABIC = /[\u{621}-\u{64a}]/u

/** 词根写成「ك ت ب」：字母之间一个空格，去掉元音符号、横线 */
export function normalizeRoot(r: string): string | undefined {
  const letters = [...arKey(r).replace(/[\s\-–—]+/g, '')].filter((c) => ARABIC.test(c))
  return letters.length >= 2 && letters.length <= 5 ? letters.join(' ') : undefined
}

interface RawForm {
  form: string
  tags?: string[]
  source?: string
}
interface RawSense {
  glosses?: string[]
  tags?: string[]
  form_of?: { word: string }[]
  alt_of?: { word: string }[]
  examples?: { text?: string; english?: string; translation?: string; type?: string }[]
  synonyms?: { word: string }[]
  antonyms?: { word: string }[]
  categories?: (string | { name: string; orig?: string })[]
}
interface RawRecord {
  word: string
  pos: string
  lang_code: string
  forms?: RawForm[]
  senses?: RawSense[]
  sounds?: { ipa?: string; tags?: string[]; ogg_url?: string; mp3_url?: string; audio?: string }[]
  head_templates?: { name: string; args?: Record<string, string> }[]
  etymology_templates?: { name: string; args?: Record<string, string> }[]
  etymology_links?: [string, string][]
  categories?: (string | { name: string })[]
  tags?: string[]
}

const catName = (c: string | { name: string }): string => (typeof c === 'string' ? c : c.name)

/** 一行一个记录的 JSONL（.gz），只给阿拉伯语（lang_code = ar）的 */
export async function* readKaikki(file: string): AsyncGenerator<RawRecord> {
  const input = createReadStream(file).pipe(createGunzip())
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    if (!line) continue
    const o = JSON.parse(line) as RawRecord
    if (o.lang_code === 'ar') yield o
  }
}

/** 变形表一格：去掉不要的标签；双数、复数格子上 wiktextract 多带的 singular 去掉 */
function cleanTags(tags: string[]): string[] {
  let t = tags.filter((x) => !DROP_TAGS.has(x))
  if (t.includes('dual') || t.includes('plural') || t.includes('paucal'))
    t = t.filter((x) => x !== 'singular')
  return [...new Set(t)].sort()
}

/**
 * 同一格（标签只差格、性的）里形式一样的合成一项：第一人称阳、阴性同形合成通性，
 * 双数的宾格属格同形合成一项（标签并起来，跟 Wiktextract 别的语言里「nominative accusative」的写法一样）。
 */
export function mergeCells(cells: Cell[]): Cell[] {
  const MERGE = new Set(['nominative', 'accusative', 'genitive', 'masculine', 'feminine'])
  const groups = new Map<string, { form: string; tags: Set<string>; merged: Set<string> }>()
  for (const [form, tags] of cells) {
    const base = tags.filter((t) => !MERGE.has(t))
    const k = form + '\u{1}' + base.join(' ')
    const g = groups.get(k)
    if (g) for (const t of tags) g.merged.add(t)
    else groups.set(k, { form, tags: new Set(base), merged: new Set(tags) })
  }
  const out: Cell[] = []
  for (const g of groups.values()) {
    const tags = new Set(g.tags)
    const cases = ['nominative', 'accusative', 'genitive'].filter((t) => g.merged.has(t))
    // 三个格都一样（不变格的词、口语形）就不写格
    if (cases.length < 3) for (const t of cases) tags.add(t)
    const genders = ['masculine', 'feminine'].filter((t) => g.merged.has(t))
    // 阳、阴性同形（第一人称、双数第二人称）就不写性
    if (genders.length === 1) tags.add(genders[0])
    out.push([g.form, [...tags].sort()])
  }
  return out
}

/** 词头模板 ar-verb 的参数：「I/a~u.pass.vn:…」→ 派生式 I、元音 a~u */
function verbInfo(args: Record<string, string> | undefined): { form?: string; vowels?: string } {
  const a = args?.['1'] ?? ''
  const m =
    /(?:^|<)((?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV)q?)(?:\/([aiu])~([aiu]))?/.exec(a)
  return m ? { form: m[1], vowels: m[2] ? `${m[2]}~${m[3]}` : undefined } : {}
}

/** 一个记录 → 词条（或 alt-of / form-of 的转向，或不要） */
export function parseRecord(
  o: RawRecord
): { entry: WiktEntry } | { redirect: WiktRedirect } | null {
  const pos = POS_OF[o.pos]
  if (!pos || o.pos === 'root') return null
  const senses = o.senses ?? []
  const glossed = senses.filter(
    (s) =>
      s.glosses?.length && !s.form_of?.length && !s.alt_of?.length && !s.tags?.includes('no-gloss')
  )
  if (!glossed.length) {
    // 转向：异体、缩写写成目标词条的一个写法；变形补查词键
    const s = senses.find((x) => x.alt_of?.length || x.form_of?.length)
    const target = s?.alt_of?.[0]?.word ?? s?.form_of?.[0]?.word
    if (!s || !target) return null
    return {
      redirect: {
        w: o.word,
        kpos: o.pos,
        target,
        kind: s.alt_of?.length ? 'alt' : 'form',
        tags: (s.tags ?? []).filter((t) => !SENSE_TAG_DROP.test(t))
      }
    }
  }
  const forms = o.forms ?? []
  // 带元音的写法：词头模板偶尔带进拉丁字母的说明（سَلِم m and plural of variety），截掉
  const canon = forms
    .filter((f) => f.tags?.includes('canonical'))
    .map((f) => f.form.replace(/\s*[A-Za-z(].*$/s, '').trim())
    .filter((f) => ARABIC.test(f))
  const d = canon[0] ?? o.word
  // 词头模板里的主要形式（没有 source 的）；变形表（declension / conjugation / inflection）
  const head: Cell[] = []
  const cells: Cell[] = []
  const decl = new Set<string>()
  for (const f of forms) {
    const tags = f.tags ?? []
    if (!f.form || /^[-—–?]+$/.test(f.form) || !ARABIC.test(f.form)) continue
    if (tags.includes('canonical') || tags.includes('romanization')) continue
    if (tags.includes('table-tags') || tags.includes('inflection-template')) continue
    // 变格类型看单数（复数的类型另记：破碎式 / 规则复数）
    if (tags.includes('singular') && !tags.includes('dual') && !tags.includes('plural'))
      for (const t of DECL_TAGS) if (tags.includes(t)) decl.add(t)
    if (tags.includes('broken-form')) decl.add('broken-plural')
    if (tags.includes('sound-form') && tags.includes('plural')) decl.add('sound-plural')
    const clean = cleanTags(tags)
    if (!f.source) {
      if (clean.length) head.push([f.form, clean])
    } else if (
      f.source === 'declension' ||
      f.source === 'conjugation' ||
      f.source === 'inflection'
    ) {
      if (clean.includes('informal')) continue // 不带格尾的口语形：跟各格同键，表里不重复列
      cells.push([f.form, clean])
    }
  }
  // 性：词头的 canonical 标签或记录标签
  const canonTags = forms.find((f) => f.tags?.includes('canonical'))?.tags ?? []
  const allTags = new Set([...canonTags, ...(o.tags ?? [])])
  const g =
    pos === 'noun' || pos === 'propn'
      ? allTags.has('masculine') && allTags.has('feminine')
        ? 'mf'
        : allTags.has('masculine')
          ? 'm'
          : allTags.has('feminine')
            ? 'f'
            : undefined
      : undefined
  // 义项：嵌套的拆成上级、本级两条（上级只出一次）
  const out: WiktSense[] = []
  const parents = new Set<string>()
  for (const s of glossed) {
    const gl = s.glosses!
    const topics = (s.categories ?? [])
      .map((c) => (typeof c === 'object' ? c.orig : undefined))
      .filter((x): x is string => !!x && x.startsWith('ar:'))
      .map((x) => x.slice(3))
    const tags = [...new Set((s.tags ?? []).filter((t) => !SENSE_TAG_DROP.test(t)))]
    if (gl.length > 1 && !parents.has(gl[0])) {
      parents.add(gl[0])
      out.push({ en: gl[0], tags: [], examples: [], syn: [], ant: [], topics: [] })
    }
    out.push({
      en: gl[gl.length - 1],
      parent: gl.length > 1 ? gl[0] : undefined,
      tags,
      examples: (s.examples ?? [])
        .filter((e) => e.text && ARABIC.test(e.text))
        .map((e) => ({ text: e.text!, en: e.translation ?? e.english, type: e.type })),
      syn: (s.synonyms ?? []).map((x) => x.word).filter((x) => ARABIC.test(x)),
      ant: (s.antonyms ?? []).map((x) => x.word).filter((x) => ARABIC.test(x)),
      topics
    })
  }
  // 词根：词源里的 ar-rootbox / ar-root 模板，或「属于词根 … 的词」分类
  const cats = [
    ...(o.categories ?? []).map(catName),
    ...senses.flatMap((s) => (s.categories ?? []).map(catName))
  ]
  let root: string | undefined
  for (const e of o.etymology_templates ?? [])
    if ((e.name === 'ar-rootbox' || e.name === 'ar-root') && e.args?.['1']) {
      root = normalizeRoot(e.args['1'])
      if (root) break
    }
  if (!root)
    for (const c of cats) {
      const m = ROOT_CAT.exec(c)
      if (m && (root = normalizeRoot(m[1]))) break
    }
  const deriv = [
    ...new Set(
      (o.etymology_templates ?? []).map((e) => DERIV[e.name]).filter((x): x is string => !!x)
    )
  ]
  const verb =
    pos === 'verb' ? verbInfo(o.head_templates?.find((h) => h.name === 'ar-verb')?.args) : {}
  // IPA：只留标准语的（不带地区标签）；录音：维基共享资源上的文件
  const ipa = [
    ...new Set((o.sounds ?? []).filter((s) => s.ipa && !s.tags?.length).map((s) => s.ipa!))
  ].slice(0, 2)
  const au: AudioRef[] = (o.sounds ?? [])
    .filter((s) => s.mp3_url || s.ogg_url)
    .slice(0, 3)
    .map((s) => ({
      url: s.mp3_url ?? s.ogg_url!,
      ...(s.tags?.length ? { label: s.tags.join(' ') } : {}),
      credit: 'Wikimedia Commons'
    }))
  let p: PosTag = pos
  if (o.pos === 'conj' && SCONJ.has(arKey(o.word))) p = 'sconj'
  return {
    entry: {
      w: o.word,
      d,
      dAlt: canon.slice(1).filter((x) => x !== d),
      romWikt: forms.find((f) => f.tags?.includes('romanization'))?.form,
      pos: p,
      kpos: o.pos,
      g,
      ipa,
      au,
      senses: out,
      head,
      cells: mergeCells(cells),
      root,
      verbForm: verb.form,
      vowels: verb.vowels,
      deriv,
      decl: [...decl],
      etyLinks: (o.etymology_links ?? [])
        .map(([, target]) => target.split('#')[0])
        .filter((t) => ARABIC.test(t) && !t.includes(':')),
      cats: cats.filter((c) =>
        /nisba|Egyptian|Levantine|Gulf|Maghrebi|Iraqi|dialect|obsolete|archaic|Classical|Koranic|Quranic/i.test(
          c
        )
      )
    }
  }
}
