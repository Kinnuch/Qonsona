/**
 * 法语（French）：学习包的描述——叫什么、几套分级、有哪些能力。分析与依据见 docs/lang/fr.md。
 *
 * 分级：
 * - 主分级 CEFR A1–C2：法国教育部的 DELF（A1–B2）、DALF（C1、C2）就按这六级考，TCF 的分数也换算成这六级。
 *   词分到各级的办法：Lexique 的词频（字幕与书籍合起来）按名次切，切点照 FLELex（按 FLE 教材统计的分级词表，
 *   CC BY-NC-SA，只拿来核对、不进库）各级的词数定；再用手挑的 A1、A2 核心词（data/fr/core.txt）
 *   和语体（粗俗、俚语、古旧）调整。
 * - 词频段（wordlist）：Lexique 词频名次的 1k、2k、3k、5k、10k、20k 段，生词本按段背用。
 * 阶段一只开词典（lexicon）；阅读、课程、练习等以后的阶段再开。
 */
import { CEFR_SOURCE } from '../levels'
import type { LevelDef, LevelSystemDef, LangSpec, SourceRef } from '../types'

export const LEXIQUE_SOURCE: SourceRef = {
  id: 'lexique',
  name: 'Lexique 4.1 / 3.83（法语词汇数据库：字幕与书籍词频）',
  license: 'CC BY-SA 4.0',
  credit: 'Boris New, Christophe Pallier 等（lexique.org）',
  home: 'http://www.lexique.org/'
}

export const CORE_SOURCE: SourceRef = {
  id: 'fr-core',
  name: 'A1、A2 核心词（按 DELF A1、A2 的话题手挑：问候、数字、时间、家庭、饮食、衣物、住房、城市、交通、学校……）',
  license: 'CC0（本软件自编）',
  credit: 'Qonsona',
  home: 'https://github.com/Kinnuch/Qonsona'
}

/**
 * 各级说明：能做什么，对应的考试是什么样（DELF / DALF 的卷面，TCF 的分数段）。
 * 考试的时长、分数照 France Éducation international 公布的卷面（2023 年起的新版），写的是概数。
 */
const CEFR_FR: LevelDef[] = [
  {
    id: 'A1',
    name: { zh: 'A1 入门', en: 'A1 Beginner' },
    short: 'A1',
    desc: {
      zh: '能听懂、会说最基本的日常用语：问候、介绍自己和家人、数字、时间、购物；能填简单的表格、写几句话的明信片。DELF A1：听力约 20 分钟、阅读约 30 分钟、写作约 30 分钟，口试 5–7 分钟（准备 10 分钟）；四项各 25 分，总分 50 分及格、每项不低于 5 分。TCF 100–199 分。',
      en: 'Understands and uses everyday expressions: greetings, introducing oneself and family, numbers, time, shopping; fills in simple forms. DELF A1: listening ~20 min, reading ~30 min, writing ~30 min, speaking 5–7 min (10 min preparation); four parts of 25 points, pass at 50/100 with at least 5 in each. TCF 100–199.'
    }
  },
  {
    id: 'A2',
    name: { zh: 'A2 基础', en: 'A2 Elementary' },
    short: 'A2',
    desc: {
      zh: '能就熟悉的事简单交流：购物、交通、工作、住处、过去的经历；能读懂简短的通知、广告、私人信件，写简单的邀请、感谢。DELF A2：听力约 25 分钟、阅读约 30 分钟、写作约 45 分钟，口试 6–8 分钟（准备 10 分钟）。TCF 200–299 分。',
      en: 'Handles simple exchanges on familiar matters (shopping, transport, work, home, past events); reads short notices, ads and personal letters. DELF A2: listening ~25 min, reading ~30 min, writing ~45 min, speaking 6–8 min (10 min preparation). TCF 200–299.'
    }
  },
  {
    id: 'B1',
    name: { zh: 'B1 进阶', en: 'B1 Intermediate' },
    short: 'B1',
    desc: {
      zh: '能听懂、读懂熟悉话题的要点，应付旅行中的大多数情况，叙述经历和计划、表达看法并简单说明理由。DELF B1：听力约 25 分钟、阅读约 35 分钟、写作约 45 分钟（表达观点的短文），口试约 15 分钟。TCF 300–399 分。',
      en: 'Understands the main points on familiar topics, copes with most travel situations, narrates experiences and gives brief reasons for opinions. DELF B1: listening ~25 min, reading ~35 min, writing ~45 min (opinion essay), speaking ~15 min. TCF 300–399.'
    }
  },
  {
    id: 'B2',
    name: { zh: 'B2 中高级', en: 'B2 Upper intermediate' },
    short: 'B2',
    desc: {
      zh: '能读懂报刊文章、评论，跟母语者交流比较流利，能就多种话题清楚地论证自己的观点；法国大学本科入学一般要 B2。DELF B2：听力约 30 分钟、阅读约 1 小时、写作约 1 小时（论证文），口试约 20 分钟（准备 30 分钟）；2023 年起的新版听力、阅读全是选择题，口试就一份短文陈述并维护观点。TCF 400–499 分。',
      en: 'Reads press articles and opinion pieces, talks with native speakers fairly fluently and argues a point of view; usually required for French universities. DELF B2: listening ~30 min, reading ~1 h, writing ~1 h (argumentative essay), speaking ~20 min (30 min preparation); since 2023 the listening and reading parts are multiple choice. TCF 400–499.'
    }
  },
  {
    id: 'C1',
    name: { zh: 'C1 高级', en: 'C1 Advanced' },
    short: 'C1',
    desc: {
      zh: '能读懂长篇、难度高的文章并体会言外之意，在学习、工作中灵活运用法语，写结构清楚的长文。DALF C1：听力约 40 分钟、阅读约 50 分钟、写作 2 小时 30 分钟（资料综述 + 论证），口试约 30 分钟（准备 1 小时）。TCF 500–599 分。',
      en: 'Understands long, demanding texts and implicit meaning; uses French flexibly for study and work. DALF C1: listening ~40 min, reading ~50 min, writing 2 h 30 (synthesis and argumentative essay), speaking ~30 min (1 h preparation). TCF 500–599.'
    }
  },
  {
    id: 'C2',
    name: { zh: 'C2 精通', en: 'C2 Proficient' },
    short: 'C2',
    desc: {
      zh: '几乎能毫不费力地理解一切，能综合不同来源的信息，表达精确、细腻。DALF C2：听说合考（准备 1 小时、口试约 30 分钟）、读写合考 3 小时 30 分钟，各 50 分。TCF 600–699 分。',
      en: 'Understands virtually everything with ease and expresses fine shades of meaning. DALF C2: combined listening/speaking (1 h preparation, ~30 min exam) and reading/writing (3 h 30), 50 points each. TCF 600–699.'
    }
  }
]

const cefr: LevelSystemDef = {
  id: 'cefr',
  name: { zh: '欧洲共同语言参考标准（CEFR · DELF / DALF）', en: 'CEFR (DELF / DALF)' },
  kind: 'proficiency',
  primary: true,
  levels: CEFR_FR,
  cefr: { A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' },
  sources: [CEFR_SOURCE, LEXIQUE_SOURCE, CORE_SOURCE]
}

/** 词频段：段的 id 与这一段的最后一个名次 */
export const FREQ_BANDS: [id: string, upTo: number][] = [
  ['1k', 1000],
  ['2k', 2000],
  ['3k', 3000],
  ['5k', 5000],
  ['10k', 10000],
  ['20k', 20000]
]

const band = (id: string, from: number, to: number): LevelDef => ({
  id,
  name: { zh: `词频 ${from}–${to}`, en: `Frequency ${from}–${to}` },
  short: id,
  desc: {
    zh: `Lexique 词频名次第 ${from}–${to} 的词（字幕与书籍合起来排）`,
    en: `Words ranked ${from}–${to} by Lexique frequency (subtitles and books combined)`
  }
})

const freq: LevelSystemDef = {
  id: 'freq',
  name: { zh: '词频段（Lexique）', en: 'Frequency bands (Lexique)' },
  kind: 'wordlist',
  levels: FREQ_BANDS.map(([id, to], i) => band(id, i ? FREQ_BANDS[i - 1][1] + 1 : 1, to)),
  cefr: { '1k': 'A1', '2k': 'A2', '3k': 'B1', '5k': 'B1', '10k': 'B2', '20k': 'C1' },
  sources: [LEXIQUE_SOURCE]
}

export const spec: LangSpec = {
  code: 'fr',
  name: { zh: '法语', en: 'French' },
  nativeName: 'français',
  bcp47: 'fr',
  color: '#6b4fa8',
  direction: 'ltr',
  levelSystems: [cefr, freq],
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
    ruby: 'ipa',
    romanization: false,
    speech: 'fr-FR'
  },
  intro: {
    zh: '名词分阴阳性，冠词、形容词都要跟着变；动词按人称、时态、语式变位，常用动词大多不规则。读音跟拼写差得远：词尾的辅音多半不发音，词与词之间还有连诵、省音，另有四个鼻化元音。',
    en: 'Nouns have gender, and articles and adjectives agree with them; verbs conjugate for person, tense and mood, and most common verbs are irregular. Spelling and sound diverge: final consonants are mostly silent, words link through liaison and elision, and there are four nasal vowels.'
  }
}
