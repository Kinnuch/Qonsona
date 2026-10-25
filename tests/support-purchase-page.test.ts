import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { transform } from 'esbuild'
import { compile } from 'svelte/compiler'
import { render } from 'svelte/server'
import { describe, expect, it, vi } from 'vitest'
import type { SupportOrder } from '../src/shared/account'
import {
  customSupportChoice,
  mergeSupportOrders,
  supportYuan,
  unresolvedSupportOrder
} from '../src/renderer/src/lib/accounts/support-plans'
import { accountError } from '../src/renderer/src/lib/accounts/errors'
import { orderStatus } from '../src/renderer/src/lib/accounts/presentation'
import { paymentQr } from '../src/renderer/src/lib/accounts/payment-qr'

const require = createRequire(import.meta.url)
const rules = { minAmountFen: 60, maxAmountFen: 60000, stepAmountFen: 60, ticketAmountFen: 60 }
const plans = [
  {
    id: 'first-support',
    name: { zh: '初次同行', en: 'First journey' },
    amountFen: 1,
    baseTickets: 10,
    bonusTickets: 0,
    tickets: 10,
    firstPurchaseOnly: true
  },
  {
    id: 'support-6',
    name: { zh: '一杯心意', en: 'A little support' },
    amountFen: 600,
    baseTickets: 10,
    bonusTickets: 0,
    tickets: 10,
    firstPurchaseOnly: false
  },
  {
    id: 'support-60',
    name: { zh: '一路相伴', en: 'Along the way' },
    amountFen: 6000,
    baseTickets: 100,
    bonusTickets: 10,
    tickets: 110,
    firstPurchaseOnly: false
  },
  {
    id: 'support-600',
    name: { zh: '长久同行', en: 'A lasting journey' },
    amountFen: 60000,
    baseTickets: 1000,
    bonusTickets: 100,
    tickets: 1100,
    firstPurchaseOnly: false
  }
]
const capabilities = {
  enabled: true,
  provider: 'yungouos',
  mode: 'live',
  currency: 'CNY',
  unitAmountFen: 60,
  orderMaxFen: 60000,
  monthLimitFen: null,
  eligible: true,
  plans,
  firstPurchase: { eligible: true, claimed: false },
  custom: rules
}
async function page(overrides: Record<string, unknown> = {}, locale = 'zh'): Promise<string> {
  const source = readFileSync('src/renderer/src/lib/accounts/SupportPurchasePage.svelte', 'utf8')
  const compiled = compile(source, { filename: 'SupportPurchasePage.svelte', generate: 'server' })
    .js.code
  const js = await transform(compiled, { format: 'cjs', target: 'esnext' })
  const module = { exports: {} as { default: Parameters<typeof render>[0] } }
  new Function('require', 'module', 'exports', js.code)(
    (id: string) => {
      if (id === '$lib/i18n/index.svelte') return { i18n: { locale } }
      if (id === '@lucide/svelte') return new Proxy({}, { get: () => () => {} })
      if (id === './errors') return { accountError }
      if (id === './presentation') return { orderStatus }
      if (id === './support-plans')
        return { customSupportChoice, supportYuan, unresolvedSupportOrder }
      return require(id)
    },
    module,
    module.exports
  )
  return render(module.exports.default, {
    props: {
      payments: capabilities,
      online: true,
      busy: false,
      orders: [],
      ordersLoaded: true,
      orderLoading: false,
      orderError: '',
      back: vi.fn(),
      purchase: vi.fn(),
      viewOrder: vi.fn(),
      refreshOrders: vi.fn(),
      ...overrides
    }
  }).body
}
const pending = (overrides: Partial<SupportOrder> = {}): SupportOrder => ({
  id: 'synthetic-pending-order',
  tickets: 1,
  amountFen: 1,
  currency: 'CNY',
  status: 'pending',
  createdAt: 1,
  payment: { provider: 'yungouos', method: 'wechat', state: 'creating' },
  ...overrides
})
async function dialog(order: SupportOrder): Promise<string> {
  const source = readFileSync('src/renderer/src/lib/accounts/SupportPaymentDialog.svelte', 'utf8')
  const compiled = compile(source, { filename: 'SupportPaymentDialog.svelte', generate: 'server' })
    .js.code
  const js = await transform(compiled, { format: 'cjs', target: 'esnext' })
  const module = { exports: {} as { default: Parameters<typeof render>[0] } }
  new Function('require', 'module', 'exports', js.code)(
    (id: string) => {
      if (id === '$lib/i18n/index.svelte') return { i18n: { locale: 'zh' } }
      if (id === '$lib/state/account.svelte')
        return {
          account: {
            session: { user: { id: 'fixture-owner' }, server: { online: true } },
            generation: 3,
            snapshot: { payments: capabilities, serverTime: Date.now() },
            loading: false
          }
        }
      if (id === '@lucide/svelte') return new Proxy({}, { get: () => () => {} })
      if (id === './errors') return { accountError }
      if (id === './presentation') return { orderStatus }
      if (id === './support-plans') return { supportYuan }
      if (id === './payment-qr') return { paymentQr }
      return require(id)
    },
    module,
    module.exports
  )
  return render(module.exports.default, {
    props: {
      initialOrder: order,
      ownerId: 'fixture-owner',
      ownerGeneration: 3,
      close: vi.fn(),
      updated: vi.fn()
    }
  }).body
}

describe('custom support plans', () => {
  it('uses integer fen, with no rounding or free bonus, across the entire custom range', () => {
    for (let count = 1; count <= 1000; count++) {
      expect(customSupportChoice(supportYuan(count * 60), rules)).toEqual({
        planId: 'custom',
        amountFen: count * 60,
        tickets: count,
        baseTickets: count,
        bonusTickets: 0
      })
    }
    expect(customSupportChoice('6', rules)?.tickets).toBe(10)
    expect(customSupportChoice('0.60', rules)?.tickets).toBe(1)
    expect(customSupportChoice('600.00', rules)?.tickets).toBe(1000)
  })
  it('rejects off-step, out-of-range and coercion input rather than silently changing the order amount', () => {
    for (const value of [
      '0.01',
      '0.59',
      '0',
      '-6',
      '600.60',
      '6.01',
      '0.600',
      '6e0',
      '06.00',
      ' 6',
      '6 ',
      '6,00',
      '6.00&amount=1',
      '',
      'Infinity'
    ])
      expect(customSupportChoice(value, rules), value).toBeNull()
    expect(customSupportChoice('6.00', undefined)).toBeNull()
    expect(customSupportChoice('6.00', { ...rules, ticketAmountFen: 0 })).toBeNull()
  })
  it('keeps expired or unknown pending orders unresolved until the server confirms settlement or closure', () => {
    const unknown = pending({
      payment: { provider: 'yungouos', method: 'wechat', state: 'creating', expiresAt: 2 }
    })
    expect(unresolvedSupportOrder([unknown])).toBe(unknown)
    expect(unresolvedSupportOrder([pending({ status: 'approved' })])).toBeUndefined()
    expect(
      unresolvedSupportOrder([
        pending({
          status: 'rejected',
          payment: { provider: 'yungouos', method: 'wechat', state: 'closed' }
        })
      ])
    ).toBeUndefined()
  })
  it('does not resurrect stale pending orders after background closure, paid reconciliation or refund review', () => {
    const old = pending()
    const closed = pending({
      status: 'rejected',
      payment: { provider: 'yungouos', method: 'wechat', state: 'closed' }
    })
    expect(mergeSupportOrders([closed], old)).toEqual([closed])
    const paid = pending({
      status: 'approved',
      payment: { provider: 'yungouos', method: 'wechat', state: 'paid' }
    })
    expect(mergeSupportOrders([old], paid)).toEqual([paid])
    expect(mergeSupportOrders([paid], closed)).toEqual([paid])
    const review = pending({
      status: 'approved',
      payment: { provider: 'yungouos', method: 'wechat', state: 'refund_review' }
    })
    expect(mergeSupportOrders([paid], review)).toEqual([review])
  })
})

describe('support plan page server rendering', () => {
  it('offers all server plans and exact bonus totals with a dedicated back path in both languages', async () => {
    const zh = await page()
    expect(zh).toContain('data-support-purchase-page')
    expect(zh).toContain('返回灵墨商店')
    for (const id of plans.map((plan) => plan.id)) expect(zh).toContain(`data-support-plan="${id}"`)
    expect(zh).toContain('¥0.01')
    expect(zh).toContain('100 张 + 赠送 10 张')
    expect(zh).toContain('1000 张 + 赠送 100 张')
    const en = await page({}, 'en')
    expect(en).toContain('Back to Ink shop')
    expect(en).toContain('100 + 10 bonus tickets')
    expect(en).toContain('no bonus')
  })
  it('disables a used first purchase and preserves the exact one-fen one-ticket historical order', async () => {
    const body = await page({
      payments: { ...capabilities, firstPurchase: { eligible: false, claimed: true } },
      orders: [pending({ status: 'approved', payment: undefined })]
    })
    expect(body).toMatch(/data-support-plan="first-support"[^>]*disabled/)
    expect(body).toContain('首购已使用')
    expect(body.replace(/\s+/g, ' ')).toContain('¥0.01 · 1 张支持寻访笺')
  })
  it('requires continuation of an unresolved order and hides checkout for offline capabilities', async () => {
    const body = await page({ orders: [pending()] })
    expect(body).toContain('data-support-pending-order')
    expect(body).toContain('data-support-resume-order')
    expect(body).toMatch(/data-support-plan="support-6"[^>]*disabled/)
    const offline = await page({ online: false })
    expect(offline).toContain('当前离线')
    expect(offline).toMatch(/data-support-create[^>]*disabled/)
  })
})

describe('support checkout evidence', () => {
  it('never presents refund review as a successful credit, even for an approved historical order', async () => {
    const body = await dialog(
      pending({
        status: 'approved',
        payment: { provider: 'yungouos', method: 'wechat', state: 'refund_review' }
      })
    )
    expect(body).toContain('退款审核处理中')
    expect(body).not.toContain('付款已确认，寻访笺已到账')
    expect(body).not.toContain('感谢你陪伴')
    expect(body).not.toMatch(/class="[^"]*checkout-state[^"]*success/)
  })
  it('hides an expired QR while retaining the unresolved order without claiming closure', async () => {
    const body = await dialog(
      pending({
        payment: {
          provider: 'yungouos',
          method: 'wechat',
          state: 'pending',
          expiresAt: Date.now() - 1000,
          qrCodeUrl: 'weixin://wxpay/bizpayurl?pr=synthetic_qa_only'
        }
      })
    )
    expect(body).toContain('正在核对关单结果')
    expect(body).not.toContain('data-support-payment-qr')
    expect(body).not.toContain('付款入口已关闭')
    expect(body).toContain('synthetic-pending-order')
  })
  it('shows exact stored ticket bonuses and never reprices the old one-fen diagnostic order', async () => {
    const withBonus = await dialog(
      pending({ amountFen: 6000, tickets: 110, baseTickets: 100, bonusTickets: 10 })
    )
    expect(withBonus).toContain('购买 100 张 + 赠送 10 张，合计 110 张')
    const historical = await dialog(pending({ status: 'approved', payment: undefined }))
    expect(historical).toContain('¥0.01')
    expect(historical).not.toContain('data-support-payment-breakdown')
    expect(historical).not.toContain('赠送 9 张')
  })
})
