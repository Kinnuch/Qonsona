/**
 * 视听的状态：媒体库、正在看的那一条（主字幕、第二字幕）、播放设置（倍速、单句循环、每句后暂停、显示哪几行字幕），
 * 以及页面上走到哪一步。离开页面再回来还在；看到哪里存进媒体库，下次接着看。
 * 播放器本身（<video>）在 lib/media/Player.svelte 里。
 */
import { platform } from '$lib/platform'
import { t } from '$lib/i18n/index.svelte'
import { parseSubtitles, type Cue, type MediaItem, type MediaPatch } from '$shared/media'
import { ui } from './ui.svelte'
import { packs } from './packs.svelte'

export type MediaView = { page: 'library' } | { page: 'player'; id: string }

/** 倍速档位 */
export const RATES = [0.5, 0.75, 0.9, 1, 1.25, 1.5]

/** 进度每隔多久存一次（毫秒） */
const POSITION_DELAY = 4000

class MediaState {
  items = $state.raw<MediaItem[]>([])
  loaded = $state(false)
  view = $state<MediaView>({ page: 'library' })
  /** 正在看的那一条的主字幕、第二字幕（解析好的） */
  primary = $state.raw<Cue[]>([])
  secondary = $state.raw<Cue[]>([])
  rate = $state(1)
  /** 单句循环：放完这一句回到句首 */
  loop = $state(false)
  /** 每句放完暂停（跟读用） */
  autoPause = $state(false)
  showPrimary = $state(true)
  showSecondary = $state(true)
  busy = $state(false)
  /** 正在放（统计时长时算在学） */
  playing = $state(false)
  #positionTimer: ReturnType<typeof setTimeout> | undefined
  #pending: { id: string; patch: MediaPatch } | null = null

  /** 正在学的这门语言的（没写语言的是日语的）；换了语言，播放器里那一条不是这门语言的就回到库 */
  mine = $derived(this.items.filter((x) => (x.lang ?? 'ja') === (packs.active?.id ?? 'ja')))

  current = $derived.by<MediaItem | null>(() => {
    const v = this.view
    return v.page === 'player' ? (this.mine.find((x) => x.id === v.id) ?? null) : null
  })

  async load(): Promise<void> {
    try {
      this.items = await platform.media.list()
    } catch {
      this.items = []
    }
    this.loaded = true
  }

  #put(item: MediaItem): void {
    const i = this.items.findIndex((x) => x.id === item.id)
    this.items =
      i >= 0 ? this.items.map((x) => (x.id === item.id ? item : x)) : [...this.items, item]
  }

  /** 挑文件加进库；只加了一个时直接打开 */
  async pick(): Promise<void> {
    const added = await platform.media.pick(packs.active?.id).catch((e) => {
      ui.toast(String(e), 'error', 6000)
      return [] as MediaItem[]
    })
    this.#added(added)
  }

  /** 拖进来的文件：视频、音频加进库；正在看的时候拖字幕进来就加到这一条上 */
  async drop(files: File[]): Promise<void> {
    const paths = files.map((f) => platform.media.pathForFile(f)).filter(Boolean)
    if (!paths.length) return
    const subs = paths.filter((p) => /\.(srt|vtt|ass|ssa|lrc)$/i.test(p))
    const others = paths.filter((p) => !subs.includes(p))
    if (subs.length && this.current)
      await this.#subtitles(platform.media.addSubtitlePaths(this.current.id, subs))
    if (others.length)
      this.#added(await platform.media.addPaths(others, packs.active?.id).catch(() => []))
    else if (subs.length && !this.current) ui.toast(t('media.dropSubtitleHint'))
  }

  #added(added: MediaItem[]): void {
    for (const it of added) this.#put(it)
    if (added.length === 1) void this.open(added[0].id)
    else if (added.length) ui.toast(t('media.added', { n: added.length }))
  }

  async open(id: string): Promise<void> {
    this.flushPosition()
    this.view = { page: 'player', id }
    this.primary = []
    this.secondary = []
    await this.#loadCues()
  }

  library(): void {
    this.flushPosition()
    this.view = { page: 'library' }
    void this.load()
  }

  async #cues(id: string, subId: string | null): Promise<Cue[]> {
    if (!subId) return []
    const r = await platform.media.subtitle(id, subId).catch(() => null)
    return r ? parseSubtitles(r.text, r.name) : []
  }

  async #loadCues(): Promise<void> {
    const it = this.current
    if (!it) return
    const [a, b] = await Promise.all([
      this.#cues(it.id, it.primary),
      this.#cues(it.id, it.secondary)
    ])
    if (this.current?.id !== it.id) return
    this.primary = a
    this.secondary = b
  }

  /** 加字幕：挑文件，或者拖进来的 */
  async addSubtitle(): Promise<void> {
    const it = this.current
    if (it) await this.#subtitles(platform.media.pickSubtitle(it.id))
  }

  async #subtitles(p: Promise<{ item: MediaItem | null; failed: string[] }>): Promise<void> {
    try {
      const r = await p
      if (r.item) {
        this.#put(r.item)
        await this.#loadCues()
      }
      if (r.failed.length)
        ui.toast(t('media.subtitleFailed', { files: r.failed.join('、') }), 'error', 6000)
    } catch (e) {
      ui.toast(String(e), 'error', 6000)
    }
  }

  async #update(patch: MediaPatch): Promise<void> {
    const it = this.current
    if (!it) return
    this.#put({ ...it, ...patch })
    try {
      this.#put(await platform.media.update(it.id, patch))
    } catch (e) {
      ui.toast(String(e), 'error', 6000)
    }
  }

  /** 换主字幕 / 第二字幕；选了另一行正在用的那个就两行对调 */
  async setTrack(which: 'primary' | 'secondary', subId: string | null): Promise<void> {
    const it = this.current
    if (!it) return
    const patch: MediaPatch = { [which]: subId }
    const other = which === 'primary' ? 'secondary' : 'primary'
    if (subId && it[other] === subId) patch[other] = it[which]
    await this.#update(patch)
    await this.#loadCues()
  }

  async removeSubtitle(subId: string): Promise<void> {
    const it = this.current
    if (!it) return
    this.#put(await platform.media.removeSubtitle(it.id, subId))
    await this.#loadCues()
  }

  /** 字幕整体延后 / 提前（秒，按 0.1 秒取整） */
  setOffset(offset: number): void {
    void this.#update({ offset: Math.round(offset * 10) / 10 })
  }

  rename(title: string): void {
    if (title.trim()) void this.#update({ title: title.trim() })
  }

  async remove(id: string): Promise<void> {
    await platform.media.remove(id)
    this.items = this.items.filter((x) => x.id !== id)
    if (this.view.page === 'player' && this.view.id === id) this.view = { page: 'library' }
  }

  /** 看到哪里：过一会儿存（一直在放时每隔几秒存一次） */
  savePosition(id: string, position: number, duration: number): void {
    this.#pending = {
      id,
      patch: { position, duration, playedAt: new Date().toISOString() }
    }
    if (!this.#positionTimer)
      this.#positionTimer = setTimeout(() => this.flushPosition(), POSITION_DELAY)
  }

  flushPosition(): void {
    clearTimeout(this.#positionTimer)
    this.#positionTimer = undefined
    const p = this.#pending
    this.#pending = null
    if (!p) return
    const it = this.items.find((x) => x.id === p.id)
    if (it) this.#put({ ...it, ...p.patch })
    void platform.media.update(p.id, p.patch).catch(() => {})
  }
}

export const media = new MediaState()
