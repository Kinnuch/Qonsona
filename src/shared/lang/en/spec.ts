/**
 * 英语（English）：学习包的描述——叫什么、几套分级、有哪些能力。
 * 这是框架先放的占位，由负责英语的分支按 docs/lang/en.md 的分析改写。
 */
import { cefrSystem } from '../levels'
import type { LangSpec } from '../types'

export const spec: LangSpec = {
  code: 'en',
  name: { zh: '英语', en: 'English' },
  nativeName: 'English',
  bcp47: 'en',
  color: '#2f5fa8',
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
    speech: 'en-US'
  },
  intro: {
    zh: '世界上用得最广的语言；拼写跟读音的对应不规则，词汇量大，时态与短语动词是难点。',
    en: 'The most widely used language in the world; irregular spelling, a huge vocabulary, tenses and phrasal verbs are the hard parts.'
  }
}
