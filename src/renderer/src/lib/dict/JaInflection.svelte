<script lang="ts">
  import type { EntryView } from '$shared/dict'
  import { dictionaryInflection } from '$shared/ja/dictionary-inflection'
  import { FORM_NAMES } from '$shared/ja/forms-course'
  import { i18n, t } from '$lib/i18n/index.svelte'
  import { txt } from '$lib/courses/view'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  let { entry }: { entry: EntryView } = $props()
  const groups = $derived(dictionaryInflection(entry))
  const noun = $derived(entry.senses.some((s) => s.pos.includes('n')))
</script>

<section class="inflection" data-inflection-panel data-forms>
  <h3>{t('dict.inflection')}</h3>
  {#if noun}
    <p class="muted">
      {i18n.locale === 'zh'
        ? '日语名词通常不因性、数或格改变词尾，格关系主要由助词表达。这里显示有明确词性标记的动词与形容词活用。'
        : 'Japanese nouns normally do not change their endings for gender, number or case; particles express case relations. Verb and adjective forms below follow the entry’s explicit word-class tags.'}
    </p>
  {/if}
  {#each groups as group (group.key)}
    <h4 lang="ja">{group.base}</h4>
    <div class="table-scroll" data-dict-forms-scroll>
      <table data-paradigm>
        <thead
          ><tr
            ><th>{i18n.locale === 'zh' ? '形式' : 'Form'}</th><th
              >{i18n.locale === 'zh' ? '写法' : 'Writing'}</th
            ><th>{i18n.locale === 'zh' ? '读音' : 'Reading'}</th><th
              >{i18n.locale === 'zh' ? '朗读' : 'Audio'}</th
            ></tr
          ></thead
        >
        <tbody
          >{#each group.rows as row (row.id)}<tr
              ><th>{txt(FORM_NAMES[row.id])}</th><td lang="ja">{row.text}</td><td lang="ja"
                >{row.reading}</td
              ><td><Pronounce item={{ text: row.reading, lang: 'ja-JP' }} /></td></tr
            >{/each}</tbody
        >
      </table>
    </div>
  {:else}<p class="muted">{t('dict.inflectionEmpty')}</p>{/each}
  {#if groups.length}<p class="muted">
      {i18n.locale === 'zh'
        ? '依据 JMdict 词性和本软件现有活用规则生成；不支持的特殊活用不会补猜。'
        : 'Generated from JMdict word-class tags and the app’s existing conjugation rules. Unsupported special classes are not guessed.'}
    </p>{/if}
</section>

<style>
  .inflection {
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    margin-block: 18px;
    min-width: 0;
  }
  h3 {
    margin-block: 0 12px;
  }
  h4 {
    margin-block: 16px 8px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    background: var(--bg-elev);
  }
  th,
  td {
    padding: 9px 12px;
    border-bottom: 1px solid var(--border);
    text-align: start;
    vertical-align: middle;
  }
  th {
    font-weight: 500;
    color: var(--text-2);
  }
  .muted {
    font-size: 12px;
    line-height: 1.7;
  }
</style>
