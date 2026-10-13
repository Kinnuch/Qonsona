/**
 * 随软件带的学习包：日语（自成一套），以及多语言框架里的英、法、韩、西、阿、俄、盖尔、昆雅语和辛达语
 * （描述在 src/shared/lang/<代码>/spec.ts）。这里只是描述（叫什么、有哪些能力、等级体系），数据另由数据管线生成。
 */
import { LANG_CODES, type LangSpec } from '$shared/lang/types'
import { LANGS } from '$shared/lang/registry'
import { primarySystem } from '$shared/lang/levels'
import type { PackManifest } from './types'

export const JAPANESE: PackManifest = {
  id: 'ja',
  kind: 'builtin',
  name: { zh: '日语', en: 'Japanese' },
  nativeName: '日本語',
  bcp47: 'ja',
  color: '#c2453a',
  direction: 'ltr',
  levels: {
    id: 'jlpt',
    name: { zh: '日本语能力测试', en: 'JLPT' },
    // 从易到难
    levels: ['N5', 'N4', 'N3', 'N2', 'N1'].map((n) => ({ id: n, name: { zh: n, en: n } }))
  },
  features: {
    texts: true,
    lexicon: true,
    alphabet: 'kana',
    characters: 'kanji',
    grammar: true,
    inflection: true,
    phrasebook: true,
    idioms: true,
    stories: true,
    media: true,
    exam: true,
    ruby: 'furigana',
    romanization: true,
    speech: 'ja-JP',
    gloss: false,
    etymology: false
  },
  scripts: [],
  // 数据管线（M1）做完才知道有多少
  stats: null
}

/** 框架里的一门语言 → 学习包描述；主分级当作 levels，其余分级在 spec 里 */
export function langPack(spec: LangSpec): PackManifest {
  const primary = primarySystem(spec.levelSystems)
  const f = spec.features
  return {
    id: spec.code,
    kind: 'builtin',
    name: spec.name,
    nativeName: spec.nativeName,
    bcp47: spec.bcp47,
    color: spec.color,
    direction: spec.direction,
    levels: {
      id: primary.id,
      name: primary.name,
      levels: primary.levels.map((l) => ({ id: l.id, name: l.name }))
    },
    features: {
      texts: f.texts,
      lexicon: f.lexicon,
      alphabet: f.alphabet,
      characters: f.characters,
      grammar: f.grammar,
      inflection: f.inflection,
      phrasebook: f.phrasebook,
      idioms: f.idioms,
      stories: f.stories,
      media: f.media,
      exam: f.exam,
      ruby: f.ruby,
      romanization: f.romanization,
      speech: f.speech,
      gloss: false,
      etymology: false
    },
    scripts: [],
    stats: null
  }
}

export const LANG_PACKS: PackManifest[] = LANG_CODES.map((c) => langPack(LANGS[c].spec))

export const BUILTIN_PACKS: PackManifest[] = [JAPANESE, ...LANG_PACKS]
