/** Child-process protocol and delayed disk ownership; this does not claim model audio quality. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const mocked = vi.hoisted(() => ({
  spawn: vi.fn(),
  phonetics: [] as {
    available: boolean
    call: ReturnType<typeof vi.fn>
    speak: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  }[],
  neuralVoices: vi.fn(),
  neuralStop: vi.fn(),
  neuralDispose: vi.fn()
}))
vi.mock('child_process', () => ({ spawn: mocked.spawn }))
vi.mock('../src/main/phonetic-speech', () => ({
  PhoneticSpeech: class {
    available = true
    call = vi.fn(async () => ({
      ok: true,
      voices: [{ name: 'English', identifier: 'en', languages: [{ name: 'en', priority: 1 }] }]
    }))
    speak = vi.fn(async () => ({ wav: Buffer.alloc(2100), dropped: [] }))
    dispose = vi.fn()
    constructor() {
      mocked.phonetics.push(this)
    }
  }
}))
vi.mock('../src/main/neural-speech', () => ({
  NeuralSpeech: class {
    supported = true
    voices = mocked.neuralVoices
    stop = mocked.neuralStop
    dispose = mocked.neuralDispose
  }
}))
import { Speech, type Voice } from '../src/main/speech'
type Request = { id: number; op: string; out?: string }
class Helper extends EventEmitter {
  stdin = new PassThrough()
  stdout = new PassThrough()
  stderr = new PassThrough()
  requests: Request[] = []
  kill = vi.fn(() => {
    this.emit('exit', 0)
    return true
  })
  constructor() {
    super()
    let buffer = ''
    this.stdin.on('data', (chunk) => {
      buffer += String(chunk)
      for (let end = buffer.indexOf('\n'); end >= 0; end = buffer.indexOf('\n')) {
        this.requests.push(JSON.parse(buffer.slice(0, end)))
        buffer = buffer.slice(end + 1)
      }
    })
  }
  async reply(request: Request, voices?: Voice[]): Promise<void> {
    if (request.out) {
      const wav = Buffer.alloc(2100)
      wav.write('RIFF')
      await fs.writeFile(request.out, wav)
    }
    this.stdout.write(
      JSON.stringify({ id: request.id, ok: true, ...(voices ? { voices } : {}) }) + '\n'
    )
  }
}
const systemVoice: Voice = { name: 'Test system voice', culture: 'en-US', gender: 'Female' }
let directory: string, engine: Speech, helpers: Helper[]
const platforms = Object.getOwnPropertyDescriptor(process, 'platform')!
beforeEach(async () => {
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
  directory = await fs.mkdtemp(join(tmpdir(), 'qonsona-speech-discovery-'))
  helpers = []
  mocked.phonetics.length = 0
  vi.clearAllMocks()
  mocked.neuralVoices.mockResolvedValue([])
  mocked.spawn.mockImplementation(() => {
    const helper = new Helper()
    helpers.push(helper)
    return helper
  })
  engine = new Speech(directory, 'runtime', 'app')
})
afterEach(async () => {
  engine.dispose()
  vi.restoreAllMocks()
  Object.defineProperty(process, 'platform', platforms)
  await fs.rm(directory, { recursive: true, force: true })
})
describe('speech discovery isolated from playback stop', () => {
  it('preserves Windows and IPA discovery across startup stop and shares/cache only static results', async () => {
    let release!: (value: unknown) => void
    mocked.phonetics[1].call.mockReturnValueOnce(
      new Promise((done) => {
        release = done
      })
    )
    const first = engine.voices(),
      second = engine.voices()
    expect(mocked.spawn).toHaveBeenCalledTimes(1)
    expect(mocked.phonetics[1].call).toHaveBeenCalledTimes(1)
    engine.stop()
    expect(helpers[0].kill).not.toHaveBeenCalled()
    expect(mocked.phonetics[1].dispose).not.toHaveBeenCalled()
    expect(mocked.phonetics[0].dispose).toHaveBeenCalledOnce()
    await helpers[0].reply(helpers[0].requests[0], [systemVoice])
    release({
      ok: true,
      voices: [{ name: 'English', identifier: 'en', languages: [{ name: 'en', priority: 1 }] }]
    })
    const [a, b] = await Promise.all([first, second])
    expect(a).toEqual(b)
    expect(a.map((v) => v.name)).toEqual(['Test system voice', 'espeak:ipa', 'espeak:en'])
    const neural: Voice = {
      name: 'neural:supertonic3:en:F1',
      culture: 'en',
      gender: 'Female',
      engine: 'neural'
    }
    mocked.neuralVoices.mockResolvedValue([neural])
    expect((await engine.voices())[0]).toEqual(neural)
    expect(mocked.spawn).toHaveBeenCalledTimes(1)
    expect(mocked.phonetics[1].call).toHaveBeenCalledTimes(1)
  })
  it('cleans owned discovery processes on dispose and suppresses its late results', async () => {
    const voices = engine.voices()
    engine.dispose()
    expect(helpers[0].kill).toHaveBeenCalled()
    expect(mocked.phonetics[1].dispose).toHaveBeenCalled()
    expect(await voices).toEqual([])
    expect(await engine.voices()).toEqual([])
  })
})
describe('Windows speech asynchronous cancellation boundaries', () => {
  it('does not dispatch old speech after delayed mkdir; a new request works without waiting for it', async () => {
    const original = fs.mkdir.bind(fs)
    let release!: () => void
    const delay = new Promise<void>((done) => {
      release = done
    })
    let held = false
    vi.spyOn(fs, 'mkdir').mockImplementation(async (path, options) => {
      if (String(path) === directory && !held) {
        held = true
        await delay
      }
      return original(path, options as { recursive: true })
    })
    const old = engine.speak({ content: 'Old', voice: systemVoice.name, ipa: false, rate: 0 })
    await vi.waitFor(() => expect(held).toBe(true))
    engine.stop()
    const current = engine.speak({ content: 'New', voice: systemVoice.name, ipa: false, rate: 0 })
    await vi.waitFor(() => expect(helpers).toHaveLength(1))
    await helpers[0].reply(helpers[0].requests[0])
    expect((await current).wav!.toString('ascii', 0, 4)).toBe('RIFF')
    release()
    expect((await old).wav).toBeNull()
    expect(helpers[0].requests).toHaveLength(1)
  })
  it('does not return cached WAV read after stop', async () => {
    const req = { content: 'Cached', voice: systemVoice.name, ipa: false, rate: 0 }
    const key = createHash('sha1')
      .update(JSON.stringify([req.voice, 0, false, req.content]))
      .digest('hex')
    const file = join(directory, key + '.wav')
    await fs.writeFile(file, Buffer.alloc(2100))
    await fs.writeFile(file + '.json', '{"dropped":[]}')
    const original = fs.readFile.bind(fs)
    let release!: () => void,
      held = false
    const delay = new Promise<void>((done) => {
      release = done
    })
    vi.spyOn(fs, 'readFile').mockImplementation(async (...args: Parameters<typeof fs.readFile>) => {
      if (String(args[0]) === file) {
        held = true
        await delay
      }
      return original(...args)
    })
    const speech = engine.speak(req)
    await vi.waitFor(() => expect(held).toBe(true))
    engine.stop()
    release()
    expect((await speech).wav).toBeNull()
    expect(mocked.spawn).not.toHaveBeenCalled()
  })
  it('stops an outstanding system helper and cannot publish completion metadata for it', async () => {
    const speech = engine.speak({
      content: 'Pending',
      voice: systemVoice.name,
      ipa: false,
      rate: 0
    })
    await vi.waitFor(() => expect(helpers).toHaveLength(1))
    engine.stop()
    expect((await speech).wav).toBeNull()
    expect(helpers[0].kill).toHaveBeenCalled()
    expect((await fs.readdir(directory)).filter((name) => name.endsWith('.json'))).toEqual([])
  })
})
