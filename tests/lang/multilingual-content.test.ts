/** 七门语言接入后的整体检查：课程不能引用不存在的词条/课文，每一级都能出完整训练卷。 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { LANG_CODES } from '../../src/shared/lang/types'
import { LANGS } from '../../src/shared/lang/registry'
import { primarySystem } from '../../src/shared/lang/levels'
import { LANG_TEXTS } from '../../src/main/lang/texts'
import { LexDb } from '../../src/main/lang/lexdb'
import { langArticlePractice, langPaper } from '../../src/main/lang/practice'
import { analyzeLex } from '../../src/main/lang/analyze'
import { lessonQuiz, poolUpTo, allLessons } from '../../src/shared/course'
import { findGrammar } from '../../src/shared/lang/grammar'
import { segmentWords } from '../../src/shared/lang/text'

for (const code of LANG_CODES)
  describe(`${code} 学习内容整体接入`, () => {
    const mod = LANGS[code]
    const levels = primarySystem(mod.spec.levelSystems).levels
    const file = join(process.cwd(), 'resources', 'data', code, 'dict.sqlite')
    let dictionary: LexDb | null = null
    beforeAll(() => {
      if (existsSync(file)) dictionary = new LexDb(code, file)
    })
    afterAll(() => dictionary?.close())
    it('每级有语法、双语示例、正文和训练卷，功能开关与真实课程一致', () => {
      const points = mod.grammar ?? []
      expect(new Set(points.map((g) => g.id)).size).toBe(points.length)
      for (const lv of levels) {
        expect(
          points.some((g) => g.level === lv.id),
          lv.id
        ).toBe(true)
        expect(
          LANG_TEXTS[code].some((t) => t.level === lv.id),
          lv.id
        ).toBe(true)
        expect(
          mod.exams?.some((e) => e.level === lv.id),
          lv.id
        ).toBe(true)
      }
      for (const g of points) {
        expect(
          levels.some((l) => l.id === g.level),
          g.id
        ).toBe(true)
        expect(g.examples.length, g.id).toBeGreaterThanOrEqual(2)
        for (const ex of g.examples) {
          expect(ex.zh, g.id).toBeTruthy()
          expect(ex.en, g.id).toBeTruthy()
          expect(ex.hl, g.id).toBeTruthy()
          expect(ex.text.includes(ex.hl!), `${g.id}: ${ex.hl}`).toBe(true)
          const tokens = (
            mod.rules.tokenize?.(ex.text) ?? segmentWords(ex.text, mod.spec.bcp47)
          ).map((t) => {
            const hit = t.kind === 'word' ? dictionary?.lookup(t.text) : null
            return hit ? { ...t, lemma: hit.lemma, pos: hit.pos, tags: hit.tags } : t
          })
          const start = ex.text.indexOf(ex.hl!)
          const hits = findGrammar(
            [{ start: 0, end: ex.text.length, para: 0, tokens }],
            [g],
            mod.rules.key
          )
          expect(
            hits.some((h) => h.start === start && h.end === start + ex.hl!.length),
            `${g.id}: ${ex.hl}`
          ).toBe(true)
        }
      }
      for (const locale of ['zh', 'en']) {
        const courses = mod.courses?.(locale) ?? []
        for (const id of [
          'alphabet',
          'grammar',
          'inflection',
          'phrasebook',
          'idioms',
          'stories'
        ] as const) {
          if (mod.spec.features[id])
            expect(
              courses.some((c) => c.id === id),
              id
            ).toBe(true)
        }
        for (const c of courses) {
          const refs =
            c.kind === 'symbols'
              ? c.symbols
              : c.kind === 'grammar'
                ? c.grammar
                : c.kind === 'forms'
                  ? c.forms
                  : c.kind === 'texts'
                    ? c.texts
                    : c.phrases
          expect(c.units.length, c.id).toBeGreaterThan(0)
          const lessons = allLessons(c)
          expect(new Set(lessons.map((l) => l.lesson.id)).size, c.id).toBe(lessons.length)
          for (const { lesson } of lessons) {
            expect(lesson.items.length, `${c.id}/${lesson.id}`).toBeGreaterThan(0)
            for (const key of lesson.items) expect(refs?.[key], `${c.id}/${key}`).toBeDefined()
            if (c.kind === 'texts')
              for (const key of lesson.items) {
                expect(LANG_TEXTS[code].some((t) => `b-${t.id}` === c.texts![key].articleId)).toBe(
                  true
                )
              }
            else {
              const words =
                dictionary?.spell(lesson.words ?? []).map((w) => ({
                  text: w.text,
                  reading: w.reading,
                  meaning: { zh: w.zh, en: w.en }
                })) ?? []
              const quiz = lessonQuiz(c, lesson, poolUpTo(c, lesson.id), {
                seed: 7,
                listen: false,
                words
              })
              if (!(c.kind === 'symbols' && lesson.items.every((key) => c.symbols[key].learnOnly)))
                expect(quiz.length, `${c.id}/${lesson.id}`).toBeGreaterThan(0)
              for (const q of quiz)
                if ('choices' in q) {
                  expect(q.choices.length, `${c.id}/${lesson.id}`).toBeGreaterThanOrEqual(2)
                  expect(new Set(q.choices).size).toBe(q.choices.length)
                }
            }
          }
        }
      }
    })
    it.skipIf(!existsSync(file))(
      '真实库逐级出满卷、本文练习可用且不重复选项',
      () => {
        const db = new LexDb(code, file)
        try {
          for (const def of mod.exams ?? []) {
            const paper = langPaper(db, def.id, 42, 'zh')
            expect(paper, def.id).not.toBeNull()
            expect(paper!.sections.map((s) => s.questions.length)).toEqual(
              def.sections.map((s) => s.parts.reduce((n, p) => n + p.n, 0))
            )
            for (const s of paper!.sections)
              for (const q of s.questions) {
                expect(q.answer).toBeGreaterThanOrEqual(0)
                expect(q.answer).toBeLessThan(q.choices.length)
                for (const locale of ['zh', 'en']) {
                  const labels = q.choices.map((c) =>
                    typeof c.text === 'string' ? c.text : c.text[locale]
                  )
                  expect(new Set(labels).size, `${def.id}/${q.id}/${locale}`).toBe(labels.length)
                }
              }
          }
          const text = LANG_TEXTS[code][0]
          expect(text).toBeDefined()
          expect(
            langArticlePractice(db, analyzeLex(db, text.text), 7, 'zh').length
          ).toBeGreaterThan(0)
        } finally {
          db.close()
        }
      },
      60_000
    )
  })
