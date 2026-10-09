/**
 * Tatoeba（CC BY 2.0 FR，部分 CC0）：法语句子 + 人工的中文、英文翻译。
 * 一个法语句子有几个翻译时取第一个；繁体的中文逐字转简体。
 */
import { join } from 'node:path'
import { CACHE } from './fetch'
import { DOWNLOADS } from './sources'
import { cached, log, readBz2Text } from './io'
import { toSimplified } from './zh-sources'

export interface TatoebaSentence {
  id: number
  text: string
  zh?: string
  en?: string
}

const file = (id: keyof typeof DOWNLOADS): string => join(CACHE, DOWNLOADS[id].file)

function links(path: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const line of readBz2Text(path).split('\n')) {
    const [a, b] = line.split('\t')
    if (!a || !b) continue
    const list = out.get(a) ?? []
    list.push(b.trim())
    out.set(a, list)
  }
  return out
}

function sentences(path: string, want?: Set<string>): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of readBz2Text(path).split('\n')) {
    const i = line.indexOf('\t')
    const j = line.indexOf('\t', i + 1)
    if (i < 0 || j < 0) continue
    const id = line.slice(0, i)
    if (want && !want.has(id)) continue
    out.set(id, line.slice(j + 1).trim())
  }
  return out
}

export async function loadTatoeba(t2s: Record<string, string>): Promise<TatoebaSentence[]> {
  const inputs = [
    file('tatoebaFra'),
    file('tatoebaFraCmn'),
    file('tatoebaFraEng'),
    file('tatoebaCmn'),
    file('tatoebaEng')
  ]
  return cached('tatoeba', 1, inputs, async () => {
    const fra = sentences(file('tatoebaFra'))
    const toCmn = links(file('tatoebaFraCmn'))
    const toEng = links(file('tatoebaFraEng'))
    const cmn = sentences(file('tatoebaCmn'))
    const engIds = new Set<string>()
    for (const ids of toEng.values()) for (const id of ids) engIds.add(id)
    const eng = sentences(file('tatoebaEng'), engIds)
    const out: TatoebaSentence[] = []
    for (const [id, text] of fra) {
      const zh = toCmn
        .get(id)
        ?.map((x) => cmn.get(x))
        .find(Boolean)
      const en = toEng
        .get(id)
        ?.map((x) => eng.get(x))
        .find(Boolean)
      if (!zh && !en) continue
      out.push({
        id: Number(id),
        text,
        ...(zh ? { zh: toSimplified(zh, t2s) } : {}),
        ...(en ? { en } : {})
      })
    }
    log(
      `Tatoeba：法语句子 ${fra.size} 句，有翻译的 ${out.length} 句（有中文 ${out.filter((s) => s.zh).length} 句）`
    )
    return out
  })
}
