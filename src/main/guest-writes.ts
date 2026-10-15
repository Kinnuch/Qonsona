import { pendingWrites } from './pending-writes'
import { GuestCollectionError } from './guest-collection'

/** 业务拒绝没有未保存数据，不能让「第二次领取」阻止正常关窗。 */
export async function trackGuestWrite<T>(key: string, work: () => Promise<T>): Promise<T> {
  const result = await pendingWrites.run(key, async () => {
    try {
      return { ok: true as const, value: await work() }
    } catch (error) {
      if (error instanceof GuestCollectionError && error.code !== 'GUEST_STATE_UNAVAILABLE')
        return { ok: false as const, error }
      throw error
    }
  })
  if (!result.ok) throw result.error
  return result.value
}
