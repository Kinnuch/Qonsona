<script lang="ts">
  // 做模拟卷：一节一节做，每节限时（右上角倒计时，时间到了自动进下一节）；
  // 一节里可以点题号前后翻、改答案，答完点「下一节」，最后一节点「交卷」。
  // 快捷键：1–4 选择，← → 上一题 / 下一题，R 再听一遍
  import { onMount, untrack } from 'svelte'
  import { X, ArrowLeft, ArrowRight, Clock, Headphones } from '@lucide/svelte'
  import { practice, type ExamRun } from '$lib/state/practice.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { txt } from '$lib/courses/view'
  import ExamPrompt from './ExamPrompt.svelte'
  import Choices from './Choices.svelte'
  import { clock, playPrompt } from './view'

  const run = $derived(practice.run as ExamRun)
  const section = $derived(run.paper.sections[run.section])
  const q = $derived(section.questions[run.i])
  const mine = $derived(run.answers[run.section])
  const last = $derived(run.section === run.paper.sections.length - 1)
  const blanks = $derived(mine.filter((a) => a === null).length)

  let now = $state(Date.now())
  const left = $derived(run.deadline - now)
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 250)
    return () => clearInterval(timer)
  })

  // 时间到了：这一节自动结束
  $effect(() => {
    if (left > 0) return
    untrack(() => {
      ui.toast(t(last ? 'practice.exam.timeUpLast' : 'practice.exam.timeUp'))
      practice.endSection()
    })
  })

  // 翻到听力题自动放一遍
  $effect(() => {
    void run.section
    void run.i
    untrack(() => {
      if (q?.prompt.listen) playPrompt(q)
    })
  })

  async function finishSection(): Promise<void> {
    const at = run.section
    if (blanks) {
      const ok = await ui.confirm(
        t(last ? 'practice.exam.submit' : 'practice.exam.nextSection'),
        t('practice.exam.blanks', { n: blanks }),
        t(last ? 'practice.exam.submit' : 'practice.exam.nextSection')
      )
      // 确认框开着的时候时间到了、已经自动进了下一节，就不再往下跳
      const cur = practice.run
      if (!ok || cur?.mode !== 'exam' || cur.section !== at) return
    }
    practice.endSection()
  }

  async function quit(): Promise<void> {
    const ok = await ui.confirm(
      t('practice.exam.quitTitle'),
      t('practice.exam.quitBody'),
      t('practice.exam.quit'),
      true
    )
    if (ok) practice.home()
  }

  function onkey(e: KeyboardEvent): void {
    if (ui.confirmRequest || (e.target as HTMLElement).closest('input, textarea, select')) return
    if (/^[1-9]$/.test(e.key) && Number(e.key) <= q.choices.length) {
      e.preventDefault()
      practice.choose(Number(e.key) - 1)
    } else if (e.key === 'ArrowRight') practice.goto(run.i + 1)
    else if (e.key === 'ArrowLeft') practice.goto(run.i - 1)
    else if ((e.key === 'r' || e.key === 'R') && q.prompt.listen) playPrompt(q)
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="exam" data-exam={run.paper.id} data-exam-section={section.id}>
  <header class="bar">
    <strong>{txt(run.paper.title)}</strong>
    <span class="faint">·</span>
    <span data-section-title>{txt(section.title)}</span>
    <span class="faint"
      >{t('practice.exam.sectionOf', { i: run.section + 1, n: run.paper.sections.length })}</span
    >
    <div class="grow"></div>
    <span class="timer" class:low={left < 60_000} data-timer><Clock size={15} />{clock(left)}</span>
    <button class="btn ghost" data-exam-quit title={t('practice.exam.quit')} onclick={quit}
      ><X size={16} /></button
    >
  </header>

  <div class="sections">
    {#each run.paper.sections as s, k (s.id)}
      <span class="chip" class:on={k === run.section} class:past={k < run.section}
        >{txt(s.title)} · {t('practice.exam.minutes', { n: s.minutes })}</span
      >
    {/each}
  </div>

  <nav class="numbers" aria-label={t('practice.exam.questions')}>
    {#each section.questions as x, k (x.id)}
      <button
        class="num"
        class:on={k === run.i}
        class:answered={mine[k] !== null}
        data-goto={k}
        aria-current={k === run.i ? 'true' : undefined}
        onclick={() => practice.goto(k)}>{k + 1}</button
      >
    {/each}
  </nav>

  {#key `${run.section}-${run.i}`}
    <div class="card question" data-question={q.kind}>
      {#if q.prompt.listen}<span class="faint listen-note"
          ><Headphones size={13} />{t('practice.exam.listenNote')}</span
        >{/if}
      <ExamPrompt {q} reveal={false} />
      <Choices {q} selected={mine[run.i]} reveal={false} onchoose={(i) => practice.choose(i)} />
    </div>
  {/key}

  <footer class="nav">
    <button class="btn" data-prev disabled={run.i === 0} onclick={() => practice.goto(run.i - 1)}
      ><ArrowLeft size={14} />{t('practice.exam.prev')}</button
    >
    <button
      class="btn"
      data-next
      disabled={run.i >= section.questions.length - 1}
      onclick={() => practice.goto(run.i + 1)}
      >{t('practice.exam.next')}<ArrowRight size={14} /></button
    >
    <div class="grow"></div>
    <span class="faint"
      >{t('practice.exam.answered', { n: mine.length - blanks, total: mine.length })}</span
    >
    <button class="btn primary" data-finish-section onclick={finishSection}
      >{t(last ? 'practice.exam.submit' : 'practice.exam.nextSection')}</button
    >
  </footer>
  <p class="faint keys">{t('practice.exam.keys')}</p>
</div>

<style>
  .exam {
    max-width: 820px;
    margin: 0 auto;
    padding: 20px 24px 40px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .bar,
  .nav {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .grow {
    flex: 1;
  }
  .timer {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--bg-sunken);
  }
  .timer.low {
    color: var(--danger);
    background: var(--danger-soft);
  }
  .sections {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chip.past {
    text-decoration: line-through;
  }
  .numbers {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .num {
    min-width: 30px;
    height: 28px;
    padding: 0 6px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }
  .num.answered {
    background: var(--accent-soft);
    border-color: transparent;
    color: var(--accent-text);
  }
  .num.on {
    box-shadow: 0 0 0 2px var(--accent);
  }
  .question {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding: 28px 24px;
  }
  .listen-note {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .keys {
    text-align: center;
  }
</style>
