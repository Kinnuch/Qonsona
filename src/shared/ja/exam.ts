/**
 * 日语的练习题与模拟卷：按 JLPT 等级自动出题；另有本文练习（用一篇文章里的词、语法、句子出题）。题目都由词典（词、读音、释义、例句）、语法课的例句、
 * 变形（conjugate.ts）与按级挑好的例句（scripts/data/examples-ja.ts → data/ja/level-sentences.json）生成，
 * 不照搬任何现成的考题。纯函数：数据由主进程从词典里取好了给（src/main/exam.ts），测试里直接用。
 *
 * 干扰项的来源：读法题是把正确读音改一处（清浊、长音、促音、拗音），写法题是同级别里写法相近的词，
 * 意思题是同级别别的词的释义，语法题沿用语法课（同一组意思相近的不互相当干扰项），变形题是常见的错形。
 */
import {
  grammarQuestion,
  rng,
  shuffled,
  exampleSpan,
  unitItems,
  usableExamples,
  type Course,
  type Text
} from '../course'
import type { Choice, ExamPaper, ExamQuestion, ExamSection, PracticeKind } from '../exam'
import { PRACTICE_SECTION } from '../exam'
import type { ConjugableWord } from '../dict'
import { conjugate, displayForm, formsOf, wrongForms } from './conjugate'
import { FORM_NAMES, formRule } from './forms-course'
import { hasKanji, kanaToRomaji, kanaUnits } from './kana'
import { GRAMMAR, GRAMMAR_BY_ID, type GrammarPoint } from './grammar'
import { GRAMMAR_NOTES } from './grammar-course'
import type { JaAnalysis } from './reader'
import { CONTENT_POS } from '../articles'
import { GRAMMAR_FUNCTION_ASK, GRAMMAR_SENTENCE_ASK } from '../question-semantics'

/** 出题用的一个词：词典里的词条，带几句用到它原样写法的例句 */
export interface ExamWord {
  id: number
  head: string
  reading: string
  /** 这个词条所有的假名读法（读法题的干扰项不能是其中之一） */
  readings: string[]
  /** 通常写假名（uk）：不出汉字读法、写法题 */
  uk: boolean
  pos: string[]
  zh: string
  en: string
  examples: ExampleLite[]
}

export interface ExampleLite {
  ja: string
  zh: string | null
  en: string | null
  zhMachine?: boolean
}

/** 按级挑好的例句：句子里最难的词正好是这一级 */
export interface LevelSentence extends ExampleLite {
  id: number
}

export interface LevelSentenceData {
  generated: string
  levels: Record<string, LevelSentence[]>
}

export interface JaExamData {
  /** 5 = N5 … 1 = N1 */
  level: number
  words: ExamWord[]
  sentences: LevelSentence[]
  /** 语法课（出语法题用这一级的单元） */
  grammar: Course | null
  /** 这一级能变形的动词、形容词 */
  verbs: ConjugableWord[]
}

/** 各级能出的题（N5 到 N1 都一样） */
export function jaPracticeKinds(_level: number): PracticeKind[] {
  return [
    'kanji-reading',
    'orthography',
    'word-meaning',
    'context',
    'grammar-fill',
    'grammar-meaning',
    'conjugate',
    'sentence',
    'listen-sentence',
    'listen-word'
  ]
}

/** 学习软件里不放的内容（Tatoeba 的例句里有一些）：课文、考题都不用 */
export const UNSUITABLE =
  /性病|不感症|セックス|殺|死ね|自殺|麻薬|売春|レイプ|テロ|暴行|暴動|手錠|ホモ|毛唐|野郎|性行為|梅毒|銃|弾丸/

// ───────────────────────── 读音的干扰项 ─────────────────────────

const VOICE: Record<string, string[]> = {
  か: ['が'],
  が: ['か'],
  き: ['ぎ'],
  ぎ: ['き'],
  く: ['ぐ'],
  ぐ: ['く'],
  け: ['げ'],
  げ: ['け'],
  こ: ['ご'],
  ご: ['こ'],
  さ: ['ざ'],
  ざ: ['さ'],
  し: ['じ'],
  じ: ['し'],
  す: ['ず'],
  ず: ['す'],
  せ: ['ぜ'],
  ぜ: ['せ'],
  そ: ['ぞ'],
  ぞ: ['そ'],
  た: ['だ'],
  だ: ['た'],
  て: ['で'],
  で: ['て'],
  と: ['ど'],
  ど: ['と'],
  は: ['ば', 'ぱ'],
  ば: ['は', 'ぱ'],
  ぱ: ['は', 'ば'],
  ひ: ['び', 'ぴ'],
  び: ['ひ', 'ぴ'],
  ぴ: ['ひ', 'び'],
  ふ: ['ぶ', 'ぷ'],
  ぶ: ['ふ', 'ぷ'],
  ぷ: ['ふ', 'ぶ'],
  へ: ['べ', 'ぺ'],
  べ: ['へ', 'ぺ'],
  ぺ: ['へ', 'べ'],
  ほ: ['ぼ', 'ぽ'],
  ぼ: ['ほ', 'ぽ'],
  ぽ: ['ほ', 'ぼ']
}
/** 长音：o 段加う、e 段加い（去掉时 a、i、u 段的也认：おかあさん → おかさん） */
const LENGTHEN: Record<string, string> = { a: 'あ', i: 'い', u: 'う', e: 'い', o: 'う' }
/** 加长音只加在 o、e 段后面（こう、せい 这种），加在别的段后面（かあみ）不像真词 */
const ADD_LONG = new Set(['o', 'e'])
const SMALL_TO_BIG: Record<string, string> = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ' }
/** 能在前面加促音的：か さ た ぱ 各行 */
const GEMINABLE = /^[かきくけこさしすせそたちつてとぱぴぷぺぽ]/

const vowelOf = (unit: string): string => kanaToRomaji(unit).slice(-1)

/**
 * 读音「改一处」的几种错法：清浊互换、长音加减、促音加减、拗音写成大字、ん 加减。
 * 每种错法先各挑一个，凑不够再补；不跟正确读音以及 exclude 里的读音（同一个词的别的读法）重
 */
export function readingDistractors(
  reading: string,
  rand: () => number,
  n = 3,
  exclude: ReadonlySet<string> = new Set()
): string[] {
  const u = kanaUnits(reading)
  const byKind: string[][] = [[], [], [], [], []]
  const put = (k: number, units: string[]): void => void byKind[k].push(units.join(''))
  u.forEach((x, i) => {
    // 清浊
    for (const v of VOICE[x[0]] ?? []) put(0, [...u.slice(0, i), v + x.slice(1), ...u.slice(i + 1)])
    // 长音：去掉拉长的那个、没有的加上
    const vw = vowelOf(x)
    const next = u[i + 1]
    if (next && next === LENGTHEN[vw] && x !== 'っ')
      put(1, [...u.slice(0, i + 1), ...u.slice(i + 2)])
    else if (ADD_LONG.has(vw) && x !== 'ん' && x !== 'っ' && next !== LENGTHEN[vw])
      put(1, [...u.slice(0, i + 1), LENGTHEN[vw], ...u.slice(i + 1)])
    // 促音
    if (x === 'っ') put(2, [...u.slice(0, i), ...u.slice(i + 1)])
    else if (i > 0 && GEMINABLE.test(x) && u[i - 1] !== 'っ' && u[i - 1] !== 'ん')
      put(2, [...u.slice(0, i), 'っ', ...u.slice(i)])
    // 拗音写成大字
    const small = SMALL_TO_BIG[x.slice(-1)]
    if (x.length === 2 && small) put(3, [...u.slice(0, i), x[0], small, ...u.slice(i + 1)])
    // ん
    if (x === 'ん') put(4, [...u.slice(0, i), ...u.slice(i + 1)])
  })
  const bad = (s: string): boolean => !s || s === reading || exclude.has(s)
  const out: string[] = []
  // 每种错法轮流挑一个，错法多样
  const lists = shuffled(
    byKind.map((l) => shuffled([...new Set(l)], rand)).filter((l) => l.length),
    rand
  )
  for (let round = 0; out.length < n && lists.some((l) => l.length); round++)
    for (const l of lists) {
      while (l.length && (bad(l[0]) || out.includes(l[0]))) l.shift()
      if (l.length && out.length < n) out.push(l.shift()!)
    }
  return out
}

// ───────────────────────── 小工具 ─────────────────────────

const both = (zh: string, en: string): Text => ({ zh: zh || en, en: en || zh })
const meaningOf = (w: { zh: string; en: string }): Text => both(w.zh, w.en)
const textKey = (t: Text): string => (typeof t === 'string' ? t : `${t.zh}|${t.en}`)
const ja = (text: string): Choice => ({ text, lang: 'ja' })

/** 答案放进选项里、打乱，记下答案在第几项 */
function arrange(
  right: Choice,
  wrong: Choice[],
  rand: () => number
): { choices: Choice[]; answer: number } {
  const choices = shuffled([right, ...wrong], rand)
  return { choices, answer: choices.indexOf(right) }
}

/** 例句的译文（中英都给；中文没有时用英文） */
const translationOf = (e: ExampleLite): Text => both(e.zh ?? '', e.en ?? '')

/** 词条那一行解析：写法（读音）：意思 */
function wordLine(w: ExamWord): Text {
  const head = w.head === w.reading ? w.head : `${w.head}（${w.reading}）`
  return both(`${head}：${w.zh || w.en}`, `${head}: ${w.en || w.zh}`)
}

/** 一句例句里原样出现这个词的位置 */
function findIn(e: ExampleLite, head: string): number {
  return e.ja.indexOf(head)
}

/** 词性大类：名词、动词、い形容词、な形容词、副词，其余不收 */
function posGroup(pos: string[]): string | null {
  for (const p of pos) {
    if (p.startsWith('v')) return 'v'
    if (p === 'adj-i' || p === 'adj-ix') return 'ai'
    if (p === 'adj-na') return 'an'
    if (p === 'adv') return 'adv'
    if (p === 'n') return 'n'
  }
  return null
}

// ───────────────────────── 各种题 ─────────────────────────

type Maker = (d: JaExamData, n: number, rand: () => number) => ExamQuestion[]

const question = (
  kind: PracticeKind,
  i: number,
  q: Omit<ExamQuestion, 'id' | 'kind' | 'section'>
): ExamQuestion => ({ id: `${kind}-${i}`, kind, section: PRACTICE_SECTION[kind], ...q })

/** 写法里有数字的（２０日）不出词汇题 */
const DIGITS = /[0-9０-９]/

/** 能出汉字题的词：写汉字（不是通常写假名的），读音跟写法不同 */
const kanjiWords = (d: JaExamData): ExamWord[] =>
  d.words.filter((w) => !w.uk && hasKanji(w.head) && w.head !== w.reading && !DIGITS.test(w.head))

const kanjiReading: Maker = (d, n, rand) => {
  const out: ExamQuestion[] = []
  for (const w of shuffled(kanjiWords(d), rand)) {
    if (out.length >= n) break
    const wrong = readingDistractors(w.reading, rand, 3, new Set(w.readings))
    if (wrong.length < 3) continue
    const ex = w.examples.find((e) => findIn(e, w.head) >= 0)
    const at = ex ? findIn(ex, w.head) : -1
    out.push(
      question('kanji-reading', out.length, {
        ask: ex
          ? { zh: '选出下划线词语的读法', en: 'Choose the reading of the underlined word' }
          : { zh: '选出这个词的读法', en: 'Choose the reading of this word' },
        prompt: ex
          ? { text: ex.ja, lang: 'ja', mark: [at, at + w.head.length], ruby: true }
          : { text: w.head, lang: 'ja' },
        ...arrange(ja(w.reading), wrong.map(ja), rand),
        explain: {
          lines: [wordLine(w), ...(ex ? [translationOf(ex)] : [])],
          say: { text: w.reading, lang: 'ja-JP' },
          card: `ja-${w.id}`
        }
      })
    )
  }
  return out
}

/** 写法相近的词：同样多个字、结尾的假名（送假名）一样，或者有同一个汉字；读音不同 */
function lookalikes(w: ExamWord, pool: ExamWord[], rand: () => number): string[] {
  const tail = (s: string): string => s.match(/[ぁ-ゖ]*$/)?.[0] ?? ''
  const kanji = new Set([...w.head].filter((c) => hasKanji(c)))
  const ok = pool.filter(
    (x) => x.head !== w.head && x.reading !== w.reading && !w.readings.includes(x.reading)
  )
  const near = ok.filter(
    (x) =>
      [...x.head].length === [...w.head].length &&
      (tail(x.head) === tail(w.head) || [...x.head].some((c) => kanji.has(c)))
  )
  const rest = ok.filter((x) => [...x.head].length === [...w.head].length)
  const picked: string[] = []
  for (const x of [...shuffled(near, rand), ...shuffled(rest, rand), ...shuffled(ok, rand)]) {
    if (picked.length >= 3) break
    if (!picked.includes(x.head)) picked.push(x.head)
  }
  return picked
}

const orthography: Maker = (d, n, rand) => {
  const pool = kanjiWords(d)
  const out: ExamQuestion[] = []
  for (const w of shuffled(pool, rand)) {
    if (out.length >= n) break
    const wrong = lookalikes(w, pool, rand)
    if (wrong.length < 3) continue
    const ex = w.examples.find((e) => findIn(e, w.head) >= 0)
    // 句子里这个词换成假名，下划线标在假名上
    const at = ex ? findIn(ex, w.head) : -1
    const text = ex ? ex.ja.slice(0, at) + w.reading + ex.ja.slice(at + w.head.length) : w.reading
    out.push(
      question('orthography', out.length, {
        ask: ex
          ? {
              zh: '选出下划线词语的汉字写法',
              en: 'Choose the kanji spelling of the underlined word'
            }
          : { zh: '选出这个词的汉字写法', en: 'Choose the kanji spelling of this word' },
        prompt: ex
          ? { text, lang: 'ja', mark: [at, at + w.reading.length], ruby: true }
          : { text, lang: 'ja' },
        ...arrange(ja(w.head), wrong.map(ja), rand),
        explain: {
          lines: [wordLine(w), ...(ex ? [translationOf(ex)] : [])],
          say: { text: w.reading, lang: 'ja-JP' },
          card: `ja-${w.id}`
        }
      })
    )
  }
  return out
}

const wordMeaning: Maker = (d, n, rand) => {
  const pool = d.words.filter((w) => (w.zh || w.en) && !DIGITS.test(w.head))
  const out: ExamQuestion[] = []
  for (const w of shuffled(pool, rand)) {
    if (out.length >= n) break
    const mine = meaningOf(w)
    const wrong: Text[] = []
    for (const x of shuffled(pool, rand)) {
      if (wrong.length >= 3) break
      const m = meaningOf(x)
      if (x.id === w.id || x.reading === w.reading) continue
      const same = (a: Text, b: Text): boolean =>
        typeof a !== 'string' && typeof b !== 'string' && (a.zh === b.zh || a.en === b.en)
      if (same(m, mine) || wrong.some((y) => same(y, m))) continue
      wrong.push(m)
    }
    if (wrong.length < 3) continue
    out.push(
      question('word-meaning', out.length, {
        ask: { zh: '选出这个词的意思', en: 'Choose the meaning of this word' },
        prompt: {
          text: w.head,
          lang: 'ja',
          ...(w.head !== w.reading && { sub: w.reading })
        },
        ...arrange(
          { text: mine },
          wrong.map((text) => ({ text })),
          rand
        ),
        explain: {
          lines: [wordLine(w)],
          say: { text: w.reading, lang: 'ja-JP' },
          card: `ja-${w.id}`
        }
      })
    )
  }
  return out
}

const context: Maker = (d, n, rand) => {
  const usable = d.words.filter(
    (w) =>
      [...w.head].length >= 2 &&
      !DIGITS.test(w.head) &&
      posGroup(w.pos) &&
      w.examples.some((e) => findIn(e, w.head) >= 0)
  )
  const out: ExamQuestion[] = []
  for (const w of shuffled(usable, rand)) {
    if (out.length >= n) break
    const g = posGroup(w.pos)
    const others = shuffled(
      d.words.filter((x) => posGroup(x.pos) === g && x.head !== w.head && x.reading !== w.reading),
      rand
    )
    const wrong = [...new Set(others.map((x) => x.head))].slice(0, 3)
    if (wrong.length < 3) continue
    const ex = w.examples.find((e) => findIn(e, w.head) >= 0)!
    const at = findIn(ex, w.head)
    out.push(
      question('context', out.length, {
        ask: {
          zh: '看着译文，选出填进空里最合适的词',
          en: 'Using the translation, choose the word that best fits the blank'
        },
        prompt: {
          text: ex.ja,
          lang: 'ja',
          blank: [at, at + w.head.length],
          ruby: true,
          sub: translationOf(ex)
        },
        ...arrange(ja(w.head), wrong.map(ja), rand),
        explain: {
          lines: [wordLine(w), translationOf(ex)],
          say: { text: ex.ja, lang: 'ja-JP' },
          card: `ja-${w.id}`
        }
      })
    )
  }
  return out
}

/** 语法题：从语法课这一级的单元里出，干扰项沿用语法课的规则 */
function grammarMaker(type: 'fill' | 'meaning'): Maker {
  return (d, n, rand) => {
    const c = d.grammar
    const unit = c?.units.find((u) => u.id === `n${d.level}`)
    if (!c || !unit) return []
    const keys = unitItems(unit).filter((k) => usableExamples(c.grammar[k]).length)
    const out: ExamQuestion[] = []
    for (const k of shuffled(keys, rand)) {
      if (out.length >= n) break
      const g = c.grammar[k]
      const ex = shuffled(usableExamples(g), rand)[0]
      const q = grammarQuestion(c, type, k, ex, keys, keys, rand)
      if (!q || (q.type !== 'fill' && q.type !== 'meaning')) continue
      const e = g.examples[ex]
      const kind: PracticeKind = type === 'fill' ? 'grammar-fill' : 'grammar-meaning'
      const choices: Choice[] =
        q.type === 'fill'
          ? q.choices.map(ja)
          : q.choices.map((key) => ({
              text: q.sentenceChoices?.[key] ?? c.grammar[key].meaning
            }))
      const answer = q.type === 'fill' ? q.choices.indexOf(exampleSpan(e)) : q.choices.indexOf(k)
      out.push(
        question(kind, out.length, {
          ask:
            type === 'fill'
              ? {
                  zh: '看着译文，选出填进空里的一项',
                  en: 'Using the translation, choose what fills the blank'
                }
              : q.type === 'meaning' && q.sentenceChoices
                ? GRAMMAR_SENTENCE_ASK
                : GRAMMAR_FUNCTION_ASK,
          prompt: {
            text: e.ja,
            lang: 'ja',
            ruby: true,
            ...(type === 'fill'
              ? { blank: [e.start, e.end] as [number, number], sub: translationOf(e) }
              : { mark: [e.start, e.end] as [number, number] })
          },
          choices,
          answer,
          explain: {
            lines: [
              both(`${g.name}：${g.meaning.zh ?? ''}`, `${g.name}: ${g.meaning.en ?? ''}`),
              both(`接续：${g.form}`, `Form: ${g.form}`),
              translationOf(e)
            ],
            say: { text: e.ja, lang: 'ja-JP' }
          }
        })
      )
    }
    return out
  }
}

const conjugateMaker: Maker = (d, n, rand) => {
  const out: ExamQuestion[] = []
  for (const w of shuffled(d.verbs, rand)) {
    if (out.length >= n) break
    const form = shuffled(formsOf(w.cls), rand)[0]
    const c = conjugate(w, form)
    if (!c) continue
    const wrong = wrongForms(w, form).map((x) => displayForm(w, x))
    if (wrong.length < 3) continue
    const name = FORM_NAMES[form] as Record<string, string>
    const right = displayForm(w, c)
    const rule = formRule(form, w.cls)
    out.push(
      question('conjugate', out.length, {
        ask: { zh: `选出它的「${name.zh}」`, en: `Choose its ${name.en}` },
        prompt: { text: w.head, lang: 'ja', ...(w.head !== w.reading && { sub: w.reading }) },
        ...arrange(ja(right), wrong.map(ja), rand),
        explain: {
          lines: [
            both(
              `${w.head} → ${right}${c.reading !== right ? `（${c.reading}）` : ''}`,
              `${w.head} → ${right}${c.reading !== right ? ` (${c.reading})` : ''}`
            ),
            ...(rule ? [rule] : [])
          ],
          say: { text: c.reading, lang: 'ja-JP' },
          card: `ja-${w.id}`
        }
      })
    )
  }
  return out
}

/** 看 / 听一句话选意思：干扰项是同一级别的句子的译文 */
function sentenceMaker(kind: 'sentence' | 'listen-sentence'): Maker {
  return (d, n, rand) => {
    const pool = d.sentences.filter((s) => s.zh || s.en)
    const out: ExamQuestion[] = []
    for (const s of shuffled(pool, rand)) {
      if (out.length >= n) break
      const mine = translationOf(s)
      const wrong: Text[] = []
      for (const x of shuffled(pool, rand)) {
        if (wrong.length >= 3) break
        const m = translationOf(x)
        if (
          x.id === s.id ||
          textKey(m) === textKey(mine) ||
          wrong.some((y) => textKey(y) === textKey(m))
        )
          continue
        wrong.push(m)
      }
      if (wrong.length < 3) continue
      out.push(
        question(kind, out.length, {
          ask:
            kind === 'sentence'
              ? { zh: '选出这句话的意思', en: 'Choose the meaning of this sentence' }
              : { zh: '请听，选出这句话的意思', en: 'Listen and choose what the sentence means' },
          prompt: {
            text: s.ja,
            lang: 'ja',
            ruby: true,
            ...(kind === 'listen-sentence' && { listen: { text: s.ja, lang: 'ja-JP' } })
          },
          ...arrange(
            { text: mine },
            wrong.map((text) => ({ text })),
            rand
          ),
          explain: { lines: [both(s.ja, s.ja), mine], say: { text: s.ja, lang: 'ja-JP' } }
        })
      )
    }
    return out
  }
}

/** 听词选词：干扰项是读音一样长、开头或结尾的假名一样的词 */
const listenWord: Maker = (d, n, rand) => {
  const out: ExamQuestion[] = []
  const pool = d.words.filter((w) => kanaUnits(w.reading).length >= 2 && !DIGITS.test(w.head))
  for (const w of shuffled(pool, rand)) {
    if (out.length >= n) break
    const len = kanaUnits(w.reading).length
    const others = pool.filter(
      (x) => x.reading !== w.reading && x.head !== w.head && !w.readings.includes(x.reading)
    )
    const near = others.filter(
      (x) =>
        kanaUnits(x.reading).length === len &&
        (x.reading[0] === w.reading[0] || x.reading.slice(-1) === w.reading.slice(-1))
    )
    const wrong = [
      ...new Set([...shuffled(near, rand), ...shuffled(others, rand)].map((x) => x.head))
    ].slice(0, 3)
    if (wrong.length < 3) continue
    out.push(
      question('listen-word', out.length, {
        ask: { zh: '请听，选出听到的词', en: 'Listen and choose the word you hear' },
        prompt: { text: w.head, lang: 'ja', listen: { text: w.reading, lang: 'ja-JP' } },
        ...arrange(ja(w.head), wrong.map(ja), rand),
        explain: {
          lines: [wordLine(w)],
          say: { text: w.reading, lang: 'ja-JP' },
          card: `ja-${w.id}`
        }
      })
    )
  }
  return out
}

const MAKERS: Record<string, Maker> = {
  'kanji-reading': kanjiReading,
  orthography,
  'word-meaning': wordMeaning,
  context,
  'grammar-fill': grammarMaker('fill'),
  'grammar-meaning': grammarMaker('meaning'),
  conjugate: conjugateMaker,
  sentence: sentenceMaker('sentence'),
  'listen-sentence': sentenceMaker('listen-sentence'),
  'listen-word': listenWord
}

/** 一组练习：某一种题出 n 道 */
export function jaPractice(
  d: JaExamData,
  kind: PracticeKind,
  n: number,
  seed: number
): ExamQuestion[] {
  const make = MAKERS[kind]
  return make ? make(d, n, rng(seed)) : []
}

/** 模拟卷有哪几级 */
export const PAPER_LEVELS = [5, 4, 3, 2, 1]

/** 模拟卷的一节：限时几分钟、出哪几种题各几道 */
export interface PaperSectionLayout {
  id: ExamSection
  title: Text
  minutes: number
  parts: [PracticeKind, number][]
}

const READING_TITLE: Text = { zh: '读解', en: 'Reading' }

/** 模拟卷的四节；N3 起读解单独计 60 分，题多一些、时间长一些 */
export function paperLayout(level: number): PaperSectionLayout[] {
  return PAPER_LAYOUT.map((s) =>
    s.id === 'reading' && level <= 3
      ? { id: 'reading', title: READING_TITLE, minutes: 15, parts: [['sentence', 10]] }
      : s
  )
}

/** 模拟卷的结构：几节、多少题、限时多久 */
export function paperShape(level: number): { sections: number; n: number; m: number } {
  const layout = paperLayout(level)
  return {
    sections: layout.length,
    n: layout.reduce((a, s) => a + s.parts.reduce((b, [, k]) => b + k, 0), 0),
    m: layout.reduce((a, s) => a + s.minutes, 0)
  }
}

/** N5、N4 模拟卷的四节 */
const PAPER_LAYOUT: PaperSectionLayout[] = [
  {
    id: 'vocab',
    title: { zh: '文字·词汇', en: 'Vocabulary' },
    minutes: 15,
    parts: [
      ['kanji-reading', 7],
      ['orthography', 5],
      ['context', 6],
      ['word-meaning', 5]
    ]
  },
  {
    id: 'grammar',
    title: { zh: '语法', en: 'Grammar' },
    minutes: 15,
    parts: [
      ['grammar-fill', 9],
      ['grammar-meaning', 4],
      ['conjugate', 3]
    ]
  },
  { id: 'reading', title: READING_TITLE, minutes: 10, parts: [['sentence', 6]] },
  {
    id: 'listening',
    title: { zh: '听解', en: 'Listening' },
    minutes: 10,
    parts: [
      ['listen-sentence', 5],
      ['listen-word', 4]
    ]
  }
]

/**
 * 一张模拟卷：按 JLPT 的结构分四节（文字·词汇、语法、读解、听解），题量比正式考试少，时间相应缩短；
 * 计分按 JLPT 的办法换算
 */
export function jaPaper(d: JaExamData, seed: number): ExamPaper {
  const rand = rng(seed)
  const take = (kind: PracticeKind, n: number): ExamQuestion[] =>
    MAKERS[kind](d, n, rng(Math.floor(rand() * 2 ** 31)))
  return {
    id: `N${d.level}-${seed}`,
    level: `N${d.level}`,
    title: { zh: `N${d.level} 模拟卷`, en: `N${d.level} mock exam` },
    scoring: `jlpt-n${d.level}`,
    sections: paperLayout(d.level).map((s) => ({
      id: s.id,
      title: s.title,
      minutes: s.minutes,
      questions: s.parts
        .flatMap(([kind, n]) => take(kind, n))
        .map((q, i) => ({ ...q, id: `${q.id}-${i}` }))
    }))
  }
}

// ───────────────────────── 本文练习 ─────────────────────────

/** 本文练习要用的：文章的分析结果（词带词典的词条号与等级）、文中的词条、同级的词（凑干扰项） */
export interface ArticlePracticeData {
  analysis: JaAnalysis
  /** 文中的词条做成的出题用的词（不带例句） */
  words: ExamWord[]
  /** 跟文章同一级的词：凑意思题的干扰项 */
  pool: ExamWord[]
  /** 能不能出听力题（有日语语音） */
  listen: boolean
}

/** 一句太长的不拿来出题（文学作品里一句一两百字的常有） */
const ARTICLE_SENTENCE_MAX = 80

/**
 * 本文练习：用这篇文章里的词、语法、句子出一组题——下划线的词的意思、汉字词的读法、
 * 标出的语法点的意思、听一句选出是哪一句。几种题按比例出，哪种凑不够由别的补上
 */
export function jaArticlePractice(d: ArticlePracticeData, seed: number, n = 10): ExamQuestion[] {
  const rand = rng(seed)
  const text = d.analysis.text
  const byId = new Map(d.words.map((w) => [w.id, w]))
  const sentenceOf = (i: number): { s: string; at: number } => {
    const s = d.analysis.sentences[i]
    return { s: text.slice(s.start, s.end), at: s.start }
  }
  const tooLong = (i: number): boolean => {
    const s = d.analysis.sentences[i]
    return !s || s.end - s.start > ARTICLE_SENTENCE_MAX
  }

  // 文中的实词：每个词条只取第一次出现（句子不太长的那一处）；难的在前，同级的打乱
  const seen = new Set<number>()
  const jlpt = new Map<number, number | null>()
  const occ: { w: ExamWord; surface: string; si: number; start: number; end: number }[] = []
  d.analysis.sentences.forEach((s, si) => {
    for (const x of s.words) {
      const w = x.entryId ? byId.get(x.entryId) : undefined
      if (!w || !x.word || seen.has(w.id) || tooLong(si)) continue
      if (!CONTENT_POS.has(x.pos) || DIGITS.test(x.surface) || !(w.zh || w.en)) continue
      seen.add(w.id)
      jlpt.set(w.id, x.jlpt ?? null)
      occ.push({ w, surface: x.surface, si, start: x.start, end: x.end })
    }
  })
  const rank = (w: ExamWord): number => jlpt.get(w.id) ?? 6
  const words = shuffled(occ, rand).sort((a, b) => rank(a.w) - rank(b.w))

  // 意思：干扰项是同级的词与文中别的词的释义
  const meaningQs: ExamQuestion[] = []
  const pool = [...d.pool, ...d.words].filter((w) => w.zh || w.en)
  const same = (a: Text, b: Text): boolean =>
    typeof a !== 'string' && typeof b !== 'string' && (a.zh === b.zh || a.en === b.en)
  for (const o of words) {
    if (meaningQs.length >= n) break
    const mine = meaningOf(o.w)
    const wrong: Text[] = []
    for (const x of shuffled(pool, rand)) {
      if (wrong.length >= 3) break
      const m = meaningOf(x)
      if (x.id === o.w.id || x.reading === o.w.reading) continue
      if (same(m, mine) || wrong.some((y) => same(y, m))) continue
      wrong.push(m)
    }
    if (wrong.length < 3) continue
    const { s, at } = sentenceOf(o.si)
    meaningQs.push(
      question('word-meaning', meaningQs.length, {
        ask: { zh: '选出下划线词语的意思', en: 'Choose the meaning of the underlined word' },
        prompt: { text: s, lang: 'ja', mark: [o.start - at, o.end - at], ruby: true },
        ...arrange(
          { text: mine },
          wrong.map((m) => ({ text: m })),
          rand
        ),
        explain: {
          lines: [wordLine(o.w)],
          say: { text: o.w.reading, lang: 'ja-JP' },
          card: `ja-${o.w.id}`
        }
      })
    )
  }

  // 读法：写汉字、原样出现在文中（没变形）的词
  const readingQs: ExamQuestion[] = []
  for (const o of words) {
    if (readingQs.length >= n) break
    const w = o.w
    if (w.uk || !hasKanji(w.head) || o.surface !== w.head || w.head === w.reading) continue
    const wrong = readingDistractors(w.reading, rand, 3, new Set(w.readings))
    if (wrong.length < 3) continue
    const { s, at } = sentenceOf(o.si)
    readingQs.push(
      question('kanji-reading', readingQs.length, {
        ask: { zh: '选出下划线词语的读法', en: 'Choose the reading of the underlined word' },
        prompt: { text: s, lang: 'ja', mark: [o.start - at, o.end - at], ruby: true },
        ...arrange(ja(w.reading), wrong.map(ja), rand),
        explain: {
          lines: [wordLine(w)],
          say: { text: w.reading, lang: 'ja-JP' },
          card: `ja-${w.id}`
        }
      })
    )
  }

  // 语法：文中认出的语法点（基础的不算）选意思；干扰项是等级相近、不同组的语法点
  const grammarQs: ExamQuestion[] = []
  const meaningOfPoint = (g: GrammarPoint): Text => both(g.zh, g.en)
  const groupOf = (id: string): string | undefined => GRAMMAR_NOTES[id]?.group
  const asked = new Set<string>()
  for (const h of shuffled(d.analysis.grammar, rand)) {
    if (grammarQs.length >= n) break
    const g = GRAMMAR_BY_ID.get(h.id)
    if (!g || g.basic || asked.has(g.id) || tooLong(h.sentence)) continue
    const others = shuffled(
      GRAMMAR.filter(
        (x) =>
          x.id !== g.id &&
          !x.basic &&
          Math.abs(x.level - g.level) <= 1 &&
          (!groupOf(g.id) || groupOf(x.id) !== groupOf(g.id)) &&
          x.zh !== g.zh
      ),
      rand
    ).slice(0, 3)
    if (others.length < 3) continue
    asked.add(g.id)
    const { s, at } = sentenceOf(h.sentence)
    grammarQs.push(
      question('grammar-meaning', grammarQs.length, {
        ask: GRAMMAR_FUNCTION_ASK,
        prompt: { text: s, lang: 'ja', mark: [h.start - at, h.end - at], ruby: true },
        ...arrange(
          { text: meaningOfPoint(g) },
          others.map((x) => ({ text: meaningOfPoint(x) })),
          rand
        ),
        explain: {
          lines: [both(`${g.name}（N${g.level}）：${g.zh}`, `${g.name} (N${g.level}): ${g.en}`)]
        }
      })
    )
  }

  // 听力：放一句，从文中的四句里选出是哪一句
  const listenQs: ExamQuestion[] = []
  if (d.listen) {
    const lines = [
      ...new Set(
        d.analysis.sentences
          .map((s) => text.slice(s.start, s.end).trim())
          .filter((s) => [...s].length >= 6 && [...s].length <= 40)
      )
    ]
    if (lines.length >= 4)
      for (const s of shuffled(lines, rand)) {
        if (listenQs.length >= n) break
        const wrong = shuffled(
          lines.filter((x) => x !== s),
          rand
        ).slice(0, 3)
        listenQs.push(
          question('listen-sentence', listenQs.length, {
            ask: { zh: '请听，选出听到的句子', en: 'Listen and choose the sentence you hear' },
            prompt: { text: s, lang: 'ja', ruby: true, listen: { text: s, lang: 'ja-JP' } },
            ...arrange(ja(s), wrong.map(ja), rand),
            explain: { lines: [s], say: { text: s, lang: 'ja-JP' } }
          })
        )
      }
  }

  // 意思、读法、语法、听力按 4 : 2 : 2 : 2 出，哪种不够由别的补
  const lists = [meaningQs, readingQs, grammarQs, listenQs]
  const quota = [4, 2, 2, 2].map((q) => Math.round((q * n) / 10))
  const out: ExamQuestion[] = []
  lists.forEach((l, i) => out.push(...l.splice(0, quota[i])))
  for (const l of lists) while (out.length < n && l.length) out.push(l.shift()!)
  return shuffled(out.slice(0, n), rand)
}
