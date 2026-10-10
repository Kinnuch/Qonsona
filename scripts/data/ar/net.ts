/**
 * 阿拉伯语数据管线的下载：放进 .cache/data/ar/（不入库），已经下好的跳过。
 * kaikki.org、GitHub 从国内连接时快时慢，大文件按 1 MB 一段并行下载，断了重跑会接着下（跟日语的 wiktionary-ja.mjs 一个做法）；
 * 服务器不支持分段（没有 Content-Length / Accept-Ranges）的整个下载。
 */
import {
  closeSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync
} from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { cacheDir } from '../../lang/lexdb-writer'

const UA = { 'User-Agent': 'Qonsona data pipeline (https://github.com/Kinnuch/Qonsona)' }
/** 同时开几个连接、每段多大、多久没收到数据就重连 */
const PARALLEL = 12
const CHUNK = 1 << 20
const STALL = 30_000

export const arCache = (): string => cacheDir('ar')
const done = (path: string): boolean => existsSync(path) && statSync(path).size > 0

/** 下一段 [start, end]：收到的先写进 .tmp，断了从断处接着要，收齐了改名 */
async function fetchRange(
  url: string,
  start: number,
  end: number,
  path: string,
  etag: string,
  onBytes: (n: number) => void
): Promise<void> {
  const tmp = path + '.tmp'
  for (let attempt = 1; ; attempt++) {
    const have = existsSync(tmp) ? statSync(tmp).size : 0
    if (start + have > end) break
    const ctrl = new AbortController()
    let timer: NodeJS.Timeout | undefined
    const arm = (): void => {
      clearTimeout(timer)
      timer = setTimeout(() => ctrl.abort(), STALL)
    }
    const out = createWriteStream(tmp, { flags: 'a' })
    try {
      arm()
      const res = await fetch(url, {
        headers: {
          ...UA,
          Range: `bytes=${start + have}-${end}`,
          ...(etag && { 'If-Range': etag })
        },
        signal: ctrl.signal
      })
      if (res.status === 200) {
        await res.body?.cancel()
        throw Object.assign(new Error('服务器上的文件刚更新过，删掉 .parts 重跑一次即可'), {
          fatal: true
        })
      }
      if (res.status !== 206 || !res.body) throw new Error(`HTTP ${res.status}`)
      for await (const c of res.body as unknown as AsyncIterable<Uint8Array>) {
        arm()
        out.write(c)
        onBytes(c.length)
      }
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal || attempt >= 30) throw e
      await sleep(Math.min(attempt, 5) * 2000)
    } finally {
      clearTimeout(timer)
      await new Promise((r) => out.end(r))
    }
  }
  if (statSync(tmp).size !== end - start + 1) throw new Error(`${path} 大小不对`)
  renameSync(tmp, path)
}

/** 整个下载（小文件、不支持分段的服务器）；失败重试几次 */
async function fetchWhole(url: string, dest: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, redirect: 'follow' })
      if (!res.ok || !res.body) throw new Error(`${url} → HTTP ${res.status}`)
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest + '.part'))
      renameSync(dest + '.part', dest)
      return
    } catch (e) {
      if (attempt >= 5) throw e
      await sleep(attempt * 2000)
    }
  }
}

/**
 * 下载到 .cache/data/ar/<file>（已经有了就不再下），返回本地路径。
 * 旁边写一份 <file>.json：下载地址、服务器上的修改时间、下载时间（文档里的「数据版本」照它写）。
 */
export async function fetchCached(url: string, file: string): Promise<string> {
  const dir = arCache()
  mkdirSync(dir, { recursive: true })
  const dest = join(dir, file)
  if (done(dest)) return dest
  const head = await fetch(url, { method: 'HEAD', headers: UA, redirect: 'follow' })
  if (!head.ok)
    throw Object.assign(new Error(`${url} → HTTP ${head.status}`), { status: head.status })
  const total = Number(head.headers.get('content-length') ?? 0)
  const etag = head.headers.get('etag') ?? ''
  const ranges = head.headers.get('accept-ranges') === 'bytes'
  process.stdout.write(`下载 ${file}（${(total / 1e6).toFixed(1)} MB）… `)
  if (!ranges || !total || total < 4 * CHUNK) {
    await fetchWhole(url, dest)
  } else {
    // 没下完的分段放 <file>.parts/；服务器上的文件换了（etag 不同）就作废重下
    const parts = dest + '.parts'
    const tagFile = join(parts, 'etag')
    const tag = `${etag} ${total} ${CHUNK}`
    if (existsSync(parts) && (!existsSync(tagFile) || readFileSync(tagFile, 'utf8') !== tag))
      rmSync(parts, { recursive: true })
    mkdirSync(parts, { recursive: true })
    writeFileSync(tagFile, tag)
    const n = Math.ceil(total / CHUNK)
    const todo: number[] = []
    let got = 0
    for (let i = 0; i < n; i++) {
      const p = join(parts, String(i))
      if (existsSync(p)) got += statSync(p).size
      else {
        if (existsSync(p + '.tmp')) got += statSync(p + '.tmp').size
        todo.push(i)
      }
    }
    const t0 = Date.now()
    const got0 = got
    let shown = got
    const onBytes = (b: number): void => {
      got += b
      if (got - shown >= total / 10) {
        shown = got
        const kbps = ((got - got0) / 1024 / ((Date.now() - t0) / 1000)).toFixed(0)
        process.stdout.write(`${Math.round((got / total) * 100)}%(${kbps} KB/s) `)
      }
    }
    const worker = async (): Promise<void> => {
      while (todo.length) {
        const i = todo.shift()!
        const end = Math.min(total, (i + 1) * CHUNK) - 1
        await fetchRange(url, i * CHUNK, end, join(parts, String(i)), etag, onBytes)
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker))
    const fd = openSync(dest + '.part', 'w')
    for (let i = 0; i < n; i++) writeSync(fd, readFileSync(join(parts, String(i))))
    closeSync(fd)
    if (statSync(dest + '.part').size !== total) throw new Error(`${file} 拼起来大小不对`)
    renameSync(dest + '.part', dest)
    rmSync(parts, { recursive: true })
  }
  writeFileSync(
    dest + '.json',
    JSON.stringify(
      {
        url,
        lastModified: head.headers.get('last-modified'),
        etag,
        downloadedAt: new Date().toISOString()
      },
      null,
      2
    ) + '\n'
  )
  console.log('完成')
  return dest
}
