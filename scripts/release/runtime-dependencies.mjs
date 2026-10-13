import { createRequire } from 'node:module'
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const NATIVE_ASAR_OPTIONS = {
  unpackDir: '**/{onnxruntime-node,onnxruntime-common}'
}

export function packageRoot(name, from) {
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

/** Preserve parent-specific resolution, including installed optional dependencies. */
export function copyRuntimeDependencies(root, staging, names) {
  const graph = []
  function copy(name, from, targetParent, ancestors = new Set()) {
    const source = packageRoot(name, from)
    if (ancestors.has(source)) return
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
      copy(dependency, source, target, chain)
    for (const dependency of Object.keys(metadata.optionalDependencies || {})) {
      try {
        packageRoot(dependency, source)
      } catch {
        continue
      }
      copy(dependency, source, target, chain)
    }
  }
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  for (const name of names || Object.keys(pkg.dependencies || {})) copy(name, root, staging)
  return graph
}
