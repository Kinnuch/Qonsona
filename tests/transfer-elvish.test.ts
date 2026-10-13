import { afterEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LANG_CODES } from '../src/shared/lang/types'
import qya from '../src/shared/lang/qya'
import sjn from '../src/shared/lang/sjn'
import qyaTexts from '../data/qya/texts.json'
import sjnTexts from '../data/sjn/texts.json'
import { addCards, emptyNotebook } from '../src/shared/notebook'
import { grade } from '../src/shared/srs'
import { emptyProgress } from '../src/shared/course'
import { emptyPracticeLog, scorePaper, type ExamPaper } from '../src/shared/exam'
import { makeArticleQuiz, type ArticleQuizProgress } from '../src/shared/article-quiz'
import {
  BUILTIN_TRANSFER_IDS,
  transferPath,
  validateTransfer,
  type TransferBundle
} from '../src/shared/transfer'
import {
  applyPendingTransfer,
  buildTransfer,
  exportTransfer,
  previewTransfer,
  readTransfer,
  scheduleTransfer
} from '../src/main/transfer'

const directories: string[] = []
async function folder(): Promise<string> {
  const path = await fs.mkdtemp(join(tmpdir(), 'qonsona-elvish-transfer-'))
  directories.push(path)
  return path
}
async function put(root: string, path: string, data: unknown): Promise<void> {
  const destination = join(root, ...path.split('/'))
  await fs.mkdir(join(destination, '..'), { recursive: true })
  await fs.writeFile(destination, path.endsWith('.txt') ? String(data) : JSON.stringify(data))
}
const get = async (root: string, path: string) =>
  JSON.parse(await fs.readFile(join(root, ...path.split('/')), 'utf8'))
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => fs.rm(path, { recursive: true, force: true }))
  )
})
const cases = [
  {
    code: 'qya',
    module: qya,
    text: qyaTexts[0],
    word: 'elen',
    reading: 'ˈelen',
    meaning: { zh: '星', en: 'star' },
    second: 'Elda'
  },
  {
    code: 'sjn',
    module: sjn,
    text: sjnTexts[0],
    word: 'adan',
    reading: 'ˈadan',
    meaning: { zh: '人类', en: 'man' },
    second: 'edhel'
  }
] as const
function notebook(word: string, reading: string, meaning: Record<string, string>, at: number) {
  const n = emptyNotebook(10)
  addCards(n, 'mine', [{ key: 'lex-101', front: word, reading, meaning }], 10)
  grade(n.cards['lex-101'], 5, at)
  return n
}
describe('registry-backed transfer languages', () => {
  it('accepts every registered builtin and keeps Japanese in its original namespace', () => {
    expect(BUILTIN_TRANSFER_IDS).toEqual(['ja', ...LANG_CODES])
    for (const code of BUILTIN_TRANSFER_IDS) {
      const data = emptyNotebook(10)
      addCards(
        data,
        'mine',
        [
          {
            key: code === 'ja' ? 'ja-101' : 'lex-101',
            front: 'entry',
            reading: '',
            meaning: { en: 'entry' }
          }
        ],
        10
      )
      const bundle: TransferBundle = {
        app: 'qonsona-transfer',
        format: 1,
        scope: 'notebook',
        appVersion: '0.3.0',
        createdAt: '2026-10-13T00:00:00Z',
        packs: [{ id: code, name: code, kind: 'builtin' }],
        files: [{ path: `notebook/${code}.json`, content: data }]
      }
      expect(validateTransfer(bundle)).toBe(bundle)
    }
  })
  it.each(['qya', 'sjn'])(
    'permits only exact registered %s article paths and rejects aliases and foreign namespaces',
    (code) => {
      expect(transferPath(`articles/${code}/state.json`)).toEqual({
        kind: 'article-state',
        pack: code
      })
      expect(transferPath(`articles/${code}/user/u-story.json`)).toEqual({
        kind: 'article',
        pack: code,
        id: 'u-story'
      })
      expect(transferPath(`articles/${code}/translations/u-story.txt`)).toEqual({
        kind: 'translation',
        pack: code,
        id: 'u-story'
      })
      for (const language of ['QYA', 'SJN', 'xyz', 'custom'])
        expect(transferPath(`articles/${language}/user/u-story.json`)).toBeNull()
      const data = emptyNotebook(10)
      addCards(
        data,
        'mine',
        [{ key: 'ja-101', front: 'wrong namespace', reading: '', meaning: { en: 'invalid' } }],
        10
      )
      const bundle: TransferBundle = {
        app: 'qonsona-transfer',
        format: 1,
        scope: 'notebook',
        appVersion: '0.3.0',
        createdAt: '2026-10-13T00:00:00Z',
        packs: [{ id: code, name: code, kind: 'builtin' }],
        files: [{ path: `notebook/${code}.json`, content: data }]
      }
      expect(() => validateTransfer(bundle)).toThrow(/language/)
      expect(() =>
        validateTransfer({
          ...bundle,
          packs: [{ id: code.toUpperCase(), name: 'alias', kind: 'qonlang' }],
          files: []
        })
      ).toThrow()
      expect(() =>
        validateTransfer({
          ...bundle,
          packs: [{ id: 'xyz', name: 'unknown builtin', kind: 'builtin' }],
          files: []
        })
      ).toThrow()
    }
  )
})
describe('real Elvish personal files across computers', () => {
  it.each(cases)(
    '$code exports, previews, merges and reimports notebook/course/exam/reading progress without duplication',
    async ({ code, module, text, word, reading, meaning, second }) => {
      const source = await folder(),
        target = await folder(),
        at = 2000
      const remote = notebook(word, reading, meaning, at),
        local = notebook(word, reading, meaning, 1000)
      addCards(
        local,
        'mine',
        [{ key: 'lex-102', front: second, reading: '', meaning: { en: 'Elf' } }],
        20
      )
      const course = module.courses!('en')[0],
        lesson = course.units[0].lessons[0]
      const courseKey = `${course.id}/${lesson.id}`
      const progress = emptyProgress()
      progress.lessons[courseKey] = { learned: true, best: 1, passed: true, tries: 2, at }
      progress.last = { course: course.id, lesson: lesson.id }
      const localProgress = emptyProgress()
      localProgress.lessons[courseKey] = {
        learned: true,
        best: 0.5,
        passed: false,
        tries: 1,
        at: 1000
      }
      localProgress.lessons['local/lesson'] = {
        learned: true,
        best: 1,
        passed: true,
        tries: 1,
        at: 1000
      }
      const paper: ExamPaper = {
        id: `${code}-practice`,
        level: 'L1',
        title: { en: 'Internal vocabulary practice', zh: '内部词汇练习' },
        scoring: null,
        sections: [
          {
            id: 'vocab',
            title: { en: 'Vocabulary', zh: '词汇' },
            minutes: 5,
            questions: [
              {
                id: `${code}-star-or-man`,
                kind: 'word-meaning',
                section: 'vocab',
                ask: { en: 'Choose the meaning', zh: '请选择词义' },
                prompt: { text: word },
                choices: [
                  { text: meaning.en },
                  { text: 'tree' },
                  { text: 'water' },
                  { text: 'house' }
                ],
                answer: 0,
                explain: { lines: [{ en: `${word}: ${meaning.en}`, zh: `${word}：${meaning.zh}` }] }
              }
            ]
          }
        ]
      }
      const practice = emptyPracticeLog(),
        localPractice = emptyPracticeLog(),
        answers = [[0]]
      const record = {
        id: `${code}-attempt`,
        level: 'L1',
        at,
        seconds: 20,
        paper,
        answers,
        outcome: scorePaper(paper, answers)
      }
      practice.exams = [record]
      practice.days['2026-10-13'] = { answered: 1, right: 1 }
      localPractice.exams = [{ ...record, id: `${code}-local-attempt`, at: 1000 }]
      const articleId = `u-${code}-study`,
        quiz = makeArticleQuiz({ id: articleId, body: text.text, lang: code, seed: 1729 })
      expect(quiz.questions.length).toBeGreaterThan(0)
      const correct = quiz.questions.map((q) => q.answer)
      const remoteQuiz: ArticleQuizProgress = {
        fingerprint: quiz.fingerprint,
        answers: correct,
        completed: true,
        history: [{ at, answers: correct, right: correct.length, total: correct.length }]
      }
      const localQuiz: ArticleQuizProgress = {
        fingerprint: quiz.fingerprint,
        answers: correct.slice(0, 1),
        completed: false,
        history: [{ at: 1000, answers: correct.slice(0, 1), right: 1, total: 1 }]
      }
      const article = {
        id: articleId,
        code,
        source: 'user',
        title: text.title,
        body: text.text,
        chars: text.text.length,
        author: text.author,
        license: text.license
      }
      const translation = `${meaning.zh} — ${meaning.en}`
      await put(source, `notebook/${code}.json`, remote)
      await put(source, `courses/${code}.json`, progress)
      await put(source, `practice/${code}.json`, practice)
      await put(source, `article-quizzes/${code}.json`, { [articleId]: remoteQuiz })
      await put(source, `articles/${code}/user/${articleId}.json`, article)
      await put(source, `articles/${code}/translations/${articleId}.txt`, translation)
      await put(source, `articles/${code}/state.json`, {
        read: { [articleId]: '2026-10-13T12:00:00Z' },
        levels: { [articleId]: 'L1' }
      })
      await put(target, `notebook/${code}.json`, local)
      await put(target, `courses/${code}.json`, localProgress)
      await put(target, `practice/${code}.json`, localPractice)
      await put(target, `article-quizzes/${code}.json`, { [articleId]: localQuiz })
      await put(target, `articles/${code}/state.json`, {
        read: { 'u-local': '2026-10-12T12:00:00Z' },
        levels: { 'u-local': 'L2' }
      })
      const path = join(source, 'personal.json')
      await exportTransfer(source, path, 'personal', '0.3.0')
      const { bundle } = await readTransfer(path)
      expect(bundle.packs).toEqual([{ id: code, name: code, kind: 'builtin' }])
      expect(bundle.files).toHaveLength(7)
      expect(validateTransfer(bundle)).toBe(bundle)
      const notebookExport = await buildTransfer(source, 'notebook', '0.3.0', code)
      expect(notebookExport.packs[0].kind).toBe('builtin')
      expect(notebookExport.files[0].content).toEqual(remote)
      const original = await get(target, `notebook/${code}.json`)
      const preview = await previewTransfer(target, bundle, 'review-token', 'personal.json')
      expect(preview.missingPacks).toEqual([])
      expect(preview.counts).toEqual([
        { pack: code, cards: 1, lists: 1, courses: 1, exams: 1, articles: 1 }
      ])
      expect(preview.updated).toBeGreaterThan(0)
      expect(preview.added).toBe(2)
      expect(await get(target, `notebook/${code}.json`)).toEqual(original)
      await scheduleTransfer(target, bundle)
      expect((await applyPendingTransfer(target))?.files).toBe(7)
      const mergedNotebook = await get(target, `notebook/${code}.json`)
      expect(Object.keys(mergedNotebook.cards).sort()).toEqual(['lex-101', 'lex-102'])
      expect(mergedNotebook.cards['lex-101'].last).toBe(at)
      expect(mergedNotebook.cards['lex-101'].due).toBe(remote.cards['lex-101'].due)
      expect((await get(target, `courses/${code}.json`)).lessons[courseKey].passed).toBe(true)
      expect((await get(target, `courses/${code}.json`)).lessons['local/lesson'].passed).toBe(true)
      expect(
        (await get(target, `practice/${code}.json`)).exams.map((r: { id: string }) => r.id)
      ).toEqual([`${code}-local-attempt`, `${code}-attempt`])
      const mergedQuiz = (await get(target, `article-quizzes/${code}.json`))[articleId]
      expect(mergedQuiz.completed).toBe(true)
      expect(mergedQuiz.answers).toEqual(correct)
      expect(mergedQuiz.history).toHaveLength(2)
      expect(await get(target, `articles/${code}/user/${articleId}.json`)).toEqual(article)
      expect(
        await fs.readFile(join(target, `articles/${code}/translations/${articleId}.txt`), 'utf8')
      ).toBe(translation)
      expect((await get(target, `articles/${code}/state.json`)).read).toEqual({
        'u-local': '2026-10-12T12:00:00Z',
        [articleId]: '2026-10-13T12:00:00Z'
      })
      const before = await buildTransfer(target, 'personal', '0.3.0')
      const repeatPreview = await previewTransfer(target, bundle, 'repeat-token', 'personal.json')
      expect(repeatPreview.updated).toBe(0)
      expect(repeatPreview.added).toBe(0)
      await scheduleTransfer(target, bundle)
      await applyPendingTransfer(target)
      const after = await buildTransfer(target, 'personal', '0.3.0')
      expect(after.files).toEqual(before.files)
      expect(after.packs).toEqual(before.packs)
    }
  )
})
