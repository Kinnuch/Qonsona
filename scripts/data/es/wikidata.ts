/**
 * Wikidata 词位（Lexeme，CC0）：西班牙语词位的义项连到概念条目（P5137「这个义项对应的条目」），
 * 条目有中文名字——这就是一份开放许可的西中对照。五千来个义项，名词居多，专名（地名、国名）也有。
 *
 * 链接有错的（placer「快乐」连到了「漂砂矿床」、candela「蜡烛」连到了单位「坎德拉」），也有中文名字不像释义的
 * （millón →「1000000」），所以只在条目的英文名字或别名对得上英文维基词典这个词的某个义项时才用，
 * 而且挂到对上的那个义项上；中文名字里没有汉字的不要。繁体用 OpenCC 转简体。
 *
 * 查询走 query.wikidata.org 的 SPARQL，分两步（一起查会超过 Wikidata 查询的 60 秒限制）：
 * 西语词位的义项 → 条目（缓存 wikidata-lexemes.json）；条目的中文名字、英文名字与别名，四百个一批
 * （缓存 wikidata-items.json）。删掉缓存就重新取。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import type { T2S } from './zh'

const ENDPOINT = 'https://query.wikidata.org/sparql'
const UA = 'Qonsona data pipeline (https://github.com/Kinnuch/Qonsona; language-learning app)'

/** Wikidata 的词汇类别 → kaikki 英文版的词性 */
const CATEGORY: Record<string, string[]> = {
  Q1084: ['noun'],
  Q29888377: ['noun', 'phrase'],
  Q147276: ['name'],
  Q34698: ['adj'],
  Q24905: ['verb'],
  Q380057: ['adv'],
  Q5978303: ['adv', 'phrase', 'prep_phrase'],
  Q102786: ['noun', 'name'],
  Q134830: ['prefix'],
  Q36224: ['pron'],
  Q1989081: ['pron'],
  Q468801: ['pron'],
  Q184511: ['phrase', 'proverb'],
  Q83034: ['intj'],
  Q36484: ['conj']
}

type Binding = Record<string, { value: string; 'xml:lang'?: string }>

async function sparql(query: string): Promise<Binding[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ query })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return ((await res.json()) as { results: { bindings: Binding[] } }).results.bindings
    } catch (e) {
      if (attempt >= 6) throw e
      process.stdout.write(`（Wikidata：${String(e).slice(0, 50)}，重试）`)
      await sleep(attempt * 10000)
    }
  }
}

/** 西语词位的义项 → 条目（先从 P5137 的三元组出发，再筛西班牙语，查得快） */
const SENSES_QUERY = `SELECT ?lemma ?cat ?sense ?item WHERE {
  ?sense wdt:P5137 ?item .
  ?l ontolex:sense ?sense .
  ?l dct:language wd:Q1321 .
  ?l wikibase:lemma ?lemma .
  ?l wikibase:lexicalCategory ?cat .
}`

const itemsQuery = (batch: string[]): string => `SELECT ?item ?label ?alias WHERE {
  VALUES ?item { ${batch.map((q) => `wd:${q}`).join(' ')} }
  { ?item rdfs:label ?label . FILTER(LANG(?label) IN ("en", "zh", "zh-hans", "zh-cn")) }
  UNION { ?item skos:altLabel ?alias . FILTER(LANG(?alias) = "en") }
}`

export interface WdSense {
  /** 可以对上的英文版词性 */
  kpos: string[]
  /** 条目的中文名字（简体） */
  zh: string
  /** 条目的英文名字与别名（小写） */
  en: string[]
}

interface ItemNames {
  zh?: string
  en: string[]
}

const qid = (uri: string): string => uri.split('/').pop()!

/** 取（或读缓存）词位义项与条目的名字；返回 词头 → 义项 */
export async function readWikidata(
  sensesFile: string,
  itemsFile: string,
  t2s: T2S
): Promise<Map<string, WdSense[]>> {
  if (!existsSync(sensesFile)) writeFileSync(sensesFile, JSON.stringify(await sparql(SENSES_QUERY)))
  const rows = JSON.parse(readFileSync(sensesFile, 'utf8')) as Binding[]
  const items = [...new Set(rows.map((r) => qid(r.item.value)))]
  const names: Record<string, ItemNames> = existsSync(itemsFile)
    ? JSON.parse(readFileSync(itemsFile, 'utf8'))
    : {}
  const missing = items.filter((q) => !names[q])
  for (let i = 0; i < missing.length; i += 400) {
    const batch = missing.slice(i, i + 400)
    const zh: Record<string, Record<string, string>> = {}
    for (const q of batch) names[q] = { en: [] }
    for (const b of await sparql(itemsQuery(batch))) {
      const q = qid(b.item.value)
      const v = b.label ?? b.alias
      if (!v) continue
      const lang = v['xml:lang'] ?? 'en'
      if (lang === 'en') {
        const t = v.value.toLowerCase()
        if (!names[q].en.includes(t)) names[q].en.push(t)
      } else (zh[q] ??= {})[lang] = v.value
    }
    for (const [q, m] of Object.entries(zh)) names[q].zh = m['zh-hans'] ?? m['zh-cn'] ?? m.zh
    process.stdout.write('.')
    // 中途断了也留下已经取到的
    writeFileSync(itemsFile, JSON.stringify(names))
    await sleep(1500)
  }
  const out = new Map<string, WdSense[]>()
  const seen = new Set<string>()
  // 按词位、义项编号排（L123-S1 在 L123-S2 前面）：一个英文义项只用排在前面的那个
  const senseNo = (r: Binding): [number, number] => {
    const m = /L(\d+)-S(\d+)$/.exec(r.sense.value)
    return m ? [Number(m[1]), Number(m[2])] : [0, 0]
  }
  rows.sort((a, b) => {
    const [la, sa] = senseNo(a)
    const [lb, sb] = senseNo(b)
    return la - lb || sa - sb
  })
  for (const r of rows) {
    const lemma = r.lemma.value.normalize('NFC')
    if (!/^[\p{Script=Latin}\s'-]+$/u.test(lemma)) continue
    const n = names[qid(r.item.value)]
    if (!n?.zh) continue
    const zh = t2s(n.zh.trim())
    // 没有汉字的（1000000、Β）、太长像说明句的不要
    if (!/\p{Script=Han}/u.test(zh) || zh.length > 16 || /[，。、；]/.test(zh)) continue
    const k = `${lemma}\t${r.sense.value}\t${zh}`
    if (seen.has(k)) continue
    seen.add(k)
    let list = out.get(lemma)
    if (!list) out.set(lemma, (list = []))
    list.push({ kpos: CATEGORY[qid(r.cat.value)] ?? [], zh, en: n.en })
  }
  return out
}

/** 英文释义规整成比较用的样子：小写、去掉括号里的补充、开头的 to / a / an / the */
const normEn = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^\s*(to|a|an|the)\s+/, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * 条目的英文名字（或别名）对上了哪个义项：跟义项的某条英文释义一样，或者是释义开头 / 结尾的整个词组
 * （goat ↔ female goat、chicken ↔ chicken meat）。返回义项下标，对不上的 -1。
 */
export function matchSense(names: string[], senses: { en?: string[] }[]): number {
  // 单复数不论（goats ↔ goat）
  const sing = (s: string): string => s.replace(/(?<=\w{3})s$/, '')
  const ns = names
    .map(normEn)
    .filter((n) => n.length >= 3)
    .map(sing)
  for (let i = 0; i < senses.length; i++)
    for (const g of senses[i].en ?? []) {
      const e = sing(normEn(g))
      if (e.length < 3) continue
      for (const n of ns)
        if (e === n || e.startsWith(n + ' ') || e.endsWith(' ' + n) || n.endsWith(' ' + e)) return i
    }
  return -1
}
