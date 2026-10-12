/**
 * 俄语的语法点：按 ТРКИ 各级（ТЭУ … ТРКИ-4）教学大纲的顺序与粒度。说明、例句都是自己写的。
 *
 * patterns 用阅读器给每个词的原形（lemma）、写法（form）、词性（pos）、标签（tags：格、数、性、体、时……）来认，
 * 认得准比认得多要紧。框架现在只看一个词的第一组标签：跟词头同形的词（стол、книга、читать）没有标签，
 * 所以要格的条件都放在「间接格」上（属格、与格、工具格、前置格，以及跟主格不同形的宾格），
 * 不定式按词尾认（-ть、-ти、-чь）。见 docs/lang/ru.md「语法点」。
 */
import type { LexGrammarPoint, TokenTest } from '../types'
import { rules } from './rules'
import { addExamplePatterns } from '../grammar'

// ───────────────────────── 写 pattern 用的小工具 ─────────────────────────

const VOWELS = 'аеёиоуыэюяАЕЁИОУЫЭЮЯ'
/** 正则里每个元音后面允许一个重音符号（课文、例句可能带重音：идти́） */
function accentable(src: string, flags = 'u'): RegExp {
  let out = ''
  for (const ch of src) out += VOWELS.includes(ch) ? `${ch}[\\u0300\\u0301]?` : ch
  return new RegExp(out, flags)
}

const lemma = (...l: string[]): TokenTest => ({ lemma: l })
const form = (...f: string[]): TokenTest => ({ form: f })
/** 不定式：动词，词尾 -ть / -ти / -чь（可以带 -ся） */
const INF: TokenTest = { pos: 'verb', surface: accentable('(ть|ти|чь)(ся|сь)?$') }
const gap = (t: TokenTest, n: number): TokenTest => ({ ...t, gap: n })
const optional = (t: TokenTest): TokenTest => ({ ...t, optional: true })
const NOUNISH = ['noun', 'propn', 'pron'] as const
const caseOf = (c: string, pos: readonly string[] = NOUNISH): TokenTest => ({
  pos: [...pos] as TokenTest['pos'],
  anyTags: [c]
})
const ADJ_LIKE = ['adj', 'det', 'pron', 'num'] as const
/** 名词前面可有可无的一个形容词（同一个格） */
const adjOf = (c: string): TokenTest => optional({ pos: [...ADJ_LIKE], anyTags: [c] })

const MOTION = [
  'идти',
  'ходить',
  'ехать',
  'ездить',
  'лететь',
  'летать',
  'бежать',
  'бегать',
  'плыть',
  'плавать',
  'нести',
  'носить',
  'вести',
  'водить',
  'везти',
  'возить'
]

// 补足旧工作目录中只写一例的点；均为自写例句。
const extraExamples: Record<string, { text: string; zh: string; en: string; hl: string }> = {
  'ru-ne-tolko': {
    text: 'Он не только читает, но и пишет.',
    zh: '他不仅读书，也写作。',
    en: 'He not only reads but also writes.',
    hl: 'не только читает, но и'
  },
  'ru-poka-ne': {
    text: 'Не уходи, пока я не вернусь.',
    zh: '等我回来你再走。',
    en: 'Do not leave until I return.',
    hl: 'пока я не вернусь'
  },
  'ru-v-to-vremya-kak': {
    text: 'В то время как она читала, я писал.',
    zh: '她读书的时候，我在写作。',
    en: 'While she was reading, I was writing.',
    hl: 'В то время как'
  },
  'ru-chem-tem': {
    text: 'Чем дольше ждёшь, тем труднее сохранять спокойствие.',
    zh: '等得越久，越难保持平静。',
    en: 'The longer you wait, the harder it is to stay calm.',
    hl: 'Чем дольше ждёшь, тем труднее'
  },
  'ru-dlya-togo-chtoby': {
    text: 'Для того чтобы понять текст, прочитайте его ещё раз.',
    zh: '为理解文本，请再读一遍。',
    en: 'To understand the text, read it again.',
    hl: 'Для того чтобы'
  },
  'ru-vmesto-togo': {
    text: 'Вместо того чтобы спорить, мы проверили данные.',
    zh: '我们没有争论，而是检查了数据。',
    en: 'Instead of arguing, we checked the data.',
    hl: 'Вместо того чтобы'
  },
  'ru-ni-ni': {
    text: 'Здесь нет ни света, ни воды.',
    zh: '这里既没电，也没水。',
    en: 'There is neither electricity nor water here.',
    hl: 'ни света, ни'
  },
  'ru-po-mere': {
    text: 'По мере того как рос город, менялись дороги.',
    zh: '随着城市发展，道路也在变化。',
    en: 'As the city grew, the roads changed.',
    hl: 'По мере того как'
  },
  'ru-ibo': {
    text: 'Мы остановились, ибо путь был закрыт.',
    zh: '我们停下了，因为道路被封了。',
    en: 'We stopped, for the road was closed.',
    hl: 'ибо'
  },
  'ru-kak-by-ne': {
    text: 'Как бы не забыть ключи!',
    zh: '可别忘了钥匙！',
    en: 'I hope I do not forget the keys!',
    hl: 'Как бы не забыть'
  },
  'ru-budushi': {
    text: 'Будучи врачом, она хорошо понимала риск.',
    zh: '作为医生，她很清楚风险。',
    en: 'Being a doctor, she understood the risk well.',
    hl: 'Будучи врачом'
  },
  'ru-dabы': {
    text: 'Мы проверили расчёты, дабы избежать ошибки.',
    zh: '我们检查了计算，以免出错。',
    en: 'We checked the calculations in order to avoid an error.',
    hl: 'дабы'
  },
  'ru-vshi': {
    text: 'Прочитав письмо, она позвонила другу.',
    zh: '读完信，她给朋友打了电话。',
    en: 'Having read the letter, she called her friend.',
    hl: 'Прочитав'
  },
  'ru-koli': {
    text: 'Коли не знаешь, спроси.',
    zh: '既然不知道，就问吧。',
    en: 'If you do not know, ask.',
    hl: 'Коли'
  },
  'ru-ottogo-chto': {
    text: 'Я устал оттого, что долго работал.',
    zh: '我累了，因为工作了很久。',
    en: 'I am tired because I worked for a long time.',
    hl: 'оттого, что'
  }
}

const PREFIXES = [
  'при',
  'у',
  'в',
  'вы',
  'под',
  'от',
  'за',
  'пере',
  'про',
  'до',
  'об',
  'с',
  'раз',
  'вз'
]
/** 带前缀的运动动词：прийти、уйти、войти、выйти……（идти 加前缀写成 -йти） */
const PREFIXED_MOTION = [
  'прийти',
  'уйти',
  'войти',
  'выйти',
  'подойти',
  'отойти',
  'зайти',
  'перейти',
  'пройти',
  'дойти',
  'обойти',
  'сойти',
  'найти',
  ...PREFIXES.flatMap((p) =>
    [
      'ходить',
      'ехать',
      'езжать',
      'лететь',
      'летать',
      'бежать',
      'бегать',
      'нести',
      'носить',
      'вести',
      'водить',
      'везти',
      'возить',
      'плыть',
      'плывать'
    ].map((v) => p + v)
  )
].filter((v, i, a) => a.indexOf(v) === i && !MOTION.includes(v))

// ───────────────────────── 语法点 ─────────────────────────

export const grammar: LexGrammarPoint[] = [
  // ═════════════ ТЭУ（A1） ═════════════
  {
    id: 'ru-u-menya-est',
    level: 'teu',
    name: { zh: 'у меня есть（某人有某物）', en: 'у меня есть (possession)' },
    form: {
      zh: 'у + 人称代词 / 名词的属格 + есть + 所有物（主格）',
      en: 'у + genitive + есть + thing possessed (nominative)'
    },
    meaning: {
      zh: '表示「某人有……」。俄语日常不用「有」这个动词，而说「在某人那里有……」：拥有者用 у + 属格，所有物是句子的主语（主格）。',
      en: 'Expresses possession. Instead of a verb "to have", Russian says "by someone there is…": the owner goes into у + genitive and the thing owned is the subject (nominative).'
    },
    notes: {
      zh: 'у 后面的 он、она、они 要加 н-：у него、у неё、у них。说「没有」时用 нет + 属格（见下一条）。强调「有没有」时说 есть，强调有什么样的时候 есть 常省掉：У меня большая семья。',
      en: 'After у the pronouns он, она, они take н-: у него, у неё, у них. For "not have" use нет + genitive (next point). есть is often dropped when the focus is on what kind: У меня большая семья.'
    },
    examples: [
      { text: 'У меня есть кошка.', zh: '我有一只猫。', en: 'I have a cat.', hl: 'У меня есть' },
      {
        text: 'У брата есть машина.',
        zh: '哥哥有一辆车。',
        en: 'My brother has a car.',
        hl: 'У брата есть'
      },
      { text: 'У тебя есть время?', zh: '你有时间吗？', en: 'Do you have time?', hl: 'У тебя есть' }
    ],
    patterns: [[lemma('у'), caseOf('genitive'), form('есть')]],
    group: 'possession'
  },
  {
    id: 'ru-net-gen',
    level: 'teu',
    name: { zh: 'нет + 属格（没有）', en: 'нет + genitive (absence)' },
    form: { zh: 'нет + 名词 / 代词的属格', en: 'нет + genitive of a noun or pronoun' },
    meaning: {
      zh: '表示「没有……」「……不在」。没有的那个东西或人用属格，句子没有主语。',
      en: 'Says that something is absent or missing. The absent thing or person goes into the genitive; the sentence has no subject.'
    },
    notes: {
      zh: '过去时用 не было，将来时用 не будет，后面同样用属格：Вчера не было урока。',
      en: 'In the past use не было, in the future не будет, still with the genitive: Вчера не было урока.'
    },
    examples: [
      {
        text: 'У меня нет времени.',
        zh: '我没有时间。',
        en: "I don't have time.",
        hl: 'нет времени'
      },
      {
        text: 'Сегодня нет урока.',
        zh: '今天没有课。',
        en: "There's no lesson today.",
        hl: 'нет урока'
      },
      { text: 'Мамы нет дома.', zh: '妈妈不在家。', en: "Mum isn't at home.", hl: 'нет дома' }
    ],
    patterns: [[form('нет'), adjOf('genitive'), caseOf('genitive', ['noun', 'propn', 'pron'])]],
    group: 'possession'
  },
  {
    id: 'ru-menya-zovut',
    level: 'teu',
    name: { zh: 'Меня зовут…（我叫……）', en: 'Меня зовут… (my name is…)' },
    form: { zh: '人称代词的宾格 + зовут + 名字', en: 'accusative pronoun + зовут + name' },
    meaning: {
      zh: '介绍名字。字面意思是「（人们）叫我……」，所以「我」用宾格 меня，动词用第三人称复数 зовут。',
      en: 'Gives someone’s name. Literally "(they) call me…", so the person is in the accusative and the verb is third-person plural.'
    },
    examples: [
      { text: 'Меня зовут Анна.', zh: '我叫安娜。', en: 'My name is Anna.', hl: 'Меня зовут' },
      { text: 'Как тебя зовут?', zh: '你叫什么名字？', en: "What's your name?", hl: 'тебя зовут' },
      { text: 'Его зовут Иван.', zh: '他叫伊万。', en: 'His name is Ivan.', hl: 'Его зовут' }
    ],
    patterns: [[form('меня', 'тебя', 'его', 'её', 'нас', 'вас', 'их'), lemma('звать')]]
  },
  {
    id: 'ru-mne-nravitsya',
    level: 'teu',
    name: { zh: 'мне нравится（我喜欢）', en: 'мне нравится (liking)' },
    form: {
      zh: '喜欢的人（与格）+ нравится / нравятся + 喜欢的东西（主格）',
      en: 'the person who likes (dative) + нравится / нравятся + what is liked (nominative)'
    },
    meaning: {
      zh: '表示「喜欢」。字面意思是「……让我觉得好」：喜欢的人用与格，喜欢的东西是主语，动词跟着它变数：Мне нравится книга / Мне нравятся книги。',
      en: 'Expresses liking, literally "…is pleasing to me": the person is in the dative, the liked thing is the subject and the verb agrees with it.'
    },
    notes: {
      zh: '后面也可以接不定式：Мне нравится читать。比 любить 轻，常用于具体的、眼前的东西。',
      en: 'Can also take an infinitive: Мне нравится читать. Weaker than любить and often used about specific things.'
    },
    examples: [
      {
        text: 'Мне нравится эта музыка.',
        zh: '我喜欢这首音乐。',
        en: 'I like this music.',
        hl: 'Мне нравится'
      },
      { text: 'Ей нравятся цветы.', zh: '她喜欢花。', en: 'She likes flowers.', hl: 'Ей нравятся' },
      {
        text: 'Тебе нравится Москва?',
        zh: '你喜欢莫斯科吗？',
        en: 'Do you like Moscow?',
        hl: 'Тебе нравится'
      }
    ],
    patterns: [[caseOf('dative'), lemma('нравиться')]]
  },
  {
    id: 'ru-skolko-stoit',
    level: 'teu',
    name: { zh: 'Сколько стоит…?（多少钱）', en: 'Сколько стоит…? (price)' },
    form: {
      zh: 'сколько + стоит / стоят + 东西（主格）',
      en: 'сколько + стоит / стоят + item (nominative)'
    },
    meaning: {
      zh: '问价钱。东西是单数用 стоит，复数用 стоят。',
      en: 'Asks the price. Use стоит for one item, стоят for several.'
    },
    examples: [
      {
        text: 'Сколько стоит билет?',
        zh: '票多少钱？',
        en: 'How much is the ticket?',
        hl: 'Сколько стоит'
      },
      {
        text: 'Сколько стоят яблоки?',
        zh: '苹果多少钱？',
        en: 'How much are the apples?',
        hl: 'Сколько стоят'
      }
    ],
    patterns: [[lemma('сколько'), lemma('стоить')]]
  },
  {
    id: 'ru-prep-place',
    level: 'teu',
    name: { zh: 'в / на + 前置格（在哪里）', en: 'в / на + prepositional (location)' },
    form: { zh: 'в / на + 名词的前置格', en: 'в / на + prepositional' },
    meaning: {
      zh: '回答「在哪里？」（где?）。в 是「在……里面」，на 是「在……上面」，也用于开放的场所和活动（на улице、на работе、на концерте）。',
      en: 'Answers "where?" (где?). в means inside, на means on; на is also used with open spaces and events (на улице, на работе, на концерте).'
    },
    notes: {
      zh: '用 в 还是 на 要一个一个记：в школе、в университете，但 на почте、на вокзале、на заводе。一些阳性名词有特别的前置格 -у：в лесу́、в саду́、на полу́。',
      en: 'Which preposition a noun takes has to be learned: в школе, в университете but на почте, на вокзале, на заводе. Some masculine nouns take a special -у: в лесу́, в саду́, на полу́.'
    },
    examples: [
      {
        text: 'Я читаю в библиотеке.',
        zh: '我在图书馆看书。',
        en: 'I read in the library.',
        hl: 'в библиотеке'
      },
      {
        text: 'Книга лежит на столе.',
        zh: '书在桌子上。',
        en: 'The book is on the table.',
        hl: 'на столе'
      },
      {
        text: 'Они живут в большом городе.',
        zh: '他们住在一座大城市里。',
        en: 'They live in a big city.',
        hl: 'в большом городе'
      }
    ],
    patterns: [
      [lemma('в', 'во', 'на'), adjOf('prepositional'), caseOf('prepositional', ['noun', 'propn'])]
    ],
    group: 'v-na'
  },
  {
    id: 'ru-prep-direction',
    level: 'teu',
    name: { zh: 'в / на + 宾格（去哪里、什么时候）', en: 'в / на + accusative (direction, time)' },
    form: { zh: 'в / на + 名词的宾格', en: 'в / на + accusative' },
    meaning: {
      zh: '回答「去哪里？」（куда?）：идти в школу、ехать на работу。в + 宾格也表示时间：в субботу（在星期六）、в два часа。',
      en: 'Answers "where to?" (куда?): идти в школу, ехать на работу. в + accusative also gives time: в субботу (on Saturday), в два часа.'
    },
    notes: {
      zh: '跟「在哪里」用同一个前置词：在学校 в школе → 去学校 в школу；在单位 на работе → 去单位 на работу。',
      en: 'The same preposition as for location: в школе → в школу, на работе → на работу.'
    },
    examples: [
      { text: 'Мы идём в школу.', zh: '我们去学校。', en: "We're going to school.", hl: 'в школу' },
      {
        text: 'Папа едет на работу.',
        zh: '爸爸开车去上班。',
        en: 'Dad is driving to work.',
        hl: 'на работу'
      },
      { text: 'Приходи в субботу!', zh: '星期六来吧！', en: 'Come on Saturday!', hl: 'в субботу' }
    ],
    patterns: [
      [lemma('в', 'во', 'на'), adjOf('accusative'), caseOf('accusative', ['noun', 'propn'])]
    ],
    group: 'v-na'
  },
  {
    id: 'ru-o-prep',
    level: 'teu',
    name: { zh: 'о + 前置格（关于）', en: 'о + prepositional (about)' },
    form: { zh: 'о / об / обо + 前置格', en: 'о / об / обо + prepositional' },
    meaning: {
      zh: '「关于……」，跟 говорить、думать、рассказывать、читать、писать、знать 这些动词连用。',
      en: '"About…", used with verbs like говорить, думать, рассказывать, читать, писать, знать.'
    },
    notes: {
      zh: '元音开头的词前用 об（об этом、об Анне），обо 只用在 обо мне、обо всём 等几个词前。',
      en: 'Before a vowel use об (об этом, об Анне); обо appears only in a few fixed forms (обо мне, обо всём).'
    },
    examples: [
      { text: 'Мы говорили о нём.', zh: '我们谈到了他。', en: 'We talked about him.', hl: 'о нём' },
      {
        text: 'Я часто думаю о маме.',
        zh: '我常常想妈妈。',
        en: 'I often think about my mum.',
        hl: 'о маме'
      },
      {
        text: 'Расскажи об этом фильме.',
        zh: '讲讲这部电影吧。',
        en: 'Tell me about this film.',
        hl: 'об этом фильме'
      }
    ],
    patterns: [[lemma('о', 'об', 'обо'), adjOf('prepositional'), caseOf('prepositional')]]
  },
  {
    id: 'ru-past',
    level: 'teu',
    name: { zh: '动词的过去时', en: 'Past tense of verbs' },
    form: {
      zh: '不定式去掉 -ть，加 -л（阳性）、-ла（阴性）、-ло（中性）、-ли（复数）',
      en: 'Infinitive minus -ть, plus -л (masc.), -ла (fem.), -ло (neut.), -ли (pl.)'
    },
    meaning: {
      zh: '过去发生的事。俄语过去时不按人称变，而按主语的性和数变：я читал（男）/ я читала（女）。',
      en: 'Something that happened in the past. The past tense agrees with the subject in gender and number, not in person: я читал (man) / я читала (woman).'
    },
    notes: {
      zh: '有些动词的过去时不规则：идти → шёл、шла、шли；мочь → мог、могла；есть → ел、ела。',
      en: 'Some past forms are irregular: идти → шёл, шла, шли; мочь → мог, могла; есть → ел, ела.'
    },
    examples: [
      {
        text: 'Вчера я читал книгу.',
        zh: '昨天我（男）看了书。',
        en: 'Yesterday I read a book.',
        hl: 'читал'
      },
      {
        text: 'Она жила в Москве.',
        zh: '她以前住在莫斯科。',
        en: 'She lived in Moscow.',
        hl: 'жила'
      },
      {
        text: 'Мы долго гуляли.',
        zh: '我们散了很久的步。',
        en: 'We walked for a long time.',
        hl: 'гуляли'
      }
    ],
    patterns: [[{ pos: 'verb', tags: ['past'], not: { anyTags: ['participle'] } }]],
    group: 'tense'
  },
  {
    id: 'ru-future-ipf',
    level: 'teu',
    name: { zh: '未完成体的将来时：буду + 不定式', en: 'Imperfective future: буду + infinitive' },
    form: {
      zh: 'буду / будешь / будет / будем / будете / будут + 未完成体不定式',
      en: 'буду / будешь / будет / будем / будете / будут + imperfective infinitive'
    },
    meaning: {
      zh: '将来要做、会一直做的事（过程、反复），不强调做完。быть 按人称变，后面的动词用不定式。',
      en: 'Future actions seen as a process or repeated, without stressing completion. быть changes for person; the main verb stays in the infinitive.'
    },
    notes: {
      zh: '完成体动词没有这个形式：完成体用现在时的变位表示将来（прочитаю = 我将读完）。',
      en: 'Perfective verbs never use this form; their present-tense endings already express the future (прочитаю = I will read through).'
    },
    examples: [
      {
        text: 'Завтра я буду работать.',
        zh: '明天我要工作。',
        en: 'Tomorrow I will be working.',
        hl: 'буду работать'
      },
      {
        text: 'Что ты будешь делать вечером?',
        zh: '你晚上要做什么？',
        en: 'What will you do this evening?',
        hl: 'будешь делать'
      },
      { text: 'Мы будем ждать.', zh: '我们会等着。', en: 'We will wait.', hl: 'будем ждать' }
    ],
    patterns: [[{ lemma: 'быть', tags: ['future'] }, gap(INF, 1)]],
    group: 'tense'
  },
  {
    id: 'ru-mozhno-nelzya',
    level: 'teu',
    name: {
      zh: 'можно / нельзя + 不定式（可以 / 不可以）',
      en: 'можно / нельзя + infinitive (permission)'
    },
    form: { zh: '（与格 +）можно / нельзя + 不定式', en: '(dative +) можно / нельзя + infinitive' },
    meaning: {
      zh: '表示允许或禁止。谁可以做用与格：Тебе можно идти。',
      en: 'Expresses permission or prohibition. The person allowed goes into the dative: Тебе можно идти.'
    },
    examples: [
      {
        text: 'Здесь нельзя курить.',
        zh: '这里不能抽烟。',
        en: "You can't smoke here.",
        hl: 'нельзя курить'
      },
      { text: 'Можно войти?', zh: '可以进来吗？', en: 'May I come in?', hl: 'Можно войти' },
      {
        text: 'Тебе можно отдыхать.',
        zh: '你可以休息了。',
        en: 'You may rest now.',
        hl: 'можно отдыхать'
      }
    ],
    patterns: [[form('можно', 'нельзя'), gap(INF, 1)]],
    group: 'modal'
  },
  {
    id: 'ru-modal-inf',
    level: 'teu',
    name: {
      zh: 'хотеть / мочь / любить / уметь + 不定式',
      en: 'хотеть / мочь / любить / уметь + infinitive'
    },
    form: {
      zh: '变位的 хотеть、мочь、любить、уметь + 不定式',
      en: 'conjugated хотеть, мочь, любить, уметь + infinitive'
    },
    meaning: {
      zh: '想做（хотеть）、能做（мочь）、喜欢做（любить）、会做（уметь）某事。后面的动词不变，用不定式。',
      en: 'Want to (хотеть), be able to (мочь), like to (любить), know how to (уметь) do something; the second verb is an infinitive.'
    },
    notes: {
      zh: 'мочь 是有条件、被允许能做；уметь 是学过、会做：Я умею плавать, но сегодня не могу。',
      en: 'мочь is being able or allowed; уметь is having the skill: Я умею плавать, но сегодня не могу.'
    },
    examples: [
      { text: 'Я хочу спать.', zh: '我想睡觉。', en: 'I want to sleep.', hl: 'хочу спать' },
      { text: 'Ты можешь помочь?', zh: '你能帮忙吗？', en: 'Can you help?', hl: 'можешь помочь' },
      {
        text: 'Она любит читать.',
        zh: '她喜欢读书。',
        en: 'She likes reading.',
        hl: 'любит читать'
      },
      {
        text: 'Мой сын умеет плавать.',
        zh: '我儿子会游泳。',
        en: 'My son can swim.',
        hl: 'умеет плавать'
      }
    ],
    patterns: [[lemma('хотеть', 'мочь', 'любить', 'уметь', 'смочь', 'захотеть'), gap(INF, 1)]],
    group: 'modal'
  },
  {
    id: 'ru-num-gen',
    level: 'teu',
    name: {
      zh: '数词后名词的格（два стола、пять столов）',
      en: 'Case after numerals (два стола, пять столов)'
    },
    form: {
      zh: '1 + 主格单数；2、3、4 + 属格单数；5 以上 + 属格复数（看最后一位数）',
      en: '1 + nominative singular; 2, 3, 4 + genitive singular; 5 and up + genitive plural (go by the last digit)'
    },
    meaning: {
      zh: '数词决定后面名词的格和数：один стол、два стола、пять столов；二十一 21 又是 один：двадцать один стол。',
      en: 'The numeral decides the case and number of the noun: один стол, два стола, пять столов; 21 behaves like 1: двадцать один стол.'
    },
    notes: {
      zh: '11–14 是例外，都接属格复数：одиннадцать столов。два 用于阳性、中性，две 用于阴性：два брата、две сестры。',
      en: '11–14 always take the genitive plural: одиннадцать столов. два for masculine and neuter, две for feminine: два брата, две сестры.'
    },
    examples: [
      {
        text: 'У меня два брата.',
        zh: '我有两个哥哥。',
        en: 'I have two brothers.',
        hl: 'два брата'
      },
      {
        text: 'Мы купили пять книг.',
        zh: '我们买了五本书。',
        en: 'We bought five books.',
        hl: 'пять книг'
      },
      {
        text: 'Урок идёт три часа.',
        zh: '课上三个小时。',
        en: 'The lesson lasts three hours.',
        hl: 'три часа'
      }
    ],
    patterns: [
      [
        form('два', 'две', 'три', 'четыре', 'оба', 'обе', '2', '3', '4'),
        adjOf('genitive'),
        { pos: 'noun', tags: ['genitive', 'singular'] }
      ],
      [
        form(
          'пять',
          'шесть',
          'семь',
          'восемь',
          'девять',
          'десять',
          'двадцать',
          'тридцать',
          'сто',
          '5',
          '6',
          '7',
          '8',
          '9',
          '10',
          '20',
          '100'
        ),
        adjOf('genitive'),
        { pos: 'noun', tags: ['genitive', 'plural'] }
      ]
    ]
  },
  {
    id: 'ru-imperative',
    level: 'teu',
    name: { zh: '命令式（читай、читайте）', en: 'Imperative (читай, читайте)' },
    form: {
      zh: '现在时词干 + -й / -и（单数），复数和敬称加 -те：читай(те)、говори(те)、сядь(те)',
      en: 'present stem + -й / -и (singular); add -те for plural and polite: читай(те), говори(те), сядь(те)'
    },
    meaning: {
      zh: '请求、命令、建议。对一个熟人用单数，对几个人或者客气地对一个人用 -те。',
      en: 'Requests, orders and advice. Singular to one familiar person; -те to several people or politely to one.'
    },
    notes: {
      zh: '请求时常加 пожалуйста。完成体命令式是要求做完一次（Закрой окно!），未完成体是叫人开始做、继续做或客气地邀请（Садитесь!）。',
      en: 'Add пожалуйста to soften it. Perfective asks for one completed action (Закрой окно!); imperfective tells someone to start, go on, or is a polite invitation (Садитесь!).'
    },
    examples: [
      { text: 'Читай громче!', zh: '读大声一点！', en: 'Read louder!', hl: 'Читай' },
      {
        text: 'Закройте, пожалуйста, окно.',
        zh: '请关上窗户。',
        en: 'Please close the window.',
        hl: 'Закройте'
      },
      { text: 'Иди сюда!', zh: '过来！', en: 'Come here!', hl: 'Иди' }
    ],
    patterns: [[{ pos: 'verb', tags: ['imperative'], not: { anyTags: ['present', 'future'] } }]]
  },
  {
    id: 'ru-potomu-chto',
    level: 'teu',
    name: { zh: 'потому что / поэтому（因为 / 所以）', en: 'потому что / поэтому (because / so)' },
    form: {
      zh: '……, потому что + 原因；原因, поэтому + 结果',
      en: '…, потому что + reason; reason, поэтому + result'
    },
    meaning: {
      zh: 'потому что 引出原因（因为），поэтому 引出结果（所以）。两者不能同时用在一个句子里。',
      en: 'потому что introduces the reason (because), поэтому the result (so). They are not used together in one sentence.'
    },
    examples: [
      {
        text: 'Я не пришёл, потому что болел.',
        zh: '我没来，因为我病了。',
        en: "I didn't come because I was ill.",
        hl: 'потому что'
      },
      {
        text: 'Шёл дождь, поэтому мы остались дома.',
        zh: '下雨了，所以我们待在家里。',
        en: 'It was raining, so we stayed at home.',
        hl: 'поэтому'
      }
    ],
    patterns: [[lemma('потому что')], [form('поэтому')], [form('потому'), form('что')]],
    group: 'cause'
  },

  // ═════════════ ТБУ（A2） ═════════════
  {
    id: 'ru-aspect',
    level: 'tbu',
    name: { zh: '动词的体：完成体与未完成体', en: 'Verbal aspect: perfective and imperfective' },
    form: {
      zh: '多数动词成对：делать / сделать、читать / прочитать、говорить / сказать、покупать / купить',
      en: 'Most verbs come in pairs: делать / сделать, читать / прочитать, говорить / сказать, покупать / купить'
    },
    meaning: {
      zh: '未完成体讲动作本身、过程、反复、习惯（Я читал книгу — 我看过书 / 在看书）；完成体讲动作完成、有结果、一次性的事（Я прочитал книгу — 我把书看完了）。',
      en: 'Imperfective presents the action itself, as a process, repeated or habitual (Я читал книгу); perfective presents it as completed, with a result, a single event (Я прочитал книгу).'
    },
    notes: {
      zh: '完成体没有现在时，它的「现在时」变位表示将来：прочитаю（我将读完）。词典里每个动词都标了体和配对。跟中文的「了」不对等：Я читал（我读过 / 我在读）不是「我读完了」。',
      en: 'Perfective verbs have no present; their present endings mean future: прочитаю. Every verb in the dictionary shows its aspect and partner. Not the same as Chinese 了.'
    },
    examples: [
      {
        text: 'Вчера я читал, а потом прочитал всю книгу.',
        zh: '昨天我在看书，后来把整本书看完了。',
        en: 'Yesterday I was reading, and then I finished the whole book.',
        hl: 'прочитал'
      },
      {
        text: 'Каждый день он покупает хлеб, а сегодня купил торт.',
        zh: '他每天买面包，今天买了个蛋糕。',
        en: 'Every day he buys bread, but today he bought a cake.',
        hl: 'купил'
      }
    ],
    group: 'aspect'
  },
  {
    id: 'ru-motion',
    level: 'tbu',
    name: {
      zh: '运动动词：идти / ходить、ехать / ездить',
      en: 'Verbs of motion: идти / ходить, ехать / ездить'
    },
    form: {
      zh: '定向动词（идти、ехать、лететь、бежать……）与不定向动词（ходить、ездить、летать、бегать……）成对',
      en: 'Pairs of unidirectional (идти, ехать, лететь, бежать…) and multidirectional verbs (ходить, ездить, летать, бегать…)'
    },
    meaning: {
      zh: '定向动词表示朝一个方向、正在进行的一次移动（Я иду в школу — 我正走去学校）；不定向动词表示来回、反复、习惯或一般的能力（Я хожу в школу — 我上学）。идти 是走路，ехать 是乘车。',
      en: 'Unidirectional verbs describe one trip in progress in one direction (Я иду в школу); multidirectional ones describe round trips, repetition, habit or ability (Я хожу в школу). идти is on foot, ехать by vehicle.'
    },
    examples: [
      {
        text: 'Сейчас я иду в магазин.',
        zh: '我现在正去商店。',
        en: "I'm going to the shop now.",
        hl: 'иду'
      },
      {
        text: 'Каждое утро он ходит в парк.',
        zh: '他每天早上去公园。',
        en: 'Every morning he goes to the park.',
        hl: 'ходит'
      },
      {
        text: 'Летом мы ездили на море.',
        zh: '夏天我们去了海边（又回来了）。',
        en: 'In the summer we went to the seaside.',
        hl: 'ездили'
      }
    ],
    patterns: [[lemma(...MOTION)]],
    group: 'motion'
  },
  {
    id: 'ru-comparative',
    level: 'tbu',
    name: { zh: '比较级：больше, чем…', en: 'Comparative: больше, чем…' },
    form: {
      zh: '形容词 / 副词的比较级（-ее、-е，不规则的 лучше、хуже、больше、меньше）+ чем + 比较的对象',
      en: 'comparative in -ее / -е (irregular лучше, хуже, больше, меньше) + чем + what is compared'
    },
    meaning: {
      zh: '比较两样东西。比较级本身不变。也可以不用 чем、直接用属格：Москва больше Петербурга。',
      en: 'Compares two things. The comparative does not change. Instead of чем you can use the genitive: Москва больше Петербурга.'
    },
    examples: [
      {
        text: 'Москва больше, чем Петербург.',
        zh: '莫斯科比彼得堡大。',
        en: 'Moscow is bigger than St Petersburg.',
        hl: 'больше, чем'
      },
      {
        text: 'Сегодня теплее, чем вчера.',
        zh: '今天比昨天暖和。',
        en: "It's warmer today than yesterday.",
        hl: 'теплее, чем'
      }
    ],
    patterns: [[{ anyTags: ['comparative'] }, form('чем')]],
    group: 'comparison'
  },
  {
    id: 'ru-superlative',
    level: 'tbu',
    name: { zh: '最高级：самый + 形容词', en: 'Superlative: самый + adjective' },
    form: {
      zh: 'самый + 形容词（两个都跟名词的性、数、格一致）',
      en: 'самый + adjective (both agree with the noun)'
    },
    meaning: {
      zh: '「最……的」。самый 跟后面的形容词一样变：самая красивая улица、в самом большом городе。',
      en: '"The most…". самый declines like the adjective after it: самая красивая улица, в самом большом городе.'
    },
    examples: [
      {
        text: 'Это самый красивый город.',
        zh: '这是最美的城市。',
        en: 'This is the most beautiful city.',
        hl: 'самый красивый'
      },
      {
        text: 'Она живёт на самой длинной улице.',
        zh: '她住在最长的那条街上。',
        en: 'She lives on the longest street.',
        hl: 'самой длинной'
      }
    ],
    patterns: [[lemma('самый'), { pos: 'adj' }]],
    group: 'comparison'
  },
  {
    id: 'ru-nado-nuzhno',
    level: 'tbu',
    name: {
      zh: 'мне надо / нужно + 不定式（需要、得）',
      en: 'мне надо / нужно + infinitive (need to)'
    },
    form: {
      zh: '与格 + надо / нужно / необходимо + 不定式',
      en: 'dative + надо / нужно / необходимо + infinitive'
    },
    meaning: {
      zh: '「某人得做……」。需要做的人用与格，句子没有主语。',
      en: '"Someone needs to / has to…". The person goes into the dative; the sentence has no subject.'
    },
    notes: {
      zh: '过去时、将来时加 было、будет：Мне надо было уйти。нужно 后面也可以接名词（主格）：Мне нужна помощь（нужна 跟名词一致）。',
      en: 'Past and future add было, будет: Мне надо было уйти. With a noun use the agreeing short form: Мне нужна помощь.'
    },
    examples: [
      { text: 'Мне нужно идти.', zh: '我得走了。', en: 'I have to go.', hl: 'Мне нужно идти' },
      {
        text: 'Тебе надо больше спать.',
        zh: '你得多睡点。',
        en: 'You need to sleep more.',
        hl: 'Тебе надо больше спать'
      }
    ],
    patterns: [[caseOf('dative'), form('надо', 'нужно', 'необходимо'), gap(INF, 2)]],
    group: 'modal'
  },
  {
    id: 'ru-dolzhen',
    level: 'tbu',
    name: { zh: 'должен + 不定式（应该、必须）', en: 'должен + infinitive (must)' },
    form: {
      zh: 'должен / должна / должно / должны + 不定式',
      en: 'должен / должна / должно / должны + infinitive'
    },
    meaning: {
      zh: '「应该、必须」。должен 跟主语的性、数一致，主语用主格（跟 надо 不同）。',
      en: '"Must, should". должен agrees with the subject, which is in the nominative (unlike надо).'
    },
    examples: [
      {
        text: 'Ты должен сделать уроки.',
        zh: '你得把功课做完。',
        en: 'You must do your homework.',
        hl: 'должен сделать'
      },
      {
        text: 'Мы должны помочь им.',
        zh: '我们应该帮助他们。',
        en: 'We should help them.',
        hl: 'должны помочь'
      }
    ],
    patterns: [[form('должен', 'должна', 'должно', 'должны'), gap(INF, 1)]],
    group: 'modal'
  },
  {
    id: 'ru-impersonal-state',
    level: 'tbu',
    name: {
      zh: '无人称句：мне холодно（我觉得冷）',
      en: 'Impersonal state: мне холодно (I feel cold)'
    },
    form: {
      zh: '与格 + 以 -о 结尾的状态词（холодно、скучно、трудно……）',
      en: 'dative + state word in -о (холодно, скучно, трудно…)'
    },
    meaning: {
      zh: '说人的感觉、状态。感受的人用与格：Мне холодно（我冷）、Ему скучно（他觉得无聊）。',
      en: 'Describes how someone feels. The person goes into the dative: Мне холодно, Ему скучно.'
    },
    examples: [
      { text: 'Мне холодно.', zh: '我冷。', en: "I'm cold.", hl: 'Мне холодно' },
      {
        text: 'Детям было скучно.',
        zh: '孩子们觉得无聊。',
        en: 'The children were bored.',
        hl: 'Детям было скучно'
      }
    ],
    patterns: [
      [
        caseOf('dative'),
        optional(form('было', 'будет')),
        form(
          'холодно',
          'жарко',
          'тепло',
          'скучно',
          'грустно',
          'весело',
          'трудно',
          'легко',
          'интересно',
          'стыдно',
          'больно',
          'страшно',
          'приятно',
          'удобно',
          'плохо',
          'хорошо',
          'одиноко',
          'жаль'
        )
      ]
    ]
  },
  {
    id: 'ru-esli',
    level: 'tbu',
    name: { zh: 'если（如果）', en: 'если (if)' },
    form: { zh: 'Если + 条件, (то) + 结果', en: 'Если + condition, (то) + result' },
    meaning: {
      zh: '真实的条件：如果……就……。说将来的事时，条件句也用将来时（俄语跟中文一样，跟英语不同）：Если будет дождь, мы останемся дома。',
      en: 'A real condition. When talking about the future, the если-clause also uses the future tense: Если будет дождь, мы останемся дома.'
    },
    examples: [
      {
        text: 'Если будет дождь, мы останемся дома.',
        zh: '如果下雨，我们就待在家里。',
        en: 'If it rains, we will stay at home.',
        hl: 'Если'
      },
      {
        text: 'Позвони, если опоздаешь.',
        zh: '要是你会晚到，就打个电话。',
        en: "Call if you're going to be late.",
        hl: 'если'
      }
    ],
    patterns: [[form('если')]],
    group: 'condition'
  },
  {
    id: 'ru-chto-clause',
    level: 'tbu',
    name: { zh: 'что 引出的宾语从句（我知道……）', en: 'что-clauses (I know that…)' },
    form: {
      zh: '说、想、知道类动词 + , что + 从句',
      en: 'verb of saying / thinking / knowing + , что + clause'
    },
    meaning: {
      zh: '引出说的、想的、知道的内容，相当于「……（这件事）」。从句前一定要有逗号，что 不能省。',
      en: 'Introduces reported content, like English "that". A comma always comes before что, and что cannot be dropped.'
    },
    examples: [
      {
        text: 'Я думаю, что он прав.',
        zh: '我觉得他是对的。',
        en: 'I think he is right.',
        hl: 'думаю, что'
      },
      {
        text: 'Она сказала, что придёт завтра.',
        zh: '她说她明天来。',
        en: "She said she'd come tomorrow.",
        hl: 'сказала, что'
      }
    ],
    patterns: [
      [
        lemma(
          'знать',
          'думать',
          'сказать',
          'говорить',
          'понимать',
          'понять',
          'видеть',
          'слышать',
          'писать',
          'написать',
          'считать',
          'узнать',
          'помнить',
          'надеяться',
          'чувствовать',
          'объяснить',
          'ответить',
          'рассказать',
          'забыть'
        ),
        form('что')
      ]
    ],
    group: 'clause'
  },
  {
    id: 'ru-kotoryj',
    level: 'tbu',
    name: { zh: '关系从句 который（……的）', en: 'Relative clauses with который' },
    form: {
      zh: '名词, + который（跟名词的性、数一致，格看它在从句里的作用）',
      en: 'noun, + который (gender and number from the noun, case from its role in the clause)'
    },
    meaning: {
      zh: '修饰名词，相当于中文的「……的」。который 的性、数跟前面的名词，格按它在从句里的作用：книга, которую я читаю（我在看的书）。',
      en: 'Modifies a noun. который takes gender and number from the noun but its case from its role in the clause: книга, которую я читаю.'
    },
    examples: [
      {
        text: 'Это книга, которую я читаю.',
        zh: '这是我在看的书。',
        en: "This is the book I'm reading.",
        hl: 'которую'
      },
      {
        text: 'Я знаю человека, который живёт там.',
        zh: '我认识住在那里的人。',
        en: 'I know the man who lives there.',
        hl: 'который'
      }
    ],
    patterns: [[lemma('который')]],
    group: 'clause'
  },
  {
    id: 'ru-davaj',
    level: 'tbu',
    name: { zh: 'давай(те) + 动词（我们……吧）', en: 'давай(те) + verb (let’s…)' },
    form: {
      zh: 'давай / давайте + 完成体第一人称复数（давай пойдём）或未完成体不定式（давай играть）',
      en: 'давай / давайте + perfective 1st-person plural (давай пойдём) or imperfective infinitive (давай играть)'
    },
    meaning: {
      zh: '提议一起做某事。对一个熟人用 давай，对几个人或客气时用 давайте。',
      en: 'Suggests doing something together; давай to one familiar person, давайте to several or politely.'
    },
    examples: [
      {
        text: 'Давайте пойдём в кино.',
        zh: '我们去看电影吧。',
        en: "Let's go to the cinema.",
        hl: 'Давайте пойдём'
      },
      {
        text: 'Давай играть в шахматы.',
        zh: '我们下象棋吧。',
        en: "Let's play chess.",
        hl: 'Давай играть'
      }
    ],
    patterns: [
      [form('давай', 'давайте'), { pos: 'verb', tags: ['first-person', 'plural'] }],
      [form('давай', 'давайте'), INF]
    ]
  },
  {
    id: 'ru-s-instr',
    level: 'tbu',
    name: { zh: 'с + 工具格（和……一起）', en: 'с + instrumental (with)' },
    form: { zh: 'с / со + 工具格', en: 'с / со + instrumental' },
    meaning: {
      zh: '「和……一起」「带着……」：кофе с молоком（加奶的咖啡）、Мы с тобой（我和你）。',
      en: '"With, together with": кофе с молоком, Мы с тобой (you and I).'
    },
    examples: [
      {
        text: 'Я пью кофе с молоком.',
        zh: '我喝加奶的咖啡。',
        en: 'I drink coffee with milk.',
        hl: 'с молоком'
      },
      {
        text: 'Мы с тобой давно знакомы.',
        zh: '我和你认识很久了。',
        en: 'You and I have known each other for a long time.',
        hl: 'с тобой'
      }
    ],
    patterns: [[lemma('с', 'со'), adjOf('instrumental'), caseOf('instrumental')]]
  },
  {
    id: 'ru-age',
    level: 'tbu',
    name: { zh: '年龄：мне двадцать лет', en: 'Age: мне двадцать лет' },
    form: { zh: '与格 + 数词 + год / года / лет', en: 'dative + numeral + год / года / лет' },
    meaning: {
      zh: '说年龄：人用与格。год 跟着数词变：один год、два года、пять лет。问年龄：Сколько тебе лет?',
      en: 'States age; the person is in the dative. год follows the numeral rule: один год, два года, пять лет. Ask: Сколько тебе лет?'
    },
    examples: [
      { text: 'Мне двадцать лет.', zh: '我二十岁。', en: "I'm twenty.", hl: 'Мне двадцать лет' },
      {
        text: 'Сестре три года.',
        zh: '妹妹三岁。',
        en: 'My sister is three.',
        hl: 'Сестре три года'
      }
    ],
    patterns: [[caseOf('dative'), { pos: 'num' }, form('год', 'года', 'лет')]]
  },
  {
    id: 'ru-reflexive',
    level: 'tbu',
    name: { zh: '-ся 动词', en: 'Verbs in -ся' },
    form: {
      zh: '动词 + -ся（元音后写 -сь）：учиться、улыбаться、начинаться',
      en: 'verb + -ся (-сь after a vowel): учиться, улыбаться, начинаться'
    },
    meaning: {
      zh: '-ся 可以表示反身（одеваться 给自己穿衣）、相互（встречаться 见面）、被动（дом строится 房子在建）、自发（урок начинается 课开始了），也有很多词只有 -ся 的形式（смеяться、нравиться）。-ся 动词不带宾格宾语。',
      en: '-ся can be reflexive (одеваться), reciprocal (встречаться), passive (дом строится), or mark a spontaneous event (урок начинается); many verbs exist only with -ся (смеяться, нравиться). They never take a direct object.'
    },
    examples: [
      {
        text: 'Урок начинается в девять.',
        zh: '课九点开始。',
        en: 'The lesson starts at nine.',
        hl: 'начинается'
      },
      { text: 'Она улыбнулась.', zh: '她笑了。', en: 'She smiled.', hl: 'улыбнулась' }
    ],
    patterns: [[{ pos: 'verb', surface: accentable('(ся|сь)$'), not: { anyTags: ['participle'] } }]]
  },

  // ═════════════ ТРКИ-1（B1） ═════════════
  {
    id: 'ru-chtoby-inf',
    level: 'trki1',
    name: { zh: 'чтобы + 不定式（为了）', en: 'чтобы + infinitive (in order to)' },
    form: { zh: '……, чтобы + 不定式（主语相同）', en: '…, чтобы + infinitive (same subject)' },
    meaning: {
      zh: '表示目的：「为了……」。两部分是同一个主语时用不定式。',
      en: 'Expresses purpose when both parts have the same subject.'
    },
    examples: [
      {
        text: 'Мы пришли, чтобы помочь.',
        zh: '我们是来帮忙的。',
        en: 'We came to help.',
        hl: 'чтобы помочь'
      },
      {
        text: 'Он учит русский, чтобы читать Толстого.',
        zh: '他学俄语是为了读托尔斯泰。',
        en: 'He is learning Russian in order to read Tolstoy.',
        hl: 'чтобы читать'
      }
    ],
    patterns: [[form('чтобы', 'чтоб'), gap(INF, 2)]],
    group: 'purpose'
  },
  {
    id: 'ru-chtoby-past',
    level: 'trki1',
    name: {
      zh: 'хочу, чтобы + 过去时（希望别人……）',
      en: 'хочу, чтобы + past tense (want someone to…)'
    },
    form: {
      zh: 'хотеть / просить / сказать…, чтобы + 主语 + 动词过去时',
      en: 'хотеть / просить / сказать…, чтобы + subject + past-tense verb'
    },
    meaning: {
      zh: '希望、请求、要求别人做某事。主语跟主句不同，чтобы 后面的动词一定用过去时形式（不表示过去）：Я хочу, чтобы ты пришёл（我希望你来）。',
      en: 'Wanting or asking someone else to do something. With a different subject, the verb after чтобы is always in the past form, though it does not mean past: Я хочу, чтобы ты пришёл.'
    },
    examples: [
      {
        text: 'Я хочу, чтобы ты пришёл.',
        zh: '我希望你来。',
        en: 'I want you to come.',
        hl: 'чтобы ты пришёл'
      },
      {
        text: 'Мама просит, чтобы мы не шумели.',
        zh: '妈妈要我们别吵。',
        en: 'Mum is asking us not to make noise.',
        hl: 'чтобы мы не шумели'
      }
    ],
    patterns: [
      [
        form('чтобы', 'чтоб'),
        { pos: ['pron', 'noun', 'propn'] },
        gap({ pos: 'verb', tags: ['past'] }, 1)
      ]
    ],
    group: 'purpose'
  },
  {
    id: 'ru-conditional',
    level: 'trki1',
    name: { zh: '假定式：если бы…, … бы（要是……就……）', en: 'Conditional mood: если бы…, … бы' },
    form: {
      zh: 'бы + 动词过去时形式（两个分句都要 бы）',
      en: 'бы + past-tense form of the verb (both clauses take бы)'
    },
    meaning: {
      zh: '与事实相反、不太可能的条件，或者委婉的愿望。动词总用过去时形式，时间看上下文：Если бы я знал, я бы пришёл（要是我知道，我就来了 / 就会来）。Я бы хотел…（我想……，比 хочу 客气）。',
      en: 'Unreal or unlikely conditions, or polite wishes. The verb is always in the past form; the time comes from the context: Если бы я знал, я бы пришёл. Я бы хотел… is politer than хочу.'
    },
    examples: [
      {
        text: 'Если бы я знал, я бы пришёл.',
        zh: '要是我知道，我就来了。',
        en: "If I'd known, I would have come.",
        hl: 'бы пришёл'
      },
      {
        text: 'Я бы хотел чаю.',
        zh: '我想喝点茶。',
        en: "I'd like some tea.",
        hl: 'бы хотел'
      },
      {
        text: 'Ты помог бы мне?',
        zh: '你能帮我一下吗？',
        en: 'Would you help me?',
        hl: 'помог бы'
      }
    ],
    patterns: [
      [form('бы', 'б'), { pos: 'verb', tags: ['past'] }],
      [{ pos: 'verb', tags: ['past'] }, form('бы', 'б')]
    ],
    group: 'condition'
  },
  {
    id: 'ru-motion-prefixed',
    level: 'trki1',
    name: {
      zh: '带前缀的运动动词（прийти、уйти、войти……）',
      en: 'Prefixed verbs of motion (прийти, уйти, войти…)'
    },
    form: {
      zh: '前缀 + 运动动词：при-（到来）、у-（离开）、в-（进入）、вы-（出去）、под-（走近）、от-（走开）、за-（顺路去）、пере-（越过）、про-（经过）、до-（到达）',
      en: 'prefix + verb of motion: при- (arrive), у- (leave), в- (enter), вы- (exit), под- (approach), от- (move away), за- (drop in), пере- (cross), про- (pass), до- (reach)'
    },
    meaning: {
      zh: '前缀给运动加上方向。加在定向动词上成完成体（прийти），加在不定向动词上成未完成体（приходить），两个正好成为体的配对。идти 加前缀写成 -йти。',
      en: 'The prefix adds direction. With a unidirectional verb it makes a perfective (прийти), with a multidirectional one an imperfective (приходить): the two form an aspect pair. идти becomes -йти.'
    },
    examples: [
      {
        text: 'Он пришёл домой поздно.',
        zh: '他很晚才到家。',
        en: 'He came home late.',
        hl: 'пришёл'
      },
      {
        text: 'Она вышла из комнаты.',
        zh: '她从房间里出去了。',
        en: 'She went out of the room.',
        hl: 'вышла'
      },
      {
        text: 'Мы переехали в новую квартиру.',
        zh: '我们搬进了新公寓。',
        en: 'We moved into a new flat.',
        hl: 'переехали'
      }
    ],
    patterns: [[lemma(...PREFIXED_MOTION)]],
    group: 'motion'
  },
  {
    id: 'ru-indefinite',
    level: 'trki1',
    name: { zh: '不定代词：-то、-нибудь、кое-', en: 'Indefinite pronouns: -то, -нибудь, кое-' },
    form: {
      zh: '疑问词 + -то / -нибудь / -либо，或者 кое- + 疑问词：кто-то、что-нибудь、где-то、кое-что',
      en: 'question word + -то / -нибудь / -либо, or кое- + question word: кто-то, что-нибудь, где-то, кое-что'
    },
    meaning: {
      zh: '-то：确有其人其物，只是说话人不知道或不说（Кто-то звонил — 有人打过电话）；-нибудь：随便哪一个，用在问句、命令、将来（Кто-нибудь звонил? — 有没有人打过电话？）；кое-：说话人知道，但先不说（кое-что — 某件事）。',
      en: '-то: a definite but unknown or unnamed one (Кто-то звонил); -нибудь: any one at all, in questions, requests and the future (Кто-нибудь звонил?); кое-: known to the speaker but not said (кое-что).'
    },
    examples: [
      {
        text: 'Кто-то стучит в дверь.',
        zh: '有人在敲门。',
        en: 'Someone is knocking at the door.',
        hl: 'Кто-то'
      },
      {
        text: 'Ты что-нибудь знаешь?',
        zh: '你知道点什么吗？',
        en: 'Do you know anything?',
        hl: 'что-нибудь'
      },
      {
        text: 'Я хочу тебе кое-что сказать.',
        zh: '我想跟你说件事。',
        en: 'I want to tell you something.',
        hl: 'кое-что'
      }
    ],
    patterns: [
      [{ pos: ['pron', 'adv', 'det'], surface: accentable('-(то|нибудь|либо)$') }],
      [{ pos: ['pron', 'adv', 'det'], surface: /^[Кк]ое-/ }]
    ]
  },
  {
    id: 'ru-negative-ni',
    level: 'trki1',
    name: { zh: '否定代词 никто / ничего + не', en: 'Negative pronouns никто / ничего + не' },
    form: {
      zh: 'никто、ничто、никогда、нигде、никуда、никакой…… + не + 动词',
      en: 'никто, ничто, никогда, нигде, никуда, никакой… + не + verb'
    },
    meaning: {
      zh: '俄语的否定是「双重」的：句子里有 ни- 开头的词时，动词前还要有 не：Никто не пришёл（没有人来）、Я ничего не знаю（我什么也不知道）。',
      en: 'Russian uses double negation: with a ни- word the verb still needs не: Никто не пришёл, Я ничего не знаю.'
    },
    examples: [
      { text: 'Никто не пришёл.', zh: '没有人来。', en: 'Nobody came.', hl: 'Никто не' },
      {
        text: 'Я ничего не знаю.',
        zh: '我什么也不知道。',
        en: "I don't know anything.",
        hl: 'ничего не'
      },
      {
        text: 'Он никогда не опаздывает.',
        zh: '他从不迟到。',
        en: 'He is never late.',
        hl: 'никогда не'
      }
    ],
    patterns: [
      [
        lemma(
          'никто',
          'ничто',
          'ничего',
          'никогда',
          'нигде',
          'никуда',
          'никакой',
          'ниоткуда',
          'нисколько',
          'никак'
        ),
        gap(form('не'), 2)
      ]
    ]
  },
  {
    id: 'ru-cherez-nazad',
    level: 'trki1',
    name: { zh: 'через… / … назад（……之后 / ……以前）', en: 'через… / … назад (in… / …ago)' },
    form: {
      zh: 'через + 宾格；时间段（宾格）+ назад',
      en: 'через + accusative; time span (accusative) + назад'
    },
    meaning: {
      zh: 'через неделю（一周以后）；неделю назад（一周以前）。',
      en: 'через неделю (in a week); неделю назад (a week ago).'
    },
    examples: [
      {
        text: 'Я вернусь через неделю.',
        zh: '我一周后回来。',
        en: "I'll be back in a week.",
        hl: 'через неделю'
      },
      {
        text: 'Мы встретились год назад.',
        zh: '我们是一年前认识的。',
        en: 'We met a year ago.',
        hl: 'год назад'
      },
      {
        text: 'Поезд уходит через два часа.',
        zh: '火车两小时后开。',
        en: 'The train leaves in two hours.',
        hl: 'через два часа'
      }
    ],
    patterns: [
      [form('через'), caseOf('accusative', ['noun'])],
      [form('через'), { pos: 'num' }, { pos: 'noun' }],
      [optional({ pos: 'num' }), { pos: 'noun' }, form('назад')]
    ],
    group: 'time'
  },
  {
    id: 'ru-stat-instr',
    level: 'trki1',
    name: {
      zh: 'стать / быть / работать + 工具格（成为、当）',
      en: 'стать / быть / работать + instrumental (become, be, work as)'
    },
    form: {
      zh: 'стать、становиться、быть（过去、将来）、работать、являться + 工具格',
      en: 'стать, становиться, быть (past, future), работать, являться + instrumental'
    },
    meaning: {
      zh: '表示身份、职业、状态的变化：Он стал врачом（他成了医生）、Она работает учителем（她当老师）、В детстве он был спортсменом（他小时候是运动员）。',
      en: 'States a role, profession or change of state: Он стал врачом, Она работает учителем, В детстве он был спортсменом.'
    },
    examples: [
      {
        text: 'Он хочет стать врачом.',
        zh: '他想当医生。',
        en: 'He wants to become a doctor.',
        hl: 'стать врачом'
      },
      {
        text: 'Моя мама работает учителем.',
        zh: '我妈妈当老师。',
        en: 'My mum works as a teacher.',
        hl: 'работает учителем'
      },
      {
        text: 'Москва является столицей России.',
        zh: '莫斯科是俄罗斯的首都。',
        en: 'Moscow is the capital of Russia.',
        hl: 'является столицей'
      }
    ],
    patterns: [
      [
        lemma(
          'стать',
          'становиться',
          'быть',
          'работать',
          'являться',
          'оказаться',
          'оставаться',
          'остаться',
          'считаться',
          'казаться'
        ),
        adjOf('instrumental'),
        caseOf('instrumental', ['noun'])
      ]
    ],
    group: 'instrumental'
  },
  {
    id: 'ru-zanimatsya-instr',
    level: 'trki1',
    name: {
      zh: 'заниматься / интересоваться + 工具格',
      en: 'заниматься / интересоваться + instrumental'
    },
    form: {
      zh: 'заниматься、интересоваться、увлекаться、пользоваться、гордиться、руководить、управлять + 工具格',
      en: 'заниматься, интересоваться, увлекаться, пользоваться, гордиться, руководить, управлять + instrumental'
    },
    meaning: {
      zh: '这些动词的宾语用工具格：заниматься спортом（做运动）、интересоваться музыкой（对音乐感兴趣）、гордиться сыном（为儿子骄傲）。',
      en: 'These verbs take their object in the instrumental: заниматься спортом, интересоваться музыкой, гордиться сыном.'
    },
    examples: [
      {
        text: 'Он занимается спортом.',
        zh: '他从事体育运动。',
        en: 'He does sport.',
        hl: 'занимается спортом'
      },
      {
        text: 'Она интересуется русской литературой.',
        zh: '她对俄罗斯文学感兴趣。',
        en: 'She is interested in Russian literature.',
        hl: 'интересуется русской литературой'
      }
    ],
    patterns: [
      [
        lemma(
          'заниматься',
          'интересоваться',
          'увлекаться',
          'пользоваться',
          'гордиться',
          'руководить',
          'управлять',
          'владеть',
          'восхищаться',
          'любоваться',
          'дорожить'
        ),
        adjOf('instrumental'),
        caseOf('instrumental')
      ]
    ],
    group: 'instrumental'
  },
  {
    id: 'ru-drug-druga',
    level: 'trki1',
    name: { zh: 'друг друга（互相）', en: 'друг друга (each other)' },
    form: {
      zh: 'друг + друга / другу / другом / (前置词 +) друге',
      en: 'друг + друга / другу / другом / (preposition +) друге'
    },
    meaning: {
      zh: '「互相」。第一个 друг 不变，第二个按动词的要求变格，前置词放在两个词中间：друг о друге、друг с другом。',
      en: '"Each other". The first друг never changes; the second takes the case required by the verb, and a preposition goes between them: друг о друге, друг с другом.'
    },
    examples: [
      {
        text: 'Они любят друг друга.',
        zh: '他们彼此相爱。',
        en: 'They love each other.',
        hl: 'друг друга'
      },
      {
        text: 'Мы часто думаем друг о друге.',
        zh: '我们常常想念彼此。',
        en: 'We often think about each other.',
        hl: 'друг о друге'
      }
    ],
    patterns: [
      [form('друг'), form('друга', 'другу', 'другом')],
      [form('друг'), { pos: 'adp' }, form('друга', 'другу', 'другом', 'друге')]
    ]
  },
  {
    id: 'ru-quantity-gen',
    level: 'trki1',
    name: { zh: 'много / мало / сколько + 属格', en: 'много / мало / сколько + genitive' },
    form: {
      zh: 'много、мало、сколько、несколько、немного + 属格（可数的用复数，不可数的用单数）',
      en: 'много, мало, сколько, несколько, немного + genitive (plural for countables, singular for mass nouns)'
    },
    meaning: {
      zh: '表示数量：много книг（很多书）、мало времени（时间很少）。',
      en: 'Expresses quantity: много книг, мало времени.'
    },
    examples: [
      {
        text: 'У него много книг.',
        zh: '他有很多书。',
        en: 'He has a lot of books.',
        hl: 'много книг'
      },
      {
        text: 'У нас мало времени.',
        zh: '我们时间不多。',
        en: "We don't have much time.",
        hl: 'мало времени'
      },
      {
        text: 'Сколько у тебя друзей?',
        zh: '你有多少朋友？',
        en: 'How many friends do you have?',
        hl: 'Сколько у тебя друзей'
      }
    ],
    patterns: [
      [
        form('много', 'мало', 'сколько', 'несколько', 'немного', 'немало'),
        adjOf('genitive'),
        caseOf('genitive', ['noun'])
      ],
      [form('сколько'), lemma('у'), caseOf('genitive'), caseOf('genitive', ['noun'])]
    ]
  },
  {
    id: 'ru-short-passive',
    level: 'trki1',
    name: {
      zh: '短尾被动形动词：построен、написано',
      en: 'Short passive participles: построен, написано'
    },
    form: {
      zh: '（быть +）完成体动词的短尾被动形动词：-н / -на / -но / -ны、-т / -та / -то / -ты',
      en: '(быть +) short passive participle of a perfective verb: -н / -на / -но / -ны, -т / -та / -то / -ты'
    },
    meaning: {
      zh: '被动：「被……了」。说明动作完成后的状态，跟主语的性、数一致；过去、将来加 был、будет：Дом был построен в прошлом году。',
      en: 'Passive: "has been / was done". Describes the state after the action, agrees with the subject; past and future add был, будет: Дом был построен в прошлом году.'
    },
    examples: [
      {
        text: 'Дом был построен в прошлом году.',
        zh: '房子是去年建成的。',
        en: 'The house was built last year.',
        hl: 'был построен'
      },
      { text: 'Магазин закрыт.', zh: '商店关门了。', en: 'The shop is closed.', hl: 'закрыт' },
      {
        text: 'Письмо написано по-русски.',
        zh: '信是用俄语写的。',
        en: 'The letter is written in Russian.',
        hl: 'написано'
      }
    ],
    patterns: [
      [optional(lemma('быть')), { pos: 'verb', tags: ['participle', 'passive', 'short-form'] }]
    ],
    group: 'passive'
  },
  {
    id: 'ru-tot-kto',
    level: 'trki1',
    name: {
      zh: 'тот, кто / то, что（……的人 / ……的事）',
      en: 'тот, кто / то, что (the one who / what)'
    },
    form: {
      zh: 'тот / то（按在主句里的作用变格）+ , кто / что + 从句',
      en: 'тот / то (case from its role in the main clause) + , кто / что + clause'
    },
    meaning: {
      zh: '「……的人」「……的事」。тот、то 的格看它在主句里的作用：Я рад тому, что ты пришёл（我为你来了而高兴）。',
      en: '"The one who / the thing that". The case of тот / то depends on the main clause: Я рад тому, что ты пришёл.'
    },
    examples: [
      {
        text: 'Тот, кто рано встаёт, много успевает.',
        zh: '早起的人能做很多事。',
        en: 'Those who get up early get a lot done.',
        hl: 'Тот, кто'
      },
      {
        text: 'Я рад тому, что ты пришёл.',
        zh: '你来了我很高兴。',
        en: "I'm glad that you came.",
        hl: 'тому, что'
      }
    ],
    patterns: [[lemma('тот'), form('кто', 'что')]],
    group: 'clause'
  },
  {
    id: 'ru-ne-tolko',
    level: 'trki1',
    name: {
      zh: 'не только…, но и…（不但……而且……）',
      en: 'не только…, но и… (not only… but also…)'
    },
    form: { zh: 'не только + A, но и + B', en: 'не только + A, но и + B' },
    meaning: {
      zh: '递进：不但……而且……。',
      en: 'Adds a second, stronger point: not only… but also….'
    },
    examples: [
      {
        text: 'Она говорит не только по-русски, но и по-китайски.',
        zh: '她不但会说俄语，还会说汉语。',
        en: 'She speaks not only Russian but also Chinese.',
        hl: 'не только по-русски, но и'
      }
    ],
    patterns: [[form('не'), form('только'), gap(form('но'), 5), form('и')]]
  },
  {
    id: 'ru-pust',
    level: 'trki1',
    name: { zh: 'пусть + 第三人称（让他……吧）', en: 'пусть + third person (let him…)' },
    form: {
      zh: 'пусть / пускай + 主语 + 第三人称动词',
      en: 'пусть / пускай + subject + third-person verb'
    },
    meaning: {
      zh: '对第三人称的祈使、允许：Пусть он придёт（让他来吧）。',
      en: 'An instruction or permission for a third person: Пусть он придёт.'
    },
    examples: [
      {
        text: 'Пусть он придёт завтра.',
        zh: '让他明天来吧。',
        en: 'Let him come tomorrow.',
        hl: 'Пусть он придёт'
      },
      {
        text: 'Пусть дети играют.',
        zh: '让孩子们玩吧。',
        en: 'Let the children play.',
        hl: 'Пусть дети играют'
      }
    ],
    patterns: [
      [
        form('пусть', 'пускай'),
        { pos: ['pron', 'noun', 'propn'] },
        { pos: 'verb', tags: ['third-person'] }
      ]
    ]
  },
  {
    id: 'ru-li',
    level: 'trki1',
    name: { zh: '语气词 ли（是否；间接问句）', en: 'Particle ли (whether; indirect questions)' },
    form: { zh: '要问的那个词 + ли', en: 'the word in question + ли' },
    meaning: {
      zh: '「是否、……没有」，多用在间接问句里：Я не знаю, придёт ли он（我不知道他来不来）。ли 放在被问的那个词后面。',
      en: '"Whether", mostly in indirect questions: Я не знаю, придёт ли он. ли follows the word being asked about.'
    },
    examples: [
      {
        text: 'Я не знаю, придёт ли он.',
        zh: '我不知道他来不来。',
        en: "I don't know whether he'll come.",
        hl: 'придёт ли'
      },
      {
        text: 'Спроси, есть ли билеты.',
        zh: '问问还有没有票。',
        en: 'Ask whether there are tickets.',
        hl: 'есть ли'
      }
    ],
    patterns: [[{ pos: 'verb' }, form('ли')]]
  },
  {
    id: 'ru-poka-ne',
    level: 'trki1',
    name: { zh: 'пока не（直到……为止）', en: 'пока не (until)' },
    form: { zh: '……, пока не + 完成体动词', en: '…, пока не + perfective verb' },
    meaning: {
      zh: '「直到……为止」：Подожди, пока он не придёт（等到他来）。这里的 не 不表示否定。',
      en: '"Until": Подожди, пока он не придёт. The не here is not a negation.'
    },
    examples: [
      {
        text: 'Подожди, пока он не придёт.',
        zh: '等他来了再说。',
        en: 'Wait until he comes.',
        hl: 'пока он не придёт'
      }
    ],
    patterns: [
      [
        form('пока'),
        optional({ pos: ['pron', 'noun', 'propn'] }),
        form('не'),
        { pos: 'verb', tags: ['perfective'] }
      ]
    ],
    group: 'time'
  },

  // ═════════════ ТРКИ-2（B2） ═════════════
  {
    id: 'ru-participle-active',
    level: 'trki2',
    name: { zh: '主动形动词（читающий、читавший）', en: 'Active participles (читающий, читавший)' },
    form: {
      zh: '现在时：现在时词干 + -ущ- / -ющ- / -ащ- / -ящ- + 形容词词尾；过去时：过去时词干 + -вш- / -ш- + 形容词词尾',
      en: 'present: present stem + -ущ- / -ющ- / -ащ- / -ящ- + adjective ending; past: past stem + -вш- / -ш- + adjective ending'
    },
    meaning: {
      zh: '「正在……的」「……过的」，像形容词一样修饰名词、跟名词一致，代替 который 从句，多用于书面语：студент, читающий книгу = студент, который читает книгу。',
      en: 'Verb-adjectives meaning "who is doing / who did", agreeing with the noun; a written-style replacement for который-clauses: студент, читающий книгу = студент, который читает книгу.'
    },
    examples: [
      {
        text: 'Я вижу студента, читающего газету.',
        zh: '我看见一个正在看报的学生。',
        en: 'I can see a student reading a newspaper.',
        hl: 'читающего'
      },
      {
        text: 'Человек, написавший эту книгу, жил в Москве.',
        zh: '写这本书的人住在莫斯科。',
        en: 'The man who wrote this book lived in Moscow.',
        hl: 'написавший'
      }
    ],
    patterns: [
      [
        {
          pos: 'verb',
          surface: accentable(
            '(ущ|ющ|ащ|ящ|вш|ш)(ий|ая|ее|ие|его|ей|ему|им|ем|ую|их|ими|ею)(ся|ся)?$'
          )
        }
      ]
    ],
    group: 'participle'
  },
  {
    id: 'ru-participle-passive',
    level: 'trki2',
    name: {
      zh: '被动形动词（прочитанный、читаемый）',
      en: 'Passive participles (прочитанный, читаемый)'
    },
    form: {
      zh: '过去时：-нн- / -енн- / -т- + 形容词词尾（прочитанный、открытый）；现在时：-ем- / -им- + 形容词词尾（читаемый）',
      en: 'past: -нн- / -енн- / -т- + adjective ending (прочитанный, открытый); present: -ем- / -им- + adjective ending (читаемый)'
    },
    meaning: {
      zh: '「被……的」，修饰名词，代替被动的 который 从句：книга, прочитанная мной（我读过的书）。动作的发出者用工具格。',
      en: '"Which is / was done", a written-style replacement for passive который-clauses: книга, прочитанная мной. The doer goes into the instrumental.'
    },
    examples: [
      {
        text: 'Мы обсуждали прочитанную книгу.',
        zh: '我们讨论了读过的那本书。',
        en: 'We discussed the book we had read.',
        hl: 'прочитанную'
      },
      {
        text: 'Это решение, принятое вчера.',
        zh: '这是昨天作出的决定。',
        en: 'This is the decision taken yesterday.',
        hl: 'принятое'
      }
    ],
    patterns: [
      [
        {
          pos: 'verb',
          surface: accentable('(нн|т|ем|им)(ый|ая|ое|ые|ого|ой|ому|ым|ом|ую|ых|ыми|ою)$'),
          not: { anyTags: ['short-form'] }
        }
      ]
    ],
    group: 'participle'
  },
  {
    id: 'ru-gerund',
    level: 'trki2',
    name: { zh: '副动词（читая、прочитав）', en: 'Adverbial participles (читая, прочитав)' },
    form: {
      zh: '未完成体：现在时词干 + -я / -а（читая、говоря）；完成体：过去时词干 + -в / -вши（прочитав、сделав）',
      en: 'imperfective: present stem + -я / -а (читая, говоря); perfective: past stem + -в / -вши (прочитав, сделав)'
    },
    meaning: {
      zh: '一个人做着一件事又做另一件：未完成体副动词是「一边……一边」（Читая книгу, она улыбалась），完成体是「……之后」（Прочитав письмо, он ушёл）。副动词的主语必须跟主句相同。',
      en: 'One subject doing two things: imperfective means "while doing" (Читая книгу, она улыбалась), perfective "having done" (Прочитав письмо, он ушёл). The subject must be the same as in the main clause.'
    },
    examples: [
      {
        text: 'Прочитав письмо, он улыбнулся.',
        zh: '他读完信，笑了。',
        en: 'Having read the letter, he smiled.',
        hl: 'Прочитав'
      },
      {
        text: 'Читая книгу, она заснула.',
        zh: '她看着书睡着了。',
        en: 'She fell asleep while reading a book.',
        hl: 'Читая'
      }
    ],
    patterns: [[{ pos: 'verb', tags: ['adverbial', 'participle'] }]],
    group: 'participle'
  },
  {
    id: 'ru-nesmotrya',
    level: 'trki2',
    name: { zh: 'несмотря на（尽管）', en: 'несмотря на (despite)' },
    form: {
      zh: 'несмотря на + 宾格；несмотря на то что + 从句',
      en: 'несмотря на + accusative; несмотря на то что + clause'
    },
    meaning: { zh: '让步：「尽管……，还是……」。', en: 'Concession: "despite…, still…".' },
    examples: [
      {
        text: 'Несмотря на дождь, мы пошли гулять.',
        zh: '尽管下着雨，我们还是去散步了。',
        en: 'Despite the rain, we went for a walk.',
        hl: 'Несмотря на'
      },
      {
        text: 'Несмотря на то что было поздно, он позвонил.',
        zh: '虽然已经很晚了，他还是打了电话。',
        en: 'Although it was late, he called.',
        hl: 'Несмотря на то что'
      }
    ],
    patterns: [
      [lemma('несмотря на'), form('то'), form('что')],
      [lemma('несмотря на')],
      [form('несмотря'), form('на')]
    ],
    group: 'concession'
  },
  {
    id: 'ru-blagodarya-iz-za',
    level: 'trki2',
    name: {
      zh: 'благодаря + 与格 / из-за + 属格（多亏 / 由于）',
      en: 'благодаря + dative / из-за + genitive (thanks to / because of)'
    },
    form: {
      zh: 'благодаря + 与格（好的原因）；из-за + 属格（不好的原因）',
      en: 'благодаря + dative (good cause); из-за + genitive (bad cause)'
    },
    meaning: {
      zh: '说原因：благодаря 用于带来好结果的原因（Благодаря тебе я сдал экзамен），из-за 用于带来坏结果的原因（Из-за дождя матч отменили）。',
      en: 'Gives a cause: благодаря for good outcomes (Благодаря тебе я сдал экзамен), из-за for bad ones (Из-за дождя матч отменили).'
    },
    examples: [
      {
        text: 'Благодаря тебе я сдал экзамен.',
        zh: '多亏了你，我考试通过了。',
        en: 'Thanks to you I passed the exam.',
        hl: 'Благодаря тебе'
      },
      {
        text: 'Из-за дождя матч отменили.',
        zh: '因为下雨，比赛取消了。',
        en: 'The match was cancelled because of the rain.',
        hl: 'Из-за дождя'
      }
    ],
    patterns: [
      [form('благодаря'), adjOf('dative'), caseOf('dative')],
      [form('из-за'), adjOf('genitive'), caseOf('genitive')]
    ],
    group: 'cause'
  },
  {
    id: 'ru-tak-kak',
    level: 'trki2',
    name: { zh: 'так как / поскольку（因为、既然）', en: 'так как / поскольку (since, as)' },
    form: {
      zh: 'так как / поскольку + 原因从句（可以放在句首）',
      en: 'так как / поскольку + reason clause (may come first)'
    },
    meaning: {
      zh: '说原因，比 потому что 书面；可以放在句首（Так как было поздно, мы ушли），потому что 一般不行。',
      en: 'Gives a reason; more formal than потому что and, unlike it, can start the sentence (Так как было поздно, мы ушли).'
    },
    examples: [
      {
        text: 'Так как было поздно, мы ушли.',
        zh: '因为已经很晚了，我们就走了。',
        en: 'As it was late, we left.',
        hl: 'Так как'
      },
      {
        text: 'Поскольку все согласны, начнём.',
        zh: '既然大家都同意，我们开始吧。',
        en: 'Since everyone agrees, let’s begin.',
        hl: 'Поскольку'
      }
    ],
    patterns: [[lemma('так как')], [form('поскольку')]],
    group: 'cause'
  },
  {
    id: 'ru-v-to-vremya-kak',
    level: 'trki2',
    name: { zh: 'в то время как（在……的时候；而）', en: 'в то время как (while, whereas)' },
    form: { zh: 'в то время как + 从句', en: 'в то время как + clause' },
    meaning: {
      zh: '两件事同时发生，或者对比两件事：「……的时候」「而……」。',
      en: 'Two things happening at the same time, or a contrast: "while, whereas".'
    },
    examples: [
      {
        text: 'В то время как я работал, он отдыхал.',
        zh: '我在工作，他却在休息。',
        en: 'While I was working, he was resting.',
        hl: 'В то время как'
      }
    ],
    patterns: [[lemma('в то время как')], [form('в'), form('то'), form('время'), form('как')]],
    group: 'time'
  },
  {
    id: 'ru-chem-tem',
    level: 'trki2',
    name: { zh: 'чем…, тем…（越……越……）', en: 'чем…, тем… (the more…, the more…)' },
    form: { zh: 'чем + 比较级……, тем + 比较级……', en: 'чем + comparative…, тем + comparative…' },
    meaning: {
      zh: '「越……越……」：Чем больше читаешь, тем лучше пишешь（读得越多，写得越好）。',
      en: '"The more…, the more…": Чем больше читаешь, тем лучше пишешь.'
    },
    examples: [
      {
        text: 'Чем больше читаешь, тем лучше пишешь.',
        zh: '读得越多，写得越好。',
        en: 'The more you read, the better you write.',
        hl: 'Чем больше читаешь, тем лучше'
      }
    ],
    patterns: [
      [form('чем'), { anyTags: ['comparative'] }, gap(form('тем'), 4), { anyTags: ['comparative'] }]
    ],
    group: 'comparison'
  },
  {
    id: 'ru-prikhoditsya',
    level: 'trki2',
    name: {
      zh: 'приходится / пришлось + 不定式（不得不）',
      en: 'приходится / пришлось + infinitive (have to)'
    },
    form: {
      zh: '与格 + приходится / пришлось / придётся + 不定式',
      en: 'dative + приходится / пришлось / придётся + infinitive'
    },
    meaning: {
      zh: '迫于情况「不得不……」，人用与格：Мне пришлось уйти（我只好走了）。',
      en: 'Being forced by circumstances; the person is in the dative: Мне пришлось уйти.'
    },
    examples: [
      {
        text: 'Мне пришлось уйти.',
        zh: '我只好走了。',
        en: 'I had to leave.',
        hl: 'пришлось уйти'
      },
      {
        text: 'Нам придётся подождать.',
        zh: '我们只好等一等。',
        en: "We'll have to wait.",
        hl: 'придётся подождать'
      }
    ],
    patterns: [[lemma('приходиться', 'прийтись'), gap(INF, 1)]],
    group: 'modal'
  },
  {
    id: 'ru-stoit',
    level: 'trki2',
    name: {
      zh: '(не) стоит + 不定式（值得、没必要）',
      en: '(не) стоит + infinitive (worth / not worth)'
    },
    form: { zh: '（не）стоит / стоило + 不定式', en: '(не) стоит / стоило + infinitive' },
    meaning: {
      zh: '建议：「值得……」「不必……」：Эту книгу стоит прочитать（这本书值得一读）、Не стоит волноваться（不用担心）。',
      en: 'Advice: "it is worth…, there is no need to…": Эту книгу стоит прочитать, Не стоит волноваться.'
    },
    examples: [
      {
        text: 'Эту книгу стоит прочитать.',
        zh: '这本书值得一读。',
        en: 'This book is worth reading.',
        hl: 'стоит прочитать'
      },
      {
        text: 'Не стоит волноваться.',
        zh: '不用担心。',
        en: "There's no need to worry.",
        hl: 'стоит волноваться'
      }
    ],
    patterns: [[form('стоит', 'стоило'), INF]],
    group: 'modal'
  },
  {
    id: 'ru-dlya-togo-chtoby',
    level: 'trki2',
    name: { zh: 'для того чтобы（为了）', en: 'для того чтобы (in order to)' },
    form: {
      zh: 'для того чтобы / с тем чтобы + 不定式或过去时',
      en: 'для того чтобы / с тем чтобы + infinitive or past'
    },
    meaning: {
      zh: '书面一点的目的连词，用法跟 чтобы 一样，更强调目的。',
      en: 'A more formal purpose conjunction, used like чтобы but with more emphasis on the purpose.'
    },
    examples: [
      {
        text: 'Для того чтобы выучить язык, нужно много читать.',
        zh: '要学会一门语言，就得多读。',
        en: 'To learn a language you need to read a lot.',
        hl: 'Для того чтобы'
      }
    ],
    patterns: [
      [form('для'), form('того'), form('чтобы')],
      [form('с'), form('тем'), form('чтобы')]
    ],
    group: 'purpose'
  },
  {
    id: 'ru-vmesto-togo',
    level: 'trki2',
    name: { zh: 'вместо того чтобы（与其……不如；不……反而）', en: 'вместо того чтобы (instead of)' },
    form: { zh: 'вместо того чтобы + 不定式', en: 'вместо того чтобы + infinitive' },
    meaning: { zh: '「不去……，反而……」。', en: '"Instead of doing…".' },
    examples: [
      {
        text: 'Вместо того чтобы учиться, он играл.',
        zh: '他不学习，反而在玩。',
        en: 'Instead of studying, he was playing.',
        hl: 'Вместо того чтобы'
      }
    ],
    patterns: [[form('вместо'), form('того'), form('чтобы')]]
  },
  {
    id: 'ru-dazhe-esli',
    level: 'trki2',
    name: { zh: 'даже если / хотя（即使 / 虽然）', en: 'даже если / хотя (even if / although)' },
    form: { zh: 'даже если + 条件；хотя + 事实', en: 'даже если + condition; хотя + fact' },
    meaning: {
      zh: '让步：хотя 说的是事实（虽然），даже если 是假设（即使）。',
      en: 'Concession: хотя states a fact (although), даже если a supposition (even if).'
    },
    examples: [
      {
        text: 'Даже если будет дождь, я приду.',
        zh: '即使下雨，我也会来。',
        en: "Even if it rains, I'll come.",
        hl: 'Даже если'
      },
      {
        text: 'Хотя было холодно, мы гуляли.',
        zh: '虽然很冷，我们还是去散步了。',
        en: 'Although it was cold, we went for a walk.',
        hl: 'Хотя'
      }
    ],
    patterns: [[form('даже'), form('если')], [form('хотя', 'хоть')]],
    group: 'concession'
  },
  {
    id: 'ru-ni-ni',
    level: 'trki2',
    name: { zh: 'ни…, ни…（既不……也不……）', en: 'ни…, ни… (neither… nor…)' },
    form: { zh: '(не +) 动词 + ни A, ни B', en: '(не +) verb + ни A, ни B' },
    meaning: {
      zh: '「既不……也不……」，动词前要有 не：Я не люблю ни чай, ни кофе。',
      en: '"Neither… nor…"; the verb still takes не: Я не люблю ни чай, ни кофе.'
    },
    examples: [
      {
        text: 'Я не люблю ни чай, ни кофе.',
        zh: '我既不喜欢茶，也不喜欢咖啡。',
        en: 'I like neither tea nor coffee.',
        hl: 'ни чай, ни'
      }
    ],
    patterns: [[form('ни'), gap(form('ни'), 3)]]
  },

  // ═════════════ ТРКИ-3（C1） ═════════════
  {
    id: 'ru-kak-by-ni',
    level: 'trki3',
    name: {
      zh: 'как бы ни / что бы ни（无论怎样 / 无论什么）',
      en: 'как бы ни / что бы ни (however / whatever)'
    },
    form: {
      zh: '疑问词（как、что、где、куда、кто、сколько……）+ бы ни + 过去时形式',
      en: 'question word (как, что, где, куда, кто, сколько…) + бы ни + past form'
    },
    meaning: {
      zh: '「无论……都……」：Что бы ни случилось, я буду рядом（无论发生什么，我都在你身边）。',
      en: '"No matter…": Что бы ни случилось, я буду рядом.'
    },
    examples: [
      {
        text: 'Что бы ни случилось, я буду рядом.',
        zh: '无论发生什么，我都会在你身边。',
        en: 'Whatever happens, I will be by your side.',
        hl: 'Что бы ни'
      },
      {
        text: 'Как бы он ни старался, у него не получалось.',
        zh: '无论他怎么努力，都做不成。',
        en: 'However hard he tried, he did not succeed.',
        hl: 'Как бы он ни'
      }
    ],
    patterns: [
      [
        form(
          'как',
          'что',
          'где',
          'куда',
          'кто',
          'сколько',
          'когда',
          'откуда',
          'какой',
          'какая',
          'какое',
          'какие'
        ),
        form('бы', 'б'),
        optional({ pos: ['pron', 'noun', 'propn'] }),
        form('ни')
      ]
    ],
    group: 'concession'
  },
  {
    id: 'ru-po-mere',
    level: 'trki3',
    name: { zh: 'по мере того как（随着）', en: 'по мере того как (as, in proportion as)' },
    form: {
      zh: 'по мере + 属格；по мере того как + 从句',
      en: 'по мере + genitive; по мере того как + clause'
    },
    meaning: {
      zh: '「随着……（逐渐）」：По мере того как темнело, становилось холоднее。',
      en: '"As (gradually)…": По мере того как темнело, становилось холоднее.'
    },
    examples: [
      {
        text: 'По мере того как темнело, становилось холоднее.',
        zh: '天越来越黑，也越来越冷了。',
        en: 'As it grew dark, it got colder.',
        hl: 'По мере того как'
      }
    ],
    patterns: [
      [form('по'), form('мере'), form('того'), form('как')],
      [lemma('по мере'), form('того'), form('как')]
    ],
    group: 'time'
  },
  {
    id: 'ru-v-svyazi',
    level: 'trki3',
    name: {
      zh: 'в связи с / вследствие（由于、鉴于）',
      en: 'в связи с / вследствие (due to, owing to)'
    },
    form: {
      zh: 'в связи с + 工具格；вследствие / в результате + 属格',
      en: 'в связи с + instrumental; вследствие / в результате + genitive'
    },
    meaning: {
      zh: '公文、新闻里说原因：В связи с ремонтом магазин закрыт（因装修，商店暂停营业）。',
      en: 'Formal statements of cause, common in notices and news: В связи с ремонтом магазин закрыт.'
    },
    examples: [
      {
        text: 'В связи с ремонтом магазин закрыт.',
        zh: '因装修，商店暂停营业。',
        en: 'The shop is closed for refurbishment.',
        hl: 'В связи с'
      },
      {
        text: 'Вследствие аварии движение остановлено.',
        zh: '由于事故，交通中断了。',
        en: 'Traffic has been stopped owing to an accident.',
        hl: 'Вследствие аварии'
      }
    ],
    patterns: [
      [form('в'), form('связи'), form('с', 'со')],
      [lemma('в связи с')],
      [form('вследствие'), caseOf('genitive', ['noun'])],
      [form('в'), form('результате'), caseOf('genitive', ['noun'])]
    ],
    group: 'cause'
  },
  {
    id: 'ru-ibo',
    level: 'trki3',
    name: { zh: 'ибо（因为，书面）', en: 'ибо (for, because — bookish)' },
    form: { zh: '……, ибо + 原因', en: '…, ибо + reason' },
    meaning: {
      zh: '书面、庄重的「因为」，口语里不用。',
      en: 'A bookish, solemn "for, because", not used in speech.'
    },
    examples: [
      {
        text: 'Он молчал, ибо сказать было нечего.',
        zh: '他沉默着，因为无话可说。',
        en: 'He was silent, for there was nothing to say.',
        hl: 'ибо'
      }
    ],
    patterns: [[form('ибо')]],
    group: 'cause'
  },
  {
    id: 'ru-ved-zhe',
    level: 'trki3',
    name: { zh: '语气词 ведь、же（毕竟、到底）', en: 'Particles ведь, же' },
    form: {
      zh: 'ведь 一般放在句首或谓语前；же 放在要强调的词后',
      en: 'ведь usually at the start or before the predicate; же after the stressed word'
    },
    meaning: {
      zh: 'ведь：「要知道、毕竟」，提醒对方已知的事：Ведь я тебе говорил!（我不是跟你说过嘛！）。же：强调、「到底」：Где же он?（他到底在哪儿？）、Я же сказал（我都说了）。',
      en: 'ведь reminds the listener of something known: Ведь я тебе говорил! же adds emphasis or impatience: Где же он? Я же сказал.'
    },
    examples: [
      { text: 'Ведь я тебе говорил!', zh: '我不是跟你说过嘛！', en: 'I did tell you!', hl: 'Ведь' },
      { text: 'Где же он?', zh: '他到底在哪儿？', en: 'Where on earth is he?', hl: 'же' }
    ],
    patterns: [[form('ведь')], [{ pos: ['pron', 'adv', 'verb'] }, { form: 'же', ctx: false }]]
  },
  {
    id: 'ru-ne-gerund',
    level: 'trki3',
    name: { zh: 'не + 副动词（没有……就）', en: 'не + adverbial participle (without doing)' },
    form: { zh: 'не + 副动词', en: 'не + adverbial participle' },
    meaning: {
      zh: '「没有……（就）」：Он ушёл, не попрощавшись（他没打招呼就走了）。',
      en: '"Without doing": Он ушёл, не попрощавшись.'
    },
    examples: [
      {
        text: 'Он ушёл, не попрощавшись.',
        zh: '他没打招呼就走了。',
        en: 'He left without saying goodbye.',
        hl: 'не попрощавшись'
      },
      {
        text: 'Не зная языка, трудно жить за границей.',
        zh: '不懂语言，在国外生活很难。',
        en: "It's hard to live abroad without knowing the language.",
        hl: 'Не зная'
      }
    ],
    patterns: [[form('не'), { pos: 'verb', tags: ['adverbial', 'participle'] }]],
    group: 'participle'
  },
  {
    id: 'ru-collective-num',
    level: 'trki3',
    name: { zh: '集合数词：двое、трое……', en: 'Collective numerals: двое, трое…' },
    form: {
      zh: 'двое、трое、четверо、пятеро…… + 属格复数',
      en: 'двое, трое, четверо, пятеро… + genitive plural'
    },
    meaning: {
      zh: '数人（尤其是阳性的人、孩子、复数名词）：двое детей（两个孩子）、трое друзей（三个朋友）、двое суток（两昼夜）。',
      en: 'Used to count people (especially males and children) and plural-only nouns: двое детей, трое друзей, двое суток.'
    },
    examples: [
      {
        text: 'У них двое детей.',
        zh: '他们有两个孩子。',
        en: 'They have two children.',
        hl: 'двое детей'
      },
      {
        text: 'Пришли трое друзей.',
        zh: '来了三个朋友。',
        en: 'Three friends came.',
        hl: 'трое друзей'
      }
    ],
    patterns: [
      [
        form('двое', 'трое', 'четверо', 'пятеро', 'шестеро', 'семеро'),
        caseOf('genitive', ['noun', 'pron'])
      ]
    ]
  },
  {
    id: 'ru-kak-by-ne',
    level: 'trki3',
    name: { zh: 'как бы не…（但愿别……，担心）', en: 'как бы не… (fear that…)' },
    form: {
      zh: '（与格 +）как бы не + 不定式 / 过去时',
      en: '(dative +) как бы не + infinitive / past form'
    },
    meaning: {
      zh: '担心某事发生：Как бы не опоздать!（可别迟到了！）。',
      en: 'Worry that something might happen: Как бы не опоздать!'
    },
    examples: [
      {
        text: 'Как бы не опоздать!',
        zh: '可别迟到了！',
        en: "I hope we're not late!",
        hl: 'Как бы не опоздать'
      }
    ],
    patterns: [[form('как'), form('бы'), form('не'), INF]],
    group: 'condition'
  },
  {
    id: 'ru-lish-by',
    level: 'trki3',
    name: { zh: 'лишь бы / только бы（只要……就好）', en: 'лишь бы / только бы (if only)' },
    form: {
      zh: 'лишь бы / только бы + 过去时形式或不定式',
      en: 'лишь бы / только бы + past form or infinitive'
    },
    meaning: {
      zh: '表示愿望：「只要……就好」：Лишь бы ты был здоров（只要你健康就好）。',
      en: 'A wish: "if only…": Лишь бы ты был здоров.'
    },
    examples: [
      {
        text: 'Лишь бы ты был здоров.',
        zh: '只要你身体健康就好。',
        en: 'If only you stay healthy.',
        hl: 'Лишь бы'
      },
      {
        text: 'Только бы не было дождя!',
        zh: '可千万别下雨！',
        en: "If only it doesn't rain!",
        hl: 'Только бы'
      }
    ],
    patterns: [[form('лишь', 'только'), form('бы')]],
    group: 'condition'
  },

  // ═════════════ ТРКИ-4（C2） ═════════════
  {
    id: 'ru-budushi',
    level: 'trki4',
    name: { zh: 'будучи + 工具格（作为……，在……时）', en: 'будучи + instrumental (being…)' },
    form: {
      zh: 'будучи + 名词 / 形容词的工具格',
      en: 'будучи + instrumental of a noun or adjective'
    },
    meaning: {
      zh: 'быть 的副动词，书面语：Будучи студентом, он много читал（他当学生时读了很多书）。',
      en: 'The adverbial participle of быть, bookish: Будучи студентом, он много читал.'
    },
    examples: [
      {
        text: 'Будучи студентом, он много читал.',
        zh: '他当学生的时候读了很多书。',
        en: 'As a student he read a lot.',
        hl: 'Будучи студентом'
      }
    ],
    patterns: [[form('будучи'), adjOf('instrumental'), caseOf('instrumental', ['noun', 'adj'])]],
    group: 'participle'
  },
  {
    id: 'ru-dabы',
    level: 'trki4',
    name: { zh: 'дабы（为了，古雅）', en: 'дабы (so that — archaic)' },
    form: { zh: 'дабы + 不定式 / 过去时形式', en: 'дабы + infinitive / past form' },
    meaning: {
      zh: '古雅的「为了」，现在多用于讽刺或仿古文体。',
      en: 'An archaic "so that", now used for irony or pastiche.'
    },
    examples: [
      {
        text: 'Он говорил тихо, дабы никого не разбудить.',
        zh: '他小声说话，以免吵醒别人。',
        en: 'He spoke quietly, lest he wake anyone.',
        hl: 'дабы'
      }
    ],
    patterns: [[form('дабы')]],
    group: 'purpose'
  },
  {
    id: 'ru-vshi',
    level: 'trki4',
    name: {
      zh: '-вши 结尾的副动词（口语、旧式）',
      en: 'Adverbial participles in -вши (colloquial, old-fashioned)'
    },
    form: {
      zh: '过去时词干 + -вши（-ся 动词一定用 -вшись）',
      en: 'past stem + -вши (always -вшись with -ся verbs)'
    },
    meaning: {
      zh: '完成体副动词的另一种形式：сделавши = сделав。-ся 动词只有这一种：умывшись、вернувшись。',
      en: 'An alternative perfective adverbial participle: сделавши = сделав; -ся verbs only have this form: умывшись, вернувшись.'
    },
    examples: [
      {
        text: 'Вернувшись домой, он сразу лёг спать.',
        zh: '他回到家就马上睡了。',
        en: 'Having got home, he went straight to bed.',
        hl: 'Вернувшись'
      }
    ],
    patterns: [
      [{ pos: 'verb', tags: ['adverbial', 'participle'], surface: accentable('вши(сь)?$') }]
    ],
    group: 'participle'
  },
  {
    id: 'ru-koli',
    level: 'trki4',
    name: {
      zh: 'коли / коль / ежели（如果，口语或旧式）',
      en: 'коли / коль / ежели (if — colloquial, old-fashioned)'
    },
    form: { zh: 'коли / коль / ежели + 条件', en: 'коли / коль / ежели + condition' },
    meaning: {
      zh: '旧式、口语的「如果、既然」，常见于民间故事和十九世纪的作品：Коли так, иди。',
      en: 'Old-fashioned or folksy "if, since", common in folk tales and 19th-century writing: Коли так, иди.'
    },
    examples: [
      {
        text: 'Коли так, иди домой.',
        zh: '既然这样，你就回家吧。',
        en: 'If that is so, go home.',
        hl: 'Коли'
      }
    ],
    patterns: [[form('коли', 'коль', 'ежели')]],
    group: 'condition'
  },
  {
    id: 'ru-ottogo-chto',
    level: 'trki4',
    name: {
      zh: 'оттого что / затем что（因为，旧式）',
      en: 'оттого что / затем что (because — dated)'
    },
    form: {
      zh: 'оттого что + 原因；затем что + 目的或原因',
      en: 'оттого что + reason; затем что + purpose or reason'
    },
    meaning: {
      zh: '书面、旧式的因果连词，多见于文学作品。',
      en: 'Dated, literary conjunctions of cause, mostly found in fiction.'
    },
    examples: [
      {
        text: 'Он не пришёл оттого, что заболел.',
        zh: '他没来，是因为病了。',
        en: "He didn't come because he had fallen ill.",
        hl: 'оттого, что'
      }
    ],
    patterns: [[form('оттого', 'затем'), form('что')]],
    group: 'cause'
  },
  {
    id: 'ru-v-silu',
    level: 'trki4',
    name: {
      zh: 'в силу / по причине + 属格（由于，公文）',
      en: 'в силу / по причине + genitive (by virtue of — formal)'
    },
    form: {
      zh: 'в силу / по причине / ввиду + 属格',
      en: 'в силу / по причине / ввиду + genitive'
    },
    meaning: {
      zh: '公文、学术语体里说原因：в силу обстоятельств（由于情况所迫）、ввиду болезни（因病）。',
      en: 'Formal and academic statements of cause: в силу обстоятельств, ввиду болезни.'
    },
    examples: [
      {
        text: 'В силу обстоятельств встреча перенесена.',
        zh: '由于情况变化，会面改期了。',
        en: 'Owing to circumstances the meeting has been postponed.',
        hl: 'В силу обстоятельств'
      },
      {
        text: 'Ввиду болезни он не работает.',
        zh: '他因病没有工作。',
        en: 'He is not working owing to illness.',
        hl: 'Ввиду болезни'
      }
    ],
    patterns: [
      [form('в'), form('силу'), caseOf('genitive', ['noun'])],
      [form('по'), form('причине'), caseOf('genitive', ['noun'])],
      [form('ввиду'), caseOf('genitive', ['noun'])]
    ],
    group: 'cause'
  }
]

for (const point of grammar)
  if (extraExamples[point.id]) point.examples.push(extraExamples[point.id])
addExamplePatterns(grammar, rules, 'ru')
