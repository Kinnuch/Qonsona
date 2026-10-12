/**
 * 中文释义的来源：
 *
 * 1. 中文维基词典的西班牙语词条（kaikki.org 的 zhwiktionary「西班牙语」「西班牙語」两份）。
 *    只用有词性标题的新式条目（多数是人工写的或从英文维基词典译过来的，CC BY-SA）；
 *    2010 年 Wjcdbot 机器人批量导入的一万二千条（释义前带「m. f. adj.」缩写、没有词性标题），
 *    以及同样格式的「vt. vi. vr.」一批（五千九百条）来源不明，像是从某部西汉词典搬来的，不用
 *    （跟日语那边对中文维基词典「日语」批量条目的处理一样）。有词性标题的条目里个别释义仍带这种缩写的，那一条也不要。
 * 2. 西语维基词典（Wikcionario）词条翻译表里的汉语（官话）对译词，只取第一个义项的（或没标义项的）。
 *
 * 繁体用 OpenCC 的 TSPhrases + TSCharacters 转成简体（先按词、再按字，最长匹配）。
 */
import { readFileSync } from 'node:fs'
import { readLines } from './util'

// ───────────────────────── 繁转简 ─────────────────────────

export type T2S = (text: string) => string

/** 读 OpenCC 的两张表，返回转换函数 */
export function loadOpenCC(charsFile: string, phrasesFile: string): T2S {
  const chars = new Map<string, string>()
  const phrases = new Map<string, string>()
  let maxLen = 1
  const load = (file: string, into: Map<string, string>, isPhrase: boolean): void => {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line || line.startsWith('#')) continue
      const [k, v] = line.split('\t')
      if (!k || !v) continue
      const first = v.trim().split(' ')[0]
      into.set(k, first)
      if (isPhrase) maxLen = Math.max(maxLen, [...k].length)
    }
  }
  load(charsFile, chars, false)
  load(phrasesFile, phrases, true)
  return (text: string): string => {
    const cs = [...text]
    let out = ''
    for (let i = 0; i < cs.length;) {
      let done = false
      for (let n = Math.min(maxLen, cs.length - i); n >= 2; n--) {
        const p = phrases.get(cs.slice(i, i + n).join(''))
        if (p) {
          out += p
          i += n
          done = true
          break
        }
      }
      if (done) continue
      out += chars.get(cs[i]) ?? cs[i]
      i++
    }
    return out
  }
}

// ───────────────────────── 中文维基词典 ─────────────────────────

/**
 * 释义开头的语法缩写：m. f. adj. vt. vi. vr. n.pr. v.tr. s.f. …（批量导入那几批的特征；
 * 人写的中文释义不会用拉丁字母的缩写开头）。也查释义里换行后的缩写（「adj. 缆车的\nm. 缆车」）
 */
const ABBR = /(^|\n)\s*(?:\S+\/-?\S*\s*\n)?\s*(?:[a-z]{1,5}\.\s*){1,3}(?=[\s\p{Script=Han}[(（])/u
/** 中文维基词典的词性 → kaikki 英文版的词性（找对应词条用） */
const ZH_POS: Record<string, string[]> = {
  noun: ['noun'],
  name: ['name', 'noun'],
  verb: ['verb'],
  adj: ['adj'],
  adv: ['adv'],
  pron: ['pron'],
  det: ['det', 'article', 'pron'],
  article: ['article', 'det'],
  prep: ['prep', 'contraction', 'prep_phrase'],
  conj: ['conj'],
  intj: ['intj'],
  num: ['num', 'adj', 'noun'],
  phrase: ['phrase', 'prep_phrase', 'adv_phrase', 'proverb', 'noun', 'adv', 'verb', 'intj'],
  proverb: ['proverb', 'phrase'],
  suffix: ['suffix'],
  prefix: ['prefix'],
  contraction: ['contraction', 'prep'],
  particle: ['particle']
}

export interface ZhSense {
  zh: string
  tags: string[]
}

export interface ZhEntry {
  /** 可以对上的英文版词性（按优先顺序）；空的表示不限 */
  kpos: string[]
  gender?: 'm' | 'f'
  senses: ZhSense[]
}

/** 释义里的维基残留、跨语言标题、括号里的提问 */
function cleanZh(s: string): string {
  return s
    .split(/={2,}/)[0]
    .replace(/[(（]\s*可否[驗验][證证]此[條条][釋释]義?[?？]?\s*[)）]/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[。.]+$/, '')
    .trim()
}

/** 有没有汉字（全是拉丁字母的「释义」多半是转引、学名） */
const hasHan = (s: string): boolean => /\p{Script=Han}/u.test(s)

interface RawZh {
  word: string
  pos: string
  pos_title?: string
  tags?: string[]
  senses?: { glosses?: string[]; tags?: string[]; form_of?: unknown[]; alt_of?: unknown[] }[]
}

/** 读两份中文维基词典的抽取：词头 → 条目（同一个词头可以有几个词性） */
export async function readZhWiktionary(files: string[], t2s: T2S): Promise<Map<string, ZhEntry[]>> {
  const out = new Map<string, ZhEntry[]>()
  for (const file of files) {
    for await (const line of readLines(file)) {
      if (!line) continue
      const o = JSON.parse(line) as RawZh
      if (!o.pos_title) continue
      const raw = o.senses ?? []
      if (!raw.length || raw.every((s) => s.form_of || s.alt_of)) continue
      const senses: ZhSense[] = []
      for (const s of raw) {
        if (s.form_of || s.alt_of) continue
        const g = s.glosses?.at(-1) ?? ''
        if (!g || ABBR.test(g)) continue
        // 繁简并存的写法（貓/猫）转成简体后两边一样，留一个
        const zh = [
          ...new Set(
            t2s(cleanZh(g))
              .split('/')
              .map((x) => x.trim())
          )
        ].join('/')
        if (!zh || !hasHan(zh) || zh.length > 120) continue
        senses.push({ zh, tags: s.tags ?? [] })
      }
      if (!senses.length) continue
      const tags = new Set([...(o.tags ?? []), ...raw.flatMap((s) => s.tags ?? [])])
      const gender =
        tags.has('masculine') && !tags.has('feminine')
          ? 'm'
          : tags.has('feminine') && !tags.has('masculine')
            ? 'f'
            : undefined
      const entry: ZhEntry = { kpos: ZH_POS[o.pos] ?? [], gender, senses }
      let list = out.get(o.word)
      if (!list) out.set(o.word, (list = []))
      list.push(entry)
    }
  }
  return out
}

// ───────────────────────── 西语维基词典的翻译表 ─────────────────────────

/** 西语维基词典的词性 → 英文版的词性 */
export const ES_POS: Record<string, string[]> = {
  noun: ['noun'],
  name: ['name'],
  verb: ['verb'],
  adj: ['adj'],
  participle: ['adj', 'verb'],
  adv: ['adv'],
  pron: ['pron'],
  article: ['article', 'det'],
  det: ['det', 'article'],
  prep: ['prep', 'contraction'],
  conj: ['conj'],
  intj: ['intj'],
  num: ['num'],
  phrase: ['phrase', 'prep_phrase', 'adv_phrase', 'noun', 'adv', 'verb'],
  proverb: ['proverb', 'phrase'],
  suffix: ['suffix'],
  prefix: ['prefix'],
  contraction: ['contraction', 'prep'],
  abbrev: ['noun', 'name'],
  unknown: []
}

/** 汉语对译词清理：去掉括号里的拼音、注释，留下汉字 */
export function cleanTranslation(word: string, t2s: T2S): string | null {
  const w = t2s(
    word
      .replace(/[(（][^)）]*[)）]/g, '')
      .replace(/\s+/g, '')
      .trim()
  )
  return w && hasHan(w) && !/[A-Za-z]/.test(w) && w.length <= 16 ? w : null
}
