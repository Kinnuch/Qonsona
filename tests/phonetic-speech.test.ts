import { afterAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { PhoneticSpeech } from '../src/main/phonetic-speech'
import { ipaPhones } from '../src/shared/ipa-phones'
const engine = new PhoneticSpeech(resolve('resources/speech'))
afterAll(() => engine.dispose())
describe('offline explicit IPA', () => {
  it('renders rounded vowels and distinguishes dark l from the voiceless lateral fricative', async () => {
    for (const ipa of ['ya', 'øa', 'œa', 'ɑa', 'ɜa', 'ɫa', 'ɬa', 'ʍa']) {
      const result = await engine.speak(ipa, true, '', 0)
      expect(result.error).toBeUndefined()
      expect(result.trace?.[0]).toBe(ipa.slice(0, 1))
      expect(result.wav!.length).toBeGreaterThan(1000)
    }
    expect(ipaPhones('yɹɑ').unsupported).toEqual(['ɹ', 'ɑ'])
  })
  it('keeps three rhotics distinct in engine input', () => {
    expect(ipaPhones('/ra ɹa ɾa/')).toEqual({ phones: ' Ra ra *a ', unsupported: [] })
    expect(ipaPhones('t͡ʃaː')).toEqual({ phones: 'tSa:', unsupported: [] })
  })
  it('does not silently drop unsupported sounds or tones', async () => {
    const result = await engine.speak('a˥', true, '', 0)
    expect(result.wav).toBeNull()
    expect(result.error).toContain('˥')
    expect(result.dropped).toEqual([])
  })
  it('actually renders a trill, approximant and tap as distinct PCM and phoneme events', async () => {
    const results = []
    for (const [ipa, phone] of [
      ['ra', 'r'],
      ['ɹa', 'ɹ'],
      ['ɾa', 'ɾ']
    ]) {
      const result = await engine.speak(ipa, true, 'Microsoft English ignored', 0)
      expect(result.error).toBeUndefined()
      expect(result.wav?.subarray(0, 4).toString()).toBe('RIFF')
      expect(result.wav!.length).toBeGreaterThan(1000)
      expect(result.trace![0]).toBe(phone)
      results.push(result.wav!)
    }
    expect(results[0].equals(results[1])).toBe(false)
    expect(results[0].equals(results[2])).toBe(false)
  })
  it('has genuine offline language voices and pronounces Arabic text without an English fallback', async () => {
    const voices = await engine.call({ op: 'voices' })
    expect(voices.voices?.map((v) => v.identifier)).toEqual(
      expect.arrayContaining(['sem/ar', 'art/qya', 'art/sjn'])
    )
    const result = await engine.speak('فِي', false, 'sem/ar', 0)
    expect(result.error).toBeUndefined()
    expect(result.trace?.some((p) => p.replaceAll('ˈ', '').includes('i'))).toBe(true)
    expect(result.wav!.length).toBeGreaterThan(1000)
  })
})
