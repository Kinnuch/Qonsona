/**
 * 俄语（Russian）：学习包的描述——叫什么、几套分级、有哪些能力。
 * 这是框架先放的占位，由负责俄语的分支按 docs/lang/ru.md 的分析改写。
 */
import { cefrSystem } from '../levels'
import type { LangSpec } from '../types'

export const spec: LangSpec = {
  code: 'ru',
  name: { zh: '俄语', en: 'Russian' },
  nativeName: 'русский',
  bcp47: 'ru',
  color: '#8a3b2e',
  direction: 'ltr',
  levelSystems: [cefrSystem([])],
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
    zh: '西里尔字母，重音不标且会移动；名词六个格，动词分完成体与未完成体。',
    en: 'Cyrillic script, unmarked and shifting stress, six noun cases, and perfective and imperfective verb aspects.'
  }
}
