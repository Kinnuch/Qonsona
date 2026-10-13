/* eslint-disable @typescript-eslint/explicit-function-return-type */
/** Standalone offline neural TTS. stdin/stdout are JSON lines; stderr is diagnostics. */
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { loadTextToSpeech, loadVoiceStyle, setRuntime } from './supertonic/helper.mjs'

const languages = new Set([
  'en',
  'ko',
  'ja',
  'ar',
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'es',
  'et',
  'fi',
  'fr',
  'hi',
  'hr',
  'hu',
  'id',
  'it',
  'lt',
  'lv',
  'nl',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'sv',
  'tr',
  'uk',
  'vi'
])
const voices = new Set(['F1', 'F2', 'M1', 'M2'])
const modelDir = resolve(process.argv[2] ?? '')
const appRoot = resolve(process.argv[3] ?? '')
let modelPromise
const styles = new Map()

function wavBuffer(samples, sampleRate) {
  if (!samples.length || samples.some((value) => !Number.isFinite(value)))
    throw new Error('Neural model returned invalid audio')
  const wav = Buffer.alloc(44 + samples.length * 2)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i++)
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2)
  return wav
}
async function speak(request) {
  if (request.op !== 'speak') throw new Error('Unknown neural operation')
  if (typeof request.content !== 'string' || !request.content.trim())
    throw new Error('Speech text is empty')
  if (request.content.length > 5000)
    throw new Error('Speech text exceeds 5000 characters; split it into smaller passages')
  if (!languages.has(request.lang)) throw new Error(`Unsupported neural language: ${request.lang}`)
  const voice = request.voice ?? 'F1'
  if (!voices.has(voice)) throw new Error(`Unsupported neural voice: ${voice}`)
  const rate = request.rate === undefined ? 0 : request.rate
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < -10 || rate > 10)
    throw new Error('Speech rate must be between -10 and 10')
  const speed = Math.max(0.5, Math.min(2, Math.pow(1.1, rate)))
  if (!modelPromise) {
    modelPromise = (async () => {
      const runtimeRoot = appRoot.endsWith('.asar') ? `${appRoot}.unpacked` : appRoot
      const require = createRequire(join(runtimeRoot, 'package.json'))
      const ort = require('onnxruntime-node')
      setRuntime(ort)
      return loadTextToSpeech(join(modelDir, 'onnx'))
    })().catch((error) => {
      modelPromise = undefined
      throw error
    })
  }
  const model = await modelPromise
  if (!styles.has(voice))
    styles.set(voice, loadVoiceStyle([join(modelDir, 'voice_styles', `${voice}.json`)]))
  const started = performance.now()
  const { wav } = await model.call(request.content, request.lang, styles.get(voice), 5, speed)
  const audio = wavBuffer(wav, model.sampleRate)
  return {
    id: request.id,
    ok: true,
    wav: audio.toString('base64'),
    sampleRate: model.sampleRate,
    duration: wav.length / model.sampleRate,
    elapsedMs: performance.now() - started
  }
}
let queue = Promise.resolve()
const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
input.on('line', (line) => {
  queue = queue.then(async () => {
    let request
    try {
      if (line.length > 100000) throw new Error('Neural request is too large')
      request = JSON.parse(line)
      if (!request || typeof request !== 'object' || Array.isArray(request))
        throw new Error('Invalid neural request')
      process.stdout.write(JSON.stringify(await speak(request)) + '\n')
    } catch (error) {
      process.stdout.write(
        JSON.stringify({
          id: request?.id ?? null,
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        }) + '\n'
      )
    }
  })
})
input.on('close', () => queue.finally(() => process.exit(0)))
