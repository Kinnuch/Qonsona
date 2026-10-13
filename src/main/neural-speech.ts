/** 神经语音模型只下载公开权重；合成由隐藏的本地子进程执行。 */
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { createHash } from 'crypto'
import { promises as fs, existsSync, createReadStream } from 'fs'
import { join, dirname, resolve, relative } from 'path'
import { NEURAL_MODEL } from '../shared/neural-model'
import {
  neuralVoice,
  NEURAL_LANGUAGES,
  NEURAL_STYLES,
  type NeuralStatus
} from '../shared/neural-speech'
import type { Voice, SpeakResult } from './speech'

export class NeuralSpeech {
  readonly modelDir: string
  #download: Promise<NeuralStatus> | null = null
  #abort: AbortController | null = null
  #received = 0
  #error: string | undefined
  #proc: ChildProcessWithoutNullStreams | null = null
  #seq = 0
  #epoch = 0
  #buffer = ''
  #pending = new Map<
    number,
    { resolve: (result: SpeakResult) => void; timer: ReturnType<typeof setTimeout> }
  >()
  #queue: Promise<unknown> = Promise.resolve()
  #verified = ''
  #integrityFailed = false
  #removing = false
  #cancelling = false
  #cancellation: Promise<void> | null = null
  #commitOwner: AbortController | null = null

  constructor(
    private root: string,
    private runtimeDir: string,
    private appRoot: string,
    private executable = process.execPath
  ) {
    this.modelDir = join(root, 'supertonic3')
  }

  get supported(): boolean {
    return (
      ['win32', 'darwin', 'linux'].includes(process.platform) &&
      ['x64', 'arm64'].includes(process.arch) &&
      existsSync(join(this.runtimeDir, 'neural-runner.mjs'))
    )
  }

  async #installed(): Promise<boolean> {
    if (this.#integrityFailed) return false
    try {
      const directory = await fs.lstat(this.modelDir)
      if (!directory.isDirectory() || directory.isSymbolicLink()) return false
      const marker = JSON.parse(await fs.readFile(join(this.modelDir, 'installed.json'), 'utf8'))
      if (marker.revision !== NEURAL_MODEL.revision) return false
      for (const file of NEURAL_MODEL.files) {
        const info = await fs.lstat(join(this.modelDir, file.path))
        if (!info.isFile() || info.isSymbolicLink() || info.size !== file.bytes) return false
      }
      return true
    } catch {
      return false
    }
  }

  async status(): Promise<NeuralStatus> {
    return {
      supported: this.supported,
      installed: await this.#installed(),
      downloading: !!this.#download || this.#cancelling,
      received: this.#received,
      total: NEURAL_MODEL.total,
      ...(this.#error ? { error: this.#error } : {})
    }
  }

  async install(): Promise<NeuralStatus> {
    if (this.#download) {
      await this.#download
      await this.#cancellation
      return this.status()
    }
    if (this.#removing || this.#cancelling)
      throw new Error('Voice pack operation is still finishing')
    if (!this.supported) throw new Error('Neural speech is unavailable on this platform')
    if (await this.#installed()) return this.status()
    // 同一时刻的两个 IPC 请求共用下载，避免互相清理临时目录。
    if (this.#download) {
      await this.#download
      await this.#cancellation
      return this.status()
    }
    this.#abort = new AbortController()
    this.#commitOwner = null
    this.#received = 0
    this.#error = undefined
    const controller = this.#abort
    this.#download = this.#install(controller).finally(() => {
      this.#download = null
      this.#abort = null
    })
    await this.#download
    await this.#cancellation
    return this.status()
  }

  async #install(controller: AbortController): Promise<NeuralStatus> {
    const temporary = join(this.root, 'supertonic3-download')
    try {
      await fs.mkdir(this.root, { recursive: true })
      this.#assertInside(temporary)
      await fs.rm(temporary, { recursive: true, force: true })
      await fs.mkdir(temporary)
      for (const file of NEURAL_MODEL.files) {
        if (controller.signal.aborted) throw new Error('Download cancelled')
        if (!/^[a-zA-Z0-9_./-]+$/.test(file.path) || file.path.split('/').includes('..'))
          throw new Error('Invalid model catalog')
        const destination = join(temporary, file.path)
        this.#assertInside(destination)
        await fs.mkdir(dirname(destination), { recursive: true })
        const handle = await fs.open(destination, 'wx')
        let idle: ReturnType<typeof setTimeout> | undefined
        const arm = (): void => {
          clearTimeout(idle)
          idle = setTimeout(() => controller.abort(), 120000)
        }
        arm()
        try {
          const response = await fetch(file.url, { signal: controller.signal })
          if (!response.ok || !response.body)
            throw new Error(`Voice pack download failed: HTTP ${response.status}`)
          const hash = createHash('sha256')
          let size = 0
          for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
            arm()
            size += chunk.length
            if (size > file.bytes) throw new Error('Voice pack size mismatch')
            hash.update(chunk)
            await handle.writeFile(chunk)
            this.#received += chunk.length
          }
          if (size !== file.bytes || hash.digest('hex') !== file.sha256)
            throw new Error('Voice pack checksum mismatch')
        } finally {
          clearTimeout(idle)
          await handle.close()
        }
      }
      if (controller.signal.aborted) throw new Error('Download cancelled')
      await fs.writeFile(
        join(temporary, 'installed.json'),
        JSON.stringify({ revision: NEURAL_MODEL.revision, installedAt: new Date().toISOString() })
      )
      if (controller.signal.aborted) throw new Error('Download cancelled')
      this.stop()
      this.#assertInside(this.modelDir)
      // 完整核验后再替换旧的损坏模型；学习数据不在该目录里。
      await fs.rm(this.modelDir, { recursive: true, force: true })
      if (controller.signal.aborted) throw new Error('Download cancelled')
      await fs.rename(temporary, this.modelDir)
      this.#commitOwner = controller
      this.#verified = ''
      this.#integrityFailed = false
    } catch (error) {
      this.#error = controller.signal.aborted
        ? 'Download cancelled'
        : error instanceof Error
          ? error.message
          : 'Voice pack download failed'
      this.#assertInside(temporary)
      await fs.rm(temporary, { recursive: true, force: true }).catch(() => {})
    }
    return this.status()
  }

  #assertInside(path: string): void {
    const rel = relative(resolve(this.root), resolve(path))
    if (!rel || rel.startsWith('..') || resolve(this.root) === resolve(path))
      throw new Error('Unsafe voice pack path')
  }

  async cancel(): Promise<void> {
    if (this.#cancellation) return this.#cancellation
    const controller = this.#abort
    const download = this.#download
    if (!controller || !download) return
    this.#cancelling = true
    controller.abort()
    this.#cancellation = (async () => {
      try {
        await download
        // 即使取消落在最后的原子重命名中，也撤销本次新安装，不删除此前已有的模型。
        if (this.#commitOwner === controller) {
          this.stop()
          this.#assertInside(this.modelDir)
          await fs.rm(this.modelDir, { recursive: true, force: true })
          this.#verified = ''
          this.#commitOwner = null
        }
        this.#error = 'Download cancelled'
      } finally {
        this.#cancelling = false
      }
    })().finally(() => {
      this.#cancellation = null
    })
    await this.#cancellation
  }

  async remove(): Promise<NeuralStatus> {
    this.#removing = true
    try {
      await this.cancel()
      this.stop()
      this.#assertInside(this.modelDir)
      await fs.rm(this.modelDir, { recursive: true, force: true })
      this.#verified = ''
      this.#integrityFailed = false
      this.#received = 0
      this.#error = undefined
    } finally {
      this.#removing = false
    }
    return this.status()
  }

  async voices(): Promise<Voice[]> {
    if (this.#removing || !(await this.#installed())) return []
    return NEURAL_LANGUAGES.flatMap((lang) =>
      NEURAL_STYLES.map((style) => ({
        name: `neural:supertonic3:${lang}:${style}`,
        culture: lang,
        gender: style.startsWith('F') ? 'Female' : 'Male',
        engine: 'neural' as const,
        label: `Supertonic 3 · ${style}`
      }))
    )
  }

  async speak(content: string, voiceName: string, rate: number): Promise<SpeakResult> {
    const voice = neuralVoice(voiceName)
    if (!voice || !content.trim() || content.length > 5000 || !Number.isFinite(rate))
      return {
        wav: null,
        dropped: [],
        error: 'Invalid neural speech request (maximum 5000 characters)'
      }
    const epoch = this.#epoch
    const task = this.#queue
      .catch(() => {})
      .then(async () => {
        if (epoch !== this.#epoch || this.#removing)
          return { wav: null, dropped: [], error: 'Speech cancelled' }
        if (!(await this.#installed()))
          return {
            wav: null,
            dropped: [],
            error: 'Please download the offline neural voice pack in Settings'
          }
        if (this.#verified !== NEURAL_MODEL.revision) {
          for (const file of NEURAL_MODEL.files) {
            const hash = createHash('sha256')
            for await (const chunk of createReadStream(join(this.modelDir, file.path))) {
              if (epoch !== this.#epoch)
                return { wav: null, dropped: [], error: 'Speech cancelled' }
              hash.update(chunk)
            }
            if (hash.digest('hex') !== file.sha256) {
              this.#integrityFailed = true
              this.#error = 'Voice pack checksum mismatch; please download it again'
              return {
                wav: null,
                dropped: [],
                error: this.#error
              }
            }
          }
          this.#verified = NEURAL_MODEL.revision
        }
        if (epoch !== this.#epoch) return { wav: null, dropped: [], error: 'Speech cancelled' }
        const key = createHash('sha256')
          .update(JSON.stringify([NEURAL_MODEL.revision, content, voiceName, rate]))
          .digest('hex')
        const cache = join(this.root, 'audio-cache')
        const file = join(cache, key + '.wav')
        let cached: Buffer | null = null
        try {
          cached = await fs.readFile(file)
        } catch {
          /* 初次合成。 */
        }
        if (epoch !== this.#epoch || this.#removing)
          return { wav: null, dropped: [], error: 'Speech cancelled' }
        if (cached) {
          const wav = cached
          if (wav.length > 1000 && wav.toString('ascii', 0, 4) === 'RIFF')
            return { wav, dropped: [] }
        }
        const result = await this.#call({ content, lang: voice.lang, voice: voice.style, rate })
        if (result.wav && epoch === this.#epoch) {
          await fs.mkdir(cache, { recursive: true })
          await fs.writeFile(file, result.wav)
          await this.#prune(cache)
        }
        if (epoch !== this.#epoch) return { wav: null, dropped: [], error: 'Speech cancelled' }
        return result
      })
      .catch((error) => ({
        wav: null,
        dropped: [],
        error: error instanceof Error ? error.message : 'Neural speech failed'
      }))
    this.#queue = task
    return task
  }

  async #prune(directory: string): Promise<void> {
    const list = await Promise.all(
      (await fs.readdir(directory))
        .filter((name) => /^[a-f0-9]{64}\.wav$/.test(name))
        .map(async (name) => ({ name, info: await fs.stat(join(directory, name)) }))
    )
    let bytes = list.reduce((sum, file) => sum + file.info.size, 0)
    for (const file of list.sort((a, b) => a.info.mtimeMs - b.info.mtimeMs)) {
      if (bytes <= 128 * 1048576) break
      await fs.unlink(join(directory, file.name))
      bytes -= file.info.size
    }
  }

  #start(): ChildProcessWithoutNullStreams {
    if (this.#proc) return this.#proc
    const proc = spawn(
      this.executable,
      [join(this.runtimeDir, 'neural-runner.mjs'), this.modelDir, this.appRoot],
      {
        windowsHide: true,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['pipe', 'pipe', 'pipe']
      }
    )
    this.#proc = proc
    this.#buffer = ''
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      if (this.#proc !== proc) return
      this.#buffer += chunk
      if (this.#buffer.length > 64 * 1048576) {
        this.stop()
        return
      }
      let newline: number
      while ((newline = this.#buffer.indexOf('\n')) !== -1) {
        const line = this.#buffer.slice(0, newline)
        this.#buffer = this.#buffer.slice(newline + 1)
        try {
          const result = JSON.parse(line)
          const pending = this.#pending.get(result.id)
          if (!pending) continue
          clearTimeout(pending.timer)
          this.#pending.delete(result.id)
          const wav =
            result.ok && typeof result.wav === 'string' ? Buffer.from(result.wav, 'base64') : null
          pending.resolve(
            wav && wav.length > 1000 && wav.toString('ascii', 0, 4) === 'RIFF'
              ? { wav, dropped: [] }
              : { wav: null, dropped: [], error: result.error ?? 'No speech audio returned' }
          )
        } catch {
          /* 只接受完整的协议回应。 */
        }
      }
    })
    // stderr 不含文字内容，也不转发到渲染层；错误通过 JSON 协议返回。
    proc.stderr.resume()
    const fail = (): void => {
      if (this.#proc === proc) this.stop()
    }
    proc.on('error', fail)
    proc.stdin.on('error', fail)
    proc.on('exit', fail)
    return proc
  }

  #call(request: Record<string, unknown>): Promise<SpeakResult> {
    const id = ++this.#seq
    return new Promise((resolveResult) => {
      const timer = setTimeout(() => this.stop(), 180000)
      this.#pending.set(id, { resolve: resolveResult, timer })
      const proc = this.#start()
      proc.stdin.write(JSON.stringify({ ...request, id, op: 'speak' }) + '\n', (error) => {
        if (error && this.#proc === proc) this.stop()
      })
    })
  }

  stop(): void {
    this.#epoch++
    const proc = this.#proc
    this.#proc = null
    this.#buffer = ''
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer)
      pending.resolve({ wav: null, dropped: [], error: 'Speech cancelled or synthesis timed out' })
    }
    this.#pending.clear()
    proc?.kill()
  }

  dispose(): void {
    this.#abort?.abort()
    this.stop()
  }
}
