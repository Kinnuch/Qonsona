// CI 打包前：从草稿 Release「build-data」取词典数据（ja-data.zip），解到 resources/data/。
// 词典数据库约 115 MB，不入库；本机重新生成后用 upload-data.mjs 换掉那份 zip。
//   GITHUB_TOKEN=… node scripts/release/fetch-data.mjs
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import { DATA_ASSET, DATA_RELEASE, downloadAsset, findRelease } from './github.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const rel = await findRelease(DATA_RELEASE)
const asset = rel?.assets?.find((a) => a.name === DATA_ASSET)
if (!asset) {
  console.error(`找不到 Release「${DATA_RELEASE}」里的 ${DATA_ASSET}`)
  process.exit(1)
}
const zip = await downloadAsset(asset)
const files = unzipSync(zip)
for (const [name, bytes] of Object.entries(files)) {
  if (name.endsWith('/')) continue
  if (name.split('/').some((p) => p === '..' || !p)) throw new Error(`不安全的路径：${name}`)
  const out = join(root, 'resources', 'data', ...name.split('/'))
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, bytes)
  console.log(`${name}  ${(statSync(out).size / 1048576).toFixed(1)} MB`)
}
