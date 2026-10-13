import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ipaPhones, ipaProfile } from '../shared/ipa-phones'

interface Result {
  ok: boolean
  error?: string
  wav?: string
  trace?: string[]
  voices?: { name: string; identifier: string; languages: { name: string; priority: number }[] }[]
}
export class PhoneticSpeech {
  #process: ChildProcessWithoutNullStreams | null = null
  #sequence = 0
  #pending = new Map<
    number,
    { resolve: (r: Result) => void; timer: ReturnType<typeof setTimeout> }
  >()
  constructor(readonly directory: string) {}
  get available(): boolean {
    return (
      existsSync(join(this.directory, 'runner.mjs')) &&
      existsSync(join(this.directory, 'espeak/espeak-ng.data'))
    )
  }
  #start(): ChildProcessWithoutNullStreams {
    if (this.#process) return this.#process
    const child = spawn(process.execPath, [join(this.directory, 'runner.mjs')], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.#process = child
    let buffer = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk
      for (let end = buffer.indexOf('\n'); end >= 0; end = buffer.indexOf('\n')) {
        const line = buffer.slice(0, end)
        buffer = buffer.slice(end + 1)
        try {
          const value = JSON.parse(line)
          const job = this.#pending.get(value.id)
          if (job) {
            clearTimeout(job.timer)
            this.#pending.delete(value.id)
            job.resolve(value)
          }
        } catch {
          /* engine diagnostic */
        }
      }
    })
    const fail = (): void => {
      if (this.#process !== child) return
      this.#process = null
      for (const job of this.#pending.values()) {
        clearTimeout(job.timer)
        job.resolve({ ok: false, error: 'Offline speech process stopped' })
      }
      this.#pending.clear()
    }
    child.stderr.resume()
    child.on('error', fail)
    child.stdin.on('error', fail)
    child.on('exit', fail)
    return child
  }
  call(value: Record<string, unknown>): Promise<Result> {
    if (!this.available)
      return Promise.resolve({ ok: false, error: 'Offline speech resources unavailable' })
    return new Promise((resolve) => {
      const id = ++this.#sequence
      const timer = setTimeout(() => {
        this.#pending.delete(id)
        resolve({ ok: false, error: 'Speech timed out' })
        this.dispose()
      }, 30000)
      this.#pending.set(id, { resolve, timer })
      try {
        this.#start().stdin.write(JSON.stringify({ ...value, id }) + '\n')
      } catch {
        clearTimeout(timer)
        this.#pending.delete(id)
        resolve({ ok: false, error: 'Offline speech process unavailable' })
      }
    })
  }
  async speak(
    content: string,
    ipa: boolean,
    voice: string,
    rate: number
  ): Promise<{ wav: Buffer | null; dropped: string[]; error?: string; trace?: string[] }> {
    const converted = ipa ? ipaPhones(content) : null
    if (converted?.unsupported.length)
      return {
        wav: null,
        dropped: [],
        error: 'Unsupported IPA: ' + converted.unsupported.join(' ')
      }
    const result = await this.call({
      content: converted?.phones ?? content,
      ipa,
      voice,
      rate,
      profile: ipa ? ipaProfile(content) : undefined
    })
    return {
      wav: result.wav ? Buffer.from(result.wav, 'base64') : null,
      dropped: [],
      error: result.error,
      trace: result.trace
    }
  }
  dispose(): void {
    this.#process?.kill()
    this.#process = null
    for (const job of this.#pending.values()) {
      clearTimeout(job.timer)
      job.resolve({ ok: false, error: 'Offline speech process stopped' })
    }
    this.#pending.clear()
  }
}
