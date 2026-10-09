<script lang="ts">
  // 「关于这门语言」里框架语言的部分：一句介绍、词典有多少词条例句、每一套分级（每级说明与词数）、数据来源
  import { onMount } from 'svelte'
  import { platform } from '$lib/platform'
  import { t, pick } from '$lib/i18n/index.svelte'
  import { LANGS } from '$shared/lang/registry'
  import type { LangCode, SourceRef } from '$shared/lang/types'
  import type { LexStatus } from '$shared/lang/views'

  let { code }: { code: string } = $props()

  const spec = $derived(LANGS[code as LangCode].spec)
  let status = $state<LexStatus | null>(null)
  let counts = $state<Record<string, number>>({})
  let sources = $state<SourceRef[]>([])
  /** 展开说明的那一级（system:level） */
  let open = $state<string | null>(null)

  onMount(async () => {
    ;[status] = await platform.lang.status([code]).catch(() => [null])
    if (!status?.available) return
    ;[counts, sources] = await Promise.all([
      platform.lang.listCounts(code).catch(() => ({})),
      platform.lang.sources(code).catch(() => [])
    ])
  })
</script>

<section class="card intro" data-lang-intro>
  <p>{pick(spec.intro)}</p>
  {#if status?.available}
    <p class="faint">
      {t('lang.about.data', { entries: status.entries, examples: status.examples })}
    </p>
  {:else if status}
    <p class="faint">{t('lang.about.noData')}</p>
  {/if}
</section>

<section class="stack" data-lang-levels>
  <h3>{t('lang.about.levels')}</h3>
  {#each spec.levelSystems as sys (sys.id)}
    <div class="system card" data-system={sys.id}>
      <div class="sys-head">
        <strong>{pick(sys.name)}</strong>
        {#if sys.primary}<span class="chip on">{t('lang.about.primary')}</span>{/if}
        <span class="faint">{t(`lang.about.kind.${sys.kind}`)}</span>
      </div>
      <div class="levels">
        {#each sys.levels as lv (lv.id)}
          {@const k = `${sys.id}:${lv.id}`}
          <button
            class="level"
            class:on={open === k}
            data-level={k}
            title={pick(lv.desc)}
            onclick={() => (open = open === k ? null : k)}
          >
            <span>{lv.short}</span>
            {#if counts[k]}<b>{counts[k]}</b>{/if}
          </button>
        {/each}
      </div>
      {#each sys.levels as lv (lv.id)}
        {#if open === `${sys.id}:${lv.id}`}
          <p class="desc">
            <strong>{pick(lv.name)}</strong>
            {#if sys.cefr?.[lv.id] && sys.id !== 'cefr'}<span class="faint"
                >≈ CEFR {sys.cefr[lv.id]}</span
              >{/if}
            <br />{pick(lv.desc)}
          </p>
        {/if}
      {/each}
      {#if sys.sources.length}
        <p class="faint small">
          {t('lang.about.basis')}{sys.sources.map((s) => s.name).join('；')}
        </p>
      {/if}
    </div>
  {/each}
</section>

{#if sources.length}
  <section class="stack" data-lang-sources>
    <h3>{t('lang.about.sources')}</h3>
    <ul class="sources">
      {#each sources as s (s.id)}
        <li>
          <a href={s.home} target="_blank" rel="noopener">{s.name}</a>
          <span class="faint">{s.license} · {s.credit}</span>
          {#if s.note}<span class="faint small">{s.note}</span>{/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .intro p {
    margin: 0 0 6px;
  }
  .system {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sys-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .levels {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .level {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 2px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: var(--bg-elev);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
  }
  .level b {
    font-weight: 500;
    color: var(--text-2);
    font-size: 12px;
  }
  .level.on {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .desc {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
  }
  .small {
    font-size: 12px;
  }
  .sources {
    margin: 0;
    padding-inline-start: 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
  }
  .sources li span {
    margin-inline-start: 6px;
  }
</style>
