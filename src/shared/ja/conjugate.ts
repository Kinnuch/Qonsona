/**
 * 日语的活用：给原形和词类，变出ます形、て形、ない形……（变形课、变形练习用）。
 * 跟 deinflect.ts 反过来：那边还原，这边变形；测试里拿 deinflect 把变出来的还原回去核对。
 * 另外按学习者常犯的错变出几个「错的形式」，出选择题当干扰项（書く 的て形错成 書きて、書って）。
 * 写法（有汉字）和读音（假名）一起变：来る 的汉字不变、读音变（来ない こない），所以两样分开算。
 */

export type WordClass = 'v5' | 'v1' | 'vs' | 'vk' | 'adj-i' | 'adj-na'

/** 要特别处理的几个：行く（行って）、ある（ない）、いらっしゃる 这类（います、命令形い）、くれる（命令形くれ）、いい（よ） */
export type Special = 'iku' | 'aru' | 'aru-honorific' | 'kureru' | 'ii'

export interface Conjugable {
  /** 原形的写法（書く、勉強する） */
  head: string
  /** 原形的读音（かく） */
  reading: string
  cls: WordClass
  special?: Special
}

export interface Conjugated {
  text: string
  reading: string
}

export type FormId =
  | 'masu'
  | 'masen'
  | 'mashita'
  | 'nai'
  | 'nakatta'
  | 'te'
  | 'ta'
  | 'potential'
  | 'volitional'
  | 'ba'
  | 'imperative'
  | 'passive'
  | 'causative'
  | 'adj-neg'
  | 'adj-past'
  | 'adj-negpast'
  | 'adj-te'

export const VERB_FORMS: FormId[] = [
  'masu',
  'masen',
  'mashita',
  'nai',
  'nakatta',
  'te',
  'ta',
  'potential',
  'volitional',
  'ba',
  'imperative',
  'passive',
  'causative'
]
export const ADJ_FORMS: FormId[] = ['adj-neg', 'adj-past', 'adj-negpast', 'adj-te']

/** 这类词能变哪些形 */
export const formsOf = (cls: WordClass): FormId[] =>
  cls === 'adj-i' || cls === 'adj-na' ? ADJ_FORMS : VERB_FORMS

/**
 * JMdict 的词性 → 活用类；不收的（問う、愛する 这类少见的变法）给 null。
 * 带 vs 的名词（勉強）当「勉強する」
 */
export function classOf(
  pos: string[]
): { cls: WordClass; special?: Special; suru?: boolean } | null {
  for (const p of pos) {
    if (p === 'v5k-s') return { cls: 'v5', special: 'iku' }
    if (p === 'v5r-i') return { cls: 'v5', special: 'aru' }
    if (p === 'v5aru') return { cls: 'v5', special: 'aru-honorific' }
    if (/^v5[ukgstnbmr]$/.test(p)) return { cls: 'v5' }
    if (p === 'v1') return { cls: 'v1' }
    if (p === 'v1-s') return { cls: 'v1', special: 'kureru' }
    if (p === 'vk') return { cls: 'vk' }
    if (p === 'vs-i') return { cls: 'vs' }
    if (p === 'adj-i') return { cls: 'adj-i' }
    if (p === 'adj-ix') return { cls: 'adj-i', special: 'ii' }
    if (p === 'adj-na') return { cls: 'adj-na' }
  }
  if (pos.includes('vs')) return { cls: 'vs', suru: true }
  return null
}

// ── 五段动词：词尾所在的行 ──

type Row = 'a' | 'i' | 'u' | 'e' | 'o'
const ROWS: Record<string, Record<Row, string>> = {
  う: { a: 'わ', i: 'い', u: 'う', e: 'え', o: 'お' },
  く: { a: 'か', i: 'き', u: 'く', e: 'け', o: 'こ' },
  ぐ: { a: 'が', i: 'ぎ', u: 'ぐ', e: 'げ', o: 'ご' },
  す: { a: 'さ', i: 'し', u: 'す', e: 'せ', o: 'そ' },
  つ: { a: 'た', i: 'ち', u: 'つ', e: 'て', o: 'と' },
  ぬ: { a: 'な', i: 'に', u: 'ぬ', e: 'ね', o: 'の' },
  ぶ: { a: 'ば', i: 'び', u: 'ぶ', e: 'べ', o: 'ぼ' },
  む: { a: 'ま', i: 'み', u: 'む', e: 'め', o: 'も' },
  る: { a: 'ら', i: 'り', u: 'る', e: 'れ', o: 'ろ' }
}
/** て形的音便：う・つ・る → って，ぬ・ぶ・む → んで，く → いて，ぐ → いで，す → して */
const ONBIN: Record<string, string> = {
  う: 'って',
  つ: 'って',
  る: 'って',
  ぬ: 'んで',
  ぶ: 'んで',
  む: 'んで',
  く: 'いて',
  ぐ: 'いで',
  す: 'して'
}
/** て形 → た形 */
const teToTa = (te: string): string => te.slice(0, -1) + (te.endsWith('で') ? 'だ' : 'た')

/** 一个形由「词干 + 词尾」拼成：写法、读音各自的词干，共用词尾 */
interface Parts {
  text: string
  reading: string
}
const join = (stem: Parts, suffix: string): Conjugated => ({
  text: stem.text + suffix,
  reading: stem.reading + suffix
})

/** 去掉末尾 n 个字的词干（写法、读音各去各的） */
const cut = (w: Conjugable, n: number): Parts => ({
  text: w.head.slice(0, -n),
  reading: w.reading.slice(0, -n)
})

// ── 各类的正确变法 ──

function godan(w: Conjugable, form: FormId): Conjugated | null {
  const last = w.reading.slice(-1)
  const row = ROWS[last]
  if (!row || w.head.slice(-1) !== last) return null
  const stem = cut(w, 1)
  const r = (x: Row, suffix: string): Conjugated => join(stem, row[x] + suffix)
  // いらっしゃる、なさる、くださる：ます形、命令形用い段的「い」
  const iStem = w.special === 'aru-honorific' ? 'い' : row.i
  const te = w.special === 'iku' ? 'って' : ONBIN[last]
  switch (form) {
    case 'masu':
      return join(stem, iStem + 'ます')
    case 'masen':
      return join(stem, iStem + 'ません')
    case 'mashita':
      return join(stem, iStem + 'ました')
    case 'nai':
      return w.special === 'aru' ? { text: 'ない', reading: 'ない' } : r('a', 'ない')
    case 'nakatta':
      return w.special === 'aru' ? { text: 'なかった', reading: 'なかった' } : r('a', 'なかった')
    case 'te':
      return join(stem, te)
    case 'ta':
      return join(stem, teToTa(te))
    case 'potential':
      return r('e', 'る')
    case 'volitional':
      return r('o', 'う')
    case 'ba':
      return r('e', 'ば')
    case 'imperative':
      return w.special === 'aru-honorific' ? join(stem, 'い') : r('e', '')
    case 'passive':
      return r('a', 'れる')
    case 'causative':
      return r('a', 'せる')
    default:
      return null
  }
}

const ICHIDAN: Partial<Record<FormId, string>> = {
  masu: 'ます',
  masen: 'ません',
  mashita: 'ました',
  nai: 'ない',
  nakatta: 'なかった',
  te: 'て',
  ta: 'た',
  potential: 'られる',
  volitional: 'よう',
  ba: 'れば',
  imperative: 'ろ',
  passive: 'られる',
  causative: 'させる'
}

function ichidan(w: Conjugable, form: FormId): Conjugated | null {
  if (!w.reading.endsWith('る') || !w.head.endsWith('る')) return null
  if (form === 'imperative' && w.special === 'kureru') return join(cut(w, 1), '')
  const suffix = ICHIDAN[form]
  return suffix === undefined ? null : join(cut(w, 1), suffix)
}

/** する：勉強する 的「勉強」原样留着 */
const SURU: Partial<Record<FormId, string>> = {
  masu: 'します',
  masen: 'しません',
  mashita: 'しました',
  nai: 'しない',
  nakatta: 'しなかった',
  te: 'して',
  ta: 'した',
  potential: 'できる',
  volitional: 'しよう',
  ba: 'すれば',
  imperative: 'しろ',
  passive: 'される',
  causative: 'させる'
}

function suru(w: Conjugable, form: FormId): Conjugated | null {
  if (!w.reading.endsWith('する') || !w.head.endsWith('する')) return null
  const suffix = SURU[form]
  return suffix === undefined ? null : join(cut(w, 2), suffix)
}

/** 来る：写汉字时「来」不变、读音变；写假名时整个换 */
const KURU: Partial<Record<FormId, [string, string]>> = {
  masu: ['き', 'ます'],
  masen: ['き', 'ません'],
  mashita: ['き', 'ました'],
  nai: ['こ', 'ない'],
  nakatta: ['こ', 'なかった'],
  te: ['き', 'て'],
  ta: ['き', 'た'],
  potential: ['こ', 'られる'],
  volitional: ['こ', 'よう'],
  ba: ['く', 'れば'],
  imperative: ['こ', 'い'],
  passive: ['こ', 'られる'],
  causative: ['こ', 'させる']
}

function kuru(w: Conjugable, form: FormId): Conjugated | null {
  const k = KURU[form]
  if (!k || !w.reading.endsWith('くる')) return null
  const pre = { text: w.head.slice(0, -2), reading: w.reading.slice(0, -2) }
  const kanji = w.head.endsWith('来る')
  return {
    text: pre.text + (kanji ? '来' : k[0]) + k[1],
    reading: pre.reading + k[0] + k[1]
  }
}

const ADJ_I: Partial<Record<FormId, string>> = {
  'adj-neg': 'くない',
  'adj-past': 'かった',
  'adj-negpast': 'くなかった',
  'adj-te': 'くて'
}

function adjI(w: Conjugable, form: FormId): Conjugated | null {
  const suffix = ADJ_I[form]
  if (!suffix || !w.reading.endsWith('い')) return null
  // いい / 良い 变的时候用 よ（よくない、良かった）：写假名的换成よ，写汉字的留着汉字
  if (w.special === 'ii') {
    const kanaHead = /(いい|よい)$/.test(w.head)
    return {
      text: (kanaHead ? w.head.slice(0, -2) + 'よ' : w.head.slice(0, -1)) + suffix,
      reading: w.reading.slice(0, -2) + 'よ' + suffix
    }
  }
  return join(cut(w, 1), suffix)
}

const ADJ_NA: Partial<Record<FormId, string>> = {
  'adj-neg': 'ではない',
  'adj-past': 'だった',
  'adj-negpast': 'ではなかった',
  'adj-te': 'で'
}

function adjNa(w: Conjugable, form: FormId): Conjugated | null {
  const suffix = ADJ_NA[form]
  return suffix ? join({ text: w.head, reading: w.reading }, suffix) : null
}

/** 变出来的形式；这类词没有这个形（形容词的命令形……）给 null */
export function conjugate(w: Conjugable, form: FormId): Conjugated | null {
  switch (w.cls) {
    case 'v5':
      return godan(w, form)
    case 'v1':
      return ichidan(w, form)
    case 'vs':
      return suru(w, form)
    case 'vk':
      return kuru(w, form)
    case 'adj-i':
      return adjI(w, form)
    case 'adj-na':
      return adjNa(w, form)
  }
}

// ── 错的形式：学习者常犯的错（出选择题当干扰项）──

/** 五段：换错段、音便用错、当成一段动词 */
function godanWrong(w: Conjugable, form: FormId): Conjugated[] {
  const last = w.reading.slice(-1)
  const row = ROWS[last]
  if (!row) return []
  const stem = cut(w, 1)
  const r = (x: Row, suffix: string): Conjugated => join(stem, row[x] + suffix)
  const dict = { text: w.head, reading: w.reading }
  const te = w.special === 'iku' ? 'って' : ONBIN[last]
  const otherTe = [...new Set(Object.values(ONBIN))].filter((x) => x !== te)
  switch (form) {
    case 'masu':
    case 'masen':
    case 'mashita': {
      const end = { masu: 'ます', masen: 'ません', mashita: 'ました' }[form]
      return [r('a', end), r('e', end), join(dict, end)]
    }
    case 'nai':
    case 'nakatta': {
      const end = form === 'nai' ? 'ない' : 'なかった'
      return [r('i', end), r('o', end), join(dict, end)]
    }
    case 'te':
    case 'ta': {
      const fix = form === 'te' ? (x: string): string => x : teToTa
      // 行く 按 く 的规则变成 行いて 是最常见的错
      const extra = w.special === 'iku' ? [join(stem, fix('いて'))] : []
      return [
        ...extra,
        ...otherTe.slice(0, 2).map((x) => join(stem, fix(x))),
        join(stem, row.i + (form === 'te' ? 'て' : 'た')),
        join(dict, form === 'te' ? 'て' : 'た')
      ]
    }
    case 'potential':
      return [r('a', 'れる'), r('i', 'れる'), r('e', 'られる')]
    case 'volitional':
      return [r('o', 'よう'), r('a', 'う'), join(dict, 'よう')]
    case 'ba':
      return [r('a', 'ば'), r('i', 'ば'), join(dict, 'れば')]
    case 'imperative':
      return [r('e', 'ろ'), r('o', ''), r('a', '')]
    case 'passive':
      return [r('e', 'れる'), r('i', 'れる'), r('a', 'られる')]
    case 'causative':
      return [r('e', 'せる'), r('i', 'せる'), r('a', 'させる')]
    default:
      return []
  }
}

/** 一段：当成る结尾的五段动词、原形直接加词尾 */
function ichidanWrong(w: Conjugable, form: FormId): Conjugated[] {
  const s = cut(w, 1)
  const dict = { text: w.head, reading: w.reading }
  switch (form) {
    case 'masu':
    case 'masen':
    case 'mashita': {
      const end = { masu: 'ます', masen: 'ません', mashita: 'ました' }[form]
      return [join(s, 'り' + end), join(s, 'れ' + end), join(dict, end)]
    }
    case 'nai':
    case 'nakatta': {
      const end = form === 'nai' ? 'ない' : 'なかった'
      return [join(s, 'ら' + end), join(s, 'り' + end), join(dict, end)]
    }
    case 'te':
      return [join(s, 'って'), join(s, 'いて'), join(dict, 'て')]
    case 'ta':
      return [join(s, 'った'), join(s, 'いた'), join(dict, 'た')]
    case 'potential':
      return [join(s, 'らる'), join(s, 'れられる'), join(s, 'させる')]
    case 'volitional':
      return [join(s, 'ろう'), join(dict, 'う'), join(s, 'こう')]
    case 'ba':
      return [join(s, 'ば'), join(dict, 'ば'), join(s, 'らば')]
    case 'imperative':
      return [join(s, 'れ'), join(dict, ''), join(s, 'ろう')]
    case 'passive':
      return [join(s, 'れる'), join(s, 'らる'), join(s, 'させる')]
    case 'causative':
      return [join(s, 'せる'), join(s, 'らせる'), join(s, 'られる')]
    default:
      return []
  }
}

const SURU_WRONG: Partial<Record<FormId, string[]>> = {
  masu: ['すます', 'さます', 'せます'],
  masen: ['すません', 'さません', 'せません'],
  mashita: ['すました', 'さました', 'せました'],
  nai: ['すない', 'せない', 'さない'],
  nakatta: ['すなかった', 'せなかった', 'さなかった'],
  te: ['すて', 'さて', 'しって'],
  ta: ['すた', 'さた', 'しった'],
  potential: ['される', 'しれる', 'すれる'],
  volitional: ['すよう', 'しおう', 'さよう'],
  ba: ['しれば', 'しば', 'せれば'],
  imperative: ['すろ', 'しれ', 'され'],
  passive: ['しれる', 'すれる', 'しられる'],
  causative: ['しさせる', 'すさせる', 'せさせる']
}

const KURU_WRONG: Partial<Record<FormId, string[]>> = {
  masu: ['こます', 'くます', 'くります'],
  masen: ['こません', 'くません', 'くりません'],
  mashita: ['こました', 'くました', 'くりました'],
  nai: ['きない', 'くない', 'くらない'],
  nakatta: ['きなかった', 'くなかった', 'くらなかった'],
  te: ['こて', 'くて', 'きって'],
  ta: ['こた', 'くた', 'きった'],
  potential: ['きられる', 'くられる', 'こさせる'],
  volitional: ['きよう', 'くよう', 'こう'],
  ba: ['これば', 'きれば', 'くば'],
  imperative: ['きい', 'くろ', 'こよう'],
  passive: ['きられる', 'くられる', 'こさせる'],
  causative: ['きさせる', 'くさせる', 'こられる']
}

/** 写成假名的错形：来る 的错读法没法用汉字写（来ない 分不出 こない、きない），这几个都按读音出 */
function kanaWrong(
  w: Conjugable,
  table: Partial<Record<FormId, string[]>>,
  tail: number,
  form: FormId
): Conjugated[] {
  const pre = { text: w.head.slice(0, -tail), reading: w.reading.slice(0, -tail) }
  return (table[form] ?? []).map((x) => ({ text: pre.text + x, reading: pre.reading + x }))
}

const ADJ_I_WRONG: Partial<Record<FormId, string[]>> = {
  'adj-neg': ['いない', 'いではない', 'いくない'],
  'adj-past': ['いだった', 'いかった', 'くだった'],
  'adj-negpast': ['いではなかった', 'くないだった', 'いなかった'],
  'adj-te': ['いで', 'いて', 'かって']
}

const ADJ_NA_WRONG: Partial<Record<FormId, string[]>> = {
  'adj-neg': ['くない', 'ない', 'だない'],
  'adj-past': ['かった', 'いだった', 'なかった'],
  'adj-negpast': ['くなかった', 'ないだった', 'だなかった'],
  'adj-te': ['くて', 'て', 'だて']
}

/**
 * 常见的错形，去掉跟正确答案一样的、重复的；最多 n 个。
 * 来る 的错形按读音算，界面上要显示读音（kanaOnly）
 */
export function wrongForms(w: Conjugable, form: FormId, n = 3): Conjugated[] {
  const right = conjugate(w, form)
  let list: Conjugated[] = []
  switch (w.cls) {
    case 'v5':
      list = godanWrong(w, form)
      break
    case 'v1':
      list = ichidanWrong(w, form)
      break
    case 'vs':
      list = kanaWrong(w, SURU_WRONG, 2, form)
      break
    case 'vk':
      list = kanaWrong(w, KURU_WRONG, 2, form).map((x) => ({ text: x.reading, reading: x.reading }))
      break
    case 'adj-i':
      // 错形都是在原形上直接加（高いない、いいかった），所以词干去掉末尾的い、词尾带上い
      list = (ADJ_I_WRONG[form] ?? []).map((x) => join(cut(w, 1), x))
      break
    case 'adj-na':
      list = (ADJ_NA_WRONG[form] ?? []).map((x) => join({ text: w.head, reading: w.reading }, x))
      break
  }
  const seen = new Set([right?.reading])
  const out: Conjugated[] = []
  for (const x of list) {
    if (seen.has(x.reading)) continue
    seen.add(x.reading)
    out.push(x)
    if (out.length >= n) break
  }
  return out
}

/** 选择题里显示的写法：来る 按读音（汉字写法分不出对错） */
export const displayForm = (w: Conjugable, c: Conjugated): string =>
  w.cls === 'vk' ? c.reading : c.text
