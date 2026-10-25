<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { Check, Clock3, RefreshCw, Smartphone, X } from '@lucide/svelte'
  import { account } from '$lib/state/account.svelte'
  import { i18n } from '$lib/i18n/index.svelte'
  import type { SupportOrder } from '$shared/account'
  import { accountError } from './errors'
  import { orderStatus } from './presentation'
  import { paymentQr } from './payment-qr'

  let {
    initialOrder,
    ownerId,
    ownerGeneration,
    close,
    updated
  }: {
    initialOrder: SupportOrder
    ownerId: string
    ownerGeneration: number
    close: () => void
    updated: (order: SupportOrder) => void
  } = $props()
  const tr = (zh: string, en: string): string => (i18n.locale === 'zh' ? zh : en)
  let order = $state.raw(untrack(() => initialOrder))
  let checking = $state(false)
  let closing = $state(false)
  let closeRequested = $state(false)
  let closeRequestId = ''
  let error = $state('')
  let secondsUntilCheck = $state(15)
  let now = $state(Date.now())
  let disposed = false
  let inFlight = false
  let nextCheck = 0
  const ownerCurrent = (): boolean =>
    !disposed && ownerId === account.session?.user?.id && ownerGeneration === account.generation
  const online = $derived(
    ownerId === account.session?.user?.id &&
      ownerGeneration === account.generation &&
      !!account.session?.server.online &&
      !account.loading
  )
  const payment = $derived(order.payment)
  const checkoutEnabled = $derived(
    account.snapshot?.payments?.enabled &&
      account.snapshot.payments.mode === 'live' &&
      account.snapshot.payments.eligible
  )
  const credited = $derived(order.status === 'approved')
  const terminal = $derived(
    order.status !== 'pending' || payment?.state === 'closed' || payment?.state === 'refund_review'
  )
  const expired = $derived(!!payment?.expiresAt && now >= payment.expiresAt)
  const qr = $derived(payment?.qrCodeUrl ? paymentQr(payment.qrCodeUrl) : null)
  const showQr = $derived(
    online &&
      checkoutEnabled &&
      order.status === 'pending' &&
      payment?.state === 'pending' &&
      !expired &&
      !closeRequested &&
      !!qr
  )
  const statusText = $derived(
    payment?.state === 'refund_review'
      ? tr('退款审核处理中', 'Refund under review')
      : credited
        ? tr('付款已确认，寻访笺已到账', 'Payment confirmed · tickets credited')
        : order.status === 'refunded'
          ? orderStatus(order.status, i18n.locale)
          : payment?.state === 'closed'
            ? tr('付款入口已关闭', 'Payment is closed')
            : payment?.state === 'paid'
              ? tr('付款已确认，正在核对到账', 'Payment confirmed · checking credit')
              : payment?.state === 'creating'
                ? tr('正在确认微信付款入口', 'Confirming WeChat checkout')
                : order.status === 'pending' && expired
                  ? tr(
                      '扫码展示已结束，等待核对订单',
                      'Checkout display ended · awaiting verification'
                    )
                  : payment?.state === 'pending'
                    ? tr('等待微信付款', 'Awaiting WeChat payment')
                    : orderStatus(order.status, i18n.locale)
  )

  async function checkOrder(): Promise<void> {
    if (
      !ownerCurrent() ||
      !online ||
      inFlight ||
      account.busy ||
      closeRequested ||
      closing ||
      document.hidden ||
      performance.now() < nextCheck
    )
      return
    inFlight = true
    checking = true
    error = ''
    nextCheck = performance.now() + 15000
    secondsUntilCheck = 15
    const orderId = order.id
    try {
      const result = await account.refreshSupportOrder(orderId)
      if (!ownerCurrent() || order.id !== orderId) return
      if (result && result.id === orderId) {
        order = result
        updated(result)
      } else error = account.error || 'PAYMENT_STATUS_UNKNOWN'
    } catch {
      if (ownerCurrent() && order.id === orderId) error = 'PAYMENT_STATUS_UNKNOWN'
    } finally {
      if (ownerCurrent()) checking = false
      inFlight = false
    }
  }
  function requestCloseOrder(): void {
    if (!ownerCurrent() || !online || checking || closing || account.busy) return
    closeRequestId ||= crypto.randomUUID()
    closeRequested = true
  }
  async function closeOrder(): Promise<void> {
    if (
      !ownerCurrent() ||
      !online ||
      !closeRequested ||
      !closeRequestId ||
      checking ||
      closing ||
      account.busy
    )
      return
    closing = true
    error = ''
    const orderId = order.id
    try {
      const ok = await account.mutate('closeSupportOrder', { orderId, requestId: closeRequestId })
      if (!ownerCurrent() || order.id !== orderId) return
      if (ok && account.lastOrder?.id === orderId) {
        order = account.lastOrder
        updated(order)
        closeRequested = false
      } else error = account.error || 'PAYMENT_STATUS_UNKNOWN'
    } catch {
      if (ownerCurrent() && order.id === orderId) error = 'PAYMENT_STATUS_UNKNOWN'
    } finally {
      if (ownerCurrent()) closing = false
    }
  }
  onMount(() => {
    nextCheck = performance.now() + 15000
    const timer = window.setInterval(() => {
      if (document.hidden || !ownerCurrent()) return
      now = Date.now()
      secondsUntilCheck = Math.max(0, Math.ceil((nextCheck - performance.now()) / 1000))
      if (!terminal && secondsUntilCheck === 0) void checkOrder()
    }, 1000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  })
  function focusDialog(node: HTMLElement): { destroy: () => void } {
    const previous = document.activeElement as HTMLElement | null
    node.focus()
    const keydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close()
        return
      }
      if (event.key !== 'Tab') return
      const buttons = Array.from(node.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const first = buttons[0]
      const last = buttons.at(-1)
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
    node.addEventListener('keydown', keydown)
    return {
      destroy: () => {
        node.removeEventListener('keydown', keydown)
        if (previous?.isConnected) previous.focus()
      }
    }
  }
</script>

<div class="payment-overlay" data-support-payment-dialog data-payment-order-id={order.id}>
  <button
    class="scrim"
    tabindex="-1"
    aria-label={tr('收起付款界面', 'Hide checkout')}
    onclick={close}
  ></button>
  <div
    class="payment-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="support-payment-title"
    aria-describedby="support-payment-description"
    tabindex="-1"
    use:focusDialog
  >
    <header>
      <div class="heading">
        <p class="eyebrow">SUPPORT THE JOURNEY</p>
        <h2 id="support-payment-title">
          {payment
            ? tr('微信扫码支持开发', 'Support development with WeChat')
            : tr('支持订单', 'Support order')}
        </h2>
      </div>
      <button
        class="close"
        data-support-payment-close
        aria-label={tr('收起付款界面', 'Hide checkout')}
        onclick={close}><X size={20} /></button
      >
    </header>
    <div class="summary">
      <div>
        <span class="ticket-label">{tr('支持寻访笺', 'Support discovery tickets')}</span>
        <strong>{order.tickets}<small>{tr('张', 'tickets')}</small></strong>
      </div>
      <div class="amount">
        <span>{tr('订单金额', 'Order total')}</span>
        <strong data-support-payment-amount>¥{(order.amountFen / 100).toFixed(2)}</strong>
      </div>
    </div>
    <div class="checkout-state" class:success={credited} role="status" data-support-payment-status>
      {#if credited}<Check size={18} />{:else}<Clock3 size={18} />{/if}
      <strong>{statusText}</strong>
    </div>
    {#if showQr && qr}
      <div class="qr-frame" data-support-payment-qr>
        <svg
          viewBox={`0 0 ${qr.size} ${qr.size}`}
          role="img"
          aria-label={tr('使用微信扫一扫付款', 'Scan this payment QR code with WeChat')}
          shape-rendering="crispEdges"
        >
          <rect width={qr.size} height={qr.size} fill="#fff" />
          <path d={qr.path} fill="#101810" />
        </svg>
      </div>
      <p class="scan-note">
        <Smartphone size={16} />{tr('打开微信 · 扫一扫', 'Open WeChat · Scan')}
      </p>
      {#if payment?.expiresAt}<p class="expires">
          {tr('扫码入口展示至', 'Checkout shown until')}
          {new Date(payment.expiresAt).toLocaleTimeString(i18n.locale === 'zh' ? 'zh-CN' : 'en', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>{/if}
    {:else if closeRequested}
      <div class="close-confirmation" data-support-payment-close-confirmation>
        <strong>{tr('关闭这个未付款订单？', 'Close this unpaid order?')}</strong>
        <p>
          {tr(
            '服务器会先核对付款状态。确认关闭后，此订单二维码不可继续付款；关闭结果不明时，请核对同一订单，不要重复下单。',
            'The server checks payment first. After closure, this order’s QR code cannot be paid. If the result is uncertain, check the same order before creating another one.'
          )}
        </p>
        <div class="close-actions">
          <button
            class="btn ghost"
            data-support-payment-keep-order
            disabled={closing}
            onclick={() => (closeRequested = false)}>{tr('保留订单', 'Keep order')}</button
          >
          <button
            class="btn"
            data-support-payment-confirm-close
            disabled={!online || closing || checking || account.busy}
            onclick={() => void closeOrder()}
            >{closing
              ? tr('正在关闭', 'Closing')
              : tr('确认关闭未付款订单', 'Confirm close unpaid order')}</button
          >
        </div>
      </div>
    {:else if !online && !credited}
      <p class="notice" data-support-payment-offline>
        {tr(
          '当前连接不可用。订单仍已保存，请重新连接后查看订单并核对付款结果。',
          'The connection is unavailable. Your order is saved; reconnect and view it to check the payment result.'
        )}
      </p>
    {:else if payment && !checkoutEnabled && order.status === 'pending'}
      <p class="notice">
        {tr(
          '当前付款入口不可用，请勿付款。已有付款请核对同一订单，或联系运营者。',
          'Checkout is currently unavailable. Do not make a payment. If you already paid, check the same order or contact the operator.'
        )}
      </p>
    {:else if payment?.state === 'creating'}
      <p class="notice">
        {tr(
          '付款入口尚未确认，请稍后核对本订单，不要重复创建或付款。',
          'Checkout is not confirmed yet. Check this order shortly; do not create or pay a duplicate order.'
        )}
      </p>
    {:else if expired && order.status === 'pending'}
      <p class="notice">
        {tr(
          '本次扫码入口已到展示时限，请先核对本订单；如果已经付款，服务器确认后才会发放寻访笺。',
          'This checkout has reached its display limit. Check this order first; if you already paid, tickets are issued after server confirmation.'
        )}
      </p>
    {:else if payment?.state === 'refund_review'}
      <p class="notice">
        {tr(
          '订单正在核对退款，请联系运营者处理。此状态不代表已经退款。',
          'This order requires a refund review. Contact the operator; this state does not confirm a refund.'
        )}
      </p>
    {:else if payment?.state === 'pending' && !qr}
      <p class="notice" role="alert">
        {tr(
          '付款二维码暂不可用，请核对本订单；不要向其他二维码付款。',
          'The payment QR code is unavailable. Check this order; do not pay another QR code.'
        )}
      </p>
    {/if}
    <p id="support-payment-description" class="description">
      {order.status === 'refunded'
        ? tr(
            '本订单已确认退款，请以付款渠道的退款记录为准。',
            'This order is confirmed refunded. Refer to your payment provider’s refund record.'
          )
        : payment?.state === 'closed'
          ? tr(
              '本订单付款入口已关闭，请勿继续使用旧二维码。需要再次支持时，可回到商店自行创建新订单。',
              'Checkout for this order is closed. Do not use its old QR code. To support again, return to the shop and create a new order.'
            )
          : credited
            ? tr(
                '本次支持只增加支持寻访笺。感谢你陪伴 Qonsona 继续成长。',
                'This order credits support tickets only. Thank you for helping Qonsona grow.'
              )
            : payment
              ? tr(
                  '付款完成后由服务器核验，确认后才会到账。收起界面不会取消订单；可从订单记录继续查看。',
                  'The server verifies payment before crediting tickets. Hiding this view does not cancel the order; reopen it from your order history.'
                )
              : tr(
                  '此订单没有在线付款入口，请勿向其他二维码付款。',
                  'This order has no online checkout. Do not pay another QR code.'
                )}
    </p>
    <dl class="order-meta">
      <dt>{tr('订单编号', 'Order ID')}</dt>
      <dd>{order.id}</dd>
    </dl>
    {#if error}<p class="error" role="alert">{accountError(error, i18n.locale)}</p>{/if}
    {#if order.status === 'pending' && payment && payment.state !== 'closed' && payment.state !== 'refund_review' && !closeRequested}<button
        class="close-order"
        data-support-payment-close-order
        disabled={!online || checking || closing || account.busy}
        onclick={requestCloseOrder}>{tr('关闭未付款订单', 'Close unpaid order')}</button
      >{/if}
    <footer>
      <button
        class="btn ghost"
        data-support-payment-refresh
        disabled={!online ||
          checking ||
          closing ||
          closeRequested ||
          account.busy ||
          secondsUntilCheck > 0}
        onclick={() => void checkOrder()}
        ><RefreshCw size={15} class={checking ? 'spinning' : ''} />{checking
          ? tr('正在核对', 'Checking')
          : secondsUntilCheck > 0
            ? tr(`${secondsUntilCheck} 秒后可核对`, `Check again in ${secondsUntilCheck}s`)
            : tr('核对付款结果', 'Check payment result')}</button
      >
      <button class="btn primary" data-support-payment-done onclick={close}
        >{credited ? tr('完成', 'Done') : tr('收起', 'Hide')}</button
      >
    </footer>
  </div>
</div>

<style>
  .payment-overlay {
    position: fixed;
    inset: 0;
    z-index: 1250;
    display: grid;
    place-items: center;
    padding: 24px;
  }
  .scrim {
    position: absolute;
    inset: 0;
    border: 0;
    background: #0d120bad;
    backdrop-filter: blur(6px);
    cursor: default;
  }
  .payment-dialog {
    position: relative;
    width: min(100%, 510px);
    max-height: calc(100dvh - 48px);
    overflow-y: auto;
    padding: 27px;
    border: 1px solid var(--gallery-border, var(--border));
    border-radius: 22px;
    color: var(--text);
    background: var(--bg-elev);
    box-shadow: 0 24px 80px #0006;
    outline: none;
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  .eyebrow {
    margin: 0 0 6px;
    color: var(--text-3);
    font-size: 10px;
    letter-spacing: 0.13em;
  }
  h2 {
    margin: 0;
    font-size: 21px;
    line-height: 1.35;
  }
  .close {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text-2);
    background: transparent;
    cursor: pointer;
  }
  .close:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .summary {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    margin: 24px 0 16px;
    padding: 17px 18px;
    border: 1px solid var(--border);
    border-radius: 13px;
  }
  .summary span {
    display: block;
    margin-bottom: 6px;
    color: var(--text-3);
    font-size: 12px;
  }
  .summary strong {
    display: block;
    font-size: 29px;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }
  .summary small {
    margin-left: 7px;
    color: var(--text-2);
    font-size: 12px;
    font-weight: normal;
  }
  .amount {
    text-align: right;
  }
  .checkout-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 38px;
    color: var(--text-2);
    font-size: 13px;
  }
  .checkout-state.success {
    color: var(--gallery-ink, var(--accent));
    padding: 20px 0;
  }
  .qr-frame {
    width: min(100%, 240px);
    aspect-ratio: 1;
    margin: 12px auto;
    padding: 8px;
    border: 1px solid #d8ddcf;
    border-radius: 13px;
    background: #fff;
  }
  .qr-frame svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .scan-note {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    margin: 12px 0 5px;
    font-size: 13px;
  }
  .expires {
    margin: 0;
    color: var(--text-3);
    text-align: center;
    font-size: 11px;
  }
  .description,
  .notice {
    margin: 18px 0 0;
    color: var(--text-2);
    font-size: 12px;
    line-height: 1.8;
  }
  .notice {
    padding: 13px;
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .close-confirmation {
    margin-top: 18px;
    padding: 15px;
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  .close-confirmation strong {
    font-size: 14px;
  }
  .close-confirmation p {
    color: var(--text-2);
    font-size: 12px;
    line-height: 1.8;
  }
  .close-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
  }
  .close-actions button {
    font-size: 12px;
  }
  .close-order {
    margin-top: 17px;
    border: 0;
    padding: 3px 0;
    color: var(--text-3);
    background: transparent;
    font-size: 12px;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .close-order:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .order-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin: 15px 0 0;
    font-size: 11px;
    color: var(--text-3);
  }
  .order-meta dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .error {
    font-size: 12px;
    line-height: 1.7;
    color: var(--danger, #b34343);
  }
  footer {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 22px;
  }
  footer button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  footer :global(.spinning) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    footer :global(.spinning) {
      animation: none;
    }
  }
  @media (max-width: 600px) {
    .payment-overlay {
      padding: 12px;
    }
    .payment-dialog {
      padding: 20px;
      max-height: calc(100dvh - 24px);
    }
  }
</style>
