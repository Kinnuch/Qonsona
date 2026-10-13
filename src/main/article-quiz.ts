import { app, ipcMain } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArticleQuizProgress } from '../shared/article-quiz'
import { pendingWrites } from './pending-writes'

const pathFor = (packId: unknown): string => {
  if (typeof packId !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(packId))
    throw new Error('Invalid article quiz language')
  return join(app.getPath('userData'), 'article-quizzes', `${packId}.json`)
}
const keyFor = (id: unknown): string => {
  if (
    typeof id !== 'string' ||
    !id.trim() ||
    id.length > 1024 ||
    ['__proto__', 'constructor', 'prototype'].includes(id)
  )
    throw new Error('Invalid article quiz material key')
  return id
}
async function load(path: string): Promise<Record<string, unknown>> {
  try {
    const raw = JSON.parse(await readFile(path, 'utf8'))
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error('Invalid article quiz file')
    for (const [key, value] of Object.entries(raw)) {
      keyFor(key)
      if (!parseArticleQuizProgress(value)) throw new Error('Invalid saved article quiz progress')
    }
    return raw
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
}
export function registerArticleQuizIpc(): void {
  ipcMain.handle('articleQuiz:load', async (_event, packId: unknown, id: unknown) => {
    const path = pathFor(packId)
    return pendingWrites.run(`article-quiz:${packId}`, async () =>
      parseArticleQuizProgress((await load(path))[keyFor(id)])
    )
  })
  ipcMain.handle('articleQuiz:save', (_event, packId: unknown, id: unknown, value: unknown) => {
    const path = pathFor(packId),
      key = keyFor(id),
      progress = parseArticleQuizProgress(value)
    if (!progress) throw new Error('Invalid article quiz progress')
    return pendingWrites.run(`article-quiz:${packId}`, async () => {
      const data = await load(path)
      data[key] = progress
      await mkdir(join(app.getPath('userData'), 'article-quizzes'), { recursive: true })
      await writeFile(`${path}.tmp`, JSON.stringify(data), 'utf8')
      await rename(`${path}.tmp`, path)
    })
  })
}
