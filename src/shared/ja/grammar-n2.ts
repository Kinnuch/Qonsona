/**
 * JLPT N2 的语法（一）：理由、转折、附加，「こと」「もの」的句型，情不自禁、难以、断定。
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

/** 前面是谓语（动词、形容词、助动词）：只看不算 */
const PRED: TokenSpec = { pos: ['動詞', '形容詞', '助動詞'], ctx: true }
/** 前面是动词原形：只看不算 */
const V_DICT: TokenSpec = { pos: '動詞', cf: '基本形', ctx: true }
/** 前面是动词连用形（ます形）：只看不算 */
const V_STEM: TokenSpec = { pos: '動詞', cf: '連用形', ctx: true }
/** 〜ません */
const MASEN: TokenSpec[] = [{ s: 'ませ' }, { s: 'ん' }]
/** 一串后面接上否定的结尾（ない・なかった、ぬ・ず、ません），各成一串 */
const negated = (head: TokenSpec[]): TokenSpec[][] => [
  [...head, { b: ['ない', 'ぬ'] }],
  [...head, ...MASEN]
]
/** という：多半切成一个词，写成汉字的是 と + 言う */
const TOIU: TokenSpec[][] = [
  [{ s: 'という' }],
  [{ s: 'と' }, { b: ['言う', 'いう'], cf: '基本形' }]
]
/** ではない／でもない／じゃない（与 ありません） */
const DEWANAI: TokenSpec[][] = [
  [{ s: 'で' }, { s: ['は', 'も'] }, { b: 'ない' }],
  [{ s: 'で' }, { s: ['は', 'も'] }, { s: 'あり' }, ...MASEN],
  [{ s: 'じゃ' }, { b: 'ない' }],
  [{ s: 'じゃ' }, { s: 'あり' }, ...MASEN]
]
/** 〜ほかない 的结尾：ない／はない／ありません／はありません */
const HOKA_TAIL: TokenSpec[][] = [
  [{ b: 'ない' }],
  [{ s: 'は' }, { b: 'ない' }],
  [{ s: 'あり' }, ...MASEN],
  [{ s: 'は' }, { s: 'あり' }, ...MASEN]
]
const HOKA: TokenSpec = { s: ['ほか', '他', '外'] }
/** 〜ずには／〜ないでは（なしではいられない 不算） */
const ZUNI: TokenSpec[][] = [
  [{ s: 'ず' }, { s: 'に' }],
  [{ s: 'ない' }, { s: 'で' }]
]
/** 后面的 いられ：「はいら」有时被切成一个词（入る） */
const IRARE: TokenSpec[][] = [
  [{ s: 'は' }, { b: 'いる' }, { b: 'られる' }],
  [{ s: 'はいら' }, { b: 'れる' }]
]
/** 〜ようがない 的 よう（直しよう、答えよう） */
const YOU: TokenSpec = { s: 'よう', pos: '名詞', p1: '接尾' }
const NAGARA: TokenSpec = { s: 'ながら', p1: '接続助詞' }
const KANE: TokenSpec = { b: 'かねる', p1: '非自立' }
const SHIRO: TokenSpec = { b: 'する', cf: ['命令ｒｏ', '命令ｙｏ'] }
/** 驚いた、残念な、うれしい：表示心情的词 */
const FEELING: TokenSpec[] = [
  { pos: '形容詞', ctx: true },
  { pos: '助動詞', b: ['た', 'だ'], ctx: true }
]

const points: GrammarPoint[] = [
  // ── 理由与「既然」 ──
  P(
    'karakoso',
    2,
    '〜からこそ',
    '正因为……',
    'precisely because',
    'あなたのことを思うからこそ、厳しく言うのです。',
    [[{ s: 'から', p1: '接続助詞' }, { s: 'こそ' }], [{ s: 'だからこそ' }]]
  ),
  P(
    'ijou',
    2,
    '〜以上（は）',
    '既然……',
    'since; as long as',
    '約束した以上は、守らなければならない。',
    [
      [PRED, { s: '以上' }, { s: 'は' }],
      // 思った以上に、期待した以上の 是「超过」
      [PRED, { s: '以上' }, { s: ['に', 'の', 'だ', 'です', 'で', 'な'], ctx: true, not: true }]
    ]
  ),
  P(
    'karaniwa',
    2,
    '〜からには',
    '既然……就',
    'now that; having (decided) to',
    '試合に出るからには、勝ちたい。',
    [[{ s: 'からには' }], [PRED, { s: 'から' }, { s: 'に' }, { s: 'は' }]]
  ),
  P(
    'bakarini',
    2,
    '〜ばかりに',
    '就因为……（才落得不好的结果）',
    'just because (with a bad result)',
    'うそをついたばかりに、友達を失ってしまった。',
    // 言わんばかりに、張り裂けんばかりに（简直像要……）不算；〜ばかりになる 是「只等……」
    [
      { pos: ['動詞', '形容詞'], cf: '基本形', ctx: true },
      { pos: '助動詞', b: ['た', 'ない', 'たい', 'だ'], ctx: true }
    ].map((before: TokenSpec) => [
      before,
      { s: 'ばかり' },
      { s: 'に' },
      { b: 'なる', ctx: true, not: true }
    ])
  ),

  // ── 转折与让步 ──
  P(
    'monono',
    2,
    '〜ものの',
    '虽然……但是',
    'although',
    '新しい自転車を買ったものの、まだ一度も乗っていない。',
    // 派生したものの一つ、素早いもののたとえ（もの + の）不算
    [[PRED, { s: 'ものの', pos: '助詞' }, { pos: '名詞', ctx: true, not: true }]]
  ),
  P(
    'nagaramo',
    2,
    '〜ながら（も）',
    '虽然……',
    'although; while',
    'この部屋は狭いながらも、日当たりがいい。',
    [
      [NAGARA, { s: 'も', pos: '助詞' }],
      // 残念ながら、狭いながら：前面是名词、形容词的（昔ながらの、涙ながらに 不算）
      [{ pos: ['形容詞', '名詞'], ctx: true }, NAGARA, { s: ['の', 'に'], ctx: true, not: true }],
      // 知っていながら、学生でありながら、知りながら
      [{ b: 'いる', p1: '非自立', ctx: true }, NAGARA],
      [{ b: ['ある', '知る'], ctx: true }, NAGARA]
    ]
  ),
  P(
    'nimokakawarazu',
    2,
    '〜にもかかわらず',
    '尽管……',
    'despite; even though',
    '雨にもかかわらず、たくさんの人が集まった。',
    [[{ s: 'に' }, { s: 'も' }, { b: ['かかわる', '関わる', '拘わる', '拘る'] }, { s: 'ず' }]]
  ),
  P(
    'toittemo',
    2,
    '〜といっても',
    '虽说……',
    'although; even though (I say)',
    '料理ができるといっても、簡単なものだけです。',
    // 何といっても（毕竟）、といってもいい・と言っても過言ではない（可以说）不算
    [
      [
        { s: ['何', 'なん'], ctx: true, not: true },
        { s: 'と' },
        { b: ['言う', 'いう'] },
        TE,
        { s: 'も' },
        { b: ['いい', 'よい', '良い', '過言', '差し支える', '差支える'], ctx: true, not: true }
      ]
    ]
  ),
  P(
    'karatoitte',
    2,
    '〜からといって',
    '虽说……但也不能',
    "just because … (doesn't mean)",
    '高いからといって、品質がいいとは限らない。',
    [
      [{ s: 'から', p1: '接続助詞' }, { s: 'と' }, { b: ['言う', 'いう'] }, TE],
      [{ s: 'だからといって' }]
    ]
  ),
  P(
    'nishiro',
    2,
    '〜にしろ／〜にせよ',
    '即使……也；无论……',
    'even if; whether … or …',
    '行くにしろ行かないにしろ、早めに連絡してください。',
    // 后面接着说下去的才算（静かにしろ。いい加減にしろっつの、しろったら 这类命令不算：
    // っ 是连用タ接续的动词）
    [
      { s: '、', ctx: true },
      { pos: ['名詞', '形容詞', '副詞', '連体詞', '接頭詞'], ctx: true },
      { pos: '動詞', cf: ['基本形', '未然形', '連用形'], ctx: true }
    ].map((after: TokenSpec) => [{ s: 'に', p1: '格助詞' }, SHIRO, after])
  ),

  // ── 附加、对比与前提 ──
  P(
    'ueni',
    2,
    '〜うえに',
    '不仅……而且',
    'not only … but also',
    'このレストランは安いうえに、料理もおいしい。',
    [[PRED, { s: ['うえ', '上'] }, { s: 'に' }]]
  ),
  P(
    'ippou',
    2,
    '〜一方（で）',
    '一方面……另一方面',
    'while; on the other hand',
    '仕事は楽しい一方で、責任も重い。',
    [
      // 増える一方である（一个劲儿地……）不算
      [PRED, { s: '一方' }, { s: 'で' }, { b: 'ある', ctx: true, not: true }],
      [PRED, { s: '一方' }, { s: '、', ctx: true }]
    ]
  ),
  P(
    'uede',
    2,
    '〜上で／〜上の',
    '在……之后；在……方面',
    'after (doing); when it comes to',
    '家族と相談した上で、お返事します。',
    [
      [{ pos: ['動詞', '助動詞'], ctx: true }, { s: ['上', 'うえ'] }, { s: 'で' }],
      [
        { pos: ['動詞', '助動詞'], ctx: true },
        { s: ['上', 'うえ'] },
        { s: 'の' },
        { pos: '名詞', ctx: true }
      ]
    ]
  ),
  P(
    'tekarademonai',
    2,
    '〜てからでないと',
    '不先……就不能',
    'not until (after) …',
    '料金を払ってからでないと、中に入れません。',
    [
      [TE, { s: 'から' }, { s: ['で', 'じゃ'] }, { s: 'ない' }, { s: 'と' }],
      [TE, { s: 'から' }, { s: 'で' }, { s: 'なけれ' }, { s: 'ば' }]
    ]
  ),

  // ── 「こと」的句型 ──
  P(
    'kotokara',
    2,
    '〜ことから',
    '由于……；从……来看',
    'from the fact that; because',
    '星の形に似ていることから、この名前がついた。',
    // できることから始める（从……开始）、言っていることからすれば（从……来看，N2 的 からすると）不算
    [
      [
        PRED,
        { s: 'こと' },
        { s: 'から', p1: '格助詞' },
        { b: ['始める', 'はじめる', 'する'], ctx: true, not: true }
      ]
    ]
  ),
  P(
    'kotonaku',
    2,
    '〜ことなく',
    '不……（而……）',
    'without (doing)',
    '彼は休むことなく、朝まで働き続けた。',
    // 〜こともなくなった（不再……）不算
    [
      [V_DICT, { s: 'こと' }, { s: 'なく' }, { b: 'なる', ctx: true, not: true }],
      [V_DICT, { s: 'こと' }, { s: 'も' }, { s: 'なく' }, { b: 'なる', ctx: true, not: true }]
    ]
  ),
  P(
    'naikotoniwa',
    2,
    '〜ないことには',
    '不……的话就……',
    'unless …',
    '実際に使ってみないことには、よさは分からない。',
    [[{ b: 'ない' }, { s: 'こと' }, { s: 'に' }, { s: 'は' }]]
  ),
  P(
    'kotoni',
    2,
    '〜ことに（は）',
    '令人……的是',
    "to one's (surprise, regret …)",
    '驚いたことに、彼はもう全部覚えていた。',
    // 驚いたことに、残念なことに、うれしいことには：后面跟读点（ことにする、ことに気づく 不算）
    FEELING.flatMap((before) => [
      [before, { s: 'こと' }, { s: 'に' }, { s: 'は' }, { s: '、', ctx: true }],
      [before, { s: 'こと' }, { s: 'に' }, { s: '、', ctx: true }]
    ])
  ),
  P(
    'kotoka',
    2,
    '〜ことか',
    '多么……啊',
    'how (very) …!',
    '合格の知らせを聞いて、どんなにうれしかったことか。',
    // ということか（是说……吗）、ことかと思う、どうしたことか（怎么回事）不算
    [
      [
        { s: 'どう', ctx: true, not: true },
        { ctx: true },
        PRED,
        { s: 'こと' },
        { s: 'か', pos: '助詞' },
        { pos: '助詞', ctx: true, not: true }
      ]
    ]
  ),

  // ── 「もの」的句型 ──
  P(
    'monogaaru',
    2,
    '〜ものがある',
    '有……之处',
    'there is something … about',
    '彼の歌には、人の心を動かすものがある。',
    // 实指「有……的东西」的不算：以下のようなものがあります、何か新しいものがある、
    // 気に入るものがありません（否定）、食べるものがありますか（问句）
    [
      [
        { s: ['よう', 'か'], ctx: true, not: true },
        PRED,
        { s: 'もの' },
        { s: 'が' },
        { b: 'ある', pos: '動詞' },
        { s: ['ませ', 'か'], ctx: true, not: true },
        { s: 'か', ctx: true, not: true }
      ]
    ]
  ),
  P(
    'mononara',
    2,
    '〜ものなら',
    '如果能……的话',
    'if (only) one could …',
    '戻れるものなら、学生時代に戻りたい。',
    [
      [V_DICT, { s: ['もの', 'もん'] }, { s: 'なら' }],
      // 〜ようものなら（要是……的话，可就糟了）
      [{ pos: '助動詞', b: ['う', 'よう'], ctx: true }, { s: ['もの', 'もん'] }, { s: 'なら' }]
    ]
  ),
  P(
    'monoka',
    2,
    '〜ものか',
    '才不……呢',
    "no way (I'll) …",
    'あんな店、二度と行くものか。',
    // どうしたものか、ないものか（想办法、盼望）不算：前面只要动词原形
    [
      [
        V_DICT,
        { s: ['もの', 'もん'] },
        { s: 'か', pos: '助詞' },
        { pos: '助詞', ctx: true, not: true }
      ],
      [V_DICT, { s: ['もの', 'もん'] }, { s: 'です' }, { s: 'か', pos: '助詞' }]
    ]
  ),
  P(
    'toiumonoda',
    2,
    '〜というものだ',
    '这就是……（下结论）',
    "that's what … is",
    '困ったときに助け合うのが、友達というものだ。',
    // というものではない（未必……）不算
    TOIU.map((t) => [...t, { s: ['もの', 'もん'] }, { s: ['だ', 'です', 'だろ', 'でしょ'] }])
  ),

  // ── 情不自禁与不得不 ──
  P(
    'zuniwairarenai',
    2,
    '〜ずにはいられない／〜ないではいられない',
    '不由得……',
    "can't help (doing)",
    'その映画を見て、泣かずにはいられなかった。',
    ZUNI.flatMap((head) => IRARE.flatMap((ir) => negated([...head, ...ir])))
  ),
  P(
    'tenaranai',
    2,
    '〜てならない',
    '……得不得了；总觉得……',
    "terribly; can't help feeling",
    '試験の結果が気になってならない。',
    [
      // 〜なくてならない（得……）不算
      ...negated([{ b: 'ない', ctx: true, not: true }, TE, { b: 'なる', s: ['なら', 'なり'] }]),
      // 残念でならない
      ...negated([
        { s: 'で', pos: '助動詞' },
        { b: 'なる', s: ['なら', 'なり'] }
      ])
    ]
  ),
  P(
    'zaruwoenai',
    2,
    '〜ざるを得ない',
    '不得不……',
    'have no choice but to …',
    '台風が来るので、旅行は中止せざるを得ない。',
    negated([{ s: 'ざる' }, { s: 'を' }, { b: ['得る', 'える'] }])
  ),
  P(
    'hokanai',
    2,
    '〜ほかない／〜よりほかない',
    '只好……',
    'the only thing to do is …',
    '終電に乗り遅れたので、歩いて帰るほかない。',
    [
      ...HOKA_TAIL.map((tail) => [V_DICT, HOKA, ...tail]),
      ...HOKA_TAIL.map((tail) => [V_DICT, { s: 'より' }, HOKA, ...tail])
    ]
  ),

  // ── 难以与不可能 ──
  P('gatai', 2, '〜がたい', '难以……', 'hard to …', '彼がそんなことをしたとは、信じがたい。', [
    // ありがたく 会被切成 あり + がたく
    [
      { b: 'ある', ctx: true, not: true },
      { b: ['がたい', '難い'], p1: '非自立' }
    ],
    // 切成一个词的
    [{ s: ['得がたい', '耐えがたい', '得難い', '耐え難い'] }]
  ]),
  P(
    'kaneru',
    2,
    '〜かねる',
    '难以……（礼貌地拒绝）',
    'cannot (polite refusal)',
    'そのご質問には、お答えしかねます。',
    [
      [{ pos: '動詞', ctx: true }, KANE, { s: 'ます' }],
      [{ pos: '動詞', ctx: true }, KANE]
    ]
  ),
  P(
    'kanenai',
    2,
    '〜かねない',
    '很可能会……（不好的事）',
    'could well (something bad)',
    'そんな運転をしていたら、事故を起こしかねない。',
    negated([{ pos: '動詞', ctx: true }, KANE])
  ),
  P(
    'eru',
    2,
    '〜得る／〜得ない',
    '可能……／不可能……',
    'can possibly; cannot possibly',
    'そんなことはあり得ない。',
    [
      [V_STEM, { b: ['得る', 'える'], p1: '非自立' }, { b: 'ない' }],
      [V_STEM, { b: ['得る', 'うる'], p1: '非自立' }],
      // 假名的「える」只认 ありえる（すげえ 会被切成 すげ + え）
      [
        { b: 'ある', ctx: true },
        { b: 'える', p1: '非自立' }
      ]
    ]
  ),
  P(
    'kkonai',
    2,
    '〜っこない',
    '不可能……',
    'there is no way …',
    'こんなにたくさんの宿題、一日で終わりっこない。',
    // kuromoji 把「っこ」切成 っ（く）+ こ（来る），或者连着前面的词（できっこ → で きっ こ）
    [
      [
        { pos: '動詞', cf: '連用タ接続' },
        { s: 'こ', b: 'くる', p1: '非自立' },
        { b: 'ない', pos: '助動詞' }
      ]
    ]
  ),
  P(
    'yougaanai',
    2,
    '〜ようがない',
    '没办法……',
    'there is no way to …',
    'こんなに壊れていては、直しようがない。',
    [
      [YOU, { s: ['が', 'も', 'の'] }, { b: 'ない' }],
      [YOU, { s: ['が', 'も'] }, { s: 'あり' }, ...MASEN],
      // しようがない、言いようがない：切成一个词的
      [{ s: 'しようが' }, { b: 'ない' }],
      [{ s: ['しよう', '言いよう'] }, { s: ['が', 'も', 'の'] }, { b: 'ない' }],
      [{ s: ['しよう', '言いよう'] }, { s: ['が', 'も'] }, { s: 'あり' }, ...MASEN]
    ]
  ),

  // ── 断定与评价 ──
  P(
    'nikimatteiru',
    2,
    '〜に決まっている',
    '肯定……',
    'surely; bound to',
    '今から行っても、店は閉まっているに決まっている。',
    // 三時に決まっている、明日に決まっている（定在……）这类前面是时间、数量的不算
    [[TE, { b: 'いる' }], [{ b: 'てる' }], [TE, { s: 'ます' }]].map((tail: TokenSpec[]) => [
      { p1: ['数', '接尾', '副詞可能'], ctx: true, not: true },
      { s: 'に' },
      { b: ['決まる', 'きまる'] },
      ...tail
    ])
  ),
  P(
    'nisuginai',
    2,
    '〜にすぎない',
    '只不过……',
    'merely; no more than',
    'それはただのうわさにすぎない。',
    negated([{ s: 'に' }, { b: ['すぎる', '過ぎる'], pos: '動詞' }])
  ),
  P(
    'nihokanaranai',
    2,
    '〜にほかならない',
    '正是……',
    'nothing other than',
    '今回の成功は、皆さんの努力の結果にほかならない。',
    [...negated([{ s: 'に' }, { b: 'ほかなる' }]), ...negated([{ s: 'に' }, HOKA, { b: 'なる' }])]
  ),
  P(
    'nikagiru',
    2,
    '〜に限る',
    '最好是……',
    "nothing beats …; it's best to …",
    '暑い日は冷たいビールに限る。',
    [
      // 会員に限る特典（只限……）这类后面接名词的不算
      [{ s: 'に' }, { b: ['限る', 'かぎる'], cf: '基本形' }, { pos: '名詞', ctx: true, not: true }],
      [{ s: 'に' }, { b: ['限る', 'かぎる'], cf: '連用形' }, { s: 'ます' }]
    ]
  ),
  P(
    'toiuwakedewanai',
    2,
    '〜というわけではない',
    '并不是说……',
    "it doesn't mean that …",
    '肉が嫌いというわけではないが、あまり食べない。',
    TOIU.flatMap((t) => DEWANAI.map((tail) => [...t, { b: ['わけ', '訳'] }, ...tail]))
  ),
  P(
    'mai',
    2,
    '〜まい',
    '决不……；不会……吧',
    'will never …; probably not',
    'もう二度と同じ失敗はするまい。',
    // 〜ではあるまいし（N1）、おかまいなし 不算
    [
      [
        { pos: '助動詞', b: 'まい' },
        { s: ['し', 'なし'], ctx: true, not: true }
      ]
    ]
  )
]

/** 接续、自带例句的中英翻译、同组、另写的例句 */
const notes: Record<string, GrammarNote> = {
  // ── 理由与「既然」 ──
  karakoso: {
    form: '普通形 + からこそ',
    zh: '正因为为你着想，我才说得这么严厉。',
    en: "It's precisely because I care about you that I'm being so strict.",
    group: 'reason',
    more: [
      {
        ja: '失敗したからこそ、学べたこともある。',
        zh: '有些东西正是因为失败了才学到的。',
        en: 'There are things I learned precisely because I failed.'
      },
      {
        ja: '忙しいからこそ、休みの日を大切にしている。',
        zh: '正因为忙，我才格外珍惜休息日。',
        en: "Precisely because I'm busy, I make the most of my days off."
      }
    ]
  },
  ijou: {
    form: '普通形（なAである・Nである）+ 以上（は）',
    zh: '既然答应了，就必须遵守。',
    en: "Now that I've promised, I have to keep my word.",
    group: 'reason',
    more: [
      {
        ja: '引き受けた以上、最後までやるつもりだ。',
        zh: '既然接下了，我就打算做到最后。',
        en: "Since I've taken it on, I intend to see it through."
      },
      {
        ja: '学生である以上、勉強が第一だ。',
        zh: '既然是学生，就该以学习为重。',
        en: "As long as you're a student, studying comes first."
      }
    ]
  },
  karaniwa: {
    form: '普通形（なAである・Nである）+ からには',
    zh: '既然要参加比赛，就想赢。',
    en: "Since I'm playing in the match, I want to win.",
    group: 'reason',
    more: [
      {
        ja: '日本に来たからには、日本語をしっかり勉強しよう。',
        zh: '既然来了日本，就好好学日语吧。',
        en: "Now that I'm in Japan, I'm going to study Japanese properly."
      },
      {
        ja: 'やると言ったからには、最後までやってね。',
        zh: '既然说了要做，就要做到底哦。',
        en: "You said you'd do it, so see it through to the end, okay?"
      }
    ]
  },
  bakarini: {
    form: '普通形（なAな・Nである）+ ばかりに',
    zh: '就因为撒了谎，我失去了朋友。',
    en: 'Just because I told a lie, I lost a friend.',
    group: 'reason',
    more: [
      {
        ja: '寝坊したばかりに、大事な会議に遅れた。',
        zh: '就因为睡过了头，重要的会议迟到了。',
        en: 'Simply because I overslept, I was late for an important meeting.'
      },
      {
        ja: '褒められたいばかりに、無理をしてしまった。',
        zh: '就因为想被表扬，结果太勉强自己了。',
        en: 'Just because I wanted to be praised, I pushed myself too hard.'
      }
    ]
  },

  // ── 转折与让步 ──
  monono: {
    form: '普通形（なAな・Nである）+ ものの',
    zh: '虽然买了新自行车，却还一次都没骑过。',
    en: "Although I bought a new bicycle, I haven't ridden it even once.",
    group: 'but',
    more: [
      {
        ja: '頭では分かっているものの、なかなか実行できない。',
        zh: '虽然脑子里明白，却怎么也做不到。',
        en: "I understand it in my head, but I just can't put it into practice."
      },
      {
        ja: '試験には合格したものの、点数はぎりぎりだった。',
        zh: '考试虽然通过了，分数却刚刚够线。',
        en: 'I passed the exam, but only just.'
      }
    ]
  },
  nagaramo: {
    form: 'Vます形 / いA / なA / N + ながら（も）（知りながら · 狭いながらも · 残念ながら）',
    zh: '这个房间虽然小，但采光很好。',
    en: 'Although this room is small, it gets plenty of sunlight.',
    group: 'but',
    more: [
      {
        ja: '彼は知っていながら、何も教えてくれなかった。',
        zh: '他明明知道，却什么也没告诉我。',
        en: "Even though he knew, he didn't tell me anything."
      },
      {
        ja: '残念ながら、今回は参加できません。',
        zh: '很遗憾，这次不能参加。',
        en: "Unfortunately, I can't take part this time."
      }
    ]
  },
  nimokakawarazu: {
    form: '普通形 / N + にもかかわらず',
    zh: '尽管下着雨，还是来了很多人。',
    en: 'Despite the rain, a lot of people turned up.',
    group: 'but',
    more: [
      {
        ja: '彼は熱があるにもかかわらず、会社に来た。',
        zh: '尽管发着烧，他还是来上班了。',
        en: 'He came to work even though he had a fever.'
      },
      {
        ja: '何度も注意したにもかかわらず、同じミスが続いている。',
        zh: '尽管提醒了很多次，同样的错误还是接连出现。',
        en: "Even though I've warned them many times, the same mistakes keep happening."
      }
    ]
  },
  toittemo: {
    form: '普通形 / N + といっても',
    zh: '虽说会做饭，也只会做些简单的。',
    en: 'I can cook, but only simple things.',
    group: 'but',
    more: [
      {
        ja: '旅行といっても、近くの温泉に一泊するだけだ。',
        zh: '说是旅行，其实只是在附近的温泉住一晚。',
        en: "I call it a trip, but we're only staying one night at a nearby hot spring."
      },
      {
        ja: '春といっても、朝晩はまだ寒い。',
        zh: '虽说是春天，早晚还是很冷。',
        en: 'It may be spring, but the mornings and evenings are still cold.'
      }
    ]
  },
  karatoitte: {
    form: '普通形 + からといって',
    zh: '虽说价格贵，质量也不一定就好。',
    en: "Just because something is expensive doesn't mean it's good quality.",
    group: 'but',
    more: [
      {
        ja: '忙しいからといって、朝ご飯を抜くのはよくないよ。',
        zh: '虽说忙，也不能不吃早饭啊。',
        en: 'Being busy is no excuse for skipping breakfast, you know.'
      },
      {
        ja: '一度失敗したからといって、あきらめる必要はない。',
        zh: '虽说失败了一次，也没有必要放弃。',
        en: "Just because you failed once doesn't mean you have to give up."
      }
    ]
  },
  nishiro: {
    form: '普通形 / N + にしろ / にせよ',
    zh: '去也好，不去也好，请早点联系我。',
    en: 'Whether you go or not, please let me know soon.',
    group: 'even-if',
    more: [
      {
        ja: 'どんな理由があるにせよ、遅刻はよくない。',
        zh: '无论有什么理由，迟到都不对。',
        en: 'Whatever the reason, being late is not good.'
      },
      {
        ja: '冗談にしろ、そんなことを言ってはいけない。',
        zh: '即使是开玩笑，也不该说那种话。',
        en: "Even as a joke, you shouldn't say such a thing."
      }
    ]
  },

  // ── 附加、对比与前提 ──
  ueni: {
    form: '普通形（なAな・Nである）+ うえに',
    zh: '这家餐厅不仅便宜，菜也好吃。',
    en: 'This restaurant is cheap, and the food is good too.',
    group: 'not-only',
    more: [
      {
        ja: '道に迷ったうえに、雨まで降ってきた。',
        zh: '不仅迷了路，还下起雨来了。',
        en: 'Not only did we get lost, but it started to rain as well.'
      },
      {
        ja: '今日は寒い上に、風も強いね。',
        zh: '今天不仅冷，风也很大啊。',
        en: "It's cold today, and windy on top of that."
      }
    ]
  },
  ippou: {
    form: '普通形（なAな・Nである）+ 一方（で）',
    zh: '工作一方面很开心，另一方面责任也很重。',
    en: 'While my job is enjoyable, it also comes with heavy responsibility.',
    group: 'but',
    more: [
      {
        ja: '町は便利になった一方、昔の静けさが失われた。',
        zh: '小镇一方面变方便了，另一方面也失去了往日的宁静。',
        en: 'While the town has become more convenient, it has lost its old quiet.'
      },
      {
        ja: '彼は厳しい先生である一方で、とても優しい父親でもある。',
        zh: '他一方面是严厉的老师，另一方面也是非常温柔的父亲。',
        en: 'He is a strict teacher, but at the same time a very gentle father.'
      }
    ]
  },
  uede: {
    form: 'Vた形 + 上で（之后）· V辞書形 / Nの + 上で（方面）· Vた形 + 上の + N',
    zh: '和家人商量之后再答复您。',
    en: "I'll give you my answer after talking it over with my family.",
    group: 'after',
    more: [
      {
        ja: '外国語を学ぶ上で、毎日続けることが何より大切だ。',
        zh: '学外语时，最重要的是每天坚持。',
        en: 'When it comes to learning a foreign language, nothing matters more than keeping at it every day.'
      },
      {
        ja: 'これは十分に考えた上の決断です。',
        zh: '这是深思熟虑之后做出的决定。',
        en: 'This is a decision I made after careful thought.'
      }
    ]
  },
  tekarademonai: {
    form: 'Vて形 + からでないと / からでなければ',
    zh: '不先付费就不能进去。',
    en: "You can't go in until you've paid.",
    group: 'only-if',
    more: [
      {
        ja: 'よく調べてからでないと、決められないよ。',
        zh: '不先好好调查一下，就没法决定啊。',
        en: "I can't decide until I've looked into it properly."
      },
      {
        ja: '部長の許可を得てからでなければ、この資料は使えない。',
        zh: '不先得到部长的许可，就不能用这份资料。',
        en: "We can't use this material until we have the department head's permission."
      }
    ]
  },

  // ── 「こと」的句型 ──
  kotokara: {
    form: '普通形（なAな・Nである）+ ことから',
    zh: '因为形状像星星，所以得了这个名字。',
    en: 'It got this name because its shape resembles a star.',
    group: 'reason',
    more: [
      {
        ja: '道がぬれていることから、夜中に雨が降ったと分かる。',
        zh: '从路面是湿的来看，可知半夜下过雨。',
        en: 'From the fact that the road is wet, we can tell it rained during the night.'
      },
      {
        ja: '駅から近いことから、この店はいつも混んでいる。',
        zh: '由于离车站近，这家店总是很拥挤。',
        en: "Because it's close to the station, this shop is always crowded."
      }
    ]
  },
  kotonaku: {
    form: 'V辞書形 + ことなく',
    zh: '他一刻不停地工作到了早上。',
    en: 'He kept working until morning without a break.',
    group: 'without',
    more: [
      {
        ja: '誰にも相談することなく、会社を辞めてしまった。',
        zh: '他没跟任何人商量就辞职了。',
        en: 'He quit his job without consulting anyone.'
      },
      {
        ja: '迷うことなく、この道を選びました。',
        zh: '我毫不犹豫地选择了这条路。',
        en: 'I chose this path without hesitation.'
      }
    ]
  },
  naikotoniwa: {
    form: 'Vない形 + ことには',
    zh: '不实际用一用，就不知道它的好处。',
    en: "Unless you actually try it, you won't know how good it is.",
    group: 'only-if',
    more: [
      {
        ja: '本人に聞かないことには、何とも言えないね。',
        zh: '不问本人的话，什么也说不准啊。',
        en: "We can't say anything for sure unless we ask the person himself."
      },
      {
        ja: '雨がやまないことには、試合は始められない。',
        zh: '雨不停的话，比赛就没法开始。',
        en: "The match can't start unless the rain stops."
      }
    ]
  },
  kotoni: {
    form: 'Vた形 / いA / なAな + ことに（は）',
    zh: '令人吃惊的是，他已经全都记住了。',
    en: 'To my surprise, he had already memorized all of it.',
    more: [
      {
        ja: '残念なことに、雨で花火大会は中止になった。',
        zh: '遗憾的是，烟花大会因为下雨取消了。',
        en: 'Unfortunately, the fireworks festival was called off because of the rain.'
      },
      {
        ja: 'うれしいことには、子供たちが手伝ってくれた。',
        zh: '令人高兴的是，孩子们来帮忙了。',
        en: 'To my delight, the children helped me out.'
      }
    ]
  },
  kotoka: {
    form: '普通形（なAな）+ ことか',
    zh: '听到合格的消息，我是多么高兴啊。',
    en: 'How happy I was to hear that I had passed!',
    more: [
      {
        ja: 'この日を何年待ったことか。',
        zh: '这一天我等了多少年啊。',
        en: 'How many years I have waited for this day!'
      },
      {
        ja: '子供のころ、夏休みがどれほど楽しみだったことか。',
        zh: '小时候，我是多么盼望暑假啊。',
        en: 'How I used to look forward to the summer holidays as a child!'
      }
    ]
  },

  // ── 「もの」的句型 ──
  monogaaru: {
    form: 'V辞書形 / いA / なAな + ものがある',
    zh: '他的歌里有打动人心的东西。',
    en: "There's something in his singing that moves people.",
    more: [
      {
        ja: '毎日同じ作業を続けるのは、つらいものがある。',
        zh: '每天重复同样的工作，确实有些辛苦。',
        en: 'Doing the same work day after day is pretty tough.'
      },
      {
        ja: 'この小説の結末には、考えさせられるものがあった。',
        zh: '这部小说的结局有发人深省之处。',
        en: 'The ending of this novel had something thought-provoking about it.'
      }
    ]
  },
  mononara: {
    form: 'V辞書形（多为可能形）+ ものなら · Vよう形 + ものなら',
    zh: '如果能回去的话，真想回到学生时代。',
    en: "If I could go back, I'd love to return to my school days.",
    group: 'if',
    more: [
      {
        ja: 'できるものなら、一週間くらい休みたい。',
        zh: '可以的话，真想休息一个星期左右。',
        en: "If I could, I'd like to take about a week off."
      },
      {
        ja: '遅刻なんかしようものなら、先生にひどく叱られる。',
        zh: '要是敢迟到，会被老师狠狠地骂一顿。',
        en: 'If you were to be late, the teacher would give you a real scolding.'
      }
    ]
  },
  monoka: {
    form: 'V辞書形 + ものか / もんか / ものですか',
    zh: '那种店，我才不会再去呢。',
    en: "I'm never going to that shop again!",
    group: 'never',
    more: [
      {
        ja: 'こんな問題くらいで負けるものか。',
        zh: '这么点问题，我才不会认输呢。',
        en: "As if I'd let a little problem like this beat me!"
      },
      {
        ja: '誰がそんな話を信じるものですか。',
        zh: '谁会相信那种话呢。',
        en: 'Who would believe a story like that?'
      }
    ]
  },
  toiumonoda: {
    form: '普通形 / N + というものだ',
    zh: '有困难时互相帮助，这才是朋友。',
    en: "Helping each other in hard times — that's what friends are for.",
    more: [
      {
        ja: '一日で全部やれなんて、それは無理というものです。',
        zh: '要一天全做完，那简直是强人所难。',
        en: "Doing it all in one day? That's simply asking too much."
      },
      {
        ja: '思いどおりにいかないのが人生というものだ。',
        zh: '事情总不如意，这就是人生。',
        en: "Things not going the way you want — that's life."
      }
    ]
  },

  // ── 情不自禁与不得不 ──
  zuniwairarenai: {
    form: '泣く → 泣かずにはいられない · 泣かないではいられない（する → せずには）',
    zh: '看了那部电影，我忍不住哭了。',
    en: "Watching that movie, I couldn't help crying.",
    group: 'feeling',
    more: [
      {
        ja: '彼の話があまりにおかしくて、笑わずにはいられない。',
        zh: '他讲的事太好笑了，让人忍不住要笑。',
        en: "His story is so funny I can't help laughing."
      },
      {
        ja: '困っている人を見ると、声をかけないではいられない。',
        zh: '一看到有困难的人，我就忍不住上前搭话。',
        en: "Whenever I see someone in trouble, I can't help speaking to them."
      }
    ]
  },
  tenaranai: {
    form: 'Vて形 / いAくて / なAで + ならない',
    zh: '我非常在意考试的结果。',
    en: "I can't stop worrying about the exam results.",
    group: 'feeling',
    more: [
      {
        ja: '一人暮らしを始めたころは、寂しくてならなかった。',
        zh: '刚开始一个人生活的时候，寂寞得不得了。',
        en: 'When I first started living alone, I was terribly lonely.'
      },
      {
        ja: '何か大事なことを忘れている気がしてならない。',
        zh: '总觉得忘了什么重要的事。',
        en: "I can't shake the feeling that I've forgotten something important."
      }
    ]
  },
  zaruwoenai: {
    form: '行く → 行かざるを得ない · する → せざるを得ない',
    zh: '因为台风要来，旅行不得不取消。',
    en: 'With a typhoon coming, we have no choice but to cancel the trip.',
    group: 'no-choice',
    more: [
      {
        ja: '上司の命令なら、従わざるを得ません。',
        zh: '如果是上司的命令，我只能服从。',
        en: "If it's my boss's order, I have no choice but to obey."
      },
      {
        ja: '彼の努力は認めざるをえない。',
        zh: '不得不承认他很努力。',
        en: 'I have to admit that he has worked hard.'
      }
    ]
  },
  hokanai: {
    form: 'V辞書形 + ほかない / よりほかない',
    zh: '错过了末班车，只好走回家了。',
    en: 'I missed the last train, so I have no choice but to walk home.',
    group: 'no-choice',
    more: [
      {
        ja: '誰も手伝ってくれないなら、一人でやるよりほかない。',
        zh: '要是没人帮忙，就只好一个人干了。',
        en: "If nobody will help, I'll just have to do it alone."
      },
      {
        ja: '薬が効かないなら、手術をするほかありません。',
        zh: '如果药不管用，就只能做手术了。',
        en: "If the medicine doesn't work, there's no option but surgery."
      }
    ]
  },

  // ── 难以与不可能 ──
  gatai: {
    form: 'Vます形 + がたい',
    zh: '很难相信他会做那种事。',
    en: "It's hard to believe that he did such a thing.",
    group: 'cannot',
    more: [
      {
        ja: 'この町には、忘れがたい思い出がたくさんある。',
        zh: '这个小镇有很多难忘的回忆。',
        en: 'This town holds many unforgettable memories.'
      },
      {
        ja: 'どちらの案もよくて、一つに決めがたい。',
        zh: '两个方案都不错，很难选定一个。',
        en: "Both plans are good, so it's hard to pick just one."
      }
    ]
  },
  kaneru: {
    form: 'Vます形 + かねる',
    zh: '您的这个问题，恕我难以回答。',
    en: "I'm afraid I'm unable to answer that question.",
    group: 'cannot',
    more: [
      {
        ja: '申し訳ありませんが、そのご意見には賛成しかねます。',
        zh: '很抱歉，我难以赞同您的意见。',
        en: "I'm sorry, but I can't agree with that opinion."
      },
      {
        ja: '彼の態度は、私には理解しかねる。',
        zh: '他的态度，我实在难以理解。',
        en: 'His attitude is beyond my understanding.'
      }
    ]
  },
  kanenai: {
    form: 'Vます形 + かねない',
    zh: '那样开车的话，很可能会出事故。',
    en: 'Driving like that, you could easily cause an accident.',
    group: 'guess',
    more: [
      {
        ja: '無理をすると、体を壊しかねないよ。',
        zh: '太勉强的话，可能会把身体搞垮哦。',
        en: 'If you overdo it, you could end up ruining your health.'
      },
      {
        ja: '小さなミスが、大きな問題につながりかねません。',
        zh: '小小的失误也有可能酿成大问题。',
        en: 'A small mistake could lead to a serious problem.'
      }
    ]
  },
  eru: {
    form: 'Vます形 + 得る（える／うる）/ 得ない（あり得る · あり得ない）',
    zh: '那种事不可能发生。',
    en: "That simply can't happen.",
    group: 'cannot',
    more: [
      {
        ja: '地震はいつでも起こり得る。',
        zh: '地震随时都可能发生。',
        en: 'An earthquake can happen at any time.'
      },
      {
        ja: '考え得るすべての方法を試してみた。',
        zh: '能想到的办法全都试过了。',
        en: 'I tried every method I could think of.'
      }
    ]
  },
  kkonai: {
    form: 'Vます形 + っこない（分かりっこない · できっこない）',
    zh: '这么多作业，一天不可能写完。',
    en: "There's no way I can finish this much homework in one day.",
    group: 'cannot',
    more: [
      {
        ja: '「宝くじ、当たるかな」「当たりっこないよ。」',
        zh: '“彩票能中吗？”“不可能中的啦。”',
        en: '"Do you think I\'ll win the lottery?" "Not a chance."'
      },
      {
        ja: 'そんなこと、恥ずかしくて先生に言えっこない。',
        zh: '那种事太难为情了，我不可能跟老师说。',
        en: "That's too embarrassing — there's no way I could tell the teacher."
      }
    ]
  },
  yougaanai: {
    form: 'Vます形 + ようがない（直しようがない）· Nの + しようがない',
    zh: '坏成这样，已经没法修了。',
    en: "It's so badly broken there's no way to fix it.",
    group: 'cannot',
    more: [
      {
        ja: '住所が分からないので、連絡のしようがない。',
        zh: '不知道地址，没办法联系。',
        en: "I don't know the address, so there's no way to get in touch."
      },
      {
        ja: '何度聞かれても、知らないことは答えようがない。',
        zh: '不管被问多少次，不知道的事也没法回答。',
        en: "No matter how many times I'm asked, I can't answer what I don't know."
      }
    ]
  },

  // ── 断定与评价 ──
  nikimatteiru: {
    form: '普通形 / N + に決まっている',
    zh: '现在去的话，店肯定已经关门了。',
    en: 'Even if we go now, the shop is bound to be closed.',
    group: 'guess',
    more: [
      {
        ja: 'そんなうまい話、うそに決まってるよ。',
        zh: '那么好的事，肯定是骗人的。',
        en: 'A deal that good is bound to be a lie.'
      },
      {
        ja: '毎日練習している彼が勝つに決まっています。',
        zh: '每天都在练习的他肯定会赢。',
        en: "He practices every day, so of course he'll win."
      }
    ]
  },
  nisuginai: {
    form: '普通形 / N + にすぎない',
    zh: '那只不过是传闻而已。',
    en: "That's nothing more than a rumor.",
    group: 'only',
    more: [
      {
        ja: '私は自分の仕事をしたにすぎません。',
        zh: '我只不过是做了自己分内的事。',
        en: 'I was merely doing my job.'
      },
      {
        ja: '参加者は全体の一割にすぎなかった。',
        zh: '参加者只不过占全体的一成。',
        en: 'The participants made up no more than ten percent of the total.'
      }
    ]
  },
  nihokanaranai: {
    form: 'N + にほかならない（努力の結果にほかならない · 思うからにほかならない）',
    zh: '这次的成功，正是大家努力的结果。',
    en: "This success is nothing other than the result of everyone's hard work.",
    more: [
      {
        ja: '親が厳しく言うのは、子供のことを思うからにほかならない。',
        zh: '父母说得严厉，正是因为为孩子着想。',
        en: 'Parents are strict precisely because they care about their children.'
      },
      {
        ja: '毎日の小さな習慣こそ、健康の秘訣にほかなりません。',
        zh: '每天的小习惯，正是健康的秘诀。',
        en: 'Small daily habits are none other than the secret to good health.'
      }
    ]
  },
  nikagiru: {
    form: 'V辞書形 / Vない形 / N + に限る',
    zh: '大热天最好是来杯冰啤酒。',
    en: 'On a hot day, nothing beats a cold beer.',
    group: 'should',
    more: [
      {
        ja: '疲れたときは、早く寝るに限る。',
        zh: '累的时候，最好是早点睡。',
        en: "When you're tired, the best thing is to go to bed early."
      },
      {
        ja: '旅行の荷物は少ないに限るね。',
        zh: '旅行的行李还是越少越好啊。',
        en: 'When you travel, the less luggage the better.'
      }
    ]
  },
  toiuwakedewanai: {
    form: '普通形 + というわけではない',
    zh: '并不是说讨厌吃肉，只是不怎么吃。',
    en: "It's not that I dislike meat; I just don't eat much of it.",
    group: 'partial-neg',
    more: [
      {
        ja: '高い店がいつもおいしいというわけではない。',
        zh: '并不是说贵的店就一定好吃。',
        en: "Expensive restaurants aren't necessarily always good."
      },
      {
        ja: '反対というわけじゃないけど、もう少し考えたい。',
        zh: '并不是说我反对，只是想再考虑一下。',
        en: "It's not that I'm against it, but I'd like to think it over a bit more."
      }
    ]
  },
  mai: {
    form: 'V辞書形 + まい（する → するまい / すまい）',
    zh: '我决不会再犯同样的错误。',
    en: 'I will never make the same mistake again.',
    group: 'never',
    more: [
      {
        ja: 'この空なら、今日は雨は降るまい。',
        zh: '看这天色，今天不会下雨吧。',
        en: "Judging by the sky, it probably won't rain today."
      },
      {
        ja: '彼女を心配させまいと、彼は何も言わなかった。',
        zh: '为了不让她担心，他什么也没说。',
        en: "Not wanting to worry her, he didn't say anything."
      }
    ]
  }
}

const lessons: LessonSpec[] = [
  {
    id: 'n2-5',
    title: { zh: '理由与「既然」', en: 'Reasons and "now that"' },
    items: ['karakoso', 'ijou', 'karaniwa', 'bakarini']
  },
  {
    id: 'n2-6',
    title: { zh: '转折与让步', en: 'Although and even if' },
    items: ['monono', 'nagaramo', 'nimokakawarazu', 'toittemo', 'karatoitte', 'nishiro']
  },
  {
    id: 'n2-8',
    title: { zh: '附加、对比与前提', en: 'Adding, contrasting and prerequisites' },
    items: ['ueni', 'ippou', 'uede', 'tekarademonai']
  },
  {
    id: 'n2-11',
    title: { zh: '「こと」的句型', en: 'Patterns with こと' },
    items: ['kotokara', 'kotonaku', 'naikotoniwa', 'kotoni', 'kotoka']
  },
  {
    id: 'n2-12',
    title: { zh: '「もの」的句型', en: 'Patterns with もの' },
    items: ['monogaaru', 'mononara', 'monoka', 'toiumonoda']
  },
  {
    id: 'n2-15',
    title: { zh: '情不自禁与不得不', en: "Can't help it, no choice" },
    items: ['zuniwairarenai', 'tenaranai', 'zaruwoenai', 'hokanai']
  },
  {
    id: 'n2-16',
    title: { zh: '难以与不可能', en: 'Hard and impossible' },
    items: ['gatai', 'kaneru', 'kanenai', 'eru', 'kkonai', 'yougaanai']
  },
  {
    id: 'n2-17',
    title: { zh: '断定与评价', en: 'Judgments and conclusions' },
    items: ['nikimatteiru', 'nisuginai', 'nihokanaranai', 'nikagiru', 'toiuwakedewanai', 'mai']
  }
]

export const N2_GRAMMAR: LevelGrammar = { points, notes, lessons }
