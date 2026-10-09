/**
 * 视听（M6）里跟语言无关的部分：媒体库的条目、字幕文件的解码与解析（SRT、WebVTT、ASS / SSA、LRC）、
 * 按时间找字幕。纯函数，测试里直接用。
 */

export type MediaKind = 'video' | 'audio'

export const VIDEO_EXT = ['mp4', 'm4v', 'webm', 'mkv', 'mov', 'ogv']
export const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'oga', 'opus']
export const SUBTITLE_EXT = ['srt', 'vtt', 'ass', 'ssa', 'lrc']

export const extOf = (name: string): string => /\.([^./\\]+)$/.exec(name)?.[1]?.toLowerCase() ?? ''

export function mediaKind(name: string): MediaKind | null {
  const ext = extOf(name)
  return VIDEO_EXT.includes(ext) ? 'video' : AUDIO_EXT.includes(ext) ? 'audio' : null
}

export interface MediaSubtitle {
  id: string
  /** 字幕文件原来的名字 */
  name: string
  /** 有几句 */
  cues: number
}

/** 媒体库里的一个视频或音频：文件留在原处，只记路径；字幕读成文字另存 */
export interface MediaItem {
  id: string
  title: string
  path: string
  kind: MediaKind
  addedAt: string
  subtitles: MediaSubtitle[]
  /** 主字幕（要学的语言）与第二字幕（译文）的 id */
  primary: string | null
  secondary: string | null
  /** 字幕整体延后几秒（负数是提前） */
  offset: number
  /** 看到哪里、一共多长（秒） */
  position: number
  duration: number
  playedAt: string | null
  /** 原文件还在不在（列表时查） */
  exists?: boolean
  /** 哪门语言的（学习包 id）；没有的是日语（分语言之前只有日语有视听） */
  lang?: string
}

/** 界面能改的几项 */
export type MediaPatch = Partial<
  Pick<
    MediaItem,
    'title' | 'primary' | 'secondary' | 'offset' | 'position' | 'duration' | 'playedAt'
  >
>

// ───────────────────────── 字幕文件的编码 ─────────────────────────

/**
 * 字幕文件的字节转成文字：有 BOM 按 BOM；UTF-8 读得通就是 UTF-8；
 * 读不通时看作日文（Shift_JIS，读出来有假名）或中文（GB18030）的旧编码
 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // 不是 UTF-8
  }
  try {
    const sjis = new TextDecoder('shift_jis', { fatal: true }).decode(bytes)
    if (/[ぁ-ゖァ-ヺ]/.test(sjis)) return sjis
  } catch {
    // 不是 Shift_JIS
  }
  return new TextDecoder('gb18030').decode(bytes)
}

// ───────────────────────── 字幕解析 ─────────────────────────

/** 一句字幕：起止时间（秒）与文字（可以有换行） */
export interface Cue {
  start: number
  end: number
  text: string
}

/** 00:01:02,345 / 01:02.345 / 1:02:03.45（ASS 的百分秒）→ 秒 */
export function parseTime(s: string): number | null {
  const m = /^\s*(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,:](\d{1,3}))?\s*$/.exec(s)
  if (!m) return null
  const [, h, mi, se, frac] = m
  const f = frac ? Number(frac) / 10 ** frac.length : 0
  return Number(h ?? 0) * 3600 + Number(mi) * 60 + Number(se) + f
}

/** 去掉字幕里的样式标签：<i>、<c.xx>、<v 人名>、{\an8}、{\i1}，以及 ASS 的 \N \n \h */
export function cleanCueText(s: string): string {
  return s
    .replace(/<rt>[\s\S]*?<\/rt>|<rp>[\s\S]*?<\/rp>/g, '')
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/\\N|\\n/g, '\n')
    .replace(/\\h/g, ' ')
    .replace(/<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}>/g, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
}

const ARROW = /^\s*(\S+)\s+-->\s+(\S+)/

/** SRT 与 WebVTT：一段一句，时间行「开始 --> 结束」，下面是文字 */
function parseBlocks(text: string): Cue[] {
  const out: Cue[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = ARROW.exec(lines[i])
    if (!m) continue
    const start = parseTime(m[1])
    const end = parseTime(m[2])
    const body: string[] = []
    while (i + 1 < lines.length && lines[i + 1].trim() && !ARROW.test(lines[i + 1]))
      body.push(lines[++i])
    // 下一句的编号行混进来了（没有空行隔开的坏文件）：去掉结尾的纯数字行
    if (
      i + 1 < lines.length &&
      ARROW.test(lines[i + 1]) &&
      /^\d+$/.test(body[body.length - 1] ?? '')
    )
      body.pop()
    const t = cleanCueText(body.join('\n'))
    if (start !== null && end !== null && t) out.push({ start, end: Math.max(end, start), text: t })
  }
  return out
}

/** ASS / SSA：[Events] 里的 Dialogue 行，按 Format 行找开始、结束、文字几列 */
function parseAss(text: string): Cue[] {
  const out: Cue[] = []
  let format: string[] | null = null
  let events = false
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (/^\[.*\]$/.test(line)) {
      events = line.toLowerCase() === '[events]'
      continue
    }
    if (!events) continue
    if (/^format\s*:/i.test(line)) {
      format = line
        .replace(/^format\s*:/i, '')
        .split(',')
        .map((x) => x.trim().toLowerCase())
      continue
    }
    if (!/^dialogue\s*:/i.test(line)) continue
    const cols = format ?? [
      'layer',
      'start',
      'end',
      'style',
      'name',
      'marginl',
      'marginr',
      'marginv',
      'effect',
      'text'
    ]
    const parts = line.replace(/^dialogue\s*:/i, '').split(',')
    // 文字是最后一列，里面可以有逗号
    const fields = [...parts.slice(0, cols.length - 1), parts.slice(cols.length - 1).join(',')]
    const get = (k: string): string => fields[cols.indexOf(k)] ?? ''
    const start = parseTime(get('start'))
    const end = parseTime(get('end'))
    const t = cleanCueText(get('text'))
    if (start !== null && end !== null && t) out.push({ start, end: Math.max(end, start), text: t })
  }
  return out
}

const LRC_STAMP = /^\s*\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/

/** LRC 歌词：[mm:ss.xx]一句（一行可以有几个时间）；一句到下一句开始为止，最后一句算 4 秒 */
function parseLrc(text: string): Cue[] {
  const stamps: { start: number; text: string }[] = []
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const times: number[] = []
    let rest = line
    let m: RegExpExecArray | null
    // 歌词里 [01:02:34] 的第三段也是百分秒，不是小时
    while ((m = LRC_STAMP.exec(rest))) {
      const s = parseTime(`${m[1]}:${m[2]}${m[3] ? '.' + m[3] : ''}`)
      if (s !== null) times.push(s)
      rest = rest.slice(m[0].length)
    }
    const t = cleanCueText(rest.replace(/<\d+:\d{1,2}(?:[.:]\d{1,3})?>/g, ''))
    for (const start of times) stamps.push({ start, text: t })
  }
  stamps.sort((a, b) => a.start - b.start)
  const out: Cue[] = []
  stamps.forEach((s, i) => {
    const end = stamps[i + 1]?.start ?? s.start + 4
    if (s.text) out.push({ start: s.start, end: Math.max(end, s.start), text: s.text })
  })
  return out
}

/** 按扩展名（没有时看内容）挑解析办法；结果按开始时间排好 */
export function parseSubtitles(text: string, name = ''): Cue[] {
  const ext = extOf(name)
  const body = text.replace(/^\uFEFF/, '')
  let cues: Cue[]
  if (ext === 'ass' || ext === 'ssa' || /^\s*\[script info\]/i.test(body)) cues = parseAss(body)
  else if (ext === 'lrc' || (!ARROW.test(body) && /^\s*\[\d+:\d{1,2}/m.test(body)))
    cues = parseLrc(body)
  else cues = parseBlocks(body)
  return cues.sort((a, b) => a.start - b.start || a.end - b.end)
}

/** 时间 t 落在哪一句里（没有就是 -1）；offset 是字幕整体延后的秒数 */
export function cueAt(cues: Cue[], t: number, offset = 0): number {
  const i = lastStarted(cues, t, offset)
  return i >= 0 && t < cues[i].end + offset ? i : -1
}

/** 开始时间不晚于 t 的最后一句（还没到第一句是 -1） */
export function lastStarted(cues: Cue[], t: number, offset = 0): number {
  let lo = 0
  let hi = cues.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (cues[mid].start + offset <= t) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

/** 跟某一句时间上重叠最多的那一句（第二字幕对齐主字幕用）；没有重叠是 -1 */
export function overlapping(cues: Cue[], start: number, end: number): number {
  let best = -1
  let most = 0
  const from = Math.max(0, lastStarted(cues, start) - 2)
  for (let i = from; i < cues.length && cues[i].start < end; i++) {
    const o = Math.min(end, cues[i].end) - Math.max(start, cues[i].start)
    if (o > most) {
      most = o
      best = i
    }
  }
  return best
}

/** 时间写成 1:02:03 或 2:03 */
export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
