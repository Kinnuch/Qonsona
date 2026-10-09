/**
 * 韩语（Korean）：学习包的描述——叫什么、几套分级、有哪些能力。分析与依据见 docs/lang/ko.md。
 *
 * 主分级是 TOPIK（韩国语能力考试）1–6 级；词分到各级的依据：
 *   1. 国立国语院《国际通用韩国语标准教育课程适用研究（4 阶段，2017）》的词汇等级表（1–6 级，10,635 词）；
 *   2. 表里没有的词：한국어기초사전的词汇等级（초급 → 1–2 级段、중급 → 3–4、고급 → 5–6），段内按词频切。
 * 另有三套：标准课程词表本身（只收官方的 10,635 词）、한국어기초사전等级、2003 年学习用词汇目录（A/B/C）。
 */
import type { LangSpec, LevelSystemDef, SourceRef } from '../types'

export const NIKL_STD2017: SourceRef = {
  id: 'nikl-std2017',
  name: '国际通用韩国语标准教育课程适用研究（4 阶段，2017）词汇、语法等级表',
  license: '公共누리 第 1 类型（注明出处可自由使用）',
  credit: '国立国语院（국립국어원）',
  home: 'https://www.korean.go.kr/front/reportData/reportDataView.do?mn_id=45&report_seq=932'
}

export const NIKL_VOCAB2003: SourceRef = {
  id: 'nikl-vocab2003',
  name: '韩国语学习用词汇目录（한국어 학습용 어휘 목록，2003）',
  license: '公共누리 第 1 类型（注明出处可自由使用）',
  credit: '国立国语研究院（현 국립국어원）',
  home: 'https://www.korean.go.kr/front/etcData/etcDataView.do?mn_id=46&etc_seq=71'
}

export const KRDICT: SourceRef = {
  id: 'krdict',
  name: '한국어기초사전（韩国语基础词典）',
  license: 'CC BY-SA 2.0 KR',
  credit: '国立国语院（국립국어원）',
  home: 'https://krdict.korean.go.kr/'
}

export const TOPIK_SOURCE: SourceRef = {
  id: 'topik',
  name: '韩国语能力考试（TOPIK）的等级与评价标准',
  license: '考试说明（各级的说明为本软件概括）',
  credit: '国立国际教育院（국립국제교육원，NIIED）',
  home: 'https://www.topik.go.kr/'
}

export const FREQ_SUBTITLES: SourceRef = {
  id: 'freq-opensubtitles',
  name: '词频：FrequencyWords（OpenSubtitles 2018 韩语字幕），按本软件的还原规则归到原形',
  license: 'CC BY-SA 4.0',
  credit: 'Hermit Dave；OpenSubtitles.org；OPUS（Lison & Tiedemann 2016）',
  home: 'https://github.com/hermitdave/FrequencyWords'
}

const topik: LevelSystemDef = {
  id: 'topik',
  name: { zh: '韩国语能力考试（TOPIK）', en: 'TOPIK (Test of Proficiency in Korean)' },
  kind: 'proficiency',
  primary: true,
  levels: [
    {
      id: '1',
      short: '1급',
      name: { zh: 'TOPIK 1 级（初级）', en: 'TOPIK Level 1 (beginner)' },
      desc: {
        zh: '能做自我介绍、买东西、点菜这类最基本的事；能听懂、说出关于自己、家人、爱好、天气的简单句子。约 800 个基础词。考 TOPIK I（听力 30 题、阅读 40 题，满分 200），80 分以上为 1 级。',
        en: 'Handles survival tasks such as introducing oneself, shopping and ordering food; understands and makes simple sentences about self, family, hobbies and weather. About 800 basic words. TOPIK I (30 listening + 40 reading items, 200 points): 80+ for Level 1.'
      }
    },
    {
      id: '2',
      short: '2급',
      name: { zh: 'TOPIK 2 级（初级）', en: 'TOPIK Level 2 (beginner)' },
      desc: {
        zh: '能打电话、请求帮忙，会用邮局、银行等公共设施；用一千五到两千词谈熟悉的日常话题，能分清正式与非正式场合。TOPIK I 140 分以上为 2 级。',
        en: 'Makes phone calls and requests, uses public facilities such as the post office and bank; talks about familiar topics in paragraphs with 1,500–2,000 words and tells formal from informal settings. TOPIK I: 140+ for Level 2.'
      }
    },
    {
      id: '3',
      short: '3급',
      name: { zh: 'TOPIK 3 级（中级）', en: 'TOPIK Level 3 (intermediate)' },
      desc: {
        zh: '日常生活基本没有困难，能维持一般的社会交往；能成段地理解、表达熟悉的社会话题，分得清书面语与口语。考 TOPIK II（听力 50 题、写作 4 题、阅读 50 题，满分 300），120 分以上为 3 级。',
        en: 'Copes with daily life without much difficulty and maintains social relationships; understands and expresses familiar social topics in paragraphs and distinguishes written from spoken style. TOPIK II (50 listening, 4 writing, 50 reading; 300 points): 120+ for Level 3.'
      }
    },
    {
      id: '4',
      short: '4급',
      name: { zh: 'TOPIK 4 级（中级）', en: 'TOPIK Level 4 (intermediate)' },
      desc: {
        zh: '能处理一般的工作事务，读懂新闻、报纸里浅显的内容；对一般的社会、抽象话题能比较准确流利地理解和表达，懂常用惯用语和有代表性的韩国文化。TOPIK II 150 分以上为 4 级。',
        en: 'Performs routine work tasks and understands plain news and newspaper articles; handles general social and abstract topics fairly accurately and fluently, with common idioms and key aspects of Korean culture. TOPIK II: 150+ for Level 4.'
      }
    },
    {
      id: '5',
      short: '5급',
      name: { zh: 'TOPIK 5 级（高级）', en: 'TOPIK Level 5 (advanced)' },
      desc: {
        zh: '能在专业领域里做一定程度的研究和工作；政治、经济、社会、文化方面不熟悉的话题也能理解和运用，能按正式与非正式、口语与书面语的场合恰当地用语。TOPIK II 190 分以上为 5 级。',
        en: 'Functions to some degree in research and professional work; understands and uses unfamiliar topics across politics, economy, society and culture, adapting register to formal, informal, spoken and written contexts. TOPIK II: 190+ for Level 5.'
      }
    },
    {
      id: '6',
      short: '6급',
      name: { zh: 'TOPIK 6 级（高级）', en: 'TOPIK Level 6 (advanced)' },
      desc: {
        zh: '能比较准确流利地在专业领域里研究和工作；各方面不熟悉的话题都能运用自如，虽不到母语者的水平，表达意思没有困难。TOPIK II 230 分以上为 6 级。',
        en: 'Carries out research and professional work fairly accurately and fluently; deals with unfamiliar topics in all fields and, though not at native level, has no difficulty expressing meaning. TOPIK II: 230+ for Level 6.'
      }
    }
  ],
  // 国立国际教育院没有发布官方对照；这是通行的对应，与《한국어교육》2025 年 TOPIK–CEFR 等级描述比较研究的结论一致
  cefr: { '1': 'A1', '2': 'A2', '3': 'B1', '4': 'B2', '5': 'C1', '6': 'C2' },
  sources: [TOPIK_SOURCE, NIKL_STD2017, KRDICT, FREQ_SUBTITLES]
}

const kstd: LevelSystemDef = {
  id: 'kstd',
  name: {
    zh: '国际通用韩国语标准课程词汇（2017）',
    en: 'International Standard Curriculum for Korean: vocabulary (2017)'
  },
  kind: 'wordlist',
  levels: ['1', '2', '3', '4', '5', '6'].map((id) => ({
    id,
    short: `${id}급`,
    name: { zh: `标准课程 ${id} 级`, en: `Standard curriculum level ${id}` },
    desc: {
      zh: '国立国语院为海外韩语教育制定的标准课程所列的词，共 10,635 个，分 6 级，跟 TOPIK、各国大学韩国语学堂的 6 级体系对应。',
      en: 'Words listed by the National Institute of Korean Language in the International Standard Curriculum for Korean: 10,635 words in six levels matching TOPIK and Korean language institutes.'
    }
  })),
  cefr: { '1': 'A1', '2': 'A2', '3': 'B1', '4': 'B2', '5': 'C1', '6': 'C2' },
  sources: [NIKL_STD2017]
}

const krdict: LevelSystemDef = {
  id: 'krdict',
  name: { zh: '한국어기초사전词汇等级', en: 'Basic Korean Dictionary vocabulary level' },
  kind: 'proficiency',
  levels: [
    {
      id: '1',
      short: '초급',
      name: { zh: '初级（★★★）', en: 'Beginner (★★★)' },
      desc: {
        zh: '한국어기초사전标为初级的词：初学阶段（相当于 TOPIK 1–2 级）就要会的词。',
        en: 'Marked beginner in the Basic Korean Dictionary: words needed at the beginning stage (about TOPIK 1–2).'
      }
    },
    {
      id: '2',
      short: '중급',
      name: { zh: '中级（★★）', en: 'Intermediate (★★)' },
      desc: {
        zh: '标为中级的词：相当于 TOPIK 3–4 级。',
        en: 'Marked intermediate: about TOPIK 3–4.'
      }
    },
    {
      id: '3',
      short: '고급',
      name: { zh: '高级（★）', en: 'Advanced (★)' },
      desc: {
        zh: '标为高级的词：初中级以外收进学习词典的词（三万多个），相当于 TOPIK 5–6 级及以上。',
        en: 'Marked advanced: the rest of the learner’s dictionary (over 30,000 words), TOPIK 5–6 and beyond.'
      }
    }
  ],
  cefr: { '1': 'A2', '2': 'B2', '3': 'C1' },
  sources: [KRDICT]
}

const nikl2003: LevelSystemDef = {
  id: 'nikl2003',
  name: { zh: '韩国语学习用词汇目录（2003）', en: 'Korean Learner’s Vocabulary List (2003)' },
  kind: 'wordlist',
  levels: [
    {
      id: 'A',
      short: 'A',
      name: { zh: 'A 级（初级，982 词）', en: 'Grade A (beginner, 982 words)' },
      desc: {
        zh: '国立国语研究院 2003 年按使用频度与教学需要选的学习用词汇里的第一阶段。',
        en: 'Stage one of the learner’s vocabulary selected by frequency and teaching needs (NIKL, 2003).'
      }
    },
    {
      id: 'B',
      short: 'B',
      name: { zh: 'B 级（中级，2,111 词）', en: 'Grade B (intermediate, 2,111 words)' },
      desc: { zh: '第二阶段。', en: 'Stage two.' }
    },
    {
      id: 'C',
      short: 'C',
      name: { zh: 'C 级（高级，2,872 词）', en: 'Grade C (advanced, 2,872 words)' },
      desc: { zh: '第三阶段。', en: 'Stage three.' }
    }
  ],
  cefr: { A: 'A2', B: 'B1', C: 'B2' },
  sources: [NIKL_VOCAB2003]
}

export const spec: LangSpec = {
  code: 'ko',
  name: { zh: '韩语', en: 'Korean' },
  nativeName: '한국어',
  bcp47: 'ko',
  color: '#0e8a7e',
  direction: 'ltr',
  levelSystems: [topik, kstd, krdict, nikl2003],
  // 阶段一只开词典；阅读（发音提示、罗马字）、字母课、汉字栏等到后面的阶段再开
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
    speech: 'ko-KR'
  },
  intro: {
    zh: '韩文 24 个字母拼成音节块，一两天就能学会读；难在写法与读音不一致（먹는 读 멍는）、助词词尾层层黏着、敬语分好几级。词汇一半以上是汉字词，「학교 學校」「도서관 圖書館」，中文母语者一看就懂。',
    en: 'Hangul’s 24 letters build syllable blocks and can be learned in a day or two; the challenges are sound changes (먹는 is said 멍는), stacked particles and endings, and several levels of politeness. Over half the vocabulary is Sino-Korean, e.g. 학교 學校 “school”.'
  }
}
