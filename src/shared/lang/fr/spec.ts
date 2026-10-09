/**
 * 法语（French）：学习包的描述——叫什么、几套分级、有哪些能力。
 * 这是框架先放的占位，由负责法语的分支按 docs/lang/fr.md 的分析改写。
 */
import { cefrSystem } from '../levels'
import type { LangSpec } from '../types'

export const spec: LangSpec = {
  code: 'fr',
  name: { zh: '法语', en: 'French' },
  nativeName: 'français',
  bcp47: 'fr',
  color: '#6b4fa8',
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
    speech: 'fr-FR'
  },
  intro: {
    zh: '名词分阴阳性，动词变位丰富，连诵与省音让读音跟拼写差得远。',
    en: 'Nouns have gender, verbs conjugate richly, and liaison and elision pull the sound away from the spelling.'
  }
}
