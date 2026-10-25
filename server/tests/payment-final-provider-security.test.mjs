/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Security regression tests run directly on Node. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { YunGouOSProvider, YunGouOSError, yuanToFen, fenToYuan } from '../yungouos.mjs'

// Synthetic values only; this suite never sends a payment-provider network request.
const fixture = {
  mchId: '1529637931',
  payKey: 'example-test-key-0000000000000000',
  notifyUrl: 'https://kinnuch.cn/qon-api/v1/payments/yungouos/notify'
}
const order = 'QON202610250001'
const nativeQr = 'weixin://wxpay/bizpayurl?pr=synthetic_123'
const notification = {
  code: '1',
  orderNo: 'Y17511778601665',
  outTradeNo: order,
  payNo: '4200000335201906015303714694',
  money: '6.00',
  mchId: fixture.mchId,
  // Fixed external .NET/PowerShell vector, independent of the adapter implementation.
  sign: '7A070E371942E9E5AEB7EB20A0F7A214'
}
const json = (data) =>
  new Response(JSON.stringify({ code: 0, data }), {
    headers: { 'content-type': 'application/json' }
  })

test('tampering with any authenticated callback field, even a single interior byte, fails validation', () => {
  const provider = new YunGouOSProvider(fixture)
  assert.equal(provider.verifyNotification(notification).status, 'paid')
  for (const name of ['code', 'orderNo', 'outTradeNo', 'payNo', 'money', 'mchId']) {
    const source = notification[name]
    for (let index = 0; index < source.length; index++) {
      const replacement = source[index] === '9' ? '8' : '9'
      const changed = source.slice(0, index) + replacement + source.slice(index + 1)
      assert.throws(
        () => provider.verifyNotification({ ...notification, [name]: changed }),
        (error) => error instanceof YunGouOSError,
        `${name}[${index}] must not reuse the original signature`
      )
    }
  }
  for (const sign of ['0'.repeat(31), '0'.repeat(33), 'Ｆ'.repeat(32), 'A'.repeat(100000)]) {
    assert.throws(
      () => provider.verifyNotification({ ...notification, sign }),
      (error) => error instanceof YunGouOSError && !error.message.includes(fixture.payKey)
    )
  }
})

test('a provider response that followed or changed URL is rejected before returning a QR', async () => {
  for (const spoof of [
    { url: 'https://evil.example/stolen-signature' },
    { url: 'http://api.pay.yungouos.com/api/pay/wxpay/nativePay' },
    { url: 'https://api.pay.yungouos.com.evil.example/api/pay/wxpay/nativePay' },
    { redirected: true }
  ]) {
    let calls = 0
    const provider = new YunGouOSProvider({
      ...fixture,
      fetchImpl: async (url, options) => {
        calls++
        assert.equal(url, 'https://api.pay.yungouos.com/api/pay/wxpay/nativePay')
        assert.equal(options.redirect, 'error')
        const response = json(nativeQr)
        for (const [name, value] of Object.entries(spoof))
          Object.defineProperty(response, name, { value })
        return response
      }
    })
    await assert.rejects(
      provider.create({ outTradeNo: order, amountFen: 600, description: 'Synthetic test' }),
      YunGouOSError
    )
    assert.equal(calls, 1)
  }
})

test('malformed UTF-8, dropped response bodies and provider-controlled exceptions expose only fixed safe errors', async () => {
  for (const responseFactory of [
    () =>
      new Response(new Uint8Array([0xc3, 0x28]), {
        headers: { 'content-type': 'application/json' }
      }),
    () => new Response(null, { headers: { 'content-type': 'application/json' } }),
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error(`provider leaked ${fixture.payKey}`))
          }
        }),
        { headers: { 'content-type': 'application/json' } }
      )
  ]) {
    const provider = new YunGouOSProvider({ ...fixture, fetchImpl: async () => responseFactory() })
    await assert.rejects(provider.query({ outTradeNo: order, amountFen: 600 }), (error) => {
      assert.ok(error instanceof YunGouOSError)
      assert.match(error.code, /^PAYMENT_PROVIDER_[A-Z_]+$/)
      assert.equal(error.cause, undefined)
      assert.equal(JSON.stringify(error).includes(fixture.payKey), false)
      assert.equal(error.stack.includes(fixture.payKey), false)
      return true
    })
  }
})

test('every normal checkout amount round-trips in integer fen without decimal coercion', () => {
  // Includes the one-fen paid diagnostic and all normal monthly-cap quantities.
  for (let amountFen = 1; amountFen <= 6000; amountFen++)
    assert.equal(yuanToFen(fenToYuan(amountFen)), amountFen)
  for (const value of ['6.000', '+6.00', '6e0', '6,00', '6.00\0', '6.00&money=0.01'])
    assert.throws(() => yuanToFen(value), YunGouOSError)
})
