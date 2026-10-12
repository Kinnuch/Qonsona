/** Build first; node scripts/smoke-review-feedback.mjs. Real words and metadata, isolated profile; preserves evidence. */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.SMOKE_REVIEW_PORT) || 9477
const userData = mkdtempSync(join(tmpdir(), 'qonsona-review-feedback-'))
const output = join(root, 'dist/smoke-review-feedback')
mkdirSync(output, { recursive: true })
writeFileSync(
  join(userData, 'prefs.json'),
  JSON.stringify({
    activePackId: 'en',
    locale: 'en',
    nhkEasy: false,
    checkUpdates: false,
    relearn: false
  })
)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = [],
  errors = [],
  processDiagnostics = []
let child,
  ws,
  seq = 0,
  pending = new Map()
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ': ' + detail : ''}`)
  if (!ok) throw new Error(name)
}
const launch = () => {
  writeFileSync(join(userData, 'native-close-control.json'), JSON.stringify({ close: false }))
  child = spawn(
    join(root, 'node_modules/electron/dist/electron.exe'),
    [
      join(root, 'scripts/close-smoke-bootstrap.cjs'),
      `--user-data-dir=${userData}`,
      `--remote-debugging-port=${port}`,
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ],
    { env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true }
  )
  processDiagnostics.push({ launched: Date.now(), pid: child.pid, userData })
  child.stderr.on('data', (bytes) => processDiagnostics.push(String(bytes)))
  child.on('error', (error) => processDiagnostics.push(String(error)))
  child.on('exit', (code, signal) => processDiagnostics.push({ exitCode: code, signal }))
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('DevTools socket is closed before ' + method))
      return
    }
    const id = ++seq
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('CDP timeout ' + method))
    }, 30000)
    const complete = (m) => {
      clearTimeout(timer)
      resolve(m)
    }
    complete.reject = (error) => {
      clearTimeout(timer)
      reject(error)
    }
    pending.set(id, complete)
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function connect() {
  let url
  for (let i = 0; i < 120 && !url; i++) {
    try {
      url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (t) => t.type === 'page'
      )?.webSocketDebuggerUrl
    } catch {
      /* The isolated Electron process is still starting. */
    }
    if (!url) await sleep(100)
  }
  if (!url) throw new Error('No isolated Electron DevTools')
  ws = new WebSocket(url)
  await new Promise((r, j) => {
    ws.onopen = r
    ws.onerror = j
  })
  pending = new Map()
  ws.onclose = () => {
    for (const complete of pending.values()) complete.reject(new Error('DevTools closed'))
    pending.clear()
  }
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id) {
      pending.get(m.id)?.(m)
      pending.delete(m.id)
    } else if (m.method === 'Runtime.exceptionThrown')
      errors.push(
        m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text
      )
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '))
  }
  await send('Runtime.enable')
}
async function evaluate(code) {
  const r = await send('Runtime.evaluate', {
    expression: `(async()=>{${code}})()`,
    awaitPromise: true,
    returnByValue: true
  })
  if (r.result?.exceptionDetails)
    throw new Error(
      r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text
    )
  return r.result?.result?.value
}
async function waitFor(expr, ms = 20000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await evaluate(`return !!(await (${expr}))`)) return true
    await sleep(80)
  }
  return false
}
const click = (selector) =>
  evaluate(
    `const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing '+${JSON.stringify(selector)});el.click()`
  )
async function type(selector, value) {
  await evaluate(
    `const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing input');el.value=${JSON.stringify(String(value))};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))`
  )
  await sleep(20)
}
const persisted = () =>
  evaluate(`return JSON.parse(await window.qstudy.invoke('notebook:load','en'))`)
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(output, name + '.png'), Buffer.from(r.result.data, 'base64'))
}
async function stop() {
  ws?.close()
  ws = null
  if (child && child.exitCode === null) {
    const exited = new Promise((r) => child.once('exit', r))
    child.kill()
    await exited
  }
  await sleep(250)
}
/** Native BrowserWindow.close path, backed by test-only control file evidence. */
async function closeForRestart() {
  const exited = new Promise((resolve) => child.once('exit', () => resolve(true)))
  const id = String(Date.now())
  writeFileSync(join(userData, 'native-close-control.json'), JSON.stringify({ close: true, id }))
  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), 10000)
  })
  const closed = await Promise.race([exited, timeout])
  clearTimeout(timer)
  check('actual window close saves and exits within 10s', closed)
  const evidence = JSON.parse(readFileSync(join(userData, 'native-close-evidence.json'), 'utf-8'))
  check(
    'native close actually waits for renderer save handshake',
    evidence.nativeClose === true && evidence.prevented === true && evidence.id === id,
    JSON.stringify(evidence)
  )
  ws?.close()
  ws = null
  await sleep(200)
}
async function configure(kind) {
  await click('[data-open-review-settings]')
  check('modal ' + kind, await waitFor('document.querySelector("[data-review-settings][open]")'))
  await waitFor('!document.body.innerText.includes("Checking real examples")')
  const supported = await evaluate(
    `return document.querySelector('[data-review-weight="${kind}"]')?.dataset.reviewCapable==='true'`
  )
  if (!supported) {
    results.push({
      name: kind + ' capability unavailable',
      ok: true,
      detail:
        'The fixture lacks required reading/audio/example data. Configuration is allowed; runtime tasks remain data-gated.'
    })
    await click('[data-review-settings] button[aria-label="Close"]')
    return false
  }
  for (const key of [
    'flashcard',
    'word-meaning',
    'meaning-word',
    'spelling',
    'reading',
    'listening',
    'context'
  ])
    await type(`[data-review-weight="${key}"]`, key === kind ? 1 : 0)
  await type('[data-review-new]', 8)
  await type('[data-review-cap]', 12)
  await type('[data-review-ladder]', '2, 3, 6, 12, 24')
  await type('[data-review-master]', 30)
  await click('[data-review-save]')
  check(
    'saved ' + kind,
    await waitFor(
      `!document.querySelector('[data-review-settings]')&&(async()=>{const n=JSON.parse(await window.qstudy.invoke('notebook:load','en'));return n.review?.language?.weights[${JSON.stringify(kind)}]===1&&n.review.language.ladder[0]===2})()`
    )
  )
  return true
}
async function submit(kind, answer) {
  if (kind === 'spelling') {
    await type('[data-review-input]', answer)
    await click('[data-review-submit]')
  } else
    await evaluate(
      `const b=[...document.querySelectorAll('[data-review-choice]')].find(b=>b.textContent.trim()===${JSON.stringify(answer)});if(!b)throw new Error('Current-word answer missing');b.click()`
    )
}
try {
  launch()
  await connect()
  check('isolated app starts', await waitFor('document.querySelector("[data-nav=notebook]")'))
  const seed = await evaluate(
    `const cards={};let order=0;const now=Date.now();for(const word of ['cat','dog','bird','fish','tree','house','book','water','school','apple','chair','work']){const found=await window.qstudy.invoke('lang:search','en',word);const hit=found?.hits.find(h=>h.w===word)??found?.hits[0];if(!hit)continue;const e=await window.qstudy.invoke('lang:entry','en',hit.id);if(!e)continue;const key='lex-'+e.id;cards[key]={key,front:e.w,reading:e.ipa[0]||e.rom||'',meaning:{en:e.senses.find(s=>s.en.length)?.en.slice(0,3).join('; ')||'',zh:e.senses.find(s=>s.zh.length)?.zh[0]||''},added:now,order:order++,state:0,due:0,ivl:0,ease:2.5,reps:0,lapses:0,last:0,seen:0,hist:[]}}const nb={version:1,cards,lists:[{id:'mine',name:'',keys:Object.keys(cards),createdAt:now}],days:{},seq:order};return nb`
  )
  check('real dictionary review cards seeded', Object.keys(seed.cards).length >= 8)
  // The initial renderer owns an empty notebook. Close it before installing the fixture,
  // otherwise its legitimate before-close flush would overwrite an out-of-band IPC save.
  await closeForRestart()
  mkdirSync(join(userData, 'notebook'), { recursive: true })
  writeFileSync(join(userData, 'notebook/en.json'), JSON.stringify(seed))
  launch()
  await connect()
  check(
    'restart with seeded profile',
    await waitFor('document.querySelector("[data-nav=notebook]")')
  )
  await click('[data-nav=notebook]')
  check(
    'real words appear in notebook',
    await waitFor('document.querySelectorAll("[data-card-row]").length>=8')
  )
  check('old profile defaults remain flashcard-only', !(await persisted()).review)
  for (const kind of [
    'word-meaning',
    'meaning-word',
    'spelling',
    'reading',
    'listening',
    'context'
  ]) {
    if (!(await configure(kind))) continue
    const beforeTask = await persisted()
    await click('[data-drill]')
    check(
      kind + ' current-word task appears',
      await waitFor(`document.querySelector('[data-review-question="${kind}"]')`)
    )
    const key = await evaluate('return document.querySelector("[data-card]").dataset.card')
    const card = seed.cards[key]
    check(kind + ' belongs to seeded review card', !!card, key)
    let answer =
      kind === 'word-meaning' ? card.meaning.en : kind === 'reading' ? card.reading : card.front
    if (kind === 'context') {
      const candidates = await evaluate(
        `const e=await window.qstudy.invoke('lang:entry','en',Number(${JSON.stringify(key)}.slice(4)));const forms=new Set([e.w,e.d,...e.forms.map(f=>f.form)]);return [...document.querySelectorAll('[data-review-choice]')].map(b=>b.textContent.trim()).filter(x=>forms.has(x))`
      )
      check(
        'context uses verified current-entry form',
        candidates.length === 1,
        JSON.stringify(candidates)
      )
      answer = candidates[0]
    }
    if (kind === 'listening') {
      await click('[data-review-listen]')
      await sleep(200)
    }
    await submit(kind, answer)
    check(
      kind + ' correct answer grades current card',
      await waitFor(
        'document.querySelector("[data-review-result]")?.textContent.includes("Correct")'
      )
    )
    await shot('review-' + kind)
    await click('[data-undo]')
    check(
      kind + ' undo returns same word and permits reanswer',
      await waitFor(
        `!document.querySelector('[data-review-result]')&&document.querySelector('[data-card]')?.dataset.card===${JSON.stringify(key)}&&(document.querySelector('[data-review-input]')?!document.querySelector('[data-review-input]').disabled:![...document.querySelectorAll('[data-review-choice]')].every(b=>b.disabled))`
      )
    )
    await submit(kind, answer)
    await click('[data-exit]')
    check(
      kind + ' undo/reanswer records one SRS answer',
      await waitFor(
        `(async()=>{const n=JSON.parse(await window.qstudy.invoke('notebook:load','en'));return n.cards[${JSON.stringify(key)}].seen===${beforeTask.cards[key].seen + 1}})()`
      )
    )
  }
  await configure('word-meaning')
  const before = await persisted()
  let remembered = Object.values(before.cards).find((c) => c.seen > 0)
  check(
    'custom ladder used on real card',
    remembered?.ivl === 2,
    JSON.stringify({ ivl: remembered?.ivl, seen: remembered?.seen })
  )
  // Answer, then close before the 400ms debounce without exiting the review UI.
  await click('[data-drill]')
  await waitFor('document.querySelector("[data-review-question=word-meaning]")')
  await submit('word-meaning', remembered.meaning.en)
  await waitFor('document.querySelector("[data-review-result]")')
  await closeForRestart()
  launch()
  await connect()
  check('restart isolated profile', await waitFor('document.querySelector("[data-nav=notebook]")'))
  await click('[data-nav=notebook]')
  await waitFor('document.querySelector("[data-open-review-settings]")')
  const after = await persisted()
  check(
    'restart preserves settings and exact SRS due date',
    JSON.stringify(before.review) === JSON.stringify(after.review) &&
      after.cards[remembered.key].due === remembered.due &&
      after.cards[remembered.key].seen === remembered.seen + 1
  )
  remembered = after.cards[remembered.key]
  // Save settings and immediately close, again without waiting for the debounce or a persisted read.
  await click('[data-open-review-settings]')
  await waitFor('document.querySelector("[data-review-settings][open]")')
  await type('[data-review-master]', 31)
  await click('[data-review-save]')
  await closeForRestart()
  launch()
  await connect()
  await waitFor('document.querySelector("[data-nav=notebook]")')
  await click('[data-nav=notebook]')
  await waitFor('document.querySelector("[data-open-review-settings]")')
  const savedSettings = await persisted()
  check(
    'immediate close preserves undebounced settings and review history',
    savedSettings.review.language.masterDays === 31 &&
      savedSettings.cards[remembered.key].seen === remembered.seen &&
      savedSettings.cards[remembered.key].due === remembered.due
  )
  await click('[data-open-review-settings]')
  await waitFor('document.querySelector("[data-review-settings][open]")')
  await evaluate(
    `const e=document.querySelector('select[aria-label="Reschedule scope"]');e.value='scheduled';e.dispatchEvent(new Event('change',{bubbles:true}))`
  )
  await type('[data-review-date]', '2030-01-15')
  await click('[data-review-reschedule]')
  check(
    'reschedule reports preserved history',
    await waitFor(
      'document.querySelector("[data-review-settings-message]")?.textContent.includes("Rescheduled")'
    )
  )
  await click('[data-review-settings] button[aria-label="Close"]')
  check(
    'rescheduled date persists with history intact',
    await waitFor(
      `(async()=>{const n=JSON.parse(await window.qstudy.invoke('notebook:load','en'));const c=n.cards[${JSON.stringify(remembered.key)}];const d=new Date(c.due);return d.getFullYear()===2030&&d.getMonth()===0&&d.getDate()===15&&c.seen===${remembered.seen}&&c.hist.length===${remembered.hist.length}})()`
    )
  )
  check('zero runtime and console errors', errors.length === 0, errors.join('\n'))
} catch (error) {
  results.push({ name: 'review UI complete', ok: false, detail: String(error) })
  console.error(error.stack ?? error)
  if (ws) {
    await shot('failure').catch(() => {})
    writeFileSync(
      join(output, 'failure-ui.txt'),
      String(await evaluate('return document.body.innerText').catch(() => ''))
    )
  }
} finally {
  await stop()
  writeFileSync(
    join(output, 'results.json'),
    JSON.stringify({ results, errors, userData, processDiagnostics }, null, 2)
  )
}
const failed = results.filter((r) => !r.ok)
console.log(
  `${results.length - failed.length}/${results.length} passed; profile ${userData}; output ${output}`
)
process.exitCode = failed.length ? 1 : 0
