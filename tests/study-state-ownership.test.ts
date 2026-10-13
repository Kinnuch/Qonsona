import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { build, transform } from 'esbuild'
import { compileModule } from 'svelte/compiler'
import { describe, expect, it, vi } from 'vitest'
const require = createRequire(import.meta.url)
const deferred = <T>() => {
  let release!: (value: T) => void
  const promise = new Promise<T>((resolve) => (release = resolve))
  return { promise, release }
}
async function instance(name: 'courses' | 'practice') {
  const fixture = {
    packs: {
      active: {
        id: 'en',
        kind: 'builtin',
        name: { en: 'English' },
        features: {
          alphabet: 'phonics',
          grammar: true,
          inflection: true,
          phrasebook: true,
          idioms: true,
          stories: true
        }
      },
      project: null,
      hidden: new Set()
    },
    ui: { closing: false, section: name === 'courses' ? 'courses' : 'practice', toast: vi.fn() },
    audio: { canSay: () => false },
    activity: { complete: vi.fn() },
    i18n: { locale: 'en' },
    platform: {
      course: { load: async () => null, save: async () => {} },
      practice: { load: async () => null, save: async () => {} },
      lang: {
        practiceKinds: async () => [],
        practice: vi.fn(),
        articlePractice: vi.fn(),
        paper: vi.fn()
      },
      ja: { grammarExamples: async () => ({}), conjugables: async () => [] }
    },
    courses: { textDone: vi.fn() }
  }
  const mocks: Record<string, string> = {
    packs: 'export const packs=$state(fixture.packs);fixture.packs=packs',
    ui: 'export const ui=$state(fixture.ui);fixture.ui=ui',
    audio: 'export const audio=fixture.audio',
    activity: 'export const activity=fixture.activity',
    i18n: `export const i18n=fixture.i18n;export const t=key=>key;export const pick=text=>typeof text==='string'?text:Object.values(text??{})[0]??''`,
    platform: 'export const platform=fixture.platform',
    courses: 'export const courses=fixture.courses',
    persistence:
      'export const serializedWrites={enqueue:(key,write)=>Promise.resolve().then(write),wait:async()=>{},drain:async()=>{}}'
  }
  const entry = resolve(`src/renderer/src/lib/state/${name}.svelte.ts`)
  const bundle = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    plugins: [
      {
        name: 'actual-state-with-delayed-services',
        setup(b) {
          b.onResolve(
            {
              filter:
                /^\$lib\/platform$|i18n\/index\.svelte$|^\.\/(packs|ui|audio|activity|courses)\.svelte$|^\.\/persistence$/
            },
            (args) => {
              const id =
                args.path === '$lib/platform'
                  ? 'platform'
                  : args.path.includes('i18n/')
                    ? 'i18n'
                    : args.path.replace(/^\.\//, '').replace('.svelte', '')
              return { path: id, namespace: 'fixture' }
            }
          )
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
            contents: compileModule(mocks[args.path], {
              filename: args.path + '.svelte.ts',
              generate: 'client'
            }).js.code,
            loader: 'js',
            resolveDir: resolve('.')
          }))
          b.onLoad({ filter: /\.svelte\.ts$/ }, async (args) => {
            const js = await transform(readFileSync(args.path, 'utf8'), {
              loader: 'ts',
              target: 'esnext'
            })
            return {
              contents: compileModule(js.code, {
                filename: args.path.replace(/\.ts$/, '.js'),
                generate: 'client'
              }).js.code,
              loader: 'js'
            }
          })
          b.onResolve({ filter: /^\$(shared|lib|qon)\// }, (args) => {
            const parts = args.path.split('/')
            const root =
              parts.shift() === '$shared'
                ? 'src/shared'
                : args.path.startsWith('$qon/')
                  ? 'src/renderer/src/vendor/qonlang'
                  : 'src/renderer/src/lib'
            const path = resolve(root, parts.join('/'))
            return { path: existsSync(path + '.ts') ? path + '.ts' : resolve(path, 'index.ts') }
          })
        }
      }
    ]
  })
  const state = new Function(
    'fixture',
    'require',
    `const module={exports:{}};const exports=module.exports;${bundle.outputFiles[0].text};return module.exports`
  )(fixture, require)[name]
  await state.load('en')
  return { state, fixture }
}
describe('real asynchronous study state ownership', () => {
  it('late practice response from the first A cannot overwrite the new A or clear its busy state', async () => {
    const { state, fixture } = await instance('practice'),
      old = deferred<unknown[]>(),
      current = deferred<unknown[]>()
    fixture.platform.lang.practice
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise)
    const first = state.start('meaning')
    fixture.packs.active.id = 'fr'
    await state.load('fr')
    fixture.packs.active.id = 'en'
    await state.load('en')
    const second = state.start('meaning')
    expect(state.busy).toBe(true)
    old.release([{ id: 'stale', answer: 0, choices: [] }])
    await first
    expect(state.run).toBeNull()
    expect(state.busy).toBe(true)
    expect(fixture.activity.complete).not.toHaveBeenCalled()
    current.release([{ id: 'current', answer: 0, choices: [{ text: 'real answer' }] }])
    await second
    expect(state.busy).toBe(false)
    expect(state.run.questions[0].id).toBe('current')
    expect(state.run.packId).toBe('en')
    state.answer(0)
    state.next()
    expect(fixture.activity.complete).toHaveBeenCalledWith('practice', 'meaning/all', 'en')
    await state.flush()
  })
  it('late article questions and exam papers cannot create sessions in a different language', async () => {
    for (const mode of ['article', 'exam'] as const) {
      const { state, fixture } = await instance('practice'),
        response = deferred<unknown>()
      fixture.platform.lang.articlePractice.mockReturnValue(response.promise)
      fixture.platform.lang.paper.mockReturnValue(response.promise)
      const pending =
        mode === 'article' ? state.startArticle('article', 'Article') : state.startExam('paper')
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      expect(
        mode === 'article' ? fixture.platform.lang.articlePractice : fixture.platform.lang.paper
      ).toHaveBeenCalled()
      fixture.packs.active.id = 'fr'
      await state.load('fr')
      response.release(
        mode === 'article'
          ? [{ id: 'stale', answer: 0, choices: [] }]
          : { sections: [{ minutes: 1, questions: [{ id: 'stale' }] }] }
      )
      expect(await pending).toBe(mode === 'article' ? false : undefined)
      expect(state.run).toBeNull()
      expect(state.busy).toBe(false)
      expect(fixture.activity.complete).not.toHaveBeenCalled()
    }
  })
  it('late course spell data cannot replace a new A lesson quiz after A→B→A', async () => {
    const { state, fixture } = await instance('courses'),
      old = deferred<unknown[]>()
    const course = state.course('grammar'),
      lessons = course.units.flatMap((u: { lessons: unknown[] }) => u.lessons)
    state.spellWords = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce([])
    const first = state.startLesson(course.id, lessons[0].id)
    fixture.packs.active.id = 'fr'
    await state.load('fr')
    fixture.packs.active.id = 'en'
    await state.load('en')
    await state.startLesson('grammar', lessons[1].id)
    const newest = state.quiz
    expect(newest).not.toBeNull()
    expect(newest.packId).toBe('en')
    old.release([])
    await first
    expect(state.quiz).toBe(newest)
    expect(state.quiz.target).toBe(lessons[1].id)
    expect(fixture.activity.complete).not.toHaveBeenCalled()
  })
  it('late unit-test generation cannot replace a newly generated unit test in the same returning language', async () => {
    const { state, fixture } = await instance('courses'),
      response = deferred<unknown[]>()
    const unit = state.course('grammar').units[0]
    state.spellWords = vi.fn().mockReturnValueOnce(response.promise).mockResolvedValueOnce([])
    const first = state.startTest('grammar', unit.id)
    fixture.packs.active.id = 'fr'
    await state.load('fr')
    fixture.packs.active.id = 'en'
    await state.load('en')
    await state.startTest('grammar', unit.id)
    const newest = state.quiz
    expect(newest.kind).toBe('test')
    expect(newest.packId).toBe('en')
    response.release([])
    await first
    expect(state.quiz).toBe(newest)
    expect(fixture.activity.complete).not.toHaveBeenCalled()
  })
  it('exiting during delayed course generation leaves no quiz or automatic check-in', async () => {
    const { state, fixture } = await instance('courses'),
      response = deferred<unknown[]>(),
      course = state.course('grammar'),
      lesson = course.units[0].lessons[0]
    state.spellWords = () => response.promise
    const pending = state.startLesson(course.id, lesson.id)
    state.home()
    response.release([])
    await pending
    expect(state.quiz).toBeNull()
    expect(state.view.page).toBe('home')
    expect(fixture.activity.complete).not.toHaveBeenCalled()
  })
})
