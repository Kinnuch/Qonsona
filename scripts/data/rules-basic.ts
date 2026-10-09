/**
 * N5、N4 语法点挑例句时的额外条件（写法见 rule-kit.ts）：挡掉同形不同义的用法。
 */
import { isVerbish, textBefore, type Rule } from './rule-kit'

/**
 * 请求、授受的敬语（くださいませんか、いただけませんか）、义务的疑问（なければなりませんか）不算邀请；
 * kuromoji 会把 いただけ 切成 い/た/だけ，所以看原文
 */
const NOT_INVITING = /(ください|下さい|いただけ|頂け|なければなり|てはなり)$/
export const BASIC_RULES: Record<string, Rule> = {
  // 表原因的から、表转折的が 前面得是谓语（名词后的から是「从」，が是主格）
  kara: (before) => isVerbish(before),
  ga: (before) => isVerbish(before),
  // 〜たり 后面得有する（ありきたり 这类词里的たり不算）
  tari: (_b, _s, after) => after.some((t) => t.b === 'する'),
  // 一边……一边：前面得是自立的动词（遺憾ながら 不算），知りながら、ありながら 是「虽然」
  nagara: (before) =>
    before?.pos === '動詞' && before.p1 === '自立' && !['知る', 'ある'].includes(before.b),
  // 不如：后面得有否定（ほど〜ない），比较的对象不能是数量（三日ほど 是「大约」）
  hodonai: (before) => !!before && before.p1 !== '数' && before.p1 !== '接尾',
  dake: (_b, _s, _a, row) => !row.ja.includes('いただけ'),
  // 动词的否定：前面得是动词或助动词（手はない 的ない是形容词）；ようじゃないか 不算
  nai: (before, _s, _a, row) => isVerbish(before) && !/じゃないか|ではないか/.test(row.ja),
  masu: (_b, span, _a, row) => !NOT_INVITING.test(textBefore(row, span)),
  masenka: (_b, span, _a, row) => !NOT_INVITING.test(textBefore(row, span)),
  // 好像：只要句末的ようだ / ようです（どのような、〜ような本 不算）
  youda: (before, span) => before?.pos !== '連体詞' && span[span.length - 1].cf !== '体言接続',
  // みたい 后面得是だ、です、に、な、ね 或句末（ひと目みたいもの 是「想看」）
  mitai: (_b, _s, after) => !after.length || /^(だ|です|に|な|ね|よ|。|！|？)$/.test(after[0].s),
  // 听说、好像：前面得是谓语（紳士らしい、嫌らしい 不算）
  rashii: (before) => isVerbish(before),
  // 即使：后面不能是いい、大丈夫这些（那是「可以……」）
  temo: (_b, _s, after) =>
    !after.length ||
    (!/^(いい|よい|良い|よろしい|大丈夫|かまわ|構わ)/.test(after[0].s) && after[0].b !== 'みる'),
  // 明明……却：后面跟读点（買うのに十分な 是「用来」）
  noni: (_b, _s, after) => after[0]?.s === '、',
  // 尽量：前面得是动词或ない（このようにして 不算）
  younisuru: (before) => isVerbish(before),
  kotogadekiru: (before) => isVerbish(before),
  // 定下来要：前面是动词原形或ない（大変なことになる、困ったことになる 不算）
  kotoninaru: (before) =>
    (before?.pos === '動詞' && before.cf === '基本形') || before?.b === 'ない',
  // 保持状态：前面是た或ない（思いのまま、ほしいまま 这类成语不算）
  mama: (before) => before?.b === 'た' || before?.b === 'ない',
  // 光、净：前面是て形，或者后面有动词（５０００円ばかり 是「大约」）
  bakari: (before, _s, after) =>
    before?.p1 === '接続助詞' ||
    (before?.pos === '名詞' &&
      !['数', '接尾'].includes(before.p1) &&
      after.some((t) => t.pos === '動詞')),
  // 作为：前面得是一般名词，后面不是いる、する（〜ようとして、雑然としている 不算）
  toshite: (before, _s, after) =>
    before?.pos === '名詞' &&
    before.p1 !== '形容動詞語幹' &&
    !['いる', 'する'].includes(after[0]?.b ?? '')
}
