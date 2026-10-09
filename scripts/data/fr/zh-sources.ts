/**
 * 中文释义的几份来源（都是开放许可），整理成「法语词 → 中文候选」：
 * - 中文维基词典的法语词条（人写的中文释义，简体、繁体两个分类；繁体逐字转成简体）；
 * - CFDICT 汉法词典反查（法语释义整条等于这个词的，那个中文词就是候选）；
 * - CC-CEDICT 汉英词典：中文词的英文意思，拿来把中文候选对到英文维基词典的义项上（三角对照），
 *   繁简两栏逐字对齐得到繁转简的字表；
 * - 结巴分词的词频（MIT）：候选多时常用的在前（不进库）。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import type { PosTag } from '../../../src/shared/lang/types'
import { frKey } from '../../../src/shared/lang/fr/rules'
import { CACHE } from './fetch'
import { DOWNLOADS } from './sources'
import { cached, log, readJsonl } from './io'
import { mapPos } from './wikt-en'

// ───────────────────────── CC-CEDICT 与繁转简 ─────────────────────────

export interface Cedict {
  /** 简体词 → 英文意思（几条） */
  en: Record<string, string[]>
  /** 繁体字 → 简体字（只收不同的） */
  t2s: Record<string, string>
}

export async function loadCedict(): Promise<Cedict> {
  const file = join(CACHE, DOWNLOADS.cedict.file)
  return cached('cedict', 1, [file], async () => {
    const text = gunzipSync(readFileSync(file)).toString('utf8')
    const en: Record<string, string[]> = {}
    const votes = new Map<string, Map<string, number>>()
    for (const line of text.split('\n')) {
      if (!line || line.startsWith('#')) continue
      const m = /^(\S+) (\S+) \[[^\]]*\] \/(.*)\/\s*$/.exec(line)
      if (!m) continue
      const [, trad, simp, defs] = m
      const list = defs
        .split('/')
        .filter((d) => d && !/^(CL:|variant of|old variant|see |surname |used in )/i.test(d))
      if (list.length) (en[simp] ??= []).push(...list)
      const t = [...trad]
      const s = [...simp]
      if (t.length === s.length)
        for (let i = 0; i < t.length; i++) {
          if (t[i] === s[i]) continue
          const v = votes.get(t[i]) ?? new Map<string, number>()
          v.set(s[i], (v.get(s[i]) ?? 0) + 1)
          votes.set(t[i], v)
        }
    }
    const t2s: Record<string, string> = {}
    for (const [t, v] of votes) t2s[t] = [...v].sort((a, b) => b[1] - a[1])[0][0]
    log(`CC-CEDICT：${Object.keys(en).length} 个词，繁转简 ${Object.keys(t2s).length} 字`)
    return { en, t2s }
  })
}

/** 繁体逐字转简体（词典里常见的写法够用；个别一对多的字按多数） */
export function toSimplified(text: string, t2s: Record<string, string>): string {
  let out = ''
  for (const ch of text) out += t2s[ch] ?? ch
  return out
}

// ───────────────────────── 结巴词频 ─────────────────────────

export async function loadJieba(): Promise<Record<string, number>> {
  const file = join(CACHE, DOWNLOADS.jieba.file)
  return cached('jieba', 1, [file], async () => {
    const out: Record<string, number> = {}
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const [w, f] = line.split(' ')
      if (w && f) out[w] = Number(f)
    }
    return out
  })
}

// ───────────────────────── CFDICT 反查 ─────────────────────────

export interface CfHit {
  /** 简体中文词 */
  zh: string
  /** 这个法语词是那条的第几个释义（0 起） */
  i: number
  /** 那条一共几个释义 */
  n: number
  /** 单字的条目（字义宽泛，权重低一些） */
  one?: 1
}

/**
 * 法语释义整条（去掉括号里的补充）→ 中文词。只认整条相等的：「manger」对上 吃，
 * 「prendre qch (par voie orale)」这种说明不当成词。单字的条目（猫、书）标出来，排序时权重低一些。
 */
export async function loadCfdict(): Promise<Record<string, CfHit[]>> {
  const file = join(CACHE, DOWNLOADS.cfdict.file)
  return cached('cfdict', 2, [file], async () => {
    const out: Record<string, CfHit[]> = {}
    let n = 0
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line || line.startsWith('#')) continue
      const m = /^(\S+) (\S+) \[[^\]]*\] \/(.*)\/\s*$/.exec(line)
      if (!m) continue
      const simp = m[2]
      if (!/^\p{Script=Han}+$/u.test(simp)) continue
      const one = [...simp].length === 1
      const defs = m[3].split('/').filter(Boolean)
      defs.forEach((d, i) => {
        const clean = d
          .replace(/\([^)]*\)/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (!clean || clean.length > 40 || /[;:=]/.test(clean)) return
        const k = frKey(clean)
        ;(out[k] ??= []).push({ zh: simp, i, n: defs.length, ...(one ? { one: 1 as const } : {}) })
      })
      n++
    }
    log(`CFDICT：${n} 条，反查出 ${Object.keys(out).length} 个法语写法`)
    return out
  })
}

// ───────────────────────── 中文维基词典的法语词条 ─────────────────────────

export interface ZhWiktEntry {
  k: string
  w: string
  /** 词性；中文维基词典有些法语词条没写词性（unknown），这时为 null，按词头对 */
  p: PosTag | null
  /** 每个义项的中文释义（已转简体） */
  s: string[]
}

/** 释义里的词性标注、领域括号（n.f.、【金融】、［作助动词］）去掉，只留中文意思 */
function cleanZh(g: string): string {
  return g
    .replace(/^\s*(?:n\.\s*[mf]\.?|v\.\s*[ti]\.?|adj\.|adv\.|prép\.|loc\.)\s*/i, '')
    .replace(/^\*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 从汉法词典导进来的条目把几个词性的意思写在一行里：「num.card. 百；第一百n.m. 百；百来个n.m. 分」。
 * 按这些词性标记切开，各段归到对应的词性（没有标记的整行原样返回，词性 undefined）
 */
const MARKS: [RegExp, PosTag][] = [
  [/^n\.\s*[mf]\.?(?:\s*pl\.)?/i, 'noun'],
  [/^n\./i, 'noun'],
  [/^num\.\s*(?:card|ord)\.?/i, 'num'],
  [/^adj\./i, 'adj'],
  [/^adv\./i, 'adv'],
  [/^v\.\s*(?:t|i|pr|tr|intr)\.?(?:\s*ind\.)?/i, 'verb'],
  [/^v\./i, 'verb'],
  [/^prép\./i, 'adp'],
  [/^pron\./i, 'pron'],
  [/^conj\./i, 'sconj'],
  [/^interj\./i, 'intj'],
  [/^art\./i, 'det']
]
const MARK_AT =
  /(?:n\.\s*[mf]\.?(?:\s*pl\.)?|num\.\s*(?:card|ord)\.?|adj\.|adv\.|v\.\s*(?:t|i|pr|tr|intr)\.(?:\s*ind\.)?|prép\.|pron\.|conj\.|interj\.|art\.)/gi

function splitByPos(text: string): { p?: PosTag; text: string }[] {
  const starts: number[] = []
  for (const m of text.matchAll(MARK_AT)) if (m.index !== undefined) starts.push(m.index)
  if (!starts.length) return [{ text }]
  const out: { p?: PosTag; text: string }[] = []
  if (starts[0] > 0 && text.slice(0, starts[0]).trim()) out.push({ text: text.slice(0, starts[0]) })
  starts.forEach((at, i) => {
    const seg = text.slice(at, starts[i + 1] ?? text.length)
    const hit = MARKS.find(([re]) => re.test(seg))
    out.push({ p: hit?.[1], text: hit ? seg.replace(hit[0], '') : seg })
  })
  return out
}

export async function loadZhWikt(t2s: Record<string, string>): Promise<ZhWiktEntry[]> {
  const files = [DOWNLOADS.zhwiktHans.file, DOWNLOADS.zhwiktHant.file].map((f) => join(CACHE, f))
  return cached('zhwikt', 3, files, async () => {
    const byKey = new Map<string, ZhWiktEntry>()
    const add = (k: string, w: string, p: PosTag | null, s: string[]): void => {
      if (!s.length) return
      const key = `${k}|${p ?? ''}`
      const cur = byKey.get(key)
      if (cur) {
        for (const x of s) if (!cur.s.includes(x)) cur.s.push(x)
      } else byKey.set(key, { k, w, p, s })
    }
    for (const file of files) {
      for await (const o of readJsonl<{
        word: string
        pos: string
        senses?: { glosses?: string[]; tags?: string[]; form_of?: unknown[] }[]
      }>(file)) {
        if (!o.word) continue
        const senses = (o.senses ?? []).filter(
          (s) => s.glosses?.length && !s.form_of?.length && !s.tags?.includes('form-of')
        )
        if (!senses.length) continue
        const p = o.pos === 'unknown' ? null : mapPos(o.pos, o.word)
        if (o.pos !== 'unknown' && !p) continue
        const k = frKey(o.word)
        for (const x of senses) {
          const text = toSimplified(x.glosses!.join('：'), t2s)
          for (const seg of splitByPos(text)) {
            const g = cleanZh(seg.text)
            if (!/\p{Script=Han}/u.test(g) || g.length > 60) continue
            // 段上标着词性的按标记归；词条本身写了词性、跟标记不一样的，以标记为准
            add(k, o.word, seg.p ?? p, [g])
          }
        }
      }
    }
    log(`中文维基词典：${byKey.size} 个法语词条有中文释义`)
    return [...byKey.values()]
  })
}
