/**
 * Tatoeba 例句：阿拉伯语句子连同英译、中译。阿中直接对照的很少（几十句），没有中译的句子，
 * 它的英译在 Tatoeba 上有人工中译的，就用那句中译（来源记成 tatoeba-en，界面上注明是经英语转的）。
 */
import { readFileSync } from 'node:fs'
import Bunzip from 'seek-bzip'

export interface TatoebaSentence {
  id: string
  text: string
  en?: string
  zh?: string
  /** 中译是直接对照（tatoeba）还是经英语转的（tatoeba-en） */
  zs?: 'tatoeba' | 'tatoeba-en'
}

const readBz2 = (file: string): string =>
  (Bunzip as { decode(b: Buffer): Buffer }).decode(readFileSync(file)).toString('utf8')

function sentences(file: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of readBz2(file).split('\n')) {
    const [id, , text] = line.split('\t')
    if (id && text) out.set(id, text.trim())
  }
  return out
}

function links(file: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const line of readBz2(file).split('\n')) {
    const [a, b] = line.split('\t').map((s) => s?.trim())
    if (!a || !b) continue
    const l = out.get(a)
    if (l) l.push(b)
    else out.set(a, [b])
  }
  return out
}

export function readTatoeba(
  files: {
    ara: string
    araEng: string
    araCmn: string
    eng: string
    engCmn: string
    cmn: string
  },
  toSimplified: (s: string) => string
): TatoebaSentence[] {
  const ara = sentences(files.ara)
  const eng = sentences(files.eng)
  const cmn = sentences(files.cmn)
  const ae = links(files.araEng)
  const ac = links(files.araCmn)
  const ec = links(files.engCmn)
  const out: TatoebaSentence[] = []
  for (const [id, text] of ara) {
    const enIds = (ae.get(id) ?? []).filter((x) => eng.has(x))
    const en = enIds.map((x) => eng.get(x)!)[0]
    const zhDirect = (ac.get(id) ?? []).map((x) => cmn.get(x)).find(Boolean)
    let zh: string | undefined
    let zs: TatoebaSentence['zs']
    if (zhDirect) {
      zh = zhDirect
      zs = 'tatoeba'
    } else {
      for (const e of enIds) {
        const c = (ec.get(e) ?? []).map((x) => cmn.get(x)).find(Boolean)
        if (c) {
          zh = c
          zs = 'tatoeba-en'
          break
        }
      }
    }
    out.push({ id, text, en, zh: zh ? toSimplified(zh) : undefined, zs: zh ? zs : undefined })
  }
  return out
}
