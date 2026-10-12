/** Runs only the newly prepared package (or PROBE_EXE), with a fresh profile. Never targets user instances. */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
mkdirSync(dist, { recursive: true })
const output = mkdtempSync(join(dist, 'smoke-packaged-'))
const require = createRequire(join(root, 'package.json'))
const asar = require('@electron/asar')
const candidates = readdirSync(dist)
  .filter(
    (name) => name.startsWith('packaged-qa-') && existsSync(join(dist, name, 'manifest.json'))
  )
  .sort(
    (a, b) =>
      statSync(join(dist, b, 'manifest.json')).mtimeMs -
      statSync(join(dist, a, 'manifest.json')).mtimeMs
  )
const manifestPath =
  process.env.PROBE_MANIFEST || (candidates[0] && join(dist, candidates[0], 'manifest.json'))
const manifest = manifestPath ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null
const exe = process.env.PROBE_EXE || manifest?.exe
if (!exe || !existsSync(exe)) throw new Error('Run prepare-packaged-qa.mjs first or set PROBE_EXE.')
const appAsar = join(dirname(exe), 'resources', 'app.asar')
if (!existsSync(appAsar)) throw new Error(`Executable has no sibling app.asar: ${exe}`)
const packagedMetadata = JSON.parse(asar.extractFile(appAsar, 'package.json').toString())
const userData = join(output, 'profile')
mkdirSync(userData)
writeFileSync(
  join(userData, 'prefs.json'),
  JSON.stringify({ activePackId: 'en', nhkEasy: false, checkUpdates: false })
)
const port = Number(process.env.PROBE_PORT || 9552)
// Refuse an occupied CDP endpoint; never connect to somebody else's Electron.
try {
  await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) })
  throw new Error(`CDP ${port} is already occupied`)
} catch (error) {
  if (error.message.includes('already occupied')) throw error
}
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(exe, [`--user-data-dir=${userData}`, `--remote-debugging-port=${port}`], {
  env,
  stdio: ['ignore', 'pipe', 'pipe']
})
let stdout = '',
  stderr = '',
  ws,
  exitCode = null
child.stdout.on('data', (data) => {
  stdout += data.toString()
})
child.stderr.on('data', (data) => {
  stderr += data.toString()
})
child.on('exit', (code) => {
  exitCode = code
})
const results = [],
  errors = []
child.on('error', (error) => {
  errors.push(error.stack || String(error))
  exitCode = -1
})
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(detail)}`)
  if (!ok) throw new Error(name)
}
try {
  const expected = process.env.PROBE_VERSION || '0.2.0'
  check('ASAR metadata version', packagedMetadata.version === expected, packagedMetadata.version)
  let page
  for (let i = 0; i < 200 && !page; i++) {
    try {
      page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (item) => item.type === 'page' && item.url.includes('app.asar')
      )
    } catch {
      /* starting */
    }
    if (exitCode !== null) throw new Error(`Owned Electron exited ${exitCode}: ${stderr}`)
    if (!page) await sleep(100)
  }
  check('renderer loaded from actual ASAR', !!page, page?.url)
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((done, fail) => {
    ws.onopen = done
    ws.onerror = fail
  })
  let sequence = 0
  const pending = new Map()
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (message.id) {
      pending.get(message.id)?.(message)
      pending.delete(message.id)
    } else if (message.method === 'Runtime.exceptionThrown')
      errors.push(message.params.exceptionDetails)
  }
  const send = (method, params = {}) =>
    new Promise((done, fail) => {
      const id = ++sequence
      const timer = setTimeout(() => {
        pending.delete(id)
        fail(new Error(`CDP timeout ${method}`))
      }, 45000)
      pending.set(id, (message) => {
        clearTimeout(timer)
        message.error ? fail(new Error(JSON.stringify(message.error))) : done(message.result)
      })
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails))
    return response.result.value
  }
  for (let i = 0; i < 150; i++) {
    if (await evaluate('!!window.qstudy?.invoke')) break
    await sleep(100)
  }
  const invoke = (channel, ...args) =>
    evaluate(
      `Promise.race([window.qstudy.invoke(${[channel, ...args].map((arg) => JSON.stringify(arg)).join(',')}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('IPC timeout: ${channel}')),30000))])`
    )
  const info = await invoke('app:info')
  check('runtime app version', info.version === expected, info)
  const snippets = {
    en: 'The library is open today.',
    fr: 'La bibliothèque est ouverte aujourd’hui.',
    ko: '오늘 도서관에 갑니다.',
    es: 'La biblioteca está abierta hoy.',
    ar: 'الكتاب على الطاولة.',
    ru: 'Сегодня библиотека открыта.',
    gd: 'Tha an leabhar air a’ bhòrd.'
  }
  for (const code of Object.keys(snippets)) {
    const [status] = await invoke('lang:status', [code])
    check(`${code} packaged dictionary status`, status.available && status.entries > 0, status)
  }
  check('ja packaged dictionary available', await invoke('ja:available'), true)
  const japanese = await invoke('ja:search', '食べる')
  check('ja exemplar search', japanese?.hits?.length > 0, japanese?.hits?.slice(0, 1))
  const entry = await invoke('ja:entry', japanese.hits[0].id)
  check('ja exemplar entry', !!entry, { id: japanese.hits[0].id })
  for (const code of [...Object.keys(snippets), 'ja']) {
    const daily = await invoke('dictionary:daily', code, '2026-10-12')
    check(
      `${code} daily IPC`,
      daily?.packId === code &&
        daily.words?.length > 0 &&
        daily.sentences?.length > 0 &&
        daily.grammar?.length > 0,
      {
        words: daily?.words?.length,
        sentences: daily?.sentences?.length,
        grammar: daily?.grammar?.length
      }
    )
  }
  // Run worker last so a packaged-worker failure still leaves full dictionary/daily evidence.
  for (const [code, text] of Object.entries(snippets)) {
    const start = performance.now()
    const analyzed = await invoke('lang:analyze', code, text)
    check(
      `${code} ASAR worker analysis`,
      analyzed?.text === text && analyzed.sentences?.some((sentence) => sentence.tokens?.length),
      {
        milliseconds: Math.round(performance.now() - start),
        sentences: analyzed?.sentences?.length
      }
    )
  }
  check('renderer runtime errors', errors.length === 0, errors)
  await send('Page.close')
} catch (error) {
  errors.push(error.stack || String(error))
  process.exitCode = 1
} finally {
  ws?.close()
  // Only our spawn handle can be terminated; no process-name or system-wide kill.
  for (let i = 0; i < 50 && exitCode === null; i++) await sleep(100)
  if (exitCode === null) child.kill()
  writeFileSync(join(output, 'stdout.log'), stdout)
  writeFileSync(join(output, 'stderr.log'), stderr)
  writeFileSync(
    join(output, 'results.json'),
    JSON.stringify({ exe, appAsar, manifestPath, userData, results, errors, exitCode }, null, 2)
  )
  console.log(`Packaged QA report: ${join(output, 'results.json')}`)
  if (errors.length) console.error(errors)
}
