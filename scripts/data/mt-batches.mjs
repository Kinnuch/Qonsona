#!/usr/bin/env node
/**
 * 准备「由英文释义翻译成中文」的任务：常用词与 JLPT 词（dict.sqlite 里 common = 1 或有 jlpt 的词条）。
 * 其余词条的中文释义用 Tomoshi 开放数据（见 tomoshi.mjs）。
 *
 *   node scripts/data/mt-batches.mjs split   → .cache/mt/in/part-NNN.tsv（每份 150 个词条）
 *   node scripts/data/mt-batches.mjs merge   → data/zh/mt-en/mt-en.jsonl（检查义项数对得上）
 *
 * 输入每行（制表符分隔）：词条号  词头  读音  义项1 ‖ 义项2 ‖ …
 *   每个义项写成「[词性,词性] 英文释义; 英文释义」
 * 译文每行：词条号  中文1 ‖ 中文2 ‖ …（义项个数与输入一致）
 */
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { root } from './sources.mjs'

const DB = join(root, 'resources/data/ja/dict.sqlite')
const IN = join(root, '.cache/mt/in')
const OUT = join(root, '.cache/mt/out')
const DEST = join(root, 'data/zh/mt-en')
const PART = 150
const MAX_CHARS = 12000
const SEP = ' ‖ '

function entries() {
  const db = new DatabaseSync(DB, { readOnly: true })
  const zdict = Buffer.from(
    db.prepare("SELECT value FROM meta WHERE key = 'zdict'").get().value,
    'base64'
  )
  const rows = db
    .prepare(
      'SELECT id, head, reading, data FROM entry WHERE common = 1 OR jlpt IS NOT NULL ORDER BY jlpt DESC NULLS LAST, score DESC, id'
    )
    .all()
  db.close()
  return rows.map((r) => {
    const d = JSON.parse(inflateRawSync(r.data, { dictionary: zdict }).toString())
    return { id: r.id, h: r.head, r: r.reading, s: d.s }
  })
}

const clean = (s) => s.replace(/[\t\n‖]/g, ' ')

const [cmd] = process.argv.slice(2)
if (cmd === 'split') {
  const all = entries().map((e) =>
    [
      e.id,
      e.h,
      e.r,
      e.s.map((s) => `[${(s.p ?? []).join(',')}] ${s.g.map(clean).join('; ')}`).join(SEP)
    ].join('\t')
  )
  mkdirSync(IN, { recursive: true })
  // 每份最多 PART 个词条、约 MAX_CHARS 个字（一次能完整读进来）
  const parts = [[]]
  let chars = 0
  for (const line of all) {
    if (parts.at(-1).length >= PART || (chars + line.length > MAX_CHARS && parts.at(-1).length)) {
      parts.push([])
      chars = 0
    }
    parts.at(-1).push(line)
    chars += line.length + 1
  }
  parts.forEach((p, i) =>
    writeFileSync(join(IN, `part-${String(i + 1).padStart(3, '0')}.tsv`), p.join('\n') + '\n')
  )
  console.log(`${all.length} 个词条分成 ${parts.length} 份 → ${IN}`)
} else if (cmd === 'merge') {
  const want = new Map()
  for (const f of readdirSync(IN).filter((x) => x.endsWith('.tsv')))
    for (const line of readFileSync(join(IN, f), 'utf8').split('\n').filter(Boolean)) {
      const [id, h, , senses] = line.split('\t')
      want.set(Number(id), { h, n: senses.split(SEP).length })
    }
  const got = new Map()
  const problems = []
  for (const f of existsSync(OUT) ? readdirSync(OUT).filter((x) => x.endsWith('.tsv')) : []) {
    for (const line of readFileSync(join(OUT, f), 'utf8').split('\n')) {
      if (!line.trim()) continue
      const tab = line.indexOf('\t')
      const id = Number(line.slice(0, tab))
      const senses = line
        .slice(tab + 1)
        .split(/\s*‖\s*/)
        .map((s) => s.trim())
      const src = want.get(id)
      if (!src) problems.push(`${f}: 对不上的行：${line.slice(0, 60)}`)
      else if (senses.length !== src.n)
        problems.push(`${f}: ${id} ${src.h} 义项数 ${senses.length} ≠ ${src.n}`)
      else got.set(id, senses)
    }
  }
  const missing = [...want.keys()].filter((id) => !got.has(id))
  mkdirSync(DEST, { recursive: true })
  const lines = [...got.entries()]
    .sort((a, b) => a[0] - b[0])
    .flatMap(([id, s]) => s.map((text, sense) => ({ id, sense, text })))
    .filter((x) => x.text)
    .map((x) => JSON.stringify(x))
  writeFileSync(join(DEST, 'mt-en.jsonl'), lines.join('\n') + '\n')
  writeFileSync(
    join(DEST, 'source.json'),
    JSON.stringify(
      {
        name: '常用词与 JLPT 词的中文释义：由 JMdict 英文释义翻译（机器翻译，未经人工逐条校对）',
        license: 'CC BY-SA 4.0（随 JMdict）',
        credit: 'Qonsona 开发时批量翻译',
        home: 'https://www.edrdg.org/jmdict/j_jmdict.html',
        priority: 1
      },
      null,
      2
    ) + '\n'
  )
  console.log(
    `译好 ${got.size} / ${want.size} 个词条，${lines.length} 个义项；缺 ${missing.length} 个`
  )
  for (const p of problems.slice(0, 30)) console.log('  ' + p)
  if (problems.length > 30) console.log(`  ……另有 ${problems.length - 30} 处`)
  writeFileSync(join(root, '.cache/mt/missing.json'), JSON.stringify(missing))
} else {
  console.log('用法：mt-batches.mjs split | merge')
}
