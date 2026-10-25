/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain JavaScript runs directly on Node24 without a TypeScript build. */
import { createHash, timingSafeEqual } from 'node:crypto'

const ORIGIN = 'https://api.pay.yungouos.com'
const PATHS = Object.freeze({
  create: '/api/pay/wxpay/nativePay',
  query: '/api/system/order/getPayOrderInfo',
  close: '/api/pay/wxpay/closeOrder',
  refund: '/api/pay/wxpay/getRefundResult'
})
const MAX_BODY_BYTES = 65536
const MAX_AMOUNT_FEN = 99999900
const NOTIFY_FIELDS = ['code', 'orderNo', 'outTradeNo', 'payNo', 'money', 'mchId']

export class YunGouOSError extends Error {
  constructor(code = 'PAYMENT_PROVIDER_UNAVAILABLE') {
    super(code)
    this.name = 'YunGouOSError'
    this.code = code
  }
}
const fail = (code = 'PAYMENT_PROVIDER_INVALID_RESPONSE') => {
  throw new YunGouOSError(code)
}
const record = (value) => value && typeof value === 'object' && !Array.isArray(value)
const bounded = (value, maximum = 128) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= maximum &&
  ![...value].some((character) => character.codePointAt(0) < 32 || character.codePointAt(0) === 127)
const identifier = (value) => bounded(value) && /^[A-Za-z0-9_-]+$/.test(value)
const validAmount = (value) => Number.isSafeInteger(value) && value >= 1 && value <= MAX_AMOUNT_FEN

// 官方签名用原文，先排序并仅拼接端点指定的签名字段，不将 URL 编码值参与签名。
function signature(fields, key) {
  return createHash('md5')
    .update(
      Object.keys(fields)
        .sort()
        .map((name) => `${name}=${fields[name]}`)
        .concat(`key=${key}`)
        .join('&'),
      'utf8'
    )
    .digest('hex')
    .toUpperCase()
}
export function fenToYuan(value) {
  if (!validAmount(value)) fail('PAYMENT_PROVIDER_INVALID_AMOUNT')
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`
}
export function yuanToFen(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(value))
    fail('PAYMENT_PROVIDER_INVALID_AMOUNT')
  const [whole, decimals = ''] = value.split('.')
  const result = Number(whole) * 100 + Number(decimals.padEnd(2, '0'))
  if (!validAmount(result)) fail('PAYMENT_PROVIDER_INVALID_AMOUNT')
  return result
}
export function isYunGouOSQrCode(value) {
  if (typeof value !== 'string' || value.length > 512) return false
  // type=1 微信原生扫码协议；二维码是本地生成的，不展示远程图片或收银台任意网址。
  return /^weixin:\/\/wxpay\/bizpayurl\?pr=[A-Za-z0-9_-]{1,256}$/.test(value)
}
function notifyAddress(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    fail('PAYMENT_PROVIDER_NOT_CONFIGURED')
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    !/^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(
      url.hostname
    ) ||
    url.pathname === '/'
  )
    fail('PAYMENT_PROVIDER_NOT_CONFIGURED')
  return url.href
}
function cstTime(value) {
  return new Date(value + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ')
}
function paymentTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value))
    return undefined
  const result = Date.parse(value.replace(' ', 'T') + '+08:00')
  return Number.isFinite(result) && cstTime(result) === value ? result : undefined
}
async function boundedJson(response) {
  if (
    response.status !== 200 ||
    response.redirected ||
    !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')
  )
    fail()
  const length = response.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) fail()
  if (!response.body) fail()
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      size += result.value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        fail()
      }
      chunks.push(result.value)
    }
  } finally {
    reader.releaseLock()
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
  } catch {
    fail()
  }
}

export class YunGouOSProvider {
  #key
  #fetch
  #notifyUrl
  #now
  #timeoutMs

  constructor({
    mchId = process.env.QON_YUNGOUOS_MCH_ID,
    payKey = process.env.QON_YUNGOUOS_PAY_KEY,
    notifyUrl = process.env.QON_YUNGOUOS_NOTIFY_URL,
    fetchImpl = globalThis.fetch,
    now = Date.now,
    timeoutMs = 8000
  } = {}) {
    if (
      typeof mchId !== 'string' ||
      !/^\d{6,32}$/.test(mchId) ||
      !bounded(payKey, 256) ||
      payKey.length < 16 ||
      typeof fetchImpl !== 'function' ||
      typeof now !== 'function' ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > 10000
    )
      fail('PAYMENT_PROVIDER_NOT_CONFIGURED')
    this.merchantId = mchId
    this.mchid = mchId
    this.#key = payKey
    this.#notifyUrl = notifyAddress(notifyUrl)
    this.#fetch = fetchImpl
    this.#now = now
    this.#timeoutMs = timeoutMs
    this.enabled = true
    Object.freeze(this)
  }

  async #request(kind, params, method) {
    const url = new URL(PATHS[kind], ORIGIN)
    const encoded = new URLSearchParams(params)
    if (method === 'GET') url.search = encoded.toString()
    const controller = new AbortController()
    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new YunGouOSError('PAYMENT_PROVIDER_TIMEOUT'))
      }, this.#timeoutMs)
    })
    try {
      const response = await Promise.race([
        (async () => {
          const response = await this.#fetch(url.href, {
            method,
            headers: {
              Accept: 'application/json',
              ...(method === 'POST'
                ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' }
                : {})
            },
            ...(method === 'POST' ? { body: encoded.toString() } : {}),
            redirect: 'error',
            signal: controller.signal
          })
          if (response.url && response.url !== url.href) fail()
          return boundedJson(response)
        })(),
        timeout
      ])
      if (
        kind === 'query' &&
        record(response) &&
        response.code === 1 &&
        response.msg === '支付订单不存在' &&
        (response.data === undefined || response.data === null || response.data === '')
      )
        fail('PAYMENT_PROVIDER_ORDER_NOT_FOUND')
      if (!record(response) || response.code !== 0 || !Object.hasOwn(response, 'data')) fail()
      return response.data
    } catch (error) {
      // fetch 错误可能包含含签名的查询 URL，禁止透传原始消息或 cause。
      if (error instanceof YunGouOSError) throw error
      throw new YunGouOSError('PAYMENT_PROVIDER_UNAVAILABLE')
    } finally {
      clearTimeout(timer)
    }
  }

  async create({ outTradeNo, amountFen, description, expiresAt } = {}) {
    if (!identifier(outTradeNo) || outTradeNo.length > 64 || !bounded(description, 127))
      fail('PAYMENT_PROVIDER_INVALID_ORDER')
    const now = this.#now()
    expiresAt ??= now + 20 * 60000
    if (
      !Number.isSafeInteger(now) ||
      !Number.isSafeInteger(expiresAt) ||
      expiresAt <= now ||
      expiresAt > now + 2 * 3600000
    )
      fail('PAYMENT_PROVIDER_INVALID_ORDER')
    const fields = {
      out_trade_no: outTradeNo,
      total_fee: fenToYuan(amountFen),
      mch_id: this.merchantId,
      body: description
    }
    const qrCodeUrl = await this.#request(
      'create',
      {
        ...fields,
        sign: signature(fields, this.#key),
        type: '1',
        // 明确选择不分账；按官方 SDK，此可选字段不参与上述四字段签名。
        auto: '0',
        notify_url: this.#notifyUrl
      },
      'POST'
    )
    if (!isYunGouOSQrCode(qrCodeUrl)) fail()
    return {
      outTradeNo,
      mchid: this.merchantId,
      amountFen,
      status: 'pending',
      qrCodeUrl,
      // 仅为本地结账展示窗口，未向渠道请求强制过期，不能据此认定未付款或关闭。
      expiresAt
    }
  }

  async query({ outTradeNo, amountFen } = {}) {
    if (!identifier(outTradeNo)) fail('PAYMENT_PROVIDER_INVALID_ORDER')
    if (amountFen !== undefined && !validAmount(amountFen)) fail('PAYMENT_PROVIDER_INVALID_AMOUNT')
    const fields = { out_trade_no: outTradeNo, mch_id: this.merchantId }
    const data = await this.#request(
      'query',
      { ...fields, sign: signature(fields, this.#key) },
      'GET'
    )
    if (
      !record(data) ||
      data.outTradeNo !== outTradeNo ||
      data.mchId !== this.merchantId ||
      !identifier(data.orderNo)
    )
      fail()
    const actualAmount = yuanToFen(data.money)
    if (amountFen !== undefined && actualAmount !== amountFen)
      fail('PAYMENT_PROVIDER_AMOUNT_MISMATCH')
    const state = data.payStatus
    const paid = state === 1
    if (paid && !identifier(data.payNo)) fail()
    const paidAt = paid ? paymentTime(data.payTime) : undefined
    return {
      outTradeNo,
      mchid: this.merchantId,
      amountFen: actualAmount,
      status: paid
        ? 'paid'
        : state === 0
          ? 'pending'
          : state === -1 || state === -2
            ? 'closed'
            : 'unknown',
      providerOrderId: data.orderNo,
      ...(paid ? { transactionId: data.payNo } : {}),
      ...(paidAt === undefined ? {} : { paidAt })
    }
  }

  verifyNotification(body) {
    if (!record(body) || !/^[A-F0-9]{32}$/.test(body.sign || ''))
      fail('PAYMENT_PROVIDER_INVALID_SIGNATURE')
    const fields = Object.fromEntries(NOTIFY_FIELDS.map((name) => [name, body[name]]))
    if (
      NOTIFY_FIELDS.some((name) => !bounded(fields[name], name === 'money' ? 16 : 128)) ||
      !['0', '1'].includes(fields.code) ||
      !identifier(fields.orderNo) ||
      !identifier(fields.outTradeNo) ||
      !identifier(fields.payNo) ||
      fields.mchId !== this.merchantId
    )
      fail('PAYMENT_PROVIDER_INVALID_SIGNATURE')
    const expected = Buffer.from(signature(fields, this.#key), 'ascii')
    const supplied = Buffer.from(body.sign, 'ascii')
    if (!timingSafeEqual(expected, supplied)) fail('PAYMENT_PROVIDER_INVALID_SIGNATURE')
    return {
      outTradeNo: fields.outTradeNo,
      mchid: this.merchantId,
      amountFen: yuanToFen(fields.money),
      status: fields.code === '1' ? 'paid' : 'unknown',
      transactionId: fields.payNo,
      providerOrderId: fields.orderNo
    }
  }

  // 官方 closeOrder 只关闭未付订单；不可替换为可能退还已付资金的 reverseOrder。
  async closeOrder({ orderId, outTradeNo = orderId } = {}) {
    if (!identifier(outTradeNo)) fail('PAYMENT_PROVIDER_INVALID_ORDER')
    const fields = { out_trade_no: outTradeNo, mch_id: this.merchantId }
    const closedOrder = await this.#request(
      'close',
      { ...fields, sign: signature(fields, this.#key) },
      'POST'
    )
    if (closedOrder !== outTradeNo) fail()
    return { outTradeNo, mchid: this.merchantId, status: 'closed' }
  }

  // 仅查退款事实，绝不自动退款或调用可能退还已付资金的撤销接口。
  async queryRefund({ refundNo, outTradeNo, amountFen } = {}) {
    if (!identifier(refundNo) || !identifier(outTradeNo) || !validAmount(amountFen))
      fail('PAYMENT_PROVIDER_INVALID_ORDER')
    const fields = { refund_no: refundNo, mch_id: this.merchantId }
    const data = await this.#request(
      'refund',
      { ...fields, sign: signature(fields, this.#key) },
      'GET'
    )
    if (
      !record(data) ||
      data.outTradeNo !== outTradeNo ||
      data.refundMchId !== this.merchantId ||
      (data.refundNo !== refundNo && data.outTradeRefundNo !== refundNo) ||
      !identifier(data.payNo) ||
      !identifier(data.refundNo) ||
      yuanToFen(data.orderMoney) !== amountFen
    )
      fail()
    const refundAmountFen = yuanToFen(data.refundMoney)
    if (refundAmountFen > amountFen) fail()
    return {
      outTradeNo,
      mchid: this.merchantId,
      amountFen,
      status:
        data.refundStatus === 1 || data.refundStatus === '1'
          ? 'refunded'
          : data.refundStatus === 0 || data.refundStatus === '0'
            ? 'pending'
            : 'unknown',
      transactionId: data.payNo,
      refundNo: data.refundNo,
      refundAmountFen
    }
  }

  createNativeOrder({ orderId, ...options } = {}) {
    return this.create({ ...options, outTradeNo: orderId })
  }

  queryOrder({ orderId, ...options } = {}) {
    return this.query({ ...options, outTradeNo: orderId })
  }
}
