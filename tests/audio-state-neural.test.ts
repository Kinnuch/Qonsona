import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
const mocked = vi.hoisted(() => ({
  speak: vi.fn(),
  stopSpeech: vi.fn(),
  toast: vi.fn(),
  prefs: { ipaVoice: 'ipa', textVoiceMode: 'neural' as const, textVoices: {}, speechRate: 0 }
}))
vi.mock('$lib/platform', () => ({
  platform: { speak: mocked.speak, stopSpeech: mocked.stopSpeech }
}))
vi.mock('$lib/i18n/index.svelte', () => ({ t: (key: string) => key }))
vi.mock('../src/renderer/src/lib/state/ui.svelte', () => ({
  ui: { prefs: mocked.prefs, toast: mocked.toast }
}))
let State: typeof import('../src/renderer/src/lib/state/audio.svelte').AudioState
beforeAll(async () => {
  const identity = <T>(v: T): T => v
  vi.stubGlobal('$state', Object.assign(identity, { raw: identity }))
  State = (await import('../src/renderer/src/lib/state/audio.svelte')).AudioState
})
beforeEach(() => {
  vi.resetAllMocks()
  mocked.stopSpeech.mockResolvedValue(undefined)
  mocked.speak.mockResolvedValue({ wav: null, dropped: [], error: 'test' })
})
const make = () => {
  const state = new State()
  state.voices = [
    { name: 'ipa', culture: 'und-fonipa', gender: 'Neutral', engine: 'ipa' },
    { name: 'neural:supertonic3:en:F1', culture: 'en', gender: 'Female', engine: 'neural' }
  ]
  return state
}
describe('actual AudioState neural routing and cancellation', () => {
  it('does not play audio returned after the user cancelled an already dispatched request', async () => {
    let release!: (value: { wav: Uint8Array; dropped: string[] }) => void
    mocked.speak.mockReturnValueOnce(
      new Promise((done) => {
        release = done
      })
    )
    const state = make(),
      request = state.say({ text: 'Hello', lang: 'en' })
    await vi.waitFor(() => expect(mocked.speak).toHaveBeenCalledTimes(1))
    expect(state.pending).toBe('Hello')
    await state.stop()
    release({ wav: new Uint8Array([82, 73, 70, 70]), dropped: [] })
    await request
    expect(state.playing).toBeNull()
    expect(state.pending).toBeNull()
    expect(mocked.toast).not.toHaveBeenCalled()
  })
  it('uses text for a natural-language item carrying IPA, but pure IPA stays phonetic', async () => {
    const state = make()
    await state.say({ text: 'Hello', lang: 'en', ipa: 'həˈloʊ' })
    expect(mocked.speak).toHaveBeenLastCalledWith({
      content: 'Hello',
      ipa: false,
      voice: 'neural:supertonic3:en:F1',
      rate: 0
    })
    await state.say({ ipa: 'ra' })
    expect(mocked.speak).toHaveBeenLastCalledWith({
      content: 'ra',
      ipa: true,
      voice: 'ipa',
      rate: 0
    })
    expect(state.pending).toBeNull()
  })
  it('labels missing natural voices as phoneme approximations and does not fake another language', async () => {
    const state = make(),
      item = { text: 'tôl', lang: 'sjn', ipa: 'toːl' }
    expect(state.usesIpaApproximation(item)).toBe(true)
    await state.say(item)
    expect(mocked.speak).toHaveBeenLastCalledWith({
      content: 'toːl',
      ipa: true,
      voice: 'ipa',
      rate: 0
    })
    expect(state.canSay({ text: 'hello', lang: 'gd' })).toBe(false)
  })
  it('awaits the stop barrier, and cancelling pending synthesis never dispatches an obsolete request', async () => {
    let release!: () => void
    mocked.stopSpeech.mockReturnValueOnce(
      new Promise<void>((done) => {
        release = done
      })
    )
    const state = make(),
      request = state.say({ text: 'Hello', lang: 'en' })
    expect(state.pending).toBe('Hello')
    expect(mocked.speak).not.toHaveBeenCalled()
    await state.stop()
    release()
    await request
    expect(mocked.speak).not.toHaveBeenCalled()
    expect(state.pending).toBeNull()
  })
  it('clears pending state and reports IPC synthesis failures', async () => {
    const state = make()
    mocked.speak.mockRejectedValue(new Error('worker failed'))
    await state.say({ text: 'Hello', lang: 'en' })
    expect(state.pending).toBeNull()
    expect(mocked.toast).toHaveBeenCalledWith('audio.failed', 'error', 6000)
  })
})
