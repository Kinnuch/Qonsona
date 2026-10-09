<script lang="ts">
  // 框架语言的文章库：新闻（有版权的只有标题导语）、自己导入的、内置课文（公有领域、开放许可）。
  // 按难度、来源、主题筛，隐藏读完的；可以粘贴文章导入；取新闻时写明每个来源取没取到
  import { onMount } from 'svelte'
  import { ClipboardPaste, RefreshCw, Trash2, Check } from '@lucide/svelte'
  import { langReading, type LangSourceFilter } from '$lib/state/langReading.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { t, pick, i18n } from '$lib/i18n/index.svelte'
  import { LANGS } from '$shared/lang/registry'
  import { primarySystem } from '$shared/lang/levels'
  import type { LangCode } from '$shared/lang/types'
  import type { LangArticleMeta } from '$shared/lang/articles'

  let { code }: { code: string } = $props()

  const spec = $derived(LANGS[code as LangCode].spec)
  const levels = $derived(primarySystem(spec.levelSystems).levels)
  const memo = $derived(langReading.memo)
  const SOURCES: LangSourceFilter[] = ['all', 'news', 'user', 'builtin']

  let pasting = $state(false)
  let title = $state('')
  let topic = $state('')
  let body = $state('')

  onMount(() => void langReading.ensure(code))

  const levelShort = (id: string | null): string =>
    id ? (levels.find((l) => l.id === id)?.short ?? id) : ''
  const topicName = (tp: string): string => {
    const k = `langReading.topics.${tp}`
    const s = t(k)
    return s === k ? tp : s
  }
  const date = (iso?: string): string =>
    iso
      ? new Date(iso).toLocaleDateString(i18n.locale === 'zh' ? 'zh-CN' : 'en', {
          month: 'short',
          day: 'numeric'
        })
      : ''

  async function importIt(): Promise<void> {
    if (!body.trim()) return
    const meta = await langReading.save({ title, body, topic })
    pasting = false
    title = ''
    topic = ''
    body = ''
    if (meta) {
      ui.toast(t('reading.imported', { title: meta.title }))
      await langReading.open(meta.id)
    }
  }

  async function remove(a: LangArticleMeta): Promise<void> {
    const ok = await ui.confirm(
      t('reading.removeTitle', { title: a.title }),
      t('reading.removeBody'),
      t('common.remove'),
      true
    )
    if (ok) await langReading.remove(a.id)
  }

  const newsLine = $derived.by(() => {
    const n = langReading.news
    if (!n || !n.sources.length) return ''
    const ok = n.sources.filter((s) => s.ok).length
    return t('langReading.newsStatus', { ok, total: n.sources.length, added: n.added })
  })
</script>

<div class="lib" data-lex-library={code}>
  <header class="page-head">
    <h1>{t('nav.reading')}</h1>
    <div class="grow"></div>
    {#if LANGS[code as LangCode].news?.length}
      <button
        class="btn"
        data-refresh-news
        disabled={langReading.refreshing}
        onclick={() => langReading.refreshNews(true)}
        ><RefreshCw size={14} />{langReading.refreshing
          ? t('langReading.refreshing')
          : t('langReading.refresh')}</button
      >
    {/if}
    <button class="btn primary" data-paste onclick={() => (pasting = !pasting)}
      ><ClipboardPaste size={14} />{t('reading.paste')}</button
    >
  </header>
  <p class="muted">{t('langReading.intro')}</p>
  {#if newsLine}
    <details class="faint news-line" data-news-status>
      <summary>{newsLine}</summary>
      <ul>
        {#each langReading.news?.sources ?? [] as s (s.id)}
          <li>
            {s.name}：{s.ok
              ? t('langReading.sourceOk', { n: s.count })
              : t('langReading.sourceFail', { error: s.error ?? '' })}
          </li>
        {/each}
      </ul>
    </details>
  {/if}

  {#if pasting}
    <div class="card paste" data-paste-form>
      <input class="input" placeholder={t('reading.pasteTitle')} bind:value={title} />
      <input class="input" placeholder={t('reading.pasteTopic')} bind:value={topic} />
      <textarea
        class="input"
        rows="8"
        dir="auto"
        lang={spec.bcp47}
        placeholder={t('langReading.pasteBody', { lang: pick(spec.name) })}
        bind:value={body}
        data-paste-body
      ></textarea>
      <div class="row">
        <div class="grow"></div>
        <button class="btn" onclick={() => (pasting = false)}>{t('common.cancel')}</button>
        <button class="btn primary" disabled={!body.trim()} data-import onclick={importIt}
          >{t('reading.importIt')}</button
        >
      </div>
    </div>
  {/if}

  <div class="filters">
    <div class="chips">
      <span class="faint">{t('reading.level')}</span>
      <button class="chip" class:on={memo.level === null} onclick={() => (memo.level = null)}
        >{t('reading.all')}</button
      >
      {#each levels as l (l.id)}
        <button
          class="chip"
          class:on={memo.level === l.id}
          data-filter-level={l.id}
          title={pick(l.desc)}
          onclick={() => (memo.level = memo.level === l.id ? null : l.id)}>{l.short}</button
        >
      {/each}
    </div>
    <div class="chips">
      <span class="faint">{t('reading.source')}</span>
      {#each SOURCES as s (s)}
        <button
          class="chip"
          class:on={memo.source === s}
          data-filter-source={s}
          onclick={() => (memo.source = s)}>{t(`langReading.sources.${s}`)}</button
        >
      {/each}
      <label class="check"
        ><input type="checkbox" bind:checked={memo.hideRead} />{t('reading.hideRead')}</label
      >
    </div>
    {#if langReading.topics.length}
      <div class="chips">
        <span class="faint">{t('reading.topic')}</span>
        <button class="chip" class:on={memo.topic === null} onclick={() => (memo.topic = null)}
          >{t('reading.all')}</button
        >
        {#each langReading.topics.slice(0, 16) as [tp, n] (tp)}
          <button
            class="chip"
            class:on={memo.topic === tp}
            data-filter-topic={tp}
            onclick={() => (memo.topic = memo.topic === tp ? null : tp)}
            >{topicName(tp)}<b>{n}</b></button
          >
        {/each}
      </div>
    {/if}
  </div>

  {#if !langReading.loaded}
    <p class="muted">{t('reading.analyzing')}</p>
  {:else}
    <ul class="articles">
      {#each langReading.shown as a (a.id)}
        <li class="art card" class:read={!!a.readAt} data-article={a.id}>
          <button class="open" onclick={() => langReading.open(a.id)}>
            <span class="row">
              <strong lang={spec.bcp47} dir="auto">{a.title}</strong>
              {#if a.level}<span class="chip level">{levelShort(a.level)}</span>{/if}
              {#if a.readAt}<span class="faint"><Check size={12} />{t('reading.read')}</span>{/if}
              {#if a.translated}<span class="chip">{t('reading.translatedChip')}</span>{/if}
            </span>
            <span class="faint meta"
              >{[
                t(`langReading.sources.${a.source}`),
                a.origin,
                a.author,
                a.topic ? topicName(a.topic) : '',
                date(a.publishedAt ?? a.addedAt),
                a.excerpt ? t('langReading.excerptChip') : t('reading.chars', { n: a.chars })
              ]
                .filter(Boolean)
                .join(' · ')}</span
            >
            {#if a.preview}<span class="preview" lang={spec.bcp47} dir="auto">{a.preview}</span
              >{/if}
          </button>
          {#if a.source === 'user'}
            <button
              class="btn ghost danger icon"
              title={t('common.remove')}
              onclick={() => remove(a)}><Trash2 size={14} /></button
            >
          {/if}
        </li>
      {:else}
        <li class="faint">{t('reading.noArticles')}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .lib {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    overflow-y: auto;
    padding: 20px 24px 40px;
  }
  .page-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .grow {
    flex: 1;
  }
  .news-line {
    font-size: 13px;
  }
  .news-line ul {
    margin: 4px 0 0;
    padding-inline-start: 18px;
  }
  .paste {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .input {
    width: 100%;
    padding: 7px 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    font: inherit;
    color: inherit;
  }
  textarea.input {
    resize: vertical;
  }
  .row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .filters {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .chip b {
    margin-inline-start: 4px;
    font-weight: 500;
    color: var(--text-3);
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-inline-start: 8px;
    font-size: 13px;
  }
  .articles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .art {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 0;
  }
  .art.read {
    opacity: 0.75;
  }
  .open {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
    border: none;
    background: none;
    text-align: start;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  .open:hover {
    background: var(--bg-hover);
  }
  .meta {
    font-size: 12px;
  }
  .preview {
    font-size: 13px;
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip.level {
    font-size: 11px;
    padding: 0 6px;
  }
  .icon {
    margin: 8px;
  }
</style>
