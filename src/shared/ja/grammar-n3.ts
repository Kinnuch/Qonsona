/**
 * JLPT N3 的语法（一）：时间、原因、强调、程度、判断，以及「わけ」「もの」「こと」的句型。
 * 语法点（阅读器的「本文语法」、语法课、练习都用）、语法课的接续与例句翻译、分课都写在这里；
 * 写法见 grammar-def.ts，N3 的两个文件在 grammar-levels.ts 里并成一级（课按编号交错排）。
 * 说明、例句都是自己写的；每一条的例句（自带的与 more 里另写的）都得认得出来（tests/ja-grammar.test.ts）。
 */
import {
  P,
  TE,
  checked,
  type GrammarCheck,
  type GrammarNote,
  type GrammarPoint,
  type LessonSpec,
  type LevelGrammar,
  type TokenSpec
} from './grammar-def'

// ── 常用的词素条件 ──

/**
 * 前面是谓语的原形或连体形（动词、形容词、た、ない、たい……，なA的な）：只看不算。
 * 不含连用形（急でくらい 这类切错的）
 */
const PRED: TokenSpec = { pos: ['動詞', '形容詞', '助動詞'], cf: ['基本形', '体言接続'], ctx: true }
/** 前面是动词原形（V辞書形，含 ている 的いる、てみる 的みる）：只看不算 */
const DICT: TokenSpec = { pos: '動詞', cf: '基本形', ctx: true }
/** 前面是自立动词的原形（不含 される 的れる、しすぎる 的すぎる、ている 的いる）：只看不算 */
const DICT_SELF: TokenSpec = { pos: '動詞', p1: '自立', cf: '基本形', ctx: true }
/** 前面是过去的た、だ：只看不算 */
const PAST: TokenSpec = { pos: '助動詞', ct: '特殊・タ', ctx: true }
/** 前面是名词后的の：只看不算 */
const NO: TokenSpec = { s: 'の', pos: '助詞', ctx: true }
/** 过去的た */
const TA: TokenSpec = { pos: '助動詞', ct: '特殊・タ' }
/** ない（助动词的ない、形容词ない都算，なかっ、なく 也算） */
const NAI: TokenSpec = { b: 'ない' }
/** 句末的ない、なかった（仕方なく 这种副词用法的なく不算） */
const NAI_END: TokenSpec = { b: 'ない', cf: ['基本形', '連用タ接続'] }
/** 〜ません 的ませ・ん */
const MASEN: TokenSpec[] = [{ b: 'ます' }, { s: 'ん' }]
/** ありません */
const ARIMASEN: TokenSpec[] = [{ b: 'ある' }, ...MASEN]
/** 〜ませんでした 的でした */
const DESHITA: TokenSpec[] = [{ s: 'でし', b: 'です' }, TA]
/** だ、です（不含で、な、なら：〜ものではない、〜ものなら 这些各有各的） */
const DA: TokenSpec = { s: ['だ', 'です'], b: ['だ', 'です'] }
/** だった、でした */
const DATTA: TokenSpec[] = [{ s: ['だっ', 'でし'], b: ['だ', 'です'] }, TA]

/**
 * 以「ない」结尾的句型（〜わけがない 这类）：〜ない、〜なかった、〜ありません、〜ありませんでした
 * 各一串，长的在前（过去的た、でした 也算进那一段）
 */
const noneEnds = (head: TokenSpec[], nai: TokenSpec = NAI): TokenSpec[][] => [
  [...head, ...ARIMASEN, ...DESHITA],
  [...head, ...ARIMASEN],
  [...head, { ...nai, cf: '連用タ接続' }, TA],
  [...head, nai]
]

/** 以动词的否定结尾的句型（〜わけにはいかない 这类）：〜ない、〜なかった、〜ません、〜ませんでした */
const verbNegEnds = (head: TokenSpec[], verb: TokenSpec): TokenSpec[][] => [
  [...head, verb, ...MASEN, ...DESHITA],
  [...head, verb, ...MASEN],
  [...head, verb, { b: 'ない', cf: '連用タ接続' }, TA],
  [...head, verb, NAI]
]
/** わけ（前面是「の」的不算：英語の訳 是「翻译」） */
const WAKE: TokenSpec[] = [{ s: 'の', ctx: true, not: true }, { s: ['わけ', '訳'] }]
const KOTO: TokenSpec = { s: 'こと' }
const MONO: TokenSpec = { s: ['もの', 'もん'] }
const HODO: TokenSpec = { s: 'ほど', pos: '助詞' }

/** 几种开头 × 几种结尾，拼成几串 */
const cross = (heads: TokenSpec[][], tails: TokenSpec[][]): TokenSpec[][] =>
  heads.flatMap((h) => tails.map((t) => [...h, ...t]))

/** 〜てしかたがない、〜てたまらない 的开头：て形的て / で，或者なA（心配 这类サ変名词也算）后面的で */
const TE_HEADS: TokenSpec[][] = [
  [TE],
  [{ p1: ['形容動詞語幹', 'サ変接続'], ctx: true }, { s: 'で' }]
]

/** 「家」的うちに后面常跟的词（来る、帰る、泊まる……、は、も）：Nのうちに 后面不能是这些 */
const NOT_HOME: TokenSpec = {
  b: [
    '来る',
    'くる',
    '行く',
    'いく',
    '帰る',
    '寄る',
    '泊まる',
    '遊ぶ',
    '住む',
    '戻る',
    'いる',
    'ある',
    'は',
    'も'
  ],
  ctx: true,
  not: true
}

/** 忠告的〜ことだ 后面不跟と、から这些（〜ことだと思う、〜ことだから 多半是说明） */
const NOT_EXPLAIN: TokenSpec = {
  s: ['と', 'から', 'し', 'が', 'けど', 'けれど', 'って'],
  ctx: true,
  not: true
}

// ── 整句的条件（隔着几个词的上下文） ──

/** 这一句里语法点前面的原文 */
const before = (tokens: Parameters<GrammarCheck>[0], from: number): string =>
  tokens
    .slice(0, from)
    .map((t) => t.s)
    .join('')

/** 主题的〜は前面的名词（风邪のときは、ためには 这类不算主题） */
const TOPIC_NOUN = new Set(['一般', '固有名詞', '代名詞', 'サ変接続', '形容動詞語幹'])

/**
 * 前面没有主题（〜は）：私の趣味は切手を集めることです、大事なのは続けることだ、
 * 〜とは……ことだ 是说明「是……这件事」，不是忠告
 */
const noTopicBefore: GrammarCheck = (tokens, from) =>
  !tokens.slice(0, from).some((t, i) => {
    if ((t.s !== 'は' && t.s !== 'はね') || t.pos !== '助詞') return false
    const p = tokens[i - 1]
    if (!p) return false
    // 〜とは（下定义）、〜ことは、〜のは、名词＋は
    if (p.pos === '助詞') return p.s === 'と'
    return p.pos === '名詞' && (TOPIC_NOUN.has(p.p1) || p.s === 'の' || p.s === 'こと')
  })

/** 句子以「この〜は」「それは」这类开头：多半是在说某样东西（这本书是……的东西） */
const ABOUT_THING = /^(この|その|あの|これ|それ|あれ|どの)/
/** 过去常常的〜たものだ：前面多半有「よく」「昔」「子供のころ」这类词 */
const HABIT =
  /(よく|昔|頃|ころ|当時|時々|ときどき|しばしば|以前|毎日|毎晩|毎朝|毎週|いつも|子供|子ども|若い|学生)/

/** 〜ものだ 不是在说「这东西是……的」；〜たものだ 前面得有「よく」「昔」这类词 */
const notAboutThing: GrammarCheck = (tokens, from) => {
  const pre = before(tokens, from)
  if (ABOUT_THING.test(pre)) return false
  return tokens[from - 1]?.ct !== '特殊・タ' || HABIT.test(pre)
}

const points: GrammarPoint[] = [
  // ── わけ ──
  P(
    'wake',
    3,
    '〜わけだ',
    '难怪……；也就是说……',
    'no wonder; that means …',
    '窓が開いていたのか、どうりで寒いわけだ。',
    [
      [...WAKE, { s: 'な', b: 'だ' }, { s: ['ん', 'の'] }, { b: ['だ', 'です'] }],
      [...WAKE, ...DATTA],
      [...WAKE, { s: 'でしょ' }, { s: 'う' }],
      [...WAKE, DA]
    ]
  ),
  P(
    'wakedewanai',
    3,
    '〜わけではない',
    '并不是……',
    "it's not that …",
    '肉が嫌いなわけではないが、あまり食べない。',
    [
      ...noneEnds([...WAKE, { s: 'で' }, { s: ['は', 'も'] }]),
      ...noneEnds([...WAKE, { s: 'じゃ' }])
    ]
  ),
  P(
    'wakeganai',
    3,
    '〜わけがない',
    '不可能……；哪会……',
    "there's no way …",
    'あんなに優しい人が、うそをつくわけがない。',
    [
      ...noneEnds([...WAKE, { s: ['が', 'は'] }]),
      // わけありません（が省掉；申し訳ありません 的申し訳是一个词，不会认进来）
      [{ s: 'の', ctx: true, not: true }, { s: 'わけ' }, ...ARIMASEN]
    ]
  ),
  P(
    'wakeniwaikanai',
    3,
    '〜わけにはいかない',
    '（情理上）不能……',
    "can't very well …",
    '明日は大事な会議があるので、休むわけにはいかない。',
    [
      ...verbNegEnds([...WAKE, { s: 'に' }, { s: ['は', 'も'] }], { b: ['いく', '行く'] }),
      ...verbNegEnds([...WAKE, { s: 'に' }], { b: ['いく', '行く'] })
    ]
  ),

  // ── 应该、只好与推断 ──
  P(
    'bekida',
    3,
    '〜べきだ／〜べきではない',
    '应该……；不应该……',
    'should …; should not …',
    '一度した約束は、守るべきだ。',
    [
      ...noneEnds([{ s: 'べき' }, { s: 'で' }, { s: ['は', 'も'] }]),
      ...noneEnds([{ s: 'べき' }, { s: ['で', 'じゃ'] }]),
      [{ s: 'べき' }, ...DATTA],
      [{ s: 'べき' }, DA],
      [{ s: 'べき', b: 'べし' }]
    ]
  ),
  P(
    'hazuganai',
    3,
    '〜はずがない',
    '（按理说）不可能……',
    "can't possibly …",
    '鍵をかけたから、ドアが開いているはずがない。',
    [
      ...noneEnds([{ b: 'はず' }, { s: ['が', 'は', 'も'] }]),
      // そんなはずない（が省掉）
      ...noneEnds([{ b: 'はず' }], { b: 'ない', pos: '形容詞' })
    ]
  ),
  P(
    'nichigainai',
    3,
    '〜に違いない',
    '一定是……；肯定……',
    'must be …; no doubt …',
    '部屋の電気が消えているから、彼はもう寝たに違いない。',
    noneEnds([{ s: 'に' }, { s: ['違い', 'ちがい'] }])
  ),
  P(
    'shikanai',
    3,
    '〜しかない',
    '只好……；只能……',
    'have no choice but to …',
    '終電に乗り遅れたので、歩いて帰るしかない。',
    // 前面得是动词原形（百円しかない 是 N4 的「只有」）
    noneEnds([DICT, { s: 'しか', pos: '助詞' }])
  ),
  P(
    'towakagiranai',
    3,
    '〜とは限らない',
    '不一定……；未必……',
    'not necessarily',
    '高い物がいい物だとは限らない。',
    verbNegEnds([{ s: 'と' }, { s: 'は' }], { b: ['限る', 'かぎる'] })
  ),

  // ── もの、こと ──
  P(
    'kotowanai',
    3,
    '〜ことはない',
    '不必……；用不着……',
    "there's no need to …",
    '簡単な試験だから、心配することはないよ。',
    // 前面得是自立动词的原形：行ったことはない（没去过）、解雇されることはない（不会被……）、
    // しすぎることはない 不算；ことなく（不……而……）的なく也不算
    [
      ...noneEnds([DICT_SELF, KOTO, { s: ['は', 'も'] }], NAI_END),
      ...noneEnds([DICT_SELF, KOTO], { b: 'ない', pos: '形容詞', cf: ['基本形', '連用タ接続'] })
    ]
  ),
  P(
    'naikotowanai',
    3,
    '〜ないことはない',
    '也不是不……',
    "it's not that … not",
    '辛い料理も、食べられないことはない。',
    [
      ...noneEnds([{ b: 'ない', pos: ['助動詞', '形容詞'] }, KOTO, { s: ['は', 'も'] }]),
      ...noneEnds([{ s: 'なく', b: 'ない' }, { s: 'は' }])
    ]
  ),
  checked(
    P(
      'kotoda',
      3,
      '〜ことだ',
      '（忠告）最好……',
      'the best thing is to …',
      '日本語が上手になりたければ、毎日話すことだ。',
      // 私の趣味は切手を集めることです 这类说明句也是这个样子：前面有「〜は」的不算（整句的条件）
      [
        [DICT_SELF, KOTO, { ...DA, cf: '基本形' }, NOT_EXPLAIN],
        [
          { b: 'ない', pos: '助動詞', cf: '基本形', ctx: true },
          KOTO,
          { ...DA, cf: '基本形' },
          NOT_EXPLAIN
        ]
      ]
    ),
    noTopicBefore
  ),
  checked(
    P(
      'monoda',
      3,
      '〜ものだ',
      '本来就是……；（感慨）真是……；过去常常……',
      'naturally …; how …!; used to …',
      '人は誰でも間違えるものだ。',
      // 前面是谓语的原形：〜なものだ（きれいなものだ、〜ようなものだ）、〜べきものだ 多半是「东西」，不算
      [
        [{ pos: ['動詞', '形容詞', '助動詞'], cf: '基本形', ctx: true }, MONO, ...DATTA],
        [{ pos: ['動詞', '形容詞', '助動詞'], cf: '基本形', ctx: true }, MONO, DA]
      ]
    ),
    notAboutThing
  ),
  P(
    'monodewanai',
    3,
    '〜ものではない',
    '（按常理）不该……',
    "one shouldn't …",
    '人の悪口を言うものではない。',
    [
      ...noneEnds([
        { pos: '動詞', p1: '自立', cf: '基本形', ctx: true },
        MONO,
        { s: 'で' },
        { s: 'は' }
      ]),
      ...noneEnds([{ pos: '動詞', p1: '自立', cf: '基本形', ctx: true }, MONO, { s: 'じゃ' }])
    ]
  ),
  P(
    'mondakara',
    3,
    '〜ものだから／〜もので',
    '（辩解）因为……',
    'because (as an excuse)',
    '道が混んでいたものだから、遅れてしまいました。',
    [
      [PRED, MONO, DA, { s: 'から' }],
      // 〜もので：前面是た、ない，后面是标点（〜と呼ばれるもので、…… 是「是一种……」）
      [
        { pos: '助動詞', b: ['た', 'ない'], ctx: true },
        MONO,
        { s: 'で' },
        { pos: '記号', ctx: true }
      ]
    ]
  ),

  // ── 程度与感情 ──
  P(
    'teshikataganai',
    3,
    '〜てしかたがない／〜てしょうがない',
    '……得不得了',
    "terribly …; can't help …",
    '試験の結果が気になってしかたがない。',
    // しょうがない 切成 しょうが/ない，しようがない 切成 しようが/ない
    TE_HEADS.flatMap((h) => [
      ...noneEnds([...h, { s: ['しかた', '仕方'] }, { s: 'が' }], NAI_END),
      ...noneEnds([...h, { s: ['しかた', '仕方', 'しょうが', 'しようが'] }], NAI_END),
      ...noneEnds([...h, { s: ['しょう', 'しよう'] }, { s: 'が' }], NAI_END)
    ])
  ),
  P(
    'tetamaranai',
    3,
    '〜てたまらない',
    '……得受不了',
    'unbearably …; dying to …',
    '今日は朝から暑くてたまらない。',
    // たまらない 是一个形容词，たまりません 切成 たまり/ませ/ん
    TE_HEADS.flatMap((h) => [
      [...h, { b: 'たまらない', cf: '連用タ接続' }, TA],
      [...h, { b: 'たまらない' }],
      ...verbNegEnds(h, { b: ['たまる', '堪る'] })
    ])
  ),
  P(
    'kurai',
    3,
    '〜くらい／〜ぐらい',
    '（程度）到……的地步',
    'so … that; to the point of …',
    'おなかが痛くて、立っていられないくらいだった。',
    // 前面得是谓语：三日ぐらい、どのくらい 的くらい是「大约」；
    // 后面是なら、は、で、しか 的是「与其……」「至少、只不过」（〜くらいなら死んだほうがましだ）
    [
      [
        PRED,
        { s: ['くらい', 'ぐらい'], pos: '助詞' },
        { s: ['なら', 'は', 'で', 'しか'], ctx: true, not: true }
      ]
    ]
  ),
  P(
    'hodo',
    3,
    '〜ほど',
    '（程度）到……的程度；越……',
    'so … that; the more …',
    '泣きたいほど悔しかった。',
    // 前面得是谓语：三日ほど（大约）、去年ほど寒くない（比较）不算
    [[PRED, HODO]]
  ),
  P(
    'bahodo',
    3,
    '〜ば〜ほど',
    '越……越……',
    'the more …, the more …',
    '考えれば考えるほど、分からなくなる。',
    [
      [
        { cf: '仮定形', ctx: true },
        { s: 'ば', pos: '助詞' },
        { pos: ['動詞', '形容詞'], cf: '基本形' },
        HODO
      ],
      [
        { cf: '仮定形', ctx: true },
        { s: 'ば', pos: '助詞' },
        { p1: '形容動詞語幹' },
        { s: 'な' },
        HODO
      ],
      [
        { p1: '形容動詞語幹', ctx: true },
        { s: 'なら', b: 'だ' },
        { p1: '形容動詞語幹' },
        { s: 'な' },
        HODO
      ]
    ]
  ),

  // ── 添加与强调 ──
  P('sae', 3, '〜さえ', '连……都', 'even', '忙しくて、水を飲む時間さえなかった。', [
    [
      { s: 'で', pos: '助詞' },
      { s: 'さえ', pos: '助詞' }
    ],
    [{ s: 'さえ', pos: '助詞' }]
  ]),
  P(
    'koso',
    3,
    '〜こそ',
    '正是……；……才是',
    '(emphasis) this very …',
    '今年こそ、試験に合格したい。',
    [[{ s: 'こそ', pos: '助詞' }]]
  ),
  P(
    'dakedenaku',
    3,
    '〜だけでなく',
    '不仅……（而且）',
    'not only …',
    'この店は安いだけでなく、味もいい。',
    // 〜だけじゃないの？、〜だけではないか（不就是……吗）不算
    [
      ...noneEnds([{ s: 'だけ', pos: '助詞' }, { s: 'で' }, { s: 'は' }]),
      ...noneEnds([{ s: 'だけ', pos: '助詞' }, { s: ['で', 'じゃ'] }])
    ].map((seq) => [...seq, { s: ['の', 'か'], ctx: true, not: true }])
  ),
  P(
    'wamochiron',
    3,
    '〜はもちろん',
    '……自不用说',
    'not to mention',
    'この公園は、週末はもちろん、平日も人が多い。',
    // 后面跟读点或「のこと」：彼はもちろん来る 的もちろん是副词「当然」
    [[{ s: 'は', pos: '助詞' }, { s: ['もちろん', '勿論'] }, { s: ['、', 'の'], ctx: true }]]
  ),

  // ── 原因 ──
  P(
    'okagede',
    3,
    '〜おかげで',
    '多亏……；托……的福',
    'thanks to',
    '先生のおかげで、試験に合格できました。',
    [
      [{ s: ['おかげ', 'お陰', 'お蔭'] }, { s: 'で' }],
      [{ s: ['おかげ', 'お陰', 'お蔭'] }, ...DATTA],
      [{ s: ['おかげ', 'お陰', 'お蔭'] }, DA]
    ]
  ),
  P(
    'seide',
    3,
    '〜せいで／〜せいか',
    '都怪……；也许是因为……',
    'because of (blame); perhaps because',
    '雨のせいで、試合が中止になった。',
    [
      [{ s: ['せい', '所為'], p1: '非自立' }, { s: ['で', 'か'] }],
      [{ s: ['せい', '所為'], p1: '非自立' }, ...DATTA],
      [{ s: ['せい', '所為'], p1: '非自立' }, DA]
    ]
  ),

  // ── 传闻、确认与换个说法 ──
  P(
    'toiukotoda',
    3,
    '〜ということだ',
    '听说……；也就是说……',
    'I hear that …; that means …',
    '天気予報によると、明日は雪が降るということだ。',
    cross(
      [
        [{ s: 'と' }, { b: ['いう', '言う'] }],
        [{ s: ['という', 'っていう', 'って'], pos: '助詞' }],
        [{ s: 'と' }, { s: 'の' }]
      ],
      [
        [KOTO, ...DATTA],
        [KOTO, DA]
      ]
    )
  ),
  P(
    'toiuyori',
    3,
    '〜というより',
    '与其说……（不如说）',
    'rather than …',
    '今日は暖かいというより、暑いくらいだ。',
    [
      [{ s: 'と' }, { b: ['いう', '言う'] }, { s: 'より' }],
      [{ s: ['という', 'っていう'], pos: '助詞' }, { s: 'より' }]
    ]
  ),
  P(
    'tte',
    3,
    '〜って',
    '（口语）听说……；叫做……；说到……',
    '(casual) I hear; called; as for',
    '田中さん、来月結婚するって。',
    [
      // 格助詞的って（行って 的て是接続助詞，不算）；后面跟おく、いる、しまう 这些的是て形切错了（録っておいて）
      [
        { s: ['って', 'っていう', 'ていう'], pos: '助詞', p1: '格助詞' },
        {
          b: [
            'おく',
            'いる',
            'しまう',
            'くださる',
            'みる',
            'ある',
            'くる',
            'いく',
            'もらう',
            'くれる',
            'あげる',
            'ない'
          ],
          ctx: true,
          not: true
        }
      ],
      // 句末的「〜だって」是传闻（子供だって知っている 的だって是「连」，后面跟着别的词，不算）
      [
        { s: 'だって', pos: '助詞' },
        { s: ['。', '！', '？', '!', '?', 'よ', 'ね', 'さ', '」'], ctx: true }
      ]
    ]
  ),
  P(
    'kke',
    3,
    '〜っけ',
    '是不是……来着',
    '(casual) was it …? (recalling)',
    '会議は何時からだっけ？',
    [
      [{ s: ['だっ', 'でし'] }, { pos: '助動詞', ct: '特殊・タ' }, { s: 'っけ' }],
      [{ pos: '助動詞', b: ['だ', 'た'] }, { s: 'っけ' }],
      [{ s: 'っけ' }]
    ]
  ),

  // ── 时间：正要、趁着、每当 ──
  P(
    'tokoro',
    3,
    '〜ところだ',
    '正要……；正在……；刚刚……',
    'about to; in the middle of; just did',
    '今から出かけるところです。',
    // 前面是动词原形、ている、た（静かなところだ 的ところ是「地方」）
    cross(
      [
        [DICT, { s: 'ところ' }],
        [PAST, { s: 'ところ' }]
      ],
      [DATTA, [DA]]
    )
  ),
  P(
    'uchini',
    3,
    '〜うちに',
    '趁……；在……期间',
    'while (still) …; before …',
    '若いうちに、いろいろな国へ行きたい。',
    // 前面是谓语或「の」（うちには牛がいる、少しうちに寄って 的うち是「家」）；
    // 友達のうちに泊まる 这类「家」后面多跟来る、泊まる……，挡掉
    [
      [PRED, { s: ['うち', '内'], p1: '非自立' }, { s: 'に' }],
      [{ s: '今', ctx: true }, NO, { s: ['うち', '内'], p1: '非自立' }, { s: 'に' }],
      [NO, { s: ['うち', '内'], p1: '非自立' }, { s: 'に' }, NOT_HOME]
    ]
  ),
  P(
    'tabini',
    3,
    '〜たびに',
    '每当……',
    'every time',
    'この歌を聞くたびに、故郷を思い出します。',
    // 一度に 的度是量词（名詞,接尾），たびに出る 的たび是「旅」（名詞,一般）：只认非自立名词
    [[{ s: ['たび', '度'], p1: '非自立' }, { s: 'に' }]]
  ),
  P(
    'saichuu',
    3,
    '〜最中に／〜最中だ',
    '正在……的时候',
    'in the middle of',
    '会議の最中に、携帯電話が鳴った。',
    cross(
      [
        [NO, { s: '最中' }],
        [{ pos: '動詞', ctx: true }, { s: '最中' }]
      ],
      [[{ s: ['に', 'だ', 'です', 'で', 'だっ', 'でし'] }]]
    )
  ),

  // ── 时间的先后与顺便 ──
  P(
    'totan',
    3,
    '〜たとたん（に）',
    '刚一……就……',
    'the moment …; as soon as …',
    'ドアを開けたとたんに、猫が飛び出してきた。',
    [
      [PAST, { s: ['とたん', '途端'] }, { s: 'に' }],
      [PAST, { s: ['とたん', '途端'] }]
    ]
  ),
  P(
    'irai',
    3,
    '〜て以来／〜以来',
    '自从……以来',
    'ever since',
    '日本に来て以来、ずっとこの町に住んでいる。',
    [[TE, { s: '以来' }], [{ s: '以来' }]]
  ),
  P(
    'tehajimete',
    3,
    '〜てはじめて',
    '……之后才……',
    'only after …; not until …',
    '病気になってはじめて、健康のありがたさが分かった。',
    // 生まれて初めて（有生以来第一次）、来て初めての冬（来了以后的第一个冬天）不算
    [
      [
        { b: '生まれる', ctx: true, not: true },
        TE,
        { s: 'はじめ', b: 'はじめる' },
        { s: 'て' },
        { s: 'の', ctx: true, not: true }
      ],
      [
        { b: '生まれる', ctx: true, not: true },
        TE,
        { s: ['初めて', 'はじめて'] },
        { s: 'の', ctx: true, not: true }
      ]
    ]
  ),
  P(
    'tsuideni',
    3,
    '〜ついでに',
    '顺便……',
    "while (you're) at it",
    '買い物のついでに、郵便局に寄った。',
    // 句首单用的「ついでに」切成接続詞的ついで，不算
    [[{ s: 'ついで', pos: '名詞' }, { s: 'に' }]]
  )
]

/** 接续、自带例句的中英翻译、同组、另写的例句 */
const notes: Record<string, GrammarNote> = {
  // ── わけ ──
  wake: {
    form: '普通形（なAな・Nな）+ わけだ',
    zh: '原来窗户开着啊，难怪这么冷。',
    en: "Oh, the window was open — no wonder it's so cold.",
    group: 'guess',
    more: [
      {
        ja: 'つまり、来月から田中さんが部長なわけですね。',
        zh: '也就是说，从下个月起田中就是部长了，对吧。',
        en: 'So that means Tanaka will be the department manager from next month, right?'
      },
      {
        ja: '十年も日本に住んでいたのだから、日本語が上手なわけだ。',
        zh: '他在日本住了十年，日语好也是理所当然的。',
        en: 'He lived in Japan for ten years, so naturally his Japanese is good.'
      }
    ]
  },
  wakedewanai: {
    form: '普通形（なAな・Nな）+ わけではない',
    zh: '我并不是讨厌吃肉，只是不怎么吃。',
    en: "It's not that I dislike meat; I just don't eat much of it.",
    group: 'partial-neg',
    more: [
      {
        ja: '別に怒っているわけじゃないよ、ちょっと疲れているだけ。',
        zh: '我并没有生气，只是有点累。',
        en: "I'm not angry or anything — I'm just a bit tired."
      },
      {
        ja: '日本人なら誰でも納豆が好きなわけではありません。',
        zh: '并不是所有日本人都喜欢纳豆。',
        en: 'Not every Japanese person likes natto.'
      }
    ]
  },
  wakeganai: {
    form: '普通形（なAな・Nな）+ わけがない',
    zh: '那么温柔的人，不可能说谎。',
    en: "There's no way someone that kind would lie.",
    group: 'cannot',
    more: [
      {
        ja: '一日でこの本を全部覚えられるわけがないよ。',
        zh: '一天之内不可能把这本书全部记住啊。',
        en: "There's no way I can memorize this whole book in one day."
      },
      {
        ja: '練習もしないで、試合に勝てるわけはない。',
        zh: '连练习都不练，不可能赢得比赛。',
        en: "You can't possibly win a match without even practising."
      }
    ]
  },
  wakeniwaikanai: {
    form: 'V辞書形 / Vない形 + わけにはいかない',
    zh: '明天有重要的会议，我不能请假。',
    en: "I have an important meeting tomorrow, so I can't very well take the day off.",
    group: 'should',
    more: [
      {
        ja: 'せっかく誘ってもらったんだから、断るわけにはいかないよ。',
        zh: '人家特意邀请了我，我总不能拒绝吧。',
        en: 'They went to the trouble of inviting me, so I can hardly turn them down.'
      },
      {
        ja: 'お世話になった先生の頼みなので、行かないわけにはいきません。',
        zh: '这是一直关照我的老师的请求，我不能不去。',
        en: "It's a request from a teacher who has done so much for me, so I really must go."
      }
    ]
  },

  // ── 应该、只好与推断 ──
  bekida: {
    form: 'V辞書形 + べきだ / べきではない（する → するべき · すべき）',
    zh: '答应过的事就应该做到。',
    en: "Once you've made a promise, you should keep it.",
    group: 'should',
    more: [
      {
        ja: 'もっと早く病院に行くべきだったね。',
        zh: '你应该早点去医院的。',
        en: 'You should have gone to the hospital sooner.'
      },
      {
        ja: '人の失敗を笑うべきではありません。',
        zh: '不应该嘲笑别人的失败。',
        en: "You shouldn't laugh at other people's mistakes."
      }
    ]
  },
  hazuganai: {
    form: '普通形（なAな・Nの）+ はずがない',
    zh: '我锁了门，门不可能开着。',
    en: "I locked it, so the door can't be open.",
    group: 'cannot',
    more: [
      {
        ja: '田中さんがそんなことを言うはずがないよ。',
        zh: '田中不可能说那种话的。',
        en: 'Tanaka would never say something like that.'
      },
      {
        ja: '今は八月だから、雪が降るはずはない。',
        zh: '现在是八月，不可能下雪。',
        en: "It's August, so it can't possibly snow."
      }
    ]
  },
  nichigainai: {
    form: '普通形 + に違いない（寝たに違いない · 静かに違いない · 子供に違いない）',
    zh: '他房间的灯关着，他一定已经睡了。',
    en: 'The lights in his room are off, so he must have gone to bed already.',
    group: 'guess',
    more: [
      {
        ja: 'あの店はいつも行列ができているから、おいしいにちがいない。',
        zh: '那家店总是排着长队，一定很好吃。',
        en: "There's always a line outside that place, so it must be good."
      },
      {
        ja: 'この手紙を書いたのは、子供に違いありません。',
        zh: '写这封信的一定是个孩子。',
        en: 'This letter must have been written by a child.'
      }
    ]
  },
  shikanai: {
    form: 'V辞書形 + しかない',
    zh: '错过了末班车，只好走回家。',
    en: "I've missed the last train, so I have no choice but to walk home.",
    group: 'no-choice',
    more: [
      {
        ja: 'ここまで来たら、もうやるしかないよ。',
        zh: '都到这一步了，只能干下去了。',
        en: "We've come this far, so there's nothing for it but to go through with it."
      },
      {
        ja: '部品が届くまで、待つしかありません。',
        zh: '在零件送到之前，只能等着。',
        en: 'We have no choice but to wait until the parts arrive.'
      }
    ]
  },
  towakagiranai: {
    form: '普通形 + とは限らない',
    zh: '贵的东西不一定就是好东西。',
    en: "Expensive things aren't necessarily good.",
    group: 'partial-neg',
    more: [
      {
        ja: '天気予報が当たるとは限らないから、傘を持っていこう。',
        zh: '天气预报不一定准，还是带伞吧。',
        en: "The forecast isn't always right, so let's take an umbrella."
      },
      {
        ja: '有名な大学を出た人が、仕事ができるとは限りません。',
        zh: '名牌大学毕业的人，工作上不一定就能干。',
        en: "People who went to famous universities aren't necessarily good at their jobs."
      }
    ]
  },

  // ── もの、こと ──
  kotowanai: {
    form: 'V辞書形 + ことはない',
    zh: '考试很简单，不用担心。',
    en: "It's an easy exam, so there's no need to worry.",
    group: 'need-not',
    more: [
      {
        ja: 'まだ時間は十分ありますから、急ぐことはありません。',
        zh: '时间还很充裕，不必着急。',
        en: "There's still plenty of time, so there's no need to hurry."
      },
      {
        ja: 'わざわざ迎えに来ることないのに。',
        zh: '你不用特地来接我的。',
        en: "You didn't need to come all the way to pick me up."
      }
    ]
  },
  naikotowanai: {
    form: 'Vない形 / いAくない + ことはない（行けない → 行けないことはない）',
    zh: '辣的菜我也不是不能吃。',
    en: "It's not that I can't eat spicy food.",
    group: 'partial-neg',
    more: [
      {
        ja: '今から急げば、間に合わないこともないよ。',
        zh: '现在抓紧的话，也不是赶不上。',
        en: 'If we hurry now, we might still make it.'
      },
      {
        ja: '車で行けないことはありませんが、電車のほうが便利です。',
        zh: '开车也不是不能去，不过坐电车更方便。',
        en: 'You could go by car, but the train is more convenient.'
      }
    ]
  },
  kotoda: {
    form: 'V辞書形 / Vない形 + ことだ',
    zh: '想把日语学好，最好每天都开口说。',
    en: 'If you want to get good at Japanese, the best thing is to speak it every day.',
    group: 'should',
    more: [
      {
        ja: '風邪のときは、とにかくゆっくり休むことですね。',
        zh: '感冒的时候，总之最好好好休息。',
        en: 'When you have a cold, the best thing is just to get plenty of rest.'
      },
      {
        ja: '人に信じてもらいたいなら、うそをつかないことだ。',
        zh: '想让别人信任你，就别说谎。',
        en: "If you want people to trust you, don't tell lies."
      }
    ]
  },
  monoda: {
    form: 'V辞書形 / いA + ものだ（本来如此、感慨）· Vた形 + ものだ（过去常常）',
    zh: '人谁都会犯错。',
    en: "Everyone makes mistakes — that's just human nature.",
    group: 'should',
    more: [
      {
        ja: '子供のころは、よくこの川で泳いだものです。',
        zh: '小时候，我常在这条河里游泳。',
        en: 'When I was a child, I often used to swim in this river.'
      },
      {
        ja: '一年がたつのは、本当に早いものだ。',
        zh: '一年过得真快啊。',
        en: 'A year really does go by quickly.'
      }
    ]
  },
  monodewanai: {
    form: 'V辞書形 + ものではない',
    zh: '不该说别人的坏话。',
    en: "You shouldn't speak ill of others.",
    group: 'should',
    more: [
      {
        ja: '食べ物を残すもんじゃないよ。',
        zh: '不该剩饭哦。',
        en: "You shouldn't leave food on your plate."
      },
      {
        ja: '夜遅くに、人の家に電話をかけるものではありません。',
        zh: '不该在深夜往别人家里打电话。',
        en: "You shouldn't phone people at home late at night."
      }
    ]
  },
  mondakara: {
    form: '普通形（なAな・Nな）+ ものだから / もので',
    zh: '因为路上堵车，所以迟到了。',
    en: 'The roads were jammed, you see, so I ended up being late.',
    group: 'reason',
    more: [
      {
        ja: 'すみません、急いでいたもので、連絡するのを忘れていました。',
        zh: '对不起，因为太匆忙，忘了跟您联系。',
        en: 'Sorry — I was in a hurry, so I forgot to get in touch.'
      },
      {
        ja: '母が熱を出したもんだから、昨日は学校を休んだんだ。',
        zh: '因为妈妈发烧了，我昨天就没去上学。',
        en: 'My mom had a fever, so I stayed home from school yesterday.'
      }
    ]
  },

  // ── 程度与感情 ──
  teshikataganai: {
    form: 'Vて形 / いAくて / なAで + しかたがない（しょうがない）',
    zh: '我非常在意考试结果。',
    en: "I can't stop worrying about my exam results.",
    group: 'feeling',
    more: [
      {
        ja: 'ゆうべあまり寝ていないので、眠くてしょうがない。',
        zh: '昨晚没怎么睡，困得不得了。',
        en: "I hardly slept last night, so I'm terribly sleepy."
      },
      {
        ja: '一人暮らしを始めたころは、毎晩寂しくて仕方がなかった。',
        zh: '刚开始一个人生活的时候，每天晚上都寂寞得不得了。',
        en: 'When I first started living on my own, I was terribly lonely every night.'
      }
    ]
  },
  tetamaranai: {
    form: 'Vて形 / いAくて / なAで + たまらない（会いたくて · 暑くて · 心配で）',
    zh: '今天从早上起就热得受不了。',
    en: "It's been unbearably hot since this morning.",
    group: 'feeling',
    more: [
      {
        ja: 'しばらく家族に会っていないから、会いたくてたまらないよ。',
        zh: '好久没见家人了，想他们想得不得了。',
        en: "I haven't seen my family for a while, and I'm dying to see them."
      },
      {
        ja: '合格の知らせを聞いたときは、うれしくてたまりませんでした。',
        zh: '听到合格的消息时，我高兴得不得了。',
        en: "When I heard I'd passed, I was overjoyed."
      }
    ]
  },
  kurai: {
    form: 'V辞書形 / Vない形 / いA + くらい（ぐらい）',
    zh: '肚子疼得站都站不住。',
    en: 'My stomach hurt so much I could hardly stand.',
    group: 'degree',
    more: [
      {
        ja: '涙が出るぐらい笑ったよ。',
        zh: '笑得眼泪都出来了。',
        en: 'I laughed so hard I cried.'
      },
      {
        ja: 'この町は、夜になると怖いくらい静かになる。',
        zh: '这个小镇一到晚上就安静得吓人。',
        en: "At night this town gets so quiet it's almost frightening."
      }
    ]
  },
  hodo: {
    form: 'V辞書形 / Vない形 / いA + ほど',
    zh: '我懊恼得想哭。',
    en: 'I was so frustrated I wanted to cry.',
    group: 'degree',
    more: [
      {
        ja: '日本語は、勉強するほど面白くなる。',
        zh: '日语越学越有意思。',
        en: 'The more you study Japanese, the more interesting it gets.'
      },
      {
        ja: '駅前の店は、驚くほど安かった。',
        zh: '车站前那家店便宜得惊人。',
        en: 'The shop in front of the station was amazingly cheap.'
      }
    ]
  },
  bahodo: {
    form: 'Vば形 + V辞書形 + ほど · いAければ + いA + ほど · なAなら + なAな + ほど',
    zh: '越想越糊涂。',
    en: 'The more I think about it, the less I understand.',
    group: 'degree',
    more: [
      {
        ja: '野菜は新しければ新しいほどおいしいよ。',
        zh: '蔬菜越新鲜越好吃哦。',
        en: 'The fresher vegetables are, the better they taste.'
      },
      {
        ja: '説明は、簡単なら簡単なほどいい。',
        zh: '说明越简单越好。',
        en: 'The simpler an explanation is, the better.'
      }
    ]
  },

  // ── 添加与强调 ──
  sae: {
    form: 'N + さえ / でさえ',
    zh: '忙得连喝水的时间都没有。',
    en: "I was so busy I didn't even have time to drink water.",
    group: 'even',
    more: [
      {
        ja: 'こんな簡単な問題、子供でさえ分かるよ。',
        zh: '这么简单的题，连小孩都会。',
        en: 'Even a child could answer a question this easy.'
      },
      {
        ja: '祖母は、昨日のことさえ忘れてしまうことがある。',
        zh: '奶奶有时连昨天的事都会忘记。',
        en: 'My grandmother sometimes forgets even what happened yesterday.'
      }
    ]
  },
  koso: {
    form: 'N + こそ',
    zh: '今年我一定要通过考试。',
    en: "This year, I'm going to pass the exam for sure.",
    more: [
      {
        ja: 'いいえ、こちらこそお世話になりました。',
        zh: '哪里，是我受您照顾了。',
        en: "Not at all — I'm the one who should be thanking you."
      },
      {
        ja: '失敗から学ぶことこそ、一番大切だ。',
        zh: '从失败中学习，才是最重要的。',
        en: 'Learning from failure is what matters most.'
      }
    ]
  },
  dakedenaku: {
    form: 'N / 普通形（なAな）+ だけでなく',
    zh: '这家店不仅便宜，味道也好。',
    en: "This restaurant isn't just cheap — the food is good too.",
    group: 'not-only',
    more: [
      {
        ja: '週末は掃除だけじゃなく、洗濯もしないと。',
        zh: '周末不光要打扫，还得洗衣服。',
        en: 'This weekend I have to do the laundry as well as the cleaning.'
      },
      {
        ja: 'この問題は、日本だけではなく世界中で起きている。',
        zh: '这个问题不仅在日本，在全世界都在发生。',
        en: 'This problem is happening not only in Japan but all over the world.'
      }
    ]
  },
  wamochiron: {
    form: 'N + はもちろん（のこと）',
    zh: '这个公园周末自不用说，平时人也很多。',
    en: 'This park is crowded on weekdays, not to mention weekends.',
    group: 'not-only',
    more: [
      {
        ja: '彼女は英語はもちろん、中国語も話せるんだよ。',
        zh: '她英语自不用说，连中文都会说。',
        en: 'She speaks Chinese too, not to mention English.'
      },
      {
        ja: 'この料理は、子供はもちろんのこと、大人にも人気がある。',
        zh: '这道菜孩子自不用说，大人也很喜欢。',
        en: 'This dish is popular with adults, not to mention children.'
      }
    ]
  },

  // ── 原因 ──
  okagede: {
    form: '普通形（なAな・Nの）+ おかげで',
    zh: '多亏了老师，我通过了考试。',
    en: 'Thanks to my teacher, I passed the exam.',
    group: 'reason',
    more: [
      {
        ja: '毎日歩いているおかげで、体の調子がいい。',
        zh: '多亏每天走路，身体状况很好。',
        en: "Thanks to walking every day, I'm in good shape."
      },
      {
        ja: '試合に勝てたのは、皆さんが応援してくれたおかげです。',
        zh: '能赢得比赛，多亏了大家的支持。',
        en: 'We won the match thanks to all your support.'
      }
    ]
  },
  seide: {
    form: '普通形（なAな・Nの）+ せいで / せいか',
    zh: '都怪下雨，比赛取消了。',
    en: 'The match was called off because of the rain.',
    group: 'reason',
    more: [
      {
        ja: '年のせいか、最近疲れやすい。',
        zh: '也许是年纪大了，最近容易累。',
        en: "Maybe it's my age, but I get tired easily these days."
      },
      {
        ja: '遅れたのは、君が寝坊したせいだよ。',
        zh: '迟到都怪你睡过头了。',
        en: "We're late because you overslept."
      }
    ]
  },

  // ── 传闻、确认与换个说法 ──
  toiukotoda: {
    form: '普通形 + ということだ',
    zh: '据天气预报说，明天会下雪。',
    en: "According to the weather forecast, it's going to snow tomorrow.",
    group: 'seem',
    more: [
      {
        ja: 'つまり、明日の会議は中止ということですね。',
        zh: '也就是说，明天的会议取消了，对吧。',
        en: "So that means tomorrow's meeting is cancelled, right?"
      },
      {
        ja: '駅前の古い映画館が、来月閉まるということです。',
        zh: '听说车站前那家老电影院下个月要关门了。',
        en: 'I hear the old cinema in front of the station is closing next month.'
      }
    ]
  },
  toiuyori: {
    form: '普通形 / N + というより',
    zh: '今天与其说暖和，不如说有点热了。',
    en: "It's not so much warm today as hot.",
    more: [
      {
        ja: 'あの人は先生というより、友達みたいな感じだね。',
        zh: '那个人与其说是老师，更像朋友。',
        en: "He's less like a teacher and more like a friend."
      },
      {
        ja: 'この本は小説というよりも、むしろ歴史の記録に近い。',
        zh: '这本书与其说是小说，不如说更接近历史记录。',
        en: 'This book is closer to a historical record than a novel.'
      }
    ]
  },
  tte: {
    form: '普通形 / N + って（来るって · 店って · 「…」っていう）',
    zh: '听说田中下个月要结婚。',
    en: "I heard Tanaka's getting married next month.",
    group: 'seem',
    more: [
      {
        ja: 'ねえ、駅の近くにできた店って、もう行った？',
        zh: '哎，车站附近新开的那家店，你去过了吗？',
        en: 'Hey, have you been to that new shop near the station yet?'
      },
      {
        ja: '「ゆず」っていう果物を知っていますか。',
        zh: '你知道一种叫「柚子」的水果吗？',
        en: 'Do you know a fruit called yuzu?'
      }
    ]
  },
  kke: {
    form: 'Nだ / Vた形 + っけ（何時からだっけ · 置いたっけ · 何でしたっけ）',
    zh: '会议是几点开始来着？',
    en: 'What time does the meeting start again?',
    more: [
      {
        ja: 'あれ、鍵をどこに置いたっけ。',
        zh: '咦，我把钥匙放哪儿了来着？',
        en: 'Hmm, where did I put my keys?'
      },
      {
        ja: 'すみません、お名前は何でしたっけ。',
        zh: '不好意思，您叫什么名字来着？',
        en: 'Sorry, what was your name again?'
      }
    ]
  },

  // ── 时间：正要、趁着、每当 ──
  tokoro: {
    form: 'V辞書形 / Vている / Vた形 + ところだ',
    zh: '我正要出门。',
    en: "I'm just about to go out.",
    group: 'during',
    more: [
      {
        ja: '今、晩ご飯を作っているところだから、あとで電話するね。',
        zh: '我现在正在做晚饭，待会儿给你打电话。',
        en: "I'm in the middle of making dinner, so I'll call you later."
      },
      {
        ja: 'ちょうど今、駅に着いたところです。',
        zh: '我刚刚到车站。',
        en: "I've just arrived at the station."
      }
    ]
  },
  uchini: {
    form: 'V辞書形 / Vている / Vない形 / いA / なAな / Nの + うちに',
    zh: '我想趁年轻去各种国家看看。',
    en: "I want to visit lots of countries while I'm young.",
    more: [
      {
        ja: '暗くならないうちに、早く帰ろう。',
        zh: '趁天还没黑，快回家吧。',
        en: "Let's hurry home before it gets dark."
      },
      {
        ja: '何度も話しているうちに、彼と仲良くなった。',
        zh: '聊着聊着，我就和他成了好朋友。',
        en: 'As we talked again and again, he and I became good friends.'
      }
    ]
  },
  tabini: {
    form: 'V辞書形 / Nの + たびに',
    zh: '每当听到这首歌，我就会想起故乡。',
    en: 'Every time I hear this song, I think of my hometown.',
    group: 'if',
    more: [
      {
        ja: '父は出張のたびに、お土産を買ってきてくれる。',
        zh: '爸爸每次出差都会给我带礼物回来。',
        en: 'My father brings me back a present every time he goes on a business trip.'
      },
      {
        ja: '会うたびに、背が高くなっているね。',
        zh: '每次见到你，你都长高了呢。',
        en: 'You get taller every time I see you!'
      }
    ]
  },
  saichuu: {
    form: 'Vている / Nの + 最中に（最中だ）',
    zh: '正在开会的时候，手机响了。',
    en: 'My phone rang in the middle of the meeting.',
    group: 'during',
    more: [
      {
        ja: '今、宿題をやっている最中だから、静かにして。',
        zh: '我正在写作业，安静点。',
        en: "I'm in the middle of my homework, so please be quiet."
      },
      {
        ja: '食事の最中に地震があって、みんな驚いた。',
        zh: '正在吃饭的时候发生了地震，大家都吓了一跳。',
        en: 'There was an earthquake in the middle of our meal, and everyone got a fright.'
      }
    ]
  },

  // ── 时间的先后与顺便 ──
  totan: {
    form: 'Vた形 + とたん（に）',
    zh: '刚一开门，猫就跑了出来。',
    en: 'The moment I opened the door, the cat ran out.',
    group: 'as-soon-as',
    more: [
      {
        ja: '布団に入ったとたん、寝ちゃったよ。',
        zh: '我一钻进被窝就睡着了。',
        en: 'I fell asleep the moment I got into bed.'
      },
      {
        ja: '新しい商品が発売されたとたん、店の前に長い列ができた。',
        zh: '新商品一发售，店门前就排起了长队。',
        en: 'As soon as the new product went on sale, a long line formed outside the shop.'
      }
    ]
  },
  irai: {
    form: 'Vて形 / N + 以来',
    zh: '自从来到日本，我一直住在这个小镇。',
    en: "I've lived in this town ever since I came to Japan.",
    group: 'after',
    more: [
      {
        ja: '卒業以来、彼とは一度も会っていない。',
        zh: '毕业以后，我和他一次也没见过。',
        en: "I haven't seen him once since we graduated."
      },
      {
        ja: '一度その店のラーメンを食べて、それ以来ファンになった。',
        zh: '吃过一次那家店的拉面，从那以后就彻底成了它的粉丝。',
        en: "I tried the ramen at that shop once, and I've been a big fan ever since."
      }
    ]
  },
  tehajimete: {
    form: 'Vて形 + はじめて',
    zh: '生了病才知道健康的可贵。',
    en: 'It was only after I got sick that I realized how precious good health is.',
    group: 'after',
    more: [
      {
        ja: '親になって初めて、親の苦労が分かったよ。',
        zh: '自己当了父母，才明白父母的辛苦。',
        en: "It wasn't until I became a parent that I understood what my parents went through."
      },
      {
        ja: '実際に使ってみて初めて、その製品のよさが分かる。',
        zh: '只有实际用过之后，才能体会到这个产品的好处。',
        en: "You only appreciate how good the product is once you've actually used it."
      }
    ]
  },
  tsuideni: {
    form: 'V辞書形 / Vた形 / Nの + ついでに',
    zh: '去买东西的时候，顺便去了一趟邮局。',
    en: 'I stopped by the post office while I was out shopping.',
    group: 'on-the-way',
    more: [
      {
        ja: 'コンビニに行くついでに、牛乳を買ってきてくれる？',
        zh: '你去便利店的时候，顺便帮我买瓶牛奶好吗？',
        en: "Since you're going to the convenience store, could you pick up some milk for me?"
      },
      {
        ja: '実家に帰ったついでに、昔の友達に会ってきた。',
        zh: '回老家的时候，顺便见了老朋友。',
        en: "While I was back at my parents' place, I caught up with some old friends."
      }
    ]
  }
}

const lessons: LessonSpec[] = [
  {
    id: 'n3-2',
    title: { zh: '正要、趁着、每当', en: 'About to, while, every time' },
    items: ['tokoro', 'uchini', 'tabini', 'saichuu']
  },
  {
    id: 'n3-3',
    title: { zh: '时间的先后与顺便', en: 'Sequence in time, and “while you’re at it”' },
    items: ['totan', 'irai', 'tehajimete', 'tsuideni']
  },
  {
    id: 'n3-5',
    title: { zh: '原因：多亏、都怪、辩解', en: 'Causes: thanks to, blame and excuses' },
    items: ['okagede', 'seide', 'mondakara']
  },
  {
    id: 'n3-6',
    title: { zh: '添加与强调', en: 'Adding and emphasizing' },
    items: ['dakedenaku', 'wamochiron', 'sae', 'koso']
  },
  {
    id: 'n3-9',
    title: { zh: '传闻、确认与换个说法', en: 'Hearsay, checking and rephrasing' },
    items: ['tte', 'kke', 'toiukotoda', 'toiuyori']
  },
  {
    id: 'n3-10',
    title: { zh: '程度与感情', en: 'Degree and feelings' },
    items: ['kurai', 'hodo', 'bahodo', 'tetamaranai', 'teshikataganai']
  },
  {
    id: 'n3-13',
    title: { zh: '应该、只好与推断', en: 'Should, no choice, and inference' },
    items: ['bekida', 'shikanai', 'nichigainai', 'hazuganai', 'towakagiranai']
  },
  {
    id: 'n3-14',
    title: { zh: '「わけ」的句型', en: 'Patterns with わけ' },
    items: ['wake', 'wakedewanai', 'wakeganai', 'wakeniwaikanai']
  },
  {
    id: 'n3-15',
    title: { zh: '「もの」「こと」的句型', en: 'Patterns with もの and こと' },
    items: ['monoda', 'monodewanai', 'kotoda', 'kotowanai', 'naikotowanai']
  }
]

export const N3_GRAMMAR: LevelGrammar = { points, notes, lessons }
