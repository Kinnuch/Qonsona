/**
 * 英语的 spec：四套分级、各级说明、阶段一只开词典；有词典库时抽查查词。
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { spec } from '../../../src/shared/lang/en/spec'
import { primarySystem } from '../../../src/shared/lang/levels'
import { CEFR_LEVELS } from '../../../src/shared/lang/types'
import { LexDb } from '../../../src/main/lang/lexdb'

describe('英语的 spec', () => {
  it('主分级是 CEFR，另有中国考试词表、NGSL、柯林斯星级', () => {
    expect(primarySystem(spec.levelSystems).id).toBe('cefr')
    expect(spec.levelSystems.map((s) => s.id)).toEqual(['cefr', 'cn-exam', 'ngsl', 'collins'])
    expect(spec.levelSystems.find((s) => s.id === 'cn-exam')!.levels.map((l) => l.id)).toEqual([
      'zk',
      'gk',
      'cet4',
      'cet6',
      'ky',
      'ielts',
      'toefl',
      'gre'
    ])
  })
  it('每一级都有中英说明，词表都对得上 CEFR', () => {
    for (const sys of spec.levelSystems) {
      expect(sys.sources.length).toBeGreaterThan(0)
      for (const l of sys.levels) {
        expect(l.desc?.zh, `${sys.id}:${l.id}`).toBeTruthy()
        expect(l.desc?.en, `${sys.id}:${l.id}`).toBeTruthy()
        expect(CEFR_LEVELS).toContain(sys.cefr?.[l.id])
      }
    }
    // CEFR 的说明里写着对应的英语考试
    expect(spec.levelSystems[0].levels.find((l) => l.id === 'B2')!.desc!.zh).toContain('B2 First')
  })
  it('阅读、六类课程与练习接入', () => {
    const on = Object.entries(spec.features)
      .filter(([k, v]) => v === true && k !== 'romanization')
      .map(([k]) => k)
    expect(on).toEqual([
      'texts',
      'lexicon',
      'grammar',
      'inflection',
      'phrasebook',
      'idioms',
      'stories',
      'media',
      'exam'
    ])
    expect(spec.features.alphabet).toBe('phonics')
    expect(spec.features.speech).toBe('en-US')
  })
})

const file = join('resources', 'data', 'en', 'dict.sqlite')
describe.skipIf(!existsSync(file))('英语词典库（有 resources/data/en/dict.sqlite 时）', () => {
  const db = new LexDb('en', file)
  it('变形、缩约、所有格、英美拼写都查得到', () => {
    expect(db.lookup('went')).toMatchObject({ lemma: 'go', tags: ['past'] })
    expect(db.lookup('mice')).toMatchObject({ lemma: 'mouse', tags: ['plural'] })
    expect(db.lookup('studies')?.lemma).toBe('study')
    expect(db.lookup('Running')?.lemma).toBe('run')
    expect(db.lookup('don’t')?.lemma).toBe("don't")
    expect(db.lookup("students'")?.lemma).toBe('student')
    expect(db.lookup('e-mail')?.lemma).toBe('email')
    expect(db.search('colour').hits[0].w).toBe('colour')
    expect(db.search('gave up').hits[0]).toMatchObject({ w: 'give up', match: 'form' })
  })
  it('常用词有中文、英式与美式 IPA、CEFR 等级与例句', () => {
    const hit = db.search('water').hits[0]
    const e = db.entry(hit.id)!
    expect(e.senses[0].zh.length).toBeGreaterThan(0)
    expect(e.x.ipaUk).toEqual(['/ˈwɔːtə/'])
    expect(e.x.ipaUs).toEqual(['/ˈwɔtɚ/'])
    expect(e.levels.find((l) => l.primary)?.levels[0].id).toBe('A1')
    expect(e.examples.length).toBeGreaterThan(0)
  })
})
