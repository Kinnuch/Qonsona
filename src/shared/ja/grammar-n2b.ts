/**
 * JLPT N2 的语法（二）：话题与立场、条件、不仅与不论、依据与场合、随着、紧接着、样子。
 * 语法点（阅读器的「本文语法」、语法课、练习都用）、语法课的接续与例句翻译、分课都写在这里；
 * 写法见 grammar-def.ts，N2 的两个文件在 grammar-levels.ts 里并成一级（课按编号交错排）。
 * 说明、例句都是自己写的；每一条的例句（自带的与 more 里另写的）都得认得出来（tests/ja-grammar.test.ts）。
 */
import {
  P,
  TE,
  type GrammarNote,
  type GrammarPoint,
  type LessonSpec,
  type LevelGrammar,
  type TokenSpec
} from './grammar-def'

/** 只看不算的词素 */
const ctx = (t: TokenSpec): TokenSpec => ({ ...t, ctx: true })
/** 只看不算、并且那个位置不能是这样的词素 */
const not = (t: TokenSpec): TokenSpec => ({ ...t, ctx: true, not: true })

/** 格助词に */
const NI: TokenSpec = { s: 'に', pos: '助詞', p1: '格助詞' }
const WO: TokenSpec = { s: 'を', pos: '助詞' }
const TO: TokenSpec = { s: 'と', pos: '助詞' }
const BA: TokenSpec = { s: 'ば', pos: '助詞', p1: '接続助詞' }
/** 接续助词と（条件） */
const TO_IF: TokenSpec = { s: 'と', pos: '助詞', p1: '接続助詞' }
/** 过去的た（だ） */
const PAST: TokenSpec = { pos: '助動詞', ct: '特殊・タ', cf: '基本形' }
const COMMA: TokenSpec = { s: '、' }
/** 后面接名词（〜に応じた + N 这类） */
const NOUN_NEXT = ctx({ pos: '名詞' })
/** 前面是一般的名词（不含形容动词词干、の こと这类非自立名词） */
const NOUN_BEFORE = ctx({
  pos: '名詞',
  p1: ['一般', '固有名詞', '代名詞', 'サ変接続', '副詞可能', '接尾', '数']
})
/**
 * 〜にしたら 前面的人、团体（コーヒーにしたら？是「选定」，明日にすれば 是「改到」，
 * 干しっぱなしにしたら 是「弄成」，都不算）
 */
const PERSON_BEFORE: TokenSpec[] = [
  ctx({ pos: '名詞', p1: ['代名詞', '固有名詞'] }),
  // 田中さん、私たち、会社側、消費者、日本人
  ctx({
    pos: '名詞',
    p1: '接尾',
    s: 'さん さま 様 たち 達 ら 側 者 人 方 君 くん ちゃん 家'.split(' ')
  }),
  ctx({
    pos: '名詞',
    s: (
      '人 親 両親 子 子供 子ども 母 父 母親 父親 妻 夫 家族 先生 学生 生徒 客 お客 相手 本人 ' +
      '会社 店 社員 社長 上司 部下 住民 国民 市民 選手 友達 友人 大人 若者 老人 女性 男性 ' +
      '医者 患者 店員 犬 猫'
    ).split(' ')
  })
]
const SHITARA: TokenSpec[][] = [
  [NI, { b: 'する', s: 'し' }, { s: 'たら' }, ctx(COMMA)],
  [NI, { b: 'する', s: 'すれ' }, BA, ctx(COMMA)],
  [NI, { b: 'する', s: 'し' }, TE, { b: 'みる', s: 'みれ' }, BA],
  [NI, { b: 'する', s: 'し' }, TE, { b: 'みる', s: 'み' }, { s: 'たら' }]
]

/** 〜からすると 的から */
const KARA: TokenSpec = { s: 'から', pos: '助詞', p1: '格助詞' }
/** から 前面的名词：时间词（明日からすれば 是「从明天开始做」）不算，結果 除外 */
const KARA_BEFORE: TokenSpec[] = [
  ctx({
    pos: '名詞',
    p1: ['一般', '固有名詞', '代名詞', 'サ変接続', '形容動詞語幹', '接尾', '非自立', '数']
  }),
  ctx({ s: '結果' })
]
const SURUTO: TokenSpec[][] = [
  [KARA, { b: 'する', s: 'する' }, TO_IF],
  [KARA, { b: 'する', s: 'すれ' }, BA],
  [KARA, { b: 'する', s: 'し' }, { s: 'たら' }]
]
const IU: TokenSpec = { b: ['いう', '言う'] }
/** 〜と言えばいい、何と言ったらいいか、〜といったらない 不算 */
const II_NAI = not({ b: ['いい', '良い', 'よい', 'ない'] })
const KAGIRI: TokenSpec = { s: ['限り', 'かぎり'], pos: '名詞' }
/** 限り 前面：动词，ない、な（だ）、た、ぬ（力の限り、今回限り 不算） */
const KAGIRI_BEFORE: TokenSpec[] = [
  ctx({ pos: '動詞' }),
  ctx({ pos: ['助動詞', '形容詞'], b: ['ない', 'だ', 'た', 'ぬ'] })
]
const KAGIRI_TAIL: TokenSpec[][] = [
  [KAGIRI, { s: 'は', pos: '助詞' }],
  [KAGIRI, { s: 'で' }, { s: 'は', pos: '助詞' }],
  [KAGIRI]
]
const GE: TokenSpec = { s: 'げ', pos: '名詞', p1: '接尾' }
/** げ 前面：形容词词干（楽し）、名词（不安、満足、よさ）、ある（自信ありげ）；ひげ（ひ/げ）、なにげ 不算 */
const GE_BEFORE: TokenSpec[] = [
  ctx({ pos: '形容詞', cf: 'ガル接続' }),
  ctx({ pos: '名詞', p1: ['形容動詞語幹', 'サ変接続', '一般', '接尾'] }),
  ctx({ pos: '動詞', b: 'ある', s: 'あり' })
]
const ATATTE: TokenSpec = {
  s: ['に当たって', 'にあたって', 'に当たり', 'にあたり', 'に当って', 'に当り']
}
/** 〜に当たって 前面：动词原形、サ変名词（開店）、时候（とき）；夜霧に当たって（被……淋到）不算 */
const ATATTE_BEFORE: TokenSpec[] = [
  ctx({ pos: '動詞', cf: '基本形' }),
  ctx({ pos: '名詞', p1: ['サ変接続', '副詞可能', '非自立', '接尾'] })
]
const NUKI: TokenSpec = { s: ['抜き', 'ぬき'], pos: '名詞' }
const KIKKAKE: TokenSpec = { s: ['きっかけ', 'キッカケ', '切っ掛け'] }
const MOTOZUKU: TokenSpec = { b: ['基づく', 'もとづく'] }
const OUJI: TokenSpec = { b: ['応じる', '応ずる'], s: '応じ' }
const HANSHI: TokenSpec = { b: ['反す', '反する'], s: '反し' }
const KUWAE: TokenSpec = { b: '加える', s: '加え' }
/** はじめ 是名词（ピアノを始め、… 的「始め」是动词） */
const HAJIME: TokenSpec = { s: ['はじめ', '始め', '初め'], pos: '名詞' }
/** 〜をはじめ 后面列举的名词（今では、毎日 这类时间词不算） */
const LIST_NEXT: TokenSpec[] = [
  ctx({
    pos: '名詞',
    p1: ['一般', '固有名詞', '代名詞', 'サ変接続', '形容動詞語幹', '接尾', '非自立', '数']
  }),
  ctx({ s: ['多く', 'いろいろ', '数多く'] })
]
const MUKE: TokenSpec = { b: '向ける', s: '向け' }
const SHIDAI: TokenSpec = { s: ['次第', 'しだい'], pos: '名詞' }
const KIRI: TokenSpec = { s: ['きり', 'っきり'], pos: '名詞', p1: '非自立' }
const TSUTSU: TokenSpec = { s: 'つつ', pos: '助詞', p1: '接続助詞' }
/** 〜か〜ないかのうちに 的「ないか」「のうちに」 */
const NAIKA: TokenSpec[] = [{ b: 'ない', pos: '助動詞' }, { s: 'か' }]
const NOUCHINI: TokenSpec[] = [{ s: 'の' }, { s: 'うち' }, { s: 'に' }]
const SAE: TokenSpec = { s: 'さえ', pos: '助詞' }
const TOMONAU: TokenSpec = { b: ['伴う', 'ともなう'] }
const SOU: TokenSpec = { pos: '動詞', b: ['沿う', '添う', 'そう'] }

const points: GrammarPoint[] = [
  // ── 话题与立场 ──
  P(
    'toieba',
    2,
    '〜といえば／〜というと／〜といったら',
    '说到……',
    'speaking of; when it comes to',
    '夏といえば、やっぱりスイカですね。',
    [
      [NOUN_BEFORE, TO, { ...IU, s: ['いえ', '言え'] }, BA, II_NAI],
      [NOUN_BEFORE, TO, { ...IU, s: ['いう', '言う'] }, TO_IF],
      [NOUN_BEFORE, { s: 'という' }, TO_IF],
      // 〜といったらない（极其……）是另一个句型
      [NOUN_BEFORE, TO, { ...IU, s: ['いっ', '言っ'] }, { s: 'たら' }, II_NAI]
    ]
  ),
  P(
    'karasuruto',
    2,
    '〜からすると／〜からすれば／〜からしたら',
    '从……来看',
    'judging from; from the viewpoint of',
    '空の様子からすると、午後は雨になりそうだ。',
    KARA_BEFORE.flatMap((b) => SURUTO.map((seq) => [b, ...seq]))
  ),
  P(
    'nishitara',
    2,
    '〜にしたら／〜にすれば／〜にしてみれば',
    '对……来说（站在……的立场）',
    'from the standpoint of; for (someone)',
    '子供にしたら、毎日の塾はつらいだろう。',
    // 前面要是人、团体；にしたら、にすれば 后面还得跟读点
    PERSON_BEFORE.flatMap((p) => SHITARA.map((seq) => [p, ...seq]))
  ),

  // ── 条件 ──
  P(
    'tonaruto',
    2,
    '〜となると／〜となれば／〜となったら',
    '要是……的话；一旦……',
    'if it comes to; once (it is decided that)',
    '海外に引っ越すとなると、準備が大変だ。',
    [
      [TO, { b: 'なる', s: 'なる' }, TO_IF],
      [TO, { b: 'なる', s: 'なれ' }, BA],
      [TO, { b: 'なる', s: 'なっ' }, { s: 'たら' }]
    ]
  ),
  P(
    'saeba',
    2,
    '〜さえ〜ば',
    '只要……就',
    'if only; as long as',
    '時間さえあれば、もっと旅行したい。',
    [
      [SAE, { pos: ['動詞', '形容詞'], cf: '仮定形' }, BA],
      // さえ 忘れ なけれ ば
      [SAE, { pos: '動詞' }, { pos: '助動詞', b: 'ない', cf: '仮定形' }, BA],
      // さえ 覚え て おけ ば
      [SAE, { pos: '動詞' }, TE, { pos: '動詞', cf: '仮定形' }, BA],
      // さえ 丈夫 なら
      [SAE, { pos: '名詞' }, { s: 'なら', b: 'だ' }]
    ]
  ),
  P(
    'kagiri',
    2,
    '〜限り（は）／〜限りでは',
    '只要……；在……范围内',
    'as long as; as far as',
    '雨が降らない限り、試合は行われます。',
    KAGIRI_BEFORE.flatMap((b) => KAGIRI_TAIL.map((seq) => [b, ...seq]))
  ),

  // ── 不仅、加上与偏偏 ──
  P(
    'bakarika',
    2,
    '〜ばかりか',
    '不仅……而且',
    'not only … but also',
    '彼は英語ばかりか、フランス語も話せる。',
    [
      [
        { b: 'ばかり', pos: '助詞' },
        { s: 'か', pos: '助詞' },
        not({ s: ['。', '？', '?', '！', 'と', 'って'] })
      ]
    ]
  ),
  P(
    'nikuwaete',
    2,
    '〜に加えて',
    '加上……；除了……还……',
    'in addition to',
    '雨に加えて、風も強くなってきた。',
    [
      [NI, KUWAE, TE],
      [NI, KUWAE, ctx(COMMA)]
    ]
  ),
  P(
    'nikagirazu',
    2,
    '〜に限らず',
    '不仅限于……',
    'not only; not limited to',
    'この公園は子供に限らず、大人にも人気がある。',
    [[NI, { b: ['限る', 'かぎる'], s: ['限ら', 'かぎら'] }, { s: 'ず' }]]
  ),
  P(
    'nikagitte',
    2,
    '〜に限って',
    '偏偏……；唯独……',
    'of all times; (someone) of all people',
    '傘を持っていない日に限って、雨が降る。',
    [[NI, { b: ['限る', 'かぎる'], s: ['限っ', 'かぎっ'] }, TE]]
  ),
  P(
    'wohajime',
    2,
    '〜をはじめ（とする）',
    '以……为首',
    'starting with; including',
    '社長をはじめ、社員全員がパーティーに参加した。',
    [
      [WO, HAJIME, { s: 'として' }],
      [WO, HAJIME, { s: 'と', pos: '助詞' }, { b: 'する', s: 'する' }],
      [WO, HAJIME, { s: 'と', pos: '助詞' }, { b: 'する', s: 'し' }, { s: ['た', 'て'] }],
      // 光是「をはじめ」的，后面（隔着读点）得接着列举的名词：
      // ピアノをはじめ、今では毎日弾いている（开始学）的はじめ 也被标成名词
      ...[[], [ctx(COMMA)]].flatMap((comma) =>
        LIST_NEXT.map((next) => [WO, HAJIME, ...comma, next])
      )
    ]
  ),

  // ── 不论与暂且不论 ──
  P(
    'nikakawarazu',
    2,
    '〜にかかわらず／〜に関わらず',
    '不论……',
    'regardless of',
    '天気にかかわらず、試合は予定どおり行います。',
    [
      [
        NI,
        { b: ['かかわる', '関わる', '係わる'], s: ['かかわら', '関わら', '係わら'] },
        { s: 'ず' }
      ]
    ]
  ),
  P(
    'wotowazu',
    2,
    '〜を問わず',
    '不问……；不论……',
    'regardless of; irrespective of',
    'この仕事は経験を問わず、誰でも応募できます。',
    [
      [WO, { b: '問う', s: '問わ' }, { s: 'ず' }],
      // 男女問わず、昼夜問わず（省掉を）
      [ctx({ pos: '名詞' }), { b: '問う', s: '問わ' }, { s: 'ず' }]
    ]
  ),
  P(
    'wahotomokaku',
    2,
    '〜はともかく（として）',
    '……暂且不论',
    'leaving aside; never mind',
    '味はともかく、この店は値段が安い。',
    [
      [{ s: 'は', pos: '助詞' }, { s: ['ともかく', '兎も角'] }, { s: 'として' }],
      [{ s: 'は', pos: '助詞' }, { s: ['ともかく', '兎も角'] }]
    ]
  ),
  P(
    'nuki',
    2,
    '〜抜きで／〜抜きにして／〜は抜きにして',
    '去掉……；不算……',
    'without; leaving aside',
    '冗談は抜きにして、真剣に話し合いましょう。',
    [
      [{ s: 'は', pos: '助詞' }, NUKI, { s: 'に' }, { b: 'する', s: 'し' }, TE],
      // 〜を抜きにしては（……的话就不能）：连は一起算，免得后面的「にしては」另认成〜にしては
      [NUKI, { s: 'に' }, { b: 'する', s: 'し' }, TE, { s: 'は', pos: '助詞' }],
      [NUKI, { s: 'に' }, { b: 'する', s: 'し' }, TE],
      [ctx({ pos: '名詞' }), NUKI, { s: 'で' }]
    ]
  ),

  // ── 依据与契机 ──
  P(
    'womotoni',
    2,
    '〜をもとに',
    '以……为基础',
    'based on',
    'この映画は実際にあった話をもとに作られた。',
    [
      // 元に戻す（恢复原状）不算
      [
        WO,
        { s: ['もと', '元', '基'], pos: '名詞' },
        { s: 'に' },
        not({ b: ['戻す', '戻る', '戻せる', 'もどす', 'もどる', 'もどせる'] })
      ]
    ]
  ),
  P(
    'nimotozuite',
    2,
    '〜に基づいて／〜に基づく',
    '根据……',
    'based on; in accordance with',
    '法律に基づいて、正しく手続きを行ってください。',
    [
      [NI, { ...MOTOZUKU, s: ['基づい', 'もとづい'] }, TE],
      [NI, { ...MOTOZUKU, s: ['基づい', 'もとづい'] }, { s: 'た' }],
      [NI, { ...MOTOZUKU, s: ['基づく', '基づき', 'もとづく', 'もとづき'] }]
    ]
  ),
  P(
    'nioujite',
    2,
    '〜に応じて',
    '根据……；与……相应',
    'according to; depending on',
    '季節に応じて、メニューを変えています。',
    [
      [NI, OUJI, TE],
      [NI, OUJI, { s: 'た' }, NOUN_NEXT],
      [NI, OUJI, ctx(COMMA)]
    ]
  ),
  P(
    'nisotte',
    2,
    '〜に沿って／〜に沿う',
    '沿着……；按照……',
    'along; in line with',
    '川に沿って、桜の木が並んでいる。',
    [
      [NI, { ...SOU, s: ['沿っ', '添っ', 'そっ'] }, TE],
      [NI, { ...SOU, s: ['沿っ', '添っ', 'そっ'] }, { s: 'た' }, NOUN_NEXT],
      [NI, { ...SOU, s: ['沿い', '添い', '沿う', '添う'] }]
    ]
  ),
  P(
    'wokikkakeni',
    2,
    '〜をきっかけに／〜がきっかけで',
    '以……为契机',
    'prompted by; taking … as the occasion',
    '留学をきっかけに、自分で料理をするようになった。',
    [
      [WO, KIKKAKE, { s: 'に' }],
      [{ s: 'が', pos: '助詞' }, KIKKAKE, { s: 'で' }]
    ]
  ),

  // ── 场合与范围 ──
  P(
    'nioite',
    2,
    '〜において／〜における',
    '在……（场合、领域）',
    'in; at (a place, field or situation)',
    '卒業式は大学のホールにおいて行われます。',
    // カメラを家においてきた（放在）也切成「において」：后面是くる、いく、おく这些的不算
    [
      [
        { s: ['において', 'における', 'に於いて', 'に於ける'] },
        not({
          b: [
            'くる',
            '来る',
            'いく',
            '行く',
            'おく',
            'いる',
            'ある',
            'しまう',
            'くださる',
            'もらう'
          ]
        })
      ]
    ]
  ),
  P(
    'niwatatte',
    2,
    '〜にわたって',
    '遍及……；长达……',
    'over (a period or area); throughout',
    '会議は三時間にわたって続いた。',
    [
      [{ s: ['にわたって', 'にわたり', 'にわたる', 'に渡って', 'に渡り', 'に渡る'] }],
      [NI, { b: 'わたる', s: 'わたっ' }, { s: ['て', 'た'] }],
      [NI, { b: 'わたる', s: ['わたり', 'わたる'] }],
      // 写成汉字的「渡る」只认数量、时间后面的（アメリカに渡って 是「去」）
      [ctx({ p1: ['数', '接尾', '副詞可能'] }), NI, { b: '渡る', s: '渡っ' }, { s: ['て', 'た'] }],
      [ctx({ p1: ['数', '接尾', '副詞可能'] }), NI, { b: '渡る', s: ['渡り', '渡る'] }]
    ]
  ),
  P(
    'nisaishite',
    2,
    '〜に際して',
    '在……之际',
    'on the occasion of; when',
    '入学に際して、必要な書類を提出してください。',
    [
      [{ s: ['に際して', 'に際し', 'にさいして', 'にさいし'] }],
      [NI, { s: ['際し', 'さいし'] }, TE],
      [NI, { s: ['際し', 'さいし'] }]
    ]
  ),
  P(
    'niatatte',
    2,
    '〜に当たって',
    '在……之时',
    'when (about to do); on the occasion of',
    '新しい事業を始めるに当たって、しっかり計画を立てた。',
    // 「頭に当たって」（碰到）kuromoji 切成 に/当たっ/て，这里只认连在一起的；
    // 任にあたってもらう（担任）这类后面直接接动词的不算
    ATATTE_BEFORE.map((b) => [b, ATATTE, not({ pos: '動詞' })])
  ),
  P(
    'nimukete',
    2,
    '〜に向けて',
    '面向……；为了……',
    'toward; aimed at; for',
    '来月の試合に向けて、毎日練習している。',
    [
      [NI, MUKE, TE],
      [NI, MUKE, { s: 'た' }, NOUN_NEXT],
      [NI, MUKE, ctx(COMMA)]
    ]
  ),

  // ── 随着与相反 ──
  P(
    'totomoni',
    2,
    '〜とともに',
    '和……一起；随着……',
    'together with; as (something changes)',
    '年をとるとともに、体力が落ちてきた。',
    [[{ s: ['とともに', 'と共に'] }], [TO, { s: ['ともに', '共に'] }]]
  ),
  P(
    'nitomonatte',
    2,
    '〜に伴って／〜に伴う',
    '随着……',
    'along with; as (something changes)',
    '人口の増加に伴って、住宅が不足している。',
    [
      [NI, { ...TOMONAU, s: ['伴っ', 'ともなっ'] }, TE],
      [NI, { ...TOMONAU, s: ['伴っ', 'ともなっ'] }, { s: 'た' }, NOUN_NEXT],
      // 伴われる（被带着）不算
      [NI, { ...TOMONAU, s: ['伴い', 'ともない', '伴う', 'ともなう'] }]
    ]
  ),
  P(
    'nihanshite',
    2,
    '〜に反して',
    '与……相反',
    'contrary to',
    '予想に反して、試験はとても簡単だった。',
    [
      [NI, HANSHI, TE],
      [NI, HANSHI, ctx(COMMA)],
      [NI, HANSHI, { s: 'た' }, NOUN_NEXT],
      [NI, { b: '反する', s: '反する' }, NOUN_NEXT]
    ]
  ),

  // ── 紧接着与结果 ──
  P(
    'shidai',
    2,
    '〜次第',
    '一……就（马上）；取决于……',
    'as soon as; depending on',
    '駅に着き次第、電話します。',
    [
      // 次第に（渐渐）、こういう次第で（情况）不算：前面要是动词连用形或名词
      [ctx({ pos: '動詞', cf: '連用形' }), SHIDAI],
      [
        ctx({ pos: '名詞', p1: ['一般', 'サ変接続', '代名詞', '固有名詞', '副詞可能', '接尾'] }),
        SHIDAI
      ]
    ]
  ),
  P(
    'tatokoro',
    2,
    '〜たところ',
    '……结果（发现）',
    'when I did … (I found that)',
    '先生に相談したところ、親切にアドバイスしてくれた。',
    // 〜たところだ（刚刚）、〜たところで（即使）不算：后面跟读点
    [[PAST, { s: ['ところ', '所'], pos: '名詞' }, ctx(COMMA)]]
  ),
  P(
    'takiri',
    2,
    '〜たきり／〜きり',
    '自从……就再也没……；只有……',
    'and never since; only',
    '兄は朝出かけたきり、まだ帰ってこない。',
    [
      // 寝たきり（卧床不起）是一个词
      [not({ s: '寝' }), PAST, KIRI],
      [ctx({ pos: '名詞' }), KIRI],
      // 一度きり：这里的きり 被标成一般名词
      [ctx({ s: ['一度', '一回', '一人'] }), { s: ['きり', 'っきり'], pos: '名詞' }]
    ]
  ),
  P(
    'katoomouto',
    2,
    '〜かと思うと／〜かと思ったら',
    '刚……就；本以为……却',
    'no sooner … than; just when I thought …',
    '赤ちゃんは泣き出したかと思うと、すぐに笑い出した。',
    [
      // 明日が試験かと思うと（一想到）不算：前面要是た
      [
        ctx({ pos: '助動詞', ct: '特殊・タ' }),
        { s: 'か', pos: '助詞' },
        TO,
        { b: ['思う', 'おもう'], s: ['思う', 'おもう'] },
        TO_IF
      ],
      [
        { s: 'か', pos: '助詞' },
        TO,
        { b: ['思う', 'おもう'], s: ['思っ', 'おもっ'] },
        { s: 'たら' }
      ]
    ]
  ),
  P(
    'kanaika',
    2,
    '〜か〜ないかのうちに',
    '刚……就',
    'no sooner … than; the moment',
    'ベルが鳴るか鳴らないかのうちに、教室を飛び出した。',
    // か 前面是动词或た（何か食べないうちに 不算）；中间的否定动词有时切成两个词；也有省掉「かの」的
    [
      [{ pos: '動詞' }, ...NAIKA, ...NOUCHINI],
      [{ pos: '動詞' }, { pos: '動詞' }, ...NAIKA, ...NOUCHINI],
      [{ pos: '動詞' }, { b: 'ない', pos: '助動詞' }, { s: 'うち' }, { s: 'に' }]
    ].map((seq) => [ctx({ pos: ['動詞', '助動詞'] }), { s: 'か', pos: '助詞' }, ...seq])
  ),

  // ── 样子与进行 ──
  P(
    'ge',
    2,
    '〜げ',
    '好像……的样子',
    'looking …; with an air of',
    '子どもたちは楽しげに公園で遊んでいる。',
    [
      // 后面直接是动词的不算（挿げ替える）
      ...GE_BEFORE.map((b) => [b, GE, not({ pos: '動詞' })]),
      // 言いたげ、眠たげ：kuromoji 切成 言い/たげ
      [{ s: 'たげ', pos: '動詞' }],
      // 整个词收在词典里的
      [{ s: ['得意げ', '寂しげ', '淋しげ', '怪しげ', '惜しげ', '誇らしげ', '涼しげ'] }]
    ]
  ),
  P(
    'gimi',
    2,
    '〜気味',
    '有点……',
    'a touch of; slightly',
    '今日は少し風邪気味なので、早めに寝ます。',
    // 気味が悪い 是一个词；いい気味だ 的気味 不是接尾
    [[{ s: ['気味', 'ぎみ'], pos: '名詞', p1: '接尾' }]]
  ),
  P(
    'tsutsu',
    2,
    '〜つつ／〜つつある',
    '一边……；正在……',
    'while; be in the process of',
    '景色を楽しみつつ、ゆっくり山道を歩いた。',
    // 〜つつも（虽然……却）是让步，不算
    [
      [TSUTSU, { b: 'ある', s: 'あっ' }, PAST],
      [TSUTSU, { b: 'ある', pos: '動詞' }],
      [TSUTSU, not({ s: 'も' })]
    ]
  )
]

/** 接续、自带例句的中英翻译、同组、另写的例句 */
const notes: Record<string, GrammarNote> = {
  toieba: {
    form: 'N + といえば / というと / といったら',
    zh: '说到夏天，还得是西瓜啊。',
    en: 'When you think of summer, it has to be watermelon.',
    group: 'topic',
    more: [
      {
        ja: 'この町というと、昔から焼き物が有名だ。',
        zh: '说起这个小镇，它的陶器自古就很有名。',
        en: 'This town has long been famous for its pottery.'
      },
      {
        ja: '彼の部屋の汚さといったら、言葉にできないほどだ。',
        zh: '说到他房间有多乱，简直没法形容。',
        en: 'As for how messy his room is, words fail me.'
      }
    ]
  },
  karasuruto: {
    form: 'N + からすると / からすれば / からしたら',
    zh: '看天色，下午可能要下雨。',
    en: 'Judging from the sky, it looks like it will rain this afternoon.',
    group: 'viewpoint',
    more: [
      {
        ja: '親からすれば、子供はいつまでも子供なのだ。',
        zh: '在父母看来，孩子永远是孩子。',
        en: 'To parents, their children are always children.'
      },
      {
        ja: 'この値段からしたら、かなり高級な店みたいだね。',
        zh: '从这个价格来看，好像是家相当高档的店呢。',
        en: 'Judging by these prices, it seems like quite a fancy place.'
      }
    ]
  },
  nishitara: {
    form: 'N + にしたら / にすれば / にしてみれば',
    zh: '对孩子来说，每天上补习班一定很辛苦吧。',
    en: 'For the children, going to cram school every day must be hard.',
    group: 'viewpoint',
    more: [
      {
        ja: '店の人にすれば、急なキャンセルは本当に困るだろう。',
        zh: '站在店家的角度，临时取消一定很让人头疼吧。',
        en: 'For the people running the shop, last-minute cancellations must be a real headache.'
      },
      {
        ja: '君は冗談のつもりでも、彼にしてみればショックだったと思うよ。',
        zh: '你也许只是开个玩笑，可对他来说，我想是个打击。',
        en: 'You may have meant it as a joke, but for him I think it came as a shock.'
      }
    ]
  },
  tonaruto: {
    form: '普通形 / N + となると / となれば / となったら',
    zh: '要是搬到国外去，准备工作可不轻松。',
    en: "If we're moving abroad, there'll be a lot to prepare.",
    group: 'if',
    more: [
      {
        ja: '社長が来るとなれば、会議室を片付けなければならない。',
        zh: '既然社长要来，就得把会议室收拾好。',
        en: "If the company president is coming, we'll have to tidy up the meeting room."
      },
      {
        ja: '結婚するとなったら、まず両親に会ってほしい。',
        zh: '要是结婚的话，我希望你先见见我父母。',
        en: "If we're getting married, I'd like you to meet my parents first."
      }
    ]
  },
  saeba: {
    form: 'N + さえ + Vば形（時間さえあれば · 天気さえよければ）· Vます形 + さえすれば · N + さえ + なA / N + なら',
    zh: '只要有时间，我就想多去旅行。',
    en: "If only I had the time, I'd travel more.",
    group: 'only-if',
    more: [
      {
        ja: 'この薬を飲みさえすれば、すぐ治りますよ。',
        zh: '只要吃了这个药，很快就会好的。',
        en: "Just take this medicine and you'll be better in no time."
      },
      {
        ja: 'あなたさえよければ、明日一緒に行きましょう。',
        zh: '只要你方便，明天我们一起去吧。',
        en: "If it's all right with you, let's go together tomorrow."
      }
    ]
  },
  kagiri: {
    form: '普通形（なAな・Nである）+ 限り（は）· V辞書形 / Vた形 + 限りでは（知る限りでは）',
    zh: '只要不下雨，比赛就照常举行。',
    en: "As long as it doesn't rain, the match will go ahead.",
    group: 'only-if',
    more: [
      {
        ja: '体が丈夫な限り、仕事を続けたい。',
        zh: '只要身体还硬朗，我就想继续工作。',
        en: "As long as I'm in good health, I want to keep working."
      },
      {
        ja: '私が調べた限りでは、この店がいちばん安い。',
        zh: '就我查到的来看，这家店最便宜。',
        en: 'As far as I can tell from my research, this shop is the cheapest.'
      }
    ]
  },
  bakarika: {
    form: 'N / 普通形（なAな）+ ばかりか',
    zh: '他不仅会说英语，还会说法语。',
    en: 'He can speak not only English but French as well.',
    group: 'not-only',
    more: [
      {
        ja: 'その店は値段が高いばかりか、サービスも悪い。',
        zh: '那家店不光价格贵，服务也很差。',
        en: 'That shop is not only expensive; the service is bad too.'
      },
      {
        ja: '弟は宿題を手伝ってくれないばかりか、邪魔までしてくる。',
        zh: '弟弟不但不帮我写作业，还来捣乱。',
        en: "My little brother not only won't help with my homework, he even gets in my way."
      }
    ]
  },
  nikuwaete: {
    form: 'N + に加えて',
    zh: '不但下着雨，风也越来越大了。',
    en: 'On top of the rain, the wind has picked up too.',
    group: 'not-only',
    more: [
      {
        ja: 'この仕事は高い給料に加えて、休みも多い。',
        zh: '这份工作除了工资高，假期也多。',
        en: 'Besides the good pay, this job gives you plenty of days off.'
      },
      {
        ja: '英語に加えて、中国語も勉強し始めた。',
        zh: '除了英语，我还开始学中文了。',
        en: "In addition to English, I've started studying Chinese."
      }
    ]
  },
  nikagirazu: {
    form: 'N + に限らず',
    zh: '这个公园不光受孩子欢迎，也受大人欢迎。',
    en: 'This park is popular not only with children but with adults too.',
    group: 'not-only',
    more: [
      {
        ja: '日本に限らず、多くの国で高齢化が進んでいる。',
        zh: '不只是日本，很多国家的老龄化都在加剧。',
        en: 'Not just in Japan but in many countries, the population is aging.'
      },
      {
        ja: '漢字に限らず、言葉は使わないとすぐ忘れてしまう。',
        zh: '不只是汉字，词语不用的话很快就会忘掉。',
        en: "It's not just kanji: any words you don't use, you soon forget."
      }
    ]
  },
  nikagitte: {
    form: 'N + に限って',
    zh: '偏偏在没带伞的日子下雨。',
    en: "It always rains on the very day I don't have an umbrella.",
    more: [
      {
        ja: 'うちの子に限って、そんなことをするはずがない。',
        zh: '唯独我家孩子，绝不可能做那种事。',
        en: 'My child, of all people, would never do such a thing.'
      },
      {
        ja: '急いでいる時に限って、電車が遅れるんだよね。',
        zh: '偏偏在着急的时候，电车就晚点。',
        en: "The train is always late precisely when I'm in a hurry."
      }
    ]
  },
  wohajime: {
    form: 'N + をはじめ（として）· N + をはじめとする + N',
    zh: '以社长为首，全体员工都参加了聚会。',
    en: 'Everyone in the company, from the president down, came to the party.',
    group: 'not-only',
    more: [
      {
        ja: 'この町には、お寺をはじめとする古い建物がたくさんある。',
        zh: '这个镇上有许多以寺庙为代表的古老建筑。',
        en: 'This town has many old buildings, temples among them.'
      },
      {
        ja: '寿司をはじめ、日本料理は海外でも人気がある。',
        zh: '以寿司为代表，日本料理在国外也很受欢迎。',
        en: 'Japanese food, sushi above all, is popular abroad too.'
      }
    ]
  },
  nikakawarazu: {
    form: 'N / V辞書形 + Vない形 + にかかわらず（天気にかかわらず · 行く行かないにかかわらず）',
    zh: '不论天气如何，比赛都按计划进行。',
    en: 'Regardless of the weather, the match will go ahead as planned.',
    group: 'regardless',
    more: [
      {
        ja: '参加するかしないかにかかわらず、メールで返事をください。',
        zh: '不论参加与否，都请用邮件回复。',
        en: "Whether or not you'll attend, please reply by email."
      },
      {
        ja: '金額の大小に関わらず、送料は無料です。',
        zh: '不论金额大小，一律免运费。',
        en: 'Shipping is free no matter how much you spend.'
      }
    ]
  },
  wotowazu: {
    form: 'N + を問わず',
    zh: '这份工作不问经验，谁都可以应聘。',
    en: 'Anyone can apply for this job, regardless of experience.',
    group: 'regardless',
    more: [
      {
        ja: '駅前の店は昼夜を問わず、いつも混んでいる。',
        zh: '车站前的那家店不分昼夜，总是人很多。',
        en: 'The shop in front of the station is always crowded, day or night.'
      },
      {
        ja: 'このアニメは男女問わず人気がある。',
        zh: '这部动画不论男女都很喜欢。',
        en: 'This anime is popular with men and women alike.'
      }
    ]
  },
  wahotomokaku: {
    form: 'N + はともかく（として）',
    zh: '味道先不说，这家店价格便宜。',
    en: 'Taste aside, this place is cheap.',
    group: 'regardless',
    more: [
      {
        ja: '見た目はともかく、使いやすいかばんだ。',
        zh: '外观暂且不论，这是个好用的包。',
        en: "Never mind how it looks; it's an easy bag to use."
      },
      {
        ja: '結果はともかくとして、最後まで頑張ったことが大切だ。',
        zh: '结果如何暂且不论，重要的是坚持到了最后。',
        en: 'Whatever the result, what matters is that you kept going to the end.'
      }
    ]
  },
  nuki: {
    form: 'N + 抜きで · N + （を / は）抜きにして（は）',
    zh: '玩笑话先放一边，我们认真谈谈吧。',
    en: "Joking aside, let's talk this over seriously.",
    group: 'regardless',
    more: [
      {
        ja: 'すみません、ラーメンをネギ抜きでお願いします。',
        zh: '不好意思，拉面请不要放葱。',
        en: "Excuse me, I'd like the ramen without green onions, please."
      },
      {
        ja: '彼の協力を抜きにしては、この計画は成功しなかっただろう。',
        zh: '要是没有他的协助，这个计划恐怕不会成功。',
        en: "Without his help, this plan probably wouldn't have succeeded."
      }
    ]
  },
  womotoni: {
    form: 'N + をもとに（して）',
    zh: '这部电影是根据真实故事改编的。',
    en: 'This movie is based on a true story.',
    group: 'basis',
    more: [
      {
        ja: 'アンケートの結果をもとにして、新しい商品を考えた。',
        zh: '我们以问卷调查的结果为基础，构思了新产品。',
        en: 'We came up with a new product based on the survey results.'
      },
      {
        ja: '先輩のアドバイスをもとに、発表の資料を直した。',
        zh: '我根据前辈的建议修改了发言的资料。',
        en: "I revised my presentation slides based on my senior colleague's advice."
      }
    ]
  },
  nimotozuite: {
    form: 'N + に基づいて / に基づき · N + に基づく / に基づいた + N',
    zh: '请依照法律正确办理手续。',
    en: 'Please carry out the procedures properly, in accordance with the law.',
    group: 'basis',
    more: [
      {
        ja: 'これは事実に基づく話です。',
        zh: '这是根据真实事件写成的故事。',
        en: 'This is a story based on fact.'
      },
      {
        ja: '社員の意見に基づき、休みの制度が変わった。',
        zh: '根据员工的意见，休假制度改了。',
        en: "The leave system was changed based on employees' opinions."
      }
    ]
  },
  nioujite: {
    form: 'N + に応じて · N + に応じた + N',
    zh: '我们根据季节更换菜单。',
    en: 'We change the menu according to the season.',
    group: 'basis',
    more: [
      {
        ja: '年齢に応じた運動をすることが大切だ。',
        zh: '做适合自己年龄的运动很重要。',
        en: "It's important to do exercise suited to your age."
      },
      {
        ja: 'お客様のご予算に応じて、プランをご提案します。',
        zh: '我们会根据您的预算提供方案。',
        en: "We'll suggest a plan to fit your budget."
      }
    ]
  },
  nisotte: {
    form: 'N + に沿って · N + に沿った / に沿う + N',
    zh: '沿着河边种着一排樱花树。',
    en: 'Cherry trees line the river.',
    group: 'basis',
    more: [
      {
        ja: 'マニュアルに沿って、作業を進めてください。',
        zh: '请按照操作手册进行作业。',
        en: 'Please carry out the work according to the manual.'
      },
      {
        ja: 'お客様の希望に沿ったプランを考えます。',
        zh: '我们会制定符合您要求的方案。',
        en: "We'll come up with a plan that meets your wishes."
      }
    ]
  },
  wokikkakeni: {
    form: 'N + をきっかけに（して）· N + がきっかけで',
    zh: '以留学为契机，我开始自己做饭了。',
    en: 'Studying abroad got me cooking for myself.',
    more: [
      {
        ja: '病気をきっかけに、たばこをやめた。',
        zh: '借着生病这个契机，我戒了烟。',
        en: 'Getting sick was what made me quit smoking.'
      },
      {
        ja: '友達の一言がきっかけで、ギターを始めた。',
        zh: '因为朋友的一句话，我开始学吉他了。',
        en: 'A single remark from a friend got me started on the guitar.'
      }
    ]
  },
  nioite: {
    form: 'N + において · N + における + N',
    zh: '毕业典礼将在大学礼堂举行。',
    en: 'The graduation ceremony will be held in the university hall.',
    more: [
      {
        ja: '仕事における一番の悩みは何ですか。',
        zh: '你在工作上最大的烦恼是什么？',
        en: 'What is your biggest worry at work?'
      },
      {
        ja: '現代社会において、スマートフォンは欠かせないものになった。',
        zh: '在现代社会，智能手机已经成了不可或缺的东西。',
        en: 'In modern society, smartphones have become indispensable.'
      }
    ]
  },
  niwatatte: {
    form: 'N + にわたって / にわたり · N + にわたる + N',
    zh: '会议持续了整整三个小时。',
    en: 'The meeting went on for three hours.',
    group: 'throughout',
    more: [
      {
        ja: '台風の影響で、広い範囲にわたって停電した。',
        zh: '受台风影响，大范围停电了。',
        en: 'Because of the typhoon, there were power cuts over a wide area.'
      },
      {
        ja: '十年にわたる研究の結果が、ついに発表された。',
        zh: '长达十年的研究成果终于发表了。',
        en: 'The results of ten years of research have finally been published.'
      }
    ]
  },
  nisaishite: {
    form: 'N / V辞書形 + に際して / に際し',
    zh: '入学时请提交所需的材料。',
    en: 'Please submit the required documents when you enroll.',
    group: 'occasion',
    more: [
      {
        ja: '引っ越しに際し、住所変更の手続きをした。',
        zh: '搬家时，我办了地址变更手续。',
        en: 'When I moved, I filed a change of address.'
      },
      {
        ja: '帰国に際して、お世話になった方々に挨拶をした。',
        zh: '回国之际，我向关照过我的人们道了别。',
        en: 'Before returning home, I said goodbye to everyone who had helped me.'
      }
    ]
  },
  niatatte: {
    form: 'N / V辞書形 + に当たって / に当たり',
    zh: '在开始新事业之前，我们制定了周密的计划。',
    en: 'Before starting the new business, we made careful plans.',
    group: 'occasion',
    more: [
      {
        ja: '開店にあたり、多くの方にご協力いただきました。',
        zh: '开店之际，承蒙许多人的协助。',
        en: 'Many people helped us when we opened the shop.'
      },
      {
        ja: '留学するにあたって、両親とよく話し合った。',
        zh: '出国留学之前，我和父母好好商量过。',
        en: 'Before going to study abroad, I talked it over carefully with my parents.'
      }
    ]
  },
  nimukete: {
    form: 'N + に向けて · N + に向けた + N',
    zh: '为了下个月的比赛，我们每天都在练习。',
    en: "We're practicing every day for next month's match.",
    group: 'purpose',
    more: [
      {
        ja: '市長は市民に向けて、メッセージを発表した。',
        zh: '市长向市民发表了讲话。',
        en: 'The mayor issued a message to the citizens.'
      },
      {
        ja: '町では、祭りに向けた準備が始まっている。',
        zh: '镇上已经开始为祭典做准备了。',
        en: 'Preparations for the festival have begun in town.'
      }
    ]
  },
  totomoni: {
    form: 'N / V辞書形 + とともに',
    zh: '随着年龄增长，体力下降了。',
    en: 'As I have gotten older, my stamina has declined.',
    group: 'basis',
    more: [
      {
        ja: '家族とともに、新しい町で暮らし始めた。',
        zh: '我和家人一起在新的城镇开始了生活。',
        en: 'I started a new life in a new town with my family.'
      },
      {
        ja: '経済の発展とともに、人々の生活も変わった。',
        zh: '随着经济发展，人们的生活也改变了。',
        en: "As the economy developed, people's lives changed as well."
      }
    ]
  },
  nitomonatte: {
    form: 'N + に伴って / に伴い · N + に伴う + N',
    zh: '随着人口增加，住房出现了短缺。',
    en: 'With the growing population, there is a shortage of housing.',
    group: 'basis',
    more: [
      {
        ja: '台風の接近に伴い、電車の運転が止まった。',
        zh: '随着台风逼近，电车停运了。',
        en: 'As the typhoon approached, train services were suspended.'
      },
      {
        ja: '引っ越しに伴う手続きは、意外に多い。',
        zh: '搬家要办的手续多得出乎意料。',
        en: 'There are surprisingly many procedures that come with moving house.'
      }
    ]
  },
  nihanshite: {
    form: 'N + に反して · N + に反する / に反した + N',
    zh: '和预想的相反，考试非常简单。',
    en: 'Contrary to expectations, the exam was very easy.',
    more: [
      {
        ja: '親の期待に反して、彼は大学をやめてしまった。',
        zh: '他违背了父母的期望，从大学退学了。',
        en: "Against his parents' hopes, he dropped out of university."
      },
      {
        ja: '多くの人の予想に反する結果となった。',
        zh: '结果与许多人的预想相反。',
        en: 'The result went against what many people had expected.'
      }
    ]
  },
  shidai: {
    form: 'Vます形 + 次第（着き次第）· N + 次第だ / 次第で',
    zh: '一到车站我就给你打电话。',
    en: "I'll call you as soon as I get to the station.",
    group: 'as-soon-as',
    more: [
      {
        ja: '詳しいことが決まり次第、お知らせします。',
        zh: '详细情况一定下来，我们就通知您。',
        en: "We'll let you know as soon as the details are decided."
      },
      {
        ja: '合格できるかどうかは、これからの努力次第だ。',
        zh: '能不能考上，取决于今后的努力。',
        en: 'Whether you pass depends on how hard you work from now on.'
      }
    ]
  },
  tatokoro: {
    form: 'Vた形 + ところ、…',
    zh: '我去找老师商量，老师很热心地给了我建议。',
    en: 'When I consulted my teacher, they kindly gave me some advice.',
    more: [
      {
        ja: '店に電話してみたところ、もう売り切れだった。',
        zh: '给店里打电话一问，已经卖完了。',
        en: 'When I called the shop, it was already sold out.'
      },
      {
        ja: '新しい薬を試したところ、症状がかなり良くなった。',
        zh: '试了新药以后，症状好了很多。',
        en: 'When I tried the new medicine, my symptoms improved a lot.'
      }
    ]
  },
  takiri: {
    form: 'Vた形 + きり · N + きり（二人きり）',
    zh: '哥哥早上出了门，到现在还没回来。',
    en: "My brother went out this morning and still hasn't come back.",
    group: 'only',
    more: [
      {
        ja: '彼とは高校を卒業してから一度会ったきりだ。',
        zh: '高中毕业后，我和他只见过一次面。',
        en: "I've only seen him once since we graduated from high school."
      },
      {
        ja: '久しぶりに二人きりで食事をした。',
        zh: '我们俩难得单独吃了顿饭。',
        en: 'For the first time in a while, we had dinner, just the two of us.'
      }
    ]
  },
  katoomouto: {
    form: 'Vた形 + かと思うと / かと思ったら',
    zh: '婴儿刚哭起来，马上又笑了。',
    en: 'No sooner had the baby started crying than she started laughing.',
    group: 'as-soon-as',
    more: [
      {
        ja: '晴れたかと思ったら、また雨が降ってきた。',
        zh: '刚以为放晴了，又下起雨来。',
        en: 'Just when I thought it had cleared up, it started raining again.'
      },
      {
        ja: '勉強しているかと思ったら、ゲームをしていた。',
        zh: '本以为他在学习，结果却在玩游戏。',
        en: 'I thought he was studying, but he was playing games.'
      }
    ]
  },
  kanaika: {
    form: 'V辞書形 / Vた形 + か + Vない形 + かのうちに（鳴るか鳴らないかのうちに）',
    zh: '铃声刚响，我就冲出了教室。',
    en: 'The bell had barely rung when I dashed out of the classroom.',
    group: 'as-soon-as',
    more: [
      {
        ja: '横になるかならないかのうちに、眠ってしまった。',
        zh: '刚一躺下就睡着了。',
        en: 'I fell asleep almost the moment I lay down.'
      },
      {
        ja: '夫は家に着いたか着かないかのうちに、また出かけていった。',
        zh: '丈夫刚到家，就又出门了。',
        en: 'My husband had barely got home before he went out again.'
      }
    ]
  },
  ge: {
    form: '楽しい → 楽しげ · 不安 → 不安げ · 満足 → 満足げ · ある → ありげ',
    zh: '孩子们在公园里玩得很开心。',
    en: 'The children are playing happily in the park.',
    group: 'seem',
    more: [
      {
        ja: '彼は不安げな顔で、何度も時計を見ていた。',
        zh: '他一脸不安，一次又一次地看表。',
        en: 'He kept looking at his watch with an anxious face.'
      },
      {
        ja: '母は満足げに、出来上がった料理を眺めた。',
        zh: '妈妈心满意足地看着做好的菜。',
        en: 'My mother looked over the finished dish with a satisfied air.'
      }
    ]
  },
  gimi: {
    form: 'N / Vます形 + 気味（風邪気味 · 疲れ気味）',
    zh: '今天有点感冒，我早点睡。',
    en: "I'm coming down with a bit of a cold today, so I'll go to bed early.",
    group: 'tend',
    more: [
      {
        ja: '最近、仕事が忙しくて疲れ気味だ。',
        zh: '最近工作忙，有点累。',
        en: "Work has been busy lately, and I'm feeling a bit tired."
      },
      {
        ja: '工事は予定より遅れ気味です。',
        zh: '工程比预定的进度稍微落后一些。',
        en: 'The construction is running a little behind schedule.'
      }
    ]
  },
  tsutsu: {
    form: 'Vます形 + つつ / つつある',
    zh: '我一边欣赏风景，一边慢慢地走在山路上。',
    en: 'I walked slowly along the mountain path, enjoying the scenery.',
    group: 'while',
    more: [
      {
        ja: '地球の気温は少しずつ上がりつつある。',
        zh: '地球的气温正在一点点上升。',
        en: "The earth's temperature is gradually rising."
      },
      {
        ja: '予算のことも考えつつ、旅行の計画を立てよう。',
        zh: '我们一边考虑预算，一边制定旅行计划吧。',
        en: "Let's plan the trip while keeping the budget in mind."
      }
    ]
  }
}

const lessons: LessonSpec[] = [
  {
    id: 'n2-1',
    title: { zh: '话题与立场', en: 'Topics and viewpoints' },
    items: ['toieba', 'karasuruto', 'nishitara']
  },
  {
    id: 'n2-10',
    title: { zh: '条件：要是、只要', en: 'Conditions: if and as long as' },
    items: ['tonaruto', 'saeba', 'kagiri']
  },
  {
    id: 'n2-7',
    title: { zh: '不仅、加上与偏偏', en: 'Not only, in addition, of all times' },
    items: ['bakarika', 'nikuwaete', 'nikagirazu', 'nikagitte', 'wohajime']
  },
  {
    id: 'n2-9',
    title: { zh: '不论与暂且不论', en: 'Regardless, and leaving aside' },
    items: ['nikakawarazu', 'wotowazu', 'wahotomokaku', 'nuki']
  },
  {
    id: 'n2-3',
    title: { zh: '依据、契机与目标', en: 'Bases, triggers and goals' },
    items: ['womotoni', 'nimotozuite', 'nioujite', 'nisotte', 'wokikkakeni', 'nimukete']
  },
  {
    id: 'n2-2',
    title: { zh: '场合与范围', en: 'Occasions and scope' },
    items: ['nioite', 'niwatatte', 'nisaishite', 'niatatte']
  },
  {
    id: 'n2-4',
    title: { zh: '随着与相反', en: 'Along with, and contrary to' },
    items: ['totomoni', 'nitomonatte', 'nihanshite']
  },
  {
    id: 'n2-13',
    title: { zh: '紧接着与结果', en: 'Right after, and how it turned out' },
    items: ['shidai', 'tatokoro', 'takiri', 'katoomouto', 'kanaika']
  },
  {
    id: 'n2-14',
    title: { zh: '样子与进行', en: 'Appearances and ongoing change' },
    items: ['ge', 'gimi', 'tsutsu']
  }
]

export const N2B_GRAMMAR: LevelGrammar = { points, notes, lessons }
