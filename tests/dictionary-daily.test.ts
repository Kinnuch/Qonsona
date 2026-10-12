import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  dailyCandidates,
  dailyDate,
  dailyOrdinal,
  DailyRequestGate,
  makeDaily,
  selectDaily,
  type DailyPool
} from '$shared/dictionary-daily'
import { DictionaryDailyRepository } from '../src/main/dictionary-daily'
import { qonDailyPool } from '$lib/dict/daily-qonlang'
import { parseProject } from '$qon/core/serialize'
const date = '2026-10-12'
const pool = (): DailyPool => ({
  database: true,
  levels: { A1: { en: 'A1' } },
  words: Array.from({ length: 17 }, (_, i) => ({
    id: String(i),
    front: `real-${i}`,
    reading: '',
    meaning: { en: `meaning-${i}` },
    level: 'A1',
    card: { key: `lex-${i}`, front: `real-${i}`, reading: '', meaning: { en: `meaning-${i}` } }
  })),
  sentences: Array.from({ length: 7 }, (_, i) => ({
    id: String(i),
    text: `Real sentence ${i}.`,
    meaning: { en: 'Translation' },
    level: null
  })),
  grammar: Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    title: { en: `Grammar ${i}` },
    meaning: { en: 'Real explanation' },
    level: 'A1',
    lessonId: `lesson-${i}`
  }))
})
describe('daily recommendations', () => {
  it('uses local calendar dates and rejects empty/invalid dates before selection', () => {
    expect(dailyDate(new Date(2026, 9, 12, 1))).toBe(date)
    expect(dailyOrdinal('2024-02-29')).toBe(dailyOrdinal('2024-02-28') + 1)
    for (const bad of ['', '2026-02-29', '2026-13-01', '2026-1-01', 'garbage'])
      expect(() => makeDaily('ar', bad, pool())).toThrow('Invalid daily date')
    expect(makeDaily('ar', date, pool()).words).toHaveLength(3)
  })
  it('is independent of source ordering, returns real unique items and rotates through the full pool', () => {
    const p = pool()
    const first = makeDaily('en', date, p)
    expect(makeDaily('en', date, { ...p, words: [...p.words].reverse() })).toEqual(first)
    expect(makeDaily('en', '2026-10-13', p).words.map((w) => w.id)).not.toEqual(
      first.words.map((w) => w.id)
    )
    const seen = new Set<string>()
    for (let d = 1; d <= 17; d++)
      for (const w of selectDaily(
        p.words,
        'en',
        `2026-10-${String(d).padStart(2, '0')}`,
        'words',
        3
      )) {
        seen.add(w.id)
        expect(p.words).toContain(w)
      }
    expect(seen.size).toBe(17)
    expect(selectDaily([p.words[0], p.words[0]], 'en', date, 'words', 3)).toHaveLength(1)
    expect(dailyCandidates(p.words, 4)).toEqual(dailyCandidates([...p.words].reverse(), 4))
  })
  it('shows honest per-block missing data while grammar remains available', () => {
    const p = pool()
    const bundle = makeDaily('ru', date, { ...p, database: false, words: [], sentences: [] })
    expect(bundle.empty).toEqual({ words: 'missing-db', sentences: 'missing-db', grammar: null })
    expect(
      makeDaily('ru', date, {
        ...p,
        words: [{ ...p.words[0], meaning: { en: '' } }],
        sentences: [],
        grammar: []
      }).empty
    ).toEqual({ words: 'empty', sentences: 'empty', grammar: 'empty' })
  })
  it('rejects late A→B→A results and cancels when a search starts', () => {
    const g = new DailyRequestGate(),
      a = g.begin('en', date)
    g.begin('ar', date)
    const latest = g.begin('en', date)
    expect(g.accepts(a, makeDaily('en', date, pool()))).toBe(false)
    expect(g.accepts(latest, makeDaily('ar', date, pool()))).toBe(false)
    expect(g.accepts(latest, makeDaily('en', date, pool()))).toBe(true)
    g.cancel()
    expect(g.current(latest)).toBe(false)
  })
  it('coalesces pool loading, copies responses and reconstructs history after cache eviction', async () => {
    const loader = vi.fn(async () => pool())
    const repo = new DictionaryDailyRepository(loader)
    const [a, b] = await Promise.all([repo.get('en', date), repo.get('en', date)])
    expect(loader).toHaveBeenCalledTimes(1)
    a.words[0].meaning.en = 'changed'
    expect(b.words[0].meaning.en).not.toBe('changed')
    for (let i = 0; i < 70; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
      await repo.get('en', d)
    }
    expect(await repo.get('en', date)).toEqual(b)
    await expect(repo.get('en', '')).rejects.toThrow()
    expect(loader).toHaveBeenCalledTimes(1)
  })
  it('recovers from failed loading without caching failure', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('missing')).mockResolvedValue(pool())
    const repo = new DictionaryDailyRepository(loader)
    await expect(repo.get('en', date)).rejects.toThrow('missing')
    expect((await repo.get('en', date)).words).toHaveLength(3)
  })
  it('filters undefined meanings before bounding a large local pool', () => {
    const p = parseProject(
      readFileSync(resolve(__dirname, 'fixtures/qonlang/Aelith.laim.json'), 'utf8')
    )
    const language = p.languages.find((l) => l.abbr === 'ae')!
    const base = p.lexemes.find((l) => l.languageId === language.id && l.senses.length)!
    const candidates = Array.from({ length: 520 }, (_, i) => ({
      ...structuredClone(base),
      id: `daily-large-${i}`,
      lemma: `validword${i}`
    }))
    // Compute the actual seeded ordering, then put all meaningful entries outside its old cap.
    const oldBound = new Set(dailyCandidates(candidates).map((l) => l.id))
    expect(oldBound.size).toBe(512)
    p.lexemes = candidates.map((l) => ({
      ...l,
      senses: [
        { ...l.senses[0], definition: { en: oldBound.has(l.id) ? '   ' : `Real meaning ${l.id}` } }
      ]
    }))
    const valid = p.lexemes.filter((l) => !oldBound.has(l.id))
    expect(valid).toHaveLength(8)
    const hidden = new Set([valid[0].id])
    valid[1].languageId = 'different-language'
    valid[2].senses.unshift({ ...valid[2].senses[0], definition: { en: ' ' } })
    const selected = qonDailyPool(p, language, hidden)
    expect(selected.words).toHaveLength(6)
    expect(
      selected.words.every(
        (w) => !oldBound.has(w.id) && w.id !== valid[0].id && w.id !== valid[1].id
      )
    ).toBe(true)
    const bundle = makeDaily('local-project', date, selected)
    expect(bundle.words).toHaveLength(3)
    expect(bundle.words.every((w) => w.meaning.en.startsWith('Real meaning'))).toBe(true)
  })
  it('only selects current visible local project content and never mutates its data', () => {
    const p = parseProject(
      readFileSync(resolve(__dirname, 'fixtures/qonlang/Aelith.laim.json'), 'utf8')
    )
    const language = p.languages.find((l) => l.abbr === 'ae')!
    const before = JSON.stringify(p)
    const initial = qonDailyPool(p, language)
    expect(initial.words.length).toBeGreaterThan(0)
    const hidden = new Set([
      initial.words[0].id,
      ...initial.sentences.slice(0, 1).map((s) => s.id),
      ...initial.grammar.slice(0, 1).map((g) => g.id)
    ])
    const next = qonDailyPool(p, language, hidden)
    expect(
      [...next.words, ...next.sentences, ...next.grammar].every((item) => !hidden.has(item.id))
    ).toBe(true)
    expect(
      next.words.every((w) => p.lexemes.some((l) => l.id === w.id && l.languageId === language.id))
    ).toBe(true)
    expect(next.grammar.every((g) => g.docId === g.id && g.lessonId === `doc-${g.id}`)).toBe(true)
    expect(JSON.stringify(p)).toBe(before)
  })
})
