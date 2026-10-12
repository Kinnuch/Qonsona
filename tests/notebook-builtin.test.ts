/**
 * 内置词本：日语是 JLPT N5–N1 与主题词本；千语集语言的作者收藏排最前，按词频的各级、每个标签各一本，
 * 藏起来的词不进来。
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { parseProject } from '$qon/core/serialize'
import type { Project } from '$qon/core/model'
import { builtinLists } from '$lib/notebook/builtin'
import { frequencyLevels } from '$lib/packs/qonlang/levels'
import { packFromQonlang } from '$lib/packs/qonlang/convert'
import { JAPANESE } from '$lib/packs/builtin'
import { LANG_PACKS } from '$lib/packs/builtin'
import { platform } from '$lib/platform'

const load = (): Project =>
  parseProject(readFileSync(resolve(__dirname, 'fixtures/qonlang/Aelith.laim.json'), 'utf8'))
const zh = (t: Record<string, string> | undefined): string => t?.zh ?? t?.en ?? ''
const labels = { favorite: '作者收藏', tag: (tag: string) => `标签：${tag}` }

it('高级内置词本导入全部词条，不能静默截断到默认 5000 词', async () => {
  const spy = vi.spyOn(platform.lang, 'list').mockResolvedValue([])
  try {
    const lists = builtinLists(
      LANG_PACKS.find((p) => p.id === 'en')!,
      null,
      null,
      null,
      new Set(),
      zh,
      labels,
      {},
      [{ name: 'cefr:C2', count: 30038 }]
    )
    await lists.find((l) => l.source === 'lex-cefr:C2')!.load()
    expect(spy).toHaveBeenCalledWith('en', 'cefr:C2', 30038)
  } finally {
    spy.mockRestore()
  }
})

describe('千语集语言的内置词本', () => {
  it('作者收藏、各级、各标签；卡的键是 lexeme-<id>，卡面有读音与释义', async () => {
    const p = load()
    const ae = p.languages.find((l) => l.abbr === 'ae')!
    const levels = frequencyLevels(p, ae.id)
    const pack = packFromQonlang(p, ae.id, 'Aelith.laim.json')
    const lists = builtinLists(pack, p, levels, null, new Set(), zh, labels)
    const sources = lists.map((l) => l.source)
    expect(sources[0]).toBe('favorite')
    expect(sources.filter((s) => s.startsWith('level-'))).toEqual([
      'level-L1',
      'level-L2',
      'level-L3'
    ])
    expect(sources).toContain('tag-自然')
    const l1 = lists.find((l) => l.source === 'level-L1')!
    expect(l1.count).toBe(levels.system.levels[0].count)
    const cards = await l1.load()
    expect(cards).toHaveLength(l1.count!)
    expect(cards.every((c) => c.key.startsWith('lexeme-') && c.front && c.meaning.zh)).toBe(true)
    const fav = await lists[0].load()
    expect(fav.map((c) => c.key)).toEqual(
      p.lexemes.filter((l) => l.languageId === ae.id && l.favorite).map((l) => `lexeme-${l.id}`)
    )
  })

  it('藏起来的词不进内置词本', () => {
    const p = load()
    const ae = p.languages.find((l) => l.abbr === 'ae')!
    const levels = frequencyLevels(p, ae.id)
    const pack = packFromQonlang(p, ae.id, 'x')
    const nature = p.lexemes.filter((l) => l.languageId === ae.id && l.tags.includes('自然'))
    const hidden = new Set([nature[0].id])
    const lists = builtinLists(pack, p, levels, null, hidden, zh, labels)
    expect(lists.find((l) => l.source === 'tag-自然')!.count).toBe(nature.length - 1)
  })
})

describe('日语的内置词本', () => {
  it('JLPT N5–N1 五本在前，后面是主题词本（分两组，写着词数）', () => {
    const lists = builtinLists(JAPANESE, null, null, null, new Set(), zh, labels, { 5: 700 })
    expect(lists.slice(0, 5).map((l) => l.source)).toEqual([
      'jlpt-5',
      'jlpt-4',
      'jlpt-3',
      'jlpt-2',
      'jlpt-1'
    ])
    expect(lists[0].count).toBe(700)
    expect(lists.slice(0, 5).every((l) => l.group === 'jlpt')).toBe(true)
    const themes = lists.slice(5)
    expect(themes.length).toBeGreaterThanOrEqual(20)
    expect(themes.every((l) => l.group === 'theme' && l.source.startsWith('theme-'))).toBe(true)
    expect(themes.every((l) => !!l.name && (l.count ?? 0) >= 20)).toBe(true)
    expect(new Set(themes.map((l) => l.source)).size).toBe(themes.length)
  })
})

describe('框架语言的内置词本', () => {
  it('每套分级一组（主分级在前），再是主题词本与别的词表；没有词的级不列', async () => {
    const { LANG_PACKS } = await import('$lib/packs/builtin')
    const fr = LANG_PACKS.find((p) => p.id === 'fr')!
    const lists = builtinLists(fr, null, null, null, new Set(), zh, labels, {}, [
      { name: 'cefr:A1', count: 500 },
      { name: 'cefr:B2', count: 0 },
      { name: 'theme:food', count: 40, title: { zh: '食物', en: 'Food' } },
      { name: 'x:awl', count: 570 }
    ])
    expect(lists.map((l) => l.source)).toEqual(['lex-cefr:A1', 'lex-theme:food', 'lex-x:awl'])
    expect(lists[0]).toMatchObject({ group: 'sys-cefr', count: 500 })
    expect(lists[0].groupName).toContain('CEFR')
    expect(lists[1]).toMatchObject({ group: 'theme', name: '食物', count: 40 })
    expect(lists[2]).toMatchObject({ group: 'x', name: 'awl' })
  })
})
