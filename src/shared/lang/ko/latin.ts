/**
 * 查词框里打的罗马字转成韩文（rules.fromLatin）：没装韩文输入法的初学者打 annyeonghaseyo、hangugeo、
 * gamsahamnida 也能查到 안녕하세요、한국어、감사합니다。
 *
 * 国语罗马字是按发音写的，倒回去有几种可能，这里都给（常见的在前，最多 12 个），由查词的一方挑查得到的：
 * - 连音：hangugeo 可以是 한구거，也可以是 한국어（g 是前一个音节的收音，后一个音节以 ㅇ 开头）；
 * - 鼻音化、流音化：hamnida 也可以是 합니다，hangungmal 也可以是 한국말，silla 也可以是 신라；
 * - 旧式（马科恩—赖肖尔式）与随手的拼法：k、t、p、ch 在词首也当 ㄱ、ㄷ、ㅂ、ㅈ（kimchi 김치）。
 */
import { compose } from './hangul'

interface Piece {
  /** 罗马字 */
  r: string
  /** 字母 */
  j: string
  /** 不常见的读法多算一点 */
  cost: number
}

const p = (r: string, j: string, cost = 0): Piece => ({ r, j, cost })

const ONSETS: Piece[] = [
  p('kk', 'ㄲ'),
  p('tt', 'ㄸ'),
  p('pp', 'ㅃ'),
  p('ss', 'ㅆ'),
  p('jj', 'ㅉ'),
  p('ch', 'ㅊ'),
  p('ch', 'ㅈ', 1.5),
  p('g', 'ㄱ'),
  p('k', 'ㅋ'),
  p('k', 'ㄱ', 1),
  p('n', 'ㄴ'),
  p('d', 'ㄷ'),
  p('t', 'ㅌ'),
  p('t', 'ㄷ', 1),
  p('r', 'ㄹ'),
  p('l', 'ㄹ', 0.5),
  p('m', 'ㅁ'),
  p('b', 'ㅂ'),
  p('p', 'ㅍ'),
  p('p', 'ㅂ', 1),
  p('s', 'ㅅ'),
  p('s', 'ㅆ', 1.5),
  p('j', 'ㅈ'),
  p('h', 'ㅎ'),
  p('', 'ㅇ')
]

const VOWELS: Piece[] = [
  p('yae', 'ㅒ'),
  p('yeo', 'ㅕ'),
  p('wae', 'ㅙ'),
  p('eo', 'ㅓ'),
  p('eu', 'ㅡ'),
  p('ae', 'ㅐ'),
  p('ya', 'ㅑ'),
  p('yo', 'ㅛ'),
  p('yu', 'ㅠ'),
  p('ye', 'ㅖ'),
  p('wa', 'ㅘ'),
  p('wo', 'ㅝ'),
  p('we', 'ㅞ'),
  p('wi', 'ㅟ'),
  p('ui', 'ㅢ'),
  p('oe', 'ㅚ'),
  p('oo', 'ㅜ', 1),
  p('a', 'ㅏ'),
  p('e', 'ㅔ'),
  p('e', 'ㅐ', 1),
  p('i', 'ㅣ'),
  p('o', 'ㅗ'),
  p('o', 'ㅓ', 1.5),
  p('u', 'ㅜ'),
  p('u', 'ㅡ', 1.5)
]

/** 收音（后面是辅音或词尾时） */
const CODAS: Piece[] = [
  p('ng', 'ㅇ'),
  p('k', 'ㄱ'),
  p('g', 'ㄱ', 1),
  p('n', 'ㄴ'),
  p('t', 'ㄷ', 0.5),
  p('t', 'ㅅ', 0.5),
  p('l', 'ㄹ'),
  p('m', 'ㅁ'),
  p('p', 'ㅂ'),
  p('b', 'ㅂ', 1)
]

/** 收音连到下一个音节（hangugeo → 한국어）：下一个音节以元音开头，前面这个辅音其实是收音 */
const LIAISON: Piece[] = [
  p('g', 'ㄱ'),
  p('k', 'ㄲ', 1),
  p('n', 'ㄴ'),
  p('d', 'ㄷ', 0.5),
  p('j', 'ㅈ', 0.5),
  p('s', 'ㅅ', 0.5),
  p('ss', 'ㅆ', 0.5),
  p('ch', 'ㅊ', 0.5),
  p('t', 'ㅌ', 0.5),
  p('r', 'ㄹ'),
  p('m', 'ㅁ'),
  p('b', 'ㅂ'),
  p('p', 'ㅍ', 0.5),
  p('h', 'ㅎ', 1),
  // 双收音里的 ㅎ 不发音：괜찮아요 gwaenchanayo、싫어 sireo
  p('n', 'ㄶ', 0.6),
  p('r', 'ㅀ', 0.6)
]

/** 在 ㄴ、ㅁ 前面读成鼻音的收音（합니다 hamnida、한국말 hangungmal、받는 banneun） */
const NASALIZED: Piece[] = [p('m', 'ㅂ', 0.5), p('ng', 'ㄱ', 0.5), p('n', 'ㄷ', 1), p('n', 'ㅅ', 1)]

interface Partial {
  i: number
  out: string
  cost: number
}

const MAX_OUT = 12
const BEAM = 40

/** 一个词（只有拉丁字母）转成韩文的几种可能 */
function convertWord(w: string): { text: string; cost: number }[] {
  const done: { text: string; cost: number }[] = []
  let beam: Partial[] = [{ i: 0, out: '', cost: 0 }]
  const isV = (at: number): boolean => VOWELS.some((v) => w.startsWith(v.r, at))
  for (let guard = 0; guard < 40 && beam.length; guard++) {
    const next: Partial[] = []
    for (const st of beam) {
      if (st.i >= w.length) {
        done.push({ text: st.out, cost: st.cost })
        continue
      }
      for (const on of ONSETS) {
        if (!w.startsWith(on.r, st.i)) continue
        const a = st.i + on.r.length
        // 词中以元音开头的音节（ㅇ）：前一个音节要么有收音、要么本来就开音节
        for (const v of VOWELS) {
          if (!w.startsWith(v.r, a)) continue
          const b = a + v.r.length
          const base = st.cost + on.cost + v.cost + (on.j === 'ㅇ' && st.i > 0 ? 0.3 : 0)
          // 没有收音
          const open = compose(on.j, v.j)
          if (open) next.push({ i: b, out: st.out + open, cost: base })
          // 有收音：后面是辅音或词尾
          for (const c of [...CODAS, ...NASALIZED]) {
            if (!w.startsWith(c.r, b)) continue
            const e = b + c.r.length
            const after = w.slice(e)
            if (after && isV(e)) continue // 后面是元音的走连音那一路
            if (NASALIZED.includes(c) && !/^[nm]/.test(after)) continue
            const syl = compose(on.j, v.j, c.j)
            if (syl) next.push({ i: e, out: st.out + syl, cost: base + c.cost + 0.1 })
          }
          // 连音：收音的辅音后面紧跟元音，下一个音节从元音（ㅇ）开始
          for (const c of LIAISON) {
            if (!w.startsWith(c.r, b)) continue
            const e = b + c.r.length
            if (!isV(e)) continue
            const syl = compose(on.j, v.j, c.j)
            if (syl) next.push({ i: e, out: st.out + syl, cost: base + c.cost + 0.4 })
          }
          // 收音 ㅎ 在元音前不发音：좋아요 joayo、놓아 noa
          if (isV(b)) {
            const syl = compose(on.j, v.j, 'ㅎ')
            if (syl) next.push({ i: b, out: st.out + syl, cost: base + 1.2 })
          }
          // 流音化：ll 可以是 ㄴㄹ（silla 신라）
          if (w.startsWith('ll', b)) {
            const syl = compose(on.j, v.j, 'ㄴ')
            if (syl) next.push({ i: b + 1, out: st.out + syl, cost: base + 0.8 })
          }
        }
      }
    }
    next.sort((x, y) => x.cost - y.cost)
    beam = []
    const seen = new Set<string>()
    for (const st of next) {
      const k = st.i + '|' + st.out
      if (seen.has(k)) continue
      seen.add(k)
      beam.push(st)
      if (beam.length >= BEAM) break
    }
  }
  return done.sort((a, b) => a.cost - b.cost)
}

/**
 * 罗马字 → 韩文：几种可能，常见的在前。不是拉丁字母的、转不出来的给空数组。
 * 词之间的空格、连字符照留（第一个词的几种 × 后面每个词最好的一种）。
 */
export function fromLatin(text: string): string[] {
  const t = text.trim().toLowerCase()
  if (!/^[a-z][a-z\s'-]*$/.test(t)) return []
  const words = t.split(/(\s+|-)/)
  const parts = words.map((w) =>
    /^\s+$|^-$/.test(w)
      ? [{ text: w === '-' ? '' : ' ', cost: 0 }]
      : convertWord(w.replace(/'/g, ''))
  )
  if (parts.some((x) => !x.length)) return []
  // 只有一个词：给几种；几个词：每种组合按总代价排
  let combos: { text: string; cost: number }[] = [{ text: '', cost: 0 }]
  for (const opts of parts) {
    const next: { text: string; cost: number }[] = []
    for (const c of combos)
      for (const o of opts.slice(0, 6)) next.push({ text: c.text + o.text, cost: c.cost + o.cost })
    combos = next.sort((a, b) => a.cost - b.cost).slice(0, 30)
  }
  const out: string[] = []
  for (const c of combos) if (!out.includes(c.text)) out.push(c.text)
  return out.slice(0, MAX_OUT)
}
