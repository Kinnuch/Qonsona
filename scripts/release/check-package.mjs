/** Read-only release gate. Usage: node scripts/release/check-package.mjs <Resources directory>. */
import { createHash } from 'node:crypto'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATA_FILES } from './data-bundle.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
if (process.argv.length !== 3)
  throw new Error('Usage: node scripts/release/check-package.mjs <Resources directory>')
const resources = resolve(process.argv[2])
const expected = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(root, 'data/release-data.json'), 'utf8'))
const asar = createRequire(join(root, 'package.json'))('@electron/asar')
const archive = join(resources, 'app.asar')
const entryPath = (path) => join(...path.split('/')) // ASAR API uses host path.sep.
const metadata = JSON.parse(asar.extractFile(archive, 'package.json').toString())
if (metadata.name !== expected.name || metadata.version !== expected.version)
  throw new Error(
    `Package identity mismatch: ${metadata.name}@${metadata.version}; expected ${expected.name}@${expected.version}`
  )
if (
  manifest.format !== 1 ||
  manifest.version !== expected.version ||
  !Array.isArray(manifest.files)
)
  throw new Error('Release dictionary manifest format/version mismatch')
const files = new Map(manifest.files.map((file) => [file.path, file]))
if (
  manifest.files.length !== DATA_FILES.length ||
  files.size !== DATA_FILES.length ||
  DATA_FILES.some((file) => !files.has(file))
)
  throw new Error('Release dictionary manifest must contain exactly all nine required databases')
for (const path of DATA_FILES) {
  const file = join(resources, 'data', ...path.split('/'))
  const info = files.get(path)
  if (!Number.isSafeInteger(info.bytes) || info.bytes <= 0 || !/^[a-f0-9]{64}$/.test(info.sha256))
    throw new Error(`Invalid manifest metadata: ${path}`)
  if (statSync(file).size !== info.bytes) throw new Error(`Dictionary size mismatch: ${path}`)
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(file)) hash.update(bytes)
  if (hash.digest('hex') !== info.sha256) throw new Error(`Dictionary SHA256 mismatch: ${path}`)
  console.log(`PASS database ${path} (${info.bytes} bytes)`)
}
const nonempty = (path) => {
  const info = asar.statFile(archive, entryPath(path))
  if (!info.size) throw new Error(`Missing/empty ASAR file: ${path}`)
}
for (const path of [
  'out/main/index.js',
  'out/main/analysis-worker.js',
  'out/preload/index.js',
  'out/renderer/index.html'
])
  nonempty(path)
const contents = asar
  .listPackage(archive)
  .map((path) => path.replaceAll('\\', '/').replace(/^\//, ''))
const chunks = contents.filter((path) => /^out\/main\/chunks\/.+\.js$/.test(path))
if (!chunks.length) throw new Error('Missing main/worker bundled chunks')
for (const path of chunks) nonempty(path)
for (const owner of ['out/main/index.js', 'out/main/analysis-worker.js', ...chunks]) {
  const body = asar.extractFile(archive, entryPath(owner)).toString()
  for (const match of body.matchAll(/require\(["'](\.[^"']+\.js)["']\)/g)) {
    const target = normalize(join(dirname(entryPath(owner)), match[1])).replaceAll('\\', '/')
    nonempty(target)
  }
}
const kuromojiFiles = [
  'base',
  'cc',
  'check',
  'tid_map',
  'tid_pos',
  'tid',
  'unk_char',
  'unk_compat',
  'unk_invoke',
  'unk_map',
  'unk_pos',
  'unk'
]
for (const name of kuromojiFiles) nonempty(`node_modules/kuromoji/dict/${name}.dat.gz`)
console.log(
  `PASS ${metadata.name}@${metadata.version}: nine verified databases, ${chunks.length} main chunks, worker, renderer/preload, ${kuromojiFiles.length} kuromoji dictionaries; ${resources}`
)
