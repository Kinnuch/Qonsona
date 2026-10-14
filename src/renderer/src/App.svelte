<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { audio } from '$lib/state/audio.svelte'
  import { notebook } from '$lib/state/notebook.svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { practice } from '$lib/state/practice.svelte'
  import { activity } from '$lib/state/activity.svelte'
  import { flushAll } from '$lib/state/persist'
  import { platform } from '$lib/platform'
  import { t, i18n } from '$lib/i18n/index.svelte'
  import { contrastText } from '$lib/ui/color'
  import Shell from './views/Shell.svelte'
  import ConfirmDialog from '$lib/ui/ConfirmDialog.svelte'
  import UpdateNotice from '$lib/ui/UpdateNotice.svelte'
  import Toasts from '$lib/ui/Toasts.svelte'
  import { account } from '$lib/state/account.svelte'

  let ready = $state(false)

  onMount(async () => {
    await ui.load()
    await packs.load()
    // 学习界面可点击之前加载统计，完成事件才能进入关窗保存屏障。
    await activity.start()
    void account.ensure()
    ready = true
    void audio.loadVoices()
    // 这次启动时用备份恢复过：说一声
    const restored = await platform.backup.restored().catch(() => null)
    if (restored?.ok) ui.toast(t('settings.backup.restored', { n: restored.files }), 'info', 8000)
    else if (restored) ui.toast(t('settings.backup.restoreFailed'), 'error', 8000)
    const transferred = await platform.transfer.result().catch(() => null)
    if (transferred && 'error' in transferred) ui.toast(transferred.error, 'error', 8000)
    else if (transferred)
      ui.toast(
        i18n.locale === 'zh'
          ? `已合并 ${transferred.files} 个学习数据文件。`
          : `Merged ${transferred.files} learning data files.`,
        'info',
        8000
      )
  })

  // 换模块、换语言时把前一段学习时间记在原来的头上
  $effect(() => {
    void ui.section
    void packs.active?.id
    untrack(() => activity.tick())
  })

  // 换了语言就换一份录音清单、一本生词本、一份课程进度、一份练习记录
  $effect(() => {
    const id = packs.active?.id ?? null
    if (!ready) return
    untrack(() => {
      void Promise.all([
        audio.loadRecordings(id),
        notebook.load(id),
        courses.load(id),
        practice.load(id)
      ]).catch((error) => ui.toast(String(error), 'error', 8000))
    })
  })

  // 关窗前把还没存的生词本、课程进度、练习记录、视听进度、学习时长存掉
  onMount(() => {
    const flush = (): void => {
      void flushAll().catch((error) => ui.toast(String(error), 'error'))
    }
    let closingToken: string | undefined
    platform.lifecycle.onCloseCanceled((token) => {
      if (closingToken !== token) return
      ui.closing = false
      closingToken = undefined
    })
    platform.lifecycle.onCloseRequest((token) => {
      if (ui.closing) return
      closingToken = token
      ui.closing = true
      void flushAll()
        .then(() => platform.lifecycle.closeReady(true, token))
        .catch((error) => {
          // A late failure from a canceled update must not unlock a later close request.
          if (closingToken !== token) return
          ui.closing = false
          closingToken = undefined
          ui.toast(String(error), 'error', 8000)
          void platform.lifecycle.closeReady(false, token)
        })
    })
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  })

  // 强调色跟着正在学的语言走
  $effect(() => {
    const color = packs.active?.color ?? '#0e9f8a'
    const root = document.documentElement.style
    root.setProperty('--accent', color)
    root.setProperty('--accent-contrast', contrastText(color))
  })
</script>

<div inert={ui.closing} style="display: contents">
  {#if ready}<Shell />{/if}
  <Toasts />
  <ConfirmDialog />
  {#if ready}<UpdateNotice />{/if}
</div>
{#if ui.closing}
  <div class="saving" role="status">
    {i18n.locale === 'zh' ? '正在保存学习数据…' : 'Saving learning data…'}
  </div>
{/if}

<style>
  .saving {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 1000;
    padding: 12px 18px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-elev);
    color: var(--text);
  }
</style>
