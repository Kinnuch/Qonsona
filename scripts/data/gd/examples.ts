/**
 * Tatoeba 的盖尔语例句（2026-10 一共 1,052 句）。早期有学习者贡献的句子错得不少
 * （ballach、Choinneach an neach-ionnsachaidh、Tòisich 当过去式用），所以：
 *
 * - 只收几位句子读下来地道的贡献者（下面的名单；抽查记录见 docs/lang/gd.md「例句」）；
 * - 句子里每个词都要在词典里查得到（错字、生造的词会查不到）；
 * - 要有人工的英文翻译；中文翻译经英文转接（盖尔语 → 英文 → 中文，都是 Tatoeba 上人工的翻译），
 *   标为 tatoeba-via-en。
 */
import { readFileSync } from 'node:fs'
import Bunzip from 'seek-bzip'
import { tokenizeGd } from '../../../src/shared/lang/gd/rules'
import type { FormIndex } from './freq'

/** 抽查下来可靠的贡献者（Tatoeba 用户名） */
export const TRUSTED = new Set([
  'Catriona',
  'Cainntear',
  'megamanenm',
  'canan',
  'emigonza',
  'User66640'
])

export interface TatoebaExample {
  id: number
  text: string
  en: string
  zh?: string
  user: string
  /** 句子里对上的词条（下标对 entries） */
  entries: number[]
}

const bz = (file: string): string => Bunzip.decode(readFileSync(file)).toString('utf8')

export interface TatoebaFiles {
  gla: string
  glaEng: string
  eng: string
  engCmn: string
  cmn: string
}

export function readTatoeba(
  files: TatoebaFiles,
  index: FormIndex
): {
  examples: TatoebaExample[]
  total: number
  untrusted: number
  unknownWord: number
  noEnglish: number
} {
  const gla: { id: number; text: string; user: string }[] = []
  for (const line of bz(files.gla).split('\n')) {
    const [id, lang, text, user] = line.split('\t')
    if (lang === 'gla' && text) gla.push({ id: Number(id), text: text.trim(), user })
  }
  const glaToEng = new Map<number, number[]>()
  for (const line of bz(files.glaEng).split('\n')) {
    const [a, b] = line.split('\t').map(Number)
    if (!a || !b) continue
    if (!glaToEng.has(a)) glaToEng.set(a, [])
    glaToEng.get(a)!.push(b)
  }
  const wantEng = new Set([...glaToEng.values()].flat())
  const eng = new Map<number, string>()
  for (const line of bz(files.eng).split('\n')) {
    const tab = line.indexOf('\t')
    const id = Number(line.slice(0, tab))
    if (!wantEng.has(id)) continue
    eng.set(id, line.split('\t')[2]?.trim() ?? '')
  }
  const engToCmn = new Map<number, number>()
  for (const line of bz(files.engCmn).split('\n')) {
    const [a, b] = line.split('\t').map(Number)
    if (wantEng.has(a) && b && !engToCmn.has(a)) engToCmn.set(a, b)
  }
  const wantCmn = new Set(engToCmn.values())
  const cmn = new Map<number, string>()
  for (const line of bz(files.cmn).split('\n')) {
    const tab = line.indexOf('\t')
    const id = Number(line.slice(0, tab))
    if (wantCmn.has(id)) cmn.set(id, line.split('\t')[2]?.trim() ?? '')
  }

  const examples: TatoebaExample[] = []
  let untrusted = 0
  let unknownWord = 0
  let noEnglish = 0
  for (const s of gla) {
    if (!TRUSTED.has(s.user)) {
      untrusted++
      continue
    }
    const engIds = (glaToEng.get(s.id) ?? []).filter((i) => eng.get(i))
    if (!engIds.length) {
      noEnglish++
      continue
    }
    // 英文翻译挑最短的那条（多半最直译）
    engIds.sort((a, b) => eng.get(a)!.length - eng.get(b)!.length)
    const en = eng.get(engIds[0])!
    const cmnId = engIds.map((i) => engToCmn.get(i)).find((i) => i && cmn.get(i))
    const ids = new Set<number>()
    let ok = true
    for (const t of tokenizeGd(s.text)) {
      if (t.kind !== 'word') continue
      const hit = index.resolve(t.text)
      // 人名、地名（句中大写）查不到不算错
      if (!hit.length) {
        if (/^\p{Lu}/u.test(t.text) && t.start > 0) continue
        ok = false
        break
      }
      for (const i of hit.slice(0, 2)) ids.add(i)
    }
    if (!ok) {
      unknownWord++
      continue
    }
    examples.push({
      id: s.id,
      text: s.text,
      en,
      ...(cmnId ? { zh: cmn.get(cmnId) } : {}),
      user: s.user,
      entries: [...ids]
    })
  }
  return { examples, total: gla.length, untrusted, unknownWord, noEnglish }
}
