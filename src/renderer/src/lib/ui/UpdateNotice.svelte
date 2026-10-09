<script lang="ts">
  /**
   * 新版本提示（右下角，照千语集）。用户点「下载并安装」才动手：应用内下载安装包（装过的 Windows 版先试增量），
   * 下好先把生词本存盘，再静默安装（沿用上次的安装目录）并重开。没有本机安装包时只打开下载页。
   */
  import { onMount } from 'svelte'
  import { Download, X } from '@lucide/svelte'
  import { platform } from '$lib/platform'
  import { updates } from '$lib/state/updates.svelte'
  import { notebook } from '$lib/state/notebook.svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { notesForLocale } from '$shared/update'

  const info = $derived(updates.info)
  const notes = $derived(info ? notesForLocale(info.notes, ui.prefs.locale) : '')
  let phase = $state<'idle' | 'downloading' | 'installing' | 'manual' | 'failed'>('idle')
  let received = $state(0)
  let total = $state(0)
  let error = $state('')

  // 正在下载或安装时不再查
  $effect(() => {
    updates.busy = phase !== 'idle'
  })
  const check = (): void => void updates.check()

  onMount(() => {
    platform.onUpdateProgress((p) => {
      received = p.received
      total = p.total
    })
    // 等界面先跑起来，别跟启动抢
    const timer = setTimeout(check, 4000)
    return () => clearTimeout(timer)
  })
  // 之后程序开着就按设置里的间隔一直查（默认 20 分钟）；改了间隔或开关立刻按新的来
  $effect(() => {
    if (!ui.prefs.checkUpdates) return
    const minutes = Math.min(1440, Math.max(1, Number(ui.prefs.updateCheckMinutes) || 20))
    const id = setInterval(check, minutes * 60_000)
    return () => clearInterval(id)
  })

  function later(): void {
    if (info) updates.dismissed = info.version
    updates.info = null
    phase = 'idle'
  }
  function skip(): void {
    if (info) void ui.setPrefs({ skippedVersion: info.version })
    updates.info = null
    phase = 'idle'
  }
  function openPage(): void {
    if (info) window.open(info.url)
    updates.info = null
    phase = 'idle'
  }
  async function install(): Promise<void> {
    if (!info?.installer) return openPage()
    // 真正开始下载（增量要先比对出要下多少）之前没有进度，显示「校验中」，进度条等第一次进度来了才出
    phase = 'downloading'
    received = 0
    total = 0
    const r = await platform.downloadUpdate(info.installer.url, info.installer.name, info.version)
    if (!r.ok || !r.path) {
      phase = 'failed'
      error = r.error ?? ''
      return
    }
    // 安装会关掉软件：先把还没存的生词本、课程进度存掉
    notebook.flush()
    courses.flush()
    phase = 'installing'
    const done = await platform.installUpdate(r.path)
    if (!done.ok) {
      phase = 'failed'
      error = done.error ?? ''
    } else if (done.manual) phase = 'manual'
  }
  const pct = $derived(total ? Math.min(100, Math.round((received / total) * 100)) : 0)
  /** 还没开始下（增量在比对）、或者下完了在核对：都显示「校验中」 */
  const verifying = $derived(phase === 'downloading' && (!total || received >= total))
  const mb = (n: number): string => (n / 1048576).toFixed(1)
</script>

{#if info}
  <div
    class="wrap card"
    role="dialog"
    aria-label={t('update.title', { version: info.version })}
    data-update-notice
  >
    <div class="head">
      <strong class="grow">{t('update.title', { version: info.version })}</strong>
      {#if phase === 'idle' || phase === 'failed' || phase === 'manual'}
        <button class="icon" title={t('update.later')} onclick={later}><X size={14} /></button>
      {/if}
    </div>
    {#if phase === 'downloading' && verifying}
      <p class="muted">{t('update.verifying')}</p>
    {:else if phase === 'downloading'}
      <p class="muted">{t('update.downloading', { pct, done: mb(received), total: mb(total) })}</p>
      <div class="bar"><div class="fill" style:width="{pct}%"></div></div>
    {:else if phase === 'installing'}
      <p class="muted">{t('update.installing')}</p>
    {:else if phase === 'manual'}
      <p>{t('update.manualNext')}</p>
    {:else}
      <p class="muted">
        {info.installer
          ? info.installer.auto === false
            ? t('update.bodyManual')
            : t('update.bodyAuto')
          : t('update.body')}
      </p>
      {#if phase === 'failed'}
        <p class="bad">{t('update.failed', { err: error })}</p>
      {/if}
      {#if notes}
        <pre class="notes">{notes}</pre>
      {/if}
      <div class="foot">
        <button class="btn primary" data-update-install onclick={install}
          ><Download size={14} />{info.installer
            ? t('update.install')
            : t('update.download')}</button
        >
        {#if info.installer}
          <button class="btn ghost" onclick={openPage}>{t('update.page')}</button>
        {/if}
        <button class="btn ghost" onclick={later}>{t('update.later')}</button>
        <span class="grow"></span>
        <button class="btn ghost" onclick={skip}>{t('update.skip')}</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .wrap {
    position: fixed;
    inset-inline-end: 16px;
    bottom: 16px;
    width: min(380px, 90vw);
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: var(--shadow-lg);
    z-index: 110;
    font-size: 13px;
    animation: rise 0.16s ease-out;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  .head,
  .foot {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .foot {
    flex-wrap: wrap;
  }
  .foot .btn {
    padding: 4px 10px;
    font-size: 13px;
  }
  .grow {
    flex: 1;
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
    background: var(--bg-hover);
  }
  .notes {
    max-height: 160px;
    overflow: auto;
    white-space: pre-wrap;
    margin: 0;
    padding: 8px 10px;
    background: var(--bg-sunken);
    border-radius: var(--radius-sm);
    font-family: inherit;
  }
  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--bg-sunken);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
  }
  .bad {
    color: var(--danger);
  }
</style>
