/** Real window close during recording and an in-flight article save; isolated user data only. */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.SMOKE_SAVE_PORT) || 9479
const userData = mkdtempSync(join(tmpdir(), 'qonsona-save-close-'))
const output = join(root, 'dist/smoke-save-close')
mkdirSync(output, { recursive: true })
writeFileSync(
  join(userData, 'prefs.json'),
  JSON.stringify({ activePackId: 'en', nhkEasy: false, checkUpdates: false })
)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const results = [],
  errors = []
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let child,
  ws,
  seq = 0
let pending = new Map()
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ': ' + detail : ''}`)
  if (!ok) throw new Error(name)
}
async function launch() {
  writeFileSync(join(userData, 'native-close-control.json'), JSON.stringify({ close: false }))
  child = spawn(
    join(root, 'node_modules/electron/dist/electron.exe'),
    [
      join(root, 'scripts/close-smoke-bootstrap.cjs'),
      `--user-data-dir=${userData}`,
      `--remote-debugging-port=${port}`,
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream'
    ],
    { env, stdio: 'ignore', windowsHide: true }
  )
  let url
  for (let i = 0; i < 150 && !url; i++) {
    try {
      url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (tab) => tab.type === 'page'
      )?.webSocketDebuggerUrl
    } catch {
      /* Starting. */
    }
    if (!url) await sleep(100)
  }
  if (!url) throw new Error('DevTools did not start')
  ws = new WebSocket(url)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  pending = new Map()
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id) {
      pending.get(msg.id)?.resolve(msg)
      pending.delete(msg.id)
    } else if (msg.method === 'Runtime.exceptionThrown')
      errors.push(
        msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text
      )
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')
      errors.push(msg.params.args.map((arg) => arg.value ?? arg.description).join(' '))
  }
  ws.onclose = () => {
    for (const request of pending.values())
      request.method === 'Page.close'
        ? request.resolve({})
        : request.reject(new Error('DevTools closed'))
    pending.clear()
  }
  await send('Runtime.enable')
  check('isolated app starts', await waitFor('document.querySelector("[data-nav=reading]")'))
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('CDP timeout ' + method))
    }, 20000)
    pending.set(id, {
      method,
      resolve: (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      reject: (error) => {
        clearTimeout(timer)
        reject(error)
      }
    })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(code) {
  const response = await send('Runtime.evaluate', {
    expression: `(async()=>{${code}})()`,
    awaitPromise: true,
    returnByValue: true
  })
  if (response.result?.exceptionDetails)
    throw new Error(
      response.result.exceptionDetails.exception?.description ??
        response.result.exceptionDetails.text
    )
  return response.result?.result?.value
}
async function waitFor(expression) {
  const end = Date.now() + 20000
  do {
    if (await evaluate(`return !!(await (${expression}))`)) return true
    await sleep(80)
  } while (Date.now() < end)
  return false
}
const click = (selector) =>
  evaluate(
    `const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing '+${JSON.stringify(selector)});e.click()`
  )
async function closeWindow() {
  const exited = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Actual window close did not finish')), 15000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
  writeFileSync(
    join(userData, 'native-close-control.json'),
    JSON.stringify({ close: true, id: String(Date.now()) })
  )
  await exited
  const evidence = JSON.parse(readFileSync(join(userData, 'native-close-evidence.json'), 'utf8'))
  check('native close waits for the app save handshake', evidence.nativeClose && evidence.prevented)
  ws?.close()
  ws = null
  await sleep(200)
}
try {
  await launch()
  await click('[data-nav=reading]')
  check(
    'real article available',
    await waitFor('document.querySelector("[data-article^=b-] .open")')
  )
  await click('[data-article^=b-] .open')
  check('real vocabulary available', await waitFor('document.querySelector("[data-vocab]")'))
  const key = await evaluate('return "lex-"+document.querySelector("[data-vocab]").dataset.vocab')
  await click('[data-vocab]')
  check(
    'word recording control available',
    await waitFor('document.querySelector("[data-word-card] [data-record]")')
  )
  await click('[data-word-card] [data-record]')
  check(
    'fake microphone records through the real UI',
    await waitFor('document.querySelector("[data-record].rec")')
  )
  await sleep(250)
  // Start a real production save while the analysis worker has a long request in flight.
  const body = 'The library is open. Residents have asked for longer opening hours. '.repeat(1300)
  await evaluate(
    `window.qstudy.invoke('lang:analyze','en',${JSON.stringify(body)}).catch(()=>{});window.qstudy.invoke('langArticles:save','en',{title:'Close persistence fixture',body:${JSON.stringify(body)}}).catch(()=>{});return true`
  )
  await sleep(30)
  await closeWindow()
  check('close completes after flushing the active recording', child.exitCode === 0)
  const recordings = readdirSync(join(userData, 'recordings/en'))
  const file = recordings.find((name) => name.startsWith(key + '.'))
  check(
    'final recording bytes reached disk',
    !!file && readFileSync(join(userData, 'recordings/en', file)).length > 0
  )
  const articleDir = join(userData, 'articles/en/user')
  const saved = readdirSync(articleDir)
    .map((name) => JSON.parse(readFileSync(join(articleDir, name), 'utf8')))
    .find((article) => article.title === 'Close persistence fixture')
  check('in-flight user article reached disk before quit', saved?.body === body.trim())
  await launch()
  check(
    'recording survives a normal restart',
    await evaluate(
      `return (await window.qstudy.invoke('rec:list','en')).includes(${JSON.stringify(key)})`
    )
  )
  check(
    'article survives a normal restart',
    await evaluate(
      `return (await window.qstudy.invoke('langArticles:get','en',${JSON.stringify(saved.id)}))?.body === ${JSON.stringify(body.trim())}`
    )
  )
  check('no renderer errors', errors.length === 0, errors.join('\n'))
  await closeWindow()
} catch (error) {
  results.push({ name: 'save/close complete', ok: false, detail: String(error) })
  console.error(error)
} finally {
  ws?.close()
  if (child?.exitCode === null) child.kill()
  writeFileSync(
    join(output, 'results.json'),
    JSON.stringify({ userData, results, errors }, null, 2)
  )
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0
