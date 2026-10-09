/**
 * 首页上的样例：拿这门语言的一条短语（没有短语就拿一条例句），
 * 用千语集的文字引擎写成它自己的文字，配上读音和译文。
 * 学习包作者藏起来的不拿；作者定了默认文字的，那套文字排在最前。
 */
import type { Project } from '$qon/core/model'
import { renderScript } from '$qon/script/render'
import { ensureScriptFont, fontFamilyCss } from '$qon/script/fonts'
import type { LocalizedText } from '../types'
import { spellingIpa, storedIpa } from './pronounce'

export interface ScriptLine {
  id: string
  name: string
  text: string
  /** 内联样式：这套文字的字体 */
  style: string
}

export interface LanguageSample {
  /** 录音键：phrase-<短语 id> 或 sentence-<例句 id> */
  key: string
  text: string
  ipa: string
  translation: string
  scripts: ScriptLine[]
}

export function languageSample(
  project: Project,
  languageId: string,
  pick: (t: LocalizedText) => string,
  opts: { hidden?: ReadonlySet<string>; scriptId?: string | null } = {}
): LanguageSample | null {
  const lang = project.languages.find((l) => l.id === languageId)
  if (!lang) return null
  const shown = (x: { id: string; languageId: string | null; text: string }): boolean =>
    x.languageId === lang.id && !!x.text.trim() && !opts.hidden?.has(x.id)
  const phrase = project.phrasebook.find(shown)
  const sentence = project.sentences.find(shown)
  const item = phrase ?? sentence
  if (!item) return null
  const ipa = (phrase && storedIpa(lang, phrase.pronunciations)) || spellingIpa(lang, item.text)
  return {
    key: phrase ? `phrase-${phrase.id}` : `sentence-${sentence!.id}`,
    text: item.text,
    ipa,
    translation: pick(item.translation),
    scripts: [...lang.scripts]
      .sort((a, b) => Number(b.id === opts.scriptId) - Number(a.id === opts.scriptId))
      .map((sc) => {
        ensureScriptFont(sc)
        return {
          id: sc.id,
          name: sc.name,
          // 手工指定过文字写法的例句用手写的那份
          text:
            (sentence && !phrase && sentence.scriptForms[sc.id]) ||
            renderScript(lang, sc, item.text),
          style: fontFamilyCss(sc)
        }
      })
  }
}

/** 一套文字的前几个字形，首页上看个样子 */
export function glyphPreview(
  project: Project,
  languageId: string,
  scriptId: string,
  n = 16
): ScriptLine | null {
  const sc = project.languages
    .find((l) => l.id === languageId)
    ?.scripts.find((s) => s.id === scriptId)
  if (!sc) return null
  ensureScriptFont(sc)
  return {
    id: sc.id,
    name: sc.name,
    text: sc.glyphs
      .slice(0, n)
      .map((g) => g.char)
      .join(' '),
    style: fontFamilyCss(sc)
  }
}
