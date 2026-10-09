<script lang="ts">
  // 认字：这一课的字一个一个看（大字、读音、发音、笔顺、对应的另一套写法、说明、例词），
  // 最后一步「读一读」：只用学过的字写成的词。看到最后一步算学过这一课。← → 键翻页
  import { untrack } from 'svelte'
  import { ArrowLeft, ArrowRight, PenLine } from '@lucide/svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { platform } from '$lib/platform'
  import { t } from '$lib/i18n/index.svelte'
  import type { Course, CourseLesson, SpellWord } from '$shared/course'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import StrokeOrder from '$lib/ui/StrokeOrder.svelte'
  import { txt, scriptCss, sayable } from './view'

  let { course, lesson }: { course: Course; lesson: CourseLesson } = $props()

  const items = $derived(lesson.items.map((k) => course.symbols[k]).filter(Boolean))
  const lang = $derived(packs.active?.kind === 'builtin' ? packs.active.bcp47 : undefined)

  // 读一读的词（没有也不显示这一步）
  let words = $state<SpellWord[] | null>(null)
  $effect(() => {
    const l = lesson
    void courses.spellWords(course, l).then((w) => {
      if (lesson === l) words = w
    })
  })
  const steps = $derived(items.length + (words?.length ? 1 : 0))
  const view = $derived(courses.view)
  const step = $derived(view.page === 'lesson' ? Math.min(view.step, Math.max(0, steps - 1)) : 0)
  const item = $derived(step < items.length ? items[step] : null)

  function go(i: number): void {
    if (courses.view.page === 'lesson') courses.view.step = Math.max(0, Math.min(steps - 1, i))
  }

  // 看到最后一步（或者这一课只有一步）算学过（记进度会改 progress，别让这个 effect 跟着它再跑）
  $effect(() => {
    if (steps && step === steps - 1) untrack(() => courses.learned(course.id, lesson.id))
  })

  // 当前这个字的笔顺与例词
  let paths = $state<string[]>([])
  let examples = $state<SpellWord[] | null>(null)
  $effect(() => {
    const it = item
    paths = []
    examples = null
    if (!it) return
    if (it.strokes)
      void platform.ja.kanji(it.symbol).then((k) => {
        if (item === it) paths = k?.paths ?? []
      })
    void courses.startWords(course, it.key).then((w) => {
      if (item === it) examples = w
    })
  })

  const pairLabel = (pair: string): string =>
    t(`courses.learn.pair.${/[ァ-ヺ]/.test(pair) ? 'kata' : 'hira'}`)

  function onkey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return
    if (e.key === 'ArrowRight') go(step + 1)
    else if (e.key === 'ArrowLeft') go(step - 1)
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="tabs" role="tablist">
  {#each items as it, i (it.key)}
    <button
      class="tab"
      class:on={i === step}
      role="tab"
      aria-selected={i === step}
      data-step={i}
      style={scriptCss(it.scriptId)}
      {lang}
      onclick={() => go(i)}>{it.symbol}</button
    >
  {/each}
  {#if words?.length}
    <button
      class="tab words"
      class:on={step === items.length}
      role="tab"
      aria-selected={step === items.length}
      data-step={items.length}
      onclick={() => go(items.length)}>{t('courses.learn.readAlong')}</button
    >
  {/if}
</div>

{#if item}
  <div class="card symbol-card" data-symbol={item.key}>
    <div class="main">
      <p class="big" style={scriptCss(item.scriptId)} {lang}>{item.symbol}</p>
      {#if !item.learnOnly}
        <div class="reading-row">
          <span class="reading" data-reading>{item.reading}</span>
          {#if item.ipa && !item.reading.includes(item.ipa)}<span class="ipa">[{item.ipa}]</span
            >{/if}
          {#if sayable(item.say)}<Pronounce item={sayable(item.say)!} />{/if}
        </div>
      {/if}
      {#if item.pair}
        <p class="pair">
          <span class="faint">{pairLabel(item.pair)}</span>
          <span {lang}>{item.pair}</span>
        </p>
      {/if}
      {#if item.note}<p class="note">{txt(item.note)}</p>{/if}
    </div>
    {#if paths.length}
      <div class="strokes">
        <span class="faint">{t('courses.learn.strokes')}</span>
        <StrokeOrder {paths} size={150} />
      </div>
    {/if}
  </div>
  {#if !item.learnOnly}
    <section class="examples">
      <h3>{t('courses.learn.examples')}</h3>
      {#if examples && !examples.length}
        <p class="faint">{t('courses.learn.noExamples')}</p>
      {:else if examples}
        {@render wordList(examples)}
      {/if}
    </section>
  {/if}
{:else if words?.length}
  <section class="examples" data-read-along>
    <p class="muted">{t('courses.learn.readAlongHint')}</p>
    {@render wordList(words)}
  </section>
{/if}

<div class="nav">
  <button class="btn" data-prev disabled={step === 0} onclick={() => go(step - 1)}
    ><ArrowLeft size={14} />{t('courses.learn.prev')}</button
  >
  <span class="faint">{t('courses.learn.itemOf', { i: step + 1, n: Math.max(1, steps) })}</span>
  {#if step < steps - 1}
    <button class="btn primary" data-next onclick={() => go(step + 1)}
      >{t('courses.learn.next')}<ArrowRight size={14} /></button
    >
  {:else}
    <button
      class="btn primary"
      data-quiz-here
      onclick={() => courses.startLesson(course.id, lesson.id)}
      ><PenLine size={14} />{t('courses.learn.startQuiz')}</button
    >
  {/if}
</div>

{#snippet wordList(list: SpellWord[])}
  <ul class="words">
    {#each list as w (w.text)}
      <li data-word={w.text}>
        <span class="w" style={scriptCss(w.scriptId)} {lang}>{w.text}</span>
        {#if w.head}<span class="head" {lang}>{w.head}</span>{/if}
        <span class="r">{w.reading}</span>
        <span class="m muted">{txt(w.meaning)}</span>
        {#if sayable(w.say)}<Pronounce item={sayable(w.say)!} />{/if}
      </li>
    {/each}
  </ul>
{/snippet}

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    min-width: 44px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    font-size: 18px;
    cursor: pointer;
  }
  .tab.words {
    font-size: 14px;
  }
  .tab.on {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .symbol-card {
    display: flex;
    gap: 24px;
    align-items: center;
    justify-content: space-between;
    padding: 24px 28px;
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .big {
    font-size: 96px;
    line-height: 1.1;
  }
  .reading-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .reading {
    font-size: 28px;
    font-weight: 600;
    font-family: var(--font-data);
  }
  .ipa {
    font-family: var(--font-data);
    color: var(--text-2);
    font-size: 18px;
  }
  .pair {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 22px;
  }
  .note {
    max-width: 520px;
    color: var(--text-2);
  }
  .strokes {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .examples {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  h3 {
    font-size: 15px;
  }
  .words {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .words li {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    border: 1px solid var(--border);
  }
  .w {
    font-size: 20px;
  }
  .head {
    color: var(--text-2);
  }
  .r {
    font-family: var(--font-data);
  }
  .m {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
</style>
