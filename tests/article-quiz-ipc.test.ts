import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const mock = vi.hoisted(() => ({
  path: '',
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>()
}))
vi.mock('electron', () => ({
  app: { getPath: () => mock.path },
  ipcMain: {
    handle: (channel: string, callback: (...args: unknown[]) => Promise<unknown>) =>
      mock.handlers.set(channel, callback)
  }
}))
import { registerArticleQuizIpc } from '../src/main/article-quiz'
const call = (channel: string, ...args: unknown[]): Promise<unknown> =>
  mock.handlers.get(channel)!(null, ...args)
const progress = { fingerprint: 'a123', answers: [0], completed: false, history: [] }
beforeAll(async () => {
  mock.path = await mkdtemp(join(tmpdir(), 'qonsona-quiz-ipc-test-'))
  registerArticleQuizIpc()
})
afterAll(async () => {
  if (!mock.path.startsWith(join(tmpdir(), 'qonsona-quiz-ipc-test-')))
    throw new Error('Temporary quiz test directory escaped its expected root')
  await rm(mock.path, { recursive: true, force: true })
})
describe('article quiz safe persistence', () => {
  it('returns no progress before the first save', async () => {
    expect(await call('articleQuiz:load', 'en', 'sample')).toBeNull()
  })
  it('awaits real writes and serializes different article updates in the same language', async () => {
    await Promise.all([
      call('articleQuiz:save', 'en', 'sample', progress),
      call('articleQuiz:save', 'en', 'second', { ...progress, answers: [1, 2] })
    ])
    expect(await call('articleQuiz:load', 'en', 'sample')).toEqual(progress)
    expect(await call('articleQuiz:load', 'en', 'second')).toMatchObject({ answers: [1, 2] })
    expect(
      JSON.parse(await readFile(join(mock.path, 'article-quizzes', 'en.json'), 'utf8'))
    ).toHaveProperty('second')
  })
  it('keeps languages separate', async () => {
    await call('articleQuiz:save', 'gd', 'sample', { ...progress, answers: [2] })
    expect(await call('articleQuiz:load', 'en', 'sample')).toEqual(progress)
    expect(await call('articleQuiz:load', 'gd', 'sample')).toMatchObject({ answers: [2] })
  })
  it('rejects traversal/prototype keys and malformed answers before writing', async () => {
    for (const [pack, id, value] of [
      ['../en', 'sample', progress],
      ['en', '__proto__', progress],
      ['en', 'sample', { ...progress, answers: [4] }]
    ]) {
      await expect(
        Promise.resolve().then(() => call('articleQuiz:save', pack, id, value))
      ).rejects.toThrow()
    }
    expect(await call('articleQuiz:load', 'en', 'sample')).toEqual(progress)
  })
})
