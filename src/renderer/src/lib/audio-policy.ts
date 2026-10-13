import type { Prefs, Voice } from './platform'

export function selectTextVoice(
  voices: Voice[],
  lang: string,
  prefs: Pick<Prefs, 'textVoiceMode' | 'textVoices'>
): Voice | null {
  const base = lang.split('-')[0].toLowerCase()
  if (!base) return null
  const matching = voices.filter(
    (v) => v.engine !== 'ipa' && v.culture.toLowerCase().split('-')[0] === base
  )
  const mode = prefs.textVoiceMode ?? 'neural'
  const desired = matching.find((v) => v.name === prefs.textVoices?.[base])
  const engine = (v: Voice): string => v.engine ?? 'system'
  if (desired && engine(desired) === mode) return desired
  return (
    matching.find((v) => engine(v) === mode) ??
    (mode === 'neural' ? (matching.find((v) => engine(v) === 'system') ?? null) : null)
  )
}
