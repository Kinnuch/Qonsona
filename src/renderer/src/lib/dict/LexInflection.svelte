<script lang="ts">
  import { i18n, pick } from '$lib/i18n/index.svelte'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import { langModule } from '$shared/lang/registry'
  import { tagsLabel } from '$shared/lang/tags'
  import {
    inflectionData,
    INFLECTION_KINDS,
    type InflectionAlternation,
    type InflectionKind
  } from '$shared/lang/inflection'
  import { gdInflectionAlternations } from '$shared/lang/gd/inflection'
  import type { LexEntryView } from '$shared/lang/views'
  import type { LocalizedText } from '$shared/lang/types'

  let {
    entry,
    alternations,
    language,
    direction,
    labels
  }: {
    entry: LexEntryView
    alternations?: InflectionAlternation[]
    language?: string
    direction?: 'ltr' | 'rtl'
    labels?: Record<string, LocalizedText>
  } = $props()
  // Parent mounts this panel only after the dictionary's toggle is opened.
  const data = $derived(inflectionData(entry))
  const mod = $derived(langModule(entry.code))
  const lang = $derived(language ?? mod?.spec.bcp47 ?? entry.code)
  const dir = $derived(direction ?? mod?.spec.direction ?? 'ltr')
  const own = $derived(labels ?? mod?.labels)
  const variations = $derived(
    alternations ?? (entry.code === 'gd' ? gdInflectionAlternations(entry) : [])
  )
  const generatedCount = $derived(
    data.generated + variations.filter((v) => v.provenance === 'rule').length
  )
  const kinds = $derived(
    (Object.keys(INFLECTION_KINDS) as InflectionKind[]).filter((k) =>
      data.tables.some((t) => t.kind === k)
    )
  )
  let selected = $state<InflectionKind | 'all'>('all')
  const visible = $derived(
    selected === 'all' ? data.tables : data.tables.filter((t) => t.kind === selected)
  )
  const tr = (zh: string, en: string): string => (i18n.locale === 'zh' ? zh : en)
  const label = (tags: string[]): string =>
    tags.length ? tagsLabel(tags, i18n.locale, own) : tr('未标注', 'Unspecified')
  const metadata = (tags: string[], row: string[], col: string[], group: string[]): string => {
    const axes = new Set([...row, ...col, ...group, 'lemma'])
    return label(tags.filter((t) => !axes.has(t)))
  }
</script>

<section class="inflection" data-inflection-panel={entry.id} data-forms>
  <header class="panel-head">
    <h3>{tr('屈折与词形', 'Inflection and forms')}</h3>
    <span
      class="faint"
      data-inflection-recorded={data.recorded}
      data-inflection-generated={generatedCount}
    >
      {tr(`${data.recorded} 条词典记录`, `${data.recorded} recorded forms`)}
      {#if generatedCount}
        · {tr(`${generatedCount} 条规则结果`, `${generatedCount} rule outputs`)}{/if}
    </span>
  </header>
  {#if entry.cls.length}
    <p class="classes faint">
      {tr('类别：', 'Classes: ')}{entry.cls.map((c) => (own?.[c] ? pick(own[c]) : c)).join(' · ')}
    </p>
  {/if}
  <p class="notice faint" data-inflection-notice>{pick(data.notice)}</p>
  {#if entry.code === 'gd' && data.forms.some((f) => f.tags.includes('eclipsis'))}
    <p class="notice faint" data-inflection-tag-warning>
      {tr(
        'eclipsis 是来源词典保留的标签；盖尔语元音前 n- 的条件见下方音变说明，不据此生成爱尔兰语式辅音形式。',
        'Eclipsis is a retained source-dictionary tag. Conditions for Gaelic vowel-initial n- are explained below; Irish-style consonant forms are not generated from that tag.'
      )}
    </p>
  {/if}

  {#if kinds.length > 1}
    <div class="filters" role="group" aria-label={tr('词形分类', 'Form categories')}>
      <button
        class="chip"
        class:on={selected === 'all'}
        aria-pressed={selected === 'all'}
        data-inflection-kind="all"
        onclick={() => (selected = 'all')}>{tr('全部', 'All')}</button
      >
      {#each kinds as kind (kind)}
        <button
          class="chip"
          class:on={selected === kind}
          aria-pressed={selected === kind}
          data-inflection-kind={kind}
          onclick={() => (selected = kind)}>{pick(INFLECTION_KINDS[kind])}</button
        >
      {/each}
    </div>
  {/if}

  {#each visible as table (table.id)}
    <section class="group" data-inflection-table-kind={table.kind}>
      <h4>
        {pick(INFLECTION_KINDS[table.kind])}{#if table.tags.length}
          · {label(table.tags)}{/if}
      </h4>
      <div class="table-scroll" data-dict-forms-scroll>
        <table class="forms" data-paradigm={table.id}>
          <thead
            ><tr>
              <th scope="col">{tr('形态条件', 'Form context')}</th>
              {#each table.cols as col, index (index)}<th scope="col"
                  >{col.length ? label(col) : tr('已记录形式', 'Recorded form')}</th
                >{/each}
            </tr></thead
          >
          <tbody>
            {#each table.rows as row, rowIndex (rowIndex)}
              <tr
                ><th scope="row"
                  >{row.tags.length ? label(row.tags) : tr('未细分', 'Not subdivided')}</th
                >
                {#each row.cells as cell, colIndex (colIndex)}
                  <td data-inflection-cell>
                    {#if !cell.length}
                      <span
                        class="missing faint"
                        data-inflection-missing
                        title={tr(
                          '词典未提供此格；不猜造词形。',
                          'This slot is not supplied; no form is guessed.'
                        )}>— {tr('未提供', 'Not supplied')}</span
                      >
                    {:else}
                      {#each cell as form, formIndex (formIndex)}
                        <div
                          class="form-item"
                          data-inflection-form={form.form}
                          data-inflection-provenance={form.provenance}
                        >
                          <div class="form-line">
                            <bdi class="surface" {lang} {dir}>{form.form}</bdi>
                            <Pronounce
                              item={{
                                text: form.form,
                                lang,
                                ...(form.ipa ? { ipa: form.ipa } : {})
                              }}
                            />
                          </div>
                          {#if form.ipa}<span class="faint ipa" data-form-ipa>{form.ipa}</span>{/if}
                          {#if form.tags.some((t) => ![...row.tags, ...table.cols[colIndex], ...table.tags, 'lemma'].includes(t))}
                            <span class="faint note"
                              >{metadata(
                                form.tags,
                                row.tags,
                                table.cols[colIndex],
                                table.tags
                              )}</span
                            >
                          {/if}
                          {#if form.provenance === 'rule'}<span class="faint origin"
                              >{tr('规则生成', 'Rule-generated')}</span
                            >{/if}
                        </div>
                      {/each}
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/each}

  {#if variations.length}
    <section class="alternations" data-inflection-alternations>
      <h4>{tr('有条件的音变与核对例子', 'Conditional alternations and verified examples')}</h4>
      {#each variations as variation (variation.id)}
        <article
          class="alternation"
          data-inflection-alternation={variation.id}
          data-inflection-provenance={variation.provenance}
        >
          <div class="form-line">
            <strong>{pick(variation.title)}</strong><span class="chip"
              >{variation.provenance === 'dictionary'
                ? tr('词典记录', 'Dictionary record')
                : tr('规则结果', 'Rule output')}</span
            >
          </div>
          <p>
            <bdi class="surface" {lang} {dir}>{variation.form}</bdi>{#if variation.tags.length}<span
                class="faint"
              >
                · {label(variation.tags)}</span
              >{/if}
          </p>
          <p class="notice">{pick(variation.notice)}</p>
          {#each variation.examples as example, index (index)}
            <div class="example" data-inflection-example>
              <p><bdi {lang} {dir}>{example.text}</bdi></p>
              {#if example.translation}<p class="faint">{pick(example.translation)}</p>{/if}
              <p class="faint">
                {example.provenance === 'original'
                  ? tr('自编例句', 'Original example')
                  : tr('词典例句', 'Dictionary example')}{#if example.source}
                  · <a href={example.source.home} target="_blank" rel="noreferrer"
                    >{example.source.name}</a
                  >{:else if example.sourceId}
                  · {example.sourceId}{/if}
              </p>
            </div>
          {/each}
          {#if variation.sources.length}<p class="faint">
              {tr(
                '规则/例句来源：',
                'Rule/example sources: '
              )}{#each variation.sources as source, index (source.id)}{#if index}
                  ·
                {/if}<a href={source.home} target="_blank" rel="noreferrer">{source.name}</a>{/each}
            </p>{/if}
        </article>
      {/each}
    </section>
  {/if}

  {#if data.sources.length}
    <details class="sources" data-inflection-sources>
      <summary>{tr('数据来源与许可', 'Data sources and licenses')}</summary>
      <ul>
        {#each data.sources as source (source.id)}<li>
            <a href={source.home} target="_blank" rel="noreferrer">{source.name}</a> · {source.license}
            · {source.credit}
          </li>{/each}
      </ul>
    </details>
  {/if}
</section>

<style>
  .inflection {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-elev);
  }
  .panel-head,
  .form-line,
  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .panel-head {
    justify-content: space-between;
  }
  .notice,
  .classes,
  .sources {
    overflow-wrap: anywhere;
  }
  .filters button {
    border: none;
    padding: 4px 10px;
    cursor: pointer;
  }
  h4 {
    margin: 0 0 6px;
    color: var(--text-2);
    font-size: 13px;
  }
  .table-scroll {
    min-width: 0;
    max-width: 100%;
    overflow-x: auto;
  }
  .forms {
    border-collapse: collapse;
    width: 100%;
    font-size: 14px;
  }
  th,
  td {
    text-align: start;
    vertical-align: top;
    padding: 7px 10px;
    border: 1px solid var(--border);
  }
  th {
    background: var(--bg-sunken);
    font-size: 12px;
    font-weight: 500;
    min-width: 100px;
  }
  td {
    min-width: 130px;
  }
  .form-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .form-item + .form-item {
    margin-top: 8px;
  }
  .surface {
    font-size: 17px;
    white-space: nowrap;
  }
  .ipa {
    font-family: var(--font-data);
    direction: ltr;
  }
  .missing {
    white-space: nowrap;
  }
  .origin {
    color: var(--accent-text);
  }
  .alternations {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .alternation {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
  .example {
    border-inline-start: 2px solid var(--border);
    padding-inline-start: 10px;
  }
  .sources {
    font-size: 12px;
    color: var(--text-2);
  }
  .sources summary {
    cursor: pointer;
  }
  .sources ul {
    padding-inline-start: 20px;
    margin-block: 8px 0;
  }
</style>
