import { copyRuntimeDependencies, NATIVE_ASAR_OPTIONS } from './release/runtime-dependencies.mjs'
/** Build first. Creates a new local ASAR fixture; never downloads or reuses a release directory. */
import { createRequire } from 'node:module'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))
const asar = require('@electron/asar')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const expectedVersion = process.env.PROBE_VERSION || pkg.version
if (pkg.version !== expectedVersion)
  throw new Error(`Build version ${pkg.version}; expected ${expectedVersion}`)
for (const path of [
  'out/main/index.js',
  'out/main/analysis-worker.js',
  'out/preload/index.js',
  'out/renderer/index.html',
  'resources/data',
  'node_modules/electron/dist/electron.exe'
]) {
  if (!existsSync(join(root, path)))
    throw new Error(`Missing build/runtime input: ${path}. Build first.`)
}
mkdirSync(join(root, 'dist'), { recursive: true })
const output = mkdtempSync(join(root, 'dist', 'packaged-qa-'))
const runtime = join(output, 'runtime')
const staging = join(output, 'app-stage')
cpSync(join(root, 'node_modules/electron/dist'), runtime, { recursive: true })
mkdirSync(staging)
cpSync(join(root, 'out'), join(staging, 'out'), { recursive: true })
for (const folder of ['build', 'resources']) {
  if (existsSync(join(root, folder)))
    cpSync(join(root, folder), join(staging, folder), {
      recursive: true,
      filter: (source) =>
        !['resources/data', 'resources/speech'].some(
          (path) => resolve(source) === resolve(root, path)
        )
    })
}
const graph = copyRuntimeDependencies(root, staging)
writeFileSync(
  join(staging, 'package.json'),
  JSON.stringify(
    Object.fromEntries(
      ['name', 'productName', 'version', 'description', 'main', 'author', 'license', 'dependencies']
        .filter((key) => pkg[key] !== undefined)
        .map((key) => [key, pkg[key]])
    ),
    null,
    2
  )
)
const resources = join(runtime, 'resources')
mkdirSync(resources, { recursive: true })
cpSync(join(root, 'resources/speech'), join(resources, 'speech'), { recursive: true })
const appAsar = join(resources, 'app.asar')
await asar.createPackageWithOptions(staging, appAsar, NATIVE_ASAR_OPTIONS)
const defaultApp = join(resources, 'default_app.asar')
if (existsSync(defaultApp)) unlinkSync(defaultApp) // Only this newly copied runtime.
const data = realpathSync(join(root, 'resources/data'))
symlinkSync(data, join(resources, 'data'), 'junction') // Source is only read by QA; no source ACL changes.
const exe = join(runtime, 'Qonsona-QA.exe')
renameSync(join(runtime, 'electron.exe'), exe)
const manifest = {
  createdAt: new Date().toISOString(),
  root,
  output,
  exe,
  appAsar,
  data,
  version: pkg.version,
  // @electron/asar splits entry paths by the host path.sep (backslash on Windows).
  worker: asar.statFile(appAsar, join('out', 'main', 'analysis-worker.js')),
  dependencies: graph
}
writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(
  JSON.stringify(
    { manifest: join(output, 'manifest.json'), exe, appAsar, version: pkg.version },
    null,
    2
  )
)
