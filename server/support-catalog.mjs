/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Server-owned support pricing. */
import { fail, integer, shape } from './domain.mjs'

export const SUPPORT_ORDER_MAX_FEN = 60000
export const SUPPORT_TICKET_FEN = 60
export const SUPPORT_CUSTOM = Object.freeze({
  minAmountFen: 60,
  maxAmountFen: SUPPORT_ORDER_MAX_FEN,
  stepAmountFen: SUPPORT_TICKET_FEN,
  ticketAmountFen: SUPPORT_TICKET_FEN
})
export const SUPPORT_PLANS = Object.freeze(
  [
    {
      id: 'first-support',
      name: { zh: '初次支持', en: 'First Support' },
      amountFen: 1,
      baseTickets: 10,
      bonusTickets: 0,
      tickets: 10,
      firstPurchaseOnly: true
    },
    {
      id: 'support-6',
      name: { zh: '一份支持', en: 'A Little Support' },
      amountFen: 600,
      baseTickets: 10,
      bonusTickets: 0,
      tickets: 10,
      firstPurchaseOnly: false
    },
    {
      id: 'support-60',
      name: { zh: '长久相伴', en: 'Lasting Support' },
      amountFen: 6000,
      baseTickets: 100,
      bonusTickets: 10,
      tickets: 110,
      firstPurchaseOnly: false
    },
    {
      id: 'support-600',
      name: { zh: '一路同行', en: 'Along the Journey' },
      amountFen: 60000,
      baseTickets: 1000,
      bonusTickets: 100,
      tickets: 1100,
      firstPurchaseOnly: false
    }
  ].map((plan) => Object.freeze({ ...plan, name: Object.freeze(plan.name) }))
)

export function supportSelection(body) {
  shape(body, ['requestId', 'planId', 'amountFen'], ['requestId', 'planId'])
  if (body.planId === 'custom') {
    const amountFen = integer(
      body.amountFen,
      SUPPORT_CUSTOM.minAmountFen,
      SUPPORT_CUSTOM.maxAmountFen
    )
    if (amountFen % SUPPORT_CUSTOM.stepAmountFen !== 0) fail('INVALID_SUPPORT_AMOUNT')
    const tickets = amountFen / SUPPORT_CUSTOM.ticketAmountFen
    return { id: 'custom', amountFen, baseTickets: tickets, bonusTickets: 0, tickets }
  }
  if (Object.hasOwn(body, 'amountFen')) fail('INVALID_FIELDS')
  const plan = SUPPORT_PLANS.find((entry) => entry.id === body.planId)
  if (!plan) fail('INVALID_SUPPORT_PLAN')
  return plan
}
