/**
 * JLPT N1 的语法（一）：让步、列举、强调、「一……就」、情形与条件、起点与界限、极端的程度、感慨。
 * 语法点（阅读器的「本文语法」、语法课、练习都用）、语法课的接续与例句翻译、分课都写在这里；
 * 写法见 grammar-def.ts，N1 的两个文件在 grammar-levels.ts 里并成一级（课按编号交错排）。
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

/** 〜なり〜なり、〜といい〜といい 中间的那个词 */
const MID: TokenSpec = { pos: ['名詞', '動詞'] }
const MID_N: TokenSpec = { pos: '名詞' }
const COMMA: TokenSpec = { s: '、' }
const NARI: TokenSpec = { s: 'なり', pos: '助詞' }
const TO: TokenSpec = { s: 'と', pos: '助詞' }
const II_SAY: TokenSpec = { s: ['いい', '言い'] }
/** 〜たら最後 后面不能接の、に这些（〜たら最後のページ、〜たら最後に 是「最后」） */
const NOT_LAST: TokenSpec = {
  s: ['に', 'の', 'まで', 'は', 'が', 'を', 'も', 'だ', 'です', 'で', 'と'],
  ctx: true,
  not: true
}
/** 〜限りだ 的「だ」（である 的で 原形也是だ，要排在前面） */
const KAGIRI_END: TokenSpec[][] = [
  [{ s: ['限り', 'かぎり'] }, { s: 'で' }, { b: 'ある' }],
  [{ s: ['限り', 'かぎり'] }, { b: ['だ', 'です'] }]
]
/** 〜をもって：前面是「持有」的东西（責任をもって、自信をもって）不算 */
const NOT_HAVE: TokenSpec = {
  s: ['責任', '自信', '興味', '関心', '誇り', '希望', '夢', '傘', '荷物', '地図'],
  ctx: true,
  not: true
}
/** 〜をもって、〜にして 后面不能是补助动词（をもっている、一人にしておく） */
const NOT_HELPER: TokenSpec = {
  pos: '動詞',
  b: [
    'いる',
    'いく',
    '行く',
    'くる',
    '来る',
    'おく',
    'もらう',
    'いただく',
    'くれる',
    'あげる',
    'やる',
    'みる',
    'しまう',
    'ある',
    'くださる',
    '下さる'
  ],
  ctx: true,
  not: true
}
/** 〜にして 前面表示年龄、次数、时间的量词 */
const TIME_COUNTERS = [
  '歳',
  '才',
  '年',
  '日',
  '回',
  '回目',
  '度',
  '度目',
  '年目',
  '日目',
  '週間',
  '時間',
  '分',
  '秒',
  '代',
  'か月',
  'ヶ月',
  'カ月',
  '箇月',
  '月'
]
/** 〜とは思わなかった：前面不能是「〜よう」「〜たい」（没打算、不想） */
const NOT_WILL: TokenSpec = { pos: '助動詞', b: ['う', 'よう', 'たい'], ctx: true, not: true }
/** 〜とは（惊讶）：と、は */
const TOWA: TokenSpec[] = [
  { s: 'と', pos: '助詞' },
  { s: 'は', pos: '助詞' }
]

const points: GrammarPoint[] = [
  // ── 让步 ──
  P('towaie', 1, '〜とはいえ', '虽说……', 'although …; that said', '春とはいえ、朝晩はまだ寒い。', [
    [
      TO,
      { s: 'は' },
      { b: ['いう', '言う'], s: ['いえ', '言え'] },
      { s: ['ない', 'ませ', 'なかっ', 'ず', 'ぬ', 'なく'], ctx: true, not: true }
    ]
  ]),
  P(
    'toiedomo',
    1,
    '〜といえども',
    '即使是……',
    'even (though it is) …',
    '子どもといえども、ルールは守らなければならない。',
    [[TO, { b: ['いう', '言う'], s: ['いえ', '言え'] }, { s: ['ども', 'ど'] }]]
  ),
  P(
    'deare',
    1,
    '〜であれ／〜であろうと',
    '无论是……；不管是……',
    'whatever …; whether … or …',
    'どんな理由であれ、約束を破るのはよくない。',
    [
      [
        { s: 'で', pos: '助動詞' },
        { b: 'ある', s: 'あれ', cf: '命令ｅ' },
        { s: ['。', '！', '!', '」', 'と'], ctx: true, not: true }
      ],
      [{ s: 'で', pos: '助動詞' }, { s: 'あろ' }, { s: 'う' }, { s: 'と', p1: '接続助詞' }]
    ]
  ),
  P(
    'tatokorode',
    1,
    '〜たところで',
    '即使……也（没用）',
    'even if … (it would be no use)',
    '今から急いだところで、もう間に合わないだろう。',
    [
      [
        { pos: '助動詞', ct: '特殊・タ', cf: '基本形' },
        { s: 'ところ' },
        { s: 'で', pos: '助詞' },
        { s: 'は', ctx: true, not: true }
      ]
    ]
  ),
  P(
    'naimademo',
    1,
    '〜ないまでも',
    '即使不……至少也',
    'even if not …, at least',
    '毎日とは言わないまでも、週に一度は運動したほうがいい。',
    [[{ b: ['ない', 'ぬ'], pos: ['助動詞', '形容詞'] }, { s: 'まで' }, { s: 'も' }]]
  ),
  P(
    'naramadashimo',
    1,
    '〜ならまだしも',
    '如果是……还可以（可是）',
    '… would be one thing, but',
    '子どもならまだしも、大人がそんなことを言うなんて。',
    [
      [{ s: 'なら' }, { s: 'まだしも' }],
      [{ s: 'なら' }, { s: 'まだ' }, { s: 'しも' }]
    ]
  ),

  // ── 列举 ──
  P(
    'nomiarazu',
    1,
    '〜のみならず',
    '不仅……（而且）',
    'not only … (but also)',
    'この問題は国内のみならず、海外でも注目されている。',
    [[{ s: 'のみ' }, { s: 'なら' }, { s: 'ず' }]]
  ),
  P(
    'toii',
    1,
    '〜といい〜といい',
    '……也好，……也好（都）',
    'both … and … (in every respect)',
    '味といい値段といい、この店は文句なしだ。',
    [
      [TO, II_SAY, MID_N, TO, II_SAY],
      [TO, II_SAY, MID_N, MID_N, TO, II_SAY],
      [TO, II_SAY, COMMA, MID_N, TO, II_SAY],
      [TO, II_SAY, COMMA, MID_N, MID_N, TO, II_SAY]
    ]
  ),
  P(
    'narinari',
    1,
    '〜なり〜なり',
    '……或者……（都行）',
    '… or … (or whatever)',
    '困ったときは、電話なりメールなりで知らせてください。',
    [
      [NARI, MID, NARI],
      [NARI, MID, MID, NARI],
      [NARI, COMMA, MID, NARI],
      [NARI, COMMA, MID, MID, NARI]
    ]
  ),

  // ── 强调 ──
  P(
    'sura',
    1,
    '〜すら',
    '连……都',
    'even …',
    '疲れすぎて、立つことすらできなかった。',
    // 〜ですら 连「で」一起（跟 N3 的〜でさえ 一样）
    [[{ s: 'で' }, { s: 'すら', pos: '助詞' }], [{ s: 'すら', pos: '助詞' }]]
  ),
  P(
    'tekoso',
    1,
    '〜てこそ',
    '只有……才',
    'only by …; only when …',
    '自分でやってみてこそ、その大変さが分かる。',
    [[TE, { s: 'こそ' }]]
  ),
  P(
    'bakoso',
    1,
    '〜ばこそ',
    '正因为……',
    'precisely because …',
    '子どものことを思えばこそ、親は厳しく叱るのだ。',
    [[{ s: 'ば', pos: '助詞', p1: '接続助詞' }, { s: 'こそ' }]]
  ),
  P(
    'taritomo',
    1,
    '〜たりとも',
    '连一……也（不）',
    'not even (a single) …',
    '一日たりとも練習を休んだことはない。',
    [[{ pos: '名詞', ctx: true }, { s: 'たり' }, { s: 'と' }, { s: 'も' }]]
  ),
  P(
    'dani',
    1,
    '〜だに',
    '连……都；光是……就',
    'even …; just (thinking of it)',
    '締め切りに間に合わないなんて、想像するだに恐ろしい。',
    [
      [
        { pos: ['動詞', '助動詞', '助詞', '名詞'], ctx: true },
        { s: 'だに', pos: '助詞' }
      ],
      [{ s: ['微動', '一顧'], ctx: true }, { s: 'だ' }, { s: 'に' }]
    ]
  ),

  // ── 一……就 ──
  P(
    'nari',
    1,
    '〜なり',
    '一……就（马上）',
    'as soon as … (at once)',
    '彼は部屋に入るなり、窓を開けた。',
    [
      [
        { pos: '動詞', cf: '基本形', ctx: true },
        { s: 'なり', pos: '助詞' },
        { s: 'に', ctx: true, not: true }
      ]
    ]
  ),
  P(
    'yaina',
    1,
    '〜や否や／〜や',
    '刚一……就',
    'as soon as …; no sooner … than',
    'ベルが鳴るや否や、生徒たちは教室を飛び出した。',
    [
      [{ s: 'や' }, { s: ['否', 'いな'] }, { s: 'や' }],
      [{ s: 'やいなや' }],
      [
        { pos: '動詞', cf: '基本形', ctx: true },
        { s: 'や', pos: '助詞', p1: '接続助詞' }
      ]
    ]
  ),
  P(
    'gahayaika',
    1,
    '〜が早いか',
    '刚一……就',
    'the moment …; no sooner … than',
    '弟は家に帰るが早いか、ゲームを始めた。',
    [
      [
        { pos: ['動詞', '助動詞'], ctx: true },
        { s: 'が' },
        { s: ['早い', '速い', 'はやい'] },
        { s: 'か' }
      ]
    ]
  ),
  P(
    'sobakara',
    1,
    '〜そばから',
    '刚……就（又）',
    'no sooner … than (again)',
    '単語を覚えるそばから忘れてしまう。',
    [[{ pos: ['動詞', '助動詞'], ctx: true }, { s: ['そば', '傍'] }, { s: 'から' }]]
  ),

  // ── 情形与条件 ──
  P(
    'toatte',
    1,
    '〜とあって',
    '因为是……',
    'because it is …; it being …',
    '連休とあって、観光地はどこも人でいっぱいだ。',
    [[TO, { b: 'ある', s: 'あっ' }, TE]]
  ),
  P(
    'toareba',
    1,
    '〜とあれば',
    '如果是……的话',
    'if it is (for) …',
    '子どものためとあれば、親はどんな苦労もいとわない。',
    [[TO, { b: 'ある', s: 'あれ' }, { s: 'ば' }]]
  ),
  P(
    'tomonaruto',
    1,
    '〜ともなると／〜ともなれば',
    '一旦到了……（就）',
    'once it comes to …; when one becomes …',
    '十二月ともなると、街はすっかりクリスマスの雰囲気になる。',
    [
      [TO, { s: 'も' }, { s: 'なる' }, { s: 'と' }],
      [TO, { s: 'も' }, { s: 'なれ' }, { s: 'ば' }]
    ]
  ),
  P(
    'ikan',
    1,
    '〜いかんで／〜いかんによっては／〜いかんにかかわらず',
    '取决于……；不管……如何',
    'depending on …; regardless of …',
    '試験の結果いかんで、進学できるかどうかが決まる。',
    [
      [{ s: ['いかん', '如何'] }, { s: 'によって' }, { s: 'は' }],
      [{ s: ['いかん', '如何'] }, { s: 'に' }, { s: 'よっ' }, TE, { s: 'は' }],
      [{ s: ['いかん', '如何'] }, { s: 'によって' }],
      [{ s: ['いかん', '如何'] }, { s: 'に' }, { s: 'よっ' }, TE],
      [
        { s: ['いかん', '如何'] },
        { s: 'に' },
        { b: ['かかわる', '関わる', '拘わる', '係わる'] },
        { s: 'ず' }
      ],
      [{ s: ['いかん', '如何'] }, { s: 'に' }, { b: 'よる' }, { s: 'ず' }],
      [{ s: ['いかん', '如何'] }, { s: 'を' }, { b: '問う' }, { s: 'ず' }],
      [{ s: ['いかん', '如何'] }, { s: 'で' }, { s: 'は' }],
      [{ s: ['いかん', '如何'] }, { s: 'で' }]
    ]
  ),
  P(
    'taraasaigo',
    1,
    '〜たら最後／〜が最後',
    '一旦……就（再也）',
    'once … (there is no going back)',
    '父はソファに座ったら最後、なかなか立ち上がらない。',
    [
      [{ pos: '助動詞', ct: '特殊・タ', cf: '仮定形' }, { s: '最後' }, NOT_LAST],
      [
        { pos: '助動詞', ct: '特殊・タ', cf: '基本形', ctx: true },
        { s: 'が' },
        { s: '最後' },
        NOT_LAST
      ]
    ]
  ),

  // ── 起点、界限与时机 ──
  P(
    'womotte',
    1,
    '〜をもって',
    '以……；凭借……',
    'with …; by means of …; as of …',
    '以上をもって、本日の会議を終わります。',
    [
      [NOT_HAVE, { s: 'を' }, { s: 'もっ' }, TE, NOT_HELPER],
      [NOT_HAVE, { s: 'をもって' }, NOT_HELPER],
      [{ s: 'をもちまして' }],
      [{ s: 'を' }, { s: 'もち' }, { s: 'まし' }, TE]
    ]
  ),
  P(
    'tekaratoiumono',
    1,
    '〜てからというもの',
    '自从……以后（一直）',
    'ever since …',
    '犬を飼い始めてからというもの、毎朝散歩するようになった。',
    [
      [TE, { s: 'から' }, { s: 'という' }, { s: ['もの', '物'] }],
      [TE, { s: 'から' }, { s: 'と' }, { b: ['いう', '言う'] }, { s: ['もの', '物'] }]
    ]
  ),
  P(
    'wokagirini',
    1,
    '〜を限りに',
    '以……为限',
    'as of … (and no longer)',
    '本日を限りに、当店は閉店いたします。',
    [[{ s: '声', ctx: true, not: true }, { s: 'を' }, { s: ['限り', 'かぎり'] }, { s: 'に' }]]
  ),
  P(
    'wokawakirini',
    1,
    '〜を皮切りに',
    '以……为开端',
    'starting with …',
    'この発言を皮切りに、次々と反対意見が出された。',
    [[{ s: 'を' }, { s: ['皮切り', 'かわきり'] }, { s: 'に' }]]
  ),
  P(
    'niitatte',
    1,
    '〜に至って／〜に至っては／〜に至るまで',
    '到了……（才）；至于……；直至……',
    'only when it came to …; as for …; (all the way) down to …',
    '事故が起きるに至って、ようやく会社は安全対策を見直した。',
    [
      [{ s: 'に' }, { b: ['至る', 'いたる'] }, TE, { s: 'は' }],
      [{ s: 'に' }, { b: ['至る', 'いたる'] }, TE],
      [{ s: 'に' }, { s: ['至る', 'いたる'] }, { s: 'まで' }]
    ]
  ),
  P(
    'nishite',
    1,
    '〜にして',
    '到了……才；（仅仅）……就',
    'only at …; in (just) …',
    '彼は四十歳にして、初めて海外へ行った。',
    [
      // 〜にして初めて：连「初めて」一起，免得「て初めて」再认成 N3 的〜てはじめて（大切にして初めて 不算）
      [
        { pos: '名詞', p1: ['一般', '代名詞', '固有名詞', '接尾', '数', '副詞可能'], ctx: true },
        { s: 'に' },
        { b: 'する', s: 'し' },
        TE,
        { s: ['初めて', 'はじめて'] }
      ],
      [
        { pos: '名詞', p1: '接尾', s: TIME_COUNTERS, ctx: true },
        { s: 'に' },
        { b: 'する', s: 'し' },
        TE,
        NOT_HELPER
      ],
      [
        { s: ['一瞬', '一夜', '瞬時', '一朝'], ctx: true },
        { s: 'に' },
        { b: 'する', s: 'し' },
        TE,
        NOT_HELPER
      ],
      [
        { s: 'に' },
        { b: 'する', s: 'し' },
        TE,
        { s: ['ようやく', '早くも', 'すでに', '既に'], ctx: true }
      ]
    ]
  ),

  // ── 对照、搁置与「别说」 ──
  P(
    'waoroka',
    1,
    '〜はおろか',
    '别说……，就连',
    'let alone …; not to mention …',
    '忙しくて、旅行はおろか、休日もほとんどない。',
    [
      [
        { s: 'は' },
        { s: 'おろか' },
        {
          s: ['だ', 'な', 'です', 'で', 'に', 'さ', 'じゃ', 'だっ', 'でし', '者'],
          ctx: true,
          not: true
        }
      ]
    ]
  ),
  P(
    'mosarukotonagara',
    1,
    '〜もさることながら',
    '……自不用说（……更）',
    'not only … but (even more)',
    'この映画は、ストーリーもさることながら、音楽がすばらしい。',
    [[{ s: 'も' }, { s: ['さる', '然る'] }, { s: ['こと', '事'] }, { s: 'ながら' }]]
  ),
  P(
    'wasateoki',
    1,
    '〜はさておき',
    '暂且不谈……',
    'setting … aside',
    '冗談はさておき、そろそろ本題に入りましょう。',
    [[{ s: 'は' }, { b: ['さておく', 'さて置く'] }]]
  ),
  P(
    'nihikikae',
    1,
    '〜にひきかえ',
    '与……相反',
    'in contrast to …',
    '兄が活発なのにひきかえ、弟はおとなしい。',
    [
      [
        { s: 'に' },
        { b: ['ひきかえる', '引き換える', '引きかえる', '引換える'], cf: '連用形' },
        { pos: ['助詞', '助動詞'], ctx: true, not: true }
      ]
    ]
  ),

  // ── 极端的程度 ──
  P(
    'kagirida',
    1,
    '〜限りだ',
    '极其……；……得很',
    'extremely …; so …',
    '一人で海外に住むのは、心細い限りだ。',
    KAGIRI_END.map((seq) => [{ pos: ['形容詞', '助動詞'], ctx: true }, ...seq])
  ),
  P(
    'kiwamari',
    1,
    '〜極まりない／〜極まる',
    '极其……；……至极',
    'extremely …; utterly …',
    '夜中に大声で騒ぐなんて、迷惑極まりない。',
    [
      [{ b: ['極まりない', 'きわまりない'] }],
      [{ s: ['極まり', 'きわまり'] }, { b: 'ない' }],
      [{ s: '進退', ctx: true, not: true }, { b: ['極まる', 'きわまる'] }]
    ]
  ),
  P(
    'nokiwami',
    1,
    '〜の極み',
    '……之极',
    'the height of …',
    '高級ホテルの最上階で食事なんて、ぜいたくの極みだ。',
    [[{ s: 'の' }, { s: ['極み', 'きわみ'] }]]
  ),
  P(
    'noitari',
    1,
    '〜の至り',
    '……之至',
    'the utmost …; truly …',
    'このような賞をいただき、光栄の至りです。',
    [[{ s: 'の' }, { s: ['至り', 'いたり'] }]]
  ),

  // ── 感慨、遗憾与无奈 ──
  P(
    'towa',
    1,
    '〜とは',
    '竟然……（惊讶、感叹）',
    'to think that …!',
    'こんなところで昔の友達に会うとは思わなかった。',
    [
      [NOT_WILL, ...TOWA, { s: ['思わ', 'おもわ'], ctx: true }, { s: 'なかっ', ctx: true }],
      [...TOWA, { s: ['思い', 'おもい'], ctx: true }, { s: 'も', ctx: true }],
      [...TOWA, { s: '夢', ctx: true }, { s: 'に', ctx: true }, { s: 'も', ctx: true }],
      [...TOWA, { s: '知ら', ctx: true }, { s: 'なかっ', ctx: true }],
      [...TOWA, { s: ['驚い', '驚き', 'びっくり', '意外', '信じ'], ctx: true }],
      [...TOWA, { s: ['。', '！', '!', '…'], ctx: true }],
      [...TOWA, { ctx: true, not: true }],
      [{ pos: ['動詞', '助動詞', '形容詞'], ctx: true }, ...TOWA, { s: '、', ctx: true }]
    ]
  ),
  P(
    'teyamanai',
    1,
    '〜てやまない',
    '衷心……；一直……',
    'never cease to …; sincerely …',
    '皆様のご健康を心から願ってやみません。',
    [
      [TE, { b: ['やむ', '止む'], s: ['やま', '止ま'] }, { b: ['ない', 'ぬ'] }],
      [TE, { b: ['やむ', '止む'], s: ['やみ', '止み'] }, { s: 'ませ' }, { s: 'ん' }]
    ]
  ),
  P(
    'wokinjienai',
    1,
    '〜を禁じ得ない',
    '禁不住……',
    'cannot help (feeling) …',
    '彼の身勝手な発言には、怒りを禁じ得ない。',
    [
      [
        { s: 'を' },
        { b: ['禁じる', '禁ずる'] },
        { b: ['得る', 'える', 'うる'] },
        { b: ['ない', 'ぬ'] }
      ],
      [
        { s: 'を' },
        { b: ['禁じる', '禁ずる'] },
        { b: ['得る', 'える', 'うる'] },
        { s: 'ませ' },
        { s: 'ん' }
      ]
    ]
  ),
  P(
    'monowo',
    1,
    '〜ものを',
    '（要是）……就好了，可是',
    'if only … (but)',
    '一言相談してくれれば手伝ったものを。',
    [
      [
        { pos: ['助動詞', '動詞', '形容詞'], ctx: true },
        { s: ['もの', 'もん'] },
        { s: 'を' },
        { s: ['。', '、', '…', '！'], ctx: true }
      ],
      [
        { pos: ['助動詞', '動詞', '形容詞'], ctx: true },
        { s: ['もの', 'もん'] },
        { s: 'を' },
        { ctx: true, not: true }
      ]
    ]
  ),
  P(
    'younimo',
    1,
    '〜（よ）うにも〜ない',
    '想……也不能',
    'cannot … even if one tries',
    '雨がひどくて、出かけようにも出かけられない。',
    [
      [
        { pos: '動詞', ctx: true },
        { s: 'よう', pos: '名詞', p1: '接尾' },
        { s: 'に' },
        { s: 'も' }
      ],
      [{ pos: '助動詞', b: ['う', 'よう'] }, { s: 'に' }, { s: 'も' }]
    ]
  )
]

/** 接续、自带例句的中英翻译、同组、另写的例句 */
const notes: Record<string, GrammarNote> = {
  // ── 让步 ──
  towaie: {
    form: '普通形 / N + とはいえ',
    zh: '虽说是春天了，早晚还是很冷。',
    en: 'It may be spring, but mornings and evenings are still cold.',
    group: 'but',
    more: [
      {
        ja: '仕事とはいえ、毎週末の出張はさすがに疲れるよ。',
        zh: '虽说是工作，每个周末都出差还是会累啊。',
        en: "It's work, I know, but going on business trips every weekend really wears you out."
      },
      {
        ja: '景気は回復しつつあるとはいえ、家計の負担は依然として大きい。',
        zh: '虽说经济正在复苏，家庭开支的负担依然很重。',
        en: 'Although the economy is recovering, the burden on household budgets remains heavy.'
      }
    ]
  },
  toiedomo: {
    form: 'N / 普通形 + といえども',
    zh: '即使是孩子，也必须遵守规则。',
    en: 'Even children have to follow the rules.',
    group: 'but',
    more: [
      {
        ja: 'プロの選手といえども、毎回勝てるわけではない。',
        zh: '即使是职业选手，也不是每次都能赢。',
        en: "Even professional athletes can't win every time."
      },
      {
        ja: '一円といえども、税金を無駄にすることは許されない。',
        zh: '哪怕是一日元，也不允许浪费税金。',
        en: 'Not a single yen of tax money may be wasted.'
      }
    ]
  },
  deare: {
    form: 'N + であれ / であろうと（誰であれ · 何であろうと）',
    zh: '无论是什么理由，不守约定都是不对的。',
    en: 'Whatever the reason, breaking a promise is wrong.',
    group: 'but',
    more: [
      {
        ja: '相手が誰であろうと、言うべきことは言うよ。',
        zh: '不管对方是谁，该说的我都会说。',
        en: "No matter who it is, I'll say what needs to be said."
      },
      {
        ja: '大人であれ子どもであれ、ルールは同じだ。',
        zh: '无论是大人还是孩子，规则都一样。',
        en: 'Adult or child, the rules are the same.'
      }
    ]
  },
  tatokorode: {
    form: 'Vた形 + ところで',
    zh: '即使现在赶紧去，恐怕也来不及了。',
    en: "Even if we hurry now, we probably won't make it.",
    group: 'but',
    more: [
      {
        ja: 'いくら謝ったところで、許してもらえないよ。',
        zh: '再怎么道歉也不会被原谅的。',
        en: "No matter how much you apologize, they won't forgive you."
      },
      {
        ja: '道具だけそろえたところで、上手になるわけではない。',
        zh: '光是把工具备齐，也不会就此变得熟练。',
        en: "Just getting all the right tools won't make you any better."
      }
    ]
  },
  naimademo: {
    form: 'Vない形 + までも（言わないまでも · 取れないまでも）',
    zh: '即使不是每天，至少也最好每周运动一次。',
    en: 'Even if not every day, you should exercise at least once a week.',
    more: [
      {
        ja: '満点は取れないまでも、平均点ぐらいは取りたいな。',
        zh: '即使拿不到满分，至少也想拿个平均分。',
        en: "Even if I can't get full marks, I'd like to at least get an average score."
      },
      {
        ja: '以前ほどではないまでも、客足は戻りつつある。',
        zh: '虽然还不及以前，但客人正在慢慢回来。',
        en: 'Though not yet as many as before, customers are gradually coming back.'
      }
    ]
  },
  naramadashimo: {
    form: 'N / 普通形 + ならまだしも',
    zh: '如果是小孩倒还情有可原，大人竟然说出那种话。',
    en: 'It would be one thing if it were a child, but for an adult to say something like that!',
    more: [
      {
        ja: '一日ならまだしも、一週間も雨が続くと洗濯物が乾かない。',
        zh: '只下一天倒还好，要是连下一个星期的雨，洗的衣服就干不了了。',
        en: "One day of rain would be fine, but when it rains for a whole week, the laundry won't dry."
      },
      {
        ja: '冗談で言うならまだしも、本気なら許せないよ。',
        zh: '如果是开玩笑倒还好，要是当真，我可不能原谅。',
        en: "If you were joking, that'd be one thing, but if you mean it, I can't forgive that."
      }
    ]
  },

  // ── 列举 ──
  nomiarazu: {
    form: 'N / 普通形 + のみならず',
    zh: '这个问题不仅在国内，在海外也备受关注。',
    en: 'This issue is drawing attention not only at home but also abroad.',
    group: 'not-only',
    more: [
      {
        ja: 'この本は子どものみならず、大人が読んでも面白いよ。',
        zh: '这本书不仅孩子，大人读起来也很有意思哦。',
        en: 'This book is fun not only for children but for adults too.'
      },
      {
        ja: '彼は優れた研究者であるのみならず、教育者としても知られている。',
        zh: '他不仅是一位出色的研究者，作为教育家也很有名。',
        en: 'He is not only an outstanding researcher but also well known as an educator.'
      }
    ]
  },
  toii: {
    form: 'N1 + といい、N2 + といい',
    zh: '味道也好，价格也好，这家店都无可挑剔。',
    en: 'In both taste and price, this restaurant is beyond reproach.',
    more: [
      {
        ja: 'デザインといい色といい、私の好みにぴったりだよ。',
        zh: '设计也好，颜色也好，都正合我的心意。',
        en: 'The design and the color are both exactly to my taste.'
      },
      {
        ja: '景色といい、空気といい、ここは本当に気持ちがいい。',
        zh: '风景也好，空气也好，这里真让人心旷神怡。',
        en: 'The scenery, the air — everything about this place feels wonderful.'
      }
    ]
  },
  narinari: {
    form: 'N / V辞書形 + なり、N / V辞書形 + なり',
    zh: '遇到困难的时候，打电话或者发邮件告诉我都行。',
    en: "When you're in trouble, let me know by phone, email or whatever.",
    more: [
      {
        ja: '休みの日は、本を読むなり散歩するなり、好きに過ごせばいい。',
        zh: '休息日看看书或者散散步，想怎么过就怎么过。',
        en: 'On your days off, read a book, take a walk — spend the time however you like.'
      },
      {
        ja: '暑いなら、窓を開けるなり何なりしたらいいよ。',
        zh: '热的话，开个窗户什么的就好了。',
        en: "If you're hot, open a window or something."
      }
    ]
  },

  // ── 强调 ──
  sura: {
    form: 'N + すら / ですら（立つことすら · 夏ですら）',
    zh: '累得连站都站不起来了。',
    en: "I was so tired I couldn't even stand up.",
    group: 'even',
    more: [
      {
        ja: 'そんなこと、考えたことすらなかったよ。',
        zh: '那种事，我连想都没想过。',
        en: "I'd never even thought about that."
      },
      {
        ja: 'この地方では、夏ですら朝晩は涼しい。',
        zh: '在这个地区，连夏天的早晚都很凉快。',
        en: 'In this region, even in summer the mornings and evenings are cool.'
      }
    ]
  },
  tekoso: {
    form: 'Vて形 + こそ',
    zh: '只有自己亲自做过，才能体会到其中的辛苦。',
    en: 'Only by doing it yourself can you understand how hard it is.',
    group: 'after',
    more: [
      {
        ja: 'お互いに助け合ってこそ、本当の友達だよ。',
        zh: '只有互相帮助，才算是真正的朋友啊。',
        en: "It's helping each other that makes you real friends."
      },
      {
        ja: '健康であってこそ、仕事も趣味も楽しめるのだ。',
        zh: '只有身体健康，才能享受工作和爱好。',
        en: 'Only when you are healthy can you enjoy both work and hobbies.'
      }
    ]
  },
  bakoso: {
    form: 'Vば形 + こそ（思えばこそ · 健康であればこそ）',
    zh: '正因为为孩子着想，父母才会严厉地批评他们。',
    en: 'It is precisely because they care about their children that parents scold them strictly.',
    group: 'reason',
    more: [
      {
        ja: '君の将来を考えればこそ、あえて反対しているんだよ。',
        zh: '正因为考虑到你的将来，我才特意反对的。',
        en: "It's precisely because I'm thinking of your future that I'm going against you on this."
      },
      {
        ja: '信頼していればこそ、大事な仕事を任せたのだ。',
        zh: '正因为信任你，才把重要的工作交给你。',
        en: 'It was precisely because I trusted you that I gave you such an important job.'
      }
    ]
  },
  taritomo: {
    form: '一日 / 一人 / 一円 + たりとも + 〜ない',
    zh: '我连一天都没有落下过练习。',
    en: "I've never skipped practice, not even for a single day.",
    group: 'even',
    more: [
      {
        ja: '試験まであと少しだから、一分たりとも無駄にできない。',
        zh: '离考试没多少时间了，连一分钟也不能浪费。',
        en: "The exam is almost here, so I can't waste even a minute."
      },
      {
        ja: 'この書類は、一枚たりともなくさないでね。',
        zh: '这些文件，一张都别弄丢哦。',
        en: "Don't lose even a single page of these documents, okay?"
      }
    ]
  },
  dani: {
    form: 'V辞書形 / N + だに（想像するだに · 夢にだに）',
    zh: '要是赶不上截止日期……光是想想就觉得可怕。',
    en: 'Missing the deadline — it is frightening even to imagine.',
    group: 'even',
    more: [
      {
        ja: '夢にだに思わなかった幸運が舞い込んだ。',
        zh: '连做梦都没想到的好运降临了。',
        en: 'Good fortune I had never even dreamed of came my way.'
      },
      {
        ja: '名前を呼ばれても、彼は微動だにしなかった。',
        zh: '即使被叫到名字，他也纹丝不动。',
        en: "Even when his name was called, he didn't move a muscle."
      }
    ]
  },

  // ── 一……就 ──
  nari: {
    form: 'V辞書形 + なり',
    zh: '他一进房间就打开了窗户。',
    en: 'As soon as he entered the room, he opened the window.',
    group: 'as-soon-as',
    more: [
      {
        ja: '母は私の顔を見るなり、「何かあったの？」と聞いた。',
        zh: '妈妈一看到我的脸，就问：「出什么事了？」',
        en: 'The moment my mother saw my face, she asked, "Did something happen?"'
      },
      {
        ja: '父は帰ってくるなり、黙って自分の部屋に入った。',
        zh: '爸爸一回来，就一声不吭地进了自己的房间。',
        en: 'As soon as my father came home, he went into his room without a word.'
      }
    ]
  },
  yaina: {
    form: 'V辞書形 + や否や / や',
    zh: '铃声一响，学生们就冲出了教室。',
    en: 'The moment the bell rang, the students rushed out of the classroom.',
    group: 'as-soon-as',
    more: [
      {
        ja: '新製品が発売されるや、店の前には長い列ができた。',
        zh: '新产品一上市，店门前就排起了长队。',
        en: 'As soon as the new product went on sale, a long line formed in front of the store.'
      },
      {
        ja: 'その知らせが伝わるや否や、町中が喜びに包まれた。',
        zh: '那个消息一传开，全镇就沉浸在喜悦之中。',
        en: 'No sooner had the news spread than the whole town was filled with joy.'
      }
    ]
  },
  gahayaika: {
    form: 'V辞書形 / Vた形 + が早いか',
    zh: '弟弟一回到家，就开始打游戏。',
    en: 'The moment my little brother got home, he started playing video games.',
    group: 'as-soon-as',
    more: [
      {
        ja: '店のドアが開くが早いか、客たちは売り場へ駆け込んだ。',
        zh: '店门刚一打开，顾客们就冲进了卖场。',
        en: 'No sooner had the store doors opened than the customers rushed onto the sales floor.'
      },
      {
        ja: '彼女は席に着くが早いか、ノートを広げて書き始めた。',
        zh: '她刚一坐下，就摊开笔记本写了起来。',
        en: 'The moment she sat down, she opened her notebook and started writing.'
      }
    ]
  },
  sobakara: {
    form: 'V辞書形 / Vた形 + そばから',
    zh: '单词刚记住就忘了。',
    en: 'I forget words as soon as I learn them.',
    group: 'as-soon-as',
    more: [
      {
        ja: '片付けたそばから、子どもが部屋を散らかしていく。',
        zh: '刚收拾好，孩子就又把房间弄乱了。',
        en: 'No sooner have I tidied up than the kids mess up the room again.'
      },
      {
        ja: '言ったそばから、もう忘れてるじゃない。',
        zh: '刚跟你说完，你就已经忘了！',
        en: "I just told you, and you've already forgotten!"
      }
    ]
  },

  // ── 情形与条件 ──
  toatte: {
    form: '普通形 / N + とあって',
    zh: '因为是连休，旅游景点到处都是人。',
    en: "Since it's a long holiday weekend, tourist spots are packed everywhere.",
    group: 'reason',
    more: [
      {
        ja: '人気歌手が来るとあって、会場には朝から長い列ができた。',
        zh: '因为有人气歌手要来，会场从早上起就排起了长队。',
        en: 'Because a popular singer was coming, a long line formed at the venue from the morning.'
      },
      {
        ja: '初めての海外旅行とあって、娘はずいぶん緊張していたよ。',
        zh: '因为是第一次出国旅行，女儿相当紧张呢。',
        en: 'It being her first trip abroad, my daughter was pretty nervous.'
      }
    ]
  },
  toareba: {
    form: '普通形 / N + とあれば',
    zh: '如果是为了孩子，父母什么辛苦都不怕。',
    en: 'If it is for their children, parents will spare no effort.',
    group: 'if',
    more: [
      {
        ja: '社長の頼みとあれば、断るわけにはいかないね。',
        zh: '如果是社长的请求，那可不能拒绝啊。',
        en: "If it's a request from the president, I can hardly say no."
      },
      {
        ja: '必要とあれば、いつでも駆けつけます。',
        zh: '如果有需要，我随时赶过来。',
        en: "If necessary, I'll come right over at any time."
      }
    ]
  },
  tomonaruto: {
    form: 'N / V辞書形 + ともなると / ともなれば',
    zh: '一到十二月，街上就充满了圣诞节的气氛。',
    en: 'Once December comes, the town takes on a thoroughly Christmassy feel.',
    group: 'if',
    more: [
      {
        ja: '大学生ともなれば、自分のことは自分で決めないとね。',
        zh: '都是大学生了，自己的事得自己决定啊。',
        en: "Once you're a university student, you have to make your own decisions."
      },
      {
        ja: '社長ともなると、休日でも仕事の電話がかかってくる。',
        zh: '一旦当上社长，就连休息日也会有工作电话打来。',
        en: 'When you are the company president, you get work calls even on your days off.'
      }
    ]
  },
  ikan: {
    form: 'N（の）+ いかんで（は）/ いかんによっては / いかんにかかわらず',
    zh: '能不能升学取决于考试成绩。',
    en: 'Whether you can go on to the next school depends on your exam results.',
    group: 'basis',
    more: [
      {
        ja: '理由のいかんにかかわらず、遅刻は認められません。',
        zh: '不管理由如何，迟到都是不允许的。',
        en: 'Lateness will not be accepted, whatever the reason.'
      },
      {
        ja: '明日の天気いかんによっては、試合は中止になるかもしれない。',
        zh: '根据明天的天气情况，比赛也许会取消。',
        en: "Depending on tomorrow's weather, the game may be called off."
      }
    ]
  },
  taraasaigo: {
    form: 'Vた形 + ら最後 / Vた形 + が最後（座ったら最後 · 迷い込んだが最後）',
    zh: '爸爸一旦在沙发上坐下，就怎么也不肯起来了。',
    en: "Once my father sits down on the sofa, he just won't get up.",
    group: 'if',
    more: [
      {
        ja: 'あの店のケーキは、一度食べたら最後、やめられないよ。',
        zh: '那家店的蛋糕，一旦吃过一次就停不下来了。',
        en: "Once you've tried that shop's cakes, you can't stop."
      },
      {
        ja: 'この森は、迷い込んだが最後、出られないと言われている。',
        zh: '据说这片森林一旦误入，就再也出不来了。',
        en: 'They say that once you stray into this forest, you can never get out.'
      }
    ]
  },

  // ── 起点、界限与时机 ──
  womotte: {
    form: 'N + をもって（をもちまして）',
    zh: '以上，今天的会议到此结束。',
    en: "With that, we'll bring today's meeting to a close.",
    group: 'cutoff',
    more: [
      {
        ja: '結果は後日、書面をもってお知らせします。',
        zh: '结果将于日后以书面形式通知您。',
        en: 'We will inform you of the results in writing at a later date.'
      },
      {
        ja: '彼女は持ち前の粘り強さをもって、難しい交渉をまとめ上げた。',
        zh: '她凭借天生的韧劲，谈成了一场艰难的谈判。',
        en: 'With her natural tenacity, she brought a difficult negotiation to a successful close.'
      }
    ]
  },
  tekaratoiumono: {
    form: 'Vて形 + からというもの',
    zh: '自从开始养狗以后，我每天早上都去散步了。',
    en: "Ever since I started keeping a dog, I've been going for a walk every morning.",
    group: 'after',
    more: [
      {
        ja: '田中さんは結婚してからというもの、すっかり料理が上手になった。',
        zh: '田中自从结婚以后，厨艺变得非常好了。',
        en: 'Ever since Tanaka got married, he has become a really good cook.'
      },
      {
        ja: '新しい駅ができてからというもの、この辺りは急に人が増えた。',
        zh: '自从新车站建成以后，这一带的人一下子多了起来。',
        en: 'Ever since the new station opened, the number of people around here has shot up.'
      }
    ]
  },
  wokagirini: {
    form: 'N + を限りに（今日を限りに · 本日を限りに）',
    zh: '本店营业到今天为止。',
    en: 'As of today, this store will be closing its doors.',
    group: 'cutoff',
    more: [
      {
        ja: '今日を限りに、お酒はきっぱりやめるよ。',
        zh: '就到今天为止，我要彻底戒酒。',
        en: "After today, I'm giving up drinking for good."
      },
      {
        ja: '彼女は今シーズンを限りに、現役を引退すると発表した。',
        zh: '她宣布将在本赛季结束后退役。',
        en: 'She announced that she will retire at the end of this season.'
      }
    ]
  },
  wokawakirini: {
    form: 'N + を皮切りに',
    zh: '以这番发言为开端，反对意见接二连三地被提了出来。',
    en: 'Starting with this remark, one objection after another was raised.',
    group: 'start',
    more: [
      {
        ja: '地元での公演を皮切りに、全国ツアーが始まる。',
        zh: '以在家乡的演出为开端，全国巡演即将开始。',
        en: 'The nationwide tour will kick off with a show in their hometown.'
      },
      {
        ja: 'この一号店を皮切りに、全国に店を広げていきたいんです。',
        zh: '我想以这家一号店为起点，把店开到全国去。',
        en: 'Starting with this first shop, I want to expand across the country.'
      }
    ]
  },
  niitatte: {
    form: 'N / V辞書形 + に至って（は）· N + に至るまで',
    zh: '直到发生了事故，公司才终于重新审视了安全措施。',
    en: 'It was only when an accident occurred that the company finally reviewed its safety measures.',
    group: 'reach',
    more: [
      {
        ja: '小さな子どもから高齢者に至るまで、この歌を知らない人はいない。',
        zh: '从小孩到老人，没有人不知道这首歌。',
        en: "From small children to the elderly, there's no one who doesn't know this song."
      },
      {
        ja: 'みんな遅刻ばかりで、山田さんに至っては一度も来ていないよ。',
        zh: '大家总是迟到，至于山田，他一次都没来过。',
        en: "Everyone keeps coming late, and as for Yamada, he hasn't come even once."
      }
    ]
  },
  nishite: {
    form: 'N + にして（四十歳にして · 三度目にして · 一瞬にして）',
    zh: '他到了四十岁才第一次出国。',
    en: 'He went abroad for the first time at the age of forty.',
    group: 'reach',
    more: [
      {
        ja: '長年の努力が一瞬にして消えてしまった。',
        zh: '多年的努力一瞬间就化为乌有了。',
        en: 'Years of hard work vanished in an instant.'
      },
      {
        ja: '三度目にしてようやく合格できたよ。',
        zh: '考到第三次才终于通过了。',
        en: 'I finally passed on my third try.'
      }
    ]
  },

  // ── 对照、搁置与「别说」 ──
  waoroka: {
    form: 'N + はおろか',
    zh: '忙得别说旅行了，就连休息日都几乎没有。',
    en: "I'm so busy I hardly get a day off, let alone a trip.",
    group: 'not-only',
    more: [
      {
        ja: 'ピアノはおろか、楽譜も読めないよ。',
        zh: '别说弹钢琴了，我连乐谱都看不懂。',
        en: "I can't even read music, let alone play the piano."
      },
      {
        ja: 'その村には、コンビニはおろか、信号さえない。',
        zh: '那个村子别说便利店了，就连红绿灯都没有。',
        en: "That village doesn't even have a traffic light, let alone a convenience store."
      }
    ]
  },
  mosarukotonagara: {
    form: 'N + もさることながら',
    zh: '这部电影的剧情自不用说，音乐更是精彩。',
    en: 'The story of this film is good, but the music is even better.',
    group: 'not-only',
    more: [
      {
        ja: '味もさることながら、店員さんの対応が気持ちいいんだよね。',
        zh: '味道自不用说，店员的服务也让人很舒服。',
        en: "The food is good, of course, but it's the staff's service that makes it so pleasant."
      },
      {
        ja: '本人の努力もさることながら、家族の支えも大きかった。',
        zh: '本人的努力自不用说，家人的支持也起了很大作用。',
        en: 'Their own efforts aside, the support of their family also counted for a lot.'
      }
    ]
  },
  wasateoki: {
    form: 'N + はさておき',
    zh: '玩笑先放一边，我们差不多该进入正题了。',
    en: "Joking aside, let's get down to business.",
    group: 'regardless',
    more: [
      {
        ja: '値段はさておき、まずは実物を見てみたいな。',
        zh: '价格暂且不谈，我想先看看实物。',
        en: "Price aside, I'd like to see the real thing first."
      },
      {
        ja: '結果はさておき、最後まで全力を尽くしたことに意味がある。',
        zh: '结果暂且不论，全力以赴坚持到最后才有意义。',
        en: 'Whatever the result, what matters is giving it everything to the very end.'
      }
    ]
  },
  nihikikae: {
    form: 'N + にひきかえ · 普通形（なAな）+ のにひきかえ',
    zh: '与活泼的哥哥相反，弟弟很文静。',
    en: 'In contrast to his lively older brother, the younger one is quiet.',
    group: 'but',
    more: [
      {
        ja: '去年の夏が猛暑だったのにひきかえ、今年はずいぶん涼しい。',
        zh: '与去年夏天的酷热相反，今年凉快多了。',
        en: "Unlike last summer's scorching heat, this year is much cooler."
      },
      {
        ja: '前の部屋にひきかえ、今度の部屋は日当たりがいいね。',
        zh: '跟以前的房间不同，这次的房间采光很好啊。',
        en: 'Compared with the old room, this new one gets plenty of sun.'
      }
    ]
  },

  // ── 极端的程度 ──
  kagirida: {
    form: 'いA / なAな + 限りだ（うれしい限りだ · 残念な限りだ）',
    zh: '一个人住在国外，真是太让人心里没底了。',
    en: 'Living abroad on my own makes me feel terribly uneasy.',
    group: 'extreme',
    more: [
      {
        ja: '久しぶりにみんなに会えて、うれしい限りです。',
        zh: '好久不见，能见到大家真是太高兴了。',
        en: "It's such a joy to see everyone again after so long."
      },
      {
        ja: '若い世代の活躍は、頼もしい限りである。',
        zh: '年轻一代的活跃表现，实在令人放心。',
        en: 'The achievements of the younger generation are truly reassuring.'
      }
    ]
  },
  kiwamari: {
    form: 'なA + 極まりない / 極まる（失礼極まりない · 危険極まる）',
    zh: '半夜大声吵闹，实在是太扰民了。',
    en: 'Making a racket in the middle of the night is incredibly inconsiderate.',
    group: 'extreme',
    more: [
      {
        ja: 'あの人の態度、失礼極まりないよね。',
        zh: '那个人的态度，真是无礼至极啊。',
        en: "That person's attitude is incredibly rude, isn't it?"
      },
      {
        ja: '雪道を夏用タイヤで走るのは、危険極まる行為だ。',
        zh: '用夏季轮胎在雪路上行驶，是极其危险的行为。',
        en: 'Driving on snowy roads with summer tires is extremely dangerous.'
      }
    ]
  },
  nokiwami: {
    form: 'N + の極み',
    zh: '在高级酒店的顶楼用餐，真是奢侈之极。',
    en: 'Dining on the top floor of a luxury hotel is the height of extravagance.',
    group: 'extreme',
    more: [
      {
        ja: '三日も徹夜して、もう疲労の極みだよ。',
        zh: '连熬了三个通宵，已经累到极点了。',
        en: "I've stayed up three nights in a row — I'm completely exhausted."
      },
      {
        ja: '最後の最後で逆転されるなんて、痛恨の極みだ。',
        zh: '在最后关头被逆转，真是遗憾之极。',
        en: 'Being overtaken at the very last moment is bitterly disappointing.'
      }
    ]
  },
  noitari: {
    form: 'N + の至り（光栄の至り · 若気の至り）',
    zh: '能获得这样的奖项，真是荣幸之至。',
    en: 'I am truly honored to receive such an award.',
    group: 'extreme',
    more: [
      {
        ja: '若気の至りで、昔はずいぶん無茶をしたものだ。',
        zh: '年少轻狂，以前做过不少鲁莽的事。',
        en: 'In the folly of youth, I did a lot of reckless things.'
      },
      {
        ja: '皆様にご心配をおかけし、恐縮の至りでございます。',
        zh: '让各位担心了，实在是惶恐之至。',
        en: 'I am deeply sorry to have caused you all such concern.'
      }
    ]
  },

  // ── 感慨、遗憾与无奈 ──
  towa: {
    form: '普通形 / N + とは（会うとは思わなかった · 優勝するとは）',
    zh: '真没想到会在这种地方碰到老朋友。',
    en: 'I never expected to run into an old friend in a place like this.',
    group: 'surprise',
    more: [
      {
        ja: 'まさか彼が優勝するとは。',
        zh: '没想到他竟然夺冠了。',
        en: 'Who would have thought he would win!'
      },
      {
        ja: '一年でこれほど上達するとは、大したものだ。',
        zh: '一年就进步这么多，真了不起。',
        en: "To improve this much in a year — that's impressive."
      }
    ]
  },
  teyamanai: {
    form: 'Vて形 + やまない（願ってやまない · 愛してやまない）',
    zh: '衷心祝愿各位身体健康。',
    en: 'I sincerely wish you all good health.',
    group: 'feeling',
    more: [
      {
        ja: '彼は生涯、故郷の海を愛してやまなかった。',
        zh: '他一生都深爱着故乡的大海。',
        en: 'All his life, he never stopped loving the sea of his hometown.'
      },
      {
        ja: 'この絵には、見る人を引きつけてやまない魅力がある。',
        zh: '这幅画有一种始终吸引着观者的魅力。',
        en: 'This painting has a charm that never fails to captivate those who see it.'
      }
    ]
  },
  wokinjienai: {
    form: 'N + を禁じ得ない（怒りを禁じ得ない · 涙を禁じ得ない）',
    zh: '对他那自私的发言，我禁不住感到愤怒。',
    en: 'I cannot help feeling angry at his selfish remarks.',
    group: 'feeling',
    more: [
      {
        ja: '突然の知らせに、涙を禁じ得なかった。',
        zh: '听到这突如其来的消息，我禁不住流下了眼泪。',
        en: "At the sudden news, I couldn't hold back my tears."
      },
      {
        ja: 'あの対応には、正直、疑問を禁じ得ませんね。',
        zh: '对那样的处理，说实话我不禁有些疑问。',
        en: "Frankly, I can't help having doubts about how that was handled."
      }
    ]
  },
  monowo: {
    form: '普通形（なAな）+ ものを（手伝ったものを · すむものを）',
    zh: '要是跟我商量一声，我就帮你了。',
    en: "If only you'd asked me, I would have helped.",
    group: 'but',
    more: [
      {
        ja: '素直に謝ればすむものを、彼はいつまでも意地を張っている。',
        zh: '老老实实道个歉就没事了，可他却一直在赌气。',
        en: 'A simple apology would settle it, yet he keeps on being stubborn.'
      },
      {
        ja: 'あと五分早く家を出ていれば間に合ったものを。',
        zh: '要是早五分钟出门就赶上了。',
        en: "If only I'd left home five minutes earlier, I would have made it."
      }
    ]
  },
  younimo: {
    form: 'Vよう形 + にも + 〜ない（行こうにも行けない · 連絡しようにもできない）',
    zh: '雨太大了，想出门也出不去。',
    en: "It's raining so hard that I can't go out even if I want to.",
    group: 'cannot',
    more: [
      {
        ja: '連絡しようにも、電話番号が分からないんだ。',
        zh: '想联系也没办法，我不知道电话号码啊。',
        en: "I'd like to get in touch, but I don't know the phone number."
      },
      {
        ja: '言い返そうにも、言葉が出てこなかった。',
        zh: '想反驳却一句话也说不出来。',
        en: 'I wanted to answer back, but the words just would not come.'
      }
    ]
  }
}

const lessons: LessonSpec[] = [
  {
    id: 'n1-4',
    title: { zh: '让步：虽说、即使、无论', en: 'Concessions: although, even if, whatever' },
    items: ['towaie', 'toiedomo', 'deare', 'tatokorode', 'naimademo', 'naramadashimo']
  },
  {
    id: 'n1-5',
    title: { zh: '列举与「不仅」', en: 'Lists and “not only”' },
    items: ['nomiarazu', 'toii', 'narinari']
  },
  {
    id: 'n1-11',
    title: { zh: '强调：连……都、只有……才', en: 'Emphasis: even, only if' },
    items: ['sura', 'tekoso', 'bakoso', 'taritomo', 'dani']
  },
  {
    id: 'n1-1',
    title: { zh: '「一……就」', en: '“As soon as”' },
    items: ['nari', 'yaina', 'gahayaika', 'sobakara']
  },
  {
    id: 'n1-3',
    title: { zh: '情形与条件', en: 'Circumstances and conditions' },
    items: ['toatte', 'toareba', 'tomonaruto', 'ikan', 'taraasaigo']
  },
  {
    id: 'n1-2',
    title: { zh: '起点、界限与时机', en: 'Starting points, limits and turning points' },
    items: ['womotte', 'tekaratoiumono', 'wokagirini', 'wokawakirini', 'niitatte', 'nishite']
  },
  {
    id: 'n1-6',
    title: { zh: '对照、搁置与「别说」', en: 'Contrasts, setting aside and “let alone”' },
    items: ['waoroka', 'mosarukotonagara', 'wasateoki', 'nihikikae']
  },
  {
    id: 'n1-12',
    title: { zh: '极端的程度', en: 'Extreme degrees' },
    items: ['kagirida', 'kiwamari', 'nokiwami', 'noitari']
  },
  {
    id: 'n1-21',
    title: { zh: '感慨、遗憾与无奈', en: 'Strong feelings, regret and helplessness' },
    items: ['towa', 'teyamanai', 'wokinjienai', 'monowo', 'younimo']
  }
]

export const N1_GRAMMAR: LevelGrammar = { points, notes, lessons }
