/**
 * 西班牙语的拼读：音节、重音、按规则推出的音位标音（IPA）。
 *
 * 西班牙语的拼写跟读音几乎一一对应，读音规则学得会，用不着像日语那样逐词注音：
 * 词典里没有 IPA 的词用这里推出来的补上，以后的拼读课、重音练习也用这一份。
 * 标音的写法跟英文维基词典 {{es-pr}} 的音位标音一致（/θaˈpato/、/eɡˈsamen/、/emˈbjaɾ/……），
 * 方便跟词典里现成的 IPA 放在一起看；只做音位标音，不做音值（[…] 里的 β ð ɣ 那一层）。
 *
 * 口音只分两处：
 *   - distinción（西班牙中北部：z、ce、ci 读 θ）/ seseo（拉丁美洲、加那利、安达卢西亚大部：读 s）；
 *   - yeísmo（ll 跟 y 一样读 ʝ，绝大多数地区）/ lleísmo（ll 读 ʎ：西班牙北部乡间、安第斯、巴拉圭）。
 * 拉普拉塔的 ʃ / ʒ（sheísmo、zheísmo）只在词典自带的 IPA 里有，这里不推。
 */

/** 带重音符的元音 → 不带的 */
const UNACUTE: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }
/** 不带重音符的元音 → 带的 */
const ACUTE: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }

/** 去掉元音上的重音符（á → a），ü、ñ 不动 */
export function stripAcute(s: string): string {
  return s.replace(/[áéíóú]/g, (c) => UNACUTE[c])
}

/** 有没有写出来的重音符 */
export const hasAcute = (s: string): boolean => /[áéíóú]/.test(s)

const isVowelLetter = (c: string): boolean => /^[aeiouáéíóúü]$/.test(c)
const STRONG = /^[aeoáéóíú]$/

// ───────────────────────── 切成音段 ─────────────────────────

/** 一个音段：元音（带不带重音符、是不是强元音）或辅音（音位） */
interface Seg {
  kind: 'V' | 'C'
  /** 元音：a e i o u；辅音：音位符号 */
  ph: string
  /** 元音上写了重音符 */
  acute?: boolean
  /** 强元音（a e o，以及带重音符的 í ú） */
  strong?: boolean
  /** 原文第几个字母开始（算重音规则时用） */
  at: number
}

export interface IpaOptions {
  /** seseo：z、ce、ci 读 s（默认 distinción，读 θ） */
  seseo?: boolean
  /** lleísmo：ll 读 ʎ（默认 yeísmo，读 ʝ） */
  lleismo?: boolean
}

/** x 读 /x/ 的几个词（墨西哥地名的旧拼法） */
const X_AS_J = /^(m[eé]xic|oaxac|texa)/

/** 一个词（小写、只有字母）切成音段；h 不发音，词首 hie / hue 当辅音 ʝ / w̝ */
function segments(word: string, opt: IpaOptions): Seg[] {
  const w = word
  const out: Seg[] = []
  const front = (c: string | undefined): boolean => !!c && /^[eiéí]$/.test(c)
  const C = (ph: string, at: number): void => void out.push({ kind: 'C', ph, at })
  let i = 0
  // 词首的 ps、gn、mn：p、g、m 不读
  if (/^(ps|gn|mn)/.test(w)) i = 1
  for (; i < w.length; i++) {
    const c = w[i]
    const n = w[i + 1]
    if (isVowelLetter(c)) {
      const base = UNACUTE[c] ?? (c === 'ü' ? 'u' : c)
      const acute = c in UNACUTE
      out.push({ kind: 'V', ph: base, acute, strong: STRONG.test(c), at: i })
      continue
    }
    switch (c) {
      case 'c':
        if (n === 'h') {
          C('t͡ʃ', i)
          i++
        } else C(front(n) ? (opt.seseo ? 's' : 'θ') : 'k', i)
        break
      case 'z':
        C(opt.seseo ? 's' : 'θ', i)
        break
      case 'q':
        C('k', i)
        if (n === 'u') i++
        break
      case 'g':
        if (n === 'u' && front(w[i + 2])) {
          C('ɡ', i)
          i++
        } else C(front(n) ? 'x' : 'ɡ', i)
        break
      case 'j':
        C('x', i)
        break
      case 'l':
        if (n === 'l') {
          C(opt.lleismo ? 'ʎ' : 'ʝ', i)
          i++
        } else C('l', i)
        break
      case 'r':
        if (n === 'r') {
          C('r', i)
          i++
        } else {
          const prev = out[out.length - 1]
          C(i === 0 || (prev?.kind === 'C' && /^[nls]$/.test(prev.ph)) ? 'r' : 'ɾ', i)
        }
        break
      case 'y':
        // 后面是元音时是辅音；词尾、辅音前是元音 i
        if (n && isVowelLetter(n)) C('ʝ', i)
        else out.push({ kind: 'V', ph: 'i', acute: false, strong: false, at: i })
        break
      case 'h':
        // 音节开头的 hie-、hia-、hio- 读 ʝ，hue-、hua-、hui- 读 w̝；别的 h 不发音
        if (
          (i === 0 || !isVowelLetter(w[i - 1])) &&
          n === 'i' &&
          w[i + 2] &&
          /^[aeoáéó]$/.test(w[i + 2])
        ) {
          C('ʝ', i)
          i++
        } else if (i === 0 && n === 'u' && w[i + 2] && /^[aeiáéí]$/.test(w[i + 2])) {
          C('w̝', i)
          i++
        }
        break
      case 'x':
        if (X_AS_J.test(w)) C('x', i)
        else {
          C('ɡ', i)
          C('s', i)
        }
        break
      case 'ñ':
        C('ɲ', i)
        break
      case 'v':
      case 'b':
        C('b', i)
        break
      case 'w':
        C('w', i)
        break
      case 'k':
        C('k', i)
        break
      case 'f':
      case 'm':
      case 'n':
      case 'p':
      case 's':
      case 't':
      case 'd':
        C(c, i)
        break
      default:
        // 别的字母（外来词的 ç、à……）照写
        if (/\p{L}/u.test(c)) C(c, i)
    }
  }
  return out
}

// ───────────────────────── 音节与重音 ─────────────────────────

/** 不可拆的辅音连缀（音节首）：塞音、f + r / l；dl、tl 不算（tl 西班牙拆开、墨西哥连读，这里按西班牙） */
const ONSET2 = /^(p|b|f|k|ɡ|t|d)(ɾ|l)$/
const okOnset = (a: string, b: string): boolean =>
  ONSET2.test(a + b) && !(b === 'l' && (a === 'd' || a === 't'))

/** 两个元音之间要不要断开（二合元音不断、两个强元音断、带重音符的 í ú 跟别的元音断） */
function hiatus(a: Seg, b: Seg): boolean {
  if (a.strong && b.strong) return true
  if ((a.acute && !STRONG.test(a.ph)) || (b.acute && !STRONG.test(b.ph))) return true
  // ii、uu 断开
  if (!a.strong && !b.strong && a.ph === b.ph) return true
  return false
}

interface Syl {
  segs: Seg[]
  /** 音节核在 segs 里的起止 */
  nucleus: [number, number]
}

/** 按音位切音节 */
function syllabify(segs: Seg[]): Syl[] {
  // 先找出音节核：连着的元音，按 hiatus 断开
  const nuclei: [number, number][] = []
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].kind !== 'V') continue
    let j = i
    while (j + 1 < segs.length && segs[j + 1].kind === 'V' && !hiatus(segs[j], segs[j + 1])) j++
    nuclei.push([i, j])
    i = j
  }
  if (!nuclei.length) return [{ segs, nucleus: [0, -1] }]
  // 两个音节核之间的辅音：最后一个归后面；能组成连缀的两个都归后面
  const cuts: number[] = []
  for (let k = 0; k + 1 < nuclei.length; k++) {
    const from = nuclei[k][1] + 1
    const to = nuclei[k + 1][0] // 不含
    const cons = to - from
    let cut: number
    if (cons <= 0) cut = to
    else if (cons === 1) cut = from
    else {
      const a = segs[to - 2].ph
      const b = segs[to - 1].ph
      cut = okOnset(a, b) ? to - 2 : to - 1
    }
    cuts.push(cut)
  }
  const out: Syl[] = []
  let start = 0
  for (let k = 0; k < nuclei.length; k++) {
    const end = k < cuts.length ? cuts[k] : segs.length
    out.push({
      segs: segs.slice(start, end),
      nucleus: [nuclei[k][0] - start, nuclei[k][1] - start]
    })
    start = end
  }
  return out
}

/**
 * 重音在第几个音节（从 0 数）：写了重音符的那个；没写的，以元音、n、s 结尾的在倒数第二个，别的在最后一个。
 * ending 是这个词最后一个字母（y 算辅音：estoy、virrey 重音在最后）。
 */
function stressOf(syls: Syl[], ending: string): number {
  for (let i = 0; i < syls.length; i++)
    if (syls[i].segs.some((s) => s.kind === 'V' && s.acute)) return i
  if (syls.length < 2) return 0
  return /[aeiouns]$/.test(ending) ? syls.length - 2 : syls.length - 1
}

/**
 * 一个词的正字法音节（给拼读课、重音练习看）：rr、ll、ch、qu、gu 不拆，h 当辅音，tl 拆开（at-le-ta）。
 * 例：casa → ca-sa；ciudad → ciu-dad；país → pa-ís；construir → cons-truir。
 */
export function syllables(word: string): string[] {
  const w = word.normalize('NFC').toLocaleLowerCase('es')
  // 记下每个字母属于哪一类：V 元音、C 辅音（双字母当一个）
  const units: { t: string; v: boolean }[] = []
  for (let i = 0; i < w.length; i++) {
    const c = w[i]
    const two = w.slice(i, i + 2)
    if (/^(ch|ll|rr)$/.test(two) || (/^(qu|gu)$/.test(two) && /[eiéí]/.test(w[i + 2] ?? ''))) {
      units.push({ t: two, v: false })
      i++
    } else if (c === 'y') {
      const n = w[i + 1]
      units.push({ t: c, v: !(n && isVowelLetter(n)) })
    } else units.push({ t: c, v: isVowelLetter(c) })
  }
  const seg = (u: { t: string; v: boolean }): Seg =>
    u.v
      ? {
          kind: 'V',
          ph: UNACUTE[u.t] ?? (u.t === 'ü' ? 'u' : u.t === 'y' ? 'i' : u.t),
          acute: u.t in UNACUTE,
          strong: STRONG.test(u.t),
          at: 0
        }
      : { kind: 'C', ph: u.t, at: 0 }
  const segs = units.map(seg)
  // 正字法上的连缀：pr pl br bl fr fl cr cl gr gl dr tr
  const ortho = (a: string, b: string): boolean =>
    /^(p|b|f|c|k|g|t|d)(r|l)$/.test(a + b) && a + b !== 'dl' && a + b !== 'tl'
  const nuclei: [number, number][] = []
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].kind !== 'V') continue
    let j = i
    while (j + 1 < segs.length && segs[j + 1].kind === 'V' && !hiatus(segs[j], segs[j + 1])) j++
    nuclei.push([i, j])
    i = j
  }
  if (nuclei.length < 2) return [w]
  const out: string[] = []
  let start = 0
  for (let k = 0; k + 1 < nuclei.length; k++) {
    const from = nuclei[k][1] + 1
    const to = nuclei[k + 1][0]
    const cons = to - from
    let cut: number
    if (cons <= 0) cut = to
    else if (cons === 1) cut = from
    else cut = ortho(units[to - 2].t, units[to - 1].t) ? to - 2 : to - 1
    out.push(
      units
        .slice(start, cut)
        .map((u) => u.t)
        .join('')
    )
    start = cut
  }
  out.push(
    units
      .slice(start)
      .map((u) => u.t)
      .join('')
  )
  return out
}

/** 重音落在 syllables(word) 的第几个音节 */
export function stressedSyllable(word: string): number {
  const syl = syllables(word)
  for (let i = 0; i < syl.length; i++) if (hasAcute(syl[i])) return i
  if (syl.length < 2) return 0
  const w = word.toLocaleLowerCase('es')
  return /[aeiouns]$/.test(w) ? syl.length - 2 : syl.length - 1
}

// ───────────────────────── IPA ─────────────────────────

/**
 * 不重读的虚词（冠词、介词、连词、非重读代词、物主形容词短尾式）：单独标音也不标重音，
 * 短语里也不标（de nada → /de ˈnada/）。
 */
const UNSTRESSED = new Set(
  (
    'el la lo los las un al del de a en con por sin so tras ' +
    'y e ni o u que si me te se le les nos os mi mis tu tus su sus mas'
  ).split(' ')
)

/** 以 -mente 结尾、却不是副词的词（不拆成两个重音） */
const NOT_MENTE_ADV = new Set(['clemente', 'inclemente', 'demente', 'vehemente', 'simiente'])

/** 音段 → 音位符号（音节核里不在峰上的 i、u 读 j、w；峰后的照写 i、u，跟 es-pr 一样） */
function nucleusIpa(syl: Syl): string[] {
  const [a, b] = syl.nucleus
  const out = syl.segs.map((s) => s.ph)
  if (b < a) return out
  // 峰：带重音符的、强元音、都是弱元音时取后一个
  let peak = -1
  for (let i = a; i <= b; i++) if (syl.segs[i].acute) peak = i
  if (peak < 0) for (let i = a; i <= b; i++) if (syl.segs[i].strong) peak = i
  if (peak < 0) peak = b
  for (let i = a; i <= b; i++) {
    if (i === peak) continue
    const v = syl.segs[i].ph
    if (i < peak) out[i] = v === 'i' ? 'j' : v === 'u' ? 'w' : v
  }
  return out
}

/** 一个词的音位标音（不带 / /）；stress：标 ˈ、ˌ 还是不标 */
function wordIpa(word: string, opt: IpaOptions, stress: 'ˈ' | 'ˌ' | ''): string {
  // -mente 副词：形容词部分次重音，mente 主重音（rápidamente → ˌrapidaˈmente）
  const mente = /^(.{3,})mente$/.exec(word)
  if (mente && stress && /[aeiouáéíóú]/.test(mente[1]) && !NOT_MENTE_ADV.has(word)) {
    return wordIpa(mente[1], opt, 'ˌ') + wordIpa('mente', opt, stress)
  }
  const segs = segments(word, opt)
  const syls = syllabify(segs)
  const ending = word[word.length - 1] ?? ''
  const st = stressOf(syls, ending)
  const parts = syls.map((s) => nucleusIpa(s))
  // 音节尾（音节核后面）的辅音，后面紧跟辅音时：塞音写浊音（apto → abto，ritmo → ridmo，
  // técnico → teɡniko，bíceps → biθebs）；n 在 b、p、m 前写 m（enviar → embjaɾ）；
  // seseo 下 s + s 并成一个（piscina → pisina）。词末的不动（robot、club）。
  const flat: { ph: string; syl: number; role: 'onset' | 'nucleus' | 'coda' }[] = []
  parts.forEach((p, k) => {
    const [a, b] = syls[k].nucleus
    p.forEach((ph, i) =>
      flat.push({ ph, syl: k, role: i < a ? 'onset' : i <= b ? 'nucleus' : 'coda' })
    )
  })
  for (let i = 0; i + 1 < flat.length; i++) {
    const cur = flat[i]
    const next = flat[i + 1]
    if (cur.role !== 'coda' || next.role === 'nucleus') continue
    if (cur.ph === 'p') cur.ph = 'b'
    else if (cur.ph === 't') cur.ph = 'd'
    else if (cur.ph === 'k') cur.ph = 'ɡ'
    else if (cur.ph === 'n' && /^[bpm]$/.test(next.ph)) cur.ph = 'm'
    else if (cur.ph === 's' && next.ph === 's') cur.ph = ''
  }
  const bySyl: string[] = parts.map(() => '')
  for (const f of flat) bySyl[f.syl] += f.ph
  const mark = syls.length === 1 && !stress ? '' : stress
  return bySyl.map((s, k) => (k === st && mark ? mark + s : s)).join('')
}

/** 把词拆成字母串（去掉标点、数字）；保留空格分词 */
const WORDS = (text: string): string[] =>
  text
    .normalize('NFC')
    .toLocaleLowerCase('es')
    .replace(/[^\p{L}\s-]/gu, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)

/**
 * 音位标音（带 / /）：一个词或一个短语。短语里最后一个重读词标 ˈ，前面的重读词标 ˌ，虚词不标。
 * 例：zapato → /θaˈpato/（seseo：/saˈpato/）；buenos días → /ˌbwenos ˈdias/；de nada → /de ˈnada/。
 */
export function toIpa(text: string, opt: IpaOptions = {}): string {
  const words = WORDS(text)
  if (!words.length) return ''
  const stressed = words.map((w) => !UNSTRESSED.has(w) || words.length === 1)
  // 单独的虚词（de、el、que）也不标重音
  if (words.length === 1 && UNSTRESSED.has(words[0])) stressed[0] = false
  const last = stressed.lastIndexOf(true)
  const out = words.map((w, i) => wordIpa(w, opt, !stressed[i] ? '' : i === last ? 'ˈ' : 'ˌ'))
  return `/${out.join(' ')}/`
}

/** 推出来的几种口音的标音：v 是口音名（'' 表示各地一样），跟词条的 x.ipaV 用同一套名字 */
export interface IpaVariant {
  ipa: string
  v: string
}

/**
 * 一个词各地的读法：有 z / ce / ci 的分 distinción、seseo；有 ll 的再分 yeísmo、lleísmo。
 * 第一个是西班牙标准读法（distinción + yeísmo），跟维基词典的排法一样。
 */
export function ipaVariants(text: string): IpaVariant[] {
  const w = text.normalize('NFC').toLocaleLowerCase('es')
  const hasTheta = /z|c[eiéí]/.test(w)
  const hasLl = /ll/.test(w)
  const out: IpaVariant[] = []
  const add = (opt: IpaOptions, v: string): void => {
    const ipa = toIpa(w, opt)
    if (!out.some((o) => o.ipa === ipa)) out.push({ ipa, v })
  }
  if (!hasTheta && !hasLl) return [{ ipa: toIpa(w), v: '' }]
  if (hasTheta) {
    add({}, hasLl ? 'distinción yeísmo' : 'distinción')
    add({ seseo: true }, hasLl ? 'seseo yeísmo' : 'seseo')
    if (hasLl) {
      add({ lleismo: true }, 'distinción lleísmo')
      add({ seseo: true, lleismo: true }, 'seseo lleísmo')
    }
  } else {
    add({}, 'yeísmo')
    add({ lleismo: true }, 'lleísmo')
  }
  return out
}

// ───────────────────────── 重音符的增减（附着代词、复数用） ─────────────────────────

/** 最后一个元音加上重音符（voseo 命令式：deci → decí，anda → andá） */
export function acuteLastVowel(s: string): string {
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i]
    if (c in ACUTE) return s.slice(0, i) + ACUTE[c] + s.slice(i + 1)
    if (c in UNACUTE) return s
  }
  return s
}

/**
 * 按重音规则，这个词要不要写重音符才读得对：stressed 是重读音节的序号（从 0 数）。
 * 给变形、加附着代词时补重音符用（da + me + lo → dámelo）。
 */
export function needsAcute(word: string, stressed: number): boolean {
  const syl = syllables(stripAcute(word))
  if (syl.length < 2) return false
  const w = stripAcute(word).toLocaleLowerCase('es')
  const natural = /[aeiouns]$/.test(w) ? syl.length - 2 : syl.length - 1
  return natural !== stressed
}
