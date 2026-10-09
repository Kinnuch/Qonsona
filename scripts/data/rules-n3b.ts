/**
 * N3 语法点（二，跟 src/shared/ja/grammar-n3b.ts 对应）挑例句时的额外条件（写法见 rule-kit.ts）：
 * 挡掉同形不同义的用法。
 */
import { textBefore, type Rule, type RuleRow } from './rule-kit'

/** UNSUITABLE 以外也不想放进课里的：歧视、骂人的词，刀枪，性病 */
const RUDE = /ホモ|毛唐|野郎|ナイフ|銃|弾丸|性行為|梅毒/
const clean = (row: RuleRow): boolean => !RUDE.test(row.ja)

/** 全是片假名（パシフィック通り 这类街名的前一半） */
const KATAKANA = /^[ァ-ヶー・]+$/

/**
 * 语法点那一段得是补助动词、接尾词本身：kuromoji 当成一个词的（忘れっぽい、話し合う、読みかける、
 * 開けっぱなし、待たされる）填空会把前面的词干一起挖掉，不当例句
 */
const partOnly =
  (p1: string): Rule =>
  (_b, span) =>
    span[0].p1 === p1

/** 平假名的「〜だす」前面是这些的是「向外」（探しだす、思いだす），不是「……起来」 */
const OUTWARD = new Set('探す さがす 思う おもう 張る はる 流す ながす 取る とる'.split(' '))

/** 「彼に飲ませてください」是让别人做，不是「请让我」 */
const OTHER_PERSON_NI = /(彼|彼女|あの人|子供|子ども|息子|娘|みんな|皆|生徒|学生)に/

export const N3B_RULES: Record<string, Rule> = {
  // 代わりにはならない、代わりにもなる（能顶替）不算
  kawarini: (_b, _s, after) =>
    !(['は', 'も'].includes(after[0]?.s ?? '') && after[1]?.b === 'なる'),
  // 街名（パシフィック通り）、幾通り（いくとおり：几种）不算
  toori: (before, span) =>
    !(span[0].p1 === '接尾' && KATAKANA.test(before?.s ?? '')) && before?.s !== 'いく',
  wotooshite: (_b, _s, _a, row) => clean(row),
  wokomete: (_b, _s, _a, row) => clean(row),
  toshitara: (_b, _s, _a, row) => clean(row),
  kuseni: (_b, _s, _a, row) => clean(row),
  ppoi: partOnly('接尾'),
  ppanashi: partOnly('接尾'),
  kake: partOnly('非自立'),
  causativepassive: partOnly('接尾'),
  kiru: partOnly('非自立'),
  au: (_b, span, _a, row) => span[0].p1 === '非自立' && clean(row),
  dasu: (before, span) => span[0].p1 === '非自立' && !OUTWARD.has(before?.b ?? ''),
  sasetemorau: (_b, span, _a, row) => clean(row) && !OTHER_PERSON_NI.test(textBefore(row, span))
}
