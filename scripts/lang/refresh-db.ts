/**
 * 沿用已有数据刷新查词键与已有中文补译，保持词条/例句 id，生词本引用不会漂移。
 * 不联网、不重新取来源；用统一写库器在旁边生成完整新库，完成后才替换。
 * node scripts/data/run-ts.mjs scripts/lang/refresh-db.ts gd [dict.sqlite 路径]
 */
import { DatabaseSync } from 'node:sqlite'
import { renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { isLangCode } from '../../src/shared/lang/registry'
import type { LangCode, LexExample, SourceRef } from '../../src/shared/lang/types'
import { unpackEntry } from '../../src/main/lang/lexdb-schema'
import { LexDbWriter, dataDir } from './lexdb-writer'

export function refreshDb(
  code: LangCode,
  file: string
): { entries: number; examples: number; bytes: number } {
  const source = new DatabaseSync(file, { readOnly: true })
  const output = `${file}.refreshed`
  let writer: LexDbWriter | null = null
  try {
    const meta = new Map(
      (source.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[]).map(
        (r) => [r.key, r.value]
      )
    )
    if (meta.get('lang') !== code) throw new Error('数据语言不符，拒绝刷新')
    writer = new LexDbWriter(code, { file: output })
    for (const ref of JSON.parse(meta.get('sources') ?? '[]') as SourceRef[]) writer.source(ref)
    for (const [key, value] of meta)
      if (!['schema', 'lang', 'sources', 'counts', 'lists', 'builtAt'].includes(key))
        writer.meta(key, value)
    for (const r of source.prepare('SELECT id, data FROM entry ORDER BY id').iterate() as Iterable<{
      id: number
      data: Uint8Array
    }>) {
      if (writer.entry(unpackEntry(r.data)) !== Number(r.id))
        throw new Error('词条 id 不连续，拒绝改变学习记录引用')
    }
    // 保留所有额外词形和标签（词根、汉字、旧拼写），让写库器按当前语言规则重新建严格/宽松键。
    writer.db.exec('DELETE FROM form; DELETE FROM list')
    for (const r of source
      .prepare('SELECT entry, form, tags FROM form WHERE loose = 0')
      .iterate() as Iterable<{ entry: number; form: string; tags: string }>)
      writer.form(Number(r.entry), r.form, r.tags.split(' ').filter(Boolean))
    for (const r of source
      .prepare('SELECT * FROM example ORDER BY id')
      .iterate() as Iterable<LexExample>) {
      if (writer.example(r) !== Number(r.id))
        throw new Error('例句 id 不连续，拒绝改变学习记录引用')
    }
    for (const r of source
      .prepare('SELECT example, entry FROM example_entry')
      .iterate() as Iterable<{ example: number; entry: number }>)
      writer.link(Number(r.example), Number(r.entry))
    for (const r of source.prepare('SELECT name, entry, rank FROM list').iterate() as Iterable<{
      name: string
      entry: number
      rank: number | null
    }>)
      writer.list(r.name, Number(r.entry), r.rank ?? undefined)
    const stats = writer.finish()
    source.close()
    // Windows 在原库没有打开的情况下原子替换；失败时原库仍在。
    renameSync(output, file)
    return { entries: stats.entries, examples: stats.examples, bytes: stats.bytes }
  } catch (error) {
    try {
      source.close()
    } catch {
      /* 已关闭 */
    }
    try {
      writer?.db.close()
    } catch {
      /* finish 已关闭 */
    }
    rmSync(output, { force: true })
    rmSync(`${output}.building`, { force: true })
    throw error
  }
}

const code = process.argv[2]
if (isLangCode(code ?? ''))
  console.log(
    refreshDb(code as LangCode, process.argv[3] ?? join(dataDir(code as LangCode), 'dict.sqlite'))
  )
