/**
 * 复习排期（验收要求：排期有测试保证）。前半是 Wordbank 锁住的那几条规则，
 * 后半是出题队列、抽查、生词本的操作与每天的计数。
 */
import { describe, expect, it } from 'vitest'
import {
  DAY,
  LADDER,
  STATE,
  buildQueue,
  dayKey,
  endOfDay,
  fuzz,
  grade,
  newSrs,
  preview,
  spotGrade,
  type QueueCard,
  type SrsFields
} from '$shared/srs'
import {
  MINE,
  addCards,
  answer,
  cardsOf,
  countStatuses,
  createList,
  emptyNotebook,
  listOf,
  normalizeNotebook,
  orphansOf,
  removeFromList,
  removeList,
  statusOf,
  today,
  todayCounts
} from '$shared/notebook'

const T0 = new Date(2026, 8, 24, 10, 0).getTime()
const card = (fields: Partial<SrsFields> = {}): SrsFields => ({ ...newSrs('testword'), ...fields })
const within = (v: number, lo: number, hi: number): boolean => v >= lo && v <= hi

describe('排期规则', () => {
  it('认识沿 1/2/4/7/15 阶梯，走完后按熟练度系数增长', () => {
    const c = card()
    let now = T0
    const got: number[] = []
    for (let i = 0; i < 5; i++) {
      grade(c, 5, now)
      got.push(c.ivl)
      now = c.due
    }
    expect(got[0]).toBe(1)
    expect(got[1]).toBe(2)
    expect(within(got[2], 3, 5) && within(got[3], 6, 8) && within(got[4], 13, 17)).toBe(true)
    const before = c.ivl
    grade(c, 5, now)
    expect(c.ivl).toBeGreaterThan(before)
  })

  it('已经排到很远的词答有印象：拉回 ≤ 2 天，退出「掌握」', () => {
    const c = card({ state: STATE.MASTERED, reps: LADDER.length + 1, ivl: 60, due: T0 + 60 * DAY })
    expect(preview(c)[3]).toBeLessThanOrEqual(2)
    grade(c, 3, T0)
    expect(within(c.ivl, 1, 2)).toBe(true)
    expect(c.state).toBe(STATE.REVIEW)
  })

  it('成熟词答有印象也拉回；系数按 SM-2 下调 0.14；之后答认识重新爬阶梯', () => {
    const c = card({ state: STATE.MASTERED, reps: 12, ivl: 200, ease: 2.6, due: T0 })
    grade(c, 3, T0)
    expect(within(c.ivl, 1, 2)).toBe(true)
    expect(c.ease).toBeCloseTo(2.46, 9)
    let now = c.due
    const up: number[] = []
    for (let i = 0; i < 3; i++) {
      grade(c, 5, now)
      up.push(c.ivl)
      now = c.due
    }
    expect(within(up[0], 3, 5) && within(up[1], 6, 8) && within(up[2], 13, 17)).toBe(true)
  })

  it('新词答有印象：1 天后', () => {
    const c = card()
    grade(c, 3, T0)
    expect(c.ivl).toBe(1)
    expect(c.due).toBe(T0 + DAY)
  })

  it('不认识：间隔清零、本轮重来，遗忘次数 +1、系数 −0.2', () => {
    const c = card({ reps: 6, ivl: 40, lapses: 1, ease: 2.5, state: STATE.REVIEW })
    grade(c, 0, T0)
    expect(c).toMatchObject({ ivl: 0, reps: 0, state: STATE.LEARNING, lapses: 2, due: T0 })
    expect(c.ease).toBeCloseTo(2.3, 9)
  })

  it('任何状态下「有印象」都不会比「认识」排得更远', () => {
    for (const reps of [0, 1, 3, 5, 6, 10]) {
      const c = card({
        key: `w${reps}`,
        reps,
        ivl: reps ? LADDER[Math.min(reps, 5) - 1] * 2 : 0,
        state: reps ? STATE.REVIEW : STATE.NEW
      })
      const p = preview(c, false, T0)
      expect(p[3], `reps ${reps}`).toBeLessThanOrEqual(p[5])
    }
  })

  it('抖动：4 天以下不抖，以上在 ±12% 以内，同一个词每次一样', () => {
    expect(fuzz('abc', 2)).toBe(2)
    for (const key of ['a', 'kaso', '子供', 'lexeme-123']) {
      const d = fuzz(key, 50)
      expect(within(d, 44, 56)).toBe(true)
      expect(fuzz(key, 50)).toBe(d)
    }
    const spread = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => fuzz(k, 50)))
    expect(spread.size).toBeGreaterThan(1)
  })

  it('作答记录最多留 40 次', () => {
    const c = card()
    for (let i = 0; i < 50; i++) grade(c, 5, T0 + i * DAY)
    expect(c.hist).toHaveLength(40)
    expect(c.seen).toBe(50)
  })
})

describe('抽查（按词本过闪卡时碰到还没到期的词）', () => {
  it('认识不动排期，只记一次作答', () => {
    const c = card({ state: STATE.REVIEW, reps: 3, ivl: 4, due: T0 + 4 * DAY })
    const before = { due: c.due, ivl: c.ivl, reps: c.reps, ease: c.ease }
    spotGrade(c, 5, T0)
    expect(c).toMatchObject(before)
    expect(c.seen).toBe(1)
    expect(c.hist).toHaveLength(1)
  })
  it('有印象照常拉回，不认识照常算遗忘', () => {
    const a = card({ state: STATE.REVIEW, reps: 4, ivl: 7, due: T0 + 7 * DAY })
    spotGrade(a, 3, T0)
    expect(within(a.ivl, 1, 2)).toBe(true)
    const b = card({ state: STATE.REVIEW, reps: 4, ivl: 7, due: T0 + 7 * DAY, lapses: 0 })
    spotGrade(b, 0, T0)
    expect(b).toMatchObject({ ivl: 0, lapses: 1, state: STATE.LEARNING })
  })
})

describe('今天的出题队列', () => {
  const qc = (key: string, fields: Partial<QueueCard>): QueueCard => ({
    ...newSrs(key),
    order: 0,
    ...fields
  })

  it('复习按到期先后挑（受上限），新词按加入顺序、扣掉今天已学的，均匀穿插', () => {
    const cards: QueueCard[] = [
      qc('r1', { state: STATE.REVIEW, due: T0 - 3 * DAY }),
      qc('r2', { state: STATE.REVIEW, due: T0 - DAY }),
      qc('r3', { state: STATE.REVIEW, due: endOfDay(T0) }),
      qc('r4', { state: STATE.REVIEW, due: endOfDay(T0) + 1 }), // 明天才到期
      qc('n2', { order: 2 }),
      qc('n1', { order: 1 }),
      qc('n3', { order: 3 })
    ]
    const q = buildQueue(cards, {
      newPerDay: 3,
      reviewCap: 2,
      order: 'seq',
      learnedToday: 1,
      now: T0
    })
    // 复习上限 2：逾期最久的 r1、r2；新词还剩 2 个名额：n1、n2
    expect(q).toEqual(['n1', 'r1', 'n2', 'r2'])
  })

  it('random 只打乱提问顺序，不改变挑哪些词', () => {
    const cards = Array.from({ length: 30 }, (_, i) =>
      qc(`r${i}`, { state: STATE.REVIEW, due: T0 - (30 - i) * DAY, order: i })
    )
    let seed = 7
    const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647
    const q = buildQueue(cards, {
      newPerDay: 0,
      reviewCap: 10,
      order: 'random',
      learnedToday: 0,
      now: T0,
      random
    })
    expect(q.slice().sort()).toEqual(
      ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9'].sort()
    )
    expect(q).not.toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9'])
  })

  it('今天新词学满了就只剩复习', () => {
    const cards = [qc('n1', {}), qc('r1', { state: STATE.REVIEW, due: T0 })]
    expect(
      buildQueue(cards, { newPerDay: 5, reviewCap: 10, order: 'seq', learnedToday: 5, now: T0 })
    ).toEqual(['r1'])
  })
})

describe('生词本', () => {
  const inputs = (
    keys: string[]
  ): { key: string; front: string; reading: string; meaning: Record<string, string> }[] =>
    keys.map((k) => ({ key: k, front: k, reading: '', meaning: { zh: k } }))

  it('加卡：新建为新词，已有的只更新卡面；一张卡可以在几个词本里', () => {
    const nb = emptyNotebook(T0)
    expect(addCards(nb, MINE, inputs(['a', 'b']), T0)).toBe(2)
    expect(addCards(nb, MINE, inputs(['b']), T0)).toBe(0)
    const l = createList(nb, 'JLPT N5', 'jlpt-5', T0)
    addCards(nb, l.id, [{ key: 'a', front: 'A', reading: 'x', meaning: {} }], T0)
    expect(nb.cards.a.front).toBe('A')
    expect(Object.keys(nb.cards)).toEqual(['a', 'b'])
    expect(cardsOf(nb, l).map((c) => c.key)).toEqual(['a'])
    expect(nb.cards.a.order).toBeLessThan(nb.cards.b.order)
  })

  it('从最后一个词本移出时连同学习记录删掉；「我的生词」删不掉', () => {
    const nb = emptyNotebook(T0)
    const l = createList(nb, '课文', undefined, T0)
    addCards(nb, MINE, inputs(['a']), T0)
    addCards(nb, l.id, inputs(['a', 'b']), T0)
    expect(orphansOf(nb, l.id)).toBe(1)
    expect(removeList(nb, l.id)).toBe(1)
    expect(Object.keys(nb.cards)).toEqual(['a'])
    expect(removeList(nb, MINE)).toBe(0)
    expect(removeFromList(nb, MINE, ['a'])).toBe(1)
    expect(nb.cards).toEqual({})
    expect(listOf(nb, MINE)).toBeTruthy()
  })

  it('作答记进排期与今天的计数；状态按最近一次作答', () => {
    const nb = emptyNotebook(T0)
    addCards(nb, MINE, inputs(['a', 'b', 'c']), T0)
    expect(statusOf(nb.cards.a)).toBe('new')
    answer(nb, 'a', 5, T0)
    answer(nb, 'b', 3, T0)
    answer(nb, 'c', 0, T0)
    answer(nb, 'c', 5, T0 + 60_000)
    expect(today(nb, T0)).toEqual({ learned: 3, reviewed: 1, total: 4, correct: 2 })
    expect(countStatuses(Object.values(nb.cards))).toEqual({
      new: 0,
      forgot: 0,
      unsure: 1,
      known: 2
    })
    expect(nb.days[dayKey(T0)]).toBeTruthy()
  })

  it('首页的数：今天到期的复习与还能学的新词', () => {
    const nb = emptyNotebook(T0)
    addCards(nb, MINE, inputs(['a', 'b', 'c', 'd']), T0)
    answer(nb, 'a', 5, T0 - DAY) // 昨天学的，今天到期
    expect(todayCounts(nb, { newPerDay: 2, reviewCap: 100 }, T0)).toEqual({ due: 1, fresh: 2 })
    answer(nb, 'b', 5, T0)
    expect(todayCounts(nb, { newPerDay: 2, reviewCap: 100 }, T0)).toEqual({ due: 1, fresh: 1 })
  })

  it('按词本过闪卡：排了期没到期的当抽查，认识不改排期', () => {
    const nb = emptyNotebook(T0)
    addCards(nb, MINE, inputs(['a']), T0)
    answer(nb, 'a', 5, T0)
    // 学过了，明天到期；同一天在闪卡里再答「认识」：当抽查，排期不动
    const due = nb.cards.a.due
    answer(nb, 'a', 5, T0 + 1000, true)
    expect(nb.cards.a.due).toBe(due)
    expect(nb.cards.a.reps).toBe(1)
    // 同样的作答不当抽查，就会往上爬一级（这正是闪卡里要避免的）
    answer(nb, 'a', 5, T0 + 2000)
    expect(nb.cards.a.reps).toBe(2)
  })

  it('读回来的生词本：缺的补上，指着不存在的卡的键去掉', () => {
    const nb = normalizeNotebook({
      cards: { a: { ...newSrs('a'), front: 'a', reading: '', meaning: {}, added: T0, order: 5 } },
      lists: [{ id: 'x', name: '课', keys: ['a', 'zz'], createdAt: T0 }]
    })
    expect(nb.lists.map((l) => l.id)).toEqual([MINE, 'x'])
    expect(listOf(nb, 'x')!.keys).toEqual(['a'])
    expect(nb.seq).toBe(6)
    expect(normalizeNotebook('坏的').lists).toHaveLength(1)
  })
})
