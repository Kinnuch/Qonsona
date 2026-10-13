/**
 * 练习与模拟考的状态：选的等级与题量，正在做的一组练习 / 一张模拟卷，做完的成绩与回看，
 * 以及练习记录（每天做了几题、做过的卷子；存在主进程，改了过一会儿自动存）。
 * 日语的题向主进程要（按词典出，src/main/exam.ts），千语集语言的在这边按项目数据出（lib/practice/qonlang.ts）。
 *
 * 模拟卷一节一节做：每节限时，时间到了自动进下一节；一节里可以前后翻、改答案，进了下一节就不能回头。
 * 交卷后判分（JLPT 的换算办法，仅供参考），整张卷子连同答案存进记录，随时回看解析。
 */
import { platform } from '$lib/platform'
import { serializedWrites } from './persistence'
import { activity } from './activity.svelte'
import { companion } from './companion.svelte'
import { StudyRequestGate, type StudyRequest } from '$shared/study-request'
import { t, pick } from '$lib/i18n/index.svelte'
import { shuffled, rng } from '$shared/course'
import { mixedPracticeKinds } from '$shared/question-semantics'
import {
  countDay,
  emptyPracticeLog,
  normalizePracticeLog,
  scorePaper,
  type ExamPaper,
  type ExamQuestion,
  type ExamRecord,
  type PaperAnswers,
  type PracticeKind,
  type PracticeLog
} from '$shared/exam'
import { PAPER_LEVELS, jaPracticeKinds } from '$shared/ja/exam'
import { dayKey } from '$shared/srs'
import { firstGloss } from '$lib/packs/qonlang/lexicon'
import { qonPractice, qonPracticeKinds, type QonPracticeInput } from '$lib/practice/qonlang'
import type { Level } from '$lib/packs/types'
import { packs } from './packs.svelte'
import { audio } from './audio.svelte'
import { ui } from './ui.svelte'
import { courses } from './courses.svelte'
import { langModule } from '$shared/lang/registry'
import { i18n } from '$lib/i18n/index.svelte'

const SAVE_DELAY = 400

/** 一组练习有几道题 */
export const COUNTS = [10, 20, 30]

/** 综合练习：每种题都出一些，打乱；本文练习：用一篇文章出题；custom:<id> 是框架语言特有的题型 */
export type RunKind = PracticeKind | 'mixed' | 'article' | `custom:${string}`

export type PracticeView =
  | { page: 'home' }
  | { page: 'run' }
  /** 回看一张做过的卷子 */
  | { page: 'record'; id: string }

export interface PracticeRun {
  packId: string
  mode: 'practice'
  kind: RunKind
  /** 等级 id（N5、L1）；千语集语言选「全部」时是 null */
  level: string | null
  /** 本文练习：哪一篇文章，从哪里来的（回去时阅读器的「返回」照旧），故事课的哪一课 */
  article?: ArticleRef
  questions: ExamQuestion[]
  i: number
  /** 这一题选了第几项（在看解析）；还没答是 null */
  given: number | null
  answers: (number | null)[]
  done: boolean
}

export interface ExamRun {
  packId: string
  mode: 'exam'
  paper: ExamPaper
  /** 正在做第几节、这一节的第几题 */
  section: number
  i: number
  answers: PaperAnswers
  startedAt: number
  /** 这一节几点结束（毫秒时间戳） */
  deadline: number
}

export interface ArticleRef {
  id: string
  title: string
  from?: 'home' | 'course' | null
  /** 故事课的一课：做完记进课程进度 */
  course?: string
  lesson?: string
}

class PracticeState {
  packId = $state<string | null>(null)
  log = $state.raw<PracticeLog | null>(null)
  view = $state<PracticeView>({ page: 'home' })
  /** 练习页上选的等级（N5、L1；null 是全部）与一组几道题 */
  level = $state<string | null>(null)
  count = $state(10)
  run = $state.raw<PracticeRun | ExamRun | null>(null)
  /** 正在向主进程要题 */
  busy = $state(false)
  #timer: ReturnType<typeof setTimeout> | undefined
  #loading: Promise<void> | null = null
  #loadEpoch = 0
  #starts = new StudyRequestGate()

  /** 这门语言的等级（日语 N5–N1，千语集语言是按词频分的级） */
  levels = $derived.by<Level[]>(() => {
    const pack = packs.active
    if (!pack) return []
    if (pack.kind === 'qonlang') return packs.levels?.system.levels ?? []
    return pack.levels?.levels ?? []
  })

  /** 日语：按 JLPT 等级出（必须选一级）；千语集语言可以选「全部」 */
  isJa = $derived(packs.active?.kind === 'builtin' && packs.active.id === 'ja')

  /** 框架里的语言（英、法、韩……）：模块与数据够出的通用题型（读练习记录时问一次） */
  fw = $derived(packs.active ? langModule(packs.active.id) : null)
  langKinds = $state.raw<PracticeKind[]>([])

  /** 这一级能出的题 */
  kinds = $derived.by<Exclude<RunKind, 'mixed' | 'article'>[]>(() => {
    if (this.isJa) return jaPracticeKinds(this.#jaLevel(this.level))
    if (this.fw)
      return [...this.langKinds, ...(this.fw.practice ?? []).map((k) => `custom:${k.id}` as const)]
    const x = this.#qonInput()
    return x ? qonPracticeKinds(x) : []
  })

  /** 能不能放听力题（有这门语言的语音或者 IPA 能读） */
  canListen = $derived(
    this.isJa
      ? audio.canSay({ text: 'あ', lang: 'ja-JP' })
      : this.fw
        ? !!this.fw.spec.features.speech &&
          audio.canSay({ text: 'a', lang: this.fw.spec.features.speech })
        : audio.canSay({ ipa: 'a' })
  )

  /** 能做模拟卷的等级（日语的 N5–N1） */
  paperLevels = $derived(
    this.isJa && packs.active?.features.exam ? PAPER_LEVELS.map((n) => `N${n}`) : []
  )
  /** 框架语言的模拟卷（LangModule.exams） */
  langPapers = $derived(this.fw && packs.active?.features.exam ? (this.fw.exams ?? []) : [])

  #jaLevel(id: string | null): number {
    const n = Number(id?.replace(/^N/, ''))
    return n >= 1 && n <= 5 ? n : 5
  }

  #qonInput(): QonPracticeInput | null {
    const pack = packs.active
    const project = packs.project
    const lang = project?.languages.find((l) => l.id === pack?.source?.languageId)
    if (!pack || !project || !lang) return null
    return {
      project,
      lang,
      bcp47: pack.bcp47,
      hidden: packs.hidden,
      levels: packs.levels,
      level: this.level,
      gloss: (l) => firstGloss(l, pick),
      pick
    }
  }

  /** 读这门语言的练习记录（已经读好的不再读） */
  load(packId: string | null): Promise<void> {
    if (packId === this.packId && (this.log || this.#loading))
      return this.#loading ?? Promise.resolve()
    const saved = this.flush()
    const epoch = ++this.#loadEpoch
    this.#starts.cancel()
    this.busy = false
    this.packId = packId
    this.log = null
    this.run = null
    this.view = { page: 'home' }
    // 日语默认 N5；千语集与框架语言默认「全部」
    this.level = packId === 'ja' ? 'N5' : null
    this.langKinds = []
    if (!packId) {
      this.#loading = null
      return saved
    }
    this.#loading = (async () => {
      await saved
      await serializedWrites.wait(`practice:${packId}`)
      if (epoch !== this.#loadEpoch) return
      if (langModule(packId))
        platform.lang
          .practiceKinds(packId)
          .then((k) => {
            if (epoch === this.#loadEpoch) this.langKinds = k
          })
          .catch(() => {})
      const text = await platform.practice.load(packId).catch(() => null)
      let raw: unknown = null
      try {
        raw = text ? JSON.parse(text) : null
      } catch {
        raw = null
      }
      if (epoch === this.#loadEpoch) this.log = raw ? normalizePracticeLog(raw) : emptyPracticeLog()
    })().finally(() => {
      if (epoch === this.#loadEpoch) this.#loading = null
    })
    return this.#loading
  }

  #changed(): void {
    if (!this.log) return
    this.log = { ...this.log }
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => {
      void this.flush().catch(() => {})
    }, SAVE_DELAY)
  }

  flush(): Promise<void> {
    clearTimeout(this.#timer)
    this.#timer = undefined
    if (!this.log || !this.packId) return Promise.resolve()
    const packId = this.packId
    const content = JSON.stringify(this.log)
    return serializedWrites
      .enqueue(`practice:${packId}`, () => platform.practice.save(packId, content))
      .catch((e) => {
        ui.toast(String(e), 'error', 8000)
        throw e
      })
  }

  // ── 出题 ──

  async #questions(
    kind: Exclude<RunKind, 'mixed' | 'article'>,
    n: number,
    seed: number
  ): Promise<ExamQuestion[]> {
    if (this.fw && this.packId) {
      const custom = kind.startsWith('custom:') ? kind.slice(7) : undefined
      return platform.lang
        .practice(this.packId, custom ? 'custom' : kind, this.level, n, seed, i18n.locale, custom)
        .catch(() => [])
    }
    if (kind.startsWith('custom:')) return []
    if (this.isJa)
      return platform.ja
        .practice(kind as PracticeKind, this.#jaLevel(this.level), n, seed)
        .catch(() => [])
    const x = this.#qonInput()
    return x ? qonPractice(x, kind as PracticeKind, n, seed) : []
  }

  #acceptStart(request: StudyRequest): boolean {
    return (
      request.packId === packs.active?.id &&
      this.#starts.accepts(request, this.packId, this.#loadEpoch)
    )
  }

  /** 开始一组练习（本文练习另走 startArticle） */
  async start(kind: Exclude<RunKind, 'article'>): Promise<void> {
    if (this.busy || !this.packId || this.packId !== packs.active?.id || !this.log) return
    const request = this.#starts.begin(this.packId, this.#loadEpoch),
      level = this.level
    this.busy = true
    try {
      const n = this.count
      const seed = Date.now() >>> 0
      let questions: ExamQuestion[]
      if (kind === 'mixed') {
        // 综合练习侧重实际理解和表达；规则辨析留在用户明确选择的专门练习里。
        const kinds = mixedPracticeKinds(this.kinds, this.canListen)
        const each = Math.ceil(n / Math.max(kinds.length, 1))
        const parts = await Promise.all(kinds.map((k, i) => this.#questions(k, each, seed + i)))
        questions = shuffled(parts.flat(), rng(seed)).slice(0, n)
      } else questions = await this.#questions(kind, n, seed)
      if (!this.#acceptStart(request) || ui.closing) return
      if (!questions.length) {
        ui.toast(t('practice.empty'))
        return
      }
      this.run = {
        packId: request.packId!,
        mode: 'practice',
        kind,
        level,
        questions,
        i: 0,
        given: null,
        answers: [],
        done: false
      }
      this.view = { page: 'run' }
    } finally {
      if (this.#acceptStart(request)) this.busy = false
    }
  }

  /** 练习：选了一项，马上看对错与解析 */
  answer(choice: number): void {
    const run = this.run
    if (
      run?.mode !== 'practice' ||
      run.done ||
      run.given !== null ||
      run.packId !== this.packId ||
      run.packId !== packs.active?.id
    )
      return
    const q = run.questions[run.i]
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.choices.length) return
    this.run = { ...run, given: choice, answers: [...run.answers, choice] }
    if (choice === q.answer) companion.correct(run.packId, companion.answerId(run.questions, run.i))
    if (this.log) {
      countDay(this.log, dayKey(), 1, choice === q.answer ? 1 : 0)
      this.#changed()
    }
  }

  next(): void {
    const run = this.run
    if (
      run?.mode !== 'practice' ||
      run.given === null ||
      run.packId !== this.packId ||
      run.packId !== packs.active?.id
    )
      return
    const i = run.i + 1
    const done = i >= run.questions.length
    this.run = { ...run, i, given: null, done }
    if (done && run.answers.length)
      activity.complete(
        'practice',
        run.article?.id ?? `${run.kind}/${run.level ?? 'all'}`,
        run.packId
      )
    // 故事课的本文练习：做完记进课程进度（答对八成过关）
    const a = run.article
    if (done && a?.course && a.lesson) {
      const right = run.answers.filter((x, k) => x === run.questions[k].answer).length
      courses.textDone(a.course, a.lesson, right / Math.max(1, run.questions.length))
    }
  }

  /** 同一种题再来一组（本文练习换一组题） */
  async again(): Promise<void> {
    const run = this.run
    if (run?.mode !== 'practice') return
    if (run.article || run.kind === 'article') {
      if (run.article) await this.startArticle(run.article.id, run.article.title, run.article)
      return
    }
    this.level = run.level
    await this.start(run.kind)
  }

  /** 本文练习：用这篇文章的词、语法、句子出一组题，在练习页上做 */
  async startArticle(
    id: string,
    title: string,
    ctx: Omit<ArticleRef, 'id' | 'title'> = {}
  ): Promise<boolean> {
    const pack = packs.active?.id ?? null
    if (this.busy || !pack || !(this.isJa || this.fw)) return false
    const loading = this.load(pack)
    const request = this.#starts.begin(pack, this.#loadEpoch)
    this.busy = true
    try {
      await loading
      if (!this.#acceptStart(request) || ui.closing) return false
      const questions = await (
        this.fw
          ? platform.lang.articlePractice(pack, id, Date.now() >>> 0, i18n.locale)
          : platform.ja.articlePractice(id, Date.now() >>> 0, this.canListen)
      ).catch(() => [])
      if (!this.#acceptStart(request) || ui.closing) return false
      if (!questions.length) {
        ui.toast(t('practice.articleEmpty'))
        return false
      }
      this.run = {
        packId: pack,
        mode: 'practice',
        kind: 'article',
        level: null,
        article: { ...ctx, id, title },
        questions,
        i: 0,
        given: null,
        answers: [],
        done: false
      }
      this.view = { page: 'run' }
      return true
    } finally {
      if (this.#acceptStart(request)) this.busy = false
    }
  }

  // ── 模拟卷 ──

  async startExam(level: string): Promise<void> {
    if (
      this.busy ||
      !this.packId ||
      this.packId !== packs.active?.id ||
      !this.log ||
      !(this.isJa || this.fw)
    )
      return
    const request = this.#starts.begin(this.packId, this.#loadEpoch)
    this.busy = true
    try {
      // 框架语言：level 是模拟卷的 id
      const paper =
        this.fw && this.packId
          ? await platform.lang
              .paper(this.packId, level, Date.now() >>> 0, i18n.locale)
              .catch(() => null)
          : await platform.ja.paper(this.#jaLevel(level), Date.now() >>> 0).catch(() => null)
      if (!this.#acceptStart(request) || ui.closing) return
      if (!paper || !paper.sections.length || paper.sections.some((s) => !s.questions.length)) {
        ui.toast(
          t('practice.exam.unavailable', { lang: packs.active ? pick(packs.active.name) : '' }),
          'error',
          6000
        )
        return
      }
      const now = Date.now()
      this.run = {
        packId: request.packId!,
        mode: 'exam',
        paper,
        section: 0,
        i: 0,
        answers: paper.sections.map((s) => s.questions.map(() => null)),
        startedAt: now,
        deadline: now + paper.sections[0].minutes * 60_000
      }
      this.view = { page: 'run' }
    } finally {
      if (this.#acceptStart(request)) this.busy = false
    }
  }

  /** 模拟卷：选一项（这一节结束前可以改） */
  choose(choice: number): void {
    const run = this.run
    if (run?.mode !== 'exam' || run.packId !== this.packId || run.packId !== packs.active?.id)
      return
    const answers = run.answers.map((a) => [...a])
    answers[run.section][run.i] = choice
    this.run = { ...run, answers }
  }

  /** 翻到这一节的第 i 题 */
  goto(i: number): void {
    const run = this.run
    if (run?.mode !== 'exam' || run.packId !== this.packId || run.packId !== packs.active?.id)
      return
    const n = run.paper.sections[run.section].questions.length
    if (i >= 0 && i < n) this.run = { ...run, i }
  }

  /** 这一节做完（或时间到了）：进下一节；最后一节交卷 */
  endSection(): void {
    if (ui.closing) return
    const run = this.run
    if (run?.mode !== 'exam' || run.packId !== this.packId || run.packId !== packs.active?.id)
      return
    const next = run.section + 1
    if (next >= run.paper.sections.length) return this.submit()
    this.run = {
      ...run,
      section: next,
      i: 0,
      deadline: Date.now() + run.paper.sections[next].minutes * 60_000
    }
  }

  /** 交卷：判分，整张卷子连同答案存进记录，然后看成绩与解析 */
  submit(): void {
    const run = this.run
    if (
      run?.mode !== 'exam' ||
      !this.log ||
      run.packId !== this.packId ||
      run.packId !== packs.active?.id
    )
      return
    const outcome = scorePaper(run.paper, run.answers)
    for (const [sectionIndex, section] of run.paper.sections.entries()) {
      for (const [questionIndex, question] of section.questions.entries()) {
        if (run.answers[sectionIndex]?.[questionIndex] === question.answer)
          companion.correct(run.packId, companion.answerId(section.questions, questionIndex))
      }
    }
    const now = Date.now()
    const record: ExamRecord = {
      id: String(now),
      level: run.paper.level,
      at: now,
      seconds: Math.round((now - run.startedAt) / 1000),
      paper: run.paper,
      answers: run.answers,
      outcome
    }
    if (run.answers.some((section) => section.some((answer) => answer !== null)))
      activity.complete('practice', `exam/${record.id}`, run.packId)
    this.log.exams = [...this.log.exams, record]
    countDay(this.log, dayKey(now), outcome.total, outcome.right)
    this.#changed()
    this.run = null
    this.view = { page: 'record', id: record.id }
  }

  record(id: string): ExamRecord | null {
    return this.log?.exams.find((e) => e.id === id) ?? null
  }

  openRecord(id: string): void {
    this.#starts.cancel()
    this.busy = false
    this.view = { page: 'record', id }
  }

  removeRecord(id: string): void {
    if (!this.log) return
    this.log.exams = this.log.exams.filter((e) => e.id !== id)
    this.#changed()
    if (this.view.page === 'record' && this.view.id === id) this.home()
  }

  /** 结束（练习中途退出不留成绩，已经答的题照样计入每天的题数） */
  home(): void {
    this.#starts.cancel()
    this.busy = false
    this.run = null
    this.view = { page: 'home' }
  }
}

export const practice = new PracticeState()
