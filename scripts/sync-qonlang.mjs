#!/usr/bin/env node
/**
 * 从千语集仓库同步引擎快照到 src/renderer/src/vendor/qonlang/。
 *
 * 为什么是快照：学习软件读的就是千语集的 .laim.json，解析、迁移、音变、构形、分词、文字转写
 * 必须跟千语集是同一份代码，才能保证两边看到的词形、读音、文字写法一模一样。
 *
 * 取的是**已提交**的版本（git show <ref>:路径），不读工作区——千语集那边经常有没提交的改动。
 *
 * 用法：
 *   node scripts/sync-qonlang.mjs                 取 ../Qonlang 的 HEAD
 *   node scripts/sync-qonlang.mjs --ref v0.12.2   取某个标签或提交
 *   QONLANG_DIR=D:/Qonlang node scripts/sync-qonlang.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs'
import { dirname, join, resolve, posix } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { transform } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const src = resolve(process.env.QONLANG_DIR || join(root, '..', 'Qonlang'))
const refArg = process.argv.indexOf('--ref')
const ref = refArg > 0 ? process.argv[refArg + 1] : 'HEAD'
const out = join(root, 'src/renderer/src/vendor/qonlang')

const LIB = 'src/renderer/src/lib'
/** 整个目录拷过来的部分：数据模型与读写、音系与规则引擎、构形、分词、文字 */
const DIRS = ['core', 'engine', 'script', 'ipa']
/** 这几个文件依赖千语集的界面状态，学习软件用不上 */
const SKIP = new Set([
  'core/guide.ts', // 使用指南网址，依赖界面语言状态
  'core/tourSteps.ts', // 图文引导的步骤
  'engine/gloss/resolve.ts' // 语料悬浮卡的状态
])

const git = (...args) =>
  execFileSync('git', ['-C', src, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 })

if (!existsSync(join(src, '.git'))) {
  console.error(`找不到千语集仓库：${src}（可以用 QONLANG_DIR 指定）`)
  process.exit(1)
}

const commit = git('rev-parse', ref).trim()
const commitDate = git('show', '-s', '--format=%cI', commit).trim()
const subject = git('show', '-s', '--format=%s', commit).trim()
const appVersion = JSON.parse(git('show', `${commit}:package.json`)).version

const files = git('ls-tree', '-r', '--name-only', commit, ...DIRS.map((d) => `${LIB}/${d}`))
  .split('\n')
  .filter((f) => f.endsWith('.ts'))
  .map((f) => f.slice(LIB.length + 1))
  .filter((f) => !SKIP.has(f))

rmSync(out, { recursive: true, force: true })

const write = (rel, text) => {
  const p = join(out, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, text)
}

const HEADER = (rel) =>
  `// 千语集 ${appVersion}（${commit.slice(0, 7)}）的 ${LIB}/${rel}，由 scripts/sync-qonlang.mjs 同步，别手改。\n`

for (const rel of files) {
  const text = git('show', `${commit}:${LIB}/${rel}`).replace(/(['"])\$lib\//g, '$1$qon/')
  write(rel, HEADER(rel) + text)
}

// ── 垫片：引擎里少数几处引用了界面层的常量 ──

// core/sealed.ts 的密钥碎片之一在 ui/flash.ts
const flash = git('show', `${commit}:${LIB}/ui/flash.ts`)
const seq = flash.match(/^export const FLASH_SEQ = .*$/m)
if (!seq) throw new Error('ui/flash.ts 里找不到 FLASH_SEQ')
write('ui/flash.ts', HEADER('ui/flash.ts（只取 FLASH_SEQ）') + seq[0] + '\n')

// 界面文案里取几组名字：core/stressInfo.ts 按语素类型的中英文名认重音规则里的 <类型>；
// 学习软件显示语素类型、词源类别、文字类型时也用千语集的叫法
const I18N_PATHS = ['morphemes.types', 'lexicon.etyTypes', 'script.types']
const tmp = mkdtempSync(join(tmpdir(), 'qon-i18n-'))
for (const lang of ['zh', 'en']) {
  const ts = git('show', `${commit}:${LIB}/i18n/${lang}.ts`)
  const { code } = await transform(ts, { loader: 'ts', format: 'esm' })
  const file = join(tmp, `${lang}.mjs`)
  writeFileSync(file, code)
  const dict = (await import(pathToFileURL(file).href)).default
  const picked = {}
  for (const path of I18N_PATHS) {
    const keys = path.split('.')
    const value = keys.reduce((o, k) => o?.[k], dict)
    if (!value) throw new Error(`i18n/${lang}.ts 里找不到 ${path}`)
    let node = picked
    for (const k of keys.slice(0, -1)) node = node[k] ??= {}
    node[keys.at(-1)] = value
  }
  write(
    `i18n/${lang}.ts`,
    HEADER(`i18n/${lang}.ts（只取 ${I18N_PATHS.join('、')}）`) +
      `export default ${JSON.stringify(picked, null, 2)} as const\n`
  )
}
rmSync(tmp, { recursive: true, force: true })

// ── 检查：快照里的每个引用都要能在快照里找到 ──

const present = new Set([...files, 'ui/flash.ts', 'i18n/zh.ts', 'i18n/en.ts'])
const dangling = []
for (const rel of files) {
  const text = git('show', `${commit}:${LIB}/${rel}`)
  for (const m of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1]
    let target
    if (spec.startsWith('$lib/')) target = spec.slice(5)
    else if (spec.startsWith('.')) target = posix.normalize(posix.join(posix.dirname(rel), spec))
    else continue
    const hit = [target, `${target}.ts`, `${target}/index.ts`].some((t) => present.has(t))
    if (!hit) dangling.push(`${rel} → ${spec}`)
  }
}

write(
  'VERSION.json',
  JSON.stringify(
    {
      qonlangVersion: appVersion,
      commit,
      commitDate,
      subject,
      files: present.size,
      skipped: [...SKIP]
    },
    null,
    2
  ) + '\n'
)

console.log(`千语集 ${appVersion} @ ${commit.slice(0, 7)}（${commitDate}）：${present.size} 个文件`)
if (dangling.length) {
  console.error('下面这些引用在快照里找不到，需要补垫片或加进 DIRS：')
  for (const d of dangling) console.error('  ' + d)
  process.exit(2)
}
