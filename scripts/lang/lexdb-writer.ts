/**
 * 框架里各语言的数据管线共用：按 docs/lang-kit.md 的结构写 resources/data/<代码>/dict.sqlite。
 * 查词键一律用这门语言的 rules.key() / rules.looseKey()，跟主进程查词时完全一致。
 *
 *   const db = new LexDbWriter('fr')
 *   db.source({ id: 'wiktionary', name: …, license: 'CC BY-SA 4.0', credit: …, home: … })
 *   const id = db.entry({ w: 'chat', p: ['noun'], g: 'm', s: [{ en: ['cat'], zh: ['猫'], zs: 'cfdict' }], src: ['wiktionary'] })
 *   db.example({ text: 'Le chat dort.', en: 'The cat is sleeping.', src: 'tatoeba' }, [id])
 *   db.finish()
 *
 * 先写到 dict.sqlite.building，finish() 建索引、写 meta、整理之后才换上去；中途出错不会留下半个库。
 * 用 node scripts/data/run-ts.mjs <你的脚本.ts> 运行（要在仓库根目录）。
 */
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { LANGS } from '../../src/shared/lang/registry'
import { primarySystem } from '../../src/shared/lang/levels'
import type {
  LangCode,
  LangModule,
  LexEntryData,
  LexExample,
  PosTag,
  SourceRef
} from '../../src/shared/lang/types'
import {
  INDEX_SQL,
  SCHEMA_SQL,
  SCHEMA_VERSION,
  enGlossKey,
  packEntry,
  zhGlossKeys
} from '../../src/main/lang/lexdb-schema'
import { MT_SOURCE, loadMt, mtKey } from './mt-zh'

/** 仓库根目录（脚本要在根目录跑） */
export const ROOT = resolve('.')
/** 生成的数据放这里（不入库） */
export const dataDir = (code: LangCode): string => join(ROOT, 'resources', 'data', code)
/** 下载的原始文件放这里（不入库） */
export const cacheDir = (code: LangCode): string => join(ROOT, '.cache', 'data', code)

export const POS_TAGS: PosTag[] = [
  'noun',
  'propn',
  'verb',
  'aux',
  'adj',
  'adv',
  'pron',
  'det',
  'adp',
  'cconj',
  'sconj',
  'num',
  'part',
  'intj',
  'phrase',
  'idiom',
  'proverb',
  'affix',
  'abbr',
  'symbol',
  'other'
]

export interface WriterStats {
  file: string
  bytes: number
  entries: number
  forms: number
  examples: number
  lists: Record<string, number>
}

export class LexDbWriter {
  readonly lang: LangModule
  readonly file: string
  readonly db: DatabaseSync
  #tmp: string
  #nextEntry = 1
  #nextExample = 1
  #sources = new Map<string, SourceRef>()
  #meta = new Map<string, string>()
  #primary: string
  #systems: Map<string, Set<string>>
  #glossRows = 0
  #ins: Record<
    'entry' | 'form' | 'glossKey' | 'gloss' | 'example' | 'exEntry' | 'list',
    StatementSync
  >

  /** data/<代码>/zh-mt.jsonl 的译文：没有中文的义项按它补（opts.mt 为 false 时不补；测试可以直接给一份） */
  #mt: Map<string, string>
  #mtUsed = 0

  constructor(
    readonly code: LangCode,
    opts: { file?: string; mt?: false | Map<string, string> } = {}
  ) {
    this.lang = LANGS[code]
    this.#mt = opts.mt === false ? new Map() : (opts.mt ?? loadMt(ROOT, code))
    this.file = opts.file ?? join(dataDir(code), 'dict.sqlite')
    this.#tmp = this.file + '.building'
    mkdirSync(join(this.file, '..'), { recursive: true })
    rmSync(this.#tmp, { force: true })
    this.db = new DatabaseSync(this.#tmp)
    this.db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA page_size = 4096;')
    this.db.exec(SCHEMA_SQL)
    this.db.exec('BEGIN')
    this.#primary = primarySystem(this.lang.spec.levelSystems).id
    this.#systems = new Map(
      this.lang.spec.levelSystems.map((s) => [s.id, new Set(s.levels.map((l) => l.id))])
    )
    this.#ins = {
      entry: this.db.prepare(
        'INSERT INTO entry (id, w, p, fr, lv, data) VALUES (?, ?, ?, ?, ?, ?)'
      ),
      form: this.db.prepare(
        'INSERT INTO form (key, entry, form, tags, loose) VALUES (?, ?, ?, ?, ?)'
      ),
      glossKey: this.db.prepare(
        'INSERT OR IGNORE INTO gloss_key (key, lang, entry) VALUES (?, ?, ?)'
      ),
      gloss: this.db.prepare('INSERT INTO gloss (rowid, text) VALUES (?, ?)'),
      example: this.db.prepare(
        'INSERT INTO example (id, text, en, zh, zs, src, lv) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ),
      exEntry: this.db.prepare(
        'INSERT OR IGNORE INTO example_entry (example, entry) VALUES (?, ?)'
      ),
      list: this.db.prepare('INSERT OR IGNORE INTO list (name, entry, rank) VALUES (?, ?, ?)')
    }
  }

  /** 登记一份来源（设置里列出；词条、例句的 src / zs 用它的 id） */
  source(s: SourceRef): void {
    for (const k of ['id', 'name', 'license', 'credit', 'home'] as const)
      if (!s[k]?.trim()) throw new Error(`来源缺 ${k}：${JSON.stringify(s)}`)
    this.#sources.set(s.id, s)
  }

  /** 另外记一条 meta（counts、levels 这些 finish() 会自己写） */
  meta(key: string, value: unknown): void {
    this.#meta.set(key, typeof value === 'string' ? value : JSON.stringify(value))
  }

  /** 写一个词条，返回它的 id；词头、显示写法、变形表都进查词键，释义进反查，分级进词表 */
  entry(data: LexEntryData): number {
    if (!data.w?.trim()) throw new Error(`词条没有词头：${JSON.stringify(data).slice(0, 200)}`)
    if (!data.p?.length || data.p.some((p) => !POS_TAGS.includes(p)))
      throw new Error(`词性不对（${data.p}）：${data.w}`)
    if (!data.s?.length) throw new Error(`词条没有义项：${data.w}`)
    if (this.#mt.size) data = this.#withMt(data)
    const id = this.#nextEntry++
    const lv = this.#levelOf(data)
    this.#ins.entry.run(id, data.w, data.p[0], data.fr ?? null, lv, packEntry(data))
    const seen = new Set<string>()
    const addForm = (form: string, tags: string): void => {
      const strict = this.lang.rules.key(form)
      if (strict && !seen.has(`0|${strict}|${tags}`)) {
        seen.add(`0|${strict}|${tags}`)
        this.#ins.form.run(strict, id, form, tags, 0)
      }
      const loose = this.lang.rules.looseKey?.(form)
      if (loose && loose !== strict && !seen.has(`1|${loose}|${tags}`)) {
        seen.add(`1|${loose}|${tags}`)
        this.#ins.form.run(loose, id, form, tags, 1)
      }
    }
    addForm(data.w, 'lemma')
    if (data.d) addForm(data.d, 'lemma')
    for (const [form, ...tags] of data.f ?? []) if (form?.trim()) addForm(form, tags.join(' '))
    // 释义反查
    const en: string[] = []
    for (const s of data.s) {
      for (const g of s.en ?? []) {
        en.push(g)
        const k = enGlossKey(g)
        if (k) this.#ins.glossKey.run(k, 'en', id)
      }
      for (const g of s.zh ?? [])
        for (const k of zhGlossKeys(g)) this.#ins.glossKey.run(k, 'zh', id)
    }
    if (en.length) {
      this.#ins.gloss.run(id, en.join(' ; '))
      this.#glossRows++
    }
    // 分级进词表
    for (const [system, value] of Object.entries(data.lv ?? {})) {
      const levels = this.#systems.get(system)
      if (!levels) throw new Error(`${data.w}：分级体系 ${system} 不在 spec.levelSystems 里`)
      for (const level of Array.isArray(value) ? value : [value]) {
        if (!levels.has(level)) throw new Error(`${data.w}：${system} 没有 ${level} 这一级`)
        this.#ins.list.run(`${system}:${level}`, id, data.fr ?? null)
      }
    }
    return id
  }

  /** 补一个查词键（词条以外另有的写法：缩写、异体、旧拼写……） */
  form(entry: number, form: string, tags: string[] = []): void {
    const strict = this.lang.rules.key(form)
    if (strict) this.#ins.form.run(strict, entry, form, tags.join(' '), 0)
    const loose = this.lang.rules.looseKey?.(form)
    if (loose && loose !== strict) this.#ins.form.run(loose, entry, form, tags.join(' '), 1)
  }

  /** 写一句例句，挂到这些词条上；返回例句 id（词条的 s[].ex 里可以引用它） */
  example(ex: Omit<LexExample, 'id'>, entries: number[] = []): number {
    if (!ex.text?.trim()) throw new Error('例句是空的')
    const id = this.#nextExample++
    this.#ins.example.run(
      id,
      ex.text,
      ex.en ?? null,
      ex.zh ?? null,
      ex.zs ?? null,
      ex.src ?? null,
      ex.lv ?? null
    )
    for (const e of entries) this.#ins.exEntry.run(id, e)
    return id
  }

  /** 没有中文的义项按 zh-mt.jsonl 补上（词头 + 这个义项的词性 + 英文释义对得上才补） */
  #withMt(data: LexEntryData): LexEntryData {
    let changed = false
    const s = data.s.map((sense) => {
      if (sense.zh?.length || !sense.en?.length) return sense
      const zh = this.#mt.get(mtKey(data.w, (sense.p ?? data.p)[0], sense.en))
      if (!zh) return sense
      changed = true
      this.#mtUsed++
      return { ...sense, zh: [zh], zs: MT_SOURCE.id }
    })
    return changed ? { ...data, s } : data
  }

  /** 把例句挂到词条上 */
  link(example: number, entry: number): void {
    this.#ins.exEntry.run(example, entry)
  }

  /** 词表：主题词本（theme:food）、额外的考试词表；分级体系里的词表由 entry() 按 lv 自动写 */
  list(name: string, entry: number, rank?: number): void {
    this.#ins.list.run(name, entry, rank ?? null)
  }

  /** 已经写了多少个词条 */
  get entries(): number {
    return this.#nextEntry - 1
  }

  /** 建索引、写 meta、整理，换上正式文件 */
  finish(): WriterStats {
    if (this.#mtUsed && !this.#sources.has(MT_SOURCE.id)) this.source(MT_SOURCE)
    const db = this.db
    db.exec('COMMIT')
    db.exec(INDEX_SQL)
    const count = (sql: string): number => Number((db.prepare(sql).get() as { n: number }).n)
    const lists: Record<string, number> = {}
    for (const r of db.prepare('SELECT name, COUNT(*) AS n FROM list GROUP BY name').all() as {
      name: string
      n: number
    }[])
      lists[r.name] = Number(r.n)
    const stats = {
      entries: count('SELECT COUNT(*) AS n FROM entry'),
      forms: count('SELECT COUNT(*) AS n FROM form'),
      examples: count('SELECT COUNT(*) AS n FROM example'),
      glossed: this.#glossRows
    }
    const meta: Record<string, string> = {
      schema: SCHEMA_VERSION,
      lang: this.code,
      builtAt: new Date().toISOString(),
      sources: JSON.stringify([...this.#sources.values()]),
      counts: JSON.stringify(stats),
      lists: JSON.stringify(lists),
      ...Object.fromEntries(this.#meta)
    }
    if (!this.#sources.size) throw new Error('一份来源都没登记（db.source(...)）')
    const insMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
    for (const [k, v] of Object.entries(meta)) insMeta.run(k, v)
    db.exec("INSERT INTO gloss (gloss) VALUES ('optimize')")
    db.exec('ANALYZE')
    db.close()
    // VACUUM 要另开连接（关闭前的连接还在事务外，但这样更稳）
    const v = new DatabaseSync(this.#tmp)
    v.exec('VACUUM')
    v.close()
    rmSync(this.file, { force: true })
    renameSync(this.#tmp, this.file)
    return {
      file: this.file,
      bytes: statSync(this.file).size,
      entries: stats.entries,
      forms: stats.forms,
      examples: stats.examples,
      lists
    }
  }

  /** 主分级的等级（entry.lv 列）：lv 里主分级那一项；是几个的取第一个 */
  #levelOf(data: LexEntryData): string | null {
    const v = data.lv?.[this.#primary]
    return (Array.isArray(v) ? v[0] : v) ?? null
  }
}

/** 下载到缓存（已经有了就不再下）；返回本地路径 */
export async function download(code: LangCode, url: string, file?: string): Promise<string> {
  const dir = cacheDir(code)
  mkdirSync(dir, { recursive: true })
  const name = file ?? decodeURIComponent(url.split('/').pop()!.split('?')[0])
  const out = join(dir, name)
  if (existsSync(out) && statSync(out).size > 0) return out
  const res = await fetch(url, { headers: { 'User-Agent': 'Qonsona data pipeline' } })
  if (!res.ok || !res.body) throw new Error(`下载失败 ${res.status}：${url}`)
  const part = out + '.part'
  const { createWriteStream } = await import('node:fs')
  const { Readable } = await import('node:stream')
  const { pipeline } = await import('node:stream/promises')
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(part))
  renameSync(part, out)
  return out
}
