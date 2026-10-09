<script lang="ts">
  // 一门课：各单元的课（未学 / 学过 / 已过关，练习的最好成绩）与单元测验；顶上是进度、继续学习、练薄弱项
  import { ArrowLeft, Play, Target, ClipboardCheck } from '@lucide/svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import {
    courseSummary,
    lessonState,
    nextLesson,
    progressKey,
    weakItems,
    type Course
  } from '$shared/course'
  import { txt } from './view'

  let { course }: { course: Course } = $props()

  const progress = $derived(courses.progress!)
  const sum = $derived(courseSummary(course, progress))
  const next = $derived(nextLesson(course, progress))
  /** 文档课、故事课不出课内的题，没有薄弱项可练 */
  const quizzes = $derived(course.kind !== 'docs' && course.kind !== 'texts')
  const weak = $derived(quizzes ? weakItems(course, progress, 8) : [])
  const pct = (x: number): number => Math.round(x * 100)
</script>

<div class="page" data-course-page={course.id}>
  <div>
    <button class="btn ghost" data-back onclick={() => courses.home()}
      ><ArrowLeft size={16} />{t('courses.allCourses')}</button
    >
  </div>
  <header class="head">
    <h1>{txt(course.title)}</h1>
    <span class="muted">{t('courses.progress', { passed: sum.passed, n: sum.lessons })}</span>
  </header>
  {#if course.intro}<p class="muted">{txt(course.intro)}</p>{/if}
  {#if course.legend}
    <p class="card legend"><strong>{t('courses.legend')}</strong> {txt(course.legend)}</p>
  {/if}

  <div class="row">
    {#if next}
      <button
        class="btn primary"
        data-continue
        onclick={() => courses.openLesson(course.id, next.lesson.id)}
        ><Play size={14} />{t('courses.continue', { lesson: txt(next.lesson.title) })}</button
      >
    {:else}
      <span class="muted">{t('courses.allDone')}</span>
    {/if}
    {#if quizzes}
      <button
        class="btn"
        data-practice
        disabled={!weak.length}
        title={weak.length ? t('courses.practiceHint') : t('courses.noWeak')}
        onclick={() => courses.startPractice(course.id)}
        ><Target size={14} />{t('courses.practice')}</button
      >
    {/if}
  </div>

  {#each course.units as u (u.id)}
    <section class="unit" data-unit={u.id}>
      <h2>{txt(u.title)}</h2>
      {#if u.note}<p class="muted">{txt(u.note)}</p>{/if}
      <div class="lessons">
        {#each u.lessons as l (l.id)}
          {@const st = lessonState(progress, course, l.id)}
          {@const rec = progress.lessons[progressKey(course.id, l.id)]}
          <button
            class="card lesson {st}"
            class:next={next?.lesson.id === l.id}
            data-lesson={l.id}
            data-state={st}
            onclick={() => courses.openLesson(course.id, l.id)}
          >
            <span class="title">{txt(l.title)}</span>
            <span class="meta">
              <span class="chip state">{t(`courses.state.${st}`)}</span>
              {#if rec?.tries && course.kind !== 'docs'}
                <span class="faint">{t('courses.best', { pct: pct(rec.best) })}</span>
              {/if}
            </span>
          </button>
        {/each}
        {#if u.test}
          {@const test = progress.tests[progressKey(course.id, u.id)]}
          <button
            class="card lesson test"
            class:passed={test?.passed}
            data-test={u.id}
            title={t('courses.unitTestHint')}
            onclick={() => courses.startTest(course.id, u.id)}
          >
            <span class="title"><ClipboardCheck size={15} />{t('courses.unitTest')}</span>
            <span class="meta">
              {#if test?.passed}
                <span class="chip state">{t('courses.testPassed', { pct: pct(test.best) })}</span>
              {:else if test}
                <span class="faint">{t('courses.best', { pct: pct(test.best) })}</span>
              {:else}
                <span class="faint">{t('courses.unitTestHint')}</span>
              {/if}
            </span>
          </button>
        {/if}
      </div>
    </section>
  {/each}
</div>

<style>
  .head {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .legend {
    background: var(--bg-sunken);
    border: none;
    font-size: 13px;
    color: var(--text-2);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .unit {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  h2 {
    font-size: 17px;
  }
  .lessons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 8px;
  }
  .lesson {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 14px;
    text-align: start;
    cursor: pointer;
  }
  .lesson:hover {
    border-color: var(--border-strong);
  }
  .lesson.next {
    border-color: var(--accent);
    box-shadow: var(--ring);
  }
  .title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .learned .state {
    background: color-mix(in srgb, #c98a1b 16%, var(--bg-elev));
    color: #a86f10;
  }
  .passed .state {
    background: color-mix(in srgb, #2f9e63 16%, var(--bg-elev));
    color: #23804f;
  }
  .test {
    background: var(--bg-sunken);
  }
</style>
