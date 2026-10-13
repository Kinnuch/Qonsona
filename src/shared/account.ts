/** Server-owned identity and assets. Desktop IPC never exposes a bearer token. */
export type AccountTier = 'A' | 'R' | 'SR' | 'SSR'
export interface AccountUser {
  id: string
  username: string
  nickname: string
  publicId: string
  publicCollection: boolean
  publicTime: boolean
  rankVisibility?: 'global' | 'friends'
  createdAt: string | number
}
export interface AccountCharacter {
  id: string
  tier: AccountTier
  sheet: number
  cell: number
  name: { zh: string; en: string }
  speciesId?: string
  biography?: { introduction: string; traits: string; story: string }
  sprite?: {
    x: number
    y: number
    width: number
    height: number
    sheetWidth: number
    sheetHeight: number
  }
  special?: 'monthly'
  month?: string
}
export interface AccountShopItem {
  id: string
  price: number
  currency: 'points' | 'echoes'
  name?: { zh: string; en: string }
  type: 'ticket' | 'makeup' | 'character' | 'decoration'
  characterId?: string
  tier?: AccountTier
  originalPrice?: number
  discount?: number
}
export interface AccountTask {
  id: string
  kind?: 'reading' | 'practice' | 'courses' | 'review' | 'any'
  completed?: boolean
  done?: boolean
  reward?: number
  name?: { zh: string; en: string }
}
export interface AccountHistory {
  id: string
  at: string | number
  kind: string
  detail: Record<string, unknown>
  itemId?: string
  points?: number
  echoes?: number
  count?: number
  source?: string
  results?: DrawResult[]
}
export interface AccountDrawPool {
  id: string
  startAt: number
  endAt: number
  ssrIds: string[]
  characterIds: string[]
}
export interface AccountHome {
  revision: number
  skinId: string
  placements: { characterId: string; x: number; y: number }[]
  furniture: []
}
export interface CollectionSnapshot {
  version: 1
  revision: number
  legacy: { id: string; day: string; at: number; minutes: number }[]
  serverTime: string | number
  day: string
  user: AccountUser
  balances: { points: number; tickets: { learning: number; support: number }; echoes: number }
  pity: { sinceSSR: number; sinceHigh: number }
  characters: { id: string; count: number; firstAt: string | number; source: string }[]
  inventory: { makeup: number; decorations?: string[]; homeSkins?: string[] }
  checkins: { day: string; kind: 'learning' | 'makeup' }[]
  today: {
    taskPlan: {
      id: string
      kind: 'any' | 'reading' | 'practice' | 'courses' | 'review'
      done: boolean
      reward: number
    }[]
    planChanges: number
    seconds: number
    timePoints: number
    taskPoints: number
    tasks: number
    weeklyBonus: number
    weeklyDays?: number
  }
  totals: { seconds: number; collectionCount: number }
  catalog: AccountCharacter[]
  shop: AccountShopItem[]
  drawRules: Record<string, unknown>
  drawPool?: AccountDrawPool
  home?: AccountHome
  homeSkins?: { id: string; name: { zh: string; en: string }; owned: boolean }[]
  history?: AccountHistory[]
  species?: {
    id: string
    name: { zh: string; en: string }
    characterIds: string[]
    hiddenCharacterId?: string
  }[]
  gallery?: {
    type: 'new' | 'discount' | 'popular'
    characterId: string
    date: string
    price?: number
    originalPrice?: number
    ownerCount?: number
  }[]
  companion?: {
    currentId: string | null
    progress: { characterId: string; xp: number; gifts: string[] }[]
    todayAnswers: number
    maxDailyAnswers: number
    xpPerAnswer: number
    milestones: { xp: number; id: string; name: { zh: string; en: string } }[]
  }
  monthly?: {
    month: string
    completedDays: string[]
    requiredDays: number
    rewardId: string
    claimed: boolean
  }
}
export interface AccountSession {
  user: AccountUser | null
  server: { baseUrl: string; online: boolean; testcap: boolean }
  snapshot?: CollectionSnapshot
}
export interface DrawResult {
  id: string
  tier: AccountTier
  duplicate: boolean
  echoes: number
}
export interface SupportOrder {
  id: string
  tickets: number
  amountFen: number
  currency: string
  status: string
  createdAt: string | number
}
export interface Leaderboard {
  kind: 'collection' | 'time'
  language?: string | null
  scope?: 'global' | 'friends'
  rows: {
    rank: number
    publicId: string
    nickname: string
    value: number
    currentCompanion?: AccountCharacter | null
  }[]
}
export interface AccountPublicProfile {
  publicId: string
  nickname: string
  currentCompanion?: AccountCharacter | null
}
export interface AccountFriends {
  friends: AccountPublicProfile[]
  incoming: { id: string; profile: AccountPublicProfile; createdAt: number }[]
  outgoing: { id: string; profile: AccountPublicProfile; createdAt: number }[]
  ownPublicId: string
}
export interface AccountPayloads {
  configureTasks: {
    requestId: string
    kinds: [
      'reading' | 'practice' | 'courses' | 'review',
      'reading' | 'practice' | 'courses' | 'review'
    ]
  }
  importLegacy: { requestId: string; unlocks: CollectionSnapshot['legacy'] }
  register: { username: string; nickname?: string; password: string }
  login: { username: string; password: string }
  logout: Record<string, never>
  me: Record<string, never>
  updateProfile: {
    nickname?: string
    publicCollection?: boolean
    publicTime?: boolean
    rankVisibility?: 'global' | 'friends'
  }
  collection: Record<string, never>
  activity: {
    requestId: string
    language: string
    seconds: number
    completion?: { kind: 'reading' | 'practice' | 'courses' | 'review'; id: string }
  }
  purchase: { requestId: string; itemId: string; quantity?: number; expectedPrice?: number }
  draw: {
    requestId: string
    source: 'learning' | 'support'
    count: 1 | 10
    expectedPoolId?: string
  }
  updateHome: {
    requestId: string
    expectedRevision: number
    skinId: string
    placements: AccountHome['placements']
  }
  useItem: { requestId: string; itemId: 'makeup'; day: string }
  leaderboards: {
    kind: 'collection' | 'time'
    language?: string
    limit?: number
    scope?: 'global' | 'friends'
  }
  friends: Record<string, never>
  requestFriend: { requestId: string; publicId: string }
  respondFriend: { requestId: string; invitationId: string; accept: boolean }
  removeFriend: { requestId: string; publicId: string }
  selectCompanion: { requestId: string; characterId: string; expectedCurrentId?: string | null }
  companionAnswer: {
    requestId: string
    language: string
    answerId: string
    correct: true
    characterId?: string
  }
  createSupportOrder: { requestId: string; tickets: number }
  supportOrders: Record<string, never>
  testGrant: { requestId: string }
}
export interface AccountResponses {
  configureTasks: { snapshot: CollectionSnapshot } | CollectionSnapshot
  importLegacy: { snapshot: CollectionSnapshot } | CollectionSnapshot
  register: { user: AccountUser; snapshot: CollectionSnapshot }
  login: { user: AccountUser; snapshot: CollectionSnapshot }
  logout: { ok?: boolean }
  me: { user: AccountUser; snapshot: CollectionSnapshot }
  updateProfile: { user: AccountUser; snapshot?: CollectionSnapshot }
  collection: CollectionSnapshot
  activity: { snapshot: CollectionSnapshot } | CollectionSnapshot
  purchase: { snapshot: CollectionSnapshot } | CollectionSnapshot
  draw: { results: DrawResult[]; poolId: string; snapshot: CollectionSnapshot }
  updateHome: { snapshot: CollectionSnapshot } | CollectionSnapshot
  useItem: { snapshot: CollectionSnapshot } | CollectionSnapshot
  leaderboards: Leaderboard
  friends: AccountFriends
  requestFriend: { friends: AccountFriends; snapshot: CollectionSnapshot }
  respondFriend: { friends: AccountFriends; snapshot: CollectionSnapshot }
  removeFriend: { friends: AccountFriends; snapshot: CollectionSnapshot }
  selectCompanion: { snapshot: CollectionSnapshot } | CollectionSnapshot
  companionAnswer: {
    accepted: boolean
    xp: number
    gifts: string[]
    characterId: string
    snapshot: CollectionSnapshot
  }
  createSupportOrder: { order: SupportOrder; snapshot: CollectionSnapshot }
  supportOrders: { orders: SupportOrder[] }
  testGrant: { snapshot: CollectionSnapshot } | CollectionSnapshot
}
export type AccountAction = keyof AccountPayloads
