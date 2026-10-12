/**
 * 课程（M4）里跟语言无关的部分：课程的结构、学习进度、出题与判分。纯函数，测试里直接用。
 *
 * 一门课分几个单元，一个单元分几课。学什么由学习包给：
 * - symbols：一个个字（日语的假名、千语集语言的字母与自造文字），先认字，再做看字选读音、看读音选字、
 *   听音选字、拼读单词这几种题；
 * - grammar：语法点（意思、接续、例句），做选意思、填空题；
 * - docs：作者写的文档，读完就算学过，不出题；
 * - forms：变形（て形、单数·宾格），看变形表，做「选出正确的形式」题；
 * - phrases：会话短语（也用于惯用语），做看短语选意思、看意思选短语、听音选短语；
 * - texts：一课一篇文章（民间故事），在阅读器里读，做本文练习过关。
 * 日语的课在 src/shared/ja/*-course.ts，千语集语言的在 lib/courses/qonlang.ts。
 */

/** 界面上的文字：写好的一句，或者按界面语言挑（{ zh, en }） */
export type Text = string | Record<string, string>

export type CourseKind = 'symbols' | 'grammar' | 'docs' | 'forms' | 'phrases' | 'texts'

/** 怎么读出来：自然语言读文字（lang 是 BCP-47），人造语言读 IPA；有录音键的先放录音 */
export interface Sound {
  text?: string
  lang?: string
  ipa?: string
  key?: string
}

/** 要认的一个字：一个假名、一个字母、一个自造文字的字形 */
export interface SymbolItem {
  key: string
  /** 大字显示的：あ、ᚨ、ng */
  symbol: string
  /** 标准读法：a、shi；自造文字是它的转写 */
  reading: string
  /** 输入时也算对的写法（を 的 o、ぢ 的 di） */
  accept?: string[]
  /** 长得像的（出「选字」题时优先拿来当干扰项） */
  alike?: string[]
  /** 对应的另一套写法（平假名对应的片假名），显示用 */
  pair?: string
  /** pair 是什么（大写、小写、独立形……）；不写时按平假名 / 片假名标 */
  pairLabel?: Text
  /** 国际音标 */
  ipa?: string
  say?: Sound | null
  /** 用哪套自造文字的字体显示（千语集的文字 id） */
  scriptId?: string
  /** 只讲不考：促音、长音符号这类单独读不出来的 */
  learnOnly?: boolean
  note?: Text
  /** 有笔顺可看（日语的假名） */
  strokes?: boolean
  /** false：不出输入题（读音是 IPA 的字母，打不出来） */
  typeable?: boolean
}

export interface GrammarExample {
  ja: string
  zh: string | null
  en: string | null
  /** 中文是机器翻译的 */
  zhMachine?: boolean
  /** 语法点在句子里的起止（码元下标）：例句里高亮它，填空题挖掉这一段 */
  start: number
  end: number
  /** 自己写的例句，或者 Tatoeba 的例句号 */
  source: 'builtin' | number
}

export interface GrammarItem {
  key: string
  /** 〜ましょう */
  name: string
  /** 接续：V-ます + ましょう */
  form: string
  meaning: Record<string, string>
  /** 用法与易错点（多语言语法课程）。 */
  notes?: Text
  /** 意思相近的一组（〜から / 〜ので）：出题时不拿同组的互相当干扰项 */
  group?: string
  examples: GrammarExample[]
}

export interface DocItem {
  key: string
  title: string
  docId: string
}

/** 变形表里的一格：一个词的原形与这个形 */
export interface FormExample {
  /** 原形（書く、kaso） */
  base: string
  /** 原形的读音（かく） */
  baseReading?: string
  meaning?: Text
  /** 这个形（書いて、kasom） */
  form: string
  formReading?: string
  /** 错的形式（选择题的干扰项）：常见的错，或者这个词别的形 */
  wrong: string[]
  say?: Sound | null
  scriptId?: string
}

/** 一个形：て形、单数·宾格 */
export interface FormItem {
  key: string
  title: Text
  examples: FormExample[]
}

/** 一句会话短语 */
export interface PhraseItem {
  key: string
  text: string
  /** 读音（日语的假名、人造语言的 IPA） */
  reading?: string
  meaning: Text
  say?: Sound | null
  /** 用自造文字写出来的样子（显示在短语下面） */
  script?: string
  scriptId?: string
  note?: Text
}

/** 一篇课文：文章库里的一篇文章 */
export interface TextItem {
  key: string
  title: string
  author?: string
  /** 文章库里的文章 id */
  articleId: string
}

export interface CourseLesson {
  id: string
  title: Text
  /** 这一课学的条目（键） */
  items: string[]
  /** 课前的说明（浊音怎么写、拗音是什么） */
  note?: Text
  /** 拼读用的词（按这门课的写法）：给了就用这些，没给时由学习包按学过的字去挑 */
  words?: string[]
}

export interface CourseUnit {
  id: string
  title: Text
  note?: Text
  lessons: CourseLesson[]
  /** 有没有单元测验 */
  test: boolean
}

export interface Course {
  /** 课程页上的一块：alphabet / grammar …（跟 lib/packs/modules.ts 的 CourseSection 对应） */
  id: string
  kind: CourseKind
  title: Text
  intro?: Text
  /** 课程页上另附的一段说明（日语语法课：接续的写法） */
  legend?: Text
  units: CourseUnit[]
  symbols: Record<string, SymbolItem>
  grammar: Record<string, GrammarItem>
  docs: Record<string, DocItem>
  forms?: Record<string, FormItem>
  phrases?: Record<string, PhraseItem>
  texts?: Record<string, TextItem>
  /** 输入题怎么判：日语把罗马字转成假名再比；没给时跟读音逐字比（不分大小写） */
  checkTyped?: (item: SymbolItem, input: string) => boolean
}

/** 拼读题用的一个词：用学过的字写成 */
export interface SpellWord {
  /** 用这门课的字写出来的样子（さかな、ᛊᚨᚲ） */
  text: string
  /** 读法（sakana） */
  reading: string
  /** 另一种写法（有汉字的：魚），显示用 */
  head?: string
  meaning: Text
  say?: Sound | null
  scriptId?: string
}

export type Question =
  /** 看字选读音 */
  | { type: 'read'; key: string; choices: string[] }
  /** 看读音选字 */
  | { type: 'write'; key: string; choices: string[] }
  /** 听音选字 */
  | { type: 'listen'; key: string; choices: string[] }
  /** 看字写读音 */
  | { type: 'type'; key: string }
  /** 拼读：看一个词，选它的读法 */
  | { type: 'word'; word: SpellWord; choices: SpellWord[] }
  /** 语法：例句里标出的这一处是什么意思 */
  | { type: 'meaning'; key: string; ex: number; choices: string[] }
  /** 语法：看着译文，选填进空里的那一段 */
  | { type: 'fill'; key: string; ex: number; choices: string[] }
  /** 变形：给原形和要变的形，选出正确的形式（选项是写出来的形式） */
  | { type: 'form'; key: string; ex: number; choices: string[] }
  /** 会话：看短语选意思（meaning）、看意思选短语（pick）、听音选短语（listen）；选项是短语的键 */
  | { type: 'phrase'; key: string; mode: 'meaning' | 'pick' | 'listen'; choices: string[] }

// ───────────────────────── 随机 ─────────────────────────

/** 可复现的随机数（mulberry32）：出题用，测试给固定种子 */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 同一个条目别连着考两道：挨着的往后挪（挪不开就算了） */
function spread(qs: Question[]): Question[] {
  const out = [...qs]
  const keyOf = (q: Question): string => ('key' in q ? q.key : `w:${q.word.text}`)
  for (let i = 1; i < out.length; i++) {
    if (keyOf(out[i]) !== keyOf(out[i - 1])) continue
    const j = out.findIndex((q, k) => k > i && keyOf(q) !== keyOf(out[i - 1]))
    if (j > 0) [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ───────────────────────── 判分 ─────────────────────────

/** 这道题考的条目（记每个条目答对答错几次，练薄弱项用）；拼读题不记 */
export function questionKeys(q: Question): string[] {
  return 'key' in q ? [q.key] : []
}

/** 例句里语法点那一段 */
export const exampleSpan = (ex: GrammarExample): string => ex.ja.slice(ex.start, ex.end)

/** 填空题的正确答案 */
export function fillAnswer(course: Course, q: Extract<Question, { type: 'fill' }>): string {
  return exampleSpan(course.grammar[q.key].examples[q.ex])
}

const plain = (s: string): string => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()

export function typedRight(course: Course, item: SymbolItem, input: string): boolean {
  if (!input.trim()) return false
  if (course.checkTyped) return course.checkTyped(item, input.trim())
  return [item.reading, ...(item.accept ?? [])].some((r) => plain(r) === plain(input))
}

/**
 * 答对没有。选择题的 answer 是选中的那一项：字题是条目键，填空是那一段文字，拼读是词的写法；
 * 输入题是输入的文字
 */
export function isRight(course: Course, q: Question, answer: string): boolean {
  switch (q.type) {
    case 'read':
    case 'write':
    case 'listen':
    case 'meaning':
    case 'phrase':
      return answer === q.key
    case 'fill':
      return answer === fillAnswer(course, q)
    case 'form':
      return answer === course.forms?.[q.key]?.examples[q.ex]?.form
    case 'word':
      return answer === q.word.text
    case 'type':
      return typedRight(course, course.symbols[q.key], answer)
  }
}

// ───────────────────────── 出题：字 ─────────────────────────

export interface QuizOptions {
  seed: number
  /** 拼读题用的词（学习包按学过的字挑好的） */
  words?: SpellWord[]
  /** 这台机器能不能读出声（不能就不出听音题） */
  listen?: boolean
  /** 最多出几道 */
  max?: number
}

/** 读音一样（じ / ぢ）或者 IPA 一样：不能同时出现在一道题的选项里 */
const soundAlike = (a: SymbolItem, b: SymbolItem): boolean =>
  a.reading === b.reading || (!!a.ipa && a.ipa === b.ipa)

/**
 * 字题的选项（条目键，含正确答案，打乱）：选字题长得像的先上，再是同一课的，再从学过的里挑；
 * 读音跟答案一样的不要，选项之间读音也不重复
 */
function symbolChoices(
  course: Course,
  key: string,
  near: readonly string[],
  pool: readonly string[],
  shape: boolean,
  rand: () => number,
  n = 4
): string[] {
  const it = course.symbols[key]
  const picked: string[] = []
  const take = (list: readonly string[]): void => {
    for (const k of list) {
      if (picked.length >= n - 1) return
      const x = course.symbols[k]
      if (!x || k === key || x.learnOnly || soundAlike(x, it) || picked.includes(k)) continue
      if (picked.some((p) => soundAlike(course.symbols[p], x))) continue
      picked.push(k)
    }
  }
  if (shape)
    take(
      shuffled(
        (it.alike ?? []).filter((k) => pool.includes(k) || near.includes(k)),
        rand
      )
    )
  take(shuffled(near, rand))
  take(shuffled(pool, rand))
  return shuffled([key, ...picked], rand)
}

/** 拼读题：每个词配几个读法不同的词当选项；少于两个词出不了 */
function wordQuestions(words: SpellWord[], n: number, rand: () => number): Question[] {
  const uniq = words.filter(
    (w, i) => words.findIndex((x) => x.text === w.text || x.reading === w.reading) === i
  )
  if (uniq.length < 2) return []
  return shuffled(uniq, rand)
    .slice(0, n)
    .map((word) => ({
      type: 'word' as const,
      word,
      choices: shuffled(
        [
          word,
          ...shuffled(
            uniq.filter((w) => w !== word),
            rand
          ).slice(0, 3)
        ],
        rand
      )
    }))
}

const quizzable = (course: Course, keys: readonly string[]): string[] =>
  keys.filter((k) => course.symbols[k] && !course.symbols[k].learnOnly)

/** 一道字题；选项凑不够两个时改成输入题，不能输入的（IPA）就不出 */
function symbolQuestion(
  course: Course,
  type: 'read' | 'write' | 'listen' | 'type',
  key: string,
  near: readonly string[],
  pool: readonly string[],
  rand: () => number
): Question | null {
  const canType = course.symbols[key].typeable !== false
  if (type === 'type')
    return canType ? { type, key } : symbolQuestion(course, 'read', key, near, pool, rand)
  const choices = symbolChoices(course, key, near, pool, type !== 'read', rand)
  if (choices.length >= 2) return { type, key, choices }
  return canType ? { type: 'type', key } : null
}

const present = <T>(x: T | null): x is T => x !== null

/**
 * 一课的练习：每个字考看字选读音、看读音选字，能出声的再考听音选字；末尾加几道拼读。
 * pool 是到这一课为止学过的字（干扰项从里面挑）
 */
export function symbolLessonQuiz(
  course: Course,
  lesson: CourseLesson,
  pool: readonly string[],
  opts: QuizOptions
): Question[] {
  const rand = rng(opts.seed)
  const keys = quizzable(course, lesson.items)
  const qs: Question[] = []
  for (const k of keys) {
    const types: ('read' | 'write' | 'listen')[] = ['read', 'write']
    if (opts.listen && course.symbols[k].say) types.push('listen')
    qs.push(...types.map((t) => symbolQuestion(course, t, k, keys, pool, rand)).filter(present))
  }
  qs.push(...wordQuestions(opts.words ?? [], keys.length ? 3 : 6, rand))
  return spread(shuffled(qs, rand)).slice(0, opts.max ?? Infinity)
}

/**
 * 单元测验、练薄弱项：每个字考一道，题型轮着来（含输入题），再加几道拼读。
 * 字太多时随机抽 max 个
 */
export function symbolTestQuiz(
  course: Course,
  keys: readonly string[],
  pool: readonly string[],
  opts: QuizOptions
): Question[] {
  const rand = rng(opts.seed)
  const types: ('read' | 'write' | 'listen' | 'type')[] = opts.listen
    ? ['read', 'write', 'listen', 'type']
    : ['read', 'write', 'type']
  const chosen = shuffled(quizzable(course, keys), rand).slice(0, opts.max ?? Infinity)
  const qs = chosen
    .map((k) =>
      symbolQuestion(course, types[Math.floor(rand() * types.length)], k, chosen, pool, rand)
    )
    .filter(present)
  qs.push(...wordQuestions(opts.words ?? [], 4, rand))
  return spread(shuffled(qs, rand))
}

// ───────────────────────── 出题：语法 ─────────────────────────

const meaningText = (g: GrammarItem): string => Object.values(g.meaning).join('|')

/** 一个语法点能出题的例句（语法点那一段标出来了的） */
export const usableExamples = (g: GrammarItem): number[] =>
  g.examples.map((ex, i) => (ex.end > ex.start ? i : -1)).filter((i) => i >= 0)

const sameGroup = (a: GrammarItem, b: GrammarItem): boolean => !!a.group && a.group === b.group

function meaningChoices(
  course: Course,
  key: string,
  near: readonly string[],
  pool: readonly string[],
  rand: () => number
): string[] {
  const g = course.grammar[key]
  const picked: string[] = []
  for (const k of [...shuffled(near, rand), ...shuffled(pool, rand)]) {
    if (picked.length >= 3) break
    const x = course.grammar[k]
    if (!x || k === key || picked.includes(k) || sameGroup(x, g)) continue
    if (meaningText(x) === meaningText(g)) continue
    picked.push(k)
  }
  return shuffled([key, ...picked], rand)
}

function fillChoices(
  course: Course,
  key: string,
  ex: number,
  near: readonly string[],
  pool: readonly string[],
  rand: () => number
): string[] {
  const g = course.grammar[key]
  const answer = exampleSpan(g.examples[ex])
  const picked: string[] = []
  for (const k of [...shuffled(near, rand), ...shuffled(pool, rand)]) {
    if (picked.length >= 3) break
    const x = course.grammar[k]
    if (!x || k === key || sameGroup(x, g)) continue
    const spans = usableExamples(x).map((i) => exampleSpan(x.examples[i]))
    const s = shuffled(spans, rand).find((sp) => sp !== answer && !picked.includes(sp))
    if (s) picked.push(s)
  }
  return shuffled([answer, ...picked], rand)
}

export function grammarQuestion(
  course: Course,
  type: 'meaning' | 'fill',
  key: string,
  ex: number,
  near: readonly string[],
  pool: readonly string[],
  rand: () => number
): Question | null {
  const choices =
    type === 'meaning'
      ? meaningChoices(course, key, near, pool, rand)
      : fillChoices(course, key, ex, near, pool, rand)
  return choices.length < 2 ? null : { type, key, ex, choices }
}

/** 一课的练习：每个语法点一道选意思、一道填空（尽量用不同的例句） */
export function grammarLessonQuiz(
  course: Course,
  lesson: CourseLesson,
  pool: readonly string[],
  opts: QuizOptions
): Question[] {
  const rand = rng(opts.seed)
  const keys = lesson.items.filter((k) => course.grammar[k])
  const qs: Question[] = []
  for (const k of keys) {
    const exs = shuffled(usableExamples(course.grammar[k]), rand)
    if (!exs.length) continue
    const a = grammarQuestion(course, 'meaning', k, exs[0], keys, pool, rand)
    const b = grammarQuestion(course, 'fill', k, exs[1] ?? exs[0], keys, pool, rand)
    for (const q of [a, b]) if (q) qs.push(q)
  }
  return spread(shuffled(qs, rand)).slice(0, opts.max ?? Infinity)
}

/** 单元测验：每个语法点一道（选意思或填空随机），多了随机抽 max 个 */
export function grammarTestQuiz(
  course: Course,
  keys: readonly string[],
  pool: readonly string[],
  opts: QuizOptions
): Question[] {
  const rand = rng(opts.seed)
  const chosen = shuffled(
    keys.filter((k) => course.grammar[k] && usableExamples(course.grammar[k]).length),
    rand
  ).slice(0, opts.max ?? Infinity)
  const qs: Question[] = []
  for (const k of chosen) {
    const ex = shuffled(usableExamples(course.grammar[k]), rand)[0]
    const q = grammarQuestion(course, rand() < 0.5 ? 'meaning' : 'fill', k, ex, chosen, pool, rand)
    if (q) qs.push(q)
  }
  return spread(qs)
}

// ───────────────────────── 出题：变形 ─────────────────────────

/** 一道变形题：正确的形式加上错形，去重、打乱；错形凑不够一个就不出 */
function formQuestion(
  course: Course,
  key: string,
  ex: number,
  rand: () => number
): Question | null {
  const e = course.forms?.[key]?.examples[ex]
  if (!e) return null
  const wrong = [...new Set(e.wrong.filter((w) => w && w !== e.form))].slice(0, 3)
  return wrong.length
    ? { type: 'form', key, ex, choices: shuffled([e.form, ...wrong], rand) }
    : null
}

/** 一个形抽 n 个不同的词出题 */
function formQuestions(course: Course, key: string, n: number, rand: () => number): Question[] {
  const f = course.forms?.[key]
  if (!f) return []
  return shuffled(
    f.examples.map((_, i) => i),
    rand
  )
    .slice(0, n)
    .map((i) => formQuestion(course, key, i, rand))
    .filter(present)
}

/** 一课的练习：每个形考三个词 */
export function formLessonQuiz(
  course: Course,
  lesson: CourseLesson,
  opts: QuizOptions
): Question[] {
  const rand = rng(opts.seed)
  const qs = lesson.items.flatMap((k) => formQuestions(course, k, 3, rand))
  return spread(shuffled(qs, rand)).slice(0, opts.max ?? Infinity)
}

/** 单元测验：每个形考两个词，多了随机抽 max 道 */
export function formTestQuiz(
  course: Course,
  keys: readonly string[],
  opts: QuizOptions
): Question[] {
  const rand = rng(opts.seed)
  const qs = keys.flatMap((k) => formQuestions(course, k, 2, rand))
  return spread(shuffled(qs, rand).slice(0, opts.max ?? Infinity))
}

// ───────────────────────── 出题：会话 ─────────────────────────

const meaningKey = (m: Text): string => (typeof m === 'string' ? m : JSON.stringify(m))

/** 会话题的选项（短语键）：同一课的先上，再从学过的里挑；意思、写法都不跟答案重 */
function phraseChoices(
  course: Course,
  key: string,
  near: readonly string[],
  pool: readonly string[],
  rand: () => number
): string[] {
  const all = course.phrases ?? {}
  const it = all[key]
  const picked: string[] = []
  for (const k of [...shuffled(near, rand), ...shuffled(pool, rand)]) {
    if (picked.length >= 3) break
    const x = all[k]
    if (!x || k === key || picked.includes(k) || x.text === it.text) continue
    if (meaningKey(x.meaning) === meaningKey(it.meaning)) continue
    if (picked.some((p) => meaningKey(all[p].meaning) === meaningKey(x.meaning))) continue
    picked.push(k)
  }
  return shuffled([key, ...picked], rand)
}

function phraseQuestion(
  course: Course,
  key: string,
  mode: 'meaning' | 'pick' | 'listen',
  near: readonly string[],
  pool: readonly string[],
  rand: () => number
): Question | null {
  const choices = phraseChoices(course, key, near, pool, rand)
  return choices.length < 2 ? null : { type: 'phrase', key, mode, choices }
}

/** 一课的练习：每句考看短语选意思、看意思选短语，能出声的再考听音 */
export function phraseLessonQuiz(
  course: Course,
  lesson: CourseLesson,
  pool: readonly string[],
  opts: QuizOptions
): Question[] {
  const rand = rng(opts.seed)
  const keys = lesson.items.filter((k) => course.phrases?.[k])
  const qs: Question[] = []
  for (const k of keys) {
    const modes: ('meaning' | 'pick' | 'listen')[] = ['meaning', 'pick']
    if (opts.listen && course.phrases?.[k].say) modes.push('listen')
    qs.push(...modes.map((m) => phraseQuestion(course, k, m, keys, pool, rand)).filter(present))
  }
  return spread(shuffled(qs, rand)).slice(0, opts.max ?? Infinity)
}

/** 单元测验：每句一道，题型随机 */
export function phraseTestQuiz(
  course: Course,
  keys: readonly string[],
  pool: readonly string[],
  opts: QuizOptions
): Question[] {
  const rand = rng(opts.seed)
  const modes: ('meaning' | 'pick' | 'listen')[] = opts.listen
    ? ['meaning', 'pick', 'listen']
    : ['meaning', 'pick']
  const chosen = shuffled(
    keys.filter((k) => course.phrases?.[k]),
    rand
  ).slice(0, opts.max ?? Infinity)
  const qs = chosen
    .map((k) =>
      phraseQuestion(course, k, modes[Math.floor(rand() * modes.length)], chosen, pool, rand)
    )
    .filter(present)
  return spread(qs)
}

// ───────────────────────── 按课的种类出题 ─────────────────────────

/** 一课的练习（按课的种类）；拼读词、能不能出声由调用方给 */
export function lessonQuiz(
  course: Course,
  lesson: CourseLesson,
  pool: readonly string[],
  opts: QuizOptions
): Question[] {
  switch (course.kind) {
    case 'symbols':
      return symbolLessonQuiz(course, lesson, pool, opts)
    case 'grammar':
      return grammarLessonQuiz(course, lesson, pool, opts)
    case 'forms':
      return formLessonQuiz(course, lesson, opts)
    case 'phrases':
      return phraseLessonQuiz(course, lesson, pool, opts)
    default:
      return []
  }
}

/** 单元测验（按课的种类） */
export function testQuiz(
  course: Course,
  keys: readonly string[],
  pool: readonly string[],
  opts: QuizOptions
): Question[] {
  switch (course.kind) {
    case 'symbols':
      return symbolTestQuiz(course, keys, pool, { max: 50, ...opts })
    case 'grammar':
      return grammarTestQuiz(course, keys, pool, { max: 30, ...opts })
    case 'forms':
      return formTestQuiz(course, keys, { max: 30, ...opts })
    case 'phrases':
      return phraseTestQuiz(course, keys, pool, { max: 40, ...opts })
    default:
      return []
  }
}

// ───────────────────────── 结构 ─────────────────────────

export interface LessonRef {
  unit: CourseUnit
  lesson: CourseLesson
}

/** 按课程顺序排开的所有课 */
export function allLessons(course: Course): LessonRef[] {
  return course.units.flatMap((unit) => unit.lessons.map((lesson) => ({ unit, lesson })))
}

export function findLesson(course: Course, lessonId: string): LessonRef | null {
  return allLessons(course).find((r) => r.lesson.id === lessonId) ?? null
}

/** 到这一课为止（含这一课）学过的条目：出题时的干扰项从这里挑 */
export function poolUpTo(course: Course, lessonId: string): string[] {
  const out: string[] = []
  for (const r of allLessons(course)) {
    out.push(...r.lesson.items)
    if (r.lesson.id === lessonId) break
  }
  return out
}

export const unitItems = (unit: CourseUnit): string[] => unit.lessons.flatMap((l) => l.items)

// ───────────────────────── 进度 ─────────────────────────

/** 练习、测验答对这么多算过关 */
export const PASS = 0.8

export interface LessonRecord {
  /** 认字 / 讲解那一步看完了 */
  learned: boolean
  /** 练习的最好成绩（0–1） */
  best: number
  passed: boolean
  tries: number
  at: number
}

export interface TestRecord {
  best: number
  passed: boolean
  tries: number
  at: number
}

export interface CourseProgress {
  version: 1
  /** 课程 id/课 id */
  lessons: Record<string, LessonRecord>
  /** 课程 id/单元 id：单元测验 */
  tests: Record<string, TestRecord>
  /** 课程 id/条目键：答对答错几次 */
  items: Record<string, { right: number; wrong: number }>
  /** 最近学的一课（首页「继续学习」） */
  last: { course: string; lesson: string } | null
}

export const progressKey = (courseId: string, id: string): string => `${courseId}/${id}`

export function emptyProgress(): CourseProgress {
  return { version: 1, lessons: {}, tests: {}, items: {}, last: null }
}

const num = (x: unknown, d = 0): number => (typeof x === 'number' && Number.isFinite(x) ? x : d)

/** 读回来的进度文件：缺的补上、坏的丢掉 */
export function normalizeProgress(raw: unknown): CourseProgress {
  const p = emptyProgress()
  if (!raw || typeof raw !== 'object') return p
  const r = raw as Partial<CourseProgress>
  for (const [k, v] of Object.entries(r.lessons ?? {}))
    if (v && typeof v === 'object')
      p.lessons[k] = {
        learned: !!v.learned,
        best: Math.min(1, Math.max(0, num(v.best))),
        passed: !!v.passed,
        tries: num(v.tries),
        at: num(v.at)
      }
  for (const [k, v] of Object.entries(r.tests ?? {}))
    if (v && typeof v === 'object')
      p.tests[k] = {
        best: Math.min(1, Math.max(0, num(v.best))),
        passed: !!v.passed,
        tries: num(v.tries),
        at: num(v.at)
      }
  for (const [k, v] of Object.entries(r.items ?? {}))
    if (v && typeof v === 'object') p.items[k] = { right: num(v.right), wrong: num(v.wrong) }
  if (r.last && typeof r.last.course === 'string' && typeof r.last.lesson === 'string')
    p.last = { course: r.last.course, lesson: r.last.lesson }
  return p
}

const lessonRecord = (p: CourseProgress, key: string): LessonRecord =>
  (p.lessons[key] ??= { learned: false, best: 0, passed: false, tries: 0, at: 0 })

/** 认字 / 讲解看完了（文档课读完就算过关） */
export function markLearned(
  p: CourseProgress,
  course: Course,
  lessonId: string,
  now = Date.now()
): void {
  const rec = lessonRecord(p, progressKey(course.id, lessonId))
  rec.learned = true
  rec.at = now
  if (course.kind === 'docs') rec.passed = true
  p.last = { course: course.id, lesson: lessonId }
}

/** 一篇课文的本文练习做完了（答对八成过关）；passNow 是读完直接点「学完了」 */
export function recordText(
  p: CourseProgress,
  course: Course,
  lessonId: string,
  score: number,
  now = Date.now()
): boolean {
  const rec = lessonRecord(p, progressKey(course.id, lessonId))
  rec.learned = true
  rec.tries++
  rec.best = Math.max(rec.best, score)
  rec.passed ||= score >= PASS
  rec.at = now
  p.last = { course: course.id, lesson: lessonId }
  return score >= PASS
}

export interface Answered {
  keys: string[]
  right: boolean
}

/** 记下每个条目这次答对答错 */
function countItems(p: CourseProgress, course: Course, answers: Answered[]): void {
  for (const a of answers)
    for (const k of a.keys) {
      const rec = (p.items[progressKey(course.id, k)] ??= { right: 0, wrong: 0 })
      if (a.right) rec.right++
      else rec.wrong++
    }
}

export const scoreOf = (answers: Answered[]): number =>
  answers.length ? answers.filter((a) => a.right).length / answers.length : 0

/** 一课的练习做完了；没有题可出的课（拼读词一个都没找到）直接算过关 */
export function recordLesson(
  p: CourseProgress,
  course: Course,
  lessonId: string,
  answers: Answered[],
  now = Date.now()
): { score: number; passed: boolean } {
  const rec = lessonRecord(p, progressKey(course.id, lessonId))
  const score = answers.length ? scoreOf(answers) : 1
  const passed = score >= PASS
  countItems(p, course, answers)
  rec.learned = true
  rec.tries++
  rec.best = Math.max(rec.best, score)
  rec.passed ||= passed
  rec.at = now
  p.last = { course: course.id, lesson: lessonId }
  return { score, passed }
}

export function recordTest(
  p: CourseProgress,
  course: Course,
  unitId: string,
  answers: Answered[],
  now = Date.now()
): { score: number; passed: boolean } {
  const key = progressKey(course.id, unitId)
  const rec = (p.tests[key] ??= { best: 0, passed: false, tries: 0, at: 0 })
  const score = scoreOf(answers)
  const passed = score >= PASS
  countItems(p, course, answers)
  rec.tries++
  rec.best = Math.max(rec.best, score)
  rec.passed ||= passed
  rec.at = now
  return { score, passed }
}

/** 练薄弱项只记对错，不改课与单元的成绩 */
export function recordPractice(p: CourseProgress, course: Course, answers: Answered[]): number {
  countItems(p, course, answers)
  return scoreOf(answers)
}

export type LessonState = 'new' | 'learned' | 'passed'

export function lessonState(p: CourseProgress, course: Course, lessonId: string): LessonState {
  const rec = p.lessons[progressKey(course.id, lessonId)]
  return rec?.passed ? 'passed' : rec?.learned ? 'learned' : 'new'
}

/** 接着学哪一课：第一课还没过关的；全过了是 null */
export function nextLesson(course: Course, p: CourseProgress): LessonRef | null {
  return allLessons(course).find((r) => lessonState(p, course, r.lesson.id) !== 'passed') ?? null
}

/** 过关之后接着学哪一课：这一课后面第一课没过关的；后面都过了再从头找 */
export function lessonAfter(course: Course, p: CourseProgress, lessonId: string): LessonRef | null {
  const all = allLessons(course)
  const i = all.findIndex((r) => r.lesson.id === lessonId)
  const rest = [...all.slice(i + 1), ...all.slice(0, Math.max(0, i))]
  return rest.find((r) => lessonState(p, course, r.lesson.id) !== 'passed') ?? null
}

export interface CourseSummary {
  lessons: number
  passed: number
  tests: number
  testsPassed: number
}

export function courseSummary(course: Course, p: CourseProgress): CourseSummary {
  const lessons = allLessons(course)
  const tests = course.units.filter((u) => u.test)
  return {
    lessons: lessons.length,
    passed: lessons.filter((r) => lessonState(p, course, r.lesson.id) === 'passed').length,
    tests: tests.length,
    testsPassed: tests.filter((u) => p.tests[progressKey(course.id, u.id)]?.passed).length
  }
}

/**
 * 薄弱项：学过的课里答错过的条目，按「错的次数 − 对的次数的一半」从高到低，最多 n 个
 */
export function weakItems(course: Course, p: CourseProgress, n = 8): string[] {
  const learned = new Set(
    allLessons(course)
      .filter((r) => lessonState(p, course, r.lesson.id) !== 'new')
      .flatMap((r) => r.lesson.items)
  )
  const weight = (k: string): number => {
    const rec = p.items[progressKey(course.id, k)]
    return rec && rec.wrong > 0 ? rec.wrong - rec.right / 2 : -Infinity
  }
  return [...learned]
    .filter((k) => weight(k) > -Infinity)
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, n)
}
