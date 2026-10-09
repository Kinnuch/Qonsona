/**
 * 苏格兰盖尔语（Scottish Gaelic）：学习包的描述——叫什么、几套分级、有哪些能力。
 * 这是框架先放的占位，由负责苏格兰盖尔语的分支按 docs/lang/gd.md 的分析改写。
 */
import { cefrSystem } from '../levels'
import type { LangSpec } from '../types'

export const spec: LangSpec = {
  code: 'gd',
  name: { zh: '苏格兰盖尔语', en: 'Scottish Gaelic' },
  nativeName: 'Gàidhlig',
  bcp47: 'gd',
  color: '#5b7f2a',
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
    speech: null
  },
  intro: {
    zh: '苏格兰的凯尔特语言；动词在句首，词首辅音会弱化，拼写按「宽、窄」元音配对。',
    en: 'The Celtic language of Scotland: verb-first sentences, initial-consonant lenition, and spelling built on broad and slender vowels.'
  }
}
