/**
 * 韩语的「猜原形」（rules.lemmaCandidates）：一个语节（어절）可能是哪些词的什么形式。
 *
 *   학교에서는 → 학교 + 에서 + 은/는
 *   먹었어요   → 먹다 + -았/었- + -아요/어요
 *   학생이에요 → 학생 + 이다 + -아요/어요
 *   공부했어요 → 공부하다（词典里没有「공부하다」时再给「공부」）
 *   마음에 들어요 → 마음에 들다（带空格的短语：只还原最后一个语节）
 *
 * 词典里有没有由查词的一方判断；这里只管把可能的分析按常见程度排好（常见的在前，阅读器取第一个查得到的）。
 */
import { conjugate, type PredClass } from './conjugate'
import { chainTags, deinflectPredicate } from './deinflect'
import { ENDINGS, FINALS } from './endings'
import { compose, decompose, isHangulWord, withPart } from './hangul'
import {
  CODA_PARTICLES,
  PARTICLES,
  PRONOUNS,
  PRONOUN_FORMS,
  condOk,
  type Particle
} from './particles'
import type { LemmaGuess } from '../types'

interface Guess extends LemmaGuess {
  score: number
}

// ───────────────────────── 이다、아니다 ─────────────────────────

/** 이다 / 아니다 的活用表：写法 → 词尾序列（第一次用时算好） */
let copulaTable: {
  afterC: Map<string, string[]>
  afterV: Map<string, string[]>
  /** afterV 里「이」整个省掉的（의사라고、가라고）：容易跟动词的活用撞（가다 → 가라고），分析时往后排 */
  dropped: Set<string>
  anida: Map<string, string[]>
} | null = null

/** 이다、아니다 接的词尾（命令、劝诱、只接动词的不要） */
const COPULA_CHAINS = (): string[][] => {
  const finals = FINALS.filter((e) => e.base !== 'v' && e.base !== 've').map((e) => e.id)
  const out: string[][] = []
  for (const f of finals) {
    out.push([f])
    if (ENDINGS.get(f)!.tensed) out.push(['past', f])
    if (f !== 'seyo' && f !== 'syeoyo') out.push(['hon', f])
  }
  out.push(['hon', 'past', 'haeyo'], ['hon', 'past', 'da'], ['past', 'fut', 'da'], ['fut', 'da'])
  return out
}

function copulaForms(): NonNullable<typeof copulaTable> {
  if (copulaTable) return copulaTable
  const afterC = new Map<string, string[]>()
  const afterV = new Map<string, string[]>()
  const anida = new Map<string, string[]>()
  const dropped = new Set<string>()
  const put = (m: Map<string, string[]>, k: string, chain: string[]): void => {
    if (!m.has(k)) m.set(k, chain)
  }
  for (const chain of COPULA_CHAINS()) {
    for (const f of conjugate('이다', 'cop', chain)) {
      put(afterC, f, chain)
      put(afterV, f, chain) // 의사이다、의사인 也对
      // 元音结尾的体词后面，이 省略或缩约：의사다、의사라서、의사예요、의사였다、의사여서
      const first = decompose(f[0])
      if (first && first.l === 'ㅇ' && first.v === 'ㅣ' && !first.t && f.length > 1) {
        const rest = f.slice(1)
        const n = decompose(rest[0])
        if (n && n.l === 'ㅇ' && (n.v === 'ㅓ' || n.v === 'ㅔ')) {
          // 이 + 어 → 여、이 + 에 → 예、이 + 었 → 였
          put(afterV, withPart(rest[0], { v: n.v === 'ㅓ' ? 'ㅕ' : 'ㅖ' }) + rest.slice(1), chain)
        } else if (!afterV.has(rest)) {
          put(afterV, rest, chain)
          dropped.add(rest)
        }
      }
    }
    for (const f of conjugate('아니다', 'cop', chain)) put(anida, f, chain)
  }
  // 아냐（아니야 的缩约）
  anida.set('아냐', ['hae'])
  copulaTable = { afterC, afterV, dropped, anida }
  return copulaTable
}

// ───────────────────────── 助词 ─────────────────────────

interface Split {
  base: string
  particles: Particle[]
  /** 收音式缩约（난、이걸） */
  coda?: boolean
}

/** 从语节末尾剥助词（最多三层）：학교에서는 → 학교 + [에서, 은/는] */
function splitParticles(word: string): Split[] {
  const out: Split[] = []
  const walk = (base: string, ps: Particle[], depth: number): void => {
    if (depth >= 3) return
    for (const p of PARTICLES) {
      if (!base.endsWith(p.s) || base.length <= p.s.length) continue
      // 只能在最后的助词（은/는、도、요）不能出现在别的助词前面
      if (ps.length && p.final) continue
      const rest = base.slice(0, -p.s.length)
      if (!condOk(p.cond, rest)) continue
      // 나、저、너 的主格是 내가、제가、네가：「나가」不是「나 + 가」
      if (p.s === '가' && (rest === '나' || rest === '저' || rest === '너')) continue
      const next = [p, ...ps]
      out.push({ base: rest, particles: next })
      walk(rest, next, depth + 1)
    }
  }
  walk(word, [], 0)
  // 收音式：난 → 나 + 는、이걸 → 이거 + 를（只认两个音节以内的）
  if (word.length <= 3) {
    const s = decompose(word.slice(-1))
    for (const c of CODA_PARTICLES)
      if (s && s.t === c.t) {
        const base = word.slice(0, -1) + withPart(word.slice(-1), { t: '' })
        out.push({ base, particles: [{ s: '', label: c.label, cond: 'V', rank: 2 }], coda: true })
      }
  }
  return out
}

// ───────────────────────── 补助用言连写 ─────────────────────────

/** 接在 -아/어 后面、常跟前面连写的补助动词（해 주다 → 해주다、먹어 보다 → 먹어보다、만들어지다） */
const AUX_AFTER_A = [
  '주다',
  '드리다',
  '보다',
  '버리다',
  '놓다',
  '두다',
  '내다',
  '가다',
  '오다',
  '있다',
  '지다',
  '대다'
]
/** 接在 -고、-지 后面的（먹고 싶다 → 먹고싶다、먹지 않다 → 먹지않다） */
const AUX_AFTER_GO = ['싶다', '있다', '말다']
const AUX_AFTER_JI = ['않다', '못하다', '말다']

/**
 * 一个「原形」要是「主要动词的 -아/어、-고、-지 形 + 补助用言」连写成的，给出主要动词（해주다 → 하다 + 주다）。
 * 主要动词同样用正向活用核对。
 */
function splitAuxiliary(lemma: string): { main: string; tags: string[] }[] {
  const out: { main: string; tags: string[] }[] = []
  const try_ = (prefix: string, ending: string, aux: string): void => {
    if (!prefix) return
    for (const a of deinflectPredicate(prefix))
      if (a.chain.length === 1 && a.chain[0] === ending)
        out.push({ main: a.lemma, tags: [chainTags(a.chain)[0], aux] })
  }
  for (const aux of AUX_AFTER_A)
    if (lemma.endsWith(aux) && lemma.length > aux.length)
      try_(lemma.slice(0, -aux.length), 'hae', aux)
  for (const aux of AUX_AFTER_GO)
    if (lemma.endsWith('고' + aux)) try_(lemma.slice(0, -aux.length), 'go', aux)
  for (const aux of AUX_AFTER_JI)
    if (lemma.endsWith('지' + aux)) try_(lemma.slice(0, -aux.length), 'ji', aux)
  return out
}

// ───────────────────────── 合起来 ─────────────────────────

/** 一个语节的所有分析（只给全是韩文的；汉字、拉丁字母后面接助词的也剥：學校에、SNS에서） */
function analyzeWord(word: string): Guess[] {
  const out: Guess[] = []
  const add = (lemma: string, tags: string[], score: number): void => {
    if (lemma && lemma !== word) out.push({ lemma, tags, score })
  }
  const hangul = isHangulWord(word)

  // 1. 代词的特殊写法（내가、제가、뭘……）
  const pr = PRONOUN_FORMS[word]
  if (pr) add(pr[0], pr[1], 0)

  // 2. 谓词（먹었어요、예뻐요、하세요……）
  if (hangul) {
    for (const a of deinflectPredicate(word)) {
      add(a.lemma, chainTags(a.chain), a.score)
      // 词典里没有「X하다、X되다、X시키다」时退一步给 X（名词）
      const m = /^(.+?)(하|되|시키)다$/.exec(a.lemma)
      if (m && m[1].length >= 1) add(m[1], [m[2] + '다', ...chainTags(a.chain)], a.score + 1.5)
      // 补助用言连写（해주세요、먹어 봤어요 写成 먹어봤어요、먹고싶어요）：再给前面的主要动词
      for (const s of splitAuxiliary(a.lemma))
        add(s.main, [...s.tags, ...chainTags(a.chain)], a.score + 0.4)
    }
  }

  // 3. 이다、아니다
  const cop = copulaForms()
  const an = cop.anida.get(word)
  if (an) add('아니다', chainTags(an), 0.1)
  const chars = [...word]
  for (let k = 1; k < chars.length; k++) {
    const base = chars.slice(0, k).join('')
    const tail = chars.slice(k).join('')
    const hasCoda = !!decompose(base.slice(-1))?.t
    const chain = (hasCoda ? cop.afterC : cop.afterV).get(tail)
    if (chain)
      add(
        base,
        ['이다', ...chainTags(chain)],
        0.45 +
          (ENDINGS.get(chain.at(-1)!)?.rank ?? 1) * 0.3 +
          (chain.length - 1) * 0.2 +
          (!hasCoda && cop.dropped.has(tail) ? 0.3 : 0)
      )
    // 口语里 이 + ㄴ/ㄹ/ㅁ 缩到前一个音节上：뭔지（뭐인지）、어딘지（어디인지）、누군데（누구인데）
    const s = decompose(base.slice(-1))
    if (s && (s.t === 'ㄴ' || s.t === 'ㄹ' || s.t === 'ㅁ')) {
      const full = (compose('ㅇ', 'ㅣ', s.t) ?? '') + tail
      const c2 = cop.afterC.get(full)
      if (c2)
        add(
          base.slice(0, -1) + withPart(base.slice(-1), { t: '' }),
          ['이다', ...chainTags(c2)],
          0.95 + (ENDINGS.get(c2.at(-1)!)?.rank ?? 1) * 0.3
        )
    }
  }

  // 4. 体词 + 助词（학교에서는）；助词前面也可以是谓词的名词形（먹기를）、이다 的活用不在这里
  for (const sp of splitParticles(word)) {
    const tags = sp.particles.map((p) => p.label)
    const pscore = sp.particles.reduce((s, p) => s + p.rank * 0.4 + 0.1, 0)
    // 以「다」结尾的当体词（가볍다 + 는）多半是谓词的引语形（가볍다는 = -다는），往后排
    const daPen = sp.base.endsWith('다') ? 0.5 : 0
    add(sp.base, tags, (PRONOUNS.has(sp.base) ? 0.05 : 0.3) + pscore + (sp.coda ? 0.4 : 0) + daPen)
    // 代词特殊写法后面再接助词：제가요、내가요
    const pr2 = PRONOUN_FORMS[sp.base]
    if (pr2) add(pr2[0], [...pr2[1], ...tags], 0.2 + pscore)
    // 体词接 이다 再接助词：학생이라서요 → 학생
    for (let k = 1; k < sp.base.length; k++) {
      const base = sp.base.slice(0, k)
      const tail = sp.base.slice(k)
      const hasCoda = !!decompose(base.slice(-1))?.t
      const chain = (hasCoda ? cop.afterC : cop.afterV).get(tail)
      if (chain && ENDINGS.get(chain.at(-1)!)?.takesParticle)
        add(base, ['이다', ...chainTags(chain), ...tags], 0.8 + pscore)
    }
  }
  return out
}

/** 带空格的短语：最后一个语节还原，前面的照写（마음에 들어요 → 마음에 들다、눈이 높아서 → 눈이 높다） */
function analyzePhrase(text: string): Guess[] {
  const m = /^(.*\s)(\S+)$/u.exec(text)
  if (!m) return []
  return analyzeWord(m[2])
    .filter((g) => g.lemma.endsWith('다'))
    .map((g) => ({ ...g, lemma: m[1].replace(/\s+/g, ' ') + g.lemma }))
}

/** 去掉语节两头的标点、引号（「‘한국어’를」切出来的「‘한국어」） */
function trimWord(s: string): string {
  return s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

/**
 * 猜原形：结果按常见程度排，同一原形只留分数最好的一种分析。
 * 标签是助词、词尾的词典式写法（이/가、-았/었-、-아요/어요），이다 写成「이다」。
 */
export function lemmaCandidates(surface: string): LemmaGuess[] {
  const text = surface.normalize('NFC').trim()
  if (!text) return []
  const guesses = /\s/u.test(text) ? analyzePhrase(text) : analyzeWord(trimWord(text))
  guesses.sort((a, b) => a.score - b.score)
  const seen = new Set<string>()
  const out: LemmaGuess[] = []
  for (const g of guesses) {
    // 同一个原形，体词式的分析（接助词）与谓词式的（接词尾）各留一种：查词时按词条的词性挑（见 rules.guessFits）
    const k = g.lemma + '|' + (isPredicateTags(g.tags) ? 'p' : 'n')
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ lemma: g.lemma, tags: g.tags })
  }
  return out
}

/** 黏在体词后面的后缀（标签也带连字符，但不是词尾） */
const NOMINAL_SUFFIX = new Set(['-들', '-쯤', '-씩', '-째'])

/** 这组标签是谓词的（第一个是词尾 -아요/어요……）还是体词的（助词、이다、后缀） */
export function isPredicateTags(tags: string[]): boolean {
  return !!tags[0]?.startsWith('-') && !NOMINAL_SUFFIX.has(tags[0])
}

/** 给测试与数据管线：带分数的分析（同一原形可能有几种） */
export function analyses(surface: string): (LemmaGuess & { score: number })[] {
  return analyzeWord(trimWord(surface.normalize('NFC').trim())).sort((a, b) => a.score - b.score)
}

export type { PredClass }
