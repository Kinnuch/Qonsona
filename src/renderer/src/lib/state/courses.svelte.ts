/**
 * 课程的状态：正在学的那门语言有哪几门课（日语的五十音、语法、变形、会话、惯用语、民间故事；
 * 千语集语言的字母、文档、变形、会话），
 * 学习进度（存在主进程，改了过一会儿自动存），课程页上看到哪一步，以及正在做的一轮练习。
 * 页面上走到哪一步（哪门课、哪一课、认到第几个字）离开再回来还在；换语言时回到课程列表。
 */
import { langModule } from '$shared/lang/registry'
import { platform } from '$lib/platform'
import { serializedWrites } from './persistence'
import { t, pick, i18n } from '$lib/i18n/index.svelte'
import {
  emptyProgress,
  findLesson,
  isRight,
  lessonQuiz,
  markLearned,
  normalizeProgress,
  poolUpTo,
  questionKeys,
  recordLesson,
  recordPractice,
  recordTest,
  recordText,
  testQuiz,
  unitItems,
  weakItems,
  type Answered,
  type Course,
  type CourseLesson,
  type CourseProgress,
  type Question,
  type SpellWord
} from '$shared/course'
import { kanaCourse } from '$shared/ja/kana-course'
import { jaGrammarCourse, type GrammarExampleData } from '$shared/ja/grammar-course'
import { jaFormsCourse } from '$shared/ja/forms-course'
import { jaPhrasesCourse } from '$shared/ja/phrases-course'
import { jaStoriesCourse } from '$shared/ja/stories-course'
import { jaIdiomsCourse } from '$shared/ja/idioms-course'
import { kanaToRomaji } from '$shared/ja/kana'
import type { ConjugableWord, KanaWord } from '$shared/dict'
import { courseSections } from '$lib/packs/modules'
import {
  qonAlphabetCourse,
  qonDocsCourse,
  qonFormsCourse,
  qonPhrasesCourse,
  qonSpellWords,
  qonStartWords
} from '$lib/courses/qonlang'
import { firstGloss } from '$lib/packs/qonlang/lexicon'
import { packs } from './packs.svelte'
import { audio } from './audio.svelte'
import { ui } from './ui.svelte'

const SAVE_DELAY = 400

/** 课程页上看到哪一步 */
export type CourseView =
  | { page: 'home' }
  | { page: 'course'; course: string }
  | { page: 'lesson'; course: string; lesson: string; step: number }
  | { page: 'quiz' }

export interface QuizRun {
  kind: 'lesson' | 'test' | 'practice'
  course: string
  /** 课 id / 单元 id；练薄弱项是空串 */
  target: string
  questions: Question[]
  i: number
  /** 这一题答了什么（在看对错）；还没答是 null */
  given: string | null
  answers: (Answered & { given: string; q: number })[]
  done: boolean
  result: { score: number; passed: boolean } | null
}

const kanaWord = (w: KanaWord): SpellWord => ({
  text: w.text,
  reading: kanaToRomaji(w.text),
  meaning: { zh: w.zh, en: w.en },
  say: { text: w.text, lang: 'ja-JP' },
  ...(w.head !== w.text && { head: w.head })
})

class CoursesState {
  packId = $state<string | null>(null)
  progress = $state.raw<CourseProgress | null>(null)
  view = $state<CourseView>({ page: 'home' })
  quiz = $state.raw<QuizRun | null>(null)
  /** 日语语法课的 Tatoeba 例句（第一次用时向主进程要） */
  grammarData = $state.raw<GrammarExampleData | null>(null)
  /** 日语变形课用的 N5 / N4 动词、形容词（第一次用时向主进程要） */
  conjugables = $state.raw<ConjugableWord[] | null>(null)
  #timer: ReturnType<typeof setTimeout> | undefined
  #loading: Promise<void> | null = null
  #loadEpoch = 0

  /** 正在学的这门语言有的课（学习包没有的块不出；没有内容的课不出） */
  list = $derived.by<Course[]>(() => {
    const pack = packs.active
    if (!pack) return []
    const sections = courseSections(pack.features)
    const out: Course[] = []
    if (pack.kind === 'builtin' && pack.id === 'ja') {
      if (sections.includes('alphabet')) out.push(kanaCourse())
      if (sections.includes('grammar')) out.push(jaGrammarCourse(this.grammarData))
      if (sections.includes('inflection') && this.conjugables)
        out.push(jaFormsCourse(this.conjugables))
      if (sections.includes('phrasebook')) out.push(jaPhrasesCourse())
      if (sections.includes('idioms')) out.push(jaIdiomsCourse())
      if (sections.includes('stories')) out.push(jaStoriesCourse())
    } else if (langModule(pack.id)) {
      // 框架里的语言：课程由这门语言自己给（src/shared/lang/<代码>/），按能力开关取舍
      const want: Record<string, boolean> = {
        alphabet: sections.includes('alphabet'),
        grammar: sections.includes('grammar'),
        inflection: sections.includes('inflection'),
        phrasebook: sections.includes('phrasebook'),
        idioms: sections.includes('idioms'),
        stories: sections.includes('stories')
      }
      for (const c of langModule(pack.id)?.courses?.(i18n.locale) ?? []) if (want[c.id]) out.push(c)
    } else if (pack.kind === 'qonlang') {
      const project = packs.project
      const lang = project?.languages.find((l) => l.id === pack.source?.languageId)
      if (project && lang) {
        const labels = {
          alphabet: t(`kinds.alphabet.${pack.features.alphabet ?? 'phonemes'}`),
          alphabetIntro: t('courses.qon.alphabetIntro'),
          letters: t('courses.qon.letters'),
          lettersNote: t('courses.qon.lettersNote'),
          script: (name: string) => name,
          scriptNote: t('courses.qon.scriptNote'),
          docs: t('modules.courses.sections.grammar'),
          docsIntro: t('courses.qon.docsIntro'),
          docsUnit: t('courses.qon.docsUnit'),
          forms: t('modules.courses.sections.inflection'),
          formsIntro: t('courses.qon.formsIntro'),
          phrases: t('modules.courses.sections.phrasebook'),
          phrasesIntro: t('courses.qon.phrasesIntro'),
          phrasesUnit: t('courses.qon.phrasesUnit'),
          uncategorized: t('courses.qon.uncategorized')
        }
        const gloss = (l: Parameters<typeof firstGloss>[0]): string => firstGloss(l, pick)
        if (sections.includes('alphabet')) out.push(qonAlphabetCourse(project, lang, labels))
        if (sections.includes('grammar'))
          out.push(qonDocsCourse(project, lang, packs.hidden, labels))
        if (sections.includes('inflection'))
          out.push(qonFormsCourse(project, lang, packs.hidden, labels, { gloss, pick }))
        if (sections.includes('phrasebook'))
          out.push(qonPhrasesCourse(project, lang, packs.hidden, labels, { pick }))
      }
    }
    return out.filter((c) => c.units.length)
  })

  course(id: string): Course | null {
    return this.list.find((c) => c.id === id) ?? null
  }

  /** 读这门语言的进度（已经读好的不再读）；日语顺带要语法课的例句、变形课的词 */
  load(packId: string | null): Promise<void> {
    if (packId === this.packId && (this.progress || this.#loading))
      return this.#loading ?? Promise.resolve()
    const saved = this.flush()
    const epoch = ++this.#loadEpoch
    this.packId = packId
    this.progress = null
    this.view = { page: 'home' }
    this.quiz = null
    if (!packId) {
      this.#loading = null
      return saved
    }
    this.#loading = (async () => {
      await saved
      await serializedWrites.wait(`courses:${packId}`)
      if (epoch !== this.#loadEpoch) return
      const [text, data, words] = await Promise.all([
        platform.course.load(packId).catch(() => null),
        packId === 'ja' && !this.grammarData
          ? platform.ja.grammarExamples().catch(() => null)
          : Promise.resolve(this.grammarData),
        packId === 'ja' && !this.conjugables
          ? platform.ja.conjugables([5, 4]).catch(() => null)
          : Promise.resolve(this.conjugables)
      ])
      let raw: unknown = null
      try {
        raw = text ? JSON.parse(text) : null
      } catch {
        raw = null
      }
      if (epoch !== this.#loadEpoch) return
      this.grammarData = data
      this.conjugables = words
      this.progress = raw ? normalizeProgress(raw) : emptyProgress()
    })().finally(() => {
      if (epoch === this.#loadEpoch) this.#loading = null
    })
    return this.#loading
  }

  /** 改过了：界面跟着变，过一会儿存盘（连着改只存一次） */
  #changed(): void {
    if (!this.progress) return
    this.progress = { ...this.progress }
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => {
      void this.flush().catch(() => {})
    }, SAVE_DELAY)
  }

  flush(): Promise<void> {
    clearTimeout(this.#timer)
    this.#timer = undefined
    if (!this.progress || !this.packId) return Promise.resolve()
    const packId = this.packId
    const content = JSON.stringify(this.progress)
    return serializedWrites
      .enqueue(`courses:${packId}`, () => platform.course.save(packId, content))
      .catch((e) => {
        ui.toast(String(e), 'error', 8000)
        throw e
      })
  }

  // ── 走到哪一步 ──

  open(course: string): void {
    this.view = { page: 'course', course }
  }

  openLesson(course: string, lesson: string): void {
    this.view = { page: 'lesson', course, lesson, step: 0 }
  }

  home(): void {
    this.view = { page: 'home' }
  }

  /** 认字 / 讲解看完了（文档课读完就算过关） */
  learned(courseId: string, lessonId: string): void {
    const c = this.course(courseId)
    if (!c || !this.progress) return
    markLearned(this.progress, c, lessonId)
    this.#changed()
  }

  /** 故事课：这一篇的本文练习做完了（score 是答对的比例）；读完直接点「学完了」时 score 给 1 */
  textDone(courseId: string, lessonId: string, score: number): void {
    const c = this.course(courseId)
    if (!c || !this.progress) return
    recordText(this.progress, c, lessonId, score)
    this.#changed()
  }

  // ── 例词 ──

  /** 认字时每个字的例词 */
  async startWords(course: Course, key: string): Promise<SpellWord[]> {
    const item = course.symbols[key]
    if (!item || item.learnOnly) return []
    const fw = packs.active ? langModule(packs.active.id) : null
    if (fw) {
      // 这门课各课给的词里，含这个字的前三个
      const has = fw.hasSymbol ?? ((w: string, s: string) => w.includes(s))
      const pool = [
        ...new Set(course.units.flatMap((u) => u.lessons.flatMap((l) => l.words ?? [])))
      ]
      return this.#langSpell(fw.spec.code, pool.filter((w) => has(w, item.symbol)).slice(0, 3))
    }
    if (packs.active?.id === 'ja') {
      const words = await platform.ja.kanaStartWords(item.symbol, 3).catch(() => [])
      return words.map(kanaWord)
    }
    const { project, lang } = this.#qon()
    if (!project || !lang) return []
    return qonStartWords(project, lang, course, key, {
      gloss: (l) => firstGloss(l, pick),
      hidden: packs.hidden
    })
  }

  /** 拼读用的词：这一课给了词就用那些，否则按到这一课为止学过的字去挑 */
  async spellWords(
    course: Course,
    lesson: CourseLesson,
    must = lesson.items
  ): Promise<SpellWord[]> {
    if (course.kind !== 'symbols') return []
    const allowed = poolUpTo(course, lesson.id)
    const fw = packs.active ? langModule(packs.active.id) : null
    if (fw) return this.#langSpell(fw.spec.code, lesson.words ?? [])
    if (packs.active?.id === 'ja') {
      const words = lesson.words?.length
        ? await platform.ja.kanaLookup(lesson.words).catch(() => [])
        : await platform.ja
            .kanaSpellWords(
              allowed.map((k) => course.symbols[k]?.symbol ?? k),
              must.map((k) => course.symbols[k]?.symbol ?? k),
              8
            )
            .catch(() => [])
      return words.map(kanaWord)
    }
    const { project, lang } = this.#qon()
    if (!project || !lang) return []
    return qonSpellWords(project, lang, course, allowed, must, {
      gloss: (l) => firstGloss(l, pick),
      hidden: packs.hidden
    })
  }

  /** 框架语言：按词头取拼读词（读法、释义、朗读） */
  async #langSpell(code: string, words: string[]): Promise<SpellWord[]> {
    if (!words.length) return []
    const speech = langModule(code)?.spec.features.speech
    const got = await platform.lang.spell(code, words).catch(() => [])
    return got.map((w) => ({
      text: w.text,
      reading: w.reading,
      meaning: { zh: w.zh || w.en, en: w.en || w.zh },
      say: speech ? { text: w.text, lang: speech, key: `lex-${w.entry}` } : null
    }))
  }

  #qon(): {
    project: typeof packs.project
    lang: NonNullable<typeof packs.project>['languages'][number] | null
  } {
    const project = packs.project
    const lang = project?.languages.find((l) => l.id === packs.active?.source?.languageId) ?? null
    return { project, lang }
  }

  /** 能不能出听音题：这门课的字、短语能读出声 */
  #canListen(course: Course): boolean {
    const first = [...Object.values(course.symbols), ...Object.values(course.phrases ?? {})].find(
      (s) => s.say
    )
    return !!first?.say && audio.canSay(first.say)
  }

  // ── 一轮练习 ──

  async startLesson(courseId: string, lessonId: string): Promise<void> {
    const c = this.course(courseId)
    const ref = c && findLesson(c, lessonId)
    if (!c || !ref) return
    const questions = lessonQuiz(c, ref.lesson, poolUpTo(c, lessonId), {
      seed: Date.now() >>> 0,
      words: await this.spellWords(c, ref.lesson),
      listen: this.#canListen(c)
    })
    this.#run('lesson', c, lessonId, questions)
  }

  async startTest(courseId: string, unitId: string): Promise<void> {
    const c = this.course(courseId)
    const unit = c?.units.find((u) => u.id === unitId)
    if (!c || !unit) return
    const last = unit.lessons[unit.lessons.length - 1]
    const keys = unitItems(unit)
    const questions = testQuiz(c, keys, poolUpTo(c, last.id), {
      seed: Date.now() >>> 0,
      words: await this.spellWords(c, last, keys),
      listen: this.#canListen(c)
    })
    this.#run('test', c, unitId, questions)
  }

  /** 练薄弱项：答错最多的几个，每个考两三道；成绩不计入课程 */
  async startPractice(courseId: string): Promise<void> {
    const c = this.course(courseId)
    if (!c || !this.progress) return
    const keys = weakItems(c, this.progress, 8)
    if (!keys.length) return
    const lesson: CourseLesson = { id: '', title: '', items: keys }
    const pool = Object.keys(
      c.kind === 'grammar' ? c.grammar : c.kind === 'phrases' ? (c.phrases ?? {}) : c.symbols
    )
    const questions = lessonQuiz(c, lesson, pool, {
      seed: Date.now() >>> 0,
      listen: this.#canListen(c)
    })
    this.#run('practice', c, '', questions)
  }

  #run(kind: QuizRun['kind'], c: Course, target: string, questions: Question[]): void {
    if (!questions.length) {
      // 没有题可出（拼读词一个都没找到的特殊课）：这一课直接算学完
      if (kind === 'lesson' && this.progress) {
        recordLesson(this.progress, c, target, [])
        this.#changed()
        ui.toast(t('courses.quiz.empty'))
      }
      return
    }
    this.quiz = {
      kind,
      course: c.id,
      target,
      questions,
      i: 0,
      given: null,
      answers: [],
      done: false,
      result: null
    }
    this.view = { page: 'quiz' }
  }

  get question(): Question | null {
    const q = this.quiz
    return q && !q.done ? (q.questions[q.i] ?? null) : null
  }

  answer(given: string): void {
    const run = this.quiz
    const q = this.question
    const c = run && this.course(run.course)
    if (!run || !q || !c || run.given !== null) return
    const right = isRight(c, q, given)
    this.quiz = {
      ...run,
      given,
      answers: [...run.answers, { keys: questionKeys(q), right, given, q: run.i }]
    }
  }

  next(): void {
    const run = this.quiz
    if (!run || run.given === null) return
    const i = run.i + 1
    if (i < run.questions.length) {
      this.quiz = { ...run, i, given: null }
      return
    }
    const c = this.course(run.course)
    let result: QuizRun['result'] = null
    if (c && this.progress) {
      if (run.kind === 'lesson') result = recordLesson(this.progress, c, run.target, run.answers)
      else if (run.kind === 'test') result = recordTest(this.progress, c, run.target, run.answers)
      else result = { score: recordPractice(this.progress, c, run.answers), passed: true }
      this.#changed()
    }
    this.quiz = { ...run, i, given: null, done: true, result }
  }

  /** 结束这一轮（中途退出不记成绩），回到来的那一页 */
  exit(): void {
    const run = this.quiz
    this.quiz = null
    if (!run) return this.home()
    if (run.kind === 'lesson' && run.done && run.result?.passed) this.open(run.course)
    else if (run.kind === 'lesson')
      this.view = { page: 'lesson', course: run.course, lesson: run.target, step: 0 }
    else this.open(run.course)
  }

  /** 同一种练习再来一轮 */
  async retry(): Promise<void> {
    const run = this.quiz
    if (!run) return
    if (run.kind === 'lesson') await this.startLesson(run.course, run.target)
    else if (run.kind === 'test') await this.startTest(run.course, run.target)
    else await this.startPractice(run.course)
  }
}

export const courses = new CoursesState()
