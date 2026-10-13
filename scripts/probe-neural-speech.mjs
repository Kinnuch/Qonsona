/** CLI-only isolated probe: Electron RUN_AS_NODE, local model, no window or network. */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createInterface } from 'node:readline'
import assert from 'node:assert/strict'

const root = resolve('.')
const require = createRequire(join(root, 'package.json'))
const executable = process.argv.includes('--node') ? process.execPath : require('electron')
const modelDir = resolve(process.env.NEURAL_MODEL_DIR ?? '.cache/neural-probe/supertonic')
const output = resolve(process.env.NEURAL_PROBE_DIR ?? '.cache/neural-probe/results')
await mkdir(output, { recursive: true })
const child = spawn(
  executable,
  [join(root, 'resources/speech/neural-runner.mjs'), modelDir, root],
  {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  }
)
const pending = new Map()
let id = 0
let diagnostics = ''
child.stderr.on('data', (chunk) => {
  diagnostics += chunk
  process.stderr.write(chunk)
})
const reader = createInterface({ input: child.stdout })
reader.on('line', (line) => {
  try {
    const response = JSON.parse(line)
    const call = pending.get(response.id)
    if (call) {
      clearTimeout(call.timer)
      pending.delete(response.id)
      call.resolve(response)
    }
  } catch {
    process.stderr.write(`Unexpected stdout: ${line}\n`)
  }
})
child.on('exit', (code, signal) => {
  for (const call of pending.values()) {
    clearTimeout(call.timer)
    call.reject(Error(`Runner exited ${code}/${signal}: ${diagnostics}`))
  }
  pending.clear()
})
function request(data) {
  return new Promise((resolve, reject) => {
    const key = ++id
    const timer = setTimeout(() => {
      pending.delete(key)
      reject(Error(`Neural request ${key} timed out`))
      child.kill()
    }, 120000)
    pending.set(key, { resolve, reject, timer })
    child.stdin.write(JSON.stringify({ ...data, id: key }) + '\n')
  })
}
const samples = [
  ['en', 'Hello. This speech is synthesized locally on your computer.', 'F1'],
  ['ar', 'مَرْحَبًا. أَنَا أَتَعَلَّمُ اللُّغَةَ الْعَرَبِيَّةَ.', 'F2'],
  ['ko', '안녕하세요. 저는 한국어를 공부하고 있습니다.', 'M1'],
  ['ru', 'Здравствуйте. Я изучаю русский язык.', 'M2'],
  ['fr', 'Bonjour. Cette voix est créée directement sur votre ordinateur.', 'F1'],
  ['es', 'Hola. Esta voz se genera en tu ordenador sin conexión.', 'M1'],
  ['ja', 'こんにちは。私は日本語を勉強しています。', 'F2']
]
const results = []
try {
  for (const [lang, content, voice] of samples) {
    const started = performance.now()
    const result = await request({ op: 'speak', content, lang, voice, rate: 0 })
    assert.equal(result.ok, true, result.error ?? 'Unexpected neural response')
    const wav = Buffer.from(result.wav, 'base64')
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF')
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE')
    assert.equal(wav.readUInt32LE(24), 44100)
    assert.equal(wav.readUInt32LE(40), wav.length - 44)
    let sum = 0,
      peak = 0
    for (let i = 44; i < wav.length; i += 2) {
      const v = wav.readInt16LE(i) / 32768
      sum += v * v
      peak = Math.max(peak, Math.abs(v))
    }
    const rms = Math.sqrt(sum / ((wav.length - 44) / 2))
    assert(rms > 0.001, `${lang}: silent synthesis`)
    assert((wav.length - 44) / 88200 > 0.2, `${lang}: implausibly short synthesis`)
    const file = join(output, `${lang}-${voice}.wav`)
    await writeFile(file, wav)
    const metrics = {
      lang,
      voice,
      wallMs: performance.now() - started,
      inferenceMs: result.elapsedMs,
      duration: result.duration,
      bytes: wav.length,
      rms,
      peak,
      file
    }
    results.push(metrics)
    console.log(JSON.stringify(metrics))
  }
  for (const invalid of [
    { lang: 'gd', content: 'Halò.' },
    { lang: 'en', content: 'Rocket 🚀' },
    { lang: 'en', content: 'a'.repeat(5001) },
    { lang: 'en', content: 'Hello.', rate: null }
  ]) {
    const result = await request({ op: 'speak', voice: 'F1', rate: 0, ...invalid })
    assert.equal(result.ok, false, result.error ?? 'Unexpected neural response')
    assert(result.error)
    results.push({ negative: true, lang: invalid.lang, error: result.error })
  }
  const rateDurations = []
  for (const rate of [-5, 5]) {
    const result = await request({
      op: 'speak',
      content: 'This sentence lets us check whether the reading speed changes.',
      lang: 'en',
      voice: 'F1',
      rate
    })
    assert.equal(result.ok, true, result.error)
    const file = join(output, `en-rate-${rate}.wav`)
    await writeFile(file, Buffer.from(result.wav, 'base64'))
    rateDurations.push(result.duration)
    results.push({ rate, duration: result.duration, inferenceMs: result.elapsedMs, file })
  }
  assert(
    rateDurations[0] > rateDurations[1] * 1.5,
    'UI rate must make negative slower and positive faster'
  )
  const longResult = await request({
    op: 'speak',
    content: 'This is a longer speech passage without sentence punctuation '.repeat(8),
    lang: 'en',
    voice: 'F1',
    rate: 0
  })
  assert.equal(longResult.ok, true, longResult.error)
  assert(longResult.duration > 10, 'Long input must span complete bounded chunks')
  results.push({
    longInput: true,
    duration: longResult.duration,
    inferenceMs: longResult.elapsedMs
  })
  const recovery = await request({
    op: 'speak',
    lang: 'en',
    voice: 'F1',
    rate: 0,
    content: 'The voice still works after an invalid request.'
  })
  assert.equal(recovery.ok, true)
  results.push({ recovery: true, duration: recovery.duration })
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(
      {
        executable,
        electronVersion: JSON.parse(
          await readFile(join(root, 'node_modules/electron/package.json'), 'utf8')
        ).version,
        modelDir,
        results
      },
      null,
      2
    ) + '\n'
  )
} finally {
  child.stdin.end()
  setTimeout(() => child.kill(), 3000).unref()
}
console.log(
  `Offline neural probe passed: ${samples.length} languages and validation/recovery; ${output}`
)
