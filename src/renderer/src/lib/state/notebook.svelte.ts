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
  todayCounts,
  type CardInput,
  type CardStatus,
  type DayStat,
  type NoteCard,
  type Notebook
} from '$shared/notebook'
import { buildQueue, dayKey, shuffle, type Grade } from '$shared/srs'
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

  /** 今天要复习几个、还能学几个新词（首页、生词本页顶上） */
  counts = $derived(
    this.nb
      ? todayCounts(this.nb, { newPerDay: ui.prefs.newPerDay, reviewCap: ui.prefs.reviewCap })
      : { due: 0, fresh: 0 }
  )

  /** 读这门语言的生词本（已经读好的不再读） */
  load(packId: string | null): Promise<void> {
    if (packId === this.packId && (this.nb || this.#loading))
      return this.#loading ?? Promise.resolve()
    this.flush()
    this.packId = packId
    this.nb = null
    this.session = null
    this.view = { list: MINE, filter: 'all', showAll: false }
    if (!packId) return Promise.resolve()
    this.#loading = (async () => {
      const text = await platform.notebook.load(packId).catch(() => null)
      let raw: unknown = null
      try {
        raw = text ? JSON.parse(text) : null
      } catch {
        raw = null
      }
      if (this.packId === packId) this.nb = raw ? normalizeNotebook(raw) : emptyNotebook()
    })().finally(() => (this.#loading = null))
    return this.#loading
  }

  /** 改过了：界面跟着变，过一会儿存盘（连着改只存一次） */
  #changed(): void {
    if (!this.nb) return
    this.nb = { ...this.nb }
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => this.flush(), SAVE_DELAY)
  }

  flush(): void {
    clearTimeout(this.#timer)
    this.#timer = undefined
    if (this.nb && this.packId)
      void platform.notebook
        .save(this.packId, JSON.stringify(this.nb))
        .catch((e) => ui.toast(String(e), 'error', 8000))
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

  startReview(): boolean {
    if (!this.nb) return false
    const d = this.nb.days[dayKey()]
    const queue = buildQueue(Object.values(this.nb.cards), {
      newPerDay: ui.prefs.newPerDay,
      reviewCap: ui.prefs.reviewCap,
      order: ui.prefs.studyOrder,
      learnedToday: d?.learned ?? 0
    })
    return this.#start('review', null, queue)
  }

  /** 按词本过一遍：新词照常学，排了期还没到期的当抽查 */
  startDrill(listId: string, keys?: string[]): boolean {
    const list = this.nb && listOf(this.nb, listId)
    if (!list) return false
    const pool = keys ?? list.keys
    return this.#start(
      'drill',
      listId,
      ui.prefs.studyOrder === 'random' ? shuffle(pool) : [...pool]
    )
  }

  #start(mode: Session['mode'], listId: string | null, queue: string[]): boolean {
    if (!queue.length) {
      ui.toast(t('notebook.nothingToStudy'))
      return false
    }
    this.session = {
      mode,
      listId,
      queue,
      i: 0,
      answered: null,
      right: 0,
      wrong: 0,
      undo: [],
      done: false
    }
    return true
  }

  /** 这一轮当前那张卡 */
  get card(): NoteCard | null {
    const s = this.session
    return s && this.nb && !s.done ? (this.nb.cards[s.queue[s.i]] ?? null) : null
  }

  grade(q: Grade): void {
    const s = this.session
    const c = this.card
    if (!s || !c || !this.nb || s.answered !== null) return
    const now = Date.now()
    const k = dayKey(now)
    const entry: UndoEntry = {
      pos: s.i,
      key: c.key,
      card: structuredClone(c),
      dayKey: k,
      day: this.nb.days[k] ? { ...this.nb.days[k] } : null,
      right: s.right,
      wrong: s.wrong,
      inserted: []
    }
    answer(this.nb, c.key, q, now, s.mode === 'drill')
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
      undo: [...s.undo, entry]
    }
    this.#changed()
  }

  next(): void {
    const s = this.session
    if (!s || s.answered === null) return
    const i = s.i + 1
    this.session = { ...s, i, answered: null, done: i >= s.queue.length }
  }

  /** 撤回上一次作答：回到那一张，排期、计数都退回去 */
  undo(): void {
    const s = this.session
    const e = s?.undo[s.undo.length - 1]
    if (!s || !e || !this.nb) return
    const queue = [...s.queue]
    for (let j = e.inserted.length - 1; j >= 0; j--) queue.splice(e.inserted[j], 1)
    this.nb.cards[e.key] = e.card
    if (e.day) this.nb.days[e.dayKey] = e.day
    else delete this.nb.days[e.dayKey]
    this.session = {
      ...s,
      queue,
      i: e.pos,
      answered: null,
      right: e.right,
      wrong: e.wrong,
      undo: s.undo.slice(0, -1),
      done: false
    }
    this.#changed()
  }

  exit(): void {
    this.session = null
    this.flush()
  }
}

export const notebook = new NotebookState()
