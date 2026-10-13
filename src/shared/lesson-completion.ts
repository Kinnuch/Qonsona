import type { Course, CourseLesson, Text } from './course'
const text = (value: Text | undefined): boolean =>
  typeof value === 'string' ? !!value.trim() : !!value && Object.values(value).some((s) => s.trim())
/** Only displayed learning material qualifies; references/titles alone are not content. */
export function lessonHasLearningContent(
  course: Course,
  lesson: CourseLesson,
  docBody?: (id: string) => string | undefined
): boolean {
  return lesson.items.some((key) => {
    if (course.kind === 'symbols') {
      const item = course.symbols[key]
      return !!item && (!!item.symbol.trim() || text(item.note))
    }
    if (course.kind === 'grammar') {
      const item = course.grammar[key]
      return (
        !!item &&
        (text(item.meaning) ||
          text(item.form) ||
          text(item.notes) ||
          item.examples.some((e) => e.ja.trim()))
      )
    }
    if (course.kind === 'forms')
      return !!course.forms?.[key]?.examples.some((e) => e.base.trim() && e.form.trim())
    if (course.kind === 'phrases') {
      const item = course.phrases?.[key]
      return !!item && !!item.text.trim() && text(item.meaning)
    }
    if (course.kind === 'docs') {
      const item = course.docs[key]
      return !!item && !!docBody?.(item.docId)?.trim()
    }
    return false
  })
}
export function completionViewMatches(
  packId: string | null,
  activePackId: string | null,
  section: string,
  view: { page: string; course?: string; lesson?: string },
  courseId: string,
  lessonId: string
): boolean {
  return (
    !!packId &&
    packId === activePackId &&
    section === 'courses' &&
    view.page === 'lesson' &&
    view.course === courseId &&
    view.lesson === lessonId
  )
}
