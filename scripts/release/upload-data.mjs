// 本机重新生成了词典数据（npm run data:ja、wiktionary-ja.mjs）之后：把 resources/data/ 打成 ja-data.zip，
// 换掉草稿 Release「build-data」里的那份——CI 打安装包时从那里取（fetch-data.mjs）。没有这个草稿就建一个。
//   node scripts/release/upload-data.mjs
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'
import { DATA_ASSET, DATA_RELEASE, REPO, api, findRelease, token } from './github.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const dataDir = join(root, 'resources', 'data')
if (!existsSync(join(dataDir, 'ja', 'dict.sqlite'))) {
  console.error('resources/data/ja/dict.sqlite 不存在：先跑 npm run data:ja')
  process.exit(1)
}

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.isFile() ? [join(dir, e.name)] : []
  )
const entries = {}
for (const file of walk(dataDir)) {
  const name = relative(dataDir, file).split(sep).join('/')
  entries[name] = [new Uint8Array(readFileSync(file)), { level: 6 }]
  console.log(`${name}  ${(statSync(file).size / 1048576).toFixed(1)} MB`)
}
const zip = zipSync(entries)
console.log(`${DATA_ASSET}  ${(zip.length / 1048576).toFixed(1)} MB`)

let rel = await findRelease(DATA_RELEASE)
if (!rel) {
  rel = await (
    await api(`/repos/${REPO}/releases`, {
      method: 'POST',
      body: {
        tag_name: DATA_RELEASE,
        name: DATA_RELEASE,
        draft: true,
        body: '打包用的词典数据（resources/data），CI 从这里取；不是给用户下载的版本。\nDictionary data for CI builds — not a release.'
      }
    })
  ).json()
  console.log(`建了草稿 Release「${DATA_RELEASE}」`)
}
for (const old of rel.assets ?? [])
  if (old.name === DATA_ASSET)
    await api(`/repos/${REPO}/releases/assets/${old.id}`, { method: 'DELETE' })

const upload = rel.upload_url.replace(/\{.*$/, '') + `?name=${DATA_ASSET}`
const res = await fetch(upload, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token()}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/zip',
    'User-Agent': 'qonsona-release'
  },
  body: zip
})
if (!res.ok) throw new Error(`上传失败：${res.status} ${await res.text()}`)
const done = await res.json()
console.log(`传好了：${done.name} ${done.size} 字节，${done.digest ?? ''}`)
