import type { AccountClient } from './account-client'
import type { GuestCollection } from './guest-collection'
import type { AccountSession } from '../shared/account'

/** 调用方串行化整个账号操作；不会在身份变更之间把本机伙伴绑定到另一账号。 */
export async function syncGuestStarter(
  client: Pick<AccountClient, 'request' | 'session'>,
  guest: Pick<GuestCollection, 'session' | 'bind'>,
  session: AccountSession
): Promise<AccountSession> {
  if (!session.user || !session.server.online) return session
  try {
    const local = await guest.session()
    const starter = local.starter
    if (!starter || starter.claimedBy) return session
    await client.request('claimStarter', {
      requestId: `guest-starter:${starter.claimedAt}:${starter.characterId}`,
      characterId: starter.characterId
    })
    await guest.bind(session.user.id)
    return await client.session()
  } catch (error) {
    if (/UNAUTHORIZED|SESSION_EXPIRED|AUTH_REQUIRED/.test(String(error)))
      return await client.session()
    // 登录本身已成功。未知结果保留原请求；下次重连恢复，不把本机失败伪装为退出登录。
    return {
      ...session,
      server: { ...session.server, online: false, testcap: false, error: 'STARTER_SYNC_PENDING' },
      starterSync: 'pending'
    }
  }
}
