/**
 * 框架里各语言的练习与模拟卷（主进程）：题目全由词典出（词、变形、性、例句、语法点），不照搬现成考题。
 * 通用题型对所有语言都能出（数据够就出）；各语言特有的题型（韩语助词、俄语的格……）由
 * LangModule.practice 给出题函数，这里把能取词、例句、分析句子的 PracticeDb 交给它。
 * 模拟卷照各语言的 LangModule.exams 分节配题，计分办法也由它给（仅供参考）。
 */
import { LANGS } from '../../shared/lang/registry'
import { findGrammar } from '../../shared/lang/grammar'
import { genderLabel, tagsLabel } from '../../shared/lang/tags'
import { rng, shuffled, type Text } from '../../shared/course'
import {
  PRACTICE_SECTION,
  type Choice,
  type ExamPaper,
  type ExamQuestion,
  type PracticeKind
} from '../../shared/exam'
import type {
  LangModule,
  LexAnalysis,
  LexExample,
  LexGrammarPoint,
  PracticeDb,
  PracticeWord
} from '../../shared/lang/types'
import type { LexDb } from './lexdb'
import { analyzeLex } from './analyze'
import { makeArticleQuiz, type ArticleQuizInput } from '../../shared/article-quiz'

/** 通用题型（练习页按这个顺序列） */
export const LEX_KINDS: PracticeKind[] = [
  'word-meaning',
  'meaning-word',
  'listen-word',
  'spelling',
  'gender',
  'conjugate',
  'context',
  'grammar-fill',
  'grammar-meaning',
  'sentence',
  'listen-sentence'
]

/** 不出题的词性 */
const SKIP_POS = new Set(['propn', 'num', 'symbol', 'abbr', 'affix', 'other'])

export function practiceDb(db: LexDb, seed: number): PracticeDb {
  return {
    words: (o) => db.practiceWords(o),
    examples: (entry, limit) => db.entryExamples(entry, limit),
    sentences: (level, limit) => db.levelSentences(level, limit),
    lookup: (s) => db.lookup(s),
    analyze: (text) => analyzeLex(db, text),
    rand: rng(seed)
  }
}

const both = (zh: string, en: string): Text => ({ zh: zh || en, en: en || zh })
const glossOf = (w: { zh: string; en: string }): Text => both(w.zh, w.en)
const sameText = (a: Text, b: Text): boolean =>
  typeof a !== 'string' && typeof b !== 'string' ? a.zh === b.zh || a.en === b.en : a === b

function question(
  kind: PracticeKind,
  i: number,
  q: Omit<ExamQuestion, 'id' | 'kind' | 'section'>
): ExamQuestion {
  return { id: `${kind}-${i}`, kind, section: PRACTICE_SECTION[kind], ...q }
}

function arrange(
  right: Choice,
  wrong: Choice[],
  rand: () => number
): { choices: Choice[]; answer: number } {
  const choices = shuffled([right, ...wrong], rand)
  return { choices, answer: choices.indexOf(right) }
}

/** 例句的翻译（题面下的小字、解析） */
const translationOf = (ex: LexExample): Text => both(ex.zh ?? '', ex.en ?? '')

/** 一个词在句子里的位置：先找词头，再找它的变形（不分大小写） */
function findWord(sentence: string, w: PracticeWord, locale: string): [number, number] | null {
  const lower = sentence.toLocaleLowerCase(locale)
  const forms = [w.w, ...(w.d ? [w.d] : []), ...w.forms.map((f) => f[0])].sort(
    (a, b) => b.length - a.length
  )
  for (const f of forms) {
    const k = f.toLocaleLowerCase(locale)
    let at = lower.indexOf(k)
    while (at >= 0) {
      const before = at === 0 ? '' : lower[at - 1]
      const after = lower[at + k.length] ?? ''
      // 整词：前后不能是字母
      if (!/\p{L}/u.test(before) && !/\p{L}/u.test(after)) return [at, at + f.length]
      at = lower.indexOf(k, at + 1)
    }
  }
  return null
}

/** 通用的错拼法：换掉或去掉变音符号、双写或漏写一个字母、相邻两个字母对调 */
export function defaultMisspell(word: string, rand: () => number): string[] {
  const out = new Set<string>()
  const chars = [...word]
  const swaps: Record<string, string[]> = {
    é: ['e', 'è', 'ê'],
    è: ['é', 'e'],
    ê: ['é', 'e'],
    à: ['a', 'á'],
    â: ['a'],
    ç: ['c'],
    ô: ['o'],
    î: ['i'],
    û: ['u', 'ù'],
    á: ['a', 'à'],
    í: ['i', 'ì'],
    ó: ['o', 'ò'],
    ú: ['u', 'ù'],
    ñ: ['n'],
    ü: ['u'],
    ì: ['i', 'í'],
    ò: ['o', 'ó'],
    ù: ['u', 'ú']
  }
  chars.forEach((c, i) => {
    for (const s of swaps[c.toLowerCase()] ?? [])
      out.add([...chars.slice(0, i), s, ...chars.slice(i + 1)].join(''))
  })
  for (let i = 1; i < chars.length - 1; i++) {
    const c = chars[i]
    if (!/\p{L}/u.test(c)) continue
    if (chars[i + 1] === c) out.add([...chars.slice(0, i), ...chars.slice(i + 1)].join(''))
    else out.add([...chars.slice(0, i), c, ...chars.slice(i)].join(''))
    if (chars[i + 1] && chars[i + 1] !== c && /\p{L}/u.test(chars[i + 1]))
      out.add([...chars.slice(0, i), chars[i + 1], c, ...chars.slice(i + 2)].join(''))
  }
  out.delete(word)
  return shuffled([...out], rand)
}

interface Ctx {
  mod: LangModule
  db: PracticeDb
  locale: string
  level: string | null
  rand: () => number
}

type Maker = (c: Ctx, n: number) => ExamQuestion[]

const content = (w: PracticeWord): boolean => !SKIP_POS.has(w.p[0]) && w.w.length > 1

function pool(
  c: Ctx,
  need: ('gloss' | 'forms' | 'gender' | 'examples')[] = ['gloss']
): PracticeWord[] {
  const mine = c.db.words({ level: c.level, limit: 600, need }).filter(content)
  return mine.length >= 8 ? mine : c.db.words({ limit: 1200, need }).filter(content)
}

function explainWord(c: Ctx, w: PracticeWord, extra: Text[] = []): ExamQuestion['explain'] {
  const speech = c.mod.spec.features.speech
  return {
    lines: [both(`${w.d || w.w}：${w.zh || w.en}`, `${w.d || w.w}: ${w.en || w.zh}`), ...extra],
    ...(speech ? { say: { text: w.w, lang: speech, key: `lex-${w.id}` } } : {}),
    card: `lex-${w.id}`
  }
}

/** 三个意思不同的干扰项：同词性的优先 */
function wrongWords(c: Ctx, w: PracticeWord, all: PracticeWord[]): PracticeWord[] {
  const mine = glossOf(w)
  const out: PracticeWord[] = []
  const ranked = [
    ...shuffled(
      all.filter((x) => x.p[0] === w.p[0]),
      c.rand
    ),
    ...shuffled(all, c.rand)
  ]
  for (const x of ranked) {
    if (out.length >= 3) break
    if (x.id === w.id || x.w === w.w) continue
    const g = glossOf(x)
    if (sameText(g, mine) || out.some((y) => sameText(glossOf(y), g) || y.w === x.w)) continue
    out.push(x)
  }
  return out
}

const wordMeaning: Maker = (c, n) => {
  const all = pool(c)
  const out: ExamQuestion[] = []
  for (const w of shuffled(all, c.rand)) {
    if (out.length >= n) break
    const wrong = wrongWords(c, w, all)
    if (wrong.length < 3) continue
    out.push(
      question('word-meaning', out.length, {
        ask: { zh: '选出这个词的意思', en: 'Choose the meaning of this word' },
        prompt: {
          text: w.d || w.w,
          lang: c.mod.spec.bcp47,
          ...(w.rom ? { sub: w.rom } : w.ipa ? { sub: `/${w.ipa.replace(/^\/|\/$/g, '')}/` } : {})
        },
        ...arrange(
          { text: glossOf(w) },
          wrong.map((x) => ({ text: glossOf(x) })),
          c.rand
        ),
        explain: explainWord(c, w)
      })
    )
  }
  return out
}

const meaningWord: Maker = (c, n) => {
  const all = pool(c)
  const lang = c.mod.spec.bcp47
  const out: ExamQuestion[] = []
  for (const w of shuffled(all, c.rand)) {
    if (out.length >= n) break
    const wrong = wrongWords(c, w, all)
    if (wrong.length < 3) continue
    const g = c.locale.startsWith('zh') ? w.zh || w.en : w.en || w.zh
    out.push(
      question('meaning-word', out.length, {
        ask: { zh: '选出这个意思对应的词', en: 'Choose the word with this meaning' },
        prompt: { text: g },
        ...arrange(
          { text: w.d || w.w, lang },
          wrong.map((x) => ({ text: x.d || x.w, lang })),
          c.rand
        ),
        explain: explainWord(c, w)
      })
    )
  }
  return out
}

const listenWord: Maker = (c, n) => {
  const speech = c.mod.spec.features.speech
  if (!speech) return []
  const all = pool(c)
  const lang = c.mod.spec.bcp47
  const out: ExamQuestion[] = []
  for (const w of shuffled(all, c.rand)) {
    if (out.length >= n) break
    // 长短相近、开头一样的词先当干扰项
    const near = shuffled(all, c.rand)
      .filter((x) => x.id !== w.id && x.w !== w.w)
      .sort(
        (a, b) =>
          Number(b.w[0] === w.w[0]) - Number(a.w[0] === w.w[0]) ||
          Math.abs(a.w.length - w.w.length) - Math.abs(b.w.length - w.w.length)
      )
    const wrong = [...new Set(near.map((x) => x.d || x.w))].slice(0, 3)
    if (wrong.length < 3) continue
    out.push(
      question('listen-word', out.length, {
        ask: { zh: '听录音，选出听到的词', en: 'Listen and choose the word you hear' },
        prompt: { text: w.d || w.w, lang, listen: { text: w.w, lang: speech, key: `lex-${w.id}` } },
        ...arrange(
          { text: w.d || w.w, lang },
          wrong.map((x) => ({ text: x, lang })),
          c.rand
        ),
        explain: explainWord(c, w)
      })
    )
  }
  return out
}

const spelling: Maker = (c, n) => {
  const all = pool(c).filter((w) => [...w.w].length >= 4)
  const lang = c.mod.spec.bcp47
  const out: ExamQuestion[] = []
  for (const w of shuffled(all, c.rand)) {
    if (out.length >= n) break
    const variants = (c.mod.misspell ?? defaultMisspell)(w.w, c.rand).filter(
      (v) => v !== w.w && !c.db.lookup(v)
    )
    const wrong = [...new Set(variants)].slice(0, 3)
    if (wrong.length < 3) continue
    const g = c.locale.startsWith('zh') ? w.zh || w.en : w.en || w.zh
    out.push(
      question('spelling', out.length, {
        ask: { zh: '选出拼写正确的词', en: 'Choose the correct spelling' },
        prompt: { text: g, ...(w.ipa ? { sub: `/${w.ipa.replace(/^\/|\/$/g, '')}/` } : {}) },
        ...arrange(
          { text: w.w, lang },
          wrong.map((x) => ({ text: x, lang })),
          c.rand
        ),
        explain: explainWord(c, w)
      })
    )
  }
  return out
}

const gender: Maker = (c, n) => {
  const nouns = pool(c, ['gloss', 'gender']).filter((w) => w.p[0] === 'noun' && w.g)
  const genders = [...new Set(nouns.map((w) => w.g!))].filter((g) => g !== 'mf')
  if (genders.length < 2) return []
  const lang = c.mod.spec.bcp47
  const out: ExamQuestion[] = []
  for (const w of shuffled(nouns, c.rand)) {
    if (out.length >= n) break
    if (!genders.includes(w.g!)) continue
    const label = (g: string): Text => ({ zh: genderLabel(g, 'zh'), en: genderLabel(g, 'en') })
    out.push(
      question('gender', out.length, {
        ask: { zh: '选出这个名词的性', en: 'Choose the gender of this noun' },
        prompt: { text: w.d || w.w, lang, sub: glossOf(w) },
        ...arrange(
          { text: label(w.g!) },
          genders.filter((g) => g !== w.g).map((g) => ({ text: label(g) })),
          c.rand
        ),
        explain: explainWord(c, w, [label(w.g!)])
      })
    )
  }
  return out
}

const conjugate: Maker = (c, n) => {
  const words = pool(c, ['gloss', 'forms']).filter(
    (w) => w.forms.filter((f) => f.length > 1).length >= 4
  )
  const lang = c.mod.spec.bcp47
  const out: ExamQuestion[] = []
  for (const w of shuffled(words, c.rand)) {
    if (out.length >= n) break
    const forms = w.forms.filter((f) => f.length > 1 && f[0] !== w.w)
    const target = forms[Math.floor(c.rand() * forms.length)]
    if (!target) continue
    const tags = target.slice(1)
    const wrong = [
      ...new Set(
        shuffled(forms, c.rand)
          .map((f) => f[0])
          .filter((f) => f !== target[0])
      )
    ].slice(0, 3)
    if (wrong.length < 3) continue
    const zh = tagsLabel(tags, 'zh', c.mod.labels)
    const en = tagsLabel(tags, 'en', c.mod.labels)
    out.push(
      question('conjugate', out.length, {
        ask: { zh: `选出「${w.w}」的${zh}`, en: `Choose the ${en} of “${w.w}”` },
        prompt: { text: w.d || w.w, lang, sub: glossOf(w) },
        ...arrange(
          { text: target[0], lang },
          wrong.map((x) => ({ text: x, lang })),
          c.rand
        ),
        explain: explainWord(c, w, [both(`${zh}：${target[0]}`, `${en}: ${target[0]}`)])
      })
    )
  }
  return out
}

const context: Maker = (c, n) => {
  const words = pool(c, ['gloss', 'examples'])
  const lang = c.mod.spec.bcp47
  const out: ExamQuestion[] = []
  for (const w of shuffled(words, c.rand)) {
    if (out.length >= n) break
    const ex = c.db
      .examples(w.id, 6)
      .find((e) => (e.zh || e.en) && findWord(e.text, w, lang) && e.text.length < 140)
    if (!ex) continue
    const [s, e] = findWord(ex.text, w, lang)!
    const same = words.filter((x) => x.p[0] === w.p[0] && x.id !== w.id && x.w !== w.w)
    const surface = ex.text.slice(s, e)
    const wrong = [...new Set(shuffled(same, c.rand).map((x) => x.w))].slice(0, 3)
    if (wrong.length < 3) continue
    out.push(
      question('context', out.length, {
        ask: {
          zh: '看着译文，选出填进空里最合适的词',
          en: 'Using the translation, choose the word that best fits the blank'
        },
        prompt: { text: ex.text, lang, blank: [s, e], sub: translationOf(ex) },
        ...arrange(
          { text: surface, lang },
          wrong.map((x) => ({ text: x, lang })),
          c.rand
        ),
        explain: { ...explainWord(c, w, [translationOf(ex)]) }
      })
    )
  }
  return out
}

function sentenceQuestions(c: Ctx, n: number, listen: boolean): ExamQuestion[] {
  const speech = c.mod.spec.features.speech
  if (listen && !speech) return []
  const lang = c.mod.spec.bcp47
  // 韩文、阿语的完整短句不需要达到拉丁文字的字符数。
  const minLength = c.mod.spec.code === 'ko' ? 4 : 6
  let list = c.db
    .sentences(c.level, 300)
    .filter((e) => e.text.length >= minLength && e.text.length <= 160)
  if (list.length < 8)
    list = c.db
      .sentences(null, 600)
      .filter((e) => e.text.length >= minLength && e.text.length <= 160)
  const out: ExamQuestion[] = []
  const kind: PracticeKind = listen ? 'listen-sentence' : 'sentence'
  for (const ex of shuffled(list, c.rand)) {
    if (out.length >= n) break
    const mine = translationOf(ex)
    const wrong: Choice[] = []
    for (const x of shuffled(list, c.rand)) {
      const text = translationOf(x)
      if (x.id === ex.id || sameText(text, mine) || wrong.some((w) => sameText(w.text, text)))
        continue
      wrong.push({ text })
      if (wrong.length === 3) break
    }
    if (wrong.length < 3) continue
    out.push(
      question(kind, out.length, {
        ask: listen
          ? { zh: '听录音，选出这句话的意思', en: 'Listen and choose what the sentence means' }
          : { zh: '选出这句话的意思', en: 'Choose what this sentence means' },
        prompt: {
          text: ex.text,
          lang,
          ...(listen ? { listen: { text: ex.text, lang: speech! } } : {})
        },
        ...arrange({ text: mine }, wrong, c.rand),
        explain: {
          lines: [mine],
          ...(speech ? { say: { text: ex.text, lang: speech } } : {})
        }
      })
    )
  }
  return out
}

/** 能出语法题的语法点：例句写了 hl（在句子里找得到），或者有 patterns 能认 */
export const usableGrammar = (g: LexGrammarPoint): boolean =>
  g.examples.length > 0 &&
  (!!g.patterns?.length || g.examples.some((ex) => !!ex.hl && ex.text.includes(ex.hl)))

/** 语法点的例句里标出它的那一段：先用例句写的 hl，没有时用这门语言的规则分析、按 patterns 认 */
function grammarSpans(
  c: Ctx,
  g: LexGrammarPoint
): { text: string; zh?: string; en?: string; s: number; e: number }[] {
  const out: { text: string; zh?: string; en?: string; s: number; e: number }[] = []
  for (const ex of g.examples) {
    const at = ex.hl ? ex.text.indexOf(ex.hl) : -1
    if (at >= 0) {
      out.push({ ...ex, s: at, e: at + ex.hl!.length })
      continue
    }
    if (!g.patterns?.length) continue
    const a = c.db.analyze(ex.text)
    const hit = findGrammar(a.sentences, [g], c.mod.rules.key)[0]
    if (hit) out.push({ ...ex, s: hit.start, e: hit.end })
  }
  return out
}

function grammarQuestions(c: Ctx, n: number, fill: boolean): ExamQuestion[] {
  const points = (c.mod.grammar ?? []).filter(usableGrammar)
  if (points.length < 4) return []
  const order = c.mod.spec.levelSystems.find((s) => s.primary)!.levels.map((l) => l.id)
  const upTo = c.level ? order.indexOf(c.level) : order.length
  const mine = points.filter((g) => order.indexOf(g.level) <= upTo)
  const lang = c.mod.spec.bcp47
  const out: ExamQuestion[] = []
  const kind: PracticeKind = fill ? 'grammar-fill' : 'grammar-meaning'
  for (const g of shuffled(mine.length >= 4 ? mine : points, c.rand)) {
    if (out.length >= n) break
    const ex = grammarSpans(c, g)[0]
    if (!ex) continue
    const others = shuffled(points, c.rand).filter(
      (x) => x.id !== g.id && (!g.group || x.group !== g.group)
    )
    const tr = both(ex.zh ?? '', ex.en ?? '')
    if (fill) {
      const right = ex.text.slice(ex.s, ex.e)
      const wrong: string[] = []
      for (const o of others) {
        if (wrong.length >= 3) break
        const oe = grammarSpans(c, o)[0]
        const piece = oe?.text.slice(oe.s, oe.e)
        if (piece && piece !== right && !wrong.includes(piece)) wrong.push(piece)
      }
      if (wrong.length < 3) continue
      out.push(
        question(kind, out.length, {
          ask: {
            zh: '看着译文，选出填进空里的那一段',
            en: 'Using the translation, choose what fills the blank'
          },
          prompt: { text: ex.text, lang, blank: [ex.s, ex.e], sub: tr },
          ...arrange(
            { text: right, lang },
            wrong.map((w) => ({ text: w, lang })),
            c.rand
          ),
          explain: {
            lines: [
              both(
                `${g.name.zh ?? ''}：${g.meaning.zh ?? ''}`,
                `${g.name.en ?? ''}: ${g.meaning.en ?? ''}`
              ),
              tr
            ]
          }
        })
      )
    } else {
      const wrong: Choice[] = []
      for (const o of others) {
        if (sameText(o.meaning, g.meaning) || wrong.some((w) => sameText(w.text, o.meaning)))
          continue
        wrong.push({ text: o.meaning })
        if (wrong.length === 3) break
      }
      if (wrong.length < 3) continue
      out.push(
        question(kind, out.length, {
          ask: { zh: '标出的这一处是什么意思', en: 'What does the marked part mean?' },
          prompt: { text: ex.text, lang, mark: [ex.s, ex.e] },
          ...arrange({ text: g.meaning as Text }, wrong, c.rand),
          explain: { lines: [g.name as Text, tr] }
        })
      )
    }
  }
  return out
}

const MAKERS: Partial<Record<PracticeKind, Maker>> = {
  'word-meaning': wordMeaning,
  'meaning-word': meaningWord,
  'listen-word': listenWord,
  spelling,
  gender,
  conjugate,
  context,
  sentence: (c, n) => sentenceQuestions(c, n, false),
  'listen-sentence': (c, n) => sentenceQuestions(c, n, true),
  'grammar-fill': (c, n) => grammarQuestions(c, n, true),
  'grammar-meaning': (c, n) => grammarQuestions(c, n, false)
}

/** 这门语言的词典够出哪几种通用题（练习页只列这些；特有题型另由 LangModule.practice 给） */
export function practiceKindsFor(db: LexDb): PracticeKind[] {
  const s = db.practiceStats()
  const grammar = (LANGS[db.code].grammar ?? []).filter(usableGrammar).length
  const out: PracticeKind[] = []
  if (s.glossed >= 8) out.push('word-meaning', 'meaning-word', 'listen-word', 'spelling')
  if (s.genders >= 2) out.push('gender')
  if (s.forms >= 8) out.push('conjugate')
  if (s.linked >= 8) out.push('context')
  if (grammar >= 4) out.push('grammar-fill', 'grammar-meaning')
  if (s.sentences >= 8) out.push('sentence', 'listen-sentence')
  return out
}

/** 出一组题：kind 是通用题型，或 custom（这时 custom 是这门语言特有题型的 id） */
export function langPractice(
  db: LexDb,
  kind: string,
  level: string | null,
  n: number,
  seed: number,
  locale: string,
  custom?: string
): ExamQuestion[] {
  const mod = LANGS[db.code]
  const pdb = practiceDb(db, seed)
  const c: Ctx = { mod, db: pdb, locale, level, rand: pdb.rand }
  if (kind === 'custom') {
    const k = mod.practice?.find((x) => x.id === custom)
    if (!k) return []
    return k
      .make(pdb, level, n)
      .map((q, i) => ({ ...q, kind: 'custom', custom: k.id, id: `${k.id}-${i}` }))
  }
  const make = MAKERS[kind as PracticeKind]
  return make ? make(c, n) : []
}

/** 一张模拟卷（LangModule.exams 里 id 对上的那张） */
/** 本文练习：题面只取正文出现的词与语法，干扰项从同语言词库取。 */
export function langArticlePractice(
  db: LexDb,
  analysis: LexAnalysis,
  seed: number,
  locale: string,
  n = 10,
  article?: Omit<ArticleQuizInput, 'vocabulary' | 'seed'>
): ExamQuestion[] {
  const mod = LANGS[db.code]
  const pdb = practiceDb(db, seed)
  const c: Ctx = { mod, db: pdb, locale, level: analysis.level, rand: pdb.rand }
  const all = pool(c)
  const words = new Map<number, PracticeWord>()
  for (const sentence of analysis.sentences)
    for (const t of sentence.tokens) {
      if (!t.entry || !t.lemma || !t.pos || (!t.zh && !t.en) || SKIP_POS.has(t.pos)) continue
      words.set(t.entry, {
        id: t.entry,
        w: t.lemma,
        p: [t.pos],
        lv: t.lv ?? null,
        zh: t.zh ?? '',
        en: t.en ?? '',
        forms: []
      })
    }
  const out: ExamQuestion[] = []
  for (const w of shuffled([...words.values()], c.rand)) {
    const wrong = wrongWords(c, w, all)
    if (wrong.length < 3) continue
    out.push(
      question('word-meaning', out.length, {
        ask: { zh: '选出本文中这个词的意思', en: 'Choose the meaning of this word from the text' },
        prompt: { text: w.w, lang: mod.spec.bcp47 },
        ...arrange(
          { text: glossOf(w) },
          wrong.map((x) => ({ text: glossOf(x) })),
          c.rand
        ),
        explain: {
          ...explainWord(c, w),
          lines: [
            ...explainWord(c, w).lines,
            ...analysis.sentences
              .filter((s) => s.tokens.some((t) => t.entry === w.id))
              .slice(0, 1)
              .map((s) =>
                both(
                  `原文依据：${analysis.text.slice(s.start, s.end)}`,
                  `Source evidence: ${analysis.text.slice(s.start, s.end)}`
                )
              )
          ]
        }
      })
    )
    if (out.length >= n) break
  }
  const points = new Map((mod.grammar ?? []).map((g) => [g.id, g]))
  const seen = new Set<string>()
  const grammar: ExamQuestion[] = []
  for (const hit of shuffled(analysis.grammar, c.rand)) {
    const g = points.get(hit.id)
    const sentence = analysis.sentences[hit.sentence]
    if (!g || !sentence || seen.has(g.id)) continue
    seen.add(g.id)
    const wrong = shuffled([...points.values()], c.rand).filter(
      (x) => x.id !== g.id && (!g.group || x.group !== g.group) && !sameText(x.meaning, g.meaning)
    )
    const choices: Choice[] = []
    for (const x of wrong) {
      if (!choices.some((a) => sameText(a.text, x.meaning))) choices.push({ text: x.meaning })
      if (choices.length === 3) break
    }
    if (choices.length < 3) continue
    grammar.push(
      question('grammar-meaning', grammar.length, {
        ask: {
          zh: '本文标出的结构有什么作用？',
          en: 'What does the marked structure do in this text?'
        },
        prompt: {
          text: analysis.text.slice(sentence.start, sentence.end),
          lang: mod.spec.bcp47,
          mark: [hit.start - sentence.start, hit.end - sentence.start]
        },
        ...arrange({ text: g.meaning }, choices, c.rand),
        explain: { lines: [g.name, g.meaning, ...(g.notes ? [g.notes] : [])] }
      })
    )
    if (grammar.length >= 3) break
  }
  // 给语法留三个位置；最终题量按本文可用内容决定。
  const combined = [...out.slice(0, Math.max(0, n - grammar.length)), ...grammar].slice(0, n)
  const reading = makeArticleQuiz({
    id: article?.id ?? 'article',
    body: analysis.text,
    ...article,
    lang: mod.spec.bcp47,
    seed
  }).questions
  return [...shuffled(combined, c.rand).map((q, i) => ({ ...q, id: `article-${i}` })), ...reading]
}

export function langPaper(
  db: LexDb,
  examId: string,
  seed: number,
  locale: string
): ExamPaper | null {
  const mod = LANGS[db.code]
  const def = mod.exams?.find((e) => e.id === examId)
  if (!def) return null
  let k = 0
  const sections = def.sections.map((s) => ({
    id: s.id,
    title: s.title as Text,
    minutes: s.minutes,
    questions: s.parts.flatMap((p) => {
      const [kind, custom] = p.kind.startsWith('custom:')
        ? ['custom', p.kind.slice(7)]
        : [p.kind, undefined]
      return langPractice(db, kind, def.level, p.n, seed + ++k * 7919, locale, custom).map((q) => ({
        ...q,
        section: s.id
      }))
    })
  }))
  // 缺题时不能悄悄改变分项权重，也不能让空节进入考试页面。
  if (
    !sections.length ||
    sections.some(
      (s, i) =>
        !s.questions.length ||
        s.questions.length !== def.sections[i].parts.reduce((n, p) => n + p.n, 0)
    )
  )
    return null
  return {
    id: `${db.code}-${def.id}-${seed}`,
    level: def.level,
    title: def.title as Text,
    scoring: null,
    ...(def.rule ? { rule: def.rule } : {}),
    sections: sections.map((s, i) => ({
      ...s,
      questions: s.questions.map((q, j) => ({ ...q, id: `${i}-${j}-${q.id}` }))
    }))
  }
}
