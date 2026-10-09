<script lang="ts">
  // 一课：顶上是回到课程、这一课的名字与状态、课前说明；下面按课的种类：
  // 认字（一个一个看，最后读一读）、语法点讲解、文档、课文。学完点「开始练习」
  // （文档课点「学完了」，故事课做本文练习）
  import { ArrowLeft, PenLine } from '@lucide/svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { lessonState, type Course, type CourseLesson, type CourseUnit } from '$shared/course'
  import { txt } from './view'
  import LessonSymbols from './LessonSymbols.svelte'
  import LessonGrammar from './LessonGrammar.svelte'
  import LessonDoc from './LessonDoc.svelte'
  import LessonForms from './LessonForms.svelte'
  import LessonPhrases from './LessonPhrases.svelte'
  import LessonText from './LessonText.svelte'

  let { course, unit, lesson }: { course: Course; unit: CourseUnit; lesson: CourseLesson } =
    $props()

  const state = $derived(lessonState(courses.progress!, course, lesson.id))
</script>

<div class="page lesson-page" data-lesson-page={lesson.id}>
  <div class="top">
    <button class="btn ghost" data-back onclick={() => courses.open(course.id)}
      ><ArrowLeft size={16} />{t('courses.learn.back')}</button
    >
    <div class="grow"></div>
    {#if course.kind !== 'docs' && course.kind !== 'texts'}
      <button class="btn" data-start-quiz onclick={() => courses.startLesson(course.id, lesson.id)}
        ><PenLine size={14} />{t('courses.learn.startQuiz')}</button
      >
    {/if}
  </div>
  <header class="head">
    <span class="faint">{txt(course.title)} · {txt(unit.title)}</span>
    <div class="title">
      <h1>{txt(lesson.title)}</h1>
      <span class="chip state {state}" data-lesson-state={state}>{t(`courses.state.${state}`)}</span
      >
    </div>
  </header>
  {#if lesson.note}<p class="card note">{txt(lesson.note)}</p>{/if}

  {#if course.kind === 'symbols'}
    <LessonSymbols {course} {lesson} />
  {:else if course.kind === 'grammar'}
    <LessonGrammar {course} {lesson} />
  {:else if course.kind === 'forms'}
    <LessonForms {course} {lesson} />
  {:else if course.kind === 'phrases'}
    <LessonPhrases {course} {lesson} />
  {:else if course.kind === 'texts'}
    <LessonText {course} {lesson} />
  {:else}
    <LessonDoc {course} {lesson} />
  {/if}
</div>

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .grow {
    flex: 1;
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .note {
    background: var(--bg-sunken);
    border: none;
  }
  .state.learned {
    background: color-mix(in srgb, #c98a1b 16%, var(--bg-elev));
    color: #a86f10;
  }
  .state.passed {
    background: color-mix(in srgb, #2f9e63 16%, var(--bg-elev));
    color: #23804f;
  }
</style>
