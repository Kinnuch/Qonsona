/**
 * N1 语法点（一，跟 src/shared/ja/grammar-n1.ts 对应）挑例句时的额外条件（写法见 rule-kit.ts）：
 * 挡掉同形不同义的用法。
 */
import { textAfter, textBefore, type Rule } from './rule-kit'

/** 〜たところで（即使……也没用）后面常见的否定、「没用」 */
const FUTILE = /ない|ぬ|ません|無駄|むだ|無理|意味|仕方|しかた|しょうがない|同じ|知れて/
/** 〜たところで 前面常见的让步副词 */
const CONCEDE = /いくら|どんなに|どれだけ|どれほど|たとえ|今さら|今更|いまさら/
/** 〜をもって 前面是人（よい息子をもって 是「有」） */
const PEOPLE = new Set([
  '息子',
  '娘',
  '子供',
  '子ども',
  '妻',
  '夫',
  '友人',
  '友達',
  '家族',
  '兄弟',
  '親'
])

export const N1_RULES: Record<string, Rule> = {
  // 即使……也没用：前面有いくら、どんなに，或者后面是否定、「没用」（駅に着いたところで雨が降り出した 是「正好那时」）
  tatokorode: (_b, span, _a, row) =>
    CONCEDE.test(textBefore(row, span)) || FUTILE.test(textAfter(row, span)),
  // 惊讶的〜とは：「〜とは、限らない」是「不一定」，「〜とは、〜ことだ」是下定义
  towa: (_b, span, _a, row) => {
    const after = textAfter(row, span)
    return (
      !/^、?(限ら|かぎら|限りま|かぎりま)/.test(after) &&
      !/ことだ|ことである|ことです|を意味|とは何/.test(after)
    )
  },
  womotte: (before) => !PEOPLE.has(before?.s ?? '')
}
