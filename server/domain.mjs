/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain JavaScript runs directly on Node24 without a TypeScript build. */
import { randomBytes } from 'node:crypto'
import { CATALOG, shopFor, characterFor, monthlyCharacter } from './catalog.mjs'
import { testPool } from './draw-pools.mjs'
import homeSkins from './home-skins.json' with { type: 'json' }
export { CATALOG, SHOP } from './catalog.mjs'

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
  supportSpent: 0,
  companion: { currentId: null, progress: {} },
  answerDays: {},
  monthlyClaims: []
})
export const HOME_SKINS = homeSkins
export function homeState(state) {
  state.inventory.homeSkins ??= ['room-placeholder']
  state.home ??= { revision: 0, skinId: 'room-placeholder', placements: [], furniture: [] }
  return state.home
}
export function updateHome(state, body) {
  shape(
    body,
    ['requestId', 'expectedRevision', 'skinId', 'placements'],
    ['requestId', 'expectedRevision', 'skinId', 'placements']
  )
  const home = homeState(state)
  const expected = integer(body.expectedRevision, 0, Number.MAX_SAFE_INTEGER)
  if (expected !== home.revision) fail('HOME_CHANGED', 409)
  const skinId = text(body.skinId, 1, 64)
  if (!HOME_SKINS.some((skin) => skin.id === skinId) || !state.inventory.homeSkins.includes(skinId))
    fail('INVALID_HOME_SKIN', 403)
  if (!Array.isArray(body.placements) || body.placements.length > 30)
    fail('INVALID_HOME_PLACEMENTS')
  const ids = new Set()
  const placements = body.placements.map((placement) => {
    shape(placement, ['characterId', 'x', 'y'], ['characterId', 'x', 'y'])
    const characterId = text(placement.characterId, 1, 64)
    if (!characterFor(characterId) || !state.characters[characterId])
      fail('CHARACTER_NOT_OWNED', 403)
    if (ids.has(characterId)) fail('DUPLICATE_HOME_CHARACTER')
    ids.add(characterId)
    for (const position of [placement.x, placement.y])
      if (
        typeof position !== 'number' ||
        !Number.isFinite(position) ||
        position < 0 ||
        position > 1
      )
        fail('INVALID_HOME_POSITION')
    return { characterId, x: placement.x, y: placement.y }
  })
  home.skinId = skinId
  home.placements = placements
  home.revision++
  return { homeRevision: home.revision }
}
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
  const monthlyReward = awardMonthly(state, day, now)
  return {
    acceptedSeconds: seconds,
    earned: { timePoints, taskPoints, weeklyBonus },
    day,
    monthlyReward
  }
}
export function acquire(state, character, source, now) {
  const old = state.characters[character.id]
  const echoes = old ? RULES.duplicateEchoes[character.tier] : 0
  if (old) old.count++
  else state.characters[character.id] = { id: character.id, count: 1, firstAt: now, source }
  state.balances.echoes += echoes
  return { id: character.id, tier: character.tier, duplicate: !!old, echoes }
}
export function draw(state, body, now, random = secureRandom, pool = testPool(now)) {
  shape(body, ['requestId', 'source', 'count', 'expectedPoolId'], ['requestId', 'source', 'count'])
  if (body.expectedPoolId !== undefined && text(body.expectedPoolId, 1, 128) !== pool.id)
    fail('DRAW_POOL_CHANGED', 409)
  if (!['learning', 'support'].includes(body.source)) fail('INVALID_TICKET_SOURCE')
  if (![1, 10].includes(body.count)) fail('INVALID_DRAW_COUNT')
  if (state.balances.tickets[body.source] < body.count) fail('INSUFFICIENT_TICKETS', 409)
  state.balances.tickets[body.source] -= body.count
  if (body.source === 'support') state.supportSpent += body.count
  const results = []
  for (let i = 0; i < body.count; i++) {
    const tier = chooseTier(state.pity, random)
    const candidates = CATALOG.filter((c) => c.tier === tier && pool.characterIds.includes(c.id))
    if (!candidates.length) throw new Error('The active pool must include every regular tier')
    const choice = random()
    if (!(choice >= 0 && choice < 1)) throw new Error('Invalid secure random source')
    const character = candidates[Math.floor(choice * candidates.length)]
    state.pity.sinceSSR = tier === 'SSR' ? 0 : state.pity.sinceSSR + 1
    state.pity.sinceHigh = ['SR', 'SSR'].includes(tier) ? 0 : state.pity.sinceHigh + 1
    results.push(acquire(state, character, body.source, now))
  }
  return { results, poolId: pool.id }
}
export function purchase(state, body, now) {
  shape(body, ['requestId', 'itemId', 'quantity', 'expectedPrice'], ['requestId', 'itemId'])
  const item = shopFor(dayAt(now)).find((item) => item.id === body.itemId)
  if (!item) fail('UNKNOWN_SHOP_ITEM')
  if (body.expectedPrice !== undefined && integer(body.expectedPrice, 1, 100000) !== item.price)
    fail('SHOP_PRICE_CHANGED', 409)
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

export const COMPANION_MILESTONES = [100, 300, 700, 1500, 3000].map((xp, index) => ({
  xp,
  id: `keepsake-${index + 1}`,
  name: { zh: `精灵收藏品 ${index + 1}`, en: `Spirit Keepsake ${index + 1}` }
}))
export function companionState(state) {
  state.companion ??= { currentId: null, progress: {} }
  state.answerDays ??= {}
  return state.companion
}
export function selectCompanion(state, body) {
  shape(body, ['requestId', 'characterId', 'expectedCurrentId'], ['requestId', 'characterId'])
  const companion = companionState(state)
  if (Object.hasOwn(body, 'expectedCurrentId')) {
    const expected = body.expectedCurrentId === null ? null : text(body.expectedCurrentId, 1, 64)
    if (expected !== companion.currentId) fail('COMPANION_CHANGED', 409)
  }
  const characterId = text(body.characterId, 1, 64)
  if (!characterFor(characterId) || !state.characters[characterId]) fail('CHARACTER_NOT_OWNED', 403)
  companion.currentId = characterId
  companion.progress[characterId] ??= { characterId, xp: 0, gifts: [] }
  return { characterId }
}
export function companionAnswer(state, body, now, seen, record) {
  shape(
    body,
    ['requestId', 'language', 'answerId', 'correct', 'characterId'],
    ['requestId', 'language', 'answerId', 'correct']
  )
  if (!validLanguage(body.language)) fail('INVALID_LANGUAGE')
  const answerId = text(body.answerId, 1, 256)
  if (body.correct !== true) fail('INVALID_ANSWER')
  const companion = companionState(state),
    characterId = companion.currentId
  if (Object.hasOwn(body, 'characterId') && text(body.characterId, 1, 64) !== characterId)
    fail('COMPANION_CHANGED', 409)
  const previous = seen(body.language, answerId)
  if (previous) return { accepted: false, xp: 0, gifts: [], characterId: previous.character_id }
  if (!characterId || !state.characters[characterId]) fail('COMPANION_NOT_SELECTED', 409)
  const day = dayAt(now)
  if ((state.answerDays[day] || 0) >= 200) fail('DAILY_ANSWER_LIMIT', 429)
  const progress = (companion.progress[characterId] ??= { characterId, xp: 0, gifts: [] })
  progress.xp += 5
  const gifts = COMPANION_MILESTONES.filter(
    (milestone) => progress.xp >= milestone.xp && !progress.gifts.includes(milestone.id)
  ).map((milestone) => milestone.id)
  progress.gifts.push(...gifts)
  state.answerDays[day] = (state.answerDays[day] || 0) + 1
  record(body.language, answerId, characterId, 5)
  return { accepted: true, xp: 5, gifts, characterId }
}
export function monthlyStatus(state, day) {
  const month = day.slice(0, 7)
  const [year, number] = month.split('-').map(Number)
  const requiredDays = new Date(Date.UTC(year, number, 0)).getUTCDate()
  const completedDays = Object.entries(state.days)
    .filter(
      ([date, d]) =>
        date.startsWith(month + '-') &&
        d.checkin === 'learning' &&
        taskPlan(getDay(state, date)).every((task) => task.done)
    )
    .map(([date]) => date)
    .sort()
  const rewardId = `monthly-${month}`
  return {
    month,
    requiredDays,
    completedDays,
    rewardId,
    claimed: (state.monthlyClaims || []).includes(month) || !!state.characters[rewardId]
  }
}
export function awardMonthly(state, day, now) {
  const monthly = monthlyStatus(state, day)
  if (monthly.claimed || monthly.completedDays.length !== monthly.requiredDays) return null
  state.monthlyClaims ??= []
  state.monthlyClaims.push(monthly.month)
  acquire(state, monthlyCharacter(monthly.month), 'monthly', now)
  return monthly.rewardId
}
