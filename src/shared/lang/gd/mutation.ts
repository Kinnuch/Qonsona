/**
 * 苏格兰盖尔语的词首音变与词尾变化（纯函数）：查词时从变过的形式找回原形，以后的变形练习、弱化题也用这一份。
 *
 * - 弱化（lenition，sèimheachadh）：b c d f g m p s t 后面加 h 写出来（bàta → bhàta、fuair → fhuair）；
 *   l n r 弱化只改发音不改写法；sg sm sp st 不弱化；元音开头的词不弱化。
 * - 词首加字母（prothesis）：an t-uisge、na h-òrain、ar n-athair，连字符前的 t / h / n 不是词的一部分。
 * - 省音：dh'fhalbh（do + 弱化）、m' athair（mo）、b' fheàrr（bu）……撇号前是缩短的虚词。
 * - 窄化（caolachadh）：属格、复数、呼格常把最后一个宽元音变窄（balach → balaich、cat → cait）。
 *
 * 说明见 docs/lang/gd.md「拼写与读音」「词首音变」。
 */

/** 盖尔语的元音（含长音符；旧拼写的锐音符也算） */
export const VOWELS = 'aeiouàèìòùáéíóú'
const VOWEL_RE = /[aeiouàèìòùáéíóú]/i

/** 写出来的弱化只发生在这几个辅音上 */
export const LENITABLE = new Set(['b', 'c', 'd', 'f', 'g', 'm', 'p', 's', 't'])

const isUpper = (ch: string): boolean => ch !== ch.toLowerCase() && ch === ch.toUpperCase()

/** 这个词的词首写出来能不能弱化：b c d f g m p s t 开头、还没弱化，s 后面跟元音或 l n r */
export function canLenite(word: string): boolean {
  if (word.length < 2) return false
  const c0 = word[0].toLowerCase()
  const c1 = word[1].toLowerCase()
  if (!LENITABLE.has(c0) || c1 === 'h') return false
  if (c0 === 's' && !VOWEL_RE.test(c1) && !'lnr'.includes(c1)) return false
  return true
}

/** 弱化：bàta → bhàta、Màiri → Mhàiri、sgian → sgian（不变）、òran → òran（不变） */
export function lenite(word: string): string {
  if (!canLenite(word)) return word
  // 全大写的词（标题）里加大写 H
  const h = isUpper(word[0]) && isUpper(word[1]) ? 'H' : 'h'
  return word[0] + h + word.slice(1)
}

/** 看起来是不是弱化形：第一个字母能弱化、第二个字母是 h（bhàta、fhuair、thu） */
export function looksLenited(word: string): boolean {
  return word.length >= 3 && LENITABLE.has(word[0].toLowerCase()) && word[1].toLowerCase() === 'h'
}

/** 去弱化：bhàta → bàta、fhuair → fuair、Shìne → Sìne；不是弱化形时给 null */
export function delenite(word: string): string | null {
  return looksLenited(word) ? word[0] + word.slice(2) : null
}

export type Prothesis = 't' | 'h' | 'n'

/** 去掉词首加的 t- / h- / n-（t-uisge → uisge、h-òrain → òrain、n-athair → athair） */
export function stripProthesis(word: string): { prefix: Prothesis; rest: string } | null {
  const m = /^([thn])[-\u2010\u2011](\p{L}.*)$/iu.exec(word)
  return m ? { prefix: m[1].toLowerCase() as Prothesis, rest: m[2] } : null
}

/**
 * 词首省音的虚词：dh'（do：过去时小品词、介词「到」）、m'（mo「我的」）、d'（do「你的」）、b'（bu，系词过去时）、
 * th'（tha）、bh'（bha）。返回省掉的是哪个词和后面的部分（dh'fhalbh → do + fhalbh）
 */
export const ELIDED: Record<string, string> = {
  dh: 'do',
  m: 'mo',
  d: 'do',
  b: 'bu',
  th: 'tha',
  bh: 'bha'
}

export function stripElision(word: string): { full: string; rest: string } | null {
  const m = /^(dh|th|bh|m|d|b)['\u2019](\p{L}.*)$/iu.exec(word)
  return m ? { full: ELIDED[m[1].toLowerCase()], rest: m[2] } : null
}

/** 强调后缀：-sa -se -san -ne（mise、thusa、esan、agamsa、mo chàr-sa） */
export const EMPHATIC_SUFFIXES = ['san', 'sa', 'se', 'ne']

/** 去掉带连字符的强调后缀（càr-sa → càr）；不带连字符的（agamsa）靠词形表 */
export function stripEmphatic(word: string): string | null {
  const m = /^(\p{L}.*?)[-\u2010\u2011](san|sa|se|ne)$/iu.exec(word)
  return m ? m[1] : null
}

/**
 * 去窄化：把最后一个窄化的元音组变回宽的（属格、复数常见的变化），给猜原形用。
 * balaich → balach、cait → cat、eilein → eilean、fir → fear、eòin → eun、èisg → iasg。
 * 只对最后一个元音组动手，一个词可能给出几种猜法。
 */
export function broadenings(word: string): string[] {
  const m = /^(.*?)([aeiouàèìòùáéíóú]+)([^aeiouàèìòùáéíóú]+)$/i.exec(word)
  if (!m) return []
  const [, head, v, tail] = m
  const out: string[] = []
  const lower = v.toLowerCase()
  const swaps: [string, string[]][] = [
    ['ai', ['a']],
    ['oi', ['o']],
    ['ui', ['u', 'o']],
    ['ei', ['ea', 'e']],
    ['aoi', ['ao']],
    ['eòi', ['eu', 'eò']],
    ['èi', ['ia', 'è']],
    ['ài', ['à']],
    ['òi', ['ò']],
    ['ùi', ['ù']],
    ['i', ['ea', 'io']],
    ['ui', ['ua']],
    ['uai', ['ua']],
    ['iui', ['iu']]
  ]
  for (const [from, tos] of swaps)
    if (lower === from) for (const to of tos) out.push(head + to + tail)
  return [...new Set(out)]
}

/** 宽元音（a o u）还是窄元音（e i）：拼写规则「宽对宽、窄对窄」要看辅音两边的元音 */
export function vowelQuality(ch: string): 'broad' | 'slender' | null {
  const c = ch.toLowerCase()
  if ('aouàòùáóú'.includes(c)) return 'broad'
  if ('eièìéí'.includes(c)) return 'slender'
  return null
}

/**
 * 拼写规则「宽对宽、窄对窄」（caol ri caol is leathann ri leathann）：词里每一串辅音两边的元音要同为宽或同为窄。
 * 返回不合规则的位置（辅音串前后元音的下标）；外来词、复合词常有例外，只做提示用。
 */
export function broadSlenderClashes(word: string): number[] {
  const w = word.toLowerCase()
  const out: number[] = []
  const re = /([aeiouàèìòùáéíóú])([^aeiouàèìòùáéíóú\s'-]+)([aeiouàèìòùáéíóú])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(w))) {
    const a = vowelQuality(m[1])
    const b = vowelQuality(m[3])
    if (a && b && a !== b) out.push(m.index)
    re.lastIndex = m.index + m[1].length + m[2].length
  }
  return out
}
