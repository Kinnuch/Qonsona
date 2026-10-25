<script lang="ts">
  import { onMount } from 'svelte'
  import { ArrowLeft, ArrowRight, Check, Coffee, Gift, RefreshCw, Ticket } from '@lucide/svelte'
  import { i18n } from '$lib/i18n/index.svelte'
  import type { AccountPaymentCapabilities, SupportOrder } from '$shared/account'
  import { accountError } from './errors'
  import { orderStatus } from './presentation'
  import {
    customSupportChoice,
    supportYuan,
    unresolvedSupportOrder,
    type SupportChoice
  } from './support-plans'

  let {
    payments,
    online,
    busy,
    orders,
    ordersLoaded,
    orderLoading,
    orderError,
    back,
    purchase,
    viewOrder,
    refreshOrders
  }: {
    payments: AccountPaymentCapabilities | undefined
    online: boolean
    busy: boolean
    orders: SupportOrder[]
    ordersLoaded: boolean
    orderLoading: boolean
    orderError: string
    back: () => void
    purchase: (choice: SupportChoice) => void
    viewOrder: (order: SupportOrder) => void
    refreshOrders: () => void
  } = $props()
  const tr = (zh: string, en: string): string => (i18n.locale === 'zh' ? zh : en)
  let selected = $state('')
  let customAmount = $state('6.00')
  const plans = $derived(payments?.plans ?? [])
  const pending = $derived(unresolvedSupportOrder(orders))
  const pendingId = $derived(pending?.id ?? payments?.firstPurchase?.pendingOrderId)
  const live = $derived(
    !!payments?.enabled &&
      payments.mode === 'live' &&
      payments.provider === 'yungouos' &&
      payments.eligible
  )
  const custom = $derived(customSupportChoice(customAmount, payments?.custom))
  const selectedPlan = $derived(plans.find((plan) => plan.id === selected))
  const choice = $derived<SupportChoice | null>(
    selected === 'custom'
      ? custom
      : selectedPlan
        ? {
            planId: selectedPlan.id,
            amountFen: selectedPlan.amountFen,
            baseTickets: selectedPlan.baseTickets,
            bonusTickets: selectedPlan.bonusTickets,
            tickets: selectedPlan.tickets
          }
        : null
  )
  const firstUnavailable = $derived(
    selectedPlan?.firstPurchaseOnly && payments?.firstPurchase?.eligible !== true
  )
  const canCreate = $derived(
    online &&
      live &&
      !busy &&
      ordersLoaded &&
      !orderError &&
      !pendingId &&
      !!choice &&
      !firstUnavailable
  )
  let pageHeading: HTMLHeadingElement | undefined
  onMount(() => pageHeading?.focus({ preventScroll: true }))
  function status(order: SupportOrder): string {
    return order.payment?.state === 'closed'
      ? tr('已确认关闭', 'Closure confirmed')
      : order.payment?.state === 'refund_review'
        ? tr('退款核对中', 'Refund under review')
        : order.payment?.state === 'creating'
          ? tr('付款入口待确认', 'Checkout unconfirmed')
          : orderStatus(order.status, i18n.locale)
  }
</script>

<section class="support-page" data-support-purchase-page aria-labelledby="support-purchase-title">
  <button class="back-link" data-support-page-back onclick={back}>
    <ArrowLeft size={16} />{tr('返回灵墨商店', 'Back to Ink shop')}
  </button>
  <header class="support-intro">
    <div class="intro-mark"><Coffee size={30} strokeWidth={1.3} /></div>
    <div>
      <p class="eyebrow">SUPPORT THE JOURNEY</p>
      <h2 id="support-purchase-title" tabindex="-1" bind:this={pageHeading}>
        {tr('支持开发', 'Support development')}
      </h2>
      <p>{tr('让语言的旅程，继续向前。', 'Help this language journey keep growing.')}</p>
    </div>
  </header>
  <p class="intro-note">
    {tr(
      '选择支持方案，获得支持寻访笺。灵墨、学习寻访笺与续页笺仍通过学习获得；购买不会提高寻访概率。',
      'Choose a support plan to receive support discovery tickets. Earn Ink, learning tickets and makeup slips through study. Purchases do not improve discovery odds.'
    )}
  </p>
  {#if !online || !live}<p class="notice" role="status" data-support-payment-availability>
      {!online
        ? tr(
            '当前离线，暂不能创建付款订单。重新连接后可继续核对已有订单。',
            'You are offline. Reconnect before creating a payment order or checking an existing order.'
          )
        : tr(
            '在线付款暂不可用，请勿付款。可以查看已保存的订单。',
            'Online checkout is unavailable. Do not make a payment. Saved orders remain available to view.'
          )}
    </p>{/if}
  {#if pendingId}<div class="pending-notice" role="status" data-support-pending-order>
      <div>
        <strong>{tr('先查看已有的订单', 'Continue your existing order')}</strong>
        <p>
          {tr(
            '有一笔未完成订单，请核对同一笔付款，避免重复下单。超过十分钟的未付款订单由服务器核对后关闭；结果不明时会继续保留。',
            'An order is still unresolved. Check that payment before creating another. After ten minutes the server checks and closes unpaid orders; uncertain results remain pending.'
          )}
        </p>
      </div>
      {#if pending}<button
          class="btn"
          data-support-resume-order
          onclick={() => viewOrder(pending!)}
          disabled={!online || busy}>{tr('继续查看', 'Continue')}<ArrowRight size={15} /></button
        >
      {:else}<button class="btn" onclick={refreshOrders} disabled={!online || orderLoading}
          >{tr('重新核对订单', 'Refresh orders')}</button
        >{/if}
    </div>{/if}
  <div class="plan-grid" data-support-plans>
    {#each plans as plan (plan.id)}
      {@const unavailable = !!plan.firstPurchaseOnly && payments?.firstPurchase?.eligible !== true}
      <button
        class="plan-card"
        class:selected={selected === plan.id}
        class:first-support={plan.firstPurchaseOnly}
        data-support-plan={plan.id}
        aria-pressed={selected === plan.id}
        disabled={busy || unavailable || !!pendingId}
        onclick={() => (selected = plan.id)}
      >
        <span class="plan-top"
          ><span class="plan-name">{plan.name[i18n.locale]}</span>{#if selected === plan.id}<Check
              size={16}
            />{:else if plan.firstPurchaseOnly}<Gift size={17} />{/if}</span
        >
        {#if plan.firstPurchaseOnly}<span class="plan-badge"
            >{payments?.firstPurchase?.claimed
              ? tr('首购已使用', 'First purchase used')
              : tr('每个账号仅一次', 'Once per account')}</span
          >{/if}
        <strong class="plan-price">¥{supportYuan(plan.amountFen)}</strong>
        <span class="plan-tickets"
          ><Ticket size={18} /><b>{plan.tickets}</b>{tr('张支持寻访笺', 'support tickets')}</span
        >
        <span class="plan-detail"
          >{plan.bonusTickets > 0
            ? tr(
                `${plan.baseTickets} 张 + 赠送 ${plan.bonusTickets} 张`,
                `${plan.baseTickets} + ${plan.bonusTickets} bonus tickets`
              )
            : tr('所示张数即为到账总数', 'Shown quantity is the total credit')}</span
        >
        <span class="plan-select"
          >{unavailable
            ? tr('不可重复领取', 'Unavailable again')
            : selected === plan.id
              ? tr('已选择', 'Selected')
              : tr('选择此方案', 'Choose this plan')}<ArrowRight size={14} /></span
        >
      </button>
    {/each}
  </div>
  {#if payments?.custom}<section
      class="custom-card"
      class:selected={selected === 'custom'}
      data-support-custom
    >
      <button
        class="custom-heading"
        data-support-plan="custom"
        aria-pressed={selected === 'custom'}
        disabled={busy || !!pendingId}
        onclick={() => (selected = 'custom')}
      >
        <div>
          <h3>{tr('自定义支持', 'Custom support')}</h3>
          <p>{tr('按照自己的节奏，为旅程添一笔。', 'Choose the amount that suits you.')}</p>
        </div>
        {#if selected === 'custom'}<Check size={18} />{:else}<ArrowRight size={18} />{/if}
      </button>
      <div class="custom-fields">
        <label for="support-custom-amount">{tr('金额（人民币元）', 'Amount (CNY)')}</label>
        <div class="custom-entry">
          <span aria-hidden="true">¥</span><input
            id="support-custom-amount"
            data-support-custom-amount
            type="text"
            inputmode="decimal"
            maxlength="9"
            bind:value={customAmount}
            aria-describedby="support-custom-hint"
            disabled={busy || !!pendingId}
            oninput={() => (selected = 'custom')}
          />
        </div>
        <p id="support-custom-hint">
          {tr(
            `¥${supportYuan(payments.custom.minAmountFen)}–¥${supportYuan(payments.custom.maxAmountFen)}，须为 ¥${supportYuan(payments.custom.stepAmountFen)} 的整数倍；每 ¥${supportYuan(payments.custom.ticketAmountFen)} 获得一张，无赠送。`,
            `¥${supportYuan(payments.custom.minAmountFen)}–¥${supportYuan(payments.custom.maxAmountFen)}, in multiples of ¥${supportYuan(payments.custom.stepAmountFen)}. One ticket per ¥${supportYuan(payments.custom.ticketAmountFen)}; no bonus.`
          )}
        </p>
        {#if selected === 'custom' && !custom}<p class="input-error" role="status">
            {tr(
              '请按上面的范围和步长输入金额，最多两位小数。',
              'Enter an amount within the stated range and step, with at most two decimal places.'
            )}
          </p>{/if}
      </div>
    </section>{/if}
  <section class="checkout-summary" aria-live="polite" data-support-selection-summary>
    <div>
      <p class="eyebrow">{tr('本次支持', 'YOUR SELECTION')}</p>
      {#if choice}<strong class="summary-amount"
          >¥{supportYuan(choice.amountFen)}<span>→</span>{choice.tickets}<small
            >{tr('张', 'tickets')}</small
          ></strong
        >
        <p>
          {choice.bonusTickets
            ? tr(
                `含 ${choice.baseTickets} 张购买、${choice.bonusTickets} 张赠送`,
                `Includes ${choice.baseTickets} purchased + ${choice.bonusTickets} bonus tickets`
              )
            : tr(
                '无额外赠送；以本订单显示的总张数为准。',
                'No extra bonus. The shown total is the order credit.'
              )}
        </p>
      {:else}<strong class="no-selection"
          >{tr('请选择一种支持方案', 'Choose a support plan')}</strong
        >{/if}
      <small
        >{tr(
          '确认后打开微信付款码，服务器核实付款后发放。十分钟后停止展示并核对关单。',
          'Confirmation opens WeChat checkout. Tickets follow verified payment. After ten minutes checkout is hidden while the server checks closure.'
        )}</small
      >
    </div>
    <button
      class="btn primary"
      data-support-create
      disabled={!canCreate}
      onclick={() => {
        if (canCreate && choice) purchase(choice)
      }}>{tr('确认方案并继续', 'Review and continue')}<ArrowRight size={16} /></button
    >
  </section>
  {#if !ordersLoaded && !orderLoading && !orderError}<p class="notice">
      {tr(
        '请先读取订单记录，确认没有待处理的付款。',
        'Load order history first to check for unresolved payments.'
      )}
    </p>{/if}
  <section class="order-history" data-support-orders-list>
    <div class="history-heading">
      <h3>{tr('订单记录', 'Order history')}</h3>
      <button
        class="btn ghost"
        data-support-orders
        disabled={!online || orderLoading || busy}
        onclick={refreshOrders}
        ><RefreshCw size={14} />{orderLoading
          ? tr('正在读取', 'Loading')
          : tr('刷新订单', 'Refresh orders')}</button
      >
    </div>
    {#if orderError}<p class="input-error" role="alert">
        {accountError(orderError, i18n.locale)}
      </p>{/if}
    {#if !orders.length && ordersLoaded}<p class="empty-orders">
        {tr('这里会保留每一笔支持记录。', 'Your support orders will appear here.')}
      </p>{/if}
    {#each orders as order (order.id)}<div class="order-row" data-support-order={order.id}>
        <div>
          <strong
            >¥{supportYuan(order.amountFen)} · {order.tickets}
            {tr('张支持寻访笺', 'support tickets')}</strong
          ><span>{status(order)}</span><small>{order.id}</small>
        </div>
        <button
          class="btn ghost"
          data-support-order-view={order.id}
          disabled={!online || busy}
          onclick={() => viewOrder(order)}
          >{order.status === 'pending' ? tr('继续查看', 'Continue') : tr('查看', 'View')}</button
        >
      </div>{/each}
  </section>
</section>

<style>
  .support-page {
    max-width: 1120px;
    margin-inline: auto;
    padding-block: 4px 30px;
  }
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    color: var(--text-2);
    font: inherit;
    font-size: 13px;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .support-intro {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-top: 30px;
  }
  .intro-mark {
    display: grid;
    place-items: center;
    flex: 0 0 70px;
    width: 70px;
    height: 70px;
    border: 1px solid var(--gallery-border);
    border-radius: 20px;
    color: var(--gallery-ink);
    background: color-mix(in srgb, var(--gallery-sage) 12%, var(--bg-elev));
  }
  .eyebrow {
    margin: 0 0 7px;
    color: var(--text-3);
    font-size: 10px;
    letter-spacing: 0.12em;
  }
  h2 {
    margin: 0;
    font-size: 28px;
    line-height: 1.35;
    outline: none;
  }
  .support-intro p:last-child {
    margin: 8px 0 0;
    color: var(--text-2);
    font-size: 13px;
  }
  .intro-note {
    max-width: 820px;
    margin: 23px 0 29px;
    color: var(--text-2);
    font-size: 13px;
    line-height: 1.8;
  }
  .notice,
  .pending-notice {
    border: 1px solid var(--gallery-border);
    padding: 17px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.8;
    color: var(--text-2);
    background: var(--gallery-paper);
  }
  .pending-notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
  }
  .pending-notice strong {
    color: var(--text);
  }
  .pending-notice p {
    margin: 5px 0 0;
    font-size: 12px;
  }
  .pending-notice button {
    flex-shrink: 0;
  }
  .plan-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }
  .plan-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    text-align: start;
    padding: 22px 18px 18px;
    border: 1px solid var(--gallery-border);
    border-radius: 16px;
    color: var(--text);
    background: var(--bg-elev);
    font: inherit;
    cursor: pointer;
  }
  .plan-card.selected,
  .custom-card.selected {
    border-color: var(--gallery-ink);
    box-shadow: 0 0 0 1px var(--gallery-ink);
  }
  .plan-card.first-support {
    background: linear-gradient(
      150deg,
      color-mix(in srgb, var(--gallery-sage) 17%, var(--bg-elev)),
      var(--bg-elev)
    );
  }
  .plan-card:disabled {
    opacity: 0.52;
    cursor: default;
  }
  .plan-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-height: 40px;
  }
  .plan-name {
    font-size: 14px;
    line-height: 1.4;
  }
  .plan-badge {
    margin-top: 9px;
    border-radius: 5px;
    padding: 3px 6px;
    color: var(--gallery-ink);
    background: color-mix(in srgb, var(--gallery-sage) 18%, transparent);
    font-size: 10px;
  }
  .plan-price {
    margin-top: 21px;
    font-size: 30px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .plan-tickets {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 14px;
    font-size: 12px;
  }
  .plan-tickets b {
    font-size: 19px;
    font-weight: 500;
  }
  .plan-detail {
    margin: 10px 0 20px;
    color: var(--text-3);
    font-size: 11px;
    line-height: 1.7;
  }
  .plan-select {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-top: auto;
    padding-top: 13px;
    border-top: 1px solid var(--gallery-border);
    color: var(--gallery-ink);
    font-size: 12px;
  }
  .custom-card {
    margin-top: 19px;
    padding: 19px 22px;
    border: 1px solid var(--gallery-border);
    border-radius: 15px;
    background: var(--bg-elev);
  }
  .custom-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  h3 {
    font-size: 16px;
    font-weight: 500;
    margin: 0;
  }
  .custom-heading p {
    margin: 7px 0 0;
    color: var(--text-3);
    font-size: 12px;
  }
  .custom-fields {
    margin-top: 20px;
  }
  label {
    font-size: 12px;
    color: var(--text-2);
  }
  .custom-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 180px;
    max-width: 100%;
    margin-top: 9px;
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: 9px;
  }
  .custom-entry input {
    min-width: 0;
    width: 100%;
    background: transparent;
    color: var(--text);
    border: 0;
    font: inherit;
    font-variant-numeric: tabular-nums;
    outline: none;
  }
  .custom-entry:focus-within {
    outline: 2px solid var(--gallery-ink);
    outline-offset: 2px;
  }
  .custom-fields p {
    font-size: 11px;
    line-height: 1.8;
    color: var(--text-3);
    margin: 9px 0 0;
  }
  .checkout-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 24px;
    margin-top: 26px;
    border: 1px solid var(--gallery-border);
    border-radius: 16px;
    background: var(--gallery-paper);
  }
  .summary-amount {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 10px;
    font-size: 26px;
    font-weight: 500;
  }
  .summary-amount span,
  .summary-amount small {
    font-size: 12px;
    color: var(--text-3);
    font-weight: 400;
  }
  .checkout-summary p:not(.eyebrow) {
    margin: 9px 0;
    font-size: 12px;
    color: var(--text-2);
  }
  .checkout-summary small {
    display: block;
    font-size: 11px;
    line-height: 1.8;
    color: var(--text-3);
  }
  .checkout-summary > button {
    flex-shrink: 0;
  }
  .no-selection {
    font-size: 17px;
    font-weight: 500;
  }
  .order-history {
    margin-top: 35px;
    padding-top: 22px;
    border-top: 1px solid var(--gallery-border);
  }
  .history-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
  }
  .order-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    padding: 17px 0;
    border-bottom: 1px solid var(--gallery-border);
  }
  .order-row > div {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 13px;
    min-width: 0;
  }
  .order-row strong {
    font-size: 13px;
    font-weight: 500;
  }
  .order-row span,
  .empty-orders {
    color: var(--text-2);
    font-size: 12px;
  }
  .order-row small {
    flex-basis: 100%;
    color: var(--text-3);
    font-size: 10px;
    overflow-wrap: anywhere;
  }
  .input-error,
  .custom-fields p.input-error {
    color: var(--danger, #b34343);
    font-size: 12px;
    line-height: 1.7;
  }
  button:focus-visible {
    outline: 2px solid var(--gallery-ink);
    outline-offset: 3px;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  @media (max-width: 1120px) {
    .plan-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 650px) {
    .checkout-summary,
    .pending-notice {
      flex-direction: column;
      align-items: flex-start;
    }
    .checkout-summary > button {
      width: 100%;
      justify-content: center;
    }
    .support-intro {
      gap: 13px;
    }
    .intro-mark {
      flex-basis: 52px;
      width: 52px;
      height: 52px;
      border-radius: 15px;
    }
    h2 {
      font-size: 24px;
    }
    .plan-card {
      padding: 18px 14px;
    }
    .plan-price {
      font-size: 27px;
    }
  }
  @media (max-width: 420px) {
    .plan-grid {
      grid-template-columns: 1fr;
    }
    .order-row {
      align-items: flex-start;
    }
  }
</style>
