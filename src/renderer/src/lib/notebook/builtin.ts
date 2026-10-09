/**
 * 内置词本：日语是 JLPT N5–N1（常用的在前）与按主题分的常用词（data/ja/themes.json）；
 * 千语集的语言是作者收藏的词（排最前，当作「建议先学」）、按词频分的各级、
 * 学习包里作者排的每一课（本课新词与短语）、词条上的每个标签。
 * 点「加入」时才取词，加进生词本里的一个词本。
 */
import type { Project } from '$qon/core/model'
import type { LocalizedText, PackManifest } from '$lib/packs/types'
import type { LevelAssignment } from '$lib/packs/qonlang/levels'
import { learnable } from '$lib/packs/qonlang/levels'
import type { PackStudy } from '$lib/packs/qonlang/study'
import type { CardInput } from '$shared/notebook'
import { platform } from '$lib/platform'
import { jaFromListItem, qonFromLexeme, qonFromPhrase } from './cards'
import themesJson from '../../../../../data/ja/themes.json'
import { langModule } from '$shared/lang/registry'
import type { LexListInfo } from '$shared/lang/views'
import { lexFromItem } from './cards'

/** 日语的主题词本：主题、词条号、写法、读音 */
interface ThemeData {
  themes: { id: string; title: Record<string, string>; words: [number, string, string][] }[]
}
const THEMES = (themesJson as unknown as ThemeData).themes

export interface BuiltinList {
  /** 词本的来源标记（加进来之后记在词本上，认得出已经加过） */
  source: string
  /** 列表上分几组显示（日语：JLPT、主题；框架语言：每套分级一组）；没有就不分 */
  group?: string
  /** 组名（框架语言的分级体系名）；没有时按 group 查文案 */
  groupName?: string
  name: string
  /** 有多少词；日语要问过词典才知道，先是 null */
  count: number | null
  load: () => Promise<CardInput[]>
}

export function builtinLists(
  pack: PackManifest | null,
  project: Project | null,
  levels: LevelAssignment | null,
  study: PackStudy | null,
  hidden: ReadonlySet<string>,
  pick: (t: LocalizedText) => string,
  labels: { favorite: string; tag: (tag: string) => string },
  jlptCounts: Record<number, number> = {},
  langLists: LexListInfo[] = []
): BuiltinList[] {
  if (!pack) return []
  const lang = langModule(pack.id)
  if (lang) return langBuiltinLists(pack.id, lang.spec.levelSystems, langLists, pick)
  if (pack.id === 'ja')
    return [
      ...[5, 4, 3, 2, 1].map((n): BuiltinList => ({
        source: `jlpt-${n}`,
        group: 'jlpt',
        name: `JLPT N${n}`,
        count: jlptCounts[n] ?? null,
        load: async () => (await platform.ja.jlptWords(n)).map(jaFromListItem)
      })),
      ...THEMES.map((th): BuiltinList => ({
        source: `theme-${th.id}`,
        group: 'theme',
        name: pick(th.title),
        count: th.words.length,
        load: async () =>
          (await platform.ja.wordItems(th.words.map(([id]) => id))).map(jaFromListItem)
      }))
    ]

  const qlang = project?.languages.find((l) => l.id === pack.source?.languageId)
  if (!project || !qlang) return []
  const out: BuiltinList[] = []
  const lexemes = project.lexemes.filter(
    (l) => l.languageId === qlang.id && learnable(l) && !hidden.has(l.id)
  )
  const favorites = lexemes.filter((l) => l.favorite)
  if (favorites.length)
    out.push({
      source: 'favorite',
      name: labels.favorite,
      count: favorites.length,
      load: async () => favorites.map((l) => qonFromLexeme(qlang, l))
    })
  if (levels) {
    const freq = levels.freq
    for (const lv of levels.system.levels) {
      const words = lexemes
        .filter((l) => levels.entries[l.id] === lv.id)
        .sort((a, b) => (freq[b.id] ?? 0) - (freq[a.id] ?? 0) || a.lemma.localeCompare(b.lemma))
      if (!words.length) continue
      out.push({
        source: `level-${lv.id}`,
        name: pick(lv.name),
        count: words.length,
        load: async () => words.map((l) => qonFromLexeme(qlang, l))
      })
    }
  }
  for (const lesson of study?.lessons ?? []) {
    const words = lesson.lexemeIds.map((id) => lexemes.find((l) => l.id === id)).filter((l) => !!l)
    const phrases = lesson.phraseIds
      .filter((id) => !hidden.has(id))
      .map((id) => project.phrasebook.find((p) => p.id === id))
      .filter((p) => !!p)
    if (!words.length && !phrases.length) continue
    out.push({
      source: `lesson-${lesson.id}`,
      name: lesson.title || lesson.id,
      count: words.length + phrases.length,
      load: async () => [
        ...words.map((l) => qonFromLexeme(qlang, l)),
        ...phrases.map((p) => qonFromPhrase(qlang, p))
      ]
    })
  }
  const byTag = new Map<string, typeof lexemes>()
  for (const l of lexemes)
    for (const tag of l.tags) if (tag.trim()) byTag.set(tag, [...(byTag.get(tag) ?? []), l])
  for (const [tag, words] of [...byTag].sort((a, b) => a[0].localeCompare(b[0])))
    out.push({
      source: `tag-${tag}`,
      name: labels.tag(tag),
      count: words.length,
      load: async () => words.map((l) => qonFromLexeme(qlang, l))
    })
  return out
}

/** 框架里的语言（英、法、韩……）：每套分级一组（主分级在前），再是主题词本、别的词表 */
function langBuiltinLists(
  code: string,
  systems: import('$shared/lang/types').LevelSystemDef[],
  lists: LexListInfo[],
  pick: (t: LocalizedText) => string
): BuiltinList[] {
  const count = new Map(lists.map((l) => [l.name, l]))
  const load = (name: string) => async (): Promise<CardInput[]> =>
    (await platform.lang.list(code, name)).map(lexFromItem)
  const out: BuiltinList[] = []
  for (const sys of [...systems].sort((a, b) => Number(!!b.primary) - Number(!!a.primary)))
    for (const lv of sys.levels) {
      const name = `${sys.id}:${lv.id}`
      const info = count.get(name)
      if (!info?.count) continue
      out.push({
        source: `lex-${name}`,
        group: `sys-${sys.id}`,
        groupName: pick(sys.name),
        name: pick(lv.name),
        count: info.count,
        load: load(name)
      })
    }
  for (const l of lists) {
    const [kind, id] = l.name.split(':')
    if (kind !== 'theme' && kind !== 'x') continue
    out.push({
      source: `lex-${l.name}`,
      group: kind === 'theme' ? 'theme' : 'x',
      name: l.title ? pick(l.title) : id,
      count: l.count,
      load: load(l.name)
    })
  }
  return out
}
