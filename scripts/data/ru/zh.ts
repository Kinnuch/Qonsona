/**
 * 中文释义的开放来源：
 * 1. 中文维基词典的俄语词条（kaikki zhwiktionary「俄语」「俄語」）：只收有词性标题、写成正式词条的；
 *    2010 年机器人（Wjcdbot）批量建的光杆条目（只有一行释义、没有词性，kaikki 里词性是 unknown）来源不明，不收。
 * 2. 俄文维基词典俄语词条「Перевод」表里的中文（kaikki ruwiktionary）：第一个义项那一组。
 * 繁体一律按 OpenCC 的表转成简体。
 */
import type { PosTag } from '../../../src/shared/lang/types'
import { jsonl, type ToSimplified } from './read'
import { mapPos } from './wiktionary'

interface ZhRecord {
  word: string
  pos: string
  senses?: { glosses?: string[]; tags?: string[]; form_of?: unknown; alt_of?: unknown }[]
}

interface RuRecord {
  word: string
  pos: string
  translations?: {
    word?: string
    lang_code?: string
    sense?: string
    roman?: string
    tags?: string[]
  }[]
}

const key = (word: string, pos: PosTag | null): string => `${word}|${pos}`

/** 中文释义里不要的：只是指向别的词条、只写读音的 */
const USELESS =
  /(之(同義詞|同义词|異體|异体|變體|变体)|的(變格|变格|變位|变位|複數|复数)|屈折形|変化形|^見|^参见|^參見)/

function cleanZh(t2s: ToSimplified, g: string): string {
  return t2s
    .convert(g)
    .replace(/\s+/g, ' ')
    .replace(/[。．.]+$/, '')
    .trim()
}

/**
 * 一个词 + 词性的几条记录（同形异义词各是一条，按页面上的先后）；没有可用释义的记录是 null，留着它好按位置对齐
 */
export type ZhRecords = (string[] | null)[]

/** 中文维基词典：词 + 词性 → 各条记录（简体分类、繁体分类两份文件各自成一组，不能互相对齐） */
export async function readZhWiktionary(
  files: string[],
  t2s: ToSimplified
): Promise<{ glosses: Map<string, ZhRecords>[]; skippedBot: number }> {
  const glosses: Map<string, ZhRecords>[] = []
  let skippedBot = 0
  for (const file of files) {
    const map = new Map<string, ZhRecords>()
    glosses.push(map)
    for await (const o of jsonl<ZhRecord>(file)) {
      if (o.pos === 'unknown') {
        skippedBot++
        continue
      }
      const pos = o.pos === 'abbrev' ? 'abbr' : mapPos(o.pos, o.word)
      if (!pos) continue
      const out: string[] = []
      for (const s of o.senses ?? []) {
        if (s.form_of || s.alt_of || (s.tags ?? []).includes('form-of')) continue
        const g = s.glosses?.[s.glosses.length - 1]
        if (!g || USELESS.test(g) || /[а-яё]{3,}/i.test(g.replace(/\([^)]*\)|（[^）]*）/g, '')))
          continue
        const z = cleanZh(t2s, g)
        if (z && HAN.test(z) && !out.includes(z)) out.push(z)
      }
      const k = key(o.word.normalize('NFC'), pos)
      const list = map.get(k) ?? []
      list.push(out.length ? out.slice(0, 12) : null)
      map.set(k, list)
    }
  }
  return { glosses, skippedBot }
}

const HAN = /\p{Script=Han}/u

/** 闽南语白话字这类不是普通话的标音（toh-á） */
const NOT_MANDARIN = /-|ⁿ|o͘/

const RU_POS: Record<string, string> = {
  interj: 'intj',
  abbrev: 'abbr',
  gerund: 'verb',
  onomatopeia: 'intj'
}

/** 俄文维基词典：词 + 词性 → 各条记录第一个义项的中文对应词（同形异义词按页面上的先后） */
export async function readRuWiktionaryZh(
  file: string,
  t2s: ToSimplified
): Promise<Map<string, ZhRecords>> {
  const out = new Map<string, ZhRecords>()
  for await (const o of jsonl<RuRecord>(file)) {
    const raw = RU_POS[o.pos] ?? o.pos
    const pos = raw === 'abbr' ? 'abbr' : mapPos(raw, o.word)
    if (!pos) continue
    const k = key(o.word.normalize('NFC'), pos)
    const zh = (o.translations ?? []).filter(
      (t) => (t.lang_code === 'zh' || t.lang_code === 'cmn') && t.word
    )
    const words: string[] = []
    const first = zh[0]?.sense ?? ''
    for (const t of zh) {
      if ((t.sense ?? '') !== first) continue
      if (t.roman && NOT_MANDARIN.test(t.roman)) continue
      const w = cleanZh(t2s, t.word!)
      if (w && HAN.test(w) && !words.includes(w)) words.push(w)
    }
    // 没有中文的记录也占一个位置（同形异义词按先后对齐）；整个词都没有中文的不记
    const list = out.get(k)
    if (!words.length && !list) continue
    const entry = words.length ? words.slice(0, 5) : null
    if (list) list.push(entry)
    else out.set(k, [entry])
  }
  return out
}

export const zhKey = key
