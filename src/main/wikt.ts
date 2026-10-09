/**
 * 维基词典的人写释义（主进程，Node 自带的 SQLite，只读）：词典里的「日日词典」「维基词典（中文）」两栏。
 * 数据库由 scripts/data/wiktionary-ja.mjs 生成（resources/data/ja/wikt.sqlite，不入库），按 JMdict 词条号存；
 * 文件不存在时（还没跑过脚本）各方法都返回空，不报错。
 * 内容出自日语、中文维基词典，CC BY-SA，署名 Wiktionary 贡献者（经 kaikki.org / wiktextract 抽取）。
 */
import { existsSync } from 'node:fs'
import { DatabaseSync, type StatementSync } from 'node:sqlite'

type Row = Record<string, unknown>

/** 释义来源：ja 日语维基词典（日日词典），zh 中文维基词典 */
export type WiktSource = 'ja' | 'zh'

/** 一条释义（一个义项） */
export interface WiktDefinition {
  src: WiktSource
  /** 词性，照来源的说法：名詞、動詞……（日文版）；名词、动词、名·他サ……（中文版）；可能是空的 */
  pos: string
  /** 释义；语体等标记写在最前面：〔俗語〕…、〔古语〕… */
  text: string
  /** 例句，最多两句；有翻译或说明的接在「 — 」后面 */
  examples: string[]
  /** 出自维基词典的哪一页（页面标题），署名、链接原页用 */
  word: string
}

/** 各来源有释义的 JMdict 词条数 */
export type WiktStats = Record<WiktSource, number>

/** 一个来源的说明（「关于」里署名用） */
export interface WiktSourceInfo {
  key: WiktSource
  name: string
  license: string
  credit: string
  home: string
  /** 维基词典 dump 的日期 */
  dump: string | null
}

export class WiktDict {
  #db: DatabaseSync | null = null
  #q: Record<string, StatementSync> = {}

  constructor(path: string) {
    if (existsSync(path)) this.#db = new DatabaseSync(path, { readOnly: true })
  }

  #stmt(sql: string): StatementSync {
    return (this.#q[sql] ??= this.#db!.prepare(sql))
  }

  #meta(key: string): unknown {
    const r = this.#stmt('SELECT value FROM meta WHERE key = ?').get(key) as Row | undefined
    return r ? JSON.parse(String(r.value)) : null
  }

  /** 一个 JMdict 词条的释义：日文版在前、中文版在后，各自按义项顺序 */
  definitions(entryId: number): WiktDefinition[] {
    if (!this.#db) return []
    const rows = this.#stmt(
      'SELECT src, pos, text, ex, word FROM def WHERE entry = ? ORDER BY src, sense'
    ).all(entryId) as Row[]
    return rows.map((r) => ({
      src: r.src as WiktSource,
      pos: String(r.pos ?? ''),
      text: String(r.text),
      examples: r.ex ? (JSON.parse(String(r.ex)) as string[]) : [],
      word: String(r.word)
    }))
  }

  /** 各来源有释义的词条数（生成时记在 meta 里） */
  stats(): WiktStats {
    const out: WiktStats = { ja: 0, zh: 0 }
    if (!this.#db) return out
    const counts = this.#meta('counts') as Partial<Record<WiktSource, { entries: number }>> | null
    if (counts) {
      for (const src of ['ja', 'zh'] as const) out[src] = counts[src]?.entries ?? 0
      return out
    }
    for (const r of this.#stmt(
      'SELECT src, COUNT(DISTINCT entry) AS n FROM def GROUP BY src'
    ).all() as Row[])
      if (r.src === 'ja' || r.src === 'zh') out[r.src] = Number(r.n)
    return out
  }

  /** 来源、许可与署名 */
  sources(): WiktSourceInfo[] {
    if (!this.#db) return []
    const list = (this.#meta('sources') as (WiktSourceInfo & Row)[] | null) ?? []
    return list.map(({ key, name, license, credit, home, dump }) => ({
      key,
      name,
      license,
      credit,
      home,
      dump: dump ?? null
    }))
  }

  close(): void {
    this.#db?.close()
    this.#db = null
    this.#q = {}
  }
}
