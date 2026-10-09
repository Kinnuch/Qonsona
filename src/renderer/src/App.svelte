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
  import { t } from '$lib/i18n/index.svelte'
  import { contrastText } from '$lib/ui/color'
  import Shell from './views/Shell.svelte'
  import ConfirmDialog from '$lib/ui/ConfirmDialog.svelte'
  import UpdateNotice from '$lib/ui/UpdateNotice.svelte'
  import Toasts from '$lib/ui/Toasts.svelte'

  let ready = $state(false)

  onMount(async () => {
    await ui.load()
    await packs.load()
    ready = true
    void audio.loadVoices()
    void activity.start()
    // 这次启动时用备份恢复过：说一声
    const restored = await platform.backup.restored().catch(() => null)
    if (restored?.ok) ui.toast(t('settings.backup.restored', { n: restored.files }), 'info', 8000)
    else if (restored) ui.toast(t('settings.backup.restoreFailed'), 'error', 8000)
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
    void audio.loadRecordings(id)
    void notebook.load(id)
    void courses.load(id)
    void practice.load(id)
  })

  // 关窗前把还没存的生词本、课程进度、练习记录、视听进度、学习时长存掉
  onMount(() => {
    window.addEventListener('beforeunload', flushAll)
    return () => window.removeEventListener('beforeunload', flushAll)
  })

  // 强调色跟着正在学的语言走
  $effect(() => {
    const color = packs.active?.color ?? '#0e9f8a'
    const root = document.documentElement.style
    root.setProperty('--accent', color)
    root.setProperty('--accent-contrast', contrastText(color))
  })
</script>

{#if ready}
  <Shell />
{/if}
<Toasts />
<ConfirmDialog />
{#if ready}<UpdateNotice />{/if}
