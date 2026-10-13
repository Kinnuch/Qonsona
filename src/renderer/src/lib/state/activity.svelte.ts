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
import {
  emptyRewards,
  completeReward,
  addRewardInterval,
  rewardIntervalEnd,
  REWARD_MODULES,
  type CompletionKind
} from '$shared/rewards'
import { i18n } from '$lib/i18n/index.svelte'

const TICK = 15_000
/** 这么久没动鼠标键盘就算走开了 */
const IDLE = 120_000
const SAVE_EVERY = 60_000

class Activity {
  log = $state.raw<ActivityLog | null>(null)
  #lastInput = 0
  recentUnlocks = $state<string[]>([])
  #pending: { kind: CompletionKind; id: string; packId: string; at: number }[] = []
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
    this.log.rewards ??= emptyRewards()
    for (const e of this.#pending) this.complete(e.kind, e.id, e.packId, e.at)
    this.#pending = []
    this.#last = Date.now()
    const touch = (): void => void (this.#lastInput = Date.now())
    for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel'])
      window.addEventListener(ev, touch, { passive: true, capture: true })
    // 切走、切回来时先把前面那一段记上
    document.addEventListener('visibilitychange', () => this.tick())
    window.addEventListener('blur', () => this.tick())
    window.addEventListener('focus', () => {
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
      if (this.log.rewards && REWARD_MODULES.has(this.#section)) {
        const end = rewardIntervalEnd(
          this.#section,
          now - dt,
          now,
          this.#lastInput,
          this.#wasActive,
          IDLE
        )
        if (end !== null) this.announce(addRewardInterval(this.log.rewards, now - dt, end))
      }
      this.log = { ...this.log }
      this.#dirty = true
    }
    this.#last = now
    this.#pack = packs.active?.id ?? null
    this.#section = ui.section
    this.#wasActive =
      REWARD_MODULES.has(this.#section) &&
      document.visibilityState === 'visible' &&
      document.hasFocus() &&
      (now - this.#lastInput < IDLE || media.playing)
    if (this.#dirty && now - this.#lastSave >= SAVE_EVERY) void this.flush().catch(() => {})
  }

  complete(
    kind: CompletionKind,
    id: string,
    packId = packs.active?.id ?? '',
    at = Date.now()
  ): void {
    if (!packId || !id.trim()) return
    if (!this.log) {
      this.#pending.push({ kind, id, packId, at })
      return
    }
    this.log.rewards ??= emptyRewards(at)
    this.announce(completeReward(this.log.rewards, kind, id, packId, at))
    this.log = { ...this.log }
    this.#dirty = true
    void this.flush().catch((error) => ui.toast(String(error), 'error'))
  }

  private announce(ids: string[]): void {
    if (!ids.length) return
    this.recentUnlocks = [...this.recentUnlocks, ...ids]
    ui.toast(
      i18n.locale === 'zh'
        ? `已解锁 ${ids.length} 枚学习伙伴，可在「收集」中查看。`
        : `Unlocked ${ids.length} learning companions. View them in Collection.`,
      'info',
      6000
    )
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
