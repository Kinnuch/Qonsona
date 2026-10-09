<script lang="ts">
  // 课程列表：学习包有的每一块（字母、语法、变形、会话）一张卡片，写进度、「继续学习」；
  // 这门语言在这一块没有内容可学时写明
  import { GraduationCap, Play, List } from '@lucide/svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { courseSections, type CourseSection } from '$lib/packs/modules'
  import { courseSummary, lessonState, nextLesson, type Course } from '$shared/course'
  import { txt } from './view'

  const pack = $derived(packs.active)
  const sections = $derived(pack ? courseSections(pack.features) : [])
  const progress = $derived(courses.progress!)

  function sectionName(s: CourseSection): string {
    const f = pack!.features
    if (s === 'alphabet' && f.alphabet) return t(`kinds.alphabet.${f.alphabet}`)
    return t(`modules.courses.sections.${s}`)
  }

  /** 学过任何一课了没有（按钮写「开始学习」还是「继续学习」） */
  const started = (c: Course): boolean =>
    c.units.some((u) => u.lessons.some((l) => lessonState(progress, c, l.id) !== 'new'))

  function go(c: Course): void {
    const next = nextLesson(c, progress)
    if (next) courses.openLesson(c.id, next.lesson.id)
    else courses.open(c.id)
  }
</script>

<div class="page">
  <header class="page-head">
    <GraduationCap size={22} strokeWidth={1.8} />
    <h1>{t('nav.courses')}</h1>
  </header>
  <p class="muted">{t('courses.intro')}</p>

  <div class="list">
    {#each sections as s (s)}
      {@const c = courses.course(s)}
      {#if c}
        {@const sum = courseSummary(c, progress)}
        {@const next = nextLesson(c, progress)}
        <section class="card course" data-course={c.id}>
          <div class="head">
            <h2>{txt(c.title)}</h2>
            <span class="muted" data-course-progress
              >{t('courses.progress', { passed: sum.passed, n: sum.lessons })}</span
            >
            {#if sum.tests}
              <span class="faint"
                >{t('courses.testsPassed', { passed: sum.testsPassed, n: sum.tests })}</span
              >
            {/if}
          </div>
          {#if c.intro}<p class="muted">{txt(c.intro)}</p>{/if}
          <div class="track">
            <div class="fill" style:width="{(sum.passed / Math.max(1, sum.lessons)) * 100}%"></div>
          </div>
          {#if !next}<p class="muted">{t('courses.allDone')}</p>{/if}
          <div class="row">
            {#if next}
              <button class="btn primary" data-continue onclick={() => go(c)}
                ><Play size={14} />{started(c)
                  ? t('courses.continue', { lesson: txt(next.lesson.title) })
                  : t('courses.start')}</button
              >
            {/if}
            <button class="btn" data-open-course onclick={() => courses.open(c.id)}
              ><List size={14} />{t('courses.allLessons')}</button
            >
          </div>
        </section>
      {:else}
        <section class="card soon" data-section={s}>
          <h2>{sectionName(s)}</h2>
          <p class="muted">{t('courses.none')}</p>
        </section>
      {/if}
    {/each}
  </div>
</div>

<style>
  .page-head :global(svg) {
    color: var(--accent-text);
    align-self: center;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .course,
  .soon {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }
  h2 {
    font-size: 18px;
  }
  .soon {
    background: var(--bg-sunken);
  }
  .track {
    height: 6px;
    border-radius: 3px;
    background: var(--bg-sunken);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>
