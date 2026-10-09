/**
 * 日语词条的中文释义。每个来源一个目录：data/zh/<来源>/
 *   source.json   { name, license, credit, home, priority }：界面上的署名；priority 小的排前面
 *   *.jsonl       每行 { "id": JMdict 词条号, "sense": 第几个义项（从 0 数，整个词条的写 null）, "text": "中文" }
 *
 * 目前的来源：
 *   mt-en   从 JMdict 英文释义翻译过来的（开发时批量翻译，界面上标「译自英文」）
 * 开放许可的日中辞典找到后，照同样格式放一个目录即可。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { root } from './sources.mjs'

const DIR = join(root, 'data/zh')

function sourceDirs() {
  if (!existsSync(DIR)) return []
  return readdirSync(DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(DIR, d.name, 'source.json')))
    .map((d) => ({
      key: d.name,
      ...JSON.parse(readFileSync(join(DIR, d.name, 'source.json'), 'utf8'))
    }))
    .sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9))
}

/** 词条号 → [{ sense, text, source }]，按来源的 priority 排 */
export function loadChinese() {
  const out = new Map()
  for (const src of sourceDirs()) {
    const dir = join(DIR, src.key)
    for (const f of readdirSync(dir)
      .filter((n) => n.endsWith('.jsonl'))
      .sort()) {
      for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
        if (!line.trim()) continue
        const row = JSON.parse(line)
        const text = String(row.text ?? '').trim()
        if (!row.id || !text) continue
        let list = out.get(Number(row.id))
        if (!list) out.set(Number(row.id), (list = []))
        list.push({ sense: row.sense ?? null, text, source: src.key })
      }
    }
  }
  return out
}

/** 写进 meta.sources 的署名 */
loadChinese.sources = () =>
  sourceDirs().map(({ key, name, license, credit, home }) => ({ key, name, license, credit, home }))
