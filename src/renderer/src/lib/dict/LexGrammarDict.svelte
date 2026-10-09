<script lang="ts">
  // 框架语言词典的「语法」页签：这门语言的全部语法点（src/shared/lang/<代码>/ 的 grammar），
  // 按名字、构成、意思查，按主分级的等级筛；右边是讲解、构成、例句，以及意思相近的几个
  import { t, pick, i18n } from '$lib/i18n/index.svelte'
  import { dictState } from './state.svelte'
  import { LANGS } from '$shared/lang/registry'
  import { primarySystem } from '$shared/lang/levels'
  import type { LangCode, LexGrammarPoint } from '$shared/lang/types'
  import Pronounce from '$lib/ui/Pronounce.svelte'

  let { code, query }: { code: string; query: string } = $props()

  const mod = $derived(LANGS[code as LangCode])
  const spec = $derived(mod.spec)
  const levels = $derived(primarySystem(spec.levelSystems).levels)
  const memo = $derived(dictState.of(code))
  const points = $derived(mod.grammar ?? [])
  let level = $state<string | null>(null)

  const text = (g: LexGrammarPoint): string =>
    [g.id, ...Object.values(g.name), ...Object.values(g.form), ...Object.values(g.meaning)]
      .join(' ')
      .toLocaleLowerCase()
  const shown = $derived.by(() => {
    const q = query.trim().toLocaleLowerCase()
    return points.filter((g) => (!level || g.level === level) && (!q || text(g).includes(q)))
  })
  const selected = $derived(points.find((g) => g.id === memo.grammar) ?? shown[0] ?? null)
  const near = $derived(
    selected?.group ? points.filter((g) => g.group === selected.group && g.id !== selected.id) : []
  )
  const short = (id: string): string => levels.find((l) => l.id === id)?.short ?? id
  const L = $derived(i18n.locale)
  const tr = (ex: { zh?: string; en?: string }): string =>
    (L === 'zh' ? ex.zh || ex.en : ex.en || ex.zh) ?? ''
</script>

<div class="panes" data-lex-grammar>
  <div class="list-col">
    <div class="chips">
      <button class="chip" class:on={level === null} onclick={() => (level = null)}
        >{t('dict.grammar.all')}</button
      >
      {#each levels as l (l.id)}
        <button
          class="chip"
          class:on={level === l.id}
          onclick={() => (level = level === l.id ? null : l.id)}>{l.short}</button
        >
      {/each}
    </div>
    <ul class="list">
      {#each shown as g (g.id)}
        <li>
          <button
            class="hit"
            class:on={selected?.id === g.id}
            data-grammar-point={g.id}
            onclick={() => (memo.grammar = g.id)}
          >
            <span class="row"
              ><strong>{pick(g.name)}</strong><span class="chip level">{short(g.level)}</span></span
            >
            <span class="gloss">{pick(g.meaning)}</span>
          </button>
        </li>
      {:else}
        <li class="hint">{t('dict.lex.noGrammar')}</li>
      {/each}
    </ul>
  </div>
  <article class="detail">
    {#if selected}
      <header class="head">
        <h2>{pick(selected.name)}</h2>
        <span class="chip on">{short(selected.level)}</span>
      </header>
      <p class="form" lang={spec.bcp47}>{pick(selected.form)}</p>
      <p>{pick(selected.meaning)}</p>
      {#if selected.notes}<p class="faint">{pick(selected.notes)}</p>{/if}
      {#if selected.examples.length}
        <ul class="examples">
          {#each selected.examples as ex, i (i)}
            <li class="example">
              <div class="ex-line" dir={spec.direction}>
                <span lang={spec.bcp47}>{ex.text}</span>
                {#if spec.features.speech}<Pronounce
                    item={{ text: ex.text, lang: spec.features.speech }}
                  />{/if}
              </div>
              {#if tr(ex)}<div class="tr">{tr(ex)}</div>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      {#if near.length}
        <section class="block">
          <h3>{t('dict.grammar.near')}</h3>
          {#each near as g (g.id)}
            <button class="link" onclick={() => (memo.grammar = g.id)}>{pick(g.name)}</button>
          {/each}
        </section>
      {/if}
    {/if}
  </article>
</div>

<style>
  .panes {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(240px, 320px) 1fr;
    gap: 16px;
  }
  .list-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    min-height: 0;
  }
  .hit {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    text-align: start;
    cursor: pointer;
  }
  .hit:hover {
    background: var(--bg-hover);
  }
  .hit.on {
    background: var(--accent-soft);
  }
  .row {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .gloss {
    color: var(--text-2);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip.level {
    font-size: 11px;
    padding: 0 6px;
  }
  .hint {
    padding: 8px 10px;
    color: var(--text-3);
    font-size: 13px;
  }
  .detail {
    overflow-y: auto;
    min-height: 0;
    padding: 4px 8px 32px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .head h2 {
    margin: 0;
  }
  .form {
    font-size: 17px;
    font-weight: 500;
  }
  .examples {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .example {
    padding: 6px 10px;
    border-inline-start: 2px solid var(--border);
  }
  .ex-line {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 15px;
  }
  .tr {
    color: var(--text-2);
    font-size: 13px;
  }
  .block h3 {
    font-size: 13px;
    color: var(--text-2);
    margin: 0 0 6px;
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    margin-inline-end: 10px;
    color: var(--accent-text);
    cursor: pointer;
    font: inherit;
  }
</style>
