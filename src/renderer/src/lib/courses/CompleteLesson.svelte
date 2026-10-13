<script lang="ts">
  import { Check } from '@lucide/svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { i18n } from '$lib/i18n/index.svelte'
  let { courseId, lessonId }: { courseId: string; lessonId: string } = $props()
  const available = $derived(courses.canCompleteLesson(courseId, lessonId))
</script>

<button
  class="btn"
  data-complete-lesson
  disabled={!available}
  onclick={() => courses.completeLesson(courseId, lessonId)}
  ><Check size={14} />{i18n.locale === 'zh'
    ? '完成本课学习'
    : 'Finish learning this lesson'}</button
>
