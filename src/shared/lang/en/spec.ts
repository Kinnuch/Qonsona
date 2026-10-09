/**
 * 英语（English）：学习包的描述——叫什么、几套分级、有哪些能力。分析见 docs/lang/en.md。
 *
 * 分级四套：CEFR A1–C2（主分级；CEFR-J 1.6 给 A1–B2，Octanove 给 C1–C2，两表都没有的按词频补）、
 * 中国考试词表（中考 → GRE，ECDICT 的标签）、NGSL 系列词表、柯林斯星级。
 */
import { CEFR_SOURCE, cefrLevels } from '../levels'
import type { CefrLevel, LangSpec, LevelDef, LevelSystemDef } from '../types'
import { CEFRJ, ECDICT, NGSL, OCTANOVE } from './sources'

/** CEFR 各级在英语里对应的考试（接在通用说明后面） */
const CEFR_EXAMS: Record<CefrLevel, { zh: string; en: string }> = {
  A1: {
    zh: '大致是小学英语的水平；剑桥少儿英语 Movers；新托福 1 分。',
    en: 'About primary-school English; Cambridge Young Learners Movers; TOEFL iBT (2026) band 1.'
  },
  A2: {
    zh: '剑桥 A2 Key（KET）；大致是中考的要求；新托福 2 分。',
    en: 'Cambridge A2 Key (KET); roughly the zhongkao target; TOEFL iBT (2026) band 2.'
  },
  B1: {
    zh: '剑桥 B1 Preliminary（PET）；高考、大学英语四级大致在这一级；雅思 4.0–5.0；新托福 3 分。',
    en: 'Cambridge B1 Preliminary (PET); gaokao and CET-4 are roughly here; IELTS 4.0–5.0; TOEFL iBT (2026) band 3.'
  },
  B2: {
    zh: '剑桥 B2 First（FCE）；大学英语六级、考研英语大致在这一级；雅思 5.5–6.5；新托福 4 分。',
    en: 'Cambridge B2 First (FCE); CET-6 and the postgraduate entrance exam are roughly here; IELTS 5.5–6.5; TOEFL iBT (2026) band 4.'
  },
  C1: {
    zh: '剑桥 C1 Advanced（CAE）；雅思 7.0–8.0；新托福 5 分。',
    en: 'Cambridge C1 Advanced (CAE); IELTS 7.0–8.0; TOEFL iBT (2026) band 5.'
  },
  C2: {
    zh: '剑桥 C2 Proficiency（CPE）；雅思 8.5–9.0；新托福 6 分。',
    en: 'Cambridge C2 Proficiency (CPE); IELTS 8.5–9.0; TOEFL iBT (2026) band 6.'
  }
}

/** 主分级：CEFR，说明里加上英语的考试 */
const cefr: LevelSystemDef = {
  id: 'cefr',
  name: { zh: '欧洲共同语言参考标准（CEFR）', en: 'CEFR' },
  kind: 'proficiency',
  primary: true,
  levels: cefrLevels().map((l) => {
    const exam = CEFR_EXAMS[l.id as CefrLevel]
    return {
      ...l,
      desc: { zh: `${l.desc?.zh ?? ''}${exam.zh}`, en: `${l.desc?.en ?? ''} ${exam.en}` }
    }
  }),
  cefr: { A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' },
  sources: [
    CEFR_SOURCE,
    CEFRJ,
    OCTANOVE,
    {
      ...ECDICT,
      name: '按词频补级（ECDICT 的 BNC 与当代语料库名次）',
      note: '两张表都没有的词：按已分级的词在词频名次上的分布切成六段，补上等级'
    }
  ]
}

const level = (
  id: string,
  short: string,
  zh: string,
  en: string,
  descZh: string,
  descEn: string
): LevelDef => ({ id, short, name: { zh, en }, desc: { zh: descZh, en: descEn } })

/** 中国考试词表：一个词可以同时在几张表里 */
const cnExam: LevelSystemDef = {
  id: 'cn-exam',
  name: { zh: '中国考试词表', en: 'Chinese exam word lists' },
  kind: 'wordlist',
  levels: [
    level(
      'zk',
      '中考',
      '中考词汇',
      'Zhongkao',
      '初中毕业升学考试的词汇。《义务教育英语课程标准（2022 年版）》要求约 1,600 词。',
      'Senior high school entrance exam; the 2022 national curriculum lists about 1,600 words.'
    ),
    level(
      'gk',
      '高考',
      '高考词汇',
      'Gaokao',
      '普通高考的词汇。《普通高中英语课程标准（2017 年版 2020 年修订）》要求累计 3,000–3,200 词。',
      'National college entrance exam; the senior high curriculum requires 3,000–3,200 words in total.'
    ),
    level(
      'cet4',
      '四级',
      '大学英语四级',
      'CET-4',
      '大学英语四级考试：约 4,500 词（含中学词汇）与 700 个词组；写作、听力、阅读、翻译四部分，满分 710。',
      'College English Test Band 4: about 4,500 words (including school vocabulary) and 700 phrases; total score 710.'
    ),
    level(
      'cet6',
      '六级',
      '大学英语六级',
      'CET-6',
      '大学英语六级考试：约 5,500 词与 1,200 个词组；结构同四级，难度更高。',
      'College English Test Band 6: about 5,500 words and 1,200 phrases.'
    ),
    level(
      'ky',
      '考研',
      '考研英语',
      'Postgraduate entrance exam',
      '全国硕士研究生招生考试英语的大纲词汇，约 5,500 词。',
      'National postgraduate entrance exam (English); the syllabus lists about 5,500 words.'
    ),
    level(
      'ielts',
      '雅思',
      '雅思',
      'IELTS',
      '雅思备考词汇。雅思没有官方词表，这是常见备考词表的汇总。',
      'IELTS preparation vocabulary (IELTS has no official word list; this is a common compilation).'
    ),
    level(
      'toefl',
      '托福',
      '托福',
      'TOEFL',
      '托福备考词汇。托福没有官方词表，这是常见备考词表的汇总。',
      'TOEFL preparation vocabulary (no official list; a common compilation).'
    ),
    level(
      'gre',
      'GRE',
      'GRE',
      'GRE',
      'GRE 备考词汇：大量书面、学术与少用的词。',
      'GRE preparation vocabulary: many formal, academic and rare words.'
    )
  ],
  cefr: {
    zk: 'A2',
    gk: 'B1',
    cet4: 'B1',
    cet6: 'B2',
    ky: 'B2',
    ielts: 'B2',
    toefl: 'C1',
    gre: 'C2'
  },
  sources: [
    {
      ...ECDICT,
      note: 'ECDICT 的考试标签：zk 中考、gk 高考、cet4、cet6、ky 考研、ielts、toefl、gre'
    }
  ]
}

/** NGSL 系列：按语料库统计、为学习者挑的核心词表 */
const ngsl: LevelSystemDef = {
  id: 'ngsl',
  name: { zh: 'NGSL 核心词表', en: 'NGSL word lists' },
  kind: 'wordlist',
  levels: [
    level(
      'ndl',
      'NDL',
      'NDL 初级读物高频词',
      'New Dolch List',
      'New Dolch List 1.1：儿童与初学者读物里最常见的词。',
      'New Dolch List 1.1: the most frequent words in texts for children and beginners.'
    ),
    level(
      'ngsl-s',
      '口语',
      'NGSL 口语核心词',
      'NGSL-Spoken',
      'NGSL-Spoken 1.2：日常口语里最常用的约 720 个词。',
      'NGSL-Spoken 1.2: about 720 words that cover most everyday spoken English.'
    ),
    level(
      'ngsl',
      'NGSL',
      'NGSL 通用核心词',
      'NGSL',
      'New General Service List 1.2：2,809 个词，覆盖一般英语文本约 92% 的词。',
      'New General Service List 1.2: 2,809 words covering about 92% of general English text.'
    ),
    level(
      'tsl',
      '托业',
      'TSL 托业词汇',
      'TOEIC Service List',
      'TOEIC Service List 1.2：托业考试材料里 NGSL 之外的常用词。',
      'TOEIC Service List 1.2: frequent words in TOEIC materials beyond the NGSL.'
    ),
    level(
      'bsl',
      '商务',
      'BSL 商务词汇',
      'Business Service List',
      'Business Service List 1.20：商务英语里 NGSL 之外的常用词。',
      'Business Service List 1.20: frequent business English words beyond the NGSL.'
    ),
    level(
      'nawl',
      '学术',
      'NAWL 学术词汇',
      'New Academic Word List',
      'New Academic Word List 1.2：学术文本里 NGSL 之外的常用词，963 个。',
      'New Academic Word List 1.2: 963 frequent academic words beyond the NGSL.'
    )
  ],
  cefr: { ndl: 'A1', 'ngsl-s': 'A2', ngsl: 'B1', tsl: 'B2', bsl: 'B2', nawl: 'B2' },
  sources: [NGSL]
}

/** 柯林斯星级：按语料库词频分的五档（五星最常用） */
const collins: LevelSystemDef = {
  id: 'collins',
  name: { zh: '柯林斯星级', en: 'Collins frequency bands' },
  kind: 'wordlist',
  levels: [
    level('5', '★5', '柯林斯五星', 'Collins ★★★★★', '最常用的一档。', 'The most frequent band.'),
    level('4', '★4', '柯林斯四星', 'Collins ★★★★', '很常用。', 'Very frequent.'),
    level('3', '★3', '柯林斯三星', 'Collins ★★★', '常用。', 'Frequent.'),
    level('2', '★2', '柯林斯二星', 'Collins ★★', '较常用。', 'Fairly frequent.'),
    level('1', '★1', '柯林斯一星', 'Collins ★', '有一定频率。', 'Less frequent.')
  ],
  cefr: { '5': 'A1', '4': 'A2', '3': 'B1', '2': 'B2', '1': 'C1' },
  sources: [
    {
      ...ECDICT,
      note: 'ECDICT 的 collins 字段；星级源自柯林斯 COBUILD 按语料库统计的词频分档'
    }
  ]
}

export const spec: LangSpec = {
  code: 'en',
  name: { zh: '英语', en: 'English' },
  nativeName: 'English',
  bcp47: 'en',
  color: '#2f5fa8',
  direction: 'ltr',
  levelSystems: [cefr, cnExam, ngsl, collins],
  features: {
    texts: false,
    lexicon: true,
    alphabet: null,
    characters: null,
    grammar: false,
    inflection: false,
    phrasebook: false,
    idioms: false,
    stories: false,
    media: false,
    exam: false,
    ruby: null,
    romanization: false,
    speech: 'en-US'
  },
  intro: {
    zh: '世界上用得最广的语言。拼写跟读音的对应不规则，功能词有强读与弱读；词形变化少但不规则的多；时态、冠词、可数与不可数、短语动词与搭配是中文母语者的难点。',
    en: 'The most widely used language in the world. Spelling and sound do not match well and function words have weak forms; there is little inflection but many irregular forms; tenses, articles, countability, phrasal verbs and collocations are the hard parts for Chinese speakers.'
  }
}
