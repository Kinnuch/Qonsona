<script lang="ts">
  import { onMount, tick } from 'svelte'
  import {
    RefreshCw,
    X,
    ArrowUpRight,
    ArrowLeft,
    ArrowRight,
    BookOpen,
    Feather,
    Sparkles,
    Ticket,
    CalendarDays,
    Check
  } from '@lucide/svelte'
  import { fly } from 'svelte/transition'
  import { account } from '$lib/state/account.svelte'
  import { guestCollection } from '$lib/state/guest-collection.svelte'
  import { activity } from '$lib/state/activity.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { moduleVisible } from '$lib/packs/modules'
  import { i18n } from '$lib/i18n/index.svelte'
  import AccountPanel from '$lib/accounts/AccountPanel.svelte'
  import CollectionLoginDialog from '$lib/accounts/CollectionLoginDialog.svelte'
  import CompanionSprite from '$lib/accounts/CompanionSprite.svelte'
  import CompanionBiography from '$lib/accounts/CompanionBiography.svelte'
  import ShopProducts from '$lib/accounts/ShopProducts.svelte'
  import DiscoveryCorridor from '$lib/accounts/DiscoveryCorridor.svelte'
  import CompanionHome from '$lib/accounts/CompanionHome.svelte'
  import { accountError } from '$lib/accounts/errors'
  import { ledgerName, orderStatus } from '$lib/accounts/presentation'
  import LegacyCollection from './LegacyCollection.svelte'
  import { makeupDates, nextProbabilities } from '$lib/accounts/collection'
  import { platform } from '$lib/platform'
  import type { AccountCharacter, AccountShopItem, SupportOrder } from '$shared/account'
  import type { CompletionKind } from '$shared/rewards'
  import type { ModuleId } from '$lib/packs/types'
  const tr = (zh: string, en: string): string => (i18n.locale === 'zh' ? zh : en)
  const name = (c: AccountCharacter): string => c.name[i18n.locale]
  const tier = (t: string): string =>
    ({
      A: tr('初识', 'Acquaintance'),
      R: tr('相知', 'Affinity'),
      SR: tr('珍遇', 'Rare encounter'),
      SSR: tr('传颂', 'Legend')
    })[t] ?? t
  let tab = $state('gallery'),
    selected = $state('')
  let speciesId = $state(''),
    shopTier = $state('')
  let slide = $state(0),
    slideDirection = $state(1),
    hoverPause = $state(false),
    focusPause = $state(false),
    reducedMotion = $state(false)
  const slideTypes = ['new', 'discount', 'popular'] as const
  let source = $state<'learning' | 'support'>('learning'),
    makeupDay = $state('')
  let orders = $state.raw<SupportOrder[]>([]),
    orderError = $state(''),
    orderLoading = $state(false)
  let ordersOwner = ''
  let supportTickets = $state(1),
    rulesOpen = $state(false),
    supportOpen = $state(false)
  let supportHeading = $state<HTMLHeadingElement>()
  let firstTask = $state<CompletionKind>('reading'),
    secondTask = $state<CompletionKind>('review')
  let editingDay = ''
  let loginReason = $state<'browse' | 'purchase' | 'draw' | 'support' | null>(null)
  let confirm = $state<{
    title: string
    description: string
    action: () => Promise<boolean>
    local?: boolean
  } | null>(null)
  let confirmationScope = 0
  let confirmationGuestScope = 0
  let serverClock = 0,
    clockAnchor = 0,
    clockObserved: string | number | undefined,
    poolRefreshing = false,
    lastPoolRefreshAttempt = 0
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
  const guest = $derived(!account.session?.user)
  $effect(() => {
    const owner = `${account.generation}:${account.session?.user?.id ?? ''}`
    if (owner !== ordersOwner) {
      ordersOwner = owner
      orders = []
      orderError = ''
      orderLoading = false
      confirm = null
      supportOpen = false
    }
  })
  const s = $derived(guest ? guestCollection.snapshot : account.snapshot)
  const online = $derived(
    !guest && !!account.session?.server.online && !account.busy && !account.loading
  )
  const guestReady = $derived(
    guest &&
      account.loaded &&
      !account.loading &&
      !account.busy &&
      guestCollection.loaded &&
      !guestCollection.loading &&
      !guestCollection.busy
  )
  const chosen = $derived(s?.catalog.find((c) => c.id === selected) ?? s?.catalog[0])
  const owned = $derived(s?.characters.find((c) => c.id === chosen?.id))
  const featured = $derived(
    !guest ? s?.gallery?.find((g) => g.type === slideTypes[slide]) : undefined
  )
  const featuredCharacter = $derived(
    guest
      ? (s?.catalog.find((c) => c.id === guestCollection.starter?.characterId) ??
          s?.catalog.filter((c) => c.tier === (slide === 2 ? 'SSR' : 'A') && !c.special)[
            slide === 1 ? 1 : 0
          ])
      : s?.catalog.find((c) => c.id === featured?.characterId)
  )
  const groups = $derived(
    s?.species ??
      (s
        ? [
            {
              id: 'companions',
              name: { zh: '语言伙伴', en: 'Language companions' },
              characterIds: s.catalog.map((c) => c.id)
            }
          ]
        : [])
  )
  const currentGroup = $derived(groups.find((g) => g.id === speciesId))
  const groupMembers = $derived(
    s?.catalog.filter((c) => currentGroup?.characterIds.includes(c.id)) ?? []
  )
  const heroTitle = $derived(
    guest
      ? [
          tr('初识伙伴 · 免费相遇', 'Your first companion · a free encounter'),
          tr('五大系列 · 伙伴图鉴', 'Five series · the companion catalog'),
          tr('珍贵相遇 · 图鉴预览', 'Rare encounters · catalog preview')
        ][slide]
      : slide === 0
        ? tr('今日新增的馆藏', 'Today’s new acquisitions')
        : slide === 1
          ? tr('今日半价的相遇', 'Today’s half-price encounter')
          : tr('人气传颂馆藏', 'Popular legendary companion')
  )
  const probabilities = $derived(!guest && s ? nextProbabilities(s) : null)
  $effect(() => {
    if (account.loaded && guest) void guestCollection.ensure()
  })
  $effect(() => {
    if (!guest) loginReason = null
  })
  $effect(() => {
    if (s && s.serverTime !== clockObserved) {
      clockObserved = s.serverTime
      serverClock = typeof s.serverTime === 'number' ? s.serverTime : Date.parse(s.serverTime)
      clockAnchor = performance.now()
    }
  })
  async function refreshPoolIfDue(): Promise<void> {
    if (
      !s?.drawPool ||
      !account.session?.server.online ||
      account.busy ||
      poolRefreshing ||
      !Number.isFinite(serverClock)
    )
      return
    const now = performance.now()
    if (
      serverClock + now - clockAnchor < s.drawPool.endAt ||
      (lastPoolRefreshAttempt > 0 && now - lastPoolRefreshAttempt < 10000)
    )
      return
    poolRefreshing = true
    lastPoolRefreshAttempt = now
    try {
      await account.refresh()
    } finally {
      poolRefreshing = false
    }
  }
  $effect(() => {
    if (s && editingDay !== s.day) {
      editingDay = s.day
      firstTask = (s.today.taskPlan?.[1]?.kind as CompletionKind) ?? 'reading'
      secondTask = (s.today.taskPlan?.[2]?.kind as CompletionKind) ?? 'review'
    }
  })
  const tabs = $derived([
    { id: 'gallery', name: tr('馆藏', 'Gallery') },
    { id: 'home', name: tr('家园', 'Home') },
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
    void guestCollection.ensure()
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = (): void => {
      reducedMotion = media.matches
    }
    updateMotion()
    media.addEventListener('change', updateMotion)
    const interval = window.setInterval(() => {
      if (!hoverPause && !focusPause && !reducedMotion && !document.hidden)
        changeSlide((slide + 1) % 3)
      if (!document.hidden) void refreshPoolIfDue()
    }, 5000)
    const refreshOnFocus = (): void => {
      void refreshPoolIfDue()
    }
    window.addEventListener('focus', refreshOnFocus)
    return () => {
      window.clearInterval(interval)
      media.removeEventListener('change', updateMotion)
      window.removeEventListener('focus', refreshOnFocus)
    }
  })
  function changeSlide(next: number): void {
    slideDirection = next === (slide + 1) % 3 ? 1 : -1
    slide = next
  }
  function openFeatured(): void {
    if (!featuredCharacter) return
    if (guest && slide === 0 && !guestCollection.starter) {
      tab = 'shop'
      shopTier = 'A'
    } else if (!guest && slideTypes[slide] === 'discount') {
      tab = 'shop'
      shopTier = featuredCharacter.tier
    } else {
      tab = 'gallery'
      speciesId = groups.find((g) => g.characterIds.includes(featuredCharacter.id))?.id ?? ''
      selected = featuredCharacter.id
    }
  }
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
    if (guest) {
      if (item.type !== 'character' || item.tier !== 'A' || guestCollection.starter) {
        requireLogin('purchase')
        return
      }
      if (!guestReady || !item.characterId) return
      confirmationScope = account.generation
      confirmationGuestScope = guestCollection.generation
      const characterId = item.characterId
      confirm = {
        title: tr('迎接第一位语言伙伴', 'Welcome your first companion'),
        description: tr(
          `免费领取${s?.catalog.find((c) => c.id === characterId)?.name.zh ?? ''}，不消耗灵墨。本机只能免费领取一位初识伙伴；选择后保存在本机，登录后可同步一次，每个账号限一位。`,
          `Claim ${s?.catalog.find((c) => c.id === characterId)?.name.en ?? 'this companion'} for free, without spending Ink. Choose one Acquaintance companion per device. Your choice stays on this device and can be synced after sign-in, once per account.`
        ),
        local: true,
        action: () => guestCollection.claim(characterId)
      }
      return
    }
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
      action: () =>
        account.mutate('purchase', {
          requestId,
          itemId: item.id,
          quantity: 1,
          expectedPrice: item.price
        })
    }
  }
  function askDraw(count: 1 | 10): void {
    if (guest) {
      requireLogin('draw')
      return
    }
    confirmationScope = account.generation
    const ticketSource = source,
      requestId = crypto.randomUUID(),
      expectedPoolId = s?.drawPool?.id
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
      action: () =>
        account.mutate('draw', { requestId, source: ticketSource, count, expectedPoolId })
    }
  }
  async function execute(): Promise<void> {
    const c = confirm
    confirm = null
    if (!c || confirmationScope !== account.generation) return
    if (c.local) {
      if (!guestReady || confirmationGuestScope !== guestCollection.generation) return
    } else if (!online) return
    await c.action()
  }
  function requireLogin(reason: 'browse' | 'purchase' | 'draw' | 'support'): void {
    confirm = null
    loginReason = reason
  }
  async function refreshCollection(): Promise<void> {
    if (guest) await guestCollection.refresh()
    await account.reconnect()
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
      if (user === account.session?.user?.id && generation === account.generation)
        orderLoading = false
    }
  }
  function askSupport(): void {
    if (guest) {
      requireLogin('support')
      return
    }
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
  async function openSupport(): Promise<void> {
    if (account.busy || account.loading) return
    if (guest) {
      requireLogin('support')
      return
    }
    supportOpen = true
    await tick()
    supportHeading?.focus({ preventScroll: true })
    supportHeading?.scrollIntoView({ block: 'start', behavior: 'instant' })
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
      <p class="eyebrow">THE COLLECTION ROOM</p>
      <h1>{tr('收藏', 'Collection')}</h1>
    </div>
    <button
      class="btn ghost"
      data-collection-refresh
      disabled={account.loading || account.busy || guestCollection.loading || guestCollection.busy}
      onclick={refreshCollection}><RefreshCw size={15} />{tr('刷新', 'Refresh')}</button
    >
  </header>
  {#if !s}<p role="status">
      {account.loading || guestCollection.loading
        ? tr('正在读取馆藏…', 'Loading collection…')
        : tr('馆藏尚不可用，请重新连接。', 'Collection unavailable. Please reconnect.')}
    </p>
    {#if !guest}<AccountPanel />{/if}
  {:else}
    {#if guest}<section class="guest-welcome" data-guest-collection>
        <div>
          <p class="eyebrow">{tr('先相遇，再一起成长', 'A first encounter, a new journey')}</p>
          <h2>
            {guestCollection.starter
              ? tr('第一位伙伴，已经在这里等你。', 'Your first companion is waiting here.')
              : tr(
                  '挑一位初识伙伴，免费开启旅程。',
                  'Choose a free companion to begin your journey.'
                )}
          </h2>
          <p>
            {tr(
              '未登录也可浏览收藏馆。本机可任选一位初识伙伴免费领取；登录后可同步一次，每个账号限一位，并解锁灵墨、寻访及更多兑换。',
              'Browse the gallery without signing in. Claim one Acquaintance companion for free on this device; sync it after sign-in, once per account, and unlock Ink, discovery and further redemptions.'
            )}
          </p>
        </div>
        <div class="actions">
          {#if !guestCollection.starter}<button
              class="btn primary"
              data-guest-choose-starter
              onclick={() => {
                tab = 'shop'
                shopTier = 'A'
              }}>{tr('挑选免费伙伴', 'Choose a free companion')}<ArrowUpRight size={15} /></button
            >{/if}
          <button class="btn" data-collection-login onclick={() => requireLogin('browse')}
            >{tr('登录 / 注册', 'Sign in / Register')}</button
          >
        </div>
      </section>
      {#if guestCollection.error}<p class="notice" role="alert" data-guest-collection-error>
          {tr(
            '本机馆藏暂未读取成功，请刷新后重试。',
            'The local collection could not be loaded. Refresh and try again.'
          )}
        </p>{/if}
    {:else}
      <div class="wallet" data-wallet>
        <span><Feather size={16} />{tr('灵墨', 'Ink')} <b data-points>{s.balances.points}</b></span>
        <span
          ><Ticket size={16} />{tr('学习笺', 'Learning tickets')}
          <b data-learning-tickets>{s.balances.tickets.learning}</b></span
        >
        <span
          >{tr('支持寻访笺', 'Support tickets')}
          <b data-support-tickets>{s.balances.tickets.support}</b></span
        >
        <span>{tr('余韵', 'Echoes')} <b>{s.balances.echoes}</b></span>
      </div>
    {/if}
    {#if !guest && !account.session?.server.online}<div class="notice" role="status">
        {tr(
          '离线只读：本地学习可继续，暂不能消费、寻访或修改余额。重新连接后再试。',
          'Offline, read-only: local learning continues. Spending, discovery and balance changes require reconnection.'
        )}<button class="btn" onclick={() => account.reconnect()}
          >{tr('重新连接', 'Reconnect')}</button
        >
      </div>{/if}
    {#if !guest && account.error}<div class="notice" role="alert">
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
            shopTier = ''
            if (t.id === 'draw') void refreshPoolIfDue()
          }}>{t.name}</button
        >{/each}
    </nav>
    {#if tab === 'gallery'}
      <section
        class="hero"
        data-gallery-hero
        aria-roledescription={tr('画廊轮播', 'Gallery carousel')}
        aria-label={tr('今日馆藏', 'Today in the gallery')}
        onmouseenter={() => (hoverPause = true)}
        onmouseleave={() => (hoverPause = false)}
        onfocusin={() => (focusPause = true)}
        onfocusout={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) focusPause = false
        }}
      >
        <div class="hero-viewport">
          {#key slide}
            <div
              class="hero-slide"
              data-gallery-slide={slideTypes[slide]}
              data-gallery-type={slideTypes[slide]}
              in:fly={{
                x: reducedMotion ? 0 : slideDirection * 35,
                duration: reducedMotion ? 0 : 260
              }}
            >
              <div class="portrait framed">
                <div class="gold-frame" aria-hidden="true"></div>
                <div class="frame-art">
                  {#if featuredCharacter}<CompanionSprite
                      character={featuredCharacter}
                      width={146}
                    />{:else}<BookOpen size={56} strokeWidth={1} />{/if}
                </div>
                <div class="frame-label">
                  {featuredCharacter
                    ? name(featuredCharacter)
                    : tr('留给下一次相遇', 'A place for the next encounter')}
                </div>
              </div>
              <div class="hero-copy">
                <p class="eyebrow">{heroTitle} · {s.day}</p>
                <h2>
                  {slide === 0
                    ? tr('在微小进步里，\n遇见新的伙伴。', 'Small steps.\nNew companions.')
                    : slide === 1
                      ? tr(
                          '留一页心动，\n珍藏今日相遇。',
                          'A page to remember.\nToday’s special encounter.'
                        )
                      : tr(
                          '一路相伴，\n让珍贵被看见。',
                          'A companion for the journey.\nA legend to treasure.'
                        )}
                </h2>
                {#if featuredCharacter}
                  <p class="hero-caption">
                    <span>{name(featuredCharacter)}</span><span
                      class="tier-badge"
                      data-tier={featuredCharacter.tier}
                      >{featuredCharacter.special === 'monthly'
                        ? tr('月度纪念', 'Monthly memorial')
                        : tier(featuredCharacter.tier)}</span
                    >
                    {#if !guest && slide === 1}<span class="discount-badge">−50%</span>{/if}
                  </p>
                  {#if !guest && slide === 1 && featured?.price !== undefined}<p class="hero-price">
                      <del>{featured.originalPrice}</del> <strong>{featured.price}</strong>
                      {tr('灵墨', 'Ink')}
                    </p>{/if}
                  {#if !guest && slide === 2}<p class="muted">
                      {tr(
                        `${featured?.ownerCount ?? 0} 位学习者珍藏`,
                        `Collected by ${featured?.ownerCount ?? 0} learners`
                      )}
                    </p>{/if}
                  {#if guest}<p class="muted">
                      {tr(
                        '本地图鉴预览；每日折扣与本期寻访奖池在登录后显示。',
                        'Local catalog preview. Sign in for daily discounts and the current discovery pool.'
                      )}
                    </p>{/if}
                  <button class="btn primary" data-gallery-featured onclick={openFeatured}
                    >{guest && slide === 0 && !guestCollection.starter
                      ? tr('挑选免费伙伴', 'Choose a free companion')
                      : !guest && slide === 1
                        ? tr('前往兑换', 'Visit shop')
                        : tr('查看语言伙伴', 'View companion')}<ArrowUpRight size={15} /></button
                  >
                {:else}<p class="muted hero-empty">
                    {slide === 0
                      ? tr(
                          '今天还没有新增馆藏。完成学习，再开启一场寻访。',
                          'No new acquisitions today. Keep learning, then discover a new companion.'
                        )
                      : tr(
                          '馆藏正在更新，请稍后刷新。',
                          'The gallery is being updated. Refresh in a moment.'
                        )}
                  </p>
                  <button class="btn" onclick={() => (tab = 'tasks')}
                    >{tr('今日任务', 'Today’s tasks')}<ArrowUpRight size={15} /></button
                  >{/if}
              </div>
            </div>
          {/key}
        </div>
        <div class="carousel-controls">
          <button
            class="btn carousel-arrow"
            aria-label={tr('上一张', 'Previous slide')}
            onclick={() => changeSlide((slide + 2) % 3)}><ArrowLeft size={16} /></button
          >
          <div class="dots" aria-label={tr('选择画廊图片', 'Choose a gallery slide')}>
            {#each slideTypes as type, index (type)}<button
                data-hero-dot={index}
                data-gallery-dot={index}
                class:active={slide === index}
                aria-label={(guest
                  ? [
                      tr('初识伙伴', 'First companion'),
                      tr('伙伴图鉴', 'Companion catalog'),
                      tr('珍贵相遇', 'Rare encounters')
                    ]
                  : [
                      tr('今日新增', 'Today’s new acquisitions'),
                      tr('今日半价', 'Today’s discount'),
                      tr('人气传颂', 'Popular legend')
                    ])[index]}
                aria-current={slide === index ? 'true' : undefined}
                onkeydown={(event) => {
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault()
                    const next = (slide + (event.key === 'ArrowRight' ? 1 : 2)) % 3
                    changeSlide(next)
                    document
                      .querySelector<HTMLButtonElement>(`[data-gallery-dot="${next}"]`)
                      ?.focus()
                  }
                }}
                onclick={() => changeSlide(index)}
              ></button>{/each}
          </div>
          <button
            class="btn carousel-arrow"
            aria-label={tr('下一张', 'Next slide')}
            onclick={() => changeSlide((slide + 1) % 3)}><ArrowRight size={16} /></button
          >
        </div>
      </section>
      <div class="section-head">
        <div>
          <p class="eyebrow">{tr('小小收藏，长长旅程', 'Small treasures, a long journey')}</p>
          <h2>
            {currentGroup
              ? currentGroup.name[i18n.locale]
              : tr('语言伙伴图鉴', 'Companion catalog')}
          </h2>
        </div>
        <span>{s.characters.length} / {s.catalog.length} {tr('已珍藏', 'collected')}</span>
      </div>
      {#if !currentGroup}<div class="grid species-grid">
          {#each groups as group (group.id)}
            {@const members = s.catalog.filter((c) => group.characterIds.includes(c.id))}
            {@const collected = members.filter((c) =>
              s.characters.some((o) => o.id === c.id)
            ).length}
            <button
              class="card species-card"
              data-species={group.id}
              onclick={() => {
                speciesId = group.id
                selected = ''
              }}
            >
              <div class="species-preview">
                {#each members.slice(0, 3) as c (c.id)}<CompanionSprite
                    character={c}
                    width={72}
                  />{/each}
              </div>
              <div class="species-label">
                <strong>{group.name[i18n.locale]}</strong><ArrowUpRight size={16} />
              </div>
              <small>{collected} / {members.length} {tr('已珍藏', 'collected')}</small>
              <div class="species-progress">
                <span style:width={`${members.length ? (collected / members.length) * 100 : 0}%`}
                ></span>
              </div>
            </button>
          {/each}
        </div>{:else}
        <button
          class="btn ghost back"
          data-species-back
          onclick={() => {
            speciesId = ''
            selected = ''
          }}><ArrowLeft size={15} />{tr('全部物种', 'All species')}</button
        >
        <div class="grid specimen-grid" data-species-entries={currentGroup.id}>
          {#each groupMembers as c (c.id)}{@const entry = s.characters.find(
              (o) => o.id === c.id
            )}<button
              class="card companion"
              class:owned={!!entry}
              data-character={c.id}
              data-entry={c.id}
              aria-pressed={selected === c.id}
              onclick={() => (selected = c.id)}
              ><div class="specimen-art">
                <CompanionSprite character={c} width={116} locked={!entry} />
              </div>
              <strong>{name(c)}</strong><span class="tier-badge" data-tier={c.tier}
                >{c.special === 'monthly' ? tr('月度纪念', 'Monthly memorial') : tier(c.tier)}</span
              ><small
                >{entry
                  ? `${tr('已收藏', 'Collected')} ×${entry.count}`
                  : tr('尚未相遇', 'Not yet encountered')}</small
              ></button
            >{/each}
        </div>
      {/if}
      {#if selected && chosen}<section class="card detail" data-character-detail>
          <button
            class="btn ghost close"
            aria-label={tr('关闭详情', 'Close details')}
            onclick={() => (selected = '')}><X size={16} /></button
          >
          <div class="detail-header">
            <div class="portrait detail-portrait">
              <CompanionSprite character={chosen} width={164} />
            </div>
            <div class="detail-intro">
              <p class="eyebrow">
                {chosen.special === 'monthly'
                  ? tr('月度纪念', 'Monthly memorial')
                  : tier(chosen.tier)} · {currentGroup?.name[i18n.locale] ??
                  tr('语言伙伴', 'Language companion')}
              </p>
              <h2>{name(chosen)}</h2>
              <p>
                {owned
                  ? tr(
                      `共相遇 ${owned.count} 次；首次 ${new Date(owned.firstAt).toLocaleString('zh-CN')}`,
                      `Encountered ${owned.count} times; first ${new Date(owned.firstAt).toLocaleString('en')}`
                    )
                  : tr(
                      chosen.special === 'monthly'
                        ? '完成整月的每日任务，即可珍藏这位语言伙伴。'
                        : '通过寻访相遇；初识与相知也可在商店直接兑换。',
                      chosen.special === 'monthly'
                        ? 'Complete the daily tasks for an entire calendar month to collect this companion.'
                        : 'Meet through discovery; Acquaintance and Affinity are also available directly in the shop.'
                    )}
              </p>
              <button
                class="btn primary"
                data-companion-select={chosen.id}
                disabled={guest || !online || !owned || s.companion?.currentId === chosen.id}
                onclick={() =>
                  account.mutate('selectCompanion', {
                    requestId: crypto.randomUUID(),
                    characterId: chosen.id,
                    expectedCurrentId: s.companion?.currentId ?? null
                  })}
              >
                {#if s.companion?.currentId === chosen.id}<Check size={15} />{tr(
                    '正在一起成长',
                    'Growing together'
                  )}{:else}<Sparkles size={15} />{owned
                    ? tr('选择为养成伙伴', 'Choose as your companion')
                    : tr('珍藏后可选择养成', 'Collect to choose this companion')}{/if}
              </button>
              {#if guest && !owned && chosen.tier === 'A' && !chosen.special}
                {@const starterItem = s.shop.find(
                  (item) => item.type === 'character' && item.characterId === chosen.id
                )}
                {#if starterItem}<button
                    class="btn"
                    data-guest-detail-claim
                    disabled={guestCollection.busy || account.loading || account.busy}
                    onclick={() => askPurchase(starterItem)}
                    >{guestCollection.starter
                      ? tr('登录兑换更多', 'Sign in for more companions')
                      : tr('免费迎接这位伙伴', 'Welcome this companion for free')}</button
                  >{/if}
              {/if}
            </div>
          </div>
          <CompanionBiography character={chosen} companion={s.companion} />
        </section>{/if}
      {#if s.monthly}
        {@const monthlyCharacter = s.catalog.find((c) => c.id === s.monthly?.rewardId)}
        <section class="card monthly" data-monthly-collection>
          <div class="monthly-art">
            {#if monthlyCharacter}<CompanionSprite
                character={monthlyCharacter}
                width={90}
                locked={!s.monthly.claimed}
              />{:else}<CalendarDays size={36} />{/if}
          </div>
          <div>
            <p class="eyebrow">{s.monthly.month} · {tr('月度限定纪念', 'Monthly memorial')}</p>
            <h3>{tr('把每一天，都写进这一页。', 'A page for every day.')}</h3>
            <p class="muted">
              {tr(
                '连续完成本月每天的三项任务，收藏本月专属语言伙伴。续页笺不计入月度进度。',
                'Complete all three daily tasks on every day of this calendar month to collect its exclusive companion. Makeup slips do not count.'
              )}
            </p>
            <progress max={s.monthly.requiredDays} value={s.monthly.completedDays.length}
            ></progress>
            <small
              >{s.monthly.completedDays.length} / {s.monthly.requiredDays}
              {tr('天', 'days')} · {s.monthly.claimed
                ? tr('已珍藏', 'Collected')
                : tr('达标后自动赠送', 'Awarded automatically upon completion')}</small
            >
          </div>
        </section>
      {/if}
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
              {#if c}<CompanionSprite character={c} /><strong>{name(c)}</strong>{/if}<small
                >{old.day} · {old.minutes} {tr('分钟', 'minutes')}</small
              >
            </div>{/each}
        </div>
        <LegacyCollection />
      </details>
    {:else if tab === 'home'}
      <CompanionHome snapshot={s} {online} {guest} />
    {:else if tab === 'tasks'}
      {#if guest}<div class="notice" data-guest-tasks>
          <span
            >{tr(
              '登录后，联网完成学习与每日任务即可获得灵墨。未登录时学习记录仍保存在本机，当前预览不计入账号任务。',
              'Sign in and learn online to earn Ink from study and daily tasks. Guest study records stay on this device; this preview does not complete account tasks.'
            )}</span
          >
          <button class="btn" onclick={() => requireLogin('browse')}
            >{tr('登录开启任务', 'Sign in for tasks')}</button
          >
        </div>{/if}
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
      {#if shopTier}
        <nav class="shop-breadcrumb" aria-label={tr('商店位置', 'Shop location')}>
          <button class="btn ghost" data-shop-back onclick={() => (shopTier = '')}
            ><ArrowLeft size={15} />{tr('返回灵墨商店', 'Back to Ink shop')}</button
          >
          <span aria-hidden="true">/</span><span
            >{tier(shopTier)} · {tr('语言伙伴', 'Language companions')}</span
          >
        </nav>
        <div class="section-head">
          <div>
            <p class="eyebrow">CHOOSE YOUR COMPANION</p>
            <h2>{tr(`${tier(shopTier)}语言伙伴`, `${tier(shopTier)} companions`)}</h2>
          </div>
          <span>{tr('挑选一位新的伙伴', 'Choose a new companion')}</span>
        </div>
        <ShopProducts
          items={s.shop.filter((item) => item.type === 'character' && item.tier === shopTier)}
          snapshot={s}
          {online}
          {guest}
          starterAvailable={!guestCollection.starter}
          busy={guest && (!guestReady || guestCollection.busy)}
          redeem={askPurchase}
        />
      {:else}
        <div class="section-head">
          <div>
            <p class="eyebrow">THE LITTLE EMPORIUM</p>
            <h2>{tr('灵墨商店', 'Ink shop')}</h2>
          </div>
          <span>{tr('用学习，珍藏相遇', 'Treasures earned through learning')}</span>
        </div>
        <div class="grid shop-tiers">
          {#each ['A', 'R'] as quality (quality)}
            {@const available = s.catalog.filter(
              (c) => c.tier === quality && c.special !== 'monthly'
            )}
            <button
              class="card shop-tier"
              data-shop-tier={quality}
              onclick={() => (shopTier = quality)}
            >
              <div class="shop-tier-art">
                {#each available.slice(0, 3) as c (c.id)}<CompanionSprite
                    character={c}
                    width={64}
                  />{/each}
              </div>
              <p class="eyebrow">{tier(quality)}</p>
              <h3>{tr(`兑换${tier(quality)}语言伙伴`, `Redeem ${tier(quality)} companions`)}</h3>
              {#if guest && quality === 'A' && !guestCollection.starter}<small
                  class="free-starter-label"
                  >{tr('本机任选一只 · 免费一次', 'Choose one on this device · free once')}</small
                >{/if}
              <span class="shop-tier-link"
                >{tr('进入挑选', 'Choose a companion')}<ArrowUpRight size={16} /></span
              >
            </button>
          {/each}
        </div>
        <div class="section-head">
          <div>
            <p class="eyebrow">FOR THE JOURNEY</p>
            <h3>{tr('学习补给', 'Study supplies')}</h3>
          </div>
        </div>
        <ShopProducts
          items={s.shop.filter((item) => item.type !== 'character' && item.currency === 'points')}
          snapshot={s}
          {online}
          {guest}
          busy={account.busy || account.loading || (guest && !account.loaded)}
          redeem={askPurchase}
          support={() => void openSupport()}
          supportEntry
          {supportOpen}
        />
        {#if supportOpen}<section
            class="card support"
            id="collection-support-panel"
            data-support-panel
            aria-labelledby="collection-support-heading"
          >
            <h3 id="collection-support-heading" tabindex="-1" bind:this={supportHeading}>
              {tr('支持开发 · 测试订单', 'Support development · test orders')}
            </h3>
            <p class="muted">
              {tr(
                '支持订单只提供支持寻访笺，不增加灵墨、学习寻访笺或续页笺；学习补给仍需通过学习积累灵墨兑换。',
                'Support orders provide support tickets only, not Ink, learning tickets or makeup slips. Earn Ink by studying to redeem study supplies.'
              )}
            </p>
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
              disabled={(!guest && !online) ||
                account.busy ||
                !Number.isInteger(supportTickets) ||
                supportTickets < 1 ||
                supportTickets > 10}
              data-support-create
              onclick={askSupport}>{tr('创建测试订单', 'Create test order')}</button
            ><button
              class="btn ghost"
              disabled={(!guest && !online) || orderLoading}
              onclick={() => (guest ? requireLogin('support') : loadOrders())}
              >{tr('查看订单', 'View orders')}</button
            >{#if !guest && account.lastOrder}<p data-support-order>
                {account.lastOrder.id} · {account.lastOrder.amountFen / 100} CNY · {orderStatus(
                  account.lastOrder.status,
                  i18n.locale
                )}
              </p>{/if}{#if !guest && orderError}<p role="alert">
                {accountError(orderError, i18n.locale)}
              </p>{/if}{#each guest ? [] : orders as order (order.id)}<p>
                {order.id} · {order.tickets}
                {tr('张', 'tickets')} · {order.amountFen / 100} CNY · {orderStatus(
                  order.status,
                  i18n.locale
                )}
              </p>{/each}
          </section>{/if}
        <section class="echo-shop" data-echo-shop>
          <div class="section-head">
            <div>
              <p class="eyebrow">THE ECHO CORNER</p>
              <h3>{tr('余韵小铺', 'Echo corner')}</h3>
            </div>
            <span>{s.balances.echoes} {tr('余韵', 'Echoes')}</span>
          </div>
          <p class="muted">
            {tr(
              '家具兑换区暂时留空，等待正式素材。每1000余韵可兑换一张学习寻访笺。',
              'Furniture exchange is reserved for future artwork. Exchange 1,000 Echoes for one learning discovery ticket.'
            )}
          </p>
          <ShopProducts
            items={s.shop.filter((item) => item.currency === 'echoes' && item.type === 'ticket')}
            snapshot={s}
            {online}
            {guest}
            busy={guest && (!account.loaded || account.loading || account.busy)}
            redeem={askPurchase}
          />
          <div class="furniture-empty" data-furniture-shop>
            <BookOpen size={22} strokeWidth={1.2} /><span
              >{tr('家具区 · 尚未上架', 'Furniture · not available yet')}</span
            >
          </div>
        </section>
      {/if}
    {:else if tab === 'draw'}
      {#if s.drawPool}<DiscoveryCorridor catalog={s.catalog} pool={s.drawPool} />{:else}<p
          class="notice"
          role="status"
        >
          {tr(
            guest ? '登录后查看本期寻访长廊与奖池。' : '本期奖池尚不可用，请刷新账号连接。',
            guest
              ? 'Sign in to see the current discovery corridor and pool.'
              : 'The current pool is unavailable. Please refresh your connection.'
          )}
        </p>{/if}
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
            disabled={account.busy ||
              (!guest && (!online || !s.drawPool || s.balances.tickets[source] < 1))}
            onclick={() => askDraw(1)}>{tr('寻访一次 · 1 张', 'Discover once · 1 ticket')}</button
          ><button
            class="btn"
            data-draw-ten
            disabled={account.busy ||
              (!guest && (!online || !s.drawPool || s.balances.tickets[source] < 10))}
            onclick={() => askDraw(10)}
            >{tr('寻访十次 · 10 张', 'Discover ten · 10 tickets')}</button
          ><button class="btn ghost" onclick={() => (rulesOpen = !rulesOpen)}
            >{tr('查看概率与保底', 'Odds and guarantees')}</button
          >
        </div>
        {#if !guest}<p data-pity>
            {tr('距上次传颂', 'Since last Legend')}: {s.pity.sinceSSR} · {tr(
              '距上次高阶',
              'Since last high tier'
            )}: {s.pity.sinceHigh}
          </p>
          <p>
            {tr('下一抽传颂概率', 'Next Legend chance')}: {(
              (probabilities?.SSR ?? 0) * 100
            ).toFixed(1)}% · {tr('至多', 'At most')}
            {Math.max(1, Number(s.drawRules.hardSSR) - s.pity.sinceSSR)}
            {tr('抽遇传颂', 'draws to Legend')} · {Math.max(
              1,
              Number(s.drawRules.highPity) - s.pity.sinceHigh
            )}
            {tr('抽遇珍遇或传颂', 'draws to Rare encounter or Legend')}
          </p>
        {:else}<p class="muted" data-guest-draw-help>
            {tr(
              '寻访记录与保底保存在账号中，登录后显示。',
              'Discovery history and guarantees are saved to your account and shown after sign-in.'
            )}
          </p>{/if}
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
                '重复相遇分别获得 1 / 3 / 8 / 20 余韵，留作未来家具兑换；每1000余韵也可兑换一张学习寻访笺。',
                'Duplicates grant 1 / 3 / 8 / 20 Echoes, reserved for future furniture. Every 1,000 Echoes can also be exchanged for a learning ticket.'
              )}
            </p>
          </div>{/if}
      </section>
      {#if !guest && account.lastDraw.length}<section aria-live="polite" data-draw-results>
          <h3>{tr('本次相遇', 'Your encounters')}</h3>
          <div class="grid">
            {#each account.lastDraw as result, i (i)}{@const c = s.catalog.find(
                (c) => c.id === result.id
              )}
              <div class="card companion" data-draw-result={i}>
                {#if c}<div class="specimen-art"><CompanionSprite character={c} width={116} /></div>
                  <strong>{name(c)}</strong>{/if}<span class="tier-badge" data-tier={result.tier}
                  >{tier(result.tier)}</span
                ><small
                  >{result.duplicate
                    ? tr(`重复 · +${result.echoes} 余韵`, `Duplicate · +${result.echoes} echoes`)
                    : tr('初次相遇', 'First encounter')}</small
                >
              </div>{/each}
          </div>
        </section>{/if}
    {:else if guest}<section class="card" data-guest-inventory>
        <h2>{tr('本机珍藏', 'Saved on this device')}</h2>
        <p>
          {guestCollection.starter
            ? tr(
                '第一位伙伴已保存在本机。登录后可同步首次伙伴，并查看账号背包与签到记录。',
                'Your first companion is saved on this device. Sign in to sync your first companion and see account inventory and check-ins.'
              )
            : tr(
                '你还没有领取第一位伙伴。前往商店，可任选一位初识伙伴免费领取。',
                'Your first companion is waiting. Visit the shop to choose one Acquaintance companion for free.'
              )}
        </p>
        <button class="btn" onclick={() => requireLogin('browse')}
          >{tr('登录查看账号背包', 'Sign in for account inventory')}</button
        >
      </section>
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
          confirm.local
            ? '本次选择只保存到本机，不创建账号，也不会扣除灵墨。'
            : '以服务器核验结果为准。若连接中断，可重试原请求。',
          confirm.local
            ? 'This choice is saved on this device. It does not create an account or spend Ink.'
            : 'Subject to server validation. If the connection fails, retry the original request.'
        )}
      </p>
      <div class="actions">
        <button class="btn" data-transaction-cancel onclick={() => (confirm = null)}
          >{tr('取消', 'Cancel')}</button
        ><button
          class="btn primary"
          data-transaction-confirm
          disabled={confirm.local ? !guestReady : !online}
          onclick={execute}>{tr('确认', 'Confirm')}</button
        >
      </div>
    </div>
  </div>{/if}
{#if loginReason}<CollectionLoginDialog
    reason={loginReason}
    close={() => (loginReason = null)}
  />{/if}

<style>
  .guest-welcome {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    padding: 24px 26px;
    margin: 0 0 25px;
    border: 1px solid var(--gallery-border);
    border-radius: 18px;
    background: linear-gradient(
      120deg,
      color-mix(in srgb, var(--gallery-sage) 17%, transparent),
      var(--gallery-paper)
    );
  }
  .guest-welcome h2 {
    font-size: 21px;
    margin: 8px 0;
  }
  .guest-welcome p:not(.eyebrow) {
    max-width: 650px;
    margin: 7px 0 0;
    line-height: 1.7;
    font-size: 13px;
    color: var(--text-2);
  }
  .guest-welcome .actions {
    flex-shrink: 0;
    flex-direction: column;
  }
  .free-starter-label {
    color: var(--gallery-ink);
    margin: 0 0 14px;
    font-size: 12px;
  }
  @media (max-width: 800px) {
    .guest-welcome {
      flex-direction: column;
      align-items: stretch;
      padding: 20px;
    }
    .guest-welcome .actions {
      flex-direction: row;
    }
  }
  .glow .portrait {
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent),
      0 0 30px color-mix(in srgb, var(--accent) 18%, transparent);
  }
  .glow .companion.owned {
    box-shadow: inset 0 0 20px color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .collection {
    --gallery-paper: #f7f6ef;
    --gallery-sage: #becda0;
    --gallery-ink: #56663c;
    --gallery-gold: #b59d67;
    --gallery-border: #d9ddcd;
    --gallery-mat: #30372b;
    --gallery-mat-ink: #d0dcba;
    max-width: 1240px;
    padding-bottom: 50px;
  }
  :global([data-theme='dark']) .collection {
    --gallery-paper: #252920;
    --gallery-sage: #b8c99a;
    --gallery-ink: #c0d0a5;
    --gallery-gold: #b5a073;
    --gallery-border: #414937;
  }
  .page-head {
    margin-bottom: 18px;
  }
  h1 {
    font-size: 32px;
    letter-spacing: 0.02em;
    margin-top: 7px;
  }
  .collection .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    min-height: 40px;
    padding: 10px 17px;
    border-radius: 11px;
    border: 1px solid var(--gallery-border);
    background: transparent;
    color: var(--text);
    font-weight: 500;
    font-size: 13px;
    line-height: 1.4;
    transition:
      background 0.18s,
      border-color 0.18s;
  }
  .collection .btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--gallery-sage) 16%, transparent);
    border-color: var(--gallery-sage);
  }
  .collection .btn.primary {
    background: var(--gallery-sage);
    border-color: var(--gallery-sage);
    color: #253019;
  }
  .collection .btn.primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--gallery-sage) 86%, white);
  }
  .collection .btn.ghost {
    border-color: transparent;
    color: var(--text-2);
  }
  .collection .btn:focus-visible,
  .species-card:focus-visible,
  .shop-tier:focus-visible,
  .companion:focus-visible,
  .dots button:focus-visible {
    outline: 2px solid var(--gallery-ink);
    outline-offset: 4px;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.12em;
    color: var(--gallery-ink);
    font-weight: 600;
  }
  .hero {
    position: relative;
    overflow: hidden;
    padding: 29px 34px 14px;
    border: 1px solid var(--gallery-border);
    border-radius: 22px;
    background:
      radial-gradient(
        ellipse at 0 0,
        color-mix(in srgb, var(--gallery-sage) 14%, transparent),
        transparent 70%
      ),
      var(--gallery-paper);
  }
  .hero-viewport {
    min-height: 280px;
  }
  .hero-slide {
    display: grid;
    grid-template-columns: 210px minmax(0, 1fr);
    gap: 42px;
    align-items: center;
  }
  .hero-copy {
    padding: 8px 0;
    min-width: 0;
  }
  .hero-copy h2 {
    white-space: pre-line;
    font-size: clamp(24px, 2.8vw, 34px);
    line-height: 1.42;
    font-weight: 600;
    letter-spacing: 0.025em;
    margin: 13px 0 16px;
  }
  .hero-copy .btn {
    margin-top: 10px;
  }
  .hero-caption {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
    margin: 8px 0;
  }
  .hero-empty {
    max-width: 400px;
    min-height: 44px;
  }
  .hero-price {
    margin: 8px 0;
  }
  .hero-price strong {
    font-size: 24px;
    margin: 0 8px;
    color: var(--text);
  }
  del {
    font-size: 13px;
    color: var(--text-3);
    font-weight: 400;
    margin-right: 6px;
  }
  .carousel-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    margin-top: 18px;
  }
  .collection .carousel-arrow {
    min-height: 30px;
    width: 32px;
    padding: 6px;
    border-color: transparent;
  }
  .dots {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .dots button {
    display: grid;
    place-items: center;
    width: 26px;
    height: 28px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .dots button::after {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-3);
    opacity: 0.4;
    transition: width 0.2s;
  }
  .dots button.active::after {
    width: 18px;
    border-radius: 6px;
    opacity: 1;
    background: var(--gallery-ink);
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
    background: var(--gallery-mat);
    border-radius: 18px;
    padding: 12px;
  }
  .framed {
    width: 210px;
    height: 255px;
    position: relative;
    border-radius: 0;
    background: transparent;
    padding: 0;
  }
  .gold-frame {
    position: absolute;
    inset: 0;
    border: 9px solid var(--gallery-gold);
    transform: rotate(3deg);
    background: var(--gallery-mat);
    box-shadow:
      inset 0 0 0 8px color-mix(in srgb, var(--gallery-sage) 13%, var(--bg-sunken)),
      0 6px 18px #0000000a;
  }
  .frame-art {
    position: relative;
    display: grid;
    place-items: center;
    margin-top: 8px;
    color: var(--gallery-mat-ink);
  }
  .frame-label {
    position: absolute;
    bottom: 23px;
    text-align: center;
    left: 18px;
    right: 18px;
    font-size: 12px;
    letter-spacing: 0.12em;
    color: var(--gallery-mat-ink);
  }
  .wallet {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 24px;
    margin-top: 0;
    margin-bottom: 20px;
  }
  .wallet > span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--text-2);
    padding: 5px 0;
    font-size: 12px;
  }
  .wallet b {
    font-size: 21px;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .tabs {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 0 0 27px;
    border-bottom: 1px solid var(--gallery-border);
    padding-bottom: 15px;
  }
  .tabs .on {
    background: var(--gallery-sage);
    color: #253019;
    border-color: var(--gallery-sage);
  }
  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin: 29px 0 16px;
  }
  .section-head .eyebrow {
    margin: 0;
  }
  .section-head h2 {
    margin: 8px 0 0;
  }
  .section-head > span {
    font-size: 12px;
    color: var(--text-2);
    white-space: nowrap;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 15px;
  }
  .card {
    background: color-mix(in srgb, var(--gallery-paper) 25%, var(--bg-elev));
    border: 1px solid var(--gallery-border);
    border-radius: 16px;
    padding: 22px;
    min-width: 0;
    margin-bottom: 18px;
  }
  .species-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .species-card {
    cursor: pointer;
    color: var(--text);
    text-align: start;
    padding: 20px;
    transition:
      border-color 0.18s,
      background 0.18s;
  }
  .species-card:hover {
    border-color: var(--gallery-gold);
    background: var(--gallery-paper);
  }
  .species-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    min-height: 115px;
    background: var(--gallery-mat);
    border-radius: 11px;
    margin-bottom: 18px;
  }
  .species-label {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    margin-bottom: 8px;
  }
  .species-label strong {
    font-size: 17px;
    font-weight: 600;
  }
  .species-progress {
    height: 3px;
    border-radius: 8px;
    background: var(--gallery-border);
    margin-top: 14px;
    overflow: hidden;
  }
  .species-progress > span {
    display: block;
    height: 100%;
    background: var(--gallery-sage);
  }
  .back {
    margin-bottom: 15px;
  }
  .specimen-art {
    min-height: 123px;
    display: grid;
    place-items: center;
    width: 100%;
    margin-bottom: 6px;
    background: var(--gallery-mat);
    border-radius: 10px;
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
    border-color: color-mix(in srgb, var(--gallery-gold) 55%, var(--gallery-border));
  }
  small {
    color: var(--text-3);
    font-size: 12px;
  }
  .tier-badge {
    display: inline-flex;
    font-size: 10px;
    letter-spacing: 0.05em;
    padding: 4px 8px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--gallery-sage) 15%, transparent);
    color: var(--gallery-ink);
  }
  .tier-badge[data-tier='SR'] {
    background: color-mix(in srgb, #9386ad 16%, transparent);
    color: color-mix(in srgb, #9386ad 78%, var(--text));
  }
  .tier-badge[data-tier='SSR'] {
    background: color-mix(in srgb, var(--gallery-gold) 15%, transparent);
    color: color-mix(in srgb, var(--gallery-gold) 80%, var(--text));
  }
  .discount-badge {
    font-size: 11px;
    border-radius: 6px;
    padding: 4px 8px;
    background: #b7553d;
    color: #fff;
    font-weight: 600;
  }
  .detail {
    display: block;
    position: relative;
    margin-top: 25px;
  }
  .detail-header {
    display: grid;
    grid-template-columns: 195px minmax(0, 1fr);
    gap: 30px;
    align-items: center;
  }
  .detail-portrait {
    min-height: 220px;
    border: 1px solid var(--gallery-border);
    border-radius: 13px;
  }
  .detail-intro {
    padding-right: 20px;
    min-width: 0;
  }
  .detail-intro .btn {
    margin-top: 8px;
  }
  .monthly {
    display: grid;
    grid-template-columns: 105px minmax(0, 1fr);
    gap: 25px;
    align-items: center;
    margin-top: 26px;
    background: var(--gallery-paper);
  }
  .monthly-art {
    display: grid;
    place-items: center;
  }
  .monthly h3 {
    margin: 10px 0;
  }
  .monthly progress {
    margin: 4px 0 9px;
  }
  .grid.shop-tiers {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-bottom: 24px;
  }
  .shop-tier {
    text-align: left;
    color: var(--text);
    cursor: pointer;
    position: relative;
    overflow: hidden;
  }
  .shop-tier-art {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px 0 20px;
    background: var(--gallery-mat);
    border-radius: 11px;
    margin-bottom: 19px;
  }
  .shop-tier h3 {
    font-size: 19px;
    margin: 9px 0 16px;
  }
  .shop-tier-link {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 12px;
    color: var(--gallery-ink);
  }
  .shop-breadcrumb {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: var(--text-3);
  }
  .shop-breadcrumb .btn {
    padding-left: 0;
  }
  .echo-shop {
    margin-top: 35px;
    padding-top: 8px;
    border-top: 1px solid var(--gallery-border);
  }
  .furniture-empty {
    display: flex;
    justify-content: center;
    gap: 12px;
    align-items: center;
    min-height: 92px;
    border: 1px dashed var(--gallery-border);
    border-radius: 12px;
    color: var(--text-3);
    font-size: 12px;
    margin-top: 16px;
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
    accent-color: var(--gallery-ink);
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
      padding: 25px 25px 12px;
    }
    .hero-slide {
      grid-template-columns: 180px minmax(0, 1fr);
      gap: 30px;
    }
    .framed {
      width: 180px;
      height: 240px;
    }
    .species-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .species-preview {
      flex-wrap: wrap;
      gap: 0;
    }
  }
  @media (max-width: 736px) {
    .grid,
    .tasks {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .hero {
      padding: 25px 22px 12px;
    }
    .hero-slide {
      grid-template-columns: minmax(0, 1fr);
      gap: 22px;
    }
    .framed {
      justify-self: center;
      width: 190px;
      height: 245px;
    }
    .hero-copy {
      text-align: center;
      padding: 0;
    }
    .hero-caption {
      justify-content: center;
    }
    .hero-copy h2 {
      font-size: 28px;
    }
    .hero-empty {
      margin-left: auto;
      margin-right: auto;
    }
    .hero-viewport {
      min-height: 500px;
    }
    .detail-header {
      grid-template-columns: minmax(0, 1fr);
      gap: 20px;
    }
    .detail-portrait {
      max-width: 220px;
      width: 100%;
      justify-self: center;
    }
    .detail-intro {
      padding: 0;
    }
    .monthly {
      grid-template-columns: 70px minmax(0, 1fr);
      gap: 18px;
    }
    .card {
      padding: 17px;
    }
    .wallet {
      gap: 8px;
    }
    .wallet > span {
      padding: 5px 8px 5px 0;
    }
    .wallet b {
      font-size: 17px;
    }
  }
  @media (max-width: 420px) {
    .tasks {
      grid-template-columns: minmax(0, 1fr);
    }
    .grid {
      gap: 9px;
    }
    .companion {
      padding: 15px 8px;
    }
    .species-grid,
    .grid.shop-tiers {
      grid-template-columns: 1fr;
    }
    .section-head {
      align-items: flex-start;
    }
    .section-head > span {
      white-space: normal;
      text-align: right;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .collection .btn,
    .species-card,
    .dots button::after {
      transition: none;
    }
  }
</style>
