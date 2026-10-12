/**
 * Lexique（lexique.org，CC BY-SA 4.0）→ 原形的词频、知晓率、词形的 IPA。
 *
 * - Lexique 4.1：3.16 亿词的电影电视字幕语料（口语、日常），19 万词形，带 IPA、知晓率（prevalence：
 *   多少比例的母语者认得这个词）；
 * - Lexique 3.83：另有一份书籍语料的词频（书面语）。
 * 原形的词频 = 它所有词形的词频相加（Lexique 4 自带的 FreqLemme 有些行对错了原形，不用）。
 * 两份都有的取加权几何平均（字幕 0.6、书籍 0.4），只有一份的打个八折：
 * 字幕词频单用会把口语粗话排得太前（mec、putain），书籍词频单用会把文学词排得太前，合起来跟 FLELex 最接近
 * （见 docs/lang/fr.md「分级」）。
 */
import { join } from 'node:path'
import type { PosTag } from '../../../src/shared/lang/types'
import { frKey } from '../../../src/shared/lang/fr/rules'
import { CACHE } from './fetch'
import { DOWNLOADS } from './sources'
import { cached, log, readZipEntry } from './io'

/** Lexique 的词类 → UPOS（连词两种都可能，查的时候 cconj、sconj 都试） */
export function lexPos(cgram: string): PosTag | null {
  const [main, sub] = cgram.split(':')
  switch (main) {
    case 'NOM':
      return 'noun'
    case 'VER':
    case 'AUX':
      return 'verb'
    case 'ADJ':
      return sub === 'num' ? 'num' : sub ? 'det' : 'adj'
    case 'ADV':
      return 'adv'
    case 'PRE':
      return 'adp'
    case 'CON':
      return 'sconj'
    case 'PRO':
      return 'pron'
    case 'ART':
      return 'det'
    case 'ONO':
      return 'intj'
    default:
      return null
  }
}

export interface LexLemma {
  /** 字幕词频（每百万词） */
  sub: number
  /** 书籍词频（每百万词；Lexique 3.83） */
  book: number
  /** 知晓率（%），Lexique 4 只给部分词 */
  prev?: number
}

export interface Lexique {
  /** 「原形键|UPOS」→ 词频 */
  lemmas: Record<string, LexLemma>
  /** 原形键 → 各词性加起来 */
  any: Record<string, LexLemma>
  /** 词形键 → IPA（Lexique 4，没有音节点；同形异音的取第一个） */
  ipa: Record<string, string>
  /** 「词形键|原形键」→ IPA：同形异音词（couvent 名词 / 动词）按原形分开 */
  formIpa: Record<string, string>
  /** 「词形键|UPOS」→ 这个词形本身的词频（省音形式 l'、s'、qu' 的词条用：它们的原形是 le、se、que） */
  forms: Record<string, LexLemma>
}

/** 合起来的词频分数（每百万词） */
export function lexScore(l: LexLemma | undefined): number {
  if (!l) return 0
  if (l.sub > 0 && l.book > 0) return Math.exp(0.6 * Math.log(l.sub) + 0.4 * Math.log(l.book))
  return 0.8 * (l.sub || l.book)
}

const rows = (tsv: string): { head: string[]; rows: string[][] } => {
  const lines = tsv.split(/\r?\n/)
  return {
    head: lines[0].split('\t'),
    rows: lines
      .slice(1)
      .filter(Boolean)
      .map((l) => l.split('\t'))
  }
}

export async function loadLexique(): Promise<Lexique> {
  const z3 = join(CACHE, DOWNLOADS.lexique3.file)
  const z4 = join(CACHE, DOWNLOADS.lexique4.file)
  return cached('lexique', 5, [z3, z4], async () => {
    log('读 Lexique 3.83 与 4.1…')
    const lemmas: Record<string, LexLemma> = {}
    const any: Record<string, LexLemma> = {}
    const ipa: Record<string, string> = {}
    const formIpa: Record<string, string> = {}
    const forms: Record<string, LexLemma> = {}
    const addForm = (form: string, pos: PosTag, field: 'sub' | 'book', v: number): void => {
      ;(forms[`${frKey(form)}|${pos}`] ??= { sub: 0, book: 0 })[field] += v
    }
    const add = (
      lemma: string,
      pos: PosTag,
      field: 'sub' | 'book',
      v: number,
      gender?: string
    ): void => {
      const k = frKey(lemma)
      ;(lemmas[`${k}|${pos}`] ??= { sub: 0, book: 0 })[field] += v
      // 名词另按性记一份：le livre「书」和 la livre「磅」差得很远
      if (pos === 'noun' && (gender === 'm' || gender === 'f'))
        (lemmas[`${k}|${pos}|${gender}`] ??= { sub: 0, book: 0 })[field] += v
      ;(any[k] ??= { sub: 0, book: 0 })[field] += v
    }
    // Lexique 4.1：字幕词频、知晓率、IPA
    const v4 = rows(readZipEntry(z4, 'Lexique4.1.tsv'))
    const c4 = (name: string): number => v4.head.indexOf(name)
    const [iW, iIpa, iL, iC, iG, iF, iLem, iPrev] = [
      c4('1_Mot'),
      c4('3_Phono_IPA'),
      c4('4_Lemme'),
      c4('5_Cgram'),
      c4('7_Genre'),
      c4('10_FreqMot'),
      c4('14_IsLem'),
      c4('33_Preval')
    ]
    for (const r of v4.rows) {
      const pos = lexPos(r[iC] ?? '')
      if (!pos || !r[iL]) continue
      add(r[iL], pos, 'sub', Number(r[iF]) || 0, r[iG])
      if (r[iW]?.endsWith("'")) addForm(r[iW], pos, 'sub', Number(r[iF]) || 0)
      if (r[iLem] === '1' && r[iPrev]) {
        const k = `${frKey(r[iL])}|${pos}`
        lemmas[k].prev = Math.max(lemmas[k].prev ?? 0, Number(r[iPrev]))
      }
      const w = frKey(r[iW] ?? '')
      if (w && r[iIpa] && !ipa[w]) ipa[w] = r[iIpa]
      const fl = `${w}|${frKey(r[iL])}`
      if (w && r[iIpa] && !formIpa[fl]) formIpa[fl] = r[iIpa]
    }
    // Lexique 3.83：书籍词频
    const v3 = rows(readZipEntry(z3, 'Lexique383.tsv'))
    const c3 = (name: string): number => v3.head.indexOf(name)
    const [jW, jL, jC, jG, jB] = [
      c3('ortho'),
      c3('lemme'),
      c3('cgram'),
      c3('genre'),
      c3('freqlivres')
    ]
    for (const r of v3.rows) {
      const pos = lexPos(r[jC] ?? '')
      if (!pos || !r[jL]) continue
      add(r[jL], pos, 'book', Number(r[jB]) || 0, r[jG])
      if (r[jW]?.endsWith("'")) addForm(r[jW], pos, 'book', Number(r[jB]) || 0)
    }
    log(`Lexique：${Object.keys(any).length} 个原形，${Object.keys(ipa).length} 个词形有 IPA`)
    return { lemmas, any, ipa, formIpa, forms }
  })
}

/**
 * 一个词条在 Lexique 里的词频：名词先按性找，再按词性找；连词两种都试；
 * 找不到的短语、缩合冠词等用各词性合计
 */
export function lexLookup(
  lex: Lexique,
  key: string,
  pos: PosTag,
  gender?: string
): LexLemma | undefined {
  // 省音形式（l'、s'、qu'、n'）：词条的词头就是词形，按词形本身的词频（s' 代词远比 s' 连词常用）
  if (key.endsWith("'")) {
    const tries: PosTag[] =
      pos === 'other' ? ['adv', 'pron', 'sconj'] : pos === 'cconj' ? ['sconj'] : [pos]
    for (const p of tries) if (lex.forms[`${key}|${p}`]) return lex.forms[`${key}|${p}`]
  }
  if (pos === 'noun' && (gender === 'm' || gender === 'f')) {
    const l = lex.lemmas[`${key}|noun|${gender}`]
    if (l) return l
  }
  const tryPos: PosTag[] =
    pos === 'cconj' || pos === 'sconj'
      ? ['sconj']
      : pos === 'aux'
        ? ['verb']
        : pos === 'propn'
          ? ['noun']
          : pos === 'det'
            ? ['det', 'adp'] // Lexique 把缩合冠词 au、du 算介词
            : pos === 'part'
              ? ['adv'] // ne、pas 之类 Lexique 算副词
              : [pos]
  for (const p of tryPos) {
    const l = lex.lemmas[`${key}|${p}`]
    if (l) return l
  }
  // 省音形式（n'、s'、qu'）各家词性不一，直接用合计
  if (pos === 'other') return lex.any[key]
  // 短语、缩合冠词、词性对不上（Lexique 把 au 算介词）的：用合计——但这个词在 Lexique 里另有词性时不行，
  // 不然感叹词 feu !、介词 question 会拿到名词 feu、question 的词频
  if (['phrase', 'idiom', 'proverb', 'other', 'det', 'adp', 'part', 'intj', 'num'].includes(pos)) {
    const other = LEX_POS.some((p) => p !== pos && lex.lemmas[`${key}|${p}`])
    if (!other || / /.test(key)) return lex.any[key]
  }
  return undefined
}

const LEX_POS: PosTag[] = [
  'noun',
  'verb',
  'adj',
  'adv',
  'pron',
  'det',
  'adp',
  'sconj',
  'num',
  'intj'
]
