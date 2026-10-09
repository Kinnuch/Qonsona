/**
 * 韩语谓词的还原（反向）：먹었어요 → 먹다 + -았/었- + -아요/어요。
 *
 * 做法：从词尾往前剥。每剥一层，按各种可能的音变倒推出几个词干（规则、ㄹ 脱落、ㅂ/ㄷ/ㅅ/ㅎ/르/러/우 不规则、
 * 缩约前后两种写法……），尽量多猜；最后每一个猜测都用 conjugate.ts 正向活用一遍，跟原来的写法一模一样才留下。
 * 所以还原跟活用永远一致，倒推的规则写宽了也不会出错，只是多算几次。
 * 词典里有没有这个词由调用方（查词时）判断；这里按「常见程度」给每种分析打分，常见的排前面。
 */
import { conjugateJamo, type PredClass } from './conjugate'
import { ENDINGS, FINALS, type Ending } from './endings'
import { fromJamo, isConsonant, isVowel, toJamo } from './hangul'

export interface PredAnalysis {
  /** 原形：먹다 */
  lemma: string
  /** 词干的字母串 */
  stem: string
  cls: PredClass
  /** 词尾序列（ENDINGS 的 id），先语末在前：['past', 'haeyo'] */
  chain: string[]
  /** 越小越常见 */
  score: number
}

interface Cand {
  j: string
  cls: PredClass
  /** 倒推时加的分（不规则、ㄹ 复原……） */
  pen: number
}

const last = (s: string): string => s[s.length - 1] ?? ''
const vowelFinal = (j: string): boolean => isVowel(last(j))
const consonantFinal = (j: string): boolean => isConsonant(last(j))
/** 末尾是单独的收音 ㄹ */
const rieulFinal = (j: string): boolean => last(j) === 'ㄹ' && isVowel(j[j.length - 2] ?? '')

function dropsRieul(ending: string): boolean {
  const c = ending[0]
  if (c === 'ㄴ' || c === 'ㅂ' || c === 'ㅅ') return true
  return c === 'ㄹ' && (ending.length === 1 || isConsonant(ending[1]))
}

/** 词干至少要有一个完整音节 */
const okStem = (j: string): boolean => j.length >= 2 && isConsonant(j[0]) && isVowel(j[1])

/** E 类（(으)）词尾前面的部分 R → 词干 */
function revE(R: string, e: string): Cand[] {
  const out: Cand[] = []
  if (R.endsWith('ㅇㅡ')) {
    const b = R.slice(0, -2)
    if (consonantFinal(b)) {
      out.push({ j: b, cls: 'reg', pen: 0 }) // 먹으 → 먹
      if (rieulFinal(b)) out.push({ j: b.slice(0, -1) + 'ㄷ', cls: 't', pen: 0.5 }) // 들으 → 듣
    }
    if (vowelFinal(b)) out.push({ j: b + 'ㅅ', cls: 's', pen: 0.5 }) // 나으 → 낫
  }
  if (R.endsWith('ㅇㅜ')) {
    const b = R.slice(0, -2)
    if (vowelFinal(b)) {
      out.push({ j: b + 'ㅂ', cls: 'p', pen: 0.5 }) // 추우 → 춥
      out.push({ j: b + 'ㅂ', cls: 'po', pen: 0.6 }) // 도우 → 돕
    }
  }
  if (vowelFinal(R)) {
    out.push({ j: R, cls: 'reg', pen: 0 }) // 가 → 가
    if (dropsRieul(e)) out.push({ j: R + 'ㄹ', cls: 'reg', pen: 0.4 }) // 사 → 살
    const v = last(R)
    if (v === 'ㅏ' || v === 'ㅓ' || v === 'ㅑ' || v === 'ㅕ')
      out.push({ j: R + 'ㅎ', cls: 'h', pen: 0.5 }) // 파라 → 파랗、그러 → 그렇
  }
  if (rieulFinal(R)) out.push({ j: R, cls: 'reg', pen: 0 }) // 살면 → 살
  return out
}

/** 아/어 形 R → 词干 */
function revInf(R: string): Cand[] {
  const out: Cand[] = []
  const v = last(R)
  if (!isVowel(v)) return out
  if (R.endsWith('ㅇㅏ') || R.endsWith('ㅇㅓ')) {
    const b = R.slice(0, -2)
    if (consonantFinal(b)) {
      out.push({ j: b, cls: 'reg', pen: 0 }) // 먹어 → 먹
      if (rieulFinal(b)) out.push({ j: b.slice(0, -1) + 'ㄷ', cls: 't', pen: 0.5 }) // 들어 → 듣
    } else if (vowelFinal(b)) {
      out.push({ j: b, cls: 'reg', pen: 0 }) // 되어 → 되、보아 → 보
      out.push({ j: b + 'ㅅ', cls: 's', pen: 0.5 }) // 나아 → 낫、지어 → 짓
    }
  }
  if (R.endsWith('ㅇㅝ')) out.push({ j: R.slice(0, -2) + 'ㅂ', cls: 'p', pen: 0.5 }) // 추워 → 춥
  if (R.endsWith('ㅇㅘ')) out.push({ j: R.slice(0, -2) + 'ㅂ', cls: 'po', pen: 0.6 }) // 도와 → 돕
  if (R.endsWith('ㄹㄹㅏ') || R.endsWith('ㄹㄹㅓ'))
    out.push({ j: R.slice(0, -3) + 'ㄹㅡ', cls: 'reu', pen: 0.4 }) // 몰라 → 모르
  if (R.endsWith('ㄹㅡㄹㅓ')) out.push({ j: R.slice(0, -2), cls: 'reo', pen: 0.6 }) // 이르러 → 이르
  if (R.endsWith('ㅎㅏㅇㅕ')) out.push({ j: R.slice(0, -2), cls: 'reg', pen: 0.3 }) // 하여 → 하
  const pre = R.slice(0, -1)
  switch (v) {
    case 'ㅏ':
    case 'ㅓ':
      out.push({ j: R, cls: 'reg', pen: 0 }) // 가 → 가、서 → 서
      out.push({ j: pre + 'ㅡ', cls: 'reg', pen: 0.2 }) // 바빠 → 바쁘、써 → 쓰
      if (v === 'ㅓ') out.push({ j: pre + 'ㅜ', cls: 'u', pen: 0.8 }) // 퍼 → 푸
      break
    case 'ㅕ':
      out.push({ j: R, cls: 'reg', pen: 0 }) // 켜 → 켜
      out.push({ j: pre + 'ㅣ', cls: 'reg', pen: 0 }) // 마셔 → 마시
      break
    case 'ㅐ':
      out.push({ j: R, cls: 'reg', pen: 0 }) // 보내 → 보내
      if (R.endsWith('ㅎㅐ')) out.push({ j: pre + 'ㅏ', cls: 'reg', pen: 0 }) // 해 → 하
      out.push({ j: pre + 'ㅏㅎ', cls: 'h', pen: 0.5 }) // 파래 → 파랗
      out.push({ j: pre + 'ㅓㅎ', cls: 'h', pen: 0.5 }) // 그래 → 그렇
      break
    case 'ㅒ':
      out.push({ j: R, cls: 'reg', pen: 0 })
      out.push({ j: pre + 'ㅑㅎ', cls: 'h', pen: 0.5 }) // 하얘 → 하얗
      break
    case 'ㅖ':
      out.push({ j: R, cls: 'reg', pen: 0 })
      out.push({ j: pre + 'ㅕㅎ', cls: 'h', pen: 0.5 }) // 부예 → 부옇
      break
    case 'ㅔ':
      out.push({ j: R, cls: 'reg', pen: 0 }) // 세 → 세
      break
    case 'ㅘ':
      out.push({ j: pre + 'ㅗ', cls: 'reg', pen: 0 }) // 봐 → 보
      out.push({ j: pre + 'ㅗㅎ', cls: 'reg', pen: 0.5 }) // 놔 → 놓
      break
    case 'ㅝ':
      out.push({ j: pre + 'ㅜ', cls: 'reg', pen: 0 }) // 줘 → 주
      break
    case 'ㅙ':
      out.push({ j: pre + 'ㅚ', cls: 'reg', pen: 0 }) // 돼 → 되
      break
  }
  return out
}

/** C 类词尾前面的部分 R → 词干 */
function revC(R: string, e: string): Cand[] {
  const out: Cand[] = []
  if (!R) return out
  out.push({ j: R, cls: 'reg', pen: 0 })
  if (vowelFinal(R)) {
    if (dropsRieul(e)) out.push({ j: R + 'ㄹ', cls: 'reg', pen: 0.4 }) // 사는 → 살
    const v = last(R)
    if (e[0] === 'ㄴ' && (v === 'ㅏ' || v === 'ㅓ' || v === 'ㅑ' || v === 'ㅕ'))
      out.push({ j: R + 'ㅎ', cls: 'h', pen: 0.7 }) // 파라네요 → 파랗
  }
  return out
}

interface Peeled {
  stem: Cand
  pre: string[]
}

/** 从一个（可能带着先语末词尾的）词干上剥 -겠-、-았/었-、-(으)시-（从右往左，顺序固定） */
function peel(c: Cand, level: number, out: Peeled[], pre: string[] = []): void {
  out.push({ stem: c, pre })
  if (c.cls !== 'reg') return
  const j = c.j
  if (level >= 3 && j.endsWith('ㄱㅔㅆ'))
    for (const s of revC(j.slice(0, -3), 'ㄱㅔㅆ'))
      peel({ ...s, pen: s.pen + c.pen }, 2, out, ['fut', ...pre])
  if (level >= 2 && j.endsWith('ㅆ'))
    for (const s of revInf(j.slice(0, -1)))
      peel({ ...s, pen: s.pen + c.pen }, 1, out, ['past', ...pre])
  if (level >= 1 && j.endsWith('ㅅㅣ'))
    for (const s of revE(j.slice(0, -2), 'ㅅㅣ'))
      peel({ ...s, pen: s.pen + c.pen }, 0, out, ['hon', ...pre])
}

/** 一个词尾在 J 末尾能怎么对上：给出前面部分的候选词干 */
function stemsBefore(J: string, e: Ending): Cand[] {
  switch (e.type) {
    case 'A': {
      if (!J.endsWith(e.j)) return []
      return revInf(J.slice(0, J.length - e.j.length))
    }
    case 'C':
      return J.endsWith(e.j) ? revC(J.slice(0, -e.j.length), e.j) : []
    case 'E':
      return J.endsWith(e.j) ? revE(J.slice(0, -e.j.length), e.j) : []
    case 'B': {
      const out: Cand[] = []
      if (J.endsWith(e.j)) {
        const R = J.slice(0, -e.j.length)
        if (consonantFinal(R)) out.push({ j: R, cls: 'reg', pen: 0 })
      }
      if (e.jv && J.endsWith(e.jv)) {
        const R = J.slice(0, -e.jv.length)
        if (vowelFinal(R)) {
          out.push({ j: R, cls: 'reg', pen: 0 })
          out.push({ j: R + 'ㄹ', cls: 'reg', pen: 0.4 }) // 삽니다 → 살
        }
      }
      return out
    }
  }
}

/**
 * 词干本身不太像词干的加分：最后一个音节带 ㅆ 收音（먹었-、갔-，多半是 -았/었- 没剥；있다 例外）、
 * 最后一个音节是「으」（먹었으-：多半是 (으) 类词尾的 으）
 */
function oddStem(j: string): number {
  if (j.endsWith('ㅆ') && !j.endsWith('ㅇㅣㅆ')) return 1
  if (j.endsWith('ㅇㅡ')) return 1
  // 两个音节以上、最后是「아」「어」的（먹었어-、갔어-）：多半是 아/어 形没剥干净
  if ((j.endsWith('ㅇㅓ') || j.endsWith('ㅇㅏ')) && j.length > 3) return 0.8
  return 0
}

/** 冠形词尾 -는、-(으)ㄴ、-(으)ㄹ 跟助词 는、은、을/를 同形（우리는、사는），分析成谓词的往后排一点 */
const ADNOMINAL = new Set(['neun', 'n', 'l'])

/** 正向核对：这样活用出来是不是正好是 J；是第几种写法（0 是通行写法） */
function verify(stem: string, cls: PredClass, chain: string[], J: string): number {
  const forms = conjugateJamo(stem, cls, chain)
  return forms.indexOf(J)
}

/** 后面接了助词的词尾（먹기를、먹고요、해서는）：先剥这些 */
const AFTER_ENDING: { j: string; label: string }[] = [
  { j: 'ㅇㅛ', label: '요' },
  { j: 'ㄴㅡㄴ', label: '은/는' },
  { j: 'ㅇㅡㄴ', label: '은/는' },
  { j: 'ㄷㅗ', label: '도' },
  { j: 'ㅁㅏㄴ', label: '만' },
  { j: 'ㄹㅡㄹ', label: '을/를' },
  { j: 'ㅇㅡㄹ', label: '을/를' },
  { j: 'ㄱㅏ', label: '이/가' },
  { j: 'ㅇㅔ', label: '에' },
  { j: 'ㅇㅡㄹㅗ', label: '(으)로' },
  { j: 'ㄹㅗ', label: '(으)로' },
  { j: 'ㄲㅏㅈㅣ', label: '까지' },
  { j: 'ㅂㅜㅌㅓ', label: '부터' },
  { j: 'ㅇㅢ', label: '의' }
]

/**
 * 谓词还原：一个语节可能是哪些谓词的什么活用。结果按分数排（常见的在前），同一原形同一词尾序列只留一个。
 * 只管一般的谓词；이다、아니다（写法特殊）、名词加助词、名词加 이다 见 lemma.ts。
 */
export function deinflectPredicate(word: string): PredAnalysis[] {
  const J = toJamo(word)
  if (!/^[ㄱ-ㅣ]+$/.test(J)) return []
  const found = new Map<string, PredAnalysis>()
  const consider = (J0: string, extraTags: string[], extraPen: number): void => {
    for (const e of FINALS) {
      if (extraTags.length && !e.takesParticle) continue
      for (const c of stemsBefore(J0, e)) {
        const peeled: Peeled[] = []
        peel(c, e.tensed ? 3 : 1, peeled)
        for (const { stem, pre } of peeled) {
          if (!okStem(stem.j)) continue
          const chain = [...pre, e.id]
          const variant = verify(stem.j, stem.cls, chain, J0)
          if (variant < 0) continue
          const lemmaStem = fromJamo(stem.j)
          if (!lemmaStem) continue
          const lemma = lemmaStem + '다'
          const score =
            0.2 +
            e.rank * 0.5 +
            pre.length * 0.2 +
            stem.pen +
            (variant > 0 ? 0.6 : 0) +
            oddStem(stem.j) +
            (ADNOMINAL.has(e.id) && !pre.length ? 0.3 : 0) +
            extraPen
          const fullChain = [...chain, ...extraTags]
          const k = lemma + '|' + fullChain.join(' ')
          const cur = found.get(k)
          if (!cur || cur.score > score)
            found.set(k, { lemma, stem: stem.j, cls: stem.cls, chain: fullChain, score })
        }
      }
    }
  }
  consider(J, [], 0)
  for (const p of AFTER_ENDING)
    if (J.endsWith(p.j) && J.length > p.j.length + 2)
      consider(J.slice(0, -p.j.length), ['p:' + p.label], 0.5)
  // 缩约：-기는 → -긴、-지는 → -진、-기를 → -길
  for (const [tail, full, label] of [
    ['ㄱㅣㄴ', 'ㄱㅣ', '은/는'],
    ['ㅈㅣㄴ', 'ㅈㅣ', '은/는'],
    ['ㄱㅣㄹ', 'ㄱㅣ', '을/를']
  ] as const)
    if (J.endsWith(tail)) consider(J.slice(0, -tail.length) + full, ['p:' + label], 0.7)
  return [...found.values()].sort((a, b) => a.score - b.score)
}

/** 词尾序列的标签（显示、认语法点）：['past','haeyo'] → ['-았/었-', '-아요/어요']；助词写成「은/는」 */
export function chainTags(chain: string[]): string[] {
  return chain.map((id) => (id.startsWith('p:') ? id.slice(2) : (ENDINGS.get(id)?.label ?? id)))
}
