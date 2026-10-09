/**
 * 练习与模拟考（M5）里跟语言无关的部分：题目、试卷、判分。
 * 题目自己带齐题面、选项、答案与解析，存进历史记录后换了数据也能照原样回看。
 * 日语的题由主进程按词典、例句、语法与变形出（src/shared/ja/exam.ts + src/main/exam.ts），
 * 千语集语言的由界面按项目数据出（lib/practice/qonlang.ts）。
 */
import type { Sound, Text } from './course'

/** 试卷上的几节：文字·词汇、语法、读解、听解 */
export type ExamSection = 'vocab' | 'grammar' | 'reading' | 'listening'

export type PracticeKind =
  /** 看汉字词选读音 */
  | 'kanji-reading'
  /** 看假名选汉字写法 */
  | 'orthography'
  /** 看词选意思 */
  | 'word-meaning'
  /** 看意思选词 */
  | 'meaning-word'
  /** 选填进句子的词 */
  | 'context'
  /** 语法填空 */
  | 'grammar-fill'
  /** 标出的语法点是什么意思 */
  | 'grammar-meaning'
  /** 选出正确的变形 */
  | 'conjugate'
  /** 看句子选意思 */
  | 'sentence'
  /** 听句子选意思 */
  | 'listen-sentence'
  /** 听词选词 */
  | 'listen-word'
  /** 音变：看原始语的形式，按音变规律选出它在这门语言里变成的样子（千语集语言，有词源与音变规则时） */
  | 'sound-change'

export const PRACTICE_SECTION: Record<PracticeKind, ExamSection> = {
  'kanji-reading': 'vocab',
  orthography: 'vocab',
  'word-meaning': 'vocab',
  'meaning-word': 'vocab',
  context: 'vocab',
  'grammar-fill': 'grammar',
  'grammar-meaning': 'grammar',
  conjugate: 'grammar',
  sentence: 'reading',
  'listen-sentence': 'listening',
  'listen-word': 'listening',
  'sound-change': 'vocab'
}

export interface Choice {
  text: Text
  lang?: string
  scriptId?: string
}

export interface ExamQuestion {
  id: string
  kind: PracticeKind
  section: ExamSection
  /** 题干：请……（按界面语言挑） */
  ask: Text
  prompt: {
    text: string
    lang?: string
    /** 标出的一段（下划线）；读法题答完之前这一段不注音 */
    mark?: [number, number]
    /** 挖掉的一段 */
    blank?: [number, number]
    /** 句子注振假名（日语） */
    ruby?: boolean
    /** 题面下的小字：读音、译文 */
    sub?: Text
    /** 听力题：先放音，答完才显示题面 */
    listen?: Sound
    scriptId?: string
  }
  choices: Choice[]
  answer: number
  /**
   * 解析：几行说明，可以朗读；card 是生词本里卡片的键（日语 ja-<词条号>，千语集 lexeme-<id>），
   * 有它的可以加进生词本
   */
  explain: { lines: Text[]; say?: Sound; card?: string }
}

export interface PaperSection {
  id: ExamSection
  title: Text
  minutes: number
  questions: ExamQuestion[]
}

export interface ExamPaper {
  id: string
  /** 等级（N5） */
  level: string
  title: Text
  /** 按哪种计分办法换算（jlpt-n5 …）；null 只算答对几题 */
  scoring: string | null
  sections: PaperSection[]
}

/** 每节答了哪一项（没答是 null） */
export type PaperAnswers = (number | null)[][]

export interface SectionScore {
  id: ExamSection
  right: number
  total: number
}

/** 换算后的一个计分部分（JLPT 的「言语知识·读解」「听解」；N3 起「言语知识」「读解」「听解」） */
export interface ScaledPart {
  name: Text
  score: number
  max: number
  /** 基准分：低于它整场不及格 */
  min: number
  ok: boolean
}

export interface ExamOutcome {
  sections: SectionScore[]
  right: number
  total: number
  parts: ScaledPart[] | null
  /** 换算后的总分、及格线、过没过（只算答对几题的是 null） */
  scaled: number | null
  pass: number | null
  passed: boolean | null
}

interface Scoring {
  parts: { name: Text; sections: ExamSection[]; max: number; min: number }[]
  pass: number
}

const KNOWLEDGE_READING: Text = {
  zh: '言语知识（文字·词汇·语法）·读解',
  en: 'Language knowledge (vocabulary, grammar) and reading'
}
const LISTENING: Text = { zh: '听解', en: 'Listening' }
const KNOWLEDGE: Text = {
  zh: '言语知识（文字·词汇·语法）',
  en: 'Language knowledge (vocabulary, grammar)'
}
const READING: Text = { zh: '读解', en: 'Reading' }

/** N3 起分三部分，各 60 分，基准分都是 19 */
const threeParts = (pass: number): Scoring => ({
  parts: [
    { name: KNOWLEDGE, sections: ['vocab', 'grammar'], max: 60, min: 19 },
    { name: READING, sections: ['reading'], max: 60, min: 19 },
    { name: LISTENING, sections: ['listening'], max: 60, min: 19 }
  ],
  pass
})

/**
 * JLPT 的计分办法：N5、N4 分两部分（言语知识·读解 120、听解 60），N3 起分三部分（各 60），
 * 合格线与各部分基准分按官方公布的
 */
export const SCORING: Record<string, Scoring> = {
  'jlpt-n5': {
    parts: [
      { name: KNOWLEDGE_READING, sections: ['vocab', 'grammar', 'reading'], max: 120, min: 38 },
      { name: LISTENING, sections: ['listening'], max: 60, min: 19 }
    ],
    pass: 80
  },
  'jlpt-n4': {
    parts: [
      { name: KNOWLEDGE_READING, sections: ['vocab', 'grammar', 'reading'], max: 120, min: 38 },
      { name: LISTENING, sections: ['listening'], max: 60, min: 19 }
    ],
    pass: 90
  },
  'jlpt-n3': threeParts(95),
  'jlpt-n2': threeParts(90),
  'jlpt-n1': threeParts(100)
}

/** 判一张卷子：每节答对几题；有计分办法的按答对的比例换算成分数（仅供参考） */
export function scorePaper(paper: ExamPaper, answers: PaperAnswers): ExamOutcome {
  const sections: SectionScore[] = paper.sections.map((s, i) => ({
    id: s.id,
    right: s.questions.filter((q, j) => answers[i]?.[j] === q.answer).length,
    total: s.questions.length
  }))
  const right = sections.reduce((n, s) => n + s.right, 0)
  const total = sections.reduce((n, s) => n + s.total, 0)
  const rule = paper.scoring ? SCORING[paper.scoring] : null
  if (!rule) return { sections, right, total, parts: null, scaled: null, pass: null, passed: null }
  const parts: ScaledPart[] = rule.parts.map((p) => {
    const mine = sections.filter((s) => p.sections.includes(s.id))
    const r = mine.reduce((n, s) => n + s.right, 0)
    const t = mine.reduce((n, s) => n + s.total, 0)
    const score = t ? Math.round((p.max * r) / t) : 0
    return { name: p.name, score, max: p.max, min: p.min, ok: score >= p.min }
  })
  const scaled = parts.reduce((n, p) => n + p.score, 0)
  return {
    sections,
    right,
    total,
    parts,
    scaled,
    pass: rule.pass,
    passed: scaled >= rule.pass && parts.every((p) => p.ok)
  }
}

/** 做过的一张卷子（历史记录里存着整张卷子与答案，可以回看解析） */
export interface ExamRecord {
  id: string
  level: string
  at: number
  /** 用了多少秒 */
  seconds: number
  paper: ExamPaper
  answers: PaperAnswers
  outcome: ExamOutcome
}

/** 练习与模拟考的记录：每门语言一个文件 userData/practice/<包 id>.json */
export interface PracticeLog {
  version: 1
  exams: ExamRecord[]
  /** 每天做了几题、答对几题（统计页用） */
  days: Record<string, { answered: number; right: number }>
}

/** 历史里最多留几张卷子 */
export const MAX_EXAMS = 20

export const emptyPracticeLog = (): PracticeLog => ({ version: 1, exams: [], days: {} })

export function normalizePracticeLog(raw: unknown): PracticeLog {
  const log = emptyPracticeLog()
  if (!raw || typeof raw !== 'object') return log
  const r = raw as Partial<PracticeLog>
  if (Array.isArray(r.exams))
    log.exams = r.exams
      .filter((e) => e && typeof e === 'object' && e.paper && Array.isArray(e.answers))
      .slice(-MAX_EXAMS)
  for (const [k, v] of Object.entries(r.days ?? {}))
    if (v && typeof v === 'object')
      log.days[k] = { answered: Number(v.answered) || 0, right: Number(v.right) || 0 }
  return log
}

/** 把这一天做的题记进去 */
export function countDay(log: PracticeLog, day: string, answered: number, right: number): void {
  const d = (log.days[day] ??= { answered: 0, right: 0 })
  d.answered += answered
  d.right += right
}
