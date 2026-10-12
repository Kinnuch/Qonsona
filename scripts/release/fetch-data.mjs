// CI 打包前：从草稿 Release「build-data」取清单指定的版本化词典，解到 resources/data/。
// 数据库不入库；上传保留旧版资产，下载逐文件核对清单中的大小和 SHA-256。
//   GITHUB_TOKEN=… node scripts/release/fetch-data.mjs
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATA_RELEASE, downloadAsset, findRelease } from './github.mjs'
import { verifyBundle } from './data-bundle.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifest = JSON.parse(readFileSync(join(root, 'data/release-data.json'), 'utf8'))
const rel = await findRelease(DATA_RELEASE)
const asset = rel?.assets?.find((a) => a.name === manifest.asset)
if (!asset) {
  console.error(`找不到 Release「${DATA_RELEASE}」里的 ${manifest.asset}`)
  process.exit(1)
}
const zip = await downloadAsset(asset)
const files = verifyBundle(zip, manifest)
for (const [name, bytes] of Object.entries(files)) {
  if (name.endsWith('/')) continue
  if (name.split('/').some((p) => p === '..' || !p)) throw new Error(`不安全的路径：${name}`)
  const out = join(root, 'resources', 'data', ...name.split('/'))
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out + '.tmp', bytes)
  renameSync(out + '.tmp', out)
  console.log(`${name}  ${(statSync(out).size / 1048576).toFixed(1)} MB`)
}
