<script lang="ts">
  // 日语文章库：内置（青空文库）、自己导入的、NHK（Easy 的全文或新闻的导语）；按难度、来源、主题筛选，可隐藏读完的
  import { onMount } from 'svelte'
  import {
    ClipboardPaste,
    FileText,
    RefreshCw,
    Trash2,
    Check,
    BookOpen,
    Languages
  } from '@lucide/svelte'
  import { reading, type SourceFilter } from '$lib/state/reading.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { platform } from '$lib/platform'
  import type { ArticleMeta } from '$shared/articles'
  import { topicLabel } from './topics'

  const LEVELS = [5, 4, 3, 2, 1]
  const SOURCES: SourceFilter[] = ['all', 'aozora', 'user', 'nhk']
  const NHK_SITE = 'https://news.web.nhk/news/easy/'
  const NHK_NEWS = 'https://news.web.nhk/newsweb/'

  let pasting = $state(false)
  let title = $state('')
  let topic = $state('')
  let body = $state('')
  let dragging = $state(false)

  onMount(() => reading.ensure())

  async function importPasted(): Promise<void> {
    if (!body.trim()) return
    await reading.add({ title, body, topic })
    pasting = false
    title = ''
    topic = ''
    body = ''
  }

  async function importFile(file?: { name: string; content: string }): Promise<void> {
    const f = file ?? (await platform.articles.pickFile())
    if (f) await reading.add({ title: f.name, body: f.content })
  }

  async function ondrop(e: DragEvent): Promise<void> {
    e.preventDefault()
    dragging = false
    const file = e.dataTransfer?.files[0]
    if (file)
      await importFile({ name: file.name.replace(/\.[^.]+$/, ''), content: await file.text() })
  }

  async function remove(a: ArticleMeta): Promise<void> {
    const ok = await ui.confirm(
      t('reading.removeTitle', { title: a.title }),
      t('reading.removeBody'),
      t('common.remove'),
      true
    )
    if (ok) await reading.remove(a.id)
  }

  const levelLabel = (n: number | null): string =>
    n === null ? t('reading.levelUnknown') : `N${n}`
  const nhkFailed = $derived(reading.nhk && !reading.nhk.ok && reading.nhk.reason !== 'off')
  /** NHK Easy 要登录，取的是 NHK 新闻的标题与导语 */
  const viaNews = $derived(ui.prefs.nhkEasy && reading.nhk?.ok && reading.nhk.via === 'news')
</script>

<div
  class="page"
  class:dragging
  role="region"
  aria-label={t('nav.reading')}
  ondragover={(e) => {
    e.preventDefault()
    dragging = true
  }}
  ondragleave={(e) => {
    if (e.currentTarget === e.target) dragging = false
  }}
  {ondrop}
>
  <header class="page-head head">
    <BookOpen size={22} strokeWidth={1.8} />
    <h1>{t('nav.reading')}</h1>
    <div class="grow"></div>
    <button class="btn" data-paste onclick={() => (pasting = !pasting)}
      ><ClipboardPaste size={16} />{t('reading.paste')}</button
    >
    <button class="btn" onclick={() => importFile()}
      ><FileText size={16} />{t('reading.openFile')}</button
    >
    {#if ui.prefs.nhkEasy}
      <button
        class="btn"
        data-nhk-refresh
        disabled={reading.refreshing}
        onclick={() => reading.refreshNhk()}
        ><RefreshCw size={16} />{t('reading.nhk.refresh')}</button
      >
    {/if}
  </header>
  <p class="muted">{t('reading.intro')}</p>

  {#if nhkFailed}
    <p class="card note" data-nhk-note>
      {t(`reading.nhk.reasons.${reading.nhk!.reason}`)}
      <a href={NHK_SITE} target="_blank" rel="noopener">{t('reading.nhk.openSite')}</a>
    </p>
  {:else if viaNews}
    <p class="faint via" data-nhk-via-news>
      {t('reading.nhk.viaNews')}
      <a href={NHK_NEWS} target="_blank" rel="noopener">{t('reading.nhk.openNews')}</a>
    </p>
  {/if}

  {#if pasting}
    <div class="card paste" data-paste-form>
      <div class="row">
        <input class="input" placeholder={t('reading.pasteTitle')} bind:value={title} />
        <input
          class="input topic-in"
          placeholder={t('reading.pasteTopic')}
          list="article-topics"
          bind:value={topic}
          data-paste-topic
        />
        <datalist id="article-topics">
          {#each reading.topics as [tp] (tp)}<option value={tp}>{topicLabel(tp)}</option>{/each}
        </datalist>
      </div>
      <textarea
        class="input"
        rows="8"
        placeholder={t('reading.pasteBody')}
        bind:value={body}
        data-paste-body
      ></textarea>
      <div class="row end">
        <button class="btn" onclick={() => (pasting = false)}>{t('common.cancel')}</button>
        <button class="btn primary" disabled={!body.trim()} onclick={importPasted} data-paste-ok
          >{t('reading.importIt')}</button
        >
      </div>
    </div>
  {/if}

  <div class="filters">
    <div class="seg" role="group" aria-label={t('reading.level')}>
      <button class:on={reading.level === null} onclick={() => (reading.level = null)}
        >{t('reading.all')}</button
      >
      {#each LEVELS as n (n)}
        <button class:on={reading.level === n} onclick={() => (reading.level = n)}>N{n}</button>
      {/each}
    </div>
    <div class="seg" role="group" aria-label={t('reading.source')}>
      {#each SOURCES as s (s)}
        <button class:on={reading.source === s} onclick={() => (reading.source = s)}
          >{t(`reading.sources.${s}`)}</button
        >
      {/each}
    </div>
    <label class="check"
      ><input type="checkbox" bind:checked={reading.hideRead} />{t('reading.hideRead')}</label
    >
  </div>
  {#if reading.topics.length}
    <div class="topics" role="group" aria-label={t('reading.topic')} data-topics>
      <span class="muted">{t('reading.topic')}</span>
      <button
        class="chip"
        class:on={reading.topic === null}
        aria-pressed={reading.topic === null}
        data-topic=""
        onclick={() => (reading.topic = null)}>{t('reading.all')}</button
      >
      {#each reading.topics as [tp, n] (tp)}
        <button
          class="chip"
          class:on={reading.topic === tp}
          aria-pressed={reading.topic === tp}
          data-topic={tp}
          onclick={() => (reading.topic = reading.topic === tp ? null : tp)}
          >{topicLabel(tp)}<b>{n}</b></button
        >
      {/each}
    </div>
  {/if}

  {#if !reading.loaded}
    <p class="muted">{t('reading.loading')}</p>
  {:else}
    <div class="list">
      {#each reading.shown as a (a.id)}
        <div class="card item" class:read={!!a.readAt} data-article={a.id}>
          <button class="open" onclick={() => reading.open(a.id)}>
            <span class="titleline">
              <strong>{a.title}</strong>
              {#if a.readAt}<span class="chip on"><Check size={12} />{t('reading.read')}</span>{/if}
              {#if a.translated}<span class="chip" data-translated
                  ><Languages size={12} />{t('reading.translatedChip')}</span
                >{/if}
            </span>
            <span class="faint">
              {[
                a.author,
                t(`reading.sources.${a.source}`),
                topicLabel(a.topic),
                t('reading.chars', { n: a.chars })
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </button>
          <span class="chip level" data-level={a.level ?? ''}>{levelLabel(a.level)}</span>
          {#if a.source !== 'aozora'}
            <button class="btn ghost danger" title={t('common.remove')} onclick={() => remove(a)}
              ><Trash2 size={16} /></button
            >
          {/if}
        </div>
      {:else}
        <p class="card muted">{t('reading.noArticles')}</p>
      {/each}
    </div>
  {/if}
  <p class="faint">{t('reading.dropHint')}</p>
</div>

<style>
  .head {
    align-items: center;
  }
  .grow {
    flex: 1;
  }
  .dragging {
    outline: 2px dashed var(--accent);
    outline-offset: -8px;
  }
  .note {
    background: var(--bg-sunken);
    color: var(--text-2);
  }
  .note a,
  .via a {
    color: var(--accent-text);
    margin-inline-start: 6px;
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
    resize: vertical;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .topic-in {
    max-width: 260px;
  }
  .topics {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .topics .chip {
    border: none;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    padding: 3px 10px;
  }
  .topics .chip b {
    font-weight: 600;
    margin-inline-start: 4px;
    opacity: 0.7;
  }
  .end {
    justify-content: flex-end;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .seg button {
    padding: 4px 10px;
    border: none;
    background: var(--bg-elev);
    cursor: pointer;
  }
  .seg button + button {
    border-inline-start: 1px solid var(--border);
  }
  .seg button.on {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
  }
  .item.read {
    opacity: 0.75;
  }
  .open {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    border: none;
    background: none;
    padding: 0;
    text-align: start;
    cursor: pointer;
  }
  .open:hover strong {
    color: var(--accent-text);
  }
  .titleline {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .level {
    min-width: 44px;
    justify-content: center;
  }
</style>
