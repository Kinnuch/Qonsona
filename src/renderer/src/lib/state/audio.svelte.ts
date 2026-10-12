/**
 * 发音：自己的录音优先，其次是学习包里的作者录音，都没有时用系统语音读（人造语言读 IPA，自然语言读文字）。
 * 录音按「学习包 + 条目键」存（lexeme-<id>、phrase-<id>、sentence-<id>），
 * 千语集来的包用的是千语集里的 id，重新导入项目录音还在。
 */
import { platform, type Voice } from '$lib/platform'
import { t } from '$lib/i18n/index.svelte'
import { ui } from './ui.svelte'
import { serializedWrites } from './persistence'

/** 一个能发音的条目 */
export interface Sayable {
  /** 录音键；没有键的（临时文字）不能录音 */
  key?: string
  /** 人造语言：按 IPA 读 */
  ipa?: string
  /** 自然语言：按文字读，lang 是 BCP-47 */
  text?: string
  lang?: string
}

class AudioState {
  voices = $state.raw<Voice[]>([])
  /** 系统语音列表读完了没有（没读完时别说「没有语音」） */
  voicesLoaded = $state(false)
  /** 正在学的包里有录音的条目键 */
  recorded = $state.raw<Set<string>>(new Set())
  /** 学习包里带着作者录音的条目键（千语集「导出学习包」时录的） */
  authored = $state.raw<Set<string>>(new Set())
  /** 正在放的条目键（界面上显示「正在读」） */
  playing = $state<string | null>(null)
  /** 正在录的条目键 */
  recording = $state<string | null>(null)
  #packId: string | null = null
  #player: HTMLAudioElement | null = null
  /** 正在放的那一段放完（或被停下）时调：say() 返回的 Promise 靠它结束 */
  #finish: (() => void) | null = null
  #recorder: MediaRecorder | null = null
  #recordEpoch = 0
  #micPending = false
  #recordingsPending = new Set<Promise<void>>()
  #playEpoch = 0

  async loadVoices(): Promise<void> {
    try {
      this.voices = await platform.voices()
    } catch {
      this.voices = []
    }
    this.voicesLoaded = true
  }

  async loadRecordings(packId: string | null): Promise<void> {
    if (packId !== this.#packId) {
      this.stop()
      this.stopRecording()
      this.recorded = new Set()
      this.authored = new Set()
    }
    this.#packId = packId
    const [mine, authored] = packId
      ? await Promise.all([platform.listRecordings(packId), platform.listPackAudio(packId)])
      : [[], []]
    if (this.#packId !== packId) return
    this.recorded = new Set(mine)
    this.authored = new Set(authored)
  }

  /** 这个条目点了喇叭放的是什么 */
  sourceOf(item: Sayable): 'recording' | 'author' | 'tts' {
    if (item.key && this.recorded.has(item.key)) return 'recording'
    if (item.key && this.authored.has(item.key)) return 'author'
    return 'tts'
  }

  /** 读 IPA 用的声音：设置里挑过的 → 英语声音（辅音最全）→ 随便一个 */
  ipaVoice(): string {
    const pref = ui.prefs.ipaVoice
    if (pref && this.voices.some((v) => v.name === pref)) return pref
    return (this.voices.find((v) => v.culture.startsWith('en')) ?? this.voices[0])?.name ?? ''
  }

  /** 读某种语言文字的声音：语言代码对得上的第一个 */
  textVoice(lang: string): string | null {
    const base = lang.split('-')[0].toLowerCase()
    return this.voices.find((v) => v.culture.toLowerCase().split('-')[0] === base)?.name ?? null
  }

  /** 这个条目能不能出声（有录音，或者有能读它的语音） */
  canSay(item: Sayable): boolean {
    if (this.sourceOf(item) !== 'tts') return true
    if (item.ipa?.trim()) return this.voices.length > 0
    return !!(item.text?.trim() && item.lang && this.textVoice(item.lang))
  }

  async say(item: Sayable, opts: { synthOnly?: boolean } = {}): Promise<void> {
    this.stop()
    const epoch = this.#playEpoch
    const id = item.key ?? item.ipa ?? item.text ?? ''
    const source = this.sourceOf(item)
    if (!opts.synthOnly && item.key && this.#packId && source !== 'tts') {
      const rec =
        source === 'recording'
          ? await platform.getRecording(this.#packId, item.key)
          : await platform.getPackAudio(this.#packId, item.key)
      if (epoch !== this.#playEpoch) return
      if (rec) return this.#play(id, new Blob([rec.bytes as BlobPart], { type: rec.mime }))
    }
    const rate = ui.prefs.speechRate
    const req = item.ipa?.trim()
      ? { content: item.ipa, ipa: true, voice: this.ipaVoice(), rate }
      : { content: item.text ?? '', ipa: false, voice: this.textVoice(item.lang ?? '') ?? '', rate }
    if (!req.content.trim()) return
    const r = await platform.speak(req)
    if (epoch !== this.#playEpoch) return
    // 单独的附加符号（鼻化 ◌̃ 这类）前面垫一个 ◌，不然看不见
    const shown = (s: string): string => (/^\p{M}/u.test(s) ? '◌' + s : s)
    if (r.dropped.length)
      ui.toast(
        t('audio.dropped', {
          symbols: r.dropped.map((s) => t('audio.symbol', { s: shown(s) })).join('')
        })
      )
    if (!r.wav) {
      ui.toast(t('audio.failed', { error: r.error ?? '' }), 'error', 6000)
      return
    }
    return this.#play(id, new Blob([r.wav as BlobPart], { type: 'audio/wav' }))
  }

  #play(id: string, blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob)
    const player = new Audio(url)
    this.#player = player
    this.playing = id
    return new Promise((resolve) => {
      const done = (): void => {
        URL.revokeObjectURL(url)
        if (this.#player === player) {
          this.#player = null
          this.playing = null
          this.#finish = null
        }
        resolve()
      }
      this.#finish = done
      player.onended = done
      player.onerror = done
      player.play().catch(done)
    })
  }

  stop(): void {
    this.#playEpoch++
    this.#player?.pause()
    // 停下的那一段也算结束（连读整篇时靠它往下走或收尾）
    const finish = this.#finish
    this.#finish = null
    finish?.()
    this.#player = null
    this.playing = null
  }

  async startRecording(key: string): Promise<void> {
    if (this.recording || this.#micPending) return
    const packId = this.#packId
    if (!packId) return
    // 先停掉正在放的声音，免得把音箱里的声音录进去
    this.stop()
    const epoch = ++this.#recordEpoch
    this.#micPending = true
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      if (epoch === this.#recordEpoch) {
        this.#micPending = false
        ui.toast(t('audio.noMic'), 'error', 6000)
      }
      return
    }
    if (epoch !== this.#recordEpoch || this.#packId !== packId) {
      stream.getTracks().forEach((tr) => tr.stop())
      return
    }
    this.#micPending = false
    const chunks: Blob[] = []
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
    } catch (error) {
      stream.getTracks().forEach((tr) => tr.stop())
      ui.toast(String(error), 'error', 6000)
      return
    }
    let resolve!: () => void
    let reject!: (error: unknown) => void
    const saved = new Promise<void>((done, fail) => {
      resolve = done
      reject = fail
    })
    this.#recordingsPending.add(saved)
    void saved.then(
      () => {
        this.#recordingsPending.delete(saved)
      },
      (error) => {
        this.#recordingsPending.delete(saved)
        ui.toast(String(error), 'error', 8000)
      }
    )
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      stream.getTracks().forEach((tr) => tr.stop())
      if (this.#recorder === rec) {
        this.recording = null
        this.#recorder = null
      }
      void (async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        if (blob.size)
          await this.#save(key, new Uint8Array(await blob.arrayBuffer()), 'webm', packId)
      })().then(resolve, reject)
    }
    rec.onerror = () => {
      stream.getTracks().forEach((tr) => tr.stop())
      if (this.#recorder === rec) {
        this.#recorder = null
        this.recording = null
      }
      reject(new Error('Recording failed'))
    }
    this.#recorder = rec
    this.recording = key
    try {
      rec.start()
    } catch (error) {
      stream.getTracks().forEach((tr) => tr.stop())
      this.#recorder = null
      this.recording = null
      reject(error)
    }
  }

  stopRecording(): void {
    this.#recordEpoch++
    this.#micPending = false
    if (this.#recorder?.state === 'recording') this.#recorder.stop()
  }

  /** Closing or exporting also waits for the final audio chunk to reach disk. */
  async flushRecording(): Promise<void> {
    this.stopRecording()
    while (this.#recordingsPending.size) await Promise.all([...this.#recordingsPending])
  }

  async importFile(key: string): Promise<void> {
    const packId = this.#packId
    const f = await platform.pickAudioFile()
    if (f && packId) await this.#save(key, f.bytes, f.ext, packId)
  }

  async #save(key: string, bytes: Uint8Array, ext: string, packId: string): Promise<void> {
    await serializedWrites.enqueue(`audio:${packId}:${key}`, () =>
      platform.saveRecording(packId, key, bytes, ext)
    )
    if (this.#packId === packId) this.recorded = new Set([...this.recorded, key])
    ui.toast(t('audio.saved'))
  }

  async remove(key: string): Promise<void> {
    const packId = this.#packId
    if (!packId) return
    await serializedWrites.enqueue(`audio:${packId}:${key}`, () =>
      platform.deleteRecording(packId, key)
    )
    if (this.#packId !== packId) return
    const next = new Set(this.recorded)
    next.delete(key)
    this.recorded = next
  }
}

export const audio = new AudioState()
