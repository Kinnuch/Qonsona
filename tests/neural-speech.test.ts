import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promises as disk } from 'node:fs'
vi.mock('../src/shared/neural-model', async () => {
  const { createHash } = await import('node:crypto')
  const bytes = Buffer.from('safe offline model\n')
  return {
    NEURAL_MODEL: {
      revision: 'fixed-test-revision',
      total: bytes.length,
      files: [
        {
          path: 'onnx/model.onnx',
          url: 'https://example.invalid/model',
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex')
        }
      ]
    }
  }
})
import { NeuralSpeech } from '../src/main/neural-speech'
let directory: string
let engine: NeuralSpeech
const bytes = Buffer.from('safe offline model\n')
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'qonsona-neural-unit-'))
  const runtime = join(directory, 'runtime')
  await mkdir(runtime)
  // 这是协议/取消测试的受控进程；真正的模型音频另跑打包后的验收。
  await writeFile(
    join(runtime, 'neural-runner.mjs'),
    `import {createInterface} from 'node:readline'; const wav=Buffer.alloc(2100); wav.write('RIFF'); for await(const line of createInterface({input:process.stdin})){const r=JSON.parse(line); setTimeout(()=>process.stdout.write(JSON.stringify({id:r.id,ok:true,wav:wav.toString('base64')})+'\\n'),r.content==='slow'?5000:10)}`
  )
  engine = new NeuralSpeech(join(directory, 'models'), runtime, directory)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(bytes))
  )
})
afterEach(async () => {
  engine.dispose()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await rm(directory, { recursive: true, force: true })
})
describe('offline voice pack installation and process lifecycle', () => {
  it('cancels after the last file downloaded while the installation marker is pending', async () => {
    const original = disk.writeFile.bind(disk)
    let release!: () => void
    const hold = new Promise<void>((done) => {
      release = done
    })
    let reached = false
    vi.spyOn(disk, 'writeFile').mockImplementation(async (...args) => {
      if (String(args[0]).endsWith('installed.json')) {
        reached = true
        await hold
      }
      return original(...args)
    })
    const download = engine.install()
    await vi.waitFor(() => expect(reached).toBe(true))
    const cancel = engine.cancel()
    release()
    await cancel
    expect(await download).toMatchObject({
      installed: false,
      downloading: false,
      error: 'Download cancelled'
    })
    expect((await engine.status()).installed).toBe(false)
  })
  it('does not dispatch an obsolete worker after cancellation during a cache miss', async () => {
    await engine.install()
    const original = disk.readFile.bind(disk)
    let reject!: (error: Error) => void
    let reached = false
    const pending = new Promise<Buffer>((_resolve, fail) => {
      reject = fail
    })
    vi.spyOn(disk, 'readFile').mockImplementation((...args) => {
      if (String(args[0]).includes('audio-cache')) {
        reached = true
        return pending
      }
      return original(...args)
    })
    const request = engine.speak('slow', 'neural:supertonic3:en:F1', 0)
    await vi.waitFor(() => expect(reached).toBe(true))
    engine.stop()
    reject(new Error('cache miss'))
    expect(await request).toMatchObject({ wav: null, error: 'Speech cancelled' })
    vi.restoreAllMocks()
    expect(
      (await engine.speak('Hello', 'neural:supertonic3:en:F1', 0)).wav!.length
    ).toBeGreaterThan(1000)
  })
  it('verifies every download, registers only actual supported languages, and reads a WAV through the local protocol', async () => {
    expect((await engine.status()).installed).toBe(false)
    const installed = await engine.install()
    expect(installed).toMatchObject({ installed: true, downloading: false, received: bytes.length })
    const voices = await engine.voices()
    expect(voices).toHaveLength(124)
    expect(voices.some((voice) => ['gd', 'qya', 'sjn'].includes(voice.culture))).toBe(false)
    const result = await engine.speak('Hello', 'neural:supertonic3:en:F1', 0)
    expect(result.error).toBeUndefined()
    expect(result.wav!.toString('ascii', 0, 4)).toBe('RIFF')
    const again = await engine.speak('Hello', 'neural:supertonic3:en:F1', 0)
    expect(again.wav!.equals(result.wav!)).toBe(true)
  })
  it('shares concurrent installs and leaves nothing installed on a hash mismatch', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response(Buffer.alloc(bytes.length, 1)))
    const result = await Promise.all([engine.install(), engine.install()])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.every((status) => !status.installed && !status.downloading)).toBe(true)
    expect(result[0].error).toContain('checksum')
    vi.mocked(fetch).mockImplementation(async () => new Response(bytes))
    expect((await engine.install()).installed).toBe(true)
  })
  it('cancels an in-flight download, cleans partial files and can retry', async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options!.signal!.addEventListener('abort', () => reject(new Error('cancel')), {
            once: true
          })
        })
    )
    const download = engine.install()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    expect((await engine.status()).downloading).toBe(true)
    await engine.cancel()
    expect(await download).toMatchObject({
      installed: false,
      downloading: false,
      error: 'Download cancelled'
    })
    vi.mocked(fetch).mockImplementation(async () => new Response(bytes))
    expect((await engine.install()).installed).toBe(true)
  })
  it('rejects tampered bytes at first synthesis instead of running a corrupt model', async () => {
    await engine.install()
    await writeFile(join(engine.modelDir, 'onnx/model.onnx'), Buffer.alloc(bytes.length, 3))
    const result = await engine.speak('Hello', 'neural:supertonic3:en:F1', 0)
    expect(result.wav).toBeNull()
    expect(result.error).toContain('checksum')
    expect((await engine.status()).installed).toBe(false)
    expect((await engine.install()).installed).toBe(true)
  })
  it('stops owned synthesis and its queued request, then restarts cleanly', async () => {
    await engine.install()
    const slow = engine.speak('slow', 'neural:supertonic3:en:F1', 0)
    const queued = engine.speak('queued', 'neural:supertonic3:en:F1', 0)
    await new Promise((resolve) => setTimeout(resolve, 100))
    engine.stop()
    expect((await slow).wav).toBeNull()
    expect((await queued).wav).toBeNull()
    expect(
      (await engine.speak('Hello', 'neural:supertonic3:en:F1', 0)).wav!.length
    ).toBeGreaterThan(1000)
  })
  it('removes only the model and leaves personal files outside its folder', async () => {
    await engine.install()
    const personal = join(directory, 'stats.json')
    await writeFile(personal, '{"days":{}}')
    expect((await engine.remove()).installed).toBe(false)
    expect(await readFile(personal, 'utf8')).toBe('{"days":{}}')
    expect(await engine.voices()).toEqual([])
    expect((await engine.speak('Hello', 'neural:supertonic3:gd:F1', 0)).error).toContain('Invalid')
  })
})
