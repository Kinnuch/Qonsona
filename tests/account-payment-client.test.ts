import { afterEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AccountClient } from '../src/main/account-client'
import type {
  AccountUser,
  CollectionSnapshot,
  SupportOrder,
  SupportPlan,
  SupportPlanId
} from '../src/shared/account'

const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0))
    await fs.rm(directory, { recursive: true, force: true })
})

const user: AccountUser = {
  id: 'payment-client-user',
  username: 'payment_client',
  nickname: 'Payment Client',
  publicId: 'payment-public-id',
  publicCollection: true,
  publicTime: true,
  createdAt: 1
}
const snapshot: CollectionSnapshot = {
  version: 1,
  revision: 0,
  serverTime: 1,
  day: '2026-10-25',
  user,
  payments: {
    enabled: true,
    provider: 'yungouos',
    mode: 'live',
    currency: 'CNY',
    unitAmountFen: 600,
    monthLimitFen: 6000,
    eligible: true
  },
  balances: { points: 0, tickets: { learning: 0, support: 0 }, echoes: 0 },
  pity: { sinceSSR: 0, sinceHigh: 0 },
  characters: [],
  legacy: [],
  inventory: { makeup: 0 },
  checkins: [],
  today: {
    seconds: 0,
    timePoints: 0,
    taskPoints: 0,
    tasks: 0,
    taskPlan: [],
    planChanges: 0,
    weeklyBonus: 0
  },
  totals: { seconds: 0, collectionCount: 0 },
  catalog: [],
  shop: [],
  drawRules: {}
}
const orderId = 'a1234567-1234-4321-8765-123456789abc'
const otherOrderId = 'b1234567-1234-4321-8765-123456789abc'
const order: SupportOrder = {
  id: orderId,
  tickets: 1,
  amountFen: 600,
  currency: 'CNY',
  status: 'pending',
  testing: false,
  createdAt: 1000,
  approvedAt: null,
  payment: {
    provider: 'yungouos',
    method: 'wechat',
    state: 'pending',
    qrCodeUrl: 'weixin://wxpay/bizpayurl?pr=LOCAL_ONLY_payment_123',
    expiresAt: 1201000
  }
}
const credentials = { username: 'payment_client', password: 'synthetic-client-password' }
const privateToken = 'synthetic-private-payment-session-token'
type CapturedRequest = {
  path: string
  method: string
  body: unknown
  headers: Headers
  redirect: RequestRedirect | undefined
}
async function fixture() {
  const directory = await fs.mkdtemp(join(tmpdir(), 'qon-payment-client-'))
  directories.push(directory)
  let identity: Parameters<ConstructorParameters<typeof AccountClient>[0]['writeIdentity']>[0] =
    null
  let currentSnapshot = structuredClone(snapshot)
  let currentOrder = structuredClone(order)
  let override: ((request: CapturedRequest) => Response | Promise<Response>) | undefined
  const requests: CapturedRequest[] = []
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request: CapturedRequest = {
      path: new URL(String(input)).pathname,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: new Headers(init?.headers),
      redirect: init?.redirect
    }
    requests.push(request)
    if (request.path.endsWith('/client-policy'))
      return new Response(
        JSON.stringify({
          app: 'qonsona',
          mode: 'exact-latest',
          source: 'github-latest',
          currentVersion: '0.4.3',
          checkedAt: 1,
          serverTime: 1,
          validUntil: 120001,
          releaseUrl: 'https://github.com/Kinnuch/Qonsona/releases/tag/v0.4.3'
        })
      )
    if (request.path.endsWith('/auth/login'))
      return new Response(
        JSON.stringify({
          token: privateToken,
          expiresAt: 999999,
          user,
          snapshot: currentSnapshot
        })
      )
    if (request.path.endsWith('/auth/me'))
      return new Response(JSON.stringify({ user, snapshot: currentSnapshot }))
    if (request.path.endsWith('/health'))
      return new Response(JSON.stringify({ status: 'ok', testing: { grantsEnabled: false } }))
    if (request.path.includes('/support/orders')) {
      if (override) return override(request)
      if (request.method === 'GET') return new Response(JSON.stringify({ orders: [currentOrder] }))
      return new Response(JSON.stringify({ order: currentOrder, snapshot: currentSnapshot }))
    }
    return new Response(JSON.stringify({ snapshot: currentSnapshot }))
  })
  const options = {
    version: '0.4.3',
    packaged: false,
    testMode: false,
    directory,
    clock: () => 0,
    base: 'http://127.0.0.1:3782/v1',
    fetcher: fetcher as typeof fetch,
    readIdentity: async () => identity,
    writeIdentity: async (value: typeof identity) => {
      identity = value
    }
  }
  return {
    client: new AccountClient(options),
    options,
    requests,
    directory,
    reply: (callback: typeof override) => {
      override = callback
    },
    setSnapshot: (value: CollectionSnapshot) => {
      currentSnapshot = value
    },
    setOrder: (value: SupportOrder) => {
      currentOrder = value
    },
    pending: async (): Promise<Record<string, { action: string; payload: unknown }>> =>
      JSON.parse(await fs.readFile(join(directory, 'account-pending.json'), 'utf8'))
  }
}

describe('payment gateway contract and recovery', () => {
  it('uses authenticated protocol headers and exact create/check/close JSON routes', async () => {
    const f = await fixture()
    await f.client.request('login', credentials)
    const create = { requestId: 'payment-create-0001', tickets: 1 }
    const close = { orderId, requestId: 'payment-close-0001' }
    await f.client.request('createSupportOrder', create)
    await f.client.request('querySupportOrder', { orderId })
    await f.client.request('closeSupportOrder', close)
    const payments = f.requests.filter((request) => request.path.includes('/support/orders'))
    expect(payments.map(({ path, method, body }) => ({ path, method, body }))).toEqual([
      { path: '/v1/support/orders', method: 'POST', body: create },
      { path: `/v1/support/orders/${orderId}/check`, method: 'POST', body: {} },
      {
        path: `/v1/support/orders/${orderId}/close`,
        method: 'POST',
        body: { requestId: close.requestId }
      }
    ])
    for (const request of payments) {
      expect(request.headers.get('X-Qon-Payment-Protocol')).toBe('yungouos-wechat-v2')
      expect(request.headers.get('X-Qon-Version')).toBe('0.4.3')
      expect(request.headers.get('Authorization')).toBe(`Bearer ${privateToken}`)
      expect(request.headers.get('Content-Type')).toBe('application/json')
      expect(request.redirect).toBe('error')
    }
    expect(await f.pending()).toEqual({})
  })

  it.each([
    '',
    '../admin/orders',
    orderId + '/../../admin',
    orderId + '?paid=true',
    'a'.repeat(36),
    '1234567-1234-4321-8765-123456789abc',
    orderId.toUpperCase()
  ])('refuses a noncanonical order ID before sending payment HTTP: %s', async (invalid) => {
    const f = await fixture()
    await f.client.request('login', credentials)
    await expect(f.client.request('querySupportOrder', { orderId: invalid })).rejects.toThrow(
      'INVALID_ORDER_ID'
    )
    await expect(
      f.client.request('closeSupportOrder', {
        orderId: invalid,
        requestId: 'invalid-close-order-id'
      })
    ).rejects.toThrow('INVALID_ORDER_ID')
    expect(f.requests.some((request) => request.path.includes('/support/orders'))).toBe(false)
    expect(await f.pending()).toEqual({})
  })

  it.each([
    'https://images.yungouos.com/wxpay/native/code/fixture.png',
    'javascript:alert(1)',
    'https://evil.example/payment',
    'weixin://wxpay/bizpayurl?pr=fixture&redirect=https://evil.example'
  ])('rejects unsafe QR payload %s and retains the uncertain create request', async (qrCodeUrl) => {
    const f = await fixture()
    await f.client.request('login', credentials)
    f.setOrder({ ...structuredClone(order), payment: { ...order.payment!, qrCodeUrl } })
    const payload = { requestId: 'unsafe-payment-qr-0001', tickets: 1 }
    await expect(f.client.request('createSupportOrder', payload)).rejects.toThrow(
      'INVALID_RESPONSE'
    )
    expect((await f.pending())[payload.requestId]).toMatchObject({
      action: 'createSupportOrder',
      payload
    })
    expect((await f.client.session()).snapshot?.balances.tickets.support).toBe(0)
  })

  it.each(['querySupportOrder', 'closeSupportOrder'] as const)(
    'binds %s response to the requested order rather than another valid UUID',
    async (action) => {
      const f = await fixture()
      await f.client.request('login', credentials)
      f.setOrder({ ...structuredClone(order), id: otherOrderId })
      const payload = { orderId, requestId: 'mismatch-order-close-0001' }
      await expect(f.client.request(action, payload)).rejects.toThrow('Payment order mismatch')
      if (action === 'closeSupportOrder')
        expect((await f.pending())[payload.requestId].payload).toEqual(payload)
      else await expect(f.pending()).rejects.toMatchObject({ code: 'ENOENT' })
    }
  )

  it.each([
    { id: 'not-a-uuid' },
    { tickets: 2, amountFen: 1200 },
    { tickets: 0 },
    { amountFen: 0 },
    { currency: 'USD' },
    { testing: true },
    { payment: { ...order.payment!, method: 'alipay' } }
  ])('rejects a mismatching or invalid create response %j', async (override) => {
    const f = await fixture()
    await f.client.request('login', credentials)
    f.setOrder({ ...structuredClone(order), ...override } as SupportOrder)
    const payload = { requestId: 'mismatching-create-0001', tickets: 1 }
    await expect(f.client.request('createSupportOrder', payload)).rejects.toThrow(
      'INVALID_RESPONSE'
    )
    expect((await f.pending())[payload.requestId].payload).toEqual(payload)
  })

  it.each([
    { enabled: true, mode: 'disabled' },
    { enabled: false, mode: 'live' },
    { enabled: true, provider: null },
    { enabled: false, mode: 'simulation', provider: 'yungouos' },
    { currency: 'USD' },
    { unitAmountFen: 1.5 },
    { monthLimitFen: 6001 },
    { eligible: 'true' }
  ])('rejects contradictory payment capabilities %j', async (override) => {
    const f = await fixture()
    await f.client.request('login', credentials)
    const malformed = structuredClone(snapshot)
    Object.assign(malformed.payments!, override)
    f.setSnapshot(malformed)
    await expect(f.client.request('querySupportOrder', { orderId })).rejects.toThrow(
      'Invalid account snapshot'
    )
    await expect(f.pending()).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('accepts only the durable zero-credit creating reservation, clears its journal, and permits explicit close', async () => {
    const f = await fixture()
    await f.client.request('login', credentials)
    f.setOrder({
      ...structuredClone(order),
      payment: {
        provider: 'yungouos',
        method: 'wechat',
        state: 'creating',
        expiresAt: order.payment!.expiresAt
      }
    })
    const created = await f.client.request('createSupportOrder', {
      requestId: 'uncertain-create-local-fact',
      tickets: 1
    })
    expect(created.order.status).toBe('pending')
    expect(created.order.payment?.state).toBe('creating')
    expect(created.order.payment?.qrCodeUrl).toBeUndefined()
    expect(created.snapshot.balances.tickets.support).toBe(0)
    expect(await f.pending()).toEqual({})
    f.setOrder({
      ...structuredClone(order),
      status: 'rejected',
      payment: { provider: 'yungouos', method: 'wechat', state: 'closed' }
    })
    const closed = await f.client.request('closeSupportOrder', {
      orderId,
      requestId: 'close-uncertain-local-fact'
    })
    expect(closed.order.payment?.state).toBe('closed')
    expect(closed.snapshot.balances.tickets.support).toBe(0)
    expect(await f.pending()).toEqual({})
  })

  it('retains a close whose network reply is unknown, then replays the same private order and request after restart', async () => {
    const f = await fixture()
    await f.client.request('login', credentials)
    const payload = { orderId, requestId: 'restart-close-payment-0001' }
    f.reply(() => {
      throw new Error('lost response after upstream closed')
    })
    await expect(f.client.request('closeSupportOrder', payload)).rejects.toThrow(
      'SERVICE_UNAVAILABLE'
    )
    expect((await f.pending())[payload.requestId]).toMatchObject({
      action: 'closeSupportOrder',
      payload
    })
    await expect(
      f.client.request('createSupportOrder', {
        requestId: 'new-create-before-recovery',
        tickets: 1
      })
    ).rejects.toThrow('PENDING_RECOVERY')
    f.reply(undefined)
    f.setOrder({
      ...structuredClone(order),
      status: 'rejected',
      payment: { provider: 'yungouos', method: 'wechat', state: 'closed' }
    })
    const session = await new AccountClient(f.options).session()
    expect(session.server.online).toBe(true)
    expect(await f.pending()).toEqual({})
    const closes = f.requests.filter((request) => request.path.endsWith(`/${orderId}/close`))
    expect(closes).toHaveLength(2)
    expect(closes[0].body).toEqual({ requestId: payload.requestId })
    expect(closes[1].body).toEqual(closes[0].body)
  })

  it('a check never creates a durable journal, including a lost response, and cannot block a later close', async () => {
    const f = await fixture()
    await f.client.request('login', credentials)
    await f.client.request('querySupportOrder', { orderId })
    await expect(f.pending()).rejects.toMatchObject({ code: 'ENOENT' })
    f.reply(() => {
      throw new Error('lost read response')
    })
    await expect(f.client.request('querySupportOrder', { orderId })).rejects.toThrow(
      'SERVICE_UNAVAILABLE'
    )
    await expect(f.pending()).rejects.toMatchObject({ code: 'ENOENT' })
    f.reply(undefined)
    await f.client.request('closeSupportOrder', { orderId, requestId: 'close-after-read-failed' })
    expect(await f.pending()).toEqual({})
  })

  it('treats an exact close-busy response as business waiting, clears the attempt journal and retries the same order on request', async () => {
    const f = await fixture()
    await f.client.request('login', credentials)
    const payload = { orderId, requestId: 'business-busy-close-0001' }
    f.reply(
      () =>
        new Response(JSON.stringify({ error: { code: 'PAYMENT_CHECK_BUSY' } }), {
          status: 503
        })
    )
    await expect(f.client.request('closeSupportOrder', payload)).rejects.toThrow(
      /^PAYMENT_CHECK_BUSY$/
    )
    expect(await f.pending()).toEqual({})
    const reconnect = await new AccountClient(f.options).session()
    expect(reconnect.server.online).toBe(true)
    expect(reconnect.user?.id).toBe(user.id)
    expect(f.requests.filter((request) => request.path.endsWith(`/${orderId}/close`))).toHaveLength(
      1
    )
    expect(f.requests.filter((request) => request.path === '/v1/support/orders')).toHaveLength(0)
    f.reply(undefined)
    f.setOrder({
      ...structuredClone(order),
      status: 'rejected',
      payment: { provider: 'yungouos', method: 'wechat', state: 'closed' }
    })
    const closed = await f.client.request('closeSupportOrder', payload)
    expect(closed.order.id).toBe(orderId)
    expect(closed.order.status).toBe('rejected')
    expect(await f.pending()).toEqual({})
    const closes = f.requests.filter((request) => request.path.endsWith(`/${orderId}/close`))
    expect(closes).toHaveLength(2)
    expect(closes[0].body).toEqual({ requestId: payload.requestId })
    expect(closes[1].body).toEqual(closes[0].body)
  })

  it('retains a generic HTTP 503 close outcome for same-request recovery instead of treating it as business waiting', async () => {
    const f = await fixture()
    await f.client.request('login', credentials)
    const payload = { orderId, requestId: 'unknown-service-close-0001' }
    f.reply(
      () =>
        new Response(JSON.stringify({ error: { code: 'PAYMENT_PROVIDER_TIMEOUT' } }), {
          status: 503
        })
    )
    await expect(f.client.request('closeSupportOrder', payload)).rejects.toThrow(
      'SERVICE_UNAVAILABLE'
    )
    expect((await f.pending())[payload.requestId]).toMatchObject({
      action: 'closeSupportOrder',
      payload
    })
    f.reply(undefined)
    expect((await new AccountClient(f.options).session()).server.online).toBe(true)
    expect(await f.pending()).toEqual({})
    const closes = f.requests.filter((request) => request.path.endsWith(`/${orderId}/close`))
    expect(closes).toHaveLength(2)
    expect(closes[1].body).toEqual(closes[0].body)
  })

  it('keeps session credentials in main-process storage and transport rather than returned IPC DTOs or economic journals', async () => {
    const f = await fixture()
    const loggedIn = await f.client.request('login', credentials)
    const created = await f.client.request('createSupportOrder', {
      requestId: 'private-create-payment-0001',
      tickets: 1
    })
    const queried = await f.client.request('querySupportOrder', { orderId })
    const session = await f.client.session()
    for (const value of [loggedIn, created, queried, session]) {
      const serialized = JSON.stringify(value)
      expect(serialized).not.toContain(privateToken)
      expect(serialized).not.toContain(credentials.password)
      expect(serialized).not.toContain('QON_YUNGOUOS_PAY_KEY')
      expect(serialized).not.toContain('sign=')
    }
    f.reply(() => {
      throw new Error('synthetic unknown close')
    })
    await expect(
      f.client.request('closeSupportOrder', { orderId, requestId: 'private-close-payment-0001' })
    ).rejects.toThrow('SERVICE_UNAVAILABLE')
    const journal = JSON.stringify(await f.pending())
    expect(journal).not.toContain(privateToken)
    expect(journal).not.toContain(credentials.password)
    expect(journal).not.toContain('qrCodeUrl')
    expect(journal).not.toContain('sign=')
    const publicRequests = f.requests.filter((request) =>
      /\/(?:client-policy|health|auth\/login)$/.test(request.path)
    )
    expect(publicRequests.every((request) => !request.headers.has('Authorization'))).toBe(true)
  })
})

// Independent product fixtures: prices and quantities are the agreed v2 contract,
// not imported from the server implementation being validated by the gateway.
const catalogPlans: SupportPlan[] = [
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
]
function catalogSnapshot(): CollectionSnapshot {
  return {
    ...structuredClone(snapshot),
    payments: {
      enabled: true,
      provider: 'yungouos',
      mode: 'live',
      currency: 'CNY',
      unitAmountFen: 60,
      orderMaxFen: 60000,
      monthLimitFen: null,
      eligible: true,
      plans: structuredClone(catalogPlans),
      firstPurchase: { eligible: true, claimed: false },
      custom: { minAmountFen: 60, maxAmountFen: 60000, stepAmountFen: 60, ticketAmountFen: 60 }
    }
  }
}
function quotedOrder(planId: Exclude<SupportPlanId, 'custom'>): SupportOrder {
  const plan = catalogPlans.find((entry) => entry.id === planId)!
  return {
    ...structuredClone(order),
    planId,
    amountFen: plan.amountFen,
    tickets: plan.tickets,
    baseTickets: plan.baseTickets,
    bonusTickets: plan.bonusTickets,
    payment: { ...order.payment!, expiresAt: 601000 }
  }
}

describe('v2 payment catalog and exact quotation binding', () => {
  it.each(catalogPlans)(
    'accepts exact server plan $id for $amountFen fen and $tickets tickets',
    async (plan) => {
      const f = await fixture()
      f.setSnapshot(catalogSnapshot())
      f.setOrder(quotedOrder(plan.id))
      await f.client.request('login', credentials)
      const payload = { requestId: `v2-exact-${plan.id}`, planId: plan.id }
      const result = await f.client.request('createSupportOrder', payload)
      expect(result.order).toMatchObject({
        planId: plan.id,
        amountFen: plan.amountFen,
        tickets: plan.tickets,
        baseTickets: plan.baseTickets,
        bonusTickets: plan.bonusTickets
      })
      const create = f.requests.find((request) => request.path === '/v1/support/orders')!
      expect(create.body).toEqual(payload)
      expect(create.headers.get('X-Qon-Payment-Protocol')).toBe('yungouos-wechat-v2')
      expect(await f.pending()).toEqual({})
    }
  )

  it.each([60, 600, 60000])(
    'accepts a custom %i-fen order only with exact integer quantity and zero bonus',
    async (amountFen) => {
      const f = await fixture()
      f.setSnapshot(catalogSnapshot())
      const tickets = amountFen / 60
      f.setOrder({
        ...structuredClone(order),
        planId: 'custom',
        amountFen,
        tickets,
        baseTickets: tickets,
        bonusTickets: 0
      })
      await f.client.request('login', credentials)
      const payload = { requestId: `v2-custom-${amountFen}`, planId: 'custom' as const, amountFen }
      const result = await f.client.request('createSupportOrder', payload)
      expect(result.order).toMatchObject({
        planId: 'custom',
        amountFen,
        tickets,
        baseTickets: tickets,
        bonusTickets: 0
      })
      expect(f.requests.find((request) => request.path === '/v1/support/orders')!.body).toEqual(
        payload
      )
      expect(await f.pending()).toEqual({})
    }
  )

  it.each([
    ['another valid plan', { planId: 'support-6' }],
    ['amount', { amountFen: 60000 }],
    ['total tickets', { tickets: 111 }],
    ['base quantity with a valid subtotal', { baseTickets: 101, tickets: 111 }],
    ['bonus quantity with a valid subtotal', { bonusTickets: 11, tickets: 111 }],
    ['changed base/bonus split preserving total', { baseTickets: 99, bonusTickets: 11 }]
  ] as const)(
    'retains the uncertain journal if a response changes the requested %s',
    async (_label, override) => {
      const f = await fixture()
      f.setSnapshot(catalogSnapshot())
      await f.client.request('login', credentials)
      f.setOrder({ ...quotedOrder('support-60'), ...override } as SupportOrder)
      const payload = { requestId: 'v2-mismatched-package-quote', planId: 'support-60' as const }
      await expect(f.client.request('createSupportOrder', payload)).rejects.toThrow(
        'INVALID_RESPONSE'
      )
      expect((await f.pending())[payload.requestId]).toMatchObject({
        action: 'createSupportOrder',
        payload
      })
      expect(f.requests.filter((request) => request.path === '/v1/support/orders')).toHaveLength(1)
    }
  )

  it.each([
    [
      'a package identifier with the same amount',
      { planId: 'support-6', baseTickets: 10, bonusTickets: 0, tickets: 10, amountFen: 600 }
    ],
    [
      'a fabricated bonus preserving total',
      { planId: 'custom', baseTickets: 9, bonusTickets: 1, tickets: 10, amountFen: 600 }
    ],
    [
      'a different valid custom amount',
      { planId: 'custom', baseTickets: 20, bonusTickets: 0, tickets: 20, amountFen: 1200 }
    ]
  ] as const)(
    'rejects a custom response containing %s and retains only its original request',
    async (_label, values) => {
      const f = await fixture()
      f.setSnapshot(catalogSnapshot())
      await f.client.request('login', credentials)
      f.setOrder({ ...structuredClone(order), ...values } as SupportOrder)
      const payload = {
        requestId: 'v2-custom-quote-mismatch',
        planId: 'custom' as const,
        amountFen: 600
      }
      await expect(f.client.request('createSupportOrder', payload)).rejects.toThrow(
        'Payment quote mismatch'
      )
      expect((await f.pending())[payload.requestId].payload).toEqual(payload)
    }
  )

  const malformedCatalogs: [string, (value: CollectionSnapshot) => void][] = [
    [
      'duplicate plan identifiers',
      (value) => {
        value.payments!.plans![3] = structuredClone(value.payments!.plans![2])
      }
    ],
    [
      'incorrect plan subtotal',
      (value) => {
        value.payments!.plans![2].tickets = 111
      }
    ],
    [
      'negative bonus',
      (value) => {
        value.payments!.plans![2].bonusTickets = -1
      }
    ],
    [
      'missing plan',
      (value) => {
        value.payments!.plans!.pop()
      }
    ],
    [
      'claimed and eligible first purchase',
      (value) => {
        value.payments!.firstPurchase!.claimed = true
      }
    ],
    [
      'pending and eligible first purchase',
      (value) => {
        value.payments!.firstPurchase!.pendingOrderId = orderId
      }
    ],
    [
      'invalid pending identifier',
      (value) => {
        value.payments!.firstPurchase = {
          eligible: false,
          claimed: false,
          pendingOrderId: '../orders'
        }
      }
    ],
    [
      'incorrect custom step',
      (value) => {
        value.payments!.custom!.stepAmountFen = 61
      }
    ],
    [
      'incorrect custom ticket price',
      (value) => {
        value.payments!.custom!.ticketAmountFen = 1
      }
    ],
    [
      'custom limit above maximum',
      (value) => {
        value.payments!.custom!.maxAmountFen = 60060
      }
    ],
    [
      'missing custom rules',
      (value) => {
        delete value.payments!.custom
      }
    ],
    [
      'legacy monthly cap attached to the v2 catalog',
      (value) => {
        value.payments!.monthLimitFen = 6000
      }
    ]
  ]
  it.each(malformedCatalogs)(
    'rejects malformed catalog: %s without accepting a payment snapshot or writing a query journal',
    async (_label, mutate) => {
      const f = await fixture()
      f.setSnapshot(catalogSnapshot())
      await f.client.request('login', credentials)
      const malformed = catalogSnapshot()
      mutate(malformed)
      f.setSnapshot(malformed)
      f.setOrder(quotedOrder('support-6'))
      await expect(f.client.request('querySupportOrder', { orderId })).rejects.toThrow(
        'Invalid account snapshot'
      )
      await expect(f.pending()).rejects.toMatchObject({ code: 'ENOENT' })
    }
  )

  it('reads the original one-fen one-ticket paid order without applying current first-purchase pricing', async () => {
    const f = await fixture()
    const current = catalogSnapshot()
    current.payments!.firstPurchase = { eligible: false, claimed: true }
    current.balances.tickets.support = 1
    f.setSnapshot(current)
    const historical: SupportOrder = {
      ...structuredClone(order),
      amountFen: 1,
      tickets: 1,
      status: 'approved',
      approvedAt: 2000,
      payment: { provider: 'yungouos', method: 'wechat', state: 'paid' }
    }
    f.setOrder(historical)
    await f.client.request('login', credentials)
    const result = await f.client.request('querySupportOrder', { orderId })
    expect(result.order).toEqual(historical)
    expect(result.order.planId).toBeUndefined()
    expect(result.order.baseTickets).toBeUndefined()
    expect(result.snapshot.balances.tickets.support).toBe(1)
    expect(result.snapshot.payments!.firstPurchase!.eligible).toBe(false)
    await expect(f.pending()).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
