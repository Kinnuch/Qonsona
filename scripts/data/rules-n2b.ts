/**
 * N2 语法点（二，跟 src/shared/ja/grammar-n2b.ts 对应）挑例句时的额外条件（写法见 rule-kit.ts）：
 * 挡掉同形不同义的用法。
 */
import { textBefore, type Rule } from './rule-kit'

/** 恐怖袭击、开枪、死人这类内容不当课文例句（必死に 不算） */
const GRIM = /テロ|発砲|銃|爆弾|処刑|殺|(?<!必)死|命を奪/
const calm: Rule = (_b, _s, _a, row) => !GRIM.test(row.ja)

export const N2B_RULES: Record<string, Rule> = {
  // ツーと言えばカー（心领神会）是成语
  toieba: (_b, _s, _a, row) => !row.ja.includes('ツーと言えば'),
  // できる限り、可能な限り（尽可能）是固定说法；〜限りの + N（所有能……的）不算
  kagiri: (_b, span, after, row) =>
    !/(できる|出来る|可能な)$/.test(textBefore(row, span)) && after[0]?.s !== 'の',
  // スープに塩を加えて（往……里加）是实指：同一个分句里前面有「を」的不算
  nikuwaete: (_b, span, _a, row) => !/を[^、。]*$/.test(textBefore(row, span)),
  // 「金持ちにかかわらず彼女は幸せでない」是把にもかかわらず 错写成了にかかわらず
  nikakawarazu: (_b, _s, _a, row) => row.id !== 179669,
  // 可愛げ（可爱之处）是一个词
  ge: (before) => before?.s !== '可愛',
  nimukete: calm,
  nioite: calm,
  niwatatte: calm,
  totomoni: calm,
  tsutsu: calm
}
