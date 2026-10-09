<script lang="ts">
  // 一组练习：一题一题做，选了马上看对错与解析；做完给成绩，列出答错的题。
  // 快捷键：1–4 选择，回车或空格下一题，R 再听一遍，Esc 结束
  import { untrack } from 'svelte'
  import { X, ArrowRight, RotateCcw } from '@lucide/svelte'
  import { practice, type PracticeRun } from '$lib/state/practice.svelte'
  import { reading } from '$lib/state/reading.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { t, pick } from '$lib/i18n/index.svelte'
  import ExamPrompt from './ExamPrompt.svelte'
  import Choices from './Choices.svelte'
  import Explain from './Explain.svelte'
  import ReviewItem from './ReviewItem.svelte'
  import { playPrompt } from './view'

  const run = $derived(practice.run as PracticeRun)
  const q = $derived(run.done ? null : run.questions[run.i])
  const given = $derived(run.given)

  const levelName = $derived(
    run.level ? pick(practice.levels.find((l) => l.id === run.level)?.name) : t('practice.all')
  )
  const title = $derived(
    `${t(`practice.kinds.${run.kind}.name`)} · ${run.article ? run.article.title : levelName}`
  )

  /** 本文练习做完：回到那篇文章（阅读器的「返回」照旧回首页、课程或文章列表） */
  async function backToArticle(): Promise<void> {
    const a = run.article
    practice.home()
    if (!a) return
    ui.go('reading')
    await reading.open(a.id, a.from ?? null)
  }

  /** 故事课的本文练习做完：回到课程（停在那一课） */
  function backToCourse(): void {
    practice.home()
    ui.go('courses')
  }

  // 换题：听力题自动放一遍
  $effect(() => {
    void run.i
    untrack(() => {
      if (q?.prompt.listen) playPrompt(q)
    })
  })

  function onkey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return
    if (e.key === 'Escape') return practice.home()
    if (run.done || !q) return
    if (given === null) {
      if (/^[1-9]$/.test(e.key) && Number(e.key) <= q.choices.length) {
        e.preventDefault()
        practice.answer(Number(e.key) - 1)
      } else if ((e.key === 'r' || e.key === 'R') && q.prompt.listen) playPrompt(q)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      practice.next()
    }
  }

  const right = $derived(run.answers.filter((a, i) => a === run.questions[i].answer).length)
  const pct = $derived(run.answers.length ? Math.round((right / run.answers.length) * 100) : 0)
  const missed = $derived(
    run.questions
      .map((x, i) => ({ q: x, given: run.answers[i] ?? null, n: i + 1 }))
      .filter((x) => x.given !== x.q.answer)
  )
</script>

<svelte:window onkeydown={onkey} />

<div class="session" data-practice-run={run.kind}>
  <header class="bar">
    <strong>{title}</strong>
    {#if !run.done}
      <span class="faint" data-practice-progress
        >{t('practice.progress', { i: run.i + 1, n: run.questions.length })}</span
      >
    {/if}
    <div class="grow"></div>
    <button
      class="btn ghost"
      data-practice-exit
      title={t('practice.exit')}
      onclick={() => practice.home()}><X size={16} /></button
    >
  </header>
  <div class="track">
    <div class="fill" style:width="{(run.i / run.questions.length) * 100}%"></div>
  </div>

  {#if run.done}
    <div class="card result" data-practice-result>
      <h2>{t('practice.done')}</h2>
      <p class="score" data-score={pct}>
        {t('practice.score', { right, n: run.answers.length, pct })}
      </p>
      <div class="row">
        <button class="btn primary" data-again onclick={() => practice.again()}
          ><RotateCcw size={14} />{t('practice.again')}</button
        >
        {#if run.article}
          <button class="btn" data-back-article onclick={backToArticle}
            >{t('practice.backArticle')}</button
          >
          {#if run.article.course}
            <button class="btn" data-back-course onclick={backToCourse}
              >{t('practice.backCourse')}</button
            >
          {/if}
        {:else}
          <button class="btn" data-back-practice onclick={() => practice.home()}
            >{t('practice.back')}</button
          >
        {/if}
      </div>
    </div>
    {#if missed.length}
      <h3>{t('practice.missed')}</h3>
      {#each missed as m (m.q.id)}
        <ReviewItem q={m.q} given={m.given} n={m.n} />
      {/each}
    {/if}
  {:else if q}
    {#key q.id}
      <div class="card question" data-question={q.kind}>
        <ExamPrompt {q} reveal={given !== null} />
        <Choices
          {q}
          selected={given}
          reveal={given !== null}
          disabled={given !== null}
          onchoose={(i) => practice.answer(i)}
        />
      </div>
    {/key}
    {#if given !== null}
      <div class="feedback" data-feedback={given === q.answer ? 'right' : 'wrong'}>
        <p class={given === q.answer ? 'good' : 'bad'}>
          {given === q.answer ? t('practice.right') : t('practice.wrong')}
        </p>
        <Explain {q} />
        <button class="btn primary" data-practice-next onclick={() => practice.next()}
          >{run.i + 1 < run.questions.length ? t('practice.next') : t('practice.finish')}<ArrowRight
            size={16}
          /></button
        >
      </div>
    {/if}
    <p class="faint keys">{t('practice.keys')}</p>
  {/if}
</div>

<style>
  .session {
    max-width: 780px;
    margin: 0 auto;
    padding: 20px 24px 40px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .grow {
    flex: 1;
  }
  .track {
    height: 4px;
    border-radius: 2px;
    background: var(--bg-sunken);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
  }
  .question {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding: 28px 24px;
  }
  .feedback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .good {
    color: #23804f;
    font-weight: 600;
  }
  .bad {
    color: var(--danger);
    font-weight: 600;
  }
  .keys {
    text-align: center;
  }
  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 28px;
    text-align: center;
  }
  .score {
    font-size: 20px;
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
</style>
