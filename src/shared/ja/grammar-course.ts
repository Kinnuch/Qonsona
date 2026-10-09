/**
 * 日语的语法课：N5 到 N1 的语法点按等级分单元、按主题分课。
 * 每个语法点加上接续（用日语教材通行的 Vて形、普通形 这类写法，或者直接给变形的例子）、
 * 自带例句的中英翻译、意思相近的一组（出题时不拿同组的互相当干扰项）；N3 起每个语法点另有自己写的例句。
 * N5、N4 的写在这里，N3、N2、N1 的跟语法点写在一起（grammar-n3.ts …）。
 * 另外的例句从 Tatoeba 里按语法点挑（scripts/data/examples-ja.ts → data/ja/grammar-examples.json）。
 */
import type { Course, CourseLesson, CourseUnit, GrammarExample, GrammarItem, Text } from '../course'
import { GRAMMAR_BY_ID } from './grammar'
import type { GrammarNote, LessonSpec } from './grammar-def'
import { N3, N2, N1 } from './grammar-levels'

/** N5、N4 的接续、例句翻译、同组 */
const BASIC_NOTES: Record<string, GrammarNote> = {
  // ── N5 ──
  masu: {
    form: '行く → 行きます · 食べる → 食べます · する → します · 来る → 来ます',
    zh: '我每天早上喝咖啡。',
    en: 'I drink coffee every morning.'
  },
  masen: { form: 'Vます形 + ません', zh: '我不吃肉。', en: "I don't eat meat." },
  mashita: { form: 'Vます形 + ました', zh: '我昨天看了电影。', en: 'I saw a movie yesterday.' },
  mashou: {
    form: 'Vます形 + ましょう',
    zh: '一起回去吧。',
    en: "Let's go home together.",
    group: 'invite'
  },
  mashouka: {
    form: 'Vます形 + ましょうか',
    zh: '我来开窗吧？',
    en: 'Shall I open the window?',
    group: 'invite'
  },
  masenka: {
    form: 'Vます形 + ませんか',
    zh: '周末要不要一起去看电影？',
    en: 'Would you like to go and see a movie this weekend?',
    group: 'invite'
  },
  desu: {
    form: 'N / なA / いA + です（学生です · 静かです · 高いです）',
    zh: '我是学生。',
    en: 'I am a student.'
  },
  deshita: {
    form: 'N / なA + でした（雨でした · 静かでした）',
    zh: '昨天下雨了。',
    en: 'It was rainy yesterday.'
  },
  nai: {
    form: '行く → 行かない · 食べる → 食べない · する → しない · 来る → 来ない',
    zh: '今天不去学校。',
    en: "I'm not going to school today."
  },
  ta: {
    form: '行く → 行った · 食べる → 食べた · する → した · 来る → 来た',
    zh: '昨天看了书。',
    en: 'I read a book yesterday.'
  },
  te: {
    form: '行く → 行って · 食べる → 食べて · する → して · 来る → 来て',
    zh: '早上起床，然后洗脸。',
    en: 'I get up in the morning and wash my face.'
  },
  teiru: { form: 'Vて形 + いる', zh: '现在正在下雨。', en: 'It is raining now.' },
  tekudasai: {
    form: 'Vて形 + ください',
    zh: '请在这里写上名字。',
    en: 'Please write your name here.',
    group: 'want'
  },
  tekara: {
    form: 'Vて形 + から',
    zh: '洗了手再吃饭。',
    en: 'I wash my hands, and then I eat.',
    group: 'after'
  },
  temoii: { form: 'Vて形 + もいい', zh: '可以拍照吗？', en: 'May I take a photo?' },
  tewaikenai: {
    form: 'Vて形 + はいけない',
    zh: '这里不许吸烟。',
    en: 'You must not smoke here.',
    group: 'should'
  },
  naidekudasai: {
    form: 'Vない形 + でください',
    zh: '请不要在这里拍照。',
    en: "Please don't take photos here."
  },
  tai: {
    form: 'Vます形 + たい（飲みたい）',
    zh: '我想去日本。',
    en: 'I want to go to Japan.',
    group: 'want'
  },
  hoshii: {
    form: 'N + がほしい',
    zh: '我想要一台新电脑。',
    en: 'I want a new computer.',
    group: 'want'
  },
  takotogaaru: {
    form: 'Vた形 + ことがある',
    zh: '我爬过富士山。',
    en: 'I have climbed Mt. Fuji.'
  },
  tari: {
    form: 'Vた形 + り、Vた形 + り + する',
    zh: '休息日我看看书、看看电影什么的。',
    en: 'On my days off I do things like reading books and watching movies.'
  },
  kara: {
    form: '普通形 / 丁寧形 + から',
    zh: '因为在下雨，所以不出门。',
    en: "It's raining, so I'm not going out.",
    group: 'reason'
  },
  ga: {
    form: '丁寧形 / 普通形 + が、…',
    zh: '这家店很便宜，但是不好吃。',
    en: "This restaurant is cheap, but the food isn't good.",
    group: 'but'
  },
  keredo: {
    form: '普通形 / 丁寧形 + けど / けれど',
    zh: '想去，不过没时间。',
    en: "I want to go, but I don't have time.",
    group: 'but'
  },
  maeni: {
    form: 'V辞書形 / Nの + 前に',
    zh: '睡觉前刷牙。',
    en: 'I brush my teeth before going to bed.'
  },
  atode: {
    form: 'Vた形 / Nの + 後で',
    zh: '做完作业后看电视。',
    en: 'After doing my homework, I watch TV.',
    group: 'after'
  },
  nagara: {
    form: 'Vます形 + ながら',
    zh: '一边听音乐一边学习。',
    en: 'I study while listening to music.',
    group: 'while'
  },
  niiku: {
    form: 'Vます形 / N + に行く / に来る',
    zh: '去图书馆借书。',
    en: "I'm going to the library to borrow some books."
  },
  deshou: {
    form: '普通形 + でしょう（晴れるでしょう · 静かでしょう · 雨でしょう）',
    zh: '明天大概会放晴吧。',
    en: 'It will probably be sunny tomorrow.',
    group: 'guess'
  },
  tsumori: {
    form: 'V辞書形 / Vない形 + つもり',
    zh: '我打算明年去日本留学。',
    en: 'I intend to study in Japan next year.'
  },
  nohougaa: {
    form: 'N1 より N2 のほうが …',
    zh: '电车比公交车快。',
    en: 'The train is faster than the bus.',
    group: 'compare'
  },
  yori: {
    form: 'N + より',
    zh: '今天比昨天冷。',
    en: 'Today is colder than yesterday.',
    group: 'compare'
  },
  dake: { form: 'N / 数量 + だけ', zh: '请只给我一个。', en: 'Just one, please.', group: 'only' },

  // ── N4 ──
  nakereba: {
    form: '行かない → 行かなければならない',
    zh: '明天之前必须交报告。',
    en: 'I have to hand in the report by tomorrow.'
  },
  nakutemoii: {
    form: '来ない → 来なくてもいい',
    zh: '明天不来也可以。',
    en: "You don't have to come tomorrow.",
    group: 'need-not'
  },
  hougaii: {
    form: 'Vた形 / Vない形 + ほうがいい',
    zh: '最好早点睡哦。',
    en: "You'd better go to bed early.",
    group: 'should'
  },
  toomou: {
    form: '普通形 + と思う',
    zh: '我想他会来的。',
    en: 'I think he will come.',
    group: 'think'
  },
  youtoomou: {
    form: '行く → 行こうと思う · 食べる → 食べようと思う',
    zh: '我打算暑假回国。',
    en: "I'm thinking of going back to my country for the summer vacation.",
    group: 'think'
  },
  toiu: {
    form: '「…」と言う · N + という + N',
    zh: '这是叫做「樱花」的花。',
    en: 'This is a flower called "sakura".'
  },
  kamoshirenai: {
    form: '普通形 + かもしれない（降るかもしれない · 雨かもしれない）',
    zh: '下午也许会下雨。',
    en: 'It might rain in the afternoon.',
    group: 'guess'
  },
  darou: {
    form: '普通形 + だろう（着いただろう · 雨だろう）',
    zh: '他大概已经到家了吧。',
    en: 'He has probably got home by now.',
    group: 'guess'
  },
  soulook: {
    form: 'Vます形 + そうだ（降りそうだ）· おいしい → おいしそうだ · 元気 → 元気そうだ',
    zh: '这个蛋糕看起来很好吃。',
    en: 'This cake looks delicious.',
    group: 'seem'
  },
  souhear: {
    form: '普通形 + そうだ（降るそうだ · 雨だそうだ）',
    zh: '据天气预报说，明天会下雨。',
    en: 'According to the weather forecast, it will rain tomorrow.',
    group: 'seem'
  },
  youda: {
    form: '普通形 + ようだ（来たようだ · 静かなようだ · 雨のようだ）',
    zh: '好像有人来了。',
    en: 'It seems someone has come.',
    group: 'seem'
  },
  mitai: {
    form: '普通形 + みたい（来たみたい · 先生みたい）',
    zh: '那个人好像是老师。',
    en: 'That person seems to be a teacher.',
    group: 'seem'
  },
  rashii: {
    form: '普通形 + らしい（辞めるらしい · 学生らしい）',
    zh: '听说田中要辞职。',
    en: 'Apparently Tanaka is going to quit the company.',
    group: 'seem'
  },
  ndesu: {
    form: '普通形 + んです（痛いんです · 静かなんです · 雨なんです）',
    zh: '（是这样的，）我头疼。',
    en: 'The thing is, I have a headache.'
  },
  ba: {
    form: '行く → 行けば · 食べる → 食べれば · 安い → 安ければ',
    zh: '如果便宜就买。',
    en: "I'll buy it if it's cheap.",
    group: 'if'
  },
  tara: {
    form: 'Vた形 + ら（着いたら）',
    zh: '到了车站请给我打电话。',
    en: 'Please call me when you get to the station.',
    group: 'if'
  },
  nara: {
    form: '普通形 / N + なら（勉強するなら · 日本語なら）',
    zh: '要是学日语的话，这本书不错哦。',
    en: "If you're going to study Japanese, this book is a good one.",
    group: 'if'
  },
  to: {
    form: 'V辞書形 + と',
    zh: '一到春天，樱花就开了。',
    en: 'When spring comes, the cherry blossoms bloom.',
    group: 'if'
  },
  temo: {
    form: 'Vて形 + も（降っても）',
    zh: '即使下雨，比赛也照常进行。',
    en: 'Even if it rains, we will hold the match.',
    group: 'even-if'
  },
  noni: {
    form: '普通形 + のに（飲んだのに · 静かなのに · 雨なのに）',
    zh: '明明吃了药，却还在发烧。',
    en: 'Although I took some medicine, I still have a fever.',
    group: 'but'
  },
  node: {
    form: '普通形 + ので（痛いので · 静かなので · 雨なので）',
    zh: '因为头疼，今天请假休息。',
    en: "I have a headache, so I'm taking today off.",
    group: 'reason'
  },
  shi: {
    form: '普通形 + し',
    zh: '这个房间又宽敞，离车站又近。',
    en: "This room is spacious, and it's close to the station too."
  },
  tameni: {
    form: 'V辞書形 / Nの + ために',
    zh: '为了考上大学，我每天都在学习。',
    en: "I'm studying every day in order to get into university.",
    group: 'purpose'
  },
  youni: {
    form: 'V辞書形 / Vない形 + ように',
    zh: '为了不忘记，我记下笔记。',
    en: "I'll write a note so that I don't forget.",
    group: 'purpose'
  },
  younisuru: {
    form: 'V辞書形 / Vない形 + ようにする',
    zh: '我尽量每天吃蔬菜。',
    en: 'I try to eat vegetables every day.',
    group: 'resolve'
  },
  youninaru: {
    form: 'V辞書形 + ようになる（話せるようになる）',
    zh: '我会说日语了。',
    en: 'I have become able to speak Japanese.',
    group: 'become'
  },
  kotogadekiru: {
    form: 'V辞書形 + ことができる',
    zh: '我会弹钢琴。',
    en: 'I can play the piano.'
  },
  kotonisuru: {
    form: 'V辞書形 / Vない形 + ことにする',
    zh: '我决定从下个月开始每天早上跑步。',
    en: "I've decided to go running every morning from next month.",
    group: 'resolve'
  },
  kotoninaru: {
    form: 'V辞書形 / Vない形 + ことになる',
    zh: '定下来了，下个月调到大阪工作。',
    en: "It's been decided that I'll be transferred to Osaka next month.",
    group: 'become'
  },
  passive: {
    form: '書く → 書かれる · 食べる → 食べられる · する → される · 来る → 来られる',
    zh: '被老师表扬了。',
    en: 'I was praised by the teacher.'
  },
  causative: {
    form: '書く → 書かせる · 食べる → 食べさせる · する → させる · 来る → 来させる',
    zh: '妈妈让弟弟吃了蔬菜。',
    en: 'My mother made my little brother eat his vegetables.'
  },
  teshimau: {
    form: 'Vて形 + しまう',
    zh: '我把伞忘在电车上了。',
    en: 'I left my umbrella on the train.'
  },
  teoku: {
    form: 'Vて形 + おく',
    zh: '旅行之前先把酒店订好。',
    en: "I'll book a hotel before the trip."
  },
  temiru: {
    form: 'Vて形 + みる',
    zh: '这件衣服可以试穿一下吗？',
    en: 'May I try these clothes on?'
  },
  tearu: {
    form: '（他動詞）Vて形 + ある',
    zh: '墙上挂着画。',
    en: 'A picture has been hung on the wall.'
  },
  teikukuru: {
    form: 'Vて形 + いく / くる',
    zh: '天气冷起来了。',
    en: "It's getting cold."
  },
  juju: {
    form: 'Vて形 + あげる / くれる / もらう',
    zh: '朋友把我送到了车站。',
    en: 'My friend saw me off at the station.'
  },
  tehoshii: {
    form: 'Vて形 + ほしい',
    zh: '希望你说得再慢一点。',
    en: "I'd like you to speak a little more slowly.",
    group: 'want'
  },
  hodonai: {
    form: 'N / 普通形 + ほど + 否定（去年ほど暑くない · 思ったほど難しくなかった）',
    zh: '今年夏天没有去年那么热。',
    en: "This summer isn't as hot as last year.",
    group: 'compare'
  },
  sugiru: {
    form: 'Vます形 + すぎる（食べすぎる）· 高い → 高すぎる · 静か → 静かすぎる',
    zh: '昨天吃多了。',
    en: 'I ate too much yesterday.'
  },
  yasui: {
    form: 'Vます形 + やすい / にくい',
    zh: '这支笔很好写。',
    en: 'This pen is easy to write with.',
    group: 'tend'
  },
  hazu: {
    form: '普通形 + はずだ（着いているはず · 静かなはず · 休みのはず）',
    zh: '他应该已经到了。',
    en: 'He should have arrived by now.',
    group: 'guess'
  },
  baii: {
    form: '聞く → 聞けばいい · 食べる → 食べればいい',
    zh: '不懂的时候问老师就行。',
    en: "When you don't understand, you just need to ask the teacher."
  },
  mama: {
    form: 'Vた形 / Vない形 / Nの + まま',
    zh: '请不要穿着鞋进房间。',
    en: "Please don't come into the room with your shoes on.",
    group: 'while'
  },
  zuni: {
    form: '食べない → 食べずに · する → せずに',
    zh: '没吃早饭就去学校了。',
    en: 'I went to school without eating breakfast.',
    group: 'without'
  },
  shika: {
    form: 'N + しか + 否定（しかない · しかありません）',
    zh: '钱包里只有一百日元。',
    en: 'I only have 100 yen in my wallet.',
    group: 'only'
  },
  bakari: {
    form: 'N / Vて形 + ばかり',
    zh: '弟弟光玩游戏。',
    en: 'My little brother does nothing but play games.',
    group: 'only'
  },
  kadouka: {
    form: '普通形 + かどうか（来るかどうか · 本当かどうか）',
    zh: '不知道他来不来。',
    en: "I don't know whether he will come."
  },
  nitsuite: {
    form: 'N + について',
    zh: '我来谈谈日本文化。',
    en: "I'll talk about Japanese culture.",
    group: 'about'
  },
  niyotte: {
    form: 'N + によって',
    zh: '想法因人而异。',
    en: 'Ways of thinking differ from person to person.',
    group: 'basis'
  },
  niyoruto: {
    form: 'N + によると',
    zh: '据天气预报说，明天是晴天。',
    en: 'According to the weather forecast, it will be sunny tomorrow.'
  },
  toshite: {
    form: 'N + として',
    zh: '他在当口译。',
    en: 'He works as an interpreter.'
  }
}

/** 接续、例句翻译、同组、另写的例句 */
export const GRAMMAR_NOTES: Record<string, GrammarNote> = {
  ...BASIC_NOTES,
  ...N3.notes,
  ...N2.notes,
  ...N1.notes
}

const N5: LessonSpec[] = [
  {
    id: 'n5-1',
    title: { zh: '礼貌体：です・ます', en: 'Polite style: です and ます' },
    items: ['desu', 'deshita', 'masu', 'masen', 'mashita']
  },
  {
    id: 'n5-2',
    title: { zh: '邀请与提议', en: 'Invitations and offers' },
    items: ['mashou', 'mashouka', 'masenka', 'niiku']
  },
  {
    id: 'n5-3',
    title: { zh: '简体与て形', en: 'Plain forms and the て-form' },
    items: ['nai', 'ta', 'te', 'teiru']
  },
  {
    id: 'n5-4',
    title: { zh: 'て形的用法', en: 'Using the て-form' },
    items: ['tekudasai', 'tekara', 'temoii', 'tewaikenai', 'naidekudasai']
  },
  {
    id: 'n5-5',
    title: { zh: '愿望与经历', en: 'Wishes and experiences' },
    items: ['tai', 'hoshii', 'takotogaaru', 'tari']
  },
  {
    id: 'n5-6',
    title: { zh: '连接句子', en: 'Linking clauses' },
    items: ['kara', 'ga', 'keredo', 'maeni', 'atode', 'nagara']
  },
  {
    id: 'n5-7',
    title: { zh: '推测、打算与比较', en: 'Guesses, plans and comparisons' },
    items: ['deshou', 'tsumori', 'nohougaa', 'yori', 'dake']
  }
]

const N4: LessonSpec[] = [
  {
    id: 'n4-1',
    title: { zh: '必须与不必', en: 'Must and need not' },
    items: ['nakereba', 'nakutemoii', 'hougaii', 'baii']
  },
  {
    id: 'n4-2',
    title: { zh: '想法与说明', en: 'Thoughts and explanations' },
    items: ['toomou', 'youtoomou', 'toiu', 'ndesu']
  },
  {
    id: 'n4-3',
    title: { zh: '推测', en: 'Guessing' },
    items: ['kamoshirenai', 'darou', 'hazu']
  },
  {
    id: 'n4-4',
    title: { zh: '样子与传闻', en: 'Appearance and hearsay' },
    items: ['soulook', 'souhear', 'youda', 'mitai', 'rashii']
  },
  { id: 'n4-5', title: { zh: '条件', en: 'Conditions' }, items: ['ba', 'tara', 'nara', 'to'] },
  {
    id: 'n4-6',
    title: { zh: '让步、原因与列举', en: 'Concessions, reasons and lists' },
    items: ['temo', 'noni', 'node', 'shi']
  },
  {
    id: 'n4-7',
    title: { zh: '目的与变化', en: 'Purpose and change' },
    items: ['tameni', 'youni', 'younisuru', 'youninaru']
  },
  {
    id: 'n4-8',
    title: { zh: '「こと」的句型', en: 'Patterns with こと' },
    items: ['kotogadekiru', 'kotonisuru', 'kotoninaru']
  },
  {
    id: 'n4-9',
    title: { zh: '被动与使役', en: 'Passive and causative' },
    items: ['passive', 'causative']
  },
  {
    id: 'n4-10',
    title: { zh: 'て形 + 补助动词', en: 'て-form + helper verbs' },
    items: ['teshimau', 'teoku', 'temiru', 'tearu', 'teikukuru']
  },
  {
    id: 'n4-11',
    title: { zh: '授受与请求', en: 'Giving, receiving and requests' },
    items: ['juju', 'tehoshii']
  },
  {
    id: 'n4-12',
    title: { zh: '程度与状态', en: 'Degree and state' },
    items: ['sugiru', 'hodonai', 'yasui', 'mama', 'zuni']
  },
  {
    id: 'n4-13',
    title: { zh: '「只」与「是否」', en: '“Only” and “whether”' },
    items: ['shika', 'bakari', 'kadouka']
  },
  {
    id: 'n4-14',
    title: { zh: '关于、根据、作为', en: 'About, according to, as' },
    items: ['nitsuite', 'niyotte', 'niyoruto', 'toshite']
  }
]

/** 语法课里的所有语法点，按课的顺序 */
export const GRAMMAR_COURSE_IDS = [
  ...N5,
  ...N4,
  ...N3.lessons,
  ...N2.lessons,
  ...N1.lessons
].flatMap((l) => l.items)

/** 从 Tatoeba 挑出来的例句（scripts/data/grammar-examples.ts 生成） */
export interface GrammarExampleData {
  generated: string
  points: Record<
    string,
    {
      /** 自带例句里语法点的起止；认不出来时为 null */
      builtin: [number, number] | null
      /** 另写的例句（GRAMMAR_NOTES 的 more）里语法点的起止，一句一个 */
      more?: ([number, number] | null)[]
      corpus: {
        id: number
        ja: string
        en: string | null
        zh: string | null
        zhMachine: boolean
        start: number
        end: number
      }[]
    }
  >
}

export const FORM_LEGEND: Text = {
  zh: '接续里 V 是动词、N 是名词，いA / なA 是形容词；Vます形 是去掉ます的部分（飲み），Vて形、Vた形、Vない形、V辞書形、Vば形、Vよう形 是动词的各种形式（飲んで、飲んだ、飲まない、飲む、飲めば、飲もう）；普通形 是简体（行く · 行かない · 行った），写成「普通形（なAな・Nの）」的，なA 和 N 后面要加な、の。',
  en: 'In the forms, V is a verb, N a noun and いA / なA adjectives; Vます形 is the stem before ます (飲み); Vて形, Vた形, Vない形, V辞書形, Vば形 and Vよう形 are the te-, ta-, nai-, dictionary, conditional and volitional forms (飲んで, 飲んだ, 飲まない, 飲む, 飲めば, 飲もう); 普通形 is the plain style (行く, 行かない, 行った), and “普通形（なAな・Nの）” means なA and N take な and の.'
}

function item(id: string, data: GrammarExampleData | null): GrammarItem {
  const g = GRAMMAR_BY_ID.get(id)!
  const note = GRAMMAR_NOTES[id]
  const d = data?.points[id]
  const builtin: GrammarExample = {
    ja: g.example,
    zh: note.zh,
    en: note.en,
    start: d?.builtin?.[0] ?? 0,
    end: d?.builtin?.[1] ?? 0,
    source: 'builtin'
  }
  const more: GrammarExample[] = (note.more ?? []).map((m, i) => ({
    ja: m.ja,
    zh: m.zh,
    en: m.en,
    start: d?.more?.[i]?.[0] ?? 0,
    end: d?.more?.[i]?.[1] ?? 0,
    source: 'builtin'
  }))
  const corpus: GrammarExample[] = (d?.corpus ?? []).map((c) => ({
    ja: c.ja,
    zh: c.zh,
    en: c.en,
    ...(c.zhMachine && { zhMachine: true }),
    start: c.start,
    end: c.end,
    source: c.id
  }))
  return {
    key: id,
    name: g.name,
    form: note.form,
    meaning: { zh: g.zh, en: g.en },
    ...(note.group && { group: note.group }),
    examples: [builtin, ...more, ...corpus]
  }
}

function unit(id: string, title: Text, note: Text, specs: LessonSpec[]): CourseUnit {
  const lessons: CourseLesson[] = specs.map((s) => ({ id: s.id, title: s.title, items: s.items }))
  return { id, title, note, lessons, test: true }
}

/** 语法这门课；data 是挑好的 Tatoeba 例句（取不到时只有自带的例句） */
export function jaGrammarCourse(data: GrammarExampleData | null): Course {
  return {
    id: 'grammar',
    kind: 'grammar',
    title: { zh: '语法', en: 'Grammar' },
    intro: {
      zh: 'JLPT N5 到 N1 的常用语法，每课几个语法点：先看意思、接续和例句，再做选意思、填空练习。',
      en: 'Common JLPT grammar from N5 to N1, a few points per lesson: read the meaning, form and examples, then practise choosing meanings and filling in blanks.'
    },
    legend: FORM_LEGEND,
    units: [
      unit(
        'n5',
        { zh: 'N5 语法', en: 'N5 grammar' },
        {
          zh: 'JLPT N5 的基础语法：礼貌体、て形、愿望、比较等。',
          en: 'Basic JLPT N5 grammar: the polite style, the て-form, wishes, comparisons and more.'
        },
        N5
      ),
      unit(
        'n4',
        { zh: 'N4 语法', en: 'N4 grammar' },
        {
          zh: 'JLPT N4 的语法：条件、推测、被动与使役、补助动词等。',
          en: 'JLPT N4 grammar: conditions, guesses, the passive and causative, helper verbs and more.'
        },
        N4
      ),
      unit(
        'n3',
        { zh: 'N3 语法', en: 'N3 grammar' },
        {
          zh: 'JLPT N3 的语法：日常会话和一般文章里常见的句型，表达评价、原因、程度、时间先后等。',
          en: 'JLPT N3 grammar: patterns common in everyday conversation and ordinary writing, for judgements, causes, degree, timing and more.'
        },
        N3.lessons
      ),
      unit(
        'n2',
        { zh: 'N2 语法', en: 'N2 grammar' },
        {
          zh: 'JLPT N2 的语法：报纸、说明文、商务场合常见的书面句型，表达条件、让步、立场、强调等。',
          en: 'JLPT N2 grammar: written patterns common in newspapers, explanations and business, for conditions, concessions, viewpoints, emphasis and more.'
        },
        N2.lessons
      ),
      unit(
        'n1',
        { zh: 'N1 语法', en: 'N1 grammar' },
        {
          zh: 'JLPT N1 的语法：评论、论文、文学作品里的书面与文言色彩的句型。',
          en: 'JLPT N1 grammar: formal and literary patterns found in editorials, academic writing and literature.'
        },
        N1.lessons
      )
    ],
    symbols: {},
    grammar: Object.fromEntries(GRAMMAR_COURSE_IDS.map((id) => [id, item(id, data)])),
    docs: {}
  }
}
