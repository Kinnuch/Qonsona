/**
 * 韩文字母（한글）的拆与合：音节块 = 初声 + 中声 (+ 终声)，Unicode 里按公式排好：
 *   音节 = 0xAC00 + (初声 × 21 + 中声) × 28 + 终声
 * 词形还原、发音规则、转写都在「字母串」上做：一个音节拆成兼容字母（ㄱ、ㅏ……）连成的串，
 * 无声的 ㅇ 初声照写（어 = ㅇㅓ），双收音拆成两个辅音（읽 = ㅇㅣㄹㄱ），这样词尾的增删就是串的增删，
 * 再合回音节时按「辅音后面跟元音就是下一个音节的初声」切开，结果是唯一的。
 */

/** 初声 19 个（按 Unicode 的顺序） */
export const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
/** 中声 21 个 */
export const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
/** 终声 27 个（下标 + 1 是 Unicode 里的终声号，0 表示没有终声） */
export const FINALS = 'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'

const SBASE = 0xac00
const SCOUNT = 11172

/** 双收音 ↔ 两个辅音 */
export const CLUSTERS: Record<string, string> = {
  ㄳ: 'ㄱㅅ',
  ㄵ: 'ㄴㅈ',
  ㄶ: 'ㄴㅎ',
  ㄺ: 'ㄹㄱ',
  ㄻ: 'ㄹㅁ',
  ㄼ: 'ㄹㅂ',
  ㄽ: 'ㄹㅅ',
  ㄾ: 'ㄹㅌ',
  ㄿ: 'ㄹㅍ',
  ㅀ: 'ㄹㅎ',
  ㅄ: 'ㅂㅅ'
}
const CLUSTER_OF = new Map(Object.entries(CLUSTERS).map(([k, v]) => [v, k]))

export interface Syllable {
  /** 初声（无声的 ㅇ 也算） */
  l: string
  /** 中声 */
  v: string
  /** 终声（收音）；没有时是空串；双收音是一个字母（ㄺ） */
  t: string
}

export function isSyllable(ch: string): boolean {
  const c = ch.charCodeAt(0)
  return ch.length === 1 && c >= SBASE && c < SBASE + SCOUNT
}

/** 全是韩文音节（至少一个） */
export function isHangulWord(s: string): boolean {
  if (!s) return false
  for (const ch of s) if (!isSyllable(ch)) return false
  return true
}

export const isVowel = (j: string): boolean => j.length === 1 && VOWELS.includes(j)
export const isConsonant = (j: string): boolean =>
  j.length === 1 && (INITIALS.includes(j) || FINALS.includes(j))

/** 一个音节拆成初声、中声、终声；不是音节给 null */
export function decompose(ch: string): Syllable | null {
  if (!isSyllable(ch)) return null
  const i = ch.charCodeAt(0) - SBASE
  return {
    l: INITIALS[Math.floor(i / 588)],
    v: VOWELS[Math.floor((i % 588) / 28)],
    t: i % 28 ? FINALS[(i % 28) - 1] : ''
  }
}

/** 初声、中声、终声合成一个音节；拼不成（字母不对）给 null */
export function compose(l: string, v: string, t = ''): string | null {
  const li = INITIALS.indexOf(l)
  const vi = VOWELS.indexOf(v)
  const ti = t ? FINALS.indexOf(t) + 1 : 0
  if (li < 0 || vi < 0 || ti < 0 || (t && ti === 0)) return null
  return String.fromCharCode(SBASE + (li * 21 + vi) * 28 + ti)
}

/** 有没有收音（받침）；不是音节给 false */
export function hasFinal(ch: string): boolean {
  return !!decompose(ch)?.t
}

/** 最后一个音节的收音（没有或不是韩文给空串） */
export function finalOf(word: string): string {
  return decompose(word.slice(-1))?.t ?? ''
}

/** 换掉一个音节的某一部分 */
export function withPart(ch: string, part: Partial<Syllable>): string {
  const s = decompose(ch)
  if (!s) return ch
  return compose(part.l ?? s.l, part.v ?? s.v, part.t ?? s.t) ?? ch
}

/** 文字 → 字母串：音节拆开（双收音拆成两个辅音），别的字符原样留着 */
export function toJamo(text: string): string {
  let out = ''
  for (const ch of text) {
    const s = decompose(ch)
    if (!s) out += ch
    else out += s.l + s.v + (CLUSTERS[s.t] ?? s.t)
  }
  return out
}

/**
 * 字母串 → 文字。每个音节必须是「辅音 + 元音 (+ 一两个辅音)」；
 * 辅音后面紧跟元音时它是下一个音节的初声。拼不成合法音节（元音打头、三个辅音挤在一起、
 * 双辅音不是合法的双收音……）时给 null。字母以外的字符原样留下，并且当作音节的分界。
 */
export function fromJamo(jamo: string): string | null {
  let out = ''
  let i = 0
  const n = jamo.length
  while (i < n) {
    const c = jamo[i]
    if (!isVowel(c) && !isConsonant(c)) {
      out += c
      i++
      continue
    }
    if (!INITIALS.includes(c) || i + 1 >= n || !isVowel(jamo[i + 1])) return null
    const v = jamo[i + 1]
    i += 2
    // 收集后面的辅音，直到下一个「辅音 + 元音」
    let finals = ''
    while (i < n && isConsonant(jamo[i]) && !(i + 1 < n && isVowel(jamo[i + 1]))) {
      finals += jamo[i]
      i++
    }
    let t = ''
    if (finals.length === 1) t = finals
    else if (finals.length === 2) t = CLUSTER_OF.get(finals) ?? ''
    if (finals && !t) return null
    if (t && !FINALS.includes(t)) return null
    const syl = compose(c, v, t)
    if (!syl) return null
    out += syl
  }
  return out
}

/** 字母串里最后一个元音的位置（没有给 -1） */
export function lastVowelIndex(jamo: string): number {
  for (let i = jamo.length - 1; i >= 0; i--) if (isVowel(jamo[i])) return i
  return -1
}

/** 字母串最后一个元音 */
export function lastVowel(jamo: string): string {
  const i = lastVowelIndex(jamo)
  return i < 0 ? '' : jamo[i]
}

/** 字母串以元音结尾（开音节） */
export function endsWithVowel(jamo: string): boolean {
  return jamo.length > 0 && isVowel(jamo[jamo.length - 1])
}

/** 字母串末尾的收音辅音（一个或两个字母，开音节给空串） */
export function trailingConsonants(jamo: string): string {
  let i = jamo.length
  while (i > 0 && isConsonant(jamo[i - 1])) i--
  return jamo.slice(i)
}

/** 最后一个音节（字母串）：从最后一个元音前的初声起 */
export function lastSyllableJamo(jamo: string): string {
  const i = lastVowelIndex(jamo)
  return i < 1 ? jamo : jamo.slice(i - 1)
}

/**
 * 「阳性元音」：词干最后一个元音是 ㅏ、ㅗ（以及 ㅑ，「얇아」）时接 -아，其余接 -어（한글 맞춤법 第 16 项）
 */
export function takesA(vowel: string): boolean {
  return vowel === 'ㅏ' || vowel === 'ㅗ' || vowel === 'ㅑ'
}

/** 兼容字母（ㄱ ㅏ）↔ 组合用字母不在这里处理；NFD 拆出的组合字母先 NFC 合回音节再用 */
export function normalizeHangul(text: string): string {
  return text.normalize('NFC')
}

// ───────────────────────── 输入：字母合成音节 ─────────────────────────

/** 两个元音键合成复合元音（두벌식：ㅗ + ㅏ = ㅘ） */
const VOWEL_PAIRS: Record<string, string> = {
  ㅗㅏ: 'ㅘ',
  ㅗㅐ: 'ㅙ',
  ㅗㅣ: 'ㅚ',
  ㅜㅓ: 'ㅝ',
  ㅜㅔ: 'ㅞ',
  ㅜㅣ: 'ㅟ',
  ㅡㅣ: 'ㅢ'
}
const CLUSTER_OF_PAIR = new Map(Object.entries(CLUSTERS).map(([k, v]) => [v, k]))

/**
 * 把连着的兼容字母（屏幕键盘、没装韩文输入法时一个个敲进来的 ㅎ ㅏ ㄴ）合成音节，跟两벌식输入法一样：
 * 「ㅎㅏㄴㄱㅜㄱ」→「한국」、「ㅇㅣㄹㄱㅇㅓ」→「읽어」；收音后面跟元音时收音挪到下一个音节
 * （「ㅇㅣㄹㄱㅓ」→「일거」）。合不成的字母原样留着（ㄱ、-ㄴ다 的 ㄴ）。
 */
export function composeHangul(text: string): string {
  if (!/[ㄱ-ㆎ]/.test(text)) return text
  let out = ''
  let L = ''
  let V = ''
  let T = '' // 收音（一个或两个辅音字母）
  const flush = (): void => {
    if (L && V)
      out += compose(L, V, T.length === 2 ? (CLUSTER_OF_PAIR.get(T) ?? '') : T) ?? L + V + T
    else out += L + V + T
    L = V = T = ''
  }
  for (const ch of text) {
    const cons = INITIALS.includes(ch) || FINALS.includes(ch)
    const vow = VOWELS.includes(ch)
    if (!cons && !vow) {
      flush()
      out += ch
      continue
    }
    if (!L && !V) {
      if (cons && INITIALS.includes(ch)) L = ch
      else out += ch
      continue
    }
    if (L && !V) {
      if (vow) V = ch
      else {
        out += L
        L = INITIALS.includes(ch) ? ch : ''
        if (!L) out += ch
      }
      continue
    }
    // 有初声、中声
    if (!T) {
      if (vow) {
        const pair = VOWEL_PAIRS[V + ch]
        if (pair) V = pair
        else {
          flush()
          out += ch
        }
      } else if (FINALS.includes(ch)) T = ch
      else {
        flush()
        L = ch // ㄸ ㅃ ㅉ 不能当收音
      }
      continue
    }
    // 有收音
    if (vow) {
      // 收音挪到下一个音节当初声（双收音挪后一个）
      const moved = T.length === 2 ? T[1] : T
      T = T.length === 2 ? T[0] : ''
      flush()
      L = INITIALS.includes(moved) ? moved : ''
      if (L) V = ch
      else out += moved + ch
    } else if (T.length === 1 && CLUSTER_OF_PAIR.has(T + ch)) T = T + ch
    else {
      flush()
      if (INITIALS.includes(ch)) L = ch
      else out += ch
    }
  }
  flush()
  return out
}
