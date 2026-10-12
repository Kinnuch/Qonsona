<script lang="ts">
  // 生词本：左边是词本（我的生词、自己建的、从内置词本加进来的），右边是选中的词本；
  // 顶上是今天要复习多少。复习、闪卡在同一页里进行（ReviewSession）
  import { onMount } from 'svelte'
  import { NotebookPen, Play, Layers, Plus, Trash2, X, Check } from '@lucide/svelte'
  import { notebook } from '$lib/state/notebook.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { platform } from '$lib/platform'
  import { t, pick, i18n } from '$lib/i18n/index.svelte'
  import {
    MINE,
    cardsOf,
    countStatuses,
    listOf,
    orphansOf,
    statusOf,
    type CardStatus,
    type NoteCard
  } from '$shared/notebook'
  import { DAY, STATE, endOfDay } from '$shared/srs'
  import { builtinLists } from '$lib/notebook/builtin'
  import { langModule } from '$shared/lang/registry'
  import type { LexListInfo } from '$shared/lang/views'
  import ReviewSession from '$lib/notebook/ReviewSession.svelte'
  import ReviewSettings from '$lib/notebook/ReviewSettings.svelte'
  import NotebookTransfer from '$lib/notebook/NotebookTransfer.svelte'

  /** 大词本先列这么多个 */
  const PAGE = 100
  let page = $state(0)
  let search = $state('')
  let previousList = $state<string | null>(null)
  const FILTERS: ('all' | CardStatus)[] = ['all', 'new', 'forgot', 'unsure', 'known']

  const pack = $derived(packs.active)
  const nb = $derived(notebook.nb)
  const view = notebook.view

  let jlptCounts = $state<Record<number, number>>({})
  let langLists = $state.raw<LexListInfo[]>([])
  onMount(async () => {
    await notebook.load(packs.active?.id ?? null)
    const id = packs.active?.id
    if (id === 'ja') jlptCounts = await platform.ja.jlptCounts()
    else if (id && langModule(id)) langLists = await platform.lang.lists(id).catch(() => [])
  })

  const builtins = $derived(
    builtinLists(
      pack,
      packs.project,
      packs.levels,
      packs.study,
      packs.hidden,
      pick,
      { favorite: t('notebook.favorite'), tag: (tag) => t('notebook.tag', { tag }) },
      jlptCounts,
      langLists
    )
  )
  const list = $derived(nb ? (listOf(nb, view.list) ?? listOf(nb, MINE)!) : null)
  const cards = $derived(nb && list ? cardsOf(nb, list) : [])
  const statusCounts = $derived(countStatuses(cards))
  const filtered = $derived(
    cards.filter(
      (c) =>
        (view.filter === 'all' || statusOf(c) === view.filter) &&
        (!search.trim() ||
          [c.front, c.reading, ...Object.values(c.meaning)]
            .join(' ')
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()))
    )
  )
  const pages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE)))
  const shown = $derived(
    filtered.slice(Math.min(page, pages - 1) * PAGE, (Math.min(page, pages - 1) + 1) * PAGE)
  )
  $effect(() => {
    const id = list?.id ?? null
    if (previousList !== id) {
      previousList = id
      page = 0
      search = ''
    }
  })

  let newName = $state('')
  let renaming = $state<string | null>(null)
  let busy = $state<string | null>(null)
  let settingsOpen = $state(false)

  function createList(): void {
    const id = notebook.newList(newName)
    if (id) {
      view.list = id
      view.filter = 'all'
      newName = ''
    }
  }

  async function addBuiltin(b: (typeof builtins)[number]): Promise<void> {
    busy = b.source
    try {
      const id = notebook.addMany(await b.load(), b.name, b.source)
      if (id) {
        view.list = id
        view.filter = 'all'
      }
    } finally {
      busy = null
    }
  }

  async function deleteList(id: string): Promise<void> {
    if (!nb) return
    const ok = await ui.confirm(
      t('notebook.deleteTitle', { name: notebook.listName(id) }),
      t('notebook.deleteBody', { n: orphansOf(nb, id) }),
      t('common.remove'),
      true
    )
    if (ok) notebook.deleteList(id)
  }

  function dueLabel(c: NoteCard): string {
    if (c.state === STATE.NEW) return ''
    if (c.due <= endOfDay()) return t('notebook.dueToday')
    return t('notebook.dueIn', { n: Math.max(1, Math.ceil((c.due - endOfDay()) / DAY)) })
  }
  const meaning = (m: Record<string, string>): string =>
    (i18n.locale === 'zh' ? m.zh || m.en : m.en || m.zh) || pick(m)
  const isData = $derived(pack?.kind === 'qonlang')
  const added = (source: string): string | undefined =>
    nb?.lists.find((l) => l.source === source)?.id
</script>

{#if notebook.session}
  <ReviewSession />
{:else}
  <div class="page">
    <header class="page-head head">
      <NotebookPen size={22} strokeWidth={1.8} />
      <h1>{t('nav.notebook')}</h1>
      <div class="grow"></div>
      <span class="muted today" data-today
        >{t('notebook.today', { due: notebook.counts.due, fresh: notebook.counts.fresh })}</span
      >
      <button
        class="btn primary"
        data-start-review
        disabled={!nb || notebook.counts.due + notebook.counts.fresh === 0}
        onclick={() => notebook.startReview()}><Play size={16} />{t('notebook.startReview')}</button
      >
    </header>
    <p class="muted">{t('notebook.intro')}</p>
    <!-- NotebookTransfer insertion point: independent import/export component. -->
    <div class="toolbar">
      <button
        class="btn"
        data-open-review-settings
        disabled={!nb}
        onclick={() => (settingsOpen = true)}
        >{i18n.locale === 'zh' ? '复习计划与题型' : 'Review plan and tasks'}</button
      >
      <div class="transfer"><NotebookTransfer /></div>
    </div>
    {#if settingsOpen}<ReviewSettings
        listId={list?.id ?? null}
        onclose={() => (settingsOpen = false)}
      />{/if}

    {#if !nb}
      <p class="muted">{t('common.loading')}</p>
    {:else}
      <div class="cols">
        <aside class="lists">
          <h3>{t('notebook.myLists')}</h3>
          {#each nb.lists as l (l.id)}
            <button
              class="list-item"
              class:on={list?.id === l.id}
              data-list={l.id}
              onclick={() => {
                view.list = l.id
                view.filter = 'all'
                view.showAll = false
              }}
            >
              <span class="name">{notebook.listName(l.id)}</span>
              <span class="faint">{l.keys.length}</span>
            </button>
          {/each}
          <form
            class="new-list"
            onsubmit={(e) => {
              e.preventDefault()
              createList()
            }}
          >
            <input class="input" placeholder={t('notebook.newListName')} bind:value={newName} />
            <button class="btn" type="submit" title={t('notebook.newList')}
              ><Plus size={14} /></button
            >
          </form>

          {#if builtins.length}
            <h3>{t('notebook.builtin')}</h3>
            {#each builtins as b, i (b.source)}
              {@const got = added(b.source)}
              {#if b.group && b.group !== builtins[i - 1]?.group}
                <h4 class="group" data-builtin-group={b.group}>
                  {b.groupName ?? t(`notebook.groups.${b.group}`)}
                </h4>
              {/if}
              <div class="builtin" data-builtin={b.source}>
                <span class="name">{b.name}</span>
                {#if b.count !== null}<span class="faint">{b.count}</span>{/if}
                {#if got}
                  <button class="btn ghost small" onclick={() => (view.list = got)}
                    ><Check size={14} />{t('notebook.addedBuiltin')}</button
                  >
                {:else}
                  <button
                    class="btn small"
                    data-add-builtin={b.source}
                    disabled={busy !== null}
                    onclick={() => addBuiltin(b)}
                    >{busy === b.source ? t('common.loading') : t('notebook.addBuiltin')}</button
                  >
                {/if}
              </div>
            {/each}
          {/if}
        </aside>

        {#if list}
          <section class="detail" data-list-detail={list.id}>
            <div class="row">
              {#if renaming === list.id}
                <form
                  class="rename"
                  onsubmit={(e) => {
                    e.preventDefault()
                    notebook.renameList(
                      list.id,
                      (e.currentTarget.elements.namedItem('n') as HTMLInputElement).value
                    )
                    renaming = null
                  }}
                >
                  <input class="input" name="n" value={list.name} />
                  <button class="btn" type="submit"><Check size={14} /></button>
                </form>
              {:else}
                <h2>{notebook.listName(list.id)}</h2>
                {#if list.id !== MINE}
                  <button class="btn ghost small" onclick={() => (renaming = list.id)}
                    >{t('notebook.rename')}</button
                  >
                {/if}
              {/if}
              <div class="grow"></div>
              <button
                class="btn"
                data-start-list-review
                disabled={!nb || notebook.reviewCount(list.id) === 0}
                onclick={() => notebook.startReview(list.id)}
                ><Play size={16} />{i18n.locale === 'zh'
                  ? '按本词本计划复习'
                  : 'Review this list’s plan'}</button
              >
              <button
                class="btn"
                data-drill
                disabled={!filtered.length}
                title={t('notebook.drillHint')}
                onclick={() =>
                  notebook.startDrill(
                    list.id,
                    view.filter === 'all' ? undefined : filtered.map((c) => c.key)
                  )}><Layers size={16} />{t('notebook.drill')}</button
              >
              {#if list.id !== MINE}
                <button
                  class="btn ghost danger"
                  data-delete-list
                  title={t('notebook.deleteList')}
                  onclick={() => deleteList(list.id)}><Trash2 size={16} /></button
                >
              {/if}
            </div>

            <div class="filters">
              <input
                class="input"
                data-notebook-search
                aria-label={i18n.locale === 'zh'
                  ? '搜索词语、读音、释义'
                  : 'Search words, readings and meanings'}
                placeholder={i18n.locale === 'zh' ? '搜索当前词本…' : 'Search this list…'}
                bind:value={search}
                oninput={() => (page = 0)}
              />
              {#each FILTERS as f (f)}
                <button
                  class="chip status {f}"
                  class:on={view.filter === f}
                  data-filter={f}
                  onclick={() => {
                    view.filter = f
                    page = 0
                    view.showAll = false
                  }}
                >
                  {t(`notebook.status.${f}`)}
                  <b>{f === 'all' ? cards.length : statusCounts[f]}</b>
                </button>
              {/each}
            </div>

            {#if !cards.length}
              <p class="card muted empty">
                {t(list.id === MINE ? 'notebook.emptyMine' : 'notebook.empty')}
              </p>
            {:else}
              <div class="table-scroll">
                <table class="words">
                  <tbody>
                    {#each shown as c (c.key)}
                      {@const st = statusOf(c)}
                      <tr data-card-row={c.key}>
                        <td class="front" class:data={isData} lang={pack?.bcp47}>{c.front}</td>
                        <td class="reading" class:data={isData}
                          >{c.reading !== c.front ? c.reading : ''}</td
                        >
                        <td class="meaning">{meaning(c.meaning)}</td>
                        <td><span class="chip status {st}">{t(`notebook.status.${st}`)}</span></td>
                        <td class="faint due">{dueLabel(c)}</td>
                        <td>
                          <button
                            class="icon"
                            title={t('notebook.removeWord')}
                            onclick={() => notebook.remove([c.key], list.id)}
                            ><X size={14} /></button
                          >
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
              <div class="pagination" data-notebook-pagination>
                <button
                  class="btn"
                  data-notebook-previous
                  disabled={page === 0}
                  onclick={() => (page = Math.max(0, page - 1))}
                  >{i18n.locale === 'zh' ? '上一页' : 'Previous'}</button
                ><span class="muted"
                  >{Math.min(page, pages - 1) + 1} / {pages} · {filtered.length}
                  {i18n.locale === 'zh' ? '词' : 'words'}</span
                ><button
                  class="btn"
                  data-notebook-next
                  disabled={page >= pages - 1}
                  onclick={() => (page = Math.min(pages - 1, page + 1))}
                  >{i18n.locale === 'zh' ? '下一页' : 'Next'}</button
                >
              </div>
            {/if}
          </section>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .head {
    align-items: center;
  }
  .grow {
    flex: 1;
  }
  .today {
    font-size: 14px;
  }
  .cols {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }
  .lists {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .lists h3 {
    margin: 10px 0 4px;
  }
  .list-item,
  .group {
    margin: 8px 0 2px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
  }
  .builtin {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
  }
  .list-item {
    border: none;
    background: none;
    cursor: pointer;
    text-align: start;
  }
  .list-item:hover {
    background: var(--bg-hover);
  }
  .list-item.on {
    background: var(--accent-soft);
    color: var(--accent-text);
    font-weight: 600;
  }
  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .small {
    padding: 2px 8px;
    font-size: 12px;
  }
  .new-list,
  .rename {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }
  .input {
    flex: 1;
    min-width: 0;
    padding: 5px 8px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    font: inherit;
    color: inherit;
  }
  .detail {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .toolbar {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
  }
  .transfer {
    width: 100%;
    min-width: 0;
  }
  .lists,
  .rename {
    min-width: 0;
  }
  h2 {
    overflow-wrap: anywhere;
  }
  @media (max-width: 850px) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip.status {
    border: none;
    cursor: default;
  }
  button.chip.status {
    cursor: pointer;
    padding: 3px 10px;
  }
  button.chip.status.on {
    outline: 2px solid var(--accent);
  }
  .chip b {
    margin-inline-start: 4px;
    font-weight: 600;
  }
  .chip.new {
    background: var(--bg-sunken);
  }
  .chip.forgot {
    background: var(--danger-soft);
    color: var(--danger);
  }
  .chip.unsure {
    background: color-mix(in srgb, #c98a1b 16%, var(--bg-elev));
    color: #a86f10;
  }
  .chip.known {
    background: color-mix(in srgb, #2f9e63 16%, var(--bg-elev));
    color: #23804f;
  }
  .words {
    width: 100%;
    border-collapse: collapse;
  }
  .words td {
    padding: 6px 8px;
    border-top: 1px solid var(--border);
    vertical-align: baseline;
  }
  .front {
    font-size: 16px;
    font-weight: 500;
    white-space: nowrap;
  }
  .data {
    font-family: var(--font-data);
  }
  .reading {
    color: var(--text-2);
    white-space: nowrap;
  }
  .meaning {
    color: var(--text-2);
    width: 100%;
  }
  .due,
  .words .chip {
    white-space: nowrap;
  }
  .icon {
    display: inline-grid;
    place-items: center;
    border: none;
    background: none;
    color: var(--text-3);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
  }
  .icon:hover {
    color: var(--danger);
    background: var(--bg-hover);
  }
  .empty {
    padding: 20px;
  }
  .pagination {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 12px;
  }
</style>
