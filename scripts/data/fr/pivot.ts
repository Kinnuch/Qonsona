/**
 * 英文维基词典的翻译表 → 法汉对照。
 *
 * 英语词条的每个义项下有一张翻译表，同一张表里既有法语（French）又有汉语（Mandarin / Chinese）的，
 * 两边的译词说的就是同一个意思：「cat（家猫）→ chat ↔ 猫」。这比把法语的英文释义再转成中文准，
 * 也比只看汉法词典反查（一个中文词对一串法语词）准。英文义项的释义留着，用来把中文对到法语词条的义项上。
 *
 * 整份原始抽取 24 GB（压缩 3 GB），扫一遍要几分钟；结果缓存在 .cache/data/fr/work/pivot.json。
 */
import { join } from 'node:path'
import { CACHE } from './fetch'
import { DOWNLOADS } from './sources'
import { cached, log, readJsonl } from './io'

export interface PivotSense {
  /** 英语词头 */
  e: string
  /** 英语词性（wiktextract 的 pos） */
  p: string
  /** 翻译表的义项说明（英文） */
  s: string
  /** 法语译词：[词, ...标签（masculine、feminine……）] */
  fr: string[][]
  /** 汉语（普通话）译词，原样（可能是「貓／猫」） */
  zh: string[]
}

interface RawTranslation {
  code?: string
  lang_code?: string
  lang?: string
  word?: string
  sense?: string
  tags?: string[]
}

interface RawEntry {
  word: string
  pos: string
  lang_code: string
  translations?: RawTranslation[]
  senses?: { translations?: RawTranslation[] }[]
}

const code = (t: RawTranslation): string => t.lang_code ?? t.code ?? ''

export async function loadPivot(): Promise<PivotSense[]> {
  const file = join(CACHE, DOWNLOADS.enwiktRaw.file)
  return cached('pivot', 2, [file], async () => {
    log('扫英文维基词典的翻译表（几分钟）…')
    const out: PivotSense[] = []
    let n = 0
    for await (const o of readJsonl<RawEntry>(
      file,
      (l) =>
        l.includes('"lang_code": "en"') &&
        l.includes('"translations"') &&
        l.includes('"lang_code": "fr"') &&
        l.includes('"lang_code": "cmn"')
    )) {
      if (o.lang_code !== 'en') continue
      n++
      const all = [
        ...(o.translations ?? []),
        ...(o.senses ?? []).flatMap((s) => s.translations ?? [])
      ]
      const bySense = new Map<string, { fr: string[][]; zh: string[] }>()
      for (const t of all) {
        const c = code(t)
        // 汉语只要普通话（cmn）；zh 底下混着东干语（西里尔字母）、闽南语等，不要
        if (!t.word || (c !== 'fr' && c !== 'cmn')) continue
        if (c === 'cmn' && !/\p{Script=Han}/u.test(t.word)) continue
        const k = t.sense ?? ''
        const g = bySense.get(k) ?? { fr: [], zh: [] }
        if (c === 'fr') g.fr.push([t.word, ...(t.tags ?? [])])
        else g.zh.push(t.word)
        bySense.set(k, g)
      }
      for (const [s, g] of bySense)
        if (g.fr.length && g.zh.length) out.push({ e: o.word, p: o.pos, s, fr: g.fr, zh: g.zh })
    }
    log(`翻译表：${n} 个英语词条，${out.length} 个义项同时有法语和汉语`)
    return out
  })
}
