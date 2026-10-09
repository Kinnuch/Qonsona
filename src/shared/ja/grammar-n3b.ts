/**
 * JLPT N3 的语法（二）：对象与立场、比较、随着与按照、复合动词、倾向、请求与使役被动、假定与让步。
 * 语法点（阅读器的「本文语法」、语法课、练习都用）、语法课的接续与例句翻译、分课都写在这里；
 * 写法见 grammar-def.ts，N3 的两个文件在 grammar-levels.ts 里并成一级（课按编号交错排）。
 * 说明、例句都是自己写的；每一条的例句（自带的与 more 里另写的）都得认得出来（tests/ja-grammar.test.ts）。
 */
import {
  II,
  P,
  TE,
  type GrammarNote,
  type GrammarPoint,
  type LessonSpec,
  type LevelGrammar,
  type TokenSpec
} from './grammar-def'

// ── 几处共用的词素条件 ──

/** 空格、换行隔开的一串词（列表长，这样写省地方） */
const words = (list: string): string[] => list.trim().split(/\s+/)

/** 比べる */
const KURABE: TokenSpec = { b: ['比べる', 'くらべる', '較べる'] }
/** 動詞の代わる（名詞の代わり 是 〜かわりに） */
const KAWARU: TokenSpec = { b: ['代わる', '代る'], pos: '動詞' }
/** したがう */
const SHITAGAU: TokenSpec = { b: ['したがう', '従う'] }
/** 後面是いる、ます、さえ 的「従う」是动词「服从」 */
const NOT_OBEY: TokenSpec = { b: ['いる', 'おる', 'ます', 'さえ'], ctx: true, not: true }
/** こめる */
const KOMERU: TokenSpec = { b: ['こめる', '込める', '籠める'], cf: '連用形' }
/** 弾を込める 是「装子弹」 */
const NOT_BULLET: TokenSpec = { s: ['弾', '弾丸', '銃弾', '弾薬', '火薬'], ctx: true, not: true }
/** 目を通す、糸を通す、主義を通す、法案を通す 这些是动词「通す」本身，不是「通过」 */
const NOT_THROUGH: TokenSpec = {
  s: words(`
    目 糸 針 袖 風 光 火 熱 水 空気 電気 筋 意地 我 主義 主張 無理 わがまま 信念 初志
    要求 法案 議案 予算
  `),
  ctx: true,
  not: true
}
/** 〜とおり 前面的「言う、思う」这类动词 */
const SAY_THINK = words('言う いう おっしゃる 仰る 申す 思う 考える 示す 望む 述べる')
/** 予定通り、計画どおり 的接尾词（二通り 的是助数词） */
const SUFFIX_TOORI: TokenSpec = { s: ['通り', 'どおり'], p1: '接尾', p2: '一般' }
/** 南向き、裏向き、逆向き 是「朝向」，暮らし向き 是「生计」 */
const NOT_DIRECTION: TokenSpec = {
  s: words(`
    南 北 東 西 上 下 前 後ろ 後 横 外 内 左 右 表 裏 逆 反対 斜め 真上 真下 上下 左右 前後
    暮らし
  `),
  ctx: true,
  not: true
}
/** 普通形的谓语（としても、としたら 前面）：动词、形容词 */
const PLAIN_PRED: TokenSpec = { pos: ['動詞', '形容詞'], ctx: true }
/** 普通形的谓语：た、だ、ない 这些助动词（う、よう 不算：〜ようとしても 是「想要」） */
const PLAIN_AUX: TokenSpec = {
  pos: '助動詞',
  b: ['た', 'だ', 'ない', 'たい', 'ぬ', 'ん'],
  ctx: true
}
/** 前面不是意志形的う、よう（〜ようとしたら 是「正要……的时候」） */
const NOT_VOLITIONAL: TokenSpec = { pos: '助動詞', b: ['う', 'よう', 'まい'], ctx: true, not: true }
/** 前面不是なA的词干、こと、よう（きれいにしても、ことにしても、ようにしては 不算） */
const NOT_NA_STEM: TokenSpec = { p1: ['形容動詞語幹', '非自立'], ctx: true, not: true }
/** 〜にして 的「に・し・て」 */
const NI_SHITE: TokenSpec[] = [{ s: 'に', pos: '助詞' }, { s: 'し', b: 'する' }, TE]
/** わり（割） */
const WARI: TokenSpec = { s: ['わり', '割'], pos: '名詞' }
/** 意志形的う、よう */
const VOLITIONAL: TokenSpec = { pos: '助動詞', b: ['う', 'よう'] }
/** 前面是动词原形或ない（〜ように言う、〜ことになっている） */
const DICT_V: TokenSpec = { pos: '動詞', cf: '基本形', ctx: true }
const NAI_V: TokenSpec = { pos: '助動詞', b: 'ない', cf: '基本形', ctx: true }
/** 〜ということになっている、〜ってことになってる */
const TOIU: TokenSpec = { s: ['という', 'って'], ctx: true }
/** 叫别人做：言う、頼む、伝える……（〜ように注意する 多半是「自己当心」，不算） */
const TELL: TokenSpec = {
  b: words('言う いう 頼む たのむ 伝える 命じる 命ずる 求める 指示 お願い')
}
const YOUNI: TokenSpec[] = [{ b: 'よう', p2: '助動詞語幹' }, { s: 'に' }]
const KOTONI: TokenSpec[] = [{ s: 'こと' }, { s: 'に' }]
/** 使役的せる、させる */
const CAUSATIVE: TokenSpec = { pos: '動詞', p1: '接尾', b: ['せる', 'させる'] }
/** 短的使役被动（待たされる、飲まされる）：kuromoji 把「待たさ」当成一个动词 */
const SHORT_CAUSATIVE: TokenSpec = {
  b: words(`
    待たす 飲ます 行かす 書かす 読ます 歌わす 言わす 買わす 立たす 持たす 走らす 帰らす 作らす
    取らす やらす 休ます 運ばす 払わす 手伝わす 座らす 歩かす 習わす 洗わす 聞かす 笑わす 泣かす
    吸わす 選ばす 並ばす 急がす
  `),
  cf: '未然形'
}
/** いただけませんか：kuromoji 把「いただけ」切成 い/た/だけ */
const ITADAKE: TokenSpec[] = [{ s: 'い', b: 'いる' }, { s: 'た' }, { s: 'だけ' }]
/** 〜ませんか、〜ますか、〜ないでしょうか…… */
const ASK: TokenSpec[][] = [
  [{ s: 'ませ' }, { s: 'ん' }, { s: 'か' }],
  [{ s: 'ませ' }, { s: 'ん' }, { s: 'でしょ' }, { s: 'う' }, { s: 'か' }],
  [{ s: 'ます' }, { s: 'か' }],
  [{ s: 'ない' }, { s: 'か' }],
  [{ s: 'ない' }, { s: 'でしょ' }, { s: 'う' }, { s: 'か' }]
]
/**
 * 复合动词的后一半（かける、出す、きる、合う）前面得是动词：kuromoji 偶尔把「て切れた」「ば合う」「なんだし」
 * 里的也标成补助动词，这些前面是助词、名词
 */
const NOT_VERB = words('て で が を に は も と ば の や か 、 なん ん')
/** 話しかける、呼びかける、はねかける 这类「向着别人、往上面」的かける（多半是一个词，切开的也挡掉） */
const NOT_TOWARD: TokenSpec = {
  b: [
    ...NOT_VERB,
    ...words(`
      話す 呼ぶ 笑う 微笑む ほほえむ 問う 語る 働く 投げる 押す 持つ 見せる 詰める 立てる 誘う 追う
      見る 訴える 歌う 吹く 振る 浴びせる 差す 囁く ささやく 叫ぶ はねる 跳ねる もたれる 凭れる 寄せる
      着せる かぶせる 被せる たれる
    `)
  ],
  ctx: true,
  not: true
}
/** 張り出す、流し出す、探し出す、思い出す 这类「向外」的出す（多半是一个词，切开的也挡掉） */
const NOT_OUTWARD: TokenSpec = {
  b: [
    ...NOT_VERB,
    ...words(`
      張る はる 流す ながす 探す さがす 思う おもう 取る とる 引く ひく 持つ もつ 連れる つれる
      呼ぶ よぶ 追う おう 差す さす 押す おす 貸す かす 作る つくる 生む 産む うむ 抜ける ぬける
      救う すくう 吐く はく 投げる なげる 乗る のる 売る うる 打つ うつ 聞く きく 誘う さそう 這う
      はう 見つける みつける 掘る ほる 締める しめる 突く つく 映す うつす 割る わる 弾く はじく
      切る 繰る 編む あむ 洗う あらう 絞る しぼる 搾る 送る おくる 運ぶ はこぶ 叩く たたく 見る みる
      選ぶ えらぶ 描く えがく 浮かぶ うかぶ 漏れる もれる 湧く わく 導く みちびく 織る
    `)
  ],
  ctx: true,
  not: true
}
/** 噛み切る、言い切る、割り切れる、煮え切らない 这类「切」的本义或成词的不算 */
const NOT_CUT: TokenSpec = {
  b: [
    ...NOT_VERB,
    ...words(`
      噛む かむ 言う いう 割る わる 煮える にえる 張る はる 締める しめる 踏む ふむ 振る ふる
      押す おす 打つ うつ 断つ たつ 出る でる 思う おもう 乗る のる 閉める 貸す かす 焼く 刈る かる
      叩く 千切る ちぎる 見る みる 掻く 突く つく 吹く ふく 引く ひく 区 横 仕 裏 途
    `)
  ],
  ctx: true,
  not: true
}
/** 混み合う（拥挤）、似合う、知り合う 这类不是「互相」 */
const NOT_MUTUAL: TokenSpec = {
  b: [
    ...NOT_VERB,
    ...words(`
      混む こむ 込む 似る にる 知る しる 付く つく 落ちる おちる 見る みる 釣る つる 噛む かむ
      巡る めぐる 取る とる
    `)
  ],
  ctx: true,
  not: true
}

const points: GrammarPoint[] = [
  P(
    'nitaishite',
    3,
    '〜に対して',
    '对于……；与……相对',
    'toward; in contrast to',
    '先生に対して、そんな言い方をしてはいけない。',
    [
      [{ s: ['に対して', 'に対し', 'に対する', 'に対しまして'] }],
      [{ s: 'に' }, { b: '対する', pos: '動詞' }]
    ]
  ),
  P(
    'nitotte',
    3,
    '〜にとって',
    '对……来说',
    'for, to (from the viewpoint of)',
    '私にとって、家族は何より大切です。',
    // 手にとって（拿在手里）、例にとって（举例）的とって 是动词「取る」
    [[{ s: ['手', '例'], ctx: true, not: true }, { s: 'にとって' }]]
  ),
  P(
    'nikanshite',
    3,
    '〜に関して／〜に関する',
    '关于……',
    'about, concerning',
    'この件に関して、何か質問はありますか。',
    [
      [{ s: ['に関して', 'に関する', 'に関し', 'に関しまして'] }],
      [{ s: 'に' }, { b: '関する', pos: '動詞' }]
    ]
  ),
  P(
    'nikurabete',
    3,
    '〜に比べて／〜と比べて',
    '跟……相比',
    'compared with',
    '去年に比べて、今年は雨が多い。',
    [
      // 比べてみる 是动词「比较」
      [
        { s: ['に', 'と'], p1: '格助詞' },
        { ...KURABE, cf: '連用形' },
        TE,
        { b: 'みる', ctx: true, not: true }
      ],
      [
        { s: ['に', 'と'], p1: '格助詞' },
        { ...KURABE, cf: '基本形' },
        { s: 'と', p1: '接続助詞' }
      ],
      [{ s: ['に', 'と'], p1: '格助詞' }, { ...KURABE, cf: '仮定形' }, { s: 'ば' }],
      [
        { s: 'に', p1: '格助詞' },
        { ...KURABE, cf: '連用形' },
        { s: '、', ctx: true }
      ]
    ]
  ),
  P(
    'nikawatte',
    3,
    '〜に代わって',
    '代替……',
    'in place of, on behalf of',
    '社長に代わって、部長が挨拶をしました。',
    [
      [{ s: 'に' }, { ...KAWARU, cf: '連用タ接続' }, TE],
      [{ s: 'に' }, { ...KAWARU, cf: '連用形' }],
      [{ s: 'に' }, { ...KAWARU, cf: '基本形' }]
    ]
  ),
  P(
    'kawarini',
    3,
    '〜かわりに',
    '代替；作为交换；虽然……但是',
    'instead of; in exchange for; but on the other hand',
    '母の代わりに、私が買い物に行きました。',
    // お代わり（再来一份）、代わりになる（能顶替）不算
    [
      [
        { pos: '接頭詞', ctx: true, not: true },
        { s: ['かわり', '代わり', '代り'], pos: '名詞' },
        { s: 'に' },
        { b: 'なる', ctx: true, not: true }
      ]
    ]
  ),
  P(
    'nishitagatte',
    3,
    '〜にしたがって',
    '随着……；按照……',
    'as; in accordance with',
    '山を登るにしたがって、気温が下がっていく。',
    [
      // 〜に従っている、〜に従います、〜に従いさえすれば 是动词「服从」
      [{ s: ['にしたがって', 'に従って', 'にしたがい', 'に従い'] }, NOT_OBEY],
      [{ s: 'に' }, { ...SHITAGAU, cf: '連用タ接続' }, TE, NOT_OBEY],
      [{ s: 'に' }, { ...SHITAGAU, cf: '連用形' }, { s: '、', ctx: true }]
    ]
  ),
  P(
    'nitsurete',
    3,
    '〜につれて',
    '随着……',
    'as (one thing changes, so does another)',
    '日本語が上手になるにつれて、友達が増えた。',
    // 公園につれて行く 是「带去」
    [
      [
        { s: ['につれて', 'につれ'] },
        { b: ['行く', 'いく', '来る', 'くる', '帰る', '戻る'], ctx: true, not: true }
      ]
    ]
  ),
  P(
    'wochuushinni',
    3,
    '〜を中心に／〜を中心として',
    '以……为中心',
    'centering on, mainly',
    'この町は駅を中心に発展してきた。',
    [
      [{ s: 'を' }, { s: '中心' }, { s: 'に' }],
      [{ s: 'を' }, { s: '中心' }, { s: 'として' }],
      [{ s: 'を' }, { s: '中心' }, { s: 'と' }, { b: 'する' }]
    ]
  ),
  P(
    'wotooshite',
    3,
    '〜を通して／〜を通じて',
    '通过……；在整个……期间',
    'through, via; throughout',
    '友達を通して、今の妻と知り合いました。',
    [
      [NOT_THROUGH, { s: ['を通して', 'を通じて', 'を通し', 'を通じ'] }],
      [NOT_THROUGH, { s: 'を' }, { b: ['とおす', 'つうじる'] }, TE],
      // 书面的「を通じ、」
      [
        NOT_THROUGH,
        { s: 'を' },
        { b: ['通じる', 'つうじる'], cf: '連用形' },
        { s: '、', ctx: true }
      ]
    ]
  ),
  P(
    'wokomete',
    3,
    '〜をこめて',
    '满怀……',
    'with (feeling), full of',
    '母のために、心をこめて料理を作った。',
    [
      [NOT_BULLET, { s: 'を' }, KOMERU, TE],
      [NOT_BULLET, { s: 'を' }, KOMERU, { s: 'た', pos: '助動詞' }]
    ]
  ),
  P(
    'toori',
    3,
    '〜とおり（に）／〜どおり（に）',
    '按照……',
    'as, just as, in the way that',
    '先生が言ったとおりに、やってみてください。',
    // 平假名的「とおり」：そのとおり（没错）不算；汉字的「通り」在の、ある后面分不出是不是「街道」
    // （駅前の通り、木のある通り），只认た、ている、言う、思う 这些后面的；二通り（两种）、〜通り（街名）不算
    [
      [{ pos: '連体詞', ctx: true, not: true }, { s: 'とおり', p1: '非自立' }, { s: 'に' }],
      [
        { pos: '連体詞', ctx: true, not: true },
        { s: 'とおり', p1: '非自立' }
      ],
      ...[
        { b: 'た', pos: '助動詞', ctx: true },
        { pos: '動詞', cf: '基本形', p1: '非自立', ctx: true },
        { b: SAY_THINK, cf: '基本形', ctx: true }
      ].flatMap((before) => [
        [before, { s: '通り', pos: '名詞' }, { s: 'に' }],
        [before, { s: '通り', pos: '名詞' }]
      ]),
      [{ p1: '固有名詞', ctx: true, not: true }, SUFFIX_TOORI, { s: 'に' }],
      [{ p1: '固有名詞', ctx: true, not: true }, SUFFIX_TOORI]
    ]
  ),
  P(
    'muke',
    3,
    '〜向け／〜向き',
    '面向……；适合……',
    'intended for; suitable for',
    'これは子ども向けの本だが、大人が読んでも面白い。',
    [
      [{ s: ['向け', 'むけ'], pos: '名詞', p1: '接尾' }],
      [NOT_DIRECTION, { s: ['向き', 'むき'], pos: '名詞', p1: '接尾' }]
    ]
  ),
  P(
    'toshitemo',
    3,
    '〜としても',
    '即使……也',
    'even if, even supposing',
    'たとえ失敗したとしても、後悔はしない。',
    // 名词后面的「としても」是「作为……也」（〜として）
    [
      [PLAIN_PRED, { s: 'として' }, { s: 'も' }],
      [PLAIN_AUX, { s: 'として' }, { s: 'も' }],
      [PLAIN_PRED, { s: 'と' }, { s: 'し' }, TE, { s: 'も' }],
      [PLAIN_AUX, { s: 'と' }, { s: 'し' }, TE, { s: 'も' }]
    ]
  ),
  P(
    'toshitara',
    3,
    '〜としたら／〜とすれば',
    '假如……的话',
    'if, supposing that',
    'もし宝くじが当たったとしたら、何に使いますか。',
    // 私としたら（以我来说）的と不是引用
    [
      [NOT_VOLITIONAL, { s: 'と', p2: '引用' }, { s: 'し' }, { s: 'たら' }],
      [NOT_VOLITIONAL, { s: 'と', p2: '引用' }, { s: 'すれ' }, { s: 'ば' }]
    ]
  ),
  P(
    'nishitemo',
    3,
    '〜にしても',
    '即使……也；……也好',
    'even if; whether … or …',
    '冗談にしても、それは言いすぎだ。',
    // 〜にしてもいい（可以弄成……）不算
    [
      [
        NOT_NA_STEM,
        ...NI_SHITE,
        { s: 'も' },
        {
          b: ['いい', 'よい', '良い', 'よろしい', 'かまう', '構う', '大丈夫'],
          ctx: true,
          not: true
        }
      ]
    ]
  ),
  P(
    'nishitewa',
    3,
    '〜にしては',
    '就……而言（却）',
    'for (a …), considering',
    'この子は小学生にしては、ずいぶん背が高い。',
    // 無駄にしてはいけない、明日にしてはどうですか、一日にしては成らず 不算
    [
      [
        NOT_NA_STEM,
        ...NI_SHITE,
        { s: 'は' },
        {
          b: ['いける', 'なる', '成る', 'だめ', '駄目', 'ダメ', 'どう', 'いかが', '如何'],
          ctx: true,
          not: true
        }
      ]
    ]
  ),
  P(
    'warini',
    3,
    '〜わりに（は）',
    '虽然……但是（出乎意料）',
    'considering, for',
    'この店の料理は、値段のわりにおいしい。',
    // 单独的副词「割に」（比较地）不算
    [
      [{ s: 'の', p1: '連体化', ctx: true }, WARI, { s: 'に' }, { s: 'は' }],
      [{ s: 'の', p1: '連体化', ctx: true }, WARI, { s: 'に' }],
      [{ pos: ['動詞', '形容詞', '助動詞'], ctx: true }, WARI, { s: 'に' }, { s: 'は' }],
      [{ pos: ['動詞', '形容詞', '助動詞'], ctx: true }, WARI, { s: 'に' }]
    ]
  ),
  P(
    'kuseni',
    3,
    '〜くせに',
    '明明……却（责怪）',
    'even though (critical)',
    '弟は自分では何もしないくせに、文句ばかり言う。',
    // 癖になる（上瘾）不算
    [[{ s: 'くせ', p1: '非自立' }, { s: 'に' }, { b: 'なる', ctx: true, not: true }]]
  ),
  P(
    'bayokatta',
    3,
    '〜ばよかった',
    '要是……就好了',
    'I wish I had …, should have …',
    'もっと早く家を出ればよかった。',
    [[{ s: 'ば', pos: '助詞' }, { ...II, cf: '連用タ接続' }, { s: 'た' }]]
  ),
  P(
    'ppoi',
    3,
    '〜っぽい',
    '有点像……；容易……',
    '-ish, -like; tending to',
    '彼はもう大人なのに、子どもっぽいところがある。',
    [
      // すっぽ抜ける、これっぽっち 的「っぽ」不算
      [{ s: ['っぽい', 'っぽく', 'っぽかっ', 'っぽけれ'], p1: '接尾' }],
      // 忘れっぽい、白っぽい 这些 kuromoji 当成一个词
      [
        {
          b: words(`
            忘れっぽい 白っぽい 黒っぽい 青っぽい 安っぽい 熱っぽい 理屈っぽい 水っぽい 湿っぽい
            荒っぽい 俗っぽい
          `)
        }
      ]
    ]
  ),
  P(
    'gachi',
    3,
    '〜がち',
    '往往……；容易……',
    'tend to, prone to',
    '冬は風邪をひきがちなので、気をつけてください。',
    [[{ s: 'がち', pos: '名詞', p1: '接尾' }]]
  ),
  P(
    'darake',
    3,
    '〜だらけ',
    '满是……',
    'full of, covered in',
    'この作文は間違いだらけだ。',
    // 动词だらける（懒散）不算
    [[{ s: 'だらけ', pos: '名詞', p1: '接尾' }]]
  ),
  P(
    'kake',
    3,
    '〜かけ（の）／〜かける',
    '做到一半；快要……',
    'half-done; about to',
    '机の上に、飲みかけのコーヒーが置いてある。',
    // 补助动词的かける（電話をかける 是自立的）、「飲みかけの」的名词かけ；読みかける、忘れかける 是一个词
    [
      [NOT_TOWARD, { b: 'かける', pos: '動詞', p1: '非自立' }],
      [
        { pos: '動詞', cf: '連用形', ctx: true },
        { s: 'かけ', pos: '名詞', p1: '非自立' }
      ],
      [{ b: ['読みかける', '忘れかける'] }]
    ]
  ),
  P(
    'ppanashi',
    3,
    '〜っぱなし',
    '一直……着（放着不管）',
    'leaving … (as it is); … all the time',
    'エアコンをつけっぱなしで寝てしまった。',
    [
      [{ s: ['っぱなし', 'っ放し'], pos: '名詞', p1: '接尾' }],
      [{ s: ['開けっぱなし', '開けっ放し'] }]
    ]
  ),
  P(
    'osoregaaru',
    3,
    '〜おそれがある',
    '有……的危险',
    'there is a risk that …',
    '明日は大雨になるおそれがあります。',
    // 平假名的「おそれ」kuromoji 切成 お/それ
    [
      [{ s: 'お', pos: '接頭詞' }, { s: 'それ' }, { s: ['が', 'も'] }, { b: 'ある' }],
      [{ s: ['恐れ', 'おそれ', '虞'] }, { s: ['が', 'も'] }, { b: 'ある' }],
      [{ s: 'お', pos: '接頭詞' }, { s: 'それ' }, { s: 'の' }, { b: 'ある' }],
      [{ s: ['恐れ', 'おそれ', '虞'] }, { s: 'の' }, { b: 'ある' }]
    ]
  ),
  P(
    'youtosuru',
    3,
    '〜（よ）うとする',
    '想要……；正要……',
    'try to; be about to',
    '家を出ようとしたとき、電話が鳴った。',
    // 〜ようとして 连て一起算（不然 〜として 会单列出来）
    [
      [VOLITIONAL, { s: 'と' }, { b: 'する' }, TE],
      [VOLITIONAL, { s: 'として' }],
      [VOLITIONAL, { s: 'と' }, { b: 'する' }]
    ]
  ),
  P(
    'youniiu',
    3,
    '〜ように言う／〜ように頼む',
    '叫（别人）……',
    'tell / ask someone to …',
    '医者にたばこをやめるように言われた。',
    // 次のように言った（如下所说）不算：ように 前面要是动词原形或ない
    [DICT_V, NAI_V].flatMap((before) => [
      [before, ...YOUNI, TELL],
      // 〜ようにと言う、〜ようにって言う
      [before, ...YOUNI, { s: ['と', 'って'] }, TELL]
    ])
  ),
  P(
    'kotoninatteiru',
    3,
    '〜ことになっている',
    '规定……；按约定……',
    'it is a rule that; be supposed to',
    'この学校では、制服を着ることになっている。',
    // 前面是动词原形、ない，或者「〜ということになっている」；大変なことになっている（事情闹大了）不算
    [DICT_V, NAI_V, TOIU].flatMap((before) => [
      [before, ...KOTONI, { s: 'なっ', b: 'なる' }, TE, { b: 'いる' }],
      [before, ...KOTONI, { s: 'なっ', b: 'なる' }, { b: 'てる' }],
      [before, ...KOTONI, { s: 'なっ', b: 'なる' }, TE, { b: 'ます', ctx: true }]
    ])
  ),
  P(
    'kotonishiteiru',
    3,
    '〜ことにしている',
    '（自己）一向坚持……',
    'make it a rule to …',
    '健康のため、毎朝三十分歩くことにしている。',
    [DICT_V, NAI_V].flatMap((before) => [
      [before, ...KOTONI, { s: 'し', b: 'する' }, TE, { b: 'いる' }],
      [before, ...KOTONI, { s: 'し', b: 'する' }, { b: 'てる' }],
      [before, ...KOTONI, { s: 'し', b: 'する' }, TE, { b: 'ます', ctx: true }]
    ])
  ),
  P(
    'sasetemorau',
    3,
    '〜させてもらう／〜させてください',
    '请允许我……',
    'let me …, allow me to …',
    '今日は体調が悪いので、早く帰らせてください。',
    [
      [
        CAUSATIVE,
        TE,
        { b: ['もらう', 'もらえる', 'いただく', 'いただける', 'くださる', '下さる'] }
      ],
      [CAUSATIVE, TE, ...ITADAKE, { b: ['ます', 'ない'], ctx: true }]
    ]
  ),
  P(
    'causativepassive',
    3,
    '〜（さ）せられる',
    '被迫……（使役被动）',
    'be made to … (causative passive)',
    '子どものころ、母にピアノを習わせられた。',
    [
      [CAUSATIVE, { pos: '動詞', p1: '接尾', b: 'られる' }],
      [SHORT_CAUSATIVE, { pos: '動詞', p1: '接尾', b: 'れる' }]
    ]
  ),
  P(
    'temoraenai',
    3,
    '〜てもらえませんか／〜ていただけませんか',
    '能不能请您……',
    'could you (please) … ?',
    'すみません、写真を撮ってもらえませんか。',
    ASK.flatMap((ask) => [
      [TE, { b: 'もらえる' }, ...ask],
      [TE, { b: 'いただける' }, ...ask],
      [TE, ...ITADAKE, ...ask]
    ])
  ),
  P(
    'dasu',
    3,
    '〜出す',
    '……起来（突然开始）',
    'start to … (suddenly)',
    '赤ちゃんが急に泣き出した。',
    // 补助动词的出す；取り出す、思い出す 这类「向外」的是一个词，不会切开
    [
      [NOT_OUTWARD, { b: '出す', pos: '動詞', p1: '非自立' }],
      // 平假名的だす 前面一定要是动词连用形（なんだし 的だし 不算）
      [
        { pos: '動詞', cf: '連用形', ctx: true },
        { b: 'だす', pos: '動詞', p1: '非自立' }
      ],
      [{ b: ['言い出す', '降り出す', '走り出す', '動き出す', '鳴り出す', '騒ぎ出す', '話し出す'] }]
    ]
  ),
  P(
    'kiru',
    3,
    '〜きる／〜きれない',
    '……完；……不完',
    'do completely; cannot finish',
    'こんなにたくさんの料理は、一人では食べきれない。',
    // 补助动词的きる、きれる；思い切る、張り切る 这类是一个词
    [
      [NOT_CUT, { b: ['きる', '切る'], pos: '動詞', p1: '非自立' }],
      [NOT_CUT, { b: ['きれる', '切れる'], pos: '動詞', p1: '非自立' }],
      [{ b: ['使い切る', '読み切る', '出し切る', '数え切れる'] }]
    ]
  ),
  P(
    'au',
    3,
    '〜合う',
    '互相……',
    'do … to each other',
    '家族は、困ったときに支え合うものだ。',
    // 补助动词的合う；似合う、間に合う、知り合う、混み合う 这类不算
    [
      [NOT_MUTUAL, { b: ['合う', 'あう'], pos: '動詞', p1: '非自立' }],
      [
        {
          b: words(`
            話し合う 助け合う 愛し合う 言い合う 分け合う 譲り合う 競い合う 向かい合う 抱き合う 語り合う
            重なり合う 奪い合う 補い合う 触れ合う 睨み合う 張り合う 絡み合う 溶け合う
          `)
        }
      ]
    ]
  )
]

/** 接续、自带例句的中英翻译、同组、另写的例句 */
const notes: Record<string, GrammarNote> = {
  nitaishite: {
    form: 'N + に対して · N + に対する + N · 普通形（なAな・Nな）+ のに対して',
    zh: '对老师不能用那种口气说话。',
    en: "You mustn't speak to your teacher like that.",
    group: 'about',
    more: [
      {
        ja: '兄はスポーツが好きなのに対して、弟は本が好きだ。',
        zh: '哥哥喜欢运动，而弟弟喜欢看书。',
        en: 'My older brother likes sports, whereas my younger brother likes books.'
      },
      {
        ja: '市民の質問に対して、市長は何も答えなかった。',
        zh: '对于市民的提问，市长什么也没有回答。',
        en: "The mayor gave no answer to the citizens' questions."
      }
    ]
  },
  nitotte: {
    form: 'N + にとって',
    zh: '对我来说，家人比什么都重要。',
    en: 'For me, family is more important than anything.',
    group: 'viewpoint',
    more: [
      {
        ja: 'この問題は、子どもにとってはちょっと難しいね。',
        zh: '这道题对孩子来说有点难吧。',
        en: "This problem is a bit hard for children, isn't it?"
      },
      {
        ja: '多くの留学生にとって、一番大変なのは漢字だ。',
        zh: '对很多留学生来说，最难的是汉字。',
        en: 'For many international students, the hardest part is kanji.'
      }
    ]
  },
  nikanshite: {
    form: 'N + に関して · N + に関する + N',
    zh: '关于这件事，有什么问题吗？',
    en: 'Do you have any questions about this matter?',
    group: 'about',
    more: [
      {
        ja: '図書館で、日本の歴史に関する本を借りた。',
        zh: '在图书馆借了关于日本历史的书。',
        en: 'I borrowed a book on Japanese history from the library.'
      },
      {
        ja: '新しい規則に関しては、来週詳しく説明します。',
        zh: '关于新规定，下周再详细说明。',
        en: 'We will explain the new rules in detail next week.'
      }
    ]
  },
  nikurabete: {
    form: 'N + に比べて / と比べて',
    zh: '跟去年相比，今年雨水多。',
    en: 'There has been more rain this year compared with last year.',
    group: 'compare',
    more: [
      {
        ja: '都会に比べると、この町は物価が安いですね。',
        zh: '跟大城市比起来，这个小城的物价很便宜呢。',
        en: "Compared with the big city, prices in this town are low, aren't they?"
      },
      {
        ja: '姉と比べて、私は料理が下手だ。',
        zh: '跟姐姐比，我做饭做得不好。',
        en: "Compared with my older sister, I'm bad at cooking."
      }
    ]
  },
  nikawatte: {
    form: 'N + に代わって · N + に代わる + N',
    zh: '部长代替社长致了辞。',
    en: 'The department manager gave a speech on behalf of the president.',
    more: [
      {
        ja: '今日は田中さんに代わって、私がご案内します。',
        zh: '今天由我代替田中先生为您带路。',
        en: "Today I'll be showing you around in place of Mr. Tanaka."
      },
      {
        ja: '石油に代わる新しいエネルギーが求められている。',
        zh: '人们在寻求能取代石油的新能源。',
        en: 'New sources of energy to replace oil are being sought.'
      }
    ]
  },
  kawarini: {
    form: '普通形（なAな・Nの）+ かわりに',
    zh: '我代替妈妈去买了东西。',
    en: 'I went shopping instead of my mother.',
    group: 'but',
    more: [
      {
        ja: '英語を教えるかわりに、日本語を教えてもらっている。',
        zh: '我教他英语，作为交换，他教我日语。',
        en: "In exchange for teaching English, I'm being taught Japanese."
      },
      {
        ja: 'この部屋は駅から遠いかわりに、家賃が安い。',
        zh: '这个房间离车站远，不过房租便宜。',
        en: 'This apartment is far from the station, but on the other hand the rent is cheap.'
      }
    ]
  },
  nishitagatte: {
    form: 'V辞書形 / N + にしたがって',
    zh: '越往山上爬，气温就越低。',
    en: 'As you climb the mountain, the temperature drops.',
    group: 'basis',
    more: [
      {
        ja: '係の人の指示にしたがって、順番に入ってください。',
        zh: '请按照工作人员的指示依次进入。',
        en: "Please follow the staff's instructions and go in one at a time."
      },
      {
        ja: '町が大きくなるに従って、交通の問題も増えてきた。',
        zh: '随着城市变大，交通问题也多了起来。',
        en: 'As the town grew, traffic problems increased too.'
      }
    ]
  },
  nitsurete: {
    form: 'V辞書形 / N + につれて',
    zh: '随着日语越来越好，朋友也多了起来。',
    en: 'As my Japanese improved, I made more friends.',
    group: 'basis',
    more: [
      {
        ja: '暗くなるにつれて、だんだん寒くなってきたね。',
        zh: '天越来越黑，也渐渐冷起来了呢。',
        en: "It's been getting colder as it gets darker, hasn't it?"
      },
      {
        ja: '時間がたつにつれ、町の様子も変わっていった。',
        zh: '随着时间流逝，城镇的面貌也变了。',
        en: 'As time went by, the town changed too.'
      }
    ]
  },
  wochuushinni: {
    form: 'N + を中心に / を中心として',
    zh: '这个城镇是以车站为中心发展起来的。',
    en: 'This town has grown up around the station.',
    more: [
      {
        ja: '今度の旅行では、古いお寺を中心に見て回りたい。',
        zh: '这次旅行我想以古寺为主到处看看。',
        en: "On this trip, I'd like to focus on visiting old temples."
      },
      {
        ja: 'このクラブは、大学生を中心として活動している。',
        zh: '这个俱乐部以大学生为主开展活动。',
        en: 'This club is run mainly by university students.'
      }
    ]
  },
  wotooshite: {
    form: 'N + を通して / を通じて',
    zh: '我通过朋友认识了现在的妻子。',
    en: 'I met my wife through a friend.',
    group: 'throughout',
    more: [
      {
        ja: 'この地方は一年を通して暖かい。',
        zh: '这个地区一年到头都很暖和。',
        en: 'This region is warm all year round.'
      },
      {
        ja: 'ボランティア活動を通じて、多くのことを学んだ。',
        zh: '通过志愿者活动，我学到了很多东西。',
        en: 'I learned a great deal through volunteer work.'
      }
    ]
  },
  wokomete: {
    form: 'N + をこめて · N + をこめた + N',
    zh: '我为妈妈用心做了一顿饭。',
    en: 'I put my heart into cooking a meal for my mother.',
    more: [
      {
        ja: '感謝の気持ちを込めて、みんなで歌を歌いましょう。',
        zh: '让我们满怀感激之情，一起唱首歌吧。',
        en: "Let's all sing a song to show our gratitude."
      },
      {
        ja: '祖母が願いを込めたお守りを、今も大切にしている。',
        zh: '奶奶寄托着心愿的护身符，我至今还珍藏着。',
        en: 'I still treasure the charm my grandmother filled with her wishes.'
      }
    ]
  },
  toori: {
    form: 'V辞書形 / Vた形 / Nの + とおり（に）· N + どおり（に）',
    zh: '请按照老师说的试着做做看。',
    en: 'Please try doing it the way the teacher said.',
    group: 'basis',
    more: [
      {
        ja: '説明書のとおりに組み立てたのに、うまく動かない。',
        zh: '明明是按照说明书组装的，却运转不正常。',
        en: "I put it together exactly as the manual said, but it doesn't work properly."
      },
      {
        ja: '工事は予定どおりに終わった。',
        zh: '工程按计划完成了。',
        en: 'The construction work finished on schedule.'
      }
    ]
  },
  muke: {
    form: 'N + 向け / 向き',
    zh: '这是给孩子看的书，不过大人读也很有意思。',
    en: "This is a children's book, but it's fun for adults to read too.",
    more: [
      {
        ja: 'この山は初心者向きなので、安心して登れますよ。',
        zh: '这座山适合新手，可以放心地爬。',
        en: 'This mountain is good for beginners, so you can climb it without worry.'
      },
      {
        ja: 'この番組は外国人向けに作られている。',
        zh: '这个节目是面向外国人制作的。',
        en: 'This program is made for foreigners.'
      }
    ]
  },
  toshitemo: {
    form: '普通形 + としても（失敗したとしても · 本当だとしても）',
    zh: '即使失败了，我也不后悔。',
    en: "Even if I fail, I won't regret it.",
    group: 'even-if',
    more: [
      {
        ja: '今から急いだとしても、もう間に合わないよ。',
        zh: '就算现在开始赶，也已经来不及了。',
        en: "Even if we hurry now, we won't make it in time."
      },
      {
        ja: 'その話が本当だとしても、すぐには信じられない。',
        zh: '即使那件事是真的，我也没法马上相信。',
        en: "Even if that story is true, I can't believe it right away."
      }
    ]
  },
  toshitara: {
    form: '普通形 + としたら / とすれば',
    zh: '假如中了彩票，你会用来做什么？',
    en: 'If you won the lottery, what would you spend the money on?',
    group: 'if',
    more: [
      {
        ja: '行くとしたら、来週の土曜日しかないね。',
        zh: '要去的话，只能是下周六了。',
        en: "If we go, it'll have to be next Saturday."
      },
      {
        ja: '駅まで歩くとすれば、三十分はかかるだろう。',
        zh: '如果走到车站的话，大概至少要三十分钟吧。',
        en: 'If we walked to the station, it would probably take at least thirty minutes.'
      }
    ]
  },
  nishitemo: {
    form: 'N / 普通形 + にしても',
    zh: '就算是开玩笑，那也说得太过分了。',
    en: "Even as a joke, that's going too far.",
    group: 'even-if',
    more: [
      {
        ja: '行くにしても行かないにしても、早めに連絡してね。',
        zh: '去也好不去也好，都早点告诉我哦。',
        en: 'Whether you go or not, let me know soon.'
      },
      {
        ja: 'いくら忙しいにしても、電話ぐらいはできたはずだ。',
        zh: '就算再忙，打个电话总是可以的吧。',
        en: 'However busy he was, he could at least have called.'
      }
    ]
  },
  nishitewa: {
    form: 'N / 普通形 + にしては',
    zh: '这孩子作为小学生来说，个子相当高。',
    en: 'This child is very tall for an elementary school student.',
    group: 'but',
    more: [
      {
        ja: '初めてにしては、上手にできましたね。',
        zh: '作为第一次来说，做得很好呢。',
        en: 'You did a good job for a first try.'
      },
      {
        ja: '十年も住んでいたにしては、町のことをあまり知らない。',
        zh: '都住了十年了，却不怎么了解这个城镇。',
        en: "For someone who lived here for ten years, he doesn't know much about the town."
      }
    ]
  },
  warini: {
    form: '普通形（なAな・Nの）+ わりに（は）',
    zh: '这家店的菜，就价格来说很好吃。',
    en: 'The food at this restaurant is good for the price.',
    group: 'but',
    more: [
      {
        ja: '田中さんって、よく食べるわりには太らないよね。',
        zh: '田中吃得挺多，却不怎么胖呢。',
        en: "Tanaka eats a lot, but he doesn't put on weight, does he?"
      },
      {
        ja: 'たくさん勉強したわりに、試験の点数はよくなかった。',
        zh: '学了那么多，考试分数却不理想。',
        en: "Considering how much I studied, my test score wasn't good."
      }
    ]
  },
  kuseni: {
    form: '普通形（なAな・Nの）+ くせに',
    zh: '弟弟自己什么都不做，却光会抱怨。',
    en: 'My younger brother never does anything himself, yet all he does is complain.',
    group: 'but',
    more: [
      {
        ja: '知っているくせに、どうして教えてくれないの？',
        zh: '你明明知道，为什么不告诉我？',
        en: "You know perfectly well, so why won't you tell me?"
      },
      {
        ja: '子どものくせに、大人のような口をきく。',
        zh: '明明是个孩子，说起话来却像个大人。',
        en: "He's only a child, yet he talks like an adult."
      }
    ]
  },
  bayokatta: {
    form: '出る → 出ればよかった · 言わない → 言わなければよかった',
    zh: '要是早点出门就好了。',
    en: 'I should have left home earlier.',
    more: [
      {
        ja: 'あんなこと、言わなければよかったな。',
        zh: '要是没说那种话就好了。',
        en: "I wish I hadn't said that."
      },
      {
        ja: '傘を持ってくればよかったと思いながら、駅まで走った。',
        zh: '我一边想着要是带了伞就好了，一边跑到了车站。',
        en: 'I ran to the station, wishing I had brought an umbrella.'
      }
    ]
  },
  ppoi: {
    form: 'N / Vます形 + っぽい（子どもっぽい · 怒りっぽい）',
    zh: '他已经是大人了，却还有孩子气的地方。',
    en: "He's already an adult, but he has a childish side.",
    group: 'seem',
    more: [
      {
        ja: 'この服、ちょっと学生っぽくない？',
        zh: '这件衣服是不是有点学生气？',
        en: "Doesn't this outfit look a bit like something a student would wear?"
      },
      {
        ja: '父は年をとって、怒りっぽくなった。',
        zh: '父亲上了年纪，变得爱发脾气了。',
        en: 'My father has become short-tempered with age.'
      }
    ]
  },
  gachi: {
    form: 'Vます形 / N + がち',
    zh: '冬天容易感冒，请多注意。',
    en: 'People tend to catch colds in winter, so please take care.',
    group: 'tend',
    more: [
      {
        ja: '休みの日は、つい寝坊しがちだ。',
        zh: '休息日总是容易睡懒觉。',
        en: 'On my days off, I tend to sleep in.'
      },
      {
        ja: '彼女は子どものころ、病気がちだった。',
        zh: '她小时候体弱多病。',
        en: 'She was often ill as a child.'
      }
    ]
  },
  darake: {
    form: 'N + だらけ',
    zh: '这篇作文错误百出。',
    en: 'This composition is full of mistakes.',
    group: 'only',
    more: [
      {
        ja: '子どもたちは泥だらけになって帰ってきた。',
        zh: '孩子们弄得满身是泥回来了。',
        en: 'The children came home covered in mud.'
      },
      {
        ja: '長い間だれも住んでいない部屋は、ほこりだらけだった。',
        zh: '那个很久没人住的房间里满是灰尘。',
        en: 'The room, where no one had lived for a long time, was covered in dust.'
      }
    ]
  },
  kake: {
    form: 'Vます形 + かけ（の + N）/ かける',
    zh: '桌上放着喝了一半的咖啡。',
    en: "There's a half-finished cup of coffee on the desk.",
    more: [
      {
        ja: '彼は何か言いかけて、やめた。',
        zh: '他话说到一半，又不说了。',
        en: 'He started to say something, then stopped.'
      },
      {
        ja: '消えかけていた火が、また明るく燃え始めた。',
        zh: '快要熄灭的火又旺了起来。',
        en: 'The fire, which had been dying out, began to burn brightly again.'
      }
    ]
  },
  ppanashi: {
    form: 'Vます形 + っぱなし',
    zh: '开着空调就睡着了。',
    en: 'I fell asleep with the air conditioner left on.',
    more: [
      {
        ja: '水を出しっぱなしにしないで。',
        zh: '别让水一直开着。',
        en: "Don't leave the water running."
      },
      {
        ja: '今日は一日中立ちっぱなしで、足が痛い。',
        zh: '今天站了一整天，脚很疼。',
        en: "I've been on my feet all day today, and my legs hurt."
      }
    ]
  },
  osoregaaru: {
    form: 'V辞書形 / Nの + おそれがある',
    zh: '明天有下大雨的危险。',
    en: 'There is a risk of heavy rain tomorrow.',
    group: 'guess',
    more: [
      {
        ja: '今夜は大雪のおそれがあるから、早めに帰ろう。',
        zh: '今晚可能会下大雪，早点回去吧。',
        en: "There's a risk of heavy snow tonight, so let's head home early."
      },
      {
        ja: 'この薬を飲むと、眠くなる恐れがある。',
        zh: '服用这种药可能会犯困。',
        en: 'This medicine may make you drowsy.'
      }
    ]
  },
  youtosuru: {
    form: '行く → 行こうとする · 食べる → 食べようとする',
    zh: '正要出门的时候，电话响了。',
    en: 'Just as I was about to leave the house, the phone rang.',
    group: 'think',
    more: [
      {
        ja: '息子は野菜を全然食べようとしない。',
        zh: '儿子根本不肯吃蔬菜。',
        en: "My son won't even try to eat vegetables."
      },
      {
        ja: '何度も思い出そうとしたが、名前が出てこなかった。',
        zh: '我好几次试着回想，名字却怎么也想不起来。',
        en: "I tried again and again to remember, but the name wouldn't come to me."
      }
    ]
  },
  youniiu: {
    form: 'V辞書形 / Vない形 + ように言う / 頼む',
    zh: '医生让我戒烟。',
    en: 'My doctor told me to quit smoking.',
    more: [
      {
        ja: '田中さんに、あとで電話するように伝えてください。',
        zh: '请转告田中先生，让他待会儿给我打电话。',
        en: 'Please tell Mr. Tanaka to call me later.'
      },
      {
        ja: '母に、帰りに牛乳を買ってくるように頼まれた。',
        zh: '妈妈让我回来的路上买牛奶。',
        en: 'My mother asked me to pick up some milk on the way home.'
      }
    ]
  },
  kotoninatteiru: {
    form: 'V辞書形 / Vない形 + ことになっている',
    zh: '这所学校规定要穿校服。',
    en: 'At this school, students are supposed to wear uniforms.',
    group: 'become',
    more: [
      {
        ja: '会議は三時から始まることになってるよ。',
        zh: '会议定好三点开始哦。',
        en: 'The meeting is supposed to start at three.'
      },
      {
        ja: '図書館の本は、二週間以内に返すことになっています。',
        zh: '图书馆的书规定两周内归还。',
        en: 'Library books are to be returned within two weeks.'
      }
    ]
  },
  kotonishiteiru: {
    form: 'V辞書形 / Vない形 + ことにしている',
    zh: '为了健康，我坚持每天早上走三十分钟。',
    en: 'For my health, I make a point of walking for thirty minutes every morning.',
    group: 'resolve',
    more: [
      {
        ja: '夜は甘いものを食べないことにしてるんだ。',
        zh: '我晚上一向不吃甜食。',
        en: 'I make it a rule not to eat sweets at night.'
      },
      {
        ja: '分からない言葉は、すぐ辞書で調べることにしています。',
        zh: '遇到不懂的词，我总是马上查词典。',
        en: "I make a habit of looking up words I don't know in the dictionary right away."
      }
    ]
  },
  sasetemorau: {
    form: '帰る → 帰らせてもらう / 帰らせてください · する → させていただく',
    zh: '今天身体不舒服，请让我早点回去。',
    en: "I'm not feeling well today, so please let me go home early.",
    more: [
      {
        ja: 'それでは、私から説明させていただきます。',
        zh: '那么，请允许我来说明一下。',
        en: 'Well then, allow me to explain.'
      },
      {
        ja: '店長に頼んで、一日休ませてもらった。',
        zh: '我拜托店长，让我休息了一天。',
        en: 'I asked the manager, and he let me take a day off.'
      }
    ]
  },
  causativepassive: {
    form: '習う → 習わせられる（習わされる）· 食べる → 食べさせられる · する → させられる',
    zh: '小时候，妈妈逼着我学钢琴。',
    en: 'When I was a child, my mother made me take piano lessons.',
    more: [
      {
        ja: '昨日は課長に、夜遅くまで残業させられたよ。',
        zh: '昨天被科长逼着加班到深夜。',
        en: 'Yesterday my boss made me work overtime until late at night.'
      },
      {
        ja: '嫌いな野菜を無理に食べさせられた。',
        zh: '被逼着吃了讨厌的蔬菜。',
        en: 'I was forced to eat vegetables I hate.'
      }
    ]
  },
  temoraenai: {
    form: 'Vて形 + もらえませんか / いただけませんか',
    zh: '不好意思，能帮我拍张照片吗？',
    en: 'Excuse me, could you take a picture for me?',
    group: 'want',
    more: [
      {
        ja: 'もう一度、説明していただけませんか。',
        zh: '能请您再说明一遍吗？',
        en: 'Could you please explain it once more?'
      },
      {
        ja: 'ペンを貸してもらえないでしょうか。',
        zh: '能不能借我一支笔呢？',
        en: 'Would you mind lending me a pen?'
      }
    ]
  },
  dasu: {
    form: 'Vます形 + 出す（泣き出す · 言い出す）',
    zh: '婴儿突然哭了起来。',
    en: 'The baby suddenly started crying.',
    more: [
      {
        ja: '彼の話を聞いて、みんな笑い出したんだ。',
        zh: '听了他的话，大家都笑了起来。',
        en: 'When they heard his story, everyone burst out laughing.'
      },
      {
        ja: '春になると、桜がいっせいに咲き出す。',
        zh: '一到春天，樱花就一齐开了起来。',
        en: 'When spring comes, the cherry trees all start to bloom at once.'
      }
    ]
  },
  kiru: {
    form: 'Vます形 + きる / きれない',
    zh: '这么多菜，一个人吃不完。',
    en: "I can't eat this much food by myself.",
    more: [
      {
        ja: '一晩で、その長い小説を読みきった。',
        zh: '一个晚上就把那本长篇小说读完了。',
        en: 'I read that long novel from cover to cover in a single night.'
      },
      {
        ja: '毎日残業で、もう疲れきってるよ。',
        zh: '每天都加班，我已经累坏了。',
        en: "I've been working overtime every day, and I'm completely worn out."
      }
    ]
  },
  au: {
    form: 'Vます形 + 合う（話し合う · 助け合う）',
    zh: '家人就是要在困难的时候互相扶持。',
    en: 'Family members should support each other in hard times.',
    more: [
      {
        ja: '分からないところは、みんなで教え合おう。',
        zh: '不懂的地方，大家互相教吧。',
        en: "Let's teach each other the parts we don't understand."
      },
      {
        ja: '二人は黙って見つめ合っていた。',
        zh: '两个人默默地互相凝视着。',
        en: 'The two of them gazed at each other in silence.'
      }
    ]
  }
}

const lessons: LessonSpec[] = [
  {
    id: 'n3-1',
    title: { zh: '对象与立场', en: 'Targets and viewpoints' },
    items: ['nitotte', 'nitaishite', 'nikanshite', 'muke']
  },
  {
    id: 'n3-4',
    title: { zh: '比较与代替', en: 'Comparison and substitution' },
    items: ['nikurabete', 'kawarini', 'nikawatte']
  },
  {
    id: 'n3-7',
    title: { zh: '随着与按照', en: '“As” and “in accordance with”' },
    items: ['nitsurete', 'nishitagatte', 'toori']
  },
  {
    id: 'n3-8',
    title: { zh: '「を」开头的句型', en: 'Patterns starting with を' },
    items: ['wochuushinni', 'wotooshite', 'wokomete']
  },
  {
    id: 'n3-11',
    title: { zh: '复合动词', en: 'Compound verbs' },
    items: ['dasu', 'kiru', 'au', 'kake']
  },
  {
    id: 'n3-12',
    title: { zh: '倾向与样子', en: 'Tendencies and appearances' },
    items: ['ppoi', 'gachi', 'darake', 'ppanashi', 'osoregaaru']
  },
  {
    id: 'n3-16',
    title: { zh: '意图、嘱咐与规定', en: 'Attempts, requests and rules' },
    items: ['youtosuru', 'youniiu', 'kotoninatteiru', 'kotonishiteiru']
  },
  {
    id: 'n3-17',
    title: { zh: '请求、允许与被迫', en: 'Asking, permission and being made to' },
    items: ['temoraenai', 'sasetemorau', 'causativepassive']
  },
  {
    id: 'n3-18',
    title: { zh: '假定、让步与后悔', en: 'Suppositions, concessions and regrets' },
    items: ['toshitara', 'toshitemo', 'nishitemo', 'bayokatta']
  },
  {
    id: 'n3-19',
    title: { zh: '出乎意料与责怪', en: 'Unexpected contrasts and blame' },
    items: ['warini', 'nishitewa', 'kuseni']
  }
]

export const N3B_GRAMMAR: LevelGrammar = { points, notes, lessons }
