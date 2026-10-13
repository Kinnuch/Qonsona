import { describe, expect, it } from 'vitest'
import { selectTextVoice } from '../src/renderer/src/lib/audio-policy'
import type { Voice } from '../src/renderer/src/lib/platform'
const voices: Voice[] = [
  { name: 'system-en', culture: 'en-US', gender: 'Female' },
  { name: 'espeak:en', culture: 'en', gender: 'Neutral', engine: 'offline' },
  { name: 'neural:en:M1', culture: 'en', gender: 'Male', engine: 'neural' },
  { name: 'neural:en:F1', culture: 'en', gender: 'Female', engine: 'neural' },
  { name: 'ipa', culture: 'und-fonipa', gender: 'Neutral', engine: 'ipa' }
]
describe('text voice policy', () => {
  it('prefers installed neural over earlier system voices and honors language-specific selected speakers', () => {
    expect(
      selectTextVoice(voices, 'en-GB', { textVoiceMode: 'neural', textVoices: {} })?.name
    ).toBe('neural:en:M1')
    expect(
      selectTextVoice(voices, 'en', { textVoiceMode: 'neural', textVoices: { en: 'neural:en:F1' } })
        ?.name
    ).toBe('neural:en:F1')
  })
  it('falls back only to matching system voices, never automatically mechanical voices', () => {
    expect(
      selectTextVoice(voices.slice(0, 2), 'en', { textVoiceMode: 'neural', textVoices: {} })?.name
    ).toBe('system-en')
    expect(
      selectTextVoice([voices[1]], 'en', { textVoiceMode: 'neural', textVoices: {} })
    ).toBeNull()
    expect(selectTextVoice(voices, 'en', { textVoiceMode: 'offline', textVoices: {} })?.name).toBe(
      'espeak:en'
    )
  })
  it('rejects wrong-language preferences and has no fake gd/qya/sjn neural fallback', () => {
    for (const lang of ['gd', 'qya', 'sjn'])
      expect(
        selectTextVoice(voices, lang, {
          textVoiceMode: 'neural',
          textVoices: { [lang]: 'neural:en:F1' }
        })
      ).toBeNull()
    expect(
      selectTextVoice(voices, 'en', { textVoiceMode: 'system', textVoices: { en: 'neural:en:F1' } })
        ?.name
    ).toBe('system-en')
  })
})
