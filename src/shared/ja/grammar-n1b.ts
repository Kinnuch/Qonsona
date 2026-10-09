/**
 * JLPT N1 的语法（二）：名词后的词尾、不必与只好、同时与顺便、不顾与借口、根据、倾向与结局、值得、比喻、文言。
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

/** 前面是动词原形（只看不算） */
const AFTER_DICT: TokenSpec = { pos: '動詞', cf: '基本形', ctx: true }
/** 前面是名词（只看不算） */
const AFTER_NOUN: TokenSpec = { pos: '名詞', ctx: true }
/** 前面是サ変名词（想像、理解……，只看不算） */
const AFTER_SAHEN: TokenSpec = { pos: '名詞', p1: 'サ変接続', ctx: true }
/** 后面是标点（只看不算） */
const SENTENCE_END: TokenSpec[] = [{ pos: '記号', ctx: true }]
/** 后面是终助词（只看不算） */
const SENTENCE_END_PARTICLE: TokenSpec[] = [{ p1: '終助詞', ctx: true }]
/** 〜ません */
const MASEN: TokenSpec[] = [{ s: 'ませ' }, { s: 'ん' }]
/** 〜ありません */
const ARIMASEN: TokenSpec[] = [{ s: 'あり' }, ...MASEN]

const TAERU = ['たえる', '堪える', '耐える']
const TARU = ['足る', '足りる']
const KATAKU: TokenSpec = { s: ['かたく', '難く'], b: ['かたい', '難い'] }
const KOSHITA: TokenSpec[] = [
  { s: 'に' },
  { b: ['越す', 'こす'] },
  { s: 'た' },
  { s: 'こと' },
  { s: 'は' }
]
const OYOBU = ['及ぶ', 'およぶ']
/** ず + には（〜ずにはおかない、〜ずにはすまない） */
const ZUNIWA: TokenSpec[] = [{ s: 'ず', pos: '助動詞' }, { s: 'に' }, { s: 'は' }]
const OKU_SUMU = ['おく', '置く', 'すむ', '済む']
/** 余儀なく + さ + れ */
const YOGINAKU: TokenSpec[] = [{ b: '余儀ない' }, { s: 'さ', b: 'する' }, { b: 'れる' }]
const ARUMAISHI: TokenSpec[] = [{ b: 'ある' }, { s: 'まい' }, { s: 'し' }]
/** きらい + が + ある */
const KIRAI: TokenSpec[] = [{ s: ['きらい', '嫌い'], pos: '名詞' }, { s: 'が' }, { b: 'ある' }]
/** ん + が + ため（「合格せんがため、」的 ため 会切成动词 ためる，所以只看写法） */
const NGATAME: TokenSpec[] = [{ s: 'ん', pos: '助動詞' }, { s: 'が' }, { s: ['ため', '為'] }]
/** を + もの + と + も */
const MONOTOMO: TokenSpec[] = [{ s: 'を' }, { s: ['もの', '物'] }, { s: 'と' }, { s: 'も' }]
const FUMAERU: TokenSpec = { b: ['踏まえる', 'ふまえる'] }
const SOKUSU: TokenSpec = { b: ['即す', '即する', '則す', '則する'] }
const KAKOTSUKERU: TokenSpec = { b: ['かこつける', '託ける'] }
/** 相まって（kuromoji 多半切成一个副词） */
const AIMATTE: TokenSpec = { s: ['相まって', '相俟って'] }
const AIMATSU: TokenSpec = { b: ['相まつ', '相俟つ', 'あいまつ'] }
const KATAWARA: TokenSpec = { s: ['かたわら', '傍ら'] }
/** 后面不是助词（道のかたわらに 的「旁边」不算） */
const NOT_PARTICLE_AFTER: TokenSpec = { pos: '助詞', ctx: true, not: true }
const YUE: TokenSpec = { s: ['ゆえ', '故'], pos: '名詞' }
/** それゆえ、何ゆえ 不算 */
const NOT_SORE: TokenSpec = { s: ['それ', 'これ', 'その', '何'], ctx: true, not: true }
/** なし + に；后面不能是なる、する（台無しになる、一文無しになる 不算） */
const NASHINI: TokenSpec[] = [
  { s: ['なし', '無し'] },
  { s: 'に' },
  { b: ['なる', 'する'], ctx: true, not: true }
]

const points: GrammarPoint[] = [
  P(
    'nitaenai',
    1,
    '〜にたえない／〜にたえる',
    '不堪……；值得……',
    'unbearable to …; worthy of …',
    'この番組は内容がひどくて、見るにたえない。',
    [
      [AFTER_DICT, { s: 'に' }, { b: TAERU, cf: '未然形' }, { b: 'ない' }],
      [AFTER_DICT, { s: 'に' }, { b: TAERU, cf: '連用形' }, ...MASEN],
      [AFTER_DICT, { s: 'に' }, { b: TAERU, cf: '基本形' }],
      [AFTER_NOUN, { s: 'に' }, { b: TAERU, cf: '未然形' }, { b: 'ない' }],
      [AFTER_NOUN, { s: 'に' }, { b: TAERU, cf: '連用形' }, ...MASEN],
      // N + にたえる（鑑賞にたえる）：耐える（忍受寒冷、疼痛）不算
      [AFTER_NOUN, { s: 'に' }, { b: ['たえる', '堪える'], cf: '基本形' }]
    ]
  ),
  P(
    'nitaru',
    1,
    '〜に足る',
    '值得……；足以……',
    'worthy of …; enough to …',
    'この会社には、仕事を任せるに足る実績がある。',
    [
      [AFTER_DICT, { s: 'に' }, { b: TARU, cf: '未然形' }, { b: 'ない' }],
      [AFTER_DICT, { s: 'に' }, { b: TARU }],
      // N + に足る（信頼に足る）：N + に足りない（目標に足りない）是「不够」，不算
      [AFTER_NOUN, { s: 'に' }, { b: '足る', cf: '未然形' }, { b: 'ない' }],
      [AFTER_NOUN, { s: 'に' }, { b: '足る' }]
    ]
  ),
  P(
    'nikatakunai',
    1,
    '〜にかたくない',
    '不难……',
    'not hard to …',
    '初めて一人で海外へ行く彼女の不安は、想像にかたくない。',
    [
      [AFTER_SAHEN, { s: 'に' }, KATAKU, { b: 'ない' }],
      [AFTER_SAHEN, { s: 'に' }, KATAKU, ...ARIMASEN],
      [AFTER_DICT, { s: 'に' }, KATAKU, { b: 'ない' }],
      [AFTER_DICT, { s: 'に' }, KATAKU, ...ARIMASEN]
    ]
  ),
  P(
    'nikoshitakotowanai',
    1,
    '〜に越したことはない',
    '最好是……；……再好不过',
    "nothing beats …; it's best to …",
    '旅行の荷物は軽いに越したことはない。',
    [
      [...KOSHITA, { b: 'ない' }],
      [...KOSHITA, ...ARIMASEN]
    ]
  ),
  P(
    'nihaoyobanai',
    1,
    '〜には及ばない',
    '不必……；比不上……',
    'no need to …; no match for …',
    '簡単な手続きなので、わざわざ来るには及びません。',
    [
      [{ s: 'に' }, { s: 'は' }, { b: OYOBU, cf: '未然形' }, { b: 'ない' }],
      [{ s: 'に' }, { s: 'は' }, { b: OYOBU, cf: '連用形' }, ...MASEN],
      [AFTER_DICT, { s: 'に' }, { b: OYOBU, cf: '未然形' }, { b: 'ない' }],
      [AFTER_DICT, { s: 'に' }, { b: OYOBU, cf: '連用形' }, ...MASEN]
    ]
  ),
  P(
    'madademonai',
    1,
    '〜までもない',
    '用不着……',
    'no need to …; needless to …',
    'そんな簡単なこと、説明するまでもない。',
    [
      [AFTER_DICT, { s: 'まで' }, { s: 'も' }, { b: 'ない' }],
      [AFTER_DICT, { s: 'まで' }, { s: 'も' }, ...ARIMASEN],
      // 言うまでもない 切成一个形容词
      [{ b: '言うまでもない' }]
    ]
  ),
  P(
    'madeda',
    1,
    '〜までだ／〜までのことだ',
    '只好……；只不过……而已',
    'will simply …; merely …',
    '電車が動かないなら、歩いて帰るまでだ。',
    [
      [AFTER_DICT, { s: 'まで' }, { s: 'の' }, { s: 'こと' }, { b: ['だ', 'です'] }],
      [
        { b: 'た', pos: '助動詞', ctx: true },
        { s: 'まで' },
        { s: 'の' },
        { s: 'こと' },
        { b: ['だ', 'です'] }
      ],
      // 名词后的「まで（だ）」是「到……为止」，不算；までだ 得在句末（来るまでだと思う 不算）
      [AFTER_DICT, { s: 'まで' }, { b: ['だ', 'です'] }, ...SENTENCE_END],
      [AFTER_DICT, { s: 'まで' }, { b: ['だ', 'です'] }, ...SENTENCE_END_PARTICLE],
      [
        { b: 'た', pos: '助動詞', ctx: true },
        { s: 'まで' },
        { b: ['だ', 'です'] },
        ...SENTENCE_END
      ],
      [
        { b: 'た', pos: '助動詞', ctx: true },
        { s: 'まで' },
        { b: ['だ', 'です'] },
        ...SENTENCE_END_PARTICLE
      ]
    ]
  ),
  P(
    'bekumonai',
    1,
    '〜べくもない',
    '无法……；根本不可能……',
    'cannot possibly …',
    '普通の会社員の給料では、そんな豪邸は望むべくもない。',
    [
      [{ s: 'べく' }, { s: 'も' }, { b: 'ない' }],
      [{ s: 'べく' }, { s: 'も' }, ...ARIMASEN]
    ]
  ),
  P(
    'zuniwaokanai',
    1,
    '〜ずにはおかない／〜ずにはすまない',
    '必然会……；不……不行',
    'cannot fail to …; must …',
    '彼の熱いスピーチは、聞く人を感動させずにはおかない。',
    [
      [...ZUNIWA, { b: OKU_SUMU, cf: '未然形' }, { b: 'ない' }],
      [...ZUNIWA, { b: OKU_SUMU, cf: '連用形' }, ...MASEN],
      // 済まない 有时切成一个形容词
      [...ZUNIWA, { b: ['済まない', 'すまない'] }],
      // 〜ずにはすまされない
      [...ZUNIWA, { b: ['すます', '済ます'] }, { b: 'れる' }, { b: 'ない' }]
    ]
  ),
  P(
    'woyoginakusareru',
    1,
    '〜を余儀なくされる',
    '不得不……；被迫……',
    'be forced to …',
    '大雨のため、試合は中止を余儀なくされた。',
    [[{ s: 'を' }, ...YOGINAKU, { b: 'た', pos: '助動詞' }], [{ s: 'を' }, ...YOGINAKU], YOGINAKU]
  ),
  P(
    'nisouinai',
    1,
    '〜に相違ない',
    '一定……',
    'must be …; without doubt',
    'この手紙は、彼が書いたものに相違ない。',
    [
      [{ s: 'に' }, { s: '相違' }, { b: 'ない' }],
      [{ s: 'に' }, { s: '相違' }, ...ARIMASEN]
    ]
  ),
  P(
    'dewaarumaishi',
    1,
    '〜ではあるまいし',
    '又不是……',
    "it's not as if …",
    '子供ではあるまいし、一人で帰れるよ。',
    [
      [{ s: 'で' }, { s: ['は', 'も'] }, ...ARUMAISHI],
      [{ s: 'じゃ' }, ...ARUMAISHI]
    ]
  ),
  P(
    'kirai',
    1,
    '〜きらいがある',
    '有……的倾向',
    'tend to …',
    '彼は物事を大げさに言うきらいがある。',
    [
      [{ pos: ['動詞', '助動詞', '形容詞'], ctx: true }, ...KIRAI],
      [{ s: 'の', ctx: true }, ...KIRAI]
    ]
  ),
  P(
    'shimatsu',
    1,
    '〜始末だ',
    '落到……的地步',
    'end up (badly) …',
    '彼は遅刻ばかりして、ついには会議まで忘れる始末だ。',
    // 前面得是谓语（この始末だ、始末する 不算）；省掉だ、直接接句号的也算
    [
      [{ pos: ['動詞', '助動詞'], ctx: true }, { s: '始末' }, { b: ['だ', 'です'] }],
      [{ pos: ['動詞', '助動詞'], ctx: true }, { s: '始末' }, { s: ['。', '！'], ctx: true }]
    ]
  ),
  P(
    'beku',
    1,
    '〜べく',
    '为了……',
    'in order to …',
    '彼は夢をかなえるべく、毎日努力している。',
    // 前面得是动词（然るべく 的る是助动词，不算；假名的 しかるべく 在挑例句的规则里挡）；〜べくして（必然）不算
    [[{ pos: '動詞', ctx: true }, { s: 'べく' }, { s: 'し', ctx: true, not: true }]]
  ),
  P(
    'ngatame',
    1,
    '〜んがため（に）',
    '（一心）为了……',
    'for the sole purpose of …',
    '試験に合格せんがため、彼は寝る間も惜しんで勉強した。',
    [[...NGATAME, { s: 'に' }], NGATAME]
  ),
  P(
    'bekarazu',
    1,
    '〜べからず／〜べからざる',
    '不可……；禁止……',
    'must not …; do not …',
    '立て札には「芝生に入るべからず」と書いてある。',
    [[{ s: 'べから' }, { s: ['ず', 'ざる'] }]]
  ),
  P(
    'majiki',
    1,
    '〜まじき',
    '不应有的……；不该……',
    'unbecoming of …; should never …',
    '生徒の答案をなくすなど、教師にあるまじきことだ。',
    [[{ s: 'ある' }, { s: 'まじき' }], [{ s: 'まじき' }]]
  ),
  P(
    'nbakari',
    1,
    '〜んばかり',
    '几乎要……',
    'as if about to …',
    '合格の知らせに、彼女は泣き出さんばかりに喜んだ。',
    [[{ s: 'ん', pos: '助動詞' }, { s: 'ばかり' }]]
  ),
  P(
    'tobakarini',
    1,
    '〜とばかりに',
    '简直像要说……似的',
    'as if to say …',
    'ドアが開くと、子供たちは待ってましたとばかりに飛び出した。',
    [[{ s: 'と', pos: '助詞' }, { s: 'ばかり' }, { s: 'に' }]]
  ),
  P(
    'nagarani',
    1,
    '〜ながらに（して）',
    '保持……的状态；……着',
    'while still …; just as …',
    'ネットのおかげで、家に居ながらにして世界のニュースが読める。',
    [
      [{ s: 'ながら' }, { s: 'に' }, { s: 'し' }, TE],
      [{ s: 'ながら' }, { s: 'に' }],
      // 名词、副词后的 ながらの（涙ながらの、いつもながらの）；歩きながらの 是「一边」，不算
      [{ pos: ['名詞', '副詞'], ctx: true }, { s: 'ながら' }, { s: 'の' }],
      // 生まれながら、昔ながら、いながらにして 切成一个词
      [{ s: ['生まれながら', '昔ながら'] }, { s: 'に' }, { s: 'し' }, TE],
      [{ s: ['生まれながら', '昔ながら'] }, { s: ['に', 'の'] }],
      [{ s: ['いながらにして', '居ながらにして'] }]
    ]
  ),
  P(
    'gotoku',
    1,
    '〜ごとく／〜ごとき／〜ごとし',
    '如……；像……',
    'like …; as …',
    '前に述べたごとく、この計画には問題が多い。',
    [[{ b: ['ごとし', '如し'] }]]
  ),
  P(
    'womonotomosezu',
    1,
    '〜をものともせず',
    '不顾……；不畏……',
    'undaunted by …',
    '彼らは激しい雨をものともせず、山頂を目指した。',
    [
      [...MONOTOMO, { s: 'せ' }, { s: 'ず' }, { s: 'に' }],
      [...MONOTOMO, { s: 'せ' }, { s: 'ず' }],
      [...MONOTOMO, { s: 'し', b: 'する' }, { b: 'ない' }]
    ]
  ),
  P(
    'woyosoni',
    1,
    '〜をよそに',
    '不顾……；无视……',
    'ignoring …; in disregard of …',
    '親の心配をよそに、息子は毎晩遅くまで遊んでいる。',
    [[{ s: 'を' }, { s: ['よそ', '余所'] }, { s: 'に' }]]
  ),
  P(
    'wofumaete',
    1,
    '〜を踏まえて',
    '根据……；以……为前提',
    'based on …; in light of …',
    'アンケートの結果を踏まえて、サービスを改善します。',
    [
      [{ s: 'を' }, FUMAERU, TE],
      [{ s: 'を' }, FUMAERU]
    ]
  ),
  P(
    'nisokushite',
    1,
    '〜に即して',
    '按照……；依据……',
    'in line with …',
    '規則に即して、公平に判断してください。',
    [
      [{ s: 'に' }, SOKUSU, TE],
      [{ s: 'に' }, SOKUSU]
    ]
  ),
  P(
    'nikakotsukete',
    1,
    '〜にかこつけて',
    '借口……',
    'under the pretext of …',
    '彼は仕事にかこつけて、よく旅行に出かける。',
    [
      [{ s: 'に' }, KAKOTSUKERU, TE],
      [{ s: 'に' }, KAKOTSUKERU]
    ]
  ),
  P(
    'toaimatte',
    1,
    '〜と相まって',
    '与……相结合',
    'combined with …',
    '美しい景色と相まって、その旅は忘れられないものになった。',
    [
      [{ s: ['と', 'も'], pos: '助詞' }, AIMATTE],
      [{ s: ['と', 'も'], pos: '助詞' }, AIMATSU, TE],
      // AとBが相まって
      [AIMATTE],
      [AIMATSU, TE]
    ]
  ),
  P(
    'wooite',
    1,
    '〜をおいて',
    '除了……之外（没有）',
    'no one but …; nothing but …',
    'この仕事を任せられるのは、彼をおいてほかにいない。',
    // 后面得是「ほか（他）」：荷物をおいて（放下）、何をおいても（首先）不算
    [[{ s: 'を' }, { s: 'おい', b: 'おく' }, TE, { s: ['ほか', '他'], ctx: true }]]
  ),
  P(
    'katagata',
    1,
    '〜かたがた',
    '顺便……；兼……',
    'partly to …; while also …',
    '先日のお礼かたがた、ご挨拶に伺いました。',
    // 前面得是名词（ご来場の方々 的「各位」不算）
    [
      [AFTER_NOUN, { s: 'かたがた' }],
      [AFTER_SAHEN, { s: '方々' }]
    ]
  ),
  P(
    'katawara',
    1,
    '〜かたわら',
    '一边……一边（本职之外）',
    "besides (one's main work) …",
    '彼は会社に勤めるかたわら、小説を書いている。',
    [
      [{ s: ['の', 'その'], ctx: true }, KATAWARA, NOT_PARTICLE_AFTER],
      [AFTER_DICT, KATAWARA, NOT_PARTICLE_AFTER]
    ]
  ),
  P(
    'gatera',
    1,
    '〜がてら',
    '顺便……',
    'on the way …; while …ing',
    '散歩がてら、パンを買いに行ってきます。',
    // kuromoji 把 がてら 切成 が + てら（てる）
    [[{ s: 'が' }, { s: 'てら' }], [{ s: 'がてら' }]]
  ),
  P(
    'naradewa',
    1,
    '〜ならでは',
    '只有……才有的',
    'unique to …',
    'この味は、老舗ならではのものだ。',
    [[{ s: 'ならでは' }], [{ s: 'なら' }, { s: 'で' }, { s: 'は' }, { s: 'の', ctx: true }]]
  ),
  P(
    'narini',
    1,
    '〜なりに／〜なりの',
    '与……相称；以……自己的方式',
    "in one's own way; befitting …",
    '子供なりに、家族のことを心配しているようだ。',
    // 副助词的 なり（帰るなり 的接续助词不算）；再往前一个不能也是なり（男なり女なりの 是「或……或……」）
    [
      [
        { s: 'なり', ctx: true, not: true },
        { pos: ['名詞', '形容詞', '助動詞'], ctx: true },
        { s: 'なり', p1: '副助詞' },
        { s: ['に', 'の'] }
      ]
    ]
  ),
  P('zukume', 1, '〜ずくめ', '全是……', 'full of …; all …', '今年はいいことずくめの一年だった。', [
    [{ s: ['ずくめ', 'づくめ', '尽くめ'] }]
  ]),
  P(
    'meku',
    1,
    '〜めく',
    '带有……的样子',
    'show signs of …; …-like',
    '彼の言葉には、どこか皮肉めいた響きがあった。',
    // 春めく、夏めく、秋めく 切成一个动词
    [[{ b: 'めく', pos: '動詞' }], [{ b: ['春めく', '夏めく', '秋めく'] }]]
  ),
  P(
    'mamire',
    1,
    '〜まみれ',
    '满是……（污物）',
    'covered in …',
    '子供たちは砂まみれになって、公園で遊んでいる。',
    // 泥まみれ、血まみれ 切成一个名词；动词 まみれる（泥にまみれる）不算
    [[{ s: 'まみれ', pos: '名詞' }], [{ s: ['泥まみれ', '血まみれ'] }]]
  ),
  P(
    'jimiru',
    1,
    '〜じみる',
    '像……似的',
    '…-ish; smacking of …',
    'いい大人が、そんな子供じみたことを言うな。',
    [[{ b: 'じみる', pos: '動詞' }]]
  ),
  P('yue', 1, '〜ゆえ（に）', '因为……', 'because of …', '若さゆえの失敗は、誰にでもあるものだ。', [
    // 〜がゆえに：ゆえに 切成一个接续词
    [{ s: 'が' }, { s: ['ゆえに', '故に'] }],
    [{ s: 'が' }, YUE, { s: ['に', 'の'] }],
    [NOT_SORE, YUE, { s: ['に', 'の'] }],
    [NOT_SORE, { s: 'ゆえ', pos: '名詞' }, { s: ['、', '。', 'だ', 'で', 'です'], ctx: true }]
  ]),
  P(
    'kotonashini',
    1,
    '〜ことなしに／〜なしに',
    '不……就……；没有……',
    'without …',
    '努力することなしに、成功は手に入らない。',
    [
      [{ s: 'こと' }, ...NASHINI],
      [AFTER_NOUN, ...NASHINI]
    ]
  ),
  P(
    'toomoikiya',
    1,
    '〜と思いきや',
    '原以为……却',
    'contrary to what one expected …',
    '今日は晴れると思いきや、午後から雨になった。',
    [[{ s: 'と' }, { b: ['思う', 'おもう'] }, { s: 'き' }, { s: 'や' }]]
  ),
  P(
    'tokitara',
    1,
    '〜ときたら',
    '说起……来（不满）',
    'when it comes to … (complaining)',
    'うちの息子ときたら、一日中ゲームばかりしている。',
    [
      // kuromoji 多半切成 とき（とく）+ たら
      [{ s: 'とき', b: 'とく' }, { s: 'たら' }],
      // 彼ときたら 会切成 と + き（来る）+ たら：后面得有读点（假名写的「友達と来たら」不算）
      [AFTER_NOUN, { s: 'と' }, { s: 'き', b: 'くる' }, { s: 'たら' }, { s: '、', ctx: true }]
    ]
  ),
  P(
    'zujimai',
    1,
    '〜ずじまい',
    '终究没能……',
    'end up never …',
    '旅行中は忙しくて、お土産を買わずじまいだった。',
    [[{ s: 'ず', pos: '助動詞' }, { s: ['じまい', '仕舞い'] }]]
  )
]

/** 接续、自带例句的中英翻译、同组、另写的例句 */
const notes: Record<string, GrammarNote> = {
  nitaenai: {
    form: 'V辞書形 / N + にたえない（見るにたえない · 感謝の念にたえない）· N + にたえる（鑑賞にたえる）',
    zh: '这个节目内容太差，简直看不下去。',
    en: "The content of this program is so bad that it's unbearable to watch.",
    group: 'worth',
    more: [
      {
        ja: '皆様の温かいご支援に、感謝の念にたえません。',
        zh: '对各位的热情支持，我们感激不尽。',
        en: 'We cannot thank you enough for your warm support.'
      },
      {
        ja: '子供向けだが、大人の鑑賞にたえる映画だ。',
        zh: '虽说是面向儿童的，这部电影也经得起成年人欣赏。',
        en: "It's made for children, but it's a film adults can enjoy too."
      }
    ]
  },
  nitaru: {
    form: 'V辞書形 / N + に足る（任せるに足る · 信頼に足る）',
    zh: '这家公司有足以让人放心托付工作的业绩。',
    en: 'This company has a track record that makes it worth entrusting with the work.',
    group: 'worth',
    more: [
      {
        ja: 'そんな取るに足らないことで悩むなよ。',
        zh: '别为那种微不足道的小事烦恼了。',
        en: "Don't worry about such a trivial thing."
      },
      {
        ja: 'この調査結果だけでは、結論を出すに足る根拠とは言えない。',
        zh: '仅凭这项调查结果，还称不上是足以得出结论的依据。',
        en: "These survey results alone aren't enough to base a conclusion on."
      }
    ]
  },
  nikatakunai: {
    form: 'V辞書形 / N + にかたくない（察するにかたくない · 想像にかたくない）',
    zh: '她第一次一个人出国，心里有多不安，不难想象。',
    en: "It's easy to imagine how anxious she is about going abroad alone for the first time.",
    group: 'tend',
    more: [
      {
        ja: '夢がかなった彼の喜びは、察するにかたくない。',
        zh: '梦想成真的他有多高兴，不难体会。',
        en: 'It is not hard to guess how happy he is now that his dream has come true.'
      },
      {
        ja: '値上げが続けば消費が落ち込むことは、想像に難くない。',
        zh: '如果持续涨价，消费就会下滑，这不难想象。',
        en: "If prices keep rising, it's easy to imagine consumer spending falling."
      }
    ]
  },
  nikoshitakotowanai: {
    form: 'V辞書形 / いA / なA / N + に越したことはない',
    zh: '旅行的行李越轻越好。',
    en: 'When you travel, the lighter your luggage, the better.',
    group: 'should',
    more: [
      {
        ja: '念のため、早めに出るに越したことはないよ。',
        zh: '保险起见，还是早点出门为好。',
        en: "Just to be safe, it's best to leave early."
      },
      {
        ja: '費用は安いに越したことはありませんが、品質も大切です。',
        zh: '费用当然是越便宜越好，但质量也很重要。',
        en: 'Lower costs are always welcome, of course, but quality matters too.'
      }
    ]
  },
  nihaoyobanai: {
    form: 'V辞書形 / N + には及ばない',
    zh: '手续很简单，您不必特地跑一趟。',
    en: "It's a simple procedure, so there's no need to come in person.",
    group: 'need-not',
    more: [
      {
        ja: '料理の腕では、まだまだ母には及ばない。',
        zh: '论厨艺，我还远远比不上妈妈。',
        en: "When it comes to cooking, I'm still nowhere near as good as my mother."
      },
      {
        ja: 'もう元気になりましたから、ご心配には及びません。',
        zh: '我已经好了，您不必担心。',
        en: "I've fully recovered, so there's no need to worry."
      }
    ]
  },
  madademonai: {
    form: 'V辞書形 + までもない（までもなく）',
    zh: '那么简单的事，用不着解释。',
    en: "Something that simple doesn't need explaining.",
    group: 'need-not',
    more: [
      {
        ja: '結果は、わざわざ確かめるまでもなく明らかだった。',
        zh: '结果一目了然，根本用不着特意去确认。',
        en: 'The result was obvious; there was no need to check.'
      },
      {
        ja: '近いので、わざわざタクシーを呼ぶまでもありませんよ。',
        zh: '离得很近，用不着特地叫出租车。',
        en: "It's close by, so there's no need to call a taxi."
      }
    ]
  },
  madeda: {
    form: 'V辞書形 / Vた形 + までだ（までのことだ）',
    zh: '电车不开的话，那就只好走回去了。',
    en: "If the trains aren't running, I'll just have to walk home.",
    group: 'no-choice',
    more: [
      {
        ja: '怒ったわけではなく、本当のことを言ったまでだ。',
        zh: '我不是生气，只不过是说了实话而已。',
        en: "I wasn't angry; I was just telling the truth."
      },
      {
        ja: '今回がだめでも、また来年挑戦するまでのことです。',
        zh: '这次不行的话，明年再挑战就是了。',
        en: "Even if it doesn't work out this time, I'll simply try again next year."
      }
    ]
  },
  bekumonai: {
    form: 'V辞書形 + べくもない',
    zh: '靠普通上班族的工资，那样的豪宅根本不敢奢望。',
    en: "On an ordinary office worker's salary, a mansion like that is out of the question.",
    group: 'cannot',
    more: [
      {
        ja: '当時の私には、彼の本当の気持ちなど知るべくもなかった。',
        zh: '当时的我根本无从知道他的真实想法。',
        en: 'Back then, I had no way of knowing how he really felt.'
      },
      {
        ja: '町の小さな図書館は、都会の図書館とは比べるべくもない。',
        zh: '镇上的小图书馆根本无法和城市里的图书馆相比。',
        en: "Our small town library can't possibly compare with the libraries in the city."
      }
    ]
  },
  zuniwaokanai: {
    form: '感動させない → 感動させずにはおかない · 謝らない → 謝らずにはすまない · する → せずにはすまない',
    zh: '他热情洋溢的演讲，必定会打动听众。',
    en: 'His passionate speech cannot fail to move those who hear it.',
    group: 'no-choice',
    more: [
      {
        ja: '借りた本をなくしたのだから、謝らずにはすまない。',
        zh: '把借来的书弄丢了，不道歉是说不过去的。',
        en: "I lost the book I borrowed, so I can't get away without apologizing."
      },
      {
        ja: '今回のミスは、会社の信用に影響を与えずにはおかないだろう。',
        zh: '这次的失误必然会影响到公司的信誉吧。',
        en: "This mistake is bound to affect the company's reputation."
      }
    ]
  },
  woyoginakusareru: {
    form: 'N + を余儀なくされる',
    zh: '由于大雨，比赛不得不取消。',
    en: 'The match had to be called off because of heavy rain.',
    group: 'no-choice',
    more: [
      {
        ja: '工場の閉鎖で、多くの社員が転職を余儀なくされた。',
        zh: '由于工厂关闭，许多员工被迫换了工作。',
        en: "The factory's closure forced many employees to change jobs."
      },
      {
        ja: 'けがのため、彼は長期の休養を余儀なくされている。',
        zh: '因为受伤，他不得不长期休养。',
        en: 'Because of an injury, he has been forced to take a long break.'
      }
    ]
  },
  nisouinai: {
    form: '普通形 / なA / N + に相違ない',
    zh: '这封信一定是他写的。',
    en: 'This letter must have been written by him.',
    group: 'guess',
    more: [
      {
        ja: '部屋の明かりがついているから、彼は家にいるに相違ない。',
        zh: '房间的灯亮着，他一定在家。',
        en: 'The light is on in his room, so he must be at home.'
      },
      {
        ja: 'この新製品は、若い世代に受け入れられるに相違ありません。',
        zh: '这款新产品一定会受到年轻一代的欢迎。',
        en: 'This new product will surely be well received by the younger generation.'
      }
    ]
  },
  dewaarumaishi: {
    form: 'N + ではあるまいし（じゃあるまいし）',
    zh: '我又不是小孩子，一个人回得去。',
    en: "I'm not a child — I can get home on my own.",
    group: 'partial-neg',
    more: [
      {
        ja: '神様じゃあるまいし、未来のことなんて分からないよ。',
        zh: '我又不是神仙，哪知道未来的事。',
        en: "I'm not God — how would I know what the future holds?"
      },
      {
        ja: '一生会えないわけではあるまいし、そんなに泣かないで。',
        zh: '又不是一辈子见不到了，别哭得那么伤心。',
        en: "It's not as if we'll never see each other again, so don't cry like that."
      }
    ]
  },
  kirai: {
    form: 'V辞書形 / Vない形 / Nの + きらいがある',
    zh: '他说话往往夸大其词。',
    en: 'He has a tendency to exaggerate.',
    group: 'tend',
    more: [
      {
        ja: '人は年を取ると、新しいことを避けるきらいがある。',
        zh: '人上了年纪，往往会回避新事物。',
        en: 'As people get older, they tend to avoid new things.'
      },
      {
        ja: 'この報告書は、データを都合よく解釈しているきらいがある。',
        zh: '这份报告有按自己的需要解读数据之嫌。',
        en: 'This report seems to interpret the data in a self-serving way.'
      }
    ]
  },
  shimatsu: {
    form: 'V辞書形 / Vない形 + 始末だ',
    zh: '他老是迟到，最后竟落到连会议都忘了的地步。',
    en: "He's always late, and now he's even forgotten a meeting.",
    group: 'outcome',
    more: [
      {
        ja: '弟はゲームに夢中で、とうとう学校を休む始末だ。',
        zh: '弟弟沉迷游戏，最后竟然连学都不去上了。',
        en: "My little brother is so hooked on games that he's ended up skipping school."
      },
      {
        ja: '何度注意しても直らず、最後には逆に怒り出す始末です。',
        zh: '怎么提醒都改不了，到最后反而发起火来。',
        en: "No matter how often I warn him he doesn't change, and in the end he even gets angry at me."
      }
    ]
  },
  beku: {
    form: 'V辞書形 + べく（する → すべく / するべく）',
    zh: '他为了实现梦想，每天都在努力。',
    en: 'He works hard every day to make his dream come true.',
    group: 'purpose',
    more: [
      {
        ja: '新しい市場を開拓すべく、海外に支店を設けた。',
        zh: '为了开拓新市场，在海外设立了分店。',
        en: 'We opened a branch overseas in order to develop new markets.'
      },
      {
        ja: '事故の原因を明らかにするべく、調査が進められている。',
        zh: '为了查明事故原因，调查正在进行中。',
        en: 'An investigation is under way to find out the cause of the accident.'
      }
    ]
  },
  ngatame: {
    form: '守る → 守らんがため（に） · する → せんがため（に）',
    zh: '为了通过考试，他连睡觉的时间都舍不得，拼命学习。',
    en: 'Determined to pass the exam, he studied so hard he barely slept.',
    group: 'purpose',
    more: [
      {
        ja: '自分の利益を守らんがための発言だと批判された。',
        zh: '那番话被批评为只是为了维护自己的利益。',
        en: 'His remark was criticized as being made purely to protect his own interests.'
      },
      {
        ja: '生きんがために、彼はどんな仕事でも引き受けた。',
        zh: '为了活下去，他什么工作都肯接。',
        en: 'In order to survive, he took on any kind of work.'
      }
    ]
  },
  bekarazu: {
    form: 'V辞書形 + べからず · V辞書形 + べからざる + N（する → すべからず）',
    zh: '告示牌上写着“禁止进入草坪”。',
    en: 'The sign says, “Keep off the grass.”',
    group: 'should',
    more: [
      {
        ja: '水は人間の生活に欠くべからざるものだ。',
        zh: '水是人类生活中不可或缺的东西。',
        en: 'Water is indispensable to human life.'
      },
      {
        ja: '人の失敗を笑うべからず、と祖母はよく言っていた。',
        zh: '奶奶常说：不可嘲笑别人的失败。',
        en: "My grandmother often said you must never laugh at other people's mistakes."
      }
    ]
  },
  majiki: {
    form: 'V辞書形 + まじき + N · N + にあるまじき + N',
    zh: '弄丢学生的答卷，这是当老师的绝不该有的事。',
    en: "Losing students' exam papers is unacceptable for a teacher.",
    group: 'should',
    more: [
      {
        ja: '人の手紙を勝手に読むなど、許すまじき行為だ。',
        zh: '擅自看别人的信，这是不可原谅的行为。',
        en: "Reading someone else's letters without permission is unforgivable."
      },
      {
        ja: '試合中に審判に文句を言うのは、選手としてあるまじき態度だ。',
        zh: '比赛中向裁判抱怨，这是选手不应有的态度。',
        en: 'Complaining to the referee during a match is unacceptable behavior for a player.'
      }
    ]
  },
  nbakari: {
    form: '泣く → 泣かんばかり（に／の） · する → せんばかり',
    zh: '听到考上的消息，她高兴得几乎要哭出来。',
    en: 'When she heard she had passed, she was so happy she nearly burst into tears.',
    group: 'seem',
    more: [
      {
        ja: '割れんばかりの拍手が会場に響いた。',
        zh: '震耳欲聋的掌声响彻会场。',
        en: 'Thunderous applause rang through the hall.'
      },
      {
        ja: '桜の枝が、折れんばかりに花をつけている。',
        zh: '樱花枝上开满了花，几乎要被压断了。',
        en: 'The cherry branches are so laden with blossoms they look ready to break.'
      }
    ]
  },
  tobakarini: {
    form: '普通形（一句话）+ とばかりに',
    zh: '门一开，孩子们就像早等着这一刻似的冲了出去。',
    en: 'As soon as the door opened, the children rushed out as if they had been waiting for that moment.',
    group: 'seem',
    more: [
      {
        ja: '彼は自分には関係ないとばかりに、黙って横を向いた。',
        zh: '他像是在说“跟我没关系”似的，默默地把脸转了过去。',
        en: 'He silently looked away, as if to say it had nothing to do with him.'
      },
      {
        ja: 'セール初日、客は今だとばかりに商品を買い込んだ。',
        zh: '打折第一天，顾客们像是在说“就是现在”似的大量抢购。',
        en: 'On the first day of the sale, customers stocked up as if this was their big chance.'
      }
    ]
  },
  nagarani: {
    form: 'N / Vます形 + ながらに（して）· ながらの + N（涙ながらに · 居ながらにして · 昔ながらの）',
    zh: '有了网络，足不出户就能读到世界各地的新闻。',
    en: 'Thanks to the internet, you can read news from around the world without leaving home.',
    group: 'while',
    more: [
      {
        ja: '彼女は涙ながらに、これまでの苦労を語った。',
        zh: '她含着眼泪讲述了一路走来的艰辛。',
        en: 'In tears, she spoke of the hardships she had been through.'
      },
      {
        ja: 'いつもながらの見事な演技に、観客は大きな拍手を送った。',
        zh: '观众为他一如既往的精彩表演送上了热烈的掌声。',
        en: 'The audience gave a big round of applause for a performance as brilliant as ever.'
      }
    ]
  },
  gotoku: {
    form: 'Nの / V辞書形 / Vた形 + ごとく · Nの + ごとき + N · 〜ごとし（句末）',
    zh: '如前所述，这个计划有很多问题。',
    en: 'As I mentioned earlier, this plan has a lot of problems.',
    group: 'seem',
    more: [
      {
        ja: '彼は風のごとく走り去った。',
        zh: '他像一阵风似的跑走了。',
        en: 'He ran off like the wind.'
      },
      {
        ja: '私ごときに、そんな大役は務まりません。',
        zh: '像我这样的人，担不起那么重要的职务。',
        en: "Someone like me isn't up to such an important role."
      }
    ]
  },
  womonotomosezu: {
    form: 'N + をものともせず（に）',
    zh: '他们不顾倾盆大雨，向山顶进发。',
    en: 'Undaunted by the heavy rain, they pressed on toward the summit.',
    group: 'regardless',
    more: [
      {
        ja: '足のけがをものともせずに、彼は最後まで走り抜いた。',
        zh: '他不顾脚伤，坚持跑完了全程。',
        en: 'Despite his injured foot, he ran all the way to the finish.'
      },
      {
        ja: 'その会社は不景気をものともせず、売り上げを伸ばしている。',
        zh: '那家公司不畏经济不景气，销售额不断增长。',
        en: 'That company keeps growing its sales, undeterred by the recession.'
      }
    ]
  },
  woyosoni: {
    form: 'N + をよそに',
    zh: '儿子不顾父母的担心，每晚都玩到很晚。',
    en: "Ignoring his parents' worries, their son stays out late every night.",
    group: 'regardless',
    more: [
      {
        ja: '住民の反対をよそに、工事が始まった。',
        zh: '工程不顾居民的反对开工了。',
        en: "Construction began despite the residents' opposition."
      },
      {
        ja: '周りの騒ぎをよそに、猫は気持ちよさそうに寝ている。',
        zh: '猫对周围的吵闹充耳不闻，睡得正香。',
        en: 'Oblivious to all the commotion, the cat is sleeping peacefully.'
      }
    ]
  },
  wofumaete: {
    form: 'N + を踏まえて（を踏まえ · を踏まえた + N）',
    zh: '我们将根据问卷调查的结果改进服务。',
    en: 'We will improve our services based on the survey results.',
    group: 'basis',
    more: [
      {
        ja: '前回の反省を踏まえ、今年は早めに準備を始めた。',
        zh: '吸取上次的教训，今年提早开始了准备。',
        en: 'Learning from last time, we started preparing earlier this year.'
      },
      {
        ja: '現状を踏まえた上で、今後の方針を決めましょう。',
        zh: '在充分考虑现状的基础上，决定今后的方针吧。',
        en: "Let's decide on our future policy after taking the current situation into account."
      }
    ]
  },
  nisokushite: {
    form: 'N + に即して（に即した + N）',
    zh: '请按照规则公平地作出判断。',
    en: 'Please make a fair decision in accordance with the rules.',
    group: 'basis',
    more: [
      {
        ja: 'この教科書には、実際の会話に即した例文が多い。',
        zh: '这本教科书里有很多贴近实际会话的例句。',
        en: 'This textbook has many example sentences that reflect real conversation.'
      },
      {
        ja: '地域の実情に即して、支援の方法を考える必要がある。',
        zh: '有必要结合当地的实际情况来考虑支援的方式。',
        en: 'We need to plan our support in a way that fits local conditions.'
      }
    ]
  },
  nikakotsukete: {
    form: 'N + にかこつけて',
    zh: '他常常借工作之名出去旅行。',
    en: 'He often goes on trips under the pretext of work.',
    more: [
      {
        ja: '父は友人の誕生日にかこつけて、また飲みに行った。',
        zh: '爸爸借口朋友过生日，又出去喝酒了。',
        en: "My father used his friend's birthday as an excuse to go out drinking again."
      },
      {
        ja: '雨にかこつけて、今日の練習をさぼってしまった。',
        zh: '我借口下雨，逃掉了今天的练习。',
        en: "I used the rain as an excuse to skip today's practice."
      }
    ]
  },
  toaimatte: {
    form: 'N + と相まって · N + も相まって',
    zh: '再加上美丽的风景，那次旅行成了难忘的回忆。',
    en: 'Together with the beautiful scenery, it made the trip unforgettable.',
    group: 'along-with',
    more: [
      {
        ja: '好天も相まって、祭りには大勢の人が集まった。',
        zh: '再加上天气晴好，庙会上聚集了很多人。',
        en: 'Helped by the fine weather, a large crowd gathered for the festival.'
      },
      {
        ja: '彼の努力が才能と相まって、大きな成果を生んだ。',
        zh: '他的努力与才华相结合，取得了很大的成果。',
        en: 'His hard work, combined with his talent, produced great results.'
      }
    ]
  },
  wooite: {
    form: 'N + をおいて（ほかに〜ない）',
    zh: '能胜任这份工作的，除了他再没有别人。',
    en: "There's no one but him we can entrust this job to.",
    group: 'only',
    more: [
      {
        ja: '日本の伝統文化を学ぶなら、京都をおいてほかにない。',
        zh: '要学日本传统文化，非京都莫属。',
        en: 'If you want to study traditional Japanese culture, there is no place like Kyoto.'
      },
      {
        ja: '議長にふさわしい人は、山田さんをおいて他に考えられない。',
        zh: '适合当主席的人，除了山田先生，想不出别人。',
        en: "I can't think of anyone other than Mr. Yamada who would make a suitable chair."
      }
    ]
  },
  katagata: {
    form: 'N + かたがた',
    zh: '我来拜访您，顺便感谢您前几天的关照。',
    en: "I've come to pay my respects and to thank you for the other day.",
    group: 'on-the-way',
    more: [
      {
        ja: '上京かたがた、恩師のお宅を訪ねた。',
        zh: '借来东京的机会，顺便拜访了恩师的家。',
        en: 'While I was in Tokyo, I took the opportunity to visit my former teacher.'
      },
      {
        ja: '近くまで来たので、ご報告かたがたお邪魔しました。',
        zh: '正好到附近来，顺便来向您汇报一下。',
        en: 'I was in the neighborhood, so I dropped by to give you an update.'
      }
    ]
  },
  katawara: {
    form: 'V辞書形 / Nの + かたわら',
    zh: '他一边在公司上班，一边写小说。',
    en: 'He writes novels alongside his job at a company.',
    group: 'while',
    more: [
      {
        ja: '母は子育てのかたわら、通信教育で資格を取った。',
        zh: '母亲在养育孩子之余，通过函授课程取得了资格证书。',
        en: 'While raising her children, my mother earned a qualification through a correspondence course.'
      },
      {
        ja: '彼女は大学で教えるかたわら、翻訳の仕事もしている。',
        zh: '她在大学教书之余，还做翻译工作。',
        en: 'Besides teaching at a university, she also works as a translator.'
      }
    ]
  },
  gatera: {
    form: 'N / Vます形 + がてら（散歩がてら · 送りがてら）',
    zh: '我出去散散步，顺便买点面包。',
    en: "I'm going for a walk and will pick up some bread on the way.",
    group: 'on-the-way',
    more: [
      {
        ja: '駅まで送りがてら、少し話をしよう。',
        zh: '我送你去车站，顺便聊聊吧。',
        en: "I'll walk you to the station, and we can talk on the way."
      },
      {
        ja: '買い物がてら、新しくできたカフェをのぞいてみた。',
        zh: '去买东西的时候，顺便到新开的咖啡馆看了看。',
        en: 'While out shopping, I popped into the new café.'
      }
    ]
  },
  naradewa: {
    form: 'N + ならでは（の + N）',
    zh: '这种味道是老字号才有的。',
    en: 'This flavor is something only a long-established shop can offer.',
    group: 'only',
    more: [
      {
        ja: '海辺の町ならではの新鮮な魚料理を楽しんだ。',
        zh: '我们享用了海边小镇特有的新鲜鱼料理。',
        en: 'We enjoyed the kind of fresh fish dishes you only find in a seaside town.'
      },
      {
        ja: '手作りならではの温かみが感じられる。',
        zh: '能感受到手工制作特有的温度。',
        en: 'You can feel the warmth that only handmade things have.'
      }
    ]
  },
  narini: {
    form: 'N / いA / Vない形 + なりに（なりの + N）',
    zh: '孩子似乎也在用自己的方式为家里担心。',
    en: 'In his own childlike way, he seems to be worried about the family.',
    more: [
      {
        ja: '私なりの方法で、問題を解決してみます。',
        zh: '我会用我自己的方法试着解决问题。',
        en: "I'll try to solve the problem in my own way."
      },
      {
        ja: '狭いなりに、工夫すれば快適に暮らせる部屋だ。',
        zh: '房间虽小，只要花点心思，也能住得很舒服。',
        en: "It's small, but with a little ingenuity it's a room you can live in comfortably."
      }
    ]
  },
  zukume: {
    form: 'N + ずくめ',
    zh: '今年是好事连连的一年。',
    en: 'This year was full of good things.',
    group: 'only',
    more: [
      {
        ja: '彼はいつも黒ずくめの服を着ている。',
        zh: '他总是一身黑。',
        en: 'He always dresses all in black.'
      },
      {
        ja: '規則ずくめの生活に、少し疲れてしまった。',
        zh: '处处是规矩的生活让我有点累了。',
        en: "I've grown a bit tired of a life full of rules."
      }
    ]
  },
  meku: {
    form: 'N + めく（めいた + N · めいてくる）',
    zh: '他的话里带着几分讽刺的意味。',
    en: 'There was something faintly sarcastic about what he said.',
    group: 'seem',
    more: [
      {
        ja: '冗談めいた口調だったが、目は真剣だった。',
        zh: '语气像是在开玩笑，眼神却很认真。',
        en: 'His tone sounded like a joke, but his eyes were serious.'
      },
      {
        ja: '風が冷たくなり、すっかり冬めいてきた。',
        zh: '风变冷了，已经很有冬天的感觉了。',
        en: 'The wind has turned cold, and it really feels like winter now.'
      }
    ]
  },
  mamire: {
    form: 'N + まみれ',
    zh: '孩子们在公园里玩得满身是沙。',
    en: 'The children are playing in the park, covered in sand.',
    group: 'only',
    more: [
      {
        ja: '夏の工事現場では、誰もが汗まみれで働いていた。',
        zh: '夏天的工地上，每个人都汗流浃背地干着活。',
        en: 'At the construction site in summer, everyone was working drenched in sweat.'
      },
      {
        ja: '借金まみれの生活から、やっと抜け出せた。',
        zh: '终于摆脱了负债累累的生活。',
        en: "I've finally gotten out of a life buried in debt."
      }
    ]
  },
  jimiru: {
    form: 'N + じみる（じみた + N · じみている）',
    zh: '都这么大的人了，别说那种孩子气的话。',
    en: "You're a grown adult — don't say such childish things.",
    group: 'seem',
    more: [
      {
        ja: '彼の話は、どこか説教じみていて聞きたくない。',
        zh: '他的话总带着点说教的味道，我不想听。',
        en: "The way he talks sounds kind of preachy, so I don't want to listen."
      },
      {
        ja: 'そんな年寄りじみた服より、明るい色のほうが似合うよ。',
        zh: '比起那种老气的衣服，你更适合亮一点的颜色。',
        en: 'Brighter colors suit you better than such old-fashioned clothes.'
      }
    ]
  },
  yue: {
    form: 'N / 普通形 + ゆえ（に）· ゆえの + N · 普通形 + がゆえに',
    zh: '因为年轻而犯的错，谁都会有。',
    en: 'Everyone makes mistakes that come from being young.',
    group: 'reason',
    more: [
      {
        ja: '経験が浅いゆえに、判断を誤ることもある。',
        zh: '由于经验不足，有时也会判断失误。',
        en: 'With little experience, one may sometimes make the wrong call.'
      },
      {
        ja: '彼は正直であるがゆえに、損をすることが多い。',
        zh: '正因为他为人诚实，所以常常吃亏。',
        en: 'Precisely because he is honest, he often ends up losing out.'
      }
    ]
  },
  kotonashini: {
    form: 'V辞書形 + ことなしに · N + なしに',
    zh: '不付出努力，就得不到成功。',
    en: 'You cannot achieve success without making an effort.',
    group: 'without',
    more: [
      {
        ja: '彼は断りなしに、私のパソコンを使った。',
        zh: '他没打招呼就用了我的电脑。',
        en: 'He used my computer without asking.'
      },
      {
        ja: '人と関わることなしに、生きていくことはできない。',
        zh: '不与人打交道，人是活不下去的。',
        en: "You can't get through life without dealing with other people."
      }
    ]
  },
  toomoikiya: {
    form: '普通形 + と思いきや',
    zh: '原以为今天会放晴，没想到下午下起了雨。',
    en: 'I thought it would be sunny today, but it started raining in the afternoon.',
    group: 'as-soon-as',
    more: [
      {
        ja: 'もう帰ったかと思いきや、彼はまだ会社に残っていた。',
        zh: '原以为他已经回去了，没想到还留在公司。',
        en: 'I thought he had already gone home, but he was still at the office.'
      },
      {
        ja: '簡単な試験だと思いきや、最後の問題がとても難しかった。',
        zh: '原以为是很简单的考试，没想到最后一道题非常难。',
        en: 'I thought it would be an easy test, but the last question was really hard.'
      }
    ]
  },
  tokitara: {
    form: 'N + ときたら',
    zh: '说起我家儿子，一天到晚光打游戏。',
    en: 'That son of mine plays video games all day long.',
    group: 'topic',
    more: [
      {
        ja: 'この店のサービスときたら、本当にひどいものだ。',
        zh: '说起这家店的服务，真是糟透了。',
        en: 'The service at this shop is just terrible.'
      },
      {
        ja: '最近の天気ときたら、暑かったり寒かったりで困る。',
        zh: '说起最近的天气，忽冷忽热的，真让人头疼。',
        en: 'The weather lately is a real nuisance — hot one day, cold the next.'
      }
    ]
  },
  zujimai: {
    form: '買わない → 買わずじまい · する → せずじまい',
    zh: '旅行时太忙，结果到最后也没买成礼物。',
    en: 'I was so busy on the trip that I never got around to buying souvenirs.',
    group: 'outcome',
    more: [
      {
        ja: '彼が会社を辞めた理由は、結局分からずじまいだった。',
        zh: '他辞职的原因，最终还是没弄清楚。',
        en: 'In the end, we never found out why he quit the company.'
      },
      {
        ja: 'せっかく買った本も、忙しくて読まずじまいになりそうだ。',
        zh: '好不容易买来的书，太忙了，看来最后也读不成了。',
        en: "I'm so busy that it looks like I'll never get around to reading the book I bought."
      }
    ]
  }
}

const lessons: LessonSpec[] = [
  {
    id: 'n1-13',
    title: { zh: '名词后的词尾：全是、满是、像', en: 'Noun suffixes: full of, covered in, -like' },
    items: ['zukume', 'mamire', 'meku', 'jimiru']
  },
  {
    id: 'n1-16',
    title: { zh: '不必与只好', en: 'No need, and nothing for it but' },
    items: ['madademonai', 'nikoshitakotowanai', 'nihaoyobanai', 'madeda']
  },
  {
    id: 'n1-9',
    title: { zh: '同时与顺便', en: 'At the same time, and on the way' },
    items: ['gatera', 'katagata', 'katawara', 'nagarani']
  },
  {
    id: 'n1-10',
    title: { zh: '唯一、独有与相称', en: 'The only one, unique to, in its own way' },
    items: ['naradewa', 'wooite', 'narini']
  },
  {
    id: 'n1-8',
    title: { zh: '不顾与借口', en: 'Regardless, and under the pretext of' },
    items: ['woyosoni', 'womonotomosezu', 'nikakotsukete']
  },
  {
    id: 'n1-7',
    title: { zh: '根据与结合', en: 'Based on, in line with, combined with' },
    items: ['wofumaete', 'nisokushite', 'toaimatte']
  },
  {
    id: 'n1-14',
    title: { zh: '抱怨、倾向与结局', en: 'Complaints, tendencies and outcomes' },
    items: ['tokitara', 'kirai', 'shimatsu', 'zujimai']
  },
  {
    id: 'n1-15',
    title: { zh: '原因、条件与意外', en: 'Reasons, conditions and surprises' },
    items: ['yue', 'dewaarumaishi', 'kotonashini', 'toomoikiya']
  },
  {
    id: 'n1-18',
    title: { zh: '值得、不堪与难易', en: 'Worth it, unbearable, easy or impossible' },
    items: ['nitaru', 'nitaenai', 'nikatakunai', 'bekumonai']
  },
  {
    id: 'n1-17',
    title: { zh: '一定、必然与不得不', en: 'Certainly, inevitably, and forced to' },
    items: ['nisouinai', 'zuniwaokanai', 'woyoginakusareru']
  },
  {
    id: 'n1-19',
    title: { zh: '比喻：简直像……', en: 'Likenesses: as if' },
    items: ['gotoku', 'nbakari', 'tobakarini']
  },
  {
    id: 'n1-20',
    title: { zh: '文言的目的与禁止', en: 'Classical purpose and prohibition' },
    items: ['beku', 'ngatame', 'bekarazu', 'majiki']
  }
]

export const N1B_GRAMMAR: LevelGrammar = { points, notes, lessons }
