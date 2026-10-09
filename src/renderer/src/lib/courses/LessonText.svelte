<script lang="ts">
  // 故事课的一课：这一篇（标题、作者、难度、字数、开头一段）。点击「阅读」在阅读器里读（读完点「返回课程」回来），
  // 「本文练习」用这篇的词、语法、句子出题，答对八成过关；读完也可以直接点「学完了」
  import { onMount } from 'svelte'
  import { BookOpen, PenLine, Check } from '@lucide/svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { reading } from '$lib/state/reading.svelte'
  import { practice } from '$lib/state/practice.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { lessonState, type Course, type CourseLesson } from '$shared/course'

  let { course, lesson }: { course: Course; lesson: CourseLesson } = $props()

  onMount(() => reading.ensure())

  const item = $derived(course.texts?.[lesson.items[0]] ?? null)
  const meta = $derived(item ? reading.articles.find((a) => a.id === item.articleId) : undefined)
  const passed = $derived(lessonState(courses.progress!, course, lesson.id) === 'passed')
  /** 开头一段（去掉「一」「二」这类节号） */
  const preview = $derived(meta?.preview?.replace(/^[一二三四五六七八九十]+\s+/, '') ?? '')

  async function read(): Promise<void> {
    if (!item) return
    courses.learned(course.id, lesson.id)
    ui.go('reading')
    await reading.open(item.articleId, 'course')
  }

  async function practise(): Promise<void> {
    if (!item) return
    const ok = await practice.startArticle(item.articleId, item.title, {
      from: 'course',
      course: course.id,
      lesson: lesson.id
    })
    if (ok) ui.go('practice')
  }

  function done(): void {
    courses.textDone(course.id, lesson.id, 1)
    courses.open(course.id)
  }
</script>

{#if item}
  <article class="card story" data-text={item.articleId}>
    <header>
      <h2 lang="ja">{item.title}</h2>
      <span class="faint">
        {[
          item.author,
          meta?.level ? `N${meta.level}` : '',
          meta ? t('reading.chars', { n: meta.chars }) : ''
        ]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </header>
    {#if preview}<p class="preview" lang="ja">{preview}……</p>{/if}
    <div class="row">
      <button class="btn primary" data-read-text onclick={read}
        ><BookOpen size={14} />{t('courses.text.read')}</button
      >
      <button class="btn" data-practice-text disabled={practice.busy} onclick={practise}
        ><PenLine size={14} />{t('courses.text.practice')}</button
      >
    </div>
    <p class="faint">{t('courses.text.hint')}</p>
  </article>
{/if}

<div class="end">
  <button class="btn" data-text-done onclick={done}
    ><Check size={14} />{passed ? t('courses.learn.back') : t('courses.learn.finish')}</button
  >
</div>

<style>
  .story {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  header {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 12px;
  }
  h2 {
    font-size: 24px;
    font-family: var(--font-serif-ja);
  }
  .preview {
    font-size: 16px;
    line-height: 1.9;
    color: var(--text-2);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .end {
    display: flex;
    justify-content: flex-end;
  }
</style>
