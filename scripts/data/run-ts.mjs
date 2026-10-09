/**
 * 用 esbuild 把一个 TS 脚本打包到临时文件再运行；临时文件名各不相同，几个进程同时跑也不会互相覆盖。
 * 用法：node scripts/data/run-ts.mjs scripts/data/grammar-probe.ts [参数…]
 */
import { build } from 'esbuild'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [entry, ...rest] = process.argv.slice(2)
mkdirSync('.cache', { recursive: true })
const out = resolve('.cache', `run-${process.pid}-${Date.now()}.mjs`)
await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  logLevel: 'warning',
  outfile: out,
  // 跟 vitest、electron-vite 一样的路径别名
  alias: {
    $lib: resolve('src/renderer/src/lib'),
    $qon: resolve('src/renderer/src/vendor/qonlang'),
    $shared: resolve('src/shared')
  }
})
process.on('exit', () => rmSync(out, { force: true }))
process.argv = [process.argv[0], out, ...rest]
await import(pathToFileURL(out).href)
