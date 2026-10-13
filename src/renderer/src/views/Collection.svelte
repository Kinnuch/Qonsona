<script lang="ts">
  import { onMount } from 'svelte'
  import { RefreshCw, X } from '@lucide/svelte'
  import { account } from '$lib/state/account.svelte'
  import { activity } from '$lib/state/activity.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { moduleVisible } from '$lib/packs/modules'
  import { i18n } from '$lib/i18n/index.svelte'
  import AccountPanel from '$lib/accounts/AccountPanel.svelte'
  import { accountError } from '$lib/accounts/errors'
  import { ledgerName, orderStatus } from '$lib/accounts/presentation'
  import LegacyCollection from './LegacyCollection.svelte'
  import { makeupDates, nextProbabilities } from '$lib/accounts/collection'
  import { platform } from '$lib/platform'
  import type { AccountCharacter, AccountShopItem, SupportOrder } from '$shared/account'
  import type { CompletionKind } from '$shared/rewards'
  import type { ModuleId } from '$lib/packs/types'
  import dawn from '../assets/collection/companions-dawn.png'
  import journey from '../assets/collection/companions-journey.png'
  const sheets = [dawn, journey]
  const tr = (zh: string, en: string): string => (i18n.locale === 'zh' ? zh : en)
  const name = (c: AccountCharacter): string => c.name[i18n.locale]
  const tier = (t: string): string =>
    ({
      A: tr('初识', 'Acquaintance'),
      R: tr('相知', 'Affinity'),
      SR: tr('珍遇', 'Rare encounter'),
      SSR: tr('传颂', 'Legend')
    })[t] ?? t
  const pos = (cell: number): string => `${(cell % 3) * 50}% ${Math.floor(cell / 3) * 100}%`
  let tab = $state('gallery'),
    selected = $state('')
  let source = $state<'learning' | 'support'>('learning'),
    makeupDay = $state('')
  let orders = $state.raw<SupportOrder[]>([]),
    orderError = $state(''),
    orderLoading = $state(false)
  let supportTickets = $state(1),
    rulesOpen = $state(false)
  let firstTask = $state<CompletionKind>('reading'),
    secondTask = $state<CompletionKind>('review')
  let editingDay = ''
  let confirm = $state<{
    title: string
    description: string
    action: () => Promise<boolean>
  } | null>(null)
  let confirmationScope = 0
  function focusDialog(node: HTMLDivElement): { destroy: () => void } {
    const previous = document.activeElement as HTMLElement | null
    node.focus()
    const key = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return
      const buttons = Array.from(node.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const first = buttons[0],
        last = buttons.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault()
        last?.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === node)
      ) {
        event.preventDefault()
        first?.focus()
      }
    }
    node.addEventListener('keydown', key)
    return {
      destroy: () => {
        node.removeEventListener('keydown', key)
        if (previous?.isConnected) previous.focus()
      }
    }
  }
  const s = $derived(account.snapshot)
  const online = $derived(!!account.session?.server.online && !account.busy)
  const chosen = $derived(s?.catalog.find((c) => c.id === selected) ?? s?.catalog[0])
  const owned = $derived(s?.characters.find((c) => c.id === chosen?.id))
  const probabilities = $derived(s ? nextProbabilities(s) : null)
  $effect(() => {
    if (s && editingDay !== s.day) {
      editingDay = s.day
      firstTask = (s.today.taskPlan?.[1]?.kind as CompletionKind) ?? 'reading'
      secondTask = (s.today.taskPlan?.[2]?.kind as CompletionKind) ?? 'review'
    }
  })
  const tabs = $derived([
    { id: 'gallery', name: tr('馆藏', 'Gallery') },
    { id: 'tasks', name: tr('任务', 'Tasks') },
    { id: 'shop', name: tr('商店', 'Shop') },
    { id: 'draw', name: tr('寻访', 'Discovery') },
    { id: 'bag', name: tr('背包', 'Inventory') }
  ])
  const paths: { id: ModuleId; zh: string; en: string }[] = [
    { id: 'reading', zh: '完成一篇阅读', en: 'Finish a reading' },
    { id: 'courses', zh: '完成课程练习', en: 'Finish a course lesson' },
    { id: 'practice', zh: '完成一次练习', en: 'Finish a practice session' },
    { id: 'notebook', zh: '完成生词复习', en: 'Finish a notebook review' }
  ]
  onMount(() => {
    void account.ensure()
  })
  function taskName(kind: string): string {
    return (
      {
        any: tr('今日启程：完成一项学习', 'Today’s start: complete an activity'),
        reading: tr('完成阅读', 'Finish reading'),
        practice: tr('完成练习', 'Finish practice'),
        courses: tr('完成课程', 'Finish a lesson'),
        review: tr('完成生词复习', 'Finish notebook review')
      }[kind] ?? kind
    )
  }
  const taskOptions: CompletionKind[] = ['reading', 'practice', 'courses', 'review']
  function taskVisible(kind: CompletionKind): boolean {
    return moduleVisible(kind === 'review' ? 'notebook' : kind, packs.active)
  }
  function syncLegacy(): void {
    confirmationScope = account.generation
    const unlocks = Object.entries(activity.log?.rewards?.unlocked ?? {}).map(([id, u]) => ({
      id,
      ...u
    }))
    const requestId = crypto.randomUUID()
    confirm = {
      title: tr('同步旧纪念', 'Sync earlier memorials'),
      description: tr(
        `同步 ${unlocks.length} 枚旧伙伴纪念到当前账号，不产生灵墨、寻访笺或榜单积分。`,
        `Sync ${unlocks.length} earlier companion memorials to this account, without minting Ink, tickets or leaderboard credit.`
      ),
      action: () => account.mutate('importLegacy', { requestId, unlocks })
    }
  }
  function shopName(item: AccountShopItem): string {
    const c = s?.catalog.find((c) => c.id === item.characterId)
    return c
      ? `${tier(c.tier)} · ${name(c)}`
      : item.type === 'ticket'
        ? tr('学习寻访笺', 'Learning discovery ticket')
        : item.type === 'makeup'
          ? tr('续页笺', 'Makeup slip')
          : tr('微光装裱', 'Glow decoration')
  }
  function askPurchase(item: AccountShopItem): void {
    confirmationScope = account.generation
    const balance = item.currency === 'points' ? s!.balances.points : s!.balances.echoes
    const currency = item.currency === 'points' ? tr('灵墨', 'Ink') : tr('余韵', 'Echoes')
    const requestId = crypto.randomUUID()
    confirm = {
      title: shopName(item),
      description: tr(
        `消费 ${item.price} ${currency}；当前 ${balance}，完成后 ${balance - item.price}。`,
        `Spend ${item.price} ${currency}; current ${balance}, remaining ${balance - item.price}.`
      ),
      action: () => account.mutate('purchase', { requestId, itemId: item.id, quantity: 1 })
    }
  }
  function askDraw(count: 1 | 10): void {
    confirmationScope = account.generation
    const ticketSource = source,
      requestId = crypto.randomUUID()
    const label =
      source === 'learning'
        ? tr('学习寻访笺', 'learning tickets')
        : tr('支持寻访笺', 'support tickets')
    confirm = {
      title: tr('确认寻访', 'Confirm discovery'),
      description: tr(
        `消耗 ${count} 张${label}。两种寻访笺共享保底；结果由服务器生成。`,
        `Use ${count} ${label}. Both sources share guarantees; the server generates outcomes.`
      ),
      action: () => account.mutate('draw', { requestId, source: ticketSource, count })
    }
  }
  async function execute(): Promise<void> {
    const c = confirm
    confirm = null
    if (c && confirmationScope === account.generation) await c.action()
  }
  async function loadOrders(): Promise<void> {
    if (!online || orderLoading) return
    const user = account.session?.user?.id,
      generation = account.generation
    orderLoading = true
    orderError = ''
    try {
      const result = await platform.account.request('supportOrders', {})
      if (user === account.session?.user?.id && generation === account.generation)
        orders = result.orders
    } catch (error) {
      if (user === account.session?.user?.id && generation === account.generation)
        orderError = String(error)
    } finally {
      orderLoading = false
    }
  }
  function askSupport(): void {
    confirmationScope = account.generation
    const tickets = supportTickets,
      requestId = crypto.randomUUID()
    confirm = {
      title: tr('创建测试支持订单', 'Create test support order'),
      description: tr(
        `${tickets} 张支持寻访笺，示例金额人民币 ${(tickets * 6).toFixed(2)} 元。测试订单，不进行真实付款；创建不会自动到账。`,
        `${tickets} support tickets, nominal CNY ${(tickets * 6).toFixed(2)}. Test order: do not make a real payment. Creation does not credit tickets.`
      ),
      action: async () => {
        const ok = await account.mutate('createSupportOrder', { requestId, tickets })
        if (ok) await loadOrders()
        return ok
      }
    }
  }
  function askMakeup(): void {
    confirmationScope = account.generation
    const day = makeupDay,
      requestId = crypto.randomUUID()
    confirm = {
      title: tr('使用续页笺', 'Use makeup slip'),
      description: tr(
        `补记 ${day}。只补签到，不补学习时长、任务奖励或周任务资格。每月最多两次。`,
        `Record a makeup check-in for ${day}. No time, task rewards or weekly qualification are added. Maximum twice a month.`
      ),
      action: () => account.mutate('useItem', { requestId, itemId: 'makeup', day })
    }
  }
  function historyText(detail: Record<string, unknown>): string {
    const values: string[] = []
    const item = s?.shop.find((item) => item.id === detail.itemId)
    if (item) values.push(shopName(item))
    if (detail.source === 'learning' || detail.source === 'support')
      values.push(
        detail.source === 'learning'
          ? tr('学习寻访笺', 'Learning tickets')
          : tr('支持寻访笺', 'Support tickets')
      )
    if (typeof detail.count === 'number')
      values.push(tr(`${detail.count} 次`, `${detail.count} discoveries`))
    if (typeof detail.tickets === 'number')
      values.push(tr(`${detail.tickets} 张`, `${detail.tickets} tickets`))
    if (typeof detail.day === 'string') values.push(detail.day)
    if (typeof detail.acceptedSeconds === 'number')
      values.push(
        tr(
          `有效学习 ${detail.acceptedSeconds} 秒`,
          `${detail.acceptedSeconds} accepted learning seconds`
        )
      )
    return values.join(' · ')
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') {
      confirm = null
      selected = ''
      rulesOpen = false
    }
  }}
/>
<div
  class="page collection"
  class:glow={s?.inventory.decorations?.includes('decoration:glow')}
  data-collection
>
  <header class="page-head">
    <div>
      <p class="eyebrow">QONSONA · COLLECTION</p>
      <h1>{tr('书房收藏馆', 'The study gallery')}</h1>
    </div>
    <button
      class="btn ghost"
      data-collection-refresh
      disabled={account.loading || account.busy}
      onclick={() => account.reconnect()}><RefreshCw size={15} />{tr('刷新', 'Refresh')}</button
    >
  </header>
  {#if !account.session?.user}<AccountPanel />
  {:else if !s}<p role="status">
      {account.loading
        ? tr('正在读取馆藏…', 'Loading collection…')
        : tr('馆藏尚不可用，请重新连接。', 'Collection unavailable. Please reconnect.')}
    </p>
    <AccountPanel />
  {:else}
    <section class="hero">
      <div class="portrait">
        <span
          class="sprite large"
          style:background-image={`url("${sheets[chosen?.sheet ?? 0]}")`}
          style:background-position={pos(chosen?.cell ?? 0)}
        ></span>
      </div>
      <div>
        <p class="eyebrow">{s.day} · {account.session.user.nickname}</p>
        <h2>{chosen ? name(chosen) : tr('与学习同行', 'Companions to your learning')}</h2>
        <p>
          {tr(
            '让每一次真正完成的学习留下印记。两种寻访笺共用同一保底，余韵只用于装饰。',
            'Leave a mark with each completed learning activity. Both ticket sources share guarantees; echoes buy decorations only.'
          )}
        </p>
        <div class="wallet" data-wallet>
          <span>{tr('灵墨', 'Ink')} <b data-points>{s.balances.points}</b></span><span
            >{tr('学习笺', 'Learning tickets')}
            <b data-learning-tickets>{s.balances.tickets.learning}</b></span
          ><span
            >{tr('支持笺', 'Support tickets')}
            <b data-support-tickets>{s.balances.tickets.support}</b></span
          ><span>{tr('余韵', 'Echoes')} <b>{s.balances.echoes}</b></span>
        </div>
      </div>
    </section>
    {#if !account.session.server.online}<div class="notice" role="status">
        {tr(
          '离线只读：本地学习可继续，暂不能消费、寻访或修改余额。重新连接后再试。',
          'Offline, read-only: local learning continues. Spending, discovery and balance changes require reconnection.'
        )}<button class="btn" onclick={() => account.reconnect()}
          >{tr('重新连接', 'Reconnect')}</button
        >
      </div>{/if}
    {#if account.error}<div class="notice" role="alert">
        {accountError(account.error, i18n.locale)}{#if account.retryable}<button
            class="btn"
            disabled={!online}
            data-account-retry
            onclick={() => account.retry()}>{tr('重试原操作', 'Retry original operation')}</button
          ><small
            >{tr(
              '沿用原请求编号，不会重复扣款。',
              'Reuses the original request ID to prevent duplicate spending.'
            )}</small
          >{/if}
      </div>{/if}
    <nav class="tabs" aria-label={tr('收藏页签', 'Collection sections')}>
      {#each tabs as t (t.id)}<button
          class="btn"
          class:on={tab === t.id}
          data-collection-tab={t.id}
          aria-current={tab === t.id ? 'page' : undefined}
          onclick={() => {
            tab = t.id
            confirm = null
          }}>{t.name}</button
        >{/each}
    </nav>
    {#if tab === 'gallery'}
      <div class="section-head">
        <h2>{tr('馆藏图鉴', 'Collection catalog')}</h2>
        <span>{s.characters.length} / {s.catalog.length}</span>
      </div>
      <div class="grid">
        {#each s.catalog as c (c.id)}{@const entry = s.characters.find((o) => o.id === c.id)}<button
            class="card companion"
            class:owned={!!entry}
            data-character={c.id}
            aria-pressed={selected === c.id}
            onclick={() => (selected = c.id)}
            ><span
              class="sprite"
              class:locked={!entry}
              style:background-image={`url("${sheets[c.sheet]}")`}
              style:background-position={pos(c.cell)}
            ></span><strong>{name(c)}</strong><span class="tier">{tier(c.tier)}</span><small
              >{entry
                ? `${tr('已收藏', 'Collected')} ×${entry.count}`
                : tr('尚未相遇', 'Not yet encountered')}</small
            ></button
          >{/each}
      </div>
      {#if selected && chosen}<section class="card detail" data-character-detail>
          <button
            class="btn ghost close"
            aria-label={tr('关闭详情', 'Close details')}
            onclick={() => (selected = '')}><X size={16} /></button
          >
          <div class="portrait">
            <span
              class="sprite large"
              style:background-image={`url("${sheets[chosen.sheet]}")`}
              style:background-position={pos(chosen.cell)}
            ></span>
          </div>
          <div>
            <p class="eyebrow">{tier(chosen.tier)} · {chosen.id}</p>
            <h2>{name(chosen)}</h2>
            <p>
              {owned
                ? tr(
                    `共相遇 ${owned.count} 次；首次 ${new Date(owned.firstAt).toLocaleString('zh-CN')}`,
                    `Encountered ${owned.count} times; first ${new Date(owned.firstAt).toLocaleString('en')}`
                  )
                : tr(
                    '通过寻访相遇；初识与相知也可在商店直接兑换。',
                    'Meet through discovery; Acquaintance and Affinity are also available directly in the shop.'
                  )}
            </p>
            <p class="muted">
              {tr(
                '当前为原有伙伴测试池，重复相遇只增加余韵，不增加图鉴种类。',
                'The current pool uses existing companions. Duplicates grant echoes without increasing unique collection count.'
              )}
            </p>
          </div>
        </section>{/if}
      <details class="card memorial">
        <summary
          >{tr(
            '本地纪念馆 · 保留旧版伙伴',
            'Local memorial · earlier companions retained'
          )}</summary
        >
        <p class="muted">
          {tr(
            '这些记录留在本机，不覆盖账号余额或服务器馆藏。',
            'These records remain local and do not replace account balances or server collectibles.'
          )}
        </p>
        <button
          class="btn"
          data-legacy-sync
          disabled={!online || !Object.keys(activity.log?.rewards?.unlocked ?? {}).length}
          onclick={syncLegacy}>{tr('同步旧纪念到账号', 'Sync earlier memorials to account')}</button
        >
        <h3>{tr('账号纪念馆', 'Account memorials')} ({s.legacy.length}/12)</h3>
        <div class="grid">
          {#each s.legacy as old (old.id)}{@const c = s.catalog.find((c) => c.id === old.id)}
            <div class="card companion">
              {#if c}<span
                  class="sprite"
                  style:background-image={`url("${sheets[c.sheet]}")`}
                  style:background-position={pos(c.cell)}
                ></span><strong>{name(c)}</strong>{/if}<small
                >{old.day} · {old.minutes} {tr('分钟', 'minutes')}</small
              >
            </div>{/each}
        </div>
        <LegacyCollection />
      </details>
    {:else if tab === 'tasks'}
      <section class="card">
        <h2>{tr('今日学习', 'Today’s learning')}</h2>
        <p>
          {tr(
            '登录且联网时，前台有效学习每分钟获得 2 灵墨，最多奖励 60 分钟。离线记录留在本地，不补发账号积分。',
            'While signed in and online, active foreground learning earns 2 Ink per minute, up to 60 rewarded minutes. Offline records stay local and do not mint account points.'
          )}
        </p>
        <p class="big">
          {Math.floor(s.today.seconds / 60)}
          <small>{tr('分钟', 'minutes')} · {s.today.timePoints}/120 {tr('灵墨', 'Ink')}</small>
        </p>
        <progress max="120" value={s.today.timePoints}></progress>
      </section>
      <div class="grid tasks">
        {#each s.today.taskPlan as task (task.id)}<section
            class="card"
            data-task={task.id}
            data-done={task.done}
          >
            <p class="eyebrow">{taskName(task.kind)}</p>
            <h3>
              {task.done ? tr('已完成 · +20 灵墨', 'Completed · +20 Ink') : taskName(task.kind)}
            </h3>
            <p class="muted">
              {tr(
                '阅读完成、提交练习、通过课程或结束复习。仅打开页面不计入。',
                'Finish reading, submit practice, pass a lesson or complete review. Opening a page does not count.'
              )}
            </p>
          </section>{/each}
      </div>
      <section class="card">
        <h3>{tr('调整今日指定板块', 'Choose today’s designated sections')}</h3>
        <p class="muted">
          {tr(
            '开始学习或完成任务前，每天可调整一次。今日启程可与一个指定板块同时完成；两个指定板块必须不同。',
            'Change once per day, before learning or completing any task. Today’s start may overlap one designated section; the two designated sections must differ.'
          )}
        </p>
        <div class="actions">
          <label
            >{tr('板块一', 'Section one')}<select
              class="input"
              data-task-first
              bind:value={firstTask}
              >{#each taskOptions.filter(taskVisible) as kind (kind)}<option value={kind}
                  >{taskName(kind)}</option
                >{/each}</select
            ></label
          ><label
            >{tr('板块二', 'Section two')}<select
              class="input"
              data-task-second
              bind:value={secondTask}
              >{#each taskOptions.filter(taskVisible) as kind (kind)}<option value={kind}
                  >{taskName(kind)}</option
                >{/each}</select
            ></label
          ><button
            class="btn"
            data-tasks-configure
            disabled={!online ||
              firstTask === secondTask ||
              s.today.seconds > 0 ||
              s.today.tasks > 0 ||
              s.today.planChanges > 0}
            onclick={() =>
              account.mutate('configureTasks', {
                requestId: crypto.randomUUID(),
                kinds: [firstTask, secondTask]
              })}>{tr('保存今日计划', 'Save today’s plan')}</button
          >
        </div>
      </section>
      <section class="card">
        <h3>{tr('从适合当前语言的任务开始', 'Choose an activity available in this language')}</h3>
        <div class="actions">
          {#each paths.filter((p) => moduleVisible(p.id, packs.active)) as p (p.id)}<button
              class="btn"
              onclick={() => ui.go(p.id)}>{tr(p.zh, p.en)}</button
            >{/each}
        </div>
        <p class="muted">
          {tr(
            '内容较少的学习包也可阅读已有材料或复习自己的生词；任务不限定官方语言、级别或课程数量。',
            'Smaller packs can use available texts or personal vocabulary review. Tasks do not require an official language, level or number of lessons.'
          )}
        </p>
      </section>
      <section class="card">
        <h3>{tr('自然周任务 · 80 灵墨', 'Calendar-week task · 80 Ink')}</h3>
        <p>
          {tr(
            '周一至周日，至少五天各学习十分钟并完成至少一项任务。续页不补周任务资格。',
            'Monday–Sunday: at least five days with ten minutes of learning and one completed activity each. Makeup check-ins do not qualify.'
          )}
        </p>
        <p>
          {s.today.weeklyBonus
            ? tr('本周奖励已领取', 'This week’s reward claimed')
            : tr('达标后自动发放', 'Awarded automatically when qualified')}
        </p>
      </section>
    {:else if tab === 'shop'}
      <h2>{tr('灵墨商店', 'Ink shop')}</h2>
      <div class="grid">
        {#each s.shop as item (item.id)}{@const balance =
            item.currency === 'points' ? s.balances.points : s.balances.echoes}{@const already =
            (item.type === 'character' && s.characters.some((c) => c.id === item.characterId)) ||
            (item.type === 'decoration' && s.inventory.decorations?.includes(item.id))}
          <section class="card">
            <p class="eyebrow">
              {item.currency === 'echoes'
                ? tr('装饰专用', 'Decoration only')
                : tr('学习所得', 'Earned through learning')}
            </p>
            <h3>{shopName(item)}</h3>
            <p class="big">
              {item.price}
              <small>{item.currency === 'points' ? tr('灵墨', 'Ink') : tr('余韵', 'Echoes')}</small>
            </p>
            <p class="muted">
              {item.type === 'ticket'
                ? tr('用于一次寻访。', 'One discovery.')
                : item.type === 'makeup'
                  ? tr(
                      '补记过去七天未签到的一天，不补奖励。',
                      'Make up one missed check-in in the last seven days, without rewards.'
                    )
                  : item.type === 'decoration'
                    ? tr(
                        '装饰馆藏，不兑换积分或寻访笺。',
                        'Decorates your gallery; cannot become points or tickets.'
                      )
                    : tr('直接获得这一位伙伴。', 'Acquire this companion directly.')}
            </p>
            <button
              class="btn primary"
              data-shop-item={item.id}
              disabled={!online || !!already || balance < item.price}
              onclick={() => askPurchase(item)}
              >{already
                ? tr('已拥有', 'Owned')
                : balance < item.price
                  ? tr('余额不足', 'Insufficient balance')
                  : tr('兑换', 'Redeem')}</button
            >
          </section>{/each}
      </div>
      <section class="card support">
        <h3>{tr('支持开发 · 测试订单', 'Support development · test orders')}</h3>
        <p>
          {tr(
            '测试订单，不进行真实付款。示例单价人民币 6 元，每月上限 60 元；创建订单不会自动到账。人工核验与正式收款须由运营者另行开放。',
            'Test orders: do not make real payments. Nominal price CNY 6 each, monthly cap CNY 60. Creating an order does not credit tickets. Manual verification and real payments require a separate operator rollout.'
          )}
        </p>
        <label
          >{tr('张数', 'Tickets')}
          <input
            class="input"
            type="number"
            min="1"
            max="10"
            step="1"
            bind:value={supportTickets}
          /></label
        ><button
          class="btn"
          disabled={!online ||
            !Number.isInteger(supportTickets) ||
            supportTickets < 1 ||
            supportTickets > 10}
          data-support-create
          onclick={askSupport}>{tr('创建测试订单', 'Create test order')}</button
        ><button class="btn ghost" disabled={!online || orderLoading} onclick={loadOrders}
          >{tr('查看订单', 'View orders')}</button
        >{#if account.lastOrder}<p data-support-order>
            {account.lastOrder.id} · {account.lastOrder.amountFen / 100} CNY · {orderStatus(
              account.lastOrder.status,
              i18n.locale
            )}
          </p>{/if}{#if orderError}<p role="alert">
            {accountError(orderError, i18n.locale)}
          </p>{/if}{#each orders as order (order.id)}<p>
            {order.id} · {order.tickets}
            {tr('张', 'tickets')} · {order.amountFen / 100} CNY · {orderStatus(
              order.status,
              i18n.locale
            )}
          </p>{/each}
      </section>
    {:else if tab === 'draw'}
      <section class="card discovery">
        <p class="eyebrow">{tr('寻访伙伴', 'Discover companions')}</p>
        <h2>{tr('每一次相遇都有记录', 'Every encounter is recorded')}</h2>
        <p>
          {tr(
            '学习与支持寻访共用保底。购买寻访笺不会提高概率。',
            'Learning and support discoveries share guarantees. Buying tickets does not improve the odds.'
          )}
        </p>
        <label
          >{tr('使用的寻访笺', 'Ticket source')}
          <select class="input" data-draw-source bind:value={source}
            ><option value="learning"
              >{tr('学习寻访笺', 'Learning tickets')} ({s.balances.tickets.learning})</option
            ><option value="support"
              >{tr('支持寻访笺', 'Support tickets')} ({s.balances.tickets.support})</option
            ></select
          ></label
        >
        <div class="actions">
          <button
            class="btn primary"
            data-draw-one
            disabled={!online || s.balances.tickets[source] < 1}
            onclick={() => askDraw(1)}>{tr('寻访一次 · 1 张', 'Discover once · 1 ticket')}</button
          ><button
            class="btn"
            data-draw-ten
            disabled={!online || s.balances.tickets[source] < 10}
            onclick={() => askDraw(10)}
            >{tr('寻访十次 · 10 张', 'Discover ten · 10 tickets')}</button
          ><button class="btn ghost" onclick={() => (rulesOpen = !rulesOpen)}
            >{tr('查看概率与保底', 'Odds and guarantees')}</button
          >
        </div>
        <p data-pity>
          {tr('距上次传颂', 'Since last Legend')}: {s.pity.sinceSSR} · {tr(
            '距上次高阶',
            'Since last high tier'
          )}: {s.pity.sinceHigh}
        </p>
        <p>
          {tr('下一抽传颂概率', 'Next Legend chance')}: {((probabilities?.SSR ?? 0) * 100).toFixed(
            1
          )}% · {tr('至多', 'At most')}
          {Math.max(1, Number(s.drawRules.hardSSR) - s.pity.sinceSSR)}
          {tr('抽遇传颂', 'draws to Legend')} · {Math.max(
            1,
            Number(s.drawRules.highPity) - s.pity.sinceHigh
          )}
          {tr('抽遇珍遇或传颂', 'draws to Rare encounter or Legend')}
        </p>
        {#if rulesOpen}<div class="notice" data-draw-rules>
            <p>
              {tr(
                '基础概率：初识 70%、相知 24.4%、珍遇 5%、传颂 0.6%。20 抽内必有珍遇或传颂；第 76 抽起传颂每抽增加 5 个百分点，90 抽硬保底。高阶保底会改变该抽概率，以下为下一抽实际分布。',
                'Base odds: Acquaintance 70%, Affinity 24.4%, Rare encounter 5%, Legend 0.6%. A high tier is guaranteed within 20 draws. Legend chance rises by 5 percentage points per draw from draw 76, with a hard guarantee at 90. The high-tier guarantee changes that draw’s odds; the distribution below is for your next draw.'
              )}
            </p>
            {#each Object.entries(probabilities ?? {}) as [quality, p] (quality)}<span
                >{tier(quality)} {(p * 100).toFixed(3)}% ·
              </span>{/each}
            <p>
              {tr(
                '重复相遇分别获得 1 / 3 / 8 / 20 余韵，只用于装饰。',
                'Duplicates grant 1 / 3 / 8 / 20 echoes, for decorations only.'
              )}
            </p>
          </div>{/if}
      </section>
      {#if account.lastDraw.length}<section aria-live="polite" data-draw-results>
          <h3>{tr('本次相遇', 'Your encounters')}</h3>
          <div class="grid">
            {#each account.lastDraw as result, i (i)}{@const c = s.catalog.find(
                (c) => c.id === result.id
              )}
              <div class="card companion" data-draw-result={i}>
                {#if c}<span
                    class="sprite"
                    style:background-image={`url("${sheets[c.sheet]}")`}
                    style:background-position={pos(c.cell)}
                  ></span><strong>{name(c)}</strong>{/if}<span>{tier(result.tier)}</span><small
                  >{result.duplicate
                    ? tr(`重复 · +${result.echoes} 余韵`, `Duplicate · +${result.echoes} echoes`)
                    : tr('初次相遇', 'First encounter')}</small
                >
              </div>{/each}
          </div>
        </section>{/if}
    {:else}
      <section class="card">
        <h2>{tr('背包', 'Inventory')}</h2>
        <p>
          {tr('续页笺', 'Makeup slips')}: {s.inventory.makeup} · {tr(
            '微光装裱',
            'Glow decoration'
          )}: {s.inventory.decorations?.includes('decoration:glow')
            ? tr('已拥有', 'Owned')
            : tr('未拥有', 'Not owned')}
        </p>
        <label
          >{tr('补记日期', 'Makeup date')}
          <select class="input" data-makeup-day bind:value={makeupDay}
            ><option value=""
              >{tr('选择过去七天的空白日', 'Choose a missed day in the last seven days')}</option
            >{#each makeupDates(s) as day (day)}<option value={day}>{day}</option>{/each}</select
          ></label
        ><button
          class="btn"
          data-makeup-use
          disabled={!online || s.inventory.makeup < 1 || !makeupDates(s).includes(makeupDay)}
          onclick={askMakeup}>{tr('使用续页笺', 'Use makeup slip')}</button
        >
        <p class="muted">
          {tr(
            '每月最多补签两次，库存最多三张；只增加签到印记，不补积分、时长或周资格。日期按服务器 UTC+8。',
            'At most two makeup check-ins per month, with up to three slips stored. Adds a check-in mark only, not points, time or weekly qualification. Dates use the server’s UTC+8 calendar.'
          )}
        </p>
      </section>
      <section class="card">
        <h3>{tr('签到记录', 'Check-in history')}</h3>
        <div class="stamps">
          {#each s.checkins.slice().reverse().slice(0, 31) as c (c.day)}<span
              >{c.day} · {c.kind === 'makeup' ? tr('续页', 'Makeup') : tr('学习', 'Learning')}</span
            >{/each}
        </div>
      </section>
      <section class="card">
        <h3>{tr('最近获得与消费', 'Recent acquisitions and spending')}</h3>
        {#each s.history ?? [] as h (h.id)}<div class="ledger">
            <time>{new Date(h.at).toLocaleString(i18n.locale === 'zh' ? 'zh-CN' : 'en')}</time><span
              >{ledgerName(h.kind, i18n.locale)} · {historyText(h.detail)}</span
            >
          </div>{:else}<p>{tr('还没有记录', 'No records yet')}</p>{/each}
      </section>
    {/if}
  {/if}
</div>
{#if confirm}<div class="backdrop">
    <div
      class="confirmation card"
      use:focusDialog
      role="dialog"
      aria-modal="true"
      aria-label={confirm.title}
      tabindex="-1"
    >
      <h2>{confirm.title}</h2>
      <p>{confirm.description}</p>
      <p class="muted">
        {tr(
          '以服务器核验结果为准。若连接中断，可重试原请求。',
          'Subject to server validation. If the connection fails, retry the original request.'
        )}
      </p>
      <div class="actions">
        <button class="btn" data-transaction-cancel onclick={() => (confirm = null)}
          >{tr('取消', 'Cancel')}</button
        ><button class="btn primary" data-transaction-confirm disabled={!online} onclick={execute}
          >{tr('确认', 'Confirm')}</button
        >
      </div>
    </div>
  </div>{/if}

<style>
  .glow .portrait {
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent),
      0 0 30px color-mix(in srgb, var(--accent) 18%, transparent);
  }
  .glow .companion.owned {
    box-shadow: inset 0 0 20px color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .collection {
    max-width: 1240px;
    padding-bottom: 50px;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.12em;
    color: var(--accent);
    font-weight: 600;
  }
  .hero {
    display: grid;
    grid-template-columns: 210px minmax(0, 1fr);
    gap: 32px;
    align-items: center;
    padding: 32px;
    border: 1px solid var(--border);
    border-radius: 22px;
    background:
      radial-gradient(
        ellipse at 0 0,
        color-mix(in srgb, var(--accent) 15%, transparent),
        transparent 70%
      ),
      var(--bg-elev);
  }
  h2 {
    font-size: 25px;
    margin: 10px 0;
  }
  h3 {
    font-size: 18px;
  }
  p {
    line-height: 1.8;
  }
  .hero p {
    color: var(--text-2);
  }
  .portrait {
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-sunken));
    border-radius: 18px;
    padding: 12px;
  }
  .sprite {
    display: block;
    width: 126px;
    aspect-ratio: 42/39;
    background-size: 300% 200%;
    background-repeat: no-repeat;
    image-rendering: pixelated;
    max-width: 100%;
    filter: drop-shadow(0 5px 6px #31475322);
  }
  .large {
    width: 168px;
  }
  .locked {
    filter: grayscale(1);
    opacity: 0.4;
  }
  .wallet {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 18px;
  }
  .wallet > span {
    border: 1px solid var(--border);
    background: var(--bg-elev);
    border-radius: 9px;
    padding: 8px 12px;
    font-size: 12px;
  }
  .wallet b {
    font-size: 20px;
    margin-inline-start: 8px;
    font-variant-numeric: tabular-nums;
  }
  .tabs {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    margin: 25px 0;
  }
  .tabs .on {
    background: var(--accent);
    color: var(--accent-contrast);
    border-color: var(--accent);
  }
  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 15px;
  }
  .card {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 22px;
    min-width: 0;
    margin-bottom: 18px;
  }
  .grid .card {
    margin: 0;
  }
  .companion {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
    color: var(--text);
    cursor: pointer;
  }
  .companion.owned {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  }
  .tier,
  small {
    color: var(--text-3);
    font-size: 12px;
  }
  .detail {
    display: flex;
    gap: 25px;
    align-items: center;
    position: relative;
    margin-top: 25px;
  }
  .detail > div:last-child {
    min-width: 0;
    flex: 1;
  }
  .close {
    position: absolute;
    top: 8px;
    inset-inline-end: 8px;
  }
  .memorial {
    margin-top: 25px;
  }
  summary {
    cursor: pointer;
  }
  .notice {
    border: 1px solid var(--border);
    background: var(--bg-sunken);
    padding: 15px;
    border-radius: 12px;
    margin: 15px 0;
    overflow-wrap: anywhere;
  }
  .notice .btn {
    margin: 8px;
  }
  .notice small {
    display: block;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 18px 0;
  }
  .big {
    font-size: 32px;
    font-variant-numeric: tabular-nums;
  }
  .big small {
    font-size: 13px;
  }
  progress {
    width: 100%;
    accent-color: var(--accent);
  }
  .tasks {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 20px 0;
  }
  .input {
    max-width: 100%;
    margin: 8px 10px 8px 0;
  }
  .support {
    margin-top: 25px;
  }
  .stamps {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .stamps > span {
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 7px;
    font-size: 12px;
  }
  .ledger {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .ledger time {
    color: var(--text-3);
  }
  .backdrop {
    position: fixed;
    inset: 0;
    background: #0006;
    z-index: 100;
    display: grid;
    place-items: center;
    padding: 20px;
  }
  .confirmation {
    width: min(100%, 520px);
    box-shadow: var(--shadow);
    max-height: 90dvh;
    overflow: auto;
  }
  .muted {
    color: var(--text-3);
    font-size: 13px;
  }
  .discovery {
    padding: 30px;
  }
  .grid + .card {
    margin-top: 20px;
  }
  @media (max-width: 1050px) {
    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .hero {
      padding: 25px;
      grid-template-columns: 168px minmax(0, 1fr);
    }
  }
  @media (max-width: 736px) {
    .grid,
    .tasks {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .hero {
      grid-template-columns: minmax(0, 1fr);
      gap: 15px;
      padding: 20px;
    }
    .hero .portrait {
      justify-self: start;
    }
    .detail {
      flex-wrap: wrap;
    }
    .card {
      padding: 17px;
    }
    .wallet {
      gap: 8px;
    }
    .wallet > span {
      padding: 7px;
    }
    .wallet b {
      font-size: 17px;
    }
  }
  @media (max-width: 420px) {
    .tasks {
      grid-template-columns: minmax(0, 1fr);
    }
    .sprite {
      width: 100px;
    }
    .large {
      width: 150px;
    }
    .grid {
      gap: 9px;
    }
    .companion {
      padding: 15px 8px;
    }
  }
</style>
