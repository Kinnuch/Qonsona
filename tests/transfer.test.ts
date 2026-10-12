import { afterEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { emptyNotebook, addCards, createList } from '../src/shared/notebook'
import { grade } from '../src/shared/srs'
import { emptyProgress } from '../src/shared/course'
import { emptyPracticeLog, scorePaper, type ExamPaper } from '../src/shared/exam'
import { defaultReviewSettings } from '../src/shared/review-settings'
import {
  validateTransfer,
  mergeNotebook,
  mergeCourses,
  mergePractice,
  mergeStats,
  transferPath,
  type TransferBundle
} from '../src/shared/transfer'
import {
  buildTransfer,
  exportTransfer,
  readTransfer,
  previewTransfer,
  scheduleTransfer,
  applyPendingTransfer
} from '../src/main/transfer'

const folders: string[] = []
async function dir(): Promise<string> {
  const path = await fs.mkdtemp(join(tmpdir(), 'qonsona-transfer-test-'))
  folders.push(path)
  return path
}
async function put(root: string, path: string, value: unknown): Promise<void> {
  const file = join(root, ...path.split('/'))
  await fs.mkdir(join(file, '..'), { recursive: true })
  await fs.writeFile(file, path.endsWith('.txt') ? String(value) : JSON.stringify(value))
}
const note = (key = 'ja-1', front = '本') => {
  const n = emptyNotebook(10)
  addCards(n, 'mine', [{ key, front, reading: 'ほん', meaning: { zh: '书', en: 'book' } }], 10)
  return n
}
const bundle = (
  files: TransferBundle['files'],
  scope: TransferBundle['scope'] = 'personal'
): TransferBundle => ({
  app: 'qonsona-transfer',
  format: 1,
  scope,
  appVersion: '0.1.0',
  createdAt: '2026-10-12T00:00:00.000Z',
  packs: [{ id: 'ja', name: 'Japanese', kind: 'builtin' }],
  files
})
afterEach(async () => {
  await Promise.all(folders.splice(0).map((p) => fs.rm(p, { recursive: true, force: true })))
})

describe('transfer validation', () => {
  it('accepts real shaped exam history and rejects invalid results or answer ranges', () => {
    const paper: ExamPaper = {
      id: 'test-paper',
      level: 'N5',
      title: { zh: '测试', en: 'Test' },
      scoring: null,
      sections: [
        {
          id: 'vocab',
          title: { zh: '词汇', en: 'Vocabulary' },
          minutes: 5,
          questions: [
            {
              id: 'q1',
              kind: 'word-meaning',
              section: 'vocab',
              ask: { zh: '请选择', en: 'Choose' },
              prompt: { text: '本' },
              choices: [{ text: 'book' }, { text: 'cat' }],
              answer: 0,
              explain: { lines: ['book'] }
            }
          ]
        }
      ]
    }
    const answers = [[0]]
    const record = {
      id: 'record-1',
      level: 'N5',
      at: 1000,
      seconds: 30,
      paper,
      answers,
      outcome: scorePaper(paper, answers)
    }
    const log = { ...emptyPracticeLog(), exams: [record] }
    expect(
      validateTransfer(bundle([{ path: 'practice/ja.json', content: log }])).files
    ).toHaveLength(1)
    const bad = structuredClone(log)
    bad.exams[0].outcome.parts = {} as never
    expect(() => validateTransfer(bundle([{ path: 'practice/ja.json', content: bad }]))).toThrow()
    bad.exams[0].outcome = record.outcome
    bad.exams[0].answers = [[9]]
    expect(() => validateTransfer(bundle([{ path: 'practice/ja.json', content: bad }]))).toThrow()
    const local = { ...emptyPracticeLog(), exams: [record] }
    const incoming = { ...emptyPracticeLog(), exams: [{ ...record, id: 'record-2', at: 2000 }] }
    const merged = mergePractice(local, incoming)
    expect(merged.exams.map((e) => e.id)).toEqual(['record-1', 'record-2'])
    expect(mergePractice(merged, incoming)).toEqual(merged)
  })
  it('rejects Windows case aliases and reserved reading-state names', () => {
    expect(() =>
      validateTransfer({ ...bundle([]), packs: [{ id: 'JA', name: 'alias', kind: 'qonlang' }] })
    ).toThrow()
    expect(() =>
      validateTransfer({
        ...bundle([]),
        packs: [
          { id: 'custom', name: 'a', kind: 'qonlang' },
          { id: 'CUSTOM', name: 'b', kind: 'qonlang' }
        ]
      })
    ).toThrow()
    expect(transferPath('articles/STATE.json')).toBeNull()
    const content = { id: 'u-story', source: 'user', title: 'A', body: 'a', chars: 1 }
    expect(() =>
      validateTransfer(
        bundle([
          { path: 'articles/u-story.json', content },
          { path: 'articles/U-STORY.json', content: { ...content, id: 'U-STORY' } }
        ])
      )
    ).toThrow()
  })
  it('accepts a complete notebook with schedules and list settings', () => {
    const n = note()
    n.review = {
      language: defaultReviewSettings(),
      lists: { mine: defaultReviewSettings() },
      updatedAt: 100
    }
    n.reviewDays = { language: { '2026-10-12': { learned: 1, reviewed: 0, total: 1, correct: 1 } } }
    expect(
      validateTransfer(bundle([{ path: 'notebook/ja.json', content: n }], 'notebook')).files
    ).toHaveLength(1)
  })
  it.each([
    '../prefs.json',
    'notebook/../prefs.json',
    'notebook/CON.json',
    'notebook/ja.json/evil',
    'packs/ja/manifest.json',
    'C:/prefs.json',
    'articles/en/user/../../prefs.json'
  ])('rejects forbidden path %s', (path) =>
    expect(() => validateTransfer(bundle([{ path, content: note() }]))).toThrow()
  )
  it('rejects foreign card namespaces, mismatched keys and unknown languages', () => {
    const n = note('lex-1')
    expect(() => validateTransfer(bundle([{ path: 'notebook/ja.json', content: n }]))).toThrow()
    const valid = note()
    valid.cards['ja-1'].key = 'ja-2'
    expect(() => validateTransfer(bundle([{ path: 'notebook/ja.json', content: valid }]))).toThrow()
    expect(() =>
      validateTransfer(bundle([{ path: 'notebook/es.json', content: note('lex-1') }]))
    ).toThrow()
  })
  it('rejects orphan cards, bad grades and malformed settings', () => {
    const n = note()
    n.lists[0].keys = []
    expect(() => validateTransfer(bundle([{ path: 'notebook/ja.json', content: n }]))).toThrow()
    const other = note()
    other.cards['ja-1'].hist = [[10, 9 as never]]
    expect(() => validateTransfer(bundle([{ path: 'notebook/ja.json', content: other }]))).toThrow()
    other.cards['ja-1'].hist = []
    other.review = {
      lists: { mine: { ...defaultReviewSettings(), ladder: [4, 1] } },
      updatedAt: 10
    }
    expect(() => validateTransfer(bundle([{ path: 'notebook/ja.json', content: other }]))).toThrow()
  })
  it('rejects prototype keys, duplicate files, new format and NaN', () => {
    expect(() =>
      validateTransfer(JSON.parse('{"app":"qonsona-transfer","__proto__":{}}'))
    ).toThrow()
    const n = note()
    expect(() =>
      validateTransfer(
        bundle([
          { path: 'notebook/ja.json', content: n },
          { path: 'notebook/ja.json', content: n }
        ])
      )
    ).toThrow()
    expect(() => validateTransfer({ ...bundle([]), format: 2 })).toThrow()
    n.cards['ja-1'].due = NaN
    expect(() => validateTransfer(bundle([{ path: 'notebook/ja.json', content: n }]))).toThrow()
  })
  it('rejects article ID/language mismatch and notebook files with other categories', () => {
    expect(() =>
      validateTransfer(
        bundle([
          {
            path: 'articles/u-one.json',
            content: { id: 'u-other', source: 'user', title: 'A', body: 'a', chars: 1 }
          }
        ])
      )
    ).toThrow()
    expect(() =>
      validateTransfer(bundle([{ path: 'courses/ja.json', content: emptyProgress() }], 'notebook'))
    ).toThrow()
    expect(transferPath('articles/es/user/u-one.json')).toEqual({
      kind: 'article',
      pack: 'es',
      id: 'u-one'
    })
  })
})

describe('idempotent conservative merging', () => {
  it('keeps existing cards, merges list memberships and picks latest schedule', () => {
    const local = note()
    const incoming = note()
    grade(local.cards['ja-1'], 5, 1000)
    grade(incoming.cards['ja-1'], 0, 2000)
    const list = createList(incoming, 'Extra', undefined, 20)
    list.keys.push('ja-1')
    addCards(
      incoming,
      'mine',
      [{ key: 'ja-2', front: '猫', reading: 'ねこ', meaning: { en: 'cat' } }],
      20
    )
    const result = mergeNotebook(local, incoming)
    expect(result.cards['ja-1'].last).toBe(2000)
    expect(result.cards['ja-1'].state).toBe(incoming.cards['ja-1'].state)
    expect(result.cards['ja-2']).toBeDefined()
    expect(result.lists.find((l) => l.id === list.id)?.keys).toContain('ja-1')
    expect(mergeNotebook(result, incoming)).toEqual(result)
    expect(local.cards['ja-1'].last).toBe(1000)
  })
  it('keeps local schedules on tied timestamps and preserves review configuration', () => {
    const a = note(),
      b = note()
    a.cards['ja-1'].ivl = 7
    b.cards['ja-1'].ivl = 1
    a.review = {
      language: { ...defaultReviewSettings(), newPerDay: 5 },
      lists: { mine: defaultReviewSettings() },
      updatedAt: 200
    }
    b.review = {
      language: { ...defaultReviewSettings(), newPerDay: 30 },
      lists: {},
      updatedAt: 100
    }
    a.reviewDays = { language: { '2026-10-12': { learned: 5, reviewed: 2, total: 7, correct: 3 } } }
    b.reviewDays = { language: { '2026-10-12': { learned: 2, reviewed: 4, total: 6, correct: 4 } } }
    const out = mergeNotebook(a, b)
    expect(out.cards['ja-1'].ivl).toBe(7)
    expect(out.review?.language?.newPerDay).toBe(5)
    expect(out.reviewDays?.language['2026-10-12']).toEqual({
      learned: 5,
      reviewed: 4,
      total: 7,
      correct: 4
    })
    expect(mergeNotebook(out, b)).toEqual(out)
  })
  it('merges course maxima and successful completion without erasing earlier work', () => {
    const a = emptyProgress(),
      b = emptyProgress()
    a.lessons['grammar/a'] = { learned: true, best: 0.9, passed: true, tries: 3, at: 100 }
    b.lessons['grammar/a'] = { learned: false, best: 0.5, passed: false, tries: 1, at: 200 }
    b.lessons['grammar/b'] = { learned: true, best: 1, passed: true, tries: 1, at: 200 }
    const out = mergeCourses(a, b)
    expect(out.lessons['grammar/a']).toMatchObject({
      learned: true,
      best: 0.9,
      passed: true,
      tries: 3,
      at: 200
    })
    expect(out.lessons['grammar/b']).toBeDefined()
    expect(mergeCourses(out, b)).toEqual(out)
  })
  it('never sums cumulative practice or activity counts on repeat import', () => {
    const a = emptyPracticeLog(),
      b = emptyPracticeLog()
    a.days['2026-10-12'] = { answered: 12, right: 8 }
    b.days['2026-10-12'] = { answered: 10, right: 9 }
    const p = mergePractice(a, b)
    expect(p.days['2026-10-12']).toEqual({ answered: 12, right: 9 })
    expect(mergePractice(p, b)).toEqual(p)
    const local = {
      version: 1 as const,
      days: { '2026-10-12': { packs: { ja: { notebook: 100 }, es: { course: 30 } } } }
    }
    const remote = {
      version: 1 as const,
      days: { '2026-10-12': { packs: { ja: { notebook: 90 }, fr: { course: 20 } } } }
    }
    const result = mergeStats(local, remote)
    expect(result.days['2026-10-12'].packs).toEqual({
      ja: { notebook: 100 },
      es: { course: 30 },
      fr: { course: 20 }
    })
    expect(mergeStats(result, remote)).toEqual(result)
  })
})

describe('portable file transfer lifecycle', () => {
  it('rolls back earlier writes if a later file fails, and safely retries the pending import', async () => {
    const root = await dir()
    const local = note(),
      incoming = note()
    grade(incoming.cards['ja-1'], 5, 1000)
    const courses = emptyProgress()
    const remoteCourses = emptyProgress()
    remoteCourses.lessons['grammar/test'] = {
      learned: true,
      best: 1,
      passed: true,
      tries: 1,
      at: 1000
    }
    await put(root, 'notebook/ja.json', local)
    await put(root, 'courses/ja.json', courses)
    await scheduleTransfer(
      root,
      bundle([
        { path: 'notebook/ja.json', content: incoming },
        { path: 'courses/ja.json', content: remoteCourses }
      ])
    )
    const originalWrite = fs.writeFile.bind(fs)
    let failed = false
    const stub = vi.spyOn(fs, 'writeFile').mockImplementation(async (file, data, options) => {
      if (!failed && String(file).startsWith(join(root, 'courses', 'ja.json.'))) {
        failed = true
        throw new Error('Simulated import write failure')
      }
      return originalWrite(file, data, options)
    })
    try {
      await expect(applyPendingTransfer(root)).rejects.toThrow('Simulated import write failure')
    } finally {
      stub.mockRestore()
    }
    expect(JSON.parse(await fs.readFile(join(root, 'notebook/ja.json'), 'utf8'))).toEqual(local)
    expect(JSON.parse(await fs.readFile(join(root, 'courses/ja.json'), 'utf8'))).toEqual(courses)
    await applyPendingTransfer(root)
    expect(
      JSON.parse(await fs.readFile(join(root, 'notebook/ja.json'), 'utf8')).cards['ja-1'].last
    ).toBe(1000)
    expect(
      JSON.parse(await fs.readFile(join(root, 'courses/ja.json'), 'utf8')).lessons['grammar/test']
        .passed
    ).toBe(true)
  })
  it('exports only a selected list and waits until its file is readable', async () => {
    const root = await dir()
    const n = note()
    const list = createList(n, 'Cats', undefined, 20)
    addCards(
      n,
      list.id,
      [{ key: 'ja-2', front: '猫', reading: 'ねこ', meaning: { en: 'cat' } }],
      20
    )
    await put(root, 'notebook/ja.json', n)
    const file = join(root, 'export.json')
    const output = await exportTransfer(root, file, 'notebook', 'test', 'ja', list.id)
    const { bundle: out } = await readTransfer(file)
    expect(output.bytes).toBe((await fs.stat(file)).size)
    const nb = out.files[0].content as typeof n
    expect(Object.keys(nb.cards)).toEqual(['ja-2'])
    expect(nb.lists.map((l) => l.id)).toEqual(['mine', list.id])
    expect(out.scope).toBe('notebook')
  })
  it('includes personal records and text but excludes packages, audio and media paths', async () => {
    const root = await dir()
    await put(root, 'notebook/ja.json', note())
    await put(root, 'courses/ja.json', emptyProgress())
    await put(root, 'practice/ja.json', emptyPracticeLog())
    await put(root, 'stats.json', {
      version: 1,
      days: { '2026-10-12': { packs: { ja: { notebook: 10 } } } }
    })
    await put(root, 'articles/u-story.json', {
      id: 'u-story',
      source: 'user',
      title: 'Story',
      body: 'hello',
      chars: 5
    })
    await put(root, 'articles/translations/u-story.txt', '你好')
    await put(root, 'media/library.json', { items: [{ path: 'C:/private/movie.mp4' }] })
    await put(root, 'articles/n-news.json', {
      id: 'n-news',
      source: 'nhk',
      title: 'News',
      body: 'copyright',
      chars: 9
    })
    const out = await buildTransfer(root, 'personal', 'test')
    expect(out.files.map((f) => f.path).sort()).toEqual(
      [
        'articles/translations/u-story.txt',
        'articles/u-story.json',
        'courses/ja.json',
        'notebook/ja.json',
        'practice/ja.json',
        'stats.json'
      ].sort()
    )
    expect(JSON.stringify(out)).not.toContain('private/movie')
  })
  it('previews without mutation then merges on startup and retains a rollback copy', async () => {
    const root = await dir()
    const a = note(),
      b = note()
    grade(b.cards['ja-1'], 5, 1000)
    await put(root, 'notebook/ja.json', a)
    const incoming = bundle([{ path: 'notebook/ja.json', content: b }])
    const preview = await previewTransfer(root, incoming, 'test', 'import.json')
    expect(preview.updated).toBe(1)
    expect(JSON.parse(await fs.readFile(join(root, 'notebook/ja.json'), 'utf8'))).toEqual(a)
    await scheduleTransfer(root, incoming)
    const result = await applyPendingTransfer(root)
    expect(result?.files).toBe(1)
    expect(JSON.parse(await fs.readFile(join(result!.saved, 'notebook/ja.json'), 'utf8'))).toEqual(
      a
    )
    const first = await fs.readFile(join(root, 'notebook/ja.json'), 'utf8')
    await scheduleTransfer(root, incoming)
    await applyPendingTransfer(root)
    expect(await fs.readFile(join(root, 'notebook/ja.json'), 'utf8')).toBe(first)
    expect(await applyPendingTransfer(root)).toBeNull()
  })
  it('preserves local article conflicts and reports them before confirmation', async () => {
    const root = await dir()
    const a = { id: 'u-story', source: 'user', title: 'Local', body: 'local', chars: 5 }
    await put(root, 'articles/u-story.json', a)
    const incoming = bundle([
      {
        path: 'articles/u-story.json',
        content: { ...a, title: 'Remote', body: 'remote', chars: 6 }
      }
    ])
    const preview = await previewTransfer(root, incoming, 't', 'f')
    expect(preview.conflicts).toBe(1)
    expect(preview.unchanged).toBe(1)
    await scheduleTransfer(root, incoming)
    await applyPendingTransfer(root)
    expect(JSON.parse(await fs.readFile(join(root, 'articles/u-story.json'), 'utf8'))).toEqual(a)
  })
  it('rejects malformed input without writing existing data', async () => {
    const root = await dir()
    const original = note()
    await put(root, 'notebook/ja.json', original)
    await expect(
      scheduleTransfer(root, bundle([{ path: '../../outside.json', content: original }]))
    ).rejects.toThrow()
    expect(JSON.parse(await fs.readFile(join(root, 'notebook/ja.json'), 'utf8'))).toEqual(original)
  })
  it('validates local stats independently of the incoming language set', async () => {
    const root = await dir()
    await put(root, 'stats.json', {
      version: 1,
      days: { '2026-10-12': { packs: { es: { course: 20 } } } }
    })
    const incoming = bundle([
      {
        path: 'stats.json',
        content: { version: 1, days: { '2026-10-12': { packs: { ja: { notebook: 30 } } } } }
      }
    ])
    await scheduleTransfer(root, incoming)
    await applyPendingTransfer(root)
    const stats = JSON.parse(await fs.readFile(join(root, 'stats.json'), 'utf8'))
    expect(stats.days['2026-10-12'].packs).toEqual({ es: { course: 20 }, ja: { notebook: 30 } })
  })
})
