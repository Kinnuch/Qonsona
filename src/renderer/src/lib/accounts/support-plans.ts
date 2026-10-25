import type { SupportOrder, SupportPlanId } from '$shared/account'

export interface SupportChoice {
  planId: SupportPlanId
  amountFen: number
  baseTickets: number
  bonusTickets: number
  tickets: number
}
export interface CustomSupportRules {
  minAmountFen: number
  maxAmountFen: number
  stepAmountFen: number
  ticketAmountFen: number
}

/** Parse user-entered yuan without rounding or floating-point multiplication. */
export function customSupportChoice(
  text: string,
  rules: CustomSupportRules | undefined
): SupportChoice | null {
  if (
    !rules ||
    !Object.values(rules).every((value) => Number.isSafeInteger(value) && value > 0) ||
    rules.minAmountFen > rules.maxAmountFen ||
    rules.maxAmountFen > 60000 ||
    !/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(text)
  )
    return null
  const [whole, decimal = ''] = text.split('.')
  const amountFen = Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
  if (
    amountFen < rules.minAmountFen ||
    amountFen > rules.maxAmountFen ||
    amountFen % rules.stepAmountFen !== 0 ||
    amountFen % rules.ticketAmountFen !== 0
  )
    return null
  const tickets = amountFen / rules.ticketAmountFen
  return { planId: 'custom', amountFen, tickets, baseTickets: tickets, bonusTickets: 0 }
}

export function supportYuan(amountFen: number): string {
  return `${Math.floor(amountFen / 100)}.${String(amountFen % 100).padStart(2, '0')}`
}

export function unresolvedSupportOrder(orders: SupportOrder[]): SupportOrder | undefined {
  return orders.find(
    (order) =>
      order.status === 'pending' &&
      order.payment?.state !== 'closed' &&
      order.payment?.state !== 'refunded' &&
      order.payment?.state !== 'refund_review'
  )
}

/** An old cached lastOrder must not resurrect a server-confirmed closure or credit. */
export function mergeSupportOrders(
  orders: SupportOrder[],
  lastOrder: SupportOrder | null
): SupportOrder[] {
  const progress = (order: SupportOrder): number =>
    order.status === 'refunded' || order.payment?.state === 'refunded'
      ? 5
      : order.payment?.state === 'refund_review'
        ? 4
        : order.status === 'approved' || order.payment?.state === 'paid'
          ? 3
          : order.status !== 'pending' || order.payment?.state === 'closed'
            ? 2
            : order.payment?.state === 'creating'
              ? 0
              : 1
  const merged = new Map<string, SupportOrder>()
  for (const order of [...(lastOrder ? [lastOrder] : []), ...orders]) {
    const previous = merged.get(order.id)
    if (!previous || progress(order) >= progress(previous)) merged.set(order.id, order)
  }
  return [...merged.values()].sort(
    (a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt))
  )
}
