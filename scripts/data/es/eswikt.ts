/**
 * 西语维基词典（Wikcionario，kaikki.org 的 eswiktionary「Español」抽取）：
 * - 西班牙语释义（单语释义，给中高级学习者；每个词条最多 3 条，去掉已废、古旧的义项）；
 * - 发音录音（维基共享资源；拉美、西班牙各地口音的都有）；
 * - 翻译表里的汉语（官话）对译词：只要标了第 1 义项或没标义项的。
 * 只收英文维基词典里也有的词（words），省内存。
 */
import { ES_POS, cleanTranslation, type T2S } from './zh'
import { readLines } from './util'

export interface EsAudio {
  file: string
  url: string
  label?: string
}

export interface EsEntry {
  /** 可以对上的英文版词性 */
  kpos: string[]
  gender?: 'm' | 'f' | 'mf'
  /** 西班牙语释义 */
  mono: string[]
  /** 第 1 义项的汉语对译词 */
  zh: string[]
}

export interface EsData {
  entries: Map<string, EsEntry[]>
  audio: Map<string, EsAudio[]>
}

const SKIP_TAGS = new Set(['obsolete', 'archaic', 'dated'])
const MAX_MONO = 3
const MAX_LEN = 220

/** 释义清理：去掉义项号角标（Grande₁₋₂ → Grande）、过长的截在句末 */
function cleanMono(s: string): string {
  let t = s
    .replace(/[₀-₉₋]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length > MAX_LEN) {
    const cut = t.lastIndexOf('. ', MAX_LEN)
    t = cut > 60 ? t.slice(0, cut + 1) : t.slice(0, MAX_LEN - 1) + '…'
  }
  return t
}

interface RawEs {
  word: string
  pos: string
  tags?: string[]
  senses?: {
    glosses?: string[]
    tags?: string[]
    sense_index?: string
    form_of?: unknown[]
    alt_of?: unknown[]
  }[]
  sounds?: {
    audio?: string
    mp3_url?: string
    ogg_url?: string
    tags?: string[]
    raw_tags?: string[]
  }[]
  translations?: { word?: string; lang_code?: string; sense_index?: string }[]
}

/** 录音的口音标签：西班牙、拉丁美洲、各国城市（维基词典里写的） */
function audioLabel(tags: string[]): string | undefined {
  const t = tags.filter((x) => !/^(audio|Audio)$/.test(x))
  if (!t.length) return undefined
  return t.map((x) => (x === 'America' ? 'Latin America' : x.replace(/-/g, ' '))).join(', ')
}

export async function readEsWiktionary(
  file: string,
  words: Set<string>,
  t2s: T2S
): Promise<EsData> {
  const entries = new Map<string, EsEntry[]>()
  const audio = new Map<string, EsAudio[]>()
  for await (const line of readLines(file)) {
    if (!line) continue
    // 先粗筛词头，省得每行都解析
    const m = /"word": ?"((?:[^"\\]|\\.)*)"/.exec(line)
    if (!m) continue
    let word: string
    try {
      word = JSON.parse(`"${m[1]}"`)
    } catch {
      continue
    }
    if (!words.has(word)) continue
    const o = JSON.parse(line) as RawEs
    if (o.word !== word) continue
    for (const s of o.sounds ?? []) {
      const url = s.mp3_url ?? s.ogg_url
      if (!s.audio || !url) continue
      let list = audio.get(word)
      if (!list) audio.set(word, (list = []))
      if (!list.some((a) => a.file === s.audio))
        list.push({
          file: s.audio,
          url,
          label: audioLabel([...(s.tags ?? []), ...(s.raw_tags ?? [])])
        })
    }
    const senses = (o.senses ?? []).filter((s) => !s.form_of && !s.alt_of)
    if (!senses.length) continue
    const mono: string[] = []
    for (const s of senses) {
      if ((s.tags ?? []).some((t) => SKIP_TAGS.has(t))) continue
      const g = cleanMono(s.glosses?.at(-1) ?? '')
      if (g && !mono.includes(g)) mono.push(g)
      if (mono.length >= MAX_MONO) break
    }
    const firstIndex = senses.some((s) => s.sense_index === '1')
    const zh: string[] = []
    if (firstIndex || !senses.some((s) => s.sense_index))
      for (const t of o.translations ?? []) {
        if (t.lang_code !== 'zh' && t.lang_code !== 'cmn') continue
        const idx = (t.sense_index ?? '').split(/[,\s]+/).filter(Boolean)
        if (idx.length && !idx.includes('1')) continue
        const w = t.word ? cleanTranslation(t.word, t2s) : null
        if (w && !zh.includes(w)) zh.push(w)
      }
    const tags = new Set(o.tags ?? [])
    const gender =
      tags.has('masculine') && tags.has('feminine')
        ? 'mf'
        : tags.has('masculine')
          ? 'm'
          : tags.has('feminine')
            ? 'f'
            : undefined
    if (!mono.length && !zh.length) continue
    let list = entries.get(word)
    if (!list) entries.set(word, (list = []))
    list.push({ kpos: ES_POS[o.pos] ?? [], gender, mono, zh: zh.slice(0, 4) })
  }
  return { entries, audio }
}
