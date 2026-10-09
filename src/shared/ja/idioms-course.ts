/**
 * 日语的惯用语课：常用的惯用句（身体部位、「気」「心」、动物、身边的事物）、谚语、四字熟语，按主题分课。
 * 每条带整条的假名读音与中英意思，多数附一句字面意思或用法；写法、读音都对得上 JMdict 的同一个词条
 * （有词典数据库时 tests/idioms-course.test.ts 逐条核对）。朗读用系统日语语音。条目是手写的。
 */
import type { Course, CourseLesson, CourseUnit, PhraseItem, Text } from '../course'

/** 写法 | 读音 | 中文 | 英文 | 说明（可空：中文、英文） */
type Row = [string, string, string, string, string?, string?]

interface LessonSpec {
  id: string
  title: Text
  rows: Row[]
}

interface UnitSpec {
  id: string
  title: Text
  lessons: LessonSpec[]
}

const UNITS: UnitSpec[] = [
  {
    id: 'body',
    title: { zh: '身体部位的惯用句', en: 'Idioms with body parts' },
    lessons: [
      {
        id: 'hand',
        title: { zh: '手与胳膊', en: 'Hands and arms' },
        rows: [
          [
            '手を焼く',
            'てをやく',
            '很难对付；拿……没办法',
            'to have a hard time handling (someone or something)',
            '字面是「烫了手」，常说「〜に手を焼く」。',
            "Literally “burn one's hand”; usually 〜に手を焼く."
          ],
          [
            '手が離せない',
            'てがはなせない',
            '正忙着，腾不出手',
            'too busy to step away from what one is doing',
            '字面是「手离不开」。',
            "Literally “can't take one's hands off it”."
          ],
          [
            '手を貸す',
            'てをかす',
            '帮一把',
            'to give someone a hand',
            '受人帮忙说「手を借りる」。',
            'Getting help is 手を借りる.'
          ],
          [
            '手を抜く',
            'てをぬく',
            '偷工减料；敷衍了事',
            'to cut corners; to do a half-hearted job',
            '名词是「手抜き」。',
            'The noun is 手抜き.'
          ],
          [
            '手を打つ',
            'てをうつ',
            '想办法应对；采取对策',
            'to take action (to deal with a problem)',
            '也有「谈妥、成交」的意思。',
            'It can also mean “to close a deal”.'
          ],
          [
            '腕を磨く',
            'うでをみがく',
            '下功夫提高本领',
            "to hone one's skills",
            '「腕」在这里指本事、手艺。',
            'Here 腕 (arm) means skill.'
          ]
        ]
      },
      {
        id: 'leg',
        title: { zh: '脚与腰', en: 'Legs and back' },
        rows: [
          [
            '足を洗う',
            'あしをあらう',
            '洗手不干；不再干见不得人的营生',
            'to give up a shady way of life; to go straight',
            '字面是「洗脚」，中文说「洗手」。',
            "Literally “wash one's feet”."
          ],
          [
            '足が出る',
            'あしがでる',
            '开销超支；钱花超了',
            'to go over budget',
            '如「一万円足が出た」：超支了一万日元。',
            'E.g. 一万円足が出た, “went 10,000 yen over”.'
          ],
          [
            '足を引っ張る',
            'あしをひっぱる',
            '拖后腿；妨碍别人成事',
            'to drag others down; to hold the team back',
            '字面是「拽别人的腿」。',
            "Literally “pull someone's leg”, but nothing to do with teasing."
          ],
          [
            '足が棒になる',
            'あしがぼうになる',
            '腿累得发直、发酸',
            "one's legs are worn out (from walking or standing)",
            '字面是「腿变成了棍子」。',
            "Literally “one's legs turn into sticks”."
          ],
          [
            '二の足を踏む',
            'にのあしをふむ',
            '犹豫不决；迟迟不敢行动',
            'to hesitate; to have second thoughts',
            '字面是「第二步在原地踏着」。',
            'Literally “mark time on the second step”.'
          ],
          [
            '腰が低い',
            'こしがひくい',
            '谦恭；待人客气',
            'humble and polite toward others',
            '形容人的态度，是夸人的话。',
            "Describes someone's manner, as a compliment."
          ]
        ]
      },
      {
        id: 'mouth',
        title: { zh: '嘴与耳朵', en: 'Mouth and ears' },
        rows: [
          [
            '口が堅い',
            'くちがかたい',
            '嘴严，不乱说',
            'discreet; can be trusted with a secret',
            '反过来是「口が軽い」。',
            'The opposite is 口が軽い.'
          ],
          [
            '口が滑る',
            'くちがすべる',
            '一不留神说漏了嘴',
            "to blurt out something one shouldn't",
            '「滑る」是「打滑」。',
            '滑る means “to slip”.'
          ],
          [
            '口を挟む',
            'くちをはさむ',
            '别人说话时插嘴',
            'to butt in (on a conversation)',
            '「挟む」是「夹进去」。',
            '挟む means “to wedge in”.'
          ],
          [
            '口に合う',
            'くちにあう',
            '（饭菜）合胃口',
            "to be to one's taste",
            '请人吃东西时常说「お口に合うかどうか」。',
            'A host may say お口に合うかどうか, “I hope you like it”.'
          ],
          [
            '耳が痛い',
            'みみがいたい',
            '（批评）说到痛处，听着刺耳',
            'to hit a nerve (of criticism that is true)',
            '不是耳朵疼，而是被说中了缺点。',
            'Not an earache: someone has named a real fault of yours.'
          ],
          [
            '耳にたこができる',
            'みみにたこができる',
            '同样的话听得太多，听腻了',
            'to be sick of hearing the same thing',
            '「たこ」是茧子，不是章鱼。',
            'たこ here is a callus, not an octopus.'
          ]
        ]
      },
      {
        id: 'eye',
        title: { zh: '眼睛与鼻子', en: 'Eyes and nose' },
        rows: [
          [
            '目がない',
            'めがない',
            '特别喜欢，一见就忍不住',
            "to be crazy about; can't resist",
            '常说「甘いものに目がない」。',
            "E.g. 甘いものに目がない, “can't resist sweets”."
          ],
          [
            '目を通す',
            'めをとおす',
            '大致看一遍；过一下目',
            'to read through quickly; to skim',
            '多说文件、资料。',
            'Mostly of papers and documents.'
          ],
          [
            '目に余る',
            'めにあまる',
            '（行为）太过分，让人看不下去',
            'too much to overlook',
            '多指别人的坏行为。',
            "Usually about someone's bad behaviour."
          ],
          [
            '大目に見る',
            'おおめにみる',
            '宽容；不予追究',
            'to let something pass; to go easy on someone',
            '对小过错网开一面。',
            'Going easy on a small fault.'
          ],
          [
            '鼻が高い',
            'はながたかい',
            '感到骄傲；脸上有光',
            'to be proud (of someone or something)',
            '字面是「鼻子高」，也可以就指鼻梁高。',
            "Literally “one's nose is high”; it can also just mean a high nose."
          ],
          [
            '目と鼻の先',
            'めとはなのさき',
            '离得非常近',
            'just around the corner; very close by',
            '像眼睛和鼻子那么近。',
            'As close as your eyes are to your nose.'
          ]
        ]
      },
      {
        id: 'head',
        title: { zh: '头与脸', en: 'Head and face' },
        rows: [
          [
            '頭が固い',
            'あたまがかたい',
            '死脑筋；不知变通',
            "stubborn; set in one's ways",
            '反过来说「頭が柔らかい」。',
            'The opposite is 頭が柔らかい.'
          ],
          [
            '頭が下がる',
            'あたまがさがる',
            '由衷佩服',
            "to take one's hat off to (someone)",
            '对别人的努力、人品表示敬意。',
            "Said of someone's effort or character."
          ],
          [
            '頭を抱える',
            'あたまをかかえる',
            '发愁；不知如何是好',
            'to be at a loss over a problem',
            '字面是「抱着头」。',
            "Literally “hold one's head in one's hands”."
          ],
          [
            '顔が広い',
            'かおがひろい',
            '认识的人多，路子广',
            'to know a lot of people',
            '字面是「脸宽」。',
            "Literally “one's face is wide”."
          ],
          [
            '顔を出す',
            'かおをだす',
            '露个面；到场',
            'to show up; to drop in',
            '去聚会、活动等短暂出现一下也可以用。',
            'Also for a brief appearance at a party or event.'
          ],
          [
            '顔に泥を塗る',
            'かおにどろをぬる',
            '给人丢脸；给人抹黑',
            'to make someone lose face',
            '字面是「往脸上抹泥」。',
            "Literally “smear mud on someone's face”."
          ]
        ]
      },
      {
        id: 'trunk',
        title: { zh: '肚子、脖子、肩膀与骨头', en: 'Belly, neck, shoulders and bones' },
        rows: [
          [
            '腹が立つ',
            'はらがたつ',
            '生气；恼火',
            'to be angry; to be annoyed',
            '「腹」在这里指内心。',
            "Here 腹 (belly) stands for one's feelings."
          ],
          [
            '腹を割る',
            'はらをわる',
            '推心置腹；敞开心扉',
            'to speak frankly; to open up',
            '常说「腹を割って話す」。',
            'Often 腹を割って話す, “have a heart-to-heart talk”.'
          ],
          [
            '首を長くする',
            'くびをながくする',
            '眼巴巴地盼着',
            'to wait impatiently; to long for',
            '常说「首を長くして待つ」。',
            'Usually 首を長くして待つ.'
          ],
          [
            '首をかしげる',
            'くびをかしげる',
            '纳闷；觉得可疑',
            'to be puzzled; to have doubts',
            '字面是「歪着头」。',
            "Literally “tilt one's head”."
          ],
          [
            '肩を持つ',
            'かたをもつ',
            '偏袒；替某人说话',
            "to take someone's side",
            '常说「〜の肩を持つ」。',
            'Usually 〜の肩を持つ.'
          ],
          [
            '骨が折れる',
            'ほねがおれる',
            '很费劲；很不容易',
            'to take a lot of effort; to be hard work',
            '不是骨折，是「费力气」。',
            'Not a broken bone: it means “laborious”.'
          ]
        ]
      }
    ]
  },
  {
    id: 'heart',
    title: { zh: '「気」「心」与其他', en: 'Ki, kokoro and more' },
    lessons: [
      {
        id: 'ki1',
        title: { zh: '「気」：性格与相处', en: 'Ki: temperament and getting along' },
        rows: [
          [
            '気が合う',
            'きがあう',
            '合得来；投缘',
            'to get along well; to hit it off',
            '「気」在这里指性情、心思。',
            'Here 気 means temperament or mind.'
          ],
          [
            '気が置けない',
            'きがおけない',
            '相处起来很自在，不必客气',
            'so close that one can relax and be oneself',
            '常被误解为「不能放心」，其实是夸人的话。',
            "Often misread as “can't be trusted”; it is actually praise."
          ],
          [
            '気が短い',
            'きがみじかい',
            '急脾气；容易发火',
            'short-tempered; impatient',
            '反过来是「気が長い」。',
            'The opposite is 気が長い.'
          ],
          [
            '気が長い',
            'きがながい',
            '慢性子；很有耐心',
            'patient; unhurried',
            '「気の長い話」是要很久才见分晓的事。',
            '気の長い話 is something that will take ages.'
          ],
          [
            '気が小さい',
            'きがちいさい',
            '胆子小；遇事爱担心',
            'timid; easily worried',
            '跟中文的「小气」不同，不是吝啬。',
            'It does not mean stingy, as Chinese 小气 might suggest.'
          ],
          [
            '気が強い',
            'きがつよい',
            '要强；不服软',
            'assertive; not easily intimidated',
            '多说不轻易让步的人。',
            "Said of someone who doesn't back down easily."
          ],
          [
            '気が利く',
            'きがきく',
            '有眼力见儿，会主动照顾别人',
            'quick to notice what others need',
            '夸人常用。',
            'A common compliment.'
          ]
        ]
      },
      {
        id: 'ki2',
        title: { zh: '「気」：心情', en: 'Ki: mood' },
        rows: [
          [
            '気が重い',
            'きがおもい',
            '心里沉甸甸的，打不起精神',
            'to feel weighed down (by something one has to do)',
            '想到不得不做的讨厌事时说。',
            'Said when facing something unpleasant one must do.'
          ],
          [
            '気が散る',
            'きがちる',
            '注意力集中不了',
            'to be distracted; to lose focus',
            '「散る」是「散开」。',
            '散る means “to scatter”.'
          ],
          [
            '気が済む',
            'きがすむ',
            '（做到了）才甘心；心里舒坦了',
            'to feel content once something is done',
            '常说「気が済むまで」：直到满意为止。',
            '気が済むまで: “until one is satisfied”.'
          ],
          [
            '気が気でない',
            'きがきでない',
            '急得不得了，心里七上八下',
            'to be on pins and needles',
            '担心得什么都做不下去。',
            'Too worried to think of anything else.'
          ],
          [
            '気が向く',
            'きがむく',
            '来了兴致，想做',
            'to be in the mood (to do something)',
            '常说「気が向いたら」：有兴致的话。',
            '気が向いたら: “if I feel like it”.'
          ],
          [
            '気が抜ける',
            'きがぬける',
            '泄了劲；松懈下来',
            "to lose one's drive; to go slack",
            '汽水没气了也说「気が抜ける」。',
            'Also said of a fizzy drink going flat.'
          ]
        ]
      },
      {
        id: 'ki3',
        title: { zh: '「気を…」「気に…」', en: '気を… and 気に…' },
        rows: [
          [
            '気を遣う',
            'きをつかう',
            '顾虑别人；处处客气',
            'to be careful not to trouble or upset others',
            '「お気遣いなく」是「请别费心」。',
            "お気遣いなく means “please don't trouble yourself”."
          ],
          [
            '気を失う',
            'きをうしなう',
            '昏过去；失去知觉',
            'to faint; to pass out',
            '「気」在这里指意识。',
            'Here 気 means consciousness.'
          ],
          [
            '気を落とす',
            'きをおとす',
            '泄气；失望',
            'to lose heart; to feel let down',
            '安慰人时说「気を落とさないで」。',
            'To comfort someone: 気を落とさないで.'
          ],
          [
            '気を取り直す',
            'きをとりなおす',
            '（失落后）重新打起精神',
            "to bounce back; to regain one's spirits",
            '常说「気を取り直して、もう一度」。',
            'E.g. 気を取り直して、もう一度, “pick yourself up and try again”.'
          ],
          [
            '気を引き締める',
            'きをひきしめる',
            '提高警惕；不敢松懈',
            "to stay alert and not let one's guard down",
            '致辞、表决心时常用。',
            'Common in speeches and pledges.'
          ],
          [
            '気に障る',
            'きにさわる',
            '惹人不快；让人不舒服',
            "to offend; to get on someone's nerves",
            '道歉时说「気に障ったらごめん」。',
            'Apologizing: 気に障ったらごめん, “sorry if that upset you”.'
          ]
        ]
      },
      {
        id: 'kokoro',
        title: { zh: '「心」与「胸」', en: 'Heart and chest' },
        rows: [
          [
            '心を打つ',
            'こころをうつ',
            '让人深受感动',
            'to be deeply moving',
            '也说「胸を打つ」。',
            '胸を打つ means the same.'
          ],
          [
            '心を込める',
            'こころをこめる',
            '用心；倾注心意',
            'to do something with care and feeling',
            '常说「心を込めて作る」。',
            'E.g. 心を込めて作る, “make with love”.'
          ],
          [
            '心を鬼にする',
            'こころをおににする',
            '（为对方好）故意严厉',
            'to be tough on someone for their own good',
            '字面是「把心变成恶鬼」。',
            "Literally “turn one's heart into an ogre”."
          ],
          [
            '胸がいっぱいになる',
            'むねがいっぱいになる',
            '（激动得）心里满满的；百感交集',
            'to be overcome with emotion',
            '感动、高兴、难过都可以用。',
            'For joy, gratitude or sadness alike.'
          ],
          [
            '胸をなで下ろす',
            'むねをなでおろす',
            '总算放下心来',
            'to breathe a sigh of relief',
            '字面是「抚着胸口」。',
            "Literally “stroke one's chest”."
          ],
          [
            '胸を張る',
            'むねをはる',
            '理直气壮；昂首挺胸',
            "to hold one's head high",
            '有自信、问心无愧时用。',
            'For being confident and unashamed.'
          ]
        ]
      },
      {
        id: 'animal',
        title: { zh: '动物', en: 'Animals' },
        rows: [
          [
            '猫の手も借りたい',
            'ねこのてもかりたい',
            '忙得要命，人手不够',
            'so busy one would take any help',
            '字面是「猫的手也想借来用」。',
            "Literally “I'd even borrow the cat's paws”."
          ],
          [
            '猫の額',
            'ねこのひたい',
            '（地方）巴掌大',
            'a tiny patch (of land)',
            '字面是「猫的额头」，多说院子、土地。',
            "Literally “a cat's forehead”; said of a yard or plot."
          ],
          [
            '猫をかぶる',
            'ねこをかぶる',
            '收起本性装乖',
            "to hide one's true nature; to act all sweet",
            '在生人、长辈面前装老实。',
            'Acting meek in front of strangers or superiors.'
          ],
          [
            '犬猿の仲',
            'けんえんのなか',
            '关系很差，一见面就吵',
            "constantly at odds; can't stand each other",
            '字面是「狗和猴子的关系」。',
            'Literally “the relationship of dog and monkey”.'
          ],
          [
            '鶴の一声',
            'つるのひとこえ',
            '上面发话，一句定局',
            'a decision from the top that settles everything',
            '大家争不下时，有权威的人一句话就定了。',
            'One word from someone in charge ends a long argument.'
          ],
          [
            '雀の涙',
            'すずめのなみだ',
            '少得可怜',
            'a tiny, almost laughable amount',
            '多说钱，如「雀の涙ほどの給料」。',
            'Often of money: 雀の涙ほどの給料.'
          ]
        ]
      },
      {
        id: 'things',
        title: { zh: '身边的事物', en: 'Everyday things' },
        rows: [
          [
            '油を売る',
            'あぶらをうる',
            '（该干活时）闲聊磨洋工',
            'to slack off chatting (when one should be working)',
            '字面是「卖油」。',
            'Literally “sell oil”.'
          ],
          [
            '水に流す',
            'みずにながす',
            '过去的事就算了，不再计较',
            'to put the past behind you and forgive',
            '字面是「让水冲走」。',
            'Literally “let the water carry it away”.'
          ],
          [
            '根に持つ',
            'ねにもつ',
            '记仇；一直放在心上',
            'to bear a grudge for a long time',
            '反过来是「水に流す」。',
            'The opposite of 水に流す.'
          ],
          [
            '棚に上げる',
            'たなにあげる',
            '（对自己的问题）避而不谈',
            "to conveniently ignore (one's own faults)",
            '常说「自分のことは棚に上げて」。',
            'Often 自分のことは棚に上げて.'
          ],
          [
            '釘を刺す',
            'くぎをさす',
            '事先叮嘱；打预防针',
            "to warn someone in advance (so they won't do it)",
            '字面是「钉上钉子」。',
            'Literally “drive in a nail”.'
          ],
          [
            '太鼓判を押す',
            'たいこばんをおす',
            '打包票；完全保证',
            "to give one's full guarantee",
            '「太鼓判」是大印章。',
            '太鼓判 is a big seal stamp.'
          ]
        ]
      }
    ]
  },
  {
    id: 'proverb',
    title: { zh: '谚语', en: 'Proverbs' },
    lessons: [
      {
        id: 'effort',
        title: { zh: '努力与坚持', en: 'Effort and persistence' },
        rows: [
          [
            'ちりも積もれば山となる',
            'ちりもつもればやまとなる',
            '一点一滴，积少成多',
            'little things add up',
            '字面是「尘土积多了也能成山」。',
            'Literally “even dust piles up into a mountain”.'
          ],
          [
            '石の上にも三年',
            'いしのうえにもさんねん',
            '坚持下去总会有回报',
            'patience pays off in the end',
            '在冰凉的石头上坐三年，石头也会变暖。',
            'Sit on a cold stone for three years and even it warms up.'
          ],
          [
            '千里の道も一歩から',
            'せんりのみちもいっぽから',
            '再远的路也要从第一步走起',
            'even the longest journey starts with one step',
            '出自《老子》「千里之行，始于足下」。',
            'From the Laozi.'
          ],
          [
            '七転び八起き',
            'ななころびやおき',
            '百折不挠',
            'never giving up, however often one fails',
            '字面是「摔倒七次，爬起来八次」。',
            'Literally “fall seven times, get up eight”.'
          ],
          [
            '急がば回れ',
            'いそがばまわれ',
            '越是着急，越要走稳妥的路',
            'the safe way round is quicker in the end',
            '字面是「急的话就绕远路」。',
            "Literally “if you're in a hurry, go the long way round”."
          ],
          [
            '好きこそものの上手なれ',
            'すきこそもののじょうずなれ',
            '兴趣是最好的老师',
            'loving something is the best way to master it',
            '有兴趣自然肯下功夫。',
            'Loving something makes you put in the work.'
          ]
        ]
      },
      {
        id: 'caution',
        title: { zh: '失误与谨慎', en: 'Mistakes and caution' },
        rows: [
          [
            '猿も木から落ちる',
            'さるもきからおちる',
            '高手也有失手的时候',
            'even experts make mistakes',
            '字面是「猴子也会从树上掉下来」。',
            'Literally “even monkeys fall from trees”.'
          ],
          [
            '石橋を叩いて渡る',
            'いしばしをたたいてわたる',
            '小心再小心',
            'to be extremely careful',
            '字面是「敲一敲石桥再过」。',
            'Literally “tap a stone bridge before crossing it”.'
          ],
          [
            '備えあれば憂いなし',
            'そなえあればうれいなし',
            '有备无患',
            'be prepared and you have nothing to fear',
            '防灾宣传里常见。',
            'Common in disaster-preparedness campaigns.'
          ],
          [
            '後悔先に立たず',
            'こうかいさきにたたず',
            '事后后悔也来不及',
            'regret always comes too late',
            '劝人事先想清楚。',
            'A reminder to think before acting.'
          ],
          [
            '失敗は成功のもと',
            'しっぱいはせいこうのもと',
            '失败是成功之母',
            'every failure brings you closer to success',
            '也说「失敗は成功の母」。',
            'Also 失敗は成功の母.'
          ],
          [
            '口は災いの元',
            'くちはわざわいのもと',
            '祸从口出',
            'careless words bring trouble',
            '提醒人说话要小心。',
            "A reminder to watch one's words."
          ]
        ]
      },
      {
        id: 'people',
        title: { zh: '与人相处', en: 'Getting along with others' },
        rows: [
          [
            '類は友を呼ぶ',
            'るいはともをよぶ',
            '物以类聚，人以群分',
            'like-minded people find each other',
            '「類」是同一类的人。',
            "類 means “one's own kind”."
          ],
          [
            '郷に入っては郷に従え',
            'ごうにいってはごうにしたがえ',
            '入乡随俗',
            'follow local customs wherever you are',
            '也说「郷に入れば郷に従え」。',
            'Also 郷に入れば郷に従え.'
          ],
          [
            '情けは人のためならず',
            'なさけはひとのためならず',
            '善待别人，好处终会回到自己身上',
            'kindness to others comes back to you',
            '常被误解为「同情别人反而害了他」。',
            'Often misread as “kindness spoils people”.'
          ],
          [
            '親しき仲にも礼儀あり',
            'したしきなかにもれいぎあり',
            '再亲近也要讲礼貌',
            'even close friends need manners',
            '关系好也不能太随便。',
            'Being close is no excuse for rudeness.'
          ],
          [
            '人のふり見て我がふり直せ',
            'ひとのふりみてわがふりなおせ',
            '看到别人的毛病，就反省自己',
            "learn from others' faults and fix your own",
            '「ふり」是举止。',
            'ふり means behaviour.'
          ],
          [
            '出る杭は打たれる',
            'でるくいはうたれる',
            '枪打出头鸟',
            'those who stand out get knocked down',
            '字面是「冒头的桩子会挨敲」。',
            'Literally “the stake that sticks out gets hammered”.'
          ],
          [
            '三人寄れば文殊の知恵',
            'さんにんよればもんじゅのちえ',
            '三个臭皮匠，顶个诸葛亮',
            "put heads together and you'll find a way",
            '文殊是象征智慧的菩萨。',
            'Monju is the bodhisattva of wisdom.'
          ]
        ]
      },
      {
        id: 'animals',
        title: { zh: '动物谚语', en: 'Animal proverbs' },
        rows: [
          [
            '猫に小判',
            'ねこにこばん',
            '好东西给了不识货的人',
            "wasted on someone who can't appreciate it",
            '字面是「给猫金币」。',
            'Literally “gold coins to a cat”.'
          ],
          [
            '犬も歩けば棒に当たる',
            'いぬもあるけばぼうにあたる',
            '出去走动，会碰上意想不到的事',
            'get out and about, and something unexpected may happen',
            '原意是多事招祸，现在多指碰上好运。',
            'Once a warning against meddling; now usually about luck.'
          ],
          [
            '井の中の蛙',
            'いのなかのかわず',
            '井底之蛙',
            'someone with a narrow view of the world',
            '后面常接「大海を知らず」。',
            'Often followed by 大海を知らず, “knows nothing of the sea”.'
          ],
          [
            '二兎を追う者は一兎をも得ず',
            'にとをおうものはいっとをもえず',
            '贪多反而一无所得',
            "aim at two things at once and you'll miss both",
            '字面是「追两只兔子，一只也抓不到」。',
            "Literally “chase two rabbits and you won't catch even one”."
          ],
          [
            '能ある鷹は爪を隠す',
            'のうあるたかはつめをかくす',
            '真人不露相',
            "truly able people don't show off",
            '字面是「有本事的鹰把爪子藏起来」。',
            'Literally “a capable hawk hides its talons”.'
          ],
          [
            '蛙の子は蛙',
            'かえるのこはかえる',
            '孩子总是随父母',
            'children take after their parents',
            '字面是「青蛙的孩子还是青蛙」。',
            "Literally “a frog's child is a frog”."
          ]
        ]
      },
      {
        id: 'life',
        title: { zh: '运气与道理', en: 'Luck and life lessons' },
        rows: [
          [
            '早起きは三文の徳',
            'はやおきはさんもんのとく',
            '早起总能多得些好处',
            'getting up early pays off',
            '「三文」是一点点钱。',
            '三文 is a tiny sum of money.'
          ],
          [
            '棚からぼた餅',
            'たなからぼたもち',
            '天上掉馅饼',
            'good luck that falls into your lap',
            '字面是「架子上掉下来一块豆沙米糕」，常简称「棚ぼた」。',
            'Literally “a sweet rice cake falls off the shelf”; often shortened to 棚ぼた.'
          ],
          [
            '泣きっ面に蜂',
            'なきっつらにはち',
            '倒霉事一件接一件',
            'bad luck piling on bad luck',
            '字面是「哭着的脸又被蜂蜇」。',
            'Literally “a bee sting on a crying face”.'
          ],
          [
            '百聞は一見にしかず',
            'ひゃくぶんはいっけんにしかず',
            '百闻不如一见',
            'seeing once beats hearing a hundred times',
            '「しかず」是「比不上」。',
            'しかず means “is no match for”.'
          ],
          [
            '灯台下暗し',
            'とうだいもとくらし',
            '越近的东西越容易看漏',
            'we often overlook what is closest to us',
            '「灯台」是旧式的灯架，不是灯塔。',
            '灯台 here is an old-style lamp stand, not a lighthouse.'
          ],
          [
            '良薬は口に苦し',
            'りょうやくはくちににがし',
            '逆耳的话往往对自己有益',
            'honest advice can be hard to swallow',
            '字面是「好药吃起来苦」。',
            'Literally “good medicine tastes bitter”.'
          ],
          [
            '花より団子',
            'はなよりだんご',
            '重实惠不重风雅',
            'substance over style',
            '赏花时比起花，更惦记团子。',
            'At a blossom-viewing party, caring more for the dumplings than the flowers.'
          ]
        ]
      }
    ]
  },
  {
    id: 'yoji',
    title: { zh: '四字熟语', en: 'Four-character idioms' },
    lessons: [
      {
        id: 'num1',
        title: { zh: '带数字的（一）', en: 'With numbers (1)' },
        rows: [
          [
            '一石二鳥',
            'いっせきにちょう',
            '一举两得',
            'two gains from a single action',
            '同义的还有「一挙両得」。',
            'Like “kill two birds with one stone”; 一挙両得 means the same.'
          ],
          [
            '一期一会',
            'いちごいちえ',
            '每次相遇都可能是唯一的一次，要珍惜',
            'treasure each meeting, for it may never come again',
            '源自茶道。',
            'From the tea ceremony.'
          ],
          [
            '一長一短',
            'いっちょういったん',
            '各有优缺点',
            'having both strengths and weaknesses',
            '多用来比较几种做法。',
            'Often used when comparing options.'
          ],
          [
            '一朝一夕',
            'いっちょういっせき',
            '一两天之内；很短的时间（多接否定）',
            'overnight; in a short time (usually with a negative)',
            '常说「一朝一夕にはできない」。',
            "Usually 一朝一夕にはできない, “can't be done overnight”."
          ],
          [
            '一進一退',
            'いっしんいったい',
            '进进退退，没有明显进展',
            'seesawing; one step forward, one step back',
            '比赛、病情、谈判都可以用。',
            'For games, illnesses, negotiations and so on.'
          ],
          [
            '一喜一憂',
            'いっきいちゆう',
            '一会儿高兴一会儿发愁',
            'to be happy one moment and worried the next',
            '常说「結果に一喜一憂しない」。',
            'Often 結果に一喜一憂しない, “not getting worked up over every result”.'
          ]
        ]
      },
      {
        id: 'num2',
        title: { zh: '带数字的（二）', en: 'With numbers (2)' },
        rows: [
          [
            '十人十色',
            'じゅうにんといろ',
            '每个人的想法、喜好都不一样',
            'to each their own',
            '「十色」读「といろ」。',
            '十色 is read といろ.'
          ],
          [
            '四苦八苦',
            'しくはっく',
            '吃尽苦头；费尽力气',
            'to struggle hard; to go through great trouble',
            '原是佛教用语，指人生的种种苦。',
            "Originally a Buddhist term for life's many sufferings."
          ],
          [
            '八方美人',
            'はっぽうびじん',
            '谁也不想得罪、处处讨好的人',
            'someone who tries to please everyone',
            '不是说美女，多带贬义。',
            'Not about beauty; usually critical.'
          ],
          [
            '三日坊主',
            'みっかぼうず',
            '三天打鱼两天晒网；做事没长性',
            'someone who gives up on things after a few days',
            '字面是「只当了三天和尚」。',
            'Literally “a monk for three days”.'
          ],
          [
            '十中八九',
            'じっちゅうはっく',
            '十有八九；多半',
            'almost certainly; in all likelihood',
            '也读「じゅっちゅうはっく」。',
            'Also read じゅっちゅうはっく.'
          ],
          [
            '千載一遇',
            'せんざいいちぐう',
            '千载难逢',
            'a chance that comes once in a thousand years',
            '常说「千載一遇のチャンス」。',
            'Usually 千載一遇のチャンス.'
          ],
          ['半信半疑', 'はんしんはんぎ', '有点信，又有点怀疑', 'half believing, half doubting']
        ]
      },
      {
        id: 'character',
        title: { zh: '性格与态度', en: 'Character and attitude' },
        rows: [
          [
            '優柔不断',
            'ゆうじゅうふだん',
            '拿不定主意；犹犹豫豫',
            "unable to make up one's mind",
            '形容人时是贬义。',
            'Critical when said of a person.'
          ],
          [
            '自画自賛',
            'じがじさん',
            '自己夸自己',
            "blowing one's own trumpet",
            '字面是「在自己的画上自己题赞」。',
            "Literally “writing praise on one's own painting”."
          ],
          [
            '臨機応変',
            'りんきおうへん',
            '看情况灵活应对',
            'flexibly, as the situation demands',
            '常说「臨機応変に対応する」。',
            'Often 臨機応変に対応する, “handle things flexibly”.'
          ],
          [
            '単刀直入',
            'たんとうちょくにゅう',
            '不绕弯子，直奔主题',
            'without beating around the bush',
            '常说「単刀直入に言うと」。',
            'Often 単刀直入に言うと, “to put it bluntly”.'
          ],
          [
            '大器晩成',
            'たいきばんせい',
            '有大才的人往往成功得晚',
            'the greatest talents are often late bloomers',
            '常用来鼓励还没出成绩的人。',
            "Often said to encourage someone who hasn't made it yet."
          ],
          [
            '傍若無人',
            'ぼうじゃくぶじん',
            '不顾周围的人，想怎样就怎样',
            'behaving with no regard for those around',
            '字面是「旁边好像没有人」，是贬义。',
            'Literally “as if no one were nearby”; critical.'
          ]
        ]
      },
      {
        id: 'resolve',
        title: { zh: '努力与决心', en: 'Effort and resolve' },
        rows: [
          [
            '試行錯誤',
            'しこうさくご',
            '反复摸索；不断试错',
            'trial and error',
            '常说「試行錯誤を重ねる」。',
            'Often 試行錯誤を重ねる, “go through much trial and error”.'
          ],
          [
            '切磋琢磨',
            'せっさたくま',
            '彼此较劲，互相促进',
            'to push each other to improve',
            '多说同伴、对手之间。',
            'Usually between friends or rivals.'
          ],
          [
            '初志貫徹',
            'しょしかんてつ',
            '坚持最初的志向到底',
            "to see one's original goal through",
            '「初志」是最初的志向。',
            "初志 is one's original aim."
          ],
          [
            '心機一転',
            'しんきいってん',
            '转换心情，从头再来',
            'to make a fresh start',
            '新年、换了环境时常说。',
            'Common at New Year or after a change of scene.'
          ],
          [
            '無我夢中',
            'むがむちゅう',
            '拼命投入，顾不上别的',
            'so caught up that one forgets everything else',
            '「無我」是忘了自己。',
            '無我 means “forgetting oneself”.'
          ],
          [
            '不眠不休',
            'ふみんふきゅう',
            '不睡觉也不休息地（干）',
            'working around the clock',
            '常说「不眠不休で働く」。',
            'Often 不眠不休で働く.'
          ]
        ]
      },
      {
        id: 'situation',
        title: { zh: '处境与局面', en: 'Situations' },
        rows: [
          [
            '絶体絶命',
            'ぜったいぜつめい',
            '已经无路可退的危急处境',
            'in a desperate, hopeless situation',
            '注意不写成「絶対」。',
            'Note: not written with 絶対.'
          ],
          [
            '五里霧中',
            'ごりむちゅう',
            '毫无头绪；一头雾水',
            'groping in the dark; with no idea how to proceed',
            '像在五里大雾里，辨不清方向。',
            'Like being lost in a thick fog.'
          ],
          [
            '前代未聞',
            'ぜんだいみもん',
            '从来没听说过的（事）',
            'never before seen or heard of',
            '「聞」在这里读「もん」。',
            '聞 is read もん here.'
          ],
          [
            '本末転倒',
            'ほんまつてんとう',
            '主次颠倒',
            "getting one's priorities backwards",
            '把次要的事当成了主要的。',
            'Treating the minor thing as if it were the main one.'
          ],
          [
            '賛否両論',
            'さんぴりょうろん',
            '赞成的、反对的都有',
            'opinions are divided',
            '新闻里常见。',
            'Common in the news.'
          ],
          [
            '時期尚早',
            'じきしょうそう',
            '时候还没到；现在做还太早',
            'too soon (to do it)',
            '「尚早」是「还早」。',
            '尚早 means “still too early”.'
          ],
          [
            '紆余曲折',
            'うよきょくせつ',
            '几经波折',
            'a long, winding road (to the result)',
            '常说「紆余曲折を経て」。',
            'Often 紆余曲折を経て, “after many twists and turns”.'
          ]
        ]
      }
    ]
  }
]

/** 惯用语这门课 */
export function jaIdiomsCourse(): Course {
  const phrases: Record<string, PhraseItem> = {}
  const units: CourseUnit[] = UNITS.map((u) => ({
    id: u.id,
    title: u.title,
    test: true,
    lessons: u.lessons.map((l): CourseLesson => {
      const items = l.rows.map(([text, reading, zh, en, noteZh, noteEn], i) => {
        const key = `${u.id}-${l.id}-${i + 1}`
        phrases[key] = {
          key,
          text,
          ...(reading !== text && { reading }),
          meaning: { zh, en },
          say: { text: reading, lang: 'ja-JP' },
          ...(noteZh && { note: { zh: noteZh, en: noteEn ?? noteZh } })
        }
        return key
      })
      return { id: `${u.id}-${l.id}`, title: l.title, items }
    })
  }))
  return {
    id: 'idioms',
    kind: 'phrases',
    title: { zh: '惯用语', en: 'Idioms' },
    intro: {
      zh: '常用的惯用句、谚语和四字熟语，按身体部位和主题分课：先听、看读音和意思，再做看短语选意思、看意思选短语、听音选短语的练习。',
      en: 'Common idioms, proverbs and four-character compounds, grouped by body part and theme: listen and read them with their meanings, then practise matching phrases, meanings and sounds.'
    },
    units,
    symbols: {},
    grammar: {},
    docs: {},
    phrases
  }
}
