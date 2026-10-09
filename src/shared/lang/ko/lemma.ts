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
import { decompose, isHangulWord, withPart } from './hangul'
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
        } else put(afterV, rest, chain)
      }
    }
    for (const f of conjugate('아니다', 'cop', chain)) put(anida, f, chain)
  }
  // 아냐（아니야 的缩约）
  anida.set('아냐', ['hae'])
  copulaTable = { afterC, afterV, anida }
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
        0.45 + (ENDINGS.get(chain.at(-1)!)?.rank ?? 1) * 0.3 + (chain.length - 1) * 0.2
      )
  }

  // 4. 体词 + 助词（학교에서는）；助词前面也可以是谓词的名词形（먹기를）、이다 的活用不在这里
  for (const sp of splitParticles(word)) {
    const tags = sp.particles.map((p) => p.label)
    const pscore = sp.particles.reduce((s, p) => s + p.rank * 0.4 + 0.1, 0)
    add(sp.base, tags, (PRONOUNS.has(sp.base) ? 0.05 : 0.3) + pscore + (sp.coda ? 0.4 : 0))
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
    if (seen.has(g.lemma)) continue
    seen.add(g.lemma)
    out.push({ lemma: g.lemma, tags: g.tags })
  }
  return out
}

/** 给测试与数据管线：带分数的分析（同一原形可能有几种） */
export function analyses(surface: string): (LemmaGuess & { score: number })[] {
  return analyzeWord(trimWord(surface.normalize('NFC').trim())).sort((a, b) => a.score - b.score)
}

export type { PredClass }
