import { CLASS_LABEL, PRED_CLASSES, conjugate, possibleClasses, type PredClass } from './conjugate'
import type { InflectionEntry, InflectionForm } from '../inflection'
import type { LocalizedText, SourceRef } from '../types'

/** Small fallback only when recorded forms are entirely absent and the class is unambiguous. */
export function koreanInflectionFallback(
  entry: InflectionEntry
): { forms: InflectionForm[]; notice: LocalizedText; sources: SourceRef[] } | null {
  if (
    entry.code !== 'ko' ||
    entry.forms.some((f) => f.form.trim()) ||
    !entry.p.some((p) => p === 'verb' || p === 'adj') ||
    !/^[가-힣]+다$/u.test(entry.w)
  )
    return null
  const possible = possibleClasses(entry.w)
  const declared = PRED_CLASSES.filter((cls) =>
    entry.cls.some((label) => Object.values(CLASS_LABEL[cls]).includes(label))
  )
  let cls: PredClass | undefined
  if (declared.length === 1 && possible.includes(declared[0])) cls = declared[0]
  else if (possible.length === 1) cls = possible[0]
  // ㅂ's p/po subclasses share a display label, so that label alone is not evidence.
  if (!cls) return null
  const sequences: [string[], string[]][] = [
    [['hae'], ['-아/어']],
    [['haeyo'], ['-아요/어요']],
    [['seumnida'], ['-습니다']],
    [['go'], ['-고']],
    [['ji'], ['-지']],
    [
      ['past', 'haeyo'],
      ['-았/었-', '-아요/어요']
    ]
  ]
  const forms = sequences.flatMap(([chain, tags]) =>
    conjugate(entry.w, cls!, chain).map((form) => ({ form, tags, provenance: 'rule' as const }))
  )
  if (!forms.length) return null
  return {
    forms,
    notice: {
      zh: '词条没有已记录词形；以下仅由现有韩语活用器按可确定的类别生成少量常用形式，明确标为规则结果，并非新增词典证据。未确认的不规则类别不生成。',
      en: 'No recorded forms are available. These few common forms come from the existing Korean generator using an unambiguous class; they are labelled rule outputs, not dictionary attestations. Unresolved irregular classes are not generated.'
    },
    sources: [
      {
        id: 'qonsona-ko-conjugator',
        name: 'Qonsona Korean predicate generator',
        license: 'MIT',
        credit: 'Qonsona contributors',
        home: 'https://github.com/Kinnuch/Qonsona',
        note: 'src/shared/lang/ko/conjugate.ts; existing tested generator, restricted to unambiguous classes.'
      }
    ]
  }
}
