import { describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildTransfer, scheduleTransfer, applyPendingTransfer } from '../src/main/transfer'
import { createBackup, readBackup } from '../src/main/backup'
import {
  addRewardInterval,
  claimRewards,
  COLLECTIBLES,
  completeReward,
  emptyRewards,
  isRewards,
  mergeRewards,
  rewardIntervalEnd
} from '../src/shared/rewards'
import { dayKey } from '../src/shared/srs'
import { emptyActivity, normalizeActivity } from '../src/shared/stats'
import {
  mergeStats,
  mergeTransferFile,
  validateTransfer,
  type TransferBundle
} from '../src/shared/transfer'
const start = new Date(2026, 9, 13, 10).getTime(),
  today = dayKey(start)
const bundle = (content: unknown, path = 'stats.json'): TransferBundle => ({
  app: 'qonsona-transfer',
  format: 1,
  scope: 'personal',
  appVersion: '0.2.0',
  createdAt: new Date(start).toISOString(),
  packs: [{ id: 'ja', kind: 'builtin', name: 'Japanese' }],
  files: [{ path, content }]
})
describe('learning collection', () => {
  it('requires an actual completion and never retroactively grants from old statistics', () => {
    const old = emptyActivity()
    old.days[today] = { packs: { ja: { reading: 1800 } } }
    expect(normalizeActivity(old).rewards).toBeUndefined()
    const r = emptyRewards(start)
    addRewardInterval(r, start, start + 300000)
    expect(r.unlocked).toEqual({})
    expect(completeReward(r, 'reading', 'article', 'ja', start + 300000)).toEqual(['companion-1'])
    expect(r.days[today].completions).toHaveLength(1)
    completeReward(r, 'reading', 'article', 'ja', start + 301000)
    expect(r.days[today].completions).toHaveLength(1)
    expect(Object.keys(r.unlocked)).toHaveLength(1)
  })
  it('unlocks at exact 5/15/30-minute boundaries once per day, with a finite twelve-item collection', () => {
    const r = emptyRewards(start)
    completeReward(r, 'courses', 'lesson', 'ja', start)
    addRewardInterval(r, start, start + 299999)
    expect(r.unlocked).toEqual({})
    addRewardInterval(r, start + 299999, start + 300000)
    expect(Object.keys(r.unlocked)).toHaveLength(1)
    addRewardInterval(r, start + 300000, start + 900000)
    expect(Object.keys(r.unlocked)).toHaveLength(2)
    addRewardInterval(r, start + 900000, start + 1800000)
    expect(Object.keys(r.unlocked)).toHaveLength(3)
    expect(claimRewards(r, today, start + 1800000)).toEqual([])
    for (let i = 1; i <= 5; i++) {
      const at = new Date(2026, 9, 13 + i, 10).getTime()
      completeReward(r, 'review', 'session', 'ja', at)
      addRewardInterval(r, at, at + 1800000)
    }
    expect(Object.keys(r.unlocked)).toEqual(COLLECTIBLES.map((c) => c.id))
    expect(isRewards(r)).toBe(true)
  })
  it('splits at local midnight and requires a new check-in on the new date', () => {
    const at = new Date(2026, 9, 13, 23, 59, 50).getTime(),
      r = emptyRewards(at)
    completeReward(r, 'practice', 'paper', 'ja', at)
    addRewardInterval(r, at, at + 20000)
    expect(r.days['2026-10-13'].seconds).toBe(10)
    expect(r.days['2026-10-14'].seconds).toBe(10)
    expect(r.days['2026-10-14'].completions).toHaveLength(0)
    completeReward(r, 'practice', 'paper', 'ja', at + 20000)
    expect(r.days['2026-10-14'].completions).toHaveLength(1)
  })
  it('excludes background, startup, idle playback and non-learning pages, clipping idle overrun', () => {
    for (const section of ['collection', 'settings', 'home', 'packs', 'stats'])
      expect(rewardIntervalEnd(section, start, start + 15000, start, true)).toBeNull()
    expect(rewardIntervalEnd('reading', start, start + 15000, start, false)).toBeNull()
    expect(rewardIntervalEnd('media', start, start + 15000, 0, true)).toBeNull()
    expect(rewardIntervalEnd('reading', start + 119000, start + 134000, start, true)).toBe(
      start + 120000
    )
    expect(rewardIntervalEnd('media', start + 120000, start + 135000, start, true)).toBeNull()
  })
  it('retains rewards through normalization, export validation, old imports and repeat merges without new grants', () => {
    const a = emptyRewards(start)
    completeReward(a, 'reading', 'story', 'ja', start)
    addRewardInterval(a, start, start + 900000)
    const log = { ...emptyActivity(), rewards: a }
    expect(normalizeActivity(log).rewards).toEqual(a)
    expect(validateTransfer(bundle(log)).files[0].content).toEqual(log)
    const b = structuredClone(a)
    b.days[today].seconds += 100
    completeReward(b, 'practice', 'quiz', 'ja', start + 1000)
    const merged = mergeRewards(a, b)
    expect(merged.days[today].seconds).toBe(1000)
    expect(merged.days[today].completions).toHaveLength(2)
    expect(Object.keys(merged.unlocked)).toHaveLength(2)
    expect(mergeRewards(merged, b)).toEqual(merged)
    expect(mergeStats(log, emptyActivity()).rewards).toEqual(a)
    expect(mergeStats(emptyActivity(), log).rewards).toEqual(a)
    const reloaded = normalizeActivity(JSON.parse(JSON.stringify(log)))
    expect(claimRewards(reloaded.rewards!, today, start + 900000)).toEqual([])
  })
  it('rejects impossible dates, invalid amounts, unknown sprites and broken milestone references', () => {
    const r = emptyRewards(start)
    completeReward(r, 'reading', 'story', 'ja', start)
    addRewardInterval(r, start, start + 300000)
    for (const mutation of [
      (x: typeof r) => (x.days[today].seconds = Infinity),
      (x: typeof r) => (x.days[today].claimed = [30]),
      (x: typeof r) => (x.unlocked['unknown'] = x.unlocked['companion-1']),
      (x: typeof r) => (x.days['2026-02-30'] = x.days[today])
    ]) {
      const bad = structuredClone(r)
      mutation(bad)
      expect(isRewards(bad)).toBe(false)
      expect(() => validateTransfer(bundle({ ...emptyActivity(), rewards: bad }))).toThrow()
    }
  })
  it('validates and merges article quiz records as personal-only transfer data', () => {
    const p = { fingerprint: 'a123', answers: [1], completed: false, history: [] }
    const q = {
      ...p,
      answers: [1, 2],
      completed: true,
      history: [{ at: start, answers: [1, 2], total: 2, right: 1 }]
    }
    expect(validateTransfer(bundle({ article: p }, 'article-quizzes/ja.json')).files).toHaveLength(
      1
    )
    const merged = mergeTransferFile('article-quizzes/ja.json', { article: p }, { article: q })
    expect(merged).toEqual({ article: q })
    expect(mergeTransferFile('article-quizzes/ja.json', merged, { article: q })).toEqual(merged)
    expect(() =>
      validateTransfer({ ...bundle({ article: p }, 'article-quizzes/ja.json'), scope: 'notebook' })
    ).toThrow()
    expect(() =>
      validateTransfer(bundle({ article: { ...p, answers: [4] } }, 'article-quizzes/ja.json'))
    ).toThrow()
  })
  it('exports, imports and reloads real reward and article-quiz files without duplicate unlocks', async () => {
    const source = await fs.mkdtemp(join(tmpdir(), 'qonsona-collection-test-'))
    const target = await fs.mkdtemp(join(tmpdir(), 'qonsona-collection-test-'))
    try {
      const r = emptyRewards(start)
      completeReward(r, 'reading', 'story', 'ja', start)
      addRewardInterval(r, start, start + 900000)
      const log = { ...emptyActivity(), rewards: r }
      const quiz = {
        story: {
          fingerprint: 'beef',
          answers: [1, 2],
          completed: true,
          history: [{ at: start, answers: [1, 2], right: 2, total: 2 }]
        }
      }
      await fs.writeFile(join(source, 'stats.json'), JSON.stringify(log))
      await fs.mkdir(join(source, 'article-quizzes'))
      await fs.writeFile(join(source, 'article-quizzes/ja.json'), JSON.stringify(quiz))
      const zip = join(source, 'collection.zip')
      await createBackup(source, zip, '0.2.0')
      const backup = await readBackup(zip)
      expect(backup.ok).toBe(true)
      if (backup.ok) {
        expect(
          JSON.parse(Buffer.from(backup.files['stats.json']).toString('utf8')).rewards
        ).toEqual(r)
        expect(
          JSON.parse(Buffer.from(backup.files['article-quizzes/ja.json']).toString('utf8'))
        ).toEqual(quiz)
      }
      const data = await buildTransfer(source, 'personal', '0.2.0')
      expect(data.packs.map((p) => p.id)).toContain('ja')
      expect(data.files.find((f) => f.path === 'article-quizzes/ja.json')?.content).toEqual(quiz)
      await scheduleTransfer(target, data)
      await applyPendingTransfer(target)
      const first = normalizeActivity(
        JSON.parse(await fs.readFile(join(target, 'stats.json'), 'utf8'))
      )
      expect(first.rewards).toEqual(r)
      expect(claimRewards(first.rewards!, today, start + 900000)).toEqual([])
      await scheduleTransfer(target, data)
      await applyPendingTransfer(target)
      expect(JSON.parse(await fs.readFile(join(target, 'stats.json'), 'utf8'))).toEqual(first)
      expect(
        JSON.parse(await fs.readFile(join(target, 'article-quizzes/ja.json'), 'utf8'))
      ).toEqual(quiz)
    } finally {
      for (const dir of [source, target]) {
        if (dir.startsWith(join(tmpdir(), 'qonsona-collection-test-')))
          await fs.rm(dir, { recursive: true, force: true })
      }
    }
  })
})
