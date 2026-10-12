/**
 * 生词本的状态：正在学的那门语言的生词本（存在主进程，改了过一会儿自动存），以及复习 / 闪卡的一轮。
 *
 * 一轮里答错的过几张再来一次（设置里可以关）；「上一题」按作答前的快照撤回——
 * 卡的排期、今天的计数、本轮对错、为了重来插进队列的那一张，全都退回去，重答不会重复计数。
 */
import { platform } from '$lib/platform'
import { t } from '$lib/i18n/index.svelte'
import {
  MINE,
  addCards,
  answer,
  createList,
  emptyNotebook,
  listOf,
  normalizeNotebook,
  removeFromList,
  removeList,
  reviewAnswerSnapshot,
  restoreReviewAnswer,
  type ReviewAnswerSnapshot,
  type CardInput,
  type CardStatus,
  type DayStat,
  type NoteCard,
  type Notebook
} from '$shared/notebook'
import { dayKey, shuffle, STATE, type Grade } from '$shared/srs'
import {
  buildReviewPlan,
  settingsFor,
  saveReviewSettings,
  rescheduleReview,
  scopedToday
} from '$shared/review-plan'
import { type ReviewSettings, type ReviewKind } from '$shared/review-settings'
import {
  makeReviewQuestion,
  type ReviewData,
  type ReviewQuestionResult
} from '$shared/review-question'
import { serializedWrites } from './persistence'
import { ui } from './ui.svelte'

const SAVE_DELAY = 400

interface UndoEntry {
  /** 答的是队列里的第几张 */
  pos: number
  key: string
  card: NoteCard
  dayKey: string
  day: DayStat | null
  right: number
  wrong: number
  /** 答错后插进队列的位置（撤回时拿掉） */
  inserted: number[]
  snapshot: ReviewAnswerSnapshot
  question: ReviewQuestionResult
  questionCounts: Partial<Record<ReviewKind, number>>
}

export interface Session {
  /** review：今日复习；drill：按词本过闪卡 */
  mode: 'review' | 'drill'
  listId: string | null
  queue: string[]
  i: number
  /** 这一张答了什么（在看背面）；还没答是 null */
  answered: Grade | null
  right: number
  wrong: number
  undo: UndoEntry[]
  done: boolean
  settings: Record<string, ReviewSettings>
  scopes: Record<string, string>
  questionCounts: Partial<Record<ReviewKind, number>>
  question: ReviewQuestionResult
  questionPrepared: boolean
  questionEpoch: number
}

/** 生词本页上选中的词本与筛选（离开再回来还在；换语言时回到「我的生词」） */
export interface NotebookView {
  list: string
  filter: 'all' | CardStatus
  /** 大词本默认只列前面一部分 */
  showAll: boolean
}

class NotebookState {
  packId = $state<string | null>(null)
  nb = $state.raw<Notebook | null>(null)
  session = $state.raw<Session | null>(null)
  view = $state<NotebookView>({ list: MINE, filter: 'all', showAll: false })
  #timer: ReturnType<typeof setTimeout> | undefined
  #loading: Promise<void> | null = null
  #loadEpoch = 0

  /** 今天要复习几个、还能学几个新词（首页、生词本页顶上） */
  counts = $derived.by(() => {
    if (!this.nb) return { due: 0, fresh: 0 }
    const plan = buildReviewPlan(this.nb, null, this.#fallback(), Date.now(), false)
    return {
      due: plan.queue.filter((k) => this.nb!.cards[k].state !== STATE.NEW).length,
      fresh: plan.queue.filter((k) => this.nb!.cards[k].state === STATE.NEW).length
    }
  })
  #fallback(): Partial<ReviewSettings> {
    return {
      newPerDay: ui.prefs.newPerDay,
      reviewCap: ui.prefs.reviewCap,
      order: ui.prefs.studyOrder
    }
  }

  /** 读这门语言的生词本（已经读好的不再读） */
  load(packId: string | null): Promise<void> {
    if (packId === this.packId && (this.nb || this.#loading))
      return this.#loading ?? Promise.resolve()
    const flushed = this.flush()
    const epoch = ++this.#loadEpoch
    this.packId = packId
    this.nb = null
    this.session = null
    this.view = { list: MINE, filter: 'all', showAll: false }
    if (!packId) {
      this.#loading = null
      return flushed
    }
    this.#loading = (async () => {
      await flushed
      await serializedWrites.wait(`notebook:${packId}`)
      const text = await platform.notebook.load(packId).catch(() => null)
      let raw: unknown = null
      try {
        raw = text ? JSON.parse(text) : null
      } catch {
        raw = null
      }
      if (this.packId === packId && epoch === this.#loadEpoch)
        this.nb = raw ? normalizeNotebook(raw) : emptyNotebook()
    })().finally(() => {
      if (epoch === this.#loadEpoch) this.#loading = null
    })
    return this.#loading
  }

  /** 改过了：界面跟着变，过一会儿存盘（连着改只存一次） */
  #changed(): void {
    if (!this.nb) return
    this.nb = { ...this.nb }
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => {
      void this.flush().catch(() => {})
    }, SAVE_DELAY)
  }

  flush(): Promise<void> {
    clearTimeout(this.#timer)
    this.#timer = undefined
    if (!this.nb || !this.packId) return Promise.resolve()
    const packId = this.packId
    const json = JSON.stringify(this.nb)
    return serializedWrites
      .enqueue(`notebook:${packId}`, () => platform.notebook.save(packId, json))
      .catch((e) => {
        ui.toast(String(e), 'error', 8000)
        throw e
      })
  }

  has(key: string): boolean {
    return !!this.nb?.cards[key]
  }

  /** 加一个词（默认进「我的生词」） */
  add(input: CardInput, listId = MINE): void {
    if (!this.nb) return
    addCards(this.nb, listId, [input])
    this.#changed()
    ui.toast(t('notebook.added', { list: this.listName(listId) }))
  }

  /** 一批词加进一个词本：按来源找（内置词本、某篇文章），没有就新建 */
  addMany(inputs: CardInput[], name: string, source?: string): string | null {
    if (!this.nb || !inputs.length) return null
    const list =
      (source && this.nb.lists.find((l) => l.source === source)) ||
      createList(this.nb, name, source)
    const n = addCards(this.nb, list.id, inputs)
    this.#changed()
    ui.toast(t('notebook.addedMany', { n, list: this.listName(list.id) }))
    return list.id
  }

  /** 从一个词本里移出；不在别的词本里的连同学习记录删掉 */
  remove(keys: string[], listId: string): void {
    if (!this.nb) return
    removeFromList(this.nb, listId, keys)
    this.#changed()
  }

  newList(name: string): string | null {
    if (!this.nb) return null
    const id = createList(this.nb, name.trim() || t('notebook.untitled')).id
    this.#changed()
    return id
  }

  renameList(id: string, name: string): void {
    const list = this.nb && listOf(this.nb, id)
    if (!list || id === MINE || !name.trim()) return
    list.name = name.trim()
    this.#changed()
  }

  deleteList(id: string): void {
    if (!this.nb) return
    removeList(this.nb, id)
    if (this.view.list === id) this.view.list = MINE
    this.#changed()
  }

  listName(id: string): string {
    const list = this.nb && listOf(this.nb, id)
    return !list ? '' : id === MINE ? t('notebook.mine') : list.name
  }

  // ── 一轮复习 / 闪卡 ──

  reviewSettings(listId: string | null = null): ReviewSettings {
    return this.nb
      ? settingsFor(this.nb, listId, this.#fallback())
      : settingsFor(emptyNotebook(), null, this.#fallback())
  }
  setReviewSettings(listId: string | null, settings: ReviewSettings): void {
    if (!this.nb) return
    saveReviewSettings(this.nb, listId, settings)
    this.#changed()
  }
  resetReviewSettings(listId: string | null): void {
    if (!this.nb?.review) return
    if (listId) delete this.nb.review.lists[listId]
    else delete this.nb.review.language
    this.nb.review.updatedAt = Date.now()
    this.#changed()
  }
  reschedule(listId: string | null, date: string, mode: 'due' | 'scheduled'): number {
    if (!this.nb) return 0
    const n = rescheduleReview(this.nb, listId, date, mode)
    this.#changed()
    return n
  }
  reviewCount(listId: string): number {
    if (!this.nb) return 0
    return buildReviewPlan(this.nb, listId, this.#fallback(), Date.now(), false).queue.length
  }
  startReview(listId: string | null = null): boolean {
    if (!this.nb) return false
    const plan = buildReviewPlan(this.nb, listId, this.#fallback())
    return this.#start('review', listId, plan.queue, plan)
  }

  /** 按词本过一遍：新词照常学，排了期还没到期的当抽查 */
  startDrill(listId: string, keys?: string[]): boolean {
    const list = this.nb && listOf(this.nb, listId)
    if (!list) return false
    const pool = keys ?? list.keys
    return this.#start(
      'drill',
      listId,
      this.reviewSettings(listId).order === 'random' ? shuffle(pool) : [...pool]
    )
  }

  #start(
    mode: Session['mode'],
    listId: string | null,
    queue: string[],
    plan?: ReturnType<typeof buildReviewPlan>
  ): boolean {
    if (!queue.length) {
      ui.toast(t('notebook.nothingToStudy'))
      return false
    }
    const resolved = plan ?? buildReviewPlan(this.nb!, listId, this.#fallback())
    this.session = {
      mode,
      listId,
      queue,
      i: 0,
      answered: null,
      right: 0,
      wrong: 0,
      undo: [],
      done: false,
      settings: resolved.settings,
      scopes: resolved.scopes,
      questionCounts: {},
      question: { question: null, fallback: false, unavailable: [] },
      questionPrepared: false,
      questionEpoch: 0
    }
    return true
  }

  /** 这一轮当前那张卡 */
  get card(): NoteCard | null {
    const s = this.session
    return s && this.nb && !s.done ? (this.nb.cards[s.queue[s.i]] ?? null) : null
  }
  get cardPlan(): ReviewSettings {
    return this.session && this.card
      ? (this.session.settings[this.card.key] ?? this.reviewSettings(this.session.listId))
      : this.reviewSettings()
  }
  prepareQuestion(data: ReviewData): void {
    const s = this.session
    const card = this.card
    if (!s || !card || !this.nb || s.questionPrepared) return
    const result = makeReviewQuestion(
      card,
      Object.values(this.nb.cards),
      this.cardPlan,
      data,
      s.questionCounts
    )
    this.session = { ...s, question: result, questionPrepared: true }
  }

  grade(q: Grade): void {
    const s = this.session
    const c = this.card
    if (!s || !c || !this.nb || s.answered !== null) return
    const now = Date.now()
    const k = dayKey(now)
    const scope = s.scopes[c.key] ?? 'language'
    const entry: UndoEntry = {
      pos: s.i,
      key: c.key,
      card: structuredClone(c),
      dayKey: k,
      day: this.nb.days[k] ? { ...this.nb.days[k] } : null,
      right: s.right,
      wrong: s.wrong,
      inserted: [],
      snapshot: reviewAnswerSnapshot(this.nb, c.key, scope, now),
      question: s.question,
      questionCounts: { ...s.questionCounts }
    }
    this.nb.reviewDays ??= {}
    this.nb.reviewDays[scope] ??= {}
    this.nb.reviewDays[scope][k] ??= {
      ...scopedToday(this.nb, scope.startsWith('list:') ? scope.slice(5) : null, now)
    }
    answer(this.nb, c.key, q, now, s.mode === 'drill', this.cardPlan, scope)
    const queue = [...s.queue]
    if (q === 0 && ui.prefs.relearn) {
      // 过几张（4–6 张）再来一次：马上再见一面，第一个间隔才记得住
      const at = Math.min(queue.length, s.i + 4 + Math.floor(Math.random() * 3))
      queue.splice(at, 0, c.key)
      entry.inserted.push(at)
    }
    this.session = {
      ...s,
      queue,
      answered: q,
      right: s.right + (q === 5 ? 1 : 0),
      wrong: s.wrong + (q === 0 ? 1 : 0),
      undo: [...s.undo, entry],
      questionCounts: {
        ...s.questionCounts,
        [s.question.question?.kind ?? 'flashcard']:
          (s.questionCounts[s.question.question?.kind ?? 'flashcard'] ?? 0) + 1
      }
    }
    this.#changed()
  }

  next(): void {
    const s = this.session
    if (!s || s.answered === null) return
    const i = s.i + 1
    this.session = {
      ...s,
      i,
      answered: null,
      done: i >= s.queue.length,
      questionPrepared: false,
      question: { question: null, fallback: false, unavailable: [] }
    }
  }

  /** 撤回上一次作答：回到那一张，排期、计数都退回去 */
  undo(): void {
    const s = this.session
    const e = s?.undo[s.undo.length - 1]
    if (!s || !e || !this.nb) return
    const queue = [...s.queue]
    for (let j = e.inserted.length - 1; j >= 0; j--) queue.splice(e.inserted[j], 1)
    restoreReviewAnswer(this.nb, e.snapshot)
    this.session = {
      ...s,
      queue,
      i: e.pos,
      answered: null,
      right: e.right,
      wrong: e.wrong,
      undo: s.undo.slice(0, -1),
      done: false,
      questionCounts: e.questionCounts,
      question: e.question,
      questionPrepared: true,
      questionEpoch: s.questionEpoch + 1
    }
    this.#changed()
  }

  exit(): void {
    this.session = null
    void this.flush().catch(() => {})
  }
}

export const notebook = new NotebookState()
