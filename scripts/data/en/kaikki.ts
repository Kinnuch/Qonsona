/**
 * 英语维基词典（kaikki.org 的 wiktextract 数据，CC BY-SA 4.0；可选）：有 .cache/data/en/kaikki-en.jsonl.gz 时，
 * 给要收的词补英式、美式 IPA，录音文件的地址（维基共享资源），没有英文释义的义项补维基词典的英文释义，
 * 以及「这个词主要是粗俗、冒犯用法」的判断。
 * 原文件 3 GB，读一遍要二三十秒；读出来的摘要按词表存在缓存里，词表不变时直接用。
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
  /** 维基词典的词性（noun、verb、adj、prep、phrase……）→ 前几条英文释义 */
  glosses: Record<string, string[]>
  /** 主要的意思是粗俗、冒犯的（第一个义项带标记，或者三分之二以上的义项带标记） */
  flagged: boolean
}

/** 摘要的格式改了就改这个，旧缓存作废 */
const EXTRACT_VERSION = 'v2'
const FLAG_TAGS = new Set(['vulgar', 'offensive', 'derogatory', 'slur', 'pejorative'])
/** 这些义项不拿来当释义：只说是谁的变形、古旧、拼错的…… */
const SKIP_TAGS = new Set([
  ...FLAG_TAGS,
  'form-of',
  'alt-of',
  'obsolete',
  'archaic',
  'misspelling',
  'nonstandard',
  'rare',
  'dialectal',
  'sexual'
])
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
  pos?: string
  lang_code?: string
  sounds?: Sound[]
  senses?: { tags?: string[]; glosses?: string[] }[]
}

function labelOf(tags: string[] = []): string | undefined {
  if (tags.some((t) => US_TAGS.has(t))) return 'US'
  if (tags.some((t) => UK_TAGS.has(t))) return 'UK'
  for (const t of tags) if (OTHER_LABELS[t]) return OTHER_LABELS[t]
  return undefined
}

/** 一条释义：去掉多余的空白，太长的在词边上截断 */
function tidyGloss(g: string): string {
  const s = g.replace(/\s+/g, ' ').trim()
  if (s.length <= 160) return s
  return s.slice(0, 160).replace(/\s+\S*$/, '') + '…'
}

/** 读 kaikki 的英语数据，只留 words 里的词（小写） */
export async function loadKaikki(
  file: string,
  words: Set<string>,
  log: (m: string) => void
): Promise<Map<string, KaikkiWord>> {
  const hash = createHash('sha1')
    .update(EXTRACT_VERSION)
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
    let j: Line
    try {
      j = JSON.parse(line) as Line
    } catch {
      continue
    }
    const w = j.word?.toLowerCase()
    if (!w || j.lang_code !== 'en' || !words.has(w)) continue
    const cur = out.get(w) ?? { uk: [], us: [], audio: [], glosses: {}, flagged: false }
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
      const tags = s.tags ?? []
      const bad = tags.some((t) => FLAG_TAGS.has(t))
      if (f.first === null && i === 0) f.first = bad
      f.total++
      if (bad) f.flagged++
      // 英文释义：每个词性最多三条，跳过只说变形、古旧、粗俗的义项
      const g = s.glosses?.[s.glosses.length - 1]
      if (!g || !j.pos || tags.some((t) => SKIP_TAGS.has(t))) continue
      if (
        /^(plural|past|present|third-person|alternative|obsolete|archaic|misspelling)\b.*\bof\b/i.test(
          g
        )
      )
        continue
      const list = (cur.glosses[j.pos] ??= [])
      const text = tidyGloss(g)
      if (list.length < 3 && !list.includes(text)) list.push(text)
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

/** 我们的词性 → 维基词典的词性（按先后找） */
export const WIKT_POS: Record<string, string[]> = {
  noun: ['noun'],
  propn: ['name', 'noun'],
  verb: ['verb'],
  aux: ['verb'],
  adj: ['adj'],
  adv: ['adv'],
  adp: ['prep', 'prep_phrase'],
  cconj: ['conj'],
  sconj: ['conj'],
  pron: ['pron'],
  det: ['det', 'article'],
  num: ['num'],
  part: ['particle', 'adv'],
  intj: ['intj'],
  phrase: ['verb', 'phrase', 'prep_phrase', 'adv', 'adj', 'noun', 'intj'],
  idiom: ['phrase', 'verb', 'prep_phrase', 'adv', 'adj', 'noun'],
  proverb: ['proverb', 'phrase'],
  abbr: ['abbrev', 'noun', 'adj'],
  affix: ['prefix', 'suffix'],
  other: ['noun', 'verb', 'adj', 'adv', 'phrase']
}
