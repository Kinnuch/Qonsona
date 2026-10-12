/**
 * 韩语的规则：查词的键、切词、猜原形、转写（纯函数；数据管线写 form 表、主进程查词都用这一份）。
 *
 * - 查词键：NFC、小写（夹着的拉丁字母）、空白并成一个；词缀、词尾的连字符留着（-점 不跟名词 점 混）；
 *   一个个敲进来的字母合成音节（屏幕键盘、没有韩文输入法时：ㅎㅏㄴㄱㅜㄱ = 한국）。
 * - 宽松键：再去掉空格（韩语的隔写很乱：한국 사람 / 한국사람）与连字符、汉字转成简体（汉字词的汉字是繁体，
 *   中文用户输入「学校」也要查到 學校 = 학교）。
 * - 切词：按语节（어절）切，助词词尾留在语节里，交给 lemmaCandidates 剥。
 * - 转写：国语罗马字（按发音，不标紧音）；反过来，查词框里打的罗马字转成韩文（fromLatin）。
 */
import { tidy } from '../text'
import type { LangRules, LemmaGuess, PosTag, RawToken } from '../types'
import { composeHangul } from './hangul'
import { isPredicateTags, lemmaCandidates } from './lemma'
import { fromLatin } from './latin'
import { romanize } from './pronounce'
import { toSimplified } from './t2s'

/** 查词键 */
export function key(text: string): string {
  return composeHangul(tidy(text).toLocaleLowerCase('ko').replace(/\s+/g, ' ').trim())
}

/** 宽松键：去掉空格、连字符、^，汉字转简体 */
export function looseKey(text: string): string {
  return toSimplified(key(text).replace(/[\s\-‐–^·]+/g, ''))
}

const isWordChar = (c: string): boolean => /[\p{L}\p{M}]/u.test(c)
const isDigit = (c: string): boolean => /\p{Nd}/u.test(c)
const isLatin = (c: string | undefined): boolean => !!c && /[A-Za-z]/.test(c)

/**
 * 切词：连着写的字母（韩文、汉字、拉丁字母）是一个语节；数字单独成段（10월 → 10 + 월，月份、量词好查），
 * 数字里的逗号、小数点算在数字里；拉丁字母之间的撇号、连字符算在词里（K-pop）。
 * 按码点走，扩展区的汉字不会拆坏。
 */
export function tokenize(text: string): RawToken[] {
  const cps = [...text]
  const out: RawToken[] = []
  let i = 0
  let pos = 0
  const take = (from: number, to: number, kind: RawToken['kind']): void => {
    const s = cps.slice(from, to).join('')
    out.push({ text: s, start: pos, end: pos + s.length, kind })
    pos += s.length
  }
  while (i < cps.length) {
    const start = i
    const ch = cps[i]
    if (/\s/u.test(ch)) {
      while (i < cps.length && /\s/u.test(cps[i])) i++
      take(start, i, 'space')
    } else if (isDigit(ch)) {
      while (
        i < cps.length &&
        (isDigit(cps[i]) || (/[.,]/.test(cps[i]) && isDigit(cps[i + 1] ?? '')))
      )
        i++
      take(start, i, 'num')
    } else if (isWordChar(ch)) {
      while (i < cps.length) {
        const c = cps[i]
        if (isWordChar(c)) i++
        else if (/['’-]/.test(c) && isLatin(cps[i - 1]) && isLatin(cps[i + 1])) i++
        else break
      }
      take(start, i, 'word')
    } else {
      // 标点：连着的同一种合成一段（……、!!）
      i++
      while (i < cps.length && cps[i] === ch) i++
      take(start, i, 'punct')
    }
  }
  return out
}

const NOMINAL = new Set<string>(['noun', 'pron', 'num', 'propn', 'adv', 'det', 'other'])
const PREDICATE = new Set<string>(['verb', 'adj', 'aux'])
const MULTIWORD = new Set<string>(['idiom', 'phrase', 'proverb'])
/** 猜出的原形只认这几种行：原形本身、汉字写法、另一种写法（不认别的词条的变形） */
const HEAD_ROWS = new Set(['lemma', 'hanja', 'alternative'])

/**
 * 猜出来的原形去对 form 表时，这一行要不要（框架的 rules.guessFits 钩子）：
 * 只认原形行（不然「안에」猜出「안」，会对上 알다 的变形「안」）；再按词性筛：
 * 标签是助词（은/는、에）的只配体词，是词尾（-았/었-、-는）的只配谓词，带「이다」的是体词；惯用语、短语都行。
 */
export function guessFits(guess: LemmaGuess, row: { tags: string[]; pos: PosTag }): boolean {
  if (!row.tags.some((t) => HEAD_ROWS.has(t))) return false
  if (!guess.tags.length || MULTIWORD.has(row.pos)) return true
  if (isPredicateTags(guess.tags)) return PREDICATE.has(row.pos)
  return NOMINAL.has(row.pos)
}

// 框架的 LangRules 加上 guessFits 之前先这样挂上（对象字面量直接标类型会报多出来的字段）
const koRules = {
  key,
  looseKey,
  tokenize,
  lemmaCandidates,
  romanize: (text: string) => romanize(text),
  fromLatin,
  guessFits
}
export const rules: LangRules = koRules
