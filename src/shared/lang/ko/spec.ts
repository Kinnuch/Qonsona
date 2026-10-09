/**
 * 韩语（Korean）：学习包的描述——叫什么、几套分级、有哪些能力。
 * 这是框架先放的占位，由负责韩语的分支按 docs/lang/ko.md 的分析改写。
 */
import { cefrSystem } from '../levels'
import type { LangSpec } from '../types'

export const spec: LangSpec = {
  code: 'ko',
  name: { zh: '韩语', en: 'Korean' },
  nativeName: '한국어',
  bcp47: 'ko',
  color: '#0e8a7e',
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
    speech: 'ko-KR'
  },
  intro: {
    zh: '韩文字母拼成音节块；助词、词尾层层黏着，敬语分好几级，汉字词跟中文相通。',
    en: 'Hangul letters combine into syllable blocks; particles and endings stack up, politeness has several levels, and Sino-Korean words echo Chinese.'
  }
}
