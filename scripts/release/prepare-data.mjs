import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATA_FILES, makeBundle, verifyBundle } from './data-bundle.mjs'
export function prepareData() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const files = Object.fromEntries(
    DATA_FILES.map((path) => [
      path,
      new Uint8Array(readFileSync(join(root, 'resources/data', path)))
    ])
  )
  const { zip, manifest } = makeBundle(files, version)
  verifyBundle(zip, manifest)
  const output = join(root, 'dist/release-data')
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, manifest.asset), zip)
  writeFileSync(join(root, 'data/release-data.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(
    JSON.stringify({
      asset: manifest.asset,
      bytes: manifest.bytes,
      sha256: manifest.sha256,
      files: manifest.files.length
    })
  )
  return { zip, manifest }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepareData()
