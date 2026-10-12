/** Build first, then node scripts/smoke-responsiveness.mjs. Isolated data, synthetic licensed news, CDP 9475. */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.SMOKE_RESPONSIVENESS_PORT) || 9475
const userData = mkdtempSync(join(tmpdir(), 'qonsona-responsiveness-'))
const output = join(root, 'dist/smoke-responsiveness')
mkdirSync(output, { recursive: true })
const newsDir = join(userData, 'articles/en')
mkdirSync(join(newsDir, 'user'), { recursive: true })
const now = new Date().toISOString()
const paragraph =
  'The library has been serving its neighbourhood for many years. Residents who work during the day have asked for later opening hours. The council will consider their proposal after the public meeting. A reliable service depends on trained staff, accessible rooms and adequate funding. '
const longBody = Array.from({ length: 260 }, (_, i) => `Section ${i + 1}. ${paragraph}`).join(
  '\n\n'
)
const news = Array.from({ length: 120 }, (_, i) => ({
  id: `n-layout-${i}`,
  code: 'en',
  source: 'news',
  sourceId: 'qa-original',
  title: `Community library proposal ${i + 1}`,
  author: 'Qonsona test fixture',
  origin: 'Original responsiveness test',
  license: 'MIT',
  topic: 'qa',
  url: `https://example.invalid/qa/${i}`,
  body: paragraph.repeat(12) + `Proposal ${i + 1}.`,
  chars: paragraph.length * 12,
  level: null,
  readAt: null,
  publishedAt: new Date(Date.now() - i * 60000).toISOString()
}))
writeFileSync(join(newsDir, 'news.json'), JSON.stringify({ checkedAt: now, items: news }))
writeFileSync(
  join(newsDir, 'user/u-long-qa.json'),
  JSON.stringify({
    id: 'u-long-qa',
    code: 'en',
    source: 'user',
    title: 'Long analysis cancellation fixture',
    author: 'Qonsona test fixture',
    license: 'MIT',
    body: longBody,
    chars: longBody.length,
    level: 'C2',
    readAt: null,
    addedAt: now
  })
)
writeFileSync(
  join(userData, 'prefs.json'),
  JSON.stringify({ activePackId: 'en', nhkEasy: false, checkUpdates: false })
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = [],
  errors = [],
  timings = []
let ws, send, evaluate
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `: ${JSON.stringify(detail)}` : ''}`)
  if (!ok) throw new Error(name)
}
const percentile = (xs, p) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))]
try {
  let url
  for (let i = 0; i < 150 && !url; i++) {
    try {
      url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (x) => x.type === 'page'
      )?.webSocketDebuggerUrl
    } catch {
      /* Electron is still starting. */
    }
    if (!url) await sleep(100)
  }
  if (!url) throw new Error('DevTools did not start')
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
    new Promise((r, j) => {
      const id = ++seq
      const timer = setTimeout(() => {
        pending.delete(id)
        j(new Error(`CDP timeout: ${method}`))
      }, 30000)
      pending.set(id, (m) => {
        clearTimeout(timer)
        r(m)
      })
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  evaluate = async (body) => {
    const result = await send('Runtime.evaluate', {
      expression: `(async()=>{${body}})()`,
      awaitPromise: true,
      returnByValue: true
    })
    if (result.error || result.result.exceptionDetails)
      throw new Error(JSON.stringify(result.error ?? result.result.exceptionDetails))
    return result.result.result.value
  }
  const waitFor = async (expr, timeout = 15000) => {
    const end = Date.now() + timeout
    do {
      if (await evaluate(`return !!(${expr})`)) return true
      await sleep(50)
    } while (Date.now() < end)
    return false
  }
  const click = (selector) =>
    evaluate(
      `const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error(${JSON.stringify(selector)});e.click()`
    )
  await send('Emulation.setDeviceMetricsOverride', {
    width: 900,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false
  })
  check(
    'app responds while 120 uncategorised news items load',
    await waitFor('document.querySelector("[data-nav=courses]")', 30000)
  )
  const baseline = []
  for (let i = 0; i < 5; i++)
    baseline.push(
      await evaluate(
        `const at=performance.now();await window.qstudy.invoke('lang:status',['en']);return performance.now()-at`
      )
    )
  const ipcBudget = Math.min(1000, Math.max(500, percentile(baseline, 0.95) * 4))
  const navigationBudget = 1500
  check('warm simple IPC baseline is healthy', percentile(baseline, 0.95) < 500, {
    samples: baseline,
    p95: percentile(baseline, 0.95)
  })
  await evaluate(
    `window.__qaAnalysis={done:false,started:performance.now()};window.qstudy.invoke('lang:analyze','en',${JSON.stringify(longBody)}).then(a=>{window.__qaAnalysis.done=true;window.__qaAnalysis.ms=performance.now()-window.__qaAnalysis.started;window.__qaAnalysis.sentences=a?.sentences.length??0}).catch(e=>{window.__qaAnalysis.done=true;window.__qaAnalysis.error=String(e)})`
  )
  const activeBefore = await evaluate('return !window.__qaAnalysis.done')
  check('long analysis is genuinely pending when navigation begins', activeBefore, {
    chars: longBody.length,
    newsItems: 120
  })
  const navigate = async (page) => {
    const selector = {
      courses: '[data-course]',
      dictionary: '[data-lex-dict=en] [data-dict-input]',
      home: '[data-home]'
    }[page]
    const elapsed = await evaluate(`
   const at=performance.now();document.querySelector('[data-nav=${page}]').click();
   await new Promise((resolve,reject)=>{const end=at+5000;const poll=()=>{if(document.querySelector('[data-nav=${page}][aria-current=page]')&&document.querySelector(${JSON.stringify(selector)}))resolve();else if(performance.now()>end)reject(new Error('navigation did not settle'));else requestAnimationFrame(poll)};poll()});return performance.now()-at;`)
    timings.push({
      kind: 'navigation',
      page,
      ms: elapsed,
      targetMs: 1000,
      budgetMs: navigationBudget
    })
    check(`pending analysis: ${page} click becomes visible`, elapsed <= navigationBudget, {
      ms: elapsed,
      targetMs: 1000,
      budgetMs: navigationBudget
    })
  }
  for (const page of ['courses', 'dictionary', 'home', 'courses', 'dictionary', 'home']) {
    await navigate(page)
    const rpc = await evaluate(
      `const at=performance.now();const status=await window.qstudy.invoke('lang:status',['en']);return {ms:performance.now()-at,available:status[0]?.available,pending:!window.__qaAnalysis.done}`
    )
    timings.push({
      kind: 'ipc',
      channel: 'lang:status',
      ...rpc,
      targetMs: 500,
      budgetMs: ipcBudget
    })
    check(
      `${page}: simple IPC is not queued behind analysis`,
      rpc.available && rpc.ms <= ipcBudget,
      rpc
    )
    if (page === 'dictionary') {
      // Let the page's initial auto-focus and empty-query effect settle before typing.
      await sleep(250)
      const lookup = await evaluate(
        `const at=performance.now();const input=document.querySelector('[data-dict-input]');input.focus();input.value='house';input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise((resolve,reject)=>{const end=at+5000;const poll=()=>{if(document.querySelector('[data-headword]')?.textContent.trim().toLowerCase()==='house')resolve();else if(performance.now()>end)reject(new Error('dictionary lookup timed out'));else requestAnimationFrame(poll)};poll()});return {ms:performance.now()-at,pending:!window.__qaAnalysis.done};`
      )
      timings.push({ kind: 'dictionary', word: 'house', ...lookup, targetMs: 1000, budgetMs: 1500 })
      check('dictionary input and lookup respond during analysis', lookup.ms <= 1500, lookup)
    }
  }
  check(
    'seeded news list becomes available',
    await waitFor('document.querySelectorAll("[data-news-item]").length>1', 90000)
  )
  const list = await evaluate(
    `return (await window.qstudy.invoke('langArticles:list','en')).filter(x=>x.source==='news').length`
  )
  check('all 120 synthetic news items retained', list === 120, { count: list })
  await sleep(350)
  const sampleFeed = () =>
    evaluate(`
  const feed=document.querySelector('[data-news-feed]');if(!feed)throw new Error('No feed');
  const slides=Array.from(feed.querySelectorAll('[data-slide]'));const references=[feed,...slides];
  let replacements=0;const observer=new MutationObserver(records=>{for(const r of records)if(r.type==='childList')replacements+=Array.from(r.removedNodes).filter(n=>n.nodeType===1&&(n.matches?.('[data-slide],[data-news-feed]')||n.querySelector?.('[data-slide],[data-news-feed]'))).length});observer.observe(document.querySelector('[data-home]'),{childList:true,subtree:true});
  const samples=[];for(let i=0;i<25;i++){const f=document.querySelector('[data-news-feed]'),active=f.querySelector('[aria-current=true]'),r=f.getBoundingClientRect();samples.push({t:performance.now(),height:f.clientHeight,cssHeight:parseFloat(getComputedStyle(f).getPropertyValue('--h')),top:r.top,bottom:r.bottom,scroll:f.scrollTop,active:f.dataset.active,key:active?.dataset.newsItem,same:f===references[0]&&Array.from(f.querySelectorAll('[data-slide]')).every((s,j)=>s===references[j+1])});await new Promise(r=>setTimeout(r,120))}observer.disconnect();return {samples,replacements};`)
  for (const size of [
    [900, 600],
    [1280, 820]
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: size[0],
      height: size[1],
      deviceScaleFactor: 1,
      mobile: false
    })
    await sleep(350)
    const stable = await sampleFeed()
    const first = stable.samples[0]
    const heights = stable.samples.map((x) => x.height),
      tops = stable.samples.map((x) => x.top),
      scrolls = stable.samples.map((x) => x.scroll)
    check(
      `${size.join('x')}: news feed remains stable for three seconds`,
      stable.replacements === 0 &&
        stable.samples.every(
          (x) =>
            x.same &&
            x.key === first.key &&
            x.active === first.active &&
            Math.abs(x.height - x.cssHeight) <= 1
        ) &&
        Math.max(...heights) - Math.min(...heights) <= 1 &&
        Math.max(...tops) - Math.min(...tops) <= 1 &&
        Math.max(...scrolls) - Math.min(...scrolls) <= 1,
      stable
    )
  }
  // Exercise a real reader session and leave before its Promise resolves.
  await click('[data-nav=reading]')
  check(
    'long article present in real library',
    await waitFor('document.querySelector("[data-article=u-long-qa] .open")')
  )
  await click('[data-article=u-long-qa] .open')
  await sleep(30)
  await navigate('courses')
  await navigate('dictionary')
  await navigate('home')
  const completed = await waitFor('window.__qaAnalysis.done', 90000)
  const analysisResult = await evaluate('return window.__qaAnalysis')
  check(
    'detached long analysis eventually succeeds',
    completed && !analysisResult.error && analysisResult.sentences > 0,
    analysisResult
  )
  await sleep(500)
  check(
    'late analysis results do not navigate back into the abandoned reader',
    await evaluate(
      'return !!document.querySelector("[data-nav=home][aria-current=page]")&&!!document.querySelector("[data-home]")&&!document.querySelector("[data-lex-reader]")'
    )
  )
  check('no renderer errors', errors.length === 0, errors)
} catch (error) {
  errors.push(String(error))
  console.error(error)
  process.exitCode = 1
} finally {
  if (send) await send('Emulation.clearDeviceMetricsOverride').catch(() => {})
  ws?.close()
  child.kill()
  writeFileSync(
    join(output, 'results.json'),
    JSON.stringify(
      { userData, seededNews: 120, longTextChars: longBody.length, results, timings, errors },
      null,
      2
    )
  )
}
