import { account } from './account.svelte'
import { audio } from './audio.svelte'
import { ui } from './ui.svelte'
import { LANG_CODES } from '$shared/lang/types'
import {
  BreakReminder,
  EncouragementCycle,
  type DockPosition,
  type Encouragement
} from '$lib/accounts/companion-events'

interface CompanionMessage extends Encouragement {
  id: number
  kind: 'answer' | 'rest'
  xp: number
  gifts: string[]
}
interface CompanionPreferences {
  position: DockPosition | null
  speech: boolean
  bubbles: boolean
}
const defaults = (): CompanionPreferences => ({ position: null, speech: false, bubbles: true })

export class CompanionState {
  preferences = $state.raw<CompanionPreferences>(defaults())
  message = $state.raw<CompanionMessage | null>(null)
  #user = ''
  #answers = new Set<string>()
  #instances = new WeakMap<object, string>()
  #break = new BreakReminder()
  #speechEpoch = 0
  #encouragements = new EncouragementCycle()

  connectUser(id: string): void {
    if (id === this.#user) return
    this.#user = id
    this.#answers.clear()
    this.#break.reset()
    this.#encouragements.reset()
    this.#speechEpoch++
    this.message = null
    let preferences = defaults()
    if (id) {
      try {
        const value = JSON.parse(localStorage.getItem(`qonsona:companion:${id}`) ?? 'null')
        if (value && typeof value === 'object') {
          const p = value.position
          preferences = {
            position: p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null,
            speech: value.speech === true,
            bubbles: value.bubbles !== false
          }
        }
      } catch {
        /* Preferences can remain in memory on a restricted browser profile. */
      }
    }
    this.preferences = preferences
  }
  configure(patch: Partial<CompanionPreferences>): void {
    this.preferences = { ...this.preferences, ...patch }
    if (!this.#user) return
    try {
      localStorage.setItem(`qonsona:companion:${this.#user}`, JSON.stringify(this.preferences))
    } catch {
      /* In-memory preference remains usable. */
    }
  }
  answerId(instance: object, index: number): string {
    let id = this.#instances.get(instance)
    if (!id) {
      id = crypto.randomUUID()
      this.#instances.set(instance, id)
    }
    return `${id}:${index}`
  }
  /** Call only after objective grading. A revealed answer or subjective flashcard has no call site. */
  correct(language: string, answerId: string): void {
    const user = account.session?.user?.id
    const characterId = account.snapshot?.companion?.currentId
    this.connectUser(user ?? '')
    if (!user || !characterId || !answerId || this.#answers.has(answerId)) return
    this.#answers.add(answerId)
    // Bound memory; recent server IDs remain independently deduplicated on the server.
    if (this.#answers.size > 4000) this.#answers.delete(this.#answers.values().next().value!)
    const phrase = this.#encouragements.next(language)
    const message: CompanionMessage = {
      ...phrase,
      id: Date.now() + Math.random(),
      kind: 'answer',
      xp: 0,
      gifts: []
    }
    this.message = message
    void account
      .reportCompanionAnswer({
        requestId: crypto.randomUUID(),
        language:
          language === 'ja' ||
          (LANG_CODES as string[]).includes(language) ||
          language.startsWith('qonlang:')
            ? language
            : `qonlang:${language}`,
        answerId,
        characterId,
        correct: true
      })
      .then((result) => {
        if (this.#user !== user || !result || this.message?.id !== message.id) return
        this.message = { ...message, xp: result.accepted ? result.xp : 0, gifts: result.gifts }
      })
    if (this.preferences.speech && !audio.playing && !audio.pending) void this.#speak(phrase)
  }
  async #speak(phrase: Encouragement): Promise<void> {
    const epoch = ++this.#speechEpoch
    if (phrase.lang && phrase.text && audio.canSay({ text: phrase.text, lang: phrase.lang }))
      await audio.say({ text: phrase.text, lang: phrase.lang }, { synthOnly: true })
    if (
      epoch !== this.#speechEpoch ||
      !this.#user ||
      !this.preferences.speech ||
      audio.playing ||
      audio.pending
    )
      return
    if (audio.canSay({ text: phrase.zh, lang: 'zh-CN' }))
      await audio.say({ text: phrase.zh, lang: 'zh-CN' }, { synthOnly: true })
  }
  recordLearning(start: number, end: number): void {
    this.connectUser(account.session?.user?.id ?? '')
    if (!this.#user || !account.snapshot?.companion?.currentId || !this.#break.record(start, end))
      return
    this.message = {
      id: Date.now(),
      kind: 'rest',
      text: '',
      zh: '已经认真学习 45 分钟了。休息一下、看看远处吧！',
      lang: null,
      xp: 0,
      gifts: []
    }
    ui.toast('语言精灵提醒：已经学习 45 分钟，休息一下吧。', 'info', 8000)
  }
  dismiss(): void {
    this.message = null
  }
}
export const companion = new CompanionState()
