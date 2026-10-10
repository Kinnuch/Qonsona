/**
 * 列出词典里用到、但界面（src/shared/lang/tags.ts）还没有中文叫法的标签、变形类别、特有字段（报给主线加）：
 *   node scripts/data/run-ts.mjs scripts/data/fr/tags-check.ts
 */
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { unpackEntry } from '../../../src/main/lang/lexdb-schema'
import { TAG_LABELS } from '../../../src/shared/lang/tags'
import { dataDir } from '../../lang/lexdb-writer'

const db = new DatabaseSync(join(dataDir('fr'), 'dict.sqlite'), { readOnly: true })
const count = (m: Map<string, number>, k: string): void => void m.set(k, (m.get(k) ?? 0) + 1)
const formTags = new Map<string, number>()
const senseTags = new Map<string, number>()
const cls = new Map<string, number>()
const x = new Map<string, number>()
for (const r of db.prepare('SELECT data FROM entry').all() as { data: Uint8Array }[]) {
  const d = unpackEntry(r.data)
  for (const [, ...t] of d.f ?? []) for (const tag of t) count(formTags, tag)
  for (const s of d.s) for (const tag of [...(s.t ?? []), ...(s.dom ?? [])]) count(senseTags, tag)
  for (const c of d.cls ?? []) count(cls, c)
  for (const k of Object.keys(d.x ?? {})) count(x, k)
}
const missing = (m: Map<string, number>): string =>
  [...m]
    .filter(([k]) => !TAG_LABELS[k])
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}`)
    .join('，')
console.log('变形标签（没有叫法的）：' + missing(formTags))
console.log('义项标签（没有叫法的）：' + missing(senseTags))
console.log('变形类别：' + [...cls].map(([k, n]) => `${k} ${n}`).join('，'))
console.log('特有字段：' + [...x].map(([k, n]) => `${k} ${n}`).join('，'))
