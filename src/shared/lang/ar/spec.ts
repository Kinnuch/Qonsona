/**
 * 阿拉伯语（Arabic）：学习包的描述——叫什么、几套分级、有哪些能力。
 * 分析与依据见 docs/lang/ar.md；阶段一开了词典，阶段二开阅读（课文、新闻）、语法、转写注音与词根页签，别的能力随各阶段打开。
 */
import { cefrSystem } from '../levels'
import type { LangSpec, LevelSystemDef, SourceRef } from '../types'

/** 怎么把词分到各级：没有开放许可的阿语分级词表，按归到原形上的词频切（见 docs/lang/ar.md「分级」） */
const FREQ_SOURCE: SourceRef = {
  id: 'ar-freq-levels',
  name: '按词频切分：wordfreq 阿拉伯语词频（维基百科、字幕、新闻、网页、推特）归到维基词典的原形上，加 Tatoeba 例句里的出现次数',
  license: 'CC BY-SA 4.0（wordfreq、维基词典）；CC BY 2.0 FR（Tatoeba）',
  credit: 'Robyn Speer (wordfreq); Wiktionary contributors; Tatoeba contributors',
  home: 'https://github.com/rspeer/wordfreq',
  note: '参加分级的九千个常用词条，各级规模参照 Kelly 项目阿语表：A1 前 750，A2 到 2000，B1 到 3500，B2 到 5300，C1 到 7000，C2 到 9000'
}

const ACTFL_SOURCE: SourceRef = {
  id: 'actfl',
  name: 'ACTFL Proficiency Guidelines 2024；ACTFL 与 CEFR 的对照（Assigning CEFR Ratings to ACTFL Assessments，2016，听读一表）',
  license: '参考框架（等级说明为本软件概括）',
  credit: 'American Council on the Teaching of Foreign Languages (ACTFL)',
  home: 'https://www.actfl.org/educator-resources/actfl-proficiency-guidelines'
}

/**
 * ACTFL 的十一个小级：美国的阿拉伯语教学、考试（OPI、AAPPL、STAMP）通行这一套。
 * 词的 ACTFL 小级是在它的 CEFR 级里按词频再细分的，跟 CEFR 的对应见 cefr。
 */
const actfl: LevelSystemDef = {
  id: 'actfl',
  name: { zh: 'ACTFL 语言能力标准', en: 'ACTFL Proficiency Guidelines' },
  kind: 'proficiency',
  levels: [
    {
      id: 'NL',
      name: { zh: '初级低（Novice Low）', en: 'Novice Low' },
      short: 'NL',
      desc: {
        zh: '只会几个孤立的词：问候语、数字、颜色这类背下来的说法。',
        en: 'Isolated memorised words such as greetings, numbers and colours.'
      }
    },
    {
      id: 'NM',
      name: { zh: '初级中（Novice Mid）', en: 'Novice Mid' },
      short: 'NM',
      desc: {
        zh: '会用背下来的词和短语应付最熟悉的话题，句子还说不完整。',
        en: 'Memorised words and phrases on the most familiar topics; little sentence-level language.'
      }
    },
    {
      id: 'NH',
      name: { zh: '初级高（Novice High）', en: 'Novice High' },
      short: 'NH',
      desc: {
        zh: '开始能说简单的句子，应付打招呼、买东西这类最基本的事，但常常回到背好的说法。',
        en: 'Begins to create simple sentences for basic tasks, often falling back on memorised language.'
      }
    },
    {
      id: 'IL',
      name: { zh: '中级低（Intermediate Low）', en: 'Intermediate Low' },
      short: 'IL',
      desc: {
        zh: '能用短句就日常话题（自己、家人、吃住）简单问答，靠对方耐心配合。',
        en: 'Short sentences on everyday topics (self, family, food, home) with a sympathetic listener.'
      }
    },
    {
      id: 'IM',
      name: { zh: '中级中（Intermediate Mid）', en: 'Intermediate Mid' },
      short: 'IM',
      desc: {
        zh: '能就日常生活的话题交谈、问路、点菜，句子串成一小段。',
        en: 'Handles uncomplicated everyday situations, asking and answering questions in strings of sentences.'
      }
    },
    {
      id: 'IH',
      name: { zh: '中级高（Intermediate High）', en: 'Intermediate High' },
      short: 'IH',
      desc: {
        zh: '大多数日常交谈应付自如，开始能叙述、描述，但还不稳定。',
        en: 'Handles most everyday tasks with ease; begins to narrate and describe, not yet consistently.'
      }
    },
    {
      id: 'AL',
      name: { zh: '高级低（Advanced Low）', en: 'Advanced Low' },
      short: 'AL',
      desc: {
        zh: '能用成段的话按时间叙述、描述，读懂新闻报道这类熟悉题材的文章。',
        en: 'Narrates and describes in paragraphs across time frames; reads familiar factual texts such as news.'
      }
    },
    {
      id: 'AM',
      name: { zh: '高级中（Advanced Mid）', en: 'Advanced Mid' },
      short: 'AM',
      desc: {
        zh: '叙述、描述流利准确，能处理意外的情况，读懂一般的报刊文章。',
        en: 'Narrates and describes fluently and accurately and deals with unexpected complications.'
      }
    },
    {
      id: 'AH',
      name: { zh: '高级高（Advanced High）', en: 'Advanced High' },
      short: 'AH',
      desc: {
        zh: '开始能论证、提出假设，讨论抽象话题，但还撑不了很久。',
        en: 'Begins to support opinions and hypothesise on abstract topics, but cannot yet sustain it.'
      }
    },
    {
      id: 'S',
      name: { zh: '优秀级（Superior）', en: 'Superior' },
      short: 'S',
      desc: {
        zh: '能就抽象话题论证、假设，读懂各类正式文章，用语准确得体。',
        en: 'Supports opinions and hypothesises on abstract topics; reads demanding formal texts.'
      }
    },
    {
      id: 'D',
      name: { zh: '杰出级（Distinguished）', en: 'Distinguished' },
      short: 'D',
      desc: {
        zh: '像受过良好教育的母语者一样，按对象与文体调整用语，读懂文学、专业文献的言外之意。',
        en: 'Tailors language to audience and register like a highly educated native speaker.'
      }
    }
  ],
  cefr: {
    NL: 'A1',
    NM: 'A1',
    NH: 'A1',
    IL: 'A1',
    IM: 'A2',
    IH: 'B1',
    AL: 'B1',
    AM: 'B2',
    AH: 'C1',
    S: 'C1',
    D: 'C2'
  },
  sources: [ACTFL_SOURCE, FREQ_SOURCE]
}

export const spec: LangSpec = {
  code: 'ar',
  name: { zh: '阿拉伯语', en: 'Arabic' },
  nativeName: 'العربية',
  bcp47: 'ar',
  color: '#16805c',
  direction: 'rtl',
  levelSystems: [cefrSystem([FREQ_SOURCE]), actfl],
  features: {
    texts: true,
    lexicon: true,
    alphabet: 'letters',
    characters: 'roots',
    grammar: true,
    inflection: true,
    phrasebook: true,
    idioms: true,
    stories: true,
    media: true,
    exam: true,
    ruby: 'romanization',
    romanization: true,
    speech: 'ar-SA'
  },
  intro: {
    zh: '从右往左写的辅音字母，短元音平时不写；词由三辅音词根套进词型构成（ك ت ب：كِتَاب 书、كَاتِب 作者、مَكْتَب 办公室），动词分十种派生式。书面的标准语通行整个阿拉伯世界，口语是各地方言。',
    en: 'Written right to left in consonant letters, usually without short vowels; words are built by fitting three-consonant roots into patterns (k-t-b: kitāb book, kātib writer, maktab office), and verbs come in ten derived forms. Modern Standard Arabic is shared across the Arab world; everyday speech is in regional dialects.'
  }
}
