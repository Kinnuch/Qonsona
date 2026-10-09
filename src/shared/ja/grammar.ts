/**
 * 日语语法点：在分词结果（kuromoji 词素）上按顺序匹配，阅读器据此列出「本文语法」。
 *
 * 每一条写成一串词素条件（写法 s、原形 b、词性 pos / p1 / p2、活用型 ct、活用形 cf），
 * 几种写法都算的给几串（alts）。说明是自己写的；等级参照常见的 JLPT 语法分级（N5 最基础）。
 * 这里是 N5、N4，N3、N2、N1 各在 grammar-n3.ts、grammar-n2.ts、grammar-n1.ts（写法见 grammar-def.ts）。
 * 例句都有测试：每一条都得在自己的例句里认得出来（tests/ja-grammar.test.ts）。
 */
import type { GrammarHit, JaToken } from './reader'
import { II, P, TE, type GrammarPoint, type TokenSpec } from './grammar-def'
import { N3, N2, N1 } from './grammar-levels'

export type { GrammarPoint, TokenSpec } from './grammar-def'

// 〜ほど〜ない 用的几个词素条件
const HODO_PRE: TokenSpec = { ctx: true, not: true, p1: ['数', '接尾'] }
const HODO: TokenSpec = { s: 'ほど', p1: '副助詞' }
const HODO_ADJ: TokenSpec = { pos: '形容詞', cf: '連用テ接続' }
const HODO_NA: TokenSpec = { pos: '名詞', p1: '形容動詞語幹' }
const HODO_NAI: TokenSpec = { pos: '助動詞', b: 'ない' }
const HODO_TA: TokenSpec = { pos: '助動詞', b: 'た' }

/** N5、N4 的语法点（N3 起的在各级自己的文件里） */
const BASIC: GrammarPoint[] = [
  // ── N5 ──
  P(
    'masu',
    5,
    '〜ます',
    '礼貌体（敬体）的动词结尾',
    'polite verb ending',
    '毎朝コーヒーを飲みます。',
    [[{ pos: '助動詞', b: 'ます' }]],
    true
  ),
  P('masen', 5, '〜ません', '礼貌体的否定：不……', 'polite negative', '肉は食べません。', [
    [{ b: 'ます', s: 'ませ' }, { s: 'ん' }]
  ]),
  P('mashita', 5, '〜ました', '礼貌体的过去：……了', 'polite past', '昨日映画を見ました。', [
    [
      { b: 'ます', s: 'まし' },
      { pos: '助動詞', ct: '特殊・タ' }
    ]
  ]),
  P('mashou', 5, '〜ましょう', '提议：一起……吧', "let's", '一緒に帰りましょう。', [
    [{ s: 'ましょ' }, { s: 'う' }]
  ]),
  P('mashouka', 5, '〜ましょうか', '主动提出：我来……吧？', 'shall I … ?', '窓を開けましょうか。', [
    [{ s: 'ましょ' }, { s: 'う' }, { s: 'か', pos: '助詞' }]
  ]),
  P(
    'masenka',
    5,
    '〜ませんか',
    '邀请：要不要一起……？',
    "won't you … ?",
    '週末、映画を見に行きませんか。',
    [[{ s: 'ませ' }, { s: 'ん' }, { s: 'か', pos: '助詞' }]]
  ),
  P(
    'desu',
    5,
    '〜です',
    '礼貌体的判断：是……',
    'polite copula',
    '私は学生です。',
    [[{ pos: '助動詞', b: 'です' }]],
    true
  ),
  P(
    'deshita',
    5,
    '〜でした',
    '礼貌体的过去：（那时）是……',
    'polite past copula',
    '昨日は雨でした。',
    [
      [
        { b: 'です', s: 'でし' },
        { pos: '助動詞', ct: '特殊・タ' }
      ]
    ]
  ),
  P(
    'nai',
    5,
    '〜ない',
    '简体的否定：不……',
    'plain negative',
    '今日は学校に行かない。',
    [[{ pos: '助動詞', b: 'ない' }]],
    true
  ),
  P(
    'ta',
    5,
    '〜た',
    '简体的过去、完成：……了',
    'plain past',
    '昨日、本を読んだ。',
    [[{ pos: '助動詞', ct: '特殊・タ', cf: '基本形' }]],
    true
  ),
  P(
    'te',
    5,
    '〜て',
    'て形：连接前后的动作、状态',
    'te-form (and, then)',
    '朝起きて、顔を洗います。',
    [[TE]],
    true
  ),
  P(
    'teiru',
    5,
    '〜ている',
    '正在……；（结果）……着',
    'ongoing action or resulting state',
    '今、雨が降っています。',
    [[TE, { pos: '動詞', p1: '非自立', b: 'いる' }], [{ pos: '動詞', b: 'てる' }]]
  ),
  P('tekudasai', 5, '〜てください', '请（做）……', 'please do …', 'ここに名前を書いてください。', [
    [TE, { s: 'ください' }]
  ]),
  P(
    'tekara',
    5,
    '〜てから',
    '……之后（再）……',
    'after doing …',
    '手を洗ってから、ご飯を食べます。',
    [[TE, { s: 'から', pos: '助詞' }]]
  ),
  P(
    'temoii',
    5,
    '〜てもいい',
    '可以……',
    'may, it is all right to …',
    '写真を撮ってもいいですか。',
    [[TE, { s: 'も', pos: '助詞' }, II]]
  ),
  P(
    'tewaikenai',
    5,
    '〜てはいけない',
    '不许……；不可以……',
    'must not …',
    'ここでたばこを吸ってはいけません。',
    [[TE, { s: 'は', pos: '助詞' }, { b: 'いける' }]]
  ),
  P(
    'naidekudasai',
    5,
    '〜ないでください',
    '请不要……',
    "please don't …",
    'ここで写真を撮らないでください。',
    [[{ pos: '助動詞', b: 'ない' }, { s: 'で' }, { s: 'ください' }]]
  ),
  P('tai', 5, '〜たい', '想……', 'want to …', '日本へ行きたいです。', [
    [{ pos: '助動詞', b: 'たい' }]
  ]),
  P(
    'hoshii',
    5,
    '〜がほしい',
    '想要（东西）……',
    'want (something)',
    '新しいパソコンがほしいです。',
    [
      [
        { s: 'が', pos: '助詞' },
        { b: ['ほしい', '欲しい'], pos: '形容詞' }
      ]
    ]
  ),
  P(
    'takotogaaru',
    5,
    '〜たことがある',
    '曾经……过',
    'have done … before',
    '富士山に登ったことがあります。',
    [[{ pos: '助動詞', ct: '特殊・タ' }, { s: 'こと' }, { s: 'が' }, { b: 'ある' }]]
  ),
  P(
    'tari',
    5,
    '〜たり〜たりする',
    '又……又……（举几个例子）',
    'doing things like … and …',
    '休みの日は本を読んだり、映画を見たりします。',
    [[{ s: ['たり', 'だり'], pos: '助詞' }]]
  ),
  P('kara', 5, '〜から（原因）', '因为……', 'because', '雨が降っているから、出かけません。', [
    [{ pos: '助詞', p1: '接続助詞', b: 'から' }]
  ]),
  P('ga', 5, '〜が（转折）', '……，但是……', 'but', 'この店は安いですが、おいしくないです。', [
    [{ pos: '助詞', p1: '接続助詞', b: 'が' }]
  ]),
  P('keredo', 5, '〜けど／〜けれど', '……，不过……', 'but, though', '行きたいけど、時間がない。', [
    [{ pos: '助詞', p1: '接続助詞', b: ['けど', 'けれど', 'けれども'] }]
  ]),
  P('maeni', 5, '〜前に', '在……之前', 'before doing …', '寝る前に歯を磨きます。', [
    [{ pos: '動詞', cf: '基本形' }, { s: ['前', 'まえ'] }, { s: 'に' }]
  ]),
  P('atode', 5, '〜た後で', '……之后', 'after doing …', '宿題をした後で、テレビを見ます。', [
    [{ pos: '助動詞', ct: '特殊・タ' }, { s: ['後', 'あと'] }, { s: 'で' }]
  ]),
  P('nagara', 5, '〜ながら', '一边……一边……', 'while doing …', '音楽を聞きながら勉強します。', [
    // 前面得是自立的动词：知っていながら（いる）、残念ながら 这类是「虽然」（N2 的〜ながらも）
    [
      { ctx: true, pos: '動詞', p1: '自立' },
      { pos: '助詞', p1: '接続助詞', b: 'ながら' }
    ]
  ]),
  P(
    'niiku',
    5,
    '〜に行く／〜に来る',
    '去（来）做……',
    'go / come to do …',
    '図書館へ本を借りに行きます。',
    [
      [
        { pos: '動詞', cf: '連用形' },
        { s: 'に', pos: '助詞' },
        { pos: '動詞', b: ['行く', '来る', 'いく', 'くる'] }
      ]
    ]
  ),
  P('deshou', 5, '〜でしょう', '大概……吧', 'probably', '明日は晴れるでしょう。', [
    [{ s: 'でしょ' }, { s: 'う' }]
  ]),
  P('tsumori', 5, '〜つもり', '打算……', 'intend to …', '来年、日本に留学するつもりです。', [
    [{ b: 'つもり' }]
  ]),
  P(
    'nohougaa',
    5,
    '〜のほうが',
    '（比较）……更……',
    '(A) is more … (than B)',
    'バスより電車のほうが速いです。',
    [[{ s: 'の' }, { s: ['ほう', '方'] }, { s: 'が' }]]
  ),
  P('yori', 5, '〜より', '比……', 'than', '今日は昨日より寒いです。', [
    [{ pos: '助詞', b: 'より' }]
  ]),
  P('dake', 5, '〜だけ', '只……', 'only', '一つだけください。', [[{ pos: '助詞', b: 'だけ' }]]),

  // ── N4 ──
  P(
    'nakereba',
    4,
    '〜なければならない',
    '必须……',
    'must …',
    '明日までにレポートを出さなければなりません。',
    [
      [{ s: 'なけれ' }, { s: 'ば' }, { b: 'なる' }],
      [{ s: 'なく' }, { s: 'て' }, { s: 'は' }, { b: 'いける' }]
    ]
  ),
  P(
    'nakutemoii',
    4,
    '〜なくてもいい',
    '不……也可以；不必……',
    "don't have to …",
    '明日は来なくてもいいです。',
    [[{ s: 'なく' }, { s: 'て' }, { s: 'も' }, II]]
  ),
  P('hougaii', 4, '〜ほうがいい', '最好……', 'had better …', '早く寝たほうがいいですよ。', [
    [{ s: ['ほう', '方'] }, { s: 'が' }, II]
  ]),
  P('toomou', 4, '〜と思う', '我想……；我认为……', 'I think …', '彼は来ると思います。', [
    [{ s: 'と', pos: '助詞' }, { b: ['思う', 'おもう'] }]
  ]),
  P(
    'youtoomou',
    4,
    '〜（よ）うと思う',
    '打算（去）……',
    'I am thinking of doing …',
    '夏休みに国へ帰ろうと思います。',
    [[{ pos: '助動詞', b: ['う', 'よう'] }, { s: 'と', pos: '助詞' }, { b: ['思う', 'おもう'] }]]
  ),
  P(
    'toiu',
    4,
    '〜と言う／〜という',
    '说……；叫做……的',
    'say …; called …',
    'これは「さくら」という花です。',
    [[{ s: 'と', pos: '助詞' }, { b: ['言う', 'いう'] }], [{ s: ['という', 'といった'] }]]
  ),
  P('kamoshirenai', 4, '〜かもしれない', '也许……', 'might …', '午後は雨が降るかもしれません。', [
    [{ s: 'かも' }, { s: 'しれ' }],
    [{ s: 'か' }, { s: 'も' }, { s: 'しれ' }]
  ]),
  P('darou', 4, '〜だろう', '大概……吧（简体）', 'probably (plain)', '彼はもう家に着いただろう。', [
    [{ s: 'だろ' }, { s: 'う' }]
  ]),
  P('soulook', 4, '〜そうだ（样子）', '看起来……', 'looks …', 'このケーキはおいしそうです。', [
    [{ pos: '名詞', p1: '接尾', p2: '助動詞語幹', b: 'そう' }]
  ]),
  P(
    'souhear',
    4,
    '〜そうだ（传闻）',
    '听说……',
    'I hear that …',
    '天気予報によると、明日は雨が降るそうです。',
    [[{ pos: '名詞', p1: '特殊', p2: '助動詞語幹', b: 'そう' }]]
  ),
  P('youda', 4, '〜ようだ', '好像……', 'it seems …', '誰か来たようです。', [
    [{ b: 'よう', p2: '助動詞語幹' }, { b: ['だ', 'です'] }]
  ]),
  P('mitai', 4, '〜みたい', '好像……（口语）', 'seems like … (casual)', 'あの人は先生みたいです。', [
    [{ b: 'みたい' }]
  ]),
  P('rashii', 4, '〜らしい', '好像……；听说……', 'apparently', '田中さんは会社を辞めるらしい。', [
    [{ pos: '助動詞', b: 'らしい' }]
  ]),
  P(
    'ndesu',
    4,
    '〜んです／〜のです',
    '（说明情况、原因）是……的',
    'explanatory: it is that …',
    '頭が痛いんです。',
    [[{ s: ['ん', 'の'], pos: '名詞', p1: '非自立' }, { b: ['だ', 'です'] }]]
  ),
  P('ba', 4, '〜ば', '如果……（就）……', 'if', '安ければ買います。', [
    [{ pos: '助詞', p1: '接続助詞', b: 'ば' }]
  ]),
  P('tara', 4, '〜たら', '如果……；……之后', 'if; when', '駅に着いたら電話してください。', [
    [{ pos: '助動詞', ct: '特殊・タ', cf: '仮定形' }]
  ]),
  P(
    'nara',
    4,
    '〜なら',
    '要是……的话',
    'if (it is about) …',
    '日本語を勉強するなら、この本がいいですよ。',
    [[{ s: 'なら', b: 'だ' }]]
  ),
  P('to', 4, '〜と（条件）', '一……就……', 'when, whenever', '春になると、桜が咲きます。', [
    [{ pos: '助詞', p1: '接続助詞', s: 'と' }]
  ]),
  P('temo', 4, '〜ても', '即使……也……', 'even if', '雨が降っても、試合をします。', [
    [TE, { s: 'も', pos: '助詞' }]
  ]),
  P('noni', 4, '〜のに', '明明……却……', 'although', '薬を飲んだのに、まだ熱があります。', [
    [{ pos: '助詞', p1: '接続助詞', b: 'のに' }]
  ]),
  P(
    'node',
    4,
    '〜ので',
    '因为……（语气较客观）',
    'because (softer)',
    '頭が痛いので、今日は休みます。',
    [[{ pos: '助詞', p1: '接続助詞', b: 'ので' }]]
  ),
  P(
    'shi',
    4,
    '〜し',
    '又……又……（列举理由）',
    'and what is more',
    'この部屋は広いし、駅にも近いです。',
    [[{ pos: '助詞', p1: '接続助詞', s: 'し' }]]
  ),
  P(
    'tameni',
    4,
    '〜ために',
    '为了……；因为……',
    'in order to; because of',
    '大学に入るために、毎日勉強しています。',
    [[{ s: ['ため', '為'] }, { s: 'に' }]]
  ),
  P('youni', 4, '〜ように', '为了能……；以便……', 'so that', '忘れないように、メモを書きます。', [
    [{ b: 'よう', p2: '助動詞語幹' }, { s: 'に' }]
  ]),
  P(
    'younisuru',
    4,
    '〜ようにする',
    '尽量……；设法做到……',
    'make sure to …',
    '毎日野菜を食べるようにしています。',
    [[{ b: 'よう', p2: '助動詞語幹' }, { s: 'に' }, { b: 'する' }]]
  ),
  P(
    'youninaru',
    4,
    '〜ようになる',
    '变得（能）……',
    'come to (be able to) …',
    '日本語が話せるようになりました。',
    [[{ b: 'よう', p2: '助動詞語幹' }, { s: 'に' }, { b: 'なる' }]]
  ),
  P('kotogadekiru', 4, '〜ことができる', '能够……', 'can …', '私はピアノを弾くことができます。', [
    [{ s: 'こと' }, { s: 'が' }, { b: 'できる' }]
  ]),
  P('kotonisuru', 4, '〜ことにする', '决定……', 'decide to …', '来月から毎朝走ることにしました。', [
    [{ s: 'こと' }, { s: 'に' }, { b: 'する' }]
  ]),
  P(
    'kotoninaru',
    4,
    '〜ことになる',
    '（结果）定下来要……',
    'it has been decided that …',
    '来月、大阪に転勤することになりました。',
    [[{ s: 'こと' }, { s: 'に' }, { b: 'なる' }]]
  ),
  P(
    'passive',
    4,
    '〜れる／〜られる',
    '被……（被动）；能……（可能）',
    'passive; potential',
    '先生にほめられました。',
    [[{ pos: '動詞', p1: '接尾', b: ['れる', 'られる'] }]]
  ),
  P(
    'causative',
    4,
    '〜せる／〜させる',
    '让……；使……',
    'make / let someone do …',
    '母は弟に野菜を食べさせました。',
    [[{ pos: '動詞', p1: '接尾', b: ['せる', 'させる'] }]]
  ),
  P(
    'teshimau',
    4,
    '〜てしまう',
    '……完了；（不小心）……了',
    'finish; end up doing …',
    '電車の中に傘を忘れてしまいました。',
    [[TE, { b: 'しまう' }], [{ b: ['ちゃう', 'じゃう'] }]]
  ),
  P(
    'teoku',
    4,
    '〜ておく',
    '事先（做好）……',
    'do … in advance',
    '旅行の前にホテルを予約しておきます。',
    [[TE, { pos: '動詞', b: 'おく' }], [{ pos: '動詞', b: 'とく' }]]
  ),
  P('temiru', 4, '〜てみる', '试着……', 'try doing …', 'この服を着てみてもいいですか。', [
    [TE, { pos: '動詞', p1: '非自立', b: 'みる' }]
  ]),
  P(
    'tearu',
    4,
    '〜てある',
    '（有人）……好了，放着',
    'has been done (and left so)',
    '壁に絵がかけてあります。',
    [[TE, { pos: '動詞', p1: '非自立', b: 'ある' }]]
  ),
  P(
    'teikukuru',
    4,
    '〜ていく／〜てくる',
    '……下去／……起来',
    'go on doing; come to …',
    '寒くなってきました。',
    [[TE, { pos: '動詞', p1: '非自立', b: ['いく', 'くる', '行く', '来る'] }]]
  ),
  P(
    'juju',
    4,
    '〜てあげる／〜てくれる／〜てもらう',
    '为别人做……／别人为我做……',
    'doing something for someone',
    '友達が駅まで送ってくれました。',
    [[TE, { pos: '動詞', p1: '非自立', b: ['あげる', 'くれる', 'もらう', 'やる', 'いただく'] }]]
  ),
  P(
    'tehoshii',
    4,
    '〜てほしい',
    '希望（别人）……',
    'want someone to …',
    'もう少しゆっくり話してほしいです。',
    [[TE, { b: ['ほしい', '欲しい'] }]]
  ),
  P(
    'hodonai',
    4,
    '〜ほど〜ない',
    '没有……那么……；不如……',
    'not as … as',
    '今年の夏は去年ほど暑くない。',
    // 那一段从ほど到否定（ほど暑くない），包住 N3 表程度的〜ほど；数量后面的ほど（三日ほど）是「大约」
    [
      [HODO_PRE, HODO, HODO_ADJ, HODO_NAI, HODO_TA],
      [HODO_PRE, HODO, HODO_ADJ, HODO_NAI],
      [HODO_PRE, HODO, HODO_ADJ, { b: 'ある' }, { s: 'ませ' }, { s: 'ん' }],
      [
        HODO_PRE,
        HODO,
        HODO_NA,
        { s: 'で' },
        { s: 'は' },
        { b: 'ある' },
        { s: 'ませ' },
        { s: 'ん' }
      ],
      [HODO_PRE, HODO, HODO_NA, { s: 'で' }, { s: 'は' }, HODO_NAI],
      [HODO_PRE, HODO, HODO_NA, { s: 'じゃ' }, HODO_NAI],
      [HODO_PRE, HODO, { pos: '動詞' }, HODO_NAI, HODO_TA],
      [HODO_PRE, HODO, { pos: '動詞' }, HODO_NAI]
    ]
  ),
  P('sugiru', 4, '〜すぎる', '太……；过于……', 'too much, overly', '昨日は食べすぎました。', [
    [{ pos: '動詞', b: ['すぎる', '過ぎる'], p1: '非自立' }]
  ]),
  P(
    'yasui',
    4,
    '〜やすい／〜にくい',
    '容易……／难以……',
    'easy / hard to …',
    'このペンは書きやすいです。',
    [[{ pos: '形容詞', p1: '非自立', b: ['やすい', 'にくい', '難い', '易い'] }]]
  ),
  P(
    'hazu',
    4,
    '〜はずだ',
    '（按理说）应该……',
    'should be (as expected)',
    '彼はもう着いているはずです。',
    [[{ b: 'はず' }]]
  ),
  P(
    'baii',
    4,
    '〜ばいい',
    '……就行；……就好',
    'you just need to …',
    '分からないときは、先生に聞けばいいです。',
    [[{ s: 'ば' }, II]]
  ),
  P(
    'mama',
    4,
    '〜まま',
    '保持……的状态',
    'as it is, still …',
    '靴を履いたまま部屋に入らないでください。',
    [[{ b: 'まま' }]]
  ),
  P('zuni', 4, '〜ずに', '不……（而……）', 'without doing …', '朝ご飯を食べずに学校へ行きました。', [
    [{ pos: '助動詞', s: 'ず' }, { s: 'に' }]
  ]),
  P('shika', 4, '〜しか〜ない', '只有……', 'only (with a negative)', '財布に百円しかありません。', [
    [{ pos: '助詞', b: 'しか' }]
  ]),
  P('bakari', 4, '〜ばかり', '光……；净……', 'nothing but', '弟はゲームばかりしています。', [
    [{ pos: '助詞', b: 'ばかり' }]
  ]),
  P('kadouka', 4, '〜かどうか', '是否……', 'whether or not', '彼が来るかどうか分かりません。', [
    [{ s: 'か' }, { s: 'どう' }, { s: 'か' }],
    [{ s: 'か' }, { s: 'どうか' }]
  ]),
  P('nitsuite', 4, '〜について', '关于……', 'about', '日本の文化について話します。', [
    [{ s: 'について' }],
    [{ s: 'に' }, { s: 'つい' }, { s: 'て' }]
  ]),
  P(
    'niyotte',
    4,
    '〜によって',
    '根据……；由于……；由……',
    'depending on; by',
    '人によって考え方が違います。',
    [[{ s: 'によって' }], [{ s: 'に' }, { s: 'よっ' }, { s: 'て' }]]
  ),
  P('niyoruto', 4, '〜によると', '据……说', 'according to', '天気予報によると、明日は晴れです。', [
    [{ s: 'によると' }],
    [{ s: 'に' }, { s: 'よる' }, { s: 'と' }]
  ]),
  P('toshite', 4, '〜として', '作为……', 'as (in the role of)', '彼は通訳として働いています。', [
    [{ s: 'として' }],
    [{ s: 'と' }, { s: 'し' }, { s: 'て' }]
  ])
]

export const GRAMMAR: GrammarPoint[] = [...BASIC, ...N3.points, ...N2.points, ...N1.points]

export const GRAMMAR_BY_ID = new Map(GRAMMAR.map((g) => [g.id, g]))

const oneOf = (want: string | string[] | undefined, got: string): boolean =>
  want === undefined || (Array.isArray(want) ? want.includes(got) : want === got)

/** 认语法点要看的词素信息 */
export type MatchToken = Pick<
  JaToken,
  's' | 'b' | 'pos' | 'p1' | 'p2' | 'ct' | 'cf' | 'start' | 'end'
>

function tokenMatches(spec: TokenSpec, t: MatchToken): boolean {
  return (
    oneOf(spec.s, t.s) &&
    oneOf(spec.b, t.b) &&
    oneOf(spec.pos, t.pos) &&
    oneOf(spec.p1, t.p1) &&
    oneOf(spec.p2, t.p2) &&
    oneOf(spec.ct, t.ct) &&
    oneOf(spec.cf, t.cf)
  )
}

/** 只看不算的词素（ctx）：对得上才算满足；not 的反过来，那个位置没有词素也算满足 */
function contextMatches(spec: TokenSpec, t: MatchToken | undefined): boolean {
  if (!t) return !!spec.not
  return tokenMatches(spec, t) !== !!spec.not
}

/**
 * 一串条件从第 i 个词素起对不对得上（i 是语法点本身的第一个词素，开头只看不算的那几个在它前面）；
 * 对得上时给出语法点那一段 [from, to)
 */
export function matchAt(
  seq: readonly TokenSpec[],
  tokens: readonly MatchToken[],
  i: number
): [number, number] | null {
  let lead = 0
  while (lead < seq.length && seq[lead].ctx) lead++
  let trail = 0
  while (trail < seq.length - lead && seq[seq.length - 1 - trail].ctx) trail++
  const core = seq.length - lead - trail
  if (!core || i + core > tokens.length) return null
  for (let k = 0; k < core; k++) if (!tokenMatches(seq[lead + k], tokens[i + k])) return null
  for (let k = 0; k < lead; k++) if (!contextMatches(seq[k], tokens[i - lead + k])) return null
  for (let k = 0; k < trail; k++)
    if (!contextMatches(seq[lead + core + k], tokens[i + core + k])) return null
  return [i, i + core]
}

/**
 * 在一句的词素里找语法点。被更长的一条完全包住的去掉（〜ている 里的 〜て、〜ました 里的 〜ます），
 * 起止位置按原文算。
 */
export function matchGrammar(tokens: readonly MatchToken[], sentence = 0): GrammarHit[] {
  const found: { id: string; from: number; to: number }[] = []
  for (const g of GRAMMAR)
    for (let i = 0; i < tokens.length; i++)
      for (const seq of g.alts) {
        const m = matchAt(seq, tokens, i)
        if (m) {
          if (!g.check || g.check(tokens, m[0], m[1]))
            found.push({ id: g.id, from: m[0], to: m[1] })
          break
        }
      }
  const kept = found.filter(
    (h) =>
      !found.some(
        (o) => o !== h && o.from <= h.from && o.to >= h.to && o.to - o.from > h.to - h.from
      )
  )
  return kept
    .sort((a, b) => a.from - b.from || b.to - a.to)
    .map((h) => ({
      id: h.id,
      sentence,
      start: tokens[h.from].start,
      end: tokens[h.to - 1].end
    }))
}
