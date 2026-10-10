/**
 * 只下载俄语的原始数据（不建库），可以放后台先下：
 *   node scripts/data/run-ts.mjs scripts/data/ru/download.ts            全部
 *   node scripts/data/run-ts.mjs scripts/data/ru/download.ts kaikkiEn   只下这几份
 */
import { fetchAll, type RawKey } from './fetch'
import { RAW } from './sources'

const keys = (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(RAW)) as RawKey[]
for (const k of keys)
  if (!RAW[k]) throw new Error(`没有 ${k} 这份数据；有：${Object.keys(RAW).join(' ')}`)
await fetchAll(keys)
console.log('都下好了')
