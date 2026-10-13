/* eslint @typescript-eslint/explicit-function-return-type: "off" */
import test from 'node:test'
import assert from 'node:assert/strict'
import { newState, purchase } from '../domain.mjs'

test('direct exchange cannot purchase owned characters or stockpile more than three makeup slips', () => {
  const state = newState()
  state.balances.points = 10000
  const now = Date.now()
  purchase(state, { requestId: 'purchase-first', itemId: 'character:companion-1' }, now)
  const original = structuredClone(state)
  assert.throws(
    () => purchase(state, { requestId: 'purchase-repeat', itemId: 'character:companion-1' }, now),
    (error) => error.code === 'ALREADY_OWNED'
  )
  assert.deepEqual(state, original)
  assert.throws(
    () =>
      purchase(
        state,
        { requestId: 'purchase-bulk', itemId: 'character:companion-2', quantity: 2 },
        now
      ),
    (error) => error.code === 'ALREADY_OWNED'
  )
  assert.deepEqual(state, original)
  purchase(state, { requestId: 'makeup-three', itemId: 'makeup', quantity: 3 }, now)
  const full = structuredClone(state)
  assert.throws(
    () => purchase(state, { requestId: 'makeup-overflow', itemId: 'makeup' }, now),
    (error) => error.code === 'INVENTORY_CAP'
  )
  assert.deepEqual(state, full)
})
