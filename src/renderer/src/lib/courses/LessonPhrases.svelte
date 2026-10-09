<script lang="ts">
  // 会话课：这一课的短语一句一张卡（写法、读音、自造文字、意思、说明），点喇叭听；打开就算学过
  import { onMount, untrack } from 'svelte'
  import { PenLine } from '@lucide/svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import type { Course, CourseLesson } from '$shared/course'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import { sayable, scriptCss, txt } from './view'

  let { course, lesson }: { course: Course; lesson: CourseLesson } = $props()

  onMount(() => untrack(() => courses.learned(course.id, lesson.id)))

  const lang = $derived(packs.active?.kind === 'builtin' ? packs.active.bcp47 : undefined)
</script>

<ul class="phrases">
  {#each lesson.items as key (key)}
    {@const ph = course.phrases?.[key]}
    {#if ph}
      <li class="card phrase" data-phrase={key}>
        <div class="line">
          <span class="text" class:data={!lang} {lang}>{ph.text}</span>
          {#if sayable(ph.say)}<Pronounce item={sayable(ph.say)!} />{/if}
        </div>
        {#if ph.reading}<p class="faint reading" class:data={!lang} {lang}>{ph.reading}</p>{/if}
        {#if ph.script}<p class="script" style={scriptCss(ph.scriptId)}>{ph.script}</p>{/if}
        <p class="meaning">{txt(ph.meaning)}</p>
        {#if ph.note}<p class="muted">{txt(ph.note)}</p>{/if}
      </li>
    {/if}
  {/each}
</ul>

<div class="end">
  <button
    class="btn primary"
    data-quiz-here
    onclick={() => courses.startLesson(course.id, lesson.id)}
    ><PenLine size={14} />{t('courses.learn.startQuiz')}</button
  >
</div>

<style>
  .phrases {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 10px;
  }
  .phrase {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .text {
    font-size: 20px;
    font-weight: 600;
  }
  .data {
    font-family: var(--font-data);
  }
  .reading {
    font-size: 13px;
  }
  .script {
    font-size: 22px;
  }
  .meaning {
    font-size: 15px;
  }
  .end {
    display: flex;
    justify-content: flex-end;
  }
</style>
