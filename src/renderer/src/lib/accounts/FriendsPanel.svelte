<script lang="ts">
  import { onMount } from 'svelte'
  import { Check, RefreshCw, Send, UserPlus, X } from '@lucide/svelte'
  import { account } from '$lib/state/account.svelte'
  import { platform } from '$lib/platform'
  import { ui } from '$lib/state/ui.svelte'
  import { i18n, pick } from '$lib/i18n/index.svelte'
  import { accountError } from './errors'
  import CompanionSprite from './CompanionSprite.svelte'
  import type { AccountFriends, AccountPayloads } from '$shared/account'
  let data = $state.raw<AccountFriends | null>(null),
    publicId = $state(''),
    loading = $state(false),
    error = $state('')
  let epoch = 0
  const tr = (zh: string, en: string): string => (i18n.locale === 'zh' ? zh : en)
  async function load(): Promise<void> {
    const id = account.session?.user?.id,
      generation = ++epoch
    if (!id || !account.session?.server.online) return
    loading = true
    error = ''
    try {
      const response = await platform.account.request('friends', {})
      if (generation === epoch && account.session?.user?.id === id) data = response
    } catch (e) {
      if (generation === epoch) error = String(e)
    } finally {
      if (generation === epoch) loading = false
    }
  }
  async function change<A extends 'requestFriend' | 'respondFriend' | 'removeFriend'>(
    action: A,
    payload: AccountPayloads[A]
  ): Promise<void> {
    const id = account.session?.user?.id
    if (!(await account.mutate(action, payload)) || account.session?.user?.id !== id) return
    publicId = ''
    await load()
  }
  async function remove(id: string, nickname: string): Promise<void> {
    if (
      !(await ui.confirm(
        tr(`移除好友「${nickname}」？`, `Remove ${nickname} from your friends?`),
        tr(
          '双方将不再出现在彼此的好友榜。',
          'You will no longer appear in each other’s friends leaderboard.'
        ),
        tr('移除好友', 'Remove friend')
      ))
    )
      return
    await change('removeFriend', { requestId: crypto.randomUUID(), publicId: id })
  }
  $effect(() => {
    const id = account.session?.user?.id,
      online = account.session?.server.online
    if (id && online) void load()
    else {
      epoch++
      data = null
      loading = false
    }
  })
  onMount(() => () => {
    epoch++
  })
</script>

<section class="friends-panel" data-friends-panel>
  <header>
    <div>
      <span class="eyebrow">QONSONA · FRIENDS</span>
      <h2>{tr('与朋友同行', 'Learn together')}</h2>
    </div>
    <button
      class="icon-btn"
      disabled={loading || !account.session?.server.online}
      onclick={load}
      aria-label={tr('刷新好友', 'Refresh friends')}><RefreshCw size={15} /></button
    >
  </header>
  <p class="own-id">
    {tr('我的公开编号', 'My public ID')}<strong data-friend-own-id
      >{account.session?.user?.publicId}</strong
    >
  </p>
  <form
    onsubmit={(e) => {
      e.preventDefault()
      if (publicId.trim())
        void change('requestFriend', { requestId: crypto.randomUUID(), publicId: publicId.trim() })
    }}
  >
    <label class="sr-only" for="friend-id">{tr('好友公开编号', 'Friend public ID')}</label>
    <input
      id="friend-id"
      class="input"
      data-friend-input
      bind:value={publicId}
      placeholder={tr('输入朋友的公开编号', 'Enter a friend’s public ID')}
      autocomplete="off"
      maxlength="64"
    />
    <button
      class="btn primary"
      data-friend-send
      disabled={account.busy || !account.session?.server.online || !publicId.trim()}
      ><UserPlus size={15} />{tr('添加好友', 'Add friend')}</button
    >
  </form>
  <p class="hint">
    {tr(
      '朋友接受邀请后，才能在好友榜中看到对方。好友只会看到昵称、公开编号和你参与的榜单。',
      'Friends appear together after an invitation is accepted. They see your nickname, public ID and enabled rankings.'
    )}
  </p>
  {#if error}<p class="error" role="alert">{accountError(error, i18n.locale)}</p>{/if}
  {#if account.error}<p class="error" role="alert">
      {accountError(account.error, i18n.locale)}
    </p>{/if}
  {#if data}
    {#if data.incoming.length}<div class="invitations">
        <h3>{tr('收到的邀请', 'Received invitations')}</h3>
        {#each data.incoming as invitation (invitation.id)}<div
            class="person"
            data-friend-incoming={invitation.id}
          >
            <div class="person-name">
              <strong>{invitation.profile.nickname}</strong><small
                >{invitation.profile.publicId}</small
              >
            </div>
            <button
              class="icon-btn accept"
              data-friend-accept={invitation.id}
              aria-label={tr('接受好友邀请', 'Accept invitation')}
              disabled={account.busy}
              onclick={() =>
                change('respondFriend', {
                  requestId: crypto.randomUUID(),
                  invitationId: invitation.id,
                  accept: true
                })}><Check size={17} /></button
            ><button
              class="icon-btn"
              data-friend-decline={invitation.id}
              aria-label={tr('拒绝好友邀请', 'Decline invitation')}
              disabled={account.busy}
              onclick={() =>
                change('respondFriend', {
                  requestId: crypto.randomUUID(),
                  invitationId: invitation.id,
                  accept: false
                })}><X size={17} /></button
            >
          </div>{/each}
      </div>{/if}
    <div class="friend-list">
      <h3>{tr('我的好友', 'My friends')} <span>{data.friends.length}</span></h3>
      {#each data.friends as friend (friend.publicId)}<div
          class="person"
          data-friend-row={friend.publicId}
        >
          {#if friend.currentCompanion}<CompanionSprite
              character={friend.currentCompanion}
              width={44}
            />{/if}
          <div class="person-name">
            <strong>{friend.nickname}</strong><small>{friend.publicId}</small
            >{#if friend.currentCompanion}<small
                >{tr('正在养成', 'Nurturing')} · {pick(friend.currentCompanion.name)}</small
              >{/if}
          </div>
          <button
            class="icon-btn"
            data-friend-remove={friend.publicId}
            aria-label={tr('移除好友', 'Remove friend')}
            disabled={account.busy}
            onclick={() => remove(friend.publicId, friend.nickname)}><X size={15} /></button
          >
        </div>{:else}<p class="empty">
          {tr(
            '邀请一位朋友，让学习旅程多一份陪伴。',
            'Invite a friend to share your learning journey.'
          )}
        </p>{/each}
    </div>
    {#if data.outgoing.length}<details>
        <summary>{tr('等待回应', 'Awaiting a reply')} · {data.outgoing.length}</summary
        >{#each data.outgoing as invitation (invitation.id)}<p
            class="pending"
            data-friend-outgoing={invitation.id}
          >
            <Send size={12} /><span
              >{invitation.profile.nickname}<small>{invitation.profile.publicId}</small></span
            >
          </p>{/each}
      </details>{/if}
  {:else if loading}<p role="status">{tr('正在读取好友…', 'Loading friends…')}</p>{/if}
</section>

<style>
  .friends-panel {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 26px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  h2 {
    font-size: 22px;
    margin: 6px 0 0;
  }
  .eyebrow {
    font-size: 10px;
    letter-spacing: 0.14em;
    color: var(--text-3);
  }
  .own-id {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    color: var(--text-3);
    font-size: 11px;
    padding: 15px 0;
  }
  .own-id strong {
    font-family: var(--font-data);
    letter-spacing: 0.06em;
    color: var(--text);
    user-select: all;
    overflow-wrap: anywhere;
  }
  form {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .input {
    flex: 1;
    min-width: 170px;
    border: 1px solid var(--border-strong);
    background: var(--bg);
    border-radius: 10px;
    padding: 10px 12px;
    color: var(--text);
    font: inherit;
  }
  .hint {
    color: var(--text-3);
    line-height: 1.7;
    font-size: 11px;
    margin: 12px 0 22px;
  }
  h3 {
    margin: 20px 0 10px;
    font-size: 13px;
  }
  h3 span {
    color: var(--text-3);
    font-family: var(--font-data);
    margin-left: 6px;
  }
  .person {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .person-name {
    flex: 1;
    min-width: 0;
  }
  .person-name strong {
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  small {
    display: block;
    color: var(--text-3);
    font-size: 10px;
    margin-top: 4px;
    overflow-wrap: anywhere;
  }
  .icon-btn {
    display: grid;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--bg);
    color: var(--text-2);
    padding: 8px;
    cursor: pointer;
  }
  .accept {
    color: var(--accent);
  }
  .empty {
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-3);
  }
  details {
    margin-top: 20px;
    font-size: 12px;
  }
  summary {
    cursor: pointer;
  }
  .pending {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .error {
    font-size: 12px;
    color: var(--danger);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
