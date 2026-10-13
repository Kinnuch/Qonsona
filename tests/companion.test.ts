import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { transform } from 'esbuild'
import { compileModule } from 'svelte/compiler'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as events from '../src/renderer/src/lib/accounts/companion-events'
import { LANG_CODES } from '../src/shared/lang/types'
import type { CompanionState } from '../src/renderer/src/lib/state/companion.svelte'
const require = createRequire(import.meta.url)
afterEach(() => vi.unstubAllGlobals())

async function fixture() {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  })
  const account = {
    session: { user: { id: 'alice' } },
    snapshot: { companion: { currentId: 'companion-1' } },
    reportCompanionAnswer: vi.fn(async () => ({ accepted: true, xp: 5, gifts: [] }))
  }
  const audio = {
    canSay: vi.fn(() => true),
    say: vi.fn(async () => {}),
    playing: null as string | null,
    pending: null as string | null
  }
  const ui = { toast: vi.fn() }
  const source = await transform(
    readFileSync('src/renderer/src/lib/state/companion.svelte.ts', 'utf8'),
    { loader: 'ts', target: 'esnext' }
  )
  const compiled = compileModule(source.code, {
    filename: 'companion.svelte.js',
    generate: 'client'
  }).js.code
  const js = await transform(compiled, { format: 'cjs', target: 'esnext' })
  const module = { exports: {} as { CompanionState: new () => CompanionState } }
  new Function('require', 'module', 'exports', js.code)(
    (id: string) => {
      if (id === './account.svelte') return { account }
      if (id === './audio.svelte') return { audio }
      if (id === './ui.svelte') return { ui }
      if (id === '$lib/accounts/companion-events') return events
      if (id === '$shared/lang/types') return { LANG_CODES }
      return require(id)
    },
    module,
    module.exports
  )
  return { state: new module.exports.CompanionState(), account, audio, ui, values }
}

describe('companion evidence and account boundaries', () => {
  it('keeps the first objective correct answer distinct from undo/reveal repeats and new questions', async () => {
    const f = await fixture(),
      questions = [{}, {}]
    const first = f.state.answerId(questions, 0)
    expect(f.state.answerId(questions, 0)).toBe(first)
    f.state.correct('en', first)
    f.state.correct('en', first)
    f.state.correct('en', f.state.answerId(questions, 1))
    expect(f.account.reportCompanionAnswer).toHaveBeenCalledTimes(2)
    const nextRun = f.state.answerId([{}, {}], 0)
    expect(nextRun).not.toBe(first)
    f.state.correct('en', nextRun)
    expect(f.account.reportCompanionAnswer).toHaveBeenCalledTimes(3)
    const calls = f.account.reportCompanionAnswer.mock.calls as unknown as [
      { requestId: string; answerId: string; correct: boolean }
    ][]
    expect(new Set(calls.map(([payload]) => payload.requestId)).size).toBe(3)
    expect(calls[0][0]).toMatchObject({ answerId: first, correct: true })
  })
  it('cannot award with no login or no selected owned companion', async () => {
    const f = await fixture()
    f.account.snapshot.companion.currentId = ''
    f.state.correct('en', 'no-selection')
    f.account.snapshot.companion.currentId = 'companion-1'
    f.account.session.user.id = ''
    f.state.correct('en', 'no-account')
    expect(f.account.reportCompanionAnswer).not.toHaveBeenCalled()
    expect(f.state.message).toBeNull()
  })
  it('binds an answer to the companion selected when grading, before another device changes it', async () => {
    const f = await fixture()
    f.state.correct('en', 'answer-with-companion-a')
    f.account.snapshot.companion.currentId = 'companion-2'
    expect(f.account.reportCompanionAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ characterId: 'companion-1', answerId: 'answer-with-companion-a' })
    )
    f.state.correct('en', 'answer-with-companion-b')
    expect(f.account.reportCompanionAnswer).toHaveBeenLastCalledWith(
      expect.objectContaining({ characterId: 'companion-2', answerId: 'answer-with-companion-b' })
    )
  })
  it('stores positions/preferences per user and discards a previous user’s delayed answer', async () => {
    const f = await fixture()
    let resolve!: (value: { accepted: boolean; xp: number; gifts: string[] }) => void
    f.account.reportCompanionAnswer.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r
        })
    )
    f.state.connectUser('alice')
    f.state.configure({ position: { x: 120, y: 220 }, bubbles: false })
    f.state.correct('en', 'shared-question')
    f.account.session.user.id = 'bob'
    f.state.connectUser('bob')
    expect(f.state.preferences.position).toBeNull()
    expect(f.state.preferences.bubbles).toBe(true)
    f.state.correct('fr', 'shared-question')
    const message = f.state.message
    resolve({ accepted: true, xp: 5, gifts: ['old-user-gift'] })
    await Promise.resolve()
    await Promise.resolve()
    expect(f.state.message?.text).toBe(message?.text)
    expect(f.state.message?.gifts).not.toContain('old-user-gift')
    expect(f.account.reportCompanionAnswer).toHaveBeenCalledTimes(2)
    f.state.connectUser('alice')
    expect(f.state.preferences).toMatchObject({ position: { x: 120, y: 220 }, bubbles: false })
  })
  it('defaults to text and keeps both languages even when the bubble preference is disabled', async () => {
    const f = await fixture()
    f.state.connectUser('alice')
    f.state.configure({ bubbles: false })
    f.state.correct('ar', 'question-a')
    expect(f.state.message?.text).toBe(events.ENCOURAGEMENTS.ar.text)
    expect(f.state.message?.zh).toBe(events.ENCOURAGEMENTS.ar.zh)
    expect(f.audio.say).not.toHaveBeenCalled()
  })
  it('canonicalizes imported language IDs without inventing their encouragement or voice', async () => {
    const f = await fixture()
    f.state.correct('author-pack-id', 'question-custom')
    expect(f.account.reportCompanionAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'qonlang:author-pack-id' })
    )
    expect(f.state.message).toMatchObject({ text: '', lang: null, zh: '回答正确，继续加油！' })
    f.state.correct('qonlang:already-scoped', 'question-custom-two')
    expect(f.account.reportCompanionAnswer).toHaveBeenLastCalledWith(
      expect.objectContaining({ language: 'qonlang:already-scoped' })
    )
  })
  it('uses language-matched text speech and Chinese separately; no IPA or fallback English', async () => {
    const f = await fixture()
    f.state.connectUser('alice')
    f.state.configure({ speech: true })
    f.state.correct('fr', 'question-fr')
    await Promise.resolve()
    await Promise.resolve()
    expect(f.audio.say.mock.calls).toEqual([
      [{ text: events.ENCOURAGEMENTS.fr.text, lang: 'fr-FR' }, { synthOnly: true }],
      [{ text: events.ENCOURAGEMENTS.fr.zh, lang: 'zh-CN' }, { synthOnly: true }]
    ])
  })
  it('does not interrupt listening questions, including when a new question starts during encouragement', async () => {
    const f = await fixture()
    f.state.connectUser('alice')
    f.state.configure({ speech: true })
    f.audio.playing = 'listening-question'
    f.state.correct('en', 'question-1')
    expect(f.audio.say).not.toHaveBeenCalled()
    f.audio.playing = null
    let resolve!: () => void
    f.audio.say.mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          resolve = r
        })
    )
    f.state.correct('fr', 'question-2')
    f.audio.pending = 'next-question-audio'
    resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(f.audio.say).toHaveBeenCalledTimes(1)
  })
  it('gives Elvish text with verifiable sources while declining unsupported text speech', async () => {
    const f = await fixture()
    f.state.connectUser('alice')
    f.state.configure({ speech: true })
    f.state.correct('qya', 'qya-1')
    await Promise.resolve()
    expect(f.state.message?.source).toMatch(/^https:\/\/eldamo.org\//)
    expect(f.audio.say.mock.calls).toEqual([
      [{ text: events.ENCOURAGEMENTS.qya.zh, lang: 'zh-CN' }, { synthOnly: true }]
    ])
    expect(events.ENCOURAGEMENTS.sjn.text).toBe('Ma!')
    expect(events.ENCOURAGEMENTS.sjn.lang).toBeNull()
    expect(Object.keys(events.ENCOURAGEMENTS)).toHaveLength(10)
  })
  it('does not play the Chinese continuation over a newly playing question', async () => {
    const f = await fixture()
    f.state.connectUser('alice')
    f.state.configure({ speech: true })
    let resolve!: () => void
    f.audio.say.mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          resolve = r
        })
    )
    f.state.correct('fr', 'answer-with-speech')
    f.audio.playing = 'next-question'
    resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(f.audio.say).toHaveBeenCalledTimes(1)
    expect(f.audio.playing).toBe('next-question')
  })
})

describe('foreground breaks and actual dock dimensions', () => {
  it('reminds at 45 accepted minutes once, excluding overlaps and zero-duration events', () => {
    const timer = new events.BreakReminder()
    for (let i = 0; i < 179; i++) expect(timer.record(i * 15_000, (i + 1) * 15_000)).toBe(false)
    expect(timer.seconds).toBe(2685)
    expect(timer.record(2685_000, 2685_000)).toBe(false)
    expect(timer.record(2670_000, 2685_000)).toBe(false)
    expect(timer.record(2685_000, 2700_000)).toBe(true)
    expect(timer.record(2700_000, 3600_000)).toBe(false)
  })
  it('does not count background gaps and resets after ten minutes without accepted learning', () => {
    const timer = new events.BreakReminder()
    expect(timer.record(0, 44 * 60_000)).toBe(false)
    expect(timer.record(45 * 60_000, 46 * 60_000)).toBe(true)
    expect(timer.seconds).toBe(45 * 60)
    const afterBreak = 56 * 60_000
    expect(timer.record(afterBreak, afterBreak + 60_000)).toBe(false)
    expect(timer.seconds).toBe(60)
    expect(timer.record(afterBreak + 60_000, afterBreak + 45 * 60_000)).toBe(true)
  })
  it('clamps expanded messages/menu by measured width and height, including viewport resize', () => {
    expect(
      events.clampDock(
        { x: 940, y: 730 },
        { width: 1000, height: 800 },
        { width: 124, height: 330 }
      )
    ).toEqual({ x: 868, y: 462 })
    expect(
      events.clampDock(
        { x: -90, y: -30 },
        { width: 1000, height: 800 },
        { width: 124, height: 330 }
      )
    ).toEqual({ x: 8, y: 8 })
    expect(
      events.clampDock({ x: 868, y: 462 }, { width: 640, height: 480 }, { width: 124, height: 330 })
    ).toEqual({ x: 508, y: 142 })
    expect(
      events.clampDock({ x: 10, y: 10 }, { width: 100, height: 90 }, { width: 124, height: 330 })
    ).toEqual({ x: 8, y: 8 })
  })
})
