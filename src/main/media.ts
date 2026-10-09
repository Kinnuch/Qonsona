/**
 * 视听（M6）的媒体库（主进程）：本地的视频、音频不拷贝，只记住路径（userData/media/library.json）；
 * 字幕文件读成文字存进 userData/media/subs/<条目 id>/<字幕 id>.txt，原文件挪走了字幕还在。
 * 界面用 qsmedia://file/<条目 id> 播放：只放库里登记过的文件，支持 Range 请求（拖进度条）。
 */
import { createReadStream, existsSync, promises as fs } from 'fs'
import { basename, join } from 'path'
import { Readable } from 'stream'
import { randomUUID } from 'crypto'
import {
  decodeText,
  extOf,
  mediaKind,
  parseSubtitles,
  type MediaItem,
  type MediaPatch,
  type MediaSubtitle
} from '../shared/media'

export const MEDIA_SCHEME = 'qsmedia'

const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg'
}

const ID = /^[A-Za-z0-9-]{1,64}$/

export class MediaLibrary {
  #dir: string
  #items: MediaItem[] | null = null
  /** 连着改（进度每隔几秒存一次）时一个一个写，免得两次写乱了 */
  #writing: Promise<void> = Promise.resolve()

  constructor(dir: string) {
    this.#dir = dir
  }

  get #file(): string {
    return join(this.#dir, 'library.json')
  }

  async #load(): Promise<MediaItem[]> {
    if (this.#items) return this.#items
    try {
      const raw = JSON.parse(await fs.readFile(this.#file, 'utf8'))
      this.#items = Array.isArray(raw?.items) ? (raw.items as MediaItem[]) : []
    } catch {
      this.#items = []
    }
    return this.#items
  }

  #save(): Promise<void> {
    const items = this.#items ?? []
    this.#writing = this.#writing.then(async () => {
      await fs.mkdir(this.#dir, { recursive: true })
      // 「文件还在不在」是列表时现查的，不存
      const body = JSON.stringify(
        { version: 1, items: items.map(({ exists: _x, ...it }) => it) },
        null,
        1
      )
      await fs.writeFile(this.#file + '.tmp', body)
      await fs.rename(this.#file + '.tmp', this.#file)
    })
    return this.#writing
  }

  async list(): Promise<MediaItem[]> {
    const items = await this.#load()
    return items.map((it) => ({ ...it, exists: existsSync(it.path) }))
  }

  async #find(id: string): Promise<MediaItem> {
    if (!ID.test(id)) throw new Error(`媒体 id 不合法：${id}`)
    const it = (await this.#load()).find((x) => x.id === id)
    if (!it) throw new Error(`媒体库里没有：${id}`)
    return it
  }

  /**
   * 加进库里（同一个文件再加一次就是原来那一条，归到这次的语言）；不认识的格式返回 null。
   * lang 是它归哪门语言（学习包 id），不给时算日语
   */
  async add(path: string, lang?: string): Promise<MediaItem | null> {
    const kind = mediaKind(path)
    if (!kind || !existsSync(path)) return null
    const items = await this.#load()
    const hit = items.find((x) => x.path === path)
    if (hit) {
      if (lang && (hit.lang ?? 'ja') !== lang) {
        hit.lang = lang
        await this.#save()
      }
      return { ...hit, exists: true }
    }
    const item: MediaItem = {
      id: randomUUID(),
      title: basename(path).replace(/\.[^.]+$/, ''),
      path,
      kind,
      addedAt: new Date().toISOString(),
      subtitles: [],
      primary: null,
      secondary: null,
      offset: 0,
      position: 0,
      duration: 0,
      playedAt: null,
      ...(lang ? { lang } : {})
    }
    items.push(item)
    await this.#save()
    return { ...item, exists: true }
  }

  async update(id: string, patch: MediaPatch): Promise<MediaItem> {
    const it = await this.#find(id)
    const ok = new Set(it.subtitles.map((s) => s.id))
    if (typeof patch.title === 'string' && patch.title.trim())
      it.title = patch.title.trim().slice(0, 200)
    if (patch.primary === null || (typeof patch.primary === 'string' && ok.has(patch.primary)))
      it.primary = patch.primary
    if (
      patch.secondary === null ||
      (typeof patch.secondary === 'string' && ok.has(patch.secondary))
    )
      it.secondary = patch.secondary
    for (const k of ['offset', 'position', 'duration'] as const)
      if (typeof patch[k] === 'number' && Number.isFinite(patch[k])) it[k] = patch[k]
    if (typeof patch.playedAt === 'string') it.playedAt = patch.playedAt
    await this.#save()
    return { ...it, exists: existsSync(it.path) }
  }

  async remove(id: string): Promise<void> {
    await this.#find(id)
    this.#items = (this.#items ?? []).filter((x) => x.id !== id)
    await fs.rm(join(this.#dir, 'subs', id), { recursive: true, force: true })
    await this.#save()
  }

  /**
   * 加一个字幕文件：读成文字存起来。第一个字幕当主字幕；已经有主字幕、还没有第二字幕时当第二字幕。
   * 一句都解析不出来的不收（返回 null）
   */
  async addSubtitle(id: string, name: string, bytes: Uint8Array): Promise<MediaItem | null> {
    const it = await this.#find(id)
    const text = decodeText(bytes)
    const cues = parseSubtitles(text, name).length
    if (!cues) return null
    const sub: MediaSubtitle = { id: randomUUID(), name: basename(name), cues }
    const dir = join(this.#dir, 'subs', id)
    await fs.mkdir(dir, { recursive: true })
    // 存的时候带上原来的扩展名（解析时按它挑办法）
    await fs.writeFile(join(dir, `${sub.id}.${extOf(name) || 'srt'}`), text)
    it.subtitles.push(sub)
    if (!it.primary) it.primary = sub.id
    else if (!it.secondary) it.secondary = sub.id
    await this.#save()
    return { ...it, exists: existsSync(it.path) }
  }

  async removeSubtitle(id: string, subId: string): Promise<MediaItem> {
    const it = await this.#find(id)
    const sub = it.subtitles.find((s) => s.id === subId)
    if (!sub) return { ...it, exists: existsSync(it.path) }
    it.subtitles = it.subtitles.filter((s) => s.id !== subId)
    if (it.primary === subId) it.primary = it.subtitles[0]?.id ?? null
    if (it.secondary === subId || it.secondary === it.primary) it.secondary = null
    await fs.rm(join(this.#dir, 'subs', id, `${subId}.${extOf(sub.name) || 'srt'}`), {
      force: true
    })
    await this.#save()
    return { ...it, exists: existsSync(it.path) }
  }

  /** 字幕的文字（连同原来的文件名，解析时按扩展名挑办法） */
  async subtitle(id: string, subId: string): Promise<{ name: string; text: string } | null> {
    const it = await this.#find(id)
    const sub = it.subtitles.find((s) => s.id === subId)
    if (!sub) return null
    try {
      const text = await fs.readFile(
        join(this.#dir, 'subs', id, `${subId}.${extOf(sub.name) || 'srt'}`),
        'utf8'
      )
      return { name: sub.name, text }
    } catch {
      return null
    }
  }

  /** qsmedia://file/<id> 的请求：库里的文件按 Range 分段给 */
  async serve(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const id = decodeURIComponent(url.pathname.replace(/^\//, ''))
    let path: string
    try {
      path = (await this.#find(id)).path
    } catch {
      return new Response('not found', { status: 404 })
    }
    let size: number
    try {
      size = (await fs.stat(path)).size
    } catch {
      return new Response('not found', { status: 404 })
    }
    const type = MIME[extOf(path)] ?? 'application/octet-stream'
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '')
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : size - Number(range[2])
      let end = range[1] && range[2] ? Number(range[2]) : size - 1
      start = Math.max(0, start)
      end = Math.min(end, size - 1)
      if (start > end || start >= size)
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
      const body = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream
      return new Response(body, {
        status: 206,
        headers: {
          'Content-Type': type,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes'
        }
      })
    }
    const body = Readable.toWeb(createReadStream(path)) as ReadableStream
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' }
    })
  }
}
