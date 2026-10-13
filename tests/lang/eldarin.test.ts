import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEldamo, reliability } from '../../scripts/data/eldarin/parse'
import { validateCoreBindings, type CoreBinding } from '../../scripts/data/eldarin/core'
import { LANGS, isLangCode } from '../../src/shared/lang/registry'
import { STUDY_STAGES } from '../../src/shared/lang/eldarin'
import { LANG_TEXTS } from '../../src/main/lang/texts'
import { LexDb } from '../../src/main/lang/lexdb'
import { analyzeLex } from '../../src/main/lang/analyze'
import { findGrammar } from '../../src/shared/lang/grammar'
import { langPaper } from '../../src/main/lang/practice'
import { allLessons, lessonQuiz, poolUpTo } from '../../src/shared/course'

describe('Eldamo lexical adapter', () => {
  it('binds a reviewed source identity, POS, period and whole semantic anchor', () => {
    const records = parseEldamo(
      '<word-data><word l="q" v="i" speech="pron" gloss="other" page-id="1"/><word l="q" v="i" speech="article" gloss="the" page-id="2"/></word-data>'
    ).records
    const binding: CoreBinding = { w: 'i', id: '2', pos: 'det', gloss: 'the', period: 'late' }
    expect([...validateCoreBindings(records, [binding], String).keys()]).toEqual(['2'])
    for (const wrong of [
      { id: '1' },
      { pos: 'pron' },
      { period: 'middle' },
      { gloss: 'he' },
      { w: 'a' }
    ])
      expect(() =>
        validateCoreBindings(records, [{ ...binding, ...wrong } as CoreBinding], String)
      ).toThrow('Invalid reviewed')
  })
  it('keeps nested early forms separate and removes homograph numbering from lookup heads', () => {
    const parsed = parseEldamo(
      '<word-data version="fixture"><word l="q" v="i¹" speech="article" gloss="the" page-id="1"><ref v="i" source="VT/1"/><word l="eq" v="i" speech="article" gloss="early the" page-id="2"><ref v="ir" source="QL/2"><inflect form="plural"/></ref></word></word></word-data>'
    )
    expect(parsed.version).toBe('fixture')
    expect(parsed.records).toHaveLength(2)
    expect(parsed.records[0].data.w).toBe('i')
    expect(parsed.records[0].data.f).toEqual([])
    expect(parsed.records[1].data.f).toEqual([['ir', 'plural']])
    expect(parsed.records[0].data.x!.eldamo).toMatchObject({ sourceHead: 'i¹', period: 'late' })
    expect(parsed.records[1].data.x!.eldamo).toMatchObject({ period: 'early' })
  })
  it('does not expand uncertain alternatives or include rejected/reconstructed inflections or long texts', () => {
    const parsed = parseEldamo(
      '<word-data><word l="s" v="sample" speech="n" gloss="fixture"><ref v="a/b" source="PE/1"><inflect form="plural"/></ref><ref v="rejected" source="PE/2" mark="-"><inflect form="plural"/></ref><ref v="speculative" source="PE/3" mark="*"><inflect form="plural"/></ref><ref v="documented" source="PE/4"><inflect form="genitive plural"/></ref></word><word l="q" v="poem" speech="text" gloss="large text"/></word-data>'
    )
    expect(parsed.records).toHaveLength(1)
    expect(parsed.records[0].data.f).toEqual([['documented', 'genitive', 'plural']])
  })
  it('distinguishes Neo inventions, reconstructions and Tolkien-reference labels', () => {
    expect(reliability('!^#*?-†', 'neo', true)).toEqual(
      expect.arrayContaining([
        'Neo-Elvish',
        'fan-neologism',
        'reformulated',
        'derived-unattested',
        'reconstructed',
        'speculative',
        'rejected',
        'archaic'
      ])
    )
    expect(reliability('', 'late', true)).toContain('Tolkien-referenced')
    expect(reliability('‽', 'late', true)).not.toContain('Tolkien-referenced')
    expect(reliability('', 'neo', false)).not.toContain('Tolkien-referenced')
  })
})
describe('Eldamo direct documentary spellings', () => {
  it('preserves literal aliases and their citations/period, without fabricating inflections', () => {
    const parsed = parseEldamo(
      '<word-data><word l="q" v="amil(lë)" speech="n" gloss="mother"><ref v="Amille" source="VT44/18.2801"/><ref v="Amille" source="VT44/18.2801"/><ref v="amil"/><word l="mq" v="amil" speech="n" gloss="mother"><ref v="Amil" source="PE/2"/></word></word><word l="q" v="sír(ë)" speech="n" gloss="river"><ref v="sír" source="PE17/065.3101"/><ref v="sīr" source="VT49/17.1108"/></word></word-data>'
    )
    expect(parsed.records[0].data.w).toBe('amil(lë)')
    expect(parsed.records[0].data.f).toEqual([])
    expect(parsed.records[0].data.x!.eldamo).toMatchObject({
      period: 'late',
      aliases: [
        {
          form: 'Amille',
          period: 'late',
          language: 'q',
          references: [{ source: 'VT44/18.2801', mark: '' }]
        }
      ]
    })
    expect(parsed.records[1].data.x!.eldamo).toMatchObject({ period: 'middle', aliases: [] })
    expect(parsed.records[2].data.x!.eldamo).toMatchObject({
      aliases: [
        { form: 'sír', references: [{ source: 'PE17/065.3101', mark: '' }] },
        { form: 'sīr', references: [{ source: 'VT49/17.1108', mark: '' }] }
      ]
    })
  })
  it('rejects uncertain, revised, multiword and unreferenced documentary aliases', () => {
    const invalid = ['a/b', 'a(b)', 'a[b]', 'two words', 'quoted?', 'word=other']
    const marked = ['-', '?', '*', '^', '#', '!', '|', '‽']
    const xml = `<word-data><word l="s" v="base" speech="n" gloss="fixture">${invalid.map((v) => `<ref v="${v}" source="PE/1"/>`).join('')}${marked.map((mark) => `<ref v="uncertain" source="PE/2" mark="${mark}"/>`).join('')}<ref v="unreferenced"/><ref v="changed" source="PE/3"><change v="other" source="PE/4"/></ref><ref v="corrected" source="PE/5"><correction v="other" source="PE/6"/></ref><ref v="actual" source="PE/7"/></word></word-data>`
    const parsed = parseEldamo(xml)
    expect(parsed.records[0].data.x!.eldamo).toMatchObject({
      aliases: [{ form: 'actual', period: 'late', references: [{ source: 'PE/7', mark: '' }] }]
    })
    expect(parsed.records[0].data.f).toEqual([])
  })
})
for (const code of ['qya', 'sjn'] as const)
  describe(`${code} Eldarin learning`, () => {
    const mod = LANGS[code]
    const file = join(process.cwd(), 'resources/data', code, 'dict.sqlite')
    let db: LexDb | undefined
    beforeAll(() => {
      if (existsSync(file)) db = new LexDb(code, file)
    })
    afterAll(() => db?.close())
    it('has internal stages, original reading and no invented official grading/news', () => {
      expect(isLangCode(code)).toBe(true)
      expect(mod.spec.features.speech).toBe(code)
      expect(mod.spec.levelSystems[0].cefr).toBeUndefined()
      expect(mod.spec.levelSystems[0].levels.map((level) => level.id)).toEqual([...STUDY_STAGES])
      expect(mod.news).toEqual([])
      for (const level of STUDY_STAGES)
        expect(
          LANG_TEXTS[code].some(
            (text) =>
              text.level === level && text.source.includes('original') && text.license === 'MIT'
          )
        ).toBe(true)
    })
    it('preserves offsets and vowel length, accepts documented spellings and Sindarin loss markers', () => {
      const text = code === 'qya' ? 'I elen síla. Elda ar atan.' : 'I ’aladh. I edhel tôl.'
      const tokens = mod.rules.tokenize!(text)
      expect(tokens.map((token) => token.text).join('')).toBe(text)
      for (const token of tokens) expect(text.slice(token.start, token.end)).toBe(token.text)
      expect(mod.rules.key('á')).not.toBe(mod.rules.key('a'))
      if (code === 'qya') {
        expect(mod.rules.key('cöa')).toBe(mod.rules.key('coa'))
        expect(mod.rules.key('kōa')).toBe(mod.rules.key('cóa'))
      } else {
        expect(mod.rules.key('galað')).toBe(mod.rules.key('galadh'))
        expect(mod.rules.key('’aladh')).toBe(mod.rules.key('aladh'))
        expect(mod.rules.key('tól')).not.toBe(mod.rules.key('tôl'))
        expect(tokens.some((token) => token.text === '’aladh')).toBe(true)
      }
    })
    it('keeps reviewed teaching meanings and phonetic distinctions in checked-in content', () => {
      const content = JSON.parse(readFileSync(join('data', code, 'learning.json'), 'utf8')) as {
        sounds: [string, string, string, string][]
        grammar: { examples: { text: string; zh: string; en: string }[] }[]
      }
      const examples = content.grammar.flatMap((point) => point.examples)
      if (code === 'qya') {
        for (const example of examples.filter((example) => example.text.includes('alta')))
          expect(example.en).toContain('large')
      } else {
        expect(examples.every((example) => !example.text.includes('telir'))).toBe(true)
        expect(LANG_TEXTS.sjn.every((text) => !text.text.includes('telir'))).toBe(true)
        for (const symbol of ['á', 'é', 'í', 'ó', 'ú'])
          expect(content.sounds.find((sound) => sound[0] === symbol)![1]).toMatch(/^long /)
        for (const symbol of ['â', 'ê', 'î', 'ô', 'û'])
          expect(content.sounds.find((sound) => sound[0] === symbol)![1]).toMatch(/^overlong /)
      }
    })
    it('matches all highlighted examples and gives every non-reading lesson a quiz', () => {
      expect(mod.grammar).toHaveLength(24)
      for (const point of mod.grammar!)
        for (const ex of point.examples) {
          expect(ex.en).toBeTruthy()
          expect(ex.zh).toBeTruthy()
          const start = ex.text.indexOf(ex.hl!)
          const hits = findGrammar(
            [{ start: 0, end: ex.text.length, para: 0, tokens: mod.rules.tokenize!(ex.text) }],
            [point],
            mod.rules.key
          )
          expect(
            hits.some((hit) => hit.start === start && hit.end === start + ex.hl!.length),
            `${point.id}: ${ex.hl}`
          ).toBe(true)
        }
      for (const course of mod.courses!('en'))
        if (course.kind !== 'texts')
          for (const { lesson } of allLessons(course))
            expect(
              lessonQuiz(course, lesson, poolUpTo(course, lesson.id), {
                seed: 42,
                listen: false,
                words: []
              }).length,
              `${course.id}/${lesson.id}`
            ).toBeGreaterThan(0)
    })
    it.skipIf(!existsSync(file))(
      'uses full real dictionaries, clear period lists and documented forms',
      () => {
        expect(db!.status().entries).toBeGreaterThan(5000)
        const lists = db!.lists()
        expect(lists).toHaveLength(7)
        expect(
          lists.every((list) => list.name.startsWith('eldarin-study:') || !!list.title?.en)
        ).toBe(true)
        const word = code === 'qya' ? 'Elda' : 'adan'
        const hit = db!
          .search(word)
          .hits.find((item) => mod.rules.key(item.w) === mod.rules.key(word))!
        expect(hit, `Case-normalized dictionary lookup for ${word}`).toBeDefined()
        const entry = db!.entry(hit.id)!
        expect(mod.rules.key(entry.w)).toBe(mod.rules.key(word))
        expect(entry.x.eldamo).toMatchObject({ period: 'late' })
        expect(
          entry.sources.some((source) => source.id === 'eldamo' && source.license === 'CC BY 4.0')
        ).toBe(true)
        expect(entry.forms.some((form) => form.tags.includes('plural'))).toBe(true)
      }
    )
    if (code === 'qya')
      it.skipIf(!existsSync(file))(
        'finds real late aliases instead of losing them to early homographs',
        () => {
          const mother = db!.search('Amille').hits.find((hit) => hit.w === 'amil(lë)')
          expect(mother).toBeDefined()
          expect(mother!.match).toBe('form')
          const entry = db!.entry(mother!.id)!
          expect(entry.x.eldamo).toMatchObject({
            period: 'late',
            aliases: expect.arrayContaining([
              expect.objectContaining({
                form: 'Amille',
                references: expect.arrayContaining([{ source: 'VT44/18.2801', mark: '' }])
              })
            ])
          })
          expect(db!.lookup('Amille')?.lemma).toBe('amil(lë)')
          for (const spelling of ['sír', 'sīr']) {
            const river = db!.search(spelling).hits.find((hit) => hit.w === 'sír(ë)')
            expect(river, spelling).toBeDefined()
            expect(db!.entry(river!.id)!.x.eldamo).toMatchObject({ period: 'late' })
            expect(db!.entry(river!.id)!.senses.some((sense) => sense.en.includes('river'))).toBe(
              true
            )
          }
        }
      )
    it.skipIf(!existsSync(file))(
      'keeps every graded head attached to its reviewed source and meaning',
      () => {
        const bindings: CoreBinding[] = JSON.parse(
          readFileSync(join('data', code, 'core-bindings.json'), 'utf8')
        )
        const reviewed = new Map(bindings.map((binding) => [binding.id, binding]))
        const graded = ['L1', 'L2', 'L3'].flatMap((level) => db!.list(`eldarin-study:${level}`))
        expect(graded).toHaveLength(bindings.length)
        for (const item of graded) {
          const entry = db!.entry(item.id)!
          const source = entry.x.eldamo as { id: string; period: string }
          const binding = reviewed.get(source.id)
          expect(binding, entry.w).toBeDefined()
          expect(source.period).toBe(binding!.period)
          expect(entry.p).toContain(binding!.pos)
          expect(
            entry.senses
              .flatMap((sense) => sense.en)
              .join(' ')
              .toLowerCase()
          ).toContain(binding!.gloss.toLowerCase())
          const hit = db!.lookup(binding!.w)!
          expect(db!.entry(hit.entry)!.x.eldamo, binding!.w).toMatchObject({ id: binding!.id })
        }
        for (const [surface, id] of code === 'qya'
          ? [
              ['I', '1717330255'],
              ['ná', '2562596025'],
              ['alta', '891436159']
            ]
          : [
              ['I', '1324303307'],
              ['tôl', '2756894593']
            ]) {
          const hit = db!.lookup(surface)!
          expect(db!.entry(hit.entry)!.x.eldamo, surface).toMatchObject({ id })
        }
        if (code === 'sjn') {
          expect(LANG_TEXTS.sjn.every((text) => !text.text.includes('telir'))).toBe(true)
          const hit = db!.lookup('telir')!
          expect(db!.entry(hit.entry)!.p).toContain('propn')
        }
      }
    )
    it.skipIf(!existsSync(file))('creates complete self-checks and actual reading analysis', () => {
      for (const def of mod.exams!) {
        const paper = langPaper(db!, def.id, 42, 'en')
        expect(paper, def.id).not.toBeNull()
        expect(paper!.sections[0].questions).toHaveLength(6)
        for (const question of paper!.sections[0].questions) {
          expect(question.answer).toBeGreaterThanOrEqual(0)
          expect(question.answer).toBeLessThan(question.choices.length)
          expect(new Set(question.choices.map((choice) => choice.text)).size).toBe(
            question.choices.length
          )
        }
      }
      const analysis = analyzeLex(db!, LANG_TEXTS[code][0].text)
      expect(
        analysis.sentences.flatMap((sentence) => sentence.tokens).some((token) => token.entry)
      ).toBe(true)
    })
  })
