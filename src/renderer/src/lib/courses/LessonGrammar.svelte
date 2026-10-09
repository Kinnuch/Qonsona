<script lang="ts">
  // 语法课的讲解：这一课的每个语法点（名字、意思、接续、例句，见 GrammarPointCard）。打开就算学过
  import { onMount, untrack } from 'svelte'
  import { PenLine } from '@lucide/svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import type { Course, CourseLesson } from '$shared/course'
  import GrammarPointCard from './GrammarPointCard.svelte'

  let { course, lesson }: { course: Course; lesson: CourseLesson } = $props()

  onMount(() => untrack(() => courses.learned(course.id, lesson.id)))
</script>

{#each lesson.items as key (key)}
  {@const g = course.grammar[key]}
  {#if g}<GrammarPointCard {g} />{/if}
{/each}

<div class="end">
  <button
    class="btn primary"
    data-quiz-here
    onclick={() => courses.startLesson(course.id, lesson.id)}
    ><PenLine size={14} />{t('courses.learn.startQuiz')}</button
  >
</div>

<style>
  .end {
    display: flex;
    justify-content: flex-end;
  }
</style>
