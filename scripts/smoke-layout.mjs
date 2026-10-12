/**
 * Real Chromium layout assertions at multiple viewport sizes, in an isolated Electron profile.
 * Build first, then: node scripts/smoke-layout.mjs
 * Tests viewport-height chains, native wheel scrolling, short-window navigation,
 * C2 reachability and native table-row geometry. No installed-app data is used.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.SMOKE_LAYOUT_PORT) || 9474
const userData = mkdtempSync(join(tmpdir(), 'qonsona-layout-'))
const output = join(root, 'dist/smoke-layout')
mkdirSync(output, { recursive: true })
writeFileSync(
  join(userData, 'prefs.json'),
  JSON.stringify({ activePackId: 'en', checkUpdates: false, nhkEasy: false })
)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(
  join(root, 'node_modules/electron/dist/electron.exe'),
  [
    root,
    `--user-data-dir=${userData}`,
    `--remote-debugging-port=${port}`,
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ],
  { env, stdio: 'ignore' }
)
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const errors = []
let ws
let send
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `: ${JSON.stringify(detail)}` : ''}`)
  if (!ok) throw new Error(name)
}
try {
  let url
  for (let i = 0; i < 100 && !url; i++) {
    try {
      url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (x) => x.type === 'page'
      )?.webSocketDebuggerUrl
    } catch {
      /* Electron is still starting. */
    }
    if (!url) await pause(200)
  }
  if (!url) throw new Error('Electron did not expose a DevTools page')
  ws = new WebSocket(url)
  await new Promise((r, j) => {
    ws.onopen = r
    ws.onerror = j
  })
  let seq = 0
  const pending = new Map()
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id) {
      pending.get(msg.id)?.(msg)
      pending.delete(msg.id)
    } else if (msg.method === 'Runtime.exceptionThrown')
      errors.push(
        msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text
      )
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')
      errors.push(msg.params.args.map((x) => x.value ?? x.description).join(' '))
  }
  send = (method, params = {}) =>
    new Promise((r) => {
      const id = ++seq
      pending.set(id, r)
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  const evaluate = async (body) => {
    const result = await send('Runtime.evaluate', {
      expression: `(async()=>{${body}})()`,
      awaitPromise: true,
      returnByValue: true
    })
    if (result.error || result.result.exceptionDetails)
      throw new Error(JSON.stringify(result.error ?? result.result.exceptionDetails))
    return result.result.result.value
  }
  const waitFor = async (expression) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`return !!(${expression})`)) return true
      await pause(100)
    }
    return false
  }
  const click = (selector) =>
    evaluate(
      `const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error(${JSON.stringify(`Missing ${selector}`)});e.click()`
    )
  const screenshot = async (name) => {
    const result = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(output, `${name}.png`), Buffer.from(result.result.data, 'base64'))
  }
  check('app ready', await waitFor('document.querySelector("[data-nav=courses]")'))
  const arabic = await evaluate(`
    const sample=document.createElement('div');sample.lang='ar';sample.innerHTML='<span><strong>كتاب</strong></span>';document.body.append(sample);
    const sizes=[sample,...sample.querySelectorAll('*')].map(e=>getComputedStyle(e).fontSize);sample.remove();return sizes;`)
  check(
    'Arabic font scale applies once rather than multiplying through descendants',
    new Set(arabic).size === 1,
    arabic
  )
  for (const [width, height] of [
    [900, 600],
    [1280, 820],
    [720, 420],
    [1280, 360],
    [640, 320]
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    })
    await pause(150)
    for (const page of [
      'home',
      'dictionary',
      'reading',
      'notebook',
      'courses',
      'practice',
      'media',
      'stats',
      'packs',
      'settings'
    ]) {
      await click(`[data-nav=${page}]`)
      await pause(80)
      const metrics = await evaluate(`
        const main=document.querySelector('[data-main-scroll]'),nav=document.querySelector('.shell > nav');
        const rect=main.getBoundingClientRect(),n=nav.getBoundingClientRect();
        return {height:innerHeight,root:document.documentElement.getBoundingClientRect().height,app:document.querySelector('#app').getBoundingClientRect().height,
          mainHeight:main.clientHeight,mainBottom:rect.bottom,navBottom:n.bottom,bodyScroll:document.body.scrollHeight,
          horizontal:main.scrollWidth-main.clientWidth,fontSize:getComputedStyle(document.documentElement).fontSize,
          overflowing:Array.from(main.querySelectorAll('*')).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,class:String(e.className),left:r.left,right:r.right,width:r.width,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}}).filter(e=>e.width>0&&e.right>rect.right-12).sort((a,b)=>b.right-a.right).slice(0,15)};`)
      check(
        `${width}x${height}/${page}: full-height root, sidebar and scroll pane`,
        Math.abs(metrics.root - height) < 2 &&
          Math.abs(metrics.app - height) < 2 &&
          Math.abs(metrics.navBottom - height) < 2 &&
          Math.abs(metrics.mainBottom - height) < 2 &&
          metrics.mainHeight > height - 2,
        metrics
      )
    }
    // Settings has real long content, rather than an artificial spacer.
    const wheel = await evaluate(
      `const m=document.querySelector('[data-main-scroll]');m.scrollTop=0;const r=m.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+Math.min(160,r.height/2),range:m.scrollHeight-m.clientHeight}`
    )
    check(`${width}x${height}: settings offers actual scrollable content`, wheel.range > 30, wheel)
    await send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: wheel.x,
      y: wheel.y,
      deltaX: 0,
      deltaY: 450
    })
    await pause(120)
    check(
      `${width}x${height}: native wheel advances content`,
      await evaluate('return document.querySelector("[data-main-scroll]").scrollTop>10')
    )
    const sidebar = await evaluate(`
      const n=document.querySelector('[data-nav-scroll]');n.scrollTop=n.scrollHeight;
      const settings=n.querySelector('[data-nav=settings]').getBoundingClientRect(),r=n.getBoundingClientRect(),s=document.querySelector('[data-switcher]').getBoundingClientRect();
      return {navRange:n.scrollHeight-n.clientHeight,footerVisible:settings.top>=r.top-1&&settings.bottom<=r.bottom+1,switcherVisible:s.top>=0&&s.bottom<=innerHeight};`)
    check(
      `${width}x${height}: short-window footer and switcher reachable`,
      sidebar.footerVisible && sidebar.switcherVisible,
      sidebar
    )
    await screenshot(`settings-${width}x${height}`)
  }

  await send('Emulation.setDeviceMetricsOverride', {
    width: 900,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false
  })
  // A long real course should expose its last CEFR unit after scrolling to the end.
  await click('[data-nav=courses]')
  check('course list ready', await waitFor('document.querySelector("[data-course=grammar]")'))
  await click('[data-course=grammar] [data-continue]')
  check('grammar lesson ready', await waitFor('document.querySelector("[data-lesson-page]")'))
  await click('[data-lesson-page] [data-back]')
  check(
    'grammar overview ready',
    await waitFor('document.querySelector("[data-course-page=grammar] [data-unit=C2]")')
  )
  const c2 = await evaluate(`
    const m=document.querySelector('[data-main-scroll]');m.scrollTop=m.scrollHeight;
    await new Promise(r=>requestAnimationFrame(r));
    const last=Array.from(document.querySelectorAll('[data-unit=C2] [data-lesson]')).at(-1).getBoundingClientRect(),view=m.getBoundingClientRect();
    return {range:m.scrollHeight-m.clientHeight,top:last.top,bottom:last.bottom,viewTop:view.top,viewBottom:view.bottom};`)
  check(
    'C2 final lesson reachable in 900x600',
    c2.range > 0 && c2.top >= c2.viewTop && c2.bottom <= c2.viewBottom + 1,
    c2
  )
  await screenshot('grammar-C2-bottom')

  await click('[data-course-page] [data-back]')
  await click('[data-course=inflection] [data-continue]')
  check(
    'inflection table ready',
    await waitFor('document.querySelector("[data-forms-table] tbody tr")')
  )
  // Add uneven metadata only to this temporary DOM to exercise the exact regression:
  // the original word's tall cell must share a row height with the other columns.
  await evaluate(
    `const cell=document.querySelector('[data-forms-table] td.base .cell-stack');const note=document.createElement('span');note.textContent=${JSON.stringify('A longer explanation\nSecond explanatory line\nThird explanatory line')};note.style.whiteSpace='pre-line';cell.append(note)`
  )
  for (const [width, height] of [
    [1280, 820],
    [900, 600],
    [640, 320]
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    })
    await pause(100)
    const table = await evaluate(`
      const table=document.querySelector('[data-forms-table]');
      return Array.from(table.rows).map(row=>{const cells=Array.from(row.cells);const rects=cells.map(c=>c.getBoundingClientRect());return {
        sameTop:rects.every(r=>Math.abs(r.top-rects[0].top)<1),sameBottom:rects.every(r=>Math.abs(r.bottom-rects[0].bottom)<1),
        native:cells.every(c=>getComputedStyle(c).display==='table-cell'),height:row.getBoundingClientRect().height};});`)
    check(
      `${width}x${height}: tall table rows align across all columns`,
      table.length > 1 && table.every((r) => r.sameTop && r.sameBottom && r.native),
      table
    )
    await screenshot(`forms-${width}x${height}`)
  }
  // Verify the dictionary's larger French paradigm also stays native and scrolls locally.
  await click('[data-switcher]')
  await click('[data-pack=fr]')
  await click('[data-nav=dictionary]')
  check(
    'French dictionary ready',
    await waitFor('document.querySelector("[data-lex-dict=fr] [data-dict-input]")')
  )
  await evaluate(
    `const el=document.querySelector('[data-dict-input]');el.value='venir';el.dispatchEvent(new Event('input',{bubbles:true}))`
  )
  check(
    'French verb lookup ready',
    await waitFor('document.querySelector("[data-headword]")?.textContent.includes("venir")')
  )
  await evaluate(
    `if(!document.querySelector('[data-paradigm]'))document.querySelector('[data-inflection-toggle]')?.click()`
  )
  check(
    'dictionary paradigm ready',
    await waitFor('document.querySelector("[data-paradigm] tr td")')
  )
  const dictionary = await evaluate(`
    const tables=Array.from(document.querySelectorAll('[data-dict-forms-scroll] table'));
    const rows=tables.flatMap(t=>Array.from(t.rows));
    const wrapper=document.querySelector('[data-dict-forms-scroll]'),detail=wrapper.closest('.detail');
    return {rows:rows.length,native:rows.every(r=>Array.from(r.cells).every(c=>getComputedStyle(c).display==='table-cell')),
      aligned:rows.every(r=>{const a=Array.from(r.cells).map(c=>c.getBoundingClientRect());return a.every(b=>Math.abs(b.top-a[0].top)<1&&Math.abs(b.bottom-a[0].bottom)<1)}),
      wrapperWidth:wrapper.getBoundingClientRect().width,detailWidth:detail.clientWidth,overflow:getComputedStyle(wrapper).overflowX};`)
  check(
    'dictionary tables retain aligned native rows and bounded horizontal scroller',
    dictionary.rows > 0 &&
      dictionary.native &&
      dictionary.aligned &&
      dictionary.wrapperWidth <= dictionary.detailWidth + 1 &&
      dictionary.overflow === 'auto',
    dictionary
  )
  await screenshot('dictionary-paradigm-narrow')
  check('no console errors or uncaught exceptions', !errors.length, errors)
} catch (error) {
  errors.push(String(error))
  process.exitCode = 1
} finally {
  if (send) await send('Emulation.clearDeviceMetricsOverride').catch(() => {})
  ws?.close()
  child.kill()
  writeFileSync(
    join(output, 'results.json'),
    JSON.stringify({ profile: userData, results, errors }, null, 2)
  )
}
