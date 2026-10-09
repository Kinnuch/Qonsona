/**
 * 随软件带的学习包。现在只有日语；词典、文章、课程这些数据从 M1 起由数据管线生成，
 * 这里只是它的描述（叫什么、有哪些能力、等级体系）。
 */
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

export const BUILTIN_PACKS: PackManifest[] = [JAPANESE]
