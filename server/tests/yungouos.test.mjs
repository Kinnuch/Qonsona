/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain JavaScript runs directly on Node24 without a TypeScript build. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  YunGouOSProvider,
  YunGouOSError,
  fenToYuan,
  yuanToFen,
  isYunGouOSQrCode
} from '../yungouos.mjs'

const key = 'example-test-key-0000000000000000'
const merchant = '1529637931'
const order = 'QON202610250001'
const qr = 'weixin://wxpay/bizpayurl?pr=fixture_QR-123'
const now = Date.parse('2026-10-25T08:00:00Z')
const config = {
  mchId: merchant,
  payKey: key,
  notifyUrl: 'https://kinnuch.cn/qon-api/v1/payments/yungouos/notify',
  now: () => now
}
const json = (data, options = {}) =>
  new Response(JSON.stringify({ code: 0, msg: '查询成功', data }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    ...options
  })
// 字段与状态来自 2026-10-25 官方 getPayOrderInfo 文档示例；单号、金额均为合成夹具。
const queried = {
  orderNo: 'Y17511778601665',
  outTradeNo: order,
  payNo: '4200000335201906015303714694',
  money: '6.00',
  body: 'Qonsona 支持开发',
  mchId: merchant,
  payType: 'native',
  attach: null,
  payStatus: 1,
  addTime: '2026-10-25 16:00:00',
  payTime: '2026-10-25 16:01:23'
}
const notify = {
  code: '1',
  orderNo: queried.orderNo,
  outTradeNo: order,
  payNo: queried.payNo,
  money: '6.00',
  mchId: merchant,
  // 独立 PowerShell/.NET MD5 固定向量，未调用被测签名实现产生。
  sign: '7A070E371942E9E5AEB7EB20A0F7A214'
}
const rejection = (code) => (error) =>
  error instanceof YunGouOSError && error.code === code && error.message === code

test('converts integer fen exactly, rejecting rounding, exponents and amounts outside official limits', () => {
  assert.equal(fenToYuan(1), '0.01')
  assert.equal(fenToYuan(100), '1.00')
  assert.equal(fenToYuan(99999900), '999999.00')
  assert.equal(yuanToFen('0.01'), 1)
  assert.equal(yuanToFen('6'), 600)
  assert.equal(yuanToFen('6.0'), 600)
  assert.equal(yuanToFen('999999.00'), 99999900)
  for (const value of [0, -1, 1.1, NaN, Infinity, 99999901, Number.MAX_SAFE_INTEGER, '1'])
    assert.throws(() => fenToYuan(value), rejection('PAYMENT_PROVIDER_INVALID_AMOUNT'))
  for (const value of ['0', '-1', '1.001', '01', '1e2', ' 1', '1 ', '999999.01', 6, null])
    assert.throws(() => yuanToFen(value), rejection('PAYMENT_PROVIDER_INVALID_AMOUNT'))
})

test('only permits bounded original WeChat native QR payloads, never remote images or arbitrary URLs', () => {
  assert.equal(isYunGouOSQrCode(qr), true)
  for (const value of [
    'https://images.yungouos.com/wxpay/native/code/fixture.png',
    'https://evil.example/pay',
    'javascript:alert(1)',
    'weixin://wxpay@evil/bizpayurl?pr=1',
    'weixin://wxpay/bizpayurl?pr=a&return_url=https://evil.example',
    'weixin://wxpay/bizpayurl?pr=abc#fragment',
    'weixin://wxpay/bizpayurl?pr=abc\n',
    'weixin://wxpay/bizpayurl?pr=' + 'a'.repeat(257),
    null
  ])
    assert.equal(isYunGouOSQrCode(value), false)
})

test('requires complete private server configuration and an HTTPS domain notification address', () => {
  for (const override of [
    { mchId: '' },
    { mchId: 'badmerchant' },
    { payKey: 'short' },
    { payKey: 'long\nkey000000000000' },
    { notifyUrl: 'http://kinnuch.cn/notify' },
    { notifyUrl: 'https://127.0.0.1/notify' },
    { notifyUrl: 'https://kinnuch.cn:8787/notify' },
    { notifyUrl: 'https://kinnuch.cn/notify?a=1' },
    { notifyUrl: 'https://kinnuch.cn/notify#fragment' },
    { notifyUrl: 'https://user:password@kinnuch.cn/notify' },
    { timeoutMs: 10001 }
  ])
    assert.throws(
      () => new YunGouOSProvider({ ...config, ...override }),
      rejection('PAYMENT_PROVIDER_NOT_CONFIGURED')
    )
  const provider = new YunGouOSProvider(config)
  assert.equal(provider.enabled, true)
  assert.equal(provider.mchid, merchant)
  assert.equal(JSON.stringify(provider).includes(key), false)
  assert.throws(() => (provider.merchantId = '99999999'), TypeError)
})

test('creates using the official fixed endpoint, required-field MD5 vector and local integer price', async () => {
  const calls = []
  const provider = new YunGouOSProvider({
    ...config,
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return json(qr)
    }
  })
  const result = await provider.create({
    outTradeNo: order,
    amountFen: 600,
    description: 'Qonsona 支持开发'
  })
  assert.deepEqual(result, {
    outTradeNo: order,
    mchid: merchant,
    amountFen: 600,
    status: 'pending',
    qrCodeUrl: qr,
    expiresAt: now + 20 * 60000
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.pay.yungouos.com/api/pay/wxpay/nativePay')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.redirect, 'error')
  assert.equal(calls[0].options.signal instanceof AbortSignal, true)
  const body = Object.fromEntries(new URLSearchParams(calls[0].options.body))
  assert.deepEqual(body, {
    out_trade_no: order,
    total_fee: '6.00',
    mch_id: merchant,
    body: 'Qonsona 支持开发',
    sign: '39B13573C74630DC4D796EF3B6356E61',
    type: '1',
    auto: '0',
    notify_url: config.notifyUrl
  })
  assert.equal(calls[0].options.body.includes(key), false)
})

test('personal native checkout explicitly disables profit-sharing without its configuration fields and keeps its display deadline local', async () => {
  const requests = []
  const provider = new YunGouOSProvider({
    ...config,
    fetchImpl: async (_, options) => {
      requests.push(new URLSearchParams(options.body))
      return json(qr)
    }
  })
  const expiresAt = now + 7 * 60000
  const result = await provider.create({
    outTradeNo: order,
    amountFen: 1,
    description: 'Qonsona 支持开发',
    expiresAt
  })
  assert.equal(result.expiresAt, expiresAt)
  assert.equal(result.status, 'pending')
  assert.equal(requests[0].get('total_fee'), '0.01')
  assert.equal(requests[0].get('type'), '1')
  assert.equal(requests[0].get('auto'), '0')
  assert.equal(requests[0].get('notify_url'), config.notifyUrl)
  for (const name of ['biz_params', 'end_time', 'time_expire', 'auto_node', 'config_no'])
    assert.equal(requests[0].has(name), false)
  assert.deepEqual([...requests[0].keys()].sort(), [
    'auto',
    'body',
    'mch_id',
    'notify_url',
    'out_trade_no',
    'sign',
    'total_fee',
    'type'
  ])
})

test('does not invoke the provider for invalid or expired order input', async () => {
  let calls = 0
  const provider = new YunGouOSProvider({
    ...config,
    fetchImpl: async () => {
      calls++
      return json(qr)
    }
  })
  for (const override of [
    { outTradeNo: 'order&injected=1' },
    { description: '' },
    { amountFen: 0 },
    { expiresAt: now },
    { expiresAt: now - 1 },
    { expiresAt: now + 3 * 3600000 }
  ])
    await assert.rejects(
      provider.create({ outTradeNo: order, amountFen: 600, description: 'Qonsona', ...override }),
      YunGouOSError
    )
  assert.equal(calls, 0)
})

test('supports authoritative query with fixed GET endpoint, matching merchant, order and amount', async () => {
  let request
  const provider = new YunGouOSProvider({
    ...config,
    fetchImpl: async (url, options) => {
      request = { url, options }
      return json(queried)
    }
  })
  const result = await provider.query({ outTradeNo: order, amountFen: 600 })
  assert.deepEqual(result, {
    outTradeNo: order,
    mchid: merchant,
    amountFen: 600,
    status: 'paid',
    providerOrderId: queried.orderNo,
    transactionId: queried.payNo,
    paidAt: Date.parse('2026-10-25T16:01:23+08:00')
  })
  const url = new URL(request.url)
  assert.equal(
    url.origin + url.pathname,
    'https://api.pay.yungouos.com/api/system/order/getPayOrderInfo'
  )
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    out_trade_no: order,
    mch_id: merchant,
    sign: '950E291D0E4AF9DE6372205FCA578E50'
  })
  assert.equal(request.options.method, 'GET')
  assert.equal(request.options.body, undefined)
  assert.equal(request.url.includes(key), false)
})

for (const [value, expected] of [
  [0, 'pending'],
  [-1, 'closed'],
  [-2, 'closed'],
  [2, 'unknown'],
  ['1', 'unknown'],
  [true, 'unknown'],
  [null, 'unknown']
])
  test(`does not grant for payStatus=${JSON.stringify(value)} (${expected})`, async () => {
    const provider = new YunGouOSProvider({
      ...config,
      fetchImpl: async () => json({ ...queried, payStatus: value })
    })
    const result = await provider.query({ outTradeNo: order })
    assert.equal(result.status, expected)
    assert.equal(result.transactionId, undefined)
  })

test('rejects mismatching merchant/order/amount and payment without a provider transaction', async () => {
  for (const override of [
    { mchId: '1111111111' },
    { mchId: undefined, mchid: merchant },
    { outTradeNo: 'another-order' },
    { money: '0.06' },
    { money: '6.001' },
    { payNo: null },
    { orderNo: null }
  ]) {
    const provider = new YunGouOSProvider({
      ...config,
      fetchImpl: async () => json({ ...queried, ...override })
    })
    await assert.rejects(provider.query({ outTradeNo: order, amountFen: 600 }), YunGouOSError)
  }
})

test('accepts official six-field notification signature and ignores unauthenticated metadata', () => {
  const provider = new YunGouOSProvider(config)
  const result = provider.verifyNotification({
    ...notify,
    payChannel: 'wxpay',
    time: '1900-01-01 00:00:00',
    attach: 'untrusted',
    openId: 'not-a-user-identity'
  })
  assert.deepEqual(result, {
    outTradeNo: order,
    mchid: merchant,
    amountFen: 600,
    status: 'paid',
    transactionId: queried.payNo,
    providerOrderId: queried.orderNo
  })
})

test('rejects forgery, mismatching merchant and malformed notification shapes', () => {
  const provider = new YunGouOSProvider(config)
  for (const override of [
    { code: '0' },
    { code: 1 },
    { money: '0.01' },
    { mchId: '1111111111' },
    { outTradeNo: 'other-order' },
    { payNo: '' },
    { sign: notify.sign.toLowerCase() },
    { sign: '0'.repeat(32) },
    { money: ['6.00', '0.01'] },
    { orderNo: null }
  ])
    assert.throws(
      () => provider.verifyNotification({ ...notify, ...override }),
      rejection('PAYMENT_PROVIDER_INVALID_SIGNATURE')
    )
  assert.throws(() => provider.verifyNotification(null), YunGouOSError)
})

test('HTTP 200, redirects and permissive code coercion never count as a successful payment', async () => {
  for (const response of [
    new Response('{"code":1,"msg":"bad sign"}', {
      headers: { 'content-type': 'application/json' }
    }),
    new Response('{"code":"0","data":"' + qr + '"}', {
      headers: { 'content-type': 'application/json' }
    }),
    new Response('<html>paid</html>', { headers: { 'content-type': 'text/html' } }),
    json('https://evil.example/pay'),
    json(qr, { status: 302 }),
    new Response('{broken', { headers: { 'content-type': 'application/json' } }),
    json(qr, { headers: { 'content-type': 'application/json', 'content-length': '999999' } })
  ]) {
    const provider = new YunGouOSProvider({ ...config, fetchImpl: async () => response })
    await assert.rejects(
      provider.create({ outTradeNo: order, amountFen: 600, description: 'Qonsona' }),
      YunGouOSError
    )
  }
})

test('response size limit also applies to chunked bodies with no declared length', async () => {
  let cancelled = false
  const response = new Response(
    new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(4096))
      },
      cancel() {
        cancelled = true
      }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  const provider = new YunGouOSProvider({ ...config, fetchImpl: async () => response })
  await assert.rejects(provider.query({ outTradeNo: order }), YunGouOSError)
  assert.equal(cancelled, true)
})

test('timeout covers request and response body and signals the fetch cancellation', async () => {
  for (const bodyStalls of [false, true]) {
    let signal
    const provider = new YunGouOSProvider({
      ...config,
      timeoutMs: 15,
      fetchImpl: async (_, options) => {
        signal = options.signal
        if (!bodyStalls) return new Promise(() => {})
        return new Response(new ReadableStream(), {
          headers: { 'content-type': 'application/json' }
        })
      }
    })
    await assert.rejects(
      provider.query({ outTradeNo: order }),
      rejection('PAYMENT_PROVIDER_TIMEOUT')
    )
    assert.equal(signal.aborted, true)
  }
})

test('network failures cannot leak the secret key, request URL or provider body through errors', async () => {
  const provider = new YunGouOSProvider({
    ...config,
    fetchImpl: async (url) => {
      throw new Error(`secret=${key};url=${url}`)
    }
  })
  await assert.rejects(provider.query({ outTradeNo: order }), (error) => {
    assert.equal(error.message, 'PAYMENT_PROVIDER_UNAVAILABLE')
    assert.equal(error.cause, undefined)
    assert.equal(error.stack.includes(key), false)
    assert.equal(error.stack.includes('sign='), false)
    return true
  })
})

test('reads refund facts without performing a money movement and binds it to the original payment', async () => {
  let url
  const provider = new YunGouOSProvider({
    ...config,
    fetchImpl: async (request, options) => {
      url = new URL(request)
      assert.equal(options.method, 'GET')
      return json({
        refundNo: 'R16382476798864',
        outTradeNo: order,
        payNo: queried.payNo,
        refundMchId: merchant,
        orderMoney: '6.00',
        refundMoney: '0.01',
        refundStatus: 1
      })
    }
  })
  const result = await provider.queryRefund({
    refundNo: 'R16382476798864',
    outTradeNo: order,
    amountFen: 600
  })
  assert.equal(url.pathname, '/api/pay/wxpay/getRefundResult')
  assert.equal(result.status, 'refunded')
  assert.equal(result.amountFen, 600)
  assert.equal(result.refundAmountFen, 1)
  assert.equal(provider.refund, undefined)
  assert.equal(provider.reverseOrder, undefined)
})

test('closes only the exact unpaid order through official closeOrder, without reverse or refund', async () => {
  let request
  const provider = new YunGouOSProvider({
    ...config,
    fetchImpl: async (url, options) => {
      request = { url, options }
      return json(order)
    }
  })
  assert.deepEqual(await provider.closeOrder({ orderId: order }), {
    outTradeNo: order,
    mchid: merchant,
    status: 'closed'
  })
  assert.equal(request.url, 'https://api.pay.yungouos.com/api/pay/wxpay/closeOrder')
  assert.equal(request.options.method, 'POST')
  assert.deepEqual(Object.fromEntries(new URLSearchParams(request.options.body)), {
    out_trade_no: order,
    mch_id: merchant,
    sign: '950E291D0E4AF9DE6372205FCA578E50'
  })
})

test('does not treat paid close rejection, unknown response or timeout as a confirmed closure', async () => {
  for (const response of [
    new Response('{"code":1,"msg":"已支付订单不能关闭"}', {
      headers: { 'content-type': 'application/json' }
    }),
    json('different-order'),
    json({ outTradeNo: order }),
    json(null)
  ]) {
    const provider = new YunGouOSProvider({ ...config, fetchImpl: async () => response })
    await assert.rejects(provider.closeOrder({ outTradeNo: order }), YunGouOSError)
  }
  const provider = new YunGouOSProvider({
    ...config,
    timeoutMs: 15,
    fetchImpl: async () => new Promise(() => {})
  })
  await assert.rejects(
    provider.closeOrder({ outTradeNo: order }),
    rejection('PAYMENT_PROVIDER_TIMEOUT')
  )
})
