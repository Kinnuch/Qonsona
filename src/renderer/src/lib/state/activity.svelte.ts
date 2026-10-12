/**
 * 学习时长：窗口在前台、两分钟内动过鼠标键盘（或者正在放视听）时，每 15 秒给正在学的语言、正在看的模块记上时间。
 * 记录存在 userData/stats.json（所有语言一个文件），一分钟存一次，关窗时也存。统计页从这里读。
 */
import { platform } from '$lib/platform'
import { serializedWrites } from './persistence'
import { addSeconds, emptyActivity, normalizeActivity, type ActivityLog } from '$shared/stats'
import { dayKey } from '$shared/srs'
import { packs } from './packs.svelte'
import { ui } from './ui.svelte'
import { media } from './media.svelte'

const TICK = 15_000
/** 这么久没动鼠标键盘就算走开了 */
const IDLE = 120_000
const SAVE_EVERY = 60_000

class Activity {
  log = $state.raw<ActivityLog | null>(null)
  #lastInput = Date.now()
  #last = Date.now()
  #dirty = false
  #lastSave = Date.now()
  #started = false
  /** 上一次记的时候在学哪门语言、看哪个模块（这一段时间算在它们头上） */
  #pack: string | null = null
  #section = ''
  #wasActive = false

  async start(): Promise<void> {
    if (this.#started) return
    this.#started = true
    try {
      const text = await platform.stats.load()
      this.log = text ? normalizeActivity(JSON.parse(text)) : emptyActivity()
    } catch {
      this.log = emptyActivity()
    }
    const touch = (): void => void (this.#lastInput = Date.now())
    for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel'])
      window.addEventListener(ev, touch, { passive: true, capture: true })
    // 切走、切回来时先把前面那一段记上
    document.addEventListener('visibilitychange', () => this.tick())
    window.addEventListener('blur', () => this.tick())
    window.addEventListener('focus', () => {
      touch()
      this.tick()
    })
    setInterval(() => this.tick(), TICK)
    this.tick()
  }

  /**
   * 把上一次到现在的这段时间记上：这一段开始时在学（前台、没走开）就算，算在那时的语言和模块头上。
   * 换模块、换语言、切走切回来时也调一下
   */
  tick(now = Date.now()): void {
    const dt = Math.min(now - this.#last, TICK * 2)
    if (this.log && this.#pack && this.#wasActive && dt > 0) {
      addSeconds(this.log, dayKey(now), this.#pack, this.#section, dt / 1000)
      this.log = { ...this.log }
      this.#dirty = true
    }
    this.#last = now
    this.#pack = packs.active?.id ?? null
    this.#section = ui.section
    this.#wasActive =
      document.visibilityState === 'visible' &&
      document.hasFocus() &&
      (now - this.#lastInput < IDLE || media.playing)
    if (this.#dirty && now - this.#lastSave >= SAVE_EVERY) void this.flush().catch(() => {})
  }

  flush(): Promise<void> {
    this.#lastSave = Date.now()
    if (!this.log || !this.#dirty) return Promise.resolve()
    this.#dirty = false
    const content = JSON.stringify(this.log)
    return serializedWrites
      .enqueue('stats', () => platform.stats.save(content))
      .catch((e) => {
        this.#dirty = true
        throw e
      })
  }
}

export const activity = new Activity()
