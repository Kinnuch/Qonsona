import type { EldamoRecord } from './parse'
import type { PosTag } from '../../../src/shared/lang/types'

/** Reviewed source identities: a headword alone cannot disambiguate historical homographs. */
export interface CoreBinding {
  w: string
  id: string
  pos: PosTag
  gloss: string
  period: string
}
export function validateCoreBindings(
  records: EldamoRecord[],
  bindings: CoreBinding[],
  key: (word: string) => string
): Map<string, CoreBinding> {
  const result = new Map<string, CoreBinding>()
  for (const binding of bindings) {
    const candidates = records.filter((record) => record.id === binding.id)
    const record = candidates[0]
    const escaped = binding.gloss.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const anchor = new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i')
    if (
      candidates.length !== 1 ||
      key(record.data.w) !== key(binding.w) ||
      !record.data.p.includes(binding.pos) ||
      (record.data.x!.eldamo as { period: string }).period !== binding.period ||
      !record.data.s.some((sense) => sense.en?.some((gloss) => anchor.test(gloss))) ||
      result.has(binding.id)
    )
      throw new Error(`Invalid reviewed Eldamo core binding: ${binding.w}/${binding.id}`)
    result.set(binding.id, binding)
  }
  return result
}
