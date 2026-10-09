<script lang="ts">
  // 文档课：作者在千语集里写的一篇文档（Markdown，文档间的链接跟阅读页一样能点），读完点「学完了」
  import { Check } from '@lucide/svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { mdToHtml } from '$qon/core/markdown'
  import { docLinkResolver } from '$lib/packs/qonlang/reading'
  import { lessonState, type Course, type CourseLesson } from '$shared/course'

  let { course, lesson }: { course: Course; lesson: CourseLesson } = $props()

  const project = $derived(packs.project)
  const doc = $derived.by(() => {
    const item = course.docs[lesson.items[0]]
    return item && project ? (project.docs.find((d) => d.id === item.docId) ?? null) : null
  })
  const html = $derived(
    doc && project ? mdToHtml(doc.markdown, { resolve: docLinkResolver(project) }) : ''
  )
  const passed = $derived(lessonState(courses.progress!, course, lesson.id) === 'passed')

  function done(): void {
    courses.learned(course.id, lesson.id)
    courses.open(course.id)
  }
</script>

{#if html}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- mdToHtml 已转义原文，链接只认 http(s) 与文档链接 -->
  <article class="card md" data-doc>{@html html}</article>
{/if}

<div class="end">
  <button class="btn primary" data-doc-done onclick={done}
    ><Check size={14} />{passed ? t('courses.learn.back') : t('courses.learn.finish')}</button
  >
</div>

<style>
  .md {
    line-height: 1.7;
  }
  .end {
    display: flex;
    justify-content: flex-end;
  }
</style>
