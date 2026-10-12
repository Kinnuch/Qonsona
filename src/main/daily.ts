import { ipcMain } from 'electron'
import { LANGS, isLangCode } from '../shared/lang/registry'
import { primarySystem } from '../shared/lang/levels'
import { GRAMMAR } from '../shared/ja/grammar'
import { jaGrammarCourse } from '../shared/ja/grammar-course'
import type { JapaneseDict } from './dict'
import { lexDb } from './lang/ipc'
import { DictionaryDailyRepository } from './dictionary-daily'
import { dailyDate, type DailyPool, type DailyWord } from '../shared/dictionary-daily'

/** 根 main/index.ts 注册一次：registerDictionaryDaily(() => jaDict)。无需传入或上传千语集项目。 */
export function registerDictionaryDaily(getJa: () => JapaneseDict | null): void {
  const repository = new DictionaryDailyRepository((packId) => {
    if (packId === 'ja') {
      const db = getJa()
      const data = db?.dailyPool()
      const course = jaGrammarCourse(null)
      const lessons = new Map(
        course.units.flatMap((u) =>
          u.lessons.flatMap((l) => l.items.map((id) => [id, l.id] as const))
        )
      )
      return {
        database: !!db,
        levels: Object.fromEntries(
          [5, 4, 3, 2, 1].map((n) => [`N${n}`, { zh: `JLPT N${n}`, en: `JLPT N${n}` }])
        ),
        words: (data?.words ?? []).map((w) => {
          const card = {
            key: `ja-${w.id}`,
            front: w.head,
            reading: w.reading,
            meaning: { zh: w.zh, en: w.en }
          }
          return {
            id: String(w.id),
            entryId: w.id,
            front: w.head,
            reading: w.reading,
            meaning: card.meaning,
            level: w.level,
            card
          }
        }),
        sentences: (data?.sentences ?? []).map((s) => ({
          id: String(s.id),
          text: s.ja,
          meaning: { zh: s.zh ?? '', en: s.en ?? '' },
          level: null,
          lang: 'ja-JP'
        })),
        grammar: GRAMMAR.map((g) => ({
          id: g.id,
          title: { zh: g.name, en: g.name },
          meaning: { zh: g.zh, en: g.en },
          level: `N${g.level}`,
          example: g.example,
          lessonId: lessons.get(g.id)
        }))
      } satisfies DailyPool
    }
    if (!isLangCode(packId)) throw new Error('Unsupported daily dictionary language')
    const mod = LANGS[packId]
    const db = lexDb(packId)
    const data = db?.dailyPool()
    const levels = primarySystem(mod.spec.levelSystems).levels
    const course = mod.courses?.('zh').find((c) => c.id === 'grammar')
    const lessons = new Map(
      course?.units.flatMap((u) =>
        u.lessons.flatMap((l) => l.items.map((id) => [id, l.id] as const))
      ) ?? []
    )
    return {
      database: !!db,
      levels: Object.fromEntries(levels.map((l) => [l.id, l.name])),
      words: (data?.words ?? []).map((w): DailyWord => {
        const card = {
          key: `lex-${w.id}`,
          front: w.w,
          reading: w.ipa ?? w.rom ?? (w.d !== w.w ? (w.d ?? '') : ''),
          meaning: { zh: w.zh, en: w.en }
        }
        return {
          id: String(w.id),
          entryId: w.id,
          front: w.d ?? w.w,
          reading: card.reading,
          meaning: card.meaning,
          level: w.lv,
          card
        }
      }),
      sentences: (data?.sentences ?? []).map((s) => ({
        id: String(s.id),
        text: s.text,
        meaning: { zh: s.zh ?? '', en: s.en ?? '' },
        level: s.lv ?? null,
        source: s.src ?? undefined,
        lang: mod.spec.features.speech ?? mod.spec.bcp47
      })),
      grammar: (mod.grammar ?? []).map((g) => ({
        id: g.id,
        title: g.name,
        meaning: g.meaning,
        level: g.level,
        example: g.examples[0]?.text,
        lessonId: lessons.get(g.id)
      }))
    } satisfies DailyPool
  })
  ipcMain.handle('dictionary:daily', (_event, packId: unknown, date: unknown = dailyDate()) => {
    if (typeof packId !== 'string' || (packId !== 'ja' && !isLangCode(packId)))
      throw new Error('Unsupported daily dictionary language')
    if (typeof date !== 'string') throw new Error('Invalid daily date')
    return repository.get(packId, date)
  })
}
