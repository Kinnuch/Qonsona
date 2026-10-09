<script lang="ts">
  import { onMount } from 'svelte'
  import { FolderOpen, Volume2, Download, Upload } from '@lucide/svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { audio } from '$lib/state/audio.svelte'
  import { t, LOCALES, i18n, type LocaleCode } from '$lib/i18n/index.svelte'
  import { platform, type AppInfo, type Prefs } from '$lib/platform'
  import ENGINE from '$qon/VERSION.json'
  import type { DictSource } from '$shared/dict'
  import { updates } from '$lib/state/updates.svelte'
  import { flushAll } from '$lib/state/persist'

  let info = $state<AppInfo | null>(null)
  let sources = $state<DictSource[]>([])
  onMount(async () => {
    info = await platform.info()
    sources = await platform.ja.sources()
  })

  const THEMES: Prefs['theme'][] = ['system', 'light', 'dark']
  /** 试听用的一小段 IPA：常见辅音元音都有 */
  const TEST_IPA = 'ˈsala ˈmiron ˌtekʊ'
  // 自动时实际会用哪个声音（设置里挑的声音被删掉时也走这里）
  const autoVoice = $derived(
    (audio.voices.find((v) => v.culture.startsWith('en')) ?? audio.voices[0])?.name.replace(
      /^Microsoft /,
      ''
    ) ?? ''
  )
  // 「立即检查更新」：点过之后才在按钮旁边写结果（后台自动检查的结果不写，免得一打开设置就冒出一句）
  let checkedNow = $state(false)
  async function checkNow(): Promise<void> {
    checkedNow = true
    await updates.check(true)
  }
  const updateResult = $derived.by(() => {
    if (updates.checking) return t('settings.updateChecking')
    const r = updates.last
    if (!checkedNow || !r) return ''
    if (r.status === 'latest') return t('settings.updateLatest', { v: r.latest ?? '' })
    if (r.status === 'newer') return t('settings.updateNewer', { v: r.latest ?? '' })
    return t(`settings.updateFailed.${r.error ?? 'offline'}`)
  })

  // ── 备份 ──
  let backupBusy = $state(false)
  let backupResult = $state('')

  async function exportBackup(): Promise<void> {
    backupBusy = true
    try {
      // 先把还没存盘的改动存掉，稍等它们写完
      flushAll()
      await new Promise((r) => setTimeout(r, 300))
      const r = await platform.backup.export()
      if (r)
        backupResult = t('settings.backup.exported', {
          n: r.files,
          size: (r.bytes / 1048576).toFixed(1),
          path: r.path
        })
    } catch (e) {
      ui.toast(String(e), 'error', 8000)
    } finally {
      backupBusy = false
    }
  }

  async function restoreBackup(): Promise<void> {
    const r = await platform.backup.pick().catch(() => null)
    if (!r) return
    if (!r.ok) {
      ui.toast(t(`settings.backup.bad.${r.reason}`), 'error', 8000)
      return
    }
    const date = new Date(r.createdAt).toLocaleString(i18n.locale === 'zh' ? 'zh-CN' : 'en')
    const ok = await ui.confirm(
      t('settings.backup.restoreTitle'),
      t('settings.backup.restoreBody', { date, n: r.files }),
      t('settings.backup.restoreOk'),
      true
    )
    if (ok) await platform.backup.restore(r.path)
  }

  const engineDate = $derived(
    new Date(ENGINE.commitDate).toLocaleDateString(i18n.locale === 'zh' ? 'zh-CN' : 'en')
  )
</script>

<div class="page">
  <header class="page-head"><h1>{t('settings.title')}</h1></header>

  <section class="card group">
    <h3>{t('settings.interface')}</h3>
    <label class="row">
      <span>{t('settings.locale')}</span>
      <select
        data-setting="locale"
        value={ui.prefs.locale}
        onchange={(e) => ui.setPrefs({ locale: e.currentTarget.value as LocaleCode })}
      >
        {#each LOCALES as l (l.code)}<option value={l.code}>{l.label}</option>{/each}
      </select>
    </label>
    <div class="row">
      <span>{t('settings.theme')}</span>
      <div class="seg" role="radiogroup" aria-label={t('settings.theme')}>
        {#each THEMES as th (th)}
          <button
            role="radio"
            aria-checked={ui.prefs.theme === th}
            class:on={ui.prefs.theme === th}
            data-theme-option={th}
            onclick={() => ui.setPrefs({ theme: th })}
          >
            {t('settings.themes.' + th)}
          </button>
        {/each}
      </div>
    </div>
  </section>

  <section class="card group">
    <h3>{t('settings.speech')}</h3>
    <label class="row">
      <span>{t('settings.ipaVoice')}</span>
      {#if audio.voices.length}
        <select
          data-setting="ipaVoice"
          value={ui.prefs.ipaVoice}
          onchange={(e) => ui.setPrefs({ ipaVoice: e.currentTarget.value })}
        >
          <option value="">{t('settings.auto', { name: autoVoice })}</option>
          {#each audio.voices as v (v.name)}
            <option value={v.name}>{v.name.replace(/^Microsoft /, '')} · {v.culture}</option>
          {/each}
        </select>
        <button class="btn" data-test-voice onclick={() => audio.say({ ipa: TEST_IPA })}>
          <Volume2 size={16} />{t('settings.test')}
        </button>
      {:else}
        <span class="muted">
          {audio.voicesLoaded ? t('settings.noVoice') : t('common.loading')}
        </span>
      {/if}
    </label>
    <label class="row">
      <span>{t('settings.rate')}</span>
      <input
        type="range"
        min="-5"
        max="5"
        step="1"
        value={ui.prefs.speechRate}
        onchange={(e) => ui.setPrefs({ speechRate: Number(e.currentTarget.value) })}
      />
      <span class="faint">{ui.prefs.speechRate > 0 ? '+' : ''}{ui.prefs.speechRate}</span>
    </label>
    <p class="faint">{t('settings.speechHelp')}</p>
  </section>

  <section class="card group">
    <h3>{t('settings.review')}</h3>
    <label class="row">
      <span>{t('settings.newPerDay')}</span>
      <input
        class="num"
        type="number"
        min="0"
        max="200"
        data-setting="newPerDay"
        value={ui.prefs.newPerDay}
        onchange={(e) =>
          ui.setPrefs({
            newPerDay: Math.max(0, Math.min(200, Number(e.currentTarget.value) || 0))
          })}
      />
    </label>
    <label class="row">
      <span>{t('settings.reviewCap')}</span>
      <input
        class="num"
        type="number"
        min="10"
        max="999"
        data-setting="reviewCap"
        value={ui.prefs.reviewCap}
        onchange={(e) =>
          ui.setPrefs({
            reviewCap: Math.max(10, Math.min(999, Number(e.currentTarget.value) || 10))
          })}
      />
    </label>
    <label class="row">
      <span>{t('settings.studyOrder')}</span>
      <select
        data-setting="studyOrder"
        value={ui.prefs.studyOrder}
        onchange={(e) => ui.setPrefs({ studyOrder: e.currentTarget.value as Prefs['studyOrder'] })}
      >
        <option value="seq">{t('settings.orders.seq')}</option>
        <option value="random">{t('settings.orders.random')}</option>
      </select>
    </label>
    <label class="row">
      <input
        type="checkbox"
        data-setting="relearn"
        checked={ui.prefs.relearn}
        onchange={(e) => ui.setPrefs({ relearn: e.currentTarget.checked })}
      />
      <span>{t('settings.relearn')}</span>
    </label>
    <p class="faint">{t('settings.reviewHelp')}</p>
  </section>

  <section class="card group">
    <h3>{t('settings.reading')}</h3>
    <label class="row">
      <input
        type="checkbox"
        data-setting="nhkEasy"
        checked={ui.prefs.nhkEasy}
        onchange={(e) => ui.setPrefs({ nhkEasy: e.currentTarget.checked })}
      />
      <span>{t('settings.nhkEasy')}</span>
    </label>
    <p class="faint">{t('settings.nhkEasyHelp')}</p>
  </section>

  <section class="card group">
    <h3>{t('settings.data')}</h3>
    <div class="row">
      <span>{t('settings.dataDir')}</span>
      <code class="path">{info?.userData ?? ''}</code>
      <button class="btn" onclick={() => platform.openDataDir()}>
        <FolderOpen size={16} />{t('settings.openDataDir')}
      </button>
    </div>
    <div class="row">
      <span>{t('settings.backup.title')}</span>
      <button class="btn" data-backup-export disabled={backupBusy} onclick={exportBackup}
        ><Download size={16} />{t('settings.backup.export')}</button
      >
      <button class="btn" data-backup-restore disabled={backupBusy} onclick={restoreBackup}
        ><Upload size={16} />{t('settings.backup.restore')}</button
      >
    </div>
    {#if backupResult}<p class="muted path-note" data-backup-result>{backupResult}</p>{/if}
    <p class="faint">{t('settings.backup.help')}</p>
  </section>

  <section class="card group">
    <h3>{t('settings.about')}</h3>
    <p>
      <strong>{t('app.name')}</strong> · {t('settings.version', { v: info?.version ?? '' })}
    </p>
    <p class="muted">{t('app.tagline')}</p>
    <p class="muted" data-latest-version>
      {updates.last?.latest
        ? t('settings.latestVersion', { v: updates.last.latest })
        : t('settings.latestUnknown')}
    </p>
    <div class="row">
      <button class="btn" data-check-update disabled={updates.checking} onclick={checkNow}
        >{t('settings.checkNow')}</button
      >
      <span class="muted" data-update-result>{updateResult}</span>
    </div>
    <label class="row">
      <input
        type="checkbox"
        data-setting="checkUpdates"
        checked={ui.prefs.checkUpdates}
        onchange={(e) => ui.setPrefs({ checkUpdates: e.currentTarget.checked })}
      />
      <span>{t('settings.checkUpdates')}</span>
    </label>
    <label class="row">
      <span>{t('settings.updateCheckMinutes')}</span>
      <input
        class="num"
        type="number"
        min="1"
        max="1440"
        data-setting="updateCheckMinutes"
        value={ui.prefs.updateCheckMinutes}
        disabled={!ui.prefs.checkUpdates}
        onchange={(e) =>
          ui.setPrefs({
            updateCheckMinutes: Math.max(1, Math.min(1440, Number(e.currentTarget.value) || 20))
          })}
      />
    </label>
    <p class="faint">
      {t('settings.engine', {
        v: `${ENGINE.qonlangVersion} (${ENGINE.commit.slice(0, 7)})`,
        date: engineDate
      })}
    </p>
  </section>

  {#if sources.length}
    <section class="card group" data-sources>
      <h3>{t('settings.sources')}</h3>
      <p class="faint">{t('settings.sourcesNote')}</p>
      <ul class="sources">
        {#each sources as s (s.name)}
          <li>
            <a href={s.home} target="_blank" rel="noreferrer">{s.name}</a>
            <span class="chip">{s.license}</span>
            <span class="faint">{s.credit}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .row > span:first-child {
    min-width: 96px;
  }
  .path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-2);
  }
  .path-note {
    word-break: break-all;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .seg button {
    padding: 4px 12px;
    border: none;
    background: var(--bg-elev);
    cursor: pointer;
  }
  .seg button + button {
    border-inline-start: 1px solid var(--border-strong);
  }
  .sources {
    margin: 0;
    padding-inline-start: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sources a {
    color: var(--accent-text);
    margin-inline-end: 6px;
  }
  .seg button.on {
    background: var(--accent);
    color: var(--accent-contrast);
  }
</style>
