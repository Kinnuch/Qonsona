/**
 * 日语的练习与模拟卷（主进程）：从词典里取出某一级的词、例句与动词，连同随程序带着的语法课例句、
 * 按级挑好的例句，交给 src/shared/ja/exam.ts 出题。每一级的数据第一次用时取，之后留着。
 */
import type { JapaneseDict } from './dict'
import type { ExamPaper, ExamQuestion, PracticeKind } from '../shared/exam'
import {
  jaArticlePractice,
  jaPaper,
  jaPractice,
  type JaExamData,
  type LevelSentenceData
} from '../shared/ja/exam'
import type { JaAnalysis } from '../shared/ja/reader'
import { jaGrammarCourse, type GrammarExampleData } from '../shared/ja/grammar-course'
import levelSentences from '../../data/ja/level-sentences.json'
import grammarExamples from '../../data/ja/grammar-examples.json'

export class JaExams {
  #dict: () => JapaneseDict | null
  #cache = new Map<number, JaExamData>()

  constructor(dict: () => JapaneseDict | null) {
    this.#dict = dict
  }

  /** 这一级出题要用的数据；没有词典数据库时是 null */
  #data(level: number): JaExamData | null {
    const hit = this.#cache.get(level)
    if (hit) return hit
    const dict = this.#dict()
    if (!dict) return null
    const d: JaExamData = {
      level,
      words: dict.examWords(level),
      sentences: (levelSentences as unknown as LevelSentenceData).levels[String(level)] ?? [],
      grammar: jaGrammarCourse(grammarExamples as unknown as GrammarExampleData),
      verbs: dict.conjugables([level])
    }
    this.#cache.set(level, d)
    return d
  }

  practice(kind: PracticeKind, level: number, n: number, seed: number): ExamQuestion[] {
    const d = this.#data(level)
    return d ? jaPractice(d, kind, n, seed) : []
  }

  paper(level: number, seed: number): ExamPaper | null {
    const d = this.#data(level)
    return d ? jaPaper(d, seed) : null
  }

  /** 本文练习：文中的词条现取，干扰项用文章那一级的词（不知道难度的按 N3） */
  article(
    analysis: JaAnalysis,
    level: number | null,
    seed: number,
    listen: boolean
  ): ExamQuestion[] {
    const dict = this.#dict()
    const d = this.#data(level ?? 3)
    if (!dict || !d) return []
    const ids = analysis.sentences.flatMap((s) =>
      s.words.map((w) => w.entryId).filter((id): id is number => !!id)
    )
    return jaArticlePractice(
      { analysis, words: dict.examWordsOf(ids), pool: d.words, listen },
      seed
    )
  }
}
