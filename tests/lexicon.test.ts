import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { inspectQonlang } from '$lib/packs/qonlang/convert'
import { frequencyLevels } from '$lib/packs/qonlang/levels'
import {
  searchLexicon,
  searchMorphemes,
  searchSentences,
  slotLabel
} from '$lib/packs/qonlang/lexicon'
import type { LocalizedText } from '$lib/packs/types'

const r = inspectQonlang(
  readFileSync(resolve(__dirname, 'fixtures/qonlang/Aelith.laim.json'), 'utf8')
)
if (!r.ok) throw new Error(r.reason)
const p = r.project
const ae = p.languages.find((l) => l.abbr === 'ae')!
const zh = (t: LocalizedText): string => t.zh || t.en || ''
const levels = frequencyLevels(p, ae.id).entries

describe('千语集语言的词典检索', () => {
  it('什么都没输入时按等级列出整个词库', () => {
    const all = searchLexicon(p, ae.id, '', zh, levels)
    expect(all.length).toBe(p.lexemes.filter((l) => l.languageId === ae.id).length)
    expect(all[0].level).toBe('L1')
  })

  it('词头对上排第一', () => {
    const h = searchLexicon(p, ae.id, 'kaso', zh, levels)
    expect(h[0]).toMatchObject({ lemma: 'kaso', match: 'exact', gloss: '房子' })
  })

  it('屈折形查得到原词，并给出槽位', () => {
    const h = searchLexicon(p, ae.id, 'kasom', zh, levels)
    expect(h[0]).toMatchObject({ lemma: 'kaso', match: 'form', form: 'kasom' })
    expect(h[0].slot).toContain('·')
  })

  it('去掉附加符也查得到', () => {
    expect(searchLexicon(p, ae.id, 'nol', zh)[0]?.lemma).toBe('nöl')
  })

  it('按中文释义查', () => {
    expect(searchLexicon(p, ae.id, '房子', zh).some((h) => h.lemma === 'kaso')).toBe(true)
  })

  it('只查这门语言', () => {
    const merun = p.languages.find((l) => l.abbr === 'mr')!
    const ids = new Set(p.lexemes.filter((l) => l.languageId === merun.id).map((l) => l.id))
    expect(searchLexicon(p, ae.id, '', zh).some((h) => ids.has(h.id))).toBe(false)
  })

  it('语素、例句也能查', () => {
    expect(searchMorphemes(p, ae.id, '').length).toBeGreaterThan(0)
    expect(searchSentences(p, ae.id, 'kaso').length).toBeGreaterThan(0)
  })

  it('槽位名里的点换成间隔号', () => {
    expect(slotLabel('单数.宾格')).toBe('单数·宾格')
  })
})
