<script lang="ts">
  // 课程：课程列表 → 一门课（单元与课）→ 一课（先学后练）→ 练习 / 测验。走到哪一步记在 courses.view 里
  import { onMount } from 'svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { findLesson } from '$shared/course'
  import CourseList from '$lib/courses/CourseList.svelte'
  import CourseOverview from '$lib/courses/CourseOverview.svelte'
  import LessonView from '$lib/courses/LessonView.svelte'
  import QuizView from '$lib/courses/QuizView.svelte'

  onMount(() => void courses.load(packs.active?.id ?? null))

  const v = $derived(courses.view)
  const course = $derived(
    v.page === 'course' || v.page === 'lesson' ? courses.course(v.course) : null
  )
  const lesson = $derived(v.page === 'lesson' && course ? findLesson(course, v.lesson) : null)
</script>

{#if !courses.progress}
  <div class="page"><p class="muted">{t('common.loading')}</p></div>
{:else if v.page === 'quiz' && courses.quiz}
  <QuizView />
{:else if v.page === 'lesson' && course && lesson}
  {#key lesson.lesson.id}
    <LessonView {course} unit={lesson.unit} lesson={lesson.lesson} />
  {/key}
{:else if v.page === 'course' && course}
  <CourseOverview {course} />
{:else}
  <CourseList />
{/if}
