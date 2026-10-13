import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import {
  inspectQonlang,
  packFromQonlang,
  qonlangPackId,
  safeColor
} from '$lib/packs/qonlang/convert'
import { moduleVisible, visibleModules, courseSections } from '$lib/packs/modules'
import { projectToCsv } from '$qon/core/projectCsv'
import { renderScript } from '$qon/script/render'

const fixture = (name: string): string =>
  readFileSync(resolve(__dirname, 'fixtures/qonlang', name), 'utf8')

describe('读千语集项目', () => {
  it('Aelith：三门语言，各自的统计', () => {
    const r = inspectQonlang(fixture('Aelith.laim.json'))
    if (!r.ok) throw new Error(r.reason)
    expect(r.languages.map((l) => l.name)).toEqual(['Proto-Aelith', 'Aelith', 'Merun'])
    const ae = r.languages.find((l) => l.abbr === 'ae')!
    expect(ae.stats.sentences).toBeGreaterThan(0)
    expect(ae.stats.phrases).toBe(5)
    expect(ae.stats.paradigms).toBeGreaterThan(0)
    expect(ae.empty).toBe(false)
  })

  it('Aelith 转成学习包：能力按数据推出来', () => {
    const r = inspectQonlang(fixture('Aelith.laim.json'))
    if (!r.ok) throw new Error(r.reason)
    const ae = r.project.languages.find((l) => l.abbr === 'ae')!
    const pack = packFromQonlang(r.project, ae.id, 'Aelith.laim.json', '2026-09-23T00:00:00Z')
    expect(pack.kind).toBe('qonlang')
    expect(pack.id).toBe(qonlangPackId(r.project.meta.id, ae.id))
    expect(pack.features).toMatchObject({
      texts: true,
      lexicon: true,
      alphabet: 'glyphs',
      characters: 'morphemes',
      grammar: true,
      inflection: true,
      phrasebook: true,
      idioms: false,
      stories: false,
      media: false,
      exam: false,
      ruby: 'ipa',
      romanization: true,
      speech: null
    })
    expect(pack.scripts[0]).toMatchObject({ name: 'Aelith 刻文', glyphCount: 24 })
    expect(pack.source?.projectName).toBe('Aelith')
    // 没有视频：视听模块不出现，其余学习模块都在
    expect(visibleModules(pack)).toEqual([
      'home',
      'reading',
      'courses',
      'dictionary',
      'notebook',
      'practice',
      'collection',
      'leaderboards',
      'stats'
    ])
    expect(courseSections(pack.features)).toEqual([
      'alphabet',
      'grammar',
      'inflection',
      'phrasebook'
    ])
  })

  it('没有例句、只有文档的语言（Merun、原始语）也能阅读：文档在阅读里各成一篇', () => {
    const r = inspectQonlang(fixture('Aelith.laim.json'))
    if (!r.ok) throw new Error(r.reason)
    for (const abbr of ['mr', 'PAe']) {
      const lang = r.project.languages.find((l) => l.abbr === abbr)!
      const pack = packFromQonlang(r.project, lang.id, 'Aelith.laim.json')
      expect(pack.stats?.sentences, abbr).toBe(0)
      expect(pack.features.texts, abbr).toBe(true)
      expect(visibleModules(pack), abbr).toContain('reading')
    }
  })

  it('Tsahun：声调语言，意音文字，没有音变', () => {
    const r = inspectQonlang(fixture('Tsahun.laim.json'))
    if (!r.ok) throw new Error(r.reason)
    const ts = r.project.languages[0]
    const pack = packFromQonlang(r.project, ts.id, 'Tsahun.laim.json')
    expect(pack.scripts.map((s) => s.type)).toEqual(['syllabary', 'logographic'])
    expect(pack.features.alphabet).toBe('glyphs')
  })

  it('同一个项目导出的 CSV 读出来是同一个包', () => {
    const text = fixture('Aelith.laim.json')
    const a = inspectQonlang(text)
    if (!a.ok) throw new Error(a.reason)
    const b = inspectQonlang(projectToCsv(a.project))
    if (!b.ok) throw new Error(b.reason)
    expect(b.languages).toEqual(a.languages)
  })

  it('用千语集的文字引擎写出自造文字', () => {
    const r = inspectQonlang(fixture('Aelith.laim.json'))
    if (!r.ok) throw new Error(r.reason)
    const ae = r.project.languages.find((l) => l.abbr === 'ae')!
    const script = ae.scripts[0]
    const out = renderScript(ae, script, 'kaso')
    const glyphs = new Set(script.glyphs.map((g) => g.char))
    expect(out.length).toBeGreaterThan(0)
    for (const ch of out) expect(glyphs.has(ch)).toBe(true)
  })

  it('读不了的文件给出原因', () => {
    expect(inspectQonlang('QONLANG-VIEW:1:AAAA')).toMatchObject({ ok: false, reason: 'sealed' })
    expect(inspectQonlang('{oops')).toMatchObject({ ok: false, reason: 'invalid-json' })
    expect(inspectQonlang('{"a":1}')).toMatchObject({ ok: false, reason: 'not-a-project' })
    const newer = JSON.stringify({ schemaVersion: 999, meta: {} })
    expect(inspectQonlang(newer)).toMatchObject({ ok: false, reason: 'newer-schema' })
  })

  it('颜色不对时退回默认色', () => {
    expect(safeColor('#AbC')).toBe('#AbC')
    expect(safeColor('red')).toBe('#0e9f8a')
    expect(safeColor(undefined)).toBe('#0e9f8a')
  })

  it('没有语言时仍可进入首页与全局账号收藏', () => {
    expect(visibleModules(null)).toEqual(['home', 'collection', 'leaderboards'])
    expect(moduleVisible('settings', null)).toBe(true)
    expect(moduleVisible('packs', null)).toBe(true)
  })
})
