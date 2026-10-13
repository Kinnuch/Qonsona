<script lang="ts">
  import { onMount } from 'svelte'
  import { UserRound, LogOut, ShieldCheck, RefreshCw } from '@lucide/svelte'
  import { account } from '$lib/state/account.svelte'
  import { t, i18n } from '$lib/i18n/index.svelte'
  import { accountError } from './errors'
  let mode = $state<'login' | 'register'>('login')
  let username = $state(''),
    password = $state(''),
    nickname = $state('')
  let publicCollection = $state(false),
    publicTime = $state(false)
  let editingId = ''
  const user = $derived(account.session?.user)
  $effect(() => {
    if (!user) editingId = ''
    if (user?.id && user.id !== editingId) {
      editingId = user.id
      nickname = user.nickname
      publicCollection = user.publicCollection
      publicTime = user.publicTime
    }
  })
  onMount(() => {
    void account.ensure()
  })
  async function authenticate(event: SubmitEvent): Promise<void> {
    event.preventDefault()
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
          publicTime
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
        data-account-mode="login"
        onclick={() => (mode = 'login')}>{t('account.login')}</button
      ><button
        class="btn"
        class:on={mode === 'register'}
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
      <button class="btn primary" data-account-submit disabled={account.busy}
        >{account.busy ? t('common.loading') : t(`account.${mode}`)}</button
      >
    </form>
  {/if}
  {#if account.error}<p class="error" role="alert" data-account-error>
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
  .account-panel {
    max-width: 520px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    padding: 26px;
    border-radius: var(--radius);
    margin: 18px 0;
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
    margin: 20px 0;
  }
  form {
    display: grid;
    gap: 15px;
    margin: 20px 0;
  }
  label {
    display: grid;
    gap: 7px;
  }
  .privacy {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .input {
    width: 100%;
    min-width: 0;
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
