/**
 * 把法语数据的原始文件都下到 .cache/data/fr/（已经有的跳过）。
 *   node scripts/data/run-ts.mjs scripts/data/fr/download.ts            全部
 *   node scripts/data/run-ts.mjs scripts/data/fr/download.ts enwikt …   只下这几份
 */
import { fetchFile } from './fetch'
import { DOWNLOADS, type DownloadId } from './sources'

const want = process.argv.slice(2) as DownloadId[]
const ids = (want.length ? want : (Object.keys(DOWNLOADS) as DownloadId[])).filter((id) => {
  if (id in DOWNLOADS) return true
  console.error(`没有这份来源：${id}（有 ${Object.keys(DOWNLOADS).join('、')}）`)
  process.exitCode = 2
  return false
})
for (const id of ids) {
  const d = DOWNLOADS[id]
  await fetchFile(d.url, d.file)
}
