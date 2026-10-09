/**
 * 千语集语言的阅读材料：没有课时按出处、分类、文档分篇；有学习包的课时按课；逐词对照带上词条与 gloss。
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { parseProject } from '$qon/core/serialize'
import type { Project } from '$qon/core/model'
import { docLinkResolver, glossTitle, interlinear, qonTexts } from '$lib/packs/qonlang/reading'
import type { PackStudy } from '$lib/packs/qonlang/study'

const load = (): Project =>
  parseProject(readFileSync(resolve(__dirname, 'fixtures/qonlang/Aelith.laim.json'), 'utf8'))
const zh = (t: Record<string, string> | undefined): string => t?.zh ?? t?.en ?? ''
const labels = { ungrouped: '其他', phrases: (c: string) => `短语·${c}` }

describe('千语集语言的阅读材料', () => {
  it('没有课：例句按出处、短语按分类、文档各成一篇，每条例句都在某一篇里', () => {
    const p = load()
    const ae = p.languages.find((l) => l.abbr === 'ae')!.id
    const texts = qonTexts(p, ae, null, new Set(), labels)
    const sentences = p.sentences.filter((s) => s.languageId === ae)
    expect(texts.flatMap((x) => x.sentenceIds).sort()).toEqual(sentences.map((s) => s.id).sort())
    expect(texts.filter((x) => x.kind === 'phrases').flatMap((x) => x.phraseIds)).toHaveLength(
      p.phrasebook.filter((x) => x.languageId === ae).length
    )
    expect(texts.some((x) => x.kind === 'doc')).toBe(true)
    // 出处相同的例句在同一篇
    const sources = new Set(sentences.map((s) => s.source.trim()))
    expect(texts.filter((x) => x.kind === 'source')).toHaveLength(sources.size)
  })

  it('藏起来的例句不出现；有学习包的课时按课排，只留还在的', () => {
    const p = load()
    const ae = p.languages.find((l) => l.abbr === 'ae')!.id
    const s = p.sentences.filter((x) => x.languageId === ae)
    const hidden = new Set([s[0].id])
    expect(qonTexts(p, ae, null, hidden, labels).flatMap((x) => x.sentenceIds)).not.toContain(
      s[0].id
    )
    const doc = p.docs.find((d) => d.languageId === ae)!
    const study = {
      lessons: [
        {
          id: 'l1',
          title: '',
          docId: doc.id,
          lexemeIds: ['gone', p.lexemes.find((l) => l.languageId === ae)!.id],
          sentenceIds: [s[1].id, s[0].id, 'gone'],
          phraseIds: []
        }
      ]
    } as unknown as PackStudy
    const [lesson] = qonTexts(p, ae, study, hidden, labels)
    expect(lesson).toMatchObject({ kind: 'lesson', title: doc.title, docId: doc.id })
    expect(lesson.sentenceIds).toEqual([s[1].id])
  })

  it('逐词对照：词带词条与 gloss，标点单独成段，拼起来就是原文', () => {
    const p = load()
    const ae = p.languages.find((l) => l.abbr === 'ae')!.id
    const s = p.sentences.find((x) => x.languageId === ae && /[.?!]/.test(x.text))!
    const pieces = interlinear(p, s, zh)
    expect(pieces.map((x) => x.text).join('')).toBe(s.text)
    const words = pieces.filter((x) => x.word)
    expect(words.length).toBeGreaterThan(1)
    expect(words.some((w) => w.lexemeId && w.gloss)).toBe(true)
    expect(pieces.some((x) => !x.word && /[.?!]/.test(x.text))).toBe(true)
  })

  it('文档链接：词条可以点，别的只写名字、不带前缀', () => {
    const p = load()
    const resolve = docLinkResolver(p)
    const kaso = p.lexemes.find((l) => l.lemma === 'kaso')!
    expect(resolve('kaso')).toMatchObject({ text: 'kaso', target: { kind: 'lexeme', id: kaso.id } })
    const rule = resolve('音变:元音和谐')
    expect(rule.text).toBe('元音和谐')
    expect(rule.target).toBeUndefined()
  })

  it('gloss 里的缩写按缩写表写出全称', () => {
    const p = load()
    expect(glossTitle(p, '孩子.PL.NOM', zh).split('\n')).toEqual(['PL = 复数', 'NOM = 主格'])
    expect(glossTitle(p, '孩子', zh)).toBe('')
  })
})
