/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain JavaScript runs directly on Node24 without a TypeScript build. */
import { randomBytes } from 'node:crypto'

export class ApiError extends Error {
  constructor(code, status = 400) {
    super(code)
    this.code = code
    this.status = status
  }
}
export const fail = (code, status) => {
  throw new ApiError(code, status)
}
export const CATALOG = Array.from({ length: 12 }, (_, i) => ({
  id: `companion-${i + 1}`,
  tier: ['A', 'R', 'SR', 'SSR'][Math.floor(i / 3)],
  sheet: Math.floor(i / 6),
  cell: i % 6,
  name: {
    zh: ['晨光', '墨羽', '金砂', '银芽', '月影', '星团'][i % 6],
    en: ['Dawn', 'Inkwing', 'Goldsand', 'Silverbud', 'Moonshade', 'Starcluster'][i % 6]
  }
}))
export const RULES = {
  base: { A: 0.7, R: 0.244, SR: 0.05, SSR: 0.006 },
  highPity: 20,
  softSSR: 76,
  softStep: 0.05,
  hardSSR: 90,
  sharedPity: true,
  duplicateEchoes: { A: 1, R: 3, SR: 8, SSR: 20 },
  timePointsPerMinute: 2,
  dailyTimePoints: 120,
  dailyTaskPoints: 60,
  weeklyDays: 5,
  weeklySeconds: 600,
  weeklyPoints: 80
}
export const SHOP = [
  { id: 'ticket', price: 240, currency: 'points', type: 'ticket' },
  { id: 'makeup', price: 80, currency: 'points', type: 'makeup' },
  ...CATALOG.filter((c) => ['A', 'R'].includes(c.tier)).map((c) => ({
    id: `character:${c.id}`,
    price: c.tier === 'A' ? 240 : 720,
    currency: 'points',
    type: 'character',
    characterId: c.id
  })),
  { id: 'decoration:glow', price: 20, currency: 'echoes', type: 'decoration' }
]
export const secureRandom = () => randomBytes(4).readUInt32BE(0) / 4294967296
export function probabilities(pity) {
  const draw = pity.sinceSSR + 1
  const SSR = draw >= 90 ? 1 : draw >= 76 ? 0.006 + (draw - 75) * 0.05 : 0.006
  if (pity.sinceHigh + 1 >= 20) return { A: 0, R: 0, SR: 1 - SSR, SSR }
  const left = 1 - SSR,
    total = 0.7 + 0.244 + 0.05
  return { A: (left * 0.7) / total, R: (left * 0.244) / total, SR: (left * 0.05) / total, SSR }
}
export function chooseTier(pity, random = secureRandom) {
  const p = probabilities(pity),
    r = random()
  if (!(r >= 0 && r < 1)) throw new Error('Invalid secure random source')
  if (r < p.SSR) return 'SSR'
  if (r < p.SSR + p.SR) return 'SR'
  if (r < p.SSR + p.SR + p.R) return 'R'
  return 'A'
}
export const dayAt = (now) => new Date(now + 8 * 3600000).toISOString().slice(0, 10)
export const dayNumber = (day) => Date.parse(day + 'T00:00:00+08:00') / 86400000
export function weekAt(day) {
  const at = Date.parse(day + 'T12:00:00Z'),
    weekday = new Date(at).getUTCDay()
  return new Date(at - ((weekday + 6) % 7) * 86400000).toISOString().slice(0, 10)
}
export function validDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const date = new Date(day + 'T12:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day
}
const LANGUAGES = new Set(['ja', 'en', 'fr', 'ko', 'es', 'ar', 'ru', 'gd', 'qya', 'sjn'])
export const validLanguage = (value) =>
  typeof value === 'string' &&
  (LANGUAGES.has(value) || /^qonlang:[A-Za-z0-9_-]{1,128}$/.test(value))
export function shape(body, allowed, required = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('INVALID_BODY')
  if (
    Object.keys(body).some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(body, key))
  )
    fail('INVALID_FIELDS')
}
export function text(value, min = 1, max = 256) {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.length > max ||
    [...value].some(
      (character) => character.codePointAt(0) < 32 || character.codePointAt(0) === 127
    )
  )
    fail('INVALID_TEXT')
  return value.trim()
}
export function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('INVALID_NUMBER')
  return value
}
export function requestId(value) {
  return text(value, 8, 128)
}
export const newState = () => ({
  revision: 0,
  balances: { points: 0, tickets: { learning: 0, support: 0 }, echoes: 0 },
  pity: { sinceSSR: 0, sinceHigh: 0 },
  characters: {},
  legacy: {},
  inventory: { makeup: 0, decorations: [] },
  days: {},
  languageSeconds: {},
  weeklyClaims: [],
  makeupMonths: {},
  lastActivityAt: null,
  supportSpent: 0
})
const TASK_KINDS = ['reading', 'practice', 'courses', 'review']
export function getDay(state, day) {
  const d = (state.days[day] ??= {
    seconds: 0,
    timePoints: 0,
    taskPoints: 0,
    tasks: [],
    checkin: null
  })
  d.plan ??= ['reading', 'review']
  d.planChanges ??= 0
  return d
}
export function taskPlan(d) {
  const kinds = new Set(d.tasks.map((key) => JSON.parse(key)[1]))
  return [
    { id: 'any', kind: 'any', done: d.tasks.length > 0, reward: 20 },
    ...d.plan.map((kind, i) => ({ id: `board-${i + 1}`, kind, done: kinds.has(kind), reward: 20 }))
  ]
}
export function configureTasks(state, body, now) {
  shape(body, ['requestId', 'kinds'], ['requestId', 'kinds'])
  if (
    !Array.isArray(body.kinds) ||
    body.kinds.length !== 2 ||
    new Set(body.kinds).size !== 2 ||
    body.kinds.some((kind) => !TASK_KINDS.includes(kind))
  )
    fail('INVALID_TASK_PLAN')
  const d = getDay(state, dayAt(now))
  if (d.seconds > 0 || d.tasks.length > 0 || d.taskPoints > 0 || d.timePoints > 0)
    fail('TASK_PLAN_LOCKED', 409)
  if (d.planChanges >= 1) fail('TASK_PLAN_CHANGE_LIMIT', 409)
  d.plan = [...body.kinds]
  d.planChanges++
  return { kinds: d.plan }
}
export function importLegacy(state, body, now) {
  shape(body, ['requestId', 'unlocks'], ['requestId', 'unlocks'])
  if (!Array.isArray(body.unlocks) || body.unlocks.length > 12) fail('INVALID_LEGACY')
  const ids = new Set()
  for (const entry of body.unlocks) {
    shape(entry, ['id', 'day', 'at', 'minutes'], ['id', 'day', 'at', 'minutes'])
    if (
      !/^companion-(?:[1-9]|1[0-2])$/.test(entry.id) ||
      typeof entry.id !== 'string' ||
      ids.has(entry.id) ||
      ![5, 15, 30].includes(entry.minutes)
    )
      fail('INVALID_LEGACY_ENTRY')
    if (
      !validDay(entry.day) ||
      entry.day > dayAt(now) ||
      !Number.isSafeInteger(entry.at) ||
      entry.at < 0 ||
      entry.at > now
    )
      fail('INVALID_LEGACY_DATE')
    ids.add(entry.id)
  }
  state.legacy ??= {}
  for (const entry of body.unlocks) {
    const old = state.legacy[entry.id]
    if (!old || entry.at < old.at) state.legacy[entry.id] = { ...entry }
  }
  return { imported: body.unlocks.length }
}
export function activity(state, body, now) {
  shape(
    body,
    ['requestId', 'language', 'seconds', 'completion'],
    ['requestId', 'language', 'seconds']
  )
  if (!validLanguage(body.language)) fail('INVALID_LANGUAGE')
  integer(body.seconds, 0, 60)
  const day = dayAt(now),
    d = getDay(state, day)
  const previous = state.lastActivityAt
  if (previous === null || body.seconds > 0 || !body.completion) state.lastActivityAt = now
  // Never credit a device's whole offline interval or overlapping device time.
  const midnight = Date.parse(day + 'T00:00:00+08:00')
  const elapsed =
    previous === null
      ? 0
      : Math.max(0, Math.min(60, Math.floor((now - Math.max(previous, midnight)) / 1000)))
  const seconds = Math.min(body.seconds, elapsed, 7200 - d.seconds)
  d.seconds += seconds
  state.languageSeconds[body.language] = (state.languageSeconds[body.language] || 0) + seconds
  const timePoints = Math.min(120, Math.floor(d.seconds / 60) * 2) - d.timePoints
  d.timePoints += timePoints
  let taskPoints = 0
  if (body.completion !== undefined) {
    shape(body.completion, ['kind', 'id'], ['kind', 'id'])
    if (!TASK_KINDS.includes(body.completion.kind)) fail('INVALID_COMPLETION')
    const id = text(body.completion.id)
    const key = JSON.stringify([body.language, body.completion.kind, id])
    if (!d.tasks.includes(key)) {
      if (d.tasks.length >= 64) fail('DAILY_EVENT_LIMIT', 429)
      d.tasks.push(key)
      taskPoints = Math.max(
        0,
        Math.min(60, taskPlan(d).filter((task) => task.done).length * 20) - d.taskPoints
      )
      d.taskPoints += taskPoints
    }
    if (d.checkin !== 'learning') d.checkin = 'learning'
  }
  let weeklyBonus = 0
  const week = weekAt(day)
  const qualified = Object.entries(state.days).filter(
    ([date, value]) => weekAt(date) === week && value.seconds >= 600 && value.tasks.length > 0
  ).length
  if (qualified >= 5 && !state.weeklyClaims.includes(week)) {
    state.weeklyClaims.push(week)
    weeklyBonus = 80
  }
  state.balances.points += timePoints + taskPoints + weeklyBonus
  return { acceptedSeconds: seconds, earned: { timePoints, taskPoints, weeklyBonus }, day }
}
export function acquire(state, character, source, now) {
  const old = state.characters[character.id]
  const echoes = old ? RULES.duplicateEchoes[character.tier] : 0
  if (old) old.count++
  else state.characters[character.id] = { id: character.id, count: 1, firstAt: now, source }
  state.balances.echoes += echoes
  return { id: character.id, tier: character.tier, duplicate: !!old, echoes }
}
export function draw(state, body, now, random = secureRandom) {
  shape(body, ['requestId', 'source', 'count'], ['requestId', 'source', 'count'])
  if (!['learning', 'support'].includes(body.source)) fail('INVALID_TICKET_SOURCE')
  if (![1, 10].includes(body.count)) fail('INVALID_DRAW_COUNT')
  if (state.balances.tickets[body.source] < body.count) fail('INSUFFICIENT_TICKETS', 409)
  state.balances.tickets[body.source] -= body.count
  if (body.source === 'support') state.supportSpent += body.count
  const results = []
  for (let i = 0; i < body.count; i++) {
    const tier = chooseTier(state.pity, random)
    const candidates = CATALOG.filter((c) => c.tier === tier)
    const choice = random()
    if (!(choice >= 0 && choice < 1)) throw new Error('Invalid secure random source')
    const character = candidates[Math.floor(choice * candidates.length)]
    state.pity.sinceSSR = tier === 'SSR' ? 0 : state.pity.sinceSSR + 1
    state.pity.sinceHigh = ['SR', 'SSR'].includes(tier) ? 0 : state.pity.sinceHigh + 1
    results.push(acquire(state, character, body.source, now))
  }
  return { results }
}
export function purchase(state, body, now) {
  shape(body, ['requestId', 'itemId', 'quantity'], ['requestId', 'itemId'])
  const item = SHOP.find((item) => item.id === body.itemId)
  if (!item) fail('UNKNOWN_SHOP_ITEM')
  const quantity = integer(body.quantity ?? 1, 1, 10),
    cost = quantity * item.price
  if (item.type === 'character' && (quantity !== 1 || state.characters[item.characterId]))
    fail('ALREADY_OWNED', 409)
  if (item.type === 'makeup' && state.inventory.makeup + quantity > 3) fail('INVENTORY_CAP', 409)
  if (state.balances[item.currency] < cost) fail('INSUFFICIENT_POINTS', 409)
  if (
    item.type === 'decoration' &&
    (quantity !== 1 || state.inventory.decorations.includes(item.id))
  )
    fail('ALREADY_OWNED', 409)
  state.balances[item.currency] -= cost
  const results = []
  if (item.type === 'ticket') state.balances.tickets.learning += quantity
  else if (item.type === 'makeup') state.inventory.makeup += quantity
  else if (item.type === 'decoration') state.inventory.decorations.push(item.id)
  else
    for (let i = 0; i < quantity; i++)
      results.push(
        acquire(
          state,
          CATALOG.find((c) => c.id === item.characterId),
          'shop',
          now
        )
      )
  return { itemId: item.id, quantity, cost, results }
}
export function makeup(state, body, now) {
  shape(body, ['requestId', 'itemId', 'day'], ['requestId', 'itemId', 'day'])
  if (body.itemId !== 'makeup' || !validDay(body.day)) fail('INVALID_MAKEUP')
  const current = dayAt(now),
    distance = dayNumber(current) - dayNumber(body.day)
  if (distance < 1 || distance > 7) fail('MAKEUP_DAY_OUT_OF_RANGE')
  const month = current.slice(0, 7)
  if ((state.makeupMonths[month] || 0) >= 2) fail('MAKEUP_MONTH_LIMIT', 409)
  if (getDay(state, body.day).checkin) fail('ALREADY_CHECKED_IN', 409)
  if (state.inventory.makeup < 1) fail('INSUFFICIENT_ITEMS', 409)
  state.inventory.makeup--
  state.makeupMonths[month] = (state.makeupMonths[month] || 0) + 1
  getDay(state, body.day).checkin = 'makeup'
  return { day: body.day }
}
