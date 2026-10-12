import { describe, expect, it, vi } from 'vitest'
import {
  addCards,
  answer,
  createList,
  emptyNotebook,
  normalizeNotebook,
  reviewAnswerSnapshot,
  restoreReviewAnswer
} from '../src/shared/notebook'
import { DAY, STATE, buildQueue, dayKey, grade, newSrs, spotGrade } from '../src/shared/srs'
import {
  buildReviewPlan,
  rescheduleReview,
  saveReviewSettings,
  scopedToday
} from '../src/shared/review-plan'
import {
  defaultReviewSettings,
  isNotebookReviewSettings,
  isReviewSettings,
  REVIEW_KINDS,
  type ReviewKind
} from '../src/shared/review-settings'
import {
  chooseReviewKind,
  makeReviewQuestion,
  reviewAnswerCorrect,
  reviewCapabilities,
  reviewExample,
  type ReviewData
} from '../src/shared/review-question'

const NOW = new Date(2026, 9, 12, 10).getTime()
function notebook() {
  const nb = emptyNotebook(NOW)
  addCards(
    nb,
    'mine',
    [
      { key: 'cat', front: 'cat', reading: 'kæt', meaning: { en: 'cat', zh: '猫' } },
      { key: 'dog', front: 'dog', reading: 'dɒɡ', meaning: { en: 'dog', zh: '狗' } },
      { key: 'bird', front: 'bird', reading: 'bɜːd', meaning: { en: 'bird', zh: '鸟' } },
      { key: 'fish', front: 'fish', reading: 'fɪʃ', meaning: { en: 'fish', zh: '鱼' } },
      { key: 'tree', front: 'tree', reading: 'triː', meaning: { en: 'tree', zh: '树' } }
    ],
    NOW
  )
  return nb
}
const data: ReviewData = {
  locale: 'en',
  canListen: true,
  examples: [reviewExample('I saw a cat.', ['cat'], '我看见了一只猫。')!]
}
const only = (kind: ReviewKind) => ({
  ...defaultReviewSettings(),
  weights: Object.fromEntries(REVIEW_KINDS.map((k) => [k, k === kind ? 1 : 0])) as ReturnType<
    typeof defaultReviewSettings
  >['weights']
})

describe('复习计划兼容与排期', () => {
  it('旧文件无review配置，沿用用户全局每日设置与旧排期规则', () => {
    const nb = notebook()
    answer(nb, 'dog', 5, NOW)
    nb.cards.dog.due = NOW - 1
    const old = normalizeNotebook(JSON.parse(JSON.stringify(nb)), NOW)
    expect(old.review).toBeUndefined()
    const expected = buildQueue(Object.values(old.cards), {
      newPerDay: 2,
      reviewCap: 1,
      order: 'seq',
      learnedToday: 1,
      now: NOW
    })
    expect(
      buildReviewPlan(old, null, { newPerDay: 2, reviewCap: 1, order: 'seq' }, NOW).queue
    ).toEqual(expected)
    expect(old.cards.dog.ivl).toBe(1)
  })
  it('自定义间隔、掌握阈值应用于当前卡，抽查认识仍不抬高排期', () => {
    const c = newSrs('c')
    grade(c, 5, NOW, 3, [1, 3])
    expect(c.ivl).toBe(1)
    grade(c, 5, c.due, 3, [1, 3])
    expect(c.ivl).toBe(3)
    expect(c.state).toBe(STATE.MASTERED)
    const due = c.due
    spotGrade(c, 5, NOW, 3, [1, 3])
    expect(c.due).toBe(due)
    expect(c.seen).toBe(3)
  })
  it('语言与词本额度隔离、重叠成员只出一次，保存计划不清历史', () => {
    const nb = notebook()
    const list = createList(nb, 'animals', undefined, NOW + 1)
    list.keys = ['cat', 'dog']
    saveReviewSettings(nb, null, { ...defaultReviewSettings(), newPerDay: 1, reviewCap: 5 }, NOW)
    saveReviewSettings(nb, list.id, { ...defaultReviewSettings(), newPerDay: 2, reviewCap: 2 }, NOW)
    const next = createList(nb, 'also animals', undefined, NOW + 2)
    next.keys = ['cat']
    saveReviewSettings(nb, next.id, { ...defaultReviewSettings(), newPerDay: 0 }, NOW)
    const p = buildReviewPlan(nb, null, {}, NOW, false)
    expect(p.queue).toHaveLength(3)
    expect(new Set(p.queue).size).toBe(3)
    expect(p.scopes.cat).toBe(`list:${list.id}`)
    expect(p.settings.cat.newPerDay).toBe(2)
    expect(nb.cards.cat.hist).toEqual([])
  })
  it('保存已有语言计划不重置当天新词与复习额度', () => {
    const nb = notebook()
    answer(nb, 'cat', 5, NOW)
    answer(nb, 'dog', 5, NOW)
    nb.cards.cat.due = NOW
    answer(nb, 'cat', 5, NOW)
    saveReviewSettings(nb, null, { ...defaultReviewSettings(), newPerDay: 2, reviewCap: 1 }, NOW)
    expect(buildReviewPlan(nb, null, {}, NOW).queue).toEqual([])
    expect(scopedToday(nb, null, NOW)).toEqual({ learned: 2, reviewed: 1, total: 3, correct: 3 })
  })
  it('到期卡按指定日期和上限重排，未来卡/新词/历史/间隔/熟练度不被重置', () => {
    const nb = notebook()
    for (const key of ['cat', 'dog', 'bird']) {
      answer(nb, key, 5, NOW - 3 * DAY)
      nb.cards[key].due = NOW - 1
    }
    answer(nb, 'fish', 5, NOW)
    nb.cards.fish.due = NOW + 5 * DAY
    saveReviewSettings(nb, null, { ...defaultReviewSettings(), reviewCap: 2 }, NOW)
    const before = structuredClone(nb)
    expect(rescheduleReview(nb, null, '2026-10-20', 'due', NOW)).toBe(3)
    expect(dayKey(nb.cards.cat.due)).toBe('2026-10-20')
    expect(dayKey(nb.cards.bird.due)).toBe('2026-10-21')
    expect(nb.cards.fish).toEqual(before.cards.fish)
    expect(nb.cards.tree).toEqual(before.cards.tree)
    for (const k of ['cat', 'dog', 'bird']) {
      expect(nb.cards[k].hist).toEqual(before.cards[k].hist)
      expect(nb.cards[k].ivl).toBe(before.cards[k].ivl)
      expect(nb.cards[k].ease).toBe(before.cards[k].ease)
    }
  })
  it('非法日期和计划不能静默成为有效配置', () => {
    const nb = notebook()
    expect(() => rescheduleReview(nb, null, '2026-02-30', 'scheduled', NOW)).toThrow()
    expect(isReviewSettings({ ...defaultReviewSettings(), ladder: [1, 1, 2] })).toBe(false)
    expect(isReviewSettings({ ...defaultReviewSettings(), newPerDay: 1.5 })).toBe(false)
    expect(
      isNotebookReviewSettings({
        lists: { mine: { ...defaultReviewSettings(), weights: {} } },
        updatedAt: NOW
      })
    ).toBe(false)
  })
  it('列表/顶部数量统计不调用随机数', () => {
    const random = vi.spyOn(Math, 'random')
    const nb = notebook()
    saveReviewSettings(nb, null, { ...defaultReviewSettings(), order: 'random' }, NOW)
    buildReviewPlan(nb, null, {}, NOW, false)
    expect(random).not.toHaveBeenCalled()
    random.mockRestore()
  })
  it('三万卡的计划构建保持全部数据且对多词本重叠去重', () => {
    const nb = emptyNotebook(NOW)
    addCards(
      nb,
      'mine',
      Array.from({ length: 30000 }, (_, i) => ({
        key: `w${i}`,
        front: `w${i}`,
        reading: '',
        meaning: { en: `meaning ${i}` }
      })),
      NOW
    )
    saveReviewSettings(nb, null, { ...defaultReviewSettings(), newPerDay: 50 }, NOW)
    const a = createList(nb, 'first', undefined, NOW + 1)
    a.keys = Object.keys(nb.cards).slice(0, 15000)
    saveReviewSettings(nb, a.id, { ...defaultReviewSettings(), newPerDay: 20 }, NOW)
    const b = createList(nb, 'second', undefined, NOW + 2)
    b.keys = Object.keys(nb.cards).slice(10000, 20000)
    saveReviewSettings(nb, b.id, { ...defaultReviewSettings(), newPerDay: 10 }, NOW)
    const plan = buildReviewPlan(nb, null, {}, NOW, false)
    expect(plan.queue.length).toBe(80)
    expect(new Set(plan.queue).size).toBe(80)
    expect(Object.keys(nb.cards).length).toBe(30000)
  })
})

describe('当前复习词的题型、频次和同词撤回', () => {
  it('3:1权重短轮次按比例出题，零权重永不被抽到', () => {
    const weights = only('word-meaning').weights
    weights['word-meaning'] = 3
    weights.spelling = 1
    const counts: Partial<Record<ReviewKind, number>> = {}
    for (let i = 0; i < 40; i++) {
      const k = chooseReviewKind(weights, ['flashcard', 'word-meaning', 'spelling'], counts)!
      counts[k] = (counts[k] ?? 0) + 1
    }
    expect(counts).toEqual({ 'word-meaning': 30, spelling: 10 })
    expect(counts.flashcard).toBeUndefined()
  })
  for (const kind of REVIEW_KINDS.filter((k) => k !== 'flashcard'))
    it(`${kind}正确答案绑定当前cat卡而非无关词`, () => {
      const nb = notebook()
      const q = makeReviewQuestion(
        nb.cards.cat,
        Object.values(nb.cards),
        only(kind),
        data,
        {},
        () => 0.2
      ).question!
      expect(q.cardKey).toBe('cat')
      expect(q.kind).toBe(kind)
      expect(q.answer).toBe(kind === 'reading' ? 'kæt' : 'cat')
      expect(reviewAnswerCorrect(q, q.answer)).toBe(true)
      expect(reviewAnswerCorrect(q, 'tree')).toBe(false)
      if (kind !== 'spelling') {
        expect(q.choices.length).toBe(4)
        expect(new Set(q.choices).size).toBe(4)
      }
    })
  it('读音/听音/语境缺数据时不伪造，已禁用题型仍不出', () => {
    const nb = notebook()
    const card = { ...nb.cards.cat, reading: '' }
    const available = reviewCapabilities(card, Object.values(nb.cards), {
      locale: 'en',
      canListen: false,
      examples: []
    })
    expect(available).not.toContain('reading')
    expect(available).not.toContain('listening')
    expect(available).not.toContain('context')
    const out = makeReviewQuestion(card, Object.values(nb.cards), only('context'), {
      locale: 'en',
      canListen: false,
      examples: []
    })
    expect(out.question).toBeNull()
    expect(out.fallback).toBe(true)
    expect(out.unavailable).toEqual(['context'])
  })
  it('全部频次0明确回退闪卡，默认设置仍为旧闪卡', () => {
    const nb = notebook()
    const allZero = only('flashcard')
    allZero.weights.flashcard = 0
    const out = makeReviewQuestion(nb.cards.cat, Object.values(nb.cards), allZero, data)
    expect(out.fallbackReason).toBe('disabled')
    expect(out.question).toBeNull()
    expect(
      makeReviewQuestion(nb.cards.cat, Object.values(nb.cards), defaultReviewSettings(), data)
    ).toMatchObject({ question: null, fallback: false })
  })
  it('同义词不能成为由义选词干扰项，同音词不成为听音干扰项', () => {
    const nb = notebook()
    addCards(
      nb,
      'mine',
      [{ key: 'syn', front: 'kitty', reading: 'kæt', meaning: { en: 'cat', zh: '猫' } }],
      NOW
    )
    const a = makeReviewQuestion(
      nb.cards.cat,
      Object.values(nb.cards),
      only('meaning-word'),
      data
    ).question!
    const b = makeReviewQuestion(
      nb.cards.cat,
      Object.values(nb.cards),
      only('listening'),
      data
    ).question!
    expect(a.choices).not.toContain('kitty')
    expect(b.choices).not.toContain('kitty')
  })
  it('不把cat在concatenate里的子串冒称例句；日语无空格语境可用', () => {
    expect(reviewExample('concatenate these', ['cat'])).toBeNull()
    expect(reviewExample('猫がいます。', ['猫'])?.answer).toBe('猫')
  })
  it('上下文答案若不是当前词/其来源词形会被拒绝', () => {
    const nb = notebook()
    const invalid = { ...data, examples: [reviewExample('I saw a dog.', ['dog'])!] }
    expect(
      makeReviewQuestion(nb.cards.cat, Object.values(nb.cards), only('context'), invalid).question
    ).toBeNull()
    const plural = { ...data, forms: ['cats'], examples: [reviewExample('I saw cats.', ['cats'])!] }
    expect(
      makeReviewQuestion(nb.cards.cat, Object.values(nb.cards), only('context'), plural).question
        ?.answer
    ).toBe('cats')
  })
  it('练习正确/错误都更新同一张卡，撤回恢复全部SRS历史与两层每日计数', () => {
    const nb = notebook()
    saveReviewSettings(nb, null, { ...defaultReviewSettings(), ladder: [2, 3], masterDays: 3 }, NOW)
    const before = structuredClone(nb)
    const snap = reviewAnswerSnapshot(nb, 'cat', 'language', NOW)
    answer(nb, 'cat', 0, NOW, false, { ladder: [2, 3], masterDays: 3 }, 'language')
    expect(nb.cards.cat.lapses).toBe(1)
    expect(nb.cards.dog).toEqual(before.cards.dog)
    restoreReviewAnswer(nb, snap)
    expect(nb.cards.cat).toEqual(before.cards.cat)
    expect(nb.days).toEqual(before.days)
    expect(nb.reviewDays).toEqual(before.reviewDays)
    answer(nb, 'cat', 5, NOW, false, { ladder: [2, 3], masterDays: 3 }, 'language')
    expect(nb.cards.cat.ivl).toBe(2)
  })
})
