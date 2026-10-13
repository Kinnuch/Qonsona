/** Feedback acceptance against a newly prepared QA ASAR, never an installed/user instance. */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
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
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist'),
  output = join(dist, 'smoke-feedback13')
mkdirSync(output, { recursive: true })
const candidates = readdirSync(dist)
  .filter(
    (name) => name.startsWith('packaged-qa-') && existsSync(join(dist, name, 'manifest.json'))
  )
  .sort(
    (a, b) =>
      statSync(join(dist, b, 'manifest.json')).mtimeMs -
      statSync(join(dist, a, 'manifest.json')).mtimeMs
  )
const manifestPath = candidates[0] && join(dist, candidates[0], 'manifest.json')
if (!manifestPath) throw Error('Prepare a fresh QA package with prepare-packaged-qa.mjs first')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const exe = resolve(manifest.exe),
  ownerRoot = dirname(manifestPath),
  rel = relative(ownerRoot, exe)
if (isAbsolute(rel) || rel.startsWith('..') || !existsSync(exe) || resolve(manifest.root) !== root)
  throw Error('QA executable must belong to this stage’s prepared manifest')
const appAsar = join(dirname(exe), 'resources', 'app.asar')
if (!existsSync(appAsar)) throw Error('Prepared QA runtime lacks app.asar')
const asar = createRequire(join(root, 'package.json'))('@electron/asar')
const metadata = JSON.parse(asar.extractFile(appAsar, 'package.json').toString())
const profile = mkdtempSync(join(output, 'profile-'))
writeFileSync(
  join(profile, 'prefs.json'),
  JSON.stringify({ activePackId: 'en', locale: 'zh', nhkEasy: false, checkUpdates: false })
)
const port = Number(process.env.PROBE_PORT || process.env.SMOKE_PORT) || 9489
try {
  await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) })
  throw Error(`CDP ${port} is already occupied; refusing to connect`)
} catch (error) {
  if (error.message.includes('already occupied')) throw error
}
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(
  exe,
  [
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows'
  ],
  { env, stdio: ['ignore', 'pipe', 'pipe'] }
)
const results = [],
  errors = [],
  evidence = {},
  logs = []
let ws,
  evaluate,
  shot,
  exitCode = null
child.stdout.on('data', (data) => logs.push(String(data)))
child.stderr.on('data', (data) => logs.push(String(data)))
child.on('error', (error) => {
  errors.push(String(error))
  exitCode = -1
})
child.on('exit', (code) => {
  exitCode = code
})
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(detail)}`)
  if (!ok) throw Error(name)
}
try {
  check('new QA ASAR manifest version', metadata.version === manifest.version, {
    asar: metadata.version,
    manifest: manifest.version
  })
  check(
    'packaged analysis worker exists',
    asar.statFile(appAsar, join('out', 'main', 'analysis-worker.js')).size > 0
  )
  let page
  for (let i = 0; i < 200 && !page; i++) {
    try {
      page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (t) => t.type === 'page' && t.url.includes('app.asar')
      )
    } catch {
      /* starting */
    }
    if (exitCode !== null) throw Error(`Owned QA exited ${exitCode}`)
    if (!page) await sleep(100)
  }
  check('owned renderer loaded from QA ASAR', !!page, page?.url)
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((done, fail) => {
    ws.onopen = done
    ws.onerror = fail
  })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id) {
      pending.get(message.id)?.(message)
      pending.delete(message.id)
    } else if (message.method === 'Runtime.exceptionThrown')
      errors.push(message.params.exceptionDetails)
    else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')
      errors.push(message.params.args.map((a) => a.value ?? a.description).join(' '))
  }
  const send = (method, params = {}) =>
    new Promise((done, fail) => {
      const id = ++seq,
        timer = setTimeout(() => {
          pending.delete(id)
          fail(Error(`CDP timeout ${method}`))
        }, 45000)
      pending.set(id, (message) => {
        clearTimeout(timer)
        message.error ? fail(Error(JSON.stringify(message.error))) : done(message.result)
      })
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', {
      expression: `(async()=>{${expression}})()`,
      awaitPromise: true,
      returnByValue: true
    })
    if (response.exceptionDetails) throw Error(JSON.stringify(response.exceptionDetails))
    return response.result?.value
  }
  const wait = async (expression, timeout = 30000) => {
    const end = Date.now() + timeout
    do {
      if (await evaluate(`return !!(${expression})`)) return true
      await sleep(100)
    } while (Date.now() < end)
    return false
  }
  const click = (selector) =>
    evaluate(
      `const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.click()`
    )
  const invoke = (channel, ...args) =>
    evaluate(
      `return await Promise.race([window.qstudy.invoke(${[channel, ...args].map((a) => JSON.stringify(a)).join(',')}),new Promise((_,reject)=>setTimeout(()=>reject(Error('IPC timeout')),30000))])`
    )
  shot = async (name) => {
    const result = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(output, `${name}.png`), Buffer.from(result.data, 'base64'))
  }
  check(
    'bridge ready',
    await wait('window.qstudy?.invoke&&document.querySelector("[data-switcher]")')
  )
  const info = await invoke('app:info')
  check('runtime version matches manifest', info.version === manifest.version, info.version)

  const article = await invoke('langArticles:save', 'ar', {
    title: 'تعزيز التواصل في المدرسة',
    body: 'في تعزيز التواصل. الكتاب على الطاولة.'
  })
  check('independent-profile Arabic feed fixture saved by real API', !!article?.id, article?.id)
  await click('[data-switcher]')
  await click('[data-pack="ar"]')
  await click('[data-nav=home]')
  check(
    'Arabic home fixture visible',
    await wait(`document.querySelector('[data-news-item="${article.id}"] .title')`)
  )
  const index = await evaluate(
    `return [...document.querySelectorAll('[data-news-item]')].findIndex(e=>e.dataset.newsItem===${JSON.stringify(article.id)})`
  )
  await click(`[data-rail="${index}"]`)
  check(
    'Arabic fixture active',
    await wait(
      `document.querySelector('[data-news-item="${article.id}"]').classList.contains('on')`
    )
  )
  const geometry = await evaluate(
    `const e=document.querySelector('[data-news-item="${article.id}"] .title'),s=e.closest('.story'),r=e.getBoundingClientRect(),b=s.getBoundingClientRect(),c=getComputedStyle(e);return {text:e.innerText,lang:e.lang,dir:e.dir,direction:c.direction,align:c.textAlign,self:c.alignSelf,right:r.right,storyRight:b.right,width:r.width,padding:Number.parseFloat(getComputedStyle(s).paddingRight)||0}`
  )
  check(
    'Arabic title has RTL, right alignment and right edge',
    geometry.lang.split('-')[0] === 'ar' &&
      geometry.dir === 'rtl' &&
      geometry.direction === 'rtl' &&
      geometry.align === 'right' &&
      Math.abs(geometry.right - (geometry.storyRight - geometry.padding)) < 3,
    geometry
  )
  evidence.arHome = geometry
  await shot('ar-home-rtl')
  const analyzed = await invoke('lang:analyze', 'ar', 'في تعزيز التواصل')
  const words = analyzed.sentences.flatMap((s) => s.tokens).filter((t) => t.kind === 'word')
  check(
    'Arabic dictionary-inferred phrase readings exact',
    JSON.stringify(words.map((w) => w.ruby)) === JSON.stringify(['fī', 'taʿzīz', 'at-tawāṣul']),
    words
  )
  evidence.arAnalysis = analyzed
  const active = await invoke('lang:analyze', 'ar', 'كَتَبَ'),
    passive = await invoke('lang:analyze', 'ar', 'كُتِبَ'),
    activeAgain = await invoke('lang:analyze', 'ar', 'كَتَبَ')
  const readings = (a) =>
    a.sentences
      .flatMap((s) => s.tokens)
      .filter((t) => t.kind === 'word')
      .map((t) => t.ruby)
  check(
    'explicit Arabic vowels use separate worker cache entries',
    JSON.stringify(readings(active)) === JSON.stringify(['kataba']) &&
      JSON.stringify(readings(passive)) === JSON.stringify(['kutiba']) &&
      JSON.stringify(activeAgain) === JSON.stringify(active),
    { active: readings(active), passive: readings(passive) }
  )
  const unknown = await invoke('lang:analyze', 'ar', 'زظفغكلمتن')
  const unknownWords = unknown.sentences.flatMap((s) => s.tokens).filter((t) => t.kind === 'word')
  check(
    'unknown unvocalized Arabic has no invented reading',
    unknownWords.length > 0 && unknownWords.every((w) => !w.entry && !w.ruby),
    unknownWords
  )

  for (const [code, base, neo, text] of [
    ['qya', 'elen', 'accamatië', 'I elen síla. I alda ná alta.'],
    ['sjn', 'adan', 'abor', 'I adan tôl. In edain.']
  ]) {
    const [status] = await invoke('lang:status', [code])
    check(`${code} real packaged dictionary`, status?.available && status.entries > 1000, status)
    const daily = await invoke('dictionary:daily', code, '2026-10-13')
    check(
      `${code} real daily data`,
      daily?.packId === code &&
        daily.words.length > 0 &&
        daily.sentences.length > 0 &&
        daily.grammar.length > 0,
      {
        words: daily.words.length,
        sentences: daily.sentences.length,
        grammar: daily.grammar.length
      }
    )
    const analysis = await invoke('lang:analyze', code, text)
    check(
      `${code} packaged worker with real word recognition`,
      analysis?.text === text && analysis.sentences.some((s) => s.tokens.some((t) => t.entry)),
      analysis
    )
    const coreCases =
      code === 'qya'
        ? [
            ['i', 'det', /\bthe\b/i, /\bwho\b|\bthat one\b/i],
            ['ná', 'verb', /\b(?:be|is)\b/i, /\byes\b|it is so|it is a fact/i],
            ['alta', 'adj', /large|great in size/i, /radiance/i]
          ]
        : [
            ['i', 'det', /\bthe\b/i, /\bwho\b|\bthat one\b/i],
            ['tôl', 'verb', /\bcome\b|\bcoming\b/i, /mantle/i]
          ]
    const coreEvidence = []
    for (const [surface, pos, required, forbidden] of coreCases) {
      const matches = analysis.sentences
        .flatMap((s) => s.tokens)
        .filter((t) => t.text.normalize('NFC').toLowerCase() === surface)
      check(
        `${code} ${surface} contextual core POS and English meaning`,
        matches.length > 0 &&
          matches.every(
            (t) =>
              t.entry && t.pos === pos && required.test(t.en ?? '') && !forbidden.test(t.en ?? '')
          ),
        matches
      )
      for (const token of matches) {
        const selected = await invoke('lang:entry', code, token.entry)
        const glosses = selected.senses.flatMap((s) => s.en).join('; ')
        check(
          `${code} ${surface} selected real source entry agrees`,
          selected.p.includes(pos) && required.test(glosses) && !forbidden.test(glosses),
          {
            id: selected.id,
            head: selected.w,
            pos: selected.p,
            meaning: glosses,
            source: selected.x.eldamo
          }
        )
        coreEvidence.push({ token, selected })
      }
    }
    evidence[`${code}-core`] = coreEvidence
    const again = await invoke('lang:analyze', code, text)
    check(`${code} worker cache deterministic`, JSON.stringify(analysis) === JSON.stringify(again))
    await click('[data-switcher]')
    await click(`[data-pack="${code}"]`)
    await click('[data-nav=dictionary]')
    check(
      `${code} GUI dictionary daily`,
      await wait(`document.querySelector('[data-dictionary-daily="${code}"] [data-daily-word]')`)
    )
    for (const [word, period] of [
      [base, 'late'],
      [neo, 'neo']
    ]) {
      const search = await invoke('lang:search', code, word)
      let entry
      for (const hit of search?.hits ?? []) {
        const candidate = await invoke('lang:entry', code, hit.id)
        // Dictionary keys are case-insensitive; provenance retains the source spelling (Adan).
        // Do not strip length marks or accept an unrelated loose/inflected/gloss match.
        if (
          hit.match === 'exact' &&
          candidate?.w.normalize('NFC').toLowerCase() === word.normalize('NFC').toLowerCase() &&
          candidate.x?.eldamo?.period === period
        ) {
          entry = candidate
          break
        }
      }
      check(`${code} ${word} source entry and period`, !!entry, {
        id: entry?.id,
        period: entry?.x?.eldamo?.period
      })
      await evaluate(
        `const e=document.querySelector('[data-dict-input]');e.value=${JSON.stringify(word)};e.dispatchEvent(new Event('input',{bubbles:true}))`
      )
      check(
        `${code} ${word} source search hit`,
        await wait(`document.querySelector('[data-hit="${entry.id}"]')`)
      )
      await click(`[data-hit="${entry.id}"]`)
      check(
        `${code} ${word} human provenance rendered`,
        await wait(
          `document.querySelector('[data-eldamo-source="${entry.id}"] [data-eldamo-period]')`
        )
      )
      const view = await evaluate(
        `const p=document.querySelector('[data-eldamo-source="${entry.id}"]');return {text:p.innerText,period:p.querySelector('[data-eldamo-period]').innerText,eldamo:p.querySelector('[data-eldamo-link]')?.href,elfdict:p.querySelector('[data-elfdict-link]')?.href,entryText:p.closest('[data-entry]').innerText}`
      )
      check(
        `${code} ${word} readable period / Neo disclosure`,
        period === 'neo'
          ? /Neo/.test(view.period) && /Neo|新造词/.test(view.text)
          : /晚期|Late/.test(view.period),
        view.period
      )
      check(
        `${code} ${word} exact Eldamo / Elfdict links`,
        view.eldamo === entry.x.eldamo.url &&
          view.elfdict === `https://www.elfdict.com/w/${encodeURIComponent(entry.w)}`,
        { eldamo: view.eldamo, elfdict: view.elfdict }
      )
      check(
        `${code} ${word} no raw provenance JSON`,
        !/[{]\s*"|"(?:period|references|eldamo|creator)"\s*:|\[object Object\]/.test(view.entryText)
      )
      evidence[`${code}-${period}`] = { entry, view }
      await shot(`${code}-${period}-provenance`)
    }
  }
  await click('[data-nav=settings]')
  check('locale selector', await wait('document.querySelector("[data-setting=locale]")'))
  await evaluate(
    `const e=document.querySelector('[data-setting=locale]');e.value='en';e.dispatchEvent(new Event('change',{bubbles:true}))`
  )
  await click('[data-nav=dictionary]')
  check(
    'English provenance and Neo period',
    await wait(
      'document.querySelector("[data-eldamo-source]")?.innerText.includes("Entry provenance and period")&&document.querySelector("[data-eldamo-period]")?.innerText.includes("Post-Tolkien Neo material")'
    )
  )
  await shot('sjn-english-provenance')

  const voices = await invoke('speech:voices')
  check(
    'packaged native IPA engine voice',
    voices.some((v) => v.engine === 'ipa' && v.name === 'espeak:ipa'),
    voices.filter((v) => v.engine === 'ipa')
  )
  async function wave(name, request) {
    const data = await evaluate(
      `const r=await window.qstudy.invoke('speech:speak',${JSON.stringify(request)});return {bytes:Array.from(r.wav??[]),error:r.error,dropped:r.dropped}`
    )
    const buffer = Buffer.from(data.bytes)
    check(
      `${name} actual PCM WAV`,
      !data.error &&
        buffer.length > 44 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WAVE' &&
        buffer.toString('ascii', 36, 40) === 'data' &&
        buffer.readUInt32LE(40) === buffer.length - 44,
      { bytes: buffer.length, error: data.error, dropped: data.dropped }
    )
    writeFileSync(join(output, `${name}.wav`), buffer)
    return createHash('sha256').update(buffer.subarray(44)).digest('hex')
  }
  const hashes = []
  for (const [name, content] of [
    ['trill', 'ra'],
    ['approximant', 'ɹa'],
    ['tap', 'ɾa']
  ])
    hashes.push(await wave(`ipa-${name}`, { content, ipa: true, voice: 'espeak:ipa', rate: 0 }))
  check('IPA trill / approximant / tap PCM are distinct', new Set(hashes).size === 3, hashes)
  evidence.ipaHashes = hashes
  for (const [code, content] of [
    ['ar', 'في تعزيز التواصل'],
    ['qya', 'I elen síla.'],
    ['sjn', 'I adan tôl.']
  ]) {
    const voice = voices.find(
      (v) => v.engine === 'offline' && v.culture.toLowerCase().split('-')[0] === code
    )
    check(
      `${code} exact offline language voice`,
      !!voice && voice.name.startsWith('espeak:') && voice.name.split('/').at(-1) === code,
      voice
    )
    evidence[`${code}-voice`] = {
      voice,
      pcmHash: await wave(`offline-${code}`, { content, ipa: false, voice: voice.name, rate: 0 })
    }
  }
  check('no renderer runtime errors', errors.length === 0, errors)
} catch (error) {
  results.push({
    name: 'feedback smoke execution',
    ok: false,
    detail: String(error.stack ?? error)
  })
  console.error(error)
  try {
    if (evaluate)
      writeFileSync(
        join(output, 'failure-ui.txt'),
        await evaluate('return document.body.innerText')
      )
    await shot?.('failure')
  } catch {
    /* original failure */
  }
} finally {
  ws?.close()
  if (exitCode === null) child.kill()
  writeFileSync(join(output, 'electron.log'), logs.join(''))
  writeFileSync(
    join(output, 'results.json'),
    JSON.stringify(
      { manifestPath, exe, appAsar, profile, port, results, errors, evidence },
      null,
      2
    )
  )
}
console.log(`Feedback QA artifacts: ${output}`)
process.exitCode = results.some((r) => !r.ok) || errors.length ? 1 : 0
