/** Deterministic, evidence-linked reading tasks. No inferred facts, translation or LLM. */
import { rng, shuffled } from './course'
import type { ExamQuestion } from './exam'

export interface ArticleQuizInput {
  id: string
  body: string
  translation?: string
  excerpt?: boolean
  lang?: string
  /** Already attested article vocabulary questions, never renamed reading comprehension. */
  vocabulary?: ExamQuestion[]
  seed?: number
}
export interface ArticleQuiz {
  questions: ExamQuestion[]
  vocabulary: number
  reading: number
  excerpt: boolean
  translated: boolean
  fingerprint: string
}
export function articleFingerprint(input: ArticleQuizInput): string {
  let hash = 2166136261
  for (const c of `${input.id}\0${input.body}\0${input.translation ?? ''}`) {
    hash ^= c.codePointAt(0)!
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}
const paragraphsOf = (body: string): string[] =>
  body
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
const both = (zh: string, en: string): { zh: string; en: string } => ({ zh, en })
const unique = (items: string[]): string[] => [...new Set(items)]
export interface ArticleQuizWord {
  id: string
  word: string
  meaning: Record<string, string>
  evidence: string
}
export function articleVocabulary(
  words: ArticleQuizWord[],
  distractors: ArticleQuizWord[],
  seed = 1729
): ExamQuestion[] {
  const rand = rng(seed)
  const meaning = (w: ArticleQuizWord): ReturnType<typeof both> =>
    both(
      w.meaning.zh || w.meaning.en || Object.values(w.meaning).find(Boolean) || '',
      w.meaning.en || w.meaning.zh || Object.values(w.meaning).find(Boolean) || ''
    )
  const out: ExamQuestion[] = []
  for (const w of shuffled([...new Map(words.map((w) => [w.id, w])).values()], rand)) {
    const right = meaning(w)
    if (!w.evidence.trim() || !right.zh.trim()) continue
    const wrong: ReturnType<typeof both>[] = []
    for (const x of shuffled(distractors, rand)) {
      const m = meaning(x)
      if (
        x.id === w.id ||
        !m.zh.trim() ||
        m.zh === right.zh ||
        m.en === right.en ||
        wrong.some((o) => o.zh === m.zh || o.en === m.en)
      )
        continue
      wrong.push(m)
      if (wrong.length === 3) break
    }
    if (!wrong.length) continue
    const choices = shuffled([right, ...wrong], rand).map((text) => ({ text }))
    out.push({
      id: `vocabulary-${w.id}`,
      kind: 'word-meaning',
      section: 'vocab',
      ask: both(
        '根据材料提供的词汇释义，选择这个词的意思',
        'Choose the supplied dictionary meaning of this word'
      ),
      prompt: { text: w.word },
      choices,
      answer: choices.findIndex((c) => c.text === right),
      explain: {
        lines: [right, both(`原文依据：${w.evidence}`, `Evidence in the source: ${w.evidence}`)]
      }
    })
    if (out.length === 5) break
  }
  return out
}

export function makeArticleQuiz(input: ArticleQuizInput): ArticleQuiz {
  const rand = rng(input.seed ?? 1)
  // Bound question material, not source content; large books must not produce megabyte choices.
  const paragraphs = paragraphsOf(input.body)
  const translations = paragraphsOf(input.translation ?? '')
  const aligned =
    translations.length === paragraphsOf(input.body).length &&
    paragraphs.length === translations.length &&
    translations.length > 0
  const reading: ExamQuestion[] = []
  function add(
    id: string,
    ask: ReturnType<typeof both>,
    prompt: string,
    right: string,
    wrong: string[],
    evidence: string,
    meaning?: string
  ): void {
    if (prompt.length > 1800 || right.length > 1800 || evidence.length > 4000) return
    const options = unique([right, ...wrong.filter((s) => s !== right && s.length <= 1800)]).slice(
      0,
      4
    )
    if (options.length < 2) return
    const choices = shuffled(options, rand).map((text) => ({
      text,
      ...(meaning ? {} : { lang: input.lang })
    }))
    reading.push({
      id: `reading-${id}`,
      kind: 'sentence',
      section: 'reading',
      ask,
      prompt: { text: prompt, lang: input.lang },
      choices,
      answer: choices.findIndex((c) => c.text === right),
      explain: {
        lines: [
          both(`原文依据：${evidence}`, `Evidence in the supplied text: ${evidence}`),
          ...(meaning
            ? [both(`对应译文（材料提供）：${meaning}`, `Provided translation: ${meaning}`)]
            : [])
        ]
      }
    })
  }
  if (aligned && unique(translations).length > 1) {
    for (const i of shuffled(
      paragraphs.map((_, i) => i),
      rand
    ).slice(0, 3))
      add(
        `meaning-${i}`,
        both(
          '根据原文，选择这一段对应的已提供译文',
          'Choose the provided translation matching this passage'
        ),
        paragraphs[i],
        translations[i],
        shuffled(
          translations.filter((_, j) => j !== i),
          rand
        ),
        paragraphs[i],
        translations[i]
      )
  }
  // Information location and sequence are explicitly labeled; these do not assert semantic understanding.
  if (unique(paragraphs).length >= 2) {
    for (const i of shuffled(
      paragraphs.map((_, i) => i),
      rand
    ).slice(0, 2)) {
      const snippet = paragraphs[i].slice(0, Math.min(80, paragraphs[i].length))
      if (paragraphs.filter((p) => p.includes(snippet)).length !== 1) continue
      add(
        `location-${i}`,
        both(
          '原文信息定位：哪一段包含下面这段原文？',
          'Locate evidence: which paragraph contains this exact passage?'
        ),
        snippet,
        paragraphs[i],
        shuffled(
          paragraphs.filter((_, j) => j !== i),
          rand
        ),
        paragraphs[i]
      )
    }
    const pairs = paragraphs
      .slice(0, -1)
      .map((p, i) => ({ p, next: paragraphs[i + 1], i }))
      .filter((x) => paragraphs.filter((p) => p === x.p).length === 1)
    for (const x of shuffled(pairs, rand).slice(0, 2))
      add(
        `next-${x.i}`,
        both(
          '原文顺序：下面这段之后紧接着哪一段？',
          'Text sequence: which paragraph immediately follows this passage?'
        ),
        x.p,
        x.next,
        shuffled(
          paragraphs.filter((p) => p !== x.next),
          rand
        ),
        `${x.p}\n${x.next}`
      )
  } else if (paragraphs.length === 1) {
    const sentences =
      paragraphs[0]
        .match(/[^。！？.!?]+[。！？.!?]+|[^。！？.!?]+$/gu)
        ?.map((s) => s.trim())
        .filter(Boolean) ?? []
    if (sentences.length >= 2 && sentences.length <= 20)
      for (const i of sentences
        .slice(0, -1)
        .map((_, i) => i)
        .filter((i) => sentences.filter((s) => s === sentences[i]).length === 1)
        .slice(0, 2))
        add(
          `sentence-next-${i}`,
          both(
            '原文片段顺序：下一个片段是什么？',
            'Text sequence: which source segment comes next?'
          ),
          sentences[i],
          sentences[i + 1],
          sentences.filter((_, j) => j !== i + 1),
          `${sentences[i]}\n${sentences[i + 1]}`
        )
  }
  const vocabulary = (input.vocabulary ?? [])
    .filter((q) => q.kind === 'word-meaning' || q.kind === 'meaning-word')
    .slice(0, 5)
    .map((q, i) => ({
      ...q,
      ask:
        q.kind === 'word-meaning'
          ? both(
              '选出词典为本文这个词条提供的释义',
              'Choose the dictionary gloss supplied for this entry found in the text'
            )
          : both(
              '根据词典释义，选择本文出现的词条',
              'Choose the entry found in the text that matches the supplied dictionary gloss'
            ),
      prompt: { ...q.prompt, lang: q.prompt.lang ?? input.lang },
      id: `vocabulary-${i}`,
      section: 'vocab' as const
    }))
  return {
    questions: [...vocabulary, ...reading.slice(0, 5)],
    vocabulary: vocabulary.length,
    reading: Math.min(reading.length, 5),
    excerpt: !!input.excerpt,
    translated: aligned,
    fingerprint: articleFingerprint({
      ...input,
      body: input.body + JSON.stringify([...vocabulary, ...reading.slice(0, 5)])
    })
  }
}

export interface ArticleQuizAttempt {
  at: number
  answers: number[]
  right: number
  total: number
}
export interface ArticleQuizProgress {
  fingerprint: string
  answers: number[]
  completed: boolean
  history: ArticleQuizAttempt[]
}
/** Saved progress contains answers and material fingerprint, never executable content or guessed questions. */
export function parseArticleQuizProgress(value: unknown): ArticleQuizProgress | null {
  if (!value || typeof value !== 'object') return null
  const x = value as ArticleQuizProgress
  const answerList = (a: unknown): a is number[] =>
    Array.isArray(a) && a.length <= 30 && a.every((n) => Number.isInteger(n) && n >= 0 && n < 4)
  if (
    typeof x.fingerprint !== 'string' ||
    !/^[a-f0-9]{1,8}$/.test(x.fingerprint) ||
    !answerList(x.answers) ||
    typeof x.completed !== 'boolean' ||
    !Array.isArray(x.history)
  )
    return null
  if (
    !x.history.every(
      (h) =>
        h &&
        Number.isFinite(h.at) &&
        h.at > 0 &&
        answerList(h.answers) &&
        Number.isInteger(h.total) &&
        h.total === h.answers.length &&
        Number.isInteger(h.right) &&
        h.right >= 0 &&
        h.right <= h.total
    )
  )
    return null
  return {
    fingerprint: x.fingerprint,
    answers: [...x.answers],
    completed: x.completed,
    history: x.history.map((h) => ({
      at: h.at,
      answers: [...h.answers],
      right: h.right,
      total: h.total
    }))
  }
}
export function isArticleQuizProgress(value: unknown): value is ArticleQuizProgress {
  return !!parseArticleQuizProgress(value)
}
export function mergeArticleQuizProgress(
  a: ArticleQuizProgress,
  b: ArticleQuizProgress
): ArticleQuizProgress {
  const history = [
    ...new Map(
      [...a.history, ...b.history].map((h) => [JSON.stringify([h.at, h.answers]), h])
    ).values()
  ].sort((x, y) => x.at - y.at)
  const same = a.fingerprint === b.fingerprint
  const current = same
    ? b.answers.length > a.answers.length
      ? b
      : a
    : (b.history.at(-1)?.at ?? 0) > (a.history.at(-1)?.at ?? 0)
      ? b
      : a
  return {
    fingerprint: current.fingerprint,
    answers: same ? [...current.answers] : [],
    completed: same && (a.completed || b.completed),
    history
  }
}
