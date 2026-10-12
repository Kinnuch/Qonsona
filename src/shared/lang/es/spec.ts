/**
 * 西班牙语（Spanish）：学习包的描述——叫什么、几套分级、有哪些能力。分析与依据见 docs/lang/es.md。
 *
 * 分级：
 * - 主分级 CEFR A1–C2（塞万提斯学院的 DELE 六级、SIELE 都按它）。西班牙语没有开放许可的官方分级词表
 *   （塞万提斯学院《课程计划》PCIC 的词汇清单版权所有，不能搬），所以词按词频分到各级：
 *   wordfreq（七类语料）与 doozan（字幕，按词元归并）两份词频合起来排名次，切分点用 ELELex
 *   （按教材统计的各级词频，CC BY-NC-SA，只在开发时用来校准切分点，数据不随软件分发）校准；
 *   日常生活的具体词按自编的主题词表提级。每级词数见文档。
 * - 词频分档（wordlist）：按词频名次分 1–1000、1001–2000……几档，背高频词用。
 */
import { CEFR_SOURCE } from '../levels'
import type { LangSpec, LevelDef, LevelSystemDef, SourceRef } from '../types'

/** 分级依据 */
const LEVEL_SOURCES: SourceRef[] = [
  {
    id: 'wordfreq',
    name: 'wordfreq 西班牙语词频',
    license: 'CC BY-SA 4.0',
    credit: 'Robyn Speer',
    home: 'https://github.com/rspeer/wordfreq',
    note: '维基百科、字幕、新闻、图书、网页、社交媒体七类语料，按词形统计，分给各词条'
  },
  {
    id: 'doozan',
    name: '西班牙语词元词频（doozan/spanish_data）',
    license: 'CC BY-SA',
    credit: 'Jeff Doozan；hermitdave/FrequencyWords（OpenSubtitles 2018）',
    home: 'https://github.com/doozan/spanish_data',
    note: '电影电视字幕的词频，已按维基词典归并到词元'
  },
  {
    id: 'elelex',
    name: 'ELELex（CEFRLex 项目：西班牙语教材里各级的词频）',
    license: 'CC BY-NC-SA 4.0',
    credit: 'CENTAL, UCLouvain',
    home: 'https://cental.uclouvain.be/cefrlex/elelex/',
    note: '只在开发时用来校准各级的切分点（两边都有的词上让级差最小），数据不随软件分发'
  },
  {
    id: 'qonsona-es',
    name: 'Qonsona 自编的主题词表',
    license: 'MIT',
    credit: 'Qonsona',
    home: 'https://github.com/Kinnuch/Qonsona',
    note: '数字、星期、颜色、家人、食物、身体这类初学必会、词频却不高的词，按主题提到 A1–B1'
  }
]

const DELE: SourceRef = {
  id: 'dele',
  name: 'DELE 西班牙语水平证书（A1–C2）、SIELE 国际西班牙语评估服务',
  license: '考试说明（各级描述为本软件概括）',
  credit: 'Instituto Cervantes',
  home: 'https://examenes.cervantes.es/'
}

const level = (id: string, zh: string, en: string, descZh: string, descEn: string): LevelDef => ({
  id,
  name: { zh: `${id} ${zh}`, en: `${id} ${en}` },
  short: id,
  desc: { zh: descZh, en: descEn }
})

/** CEFR 六级：能做什么 + 对应的 DELE / SIELE 是什么样（自己概括的，考试细节以塞万提斯学院的说明为准） */
const CEFR: LevelSystemDef = {
  id: 'cefr',
  name: { zh: '欧洲共同语言参考标准（CEFR）', en: 'CEFR' },
  kind: 'proficiency',
  primary: true,
  levels: [
    level(
      'A1',
      '入门',
      'Beginner',
      '能用最常用的说法打招呼、介绍自己、问答姓名、国籍、住处等简单的个人信息，能看懂标牌、菜单上的常见词。' +
        'DELE A1：阅读 45 分钟、听力 25 分钟、写作 25 分钟、口语 10 分钟（另有 10 分钟准备），' +
        '满分 100，阅读与写作、听力与口语两组各要 30 分以上；SIELE 阅读 33–65 分（满分 250）大致在这一级。',
      'Greets, introduces themselves and asks and answers simple personal questions; reads common words on signs and menus. ' +
        'DELE A1: reading 45 min, listening 25 min, writing 25 min, speaking 10 min (+10 min preparation); ' +
        '100 points, at least 30 in each of the two groups (reading + writing, listening + speaking).'
    ),
    level(
      'A2',
      '基础',
      'Elementary',
      '能就购物、家庭、工作、住处周边这些熟悉的日常事务作简单交流，会用简单过去时讲做过的事，能读懂短信、通知、简短的说明。' +
        'DELE A2：阅读 60 分钟、听力 40 分钟、写作 45 分钟、口语 12 分钟（另有 12 分钟准备），及格线同 A1。',
      'Handles routine exchanges about shopping, family, work and the local area, tells what happened using the preterite, ' +
        'and reads short messages, notices and instructions. DELE A2: reading 60 min, listening 40 min, writing 45 min, ' +
        'speaking 12 min (+12 min preparation); same pass rule as A1.'
    ),
    level(
      'B1',
      '进阶',
      'Intermediate',
      '能读懂工作、学习、休闲中常见话题的要点，应付旅行中的大多数情况，能分清简单过去时与过去未完成时来叙事，' +
        '开始在愿望、建议、情感后面用虚拟式，能简单说明理由和打算。' +
        'DELE B1：阅读 70 分钟、听力 40 分钟、写作 60 分钟、口语 15 分钟（另有 15 分钟准备），及格线同上；' +
        'SIELE 阅读 118–177 分。',
      'Understands the main points on familiar topics, copes with most travel situations, narrates with preterite and imperfect, ' +
        'starts using the subjunctive after wishes, advice and emotions, and briefly gives reasons and plans. ' +
        'DELE B1: reading 70 min, listening 40 min, writing 60 min, speaking 15 min (+15 min preparation).'
    ),
    level(
      'B2',
      '中高级',
      'Upper intermediate',
      '能看懂较复杂文章（新闻、评论）的主旨，跟母语者交流比较流利自然，能就多种话题清楚、详细地表达并论证看法，' +
        '虚拟式过去时、条件句、被动与无人称句用得比较稳。' +
        'DELE B2：阅读 70 分钟、听力 40 分钟、写作 80 分钟、口语 20 分钟（另有 20 分钟准备），及格线同上；' +
        'SIELE 阅读 178–216 分。西班牙等地的大学入学常要求这一级。',
      'Understands complex texts such as news and opinion pieces, interacts fluently with native speakers and argues a point ' +
        'clearly on many subjects, using the past subjunctive, conditionals, passive and impersonal constructions with confidence. ' +
        'DELE B2: reading 70 min, listening 40 min, writing 80 min, speaking 20 min (+20 min preparation).'
    ),
    level(
      'C1',
      '高级',
      'Advanced',
      '能读懂各类长篇、难度高的文章并体会言外之意，在社交、学术、工作中灵活有效地运用语言，' +
        '能分辨语体（正式、口语）与地区用法。' +
        'DELE C1：阅读 80 分钟、听力 60 分钟、写作 80 分钟、口语 20 分钟（另有 20 分钟准备），及格线同上；' +
        'SIELE 阅读 217–250 分（SIELE 最高评到这一级）。',
      'Understands demanding, longer texts and implicit meaning, and uses the language flexibly for social, academic and ' +
        'professional purposes, telling registers and regional usage apart. DELE C1: reading 80 min, listening 60 min, ' +
        'writing 80 min, speaking 20 min (+20 min preparation). SIELE tops out at this level.'
    ),
    level(
      'C2',
      '精通',
      'Proficient',
      '几乎能毫不费力地听懂、读懂一切，能概括、重组各种来源的信息，表达精确，细微的意思差别、文学与习语用法都能把握。' +
        'DELE C2 是三场综合考试：语言运用与阅读听力 105 分钟，听读后写作 150 分钟，阅读后口语 20 分钟（另有 30 分钟准备），' +
        '每场满分约 33 分，三场都要 20 分以上。',
      'Understands virtually everything with ease, summarises and reconstructs information from different sources and ' +
        'expresses fine shades of meaning, including literary and idiomatic usage. DELE C2 has three integrated papers: ' +
        'use of language with reading and listening (105 min), integrated writing (150 min) and integrated speaking ' +
        '(20 min + 30 min preparation); at least 20 of about 33 points in each.'
    )
  ],
  cefr: { A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' },
  sources: [CEFR_SOURCE, DELE, ...LEVEL_SOURCES]
}

/** 词频分档的边界（名次） */
export const FREQ_BANDS: [string, number][] = [
  ['1k', 1000],
  ['2k', 2000],
  ['3k', 3000],
  ['5k', 5000],
  ['10k', 10000],
  ['20k', 20000]
]

const FREQ: LevelSystemDef = {
  id: 'freq',
  name: { zh: '高频词分档', en: 'Frequency bands' },
  kind: 'wordlist',
  levels: FREQ_BANDS.map(([id, top], i) => {
    const from = i ? FREQ_BANDS[i - 1][1] + 1 : 1
    return {
      id,
      name: { zh: `常用词 ${from}–${top}`, en: `Top ${from}–${top}` },
      short: id,
      desc: {
        zh: `按词频名次排在第 ${from} 到 ${top} 的词（书面语与字幕两份词频合起来排）。前一千个词覆盖一般文章八成左右的词次。`,
        en: `Words ranked ${from}–${top} by frequency (written and subtitle corpora combined).`
      }
    }
  }),
  sources: LEVEL_SOURCES.slice(0, 2)
}

export const spec: LangSpec = {
  code: 'es',
  name: { zh: '西班牙语', en: 'Spanish' },
  nativeName: 'español',
  bcp47: 'es',
  color: '#d0742a',
  direction: 'ltr',
  levelSystems: [CEFR, FREQ],
  features: {
    texts: true,
    lexicon: true,
    alphabet: 'phonics',
    characters: null,
    grammar: true,
    inflection: true,
    phrasebook: true,
    idioms: true,
    stories: true,
    media: true,
    exam: true,
    ruby: null,
    romanization: false,
    speech: 'es-ES'
  },
  intro: {
    zh:
      '全世界约五亿人以它为母语，二十多个国家的官方语言。拼读规则整齐，看到就会读；' +
      '难点在变位：动词按人称、时态、语气变出几十个形式，虚拟式用得多，ser 与 estar、简单过去时与过去未完成时要分清。' +
      '名词分阴阳性，冠词、形容词跟着变。西班牙与拉丁美洲在发音、代词（vosotros / ustedes）和词汇上各有习惯。',
    en:
      'Spoken natively by about half a billion people and official in over twenty countries. Spelling is regular, so words ' +
      'are read as written; the challenge is verb conjugation (dozens of forms, frequent subjunctive, ser vs. estar, ' +
      'preterite vs. imperfect). Nouns are masculine or feminine and articles and adjectives agree. Spain and Latin America ' +
      'differ in pronunciation, pronouns (vosotros / ustedes) and vocabulary.'
  }
}
