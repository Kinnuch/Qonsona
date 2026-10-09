<script lang="ts">
  // 日语点词弹出的词卡：原形、读音、等级、释义，朗读、去词典看、加入生词本。阅读器和视听的字幕共用
  import { BookMarked } from '@lucide/svelte'
  import type { JaWord } from '$shared/ja/reader'
  import { ui } from '$lib/state/ui.svelte'
  import { dictState } from '$lib/dict/state.svelte'
  import { t, i18n } from '$lib/i18n/index.svelte'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import AddToNotebook from '$lib/notebook/AddToNotebook.svelte'
  import { jaFromEntry, jaKey } from '$lib/notebook/cards'
  import { platform } from '$lib/platform'

  let {
    w,
    x,
    y,
    onopen
  }: {
    w: JaWord
    x: number
    y: number
    /** 去词典之前要做的事（视听先暂停） */
    onopen?: () => void
  } = $props()

  function openInDictionary(): void {
    onopen?.()
    const memo = dictState.of('ja')
    memo.tab = 'words'
    memo.query = w.base
    memo.selected = w.entryId ? String(w.entryId) : null
    ui.go('dictionary')
  }
</script>

<div class="pop card" style:left="{x}px" style:top="{y}px" data-word-card>
  <div class="pop-head">
    <span class="pop-word" lang="ja">{w.base}</span>
    {#if w.surface !== w.base}<span class="faint" lang="ja">{w.surface}</span>{/if}
    {#if w.jlpt}<span class="lv" data-jlpt={w.jlpt}>N{w.jlpt}</span>{/if}
    <Pronounce item={{ text: w.base, lang: 'ja-JP' }} />
  </div>
  {#if w.reading && w.surface === w.base}
    <p class="faint" lang="ja">{w.reading}</p>
  {/if}
  {#if w.entryId}
    {#if w.zh && i18n.locale === 'zh'}<p>{w.zh}</p>{/if}
    {#if w.en}<p class="muted">{w.en}</p>{/if}
  {:else}
    <p class="muted">{t('reading.noEntry')}</p>
  {/if}
  <div class="pop-actions">
    <button class="btn" data-open-dict onclick={openInDictionary}
      ><BookMarked size={14} />{t('reading.openInDict')}</button
    >
    {#if w.entryId}
      {@const id = w.entryId}
      <AddToNotebook
        key={jaKey(id)}
        make={async () => {
          const e = await platform.ja.entry(id)
          if (!e) throw new Error(t('reading.noEntry'))
          return jaFromEntry(e)
        }}
      />
    {/if}
  </div>
</div>

<style>
  .pop {
    position: fixed;
    z-index: 50;
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    box-shadow: var(--shadow-lg);
  }
  .pop-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pop-word {
    font-size: 20px;
    font-weight: 600;
  }
  .pop-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .lv {
    font-size: 11px;
    padding: 0 5px;
    border-radius: 4px;
    color: #fff;
    background: var(--text-3);
  }
  .lv[data-jlpt='5'] {
    background: #2f9e63;
  }
  .lv[data-jlpt='4'] {
    background: #2b8cc4;
  }
  .lv[data-jlpt='3'] {
    background: #7a5cc9;
  }
  .lv[data-jlpt='2'] {
    background: #d08a26;
  }
  .lv[data-jlpt='1'] {
    background: #d64545;
  }
</style>
