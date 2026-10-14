<script lang="ts">
  import { onMount } from 'svelte'
  import { UserRound, LogOut, ShieldCheck, RefreshCw, Download } from '@lucide/svelte'
  import { account } from '$lib/state/account.svelte'
  import { t, i18n } from '$lib/i18n/index.svelte'
  import { accountError } from './errors'
  import { updates } from '$lib/state/updates.svelte'
  let mode = $state<'login' | 'register'>('login')
  let username = $state(''),
    password = $state(''),
    nickname = $state('')
  let publicCollection = $state(true),
    publicTime = $state(true)
  let rankVisibility = $state<'global' | 'friends'>('global')
  let editingId = ''
  const user = $derived(account.session?.user)
  const version = $derived(account.session?.version)
  const canAuthenticate = $derived(
    version?.status === 'current' && !!account.session?.server.online && !account.loading
  )
  $effect(() => {
    if (!user) editingId = ''
    if (user?.id && user.id !== editingId) {
      editingId = user.id
      nickname = user.nickname
      publicCollection = user.publicCollection
      publicTime = user.publicTime
      rankVisibility = user.rankVisibility ?? 'global'
    }
  })
  onMount(() => {
    void account.ensure()
  })
  async function authenticate(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (!canAuthenticate) return
    try {
      await account.authenticate(mode, {
        username: username.trim(),
        password,
        ...(mode === 'register' ? { nickname: nickname.trim() || username.trim() } : {})
      })
    } finally {
      password = ''
    }
  }
</script>

<section class="account-panel" data-account-panel>
  <div
    class="version-status"
    class:blocked={version?.status !== 'current'}
    data-account-version-status={account.loading ? 'checking' : (version?.status ?? 'unavailable')}
    aria-live="polite"
  >
    {#if account.loading}
      <strong>{t('account.versionChecking')}</strong>
    {:else if version?.status === 'current'}
      <span
        ><ShieldCheck size={14} />{t('account.versionCurrent', {
          v: version.installedVersion
        })}</span
      >
    {:else}
      <strong
        >{t(
          version?.status === 'update-required'
            ? 'account.versionRequired'
            : 'account.versionUnavailable'
        )}</strong
      >
      <p>
        {version?.latestVersion && version.installedVersion
          ? t('account.versionHelp', {
              installed: version.installedVersion,
              latest: version.latestVersion
            })
          : t('account.versionUnknownHelp')}
      </p>
      <div class="version-actions">
        <button
          class="btn"
          data-account-check-update
          disabled={updates.checking}
          onclick={() => updates.check(true)}
          ><RefreshCw size={14} />{t('settings.checkNow')}</button
        >
        <a
          class="btn"
          data-account-download-update
          href="https://github.com/Kinnuch/Qonsona/releases/latest"
          target="_blank"
          rel="noreferrer"><Download size={14} />{t('account.downloadLatest')}</a
        >
      </div>
    {/if}
  </div>
  {#if user}
    <header>
      <UserRound size={20} />
      <div>
        <h2>{user.nickname}</h2>
        <span class="muted">{t('account.publicId', { id: user.publicId })}</span>
      </div>
      <button
        class="btn ghost"
        data-account-logout
        disabled={account.busy}
        onclick={() => account.logout()}><LogOut size={15} />{t('account.logout')}</button
      >
    </header>
    <p class="status" class:offline={!account.session?.server.online}>
      <ShieldCheck size={15} />{account.session?.server.online
        ? t('account.connected')
        : t('account.offline')}
    </p>
    <form
      onsubmit={(event) => {
        event.preventDefault()
        void account.mutate('updateProfile', {
          nickname: nickname.trim(),
          publicCollection,
          publicTime,
          rankVisibility
        })
      }}
    >
      <label
        >{t('account.nickname')}<input
          class="input"
          data-account-nickname
          bind:value={nickname}
          required
          minlength="1"
          maxlength="40"
          autocomplete="nickname"
        /></label
      >
      <label class="privacy"
        ><input type="checkbox" data-account-public-collection bind:checked={publicCollection} />{t(
          'account.publicCollection'
        )}</label
      >
      <label
        >{i18n.locale === 'zh' ? '参加的排行榜' : 'Leaderboard participation'}
        <select class="input" data-account-rank-visibility bind:value={rankVisibility}>
          <option value="global"
            >{i18n.locale === 'zh' ? '全球及好友榜' : 'Global and friends'}</option
          >
          <option value="friends">{i18n.locale === 'zh' ? '仅好友榜' : 'Friends only'}</option>
        </select>
      </label>
      <label class="privacy"
        ><input type="checkbox" data-account-public-time bind:checked={publicTime} />{t(
          'account.publicTime'
        )}</label
      >
      <p class="muted">{t('account.privacyHelp')}</p>
      <button
        class="btn primary"
        data-account-profile-save
        disabled={account.busy || !account.session?.server.online}>{t('account.save')}</button
      >
    </form>
  {:else}
    <header>
      <UserRound size={22} />
      <div>
        <h2>{t('account.title')}</h2>
        <p class="muted">{t('account.shared')}</p>
      </div>
    </header>
    <div class="seg" role="group" aria-label={t('account.authMode')}>
      <button
        class="btn"
        class:on={mode === 'login'}
        aria-pressed={mode === 'login'}
        data-account-mode="login"
        onclick={() => (mode = 'login')}>{t('account.login')}</button
      ><button
        class="btn"
        class:on={mode === 'register'}
        aria-pressed={mode === 'register'}
        data-account-mode="register"
        onclick={() => (mode = 'register')}>{t('account.register')}</button
      >
    </div>
    <form onsubmit={authenticate}>
      <label
        >{t('account.username')}<input
          class="input"
          data-account-username
          bind:value={username}
          autocomplete="username"
          required
          pattern={'[A-Za-z0-9_]{3,32}'}
          minlength="3"
          maxlength="32"
          autocapitalize="none"
          spellcheck="false"
        /></label
      >
      {#if mode === 'register'}<label
          >{t('account.nickname')}<input
            class="input"
            data-account-register-nickname
            bind:value={nickname}
            autocomplete="nickname"
            maxlength="40"
          /></label
        >{/if}
      <label
        >{t('account.password')}<input
          class="input"
          type="password"
          data-account-password
          bind:value={password}
          autocomplete={mode === 'register' ? 'new-password' : 'current-password'}
          required
          minlength="10"
          maxlength="128"
        /></label
      >
      <p class="muted">{t('account.credentialsHelp')}</p>
      <button class="btn primary" data-account-submit disabled={account.busy || !canAuthenticate}
        >{account.busy ? t('common.loading') : t(`account.${mode}`)}</button
      >
    </form>
  {/if}
  {#if account.error && !/CLIENT_UPDATE_REQUIRED|CLIENT_POLICY_UNAVAILABLE/.test(account.error)}<p
      class="error"
      role="alert"
      data-account-error
    >
      {accountError(account.error, i18n.locale)}
    </p>{/if}
  <button
    class="btn ghost"
    data-account-reconnect
    disabled={account.loading || account.busy}
    onclick={() => account.reconnect()}><RefreshCw size={14} />{t('account.reconnect')}</button
  >
</section>

<style>
  .version-status {
    margin-bottom: 22px;
    color: var(--text-2);
    font-size: 13px;
    line-height: 1.65;
  }
  .version-status > span {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .version-status.blocked {
    padding: 15px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-sunken);
  }
  .version-status p {
    margin: 6px 0 12px;
  }
  .version-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
  }
  .version-actions a {
    text-decoration: none;
  }
  .account-panel {
    max-width: 520px;
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--accent) 4%, var(--bg-elev)),
      var(--bg-elev) 70%
    );
    border: 1px solid var(--border);
    padding: 32px;
    border-radius: 20px;
    margin: 18px 0;
  }
  header > :global(svg) {
    width: 40px;
    height: 40px;
    padding: 9px;
    border: 1px solid var(--border);
    border-radius: 13px;
    color: var(--accent-text);
    background: var(--bg-elev);
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  header > div {
    flex: 1;
    min-width: 130px;
  }
  h2 {
    font-size: 20px;
    margin: 0;
  }
  header p {
    margin: 5px 0;
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 26px 0 24px;
    padding: 5px;
    background: var(--bg-sunken);
    border: 1px solid var(--border);
    border-radius: 14px;
  }
  .seg .btn {
    width: 100%;
    min-height: 43px;
    justify-self: stretch;
    border-color: transparent;
    background: transparent;
    color: var(--text-2);
  }
  .seg .btn.on {
    background: var(--bg-elev);
    color: var(--accent-text);
    border-color: var(--border);
    box-shadow: var(--shadow);
  }
  .seg .btn:hover {
    background: var(--bg-elev);
  }
  form {
    display: grid;
    gap: 19px;
    margin: 22px 0;
  }
  label {
    display: grid;
    gap: 9px;
    font-size: 13px;
    color: var(--text-2);
    font-weight: 500;
  }
  .privacy {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 13px;
    background: var(--bg-sunken);
    border-radius: 10px;
    font-weight: 400;
  }
  .privacy input {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
  }
  .input {
    width: 100%;
    min-width: 0;
    padding: 12px 14px;
    border-radius: 10px;
    min-height: 44px;
  }
  .muted {
    font-size: 13px;
    line-height: 1.65;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--accent);
  }
  .offline {
    color: var(--text-2);
  }
  .error {
    color: var(--danger);
    overflow-wrap: anywhere;
  }
  .btn {
    justify-self: start;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    border-radius: 10px;
    padding: 11px 17px;
    font-size: 13px;
    min-height: 40px;
  }
  form [data-account-submit] {
    width: 100%;
    min-height: 46px;
  }
  form .btn {
    margin-top: 5px;
  }
  @media (max-width: 600px) {
    .account-panel {
      padding: 20px;
    }
  }
</style>
