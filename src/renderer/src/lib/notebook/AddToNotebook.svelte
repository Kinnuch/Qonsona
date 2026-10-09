<script lang="ts">
  // 「加入生词本」：点一下进「我的生词」，已经在「我的生词」里的再点就移出。
  // make 可以是异步的（日语要先取词条，才有读音与释义）
  import { BookmarkPlus, BookmarkCheck } from '@lucide/svelte'
  import { notebook } from '$lib/state/notebook.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { MINE, listOf, listsWith, type CardInput } from '$shared/notebook'

  let {
    key,
    make
  }: {
    key: string
    make: () => CardInput | Promise<CardInput>
  } = $props()

  const inMine = $derived(!!notebook.nb && !!listOf(notebook.nb, MINE)?.keys.includes(key))
  /** 在哪些词本里（悬停时写出来） */
  const where = $derived(
    notebook.nb
      ? listsWith(notebook.nb, key)
          .map((l) => notebook.listName(l.id))
          .join('、')
      : ''
  )
  let busy = $state(false)

  async function toggle(): Promise<void> {
    if (busy || !notebook.nb) return
    if (inMine) {
      notebook.remove([key], MINE)
      ui.toast(t('notebook.removed', { list: t('notebook.mine') }))
      return
    }
    busy = true
    try {
      notebook.add(await make())
    } catch (e) {
      ui.toast(String(e instanceof Error ? e.message : e), 'error', 6000)
    } finally {
      busy = false
    }
  }
</script>

<button
  class="btn nb"
  class:on={inMine}
  data-add-notebook={key}
  data-in-notebook={inMine ? '' : undefined}
  disabled={!notebook.nb || busy}
  title={where ? t('notebook.inLists', { lists: where }) : t('notebook.addHint')}
  onclick={toggle}
>
  {#if inMine}<BookmarkCheck size={14} />{t('notebook.inBook')}{:else}<BookmarkPlus size={14} />{t(
      'notebook.add'
    )}{/if}
</button>

<style>
  .nb {
    padding: 3px 10px;
    font-size: 13px;
  }
  .nb.on {
    background: var(--accent-soft);
    border-color: transparent;
    color: var(--accent-text);
  }
</style>
