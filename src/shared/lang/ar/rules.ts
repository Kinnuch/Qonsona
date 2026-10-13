/**
 * 阿拉伯语的规则：查词的键、切词、猜原形（剥附着词）、元音符号的开关、拉丁转写。
 * 纯函数：数据管线写 form 表、主进程查词、阅读器切词都用这一份；**规则改了要重建词典库**。
 * 为什么这样定，见 docs/lang/ar.md「规则」一节。
 *
 * - 平常的阿拉伯语文本不写短元音，学习者输入也一般不带：查词键 key() 去掉全部元音符号（开口符、齐齿符、
 *   合口符、静符、叠音符、鼻音符、短 alif、诵读记号）与延长线（tatweel），保留正字法本身的区别——
 *   hamza 写在哪个字母上、ة 与 ه、ى 与 ي。带元音的写法放在词条的 d 里，form 表的 form 列也原样留着。
 * - 宽松键 looseKey() 再把 أ إ آ 并成 ا、ى 并成 ي、ة 并成 ه（不规范的书写、输入法常这样打）；
 *   拉丁转写去掉长音符、下加点、ʿ ʾ 与连字符（kitāb → kitab）。
 * - 词形变化（变位、变格、复数）靠词典的变形表，猜原形只剥附着词：前面的 و ف（连词）、ب ك ل（介词）、
 *   س（将来）、冠词 ال（含 لل 这种 ل 跟冠词的连写），后面的人称代词 ـه ـها ـهم……，并还原接后缀时变的写法
 *   （ة 写成 ت、ى 写成 ا 或 ي、hamza 换了座位、وا 的 alif 去掉）。
 */
import { segmentWords, tidy } from '../text'
import type { LangRules, LemmaGuess, MarkDef, RawToken } from '../types'

// ───────────────────────── 字符 ─────────────────────────

/** 短元音、静符、鼻音符（tanwin）、短 alif（ٰ）与古兰经的诵读记号：「元音符号」开关去掉的就是这些（叠音符另算） */
const VOWEL_MARKS =
  /[\u{610}-\u{61a}\u{64b}-\u{650}\u{652}-\u{65f}\u{670}\u{6d6}-\u{6dc}\u{6df}-\u{6e8}\u{6ea}-\u{6ed}\u{8d3}-\u{8e1}\u{8e3}-\u{8ff}]/gu
const SHADDA = /\u{651}/gu
/** 查词键去掉的：元音符号、叠音符与延长线 */
const ALL_MARKS =
  /[\u{610}-\u{61a}\u{64b}-\u{65f}\u{670}\u{6d6}-\u{6dc}\u{6df}-\u{6e8}\u{6ea}-\u{6ed}\u{8d3}-\u{8e1}\u{8e3}-\u{8ff}\u{640}]/gu
/** 一个字符是不是附加符号（元音、叠音、诵读记号；不含延长线） */
const IS_MARK =
  /^[\u{610}-\u{61a}\u{64b}-\u{65f}\u{670}\u{6d6}-\u{6dc}\u{6df}-\u{6e8}\u{6ea}-\u{6ed}\u{8d3}-\u{8e1}\u{8e3}-\u{8ff}]$/u
const TATWEEL = /\u{640}/gu
/** 双向控制符（从右往左的文本里常夹着）：LRM、RLM、ALM、嵌入与隔离 */
const BIDI = /[\u{200e}\u{200f}\u{61c}\u{202a}-\u{202e}\u{2066}-\u{2069}]/gu

/** 统一字母：alif wasla 是元音记号的一种（平常写 ا）；波斯语、乌尔都语键盘打出来的 ک ی ە 等换成阿拉伯语的 */
const LETTER_MAP: Record<string, string> = {
  ٱ: 'ا',
  ٲ: 'أ',
  ٳ: 'إ',
  ک: 'ك',
  ڪ: 'ك',
  ی: 'ي',
  ە: 'ه',
  ہ: 'ه',
  ھ: 'ه',
  ۀ: 'ه',
  ۃ: 'ة'
}
const LETTER_RE = new RegExp(`[${Object.keys(LETTER_MAP).join('')}]`, 'gu')

/** 阿拉伯-印度数字（٠–٩、۰–۹）与小数点、千分位、百分号换成 ASCII */
function asciiDigits(s: string): string {
  return s.replace(/[\u{660}-\u{669}\u{6f0}-\u{6f9}\u{66a}-\u{66c}]/gu, (c) => {
    const n = c.codePointAt(0)!
    if (n >= 0x660 && n <= 0x669) return String(n - 0x660)
    if (n >= 0x6f0 && n <= 0x6f9) return String(n - 0x6f0)
    return n === 0x66a ? '%' : n === 0x66b ? '.' : ','
  })
}

/** 规整成统一的写法，但保留元音符号：NFKC（连字 ﻻ、ﷲ 拆开）、去掉双向控制符与延长线、统一字母与数字 */
export function normalizeArabic(text: string): string {
  return asciiDigits(
    tidy(text)
      .normalize('NFKC')
      .replace(BIDI, '')
      .replace(TATWEEL, '')
      // 少数输入法把 ئ 打成 ى + hamza（NFC 不合成），先合起来
      .replace(/ى\u{654}/gu, 'ئ')
      .replace(LETTER_RE, (c) => LETTER_MAP[c])
  )
}

/** 去掉元音符号（短元音、静符、鼻音符、短 alif、诵读记号），保留叠音符；alif wasla 写回 ا */
export function stripVowels(text: string): string {
  return text.normalize('NFC').replace(VOWEL_MARKS, '').replace(/ٱ/g, 'ا')
}

/** 去掉叠音符 */
export function stripShadda(text: string): string {
  return text.replace(SHADDA, '')
}

/** 带不带元音符号（短元音、静符、鼻音符、叠音符、短 alif） */
export function hasVowelMarks(text: string): boolean {
  return /[\u{64b}-\u{652}\u{670}]/u.test(text)
}

// ───────────────────────── 查词键 ─────────────────────────

/** 查词键：去掉全部元音符号与延长线；拉丁字母转小写；空白合并 */
export function arKey(text: string): string {
  return normalizeArabic(text).replace(ALL_MARKS, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** 拉丁字母的附加符号（长音符、下加点……）；阿拉伯字母上的 hamza 不在这些区段里，不受影响 */
const LATIN_DIACRITICS = /[\u{1dc0}-\u{1dff}\u{300}-\u{36f}\u{1ab0}-\u{1aff}]/gu

/** 宽松键：再把 أ إ آ 并成 ا、ى 并成 ي、ة 并成 ه；拉丁转写去掉长音符、下加点、ʿ ʾ 与连字符 */
export function arLooseKey(text: string): string {
  return arKey(text)
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .normalize('NFD')
    .replace(LATIN_DIACRITICS, '')
    .normalize('NFC')
    .replace(/[ʾʿʔʕʼ'’‘`-]/g, '')
}

// ───────────────────────── 切词 ─────────────────────────

const ARABIC_LETTER = /[\u{621}-\u{63a}\u{641}-\u{64a}\u{66e}-\u{6d3}\u{6fa}-\u{6ff}]/u
const NUMBER = /^[\p{N}٫٬.,]+$/u

/**
 * 切词：Intl.Segmenter 切出来的再细分——阿拉伯-印度数字连同小数点（٣٫٥）算数字；
 * 字母跟数字连写的（و١٢٣「和 123」、2020م）在字母与数字之间断开。首尾相接覆盖全文。
 * 附着词（وَ، بِ، الْ、ـه……）不切开：它们跟后面的词连写，点击时由 lemmaCandidates 拆。
 */
export function arTokenize(text: string): RawToken[] {
  const out: RawToken[] = []
  for (const t of segmentWords(text, 'ar')) {
    if (t.kind !== 'word') {
      out.push(t)
      continue
    }
    if (NUMBER.test(t.text)) {
      out.push({ ...t, kind: 'num' })
      continue
    }
    const parts = [...t.text.matchAll(/[\p{N}٫٬]+|[^\p{N}٫٬]+/gu)]
    if (parts.length < 2) {
      out.push(t)
      continue
    }
    for (const m of parts) {
      const start = t.start + m.index!
      const s = m[0]
      out.push({
        text: s,
        start,
        end: start + s.length,
        kind: NUMBER.test(s) ? 'num' : /\p{L}/u.test(s) ? 'word' : 'punct'
      })
    }
  }
  return out
}

// ───────────────────────── 附着词 ─────────────────────────

/**
 * 猜原形时剥掉的附着词，LemmaGuess.tags 里用这些代号；界面按这张表显示（附着词本身、中文、英文）。
 * 前附：连词、介词、将来时、冠词；后附：人称代词（名词后是所属「我的……」，动词、介词后是宾语「……我」）。
 */
export const CLITICS: Record<string, { ar: string; zh: string; en: string }> = {
  'conj-wa': { ar: 'وَ', zh: '和；而', en: 'and' },
  'conj-fa': { ar: 'فَ', zh: '于是；就', en: 'so, then' },
  'prep-bi': { ar: 'بِ', zh: '用；在；带着', en: 'with, by, in' },
  'prep-ka': { ar: 'كَ', zh: '像……一样', en: 'like, as' },
  'prep-li': { ar: 'لِ', zh: '为了；给；属于', en: 'for, to' },
  'fut-sa': { ar: 'سَ', zh: '将要（将来时）', en: 'will (future)' },
  definite: { ar: 'الْ', zh: '定冠词', en: 'the (definite article)' },
  'pron-1s': { ar: 'ـي / ـنِي', zh: '我的；我（宾格）', en: 'my; me' },
  'pron-1p': { ar: 'ـنَا', zh: '我们的；我们（宾格）', en: 'our; us' },
  'pron-2s': { ar: 'ـكَ / ـكِ', zh: '你的；你（宾格）', en: 'your; you (sg.)' },
  'pron-2d': { ar: 'ـكُمَا', zh: '你们俩的；你们俩（宾格）', en: 'your; you (dual)' },
  'pron-2mp': { ar: 'ـكُمْ', zh: '你们的；你们（宾格）', en: 'your; you (m. pl.)' },
  'pron-2fp': { ar: 'ـكُنَّ', zh: '你们（女）的；你们（宾格）', en: 'your; you (f. pl.)' },
  'pron-3ms': { ar: 'ـهُ', zh: '他的；它的；他（宾格）', en: 'his, its; him' },
  'pron-3fs': { ar: 'ـهَا', zh: '她的；它的；她（宾格）', en: 'her, its; her' },
  'pron-3d': { ar: 'ـهُمَا', zh: '他们俩的；他们俩（宾格）', en: 'their; them (dual)' },
  'pron-3mp': { ar: 'ـهُمْ', zh: '他们的；他们（宾格）', en: 'their; them (m. pl.)' },
  'pron-3fp': { ar: 'ـهُنَّ', zh: '她们的；她们（宾格）', en: 'their; them (f. pl.)' },
  accusative: { ar: 'ـًا', zh: '宾格不定式（-an）', en: 'indefinite accusative (-an)' }
}

/** 一个字母连同它后面的元音符号；b 是规整过的字母（比较用），r 是原文（拼回候选词用） */
export interface Cluster {
  b: string
  r: string
}

/** 把一个词切成「字母 + 它的元音符号」一段一段（写法先规整过） */
export function clusters(word: string): Cluster[] {
  const out: Cluster[] = []
  for (const ch of normalizeArabic(word).normalize('NFC')) {
    if (IS_MARK.test(ch) && out.length) out[out.length - 1].r += ch
    else out.push({ b: ch, r: ch })
  }
  return out
}

const join = (cs: Cluster[]): string => cs.map((c) => c.r).join('')
const bases = (cs: Cluster[]): string => cs.map((c) => c.b).join('')

/** 后附代词：长的在前（هما 先于 هم、ها 先于 ه） */
const SUFFIXES: [string, string][] = [
  ['كما', 'pron-2d'],
  ['هما', 'pron-3d'],
  ['كم', 'pron-2mp'],
  ['كن', 'pron-2fp'],
  ['هم', 'pron-3mp'],
  ['هن', 'pron-3fp'],
  ['ها', 'pron-3fs'],
  ['نا', 'pron-1p'],
  ['ني', 'pron-1s'],
  ['ه', 'pron-3ms'],
  ['ك', 'pron-2s'],
  ['ي', 'pron-1s']
]

/** 接后缀时词干末尾变了写法的，还原回去：مدرستها → مدرسة、عليه → على、كتبوه → كتبوا、سماؤه → سماء、رآه → رأى */
function restoreStem(stem: Cluster[]): Cluster[][] {
  const out: Cluster[][] = [stem]
  const last = stem[stem.length - 1]
  const head = stem.slice(0, -1)
  const swap = (b: string): Cluster => ({ b, r: b + last.r.slice(last.b.length) })
  if (last.b === 'ت' && stem.length >= 3) out.push([...head, swap('ة')])
  if (last.b === 'ا' && stem.length >= 2) out.push([...head, swap('ى')])
  if (last.b === 'ي' && stem.length >= 2) out.push([...head, swap('ى')])
  if (last.b === 'و' && stem.length >= 2) out.push([...stem, { b: 'ا', r: 'ا' }])
  if ((last.b === 'ؤ' || last.b === 'ئ' || last.b === 'أ') && stem.length >= 2)
    out.push([...head, swap('ء')])
  if (last.b === 'آ' && stem.length >= 2)
    out.push([...head, { b: 'أ', r: 'أ' }, { b: 'ى', r: 'ى' }])
  if (bases(stem).endsWith('تمو')) out.push(stem.slice(0, -1))
  return out
}

interface PrefixSplit {
  /** 剥掉几个字母 */
  n: number
  tags: string[]
  /** لِ + الْ 连写成 لل */
  ll?: boolean
}

/** 前附：[连词] [介词 / 将来时] [冠词] 的各种剥法 */
function prefixSplits(cs: Cluster[]): PrefixSplit[] {
  const b = bases(cs)
  const out: PrefixSplit[] = [{ n: 0, tags: [] }]
  const conj = b[0] === 'و' ? 'conj-wa' : b[0] === 'ف' ? 'conj-fa' : null
  const starts: PrefixSplit[] = [{ n: 0, tags: [] }]
  if (conj) {
    starts.push({ n: 1, tags: [conj] })
    out.push({ n: 1, tags: [conj] })
  }
  for (const s of starts) {
    const c = b[s.n]
    const rest = b.slice(s.n + 1)
    if (c === 'ب' || c === 'ك')
      out.push({ n: s.n + 1, tags: [...s.tags, c === 'ب' ? 'prep-bi' : 'prep-ka'] })
    if (c === 'ل') {
      if (rest.startsWith('ل'))
        out.push({ n: s.n + 2, tags: [...s.tags, 'prep-li', 'definite'], ll: true })
      out.push({ n: s.n + 1, tags: [...s.tags, 'prep-li'] })
    }
    // 将来时 سـ 只加在未完成体动词前（词头 ي ت ن أ）
    if (c === 'س' && /^[يتنأ]/.test(rest)) out.push({ n: s.n + 1, tags: [...s.tags, 'fut-sa'] })
  }
  // 冠词：剥完前附之后还以 ال 开头，后面至少还有两个字母
  for (const p of [...out]) {
    if (p.ll || p.tags.includes('fut-sa')) continue
    if (b.startsWith('ال', p.n) && b.length - p.n - 2 >= 2)
      out.push({ n: p.n + 2, tags: [...p.tags, 'definite'] })
  }
  return out
}

// ───────────────────────── 词形变化的猜法（词典的变形表里没有时） ─────────────────────────

/** 未完成体（现在式）的前缀 + 后缀 → 人称、数、性 */
const NONPAST: Record<string, Record<string, string[]>> = {
  ي: {
    '': ['third-person', 'masculine', 'singular'],
    ون: ['third-person', 'masculine', 'plural'],
    وا: ['third-person', 'masculine', 'plural'],
    ان: ['third-person', 'dual'],
    ا: ['third-person', 'dual'],
    ن: ['third-person', 'feminine', 'plural']
  },
  ت: {
    '': [],
    ين: ['second-person', 'feminine', 'singular'],
    ي: ['second-person', 'feminine', 'singular'],
    ون: ['second-person', 'masculine', 'plural'],
    وا: ['second-person', 'masculine', 'plural'],
    ان: ['dual'],
    ا: ['dual'],
    ن: ['second-person', 'feminine', 'plural']
  },
  أ: { '': ['first-person', 'singular'] },
  ن: { '': ['first-person', 'plural'] }
}
/** 过去式的后缀 → 人称、数、性（长的在前） */
const PAST: [string, string[]][] = [
  ['تما', ['second-person', 'dual']],
  ['تم', ['second-person', 'masculine', 'plural']],
  ['تن', ['second-person', 'feminine', 'plural']],
  ['نا', ['first-person', 'plural']],
  ['وا', ['third-person', 'masculine', 'plural']],
  ['تا', ['third-person', 'feminine', 'dual']],
  ['ت', []],
  ['ا', ['third-person', 'masculine', 'dual']],
  ['ن', ['third-person', 'feminine', 'plural']]
]

/** 去掉人称词缀后的词干 → 可能的过去式第三人称阳性单数（不带元音）：各派生式、空心、尾弱、首弱、叠音 */
function pastStems(s: string, nonPast: boolean): string[] {
  const out = [s]
  if (nonPast) {
    if (s.length === 3) out.push('أ' + s) // 第四式：يرسل → أرسل
    if (/^(ن|ست|.ت)/.test(s) && s.length >= 4) out.push('ا' + s) // 第七、八、十式：ينكسر → انكسر
    if (s.length === 3 && 'وي'.includes(s[1])) out.push(s[0] + 'ا' + s[2]) // 空心：يقول → قال
    if (s.length === 2) out.push('و' + s) // 首弱：يصل → وصل
  } else {
    if (s.length === 2) out.push(s[0] + 'ا' + s[1]) // 空心：قلت → قال
    if (s.length === 3 && s[1] === s[2]) out.push(s.slice(0, 2)) // 叠音：مددت → مد
  }
  // 尾弱：يرمي → رمى、يدعو → دعا、رميت → رمى、دعوت → دعا（几种派生式一样）
  for (const x of [...out]) {
    if (x.endsWith('ي')) out.push(x.slice(0, -1) + 'ى')
    if (x.endsWith('و')) out.push(x.slice(0, -1) + 'ا')
  }
  return out.filter((x) => x.length >= 2)
}

/**
 * 词典的变形表里没有的词形（冷僻词只收了主要的形式），按词缀猜原形：动词猜过去式第三人称阳性单数，
 * 名词、形容词猜单数阳性。只用字母，不带元音；tags 用 Wiktextract 的标签词。
 */
export function affixGuesses(b: string): LemmaGuess[] {
  const out: LemmaGuess[] = []
  // 未完成体
  const P = NONPAST[b[0]]
  if (P && b.length >= 3)
    for (const [suf, tags] of Object.entries(P)) {
      if (!b.endsWith(suf)) continue
      const s = b.slice(1, b.length - suf.length)
      if (s.length < 2) continue
      for (const lemma of pastStems(s, true)) out.push({ lemma, tags: ['non-past', ...tags] })
    }
  // 过去式
  for (const [suf, tags] of PAST) {
    if (!b.endsWith(suf) || b.length - suf.length < 2) continue
    for (const lemma of pastStems(b.slice(0, -suf.length), false))
      out.push({ lemma, tags: ['past', ...tags] })
  }
  // 命令式：اكتب、اكتبوا → كتب
  if (b[0] === 'ا' && b.length >= 4)
    for (const suf of ['وا', 'ي', 'ا', 'ن', '']) {
      if (!b.endsWith(suf)) continue
      const s = b.slice(1, b.length - suf.length)
      if (s.length >= 3) out.push({ lemma: s, tags: ['imperative'] })
    }
  // 名词、形容词：阴性复数、阳性复数、双数、阴性
  const noun = (stem: string, tags: string[]): void => {
    if (stem.length < 2) return
    out.push({ lemma: stem, tags })
    if (stem.endsWith('ت')) out.push({ lemma: stem.slice(0, -1) + 'ة', tags })
  }
  if (b.length >= 4) {
    if (b.endsWith('ات')) {
      out.push({ lemma: b.slice(0, -2) + 'ة', tags: ['feminine', 'plural'] })
      noun(b.slice(0, -2), ['plural'])
    }
    if (b.endsWith('ون') || b.endsWith('ين')) noun(b.slice(0, -2), ['plural'])
    if (b.endsWith('ان') || b.endsWith('ين')) noun(b.slice(0, -2), ['dual'])
    if (b.endsWith('ة')) out.push({ lemma: b.slice(0, -1), tags: ['feminine'] })
  }
  return out
}

/**
 * 猜原形：剥掉附着词，还原词干的写法；返回的候选拿去查 form 表（变位、变格、复数在表里）。
 * 候选按剥掉的东西从少到多排：先只剥附着词，再按词缀猜变位、变格（affixGuesses）。词干至少两个字母。
 * 只剥附着词的候选保留原文的元音符号（查词键会去掉，界面可以拿来比对）。
 */
export function arLemmaCandidates(surface: string): LemmaGuess[] {
  // 附着词与词缀只属于一个正字法词；跨词去掉空白会把 في تعزيز 误当变位。
  // 真正的多词词条仍由词典精确查询处理。
  if (/\s/u.test(surface.trim())) return []
  const cs = clusters(surface).filter((c) => ARABIC_LETTER.test(c.b))
  if (cs.length < 3) return []
  const seen = new Set<string>([arKey(join(cs))])
  const found: (LemmaGuess & { cost: number })[] = []
  const stems: { b: string; tags: string[] }[] = [{ b: bases(cs), tags: [] }]
  const add = (stem: Cluster[], tags: string[]): void => {
    if (stem.length < 2) return
    const lemma = join(stem)
    const k = arKey(lemma)
    if (seen.has(k)) return
    seen.add(k)
    found.push({ lemma, tags, cost: tags.length })
    stems.push({ b: bases(stem), tags })
  }
  for (const p of prefixSplits(cs)) {
    let rest = cs.slice(p.n)
    // 冠词后面的太阳字母带着同化的叠音符，去掉
    if (p.tags.includes('definite') && rest.length)
      rest = [{ b: rest[0].b, r: rest[0].r.replace(SHADDA, '') }, ...rest.slice(1)]
    const stems: [Cluster[], string[]][] = [[rest, p.tags]]
    // لل：لِ + الْ（الكتاب → للكتاب）；词干本身以 ل 开头时冠词的 ل 也省掉（الليل → لليل）；لله = لِ + الله
    if (p.ll) {
      stems.push([[{ b: 'ل', r: 'ل' }, ...rest], p.tags])
      if (bases(rest) === 'ه')
        stems.push([[...clusters('الل'), ...rest], p.tags.filter((t) => t !== 'definite')])
    }
    for (const [stem, tags] of stems) {
      if (tags.length) add(stem, tags)
      // 后附代词
      const sb = bases(stem)
      for (const [suf, tag] of SUFFIXES) {
        if (!sb.endsWith(suf) || stem.length - suf.length < 2) continue
        for (const s of restoreStem(stem.slice(0, -suf.length))) add(s, [...tags, tag])
      }
      // 不定宾格的 alif（كتابا → كتاب）；ءا、ةا、اا、ىا 不算
      if (sb.endsWith('ا') && stem.length >= 4 && !/[اءةى]ا$/.test(sb))
        add(stem.slice(0, -1), [...tags, 'accusative'])
    }
  }
  // 再按词缀猜变位、变格：排在只剥附着词的后面
  for (const s of [...stems])
    for (const g of affixGuesses(s.b)) {
      const k = arKey(g.lemma)
      if (seen.has(k)) continue
      seen.add(k)
      found.push({ lemma: g.lemma, tags: [...s.tags, ...g.tags], cost: s.tags.length + 3 })
    }
  return found.sort((a, b) => a.cost - b.cost).map(({ lemma, tags }) => ({ lemma, tags }))
}

// ───────────────────────── 正文的记号开关 ─────────────────────────

export const AR_MARKS: MarkDef[] = [
  { id: 'harakat', name: { zh: '元音符号', en: 'Vowel marks' }, strip: stripVowels },
  { id: 'shadda', name: { zh: '叠音符', en: 'Shadda' }, strip: stripShadda }
]

// ───────────────────────── 转写 ─────────────────────────

/**
 * 简化的学术转写（跟 ALA-LC、DIN 31635 大体一致）：
 * ث th、ج j、ح ḥ、خ kh、ذ dh、ش sh、ص ṣ、ض ḍ、ط ṭ、ظ ẓ、ع ʿ、غ gh、ق q、ء ʾ（词首不写）；
 * 长元音 ā ī ū，叠音写两遍，冠词 al-（太阳字母同化：ash-shams），ة 在词尾读 -a、带格尾时 -at-，
 * 词尾的 ـِيّ 写 ī（ʿarabī）。带元音的写法转得准；不带元音的只能转出辅音与长元音（كتاب → ktāb），
 * 所以阅读器转写时用词典里带元音的形式。
 */
const CONSONANTS: Record<string, string> = {
  ب: 'b',
  ت: 't',
  ث: 'th',
  ج: 'j',
  ح: 'ḥ',
  خ: 'kh',
  د: 'd',
  ذ: 'dh',
  ر: 'r',
  ز: 'z',
  س: 's',
  ش: 'sh',
  ص: 'ṣ',
  ض: 'ḍ',
  ط: 'ṭ',
  ظ: 'ẓ',
  ع: 'ʿ',
  غ: 'gh',
  ف: 'f',
  ق: 'q',
  ك: 'k',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ه: 'h',
  و: 'w',
  ي: 'y',
  ء: 'ʾ',
  أ: 'ʾ',
  إ: 'ʾ',
  ؤ: 'ʾ',
  ئ: 'ʾ',
  پ: 'p',
  چ: 'ch',
  ڤ: 'v',
  ڥ: 'v',
  گ: 'g',
  ژ: 'zh'
}
const SUN_LETTERS = new Set([...'تثدذرزسشصضطظلن'])
const FATHA = '\u{64e}'
const DAMMA = '\u{64f}'
const KASRA = '\u{650}'
const SUKUN = '\u{652}'
const SHADDA_CH = '\u{651}'
const FATHATAN = '\u{64b}'
const DAMMATAN = '\u{64c}'
const KASRATAN = '\u{64d}'
const DAGGER = '\u{670}'

/** 一个字母后面的元音：a i u、an un in、ā（短 alif）；静符、没有标的给 '' */
function vowelOf(c: Cluster): string {
  const r = c.r
  if (r.includes(FATHATAN)) return 'an'
  if (r.includes(DAMMATAN)) return 'un'
  if (r.includes(KASRATAN)) return 'in'
  if (r.includes(DAGGER)) return r.includes(KASRA) ? 'i' : 'ā'
  if (r.includes(FATHA)) return 'a'
  if (r.includes(DAMMA)) return 'u'
  if (r.includes(KASRA)) return 'i'
  return ''
}
const hasMark = (c: Cluster | undefined, m: string): boolean => !!c && c.r.includes(m)
/** 一个字母后面一个元音、静符、叠音符都没有 */
const bare = (c: Cluster | undefined): boolean =>
  !!c && !/[\u{64b}-\u{652}\u{670}]/u.test(c.r.slice(c.b.length))

/** 「真主」几个固定的写法 */
const ALLAH: Record<string, string> = {
  الله: 'allāh',
  لله: 'lillāh',
  بالله: 'billāh',
  والله: 'wallāh',
  تالله: 'tallāh'
}
const PROCLITIC: Record<string, string> = { و: 'wa', ف: 'fa', ب: 'bi', ك: 'ka' }

/** 转写一个词（一串阿拉伯字母与符号） */
function romanizeWord(word: string): string {
  const cs = clusters(word)
  const n = cs.length
  const fixed = ALLAH[arKey(word)]
  if (fixed) {
    // اللّٰهُ → allāhu：带格尾元音的照读
    const v = vowelOf(cs[n - 1])
    return fixed + (v === 'u' || v === 'a' || v === 'i' ? v : '')
  }
  let out = ''
  let i = 0
  // 冠词的 alif：不带符号，或者只带开口符（اَلْ）
  const articleAlif = (c: Cluster): boolean =>
    c.b === 'ا' && (bare(c) || (vowelOf(c) === 'a' && !hasMark(c, SHADDA_CH)))
  // 冠词 ال：lam 带静符或不带符号；带元音的文本里后面的太阳字母带叠音符
  const lamOk = (j: number): boolean =>
    j + 2 < n &&
    articleAlif(cs[j]) &&
    cs[j + 1].b === 'ل' &&
    (hasMark(cs[j + 1], SUKUN) || (bare(cs[j + 1]) && hasMark(cs[j + 2], SHADDA_CH)))
  const article = (next: Cluster): void => {
    const assimilated = SUN_LETTERS.has(next.b) && (next.b !== 'ل' || hasMark(next, SHADDA_CH))
    out += (out ? '' : 'a') + (assimilated ? CONSONANTS[next.b] : 'l') + '-'
  }
  if (n > 2 && articleAlif(cs[0]) && cs[1].b === 'ل' && !vowelOf(cs[1])) {
    // 词首的冠词（不带元音的文本也算）
    article(cs[2])
    i = 2
  } else if (n > 3 && PROCLITIC[cs[0].b] && !bare(cs[0]) && lamOk(1)) {
    // وَالْكِتَاب → wa-l-kitāb（不带元音的 والد 是 wālid，不在这里）
    out = PROCLITIC[cs[0].b] + '-'
    article(cs[3])
    i = 3
  } else if (n > 3 && cs[0].b === 'ل' && cs[1].b === 'ل' && hasMark(cs[0], KASRA)) {
    // لِلْكِتَاب → li-l-kitāb
    out = 'li-'
    article(cs[2])
    i = 2
  }
  for (; i < n; i++) {
    const c = cs[i]
    const b = c.b
    const v = vowelOf(c)
    const first = out === '' || out.endsWith('-')
    if (b === 'ا') {
      if (first) {
        // 词首的 alif（hamzat al-wasl 或不带 hamza 的 أ）：读出它的元音；没标元音时后面是静符读 i，否则读 a
        out += v || (hasMark(cs[i + 1], SUKUN) ? 'i' : 'a')
        continue
      }
      if (v === 'an') {
        out += 'an'
        continue
      }
      // 词尾 وا 的 alif（كَتَبُوا）、鼻音符之后的 alif（كِتَابًا）不读
      if (i === n - 1 && (cs[i - 1].b === 'و' || out.endsWith('an'))) continue
      if (out.endsWith('a')) out = out.slice(0, -1) + 'ā'
      else if (!/[āīū]$/.test(out)) out += 'ā'
      continue
    }
    if (b === 'آ') {
      out += first ? 'ā' : 'ʾā'
      continue
    }
    if (b === 'ى') {
      if (v === 'an' || out.endsWith('an')) {
        if (!out.endsWith('an')) out += 'an'
        continue
      }
      if (out.endsWith('a')) out = out.slice(0, -1) + 'ā'
      else if (!out.endsWith('ā')) out += 'ā'
      continue
    }
    if (b === 'ة') {
      if (v) out += 't' + v
      else if (out.endsWith('ā')) out += 'h'
      else if (!out.endsWith('a')) out += 'a'
      continue
    }
    if ((b === 'و' || b === 'ي') && !first && !v && !hasMark(c, SHADDA_CH)) {
      const prev = cs[i - 1]
      // 长元音：前一个字母是合口符（و）/ 齐齿符（ي）
      if (hasMark(prev, b === 'و' ? DAMMA : KASRA) && /[ui]$/.test(out)) {
        out = out.slice(0, -1) + (b === 'و' ? 'ū' : 'ī')
        continue
      }
      // 双元音 aw、ay：前一个字母是开口符、自己带静符或不带符号
      if (hasMark(prev, FATHA)) {
        out += b === 'و' ? 'w' : 'y'
        continue
      }
      // 不带元音的文本：辅音后面的 و ي 当长元音
      if (bare(prev) && !/[aiuāīū]$/.test(out)) {
        out += b === 'و' ? 'ū' : 'ī'
        continue
      }
    }
    // 词尾的 ـِيّ（关系形容词 nisba）读 ī
    if (b === 'ي' && hasMark(c, SHADDA_CH) && !v && i === n - 1 && out.endsWith('i')) {
      out = out.slice(0, -1) + 'ī'
      continue
    }
    const con = CONSONANTS[b]
    if (con === undefined) {
      out += c.r
      continue
    }
    // 词首的 hamza 不写
    const cons = first && 'أإؤئء'.includes(b) ? '' : con
    out += hasMark(c, SHADDA_CH) && !out.endsWith(cons + '-') ? cons + cons : cons
    out += v || (first && b === 'أ' ? 'a' : first && b === 'إ' ? 'i' : '')
  }
  return out
}

const WORD_RE =
  /[\u{621}-\u{63a}\u{641}-\u{64a}\u{66e}-\u{6d3}\u{6fa}-\u{6ff}][\u{610}-\u{61a}\u{670}\u{6d6}-\u{6ed}\u{621}-\u{63a}\u{641}-\u{65f}\u{66e}-\u{6d3}\u{6fa}-\u{6ff}]*/gu

/**
 * 转写一段文字：阿拉伯字母逐词转写，标点、数字换成拉丁的，别的原样留着。
 * 正偏组合（iḍāfa）里前一个词的 ة 读出来：مُنَظَّمَة التَّحْرِير → munaẓẓamat at-taḥrīr
 * （前一个词不带冠词、后一个词带冠词才算；السُّلْطَة الْوَطَنِيَّة 是名词加形容词，不变）。
 */
export function arRomanize(text: string): string {
  const s = normalizeArabic(text).replace(/،/g, ',').replace(/؛/g, ';').replace(/؟/g, '?')
  let out = ''
  let last = 0
  /** 上一个词：转写在 out 里的结尾位置；是不是不带冠词、以 ة 结尾 */
  let prev: { outEnd: number; taMarbuta: boolean } | null = null
  for (const m of s.matchAll(WORD_RE)) {
    const start = m.index!
    const between = s.slice(last, start)
    const rom = romanizeWord(m[0])
    out += between
    if (
      prev?.taMarbuta &&
      /^\s+$/.test(between) &&
      /^a[a-zʿʾḥṣḍṭẓ]{1,2}-/.test(rom) &&
      out.slice(0, prev.outEnd).endsWith('a')
    )
      out = out.slice(0, prev.outEnd) + 't' + out.slice(prev.outEnd)
    const k = arKey(m[0])
    out += rom
    prev = { outEnd: out.length, taMarbuta: k.endsWith('ة') && !k.startsWith('ال') }
    last = start + m[0].length
  }
  return out + s.slice(last)
}

export const rules: LangRules = {
  key: arKey,
  looseKey: arLooseKey,
  tokenize: arTokenize,
  lemmaCandidates: arLemmaCandidates,
  guessFits: (g, row) => {
    if (g.tags.includes('definite') || g.tags.includes('accusative'))
      return (
        !['verb', 'aux'].includes(row.pos) ||
        row.tags.some((t) => t === 'participle' || t === 'verbal-noun')
      )
    return true
  },
  marks: AR_MARKS,
  romanize: arRomanize
}
