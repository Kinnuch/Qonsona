/** Real dictionary entries, isolated profile, CDP only. Run after build; no OS dialogs. */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.SMOKE_PORT) || 9484
const userData = mkdtempSync(join(tmpdir(), 'qonsona-inflection-'))
const output = join(root, 'dist/smoke-dictionary-inflection')
mkdirSync(output, { recursive: true })
writeFileSync(
  join(userData, 'prefs.json'),
  JSON.stringify({ checkUpdates: false, nhkEasy: false, locale: 'zh' })
)
const results = [],
  errors = [],
  entries = [],
  logs = []
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let child, ws, evaluate, capture
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ': ' + detail : ''}`)
  if (!ok) throw new Error(`${name}: ${detail}`)
}
const sameSet = (a, b) =>
  JSON.stringify([...new Set(a)].sort()) === JSON.stringify([...new Set(b)].sort())
try {
  // Use the existing JA conjugator as the oracle: JMdict has class tags, not attested paradigms.
  const oracleFile = join(userData, 'inflection-oracle.mjs')
  await build({
    stdin: {
      contents:
        "export { dictionaryInflection } from './src/shared/ja/dictionary-inflection'; export { gdInflectionAlternations } from './src/shared/lang/gd/inflection'; export { inflectionData } from './src/shared/lang/inflection'",
      resolveDir: root
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: oracleFile,
    logLevel: 'silent'
  })
  const oracle = await import(pathToFileURL(oracleFile).href)
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  child = spawn(
    process.env.SMOKE_EXE || join(root, 'node_modules/electron/dist/electron.exe'),
    [
      ...(process.env.SMOKE_EXE ? [] : [root]),
      `--user-data-dir=${userData}`,
      `--remote-debugging-port=${port}`,
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ],
    { env, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  child.stdout.on('data', (chunk) => logs.push(String(chunk)))
  child.stderr.on('data', (chunk) => logs.push(String(chunk)))
  child.on('error', (error) => errors.push(String(error)))
  let url
  for (let i = 0; i < 150 && !url; i++) {
    try {
      url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (t) => t.type === 'page'
      )?.webSocketDebuggerUrl
    } catch {
      /* starting */
    }
    if (child.exitCode !== null) throw new Error(`Electron exited ${child.exitCode}`)
    if (!url) await sleep(200)
  }
  if (!url) throw new Error('Electron DevTools did not start')
  ws = new WebSocket(url)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
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
    new Promise((resolve, reject) => {
      const id = ++seq
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`CDP timeout: ${method}`))
      }, 20000)
      pending.set(id, (msg) => {
        clearTimeout(timer)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      })
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression: `(async()=>{${expression}})()`,
      awaitPromise: true,
      returnByValue: true
    })
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ?? result.exceptionDetails.text
      )
    return result.result?.value
  }
  const waitFor = async (expression, timeout = 15000) => {
    const deadline = Date.now() + timeout
    do {
      if (await evaluate(`return !!(${expression})`)) return true
      await sleep(100)
    } while (Date.now() < deadline)
    return false
  }
  const click = (selector) =>
    evaluate(
      `const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.click()`
    )
  capture = async (name) => {
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false
    })
    writeFileSync(join(output, `${name}.png`), Buffer.from(shot.data, 'base64'))
  }
  const snapshot = () =>
    evaluate(`const p=document.querySelector('[data-inflection-panel]');return {
    text:p?.innerText??'', heading:p?.querySelector('h3')?.textContent,
    forms:[...p?.querySelectorAll('[data-inflection-form]')??[]].map(e=>({form:e.dataset.inflectionForm,provenance:e.dataset.inflectionProvenance})),
    kinds:[...p?.querySelectorAll('[data-inflection-table-kind]')??[]].map(e=>e.dataset.inflectionTableKind),
    ja:[...p?.querySelectorAll('tbody tr')??[]].map(r=>r.querySelector('td')?.textContent?.trim()),
    alternations:[...p?.querySelectorAll('[data-inflection-alternation]')??[]].map(e=>({id:e.dataset.inflectionAlternation,form:e.querySelector('p bdi.surface')?.textContent,text:e.innerText,examples:[...e.querySelectorAll('[data-inflection-example]')].map(x=>x.innerText)})),
    recorded:p?.querySelector('[data-inflection-recorded]')?.dataset.inflectionRecorded,
    generated:p?.querySelector('[data-inflection-generated]')?.dataset.inflectionGenerated
  }`)
  check('app starts', await waitFor('document.querySelector("[data-nav=home]")'))
  const cases = {
    en: [
      ['go', 'verb'],
      ['good', 'adj']
    ],
    fr: [
      ['venir', 'verb'],
      ['beau', 'adj']
    ],
    es: [
      ['hablar', 'verb'],
      ['libro', 'noun'],
      ['bueno', 'adj']
    ],
    ru: [['книга', 'noun']],
    ar: [['كتاب', 'noun']],
    ko: [
      ['듣다', 'verb'],
      ['학교', 'noun']
    ],
    gd: [
      ['bàta', 'noun'],
      ['athair', 'noun'],
      ['caraid', 'noun']
    ],
    ja: [
      ['来る', 'v'],
      ['いい', 'adj'],
      ['猫', 'n']
    ]
  }
  let scrollSeen = false
  for (const [code, words] of Object.entries(cases)) {
    await click('[data-switcher]')
    await click(`[data-pack="${code}"]`)
    await click('[data-nav=dictionary]')
    check(`${code} dictionary ready`, await waitFor('document.querySelector("[data-dict-input]")'))
    await click('[data-dict-tab=words]')
    let previousId
    for (const [word, pos] of words) {
      const real = await evaluate(
        `const r=await window.qstudy.invoke(${JSON.stringify(code === 'ja' ? 'ja:search' : 'lang:search')},${code === 'ja' ? '' : JSON.stringify(code) + ','}${JSON.stringify(word)});return r`
      )
      const hits = (real?.hits ?? []).filter((h) =>
        code === 'ja' ? h.head === word || h.reading === word : h.w === word
      )
      let entry
      for (const hit of hits) {
        const candidate = await evaluate(
          `return await window.qstudy.invoke(${JSON.stringify(code === 'ja' ? 'ja:entry' : 'lang:entry')},${code === 'ja' ? '' : JSON.stringify(code) + ','}${Number(hit.id)})`
        )
        if (
          code === 'ja'
            ? candidate?.senses.some((s) => s.pos.some((p) => p.startsWith(pos)))
            : candidate?.p.includes(pos)
        ) {
          entry = candidate
          break
        }
      }
      check(`${code} ${word} real ${pos} entry`, !!entry, `exact candidates=${hits.length}`)
      await evaluate(
        `const e=document.querySelector('[data-dict-input]');e.value=${JSON.stringify(word)};e.dispatchEvent(new Event('input',{bubbles:true}))`
      )
      check(
        `${code} ${word} visible source hit`,
        await waitFor(`document.querySelector('[data-hit="${entry.id}"]')`)
      )
      await click(`[data-hit="${entry.id}"]`)
      check(
        `${code} ${word} selected`,
        await waitFor(
          `document.querySelector('[data-entry="${entry.id}"] [data-inflection-toggle]')`
        )
      )
      if (previousId !== undefined && previousId !== entry.id)
        check(
          `${code} next entry closes panel`,
          await waitFor('!document.querySelector("[data-inflection-panel]")')
        )
      check(
        `${code} ${word} header button`,
        await evaluate(
          `return !!document.querySelector('[data-entry="${entry.id}"] header [data-inflection-toggle]')`
        )
      )
      await click('[data-inflection-toggle]')
      check(
        `${code} ${word} opens on click`,
        await waitFor(
          'document.querySelector("[data-inflection-panel]")&&document.querySelector("[data-inflection-toggle]").getAttribute("aria-expanded")==="true"'
        )
      )
      const view = await snapshot()
      entries.push({ code, word, entry, view })
      if (code === 'ja') {
        const groups = oracle.dictionaryInflection(entry)
        check(
          `ja ${word} existing JMdict-class conjugation only`,
          sameSet(
            view.ja,
            groups.flatMap((g) => g.rows.map((r) => r.text))
          ),
          `groups=${groups.length}`
        )
        if (word === '猫')
          check(
            'ja noun has no fabricated declension',
            !view.ja.length && view.text.includes('助词')
          )
        else check(`ja ${word} conjugation rows`, view.ja.length > 0)
      } else {
        const source = new Set(entry.forms.map((f) => f.form.trim()).filter(Boolean))
        check(
          `${code} ${word} no unsourced dictionary shape`,
          view.forms.every(
            (f) =>
              (f.provenance === 'dictionary' && source.has(f.form)) ||
              (code === 'ko' && f.provenance === 'rule')
          )
        )
        check(
          `${code} ${word} all recorded forms retained`,
          entry.forms
            .filter((f) => f.form.trim())
            .every((f) => view.forms.some((s) => s.form === f.form.trim()))
        )
        const expected = oracle.inflectionData(entry)
        const variations = code === 'gd' ? oracle.gdInflectionAlternations(entry) : []
        const expectedGenerated =
          expected.generated + variations.filter((v) => v.provenance === 'rule').length
        check(
          `${code} ${word} counts and classified tables`,
          Number(view.recorded) === expected.recorded &&
            Number(view.generated) === expectedGenerated &&
            sameSet(
              view.kinds,
              expected.tables.map((t) => t.kind)
            )
        )
        if (view.forms.some((f) => f.provenance === 'rule'))
          check(
            'ko generated forms explicitly labeled',
            view.text.includes('规则生成') && code === 'ko'
          )
        if (code === 'gd') {
          check(
            `gd ${word} conditional results`,
            sameSet(
              view.alternations.map((a) => a.id),
              variations.map((a) => a.id)
            ) && variations.length > 0
          )
          check(
            `gd ${word} accurate spelling and condition`,
            variations.every((a) =>
              view.alternations.some(
                (v) => v.id === a.id && v.form === a.form && v.text.includes(a.notice.zh)
              )
            )
          )
          check(
            `gd ${word} examples and provenance`,
            variations.every((a) => {
              const v = view.alternations.find((v) => v.id === a.id)
              return a.examples.every((ex) =>
                v.examples.some(
                  (text) =>
                    text.includes(ex.text) &&
                    text.includes(ex.provenance === 'original' ? '自编例句' : '词典例句')
                )
              )
            })
          )
          if (word === 'caraid')
            check(
              'gd uncurated noun has no invented original sentence',
              variations.every((a) => a.examples.every((ex) => ex.provenance !== 'original'))
            )
        }
      }
      await capture(`${code}-${words.indexOf(words.find((w) => w[0] === word))}`)
      await send('Emulation.setDeviceMetricsOverride', {
        width: 640,
        height: 760,
        deviceScaleFactor: 1,
        mobile: false
      })
      const geometry =
        await evaluate(`return [...document.querySelectorAll('[data-inflection-panel] [data-dict-forms-scroll]')].map(s=>({
        overflow:getComputedStyle(s).overflowX,width:s.clientWidth,scrollWidth:s.scrollWidth,
        rows:[...s.querySelectorAll('tbody tr')].map(r=>({display:getComputedStyle(r).display,cells:[...r.children].map(c=>{const b=c.getBoundingClientRect();return {top:b.top,bottom:b.bottom}})})),
        moved:(()=>{s.scrollLeft=50;return s.scrollLeft})()
      }))`)
      check(
        `${code} ${word} narrow native table rows`,
        geometry.every((g) =>
          g.rows.every(
            (r) =>
              r.display === 'table-row' &&
              r.cells.every(
                (c) =>
                  Math.abs(c.top - r.cells[0].top) < 2 && Math.abs(c.bottom - r.cells[0].bottom) < 2
              )
          )
        )
      )
      check(
        `${code} ${word} narrow overflow scrollable`,
        geometry.every(
          (g) =>
            g.scrollWidth <= g.width + 1 || (['auto', 'scroll'].includes(g.overflow) && g.moved > 0)
        )
      )
      scrollSeen ||= geometry.some((g) => g.scrollWidth > g.width + 1 && g.moved > 0)
      entries.at(-1).narrowGeometry = geometry
      if ((code === 'en' && word === 'go') || (code === 'ja' && word === '来る'))
        await capture(`${code}-narrow`)
      await send('Emulation.clearDeviceMetricsOverride')
      await click('[data-inflection-toggle]')
      check(
        `${code} ${word} toggle closes`,
        await waitFor(
          '!document.querySelector("[data-inflection-panel]")&&document.querySelector("[data-inflection-toggle]").getAttribute("aria-expanded")==="false"'
        )
      )
      // Leave open for the next selection to exercise automatic closing.
      await click('[data-inflection-toggle]')
      check(
        `${code} ${word} reopens`,
        await waitFor('document.querySelector("[data-inflection-panel]")')
      )
      previousId = entry.id
    }
  }
  check('at least one narrow table actually scrolls horizontally', scrollSeen)
  await click('[data-nav=settings]')
  check(
    'locale setting available',
    await waitFor('document.querySelector("[data-setting=locale]")')
  )
  await evaluate(
    `const e=document.querySelector('[data-setting=locale]');e.value='en';e.dispatchEvent(new Event('change',{bubbles:true}))`
  )
  await click('[data-nav=dictionary]')
  check(
    'English dictionary restored',
    await waitFor('document.querySelector("[data-inflection-toggle]")')
  )
  if (!(await evaluate('return !!document.querySelector("[data-inflection-panel]")')))
    await click('[data-inflection-toggle]')
  check(
    'English inflection label',
    await waitFor(
      '/Inflection/i.test(document.querySelector("[data-inflection-panel] h3")?.textContent??"")'
    )
  )
  check(
    'English Japanese noun explanation',
    await evaluate(
      'return document.querySelector("[data-inflection-panel]").innerText.includes("Japanese nouns normally")'
    )
  )
  await capture('english-ja-noun')
  await click('[data-switcher]')
  await click('[data-pack="gd"]')
  await click('[data-nav=dictionary]')
  check(
    'English GD entry restored',
    await waitFor('document.querySelector("[data-inflection-toggle]")')
  )
  if (!(await evaluate('return !!document.querySelector("[data-inflection-panel]")')))
    await click('[data-inflection-toggle]')
  check(
    'English Gaelic conditional label',
    await waitFor(
      'document.querySelector("[data-inflection-panel] h3")?.textContent?.includes("Inflection and forms")'
    )
  )
  check(
    'English Gaelic provenance',
    await evaluate(
      'return /Rule output|Dictionary record/.test(document.querySelector("[data-inflection-panel]").innerText)'
    )
  )
  await capture('english-gd')
  check('no renderer exceptions or console errors', !errors.length, errors.join('\n'))
} catch (error) {
  results.push({ name: 'smoke execution', ok: false, detail: String(error.stack ?? error) })
  console.error(error)
  try {
    await capture?.('failure')
    if (evaluate)
      writeFileSync(
        join(output, 'failure-ui.txt'),
        await evaluate('return document.body.innerText')
      )
  } catch {
    /* preserve original failure */
  }
} finally {
  ws?.close()
  child?.kill()
  writeFileSync(join(output, 'electron.log'), logs.join(''))
  writeFileSync(
    join(output, 'results.json'),
    JSON.stringify(
      { results, errors, entries, userData, exe: process.env.SMOKE_EXE ?? null, port },
      null,
      2
    )
  )
}
console.log(`Artifacts: ${output}; profile: ${userData}`)
process.exitCode = results.some((r) => !r.ok) || errors.length ? 1 : 0
