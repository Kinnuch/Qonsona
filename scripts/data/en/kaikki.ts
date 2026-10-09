/**
 * 英语维基词典（kaikki.org 的 wiktextract 数据，CC BY-SA 4.0；可选）：有 .cache/data/en/kaikki-en.jsonl.gz 时，
 * 给要收的词补英式、美式 IPA，录音文件的地址（维基共享资源），以及「这个词主要是粗俗、冒犯用法」的判断。
 * 原文件 3 GB，读一遍要一两分钟；读出来的摘要按词表存在缓存里，词表不变时直接用。
 */
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'
import { createHash } from 'node:crypto'
import type { AudioRef } from '../../../src/shared/lang/types'
import { wiktionaryIpa } from './ipa'

export interface KaikkiWord {
  uk: string[]
  us: string[]
  audio: AudioRef[]
  /** 主要的意思是粗俗、冒犯的（第一个义项带标记，或者三分之二以上的义项带标记） */
  flagged: boolean
}

const FLAG_TAGS = new Set(['vulgar', 'offensive', 'derogatory', 'slur', 'pejorative'])
const UK_TAGS = new Set(['UK', 'Received-Pronunciation', 'Southern-England', 'England', 'British'])
const US_TAGS = new Set(['US', 'General-American', 'California', 'New-York', 'Inland-North'])
const OTHER_LABELS: Record<string, string> = {
  Australia: 'AU',
  Canada: 'CA',
  Ireland: 'IE',
  'New-Zealand': 'NZ',
  India: 'IN',
  Scotland: 'Scotland'
}

interface Sound {
  tags?: string[]
  ipa?: string
  audio?: string
  ogg_url?: string
  mp3_url?: string
}
interface Line {
  word?: string
  lang_code?: string
  sounds?: Sound[]
  senses?: { tags?: string[] }[]
}

function labelOf(tags: string[] = []): string | undefined {
  if (tags.some((t) => US_TAGS.has(t))) return 'US'
  if (tags.some((t) => UK_TAGS.has(t))) return 'UK'
  for (const t of tags) if (OTHER_LABELS[t]) return OTHER_LABELS[t]
  return undefined
}

/** 读 kaikki 的英语数据，只留 words 里的词（小写） */
export async function loadKaikki(
  file: string,
  words: Set<string>,
  log: (m: string) => void
): Promise<Map<string, KaikkiWord>> {
  const hash = createHash('sha1')
    .update([...words].sort().join('\n'))
    .update(String(statSync(file).size))
    .digest('hex')
    .slice(0, 16)
  const cache = file.replace(/\.jsonl\.gz$/, `.extract-${hash}.json`)
  if (existsSync(cache)) {
    const m = new Map<string, KaikkiWord>(JSON.parse(readFileSync(cache, 'utf8')))
    log(`维基词典（缓存）：${m.size} 个词`)
    return m
  }
  const out = new Map<string, KaikkiWord>()
  const flags = new Map<string, { first: boolean | null; flagged: number; total: number }>()
  const rl = createInterface({
    input: createReadStream(file).pipe(createGunzip()),
    crlfDelay: Infinity
  })
  let n = 0
  for await (const line of rl) {
    n++
    if (n % 200000 === 0) log(`  维基词典：读了 ${n} 行`)
    // 先粗筛：这一行里根本没有要的词就不解析
    let j: Line
    try {
      j = JSON.parse(line) as Line
    } catch {
      continue
    }
    const w = j.word?.toLowerCase()
    if (!w || j.lang_code !== 'en' || !words.has(w)) continue
    const cur = out.get(w) ?? { uk: [], us: [], audio: [], flagged: false }
    for (const s of j.sounds ?? []) {
      const label = labelOf(s.tags)
      if (s.ipa) {
        if (label === 'UK') {
          const ipa = wiktionaryIpa(s.ipa, 'uk')
          if (ipa && !cur.uk.includes(ipa) && cur.uk.length < 2) cur.uk.push(ipa)
        } else if (label === 'US') {
          const ipa = wiktionaryIpa(s.ipa, 'us')
          if (ipa && !cur.us.includes(ipa) && cur.us.length < 2) cur.us.push(ipa)
        }
      }
      const url = s.mp3_url ?? s.ogg_url
      if (url && url.startsWith('https://upload.wikimedia.org/') && cur.audio.length < 6) {
        if (!cur.audio.some((a) => a.url === url))
          cur.audio.push({ url, ...(label ? { label } : {}), credit: 'Wikimedia Commons' })
      }
    }
    const senses = j.senses ?? []
    const f = flags.get(w) ?? { first: null, flagged: 0, total: 0 }
    for (const [i, s] of senses.entries()) {
      const bad = (s.tags ?? []).some((t) => FLAG_TAGS.has(t))
      if (f.first === null && i === 0) f.first = bad
      f.total++
      if (bad) f.flagged++
    }
    flags.set(w, f)
    out.set(w, cur)
  }
  for (const [w, f] of flags) {
    const cur = out.get(w)
    if (cur) cur.flagged = !!f.first || (f.total > 0 && f.flagged / f.total >= 2 / 3)
  }
  // 录音：美式、英式各一个在前，最多三个
  for (const cur of out.values()) {
    const pick: AudioRef[] = []
    for (const label of ['US', 'UK', undefined]) {
      const a = cur.audio.find((x) => (label ? x.label === label : !pick.includes(x)))
      if (a && !pick.includes(a)) pick.push(a)
    }
    cur.audio = pick.slice(0, 3)
  }
  writeFileSync(cache, JSON.stringify([...out]))
  log(`维基词典：${n} 行，取到 ${out.size} 个词`)
  return out
}
