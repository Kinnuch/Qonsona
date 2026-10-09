/**
 * 千语集「导出学习包」出的 .qstudy.json：读进来、作者的设置落进学习包目录、藏起来的处处不出现。
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { buildQonlangPack, inspectQonlang, PACK_FILES } from '$lib/packs/qonlang/convert'
import { frequencyLevels } from '$lib/packs/qonlang/levels'
import { searchLexicon, searchSentences } from '$lib/packs/qonlang/lexicon'
import { languageSample } from '$lib/packs/qonlang/sample'
import { decodeAudio, hiddenIds, type PackStudy } from '$lib/packs/qonlang/study'
import { parseProject } from '$qon/core/serialize'
import {
  defaultStudySettings,
  newLesson,
  serializeStudyPack,
  studyAudioKey
} from '$qon/core/studyPack'
import type { Project } from '$qon/core/model'

const load = (): Project =>
  parseProject(readFileSync(resolve(__dirname, 'fixtures/qonlang/Aelith.laim.json'), 'utf8'))
const zh = (t: Record<string, string> | undefined): string => t?.zh ?? t?.en ?? ''

/** 一个最小的 wav（44 字节头 + 两个采样） */
const WAV =
  'data:audio/wav;base64,' +
  btoa(
    String.fromCharCode(...[82, 73, 70, 70, 40, 0, 0, 0, 87, 65, 86, 69], ...new Array(36).fill(0))
  )

/** 用千语集自己的代码拼一份学习包：Aelith 有标题、介绍、一课、藏一个词和一句例句、固定一个词的级别、两条录音 */
function makePack(): { text: string; project: Project; ae: string; ids: Record<string, string> } {
  const project = load()
  const ae = project.languages.find((l) => l.abbr === 'ae')!.id
  const lex = project.lexemes.filter((l) => l.languageId === ae)
  const kaso = lex.find((l) => l.lemma === 'kaso')!
  const teli = lex.find((l) => l.lemma === 'teli')!
  // 语料里没出现过、默认排在最后一级的词，固定到一级
  const auto = frequencyLevels(project, ae)
  const last = auto.system.levels.at(-1)!.id
  const rare = lex.find((l) => auto.entries[l.id] === last && l.id !== teli.id)!
  const sentence = project.sentences.find((s) => s.languageId === ae)!
  const phrase = project.phrasebook.find((p) => p.languageId === ae)!
  const s = defaultStudySettings(project)
  s.author = '测试作者'
  for (const l of s.languages) if (l.languageId !== ae) l.include = false
  const sa = s.languages.find((l) => l.languageId === ae)!
  sa.title = 'Aelith 入门'
  sa.intro = '# 欢迎\n\n这是 **Aelith**。'
  sa.lessons = [{ ...newLesson('问候'), lexemeIds: [kaso.id], phraseIds: [phrase.id] }]
  sa.hidden.lexemeIds.push(teli.id)
  sa.hidden.sentenceIds.push(sentence.id)
  sa.levels = { [rare.id]: 1 }
  sa.audio = {
    [studyAudioKey('lexeme', kaso.id)]: { dataUrl: WAV, name: 'kaso.wav' },
    [studyAudioKey('phrase', phrase.id)]: { dataUrl: WAV, name: 'phrase.wav' },
    // 认不得的格式：不收
    [studyAudioKey('lexeme', rare.id)]: { dataUrl: 'data:text/plain;base64,QUJD', name: 'x.txt' }
  }
  return {
    text: serializeStudyPack(project, s, '0.12.4', '2026-09-23T00:00:00.000Z'),
    project,
    ae,
    ids: { kaso: kaso.id, teli: teli.id, rare: rare.id, sentence: sentence.id, phrase: phrase.id }
  }
}

describe('读千语集的学习包', () => {
  it('认得出是学习包，作者没勾的语言标出来', () => {
    const { text, ae } = makePack()
    const r = inspectQonlang(text)
    if (!r.ok) throw new Error(r.reason)
    expect(r.pack?.study.author).toBe('测试作者')
    expect(r.pack?.qonlangVersion).toBe('0.12.4')
    expect(r.languages.find((l) => l.id === ae)?.include).toBe(true)
    expect(r.languages.filter((l) => l.id !== ae).every((l) => l.include === false)).toBe(true)
    // 普通项目文件照旧，没有 include
    const plain = inspectQonlang(
      readFileSync(resolve(__dirname, 'fixtures/qonlang/Aelith.laim.json'), 'utf8')
    )
    expect(plain.ok && plain.languages.every((l) => l.include === undefined)).toBe(true)
  })

  it('比软件新的学习包说清楚原因', () => {
    const r = inspectQonlang(makePack().text.replace('"version":1', '"version":99'))
    expect(r).toMatchObject({ ok: false, reason: 'newer-study-pack' })
  })

  it('作者的设置写进 study.json，名称换成课程名称，录音解成文件', () => {
    const { text, project, ae, ids } = makePack()
    const r = inspectQonlang(text)
    if (!r.ok) throw new Error(r.reason)
    const built = buildQonlangPack(project, ae, 'Aelith.qstudy.json', '{}', undefined, r.pack)
    expect(built.manifest.name).toEqual({ zh: 'Aelith 入门', en: 'Aelith 入门' })
    expect(built.manifest.nativeName).toBe('Aelith')
    expect(built.manifest.study).toEqual({
      author: '测试作者',
      lessons: 1,
      audio: 2,
      hidden: 2,
      hasIntro: true
    })
    const study = JSON.parse(built.files[PACK_FILES.study]) as PackStudy
    expect(study.lessons[0]).toMatchObject({ title: '问候', lexemeIds: [ids.kaso] })
    expect(study.intro).toContain('欢迎')
    expect(study.audio.sort()).toEqual(
      [studyAudioKey('lexeme', ids.kaso), studyAudioKey('phrase', ids.phrase)].sort()
    )
    expect(Object.keys(built.audio).sort()).toEqual(study.audio.sort())
    expect(built.audio[studyAudioKey('lexeme', ids.kaso)].ext).toBe('wav')
    expect(built.audio[studyAudioKey('lexeme', ids.kaso)].bytes.length).toBe(48)
    // 录音不重复存进 study.json
    expect(built.files[PACK_FILES.study]).not.toContain('base64')
  })

  it('分级：藏起来的词不参加，固定的词放到那一级，每级的数目跟着改', () => {
    const { text, project, ae, ids } = makePack()
    const r = inspectQonlang(text)
    if (!r.ok) throw new Error(r.reason)
    const { levels } = buildQonlangPack(project, ae, 'x', '{}', undefined, r.pack)
    expect(levels.entries[ids.teli]).toBeUndefined()
    expect(levels.entries[ids.rare]).toBe('L1')
    const counted = levels.system.levels.reduce((n, lv) => n + (lv.count ?? 0), 0)
    expect(counted).toBe(Object.keys(levels.entries).length)
  })

  it('从项目文件导入的包没有 study.json', () => {
    const project = load()
    const ae = project.languages.find((l) => l.abbr === 'ae')!.id
    const built = buildQonlangPack(project, ae, 'x', '{}')
    expect(built.study).toBeNull()
    expect(built.files[PACK_FILES.study]).toBeUndefined()
    expect(built.manifest.study).toBeUndefined()
    expect(built.audio).toEqual({})
  })

  it('藏起来的词条、例句在词典和首页样例里都不出现', () => {
    const { text, project, ae, ids } = makePack()
    const r = inspectQonlang(text)
    if (!r.ok) throw new Error(r.reason)
    const study = buildQonlangPack(project, ae, 'x', '{}', undefined, r.pack).study
    const hidden = hiddenIds(study)
    expect(searchLexicon(project, ae, 'teli', zh, {}, hidden).map((h) => h.id)).not.toContain(
      ids.teli
    )
    expect(searchLexicon(project, ae, '', zh).map((h) => h.id)).toContain(ids.teli)
    expect(searchSentences(project, ae, '', hidden).map((s) => s.id)).not.toContain(ids.sentence)
    // 短语全藏起来时，样例改拿例句
    const allPhrases = new Set(project.phrasebook.map((p) => p.id))
    expect(languageSample(project, ae, zh, { hidden: allPhrases })?.key).toMatch(/^sentence-/)
  })

  it('data URL 只收认得的音频格式', () => {
    expect(decodeAudio(WAV)?.ext).toBe('wav')
    expect(decodeAudio('data:audio/webm;codecs=opus;base64,QUJD')?.ext).toBe('webm')
    expect(decodeAudio('data:text/plain;base64,QUJD')).toBeNull()
    expect(decodeAudio('data:audio/wav;base64,')).toBeNull()
    expect(decodeAudio('https://example.com/a.wav')).toBeNull()
  })
})
