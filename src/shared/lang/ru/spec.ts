/**
 * 俄语（Russian）：学习包的描述——叫什么、几套分级、有哪些能力。分析与依据见 docs/lang/ru.md。
 *
 * 主分级用俄语对外等级考试 ТРКИ（TORFL）的六级：ТЭУ、ТБУ、ТРКИ-1 到 ТРКИ-4，官方定义就对着 CEFR 的
 * A1–C2。官方的词汇大纲（Лексический минимум，Златоуст 出版）有版权、没有开放的版本，所以词的等级由开放
 * 的词频（字幕、维基百科、Tatoeba 例句、OpenRussian 排名）合起来排序，按各级官方词汇量（780、1300、2300、
 * 约 5000、1.1 万以上、约 2 万，都是累计）切分；切法与依据见 docs/lang/ru.md「分级」。
 */
import { CEFR_SOURCE } from '../levels'
import type { LangSpec, LevelSystemDef } from '../types'
import { RU_SOURCES } from './sources'

/** ТРКИ 六级：id 是考试的级别，cefr 写对应的 CEFR；角标用 CEFR 的写法（初学者也认得） */
export const TORFL: LevelSystemDef = {
  id: 'torfl',
  name: {
    zh: '俄语对外等级考试（ТРКИ / TORFL）',
    en: 'Test of Russian as a Foreign Language (TORFL / ТРКИ)'
  },
  kind: 'proficiency',
  primary: true,
  levels: [
    {
      id: 'teu',
      name: { zh: 'ТЭУ 初级（A1）', en: 'TEU Elementary (A1)' },
      short: 'A1',
      desc: {
        zh: '初级（Элементарный уровень）：能在有限的日常场景里满足最基本的交际需要——问候、介绍自己和家人、问路、买东西、说时间。官方词汇大纲约 780 词。考试分词汇·语法、阅读、听力、写作、口语五个分项，每项答对 66% 才算通过。',
        en: 'Elementary: meets the most basic needs in a limited range of everyday situations — greetings, introducing yourself and your family, asking the way, shopping, telling the time. Official lexical minimum: about 780 words. Five subtests (vocabulary & grammar, reading, listening, writing, speaking); 66% on each to pass.'
      }
    },
    {
      id: 'tbu',
      name: { zh: 'ТБУ 基础级（A2）', en: 'TBU Basic (A2)' },
      short: 'A2',
      desc: {
        zh: '基础级（Базовый уровень）：能就熟悉的话题（学习、工作、家庭、城市、购物、旅行）作简单交流，读懂短小的日常文字，写简单的便条和信。官方词汇大纲约 1300 词。',
        en: 'Basic: communicates simply on familiar topics (study, work, family, the city, shopping, travel), reads short everyday texts and writes simple notes and letters. Official lexical minimum: about 1,300 words.'
      }
    },
    {
      id: 'trki1',
      name: { zh: 'ТРКИ-1 一级（B1）', en: 'TORFL-1 (B1)' },
      short: 'B1',
      desc: {
        zh: '一级（Первый сертификационный уровень）：能应付日常生活、学习和社会文化方面的大多数情况，读懂报刊上不太难的文章，能叙述、说明理由。俄罗斯高校招收外国学生一般要求这一级。官方词汇大纲约 2300 词。',
        en: 'First certificate level: handles most everyday, academic and socio-cultural situations, reads straightforward newspaper articles, narrates and gives reasons. Usually required to enrol at a Russian university. Official lexical minimum: about 2,300 words.'
      }
    },
    {
      id: 'trki2',
      name: { zh: 'ТРКИ-2 二级（B2）', en: 'TORFL-2 (B2)' },
      short: 'B2',
      desc: {
        zh: '二级（Второй сертификационный уровень）：在各种交际场合都能比较自如地使用俄语，读懂政论、科普、文学作品的主要内容，能就社会话题发表看法。在俄罗斯高校用俄语取得学士、硕士学位（语文学方向除外）一般要求这一级。官方词汇大纲约 5000 词。',
        en: 'Second certificate level: uses Russian fairly freely in all spheres, follows journalistic, popular-science and literary texts and discusses social issues. Usually required for a bachelor’s or master’s degree from a Russian university (other than in philology). Official lexical minimum: about 5,000 words.'
      }
    },
    {
      id: 'trki3',
      name: { zh: 'ТРКИ-3 三级（C1）', en: 'TORFL-3 (C1)' },
      short: 'C1',
      desc: {
        zh: '三级（Третий сертификационный уровень）：各种场合都能高水平地运用俄语，读懂难度高的各类文章并体会言外之意，可以从事翻译、编辑、新闻、外交等以俄语为工具的工作。词汇量要求一万一千以上（积极词汇约七千）。',
        en: 'Third certificate level: high proficiency in all spheres, understands demanding texts and implicit meaning; enough to work as a translator, editor, journalist or diplomat. Vocabulary: over 11,000 words (about 7,000 active).'
      }
    },
    {
      id: 'trki4',
      name: { zh: 'ТРКИ-4 四级（C2）', en: 'TORFL-4 (C2)' },
      short: 'C2',
      desc: {
        zh: '四级（Четвёртый сертификационный уровень）：接近受过教育的母语者，表达精确、得体，细微的意思差别也能分清；俄语语文学硕士、用俄语教学和做研究要求这一级。没有官方词表，词汇量一般说一万五千到两万（积极词汇约八千）。',
        en: 'Fourth certificate level: close to an educated native speaker, precise and appropriate, aware of fine shades of meaning; required for a master’s in Russian philology and for teaching and research. No official word list; usually put at 15,000–20,000 words (about 8,000 active).'
      }
    }
  ],
  cefr: { teu: 'A1', tbu: 'A2', trki1: 'B1', trki2: 'B2', trki3: 'C1', trki4: 'C2' },
  sources: [
    RU_SOURCES.torfl,
    CEFR_SOURCE,
    RU_SOURCES.freqSubs,
    RU_SOURCES.freqWiki,
    RU_SOURCES.tatoeba,
    RU_SOURCES.openrussian
  ]
}

/** 各级（累计）的官方词汇量：按合并词频的名次切分时用 */
export const TORFL_CUTOFFS: [string, number][] = [
  ['teu', 780],
  ['tbu', 1300],
  ['trki1', 2300],
  ['trki2', 5000],
  ['trki3', 11000],
  ['trki4', 20000]
]

export const spec: LangSpec = {
  code: 'ru',
  name: { zh: '俄语', en: 'Russian' },
  nativeName: 'русский',
  bcp47: 'ru',
  color: '#8a3b2e',
  direction: 'ltr',
  levelSystems: [TORFL],
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
    speech: 'ru-RU'
  },
  intro: {
    zh: '东斯拉夫语，用西里尔字母书写；重音不标而且会在变格变位里移动，不重读的元音要弱化；名词分三个性、六个格，动词成对地分完成体与未完成体，运动动词加前缀表示方向。',
    en: 'An East Slavic language written in Cyrillic. Stress is unmarked and shifts across inflected forms, and unstressed vowels are reduced; nouns have three genders and six cases, verbs come in perfective–imperfective pairs, and verbs of motion take prefixes for direction.'
  }
}
