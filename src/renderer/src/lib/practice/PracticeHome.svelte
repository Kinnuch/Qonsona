<script lang="ts">
  // 练习页：选等级与题量，挑一种题（或综合）开始；日语还有 N5 到 N1 的模拟卷和做过的卷子。
  // 放不了声音（没有这门语言的系统语音）时听力题不能选
  import { ListChecks, Timer, ChevronRight } from '@lucide/svelte'
  import { practice, COUNTS, type RunKind } from '$lib/state/practice.svelte'
  import { t, pick, i18n } from '$lib/i18n/index.svelte'
  import { txt } from '$lib/courses/view'
  import { dayKey } from '$shared/srs'
  import type { PracticeKind } from '$shared/exam'
  import { paperShape } from '$shared/ja/exam'

  const LISTEN: PracticeKind[] = ['listen-sentence', 'listen-word']
  const kinds = $derived<Exclude<RunKind, 'article'>[]>(
    practice.kinds.length > 1 ? ['mixed', ...practice.kinds] : practice.kinds
  )
  const today = $derived(practice.log?.days[dayKey()] ?? { answered: 0, right: 0 })
  const history = $derived([...(practice.log?.exams ?? [])].reverse())

  const blocked = (k: RunKind): boolean => LISTEN.includes(k as PracticeKind) && !practice.canListen

  const date = (at: number): string =>
    new Date(at).toLocaleDateString(i18n.locale === 'zh' ? 'zh-CN' : 'en', {
      month: 'short',
      day: 'numeric'
    })
</script>

<div class="page">
  <header class="page-head">
    <ListChecks size={22} strokeWidth={1.8} />
    <h1>{t('nav.practice')}</h1>
    <span class="faint" data-today
      >{t('practice.today', { n: today.answered, right: today.right })}</span
    >
  </header>

  <section class="card controls">
    {#if practice.levels.length}
      <div class="row" role="radiogroup" aria-label={t('practice.level')}>
        <span class="muted label">{t('practice.level')}</span>
        {#if !practice.isJa}
          <button
            class="chip"
            class:on={practice.level === null}
            data-level=""
            role="radio"
            aria-checked={practice.level === null}
            onclick={() => (practice.level = null)}>{t('practice.all')}</button
          >
        {/if}
        {#each practice.levels as lv (lv.id)}
          <button
            class="chip"
            class:on={practice.level === lv.id}
            data-level={lv.id}
            role="radio"
            aria-checked={practice.level === lv.id}
            onclick={() => (practice.level = lv.id)}
            >{pick(lv.name)}{#if !practice.isJa && lv.count}<b>{lv.count}</b>{/if}</button
          >
        {/each}
      </div>
    {/if}
    <div class="row" role="radiogroup" aria-label={t('practice.count')}>
      <span class="muted label">{t('practice.count')}</span>
      {#each COUNTS as n (n)}
        <button
          class="chip"
          class:on={practice.count === n}
          data-count={n}
          role="radio"
          aria-checked={practice.count === n}
          onclick={() => (practice.count = n)}>{t('practice.countN', { n })}</button
        >
      {/each}
    </div>
  </section>

  {#if kinds.length}
    <div class="kinds">
      {#each kinds as k (k)}
        <button
          class="card kind"
          class:mixed={k === 'mixed'}
          data-kind={k}
          disabled={practice.busy || blocked(k)}
          onclick={() => practice.start(k)}
        >
          <strong>{t(`practice.kinds.${k}.name`)}</strong>
          <span class="muted">{t(`practice.kinds.${k}.desc`)}</span>
          {#if blocked(k)}<span class="faint">{t('practice.noVoice')}</span>{/if}
        </button>
      {/each}
    </div>
  {:else}
    <p class="card muted" data-no-kinds>{t('practice.noKinds')}</p>
  {/if}

  {#if practice.paperLevels.length}
    <section class="stack" data-exams>
      <h2>{t('practice.exam.title')}</h2>
      <p class="muted">{t('practice.exam.intro')}</p>
      <div class="papers">
        {#each practice.paperLevels as lv (lv)}
          <button
            class="card paper"
            data-start-exam={lv}
            disabled={practice.busy}
            onclick={() => practice.startExam(lv)}
          >
            <Timer size={20} strokeWidth={1.8} />
            <span class="ptext">
              <strong>{t('practice.exam.paper', { level: lv })}</strong>
              <span class="muted"
                >{t('practice.exam.structure', paperShape(Number(lv.slice(1))))}</span
              >
            </span>
            <ChevronRight size={16} />
          </button>
        {/each}
      </div>
      {#if !practice.canListen}<p class="faint">{t('practice.exam.noVoice')}</p>{/if}

      {#if history.length}
        <h3>{t('practice.exam.history')}</h3>
        <ul class="history">
          {#each history as r (r.id)}
            <li>
              <button class="row-btn" data-record={r.id} onclick={() => practice.openRecord(r.id)}>
                <span class="faint">{date(r.at)}</span>
                <span>{txt(r.paper.title)}</span>
                <span class="grow"></span>
                {#if r.outcome.scaled !== null}
                  <b>{r.outcome.scaled}</b>
                  <span class="chip" class:pass={r.outcome.passed} class:fail={!r.outcome.passed}
                    >{r.outcome.passed
                      ? t('practice.record.passed')
                      : t('practice.record.failed')}</span
                  >
                {:else}
                  <b>{r.outcome.right} / {r.outcome.total}</b>
                {/if}
                <ChevronRight size={14} />
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</div>

<style>
  .page-head :global(svg) {
    color: var(--accent-text);
    align-self: center;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .label {
    min-width: 56px;
  }
  .row .chip {
    border: none;
    cursor: pointer;
    font-size: 13px;
    padding: 3px 10px;
  }
  .chip b {
    font-weight: 600;
    margin-inline-start: 4px;
  }
  .kinds {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
  }
  .kind {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    text-align: start;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  .kind:hover:not(:disabled) {
    border-color: var(--border-strong);
    background: var(--bg-hover);
  }
  .kind:disabled {
    cursor: default;
    opacity: 0.6;
  }
  .kind.mixed {
    border-color: var(--accent);
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .papers {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }
  .paper {
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: start;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  .paper:hover:not(:disabled) {
    border-color: var(--border-strong);
    background: var(--bg-hover);
  }
  .paper :global(svg:first-child) {
    color: var(--accent-text);
  }
  .ptext {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .history {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-elev);
    overflow: hidden;
  }
  .history li + li {
    border-top: 1px solid var(--border);
  }
  .row-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: start;
  }
  .row-btn:hover {
    background: var(--bg-hover);
  }
  .grow {
    flex: 1;
  }
  .chip.pass {
    color: #23804f;
    background: color-mix(in srgb, #2f9e63 14%, var(--bg-elev));
  }
  .chip.fail {
    color: var(--danger);
    background: var(--danger-soft);
  }
</style>
