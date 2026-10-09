/**
 * Tatoeba 的英语句子与中文翻译（CC BY 2.0 FR）。
 *
 * 只用自报英语为母语的用户写的句子；带不合适标签的（粗俗、冒犯、暴力、待检查……）不用；
 * 中文翻译取 Tatoeba 上人工翻译的，繁体句换成 Tatoeba 自带的简体转写。
 */
import { readFileSync } from 'node:fs'
import Bunzip from 'seek-bzip'

export const readBz2 = (path: string): string =>
  (Bunzip as { decode(b: Buffer): Buffer }).decode(readFileSync(path)).toString('utf8')

export interface Sentence {
  id: number
  text: string
  zh?: string
}

export interface TatoebaFiles {
  sentences: string
  userLanguages: string
  tags: string
  links: string
  cmn: string
  cmnTranscriptions: string
}

/** 句子标签里这些（按名字认）的句子不用：不合适学习软件的内容，以及标着要检查、不自然的 */
export const BAD_TAG =
  /vulgar|offens|sexual|sexist|\bsex\b|rude|insult|slur|racis|obscen|drug|violen|death|suicid|@check|@change|@delete|@not a sentence|@possible|needs native check|unnatural|intentionally incorrect|copyright|outdated|alcohol/i

/** 读句子：返回能用的英语句子（带中文翻译的带上 zh） */
export function loadSentences(f: TatoebaFiles): {
  sentences: Sentence[]
  stats: Record<string, number>
} {
  const native = new Set<string>()
  for (const line of readBz2(f.userLanguages).split('\n')) {
    const [lang, level, user] = line.split('\t')
    if (lang === 'eng' && level === '5' && user && user !== '\\N') native.add(user)
  }
  const bad = new Set<number>()
  for (const line of readBz2(f.tags).split('\n')) {
    const tab = line.indexOf('\t')
    if (tab > 0 && BAD_TAG.test(line.slice(tab + 1))) bad.add(Number(line.slice(0, tab)))
  }
  // 中文：原句是简体的直接用；繁体原句用简体转写
  const cmn = new Map<number, string>()
  for (const line of readBz2(f.cmn).split('\n')) {
    const [id, , text] = line.split('\t')
    if (id && text) cmn.set(Number(id), text.trim())
  }
  const hans = new Map<number, string>()
  for (const line of readBz2(f.cmnTranscriptions).split('\n')) {
    const [id, , script, , text] = line.split('\t')
    if (script === 'Hans' && id && text) hans.set(Number(id), text.trim())
  }
  const zhFor = new Map<number, { text: string; original: boolean }>()
  for (const line of readBz2(f.links).split('\n')) {
    const [en, zh] = line.split('\t').map(Number)
    if (!en || !zh || !cmn.has(zh)) continue
    const original = !hans.has(zh)
    // 已经有原本就是简体的翻译就不换
    if (zhFor.get(en)?.original) continue
    zhFor.set(en, { text: original ? cmn.get(zh)! : hans.get(zh)!, original })
  }
  const sentences: Sentence[] = []
  const stats = { total: 0, native: 0, badTag: 0, length: 0, kept: 0, withZh: 0 }
  for (const line of readBz2(f.sentences).split('\n')) {
    const cols = line.split('\t')
    if (cols.length < 4 || cols[1] !== 'eng') continue
    stats.total++
    const id = Number(cols[0])
    const text = cols[2].trim()
    if (!native.has(cols[3])) continue
    stats.native++
    if (bad.has(id)) {
      stats.badTag++
      continue
    }
    const words = text.split(/\s+/).length
    if (
      words < 3 ||
      words > 20 ||
      text.length > 140 ||
      /[^\p{Script=Latin}\p{N}\p{P}\p{S}\s]/u.test(text)
    ) {
      stats.length++
      continue
    }
    const zh = zhFor.get(id)?.text
    sentences.push(zh ? { id, text, zh } : { id, text })
    stats.kept++
    if (zh) stats.withZh++
  }
  return { sentences, stats }
}

/** 句子里的词：字母（含撇号、连字符连起来的）与数字 */
export const sentenceTokens = (text: string): string[] =>
  text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+)*|\d+/g) ?? []

/** 挑例句的先后：有中文的在前，长度接近 8 个词的在前 */
export function qualityOrder(sentences: Sentence[]): Sentence[] {
  const score = (s: Sentence): number => {
    const n = sentenceTokens(s.text).length
    return (s.zh ? 0 : 1000) + Math.abs(n - 8) * 10 + (n > 14 ? 50 : 0)
  }
  return sentences
    .map((s) => ({ s, k: score(s) }))
    .sort((a, b) => a.k - b.k || a.s.id - b.s.id)
    .map((x) => x.s)
}
