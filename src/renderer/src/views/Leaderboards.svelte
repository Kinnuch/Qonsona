<script lang="ts">
  import { onMount } from 'svelte'
  import { RefreshCw, Trophy, Users, Globe } from '@lucide/svelte'
  import { account } from '$lib/state/account.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { i18n, pick } from '$lib/i18n/index.svelte'
  import { platform } from '$lib/platform'
  import AccountPanel from '$lib/accounts/AccountPanel.svelte'
  import FriendsPanel from '$lib/accounts/FriendsPanel.svelte'
  import CompanionSprite from '$lib/accounts/CompanionSprite.svelte'
  import { accountError } from '$lib/accounts/errors'
  import type { Leaderboard } from '$shared/account'
  let kind = $state<'collection' | 'time'>('collection'),
    language = $state(''),
    scope = $state<'global' | 'friends'>('global')
  let tab = $state<'rankings' | 'friends'>('rankings')
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
    if (!user || !account.session?.server.online || tab !== 'rankings') return
    loading = true
    try {
      const data = await platform.account.request('leaderboards', {
        kind,
        scope,
        ...(kind === 'time' && language ? { language } : {}),
        limit: 50
      })
      if (generation === epoch && account.session?.user?.id === user.id) result = data
    } catch (e) {
      if (generation === epoch) error = String(e)
    } finally {
      if (generation === epoch) loading = false
    }
  }
  $effect(() => {
    const id = account.session?.user?.id,
      connected = account.session?.server.online
    const filter =
      kind +
      language +
      scope +
      tab +
      account.session?.user?.rankVisibility +
      account.session?.user?.publicTime +
      account.session?.user?.publicCollection
    if (id && connected && filter && tab === 'rankings') void load()
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
  async function visibility(rankVisibility: 'global' | 'friends'): Promise<void> {
    if (await account.mutate('updateProfile', { rankVisibility })) await load()
  }
</script>

<div class="page rankings" data-leaderboards>
  <header class="page-head">
    <div>
      <p class="eyebrow">QONSONA · COMMUNITY</p>
      <h1>{tr('同行者', 'Fellow learners')}</h1>
      <p class="subtitle">
        {tr(
          '与世界分享进步，也与朋友互相鼓励。',
          'Share your progress and encourage your friends.'
        )}
      </p>
    </div>
    <Trophy size={34} strokeWidth={1.2} />
  </header>
  {#if !account.session?.user}<AccountPanel />{:else}
    <div class="community-tabs" role="tablist" aria-label={tr('社区版面', 'Community pages')}>
      <button
        role="tab"
        aria-selected={tab === 'rankings'}
        class:active={tab === 'rankings'}
        data-community-tab="rankings"
        onclick={() => (tab = 'rankings')}
        ><Trophy size={15} />{tr('排行榜', 'Leaderboards')}</button
      >
      <button
        role="tab"
        aria-selected={tab === 'friends'}
        class:active={tab === 'friends'}
        data-community-tab="friends"
        onclick={() => (tab = 'friends')}><Users size={15} />{tr('好友', 'Friends')}</button
      >
    </div>
    {#if !account.session.server.online}<div class="offline" role="status">
        {tr(
          '离线：重新连接后查看最新榜单与好友。',
          'Offline: reconnect for current rankings and friends.'
        )}<button class="btn" onclick={() => account.reconnect()}
          >{tr('重新连接', 'Reconnect')}</button
        >
      </div>{/if}
    {#if tab === 'friends'}<FriendsPanel />{:else}
      <section class="board-controls">
        <div class="scope-picker" aria-label={tr('榜单范围', 'Leaderboard scope')}>
          <button
            class:active={scope === 'global'}
            data-ranking-scope="global"
            onclick={() => (scope = 'global')}><Globe size={14} />{tr('全球', 'Global')}</button
          >
          <button
            class:active={scope === 'friends'}
            data-ranking-scope="friends"
            onclick={() => (scope = 'friends')}><Users size={14} />{tr('好友', 'Friends')}</button
          >
        </div>
        <div class="filters">
          <button
            class:active={kind === 'collection'}
            data-ranking-kind="collection"
            onclick={() => (kind = 'collection')}>{tr('收藏榜', 'Collection')}</button
          >
          <button
            class:active={kind === 'time'}
            data-ranking-kind="time"
            onclick={() => (kind = 'time')}>{tr('学习时长榜', 'Learning time')}</button
          >
          {#if kind === 'time'}<label
              ><span class="sr-only">{tr('语言范围', 'Language scope')}</span><select
                data-ranking-language
                bind:value={language}
                ><option value="">{tr('所有语言', 'All languages')}</option
                >{#each packs.all as p (p.id)}<option
                    value={p.kind === 'builtin' ? p.id : `qonlang:${p.id}`}>{pick(p.name)}</option
                  >{/each}</select
              ></label
            >{/if}
          <button
            class="refresh"
            aria-label={tr('刷新榜单', 'Refresh leaderboard')}
            disabled={loading || !account.session?.server.online}
            onclick={load}><RefreshCw size={15} /></button
          >
        </div>
      </section>
      {#if error}<p role="alert">{accountError(error, i18n.locale)}</p>{/if}
      {#if loading}<p class="loading" role="status">
          {tr('正在读取榜单…', 'Loading rankings…')}
        </p>{:else if result}
        <div class="table-wrap">
          <table>
            <thead
              ><tr
                ><th>{tr('排名', 'Rank')}</th><th>{tr('同行者', 'Learner')}</th><th
                  >{tr('养成伙伴', 'Current companion')}</th
                ><th
                  >{kind === 'collection'
                    ? tr('馆藏种类', 'Unique collectibles')
                    : tr('学习时长', 'Learning time')}</th
                ></tr
              ></thead
            >
            <tbody
              >{#each result.rows as row (row.publicId)}<tr
                  data-ranking-row={row.publicId}
                  class:mine={row.publicId === account.session?.user?.publicId}
                  ><td
                    ><span class="rank" class:medal={row.rank <= 3}
                      >{String(row.rank).padStart(2, '0')}</span
                    ></td
                  ><td><strong>{row.nickname}</strong><small>{row.publicId}</small></td><td
                    >{#if row.currentCompanion}<span
                        class="rank-companion"
                        data-ranking-companion={row.currentCompanion.id}
                        ><CompanionSprite character={row.currentCompanion} width={46} /><span
                          >{pick(row.currentCompanion.name)}</span
                        ></span
                      >{:else}<span class="muted">{tr('尚未选择', 'Not selected')}</span>{/if}</td
                  ><td class="value"
                    >{kind === 'collection'
                      ? row.value
                      : `${Math.floor(row.value / 3600)}h ${Math.floor((row.value % 3600) / 60)}m`}</td
                  ></tr
                >{:else}<tr
                  ><td colspan="4" class="empty"
                    >{scope === 'friends'
                      ? tr(
                          '暂时没有好友记录。在好友页邀请朋友一起学习吧。',
                          'No friend records yet. Invite a friend to learn together.'
                        )
                      : tr('暂时没有公开记录。', 'No public records yet.')}</td
                  ></tr
                >{/each}</tbody
            >
          </table>
        </div>
      {/if}
      <p class="board-note">
        {tr(
          '榜单统计账号在线时记录的学习与馆藏；好友榜只包含你和已互相接受邀请的朋友。',
          'Rankings use account learning records and collections. The friends board includes you and mutually accepted friends.'
        )}
      </p>
      <section class="participation" data-ranking-participation>
        <div>
          <h3>{tr('我的排行设置', 'My ranking preferences')}</h3>
          <p>
            {tr(
              '可以只与朋友分享进度，也可以选择退出某个榜单。',
              'Share with friends only, or turn off an individual leaderboard.'
            )}
          </p>
        </div>
        <label
          >{tr('参与范围', 'Participation')}<select
            data-ranking-visibility
            value={account.session.user.rankVisibility ?? 'global'}
            disabled={account.busy || !account.session.server.online}
            onchange={(e) => visibility(e.currentTarget.value as 'global' | 'friends')}
            ><option value="global">{tr('全球与好友', 'Global and friends')}</option><option
              value="friends">{tr('仅好友', 'Friends only')}</option
            ></select
          ></label
        >
        <label class="check"
          ><input
            type="checkbox"
            data-ranking-collection-enabled
            checked={account.session.user.publicCollection}
            disabled={account.busy || !account.session.server.online}
            onchange={(e) =>
              account.mutate('updateProfile', { publicCollection: e.currentTarget.checked })}
          />{tr('收藏榜', 'Collection')}</label
        >
        <label class="check"
          ><input
            type="checkbox"
            data-ranking-time-enabled
            checked={account.session.user.publicTime}
            disabled={account.busy || !account.session.server.online}
            onchange={(e) =>
              account.mutate('updateProfile', { publicTime: e.currentTarget.checked })}
          />{tr('学习时长榜', 'Learning time')}</label
        >
      </section>
      {#if account.error}<p role="alert">{accountError(account.error, i18n.locale)}</p>{/if}
    {/if}
  {/if}
</div>

<style>
  .rankings {
    max-width: 1180px;
  }
  .page-head {
    align-items: center;
  }
  .page-head > :global(svg) {
    color: #b69753;
  }
  .eyebrow {
    font-size: 10px;
    letter-spacing: 0.17em;
    color: var(--text-3);
  }
  .subtitle {
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-3);
    margin-top: 9px;
  }
  .community-tabs {
    display: flex;
    gap: 8px;
    padding-bottom: 17px;
    margin: 25px 0;
    border-bottom: 1px solid var(--border);
  }
  .community-tabs button {
    display: flex;
    align-items: center;
    gap: 7px;
    border: 1px solid transparent;
    border-radius: 12px;
    padding: 10px 17px;
    background: transparent;
    color: var(--text-2);
    cursor: pointer;
  }
  .community-tabs .active {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .board-controls {
    display: flex;
    gap: 20px;
    justify-content: space-between;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }
  .scope-picker,
  .filters {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }
  .scope-picker {
    background: var(--bg-sunken);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 4px;
  }
  .scope-picker button,
  .filters button {
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid transparent;
    border-radius: 9px;
    padding: 8px 12px;
    background: transparent;
    color: var(--text-2);
    font-size: 12px;
    cursor: pointer;
  }
  .scope-picker .active {
    background: var(--bg-elev);
    color: var(--text);
    box-shadow: 0 2px 8px #00000008;
  }
  .filters .active {
    border-color: var(--border-strong);
    background: var(--bg-elev);
    color: var(--accent-text);
  }
  select {
    border: 1px solid var(--border);
    background: var(--bg-elev);
    color: var(--text);
    border-radius: 9px;
    padding: 8px 10px;
    font: inherit;
    font-size: 12px;
  }
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 19px;
    background: var(--bg-elev);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    text-align: start;
  }
  th,
  td {
    padding: 17px;
    border-bottom: 1px solid var(--border);
  }
  th {
    font-size: 10px;
    letter-spacing: 0.05em;
    color: var(--text-3);
    white-space: nowrap;
    font-weight: 500;
    background: var(--bg-sunken);
  }
  td {
    font-size: 12px;
  }
  tr:last-child td {
    border-bottom: 0;
  }
  .mine {
    background: var(--accent-soft);
  }
  .rank {
    font-family: var(--font-data);
    color: var(--text-3);
  }
  .medal {
    color: #b58b31;
  }
  small {
    display: block;
    color: var(--text-3);
    font-size: 9px;
    margin-top: 5px;
    overflow-wrap: anywhere;
  }
  .rank-companion {
    display: flex;
    gap: 9px;
    align-items: center;
    font-size: 11px;
    min-width: 130px;
  }
  .value {
    font-family: var(--font-data);
    white-space: nowrap;
  }
  .muted,
  .board-note {
    color: var(--text-3);
  }
  .board-note {
    font-size: 10px;
    line-height: 1.8;
    margin: 15px 2px 25px;
  }
  .participation {
    display: flex;
    flex-wrap: wrap;
    gap: 17px;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 20px;
  }
  .participation > div {
    flex: 1;
    min-width: 180px;
  }
  .participation h3 {
    font-size: 13px;
    margin: 0 0 6px;
  }
  .participation p {
    font-size: 10px;
    line-height: 1.6;
    color: var(--text-3);
    margin: 0;
  }
  .participation label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
  }
  .offline {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 20px;
    color: var(--text-3);
    font-size: 12px;
  }
  .empty {
    color: var(--text-3);
    padding: 32px;
    text-align: center;
    line-height: 1.8;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (max-width: 650px) {
    th,
    td {
      padding: 11px;
    }
    .board-controls {
      gap: 12px;
    }
  }
</style>
