/**
 * 各语言共用的文字处理：规整、去变音符号、切词、分句。
 * 各语言的规则（<代码>/rules.ts）在这些上面加自己的特殊处理（省音、附着词、助词……）。
 */
import type { RawToken } from './types'

/** 统一成 NFC，弯引号撇号换成直的，去掉零宽字符与首尾空白 */
export function tidy(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\u2018\u2019\u02bc\u2032]/g, "'")
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim()
}

/** 默认的查词键：tidy 之后转小写 */
export function defaultKey(text: string, locale?: string): string {
  return tidy(text).toLocaleLowerCase(locale)
}

/** 去掉所有组合附加符号（é → e、ё → е 要另外处理：ё 在 NFD 里是 е + ̈，这里也会去掉） */
export function stripMarks(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC')
}

/**
 * 去掉附加符号（重音、元音符号……）并转小写，同时记下折叠后每个字符在原文里的位置（map 比 folded 多一项：末尾）。
 * 例句里找词时两边都这样折叠再比（Tatoeba 的句子不带重音，词典的写法带），找到后按 map 换回原文的起止
 */
export function foldWithMap(text: string, locale?: string): { folded: string; map: number[] } {
  let folded = ''
  const map: number[] = []
  let i = 0
  for (const ch of text) {
    const f = ch.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase(locale)
    for (let k = 0; k < f.length; k++) map.push(i)
    folded += f
    i += ch.length
  }
  map.push(i)
  return { folded, map }
}

const segmenters = new Map<string, Intl.Segmenter>()
function segmenter(locale: string, granularity: 'word' | 'sentence'): Intl.Segmenter {
  const k = `${locale}|${granularity}`
  let s = segmenters.get(k)
  if (!s) segmenters.set(k, (s = new Intl.Segmenter(locale, { granularity })))
  return s
}

/** 用 Intl.Segmenter 切词：词、数字、标点、空白各成一段，首尾相接覆盖全文 */
export function segmentWords(text: string, locale: string): RawToken[] {
  const out: RawToken[] = []
  for (const seg of segmenter(locale, 'word').segment(text)) {
    const start = seg.index
    const end = start + seg.segment.length
    const t = seg.segment
    const kind: RawToken['kind'] = /^\s+$/u.test(t)
      ? 'space'
      : seg.isWordLike
        ? /^[\p{N}.,]+$/u.test(t)
          ? 'num'
          : 'word'
        : /[\p{L}\p{N}]/u.test(t)
          ? 'word'
          : 'punct'
    out.push({ text: t, start, end, kind })
  }
  return out
}

export interface SentenceRange {
  start: number
  end: number
  /** 第几段（从 0 起；空行分段） */
  para: number
}

/** 分句：Intl.Segmenter 按句切，空行另起一段；每句去掉首尾空白 */
export function segmentSentences(
  text: string,
  locale: string,
  noBreakAfter?: RegExp
): SentenceRange[] {
  const out: SentenceRange[] = []
  let para = 0
  let pos = 0
  for (const block of text.split(/\n/)) {
    const blockStart = pos
    pos += block.length + 1
    if (!block.trim()) {
      if (out.length && out[out.length - 1].para === para) para++
      continue
    }
    for (const seg of segmenter(locale, 'sentence').segment(block)) {
      const raw = seg.segment
      const lead = raw.length - raw.trimStart().length
      const body = raw.trim()
      if (!body) continue
      const start = blockStart + seg.index + lead
      const prev = out[out.length - 1]
      // 前一句停在缩写上（Mr.、т. е.）：并进前一句
      if (
        noBreakAfter &&
        prev &&
        prev.para === para &&
        noBreakAfter.test(text.slice(prev.start, prev.end))
      )
        prev.end = start + body.length
      else out.push({ start, end: start + body.length, para })
    }
    // 一行一段（诗、对话）；连着的几行算同一段由各语言自己决定，这里每个换行都分段
    if (out.length && out[out.length - 1].para === para) para++
  }
  return out
}
