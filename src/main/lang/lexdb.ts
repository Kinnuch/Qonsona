/**
 * 框架里各语言的词典（主进程）：读 resources/data/<代码>/dict.sqlite（结构见 lexdb-schema.ts）。
 * 查词的顺序：词头 → 变形 → 去掉变音符号 → 按这门语言的规则猜原形 → 释义反查 → 前缀；同一类里常用的在前。
 */
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { statSync } from 'node:fs'
import { LANGS } from '../../shared/lang/registry'
import { primarySystem } from '../../shared/lang/levels'
import type {
  LangCode,
  LangModule,
  LexEntryData,
  LexExample,
  PosTag,
  PracticeWord,
  SourceRef
} from '../../shared/lang/types'
import type {
  LexEntryView,
  LexHit,
  LexLevelView,
  LexMatch,
  LexSearchResult,
  LexSenseView,
  LexListInfo,
  LexStatus,
  LexWordItem
} from '../../shared/lang/views'
import { SCHEMA_VERSION, enGlossKey, unpackEntry } from './lexdb-schema'

const ORDER: LexMatch[] = ['exact', 'form', 'loose', 'guess', 'latin', 'gloss', 'prefix']

/** 阅读器里一个词形对上的词条 */
export interface LookupHit {
  entry: number
  lemma: string
  pos: PosTag
  /** 这个词形的标签（form 表的，或者猜原形时给的） */
  tags: string[]
  /** 同一个词形在这个词条里的别的可能（几组标签） */
  alt?: string[][]
  /** 同一个词形还能是的别的词条（常用的在前，最多三个） */
  others?: { entry: number; lemma: string; pos: PosTag }[]
  lv: string | null
  zh: string
  en: string
  /** 读音：原形用词条的 IPA，变形用 fi 里这个形的；变形没有读音时空着 */
  ipa?: string
}

interface Row {
  id: number
  w: string
  p: string
  fr: number | null
  lv: string | null
  data: Uint8Array
}

/** 前缀查询的上界：比任何正常字符都大 */
const TOP = String.fromCharCode(0xffff)

/** 一条释义：界面语言是中文时中文优先 */
function firstGloss(d: LexEntryData): { zh: string; en: string } {
  const zh = d.s.find((s) => s.zh?.length)?.zh?.[0] ?? ''
  const en =
    d.s
      .find((s) => s.en?.length)
      ?.en?.slice(0, 2)
      .join('; ') ?? ''
  return { zh, en: en || (d.s[0]?.mono?.[0] ?? '') }
}

export class LexDb {
  readonly lang: LangModule
  readonly ok: boolean
  #db: DatabaseSync
  #sources = new Map<string, SourceRef>()
  #q: Record<string, StatementSync> = {}

  constructor(
    readonly code: LangCode,
    readonly file: string
  ) {
    this.lang = LANGS[code]
    this.#db = new DatabaseSync(file, { readOnly: true })
    const meta = this.#meta()
    this.ok = meta.get('schema') === SCHEMA_VERSION && meta.get('lang') === code
    try {
      for (const s of JSON.parse(meta.get('sources') ?? '[]') as SourceRef[])
        this.#sources.set(s.id, s)
    } catch {
      // 来源坏了不影响查词
    }
  }

  close(): void {
    this.#db.close()
  }

  #meta(): Map<string, string> {
    try {
      return new Map(
        (
          this.#db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[]
        ).map((r) => [r.key, r.value])
      )
    } catch {
      return new Map()
    }
  }

  #stmt(sql: string): StatementSync {
    return (this.#q[sql] ??= this.#db.prepare(sql))
  }

  status(): LexStatus {
    const meta = this.#meta()
    let counts: { entries?: number; examples?: number } = {}
    try {
      counts = JSON.parse(meta.get('counts') ?? '{}')
    } catch {
      // 没有就是 0
    }
    return {
      code: this.code,
      available: this.ok,
      entries: counts.entries ?? 0,
      examples: counts.examples ?? 0,
      bytes: statSync(this.file).size,
      builtAt: meta.get('builtAt') ?? null
    }
  }

  sources(): SourceRef[] {
    return [...this.#sources.values()]
  }

  // ───────────── 查词 ─────────────

  search(query: string, limit = 60): LexSearchResult {
    const q = query.trim()
    if (!q) return { query, hits: [] }
    const rules = this.lang.rules
    const found = new Map<number, { match: LexMatch; via?: { form: string; tags: string[] } }>()
    const add = (id: number, match: LexMatch, via?: { form: string; tags: string[] }): void => {
      const cur = found.get(id)
      if (!cur || ORDER.indexOf(match) < ORDER.indexOf(cur.match)) found.set(id, { match, via })
    }
    const byKey = (key: string, loose: 0 | 1): { entry: number; form: string; tags: string }[] =>
      this.#stmt('SELECT entry, form, tags FROM form WHERE key = ? AND loose = ? LIMIT 200').all(
        key,
        loose
      ) as { entry: number; form: string; tags: string }[]

    const key = rules.key(q)
    for (const r of byKey(key, 0)) {
      const tags = r.tags ? r.tags.split(' ') : []
      if (tags.includes('lemma')) add(Number(r.entry), 'exact')
      else add(Number(r.entry), 'form', { form: q, tags })
    }
    const loose = rules.looseKey?.(q)
    if (loose) {
      for (const r of [...byKey(loose, 1), ...(loose !== key ? byKey(loose, 0) : [])]) {
        const tags = r.tags ? r.tags.split(' ').filter((t) => t !== 'lemma') : []
        add(Number(r.entry), 'loose', tags.length ? { form: r.form, tags } : undefined)
      }
    }
    for (const g of rules.lemmaCandidates?.(q) ?? []) {
      for (const r of byKey(rules.key(g.lemma), 0))
        add(Number(r.entry), 'guess', { form: q, tags: g.tags })
    }
    // 用拉丁字母输入不用拉丁字母的语言（privet → привет）：按转写出的几种写法再查一遍
    if (rules.fromLatin && /^[\p{Script=Latin}\s'’-]+$/u.test(q)) {
      for (const c of rules.fromLatin(q).slice(0, 4)) {
        const ck = rules.key(c)
        if (!ck || ck === key) continue
        for (const r of byKey(ck, 0)) {
          const tags = r.tags ? r.tags.split(' ').filter((t) => t !== 'lemma') : []
          add(Number(r.entry), 'latin', { form: c, tags })
        }
        for (const g of rules.lemmaCandidates?.(c) ?? [])
          for (const r of byKey(rules.key(g.lemma), 0))
            add(Number(r.entry), 'latin', { form: c, tags: g.tags })
        if (found.size < 20)
          for (const r of this.#stmt(
            'SELECT DISTINCT entry FROM form WHERE key > ? AND key < ? AND loose = 0 LIMIT 100'
          ).all(ck, ck + TOP) as { entry: number }[])
            add(Number(r.entry), 'prefix')
      }
    }
    // 释义反查：有汉字按中文，有拉丁字母按英文（英语本身不按英文释义反查，免得查 cat 先出一堆含 cat 的释义）
    if (/\p{Script=Han}/u.test(q)) {
      for (const r of this.#stmt(
        "SELECT entry FROM gloss_key WHERE lang = 'zh' AND key = ? LIMIT 200"
      ).all(q) as { entry: number }[])
        add(Number(r.entry), 'gloss')
      if (found.size < 20)
        for (const r of this.#stmt(
          "SELECT DISTINCT entry FROM gloss_key WHERE lang = 'zh' AND key > ? AND key < ? LIMIT 200"
        ).all(q, q + TOP) as { entry: number }[])
          add(Number(r.entry), 'gloss')
    } else if (/[a-z]/i.test(q) && (this.code !== 'en' || found.size === 0)) {
      const k = enGlossKey(q)
      if (k)
        for (const r of this.#stmt(
          "SELECT entry FROM gloss_key WHERE lang = 'en' AND key = ? LIMIT 200"
        ).all(k) as { entry: number }[])
          add(Number(r.entry), 'gloss')
      const words = q
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
      if (words.length && found.size < 40) {
        try {
          for (const r of this.#stmt(
            'SELECT rowid AS entry FROM gloss WHERE gloss MATCH ? LIMIT 200'
          ).all(words.map((w) => `"${w}"`).join(' ')) as { entry: number }[])
            add(Number(r.entry), 'gloss')
        } catch {
          // 全文检索的语法出错就不反查
        }
      }
    }
    // 前缀：只在严格键上找，结果少时才补
    if (found.size < limit && key.length >= 1) {
      for (const r of this.#stmt(
        'SELECT DISTINCT entry FROM form WHERE key > ? AND key < ? AND loose = 0 LIMIT 300'
      ).all(key, key + TOP) as { entry: number }[])
        add(Number(r.entry), 'prefix')
    }
    if (!found.size) return { query, hits: [] }

    const ids = [...found.keys()]
    const rows = this.#rows(ids)
    // 中文反查：第一条中文释义正好是查的词的在前，其次是第一个义项里有这一说的（查「放弃」先出 abandon）
    const han = /\p{Script=Han}/u.test(q)
    const zhRank = new Map<number, number>()
    if (han)
      for (const r of rows) {
        if (found.get(r.id)!.match !== 'gloss') continue
        const zh = unpackEntry(r.data).s.find((s) => s.zh?.length)?.zh ?? []
        const parts = zh.flatMap((g) =>
          g.split(/[；;，,、]/).map((x) => x.replace(/[（(][^）)]*[）)]/g, '').trim())
        )
        zhRank.set(r.id, parts[0] === q ? 0 : parts.includes(q) ? 1 : 2)
      }
    rows.sort((a, b) => {
      const ma = ORDER.indexOf(found.get(a.id)!.match)
      const mb = ORDER.indexOf(found.get(b.id)!.match)
      if (ma !== mb) return ma - mb
      // 大小写完全一样的在前（US 与 us、May 与 may）
      const ca = Number(a.w !== q)
      const cb = Number(b.w !== q)
      if (ca !== cb) return ca - cb
      const za = zhRank.get(a.id) ?? 2
      const zb = zhRank.get(b.id) ?? 2
      if (za !== zb) return za - zb
      return (a.fr ?? 1e9) - (b.fr ?? 1e9) || a.w.length - b.w.length
    })
    const hits: LexHit[] = rows.slice(0, limit).map((r) => {
      const d = unpackEntry(r.data)
      const f = found.get(r.id)!
      const g = firstGloss(d)
      return {
        id: r.id,
        w: d.w,
        d: d.d,
        p: d.p,
        g: d.g,
        lv: r.lv,
        zh: g.zh || undefined,
        en: g.en || undefined,
        match: f.match,
        via: f.via
      }
    })
    return { query, hits }
  }

  #rows(ids: number[]): Row[] {
    const out: Row[] = []
    for (let i = 0; i < ids.length; i += 500) {
      const part = ids.slice(i, i + 500)
      out.push(
        ...(this.#db
          .prepare(
            `SELECT id, w, p, fr, lv, data FROM entry WHERE id IN (${part.map(() => '?').join(',')})`
          )
          .all(...part) as unknown as Row[])
      )
    }
    return out.map((r) => ({ ...r, id: Number(r.id) }))
  }

  // ───────────── 阅读器查词 ─────────────

  #lookups = new Map<string, LookupHit | null>()

  /**
   * 阅读器：一个词形对上哪个词条。严格键 → 宽松键 → 按规则猜原形；同一层里常用的优先。
   * 结果按键缓存（一篇文章里同一个词只查一次）
   */
  lookup(surface: string): LookupHit | null {
    const rules = this.lang.rules
    const key = rules.key(surface)
    if (!key) return null
    if (this.#lookups.has(key)) return this.#lookups.get(key)!
    const rows = (
      k: string,
      loose: 0 | 1
    ): {
      entry: number
      form: string
      tags: string
      lv: string | null
      data: Uint8Array
      k: string
      loose: 0 | 1
    }[] =>
      (
        this.#stmt(
          `SELECT f.entry, f.form, f.tags, e.lv, e.data FROM form f JOIN entry e ON e.id = f.entry
         WHERE f.key = ? AND f.loose = ? ORDER BY e.fr IS NULL, e.fr, length(e.w) LIMIT 1`
        ).all(k, loose) as {
          entry: number
          form: string
          tags: string
          lv: string | null
          data: Uint8Array
        }[]
      ).map((r) => ({ ...r, k, loose }))
    let found = rows(key, 0)[0]
    let tags: string[] | null = null
    if (!found) {
      const loose = rules.looseKey?.(surface)
      if (loose) found = rows(loose, 1)[0] ?? rows(loose, 0)[0]
    }
    if (!found) {
      for (const g of rules.lemmaCandidates?.(surface) ?? []) {
        found = rows(rules.key(g.lemma), 0)[0]
        if (found) {
          tags = g.tags
          break
        }
      }
    }
    let hit: LookupHit | null = null
    if (found) {
      const d = unpackEntry(found.data)
      const g = firstGloss(d)
      const split = (t: string): string[] => (t ? t.split(' ').filter((x) => x !== 'lemma') : [])
      const isLemma = !tags && found.tags.split(' ').includes('lemma')
      // 同一个词形在这个词条里的别的几行（标签不同的）
      const alt: string[][] = []
      if (!tags) {
        const first = split(found.tags).join(' ')
        const seen = new Set([first])
        for (const r of this.#stmt(
          'SELECT tags FROM form WHERE key = ? AND loose = ? AND entry = ?'
        ).all(found.k, found.loose, found.entry) as { tags: string }[]) {
          const t = split(r.tags)
          if (!t.length || seen.has(t.join(' '))) continue
          seen.add(t.join(' '))
          alt.push(t)
        }
      }
      const ipa =
        d.fi?.[found.form] ?? d.fi?.[surface] ?? (isLemma && !alt.length ? d.ipa?.[0] : undefined)
      // 同一个词形还能是的别的词条（стали：сталь / стать）
      const others = (
        this.#stmt(
          `SELECT DISTINCT f.entry, e.w, e.p FROM form f JOIN entry e ON e.id = f.entry
           WHERE f.key = ? AND f.loose = ? AND f.entry != ? ORDER BY e.fr IS NULL, e.fr LIMIT 3`
        ).all(found.k, found.loose, found.entry) as { entry: number; w: string; p: string }[]
      ).map((r) => ({ entry: Number(r.entry), lemma: r.w, pos: r.p as PosTag }))
      hit = {
        entry: Number(found.entry),
        lemma: d.w,
        pos: d.p[0],
        tags: tags ?? split(found.tags),
        ...(alt.length ? { alt } : {}),
        ...(others.length ? { others } : {}),
        lv: found.lv,
        zh: g.zh,
        en: g.en,
        ...(ipa ? { ipa } : {})
      }
    }
    if (this.#lookups.size > 20000) this.#lookups.clear()
    this.#lookups.set(key, hit)
    return hit
  }

  // ───────────── 词条 ─────────────

  entry(id: number): LexEntryView | null {
    const row = this.#stmt('SELECT id, w, p, fr, lv, data FROM entry WHERE id = ?').get(id) as
      Row | undefined
    if (!row) return null
    const d = unpackEntry(row.data)
    const exIds = new Set<number>()
    for (const s of d.s) for (const e of s.ex ?? []) exIds.add(e)
    const exById = new Map(this.#examples([...exIds]).map((e) => [e.id, e]))
    const senses: LexSenseView[] = d.s.map((s) => {
      const src = s.zs ? this.#sources.get(s.zs) : undefined
      return {
        p: s.p ?? [],
        en: s.en ?? [],
        zh: s.zh ?? [],
        zhSource: s.zs
          ? { id: s.zs, name: src?.name ?? s.zs, machine: s.zs.startsWith('mt-') }
          : null,
        mono: s.mono ?? [],
        tags: s.t ?? [],
        dom: s.dom ?? [],
        examples: (s.ex ?? []).map((e) => exById.get(e)).filter((e): e is LexExample => !!e),
        syn: s.syn ?? [],
        ant: s.ant ?? [],
        see: s.see ?? []
      }
    })
    // 没分到义项的例句：挂在词条上的，短的在前，最多 8 句
    const linked = (
      this.#stmt(
        `SELECT x.id, x.text, x.en, x.zh, x.zs, x.src, x.lv FROM example_entry j JOIN example x ON x.id = j.example
         WHERE j.entry = ? ORDER BY length(x.text) LIMIT 40`
      ).all(id) as unknown as LexExample[]
    )
      .map((e) => ({ ...e, id: Number(e.id) }))
      .filter((e) => !exIds.has(e.id))
      .slice(0, 8)
    const levels: LexLevelView[] = []
    for (const sys of this.lang.spec.levelSystems) {
      const v = d.lv?.[sys.id]
      if (!v) continue
      const ids = Array.isArray(v) ? v : [v]
      levels.push({
        system: sys.id,
        systemName: sys.name,
        kind: sys.kind,
        primary: !!sys.primary,
        levels: sys.levels
          .filter((l) => ids.includes(l.id))
          .map((l) => ({ id: l.id, name: l.name, short: l.short }))
      })
    }
    levels.sort((a, b) => Number(b.primary) - Number(a.primary))
    return {
      id: Number(row.id),
      code: this.code,
      w: d.w,
      d: d.d,
      p: d.p,
      g: d.g,
      ipa: d.ipa ?? [],
      rom: d.rom,
      au: d.au ?? [],
      senses,
      forms: (d.f ?? []).map(([form, ...tags]) => ({
        form,
        tags,
        ...(d.fi?.[form] ? { ipa: d.fi[form] } : {})
      })),
      cls: d.cls ?? [],
      levels,
      freq: d.fr,
      x: d.x ?? {},
      sources: (d.src ?? []).map((s) => this.#sources.get(s)).filter((s): s is SourceRef => !!s),
      examples: linked
    }
  }

  #examples(ids: number[]): LexExample[] {
    if (!ids.length) return []
    return (
      this.#db
        .prepare(
          `SELECT id, text, en, zh, zs, src, lv FROM example WHERE id IN (${ids.map(() => '?').join(',')})`
        )
        .all(...ids) as unknown as LexExample[]
    ).map((e) => ({ ...e, id: Number(e.id) }))
  }

  /** 例句页签：原文里含这段文字的，或者含查得到的词的；短的在前 */
  examples(query: string, limit = 40): LexExample[] {
    const q = query.trim()
    if (!q) return []
    const out = new Map<number, LexExample>()
    for (const e of this.#stmt(
      'SELECT id, text, en, zh, zs, src, lv FROM example WHERE text LIKE ? ORDER BY length(text) LIMIT ?'
    ).all(`%${q.replace(/[%_]/g, '')}%`, limit) as unknown as LexExample[])
      out.set(Number(e.id), { ...e, id: Number(e.id) })
    if (out.size < limit) {
      const hit = this.search(q, 3).hits[0]
      if (hit)
        for (const e of this.#stmt(
          `SELECT x.id, x.text, x.en, x.zh, x.zs, x.src, x.lv FROM example_entry j JOIN example x ON x.id = j.example
           WHERE j.entry = ? ORDER BY length(x.text) LIMIT ?`
        ).all(hit.id, limit) as unknown as LexExample[])
          out.set(Number(e.id), { ...e, id: Number(e.id) })
    }
    return [...out.values()].slice(0, limit)
  }

  // ───────────── 词表 ─────────────

  /** 词表里的词（cefr:A1、cn-exam:cet4、theme:food……），常用的在前 */
  list(name: string, limit = 5000): LexWordItem[] {
    const rows = this.#stmt(
      `SELECT e.id, e.w, e.p, e.fr, e.lv, e.data FROM list l JOIN entry e ON e.id = l.entry
       WHERE l.name = ? ORDER BY l.rank IS NULL, l.rank, e.fr IS NULL, e.fr LIMIT ?`
    ).all(name, limit) as unknown as Row[]
    return rows.map((r) => this.#item(r))
  }

  listCounts(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const r of this.#stmt('SELECT name, COUNT(*) AS n FROM list GROUP BY name').all() as {
      name: string
      n: number
    }[])
      out[r.name] = Number(r.n)
    return out
  }

  /**
   * 全部词表与词数；主题词本、别的词表的名字取自 meta.themes（[{ id, title }]，词表名 theme:<id>）
   * 与 meta.lists_info（[{ name, title }]）
   */
  lists(): LexListInfo[] {
    const meta = this.#meta()
    const titles = new Map<string, Record<string, string>>()
    try {
      for (const th of JSON.parse(meta.get('themes') ?? '[]') as {
        id: string
        title: Record<string, string>
      }[])
        titles.set(`theme:${th.id}`, th.title)
      for (const l of JSON.parse(meta.get('lists_info') ?? '[]') as {
        name: string
        title: Record<string, string>
      }[])
        titles.set(l.name, l.title)
    } catch {
      // 名字坏了就只显示 id
    }
    return Object.entries(this.listCounts()).map(([name, count]) => ({
      name,
      count,
      ...(titles.has(name) ? { title: titles.get(name) } : {})
    }))
  }

  items(ids: number[]): LexWordItem[] {
    const byId = new Map(this.#rows(ids).map((r) => [r.id, r]))
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is Row => !!r)
      .map((r) => this.#item(r))
  }

  #item(r: Row): LexWordItem {
    const d = unpackEntry(r.data)
    const g = firstGloss(d)
    return { id: Number(r.id), w: d.w, d: d.d, p: d.p, g: d.g, lv: r.lv, zh: g.zh, en: g.en }
  }

  /**
   * 字母课的拼读词：按词头查（常用的那条），给读法（转写、IPA）与一句释义；查不到的跳过
   */
  spell(
    words: string[]
  ): { text: string; reading: string; zh: string; en: string; entry: number }[] {
    const out: { text: string; reading: string; zh: string; en: string; entry: number }[] = []
    for (const w of words) {
      const hit = this.lookup(w)
      if (!hit) continue
      const reading = this.lang.rules.romanize?.(w) ?? hit.ipa ?? ''
      out.push({ text: w, reading, zh: hit.zh, en: hit.en, entry: hit.entry })
    }
    return out
  }

  // ───────────── 出题 ─────────────

  /** 出题用的词：主分级某一级（null 全部），常用的在前（只取有词频的） */
  practiceWords(o: {
    level?: string | null
    pos?: PosTag[]
    limit: number
    need?: ('gloss' | 'forms' | 'gender' | 'examples')[]
  }): PracticeWord[] {
    const need = new Set(o.need ?? ['gloss'])
    const rows = (o.level
      ? this.#stmt(
          'SELECT id, w, p, fr, lv, data FROM entry WHERE lv = ? ORDER BY fr IS NULL, fr LIMIT 4000'
        ).all(o.level)
      : this.#stmt(
          'SELECT id, w, p, fr, lv, data FROM entry ORDER BY fr IS NULL, fr LIMIT 6000'
        ).all()) as unknown as Row[]
    const withExamples = need.has('examples')
      ? new Set(
          (this.#stmt('SELECT DISTINCT entry FROM example_entry').all() as { entry: number }[]).map(
            (r) => Number(r.entry)
          )
        )
      : null
    const out: PracticeWord[] = []
    for (const r of rows) {
      if (o.pos && !o.pos.includes(r.p as PosTag)) continue
      if (withExamples && !withExamples.has(Number(r.id))) continue
      const d = unpackEntry(r.data)
      const g = firstGloss(d)
      if (need.has('gloss') && !g.zh && !g.en) continue
      if (need.has('forms') && !d.f?.length) continue
      if (need.has('gender') && !d.g) continue
      out.push({
        id: Number(r.id),
        w: d.w,
        d: d.d,
        p: d.p,
        g: d.g,
        lv: r.lv,
        zh: g.zh,
        en: g.en,
        forms: d.f ?? [],
        ipa: d.ipa?.[0],
        rom: d.rom,
        x: d.x
      })
      if (out.length >= o.limit) break
    }
    return out
  }

  /** 挂在词条上的例句，短的在前 */
  entryExamples(entry: number, limit = 6): LexExample[] {
    return (
      this.#stmt(
        `SELECT x.id, x.text, x.en, x.zh, x.zs, x.src, x.lv FROM example_entry j JOIN example x ON x.id = j.example
         WHERE j.entry = ? ORDER BY length(x.text) LIMIT ?`
      ).all(entry, limit) as unknown as LexExample[]
    ).map((e) => ({ ...e, id: Number(e.id) }))
  }

  /** 主分级某一级（null 全部）有翻译的例句：例句挂的词条里最难的就是这一级；短的在前 */
  levelSentences(level: string | null, limit: number): LexExample[] {
    const rows = (level
      ? this.#stmt(
          `SELECT x.id, x.text, x.en, x.zh, x.zs, x.src, x.lv FROM example x
             WHERE (x.zh IS NOT NULL OR x.en IS NOT NULL) AND (x.lv = ? OR (x.lv IS NULL AND EXISTS (
               SELECT 1 FROM example_entry j JOIN entry e ON e.id = j.entry WHERE j.example = x.id AND e.lv = ?)))
             ORDER BY length(x.text) LIMIT ?`
        ).all(level, level, limit)
      : this.#stmt(
          `SELECT id, text, en, zh, zs, src, lv FROM example WHERE zh IS NOT NULL OR en IS NOT NULL
             ORDER BY length(text) LIMIT ?`
        ).all(limit)) as unknown as LexExample[]
    return rows.map((e) => ({ ...e, id: Number(e.id) }))
  }

  /**
   * 数据够不够出这几类题：有释义的词、带性的名词（几种性）、有变形表的词、挂了例句的词、有翻译的例句。
   * 词按出题时的顺序（常用的在前，没有词频的排后面）看前 3000 个
   */
  practiceStats(): {
    glossed: number
    genders: number
    forms: number
    linked: number
    sentences: number
  } {
    const n = (sql: string): number => Number((this.#stmt(sql).get() as { n: number }).n)
    const genders = new Set<string>()
    let glossed = 0
    let forms = 0
    for (const r of this.#stmt(
      'SELECT data FROM entry ORDER BY fr IS NULL, fr LIMIT 3000'
    ).all() as { data: Uint8Array }[]) {
      const d = unpackEntry(r.data)
      const g = firstGloss(d)
      if (g.zh || g.en) glossed++
      if (d.p[0] === 'noun' && d.g && d.g !== 'mf') genders.add(d.g)
      if ((d.f?.filter((f) => f.length > 1).length ?? 0) >= 4) forms++
    }
    return {
      glossed,
      genders: genders.size,
      forms,
      linked: n('SELECT COUNT(DISTINCT entry) AS n FROM example_entry'),
      sentences: n('SELECT COUNT(*) AS n FROM example WHERE zh IS NOT NULL OR en IS NOT NULL')
    }
  }

  /** 主分级每一级有多少词 */
  levelCounts(): Record<string, number> {
    const primary = primarySystem(this.lang.spec.levelSystems)
    const out: Record<string, number> = {}
    for (const l of primary.levels)
      out[l.id] = Number(
        (this.#stmt('SELECT COUNT(*) AS n FROM entry WHERE lv = ?').get(l.id) as { n: number }).n
      )
    return out
  }
}
