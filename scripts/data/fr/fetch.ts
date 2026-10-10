/**
 * 法语数据管线的下载：放进 .cache/data/fr/（不入库），已经下好的跳过。
 *
 * 从这台电脑连 kaikki.org 单线程只有两三百 KB/s，几百 MB 的文件要分段并行下：
 * 每段 1 MB，同时开 12 个连接，收到的先写进 <文件>.parts/<段号>.tmp，断了从断处接着要，
 * 收齐一段改名，全部收齐再拼起来。服务器上的文件换了（ETag 变了）就把没拼完的分段作废重下。
 * 旁边写一份 <文件>.json：下载地址、ETag、Last-Modified、下载时间（文档里记数据版本用）。
 *
 * 单独跑：node scripts/data/run-ts.mjs scripts/data/fr/fetch.ts [来源 id…]（不写就全下）
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

export const CACHE = cacheDir('fr')

const PARALLEL = 12
const CHUNK = 1 << 20
/** 多久没收到数据就断开重连 */
const STALL = 30_000
const UA = 'Qonsona data pipeline (https://github.com/Kinnuch/Qonsona)'

const done = (path: string): boolean => existsSync(path) && statSync(path).size > 0

/** 下一段 [start, end]（含两端）：先写 .tmp，断了接着要，收齐了改名 */
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
          'User-Agent': UA,
          Range: `bytes=${start + have}-${end}`,
          ...(etag ? { 'If-Range': etag } : {})
        },
        signal: ctrl.signal
      })
      if (
        res.status === 200 ||
        (etag && res.headers.get('etag') && res.headers.get('etag') !== etag)
      ) {
        await res.body?.cancel()
        throw Object.assign(new Error(`${url}：服务器上的文件刚更新过，重跑一次（会从头下新版）`), {
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
      if ((e as { fatal?: boolean }).fatal || attempt >= 40) throw e
      await sleep(Math.min(attempt, 5) * 2000)
    } finally {
      clearTimeout(timer)
      await new Promise<void>((r) => out.end(() => r()))
    }
  }
  if (statSync(tmp).size !== end - start + 1) throw new Error(`${path} 大小不对`)
  renameSync(tmp, path)
}

/** 小文件或不支持分段的服务器：一次下完（先写 .part） */
async function fetchWhole(url: string, dest: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}：${url}`)
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest + '.part'))
      renameSync(dest + '.part', dest)
      return
    } catch (e) {
      if (attempt >= 5) throw e
      await sleep(attempt * 3000)
    }
  }
}

export interface Fetched {
  path: string
  url: string
  etag: string | null
  lastModified: string | null
  downloadedAt: string
}

const sidecar = (path: string): string => path + '.json'

/** 下载到 .cache/data/fr/<file>；返回本地路径（旁边的 .json 记着版本信息） */
export async function fetchFile(url: string, file: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true })
  const dest = join(CACHE, file)
  if (done(dest)) return dest
  const head = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    headers: { 'User-Agent': UA }
  })
  if (!head.ok)
    throw Object.assign(new Error(`${url} → HTTP ${head.status}`), { status: head.status })
  const total = Number(head.headers.get('content-length') ?? 0)
  const etag = head.headers.get('etag') ?? ''
  const ranges = head.headers.get('accept-ranges') === 'bytes'
  const t0 = Date.now()
  process.stdout.write(`下载 ${file}（${total ? (total / 1e6).toFixed(1) + ' MB' : '大小未知'}）… `)
  if (!ranges || !total || total < 4 * CHUNK) {
    await fetchWhole(url, dest)
  } else {
    const parts = dest + '.parts'
    const tagFile = join(parts, 'etag')
    const tag = `${etag} ${CHUNK} ${total}`
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
  const info: Fetched = {
    path: file,
    url,
    etag: etag || null,
    lastModified: head.headers.get('last-modified'),
    downloadedAt: new Date().toISOString()
  }
  writeFileSync(sidecar(dest), JSON.stringify(info, null, 2) + '\n')
  console.log(`完成（${((Date.now() - t0) / 1000).toFixed(0)} 秒）`)
  return dest
}

/** 下载时记下的版本信息（没有就是 null） */
export function fetchedInfo(path: string): Fetched | null {
  try {
    return JSON.parse(readFileSync(sidecar(path), 'utf8')) as Fetched
  } catch {
    return null
  }
}
