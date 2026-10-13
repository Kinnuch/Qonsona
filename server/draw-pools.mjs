/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain Node server module. */
import { createHash } from 'node:crypto'
import { CATALOG } from './catalog.mjs'

// A period begins at midnight in Shanghai; the end is exclusive. No device clock or timezone selects a pool.
export const POOL_EPOCH = Date.parse('2026-10-12T00:00:00+08:00')
export const POOL_DURATION = 7 * 86400000
export const poolSlot = (now) => Math.max(0, Math.floor((now - POOL_EPOCH) / POOL_DURATION))
export const regularCharacters = () => CATALOG.filter((character) => !character.special)

/** One permutation is retained for the whole cycle; a new cycle cannot immediately repeat the prior SSR. */
export function cycleOrder(seed, startSlot, previousLast = null) {
  const ids = regularCharacters()
    .filter((character) => character.tier === 'SSR')
    .map((character) => character.id)
    .sort()
  if (!ids.length) throw new Error('At least one regular SSR is required for the draw pool')
  const fingerprint = ids.join(',')
  const order = ids
    .map((id) => ({
      id,
      score: createHash('sha256')
        .update(`${seed}:qonsona-pool-v1:${startSlot}:${fingerprint}:${id}`)
        .digest('hex')
    }))
    .sort((a, b) => a.score.localeCompare(b.score) || a.id.localeCompare(b.id))
    .map((entry) => entry.id)
  if (order.length > 1 && order[0] === previousLast) [order[0], order[1]] = [order[1], order[0]]
  return order
}
export function poolForSlot(slot, ssrId) {
  const startAt = POOL_EPOCH + slot * POOL_DURATION
  const endAt = startAt + POOL_DURATION
  const characterIds = [
    ...regularCharacters()
      .filter((character) => character.tier !== 'SSR')
      .map((character) => character.id),
    ssrId
  ]
  const fingerprint = createHash('sha256').update(characterIds.join(',')).digest('hex').slice(0, 12)
  return { id: `weekly-${slot}-${fingerprint}`, startAt, endAt, ssrIds: [ssrId], characterIds }
}
// Pure domain tests use this fallback; the service always passes a pool from its persisted global schedule.
export function testPool(now) {
  const slot = poolSlot(now)
  let start = 0,
    previous = null,
    order = cycleOrder('domain-test-schedule', start, previous)
  while (slot >= start + order.length) {
    previous = order.at(-1)
    start += order.length
    order = cycleOrder('domain-test-schedule', start, previous)
  }
  return poolForSlot(slot, order[slot - start])
}
