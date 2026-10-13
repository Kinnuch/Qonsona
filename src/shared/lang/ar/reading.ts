/** 阅读注音只恢复可对齐的词典元音；未知词与无法恢复的屈折不猜短元音。 */
import { arKey, clusters, hasVowelMarks, normalizeArabic } from './rules'

const PREFIX: Record<string, string> = {
  'conj-wa': 'وَ',
  'conj-fa': 'فَ',
  'prep-bi': 'بِ',
  'prep-ka': 'كَ',
  'prep-li': 'لِ',
  'fut-sa': 'سَ',
  definite: 'الْ'
}
const SUN = new Set([...'تثدذرزسشصضطظلن'])

export function arVocalizedSurface(
  surface: string,
  form: string | undefined,
  tags: string[]
): string | null {
  const raw = normalizeArabic(surface)
  if (!form || !hasVowelMarks(form)) return hasVowelMarks(raw) ? raw : null
  const stem = normalizeArabic(form)
  const rawKey = arKey(raw)
  const stemKey = arKey(stem)
  if (rawKey === stemKey) {
    // 显式输入的符号优先；没写的从这一词形补，避免拿同键的另一读法覆盖正文。
    const input = clusters(raw),
      source = clusters(stem)
    return source
      .map((c, i) => (input[i]?.r.length > input[i]?.b.length ? input[i].r : c.r))
      .join('')
  }
  let prefix = tags
    .filter((t) => PREFIX[t])
    .map((t) => PREFIX[t])
    .join('')
  if (arKey(prefix).endsWith('لال')) prefix = prefix.replace(/لِالْ$/, 'لِلْ')
  let head = stem
  if (tags.includes('definite')) {
    const cs = clusters(head)
    if (SUN.has(cs[0]?.b) && !cs[0].r.includes('ّ'))
      cs[0].r = cs[0].b + 'ّ' + cs[0].r.slice(cs[0].b.length)
    head = cs.map((c) => c.r).join('')
  }
  if (arKey(prefix + head) === rawKey) return prefix + head
  // ـاً 只附于已核对的名词/形容词或分词，末尾 alif 是已知宾格不定式记号。
  if (tags.includes('accusative') && rawKey === arKey(prefix + head) + 'ا') {
    head = head.replace(/[ًٌٍَُِ]+$/u, '')
    return prefix + head + 'ًا'
  }
  return hasVowelMarks(raw) ? raw : null
}
