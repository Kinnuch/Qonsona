<script lang="ts">
  // 一张做过的卷子：成绩（按 JLPT 的办法换算，仅供参考）、各节答对几题、每道题的解析。
  // 默认只列答错和没答的题，可以切换成全部
  import { ArrowLeft, RotateCcw, Trash2, Check, X } from '@lucide/svelte'
  import type { ExamRecord } from '$shared/exam'
  import { practice } from '$lib/state/practice.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { t, i18n } from '$lib/i18n/index.svelte'
  import { txt } from '$lib/courses/view'
  import ReviewItem from './ReviewItem.svelte'
  import { duration } from './view'

  let { record }: { record: ExamRecord } = $props()

  const o = $derived(record.outcome)
  const wrongCount = $derived(o.total - o.right)
  let onlyWrong = $state(true)
  const used = $derived(duration(record.seconds))
  const date = $derived(
    new Date(record.at).toLocaleString(i18n.locale === 'zh' ? 'zh-CN' : 'en', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  )

  /** 每节的题，编号接着排 */
  const numbered = $derived.by(() => {
    let n = 0
    return record.paper.sections.map((s, k) => ({
      s,
      items: s.questions.map((q, j) => ({ q, given: record.answers[k]?.[j] ?? null, n: ++n }))
    }))
  })

  async function remove(): Promise<void> {
    const ok = await ui.confirm(
      t('practice.record.removeTitle'),
      t('practice.record.removeBody'),
      t('common.remove'),
      true
    )
    if (ok) practice.removeRecord(record.id)
  }
</script>

<div class="page review" data-exam-record={record.id}>
  <header class="head">
    <button class="btn ghost" data-back-practice onclick={() => practice.home()}
      ><ArrowLeft size={16} />{t('practice.back')}</button
    >
    <div class="grow"></div>
    <button class="btn" data-exam-again onclick={() => practice.startExam(record.level)}
      ><RotateCcw size={14} />{t('practice.record.again')}</button
    >
    <button class="btn ghost danger" title={t('practice.record.remove')} onclick={remove}
      ><Trash2 size={14} /></button
    >
  </header>

  <section class="card outcome" data-outcome data-passed={o.passed ? '' : undefined}>
    <div class="title">
      <h1>{txt(record.paper.title)}</h1>
      <span class="faint">{date} · {t('practice.record.used', { m: used.m, s: used.s })}</span>
    </div>
    {#if o.scaled !== null}
      <div class="big">
        <span class="scaled" data-scaled={o.scaled}>{o.scaled}</span>
        <span class="muted">/ {o.parts?.reduce((n, p) => n + p.max, 0)}</span>
        <span class="verdict" class:pass={o.passed} class:fail={!o.passed}
          >{#if o.passed}<Check size={16} />{t('practice.record.passed')}{:else}<X size={16} />{t(
              'practice.record.failed'
            )}{/if}</span
        >
      </div>
      <p class="muted">{t('practice.record.passLine', { n: o.pass ?? 0 })}</p>
      <div class="parts">
        {#each o.parts ?? [] as p (txt(p.name))}
          <div class="part" data-part-ok={p.ok ? '' : undefined}>
            <span class="pname">{txt(p.name)}</span>
            <div class="meter">
              <div class="bar" style:width="{(p.score / p.max) * 100}%"></div>
              <div class="min" style:inset-inline-start="{(p.min / p.max) * 100}%"></div>
            </div>
            <span class="pscore" class:bad={!p.ok}>{p.score} / {p.max}</span>
            <span class="faint">{t('practice.record.min', { n: p.min })}</span>
          </div>
        {/each}
      </div>
      <p class="faint">{t('practice.record.note')}</p>
    {:else}
      <p class="big"><span class="scaled">{o.right}</span> / {o.total}</p>
    {/if}
    <div class="sections">
      {#each o.sections as s, k (s.id)}
        <span class="chip" data-section-score={s.id}
          >{txt(record.paper.sections[k]?.title)}：{s.right} / {s.total}</span
        >
      {/each}
    </div>
  </section>

  <div class="filter">
    <h2>{t('practice.record.explain')}</h2>
    <div class="grow"></div>
    <button class="chip" class:on={onlyWrong} data-only-wrong onclick={() => (onlyWrong = true)}
      >{t('practice.record.onlyWrong', { n: wrongCount })}</button
    >
    <button class="chip" class:on={!onlyWrong} data-show-all onclick={() => (onlyWrong = false)}
      >{t('practice.record.all', { n: o.total })}</button
    >
  </div>

  {#each numbered as sec (sec.s.id)}
    {@const items = onlyWrong ? sec.items.filter((x) => x.given !== x.q.answer) : sec.items}
    {#if items.length}
      <h3>{txt(sec.s.title)}</h3>
      {#each items as it (it.q.id)}
        <ReviewItem q={it.q} given={it.given} n={it.n} />
      {/each}
    {/if}
  {/each}
  {#if onlyWrong && !wrongCount}
    <p class="muted">{t('practice.record.allRight')}</p>
  {/if}
</div>

<style>
  .review {
    max-width: 860px;
  }
  .head,
  .filter {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .grow {
    flex: 1;
  }
  .filter .chip {
    border: none;
    cursor: pointer;
  }
  .outcome {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .title {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }
  .big {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .scaled {
    font-size: 44px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .verdict {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-inline-start: 8px;
    padding: 2px 10px;
    border-radius: 999px;
    font-weight: 600;
    align-self: center;
  }
  .verdict.pass {
    color: #23804f;
    background: color-mix(in srgb, #2f9e63 14%, var(--bg-elev));
  }
  .verdict.fail {
    color: var(--danger);
    background: var(--danger-soft);
  }
  .parts {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .part {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(120px, 1fr) auto auto;
    align-items: center;
    gap: 12px;
  }
  .meter {
    position: relative;
    height: 8px;
    border-radius: 4px;
    background: var(--bg-sunken);
    overflow: hidden;
  }
  .meter .bar {
    height: 100%;
    background: var(--accent);
  }
  .meter .min {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--text-2);
  }
  .pscore {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .pscore.bad {
    color: var(--danger);
  }
  .sections {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
</style>
