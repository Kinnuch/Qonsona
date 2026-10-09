/**
 * N3 语法点（一，跟 src/shared/ja/grammar-n3.ts 对应）挑例句时的额外条件（写法见 rule-kit.ts）：
 * 挡掉同形不同义的用法。
 */
import { textBefore, type Rule, type RuleRow, type Tok } from './rule-kit'

/** 句子以「この〜は」「それは」这类开头：〜ものだ、〜ものではない 多半是在说某样东西（这本书是……的东西） */
const ABOUT_THING = /^(この|その|あの|これ|それ|あれ|どの)/

/** 「谁家」的うち：前面是人（友達のうちに泊まる） */
const PERSON_NO =
  /(あなた|私|わたし|僕|ぼく|俺|彼|彼女|君|友達|友人|さん|ちゃん|くん|先生|祖母|祖父|おばあちゃん|おじいちゃん|叔母|伯母|叔父|伯父|両親|親戚|兄|姉|弟|妹|母|父)の$/
/** 「拍手のうちに幕が下りた」这类「在……之中」 */
const AMID_NO = /(拍手|沈黙|混乱|失意|盛況|成功|喝采|好評|歓声|無言|暗黙|不安|緊張|笑い)の$/

/** 过去常常的〜たものだ：前面多半有「よく」「昔」「子供のころ」这类词 */
const HABIT =
  /(よく|昔|頃|ころ|当時|時々|ときどき|しばしば|以前|毎日|毎晩|毎朝|毎週|いつも|子供|子ども|若い|学生)/

/** 语法点前面有没有「〜は」（係助詞的は） */
const hasTopic = (row: RuleRow, span: Tok[]): boolean =>
  row.tokens.some((t) => t.end <= span[0].start && t.s === 'は' && t.p1 === '係助詞')

export const N3_RULES: Record<string, Rule> = {
  // 忠告：前面没有「〜は」（私の夢は医者になることです、大事なのは続けることだ 是说明；
  // 〜って言うのはね 会切成 の/はね，再看一遍原文）
  kotoda: (_b, span, _a, row) => !hasTopic(row, span) && !/(のは|とは)/.test(textBefore(row, span)),
  // 本来、感慨、过去常常：不是在说「这东西是……的」；〜たものだ 前面得有「よく」「昔」这类词
  monoda: (before, span, _a, row) => {
    const pre = textBefore(row, span)
    if (ABOUT_THING.test(pre)) return false
    return before?.ct !== '特殊・タ' || HABIT.test(pre)
  },
  // 不应该：〜できるものではない（不可能……）、この決定は……ものではない（不是……的东西）不算
  monodewanai: (before, span, _a, row) => {
    const pre = textBefore(row, span)
    return (
      !ABOUT_THING.test(pre) &&
      !pre.includes('というのは') &&
      !['できる', '意味する'].includes(before?.b ?? '')
    )
  },
  // 辩解：〜なものだから（这东西是……的，所以）多半是在说东西
  mondakara: (before) => before?.s !== 'な',
  // 不必：跟決して、二度と、何も 一起用的是「不会……」；〜ことはないでしょう、〜ことはなかった、
  // 〜ことない？ 是推测、叙述、问话
  kotowanai: (_b, span, after, row) =>
    !/(決して|二度と|もはや|何も|誰も|一度も|いくら)/.test(textBefore(row, span)) &&
    span[span.length - 1].ct !== '特殊・タ' &&
    !['でしょ', 'だろ', 'まい', '？', '?', 'か'].includes(after[0]?.s ?? ''),
  // 趁、期间：近いうちに（不久）、見る見るうちに（眼看着）是固定说法；Nのうちに 的「家」「在……之中」不算
  uchini: (_b, span, _a, row) => {
    const pre = textBefore(row, span)
    return !/(近い|見る見る|みるみる)$/.test(pre) && !PERSON_NO.test(pre) && !AMID_NO.test(pre)
  },
  // 正要、正在、刚刚：〜といったところだ（大概是……）、そこが……ところだ（地方、地步）不算
  tokoro: (before, span, _a, row) => {
    const pre = textBefore(row, span)
    return (
      !/と(言|い)(う|った)$/.test(pre) && !/^(ここ|そこ|あそこ)/.test(pre) && !/(所|場所)/.test(pre)
    )
  },
  // 程度：せいぜい〜くらいだ（顶多……而已）是「只不过」
  kurai: (_b, span, _a, row) => !textBefore(row, span).includes('せいぜい'),
  // 〜からって（就因为……）是「からといって」
  tte: (before) => before?.s !== 'から',
  // 前面得是「の」或谓语：句首的「おかげで」、そのおかげで 不算
  okagede: (before) => !!before && before.pos !== '連体詞' && before.pos !== '記号',
  // 気のせい（心理作用）是固定说法
  seide: (_b, span, _a, row) => !textBefore(row, span).endsWith('気の'),
  // 恥ずべき、驚くべき、〜たるべき 这些是固定的形容说法
  bekida: (before) => !['恥ず', 'たる', '驚く', '恐る', '愛す', '憎む'].includes(before?.s ?? ''),
  // 不仅……而且：后面得有「も」
  wamochiron: (_b, _s, after) => after.some((t) => t.s === 'も' && t.pos === '助詞')
}
