/**
 * 阿拉伯语（Arabic）：学习包的描述——叫什么、几套分级、有哪些能力。
 * 这是框架先放的占位，由负责阿拉伯语的分支按 docs/lang/ar.md 的分析改写。
 */
import { cefrSystem } from '../levels'
import type { LangSpec } from '../types'

export const spec: LangSpec = {
  code: 'ar',
  name: { zh: '阿拉伯语', en: 'Arabic' },
  nativeName: 'العربية',
  bcp47: 'ar',
  color: '#16805c',
  direction: 'rtl',
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
    speech: 'ar-SA'
  },
  intro: {
    zh: '从右往左写的辅音字母，短元音平时不写；词由三辅音词根套进词型构成，动词分十种派生式。',
    en: 'Written right to left with consonant letters and usually without short vowels; words are built from three-consonant roots and patterns.'
  }
}
