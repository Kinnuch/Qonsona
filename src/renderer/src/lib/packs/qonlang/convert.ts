/**
 * 千语集项目 → 学习包。
 *
 * 读项目用的是千语集自己的代码（vendor/qonlang，scripts/sync-qonlang.mjs 同步）：
 * 解析、旧版本迁移、构形、文字转写跟千语集里看到的一模一样。
 *
 * 一个项目可以有好几门语言（祖语、子语言……），每门语言单独成一个学习包，
 * 包 id 由项目 id + 语言 id 定，重新导入同一个项目时认得出、学习进度按词条 id 接着用。
 *
 * 除了项目文件，还收千语集「导出学习包」出的 .qstudy.json：项目连同作者给的学习设置
 * （课程、藏起来的内容、固定的级别、默认写法、作者录音），见 study.ts。
 */
import type { Language, Project } from '$qon/core/model'
import { parseProject, ProjectParseError } from '$qon/core/serialize'
import { isSealed } from '$qon/core/sealed'
import { isProjectCsv, projectFromCsv } from '$qon/core/projectCsv'
import {
  isStudyPack,
  parseStudyPack,
  StudyPackError,
  type StudyPackFile
} from '$qon/core/studyPack'
import { paradigmsFor } from '$qon/engine/morph'
import ENGINE from '$qon/VERSION.json'
import { frequencyLevels, type LevelAssignment } from './levels'
import { decodeAudio, hiddenIds, studyForLanguage, type PackStudy } from './study'
import type { LevelSystem, PackFeatures, PackManifest, PackScript, PackStats } from '../types'

/** 读不了的原因；界面按它给出说明 */
export type RejectReason =
  | 'sealed' // 纯欣赏副本（加过密）：不收（2026-09-23 用户定）
  | 'invalid-json'
  | 'not-a-project'
  | 'newer-schema' // 比快照里的千语集新，要先同步引擎
  | 'invalid-csv'
  | 'newer-study-pack' // 学习包格式比这个软件认得的新
  | 'unknown'

export type InspectResult =
  | {
      ok: true
      project: Project
      languages: LanguageSummary[]
      /** 是千语集导出的学习包时：整份学习包（设置 + 录音） */
      pack?: StudyPackFile
    }
  | { ok: false; reason: RejectReason; detail?: string }

export interface LanguageSummary {
  id: string
  name: string
  abbr: string
  color: string
  stats: PackStats
  /** 什么都没有（没有词条、例句、短语、文档）的语言导入了也学不了 */
  empty: boolean
  /** 学习包里作者勾了导出（不是学习包时为 undefined） */
  include?: boolean
}

export const ENGINE_VERSION = `${ENGINE.qonlangVersion}@${ENGINE.commit.slice(0, 7)}`

/** 读一份文件的内容：项目文件（.laim.json）、整个项目导出的 CSV，或学习包（.qstudy.json） */
export function inspectQonlang(text: string): InspectResult {
  if (isSealed(text)) return { ok: false, reason: 'sealed' }
  let project: Project
  let pack: StudyPackFile | undefined
  try {
    if (isStudyPack(text)) {
      pack = parseStudyPack(text)
      project = pack.project
    } else project = isProjectCsv(text) ? projectFromCsv(text) : parseProject(text)
  } catch (e) {
    if (e instanceof StudyPackError)
      return {
        ok: false,
        reason: e.code === 'newer-study-pack' ? 'newer-study-pack' : 'invalid-json',
        detail: e.message
      }
    if (e instanceof ProjectParseError && e.code !== 'sealed-broken') {
      return { ok: false, reason: e.code, detail: e.message }
    }
    return { ok: false, reason: 'unknown', detail: e instanceof Error ? e.message : String(e) }
  }
  const languages = project.languages.map((lang) => {
    const stats = languageStats(project, lang)
    return {
      id: lang.id,
      name: lang.name,
      abbr: lang.abbr,
      color: safeColor(lang.color),
      stats,
      empty: stats.lexemes + stats.sentences + stats.phrases === 0,
      include: pack?.study.languages.find((l) => l.languageId === lang.id)?.include
    }
  })
  return { ok: true, project, languages, pack }
}

export function languageStats(project: Project, lang: Language): PackStats {
  const mine = <T extends { languageId: string | null }>(list: T[]): T[] =>
    list.filter((x) => x.languageId === lang.id)
  const lexemes = mine(project.lexemes)
  const used = new Set<string>()
  for (const l of lexemes) for (const lp of paradigmsFor(project, l)) used.add(lp.paradigm.id)
  return {
    lexemes: lexemes.length,
    morphemes: mine(project.morphemes).length,
    sentences: mine(project.sentences).length,
    phrases: mine(project.phrasebook).length,
    // 没指定语言的文档（项目说明之类）每门语言都算上
    docs: project.docs.filter((d) => d.languageId === lang.id || d.languageId === null).length,
    paradigms: used.size,
    phonemes: lang.phonemes.length,
    orthographies: lang.orthographies.length
  }
}

export function languageFeatures(project: Project, lang: Language): PackFeatures {
  const s = languageStats(project, lang)
  const lexemes = project.lexemes.filter((l) => l.languageId === lang.id)
  const glyphScripts = lang.scripts.filter((sc) => sc.glyphs.length > 0)
  const hasIpa =
    lexemes.some((l) => Object.values(l.pronunciations).some((p) => p.ipa.trim())) ||
    lang.orthographies.some((o) => o.rulesToIpa.trim())
  const analysed = project.sentences.some(
    (se) => se.languageId === lang.id && se.tokens.some((t) => t.confirmed)
  )
  return {
    // 有例句、短语或文档就有东西可读（阅读里各成一篇）
    texts: s.sentences > 0 || s.phrases > 0 || s.docs > 0,
    lexicon: s.lexemes > 0,
    alphabet: glyphScripts.length ? 'glyphs' : s.phonemes ? 'phonemes' : null,
    characters: s.morphemes
      ? 'morphemes'
      : glyphScripts.some((sc) => sc.type === 'logographic')
        ? 'glyphs'
        : null,
    grammar: s.docs > 0,
    inflection: s.paradigms > 0,
    phrasebook: s.phrases > 0,
    // 惯用语课、故事课是随软件带的日语内容；千语集的作者写的例句、文档另有课
    idioms: false,
    stories: false,
    // 人造语言没有现成的视频、考试，也没有能读它的语音（IPA 朗读另行研究）
    media: false,
    exam: false,
    ruby: hasIpa ? 'ipa' : s.orthographies > 1 ? 'orthography' : null,
    romanization: lang.scripts.length > 0,
    speech: null,
    gloss: s.morphemes > 0 || analysed,
    etymology: lexemes.some((l) => l.etymology.sources.length > 0 || l.etymology.stages.length > 0)
  }
}

export function packScripts(lang: Language): PackScript[] {
  return lang.scripts.map((sc) => ({
    id: sc.id,
    name: sc.name,
    type: sc.type,
    direction: sc.direction,
    vertical: !!sc.vertical,
    glyphCount: sc.glyphs.length,
    fontFamily: sc.font.family,
    embeddedFont: !!sc.font.dataUrl
  }))
}

/** 包 id：同一个项目的同一门语言永远是同一个 id */
export function qonlangPackId(projectId: string, languageId: string): string {
  const part = (s: string): string => s.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'x'
  return `qon-${part(projectId)}-${part(languageId)}`
}

export function packFromQonlang(
  project: Project,
  languageId: string,
  fileName: string,
  importedAt = new Date().toISOString(),
  levels: LevelSystem = frequencyLevels(project, languageId).system,
  study: PackStudy | null = null
): PackManifest {
  const lang = project.languages.find((l) => l.id === languageId)
  if (!lang) throw new Error(`项目里没有这门语言：${languageId}`)
  const primary = lang.orthographies.find((o) => o.isPrimary) ?? lang.orthographies[0]
  // 作者起了课程名称就用它；自己的叫法照旧是语言名
  const title = study?.title.trim() || lang.name
  return {
    id: qonlangPackId(project.meta.id, lang.id),
    kind: 'qonlang',
    name: { zh: title, en: title },
    nativeName: lang.name,
    bcp47:
      'art-x-' +
      (lang.abbr
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 8) || 'conlang'),
    color: safeColor(lang.color),
    direction: primary?.direction ?? 'ltr',
    // 按词频自动分级，见 levels.ts
    levels,
    features: languageFeatures(project, lang),
    scripts: packScripts(lang),
    stats: languageStats(project, lang),
    source: {
      projectId: project.meta.id,
      projectName: project.meta.name,
      languageId: lang.id,
      appVersion: project.meta.appVersion,
      engineVersion: ENGINE_VERSION,
      fileName,
      importedAt
    },
    ...(study && {
      study: {
        author: study.author,
        lessons: study.lessons.length,
        audio: study.audio.length,
        hidden: hiddenIds(study).size,
        hasIntro: !!study.intro.trim()
      }
    })
  }
}

/** 界面拿这个颜色当强调色，不是 #rgb / #rrggbb 的一律换成默认色 */
export function safeColor(c: string | undefined): string {
  return c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim()) ? c.trim() : '#0e9f8a'
}

/** 学习包目录里的文件名 */
export const PACK_FILES = {
  manifest: 'manifest.json',
  /** 导入时的千语集项目原文 */
  source: 'source.laim.json',
  /** 按词频分的级：词条 id → 等级 */
  levels: 'levels.json',
  /** 学习包里作者给的设置（study.ts 的 PackStudy）；从项目文件导入的包没有 */
  study: 'study.json'
} as const

/** 一门语言要写进学习包目录的全部文件；从学习包导入时带上 pack（作者的设置与录音） */
export function buildQonlangPack(
  project: Project,
  languageId: string,
  fileName: string,
  source: string,
  importedAt = new Date().toISOString(),
  pack?: StudyPackFile
): {
  manifest: PackManifest
  levels: LevelAssignment
  study: PackStudy | null
  files: Record<string, string>
  audio: Record<string, { bytes: Uint8Array; ext: string }>
} {
  const study = pack ? studyForLanguage(pack.study, languageId, pack) : null
  const levels = frequencyLevels(project, languageId, {
    hidden: hiddenIds(study),
    pinned: study?.levels
  })
  const manifest = packFromQonlang(project, languageId, fileName, importedAt, levels.system, study)
  const audio: Record<string, { bytes: Uint8Array; ext: string }> = {}
  const raw = pack?.study.languages.find((l) => l.languageId === languageId)?.audio ?? {}
  for (const key of study?.audio ?? []) audio[key] = decodeAudio(raw[key].dataUrl)!
  return {
    manifest,
    levels,
    study,
    files: {
      [PACK_FILES.manifest]: JSON.stringify(manifest, null, 2),
      [PACK_FILES.levels]: JSON.stringify(levels),
      [PACK_FILES.source]: source,
      ...(study && { [PACK_FILES.study]: JSON.stringify(study) })
    },
    audio
  }
}
