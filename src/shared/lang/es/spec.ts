/**
 * 西班牙语（Spanish）：学习包的描述——叫什么、几套分级、有哪些能力。
 * 这是框架先放的占位，由负责西班牙语的分支按 docs/lang/es.md 的分析改写。
 */
import { cefrSystem } from '../levels'
import type { LangSpec } from '../types'

export const spec: LangSpec = {
  code: 'es',
  name: { zh: '西班牙语', en: 'Spanish' },
  nativeName: 'español',
  bcp47: 'es',
  color: '#d0742a',
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
    speech: 'es-ES'
  },
  intro: {
    zh: '拼读规则整齐，名词分阴阳性，动词按人称、时态、语气变位，虚拟式用得多。',
    en: 'Regular spelling and pronunciation, gendered nouns, verbs conjugated for person, tense and mood, with frequent subjunctive.'
  }
}
