/** Build first; node scripts/smoke-collection.mjs. Real words and metadata, isolated profile; preserves evidence. */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.SMOKE_COLLECTION_PORT) || 9488
const userData = mkdtempSync(join(tmpdir(), 'qonsona-collection-'))
const output = join(root, 'dist/smoke-collection')
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
    process.env.SMOKE_EXE || join(root, 'node_modules/electron/dist/electron.exe'),
    [
      ...(process.env.SMOKE_EXE ? [] : [join(root, 'scripts/close-smoke-bootstrap.cjs')]),
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
  if (process.env.SMOKE_EXE) await evaluate('window.close()').catch(() => {})
  else
    writeFileSync(join(userData, 'native-close-control.json'), JSON.stringify({ close: true, id }))
  let timer
  const closed = await Promise.race([
    exited,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), 10000)
    })
  ])
  clearTimeout(timer)
  check('native close saves and exits within 10 seconds', closed)
  if (!process.env.SMOKE_EXE) {
    const evidence = JSON.parse(readFileSync(join(userData, 'native-close-evidence.json'), 'utf8'))
    check(
      'native close executes renderer save handshake',
      evidence.nativeClose && evidence.prevented && evidence.id === id
    )
  }
  ws?.close()
  ws = null
  await sleep(200)
}
async function bringOwnedToFront() {
  await send('Page.bringToFront')
  if (!process.env.SMOKE_EXE)
    writeFileSync(
      join(userData, 'native-close-control.json'),
      JSON.stringify({ focus: true, id: 'focus-' + Date.now() })
    )
  await sleep(100)
}
const flushStats = () => evaluate(`window.dispatchEvent(new Event('beforeunload'));return true`)
const stats = () =>
  evaluate(`return JSON.parse(await window.qstudy.invoke('stats:load')||'{"days":{}}')`)
const compiled = await build({
  entryPoints: [join(root, 'src/shared/rewards.ts')],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm'
})
const model = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64')
)
try {
  launch()
  await connect()
  await bringOwnedToFront()
  check('app starts', await waitFor(`document.querySelector('[data-nav=collection]')`))
  await click('[data-nav=collection]')
  check(
    'fresh collection has twelve locked slots',
    await waitFor(
      `document.querySelectorAll('[data-collectible][data-unlocked=false]').length===12`
    )
  )
  await sleep(16000)
  await flushStats()
  const fresh = await stats()
  check(
    'startup and collection viewing do not check in or reward time',
    !Object.values(fresh.rewards?.days ?? {}).some((d) => d.seconds > 0 || d.completions.length)
  )
  check(
    'both original sprite sheets load all twelve cells',
    await evaluate(
      `const urls=[...new Set([...document.querySelectorAll('.sprite')].map(el=>getComputedStyle(el).backgroundImage.slice(5,-2)))];const sizes=await Promise.all(urls.map(url=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve([img.naturalWidth,img.naturalHeight]);img.onerror=()=>resolve([]);img.src=url})));return urls.length===2&&sizes.every(size=>size[0]===126&&size[1]===78)&&document.querySelectorAll('[data-collectible] .sprite').length===12`
    )
  )
  await send('Emulation.setDeviceMetricsOverride', {
    width: 720,
    height: 480,
    deviceScaleFactor: 1,
    mobile: false
  })
  await shot('narrow-light')
  check(
    'narrow collection has no horizontal overflow',
    await evaluate(
      `const main=document.querySelector('[data-main-scroll]');return main.scrollWidth<=main.clientWidth+1`
    )
  )
  await evaluate(`document.querySelector('[data-collectible=companion-8]').focus()`)
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    text: '\r',
    unmodifiedText: '\r',
    windowsVirtualKeyCode: 13
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13
  })
  check(
    'keyboard opens locked companion details',
    await waitFor(`document.querySelector('[data-collection-detail=companion-8]')`)
  )
  await click('[data-collection-detail-close]')
  check(
    'details close button dismisses panel',
    await waitFor(`!document.querySelector('[data-collection-detail]')`)
  )
  await click('[data-collectible=companion-9]')
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27
  })
  check(
    'Escape closes details',
    await waitFor(`!document.querySelector('[data-collection-detail]')`)
  )
  await evaluate(`document.documentElement.dataset.theme='dark'`)
  await shot('narrow-dark')
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  })
  check(
    'reduced motion disables unlock animation',
    await evaluate(
      `const el=document.querySelector('[data-collectible]');el.classList.add('new');const value=getComputedStyle(el).animationName;el.classList.remove('new');return value==='none'`
    )
  )
  await send('Emulation.clearDeviceMetricsOverride')
  await evaluate(`document.documentElement.dataset.theme='light'`)
  await click('[data-nav=courses]')
  check(
    'real course list opens',
    await waitFor(`document.querySelector('[data-course=grammar] [data-open-course]')`)
  )
  await click('[data-course=grammar] [data-open-course]')
  check('grammar lessons available', await waitFor(`document.querySelector('[data-lesson]')`))
  await click('[data-lesson]')
  check(
    'explicit nonempty lesson completion is available',
    await waitFor(`document.querySelector('[data-complete-lesson]:not([disabled])')`)
  )
  const openedLesson = await evaluate(
    `return document.querySelector('[data-lesson-page]').dataset.lessonPage`
  )
  await flushStats()
  const opened = await stats()
  check(
    'opening grammar lesson alone does not check in',
    !Object.values(opened.rewards?.days ?? {}).some((d) => d.completions.length)
  )
  await click('[data-complete-lesson]')
  check(
    'explicit lesson completion checks in',
    await waitFor(
      `(async()=>{const s=JSON.parse(await window.qstudy.invoke('stats:load')||'{}');return Object.values(s.rewards?.days??{}).some(d=>d.completions.some(c=>c.kind==='courses'&&c.id===${JSON.stringify('grammar/')}+${JSON.stringify(openedLesson)}))})()`
    )
  )
  await click('[data-complete-lesson]')
  await flushStats()
  check(
    'same lesson completed twice remains one daily event',
    await evaluate(
      `const s=JSON.parse(await window.qstudy.invoke('stats:load')||'{}');return Object.values(s.rewards?.days??{}).flatMap(d=>d.completions).filter(c=>c.kind==='courses'&&c.id===${JSON.stringify('grammar/')}+${JSON.stringify(openedLesson)}).length===1`
    )
  )
  await click('[data-nav=collection]')
  check(
    'collection shows genuine course check-in',
    await waitFor(`document.body.innerText.includes('Checked in today')`)
  )
  await shot('course-completed')
  await click('[data-nav=reading]')
  check(
    'real English reading library',
    await waitFor(`document.querySelector('[data-lex-library=en] [data-article^="b-"] .open')`)
  )
  await click('[data-lex-library=en] [data-article^="b-"] .open')
  check(
    'actual reader completion is available',
    await waitFor(`document.querySelector('[data-reading-finish]:not([disabled])')`)
  )
  await click('[data-reading-finish]')
  check(
    'reading completion checks in',
    await waitFor(
      `(async()=>{const s=JSON.parse(await window.qstudy.invoke('stats:load')||'{}');return Object.values(s.rewards?.days??{}).some(d=>d.completions.some(c=>c.kind==='reading'))})()`
    )
  )
  check(
    'real article quiz opens',
    await waitFor(`document.querySelector('[data-article-quiz-question]')`)
  )
  for (let i = 0; i < 35; i++) {
    if (await evaluate(`return !!document.querySelector('[data-article-quiz-result]')`)) break
    await click('[data-article-quiz-question] [data-choice="0"]')
    check(
      'article answer advances ' + i,
      await waitFor(`document.querySelector('[data-article-quiz-next]:not([disabled])')`)
    )
    await click('[data-article-quiz-next]')
    await sleep(100)
  }
  check(
    'actual practice completion checks in',
    await waitFor(
      `(async()=>{const s=JSON.parse(await window.qstudy.invoke('stats:load')||'{}');return Object.values(s.rewards?.days??{}).some(d=>d.completions.some(c=>c.kind==='practice'))})()`
    )
  )
  await closeForRestart()
  const recorded = JSON.parse(readFileSync(join(userData, 'stats.json'), 'utf8'))
  check(
    'native close retains genuine completion records',
    model.isRewards(recorded.rewards) &&
      Object.values(recorded.rewards.days).some(
        (d) =>
          d.completions.some((c) => c.kind === 'reading') &&
          d.completions.some((c) => c.kind === 'practice')
      )
  )
  // Seed only this closed temporary profile through the real pure model, never overwrite live state.
  const now = Date.now(),
    day = model.emptyRewards(now)
  model.completeReward(day, 'reading', 'smoke-validated-fixture', 'en', now)
  model.addRewardInterval(day, now, now + 299000)
  check(
    'near-threshold fixture validates and has zero unlocks',
    model.isRewards(day) && Object.keys(day.unlocked).length === 0
  )
  writeFileSync(join(userData, 'stats.json'), JSON.stringify({ ...recorded, rewards: day }))
  launch()
  await connect()
  await bringOwnedToFront()
  check(
    'fixture is loaded by actual application',
    await waitFor(`document.querySelector('[data-nav=dictionary]')`)
  )
  await click('[data-nav=dictionary]')
  await type('[data-dict-input]', 'language')
  const pointer = await evaluate(
    `const el=document.querySelector('[data-dict-input]');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();window.__collectionSmokeInputs=0;window.addEventListener('pointerdown',()=>window.__collectionSmokeInputs++);return {x:r.x+r.width/2,y:r.y+r.height/2,visible:document.visibilityState,focused:document.hasFocus()}`
  )
  check(
    'learning window is visible and focused',
    pointer.visible === 'visible' && pointer.focused,
    JSON.stringify(pointer)
  )
  for (let i = 0; i < 40; i++) {
    await bringOwnedToFront()
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: pointer.x + (i % 2),
      y: pointer.y
    })
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: pointer.x + (i % 2),
      y: pointer.y,
      button: 'left',
      clickCount: 1
    })
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: pointer.x + (i % 2),
      y: pointer.y,
      button: 'left',
      clickCount: 1
    })
    await sleep(1000)
    if (await evaluate(`return document.body.innerText.includes('Unlocked')`)) break
  }
  check(
    'real pointer interaction reaches the renderer',
    await evaluate('return window.__collectionSmokeInputs>0')
  )
  await click('[data-nav=collection]')
  check(
    'actual focused learning tick unlocks exactly one sprite',
    await waitFor(`document.querySelectorAll('[data-collectible][data-unlocked=true]').length===1`)
  )
  await shot('unlocked')
  await closeForRestart()
  const first = JSON.parse(readFileSync(join(userData, 'stats.json'), 'utf8')).rewards
  check(
    'new unlock saved with claimed threshold',
    model.isRewards(first) &&
      Object.keys(first.unlocked).length === 1 &&
      Object.values(first.days).some((d) => d.claimed.includes(5))
  )
  launch()
  await connect()
  await bringOwnedToFront()
  check(
    'restarted collection route ready',
    await waitFor(`document.querySelector('[data-nav=collection]')`)
  )
  await click('[data-nav=collection]')
  check(
    'restart retains unlocked companion',
    await waitFor(`document.querySelectorAll('[data-collectible][data-unlocked=true]').length===1`)
  )
  await sleep(16000)
  await closeForRestart()
  const final = JSON.parse(readFileSync(join(userData, 'stats.json'), 'utf8')).rewards
  check(
    'same milestone never grants twice and collection stays untimed',
    Object.keys(final.unlocked).length === 1 &&
      JSON.stringify(final.days) === JSON.stringify(first.days)
  )
  check('zero renderer errors', errors.length === 0, errors.join('\n'))
} catch (error) {
  results.push({ name: 'collection smoke complete', ok: false, detail: String(error) })
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
