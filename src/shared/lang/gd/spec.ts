/**
 * 苏格兰盖尔语（Scottish Gaelic, Gàidhlig）：学习包的描述——叫什么、几套分级、有哪些能力。
 * 分析与依据见 docs/lang/gd.md。
 *
 * 分级：
 * - 主分级 CEFR A1–C2。盖尔语学习界通行的就是 CEFR：LearnGaelic 按阿伯丁大学的 CLAG
 *  （Comasan Labhairt ann an Gàidhlig，盖尔语口语能力等级描述）分 A1–C2，SpeakGaelic 的四级对应 A1–B2。
 *   各级说明是本软件参照 CLAG 自评表与 SpeakGaelic 的课程说明概括的（不是原文）。
 *   词怎么分到各级见 docs/lang/gd.md「分级」：A1 是手挑的基础词表加最常用的虚词，其余按三份语料的合并词频切分。
 * - SQA 盖尔语（学习者）：苏格兰中学的考试等级（National 3 / 4 / 5、Higher、Advanced Higher），
 *   只用于说明与以后的模拟卷；SQA 没有公布词表，这一套不挂词。跟 CEFR 的对应是大致的（SQA 没有官方对照）。
 */
import { CEFR_SOURCE } from '../levels'
import type { LangSpec, LevelSystemDef, SourceRef } from '../types'

/** 各级的分法依据（词典库 meta 里也登记同样的来源） */
const GRADING_SOURCES: SourceRef[] = [
  {
    id: 'clag',
    name: 'CLAG（Comasan Labhairt ann an Gàidhlig）盖尔语口语能力等级描述与自评表',
    license: '参考（各级说明为本软件概括）',
    credit: 'University of Aberdeen；LearnGaelic',
    home: 'https://learngaelic.scot/clag/'
  },
  {
    id: 'speakgaelic',
    name: 'SpeakGaelic 课程的四级（Inntrigeadh A1、Bunaiteach A2、Eadar-mheadhanach B1、Adhartach B2）与学时',
    license: '参考',
    credit: 'MG ALBA；BBC ALBA；Sabhal Mòr Ostaig；Bòrd na Gàidhlig',
    home: 'https://speakgaelic.scot/'
  },
  {
    id: 'gd-grading',
    name: '本软件的分法：A1 = 手挑的基础词表（data/gd/core-a1.txt）+ 最常用的虚词；其余按 UD ARCOSG、LearnGaelic 语料词频表、盖尔语维基百科三份语料的合并词频切分',
    license: '方法说明（见 docs/lang/gd.md）',
    credit: 'Qonsona',
    home: 'https://github.com/Kinnuch/Qonsona'
  }
]

const cefr: LevelSystemDef = {
  id: 'cefr',
  name: { zh: '欧洲共同语言参考标准（CEFR）', en: 'CEFR' },
  kind: 'proficiency',
  primary: true,
  cefr: { A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' },
  levels: [
    {
      id: 'A1',
      short: 'A1',
      name: { zh: 'A1 入门', en: 'A1 Beginner', gd: 'Luchd-tòiseachaidh ùra' },
      desc: {
        zh: '会问候、道谢（madainn mhath、tapadh leat），介绍自己、家人和住处，说喜欢什么、有什么（tha cù agam），用 tha mi a’ dol 这样的进行体说眼前的事；会数字、说时间，一次说三四个词的短句，要对方说慢一点、帮着说。SpeakGaelic 入门级（约 90–100 学时）。',
        en: 'Greets and thanks (madainn mhath, tapadh leat), introduces self, family and home, says what they like and have (tha cù agam), uses the progressive (tha mi a’ dol), numbers and the time, in short three- or four-word sentences with help. SpeakGaelic Entry (about 90–100 hours).'
      }
    },
    {
      id: 'A2',
      short: 'A2',
      name: { zh: 'A2 基础', en: 'A2 Elementary', gd: 'Ath-cheumannan' },
      desc: {
        zh: '能用一串简单的句子讲家人、工作、爱好，讲过去的事（bha、chaidh、rinn），比较（nas fheàrr、nas motha），用系词说身份和喜好（Is e tidsear a th’ annam、Is toigh leam…），说时间、地点；会邀请、道歉、约时间，但对话多半是对方在说。SpeakGaelic 基础级；大致是 SQA National 5 盖尔语（学习者）的程度。',
        en: 'Describes family, work and hobbies in simple linked sentences, talks about the past (bha, chaidh, rinn), compares (nas fheàrr, nas motha), uses the copula for identity and likes (Is e tidsear a th’ annam, Is toigh leam…); can invite, apologise and arrange to meet, while the other person does most of the talking. SpeakGaelic Foundation; roughly SQA National 5 Gaelic (Learners).'
      }
    },
    {
      id: 'B1',
      short: 'B1',
      name: { zh: 'B1 进阶', en: 'B1 Intermediate', gd: 'Eadar-mheadhanach' },
      desc: {
        zh: '能不经准备地参与熟悉话题的对话，讲经历、感受、打算和理由，用 gu bheil / nach eil / nuair a 这样的从句把句子连长，用将来时与条件式（bidh、bhithinn）说以后和假如；读得懂写给学习者的短文（如《Litir Bheag》）。SpeakGaelic 中级（约 150–200 学时）；大致是 SQA Higher 的程度。',
        en: 'Joins unprepared conversation on familiar topics, tells experiences, feelings, plans and reasons, builds longer sentences with gu bheil / nach eil / nuair a clauses, uses the future and conditional (bidh, bhithinn); reads texts written for learners (such as An Litir Bheag). SpeakGaelic Intermediate (about 150–200 hours); roughly SQA Higher.'
      }
    },
    {
      id: 'B2',
      short: 'B2',
      name: { zh: 'B2 中高级', en: 'B2 Upper intermediate', gd: 'Eadar-mheadhanach Adhartach' },
      desc: {
        zh: '能就较广的话题详细地说，摆出理由、比较利弊（ged a、an àite、seach），讲原因、后果和假设（mura、ma、a chionn ’s），轮到自己时能连说两三句，跟流利的说话人交流不吃力；看得懂 BBC 盖尔语新闻的大意。SpeakGaelic 高级；大致是 SQA Advanced Higher 的程度。',
        en: 'Talks in detail on a wide range of topics, argues for and against (ged a, an àite, seach), speculates about causes and hypotheticals (mura, ma, a chionn ’s), gives two or three sentences per turn and interacts with fluent speakers without strain; follows BBC Gaelic news. SpeakGaelic Advanced; roughly SQA Advanced Higher.'
      }
    },
    {
      id: 'C1',
      short: 'C1',
      name: { zh: 'C1 高级', en: 'C1 Advanced', gd: 'Àrd-ìre' },
      desc: {
        zh: '能清楚、有条理地谈复杂抽象的话题，在口语和正式文体之间切换，句子长而有层次（属格链、被动、关系从句运用自如），能主导对话；读得懂评论、现代小说与诗歌。',
        en: 'Discusses complex, abstract subjects clearly and in a structured way, switches between colloquial and formal registers, handles long sentences (genitive chains, passives, relative clauses) and can lead a conversation; reads commentary, modern fiction and poetry.'
      }
    },
    {
      id: 'C2',
      short: 'C2',
      name: { zh: 'C2 精通', en: 'C2 Proficient', gd: 'Sàr-ìre' },
      desc: {
        zh: '几乎能毫不费力地听懂、读懂一切，包括方言、老派文体、谚语和惯用语，表达细腻准确，遇到难处能不着痕迹地换个说法。这是很成功的学习者能达到的水平，不等于母语者。',
        en: 'Understands virtually everything with ease, including dialects, older styles, proverbs and idioms; expresses fine shades of meaning and rephrases smoothly around difficulties. The level of very successful learners, not an idealised native speaker.'
      }
    }
  ],
  sources: [CEFR_SOURCE, ...GRADING_SOURCES]
}

const SQA_SOURCE: SourceRef = {
  id: 'sqa',
  name: 'SQA（现 Qualifications Scotland）现代语言课程说明：Gaelic (Learners) National 5、Higher、Advanced Higher',
  license: '参考（考试结构为本软件概括）',
  credit: 'Scottish Qualifications Authority / Qualifications Scotland',
  home: 'https://www.sqa.org.uk/sqa/47415.html'
}

/** SQA 盖尔语（学习者）：只有等级说明与考试结构，没有官方词表，不挂词 */
const sqa: LevelSystemDef = {
  id: 'sqa',
  name: { zh: 'SQA 盖尔语（学习者）', en: 'SQA Gaelic (Learners)' },
  kind: 'proficiency',
  cefr: { n3: 'A1', n4: 'A1', n5: 'A2', higher: 'B1', ah: 'B2' },
  levels: [
    {
      id: 'n3',
      short: 'N3',
      name: { zh: 'National 3', en: 'National 3' },
      desc: {
        zh: 'SCQF 第 3 级。按单元在校内评定，没有统一考试：能读、听懂简短的日常内容，用学过的句子说和写自己的事。',
        en: 'SCQF level 3. Internally assessed units, no exam: short everyday texts and talking/writing about oneself with learned language.'
      }
    },
    {
      id: 'n4',
      short: 'N4',
      name: { zh: 'National 4', en: 'National 4' },
      desc: {
        zh: 'SCQF 第 4 级。校内评定的单元加一个「附加价值」单元，没有统一考试：围绕社会、学习、就业、文化四类话题读、听、说、写简单的内容。',
        en: 'SCQF level 4. Internally assessed units plus an Added Value unit, no exam; simple language in the contexts of society, learning, employability and culture.'
      }
    },
    {
      id: 'n5',
      short: 'N5',
      name: { zh: 'National 5', en: 'National 5' },
      desc: {
        zh: 'SCQF 第 5 级，名义学时 160。考试：阅读 30 分（三篇短文，英文提问、英文作答，可查双语词典）、写作 20 分（按招聘广告写 120–150 词的求职信，回应六个要点）、听力 20 分（一段独白、一段对话），另有校内写作作业 20 分、口语表现 30 分（陈述加对话）。',
        en: 'SCQF level 5, 160 notional hours. Exam: Reading 30 (three texts, questions and answers in English, bilingual dictionary allowed), Writing 20 (a 120–150-word job application addressing six bullet points), Listening 20 (a monologue and a conversation); plus Assignment–writing 20 and Performance–talking 30.'
      }
    },
    {
      id: 'higher',
      short: 'H',
      name: { zh: 'Higher', en: 'Higher' },
      desc: {
        zh: 'SCQF 第 6 级，名义学时 160。考试：阅读 30 分（一篇长文，20 分理解、10 分译成英文）、定向写作 20 分（两个情境选一，150–180 词）、听力 20 分；另有写作作业 20 分、口语表现 30 分（约 10 分钟）。',
        en: 'SCQF level 6, 160 notional hours. Exam: Reading 30 (one text; 20 for comprehension, 10 for translation into English), Directed writing 20 (one of two scenarios, 150–180 words), Listening 20; plus Assignment–writing 20 and Performance–talking 30 (about 10 minutes).'
      }
    },
    {
      id: 'ah',
      short: 'AH',
      name: { zh: 'Advanced Higher', en: 'Advanced Higher' },
      desc: {
        zh: 'SCQF 第 7 级。考试：阅读与翻译 50 分（要点 23、全文意图 7、译成英文 20）、听力与议论文写作 70 分（听力 30，议论文 250–300 词 40），另有研究作品集 30 分（1200–1500 词，文学或媒体）、口语表现 50 分（约 20 分钟）。',
        en: 'SCQF level 7. Exam: Reading and translation 50 (main points 23, overall purpose 7, translation 20), Listening and discursive writing 70 (listening 30, a 250–300-word essay 40); plus a Portfolio 30 (1,200–1,500 words on literature or media) and Performance–talking 50 (about 20 minutes).'
      }
    }
  ],
  sources: [SQA_SOURCE]
}

export const spec: LangSpec = {
  code: 'gd',
  name: { zh: '苏格兰盖尔语', en: 'Scottish Gaelic', gd: 'Gàidhlig' },
  nativeName: 'Gàidhlig',
  bcp47: 'gd',
  color: '#5b7f2a',
  direction: 'ltr',
  levelSystems: [cefr, sqa],
  features: {
    texts: false,
    lexicon: true,
    // 字母课以后做成拼读规则课（phonics）；阶段一只开词典
    alphabet: null,
    characters: null,
    grammar: false,
    inflection: false,
    phrasebook: false,
    idioms: false,
    stories: false,
    media: false,
    exam: false,
    // 拼写与读音差得远，正文上方注 IPA；不需要罗马化
    ruby: 'ipa',
    romanization: false,
    // Windows（以及 macOS）都没有盖尔语语音，装也装不上：发音靠真人录音与 IPA
    speech: null
  },
  intro: {
    zh: '苏格兰的凯尔特语言，2022 年人口普查约 7 万人会说。动词放在句首，词首辅音会「弱化」（bàta → a bhàta），拼写按「宽对宽、窄对窄」的元音配对，写法和读音差得远。',
    en: 'The Celtic language of Scotland, spoken by about 70,000 people (2022 census): verb-first sentences, initial-consonant lenition (bàta → a bhàta) and a spelling built on matching broad and slender vowels, far from how words sound.'
  }
}
