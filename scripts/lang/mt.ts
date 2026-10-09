/**
 * 框架语言的中文释义补译（做法同日语的 scripts/data/mt-batches.mjs，规范见 scripts/lang/mt-guide.md）：
 *
 *   node scripts/data/run-ts.mjs scripts/lang/mt.ts split <代码> [条数]
 *       从 resources/data/<代码>/dict.sqlite 挑没有中文的常用词（有主分级等级的在前，再按词频），
 *       已经译过的跳过，拆成 .cache/mt/<代码>/in/part-NNN.tsv（每份最多 150 个词条、约一万两千字）
 *   node scripts/data/run-ts.mjs scripts/lang/mt.ts merge <代码>
 *       把 .cache/mt/<代码>/out/ 里译好的并进 data/<代码>/zh-mt.jsonl（行数、义项数对不上的那一份整份不收）
 *   node scripts/data/run-ts.mjs scripts/lang/mt.ts status <代码>
 *
 * 输入每行（制表符分隔）：序号  词头  词性  义项1 ‖ 义项2 ‖ …（每个义项「[词性] 英文释义; 英文释义」）
 * 译文每行：序号  中文1 ‖ 中文2 ‖ …（义项个数与输入一致）
 * 合并之后重建词典（各语言的数据管线），LexDbWriter 会自动补上这些中文。
 */
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { unpackEntry } from '../../src/main/lang/lexdb-schema'
import { isLangCode } from '../../src/shared/lang/registry'
import type { LangCode, LexEntryData } from '../../src/shared/lang/types'
import { ROOT, dataDir } from './lexdb-writer'
import { loadMt, mtFile, mtKey, type MtRecord } from './mt-zh'

const SEP = ' ‖ '
const PART = 150
const MAX_CHARS = 12000
/** 一个词条最多译几个义项（义项上百的常用词只译前面的） */
const MAX_SENSES = 6

const dirs = (code: LangCode): { inDir: string; outDir: string } => ({
  inDir: join(ROOT, '.cache', 'mt', code, 'in'),
  outDir: join(ROOT, '.cache', 'mt', code, 'out')
})

/** 一份里每一行对应的词条与义项（合并时按它写回） */
interface Job {
  n: number
  w: string
  senses: { p: string; en: string[] }[]
}

const clean = (s: string): string => s.replace(/[\t\n‖]/g, ' ').trim()

function jobs(code: LangCode, limit: number): Job[] {
  const file = join(dataDir(code), 'dict.sqlite')
  if (!existsSync(file)) throw new Error(`没有 ${file}：先跑这门语言的数据管线`)
  const done = loadMt(ROOT, code)
  const db = new DatabaseSync(file, { readOnly: true })
  const rows = db
    .prepare('SELECT w, data FROM entry ORDER BY lv IS NULL, fr IS NULL, fr, id')
    .all() as { w: string; data: Uint8Array }[]
  db.close()
  const out: Job[] = []
  for (const r of rows) {
    if (out.length >= limit) break
    const d: LexEntryData = unpackEntry(r.data)
    if (d.p[0] === 'propn' || d.p[0] === 'symbol') continue
    const senses = d.s
      .filter((s) => !s.zh?.length && s.en?.length)
      .map((s) => ({ p: (s.p ?? d.p)[0], en: s.en! }))
      .filter((s) => !done.has(mtKey(d.w, s.p, s.en)))
      .slice(0, MAX_SENSES)
    if (senses.length) out.push({ n: out.length + 1, w: d.w, senses })
  }
  return out
}

function split(code: LangCode, limit: number): void {
  const all = jobs(code, limit)
  const { inDir, outDir } = dirs(code)
  rmSync(inDir, { recursive: true, force: true })
  mkdirSync(inDir, { recursive: true })
  mkdirSync(outDir, { recursive: true })
  const parts: Job[][] = [[]]
  let chars = 0
  for (const j of all) {
    const line = lineOf(j)
    const cur = parts[parts.length - 1]
    if (cur.length && (cur.length >= PART || chars + line.length > MAX_CHARS)) {
      parts.push([])
      chars = 0
    }
    parts[parts.length - 1].push(j)
    chars += line.length + 1
  }
  parts.forEach((p, i) => {
    const name = `part-${String(i + 1).padStart(3, '0')}`
    writeFileSync(join(inDir, `${name}.tsv`), p.map(lineOf).join('\n') + '\n')
    writeFileSync(join(inDir, `${name}.json`), JSON.stringify(p))
  })
  const senses = all.reduce((n, j) => n + j.senses.length, 0)
  console.log(
    `${code}：${all.length} 个词条、${senses} 个义项要译，拆成 ${parts.length} 份 → ${inDir}`
  )
}

const lineOf = (j: Job): string =>
  [
    j.n,
    clean(j.w),
    j.senses[0].p,
    j.senses.map((s) => `[${s.p}] ${s.en.map(clean).join('; ')}`).join(SEP)
  ].join('\t')

function merge(code: LangCode): void {
  const { inDir, outDir } = dirs(code)
  if (!existsSync(inDir)) throw new Error(`没有 ${inDir}：先 split`)
  const file = mtFile(ROOT, code)
  const records = new Map<string, MtRecord>()
  if (existsSync(file))
    for (const line of readFileSync(file, 'utf8').split('\n'))
      if (line.trim()) {
        const r = JSON.parse(line) as MtRecord
        records.set(mtKey(r.w, r.p, r.en), r)
      }
  const before = records.size
  const bad: string[] = []
  let missing = 0
  for (const f of readdirSync(inDir)
    .filter((x) => x.endsWith('.json'))
    .sort()) {
    const name = f.replace(/\.json$/, '')
    const outFile = join(outDir, `${name}.tsv`)
    if (!existsSync(outFile)) {
      missing++
      continue
    }
    const part = JSON.parse(readFileSync(join(inDir, f), 'utf8')) as Job[]
    const lines = readFileSync(outFile, 'utf8').trim().split('\n')
    const problems: string[] = []
    if (lines.length !== part.length) problems.push(`行数 ${lines.length}≠${part.length}`)
    const got: MtRecord[] = []
    part.forEach((j, i) => {
      const [n, zh] = (lines[i] ?? '').split('\t')
      if (Number(n) !== j.n) return void problems.push(`第 ${i + 1} 行序号`)
      const zhs = (zh ?? '').split(/\s*‖\s*/).map((s) => s.trim())
      if (zhs.length !== j.senses.length || zhs.some((s) => !s))
        return void problems.push(`${j.w} 义项数`)
      j.senses.forEach((s, k) => got.push({ w: j.w, p: s.p, en: s.en.join('; '), zh: zhs[k] }))
    })
    if (problems.length) {
      bad.push(`${name}：${problems.slice(0, 5).join('，')}`)
      continue
    }
    for (const r of got) records.set(mtKey(r.w, r.p, r.en), r)
  }
  mkdirSync(join(file, '..'), { recursive: true })
  const sorted = [...records.values()].sort(
    (a, b) => a.w.localeCompare(b.w) || a.p.localeCompare(b.p) || a.en.localeCompare(b.en)
  )
  writeFileSync(file, sorted.map((r) => JSON.stringify(r)).join('\n') + '\n')
  console.log(
    `${code}：并进 ${records.size - before} 条（共 ${records.size} 条）→ ${file}` +
      (missing ? `；${missing} 份还没译` : '') +
      (bad.length ? `\n对不上、没收的：\n  ${bad.join('\n  ')}` : '')
  )
}

function status(code: LangCode): void {
  const { inDir, outDir } = dirs(code)
  const parts = existsSync(inDir) ? readdirSync(inDir).filter((x) => x.endsWith('.tsv')) : []
  const done = parts.filter((p) => existsSync(join(outDir, p)))
  console.log(
    `${code}：${parts.length} 份，译好 ${done.length} 份；已入库 ${loadMt(ROOT, code).size} 条`
  )
}

const [cmd, code, n] = process.argv.slice(2)
if (!code || !isLangCode(code)) {
  console.error('用法：mt.ts split|merge|status <代码> [条数]')
  process.exit(1)
}
if (cmd === 'split') split(code, Number(n) || 10000)
else if (cmd === 'merge') merge(code)
else if (cmd === 'status') status(code)
else {
  console.error(`不认识的命令：${cmd}`)
  process.exit(1)
}
