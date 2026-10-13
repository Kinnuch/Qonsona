<script lang="ts">
  // 变形课：这一课的几个形排成一张变形表（每行一个词、每列一个形），点喇叭听；打开就算学过
  import { onMount, untrack } from 'svelte'
  import { PenLine } from '@lucide/svelte'
  import { courses } from '$lib/state/courses.svelte'
  import CompleteLesson from './CompleteLesson.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import type { Course, CourseLesson, FormExample } from '$shared/course'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import { sayable, txt } from './view'

  /** 表里最多列这么多个词 */
  const ROWS = 10

  let { course, lesson }: { course: Course; lesson: CourseLesson } = $props()

  onMount(() => untrack(() => courses.learned(course.id, lesson.id)))

  const lang = $derived(packs.active?.kind === 'builtin' ? packs.active.bcp47 : undefined)
  const items = $derived(lesson.items.map((k) => course.forms?.[k]).filter((x) => !!x))

  /** 一行一个词：这个词在每个形下的那一格（没有这个形的是空格） */
  const rows = $derived.by(() => {
    const bases: FormExample[] = []
    for (const it of items)
      for (const ex of it.examples) if (!bases.some((b) => b.base === ex.base)) bases.push(ex)
    return bases.slice(0, ROWS).map((b) => ({
      base: b,
      cells: items.map((it) => it.examples.find((e) => e.base === b.base) ?? null)
    }))
  })
</script>

<div class="wrap">
  <table class="forms" data-forms-table>
    <thead>
      <tr>
        <th>{t('courses.learn.base')}</th>
        {#each items as it (it.key)}<th>{txt(it.title)}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as r (r.base.base)}
        <tr>
          <td class="base">
            <div class="cell-stack">
              <span class="w" class:data={!lang} {lang}>{r.base.base}</span>
              {#if r.base.baseReading}<span class="faint" {lang}>{r.base.baseReading}</span>{/if}
              {#if r.base.meaning}<span class="faint m">{txt(r.base.meaning)}</span>{/if}
            </div>
          </td>
          {#each r.cells as c, i (i)}
            <td data-cell>
              {#if c}
                <div class="cell-stack">
                  <div class="form-line">
                    <span class="w" class:data={!lang} {lang}>{c.form}</span>
                    {#if sayable(c.say)}<Pronounce item={sayable(c.say)!} />{/if}
                  </div>
                  {#if c.formReading}<span class="faint" {lang}>{c.formReading}</span>{/if}
                </div>
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<div class="end">
  <CompleteLesson courseId={course.id} lessonId={lesson.id} />
  <button
    class="btn primary"
    data-quiz-here
    onclick={() => courses.startLesson(course.id, lesson.id)}
    ><PenLine size={14} />{t('courses.learn.startQuiz')}</button
  >
</div>

<style>
  .wrap {
    min-width: 0;
    max-width: 100%;
    overflow-x: auto;
    overscroll-behavior-x: contain;
  }
  .forms {
    /* Cells must retain table-cell display so all columns share each row's height. */
    border-collapse: collapse;
    width: 100%;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  th,
  td {
    min-width: 120px;
    padding: 8px 12px;
    text-align: start;
    vertical-align: top;
    border-bottom: 1px solid var(--border);
  }
  th {
    font-size: 13px;
    color: var(--text-2);
    font-weight: 600;
    background: var(--bg-sunken);
  }
  td {
    white-space: nowrap;
  }
  td :global(.pron) {
    vertical-align: middle;
  }
  .cell-stack {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .form-line {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .w {
    font-size: 17px;
  }
  .data {
    font-family: var(--font-data);
  }
  .m {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .end {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
