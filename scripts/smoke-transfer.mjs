/** 完整Electron个人数据转移验收：临时profile、CDP、测试专用dialog stub，无生产路径后门。 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const userData = mkdtempSync(join(tmpdir(), 'qonsona-transfer-smoke-'))
const output = join(root, 'dist/smoke-transfer')
mkdirSync(output, { recursive: true })
const port = Number(process.env.SMOKE_TRANSFER_PORT) || 9478
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const results = [],
  errors = []
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ': ' + JSON.stringify(detail) : ''}`)
  if (!ok) throw new Error(name)
}
const put = (path, value) => {
  const file = join(userData, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value))
}
const card = (key, front, last = 0) => ({
  key,
  front,
  reading: '',
  meaning: { zh: front, en: front },
  state: last ? 2 : 0,
  due: 100000,
  ivl: last ? 2 : 0,
  ease: 2.5,
  reps: last ? 2 : 0,
  lapses: 0,
  last,
  seen: last ? 2 : 0,
  hist: last ? [[Math.round(last / 60000), 5]] : [],
  added: 10,
  order: key === 'ja-1' ? 0 : 1
})
const notebook = (remote = false) => ({
  version: 1,
  cards: {
    'ja-1': card('ja-1', '本', remote ? 200000 : 100000),
    ...(remote ? { 'ja-2': card('ja-2', '猫') } : {})
  },
  lists: [{ id: 'mine', name: '', keys: remote ? ['ja-1', 'ja-2'] : ['ja-1'], createdAt: 10 }],
  days: {
    '2026-10-12': {
      learned: remote ? 2 : 1,
      reviewed: 0,
      total: remote ? 2 : 1,
      correct: remote ? 2 : 1
    }
  },
  seq: remote ? 2 : 1
})
const bundle = (scope, files) => ({
  app: 'qonsona-transfer',
  format: 1,
  scope,
  appVersion: 'smoke',
  createdAt: '2026-10-12T00:00:00Z',
  packs: [{ id: 'ja', name: 'Japanese', kind: 'builtin' }],
  files
})
const notebookImport = join(userData, 'notebook-import.json'),
  personalImport = join(userData, 'personal-import.json'),
  notebookExport = join(userData, 'notebook-export.json'),
  personalExport = join(userData, 'personal-export.json')
put('prefs.json', { locale: 'zh', activePackId: 'ja', nhkEasy: false, checkUpdates: false })
put('notebook/ja.json', notebook())
put('stats.json', { version: 1, days: { '2026-10-12': { packs: { ja: { notebook: 30 } } } } })
put('courses/ja.json', { version: 1, lessons: {}, tests: {}, items: {}, last: null })
put('practice/ja.json', { version: 1, exams: [], days: {} })
put(
  'notebook-import.json',
  bundle('notebook', [{ path: 'notebook/ja.json', content: notebook(true) }])
)
put(
  'personal-import.json',
  bundle('personal', [
    { path: 'notebook/ja.json', content: notebook(true) },
    {
      path: 'stats.json',
      content: { version: 1, days: { '2026-10-12': { packs: { ja: { notebook: 80 } } } } }
    },
    {
      path: 'courses/ja.json',
      content: {
        version: 1,
        lessons: { 'grammar/test': { learned: true, best: 1, passed: true, tries: 1, at: 1000 } },
        tests: {},
        items: {},
        last: { course: 'grammar', lesson: 'test' }
      }
    },
    {
      path: 'practice/ja.json',
      content: { version: 1, exams: [], days: { '2026-10-12': { answered: 3, right: 2 } } }
    },
    {
      path: 'articles/user-transfer.json',
      content: {
        id: 'user-transfer',
        source: 'user',
        title: 'Transfer sample',
        body: 'This is an original test passage.',
        chars: 33
      }
    },
    { path: 'articles/translations/user-transfer.txt', content: '这是原创测试短文。' }
  ])
)
const controls = (exportFile, importFile) =>
  put('transfer-smoke-control.json', { exportFile, importFile })
controls(notebookExport, notebookImport)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(
  join(root, 'node_modules/electron/dist/electron.exe'),
  [
    join(root, 'scripts/transfer-smoke-bootstrap.cjs'),
    `--user-data-dir=${userData}`,
    `--remote-debugging-port=${port}`,
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ],
  { env, stdio: ['ignore', 'pipe', 'pipe'] }
)
let processLog = ''
child.stdout.on('data', (data) => {
  processLog += data.toString()
})
child.stderr.on('data', (data) => {
  processLog += data.toString()
})
child.on('error', (error) => {
  processLog += String(error)
})
let session
async function connect() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (p) => p.type === 'page'
      )
      if (!page) {
        await pause(200)
        continue
      }
      const ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((r, j) => {
        ws.onopen = r
        ws.onerror = j
      })
      let seq = 0
      const pending = new Map()
      ws.onmessage = ({ data }) => {
        const m = JSON.parse(data)
        if (m.id) {
          const p = pending.get(m.id)
          if (p) {
            clearTimeout(p.timer)
            p.resolve(m)
            pending.delete(m.id)
          }
        } else if (m.method === 'Runtime.exceptionThrown')
          errors.push(
            m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text
          )
        else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
          errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '))
      }
      ws.onclose = () => {
        for (const p of pending.values()) {
          clearTimeout(p.timer)
          p.reject(new Error('CDP disconnected'))
        }
        pending.clear()
      }
      const send = (method, params = {}) =>
        new Promise((resolve, reject) => {
          const id = ++seq
          const timer = setTimeout(() => {
            pending.delete(id)
            reject(new Error(`CDP timeout: ${method}`))
          }, 15000)
          pending.set(id, { resolve, reject, timer })
          ws.send(JSON.stringify({ id, method, params }))
        })
      const evaluate = async (body) => {
        const r = await send('Runtime.evaluate', {
          expression: `(async()=>{${body}})()`,
          awaitPromise: true,
          returnByValue: true
        })
        if (r.error || r.result?.exceptionDetails)
          throw new Error(JSON.stringify(r.error ?? r.result.exceptionDetails))
        return r.result.result.value
      }
      await send('Runtime.enable')
      const s = { ws, send, evaluate }
      for (let i = 0; i < 100; i++) {
        if (await evaluate('return !!document.querySelector("[data-nav=notebook]")')) return s
        await pause(100)
      }
      ws.close()
    } catch {
      await pause(200)
    }
  }
  throw new Error('Could not connect to isolated Electron')
}
async function waitFor(expression, timeout = 10000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await session.evaluate(`return !!(${expression})`)) return true
    await pause(40)
  }
  return false
}
const click = (selector) =>
  session.evaluate(
    `const node=document.querySelector(${JSON.stringify(selector)});if(!node)throw new Error('Missing '+${JSON.stringify(selector)});node.click()`
  )
const shot = async (name) => {
  const r = await session.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(output, `${name}.png`), Buffer.from(r.result.data, 'base64'))
}
async function restartFromPreview() {
  session.evaluate('document.querySelector("[data-transfer-confirm]").click()').catch(() => {})
  await pause(1200)
  session.ws.close()
  session = await connect()
}
try {
  session = await connect()
  check('isolated Electron is ready', true, { userData })
  await click('[data-nav=notebook]')
  check(
    'notebook transfer UI is reachable',
    await waitFor('document.querySelector("[data-transfer-scope=notebook] [data-transfer-export]")')
  )
  const latest = await session.evaluate(`
  const input=document.querySelector('.new-list input');input.value='Undebounced transfer test';input.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>requestAnimationFrame(r));document.querySelector('.new-list').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  const before=JSON.parse(await window.qstudy.invoke('notebook:load','ja'));const wasSaved=before.lists.some(l=>l.name==='Undebounced transfer test');
  document.querySelector('[data-transfer-export]').click();return {wasSaved};`)
  check(
    'fixture mutation has not reached the debounce writer before export',
    !latest.wasSaved,
    latest
  )
  check(
    'notebook export completes',
    await waitFor('document.querySelector("[data-transfer-result]")')
  )
  const exported = JSON.parse(readFileSync(notebookExport, 'utf8'))
  check(
    'UI export awaits and includes the latest pending notebook change',
    exported.scope === 'notebook' &&
      exported.files[0].content.lists.some((l) => l.name === 'Undebounced transfer test')
  )
  await shot('01-notebook-export')
  await click('[data-transfer-import]')
  check(
    'notebook import previews two incoming cards',
    await waitFor(
      'document.querySelector("[data-transfer-preview] tbody td:nth-child(2)")?.textContent==="2"'
    )
  )
  check(
    'preview does not alter local cards',
    Object.keys(JSON.parse(readFileSync(join(userData, 'notebook/ja.json'), 'utf8')).cards)
      .length === 1
  )
  await shot('02-notebook-preview')
  await restartFromPreview()
  const merged = JSON.parse(readFileSync(join(userData, 'notebook/ja.json'), 'utf8'))
  check(
    'confirmed notebook merge takes effect after actual restart',
    Object.keys(merged.cards).length === 2 &&
      merged.cards['ja-1'].last === 200000 &&
      merged.lists.some((l) => l.name === 'Undebounced transfer test')
  )
  await click('[data-nav=notebook]')
  check(
    'merged cards appear in notebook UI',
    await waitFor('document.querySelectorAll("[data-card-row]").length===2')
  )
  await click('[data-transfer-import]')
  check(
    'repeat notebook import previews no additional update',
    (await waitFor('document.querySelector("[data-transfer-preview]")')) &&
      (await session.evaluate(
        'return /新增 0 个文件，合并更新 0 个/.test(document.querySelector("[data-transfer-preview]").textContent)'
      ))
  )
  await restartFromPreview()
  const repeated = JSON.parse(readFileSync(join(userData, 'notebook/ja.json'), 'utf8'))
  check(
    'repeated notebook import keeps counts and memberships unchanged',
    JSON.stringify(repeated) === JSON.stringify(merged)
  )
  controls(personalExport, personalImport)
  await click('[data-nav=settings]')
  check(
    'personal transfer UI explains package/audio portability',
    (await waitFor('document.querySelector("[data-transfer-scope=personal]")')) &&
      (await session.evaluate(
        'return /学习包和录音不包含/.test(document.querySelector("[data-transfer-scope=personal]").textContent)'
      ))
  )
  await click('[data-transfer-scope=personal] [data-transfer-import]')
  check(
    'personal preview includes cards, lesson and article counts',
    (await waitFor('document.querySelector("[data-transfer-preview] tbody")')) &&
      (await session.evaluate(
        'const cells=[...document.querySelectorAll("[data-transfer-preview] tbody tr:first-child td")].map(e=>e.textContent);return cells[1]==="2"&&cells[3]==="1"&&cells[5]==="1"'
      ))
  )
  await shot('03-personal-preview')
  await restartFromPreview()
  check(
    'personal merge updates courses, practice and reading text',
    JSON.parse(readFileSync(join(userData, 'courses/ja.json'), 'utf8')).lessons['grammar/test']
      .passed &&
      JSON.parse(readFileSync(join(userData, 'practice/ja.json'), 'utf8')).days['2026-10-12']
        .answered === 3 &&
      existsSync(join(userData, 'articles/user-transfer.json')) &&
      readFileSync(join(userData, 'articles/translations/user-transfer.txt'), 'utf8') ===
        '这是原创测试短文。'
  )
  const statsBefore = JSON.parse(readFileSync(join(userData, 'stats.json'), 'utf8')).days[
    '2026-10-12'
  ].packs.ja.notebook
  check('personal merge preserves/maxes cumulative study time', statsBefore >= 80)
  await click('[data-nav=settings]')
  await click('[data-transfer-scope=personal] [data-transfer-export]')
  check(
    'personal UI export completes',
    await waitFor('document.querySelector("[data-transfer-scope=personal] [data-transfer-result]")')
  )
  const personal = JSON.parse(readFileSync(personalExport, 'utf8'))
  check(
    'personal UI export contains required categories',
    personal.scope === 'personal' &&
      [
        'notebook/ja.json',
        'courses/ja.json',
        'practice/ja.json',
        'stats.json',
        'articles/user-transfer.json',
        'articles/translations/user-transfer.txt'
      ].every((path) => personal.files.some((f) => f.path === path))
  )
  await shot('04-personal-export')
  await click('[data-transfer-scope=personal] [data-transfer-import]')
  check(
    'repeat personal import previews no record growth',
    (await waitFor('document.querySelector("[data-transfer-preview]")')) &&
      (await session.evaluate(
        'return /新增 0 个文件，合并更新 0 个/.test(document.querySelector("[data-transfer-preview]").textContent)'
      ))
  )
  await restartFromPreview()
  check(
    'repeat personal import does not multiply daily counts',
    JSON.parse(readFileSync(join(userData, 'practice/ja.json'), 'utf8')).days['2026-10-12']
      .answered === 3 &&
      JSON.parse(readFileSync(join(userData, 'notebook/ja.json'), 'utf8')).days['2026-10-12']
        .total === 2
  )
  check(
    'UI transfer tests have no console errors or uncaught exceptions',
    errors.length === 0,
    errors
  )
} catch (error) {
  results.push({ name: 'uncaught smoke failure', ok: false, detail: String(error) })
  console.error(error)
  process.exitCode = 1
} finally {
  writeFileSync(join(output, 'process.log'), processLog)
  writeFileSync(join(output, 'report.json'), JSON.stringify({ userData, results, errors }, null, 2))
  if (session)
    try {
      await session.send('Browser.close')
    } catch {
      // Browser.close 会断开CDP；这是测试退出的预期结果。
    }
  session?.ws.close()
  child.kill()
  console.log(`Report and screenshots: ${output}`)
}
