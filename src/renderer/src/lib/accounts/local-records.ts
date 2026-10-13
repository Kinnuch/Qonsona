import { dayKey } from '$shared/srs'
import type { Rewards, CompletionKind } from '$shared/rewards'
/** Preserve local completion statistics without issuing any new legacy collectible. */
export function recordLocalCompletion(
  r: Rewards,
  kind: CompletionKind,
  id: string,
  packId: string,
  at: number
): void {
  if (!id.trim() || id.length > 4096 || !packId.trim() || packId.length > 512) return
  const day = (r.days[dayKey(at)] ??= { seconds: 0, completions: [], claimed: [] })
  if (!day.completions.some((c) => c.kind === kind && c.id === id && c.packId === packId))
    day.completions.push({ kind, id, packId, at })
}
export function recordLocalInterval(r: Rewards, start: number, end: number): void {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return
  let at = start
  while (at < end) {
    const date = new Date(at)
    date.setHours(24, 0, 0, 0)
    const stop = Math.min(end, date.getTime())
    const day = (r.days[dayKey(at)] ??= { seconds: 0, completions: [], claimed: [] })
    day.seconds = Math.min(86400, day.seconds + (stop - at) / 1000)
    at = stop
  }
}
