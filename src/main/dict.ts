/**
 * 日语词典查询（主进程，Node 自带的 SQLite，只读）。
 * 数据库由 scripts/data/build-ja.mjs 生成。
 */
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { inflateRawSync } from 'node:zlib'
import { deinflect, typeMatchesPos } from '../shared/ja/deinflect'
import { classOf } from '../shared/ja/conjugate'
import { UNSUITABLE, type ExampleLite, type ExamWord } from '../shared/ja/exam'
import {
  hasKanji,
  isRomaji,
  kanaUnits,
  romajiToHiragana,
  toHiragana,
  toKatakana
} from '../shared/ja/kana'
import type {
  ConjugableWord,
  ContrastCard,
  DictSource,
  EntryView,
  ExampleView,
  FormView,
  KanaWord,
  KanjiView,
  RawEntry,
  SearchHit,
  SearchResult,
  WordListItem
} from '../shared/dict'

type Row = Record<string, unknown>

/** 逐项比大小：第一项不同就看第一项，相同再看下一项 */
function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

/** 阅读器里一个词对上的词条 */
export interface WordHit {
  entryId: number
  jlpt: number | null
  zh: string | null
  en: string
}

const LIMIT = 60
/** 对上的方式，越小越靠前 */
const RANK: Record<SearchHit['match'], number> = {
  exact: 0,
  kana: 1,
  deinflected: 2,
  prefix: 3,
  gloss: 4
}

/** 英文释义的匹配键，跟 build-ja.mjs 的 enKey 一样 */
const enKey = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^\s*(to|a|an|the)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()

const formOf = (f: string | unknown[]): FormView =>
  typeof f === 'string'
    ? { text: f, common: false, tags: [] }
    : { text: f[0] as string, common: !!f[1], tags: (f[2] as string[]) ?? [] }

export class JapaneseDict {
  #db: DatabaseSync
  #zdict: Buffer
  #q: Record<string, StatementSync> = {}
  #cache = new Map<number, RawEntry>()

  constructor(path: string) {
    this.#db = new DatabaseSync(path, { readOnly: true })
    const meta = this.#db.prepare("SELECT value FROM meta WHERE key = 'zdict'").get() as Row
    this.#zdict = Buffer.from(String(meta.value), 'base64')
  }

  #stmt(sql: string): StatementSync {
    return (this.#q[sql] ??= this.#db.prepare(sql))
  }

  #raw(id: number, blob?: Uint8Array): RawEntry | null {
    const hit = this.#cache.get(id)
    if (hit) return hit
    const data =
      blob ??
      ((this.#stmt('SELECT data FROM entry WHERE id = ?').get(id) as Row)?.data as Uint8Array)
    if (!data) return null
    const raw = JSON.parse(inflateRawSync(data, { dictionary: this.#zdict }).toString()) as RawEntry
    if (this.#cache.size > 2000) this.#cache.clear()
    this.#cache.set(id, raw)
    return raw
  }

  /** 所有义项的词性 */
  #pos(raw: RawEntry): string[] {
    return raw.s.flatMap((s) => s.p ?? [])
  }

  search(input: string): SearchResult {
    const query = input.trim().normalize('NFKC')
    const result: SearchResult = { query, kana: null, hits: [], contrast: null }
    if (!query) return result
    type Found = Omit<SearchHit, 'head' | 'reading' | 'common' | 'jlpt' | 'zh' | 'en'> & {
      /** 对上的写法是不是这个词条的常用写法（行った 还原成「行る」时，它只是「遣る」的罕用写法） */
      usual: boolean
    }
    const found = new Map<number, Found>()
    const add = (
      id: number,
      match: SearchHit['match'],
      usual = true,
      extra: Partial<SearchHit> = {}
    ): void => {
      const prev = found.get(id)
      if (
        !prev ||
        RANK[match] < RANK[prev.match] ||
        (RANK[match] === RANK[prev.match] && usual && !prev.usual)
      )
        found.set(id, { id, match, usual, ...extra })
    }
    const byForm = (text: string): { id: number; common: boolean }[] =>
      (this.#stmt('SELECT entry, common FROM form WHERE text = ?').all(text) as Row[]).map((r) => ({
        id: Number(r.entry),
        common: !!r.common
      }))

    // 日文：写法 → 假名互换 → 词形还原 → 开头对上
    const japanese = (text: string, kanaFromRomaji: boolean): void => {
      for (const f of byForm(text)) add(f.id, kanaFromRomaji ? 'kana' : 'exact', f.common)
      for (const alt of new Set([toHiragana(text), toKatakana(text)]))
        if (alt !== text) for (const f of byForm(alt)) add(f.id, 'kana', f.common)
      for (const d of deinflect(text)) {
        if (d.type === null) continue
        for (const f of byForm(d.word)) {
          const raw = this.#raw(f.id)
          if (raw && typeMatchesPos(d.type, this.#pos(raw)))
            add(f.id, 'deinflected', f.common, { reasons: d.reasons, inflected: text })
        }
      }
      const prefix = this.#stmt(
        "SELECT DISTINCT entry FROM form WHERE text > ? AND text < ? || '\uffff' LIMIT 200"
      ).all(text, text) as Row[]
      for (const r of prefix) add(Number(r.entry), 'prefix', false)
    }

    if (isRomaji(query)) {
      const kana = romajiToHiragana(query)
      if (!/[a-z]/i.test(kana)) {
        result.kana = kana
        japanese(kana, true)
      }
      // 英文释义：整条对上，再按片段找
      for (const r of this.#stmt(
        "SELECT entry FROM gloss_key WHERE key = ? AND lang = 'en' LIMIT 200"
      ).all(enKey(query)) as Row[])
        add(Number(r.entry), 'gloss')
      // 按单词找：每个词都要有，最后一个词按开头算（输入到一半也能找到）
      const words = query.toLowerCase().match(/[a-z0-9]+/g) ?? []
      if (words.length) {
        const match = words
          .map((w, i) => (i === words.length - 1 ? `"${w}"*` : `"${w}"`))
          .join(' AND ')
        for (const r of this.#stmt(
          'SELECT rowid AS entry FROM gloss WHERE gloss MATCH ? LIMIT 300'
        ).all(match) as Row[])
          add(Number(r.entry), 'gloss', false)
      }
    } else {
      japanese(query, false)
      // 汉字也可能是中文：中文释义整条或开头对上，再看有没有「中日同形词对照」
      if (hasKanji(query) || !/[\u3040-\u30ff]/.test(query)) {
        for (const r of this.#stmt(
          "SELECT DISTINCT entry FROM gloss_key WHERE lang = 'zh' AND key >= ? AND key < ? || '\uffff' LIMIT 200"
        ).all(query, query) as Row[])
          add(Number(r.entry), 'gloss')
        result.contrast = this.contrast(query)
      }
    }

    const ids = [...found.keys()]
    if (!ids.length) return result
    const rows = new Map<number, Row>()
    // SQLite 一次最多 999 个参数，分批取
    for (let i = 0; i < ids.length; i += 500) {
      const part = ids.slice(i, i + 500)
      const sql = `SELECT id, head, reading, common, jlpt, score, data FROM entry WHERE id IN (${part.map(() => '?').join(',')})`
      for (const r of this.#db.prepare(sql).all(...part) as Row[]) rows.set(Number(r.id), r)
    }
    result.hits = [...found.values()]
      .filter((h) => rows.has(h.id))
      .sort(
        (a, b) =>
          RANK[a.match] - RANK[b.match] ||
          Number(b.usual) - Number(a.usual) ||
          Number(rows.get(b.id)!.score) - Number(rows.get(a.id)!.score) ||
          a.id - b.id
      )
      .slice(0, LIMIT)
      .map(({ usual: _usual, ...h }) => {
        const r = rows.get(h.id)!
        const raw = this.#raw(h.id, r.data as Uint8Array)!
        return {
          ...h,
          head: String(r.head),
          reading: String(r.reading),
          common: !!r.common,
          jlpt: (r.jlpt as number | null) ?? null,
          zh: raw.z?.find(Boolean) ?? null,
          en: raw.s[0]?.g.slice(0, 3).join('; ') ?? ''
        }
      })
    return result
  }

  #words = new Map<string, WordHit | null>()

  /**
   * 阅读器里的一个词：按原形找词条，再按读音挑（日 读 ひ 还是 にち）。
   * 变过形的只比读音的前半截（書い → か…，对得上 かく），最后看常用与排序分。
   */
  word(base: string, reading: string, inflected: boolean): WordHit | null {
    const key = [base, reading, inflected ? 1 : 0].join('|')
    if (this.#words.has(key)) return this.#words.get(key)!
    const cands = this.#stmt('SELECT entry, common FROM form WHERE text = ?').all(base) as Row[]
    let best: { id: number; rank: number[] } | null = null
    const stem = inflected ? reading.slice(0, -1) : reading
    for (const c of cands) {
      const id = Number(c.entry)
      // 词条的假名写法从词条数据里取（form 表按词条查要扫全表，一次十几毫秒）
      const kana = (this.#raw(id)?.r ?? []).map((x) => (typeof x === 'string' ? x : x[0]))
      const row = this.#stmt('SELECT score FROM entry WHERE id = ?').get(id) as Row | undefined
      const byReading = !reading
        ? 0
        : kana.includes(reading) || (!kana.length && base === reading)
          ? 2
          : stem && kana.some((k) => k.startsWith(stem))
            ? 1
            : 0
      const rank = [byReading, c.common ? 1 : 0, Number(row?.score ?? 0)]
      if (!best || compareRank(rank, best.rank) > 0) best = { id, rank }
    }
    let hit: WordHit | null = null
    if (best) {
      const r = this.#stmt('SELECT jlpt, data FROM entry WHERE id = ?').get(best.id) as Row
      const raw = this.#raw(best.id, r.data as Uint8Array)
      hit = {
        entryId: best.id,
        jlpt: (r.jlpt as number | null) ?? null,
        zh: raw?.z?.find(Boolean) ?? null,
        en: raw?.s[0]?.g.slice(0, 3).join('; ') ?? ''
      }
    }
    if (this.#words.size > 20000) this.#words.clear()
    this.#words.set(key, hit)
    return hit
  }

  /** 内置词本：某一级 JLPT 的全部词，常用的在前（按排序分），每个词带一句中英释义 */
  jlptWords(level: number): WordListItem[] {
    const rows = this.#stmt(
      'SELECT id, head, reading, data FROM entry WHERE jlpt = ? ORDER BY score DESC, id'
    ).all(level) as Row[]
    return rows.map((r) => this.#listItem(r))
  }

  /** 每一级 JLPT 有多少词（内置词本上写的数） */
  jlptCounts(): Record<number, number> {
    const out: Record<number, number> = {}
    for (const r of this.#stmt(
      'SELECT jlpt, COUNT(*) AS n FROM entry WHERE jlpt IS NOT NULL GROUP BY jlpt'
    ).all() as Row[])
      out[Number(r.jlpt)] = Number(r.n)
    return out
  }

  /** 一批词条的词头、读音与一句释义（阅读器把本文词汇一起加进生词本），按给的顺序 */
  wordItems(ids: number[]): WordListItem[] {
    const byId = new Map<number, WordListItem>()
    for (let i = 0; i < ids.length; i += 500) {
      const part = ids.slice(i, i + 500)
      const sql = `SELECT id, head, reading, data FROM entry WHERE id IN (${part.map(() => '?').join(',')})`
      for (const r of this.#db.prepare(sql).all(...part) as Row[])
        byId.set(Number(r.id), this.#listItem(r))
    }
    return ids.map((id) => byId.get(id)).filter((x): x is WordListItem => !!x)
  }

  #listItem(r: Row): WordListItem {
    const raw = this.#raw(Number(r.id), r.data as Uint8Array)
    return {
      id: Number(r.id),
      head: String(r.head),
      reading: String(r.reading),
      zh: raw?.z?.find(Boolean) ?? '',
      en: raw?.s[0]?.g.slice(0, 3).join('; ') ?? ''
    }
  }

  // ── 变形课、变形练习 ──

  /** 某几级 JLPT 里能变形的动词、形容词，常用的在前；通常写假名的（uk）按假名写，带 する 的名词加上する */
  conjugables(levels: number[]): ConjugableWord[] {
    const out: ConjugableWord[] = []
    for (const level of levels) {
      const rows = this.#stmt(
        'SELECT id, head, reading, data FROM entry WHERE jlpt = ? ORDER BY score DESC, id'
      ).all(level) as Row[]
      for (const r of rows) {
        const raw = this.#raw(Number(r.id), r.data as Uint8Array)
        const first = raw?.s[0]
        const c = first ? classOf(first.p ?? []) : null
        if (!raw || !first || !c) continue
        const reading = String(r.reading) + (c.suru ? 'する' : '')
        const head =
          (first.m?.includes('uk') ? String(r.reading) : String(r.head)) + (c.suru ? 'する' : '')
        out.push({
          id: Number(r.id),
          head,
          reading,
          cls: c.cls,
          ...(c.special && { special: c.special }),
          jlpt: level,
          zh: raw.z?.find(Boolean) ?? '',
          en: first.g.slice(0, 3).join('; ')
        })
      }
    }
    return out
  }

  // ── 练习与模拟卷 ──

  /**
   * 练习与模拟卷用的词：某一级 JLPT 的全部词条，常用的在前；带所有读法、第一个义项的词性、中英释义，
   * 和最多三句原样用到这个词的例句（挑容易的）。通常写假名的（uk）按假名写
   */
  /** 一个词条做成出题用的词（不带例句）；同时给出它的例句编号 */
  #examWord(r: Row): { word: ExamWord; exIds: number[] } | null {
    const raw = this.#raw(Number(r.id), r.data as Uint8Array)
    const first = raw?.s[0]
    if (!raw || !first) return null
    const uk = !!first.m?.includes('uk')
    return {
      word: {
        id: Number(r.id),
        head: uk ? String(r.reading) : String(r.head),
        reading: String(r.reading),
        readings: (raw.r ?? []).map((x) => (typeof x === 'string' ? x : x[0])),
        uk,
        pos: first.p ?? [],
        zh: raw.z?.find(Boolean) ?? '',
        en: first.g.slice(0, 3).join('; '),
        examples: []
      },
      exIds: raw.s.flatMap((x) => x.e ?? []).slice(0, 40)
    }
  }

  /** 这几个词条做成出题用的词（不带例句；本文练习用） */
  examWordsOf(ids: number[]): ExamWord[] {
    const out: ExamWord[] = []
    for (const id of [...new Set(ids)]) {
      const r = this.#stmt('SELECT id, head, reading, data FROM entry WHERE id = ?').get(id) as
        Row | undefined
      const w = r ? this.#examWord(r) : null
      if (w) out.push(w.word)
    }
    return out
  }

  examWords(level: number): ExamWord[] {
    const rows = this.#stmt(
      'SELECT id, head, reading, data FROM entry WHERE jlpt = ? ORDER BY score DESC, id'
    ).all(level) as Row[]
    const words: ExamWord[] = []
    const exIds = new Map<number, number[]>()
    for (const r of rows) {
      const w = this.#examWord(r)
      if (!w) continue
      exIds.set(w.word.id, w.exIds)
      words.push(w.word)
    }
    const all = [...new Set([...exIds.values()].flat())]
    const byId = new Map<number, ExampleLite>()
    for (let i = 0; i < all.length; i += 500) {
      const part = all.slice(i, i + 500)
      const sql = `SELECT id, ja, en, zh, zh_mt FROM example WHERE id IN (${part.map(() => '?').join(',')})`
      for (const e of this.#db.prepare(sql).all(...part) as Row[])
        byId.set(Number(e.id), {
          ja: String(e.ja),
          en: (e.en as string) ?? null,
          zh: ((e.zh ?? e.zh_mt) as string) ?? null,
          ...(!e.zh && !!e.zh_mt && { zhMachine: true })
        })
    }
    // 例句挑容易的：这一级和更容易的几级的词里没出现过的汉字越少越好，有人工中文翻译的、长短适中的在前
    const easy = new Set<string>()
    for (const r of this.#stmt('SELECT head FROM entry WHERE jlpt >= ?').all(level) as Row[])
      for (const ch of String(r.head)) if (/\p{Script=Han}/u.test(ch)) easy.add(ch)
    const hard = (ja: string): number =>
      [...ja].filter((ch) => /\p{Script=Han}/u.test(ch) && !easy.has(ch)).length
    for (const w of words)
      w.examples = (exIds.get(w.id) ?? [])
        .map((id) => byId.get(id))
        .filter(
          (e): e is ExampleLite =>
            !!e && e.ja.length <= 40 && e.ja.includes(w.head) && !UNSUITABLE.test(e.ja)
        )
        .map((e) => ({ e, k: hard(e.ja) }))
        .sort(
          (a, b) =>
            a.k - b.k ||
            Number(!!a.e.zhMachine) - Number(!!b.e.zhMachine) ||
            Math.abs(a.e.ja.length - 16) - Math.abs(b.e.ja.length - 16)
        )
        .slice(0, 3)
        .map((x) => x.e)
    return words
  }

  // ── 五十音课的例词 ──

  /** 常用词的假名写法（第一次用时读进来）：JLPT 词在前（N5 最前），再按排序分；同一个写法只留最常用的 */
  #kanaPool: { text: string; id: number; units: string[] }[] | null = null

  #kanaWords(): { text: string; id: number; units: string[] }[] {
    if (this.#kanaPool) return this.#kanaPool
    const rows = this.#stmt(
      `SELECT f.text, f.entry, e.jlpt, e.score FROM form f JOIN entry e ON e.id = f.entry
       WHERE f.kana = 1 AND f.common = 1
       ORDER BY COALESCE(e.jlpt, 0) DESC, e.score DESC, e.id`
    ).all() as Row[]
    const seen = new Set<string>()
    const pool: { text: string; id: number; units: string[] }[] = []
    for (const r of rows) {
      const text = String(r.text)
      if (seen.has(text) || !/^[ぁ-ゖァ-ヺー]+$/.test(text)) continue
      seen.add(text)
      pool.push({ text, id: Number(r.entry), units: kanaUnits(text) })
    }
    return (this.#kanaPool = pool)
  }

  #kanaWordView(p: { text: string; id: number }): KanaWord {
    const item = this.wordItems([p.id])[0]
    return {
      text: p.text,
      id: p.id,
      head: item?.head ?? p.text,
      zh: item?.zh ?? '',
      en: item?.en ?? ''
    }
  }

  /** 这个假名开头的常用词（认字时的例词）；两拍到六拍的 */
  kanaStartWords(prefix: string, limit = 3): KanaWord[] {
    return this.#kanaWords()
      .filter((p) => p.text.startsWith(prefix) && p.units.length >= 2 && p.units.length <= 6)
      .slice(0, limit)
      .map((p) => this.#kanaWordView(p))
  }

  /**
   * 只用学过的假名（按拍算，きゃ 是一拍）写成、又用到这一课的假名的常用词：课里的拼读练习
   */
  kanaSpellWords(allowed: string[], must: string[], limit = 8): KanaWord[] {
    const ok = new Set(allowed)
    const need = new Set(must)
    return this.#kanaWords()
      .filter(
        (p) =>
          p.units.length >= 2 &&
          p.units.length <= 6 &&
          p.units.every((u) => ok.has(u)) &&
          (!need.size || p.units.some((u) => need.has(u)))
      )
      .slice(0, limit)
      .map((p) => this.#kanaWordView(p))
  }

  /** 按写法查一批词（促音、长音那几课给出的词），找不到的跳过 */
  kanaLookup(texts: string[]): KanaWord[] {
    const out: KanaWord[] = []
    for (const text of texts) {
      const r = this.#stmt(
        `SELECT f.entry FROM form f JOIN entry e ON e.id = f.entry WHERE f.text = ?
         ORDER BY f.common DESC, COALESCE(e.jlpt, 0) DESC, e.score DESC LIMIT 1`
      ).get(text) as Row | undefined
      if (r) out.push(this.#kanaWordView({ text, id: Number(r.entry) }))
    }
    return out
  }

  entry(id: number): EntryView | null {
    const row = this.#stmt(
      'SELECT id, head, reading, common, jlpt, data FROM entry WHERE id = ?'
    ).get(id) as Row | undefined
    if (!row) return null
    const raw = this.#raw(id, row.data as Uint8Array)!
    const exampleIds = raw.s.flatMap((s) => s.e ?? [])
    const examples = new Map<number, ExampleView>()
    if (exampleIds.length) {
      const sql = `SELECT id, ja, en, zh, zh_mt FROM example WHERE id IN (${exampleIds.map(() => '?').join(',')})`
      for (const r of this.#db.prepare(sql).all(...exampleIds) as Row[])
        examples.set(Number(r.id), {
          id: Number(r.id),
          ja: String(r.ja),
          en: (r.en as string) ?? null,
          zh: ((r.zh ?? r.zh_mt) as string) ?? null,
          zhMachine: !r.zh && !!r.zh_mt
        })
    }
    const head = String(row.head)
    const chars = [...new Set([...head].filter((c) => hasKanji(c)))].map((ch) => {
      const k = this.#stmt('SELECT data FROM kanji WHERE ch = ?').get(ch) as Row | undefined
      const d = k
        ? (JSON.parse(String(k.data)) as { zh?: string[]; en?: string[]; on?: string[] })
        : {}
      return { ch, zh: d.zh?.[0] ?? d.en?.[0] ?? '', on: d.on?.[0] ?? '' }
    })
    const pairRow = this.#stmt(
      'SELECT p.other, p.role, e.head, e.reading FROM verb_pair p JOIN entry e ON e.id = p.other WHERE p.entry = ? LIMIT 1'
    ).get(id) as Row | undefined
    return {
      id,
      head,
      reading: String(row.reading),
      kanji: (raw.k ?? []).map(formOf),
      kana: (raw.r ?? []).map(formOf),
      common: !!row.common,
      jlpt: (row.jlpt as number | null) ?? null,
      zhSource: raw.zs?.[0] ?? null,
      senses: raw.s.map((s, i) => ({
        pos: s.p ?? [],
        en: s.g,
        zh: raw.z?.[i] || null,
        misc: s.m ?? [],
        field: s.f ?? [],
        dialect: s.d ?? [],
        info: s.i ?? [],
        xref: s.x ?? [],
        antonym: s.a ?? [],
        only: [...(s.k ?? []), ...(s.r ?? [])],
        examples: (s.e ?? []).map((e) => examples.get(e)).filter((e): e is ExampleView => !!e)
      })),
      chars,
      pair: pairRow
        ? {
            id: Number(pairRow.other),
            head: String(pairRow.head),
            reading: String(pairRow.reading),
            role: String(pairRow.role)
          }
        : null
    }
  }

  kanji(ch: string): KanjiView | null {
    const row = this.#stmt('SELECT data, strokes FROM kanji WHERE ch = ?').get(ch) as
      Row | undefined
    if (!row) return null
    const d = JSON.parse(String(row.data)) as Record<string, unknown>
    const paths = row.strokes
      ? (JSON.parse(inflateRawSync(row.strokes as Uint8Array).toString()) as string[])
      : []
    const wordIds = (
      this.#stmt('SELECT entry FROM kanji_word WHERE ch = ? ORDER BY rank LIMIT 40').all(
        ch
      ) as Row[]
    ).map((r) => Number(r.entry))
    const words: SearchHit[] = []
    for (const id of wordIds) {
      const r = this.#stmt('SELECT head, reading, common, jlpt, data FROM entry WHERE id = ?').get(
        id
      ) as Row
      const raw = this.#raw(id, r.data as Uint8Array)!
      words.push({
        id,
        head: String(r.head),
        reading: String(r.reading),
        common: !!r.common,
        jlpt: (r.jlpt as number | null) ?? null,
        zh: raw.z?.find(Boolean) ?? null,
        en: raw.s[0]?.g.slice(0, 3).join('; ') ?? '',
        match: 'exact'
      })
    }
    const arr = (k: string): string[] => (d[k] as string[]) ?? []
    const num = (k: string): number | null => (d[k] as number | null) ?? null
    return {
      ch,
      on: arr('on'),
      kun: arr('kun'),
      nanori: arr('nanori'),
      en: arr('en'),
      zh: arr('zh'),
      pinyin: arr('py'),
      strokes: num('sc'),
      grade: num('gr'),
      freq: num('fr'),
      jlpt: num('jl'),
      radical: num('rad'),
      paths,
      words
    }
  }

  /** 例句里含有这段文字的（例句页签） */
  examples(text: string, limit = 60): ExampleView[] {
    const q = text.trim()
    if (!q) return []
    return (
      this.#stmt('SELECT id, ja, en, zh, zh_mt FROM example WHERE ja LIKE ? LIMIT ?').all(
        `%${q.replace(/[%_]/g, '')}%`,
        limit
      ) as Row[]
    ).map((r) => ({
      id: Number(r.id),
      ja: String(r.ja),
      en: (r.en as string) ?? null,
      zh: ((r.zh ?? r.zh_mt) as string) ?? null,
      zhMachine: !r.zh && !!r.zh_mt
    }))
  }

  contrast(cn: string): ContrastCard | null {
    const r = this.#stmt('SELECT cn, summary, items FROM cn_contrast WHERE cn = ?').get(cn) as
      Row | undefined
    if (!r) return null
    const items = JSON.parse(String(r.items)) as {
      entry_id: string
      ja: string
      reading: string
      note: string
    }[]
    return {
      cn: String(r.cn),
      summary: String(r.summary),
      items: items.map((x) => ({
        entryId: Number(x.entry_id),
        ja: x.ja,
        reading: x.reading,
        note: x.note
      }))
    }
  }

  /** JMdict 的标记说明（英文），界面上没有中文名的标记用它 */
  tags(): Record<string, string> {
    const r = this.#stmt("SELECT value FROM meta WHERE key = 'tags'").get() as Row
    return JSON.parse(String(r.value))
  }

  sources(): DictSource[] {
    const r = this.#stmt("SELECT value FROM meta WHERE key = 'sources'").get() as Row
    return JSON.parse(String(r.value))
  }

  close(): void {
    this.#db.close()
  }
}
