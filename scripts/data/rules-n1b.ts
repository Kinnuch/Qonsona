/**
 * N1 语法点（二，跟 src/shared/ja/grammar-n1b.ts 对应）挑例句时的额外条件（写法见 rule-kit.ts）：
 * 挡掉同形不同义的用法。
 */
import type { Rule, Tok } from './rule-kit'

/** 后面有否定（ない、ません、ぬ） */
const negativeAfter = (after: Tok[]): boolean =>
  after.some((t) => t.b === 'ない' || t.b === 'ぬ' || (t.s === 'ん' && t.pos === '助動詞'))

export const N1B_RULES: Record<string, Rule> = {
  // 为了：しかるべく（妥善地）是成语，不算
  beku: (before) => before?.s !== 'しかる',
  // 除了……之外（没有）：后面得有否定（荷物をおいてほかの部屋へ行った 是「放下」）
  wooite: (_b, _s, after) => negativeAfter(after),
  // 与……相应：道なりに（顺着路走）不算
  narini: (before) => before?.s !== '道'
}
