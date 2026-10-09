/**
 * 手写的补充词条（data/gd/supplement.tsv）：维基词典与词网都没收、语料里又常见的词（mus「在……之前」、
 * buidheann「团体」、iomadach「许多」……）。每一条都对照过语料里的用法，没把握的性、复数宁可不写。
 *
 * 格式（制表符分隔，# 开头是注释）：
 *   词头  词性（kaikki 的词性名）  性（m / f / mf / -）  英文释义（义项之间 |，一个义项里几条用 ;）  词形（形式:标签+标签, …；没有写 -）  说明（不入库）
 */
import { readFileSync } from 'node:fs'
import type { LexSense } from '../../../src/shared/lang/types'
import type { GdEntry } from './kaikki'
import { mapPos } from './kaikki'

export function readSupplement(file: string): GdEntry[] {
  const out: GdEntry[] = []
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (!raw.trim() || raw.startsWith('#')) continue
    const [w, kpos, g, glosses, forms] = raw.split('\t').map((s) => s?.trim() ?? '')
    if (!w || !kpos || !glosses) throw new Error(`supplement.tsv 这一行缺东西：${raw}`)
    const s: LexSense[] = glosses.split('|').map((sense) => ({
      en: sense
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean)
    }))
    const f: [string, ...string[]][] = []
    if (forms && forms !== '-')
      for (const item of forms.split(',')) {
        const [form, tags] = item.trim().split(':')
        if (form) f.push([form, ...(tags ? tags.split('+') : [])])
      }
    out.push({
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
  return out
}
