/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain Node server module. */
import { createHash } from 'node:crypto'
import configuration from './catalog.json' with { type: 'json' }

/** Author-editable names, exterior-based species and empty biography fields live in catalog.json. */
export const CATALOG = configuration
export function monthlyCharacter(month) {
  return {
    id: `monthly-${month}`,
    tier: 'SSR',
    sheet: 2,
    cell: 8,
    speciesId: 'blue',
    name: { zh: `${month} 月度精灵`, en: `${month} Monthly Spirit` },
    special: 'monthly',
    month,
    sprite: { x: 337, y: 54, width: 22, height: 18, sheetWidth: 393, sheetHeight: 160 },
    biography: { introduction: '', traits: '', story: '' }
  }
}
export function catalogFor(state, day) {
  const months = new Set([
    day.slice(0, 7),
    ...Object.keys(state.characters)
      .filter((id) => /^monthly-\d{4}-\d{2}$/.test(id))
      .map((id) => id.slice(8))
  ])
  return [...CATALOG, ...[...months].sort().map(monthlyCharacter)]
}
export function characterFor(id) {
  return (
    CATALOG.find((character) => character.id === id) ||
    (/^monthly-\d{4}-(?:0[1-9]|1[0-2])$/.test(id || '') ? monthlyCharacter(id.slice(8)) : null)
  )
}
export function speciesFor(catalog) {
  const names = {
    cat: { zh: '猫形精灵', en: 'Cat Spirits' },
    mist: { zh: '白色精灵', en: 'White Spirits' },
    pink: { zh: '粉色精灵', en: 'Pink Spirits' },
    blue: { zh: '蓝色精灵', en: 'Blue Spirits' }
  }
  return [...new Set(catalog.map((character) => character.speciesId))].map((id) => ({
    id,
    name: names[id] || { zh: id, en: id },
    characterIds: catalog
      .filter((character) => character.speciesId === id)
      .map((character) => character.id)
  }))
}
export function discountedCharacter(day) {
  const candidates = CATALOG.filter((character) => ['A', 'R'].includes(character.tier))
  const seed = createHash('sha256').update(`qonsona-discount-v1:${day}`).digest().readUInt32BE(0)
  return candidates[seed % candidates.length]
}
export const SHOP = [
  { id: 'ticket', price: 240, currency: 'points', type: 'ticket' },
  { id: 'makeup', price: 80, currency: 'points', type: 'makeup' },
  ...CATALOG.filter((character) => ['A', 'R'].includes(character.tier)).map((character) => ({
    id: `character:${character.id}`,
    price: character.tier === 'A' ? 240 : 720,
    currency: 'points',
    type: 'character',
    characterId: character.id,
    tier: character.tier,
    name: character.name
  })),
  { id: 'decoration:glow', price: 20, currency: 'echoes', type: 'decoration' }
]
export function shopFor(day) {
  const discounted = discountedCharacter(day).id
  return SHOP.map((item) =>
    item.characterId === discounted
      ? { ...item, originalPrice: item.price, price: item.price / 2, discount: 0.5 }
      : { ...item }
  )
}
