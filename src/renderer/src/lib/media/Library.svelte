<script lang="ts">
  // 媒体库：自己加的视频、音频（文件留在原处，只记路径），看到哪里、有几个字幕；点一条接着看。
  // 可以把视频、音频文件直接拖进来
  import { Clapperboard, Plus, Film, Music, Trash2, Captions, TriangleAlert } from '@lucide/svelte'
  import { media } from '$lib/state/media.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { formatTime, type MediaItem } from '$shared/media'

  let dragging = $state(false)

  /** 最近看过的在前，没看过的按加入的先后 */
  const items = $derived(
    [...media.mine].sort(
      (a, b) =>
        (b.playedAt ?? '').localeCompare(a.playedAt ?? '') || a.addedAt.localeCompare(b.addedAt)
    )
  )

  async function remove(it: MediaItem): Promise<void> {
    const ok = await ui.confirm(
      t('media.removeTitle'),
      t('media.removeBody', { title: it.title }),
      t('common.remove'),
      true
    )
    if (ok) await media.remove(it.id)
  }

  function ondrop(e: DragEvent): void {
    e.preventDefault()
    dragging = false
    const files = [...(e.dataTransfer?.files ?? [])]
    if (files.length) void media.drop(files)
  }
</script>

<div
  class="page"
  class:dragging
  role="region"
  aria-label={t('nav.media')}
  ondragover={(e) => {
    e.preventDefault()
    dragging = true
  }}
  ondragleave={(e) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) dragging = false
  }}
  {ondrop}
>
  <header class="page-head">
    <Clapperboard size={22} strokeWidth={1.8} />
    <h1>{t('nav.media')}</h1>
    <div class="grow"></div>
    <button class="btn primary" data-add-media onclick={() => media.pick()}
      ><Plus size={14} />{t('media.add')}</button
    >
  </header>
  <p class="muted">{t('media.intro')}</p>

  {#if !media.loaded}
    <p class="muted">{t('common.loading')}</p>
  {:else if !items.length}
    <div class="card empty" data-media-empty>
      <p>{t('media.empty')}</p>
      <p class="faint">{t('media.formats')}</p>
    </div>
  {:else}
    <ul class="items">
      {#each items as it (it.id)}
        <li class="card item" data-media-item={it.id}>
          <button class="open" data-open-media={it.id} onclick={() => media.open(it.id)}>
            <span class="kind">
              {#if it.kind === 'video'}<Film size={20} />{:else}<Music size={20} />{/if}
            </span>
            <span class="body">
              <strong class="name">{it.title}</strong>
              <span class="meta faint">
                {#if it.duration}{formatTime(it.position)} / {formatTime(it.duration)}{/if}
                {#if it.subtitles.length}
                  <span class="subs"
                    ><Captions size={13} />{t('media.subCount', { n: it.subtitles.length })}</span
                  >
                {:else}
                  <span>{t('media.noSubtitleShort')}</span>
                {/if}
                {#if it.exists === false}
                  <span class="warn"><TriangleAlert size={13} />{t('media.missingShort')}</span>
                {/if}
              </span>
              {#if it.duration}
                <span class="bar"
                  ><span style:width="{Math.min(100, (it.position / it.duration) * 100)}%"
                  ></span></span
                >
              {/if}
            </span>
          </button>
          <button class="btn ghost" title={t('media.remove')} onclick={() => remove(it)}
            ><Trash2 size={14} /></button
          >
        </li>
      {/each}
    </ul>
  {/if}
  <p class="faint">{t('media.dropHint')}</p>
</div>

<style>
  .page.dragging {
    outline: 2px dashed var(--accent);
    outline-offset: -8px;
  }
  .page-head :global(svg) {
    color: var(--accent-text);
    align-self: center;
  }
  .grow {
    flex: 1;
  }
  .empty {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
  }
  .open {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    text-align: start;
  }
  .kind {
    color: var(--accent-text);
    display: inline-flex;
  }
  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .subs,
  .warn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .warn {
    color: var(--danger);
  }
  .bar {
    height: 3px;
    border-radius: 2px;
    background: var(--bg-sunken);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
</style>
