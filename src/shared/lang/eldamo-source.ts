/** Safe, human-readable projection of lexical provenance; never render arbitrary source JSON. */
import type { LocalizedText } from './types'
import type { LexEntryView } from './views'

const periods: Record<string, LocalizedText> = {
  late: { zh: '晚期（1950–1973）', en: 'Late period (1950–1973)' },
  middle: { zh: '中期（1930–1950）', en: 'Middle period (1930–1950)' },
  early: { zh: '早期（1910–1930）', en: 'Early period (1910–1930)' },
  neo: { zh: '后托尔金 Neo 材料', en: 'Post-Tolkien Neo material' }
}
const languages: Record<string, LocalizedText> = {
  q: { zh: '晚期昆雅语', en: 'Late Quenya' },
  mq: { zh: '中期昆雅语', en: 'Middle Quenya' },
  eq: { zh: '早期 Qenya', en: 'Early Qenya' },
  nq: { zh: 'Neo-Quenya', en: 'Neo-Quenya' },
  s: { zh: '晚期辛达语', en: 'Late Sindarin' },
  n: { zh: 'Noldorin（中期前身）', en: 'Noldorin (middle-period precursor)' },
  en: { zh: '早期 Noldorin', en: 'Early Noldorin' },
  g: { zh: 'Gnomish（早期前身）', en: 'Gnomish (early precursor)' },
  ns: { zh: 'Neo-Sindarin', en: 'Neo-Sindarin' }
}
const statuses: Record<string, LocalizedText> = {
  'Neo-Elvish': { zh: 'Neo 精灵语', en: 'Neo-Elvish' },
  'fan-neologism': { zh: '爱好者新造词', en: 'Fan neologism' },
  reformulated: { zh: '依早期材料重构', en: 'Reformulated from early material' },
  'derived-unattested': { zh: '推导形式，未直接见证', en: 'Derived, not directly attested' },
  reconstructed: { zh: '比较构拟', en: 'Reconstructed' },
  speculative: { zh: '推测形式', en: 'Speculative' },
  'Tolkien-questioned': { zh: '托尔金原文存疑', en: 'Questioned by Tolkien' },
  rejected: { zh: '被否定的形式', en: 'Rejected form' },
  archaic: { zh: '古语/诗歌用法', en: 'Archaic/poetic' },
  'not-recommended': { zh: 'Eldamo 不推荐用于 Neo', en: 'Not recommended by Eldamo for Neo' },
  'editorially-marked': {
    zh: '有编辑标记，需核对原词条',
    en: 'Editorially marked; consult source'
  },
  'Tolkien-referenced': { zh: '有托尔金文献引用', en: 'With Tolkien source references' },
  'unverified-reference': { zh: '未附直接文献，需核对', en: 'No direct reference; verify' }
}
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
export interface EldamoSourceView {
  period: LocalizedText
  language: LocalizedText
  status: LocalizedText[]
  creator: string | null
  sourceHead: string | null
  references: { citation: string; form: string | null }[]
  eldamoUrl: string | null
  elfdictUrl: string
}
export function eldamoSource(
  entry: Pick<LexEntryView, 'code' | 'w' | 'x'>
): EldamoSourceView | null {
  if (!['qya', 'sjn'].includes(entry.code)) return null
  const data = object(entry.x.eldamo)
  if (!data) return null
  let eldamoUrl: string | null = null
  if (typeof data.url === 'string') {
    try {
      const parsed = new URL(data.url)
      if (
        parsed.protocol === 'https:' &&
        parsed.hostname === 'eldamo.org' &&
        !parsed.username &&
        !parsed.password &&
        !parsed.port &&
        /^\/content\/words\/word-\d+\.html$/.test(parsed.pathname)
      )
        eldamoUrl = `${parsed.origin}${parsed.pathname}`
    } catch {
      /* Invalid metadata is not an external-navigation target. */
    }
  }
  if (!eldamoUrl && typeof data.id === 'string' && /^\d+$/.test(data.id))
    eldamoUrl = `https://eldamo.org/content/words/word-${data.id}.html`
  const references = new Map<string, { citation: string; form: string | null }>()
  for (const value of Array.isArray(data.references) ? data.references : []) {
    const ref = object(value)
    if (!ref || typeof ref.source !== 'string' || !ref.source.trim()) continue
    const form =
      typeof ref.v === 'string' && ref.v.length <= 100 && !/[\r\n]/.test(ref.v) ? ref.v : null
    const citation = ref.source.trim()
    references.set(`${citation}|${form ?? ''}`, { citation, form })
  }
  return {
    period: periods[String(data.period)] ?? { zh: '时期未标注', en: 'Period unspecified' },
    language: languages[String(data.language)] ?? {
      zh: '语言阶段未标注',
      en: 'Language stage unspecified'
    },
    status: [
      ...new Set(
        Array.isArray(data.status)
          ? data.status.filter((status): status is string => typeof status === 'string')
          : []
      )
    ].flatMap((status) => (statuses[status] ? [statuses[status]] : [])),
    creator: typeof data.creator === 'string' && data.creator.trim() ? data.creator.trim() : null,
    sourceHead:
      typeof data.sourceHead === 'string' && data.sourceHead !== entry.w ? data.sourceHead : null,
    references: [...references.values()],
    eldamoUrl,
    elfdictUrl: `https://www.elfdict.com/w/${encodeURIComponent(entry.w)}`
  }
}
