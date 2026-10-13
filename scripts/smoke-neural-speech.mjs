/** Real packaged neural speech acceptance. Uses only a newly prepared QA runtime and an owned profile. */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(root, 'dist', 'smoke-neural-speech')
mkdirSync(output, { recursive: true })
const candidates = readdirSync(join(root, 'dist'))
  .filter(
    (name) =>
      name.startsWith('packaged-qa-') && existsSync(join(root, 'dist', name, 'manifest.json'))
  )
  .sort(
    (a, b) =>
      statSync(join(root, 'dist', b, 'manifest.json')).mtimeMs -
      statSync(join(root, 'dist', a, 'manifest.json')).mtimeMs
  )
const manifestPath = resolve(
  process.env.SMOKE_MANIFEST || join(root, 'dist', candidates[0] || 'missing', 'manifest.json')
)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const exe = resolve(process.env.SMOKE_EXE || manifest.exe),
  appAsar = join(dirname(exe), 'resources', 'app.asar')
const inside = (parent, path) => {
  const rel = relative(resolve(parent), resolve(path))
  return (
    !!rel &&
    !isAbsolute(rel) &&
    rel !== '..' &&
    !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
  )
}
if (
  resolve(manifest.root) !== root ||
  !inside(join(root, 'dist'), manifestPath) ||
  !inside(dirname(manifestPath), exe) ||
  !existsSync(appAsar)
)
  throw Error('Only this stage’s newly prepared QA executable is allowed')
const asar = createRequire(join(root, 'package.json'))('@electron/asar')
const metadata = JSON.parse(asar.extractFile(appAsar, 'package.json').toString())
const profile = mkdtempSync(join(output, 'profile-'))
const port = Number(process.env.SMOKE_PORT) || 9490
const results = [],
  errors = [],
  evidence = { waves: [], pings: [] },
  logs = []
let child,
  ws,
  evaluate,
  send,
  shot,
  exitCode = null
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(detail)}`)
  if (!ok) throw Error(name)
}
writeFileSync(
  join(profile, 'prefs.json'),
  JSON.stringify({ activePackId: 'en', locale: 'zh', nhkEasy: false, checkUpdates: false })
)
async function start() {
  try {
    await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) })
    throw Error(`CDP ${port} occupied; refusing to connect to another process`)
  } catch (error) {
    if (error.message.includes('occupied')) throw error
  }
  exitCode = null
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  child = spawn(
    exe,
    [
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${port}`,
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows'
    ],
    { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  child.stdout.on('data', (data) => logs.push(String(data)))
  child.stderr.on('data', (data) => logs.push(String(data)))
  child.on('error', (error) => {
    errors.push(String(error))
    exitCode = -1
  })
  child.on('exit', (code) => {
    exitCode = code
  })
  let page
  for (let i = 0; i < 250 && !page; i++) {
    try {
      page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (t) => t.type === 'page' && t.url.includes('app.asar')
      )
    } catch {
      /* Starting. */
    }
    if (exitCode !== null) throw Error(`Owned process exited ${exitCode}`)
    if (!page) await sleep(100)
  }
  check('owned renderer from prepared ASAR', !!page, page?.url)
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((done, fail) => {
    ws.onopen = done
    ws.onerror = fail
  })
  let sequence = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id) {
      pending.get(message.id)?.(message)
      pending.delete(message.id)
    } else if (message.method === 'Runtime.exceptionThrown')
      errors.push(message.params.exceptionDetails)
    else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')
      errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '))
  }
  send = (method, params = {}) =>
    new Promise((done, fail) => {
      const id = ++sequence,
        timer = setTimeout(() => {
          pending.delete(id)
          fail(Error(`CDP timeout ${method}`))
        }, 240000)
      pending.set(id, (message) => {
        clearTimeout(timer)
        message.error ? fail(Error(JSON.stringify(message.error))) : done(message.result)
      })
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  evaluate = async (expression) => {
    const reply = await send('Runtime.evaluate', {
      expression: `(async()=>{${expression}})()`,
      awaitPromise: true,
      returnByValue: true
    })
    if (reply.exceptionDetails) throw Error(JSON.stringify(reply.exceptionDetails))
    return reply.result?.value
  }
  shot = async (name) => {
    const data = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(output, `${name}.png`), Buffer.from(data.data, 'base64'))
  }
  check(
    'bridge ready',
    await wait('window.qstudy?.invoke&&document.querySelector("[data-nav=settings]")')
  )
  const info = await invoke('app:info')
  check(
    'QA version and independent userData',
    info.version === metadata.version && resolve(info.userData) === profile,
    info
  )
  // This command affects only the window belonging to our verified CDP connection.
  try {
    const window = await send('Browser.getWindowForTarget')
    await send('Browser.setWindowBounds', {
      windowId: window.windowId,
      bounds: { windowState: 'minimized' }
    })
  } catch {
    /* Some runtimes omit this domain. */
  }
}
async function close() {
  if (ws?.readyState === WebSocket.OPEN) await send('Page.close').catch(() => {})
  ws?.close()
  for (let i = 0; i < 80 && exitCode === null; i++) await sleep(100)
  if (exitCode === null) {
    child?.kill()
    for (let i = 0; i < 40 && exitCode === null; i++) await sleep(100)
  }
  if (exitCode === null) throw Error('Owned process did not stop; refusing to mutate its profile')
  await sleep(300)
}
const invoke = (channel, ...args) =>
  evaluate(
    `return await window.qstudy.invoke(${[channel, ...args].map((v) => JSON.stringify(v)).join(',')})`
  )
async function wait(expression, timeout = 30000) {
  const end = Date.now() + timeout
  do {
    if (await evaluate(`return !!(${expression})`)) return true
    await sleep(60)
  } while (Date.now() < end)
  return false
}
const click = (selector) =>
  evaluate(
    `const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.click()`
  )
const select = (selector, value) =>
  evaluate(
    `const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing select');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))`
  )
function pcm(buffer) {
  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  )
    throw Error('Not WAV')
  let format, data
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', offset, offset + 4),
      size = buffer.readUInt32LE(offset + 4),
      start = offset + 8
    if (start + size > buffer.length) throw Error('Truncated WAV chunk')
    if (id === 'fmt ')
      format = {
        encoding: buffer.readUInt16LE(start),
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4),
        bits: buffer.readUInt16LE(start + 14)
      }
    if (id === 'data') data = buffer.subarray(start, start + size)
    offset = start + size + (size % 2)
  }
  if (!format || !data || format.encoding !== 1 || format.bits !== 16 || format.channels < 1)
    throw Error('Expected PCM16 WAV')
  let peak = 0,
    sum = 0
  for (let i = 0; i + 2 <= data.length; i += 2) {
    const value = data.readInt16LE(i) / 32768
    peak = Math.max(peak, Math.abs(value))
    sum += value * value
  }
  return {
    ...format,
    seconds: data.length / (format.sampleRate * format.channels * 2),
    peak,
    rms: Math.sqrt(sum / (data.length / 2)),
    bytes: buffer.length,
    hash: createHash('sha256').update(buffer).digest('hex')
  }
}
async function wave(name, request) {
  const began = performance.now()
  const result = await evaluate(
    `const r=await window.qstudy.invoke('speech:speak',${JSON.stringify(request)});return {wav:r.wav?Array.from(r.wav):null,error:r.error,dropped:r.dropped}`
  )
  check(
    `${name} actual model returned audio`,
    !!result.wav && !result.error && result.dropped?.length === 0,
    { error: result.error, dropped: result.dropped }
  )
  const buffer = Buffer.from(result.wav),
    details = pcm(buffer)
  details.milliseconds = Math.round(performance.now() - began)
  check(
    `${name} nonzero complete PCM`,
    details.seconds > 0.15 && details.seconds < 180 && details.peak > 0.001 && details.rms > 0.0001,
    details
  )
  writeFileSync(join(output, `${name}.wav`), buffer)
  evidence.waves.push({ name, request, ...details })
  return details
}
try {
  check(
    'new QA ASAR version',
    metadata.version === '0.3.0' && manifest.version === metadata.version,
    { manifest: manifest.version, asar: metadata.version }
  )
  await start()
  let status = await invoke('neural:status')
  check(
    'supported but empty model profile',
    status.supported && !status.installed && !status.downloading,
    status
  )
  check(
    'no neural voices before installation',
    (await invoke('speech:voices')).filter((v) => v.engine === 'neural').length === 0
  )
  await click('[data-nav=settings]')
  check(
    'download UI and neural default',
    await wait(
      'document.querySelector("[data-neural-install]")&&document.querySelector("[data-setting=textVoiceMode]")?.value==="neural"'
    )
  )
  const automaticOptions = await evaluate(
    'return [...document.querySelector("[data-setting=textVoice]").options].map(o=>o.value)'
  )
  check(
    'uninstalled automatic selection never exposes eSpeak fallback',
    automaticOptions.every((v) => !v.startsWith('espeak:')),
    automaticOptions
  )
  check(
    'unsupported languages explicitly documented',
    await evaluate(
      'const s=document.querySelector("[data-neural-status]").innerText;return s.includes("盖尔语")&&s.includes("昆雅语")&&s.includes("辛达林语")'
    )
  )
  check(
    'model source license and synthesized-speech disclosure shown',
    await evaluate(
      'const e=document.querySelector("[data-neural-license]");return e.innerText.includes("人工合成")&&e.innerText.includes("OpenRAIL-M")&&e.querySelectorAll("a").length===2'
    )
  )
  await shot('before-install')
  await click('[data-neural-install]')
  check(
    'real downloader reaches progress and cancellation UI',
    await wait(
      'document.querySelector("[data-neural-cancel]")&&document.querySelector("[data-neural-status] progress")',
      10000
    )
  )
  evidence.cancelBefore = await invoke('neural:status')
  check('real download marked active', evidence.cancelBefore.downloading, evidence.cancelBefore)
  await click('[data-neural-cancel]')
  check(
    'cancel completes without installing',
    await wait(
      'document.querySelector("[data-neural-install]")&&!document.querySelector("[data-neural-cancel]")',
      30000
    )
  )
  status = await invoke('neural:status')
  check(
    'cancel leaves no installed or active model',
    !status.installed && !status.downloading,
    status
  )
  check(
    'cancel removes temporary download',
    !existsSync(join(profile, 'speech-models', 'supertonic3-download'))
  )
  await select('[data-setting=textVoiceMode]', 'offline')
  check('explicit mechanical mode saved', (await invoke('prefs:get')).textVoiceMode === 'offline')
  await close()

  const fixture = process.env.SMOKE_MODEL_DIR && resolve(process.env.SMOKE_MODEL_DIR)
  check('verified model fixture explicitly supplied', !!fixture && inside(root, fixture), fixture)
  const { NEURAL_MODEL } = await import(
    pathToFileURL(join(root, 'src/shared/neural-model.ts')).href
  )
  const marker = JSON.parse(readFileSync(join(fixture, 'installed.json'), 'utf8'))
  check(
    'fixture revision matches pinned production catalog',
    marker.revision === NEURAL_MODEL.revision,
    { fixture: marker.revision, catalog: NEURAL_MODEL.revision }
  )
  for (const file of NEURAL_MODEL.files) {
    const path = join(fixture, file.path),
      info = lstatSync(path)
    check(
      `fixture ${file.path} verified`,
      info.isFile() &&
        !info.isSymbolicLink() &&
        info.size === file.bytes &&
        createHash('sha256').update(readFileSync(path)).digest('hex') === file.sha256,
      { bytes: info.size, expected: file.bytes }
    )
  }
  mkdirSync(join(profile, 'speech-models'), { recursive: true })
  cpSync(fixture, join(profile, 'speech-models', 'supertonic3'), { recursive: true })
  evidence.installation = {
    method: 'verified fixture copy, NOT a completed download claim',
    source: fixture,
    revision: NEURAL_MODEL.revision,
    files: NEURAL_MODEL.files.length
  }
  await start()
  check(
    'saved mode survives actual restart',
    (await invoke('prefs:get')).textVoiceMode === 'offline'
  )
  check('production validates copied model as installed', (await invoke('neural:status')).installed)
  const voices = (await invoke('speech:voices')).filter((v) => v.engine === 'neural')
  const { NEURAL_LANGUAGES, NEURAL_STYLES } = await import(
    pathToFileURL(join(root, 'src/shared/neural-speech.ts')).href
  )
  const expectedVoices = NEURAL_LANGUAGES.flatMap((lang) =>
    NEURAL_STYLES.map((style) => `neural:supertonic3:${lang}:${style}`)
  )
  check(
    'voice names languages and genders match pinned catalog',
    expectedVoices.every((name) => {
      const voice = voices.find((v) => v.name === name),
        parts = name.split(':')
      return (
        voice?.culture === parts[2] &&
        voice.gender === (parts[3].startsWith('F') ? 'Female' : 'Male')
      )
    })
  )
  check(
    'exact 31 × 4 installed neural voices',
    voices.length === 124 && new Set(voices.map((v) => v.name)).size === 124,
    { count: voices.length, languages: new Set(voices.map((v) => v.culture)).size }
  )
  check(
    'no fake gd qya sjn neural voice',
    !voices.some((v) => ['gd', 'qya', 'sjn'].includes(v.culture))
  )
  check('installed install call is idempotent', (await invoke('neural:install')).installed)
  await click('[data-nav=settings]')
  await select('[data-setting=textVoiceMode]', 'neural')
  await select('[data-setting=voiceLanguage]', 'en')
  check(
    'four actual styles shown',
    await wait('document.querySelector("[data-setting=textVoice]")?.options.length===5')
  )
  await select('[data-setting=textVoice]', 'neural:supertonic3:en:M2')
  check(
    'selected male speaker persisted',
    await wait(
      '(await window.qstudy.invoke("prefs:get")).textVoices?.en === "neural:supertonic3:en:M2"'
    )
  )
  await select('[data-setting=textVoice]', 'neural:supertonic3:en:F2')
  check(
    'selected female speaker persisted',
    await wait(
      '(await window.qstudy.invoke("prefs:get")).textVoices?.en === "neural:supertonic3:en:F2"'
    )
  )
  await select('[data-setting=voiceLanguage]', 'sjn')
  check(
    'no unsupported-language neural preview',
    await evaluate('return document.querySelector("[data-test-text-voice]").disabled')
  )
  await select('[data-setting=voiceLanguage]', 'en')
  await shot('installed-settings')
  await click('[data-nav=dictionary]')
  check('real dictionary available', await wait('document.querySelector("[data-dict-input]")'))
  const hits = await invoke('lang:search', 'en', 'hello')
  const hit = (hits.items ?? hits.hits ?? hits).find(
    (h) => String(h.w ?? h.word).toLowerCase() === 'hello'
  )
  check('real hello entry for pronunciation', !!hit, hit)
  await evaluate(
    'const e=document.querySelector("[data-dict-input]");e.value="hello";e.dispatchEvent(new Event("input",{bubbles:true}))'
  )
  check('real dictionary hit shown', await wait(`document.querySelector('[data-hit="${hit.id}"]')`))
  await click(`[data-hit="${hit.id}"]`)
  const pronounce = `[data-entry="${hit.id}"] [data-pronounce]`
  check(
    'word can use installed text voice',
    await wait(
      `document.querySelector('${pronounce}')&&!document.querySelector('${pronounce}').disabled`
    )
  )
  await click(pronounce)
  check(
    'actual UI pending synthesis can be cancelled',
    await wait(`document.querySelector('${pronounce}').hasAttribute('data-pending')`, 3000)
  )
  await click(pronounce)
  check(
    'UI pending cancelled',
    await wait(
      `!document.querySelector('${pronounce}').hasAttribute('data-pending')&&!document.querySelector('${pronounce}').hasAttribute('data-playing')`
    )
  )
  await sleep(1000)
  check(
    'no late UI playback after cancel',
    await evaluate(`return !document.querySelector('${pronounce}').hasAttribute('data-playing')`)
  )

  const sentences = {
    en: 'The sun is shining today.',
    fr: 'Bonjour, comment allez-vous ?',
    es: 'Buenos días, ¿cómo estás?',
    ja: 'こんにちは。今日はいい天気ですね。',
    ar: 'مَرْحَبًا. كَيْفَ حَالُكَ؟',
    ko: '안녕하세요. 오늘 날씨가 좋아요.',
    ru: 'Здравствуйте. Сегодня хорошая погода.'
  }
  for (const [lang, content] of Object.entries(sentences)) {
    const voice = `neural:supertonic3:${lang}:F1`
    check(
      `${lang} all four correct language voices`,
      voices.filter((v) => v.culture === lang).length === 4
    )
    const first = await wave(lang, { content, voice, ipa: false, rate: 0 })
    const key = createHash('sha256')
        .update(JSON.stringify([NEURAL_MODEL.revision, content, voice, 0]))
        .digest('hex'),
      cache = join(profile, 'speech-models', 'audio-cache', `${key}.wav`)
    check(`${lang} real cache file`, existsSync(cache))
    const before = statSync(cache).mtimeMs,
      second = await wave(`${lang}-cached`, { content, voice, ipa: false, rate: 0 })
    check(
      `${lang} cache reuses exact WAV without rewrite`,
      first.hash === second.hash && statSync(cache).mtimeMs === before,
      { first: first.hash, second: second.hash }
    )
  }
  const slow = await wave('en-slow', {
      content: sentences.en,
      voice: 'neural:supertonic3:en:F1',
      ipa: false,
      rate: -3
    }),
    fast = await wave('en-fast', {
      content: sentences.en,
      voice: 'neural:supertonic3:en:F1',
      ipa: false,
      rate: 3
    })
  check('rate changes real duration', slow.seconds > fast.seconds * 1.05, {
    slow: slow.seconds,
    fast: fast.seconds
  })
  const rejected = await invoke('speech:speak', {
    content: 'ra',
    voice: 'neural:supertonic3:en:F1',
    ipa: true,
    rate: 0
  })
  check(
    'text neural voice rejects IPA rather than pretending universal support',
    !rejected.wav && !!rejected.error,
    rejected.error
  )
  const long = `${sentences.en} `.repeat(100)
  let inferenceSettled = false
  const work = invoke('speech:speak', {
    content: long,
    voice: 'neural:supertonic3:en:M1',
    ipa: false,
    rate: 0
  }).finally(() => {
    inferenceSettled = true
  })
  await sleep(100)
  check('long inference still active before responsiveness samples', !inferenceSettled)
  for (let i = 0; i < 8; i++) {
    const latency = await evaluate(
      'const start=performance.now();await window.qstudy.invoke("app:info");return performance.now()-start'
    )
    evidence.pings.push(latency)
    check(`main responsive during inference ${i + 1}`, !inferenceSettled && latency < 200, {
      milliseconds: latency
    })
    await sleep(40)
  }
  await invoke('speech:stop')
  const cancelled = await work
  check(
    'stop resolves active inference without late WAV',
    !cancelled.wav && !!cancelled.error,
    cancelled.error
  )
  const prefs = await invoke('prefs:get')
  await close()
  const stored = JSON.parse(readFileSync(join(profile, 'prefs.json'), 'utf8'))
  check(
    'selected neural mode and speaker actually written to isolated disk',
    stored.textVoiceMode === 'neural' && stored.textVoices?.en === 'neural:supertonic3:en:F2',
    stored
  )
  await start()
  const reloaded = await invoke('prefs:get')
  check(
    'speaker and mode survive second actual restart',
    reloaded.textVoiceMode === prefs.textVoiceMode &&
      reloaded.textVoices?.en === prefs.textVoices.en,
    reloaded
  )
  await click('[data-nav=settings]')
  check('remove UI exists', await wait('document.querySelector("[data-neural-remove]")'))
  await click('[data-neural-remove]')
  check(
    'remove completes and UI offers install',
    await wait('document.querySelector("[data-neural-install]")', 30000)
  )
  check(
    'removed model has no advertised neural voices',
    !(await invoke('neural:status')).installed &&
      (await invoke('speech:voices')).filter((v) => v.engine === 'neural').length === 0
  )
  await shot('after-remove')
  check('no renderer runtime errors', errors.length === 0, errors)
} catch (error) {
  results.push({ name: 'neural smoke execution', ok: false, detail: String(error.stack ?? error) })
  console.error(error)
  try {
    if (evaluate)
      writeFileSync(
        join(output, 'failure-ui.txt'),
        await evaluate('return document.body.innerText')
      )
    await shot?.('failure')
  } catch {
    /* Preserve original failure. */
  }
} finally {
  try {
    await close()
  } catch (error) {
    errors.push(String(error))
  }
  writeFileSync(join(output, 'electron.log'), logs.join(''))
  // Delete only this mkdtemp-owned profile after its process is fully stopped.
  let removedProfile = false
  if (exitCode !== null && inside(output, profile) && basenameSafe(profile)) {
    rmSync(profile, { recursive: true, force: true })
    removedProfile = true
  }
  writeFileSync(
    join(output, 'results.json'),
    JSON.stringify(
      { manifestPath, exe, appAsar, profile, removedProfile, port, results, errors, evidence },
      null,
      2
    )
  )
}
function basenameSafe(path) {
  return relative(output, path).startsWith('profile-') && !isAbsolute(relative(output, path))
}
console.log(`Neural QA artifacts: ${output}`)
process.exitCode = results.some((r) => !r.ok) || errors.length ? 1 : 0
