/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Operator-run Node smoke for the isolated test service. */
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
const base = 'http://127.0.0.1:3781/v1'
const password = randomBytes(24).toString('base64url')
const username = 'qa_' + randomBytes(6).toString('hex')
let token, token2
async function request(method, path, body, identity = token, status = 200) {
  const result = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Qon-App': 'qonsona',
      ...(identity ? { Authorization: `Bearer ${identity}` } : {})
    },
    ...(method !== 'GET' ? { body: JSON.stringify(body ?? {}) } : {})
  })
  const value = await result.json()
  assert.equal(result.status, status, value.error?.code)
  return value
}
let health
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    health = await request('GET', '/health', undefined, null)
    break
  } catch (error) {
    if (attempt === 39) throw error
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}
assert.equal(health.testing.grantsEnabled, true)
assert.equal(health.payments.enabled, false)
const registered = await request(
  'POST',
  '/auth/register',
  { username, password, nickname: '测试账号 QA' },
  null
)
token = registered.token
const login = await request('POST', '/auth/login', { username, password }, null)
token2 = login.token
assert.equal(login.user.id, registered.user.id)
const gift = await request('POST', '/test/grant', {})
assert.equal(gift.snapshot.balances.tickets.learning, 100)
const giftReplay = await request('POST', '/test/grant', {})
assert.equal(giftReplay.snapshot.balances.tickets.learning, 100)
const drawPayload = { requestId: randomUUID(), source: 'learning', count: 10 }
const draw = await request('POST', '/draw', drawPayload)
assert.equal(draw.snapshot.balances.tickets.learning, 90)
const replay = await request('POST', '/draw', drawPayload, token2)
assert.deepEqual(replay.results, draw.results)
assert.equal(replay.snapshot.balances.tickets.learning, 90)
const otherDevice = await request('GET', '/collection', undefined, token2)
assert.equal(otherDevice.balances.tickets.learning, 90)
await request('PATCH', '/auth/me', { publicCollection: true, publicTime: true })
const board = await request('GET', '/leaderboards?kind=collection&limit=20')
assert(board.rows.some((row) => row.publicId === registered.user.publicId))
assert(board.rows.every((row) => !Object.hasOwn(row, 'username')))
const created = await request('POST', '/support/orders', { requestId: randomUUID(), tickets: 1 })
assert.equal(created.order.testing, true)
assert.equal(created.order.amountFen, 600)
const approval = {
  requestId: randomUUID(),
  paymentReference: 'QA-' + randomUUID(),
  amountFen: 600,
  adultVerified: true
}
await request(
  'POST',
  '/admin/support/orders/' + created.order.id + '/approve',
  approval,
  process.env.QON_ADMIN_KEY
)
const paid = await request('GET', '/collection')
assert.equal(paid.balances.tickets.support, 1)
const paidDraw = await request('POST', '/draw', {
  requestId: randomUUID(),
  source: 'support',
  count: 1
})
assert.equal(paidDraw.snapshot.balances.tickets.support, 0)
assert.equal(
  paidDraw.snapshot.pity.sinceSSR,
  paidDraw.results[0].tier === 'SSR' ? 0 : paid.pity.sinceSSR + 1
)
await request('PATCH', '/auth/me', { publicCollection: false, publicTime: false })
await request('POST', '/auth/logout', {})
await request('GET', '/auth/me', undefined, token, 401)
assert.equal((await request('GET', '/auth/me', undefined, token2)).user.id, registered.user.id)
console.log(
  JSON.stringify({
    passed: true,
    remoteDatabase: true,
    checks: [
      'register-login',
      'same-account-two-sessions',
      '100-test-grant-once',
      'draw-idempotency',
      'cross-device-balance',
      'opt-in-leaderboard',
      'simulated-payment-approval',
      'ticket-source-shared-pity',
      'logout-session-isolation'
    ]
  })
)
