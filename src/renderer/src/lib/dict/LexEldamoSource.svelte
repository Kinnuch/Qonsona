<script lang="ts">
  import { i18n, pick } from '$lib/i18n/index.svelte'
  import { eldamoSource } from '$shared/lang/eldamo-source'
  import type { LexEntryView } from '$shared/lang/views'

  let { entry }: { entry: LexEntryView } = $props()
  const source = $derived(eldamoSource(entry))
  const tr = (zh: string, en: string): string => (i18n.locale.startsWith('zh') ? zh : en)
</script>

{#if source}
  <section
    class="eldamo-source"
    data-eldamo-source={entry.id}
    aria-label={tr('词条出处与时期', 'Entry provenance and period')}
  >
    <h3>{tr('词条出处与时期', 'Entry provenance and period')}</h3>
    <p class="period" data-eldamo-period>{pick(source.language)} · {pick(source.period)}</p>
    {#if source.status.length}
      <div class="statuses" data-eldamo-status>
        {#each source.status as label (label.en)}<span class="status">{pick(label)}</span>{/each}
      </div>
    {/if}
    {#if source.sourceHead}<p class="detail">
        {tr('来源中的写法：', 'Source headword: ')}<span>{source.sourceHead}</span>
      </p>{/if}
    {#if source.creator}<p class="detail">
        {tr('资料所列作者：', 'Attributed creator: ')}{source.creator}
      </p>{/if}
    <p class="notice">
      {tr(
        '词库保留不同历史阶段与 Neo 材料；文献引用不代表该形式是统一的最终标准。',
        'The lexicon preserves historical stages and Neo material; a reference does not establish a single final standard.'
      )}
    </p>
    <div class="links">
      {#if source.eldamoUrl}<a
          class="ext-link"
          href={source.eldamoUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-eldamo-link={source.eldamoUrl}>{tr('Eldamo 词条 ↗', 'Eldamo entry ↗')}</a
        >{/if}
      <a
        class="ext-link"
        href={source.elfdictUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-elfdict-link={source.elfdictUrl}
        >{tr('Elfdict 交叉检索 ↗', 'Cross-check in Elfdict ↗')}</a
      >
    </div>
    {#if source.references.length}
      <details data-eldamo-references>
        <summary
          >{tr('原文文献引用', 'Original-source references')} ({source.references.length})</summary
        >
        <p class="notice">
          {tr(
            '下列引用保留资料中的写法，可能包括历史变体、被否定或存疑的用法；请在 Eldamo 原词条核对符号和语境。',
            'These documentary spellings can include historical variants, rejected or questioned uses. Check their notation and context in the Eldamo entry.'
          )}
        </p>
        <ul class="references">
          {#each source.references as ref (`${ref.citation}|${ref.form ?? ''}`)}
            <li>
              <span class="citation">{ref.citation}</span>{#if ref.form}<span
                  class="documentary-form">{ref.form}</span
                >{/if}
            </li>
          {/each}
        </ul>
      </details>
    {/if}
    <p class="credit">Eldamo · Paul Strack · CC BY 4.0</p>
  </section>
{/if}

<style>
  .eldamo-source {
    min-width: 0;
    border-top: 1px solid var(--border);
    padding-top: 12px;
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  h3,
  p {
    margin: 0;
  }
  h3 {
    font-size: 14px;
    font-weight: 600;
  }
  .period {
    font-weight: 500;
  }
  .statuses,
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
  }
  .status {
    border: 1px solid var(--border);
    padding: 2px 7px;
    border-radius: 8px;
  }
  .notice,
  .credit,
  .detail {
    color: var(--text-2);
    line-height: 1.5;
  }
  .links a {
    white-space: normal;
    text-align: start;
    max-width: 100%;
  }
  summary {
    cursor: pointer;
  }
  details .notice {
    margin-top: 8px;
  }
  .references {
    max-height: 260px;
    overflow: auto;
    padding-inline-start: 20px;
    margin: 8px 0 0;
  }
  li {
    padding: 3px 0;
  }
  .citation {
    margin-inline-end: 10px;
  }
  .documentary-form {
    font-style: italic;
  }
</style>
