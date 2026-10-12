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
const expectedVersion = process.env.PROBE_VERSION || '0.2.0'
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
      filter: (source) => resolve(source) !== resolve(root, 'resources/data')
    })
}
const graph = []
function packageRoot(name, from) {
  const resolver = createRequire(join(from, 'package.json'))
  let path
  try {
    path = dirname(resolver.resolve(`${name}/package.json`))
  } catch {
    path = dirname(resolver.resolve(name))
  }
  while (true) {
    const candidate = join(path, 'package.json')
    if (existsSync(candidate) && JSON.parse(readFileSync(candidate, 'utf8')).name === name)
      return realpathSync(path)
    const parent = dirname(path)
    if (parent === path) throw new Error(`Cannot locate runtime package ${name}`)
    path = parent
  }
}
function copyDependency(name, from, targetParent, ancestors = new Set()) {
  const source = packageRoot(name, from)
  if (ancestors.has(source)) return // Node will resolve the already copied ancestor.
  const target = join(targetParent, 'node_modules', name)
  if (existsSync(target)) return
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, {
    recursive: true,
    filter: (path) => resolve(path) !== join(source, 'node_modules')
  })
  const metadata = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
  graph.push({ name, version: metadata.version, source, target })
  const chain = new Set([...ancestors, source])
  for (const dependency of Object.keys(metadata.dependencies || {}))
    copyDependency(dependency, source, target, chain)
  for (const dependency of Object.keys(metadata.optionalDependencies || {})) {
    try {
      packageRoot(dependency, source)
    } catch {
      continue
    }
    copyDependency(dependency, source, target, chain)
  }
}
for (const name of Object.keys(pkg.dependencies || {})) copyDependency(name, root, staging)
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
const appAsar = join(resources, 'app.asar')
await asar.createPackage(staging, appAsar)
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
