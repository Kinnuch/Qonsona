/**
 * 框架语言的练习与模拟卷（src/main/lang/practice.ts）：每种通用题型出的题对不对、同一个种子出同样的题、
 * 按等级取词、特有题型、模拟卷分节与计分。
 * 用一门测试专用的假语言（代码 zz，不碰七门语言自己的模块），词与例句是几句简单的法语。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LexDbWriter } from '../../scripts/lang/lexdb-writer'
import { LexDb } from '../../src/main/lang/lexdb'
import {
  defaultMisspell,
  langPaper,
  langPractice,
  practiceKindsFor
} from '../../src/main/lang/practice'
import { LANGS } from '../../src/shared/lang/registry'
import { cefrSystem } from '../../src/shared/lang/levels'
import { defaultKey, stripMarks } from '../../src/shared/lang/text'
import { rng } from '../../src/shared/course'
import { PRACTICE_SECTION, scorePaper, type ExamQuestion } from '../../src/shared/exam'
import type {
  LangCode,
  LangModule,
  LangPracticeKind,
  LexGrammarPoint,
  TokenTest
} from '../../src/shared/lang/types'

const CODE = 'zz' as LangCode

const point = (
  id: string,
  level: string,
  name: string,
  meaning: { zh: string; en: string },
  ex: { text: string; zh: string; en: string },
  pattern: TokenTest[],
  group?: string
): LexGrammarPoint => ({
  id,
  level,
  name: { zh: name, en: name },
  form: { zh: name, en: name },
  meaning,
  examples: [ex],
  patterns: [pattern],
  ...(group ? { group } : {})
})

const GRAMMAR: LexGrammarPoint[] = [
  point(
    'neg',
    'A1',
    'ne … pas',
    { zh: '否定：不……', en: 'negation: not' },
    { text: 'Il ne mange pas de viande.', zh: '他不吃肉。', en: 'He does not eat meat.' },
    [{ form: 'ne' }, { form: 'pas', gap: 2 }]
  ),
  point(
    'ilya',
    'A1',
    'il y a',
    { zh: '有……', en: 'there is / there are' },
    { text: 'Il y a un chat ici.', zh: '这里有一只猫。', en: 'There is a cat here.' },
    [{ form: 'il' }, { form: 'y' }, { form: 'a' }],
    'il'
  ),
  point(
    'proche',
    'A2',
    'aller + infinitif',
    { zh: '马上要……', en: 'going to' },
    {
      text: 'Je vais manger une pomme.',
      zh: '我要吃一个苹果。',
      en: 'I am going to eat an apple.'
    },
    [{ form: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'] }, { surface: /er$/ }]
  ),
  point(
    'tres',
    'A1',
    'très + adj.',
    { zh: '很……', en: 'very' },
    { text: 'La maison est très grande.', zh: '房子很大。', en: 'The house is very big.' },
    [{ form: 'très' }, { pos: 'adj' }]
  ),
  point(
    'faut',
    'A2',
    'il faut',
    { zh: '必须……', en: 'one must' },
    { text: 'Il faut parler lentement.', zh: '得慢慢说。', en: 'One must speak slowly.' },
    [{ form: 'il' }, { form: 'faut' }],
    'il'
  ),
  // 没有 patterns、只靠例句写的 hl 标出那一段
  {
    id: 'depuis',
    level: 'A2',
    name: { zh: 'depuis', en: 'depuis' },
    form: { zh: 'depuis + 时间', en: 'depuis + time' },
    meaning: { zh: '……以来（一直）', en: 'since / for (ongoing)' },
    examples: [
      {
        text: "J'habite ici depuis deux ans.",
        zh: '我在这里住了两年了。',
        en: 'I have lived here for two years.',
        hl: 'depuis deux ans'
      }
    ]
  }
]

/** 特有题型的样子：名词配冠词 */
const ARTICLE: LangPracticeKind = {
  id: 'article',
  name: { zh: '冠词', en: 'Articles' },
  section: 'grammar',
  make: (db, level, n) =>
    db
      .words({ level, pos: ['noun'], need: ['gloss', 'gender'], limit: 50 })
      .slice(0, n)
      .map((w, i): ExamQuestion => ({
        id: String(i),
        kind: 'custom',
        section: 'grammar',
        ask: { zh: '选出冠词', en: 'Choose the article' },
        prompt: { text: w.w, lang: 'fr' },
        choices: [{ text: 'le' }, { text: 'la' }],
        answer: w.g === 'f' ? 1 : 0,
        explain: { lines: [w.w] }
      }))
}

const FAKE: LangModule = {
  spec: {
    code: CODE,
    name: { zh: '测试语', en: 'Test language' },
    nativeName: 'test',
    bcp47: 'fr',
    color: '#888888',
    direction: 'ltr',
    levelSystems: [cefrSystem([])],
    features: {
      texts: true,
      lexicon: true,
      alphabet: null,
      characters: null,
      grammar: true,
      inflection: true,
      phrasebook: false,
      idioms: false,
      stories: false,
      media: false,
      exam: true,
      ruby: null,
      romanization: false,
      speech: 'fr-FR'
    },
    intro: { zh: '测试', en: 'Test' }
  },
  rules: {
    key: (t) => defaultKey(t, 'fr'),
    looseKey: (t) => stripMarks(defaultKey(t, 'fr'))
  },
  grammar: GRAMMAR,
  practice: [ARTICLE],
  exams: [
    {
      id: 'a1',
      level: 'A1',
      title: { zh: 'A1 模拟卷', en: 'A1 mock exam' },
      basis: { zh: '测试用', en: 'For tests' },
      sections: [
        {
          id: 'vocab',
          title: { zh: '词汇', en: 'Vocabulary' },
          minutes: 10,
          parts: [
            { kind: 'word-meaning', n: 3 },
            { kind: 'spelling', n: 2 }
          ]
        },
        {
          id: 'grammar',
          title: { zh: '语法', en: 'Grammar' },
          minutes: 10,
          parts: [
            { kind: 'gender', n: 2 },
            { kind: 'custom:article', n: 2 }
          ]
        },
        {
          id: 'reading',
          title: { zh: '阅读', en: 'Reading' },
          minutes: 10,
          parts: [{ kind: 'sentence', n: 2 }]
        }
      ],
      rule: {
        parts: [
          {
            name: { zh: '全卷', en: 'All' },
            sections: ['vocab', 'grammar', 'reading'],
            max: 100,
            min: 0
          }
        ],
        pass: 60
      }
    }
  ]
}

type W = { w: string; p: 'noun' | 'verb' | 'adj' | 'adv'; g?: string; zh: string; en: string }
const person = (form: string, p: string, n: string): [string, ...string[]] => [
  form,
  p,
  n,
  'present',
  'indicative'
]
const WORDS: (W & { lv: string; f?: [string, ...string[]][] })[] = [
  { w: 'chat', p: 'noun', g: 'm', zh: '猫', en: 'cat', lv: 'A1', f: [['chats', 'plural']] },
  { w: 'maison', p: 'noun', g: 'f', zh: '房子', en: 'house', lv: 'A1', f: [['maisons', 'plural']] },
  { w: 'livre', p: 'noun', g: 'm', zh: '书', en: 'book', lv: 'A1', f: [['livres', 'plural']] },
  { w: 'table', p: 'noun', g: 'f', zh: '桌子', en: 'table', lv: 'A1', f: [['tables', 'plural']] },
  { w: 'pomme', p: 'noun', g: 'f', zh: '苹果', en: 'apple', lv: 'A1', f: [['pommes', 'plural']] },
  { w: 'chien', p: 'noun', g: 'm', zh: '狗', en: 'dog', lv: 'A1', f: [['chiens', 'plural']] },
  {
    w: 'manger',
    p: 'verb',
    zh: '吃',
    en: 'to eat',
    lv: 'A1',
    f: [
      person('mange', 'first-person', 'singular'),
      person('manges', 'second-person', 'singular'),
      person('mangeons', 'first-person', 'plural'),
      person('mangez', 'second-person', 'plural'),
      person('mangent', 'third-person', 'plural'),
      ['mangé', 'past', 'participle']
    ]
  },
  {
    w: 'grand',
    p: 'adj',
    zh: '大',
    en: 'big',
    lv: 'A1',
    f: [
      ['grande', 'feminine'],
      ['grands', 'masculine', 'plural'],
      ['grandes', 'feminine', 'plural']
    ]
  },
  {
    w: 'petit',
    p: 'adj',
    zh: '小',
    en: 'small',
    lv: 'A1',
    f: [
      ['petite', 'feminine'],
      ['petits', 'masculine', 'plural'],
      ['petites', 'feminine', 'plural']
    ]
  },
  { w: 'voiture', p: 'noun', g: 'f', zh: '汽车', en: 'car', lv: 'A2' },
  { w: 'arbre', p: 'noun', g: 'm', zh: '树', en: 'tree', lv: 'A2' },
  { w: 'école', p: 'noun', g: 'f', zh: '学校', en: 'school', lv: 'A2' },
  {
    w: 'parler',
    p: 'verb',
    zh: '说话',
    en: 'to speak',
    lv: 'A2',
    f: [
      person('parle', 'first-person', 'singular'),
      person('parles', 'second-person', 'singular'),
      person('parlons', 'first-person', 'plural'),
      person('parlez', 'second-person', 'plural'),
      person('parlent', 'third-person', 'plural'),
      ['parlé', 'past', 'participle']
    ]
  },
  { w: 'rapidement', p: 'adv', zh: '很快地', en: 'quickly', lv: 'A2' },
  { w: 'lentement', p: 'adv', zh: '慢慢地', en: 'slowly', lv: 'A2' }
]

const EXAMPLES: { text: string; en: string; zh: string; words: string[] }[] = [
  {
    text: 'Le chat mange une pomme.',
    en: 'The cat is eating an apple.',
    zh: '猫在吃苹果。',
    words: ['chat', 'manger', 'pomme']
  },
  {
    text: 'La maison est très grande.',
    en: 'The house is very big.',
    zh: '房子很大。',
    words: ['maison', 'grand']
  },
  {
    text: "Je lis un livre à l'école.",
    en: 'I read a book at school.',
    zh: '我在学校看书。',
    words: ['livre', 'école']
  },
  {
    text: 'Le chien dort sous la table.',
    en: 'The dog sleeps under the table.',
    zh: '狗在桌子底下睡觉。',
    words: ['chien', 'table']
  },
  {
    text: 'Nous parlons avec le chien.',
    en: 'We are talking with the dog.',
    zh: '我们在跟狗说话。',
    words: ['parler', 'chien']
  },
  {
    text: 'La voiture rouge est petite.',
    en: 'The red car is small.',
    zh: '那辆红色的车很小。',
    words: ['voiture', 'petit']
  },
  {
    text: 'Un grand arbre est devant la maison.',
    en: 'A big tree stands in front of the house.',
    zh: '房子前面有一棵大树。',
    words: ['arbre', 'grand', 'maison']
  },
  {
    text: 'Il ne mange pas de pomme.',
    en: 'He does not eat apples.',
    zh: '他不吃苹果。',
    words: ['manger', 'pomme']
  },
  {
    text: 'Elle parle rapidement.',
    en: 'She speaks quickly.',
    zh: '她说话很快。',
    words: ['parler', 'rapidement']
  },
  {
    text: 'Le petit chat marche lentement.',
    en: 'The little cat walks slowly.',
    zh: '小猫走得很慢。',
    words: ['petit', 'chat', 'lentement']
  }
]

const langs = LANGS as Record<string, LangModule>
const dir = mkdtempSync(join(tmpdir(), 'qonsona-lang-practice-'))
let db: LexDb
const byWord = new Map<string, (typeof WORDS)[number]>()

beforeAll(() => {
  langs[CODE] = FAKE
  const file = join(dir, 'zz.sqlite')
  const w = new LexDbWriter(CODE, { file, mt: false })
  w.source({ id: 't', name: 'Test', license: 'CC0', credit: 'me', home: 'https://example.org' })
  const ids = new Map<string, number>()
  WORDS.forEach((x, i) => {
    byWord.set(x.w, x)
    ids.set(
      x.w,
      w.entry({
        w: x.w,
        p: [x.p],
        ...(x.g ? { g: x.g } : {}),
        s: [{ zh: [x.zh], en: [x.en], zs: 't' }],
        ...(x.f ? { f: x.f } : {}),
        lv: { cefr: x.lv },
        fr: (i + 1) * 10
      })
    )
  })
  for (const ex of EXAMPLES)
    w.example(
      { text: ex.text, en: ex.en, zh: ex.zh, zs: 't', src: 't' },
      ex.words.map((x) => ids.get(x)!)
    )
  w.finish()
  db = new LexDb(CODE, file)
})
afterAll(() => {
  db?.close()
  delete langs[CODE]
  rmSync(dir, { recursive: true, force: true })
})

const textOf = (t: unknown): string => (typeof t === 'string' ? t : JSON.stringify(t))
const right = (q: ExamQuestion): unknown => q.choices[q.answer].text

/** 每道题都该满足的：选项不重复、答案在选项里、题号不重复、节对得上题型 */
function wellFormed(qs: ExamQuestion[], kind: string, choices = 4): void {
  expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length)
  for (const q of qs) {
    expect(q.kind).toBe(kind)
    if (kind !== 'custom') expect(q.section).toBe(PRACTICE_SECTION[q.kind])
    expect(q.choices).toHaveLength(choices)
    expect(new Set(q.choices.map((c) => textOf(c.text))).size).toBe(choices)
    expect(q.answer).toBeGreaterThanOrEqual(0)
    expect(q.answer).toBeLessThan(choices)
  }
}

const practice = (kind: string, n = 5, level: string | null = null, seed = 7): ExamQuestion[] =>
  langPractice(db, kind, level, n, seed, 'zh')

describe('练习页列哪些题型', () => {
  it('数据够才列：变形表不到 8 个词时不出变形题', () => {
    const kinds = practiceKindsFor(db)
    expect(kinds).toEqual([
      'word-meaning',
      'meaning-word',
      'listen-word',
      'spelling',
      'gender',
      'context',
      'grammar-fill',
      'grammar-meaning',
      'sentence',
      'listen-sentence'
    ])
  })
})

describe('通用题型', () => {
  it('看词选意思：正确项是这个词的释义；同一个种子出同样的题', () => {
    const qs = practice('word-meaning')
    expect(qs).toHaveLength(5)
    wellFormed(qs, 'word-meaning')
    for (const q of qs) {
      const w = byWord.get(q.prompt.text)!
      expect(right(q)).toEqual({ zh: w.zh, en: w.en })
      expect(q.explain.card).toMatch(/^lex-\d+$/)
      expect(q.explain.say?.lang).toBe('fr-FR')
    }
    expect(practice('word-meaning')).toEqual(qs)
    expect(practice('word-meaning', 5, null, 8)).not.toEqual(qs)
  })

  it('选了等级只出这一级的词（这一级不够 8 个时才放宽）', () => {
    for (const q of practice('word-meaning', 8, 'A1'))
      expect(byWord.get(q.prompt.text)!.lv).toBe('A1')
    // A2 只有 6 个词，不够出题，放宽到全部
    const a2 = practice('word-meaning', 8, 'A2')
    expect(a2.length).toBeGreaterThan(0)
    expect(a2.some((q) => byWord.get(q.prompt.text)!.lv === 'A1')).toBe(true)
  })

  it('看意思选词：题面按界面语言给释义', () => {
    const qs = practice('meaning-word')
    wellFormed(qs, 'meaning-word')
    for (const q of qs) expect(byWord.get(textOf(right(q)))!.zh).toBe(q.prompt.text)
    const en = langPractice(db, 'meaning-word', null, 3, 7, 'en')
    for (const q of en) expect(byWord.get(textOf(right(q)))!.en).toBe(q.prompt.text)
  })

  it('听词：放的是正确项的读音', () => {
    const qs = practice('listen-word')
    wellFormed(qs, 'listen-word')
    for (const q of qs) {
      expect(q.prompt.listen).toMatchObject({ text: right(q), lang: 'fr-FR' })
    }
  })

  it('拼写：错的拼法都不是词典里的词', () => {
    const qs = practice('spelling')
    wellFormed(qs, 'spelling')
    for (const q of qs) {
      expect(byWord.get(textOf(right(q)))!.zh).toBe(q.prompt.text)
      q.choices.forEach((c, i) => {
        if (i !== q.answer) expect(db.lookup(textOf(c.text))).toBeNull()
      })
    }
  })

  it('名词的性：选项是这门语言出现过的几种性', () => {
    const qs = practice('gender')
    expect(qs.length).toBeGreaterThan(0)
    wellFormed(qs, 'gender', 2)
    for (const q of qs) {
      const w = byWord.get(q.prompt.text)!
      expect(right(q)).toEqual(
        w.g === 'm' ? { zh: '阳性', en: 'masculine' } : { zh: '阴性', en: 'feminine' }
      )
    }
  })

  it('变形：正确项是题干说的那种变形', () => {
    const qs = practice('conjugate')
    expect(qs.length).toBe(2)
    wellFormed(qs, 'conjugate')
    for (const q of qs) {
      const w = byWord.get(q.prompt.text)!
      const form = w.f!.find((f) => f[0] === right(q))!
      expect(form).toBeDefined()
      expect(form[0]).not.toBe(w.w)
    }
  })

  it('语境填词：挖掉的正是正确项，题面下是译文', () => {
    const qs = practice('context')
    expect(qs.length).toBeGreaterThan(0)
    wellFormed(qs, 'context')
    for (const q of qs) {
      const [s, e] = q.prompt.blank!
      expect(q.prompt.text.slice(s, e)).toBe(right(q))
      const ex = EXAMPLES.find((x) => x.text === q.prompt.text)!
      expect(q.prompt.sub).toEqual({ zh: ex.zh, en: ex.en })
    }
  })

  it('句子的意思：正确项是这句的翻译；听力版要放音', () => {
    const qs = practice('sentence')
    wellFormed(qs, 'sentence')
    for (const q of qs) {
      const ex = EXAMPLES.find((x) => x.text === q.prompt.text)!
      expect(right(q)).toEqual({ zh: ex.zh, en: ex.en })
      expect(q.prompt.listen).toBeUndefined()
    }
    for (const q of practice('listen-sentence'))
      expect(q.prompt.listen).toMatchObject({ text: q.prompt.text, lang: 'fr-FR' })
  })

  it('语法填空：挖掉的是例句写的 hl 或按 patterns 认出的那一段，干扰项来自别的语法点', () => {
    const qs = practice('grammar-fill', 6)
    expect(qs).toHaveLength(6)
    wellFormed(qs, 'grammar-fill')
    const spans: Record<string, string> = {
      'Il ne mange pas de viande.': 'ne mange pas',
      'Il y a un chat ici.': 'Il y a',
      'Je vais manger une pomme.': 'vais manger',
      'La maison est très grande.': 'très grande',
      'Il faut parler lentement.': 'Il faut',
      "J'habite ici depuis deux ans.": 'depuis deux ans'
    }
    for (const q of qs) {
      const [s, e] = q.prompt.blank!
      expect(q.prompt.text.slice(s, e)).toBe(spans[q.prompt.text])
      expect(right(q)).toBe(spans[q.prompt.text])
    }
  })

  it('语法的意思：同一组的语法点不互相当干扰项', () => {
    const qs = practice('grammar-meaning')
    wellFormed(qs, 'grammar-meaning')
    const ilya = GRAMMAR.find((g) => g.id === 'ilya')!
    const faut = GRAMMAR.find((g) => g.id === 'faut')!
    for (const q of qs) {
      const g = GRAMMAR.find((x) => x.examples[0].text === q.prompt.text)!
      expect(right(q)).toEqual(g.meaning)
      if (g === ilya) expect(q.choices.map((c) => c.text)).not.toContainEqual(faut.meaning)
      if (g === faut) expect(q.choices.map((c) => c.text)).not.toContainEqual(ilya.meaning)
    }
  })

  it('没有系统语音的语言不出听力题；不认识的题型出不了题', () => {
    const speech = FAKE.spec.features.speech
    FAKE.spec.features.speech = null
    try {
      expect(practice('listen-word')).toEqual([])
      expect(practice('listen-sentence')).toEqual([])
      expect(practice('word-meaning')[0].explain.say).toBeUndefined()
    } finally {
      FAKE.spec.features.speech = speech
    }
    expect(practice('kanji-reading')).toEqual([])
  })
})

describe('特有题型', () => {
  it('题型 custom，带上题型 id，题号不重复', () => {
    const qs = langPractice(db, 'custom', null, 3, 1, 'zh', 'article')
    expect(qs).toHaveLength(3)
    wellFormed(qs, 'custom', 2)
    for (const q of qs) expect(q.custom).toBe('article')
    expect(langPractice(db, 'custom', null, 3, 1, 'zh', 'nope')).toEqual([])
  })
})

describe('模拟卷', () => {
  it('按定义分节配题，带上计分办法；全对及格、全错不及格', () => {
    const paper = langPaper(db, 'a1', 42, 'zh')!
    expect(paper.level).toBe('A1')
    expect(paper.sections.map((s) => [s.id, s.minutes, s.questions.length])).toEqual([
      ['vocab', 10, 5],
      ['grammar', 10, 4],
      ['reading', 10, 2]
    ])
    for (const s of paper.sections) for (const q of s.questions) expect(q.section).toBe(s.id)
    const ids = paper.sections.flatMap((s) => s.questions.map((q) => q.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(paper.sections[1].questions.filter((q) => q.custom === 'article')).toHaveLength(2)
    expect(paper.rule?.pass).toBe(60)

    const all = scorePaper(
      paper,
      paper.sections.map((s) => s.questions.map((q) => q.answer))
    )
    expect(all).toMatchObject({ right: 11, total: 11, scaled: 100, passed: true })
    const none = scorePaper(
      paper,
      paper.sections.map((s) => s.questions.map(() => null))
    )
    expect(none).toMatchObject({ right: 0, scaled: 0, passed: false })

    expect(langPaper(db, 'a1', 42, 'zh')).toEqual(paper)
    expect(langPaper(db, 'c2', 42, 'zh')).toBeNull()
  })
})

describe('通用错拼法', () => {
  it('去掉、换掉变音符号，双写、漏写字母，相邻字母对调；不含原词', () => {
    const v = defaultMisspell('école', rng(1))
    expect(v).toContain('ecole')
    expect(v).toContain('ècole')
    expect(v).not.toContain('école')
    const p = defaultMisspell('pomme', rng(1))
    expect(p).toContain('pome')
    expect(p).toContain('pmome')
    expect(p).not.toContain('pomme')
  })
})
