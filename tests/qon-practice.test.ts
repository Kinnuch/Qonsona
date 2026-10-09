/**
 * 千语集语言的练习：按词库、构形与例句出题（Aelith、Tsahun 两种情况）。
 * 每种能出的题都出得来，答案在选项里、选项不重复；按级只出那一级的词；作者藏起来的词不出；
 * 有词源与音变规则的出音变题。
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { parseProject } from '$qon/core/serialize'
import type { LocalizedText, Project } from '$qon/core/model'
import { frequencyLevels } from '$lib/packs/qonlang/levels'
import { firstGloss } from '$lib/packs/qonlang/lexicon'
import { qonPractice, qonPracticeKinds, type QonPracticeInput } from '$lib/practice/qonlang'
import type { ExamQuestion } from '$shared/exam'

const load = (name: string): Project =>
  parseProject(readFileSync(resolve(__dirname, 'fixtures/qonlang', name), 'utf8'))
const pick = (t: LocalizedText): string => t.zh || t.en || Object.values(t).find(Boolean) || ''

function input(p: Project, abbr: string, extra: Partial<QonPracticeInput> = {}): QonPracticeInput {
  const lang = p.languages.find((l) => l.abbr === abbr)!
  return {
    project: p,
    lang,
    bcp47: `art-x-${abbr}`,
    hidden: new Set(),
    levels: frequencyLevels(p, lang.id),
    level: null,
    gloss: (l) => firstGloss(l, pick),
    pick,
    ...extra
  }
}

const key = (c: ExamQuestion['choices'][number]): string => JSON.stringify(c.text)

function valid(q: ExamQuestion): void {
  expect(q.choices.length, q.id).toBe(4)
  expect(new Set(q.choices.map(key)).size, `${q.id} ${q.choices.map(key).join(' ')}`).toBe(4)
  expect(q.answer).toBeGreaterThanOrEqual(0)
  expect(q.answer).toBeLessThan(4)
  expect(q.explain.lines.length).toBeGreaterThan(0)
  if (q.kind === 'listen-word') expect(q.prompt.listen?.ipa, q.id).toBeTruthy()
}

describe.each([
  ['Aelith.laim.json', 'ae'],
  ['Tsahun.laim.json', 'ts']
])('%s', (file, abbr) => {
  const p = load(file)
  const x = input(p, abbr)
  const kinds = qonPracticeKinds(x)

  it('有词义、听词这几种题；每种都出得来，题目没毛病', () => {
    expect(kinds).toEqual(expect.arrayContaining(['word-meaning', 'meaning-word', 'listen-word']))
    for (const kind of kinds) {
      const qs = qonPractice(x, kind, 6, 11)
      expect(qs.length, kind).toBeGreaterThan(0)
      qs.forEach(valid)
      expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length)
    }
  })

  it('同样的种子出同样的题', () => {
    expect(qonPractice(x, kinds[0], 5, 3)).toEqual(qonPractice(x, kinds[0], 5, 3))
  })

  it('选了一级就只出这一级的词', () => {
    const levels = x.levels!
    const lv = levels.system.levels[0].id
    const ids = new Set(
      Object.entries(levels.entries)
        .filter(([, l]) => l === lv)
        .map(([id]) => id)
    )
    const lemmas = new Set(p.lexemes.filter((l) => ids.has(l.id)).map((l) => l.lemma))
    const qs = qonPractice({ ...x, level: lv }, 'word-meaning', 20, 5)
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) expect(lemmas.has(q.prompt.text), q.prompt.text).toBe(true)
  })

  it('作者藏起来的词不出，干扰项也不用它', () => {
    const lemma = qonPractice(x, 'word-meaning', 1, 1)[0].prompt.text
    const hidden = new Set(p.lexemes.filter((l) => l.lemma === lemma).map((l) => l.id))
    expect(
      qonPractice({ ...x, hidden }, 'word-meaning', 200, 1).map((q) => q.prompt.text)
    ).not.toContain(lemma)
    const labels = qonPractice({ ...x, hidden }, 'meaning-word', 200, 1).flatMap((q) =>
      q.choices.map(key)
    )
    expect(labels.length).toBeGreaterThan(0)
    expect(labels).not.toContain(JSON.stringify(lemma))
  })

  it('解析带着生词本卡片的键与录音键', () => {
    const q = qonPractice(x, 'word-meaning', 1, 2)[0]
    expect(q.explain.card).toMatch(/^lexeme-/)
    expect(q.explain.say?.key).toBe(q.explain.card)
  })
})

describe('构形与例句', () => {
  it('Aelith 有屈折形和带译文的例句：出变形题和句子题', () => {
    const kinds = qonPracticeKinds(input(load('Aelith.laim.json'), 'ae'))
    expect(kinds).toEqual(expect.arrayContaining(['conjugate', 'sentence']))
  })

  it('有屈折形的语言出变形题：选项都是这个词的形', () => {
    for (const [file, abbr] of [
      ['Aelith.laim.json', 'ae'],
      ['Tsahun.laim.json', 'ts']
    ]) {
      const p = load(file)
      const x = input(p, abbr)
      if (!qonPracticeKinds(x).includes('conjugate')) continue
      for (const q of qonPractice(x, 'conjugate', 8, 4)) {
        const lex = p.lexemes.find((l) => l.lemma === q.prompt.text && l.languageId === x.lang.id)!
        const forms = new Set(Object.values(lex.forms).map((f) => f.surface))
        for (const c of q.choices)
          expect(forms.has(c.text as string), `${lex.lemma} ${c.text}`).toBe(true)
      }
    }
  })
})

describe('音变', () => {
  it('Aelith、Merun 从原始语推过来的词出音变题：题面是原形，答案是推到这门语言的形式', () => {
    const p = load('Aelith.laim.json')
    for (const abbr of ['ae', 'mr']) {
      const x = input(p, abbr)
      expect(qonPracticeKinds(x), abbr).toContain('sound-change')
      const qs = qonPractice(x, 'sound-change', 10, 3)
      expect(qs.length, abbr).toBeGreaterThanOrEqual(2)
      for (const q of qs) {
        valid(q)
        expect(q.prompt.text.startsWith('*'), q.id).toBe(true)
        const right = q.choices[q.answer].text as string
        const lex = p.lexemes.find(
          (l) => l.languageId === x.lang.id && l.lemma.replace(/-$/, '') === right
        )
        expect(lex, `${abbr} ${right}`).toBeTruthy()
        expect(String(q.explain.lines[0])).toContain('→')
      }
    }
  })

  it('没有词源、音变规则的语言不出音变题', () => {
    const x = input(load('Tsahun.laim.json'), 'ts')
    expect(qonPracticeKinds(x)).not.toContain('sound-change')
  })
})
