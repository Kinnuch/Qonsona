import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LangArticle } from '../src/shared/lang/articles'
const api = vi.hoisted(() => ({
  list: vi.fn(),
  markRead: vi.fn(),
  setTranslation: vi.fn(),
  get: vi.fn(),
  news: vi.fn(),
  analyze: vi.fn()
}))
vi.mock('$lib/platform', () => ({
  platform: { lang: { articles: api, news: api.news, analyze: api.analyze } }
}))
vi.mock('$lib/i18n/index.svelte', () => ({ t: (key: string) => key }))
vi.mock('../src/renderer/src/lib/state/ui.svelte', () => ({ ui: { toast: vi.fn(), go: vi.fn() } }))
let State: typeof import('../src/renderer/src/lib/state/langReading.svelte').LangReadingState
const article = (code: string): LangArticle => ({
  id: 'shared-id',
  code,
  source: 'builtin',
  title: code,
  chars: 4,
  level: null,
  readAt: null,
  body: 'text'
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
beforeAll(async () => {
  // The Node test runner transpiles TS, not Svelte runes. These identity shims leave
  // the actual class methods intact; assertions exercise async ownership only.
  const identity = <T>(value: T): T => value
  vi.stubGlobal('$state', Object.assign(identity, { raw: identity }))
  vi.stubGlobal('$derived', Object.assign(identity, { by: (fn: () => unknown) => fn() }))
  State = (await import('../src/renderer/src/lib/state/langReading.svelte')).LangReadingState
})
beforeEach(() => {
  vi.resetAllMocks()
  api.list.mockImplementation(async (code: string) => [article(code)])
  api.news.mockResolvedValue(null)
})
describe('language reader pending requests', () => {
  it.each([false, true])(
    'does not apply delayed read/translation to B or returned A (ABA=%s)',
    async (aba) => {
      const state = new State()
      await state.ensure('en')
      state.article = article('en')
      const read = deferred<void>(),
        translation = deferred<void>()
      api.markRead.mockReturnValue(read.promise)
      api.setTranslation.mockReturnValue(translation.promise)
      const saving = state.setRead('shared-id', true),
        translating = state.setTranslation('shared-id', 'old English translation')
      await state.ensure('fr')
      if (aba) await state.ensure('en')
      state.article = article(aba ? 'en' : 'fr')
      read.resolve()
      translation.resolve()
      await Promise.all([saving, translating])
      expect(api.markRead).toHaveBeenCalledWith('en', 'shared-id', true)
      expect(api.setTranslation).toHaveBeenCalledWith('en', 'shared-id', 'old English translation')
      expect(state.article.readAt).toBeNull()
      expect(state.article.translation).toBeUndefined()
      expect(state.articles[0].readAt).toBeNull()
      expect(state.articles[0].translated).toBeUndefined()
      expect(state.bilingual).toBe(false)
    }
  )
  it('reloads returning A when its old pending list belongs to a departed generation', async () => {
    const state = new State(),
      old = deferred<LangArticle[]>()
    api.list
      .mockImplementationOnce(() => old.promise)
      .mockImplementation(async (code: string) => [{ ...article(code), title: 'fresh' }])
    const first = state.ensure('en')
    await state.ensure('fr')
    const returned = state.ensure('en')
    old.resolve([{ ...article('en'), title: 'stale' }])
    await Promise.all([first, returned])
    expect(api.list.mock.calls.map((call) => call[0])).toEqual(['en', 'fr', 'en'])
    expect(state.loaded).toBe(true)
    expect(state.loading).toBe(false)
    expect(state.articles[0].title).toBe('fresh')
  })
})
