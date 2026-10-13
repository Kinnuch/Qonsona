/**
 * 左侧导航的模块，以及每个模块在当前学习包下显不显示。
 * 只看学习包的能力（PackFeatures），不看它是日语还是千语集来的语言。
 */
import type { ModuleId, PackFeatures, PackManifest } from './types'

/** 上面一组：学习用的模块，按这个顺序排 */
export const LEARN_MODULES: ModuleId[] = [
  'home',
  'reading',
  'courses',
  'dictionary',
  'notebook',
  'practice',
  'media',
  'stats'
]

/** 下面一组：跟学哪门语言无关的 */
export const SYSTEM_MODULES: ModuleId[] = ['collection', 'packs', 'settings']

/** 课程里的几块：有哪块就出哪块 */
export type CourseSection =
  'alphabet' | 'grammar' | 'inflection' | 'phrasebook' | 'idioms' | 'stories'

export function courseSections(f: PackFeatures): CourseSection[] {
  const out: CourseSection[] = []
  if (f.alphabet) out.push('alphabet')
  if (f.grammar) out.push('grammar')
  if (f.inflection) out.push('inflection')
  if (f.phrasebook) out.push('phrasebook')
  if (f.idioms) out.push('idioms')
  if (f.stories) out.push('stories')
  return out
}

/** 词典的几个页签 */
export type DictionaryTab = 'words' | 'characters' | 'sentences'

export function dictionaryTabs(f: PackFeatures): DictionaryTab[] {
  if (!f.lexicon) return []
  const out: DictionaryTab[] = ['words']
  if (f.characters) out.push('characters')
  if (f.texts) out.push('sentences')
  return out
}

export function moduleVisible(id: ModuleId, pack: PackManifest | null): boolean {
  if (id === 'packs' || id === 'settings' || id === 'collection') return true
  // 一门语言都没有时只留首页（引导去添加语言）
  if (!pack) return id === 'home'
  const f = pack.features
  switch (id) {
    case 'home':
    case 'stats':
      return true
    case 'reading':
      return f.texts
    case 'courses':
      return courseSections(f).length > 0
    case 'dictionary':
    case 'notebook':
    case 'practice':
      return f.lexicon
    case 'media':
      return f.media
  }
}

export function visibleModules(pack: PackManifest | null): ModuleId[] {
  return LEARN_MODULES.filter((id) => moduleVisible(id, pack))
}
