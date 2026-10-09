/**
 * 千语集导出的学习包（.qstudy.json）里作者给的学习设置：课程、藏起来的内容、固定的级别、默认写法、作者录音。
 * 格式由千语集定（vendor/qonlang/core/studyPack.ts），这里只把一门语言的那份拆出来存进学习包目录。
 *
 * 录音不进 study.json：解成二进制，另存在学习包目录的 audio/ 下（见 buildQonlangPack）。
 */
import type { StudyLanguage, StudySettings } from '$qon/core/studyPack'

/** 存进学习包目录 study.json 的内容 */
export interface PackStudy {
  author: string
  /** 课程名称（空的用语言名） */
  title: string
  /** 介绍（Markdown） */
  intro: string
  lessons: StudyLanguage['lessons']
  hidden: StudyLanguage['hidden']
  /** 作者固定了级别的词：词条 id → 第几级（1 起） */
  levels: Record<string, number>
  display: StudyLanguage['display']
  /** 有作者录音的条目键（lexeme-<id>、phrase-<id>、sentence-<id>） */
  audio: string[]
  exportedAt: string
  qonlangVersion: string
}

/** 学习包里一门语言的设置；学习包里没有这门语言就是 null */
export function studyForLanguage(
  settings: StudySettings,
  languageId: string,
  meta: { exportedAt: string; qonlangVersion: string }
): PackStudy | null {
  const s = settings.languages.find((l) => l.languageId === languageId)
  if (!s) return null
  return {
    author: settings.author,
    title: s.title,
    intro: s.intro,
    lessons: s.lessons,
    hidden: s.hidden,
    levels: s.levels,
    display: s.display,
    audio: Object.keys(s.audio).filter((k) => decodeAudio(s.audio[k].dataUrl)),
    exportedAt: meta.exportedAt,
    qonlangVersion: meta.qonlangVersion
  }
}

/** 所有藏起来的 id（词条、例句、短语、文档的 id 都是 UUID，不会撞） */
export function hiddenIds(study: PackStudy | null): Set<string> {
  if (!study) return new Set()
  const h = study.hidden
  return new Set([...h.lexemeIds, ...h.sentenceIds, ...h.phraseIds, ...h.docIds])
}

const EXT_OF: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/flac': 'flac'
}

/** data URL → 字节与扩展名；不是认得的音频格式就是 null */
export function decodeAudio(dataUrl: string): { bytes: Uint8Array; ext: string } | null {
  const m = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/s.exec(dataUrl)
  const ext = m && EXT_OF[m[1].toLowerCase()]
  if (!m || !ext) return null
  try {
    const bin = atob(m[2])
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes.length ? { bytes, ext } : null
  } catch {
    return null
  }
}
