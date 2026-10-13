import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { copyRuntimeDependencies, NATIVE_ASAR_OPTIONS } from './runtime-dependencies.mjs'

const [mode, target, archive] = process.argv.slice(2)
if (mode === 'copy' && target) {
  console.log(JSON.stringify(copyRuntimeDependencies(process.cwd(), resolve(target))))
} else if (mode === 'asar' && target && archive) {
  const asar = createRequire(resolve('package.json'))('@electron/asar')
  await asar.createPackageWithOptions(resolve(target), resolve(archive), NATIVE_ASAR_OPTIONS)
} else {
  throw new Error('Usage: pack-runtime.mjs copy <stage> | asar <stage> <archive>')
}
