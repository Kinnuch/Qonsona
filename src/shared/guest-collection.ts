import type { CollectionSnapshot } from './account'

/** 本机体验不创建账号，不把本机数据伪装成服务器资产。 */
export type GuestCollectionSnapshot = Omit<CollectionSnapshot, 'user'>

export interface GuestStarter {
  characterId: string
  claimedAt: number
  claimedBy?: string
}

export interface GuestCollectionState {
  snapshot: GuestCollectionSnapshot
  starter: GuestStarter | null
}
