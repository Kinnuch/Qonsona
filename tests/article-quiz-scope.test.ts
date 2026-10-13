import { describe, expect, it } from 'vitest'
import { ArticleQuizScopeGate, saveScopedArticleQuiz } from '../src/shared/article-quiz-scope'
import type { ArticleQuizProgress } from '../src/shared/article-quiz'

describe('reader quiz asynchronous ownership', () => {
  it('saves the original snapshot and credits the original scope after an A → B → A switch', async () => {
    const gate = new ArticleQuizScopeGate()
    const owner = gate.begin('en', 'shared-id')
    const data: ArticleQuizProgress = {
      fingerprint: 'abc',
      answers: [1],
      completed: true,
      history: []
    }
    let release!: () => void
    const wait = new Promise<void>((resolve) => {
      release = resolve
    })
    const writes: unknown[] = [],
      rewards: unknown[] = []
    let updated = false
    const save = saveScopedArticleQuiz(
      owner,
      data,
      async (pack, id, captured) => {
        await wait
        writes.push([pack, id, captured])
      },
      (saved) => rewards.push([saved.packId, saved.id])
    ).then(() => {
      if (gate.current(owner, 'en', 'shared-id')) updated = true
    })
    gate.begin('fr', 'shared-id')
    const returned = gate.begin('en', 'shared-id')
    data.answers.push(3)
    release()
    await save
    expect(writes).toEqual([
      ['en', 'shared-id', { fingerprint: 'abc', answers: [1], completed: true, history: [] }]
    ])
    expect(rewards).toEqual([['en', 'shared-id']])
    expect(updated).toBe(false)
    expect(gate.current(returned, 'en', 'shared-id')).toBe(true)
  })
  it('does not credit failed persistence or a destroyed UI', async () => {
    const gate = new ArticleQuizScopeGate(),
      owner = gate.begin('ar', 'one')
    const rewards: unknown[] = []
    await expect(
      saveScopedArticleQuiz(
        owner,
        { fingerprint: 'a', answers: [], completed: true, history: [] },
        async () => {
          throw new Error('disk full')
        },
        (saved) => rewards.push(saved)
      )
    ).rejects.toThrow('disk full')
    gate.invalidate()
    expect(rewards).toEqual([])
    expect(gate.current(owner, 'ar', 'one')).toBe(false)
  })
})
