/**
 * 俄语的规则：查词的键、切词、猜原形、正文记号、拉丁转写（纯函数；数据管线写 form 表、主进程查词都用这一份）。
 * 为什么这样定见 docs/lang/ru.md「规则」。
 *
 * - 查词键 key：小写、去掉重音符号（´ 与次重音 `），**保留 ё**；混进俄语词里的拉丁形近字母（a、o、e、ó……）
 *   换成西里尔字母；各种连字符统一成「-」。
 * - 宽松键 looseKey：再把 ё 写成 е（俄语平常不写两点），旧正字法（ѣ、і、ѳ、ѵ、词尾 ъ）对到今天的写法。
 *   **й 不动**（й 的短音符不是可省的记号，мой 跟 мои 是两个词）。
 * - 切词：Intl.Segmenter 会把 кто-то、по-русски、из-за 从连字符处切开，这里并回一个词。
 * - 猜原形：form 表查不到时（形动词的各格、短尾被动形动词、生僻词的变格变位），按词尾推几个可能的原形。
 * - 记号：重音符号、ё 上的两点，阅读时都可以开关。
 * - 转写：学术转写（scholarly transliteration，ISO/R 9:1968 一系）：ж ž、х x、ц c、ч č、ш š、щ šč、
 *   ъ ʺ、ы y、ь ʹ、э è、ю ju、я ja、ё ë、й j；重音符号原样带到拉丁字母上（molokó）。
 */
import { defaultKey, segmentWords, tidy } from '../text'
import type { LangRules, LemmaGuess, MarkDef, RawToken } from '../types'

// ───────────────────────── 文字 ─────────────────────────

/** 组合用重音符号：´（主重音，U+0301）与 `（次重音，U+0300） */
const STRESS = /[\u{301}\u{300}]/gu

/** 去掉重音符号（й 的短音符、ё 的两点不动） */
export function stripStress(text: string): string {
  return text.normalize('NFD').replace(STRESS, '').normalize('NFC')
}

/** 含西里尔字母 */
export const hasCyrillic = (s: string): boolean => /[\u{400}-\u{4FF}]/u.test(s)

/** 混在俄语词里、样子跟西里尔字母一样的拉丁字母（小写之后）；带重音的拉丁元音常被拿来标重音 */
const LATIN_LOOKALIKE: Record<string, string> = {
  a: 'а',
  c: 'с',
  e: 'е',
  o: 'о',
  p: 'р',
  x: 'х',
  y: 'у',
  á: 'а',
  à: 'а',
  é: 'е',
  è: 'е',
  ó: 'о',
  ò: 'о',
  ý: 'у',
  ë: 'ё'
}

/** 一个「词」：字母、组合符号、词中的连字符 */
const WORDISH = /[\p{L}\p{M}]+(?:-[\p{L}\p{M}]+)*/gu

function fixLookalikes(text: string): string {
  return text.replace(WORDISH, (w) =>
    hasCyrillic(w) && /[a-zà-ÿ]/.test(w)
      ? w.replace(/[a-zà-ÿ]/g, (c) => LATIN_LOOKALIKE[c] ?? c)
      : w
  )
}

/** 连字符的各种写法统一成「-」，软连字符去掉 */
function fixHyphens(text: string): string {
  return text.replace(/[\u{2010}\u{2011}]/gu, '-').replace(/\u{AD}/gu, '')
}

/** 查词键：小写、去重音符号、保留 ё、拉丁形近字母换成西里尔字母 */
export function key(text: string): string {
  return fixLookalikes(stripStress(fixHyphens(defaultKey(text, 'ru'))))
}

/** 旧正字法（1918 年以前）的字母 → 今天的写法 */
const PRE_REFORM: Record<string, string> = { ё: 'е', ѣ: 'е', і: 'и', ѳ: 'ф', ѵ: 'и' }

/** 宽松键：ё → е、旧正字法对到今天的写法（词尾辅音后的 ъ 去掉） */
export function looseKey(text: string): string {
  return key(text)
    .replace(/[ёѣіѳѵ]/g, (c) => PRE_REFORM[c])
    .replace(/([бвгджзклмнпрстфхцчшщ])ъ(?![\p{L}\p{M}])/gu, '$1')
}

// ───────────────────────── 切词 ─────────────────────────

const HYPHEN = /^[-\u{2010}\u{2011}]$/u

/**
 * 切词：Intl.Segmenter 切完，把连字符连着的几段并回一个词（кто-то、что-нибудь、по-русски、из-за、
 * северо-запад、Ростов-на-Дону、1-й）；连字符前后有空格的（当破折号用）不并。
 */
export function tokenize(text: string): RawToken[] {
  const raw = segmentWords(text, 'ru')
  const out: RawToken[] = []
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i]
    const prev = out[out.length - 1]
    const next = raw[i + 1]
    if (
      HYPHEN.test(t.text) &&
      prev &&
      (prev.kind === 'word' || prev.kind === 'num') &&
      prev.end === t.start &&
      next &&
      next.kind === 'word' &&
      next.start === t.end
    ) {
      prev.text += t.text + next.text
      prev.end = next.end
      i++
      continue
    }
    out.push({ ...t })
  }
  return out
}

// ───────────────────────── 猜原形 ─────────────────────────

/** 连字符后面的语气词：сказал-то、пойдём-ка、всё-таки…… */
const HYPHEN_PARTICLES = new Set(['то', 'ка', 'таки', 'де', 'с', 'либо', 'нибудь'])

/** 形容词（与形动词）的长尾词尾；去掉后按拼写规则补回阳性单数一格的 -ый / -ий / -ой */
const ADJ_ENDINGS = [
  'ыми',
  'ими',
  'ого',
  'его',
  'ому',
  'ему',
  'ая',
  'яя',
  'ую',
  'юю',
  'ое',
  'ее',
  'ые',
  'ие',
  'ых',
  'их',
  'ым',
  'им',
  'ой',
  'ей',
  'ою',
  'ею',
  'ом',
  'ем',
  'ый',
  'ий'
]

/** 拼写规则：г к х ж ш ч щ 后面不写 ы；ц 后面写 ы */
function adjLemmas(stem: string): string[] {
  const last = stem.slice(-1)
  if (!last) return []
  if ('гкхжшчщ'.includes(last)) return [stem + 'ий', stem + 'ой']
  if (last === 'ц') return [stem + 'ый', stem + 'ой']
  return [stem + 'ый', stem + 'ий', stem + 'ой']
}

/** 名词的格尾 → 一格可能的结尾（词干加上它） */
const NOUN_ENDINGS: [string, string[]][] = [
  ['ами', ['', 'а', 'о', 'ь', 'я', 'е']],
  ['ями', ['ь', 'я', 'е', 'й', 'ие', 'ия']],
  ['ах', ['', 'а', 'о']],
  ['ях', ['ь', 'я', 'е', 'й']],
  ['ам', ['', 'а', 'о']],
  ['ям', ['ь', 'я', 'е', 'й']],
  ['ов', ['', 'о']],
  ['ев', ['й', 'ь', 'е']],
  ['ей', ['ь', 'е', 'я']],
  ['ом', ['', 'о']],
  ['ем', ['ь', 'е', 'й']],
  ['ём', ['ь', 'е']],
  ['ой', ['а']],
  ['ою', ['а']],
  ['ею', ['я', 'ь']],
  ['ью', ['ь']],
  ['ии', ['ия', 'ие', 'ий']],
  ['ие', ['ие']],
  ['ия', ['ия', 'ие']],
  ['а', ['', 'о']],
  ['я', ['ь', 'й', 'е']],
  ['у', ['', 'а', 'о']],
  ['ю', ['ь', 'й', 'я', 'е']],
  ['е', ['', 'а', 'о', 'я']],
  ['ы', ['а', '']],
  ['и', ['ь', 'я', 'а', 'й', '']],
  ['', ['а', 'о', 'я', 'е']]
]

/** 动词的人称、过去时、命令式、副动词词尾 → 不定式（只管规则的；不规则的都在词典的变位表里） */
const VERB_ENDINGS: [string, string[], string][] = [
  ['аю', ['ать'], 'present'],
  ['аешь', ['ать'], 'present'],
  ['ает', ['ать'], 'present'],
  ['аем', ['ать'], 'present'],
  ['аете', ['ать'], 'present'],
  ['ают', ['ать'], 'present'],
  ['яю', ['ять'], 'present'],
  ['яешь', ['ять'], 'present'],
  ['яет', ['ять'], 'present'],
  ['яем', ['ять'], 'present'],
  ['яете', ['ять'], 'present'],
  ['яют', ['ять'], 'present'],
  ['ею', ['еть'], 'present'],
  ['еешь', ['еть'], 'present'],
  ['еет', ['еть'], 'present'],
  ['еем', ['еть'], 'present'],
  ['еете', ['еть'], 'present'],
  ['еют', ['еть'], 'present'],
  ['ую', ['овать'], 'present'],
  ['уешь', ['овать'], 'present'],
  ['ует', ['овать'], 'present'],
  ['уем', ['овать'], 'present'],
  ['уете', ['овать'], 'present'],
  ['уют', ['овать'], 'present'],
  ['юю', ['евать'], 'present'],
  ['юешь', ['евать'], 'present'],
  ['юет', ['евать'], 'present'],
  ['юем', ['евать'], 'present'],
  ['юете', ['евать'], 'present'],
  ['юют', ['евать'], 'present'],
  ['ишь', ['ить', 'еть', 'ать', 'ять'], 'present'],
  ['ит', ['ить', 'еть', 'ать', 'ять'], 'present'],
  ['им', ['ить', 'еть', 'ать', 'ять'], 'present'],
  ['ите', ['ить', 'еть', 'ать', 'ять'], 'present'],
  ['ят', ['ить', 'еть', 'ять'], 'present'],
  ['ат', ['ать', 'ить'], 'present'],
  ['ю', ['ить', 'еть'], 'present'],
  ['у', ['ить', 'ать', 'ти'], 'present'],
  ['ёшь', ['ть', 'ти'], 'present'],
  ['ёт', ['ть', 'ти'], 'present'],
  ['ём', ['ть', 'ти'], 'present'],
  ['ёте', ['ть', 'ти'], 'present'],
  ['ут', ['ть', 'ти'], 'present'],
  ['ешь', ['ать', 'ть'], 'present'],
  ['ет', ['ать', 'ть'], 'present'],
  ['ем', ['ать', 'ть'], 'present'],
  ['ете', ['ать', 'ть'], 'present'],
  ['ли', ['ть'], 'past'],
  ['ла', ['ть'], 'past'],
  ['ло', ['ть'], 'past'],
  ['л', ['ть'], 'past'],
  ['йте', ['ть'], 'imperative'],
  ['й', ['ть'], 'imperative'],
  ['ите', ['ить'], 'imperative'],
  ['и', ['ить'], 'imperative'],
  ['вши', ['ть'], 'adverbial'],
  ['в', ['ть'], 'adverbial'],
  ['ая', ['ать'], 'adverbial'],
  ['яя', ['ять'], 'adverbial'],
  ['я', ['ить', 'еть', 'ять'], 'adverbial']
]

/**
 * form 表查不到时猜原形，猜出来的拿去再查一次 form 表（形动词的原形在动词的变位表里，所以
 * говорящая → говорящий 能找回 говорить）。按可能性排，最多 40 个。
 */
export function lemmaCandidates(surface: string): LemmaGuess[] {
  const w = key(surface)
  const out: LemmaGuess[] = []
  const seen = new Set<string>([w])
  const add = (lemma: string, tags: string[]): void => {
    if (lemma.length < 2 || seen.has(lemma) || !hasCyrillic(lemma)) return
    seen.add(lemma)
    out.push({ lemma, tags })
  }
  if (!hasCyrillic(w)) return out

  // 连字符：去掉语气词（сказал-то → сказал），否则拆成几段
  if (w.includes('-')) {
    const parts = w.split('-').filter(Boolean)
    const last = parts[parts.length - 1]
    if (parts.length > 1 && HYPHEN_PARTICLES.has(last))
      add(parts.slice(0, -1).join('-'), ['particle'])
    if (parts[0] === 'кое' || parts[0] === 'кой') add(parts.slice(1).join('-'), ['particle'])
    for (const p of parts) add(p, ['compound'])
    return out
  }

  // 反身的 -ся / -сь：去掉之后再猜，猜出来的原形补回 -ся
  const bases: [string, string][] = [[w, '']]
  if (/(ся|сь)$/.test(w) && w.length > 4) bases.push([w.slice(0, -2), 'ся'])

  for (const [base, refl] of bases) {
    const extra = refl ? ['reflexive'] : []
    // 形容词、形动词的长尾
    for (const end of ADJ_ENDINGS)
      if (base.endsWith(end) && base.length > end.length + 1)
        for (const l of adjLemmas(base.slice(0, -end.length))) add(l + refl, extra)
    // 短尾被动形动词：сделан(а/о/ы) → сделанный，открыт(а/о/ы) → открытый，решён → решённый
    const short = /^(.+?)(ен|ён|ан|ян|т)(а|о|ы)?$/.exec(base)
    if (short && !refl) {
      const [, stem, suf] = short
      const full = suf === 'т' ? stem + 'тый' : stem + suf + 'ный'
      add(full, ['participle', 'passive', 'short-form'])
      if (suf === 'ен') add(stem + 'ённый', ['participle', 'passive', 'short-form'])
    }
  }

  // 比较级加 по-（побольше → больше、поскорее → скорее）；最高级 наи-（наилучший → лучший）
  if (/^по.{4,}(ее|ей|ше|же|че|ще)$/.test(w)) add(w.slice(2), ['comparative'])
  if (w.startsWith('наи') && w.length > 6) add(w.slice(3), ['superlative'])
  // 最高级 -ейший / -айший（及各格）→ 原级
  const sup = /^(.+?)(ейш|айш)(ий|ая|ее|ие|его|ей|ему|им|ем|ую|ими|их|ое|ой)$/.exec(w)
  if (sup) for (const l of adjLemmas(sup[1])) add(l, ['superlative'])

  for (const [base, refl] of bases) {
    const extra = refl ? ['reflexive'] : []
    // 动词
    for (const [end, infs, tag] of VERB_ENDINGS)
      if (base.endsWith(end) && base.length > end.length + 1)
        for (const inf of infs) add(base.slice(0, -end.length) + inf + refl, [tag, ...extra])
    if (refl) continue
    // 名词的格
    for (const [end, nomEnds] of NOUN_ENDINGS)
      if (base.endsWith(end) && base.length > end.length + 1)
        for (const n of nomEnds) add(base.slice(0, base.length - end.length) + n, ['inflected'])
  }
  return out.slice(0, 40)
}

// ───────────────────────── 记号 ─────────────────────────

/** ё 写成 е（俄语平常的写法） */
export const stripYo = (text: string): string => text.replace(/ё/g, 'е').replace(/Ё/g, 'Е')

export const marks: MarkDef[] = [
  { id: 'stress', name: { zh: '重音符号', en: 'Stress marks' }, strip: stripStress },
  { id: 'yo', name: { zh: 'ё 上的两点', en: 'Dots on ё' }, strip: stripYo }
]

// ───────────────────────── 转写 ─────────────────────────

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'ë',
  ж: 'ž',
  з: 'z',
  и: 'i',
  й: 'j',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'x',
  ц: 'c',
  ч: 'č',
  ш: 'š',
  щ: 'šč',
  ъ: 'ʺ',
  ы: 'y',
  ь: 'ʹ',
  э: 'è',
  ю: 'ju',
  я: 'ja',
  // 旧正字法
  ѣ: 'ě',
  і: 'i',
  ѳ: 'f',
  ѵ: 'i'
}

/**
 * 学术转写：一个西里尔字母对一个（或两个）拉丁字母，重音符号带到元音上（молоко́ → molokó）；
 * 大写字母开头的词开头大写，整个大写的词整个大写（Щука → Ščuka、СССР → SSSR）
 */
export function romanize(text: string): string {
  const chars = [...tidy(text).normalize('NFC')]
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const lower = c.toLowerCase()
    const t = TRANSLIT[lower]
    if (t === undefined) {
      out += c
      continue
    }
    if (c === lower) {
      out += t
      continue
    }
    // 大写：后一个也是大写的西里尔字母（缩写、全大写的词）就整个大写，否则只大写开头
    const next = chars[i + 1] ?? ''
    const allCaps = next !== next.toLowerCase() && TRANSLIT[next.toLowerCase()] !== undefined
    out += allCaps ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1)
  }
  return out.normalize('NFC')
}

// ───────────────────────── 拉丁字母输入 → 西里尔字母 ─────────────────────────

/** 拉丁字母的拼法 → 西里尔字母（按顺序最长匹配）：认学术转写、BGN/PCGN 与常见的打字习惯 */
const FROM_LATIN: [string, string][] = [
  ['shch', 'щ'],
  ['šč', 'щ'],
  ['zh', 'ж'],
  ['kh', 'х'],
  ['ts', 'ц'],
  ['ch', 'ч'],
  ['sh', 'ш'],
  ['yo', 'ё'],
  ['jo', 'ё'],
  ['yu', 'ю'],
  ['ju', 'ю'],
  ['ya', 'я'],
  ['ja', 'я'],
  ['ye', 'е'],
  ['je', 'е'],
  ['ž', 'ж'],
  ['š', 'ш'],
  ['č', 'ч'],
  ['ë', 'ё'],
  ['è', 'э'],
  ['ʹ', 'ь'],
  ['ʺ', 'ъ'],
  ["'", 'ь'],
  ['"', 'ъ'],
  ['a', 'а'],
  ['b', 'б'],
  ['v', 'в'],
  ['w', 'в'],
  ['g', 'г'],
  ['d', 'д'],
  ['e', 'е'],
  ['z', 'з'],
  ['i', 'и'],
  ['j', 'й'],
  ['k', 'к'],
  ['q', 'к'],
  ['l', 'л'],
  ['m', 'м'],
  ['n', 'н'],
  ['o', 'о'],
  ['p', 'п'],
  ['r', 'р'],
  ['s', 'с'],
  ['t', 'т'],
  ['u', 'у'],
  ['f', 'ф'],
  ['x', 'х'],
  ['h', 'х'],
  ['c', 'ц'],
  ['y', 'ы']
]

const VOWELS = 'аеёиоуыэюя'

/**
 * 拉丁字母拼的俄语（privet、spasibo、khorosho、zdravstvuyte、ščuka）→ 几种可能的西里尔写法，查词用。
 * y 在元音后当 й（moy → мой、novyy → новый），词首的 e 另给一个 э 的写法（eto → это）。
 * 含别的字符（西里尔字母、数字）给空数组。
 */
export function latinToCyrillic(text: string): string[] {
  const s = tidy(text).toLowerCase()
  if (!s || !/^[a-zšžčëèʹʺ'" -]+$/.test(s)) return []
  let out = ''
  for (let i = 0; i < s.length;) {
    const hit = FROM_LATIN.find(([lat]) => s.startsWith(lat, i))
    if (!hit) {
      out += s[i++]
      continue
    }
    const cyr = hit[0] === 'y' && out && VOWELS.includes(out.slice(-1)) ? 'й' : hit[1]
    out += cyr
    i += hit[0].length
  }
  const res = [out]
  const e = out.replace(/(^|[\s-])е/g, '$1э')
  if (e !== out) res.push(e)
  return res
}

export const rules: LangRules = {
  key,
  looseKey,
  tokenize,
  lemmaCandidates,
  marks,
  romanize
}
