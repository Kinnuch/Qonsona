/**
 * 韩语谓词的活用（正向）：词干 + 先语末词尾 + 语末词尾 → 写法。全部在字母串上做（hangul.ts）。
 *
 * 活用类别（PredClass）只记「看词形看不出来」的不规则；按词干形状就能定的自动处理：
 *   以 하 结尾的（하다、공부하다）：해 / 하여；ㄹ 词干遇 ㄴ、ㅂ、ㅅ 脱落（살다 → 사는、삽니다）；
 *   ㅡ 词干在 아/어 前脱落（쓰다 → 써，바쁘다 → 바빠）。
 * 词典里的「活用」（한국어기초사전给的 들어、들으니）用来定类别，见 classify()。
 *
 * deinflect.ts 的还原结果都要拿这里正向活用核对一遍，两边永远一致。
 */
import { ENDINGS, type Ending } from './endings'
import { compose, decompose, fromJamo, isConsonant, isVowel, toJamo } from './hangul'

/**
 * 活用类别：
 * reg 规则（含 으 脱落、ㄹ 脱落、하다）；p ㅂ 不规则（춥다 추워）；po ㅂ 不规则接 와（돕다 도와、곱다 고와）；
 * t ㄷ 不规则（듣다 들어）；s ㅅ 不规则（낫다 나아）；reu 르 不规则（모르다 몰라）；reo 러 不规则（이르다 이르러）；
 * h ㅎ 不规则（파랗다 파래）；u 우 不规则（푸다 퍼）；cop 이다、아니다（이에요、아니에요）
 */
export type PredClass = 'reg' | 'p' | 'po' | 't' | 's' | 'reu' | 'reo' | 'h' | 'u' | 'cop'

export const PRED_CLASSES: PredClass[] = ['reg', 'p', 'po', 't', 's', 'reu', 'reo', 'h', 'u', 'cop']

/** 不规则类别的名字（词典的 cls、界面） */
export const CLASS_LABEL: Record<PredClass, { zh: string; en: string; ko: string }> = {
  reg: { zh: '规则', en: 'regular', ko: '규칙' },
  p: { zh: 'ㅂ 不规则', en: 'ㅂ-irregular', ko: 'ㅂ 불규칙' },
  po: { zh: 'ㅂ 不规则', en: 'ㅂ-irregular', ko: 'ㅂ 불규칙' },
  t: { zh: 'ㄷ 不规则', en: 'ㄷ-irregular', ko: 'ㄷ 불규칙' },
  s: { zh: 'ㅅ 不规则', en: 'ㅅ-irregular', ko: 'ㅅ 불규칙' },
  reu: { zh: '르 不规则', en: '르-irregular', ko: '르 불규칙' },
  reo: { zh: '러 不规则', en: '러-irregular', ko: '러 불규칙' },
  h: { zh: 'ㅎ 不规则', en: 'ㅎ-irregular', ko: 'ㅎ 불규칙' },
  u: { zh: '우 不规则', en: '우-irregular', ko: '우 불규칙' },
  cop: { zh: '이다（叙述格助词）', en: 'copula', ko: '이다' }
}

/** 一个（可能带了先语末词尾的）词干 */
interface Stem {
  /** 字母串 */
  j: string
  cls: PredClass
  /** 最后接上的先语末词尾：-았-、-겠- 后面的 아/어 一律用 어，-(으)시- 后面 -어요 变 -세요 */
  after?: 'hon' | 'past' | 'fut'
}

const last = (s: string): string => s[s.length - 1] ?? ''

/** 이렇다、그렇다、저렇다、어떻다、아무렇다：ㅎ 不规则里 ㅓ 变 ㅐ 的几个（其余 ㅓ 变 ㅔ：누렇다 → 누레） */
const DEMONSTRATIVE_H = /(?:ㅇㅣㄹㅓㅎ|ㄱㅡㄹㅓㅎ|ㅈㅓㄹㅓㅎ|ㅇㅓㄸㅓㅎ|ㅇㅏㅁㅜㄹㅓㅎ)$/

/** 그러다、이러다、저러다、어쩌다：러/쩌 + 어 缩成 래/째（그래、어째） */
const CONTRACT_AE = /(?:ㄱㅡㄹㅓ|ㅇㅣㄹㅓ|ㅈㅓㄹㅓ|ㅇㅓㅉㅓ)$/

/** 本身以「시」结尾的敬语动词：-어요 是 -세요（계세요、주무세요、드세요） */
const HON_VERB =
  /(?:ㄱㅖㅅㅣ|ㅈㅜㅁㅜㅅㅣ|ㄷㅡㅅㅣ|ㅈㅏㅂㅅㅜㅅㅣ|ㄴㅎㅇㅡㅅㅣ|ㅇㅣㅆㅇㅡㅅㅣ|ㄷㅗㄹㅇㅏㄱㅏㅅㅣ|ㅎㅏㅅㅣ)$/

/** 阳性元音（ㅏ、ㅗ、ㅑ）结尾的接 아，其余接 어 */
function yang(j: string): boolean {
  for (let i = j.length - 1; i >= 0; i--)
    if (isVowel(j[i])) return j[i] === 'ㅏ' || j[i] === 'ㅗ' || j[i] === 'ㅑ'
  return false
}

/** 末尾是收音 ㄹ（不是双收音的一部分：삶 是 ㅅㅏㄹㅁ，末尾是 ㅁ） */
const endsWithRieul = (j: string): boolean => last(j) === 'ㄹ' && isVowel(j[j.length - 2] ?? '')

/** ㄹ 词干遇到这些开头的词尾要脱落：ㄴ、ㅂ、ㅅ，以及「ㄹ + 辅音」（-ㄹ까、-ㄹ게……；-러、-려고 不脱落） */
function dropsRieul(ending: string): boolean {
  const c = ending[0]
  if (c === 'ㄴ' || c === 'ㅂ' || c === 'ㅅ') return true
  return c === 'ㄹ' && (ending.length === 1 || isConsonant(ending[1]))
}

/** 아/어 形（연결형 -아/어）；第一个是通行写法，后面的是也对的写法（되어 / 돼） */
export function infinitive(st: Stem): string[] {
  const j = st.j
  const v = last(j)
  if (st.after === 'past' || st.after === 'fut') return [j + 'ㅇㅓ']
  if (st.after === 'hon') return [j.slice(0, -1) + 'ㅕ', j + 'ㅇㅓ'] // 셔、시어
  if (st.cls === 'cop') return [j + 'ㅇㅓ'] // 이어、아니어
  if (j.endsWith('ㅎㅏ')) return [j.slice(0, -1) + 'ㅐ', j + 'ㅇㅕ'] // 해、하여
  switch (st.cls) {
    case 'p':
      return [j.slice(0, -1) + 'ㅇㅝ'] // 춥 → 추워
    case 'po':
      return [j.slice(0, -1) + 'ㅇㅘ'] // 돕 → 도와
    case 't': {
      const s = j.slice(0, -1) + 'ㄹ'
      return [s + (yang(s) ? 'ㅇㅏ' : 'ㅇㅓ')] // 듣 → 들어、깨닫 → 깨달아
    }
    case 's': {
      const s = j.slice(0, -1)
      return [s + (yang(s) ? 'ㅇㅏ' : 'ㅇㅓ')] // 낫 → 나아、짓 → 지어
    }
    case 'reu': {
      const base = j.slice(0, -2) // 모르 → 모
      return [base + 'ㄹㄹ' + (yang(base) ? 'ㅏ' : 'ㅓ')] // 몰라、불러
    }
    case 'reo':
      return [j + 'ㄹㅓ'] // 이르러
    case 'u':
      return [j.slice(0, -1) + 'ㅓ'] // 푸 → 퍼
    case 'h': {
      const s = j.slice(0, -1) // 파랗 → 파라
      const vv = last(s)
      // ㅏ → ㅐ（파래）、ㅑ → ㅒ（하얘）、ㅓ → ㅔ（누레）、ㅕ → ㅖ（부예）；이렇다、그렇다、저렇다、어떻다 是 ㅐ
      const nv =
        vv === 'ㅑ'
          ? 'ㅒ'
          : vv === 'ㅕ'
            ? 'ㅖ'
            : vv === 'ㅓ' && !DEMONSTRATIVE_H.test(j)
              ? 'ㅔ'
              : 'ㅐ'
      return [s.slice(0, -1) + nv]
    }
  }
  if (isConsonant(v)) {
    const out = [j + (yang(j) ? 'ㅇㅏ' : 'ㅇㅓ')]
    if (j.endsWith('ㄴㅗㅎ')) out.push(j.slice(0, -2) + 'ㅘ') // 놓아 → 놔
    return out
  }
  const pre = j.slice(0, -1)
  if (CONTRACT_AE.test(j)) return [pre + 'ㅐ'] // 그래、어째
  switch (v) {
    case 'ㅏ':
    case 'ㅓ':
    case 'ㅕ':
      return [j] // 가、서、켜
    case 'ㅐ':
    case 'ㅔ':
    case 'ㅞ':
      return [j, j + 'ㅇㅓ'] // 보내 / 보내어、꿰 / 꿰어
    case 'ㅗ':
      // 오다（나오다、돌아오다）只有 와；보다 → 봐 / 보아
      return j.endsWith('ㅇㅗ') ? [pre + 'ㅘ'] : [pre + 'ㅘ', j + 'ㅇㅏ']
    case 'ㅜ':
      return [pre + 'ㅝ', j + 'ㅇㅓ'] // 줘 / 주어
    case 'ㅣ':
      return [pre + 'ㅕ', j + 'ㅇㅓ'] // 마셔 / 마시어
    case 'ㅚ':
      return [pre + 'ㅙ', j + 'ㅇㅓ'] // 돼 / 되어
    case 'ㅡ': {
      // ㅡ 脱落：前一个音节是阳性元音接 아（바빠），没有前一个音节或是阴性元音接 어（써、예뻐）
      const before = pre.slice(0, -1)
      return [pre + (yang(before) ? 'ㅏ' : 'ㅓ')]
    }
    default:
      return [j + 'ㅇㅓ'] // 뛰어、띄어……
  }
}

/** 接一个 C 类（辅音开头、直接接）词尾 */
function attachC(st: Stem, e: string): string[] {
  const j = st.j
  if (endsWithRieul(j) && dropsRieul(e)) return [j.slice(0, -1) + e] // 살 + 는 → 사는
  // ㅎ 不规则形容词接 ㄴ 开头的：파랗네요 / 파라네요（2015 年起两种都对）
  if (st.cls === 'h' && !st.after && e[0] === 'ㄴ') return [j + e, j.slice(0, -1) + e]
  return [j + e]
}

/** 接一个 E 类（(으)）词尾 */
function attachE(st: Stem, e: string): string[] {
  const j = st.j
  const v = last(j)
  if (isVowel(v)) return [j + e] // 가면、간、가세요
  if (endsWithRieul(j)) return dropsRieul(e) ? [j.slice(0, -1) + e] : [j + e] // 사니까、살면
  if (!st.after)
    switch (st.cls) {
      case 'p':
      case 'po':
        return [j.slice(0, -1) + 'ㅇㅜ' + e] // 추우면、도우면
      case 't':
        return [j.slice(0, -1) + 'ㄹㅇㅡ' + e] // 들으면
      case 's':
        return [j.slice(0, -1) + 'ㅇㅡ' + e] // 나으면
      case 'h':
        return [j.slice(0, -1) + e] // 파라면、파란
    }
  return [j + 'ㅇㅡ' + e] // 먹으면、먹었으면
}

/** 接一个 B 类（辅音词干 / 元音词干写法不同）词尾 */
function attachB(st: Stem, e: Ending): string[] {
  const j = st.j
  if (isVowel(last(j))) return [j + e.jv!] // 갑니다、간다
  if (endsWithRieul(j)) return [j.slice(0, -1) + e.jv!] // 삽니다、산다
  return [j + e.j] // 먹습니다、먹는다
}

/** 이다、아니다 的特殊写法 */
function copula(st: Stem, e: Ending): string[] | null {
  if (st.cls !== 'cop' || st.after) return null
  const j = st.j
  switch (e.id) {
    case 'hae':
      return [j + 'ㅇㅑ'] // 이야、아니야
    case 'haeyo':
      return [j + 'ㅇㅔㅇㅛ', j + 'ㅇㅓㅇㅛ'] // 이에요 / 이어요
    case 'aseo':
      return [j + 'ㄹㅏㅅㅓ', j + 'ㅇㅓㅅㅓ'] // 이라서 / 이어서
  }
  // 引语、转述类：이라고、이래요、이라면、이라는
  if (e.type === 'C' && e.j.startsWith('ㄷㅏ') && e.id !== 'da' && e.id !== 'daga')
    return [j + 'ㄹ' + e.j.slice(1)]
  if (e.type === 'C' && e.j.startsWith('ㄷㅐ')) return [j + 'ㄹ' + e.j.slice(1)]
  return null
}

/** 给一个词干接一个词尾（先语末或语末），返回新的写法（字母串） */
function attach(st: Stem, e: Ending): string[] {
  const special = copula(st, e)
  if (special) return special
  // -(으)시- 后面的 -어요 是 -세요（-셔요 也对，单列一个词尾）；계시다 这类敬语动词也一样
  if (e.id === 'haeyo' && st.after === 'hon') return [st.j.slice(0, -1) + 'ㅔㅇㅛ']
  // 本身以「시」结尾的动词：계시다、주무시다 是 -세요，모시다、가시다 是 -셔요（另一种也收，查得到）
  if (e.id === 'haeyo' && !st.after && st.cls === 'reg' && st.j.endsWith('ㅅㅣ')) {
    const se = st.j.slice(0, -1) + 'ㅔㅇㅛ'
    const syeo = st.j.slice(0, -1) + 'ㅕㅇㅛ'
    return HON_VERB.test(st.j) ? [se, syeo] : [syeo, st.j + 'ㅇㅓㅇㅛ', se]
  }
  // 가다、오다 的命令形另有 가거라、오너라
  if (e.id === 'ara' && !st.after && st.cls === 'reg') {
    if (st.j.endsWith('ㄱㅏ')) return [...infinitive(st).map((x) => x + e.j), st.j + 'ㄱㅓㄹㅏ']
    if (st.j.endsWith('ㅇㅗ')) return [...infinitive(st).map((x) => x + e.j), st.j + 'ㄴㅓㄹㅏ']
  }
  switch (e.type) {
    case 'A':
      return infinitive(st).map((x) => x + e.j)
    case 'C':
      return attachC(st, e.j)
    case 'E':
      return attachE(st, e.j)
    case 'B':
      return attachB(st, e)
  }
}

/** 活用：词干（字母串）+ 词尾序列（ENDINGS 的 id）→ 写法（字母串，可能几种，通行的在前） */
export function conjugateJamo(stem: string, cls: PredClass, chain: string[]): string[] {
  let states: Stem[] = [{ j: stem, cls }]
  for (const id of chain) {
    const e = ENDINGS.get(id)
    if (!e) throw new Error(`没有这个词尾：${id}`)
    const next: Stem[] = []
    const seen = new Set<string>()
    for (const st of states)
      for (const j of attach(st, e))
        if (!seen.has(j)) {
          seen.add(j)
          next.push({
            j,
            cls: 'reg',
            after: id === 'hon' || id === 'past' || id === 'fut' ? id : undefined
          })
        }
    states = next
  }
  return states.map((s) => s.j)
}

/** 活用：原形（먹다）+ 词尾序列 → 写法（먹었어요）；拼不成音节的丢掉 */
export function conjugate(lemma: string, cls: PredClass, chain: string[]): string[] {
  if (!lemma.endsWith('다') || lemma.length < 2) return []
  const out: string[] = []
  for (const j of conjugateJamo(toJamo(lemma.slice(0, -1)), cls, chain)) {
    const s = fromJamo(j)
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

// ───────────────────────── 定类别 ─────────────────────────

/** 按词干形状可能是哪几类（第一个是默认） */
export function possibleClasses(lemma: string): PredClass[] {
  if (lemma === '이다' || lemma === '아니다') return ['cop']
  const stem = lemma.slice(0, -1)
  const s = decompose(stem.slice(-1))
  if (!s) return ['reg']
  if (stem.endsWith('하')) return ['reg']
  if (s.t === 'ㅂ') return ['reg', 'p', 'po']
  if (s.t === 'ㄼ') return ['reg', 'p'] // 섧다 → 설워
  if (s.t === 'ㄷ') return ['reg', 't']
  if (s.t === 'ㅅ') return ['reg', 's']
  if (s.t === 'ㅎ') return ['reg', 'h']
  if (!s.t && s.v === 'ㅡ' && s.l === 'ㄹ') return ['reu', 'reg', 'reo']
  if (!s.t && s.v === 'ㅜ' && stem === '푸') return ['u']
  return ['reg']
}

/**
 * 按词典给的活用形（들어、들으니、듣는……）定类别：哪一类正向活用出来的跟它们都对得上就是哪一类。
 * 都对不上（词典的活用形是别的词尾）时按形状给默认。
 */
export function classify(lemma: string, attested: string[]): PredClass {
  const cands = possibleClasses(lemma)
  if (cands.length === 1 || !attested.length) return defaultClass(lemma, cands)
  const probes = ['hae', 'euni', 'myeon', 'n', 'neun', 'seumnida', 'go', 'ji']
  let best: PredClass | null = null
  let bestScore = -1
  for (const cls of cands) {
    const forms = new Set<string>()
    for (const p of probes) for (const f of conjugate(lemma, cls, [p])) forms.add(f)
    for (const f of conjugate(lemma, cls, ['past', 'da'])) forms.add(f)
    let score = 0
    for (const a of attested) if (forms.has(a)) score++
    if (score > bestScore) {
      best = cls
      bestScore = score
    }
  }
  return bestScore > 0 && best ? best : defaultClass(lemma, cands)
}

/** 没有活用形可看时的默认：-랗다/-렇다/-얗다 形容词是 ㅎ 不规则，르 结尾的是 르 不规则，其余规则 */
function defaultClass(lemma: string, cands: PredClass[]): PredClass {
  const stem = lemma.slice(0, -1)
  if (cands.includes('h') && /[랗렇얗옇]$/.test(stem)) return 'h'
  if (cands.includes('p') && /(?:롭|답|스럽|겁|깝|럽|덥|춥|쉽|어렵|가볍|무겁|맵|밉|곱)$/.test(stem))
    return /(?:돕|곱)$/.test(stem) ? 'po' : 'p'
  return cands[0]
}

/** 拼一个音节（给外面用） */
export { compose }
