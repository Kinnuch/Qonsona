/**
 * 框架语言写课程（LangModule.courses）用的帮手。课程的结构是 src/shared/course.ts 的 Course，
 * 这里只管把这门语言已有的东西（语法点）变成课：语法课的条目、按主分级分单元。
 * 字母课、变形课、会话课的内容各语言自己写（每门语言的字母、变形、场景都不一样）。
 */
import type { Course, CourseLesson, CourseUnit, GrammarItem, Text } from '../course'
import { primarySystem } from './levels'
import type { LangModule, LexGrammarPoint, LocalizedText } from './types'

/** 按界面语言挑一种写法：先界面语言，再英文、中文 */
export function pickText(t: LocalizedText, locale: string): string {
  return t[locale] ?? t.en ?? t.zh ?? Object.values(t)[0] ?? ''
}

/** 一个语法点 → 语法课的条目。例句的 hl 是要高亮的那一段，在句子里找不到时这一句只讲不考 */
export function lexGrammarItem(g: LexGrammarPoint, locale: string): GrammarItem {
  return {
    key: g.id,
    name: pickText(g.name, locale),
    form: pickText(g.form, locale),
    meaning: g.meaning,
    ...(g.notes ? { notes: g.notes } : {}),
    ...(g.group ? { group: g.group } : {}),
    examples: g.examples.map((ex) => {
      const at = ex.hl ? ex.text.indexOf(ex.hl) : -1
      return {
        ja: ex.text,
        zh: ex.zh ?? null,
        en: ex.en ?? null,
        start: at >= 0 ? at : 0,
        end: at >= 0 ? at + ex.hl!.length : 0,
        source: 'builtin' as const
      }
    })
  }
}

/** 自己分的单元：一课学哪几个语法点（语法点 id） */
export interface GrammarUnitDef {
  id: string
  title: LocalizedText
  note?: LocalizedText
  lessons: { id: string; title?: LocalizedText; items: string[]; note?: LocalizedText }[]
}

const joinNames = (points: LexGrammarPoint[]): LocalizedText => ({
  zh: points.map((g) => pickText(g.name, 'zh')).join('、'),
  en: points.map((g) => pickText(g.name, 'en')).join(', ')
})

/**
 * 语法课（id grammar）：units 不给时按主分级每级一个单元，这一级的语法点按写的顺序每 perLesson 个一课；
 * 课名是这几个语法点的名字。每个单元都有测验
 */
export function lexGrammarCourse(
  mod: LangModule,
  locale: string,
  o: {
    title?: LocalizedText
    intro?: LocalizedText
    units?: GrammarUnitDef[]
    perLesson?: number
  } = {}
): Course {
  const points = mod.grammar ?? []
  const byId = new Map(points.map((g) => [g.id, g]))
  const per = Math.max(1, o.perLesson ?? 3)
  const lessonTitle = (items: string[], title?: LocalizedText): Text =>
    title ?? joinNames(items.map((id) => byId.get(id)).filter((g): g is LexGrammarPoint => !!g))

  let units: CourseUnit[]
  if (o.units) {
    units = o.units.map((u) => ({
      id: u.id,
      title: u.title,
      ...(u.note ? { note: u.note } : {}),
      lessons: u.lessons.map((l): CourseLesson => ({
        id: l.id,
        title: lessonTitle(l.items, l.title),
        items: l.items.filter((id) => byId.has(id)),
        ...(l.note ? { note: l.note } : {})
      })),
      test: true
    }))
  } else {
    units = []
    for (const lv of primarySystem(mod.spec.levelSystems).levels) {
      const mine = points.filter((g) => g.level === lv.id)
      if (!mine.length) continue
      const lessons: CourseLesson[] = []
      for (let i = 0; i < mine.length; i += per) {
        const items = mine.slice(i, i + per).map((g) => g.id)
        lessons.push({ id: `${lv.id}-${lessons.length + 1}`, title: lessonTitle(items), items })
      }
      units.push({ id: lv.id, title: lv.name, lessons, test: true })
    }
  }

  return {
    id: 'grammar',
    kind: 'grammar',
    title: o.title ?? { zh: '语法', en: 'Grammar' },
    ...(o.intro ? { intro: o.intro } : {}),
    units,
    symbols: {},
    grammar: Object.fromEntries(points.map((g) => [g.id, lexGrammarItem(g, locale)])),
    docs: {}
  }
}
