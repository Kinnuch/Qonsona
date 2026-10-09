/**
 * N2 语法点（一，跟 src/shared/ja/grammar-n2.ts 对应）挑例句时的额外条件（写法见 rule-kit.ts）：
 * 挡掉同形不同义的用法。
 */
import { textBefore, type Rule } from './rule-kit'

export const N2_RULES: Record<string, Rule> = {
  // あふれるばかりに、輝くばかりに（几乎要……）不算：前面是动词原形的只认 〜ている、〜である
  bakarini: (before) => before?.pos !== '動詞' || ['いる', 'ある'].includes(before.b),
  // 后面跟读点的才当例句（素早いもののたとえ 这类 もの + の 不算）
  monono: (_b, _s, after) => after[0]?.s === '、',
  // やめろと言っても（就算说……也）这类实指的「说」不算
  toittemo: (before) => !before?.cf.startsWith('命令'),
  // 〜ことから始める（从……开始）：后面隔几个词才是 始める 的也不算
  kotokara: (_b, _s, after) => !after.some((t) => ['始める', 'はじめる'].includes(t.b)),
  // 实指的「其中有的……」：〜の中には…ものがある 不算
  monogaaru: (_b, span, _a, row) => !/中に/.test(textBefore(row, span)),
  // 如果能……：前面得是可能的说法（できる、戻れる、〜られる）或〜よう（ある価値があるものなら 不算）
  mononara: (before) =>
    !!before &&
    (before.pos === '助動詞' ||
      before.p1 === '接尾' ||
      before.b === 'できる' ||
      /[えけげせてねべめれ]る$/.test(before.s)),
  // 「天ぷら」というもの、いわゆる…というもの（叫做……的东西）、考えは…というものだ（内容是……）不算
  toiumonoda: (before, span, _a, row) =>
    before?.s !== '」' &&
    !row.ja.includes('いわゆる') &&
    !/(考え|計画|案|内容|趣旨|主張|提案|意見|話)は/.test(textBefore(row, span)),
  // 〜ようと〜まいと、〜ようが〜まいが（不管……不……）不算
  mai: (_b, span, after, row) =>
    !(['と', 'が'].includes(after[0]?.s ?? '') && /う[とが]/.test(textBefore(row, span)))
}
