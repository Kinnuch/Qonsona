/** 七门新增语言的真实 Electron 验收，使用独立用户数据目录，不操作已安装实例。 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.SMOKE_PORT) || 9483
const userData = mkdtempSync(join(tmpdir(), 'qonsona-daily-'))
const shots = join(root, 'dist/smoke-dictionary-daily')
mkdirSync(shots, { recursive: true })
writeFileSync(join(userData, 'prefs.json'), JSON.stringify({ checkUpdates: false, nhkEasy: false }))
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const wav = Buffer.alloc(44 + 8000 * 8 * 2)
wav.write('RIFF', 0)
wav.writeUInt32LE(wav.length - 8, 4)
wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(8000, 24)
wav.writeUInt32LE(16000, 28)
wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(wav.length - 44, 40)
const wavFile = join(userData, 'qa-silence.wav')
writeFileSync(wavFile, wav)
const child = spawn(
  process.env.SMOKE_EXE || join(root, 'node_modules/electron/dist/electron.exe'),
  [
    ...(process.env.SMOKE_EXE ? [] : [root]),
    `--user-data-dir=${userData}`,
    `--remote-debugging-port=${port}`,
    // Keep automated timers and rendering active when Codex takes focus between checks.
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream'
  ],
  { env, stdio: 'ignore' }
)
const sleep = (n) => new Promise((r) => setTimeout(r, n))
const results = []
const errors = []
let ws
let capture
let inspect
function check(name, value, detail = '') {
  results.push({ name, ok: !!value, detail })
  console.log(`${value ? '✓' : '✗'} ${name}${detail ? ': ' + detail : ''}`)
  if (!value) throw new Error(`${name}: ${detail}`)
}
try {
  let url
  for (let i = 0; i < 100 && !url; i++) {
    try {
      url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (t) => t.type === 'page'
      )?.webSocketDebuggerUrl
    } catch {
      /* 启动中 */
    }
    if (!url) await sleep(200)
  }
  if (!url) throw new Error('Electron DevTools 未启动')
  ws = new WebSocket(url)
  await new Promise((r, j) => {
    ws.onopen = r
    ws.onerror = j
  })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id) {
      pending.get(msg.id)?.(msg)
      pending.delete(msg.id)
    } else if (msg.method === 'Runtime.exceptionThrown')
      errors.push(
        msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text
      )
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
  }
  const send = (method, params = {}) =>
    new Promise((r) => {
      const id = ++seq
      pending.set(id, r)
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', {
      expression: `(async () => { ${expr} })()`,
      awaitPromise: true,
      returnByValue: true
    })
    if (res.result?.exceptionDetails)
      throw new Error(
        res.result.exceptionDetails.exception?.description ?? res.result.exceptionDetails.text
      )
    return res.result?.result?.value
  }
  inspect = evaluate
  const waitFor = async (expr, ms = 15000) => {
    const end = Date.now() + ms
    do {
      if (await evaluate(`return !!(${expr})`)) return true
      await sleep(100)
    } while (Date.now() < end)
    return false
  }
  const click = (selector) =>
    evaluate(
      `const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('missing '+${JSON.stringify(selector)}); el.click()`
    )
  const shot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(shots, `${name}.png`), Buffer.from(res.result.data, 'base64'))
  }
  capture = shot
  check('app starts', await waitFor('document.querySelector("[data-nav=home]")'))
  const today = new Date().toLocaleDateString('sv-SE')
  for (const code of ['ja', 'en', 'fr', 'ko', 'es', 'ar', 'ru', 'gd']) {
    await click('[data-switcher]')
    await click(`[data-pack="${code}"]`)
    await click('[data-nav=dictionary]')
    check(
      `${code} real daily UI`,
      await waitFor(`document.querySelector('[data-dictionary-daily="${code}"] [data-daily-word]')`)
    )
    check(
      `${code} three blocks`,
      await evaluate(
        `return document.querySelectorAll('[data-dictionary-daily="${code}"] [data-daily-block]').length===3`
      )
    )
    const bundle = await evaluate(
      `return await window.qstudy.invoke('dictionary:daily',${JSON.stringify(code)},${JSON.stringify(today)})`
    )
    const again = await evaluate(
      `return await window.qstudy.invoke('dictionary:daily',${JSON.stringify(code)},${JSON.stringify(today)})`
    )
    check(
      `${code} stable real source IDs`,
      JSON.stringify(bundle) === JSON.stringify(again) &&
        bundle.words.every(
          (w) => Number.isInteger(w.entryId) && w.card.key.endsWith(String(w.entryId))
        ) &&
        bundle.sentences.length > 0 &&
        bundle.grammar.length > 0
    )
    const next = await evaluate(
      `return await window.qstudy.invoke('dictionary:daily',${JSON.stringify(code)},'2026-10-13')`
    )
    const prev = await evaluate(
      `return await window.qstudy.invoke('dictionary:daily',${JSON.stringify(code)},'2026-10-12')`
    )
    check(
      `${code} cross-day rotation`,
      next.words.map((w) => w.id).join() !== prev.words.map((w) => w.id).join()
    )
    await evaluate(
      `const el=document.querySelector('[data-daily-date-input]');el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))`
    )
    check(
      `${code} cleared date recoverable`,
      await waitFor(
        `document.querySelector('[data-daily-error]')&&!document.querySelector('[data-daily-word]')`
      )
    )
    await evaluate(
      `const el=document.querySelector('[data-daily-date-input]');el.value='2026-10-12';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))`
    )
    check(
      `${code} valid date restores`,
      await waitFor(
        `document.querySelector('[data-daily-word]')&&!document.querySelector('[data-daily-error]')`
      )
    )
    const ids = await evaluate(
      `return [...document.querySelectorAll('[data-daily-word]')].map(e=>e.dataset.dailyWord)`
    )
    await evaluate(
      `const el=document.querySelector('[data-daily-date-input]');el.value='2026-10-13';el.dispatchEvent(new Event('input',{bubbles:true}))`
    )
    check(
      `${code} UI rotates date`,
      await waitFor(`document.querySelector('[data-daily-date="2026-10-13"] [data-daily-word]')`)
    )
    await evaluate(
      `const el=document.querySelector('[data-daily-date-input]');el.value='2026-10-12';el.dispatchEvent(new Event('input',{bubbles:true}))`
    )
    check(
      `${code} UI restores historical IDs`,
      await waitFor(
        `JSON.stringify([...document.querySelectorAll('[data-daily-word]')].map(e=>e.dataset.dailyWord))===${JSON.stringify(JSON.stringify(ids))}`
      )
    )
    const entryId = await evaluate(
      `return document.querySelector('[data-daily-word]').dataset.dailyWord`
    )
    await click('[data-daily-word] [data-add-notebook]')
    check(
      `${code} adds real recommendation to notebook`,
      await waitFor(`document.querySelector('[data-daily-word] [data-in-notebook]')`)
    )
    await click('[data-daily-open-word]')
    check(
      `${code} exact real word opens`,
      await waitFor(`document.querySelector('[data-entry="${entryId}"]')`)
    )
    check(
      `${code} word callback hides recommendations`,
      await waitFor(`!document.querySelector('[data-dictionary-daily]')`)
    )
    await evaluate(
      `const el=document.querySelector('[data-dict-input]');el.value='';el.dispatchEvent(new Event('input',{bubbles:true}))`
    )
    check(
      `${code} clearing search restores daily`,
      await waitFor(`document.querySelector('[data-daily-open-grammar]')`)
    )
    const sentenceText = await evaluate(
      `return document.querySelector('[data-daily-sentence] .sentence-text').textContent`
    )
    await click('[data-daily-query-sentence]')
    check(
      `${code} sentence query uses real sentence`,
      await waitFor(
        `document.querySelector('[data-dict-input]')?.value===${JSON.stringify(sentenceText)}`
      )
    )
    await click('[data-dict-tab=words]')
    await evaluate(
      `const el=document.querySelector('[data-dict-input]');el.value='';el.dispatchEvent(new Event('input',{bubbles:true}))`
    )
    check(
      `${code} restores from sentence`,
      await waitFor(`document.querySelector('[data-daily-open-grammar]')`)
    )
    const lessonId = await evaluate(
      `return (await window.qstudy.invoke('dictionary:daily',${JSON.stringify(code)},'2026-10-12')).grammar[0].lessonId`
    )
    await click('[data-daily-course]')
    check(
      `${code} opens related course`,
      await waitFor(`document.querySelector('[data-lesson-page="${lessonId}"]')`)
    )
    await click('[data-nav=dictionary]')
    check(
      `${code} daily available after course`,
      await waitFor(`document.querySelector('[data-daily-open-grammar]')`)
    )
    const grammarId = await evaluate(
      `return document.querySelector('[data-daily-grammar]').dataset.dailyGrammar`
    )
    await click('[data-daily-open-grammar]')
    check(
      `${code} grammar opens explanation`,
      await waitFor(`!document.querySelector('[data-dictionary-daily]')`)
    )
    check(
      `${code} exact grammar point selected`,
      await waitFor(
        `document.querySelector('[data-grammar-detail="${grammarId}"]') || document.querySelector('[data-grammar-point="${grammarId}"].on')`
      )
    )
    await shot(`${code}-grammar`)
    await click('[data-nav=home]')
  }
  check('zero renderer errors', errors.length === 0, errors.join(' | '))
} catch (e) {
  if (capture) await capture('failure').catch(() => {})
  if (inspect)
    writeFileSync(
      join(shots, 'failure-ui.txt'),
      String(await inspect('return document.body.innerText').catch(() => ''))
    )
  console.error(e.stack ?? e)
  results.push({ name: '验收完成', ok: false, detail: String(e) })
} finally {
  ws?.close()
  child.kill()
  writeFileSync(join(shots, 'results.json'), JSON.stringify({ results, errors, userData }, null, 2))
}
const failed = results.filter((r) => !r.ok)
console.log(`${results.length - failed.length}/${results.length} 通过；截图 ${shots}`)
process.exit(failed.length ? 1 : 0)
