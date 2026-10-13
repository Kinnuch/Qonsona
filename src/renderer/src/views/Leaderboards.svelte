<script lang="ts">
  import { onMount } from 'svelte'
  import { account } from '$lib/state/account.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { i18n, pick } from '$lib/i18n/index.svelte'
  import { platform } from '$lib/platform'
  import AccountPanel from '$lib/accounts/AccountPanel.svelte'
  import { accountError } from '$lib/accounts/errors'
  import type { Leaderboard } from '$shared/account'
  let kind = $state<'collection' | 'time'>('collection'),
    language = $state('')
  let result = $state.raw<Leaderboard | null>(null),
    loading = $state(false),
    error = $state('')
  let epoch = 0
  const tr = (zh: string, en: string): string => (i18n.locale === 'zh' ? zh : en)
  async function load(): Promise<void> {
    const generation = ++epoch,
      user = account.session?.user
    result = null
    error = ''
    if (!user || !account.session?.server.online) return
    loading = true
    try {
      const data = await platform.account.request('leaderboards', {
        kind,
        ...(kind === 'time' && language ? { language } : {}),
        limit: 20
      })
      if (generation === epoch && account.session?.user?.id === user.id) result = data
    } catch (e) {
      if (generation === epoch) error = String(e)
    } finally {
      if (generation === epoch) loading = false
    }
  }
  $effect(() => {
    const id = account.session?.user?.id
    const connected = account.session?.server.online
    const filter = kind + language
    if (id && connected && filter) void load()
    else {
      epoch++
      result = null
      loading = false
    }
  })
  onMount(() => {
    void account.ensure()
    return () => {
      epoch++
    }
  })
</script>

<div class="page rankings" data-leaderboards>
  <header class="page-head">
    <div>
      <p class="eyebrow">QONSONA · COMMUNITY</p>
      <h1>{tr('排行榜', 'Leaderboards')}</h1>
    </div>
    <button class="btn" disabled={loading || !account.session?.server.online} onclick={load}
      >{tr('刷新', 'Refresh')}</button
    >
  </header>
  {#if !account.session?.user}<AccountPanel />{:else}<p class="muted">
      {tr(
        '仅收录主动公开的账号；只展示昵称、公开编号及收藏或学习统计，不排行付费金额。',
        'Only accounts that opt in are listed. Rankings show nickname, public ID and collection or learning statistics, never spending.'
      )}
    </p>
    <div class="filters">
      <button
        class="btn"
        class:on={kind === 'collection'}
        data-ranking-kind="collection"
        onclick={() => (kind = 'collection')}>{tr('收藏总榜', 'Collection total')}</button
      ><button
        class="btn"
        class:on={kind === 'time'}
        data-ranking-kind="time"
        onclick={() => (kind = 'time')}>{tr('学习时长', 'Learning time')}</button
      >{#if kind === 'time'}<label
          >{tr('语言范围', 'Language scope')}<select
            class="input"
            data-ranking-language
            bind:value={language}
            ><option value="">{tr('所有语言合计', 'All languages combined')}</option
            >{#each packs.all as p (p.id)}<option
                value={p.kind === 'builtin' ? p.id : `qonlang:${p.id}`}>{pick(p.name)}</option
              >{/each}</select
          ></label
        >{/if}
    </div>
    {#if !account.session.server.online}<p role="status">
        {tr('离线：请重新连接后查看最新榜单。', 'Offline: reconnect for current rankings.')}
      </p>
      <button class="btn" onclick={() => account.reconnect()}>{tr('重新连接', 'Reconnect')}</button
      >{/if}{#if error}<p role="alert">{accountError(error, i18n.locale)}</p>{/if}
    {#if loading}<p role="status">
        {tr('正在读取榜单…', 'Loading rankings…')}
      </p>{:else if result}<div class="table-wrap">
        <table>
          <thead
            ><tr
              ><th>{tr('排名', 'Rank')}</th><th>{tr('昵称 / 公开编号', 'Nickname / public ID')}</th
              ><th
                >{kind === 'collection'
                  ? tr('馆藏种类', 'Unique collectibles')
                  : tr('学习时长', 'Learning time')}</th
              ></tr
            ></thead
          ><tbody
            >{#each result.rows as row (row.publicId)}<tr data-ranking-row
                ><td>{row.rank}</td><td
                  ><strong>{row.nickname}</strong><small>{row.publicId}</small></td
                ><td
                  >{kind === 'collection'
                    ? row.value
                    : `${Math.floor(row.value / 3600)}h ${Math.floor((row.value % 3600) / 60)}m`}</td
                ></tr
              >{:else}<tr
                ><td colspan="3">{tr('暂时没有公开记录。', 'No public records yet.')}</td></tr
              >{/each}</tbody
          >
        </table>
      </div>{/if}
    <details class="privacy">
      <summary>{tr('我的账号与公开设置', 'My account and privacy settings')}</summary><AccountPanel
      />
    </details>{/if}
</div>

<style>
  .rankings {
    max-width: 1040px;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.12em;
    color: var(--accent);
  }
  .filters {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
    margin: 25px 0;
  }
  .filters label {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .on {
    color: var(--accent);
    border-color: var(--accent);
  }
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 15px;
    background: var(--bg-elev);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    text-align: start;
  }
  th,
  td {
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }
  th {
    font-size: 12px;
    color: var(--text-3);
    white-space: nowrap;
  }
  td:first-child {
    font-family: var(--font-data);
  }
  small {
    display: block;
    color: var(--text-3);
    margin-top: 5px;
    overflow-wrap: anywhere;
  }
  .privacy {
    margin: 25px 0;
  }
  summary {
    cursor: pointer;
  }
  .muted {
    line-height: 1.8;
  }
  @media (max-width: 500px) {
    th,
    td {
      padding: 11px;
    }
  }
</style>
