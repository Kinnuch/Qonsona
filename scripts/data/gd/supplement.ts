/**
 * 手写的补充词条（data/gd/supplement.tsv）：维基词典与词网都没收、语料里又常见的词（mus「在……之前」、
 * buidheann「团体」、iomadach「许多」……）。每一条都对照过语料里的用法，没把握的性、复数宁可不写。
 *
 * 格式（制表符分隔，# 开头是注释）：
 *   词头  词性（kaikki 的词性名）  性（m / f / mf / -）  英文释义（义项之间 |，一个义项里几条用 ;）  词形（形式:标签+标签, …；没有写 -）  说明（不入库）
 * 词性写 + 的一行不是新词条，是给已有的词条补词形（旧写法、语料里的拼法）：
 *   loidhne  +  -  -  loighne:alternative
 */
import { readFileSync } from 'node:fs'
import type { LexSense } from '../../../src/shared/lang/types'
import { gdKey } from '../../../src/shared/lang/gd/rules'
import type { GdEntry } from './kaikki'
import { mapPos } from './kaikki'

const parseForms = (forms: string | undefined): [string, ...string[]][] => {
  const f: [string, ...string[]][] = []
  if (forms && forms !== '-')
    for (const item of forms.split(',')) {
      const [form, tags] = item.trim().split(':')
      if (form) f.push([form, ...(tags ? tags.split('+') : [])])
    }
  return f
}

export interface Supplement {
  entries: GdEntry[]
  /** 给已有词条补的词形：词头 → 词形 */
  additions: { word: string; forms: [string, ...string[]][] }[]
}

export function readSupplement(file: string): Supplement {
  const entries: GdEntry[] = []
  const additions: Supplement['additions'] = []
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (!raw.trim() || raw.startsWith('#')) continue
    const [w, kpos, g, glosses, forms] = raw.split('\t').map((s) => s?.trim() ?? '')
    if (!w || !kpos) throw new Error(`supplement.tsv 这一行缺东西：${raw}`)
    if (kpos === '+') {
      additions.push({ word: w, forms: parseForms(forms) })
      continue
    }
    if (!glosses) throw new Error(`supplement.tsv 这一行没有释义：${raw}`)
    const s: LexSense[] = glosses.split('|').map((sense) => ({
      en: sense
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean)
    }))
    const f = parseForms(forms)
    entries.push({
      data: {
        w,
        p: [mapPos(kpos, w)],
        s,
        ...(g && g !== '-' ? { g } : {}),
        ...(f.length ? { f } : {}),
        src: ['gd-supplement']
      },
      kpos,
      examples: s.map(() => [])
    })
  }
  return { entries, additions }
}

/** 把补的词形加到已有词条上（同词头的都加）；返回找不到词头的 */
export function applyAdditions(entries: GdEntry[], additions: Supplement['additions']): string[] {
  const missing: string[] = []
  for (const a of additions) {
    const hit = entries.filter((e) => gdKey(e.data.w) === gdKey(a.word))
    if (!hit.length) missing.push(a.word)
    for (const e of hit) {
      const f = (e.data.f ??= [])
      for (const form of a.forms) if (!f.some(([x]) => gdKey(x) === gdKey(form[0]))) f.push(form)
    }
  }
  return missing
}
