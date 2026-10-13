import type { CollectionSnapshot } from '$shared/account'

/** Display only. The server selects all outcomes and validates all purchases. */
export function nextProbabilities(
  snapshot: Pick<CollectionSnapshot, 'pity' | 'drawRules'>
): Record<string, number> {
  const r = snapshot.drawRules
  const base = r.base as Record<string, number>
  const next = snapshot.pity.sinceSSR + 1
  const ssr =
    next >= Number(r.hardSSR)
      ? 1
      : Math.min(1, base.SSR + Math.max(0, next - Number(r.softSSR) + 1) * Number(r.softStep))
  if (snapshot.pity.sinceHigh + 1 >= Number(r.highPity))
    return { A: 0, R: 0, SR: 1 - ssr, SSR: ssr }
  const sum = base.A + base.R + base.SR
  return {
    A: ((1 - ssr) * base.A) / sum,
    R: ((1 - ssr) * base.R) / sum,
    SR: ((1 - ssr) * base.SR) / sum,
    SSR: ssr
  }
}

export function makeupDates(snapshot: Pick<CollectionSnapshot, 'day' | 'checkins'>): string[] {
  const today = Date.parse(snapshot.day + 'T12:00:00Z')
  if (!Number.isFinite(today)) return []
  const used = new Set(snapshot.checkins.map((d) => d.day))
  return Array.from({ length: 7 }, (_, i) =>
    new Date(today - (i + 1) * 86400000).toISOString().slice(0, 10)
  ).filter((day) => !used.has(day))
}
