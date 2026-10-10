/**
 * ECDICT（ecdict.csv）的读取与解析：CSV、变形字段（exchange）、中文释义的行、英文释义（WordNet）。
 * 都是纯函数，tests/lang/en/ 里直接测。
 */
import type { PosTag } from '../../../src/shared/lang/types'

export interface EcdictRow {
  word: string
  phonetic: string
  definition: string
  translation: string
  collins: number
  oxford: boolean
  tags: string[]
  bnc: number
  frq: number
  exchange: string
}

/** RFC 4180 的 CSV：引号里可以有逗号、换行，两个引号是一个引号 */
export function* parseCsv(text: string): Generator<string[]> {
  const n = text.length
  let i = 0
  while (i < n) {
    const row: string[] = []
    for (;;) {
      let field = ''
      if (text[i] === '"') {
        i++
        for (;;) {
          const j = text.indexOf('"', i)
          if (j < 0) {
            field += text.slice(i)
            i = n
            break
          }
          field += text.slice(i, j)
          if (text[j + 1] === '"') {
            field += '"'
            i = j + 2
          } else {
            i = j + 1
            break
          }
        }
      } else {
        let j = i
        while (j < n && text[j] !== ',' && text[j] !== '\n' && text[j] !== '\r') j++
        field = text.slice(i, j)
        i = j
      }
      row.push(field)
      if (text[i] === ',') {
        i++
        continue
      }
      if (text[i] === '\r') i++
      if (text[i] === '\n') i++
      break
    }
    yield row
  }
}

/** 读 ecdict.csv 的全部行 */
export function readEcdict(text: string): EcdictRow[] {
  const it = parseCsv(text)
  const head = it.next().value as string[]
  const col = (name: string): number => head.indexOf(name)
  const c = {
    word: col('word'),
    phonetic: col('phonetic'),
    definition: col('definition'),
    translation: col('translation'),
    collins: col('collins'),
    oxford: col('oxford'),
    tag: col('tag'),
    bnc: col('bnc'),
    frq: col('frq'),
    exchange: col('exchange')
  }
  const out: EcdictRow[] = []
  for (const r of it) {
    const word = (r[c.word] ?? '').trim()
    if (!word || r.length < 4) continue
    out.push({
      word,
      phonetic: r[c.phonetic] ?? '',
      definition: r[c.definition] ?? '',
      translation: r[c.translation] ?? '',
      collins: Number(r[c.collins]) || 0,
      oxford: r[c.oxford] === '1',
      tags: (r[c.tag] ?? '').split(/\s+/).filter(Boolean),
      bnc: Number(r[c.bnc]) || 0,
      frq: Number(r[c.frq]) || 0,
      exchange: r[c.exchange] ?? ''
    })
  }
  return out
}

/** 词频名次：BNC 与当代语料库取较小（较常用）的那个；都没有时 0 */
export function rankOf(r: Pick<EcdictRow, 'bnc' | 'frq'>): number {
  const a = r.bnc > 0 ? r.bnc : Infinity
  const b = r.frq > 0 ? r.frq : Infinity
  const m = Math.min(a, b)
  return Number.isFinite(m) ? m : 0
}

// ───────────────────────── 变形（exchange） ─────────────────────────

/** exchange 的类型字母 → Wiktextract 标签 */
export const EXCHANGE_TAGS: Record<string, string[]> = {
  p: ['past'],
  d: ['past', 'participle'],
  i: ['present', 'participle'],
  '3': ['third-person', 'singular', 'present'],
  r: ['comparative'],
  t: ['superlative'],
  s: ['plural']
}

export interface Exchange {
  /** 这个词的变形：[形式, 类型字母] */
  forms: [string, string][]
  /** 这一行本身是变形时：原形（0:）与类型（1:，可以几个字母，如 dp） */
  lemma?: string
  types?: string
}

/** d:perceived/p:perceived/3:perceives/i:perceiving → 变形；0:go/1:p → 这是 go 的过去式 */
export function parseExchange(s: string): Exchange {
  const out: Exchange = { forms: [] }
  for (const part of s.split('/')) {
    const i = part.indexOf(':')
    if (i < 1) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (!v) continue
    if (k === '0') out.lemma = v
    else if (k === '1') out.types = v
    else if (EXCHANGE_TAGS[k]) out.forms.push([v, k])
  }
  return out
}

/** 类型字母串（dp、3s）→ 几组标签 */
export function typeTags(types: string): string[][] {
  return [...types].map((t) => EXCHANGE_TAGS[t]).filter((t): t is string[] => !!t)
}

// ───────────────────────── 中文释义 ─────────────────────────

/** 行首的词性缩写 → UPOS */
const POS_ABBR: Record<string, PosTag> = {
  n: 'noun',
  pl: 'noun',
  v: 'verb',
  vt: 'verb',
  vi: 'verb',
  vbl: 'verb',
  a: 'adj',
  adj: 'adj',
  ad: 'adv',
  adv: 'adv',
  prep: 'adp',
  conj: 'cconj',
  pron: 'pron',
  int: 'intj',
  interj: 'intj',
  num: 'num',
  art: 'det',
  det: 'det',
  aux: 'aux',
  abbr: 'abbr',
  pref: 'affix',
  suf: 'affix',
  na: 'noun'
}

/** 从属连词：ECDICT 都写 conj.，这几个改成 sconj */
export const SUBORDINATORS = new Set(
  'after although as because before if lest once since than that though till unless until when whenever where whereas wherever whether while whilst'.split(
    ' '
  )
)

/** [医] [计] 这类领域标记 → 领域词 */
const DOMAINS: Record<string, string> = {
  医: 'medicine',
  化: 'chemistry',
  有化: 'chemistry',
  生化: 'biochemistry',
  计: 'computing',
  经: 'economics',
  法: 'law',
  电: 'electricity',
  机: 'mechanics',
  建: 'architecture',
  体: 'sports',
  动: 'zoology',
  动物: 'zoology',
  植: 'botany',
  植物: 'botany',
  矿: 'mining',
  地质: 'geology',
  地: 'geography',
  天: 'astronomy',
  数: 'mathematics',
  物: 'physics',
  核: 'physics',
  生: 'biology',
  生态: 'ecology',
  药: 'pharmacology',
  解: 'anatomy',
  心理: 'psychology',
  商: 'business',
  财: 'finance',
  冶: 'metallurgy',
  气: 'meteorology',
  军: 'military',
  船: 'nautical',
  海: 'nautical',
  航: 'aviation',
  农: 'agriculture',
  林: 'forestry',
  宗: 'religion',
  哲: 'philosophy',
  语: 'linguistics',
  音: 'music',
  乐: 'music',
  电影: 'film',
  鸟类: 'ornithology',
  昆虫: 'entomology',
  纺: 'textiles',
  印: 'printing',
  摄: 'photography',
  无: 'radio',
  食: 'food',
  烹: 'cooking',
  交: 'transport',
  测: 'surveying',
  环: 'environment',
  统: 'statistics',
  逻: 'logic',
  美术: 'art',
  史: 'history',
  政: 'politics',
  社: 'sociology',
  牌: 'card-games',
  棋: 'board-games'
}

/** 语体、地区标记（行首的 [美] 或词里的 <口>）→ Wiktextract 标签 */
const LABELS: Record<string, string> = {
  美: 'US',
  美国英语: 'US',
  英: 'UK',
  英国英语: 'UK',
  口: 'colloquial',
  俗: 'colloquial',
  俚: 'slang',
  美俚: 'slang',
  英俚: 'slang',
  古: 'archaic',
  废: 'obsolete',
  罕: 'rare',
  诗: 'poetic',
  方: 'dialectal',
  正式: 'formal',
  非正式: 'informal',
  谑: 'humorous',
  婉: 'euphemistic',
  讳: 'euphemistic',
  书: 'literary',
  儿: 'childish'
}

/** 带这些标记的释义不收（粗俗、冒犯、侮辱、贬损） */
const FLAG_LABELS = new Set(['粗', '忌', '贬', '卑'])
const FLAG_ZH = /粗话|粗俗|粗鄙|下流|猥亵|侮辱|蔑称|贬义|骂人|脏话/
/** 英文释义里的同类标记 */
const FLAG_EN =
  /\b(?:obscene|vulgar)\b|\bethnic slur\b|\b(?:disparaging|derogatory|offensive|contemptuous) (?:term|name|word|slang|way)\b|\((?:offensive|disparaging|derogatory|vulgar|obscene|slang)\)/i

export const isFlaggedZh = (s: string): boolean =>
  FLAG_ZH.test(s) || [...s.matchAll(/<([^<>]{1,4})>/g)].some((m) => FLAG_LABELS.has(m[1]))
export const isFlaggedEn = (s: string): boolean => FLAG_EN.test(s)

/** 「go的过去式」「(big的比较级)」「lesson的名词复数」这类变形说明 */
const NOTE =
  /[（(]?\s*([A-Za-z][A-Za-z'-]*)\s*的\s*(?:名词|动词|形容词|副词)?\s*(过去式和过去分词|过去式及过去分词|过去分词和过去式|过去式|过去分词|现在分词|第三人称单数现在式|第三人称单数形式|第三人称单数|现在式第三人称单数|现在式第三人称|现在时复数或第二人称单数|复数形式|复数|比较级|最高级)\s*(?:形式)?\s*[)）]?/g
const NOTE_TAGS: Record<string, string[][]> = {
  过去式和过去分词: [['past'], ['past', 'participle']],
  过去式及过去分词: [['past'], ['past', 'participle']],
  过去分词和过去式: [['past'], ['past', 'participle']],
  过去式: [['past']],
  过去分词: [['past', 'participle']],
  现在分词: [['present', 'participle']],
  第三人称单数现在式: [['third-person', 'singular', 'present']],
  第三人称单数形式: [['third-person', 'singular', 'present']],
  第三人称单数: [['third-person', 'singular', 'present']],
  现在式第三人称单数: [['third-person', 'singular', 'present']],
  现在式第三人称: [['third-person', 'singular', 'present']],
  现在时复数或第二人称单数: [
    ['present', 'plural'],
    ['second-person', 'singular', 'present']
  ],
  复数形式: [['plural']],
  复数: [['plural']],
  比较级: [['comparative']],
  最高级: [['superlative']]
}

export interface TransLine {
  /** 行首的词性（vt. & vi. 是一个 verb） */
  pos: PosTag[]
  /** 领域（[医] → medicine）；不认得的领域标记原样 */
  domain?: string
  /** [网络] 释义 */
  web: boolean
  /** [人名] [地名] 一类 */
  name: boolean
  /** 语体、地区标签 */
  labels: string[]
  /** 一条条中文释义（已去掉变形说明、粗俗冒犯的条目） */
  items: string[]
  /** 这一行里的变形说明：[原形, 标签] */
  notes: { lemma: string; tags: string[] }[]
  /** 有条目因为粗俗、冒犯被去掉了 */
  flagged: boolean
  /** 整行都是粗俗、冒犯的 */
  allFlagged: boolean
}

/** 按顶层的逗号、分号拆开（括号里的不拆） */
export function splitItems(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if ('(（[【<〈'.includes(ch)) depth++
    else if (')）]】>〉'.includes(ch)) depth = Math.max(0, depth - 1)
    if (depth === 0 && ',，;；'.includes(ch)) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((x) => x.trim()).filter(Boolean)
}

const POS_HEAD =
  /^\s*((?:(?:n|pl|v|vt|vi|vbl|a|adj|ad|adv|prep|conj|pron|int|interj|num|art|det|aux|abbr|pref|suf|na)\.\s*(?:&|和|,)?\s*)+)/

/** 解析 translation 字段的一行 */
export function parseTransLine(raw: string): TransLine | null {
  let line = raw.trim()
  if (!line) return null
  const out: TransLine = {
    pos: [],
    web: false,
    name: false,
    labels: [],
    items: [],
    notes: [],
    flagged: false,
    allFlagged: false
  }
  // 行首的 [标记]、<标记>、词性，顺序不定，反复剥
  for (let guard = 0; guard < 6; guard++) {
    let m = line.match(/^\s*\[([^\]]*)\]\s*/)
    if (m) {
      const label = m[1].trim().replace(/\.$/, '')
      line = line.slice(m[0].length)
      if (label === '网络') out.web = true
      else if (/人名|地名|男子名|女子名|姓氏|姓|名/.test(label) && label.length <= 4)
        out.name = true
      else if (LABELS[label]) out.labels.push(LABELS[label])
      else if (/^(复|pl\.?\s*|单复同|用作单|用作复|用作单或复|总称)$/.test(label)) {
        /* 单复数说明：不当领域 */
      } else if (DOMAINS[label]) out.domain = DOMAINS[label]
      else if (label) out.domain = label
      continue
    }
    m = line.match(/^\s*<([^<>]{1,6})>\s*/)
    if (m) {
      const label = m[1].trim()
      line = line.slice(m[0].length)
      if (FLAG_LABELS.has(label)) out.allFlagged = true
      else if (LABELS[label]) out.labels.push(LABELS[label])
      continue
    }
    m = line.match(POS_HEAD)
    if (m && m[1].trim()) {
      for (const p of m[1].matchAll(/([a-z]+)\./g)) {
        const pos = POS_ABBR[p[1]]
        if (pos && !out.pos.includes(pos)) out.pos.push(pos)
      }
      line = line.slice(m[0].length)
      continue
    }
    break
  }
  // 变形说明
  line = line.replace(NOTE, (_all, lemma: string, kind: string) => {
    for (const tags of NOTE_TAGS[kind] ?? []) out.notes.push({ lemma, tags })
    return ' '
  })
  if (FLAG_ZH.test(line) && !/[，,;；]/.test(line)) out.allFlagged = true
  for (let item of splitItems(line)) {
    // 条目里的 <口> 之类
    item = item.replace(/<([^<>]{1,6})>/g, (all, label: string) => {
      if (FLAG_LABELS.has(label)) {
        out.flagged = true
        return all
      }
      if (LABELS[label]) {
        if (!out.labels.includes(LABELS[label])) out.labels.push(LABELS[label])
        return ''
      }
      return all
    })
    item = item.replace(/^[\s.。:：…]+|[\s.。…]+$/g, '').trim()
    if (!item || /^[.…]+$/.test(item)) continue
    if (isFlaggedZh(item)) {
      out.flagged = true
      continue
    }
    if (!out.items.includes(item)) out.items.push(item)
  }
  if (out.allFlagged) {
    out.flagged = true
    out.items = []
  }
  return out
}

/** translation 字段：ECDICT 里换行写成两个字符的 \n */
export function parseTranslation(text: string): TransLine[] {
  return text
    .split(/\\n|\n/)
    .map(parseTransLine)
    .filter((l): l is TransLine => !!l)
}

// ───────────────────────── 英文释义 ─────────────────────────

const DEF_POS: Record<string, PosTag> = {
  n: 'noun',
  v: 'verb',
  vt: 'verb',
  vi: 'verb',
  a: 'adj',
  s: 'adj',
  adj: 'adj',
  r: 'adv',
  adv: 'adv',
  prep: 'adp',
  pron: 'pron',
  conj: 'cconj',
  interj: 'intj',
  int: 'intj',
  num: 'num'
}

export interface DefLine {
  pos: PosTag | null
  gloss: string
  flagged: boolean
}

/** definition 字段：一行一条（WordNet：n. / v. / a. / s. / r.；少数是 1913 年韦氏词典，续行以空格开头） */
export function parseDefinitions(text: string): DefLine[] {
  const out: DefLine[] = []
  for (const raw of text.split(/\\n|\n/)) {
    if (!raw.trim()) continue
    const m = raw.match(/^\s*([a-z]{1,6})\.?\s+(.+)$/)
    const pos = m ? DEF_POS[m[1]] : undefined
    if (pos && m) {
      const gloss = m[2].trim()
      // plural of X、past of X 这类只说变形的不收
      if (
        /^(plural|past|present|third|comparative|superlative|imp\.|p\. p\.)\b.*\bof\b/i.test(gloss)
      )
        continue
      out.push({ pos, gloss, flagged: isFlaggedEn(gloss) })
    } else if (out.length && /^\s/.test(raw)) {
      const last = out[out.length - 1]
      last.gloss = `${last.gloss} ${raw.trim()}`
      last.flagged ||= isFlaggedEn(last.gloss)
    } else if (!/\bof\b/.test(raw) || raw.trim().split(/\s+/).length > 4) {
      out.push({ pos: null, gloss: raw.trim(), flagged: isFlaggedEn(raw) })
    }
  }
  return out
}
