/**
 * 俄语数据管线的下载：放进 .cache/data/ru/（不入库），已经下好的跳过。
 *
 * kaikki.org 从国内连接很慢（单个连接十几 KB/s），所以照日语 wiktionary-ja.mjs 的办法分段并行下载：
 * 每段 1 MB，16 个连接同时下，断了重跑会接着下；服务器上的文件换了（etag 不同）就作废重下。
 * GitHub、Tatoeba 这些快的站点直接下（.part 文件可以续传）。
 *
 * 单独跑（只下载、不建库，可以放后台）：node scripts/data/run-ts.mjs scripts/data/ru/fetch.ts [键名…]
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
import { setTimeout as sleep } from 'node:timers/promises'
import { cacheDir } from '../../lang/lexdb-writer'
import { RAW, type RawFile } from './sources'

export const CACHE = cacheDir('ru')

/** 同时开几个连接、每段多大、多久没收到数据就重连 */
const PARALLEL = 16
const CHUNK = 1 << 20
const STALL = 30_000

const have = (path: string): boolean => existsSync(path) && statSync(path).size > 0

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
    const got = existsSync(tmp) ? statSync(tmp).size : 0
    if (start + got > end) break
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
        headers: { Range: `bytes=${start + got}-${end}`, ...(etag && { 'If-Range': etag }) },
        signal: ctrl.signal
      })
      if (res.status === 200 || (etag && res.headers.get('etag') !== etag)) {
        await res.body?.cancel()
        throw Object.assign(new Error('服务器上的文件刚更新过，重跑一次即可（会从头下新版）'), {
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
      await new Promise((r) => out.end(r))
    }
  }
  if (statSync(tmp).size !== end - start + 1) throw new Error(`${path} 大小不对`)
  renameSync(tmp, path)
}

/** 分段并行下载；旁边写一份 <file>.json 记下载地址、时间、etag */
async function fetchParallel(url: string, dest: string): Promise<void> {
  const head = await fetch(url, { method: 'HEAD', redirect: 'follow' })
  if (!head.ok) throw new Error(`${url} → HTTP ${head.status}`)
  const total = Number(head.headers.get('content-length'))
  if (!total) throw new Error(`${url} 没有 content-length`)
  const etag = head.headers.get('etag') ?? ''
  const parts = dest + '.parts'
  const tagFile = join(parts, 'etag')
  const tag = `${etag} ${CHUNK}`
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
  const name = dest.split(/[\\/]/).pop()
  process.stdout.write(`下载 ${name}（${(total / 1e6).toFixed(1)} MB，分 ${n} 段）… `)
  const t0 = Date.now()
  const got0 = got
  let shown = got
  const onBytes = (b: number): void => {
    got += b
    if (got - shown >= total / 20) {
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
  if (statSync(dest + '.part').size !== total) throw new Error(`${name} 拼起来大小不对`)
  renameSync(dest + '.part', dest)
  rmSync(parts, { recursive: true })
  writeFileSync(
    dest + '.json',
    JSON.stringify(
      {
        url,
        etag,
        lastModified: head.headers.get('last-modified'),
        downloadedAt: new Date().toISOString()
      },
      null,
      2
    ) + '\n'
  )
  console.log('完成')
}

/** 一个连接直接下；.part 留着，断了用 Range 接着下 */
async function fetchSimple(url: string, dest: string): Promise<void> {
  const part = dest + '.part'
  const name = dest.split(/[\\/]/).pop()
  process.stdout.write(`下载 ${name} … `)
  for (let attempt = 1; ; attempt++) {
    const got = existsSync(part) ? statSync(part).size : 0
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Qonsona data pipeline',
          ...(got && { Range: `bytes=${got}-` })
        }
      })
      if (res.status === 416) break // 已经下完
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      const append = got > 0 && res.status === 206
      const out = createWriteStream(part, { flags: append ? 'a' : 'w' })
      for await (const c of res.body as unknown as AsyncIterable<Uint8Array>) out.write(c)
      await new Promise((r) => out.end(r))
      break
    } catch (e) {
      if (attempt >= 8) throw new Error(`${url}：${(e as Error).message}`)
      await sleep(attempt * 2000)
    }
  }
  renameSync(part, dest)
  writeFileSync(
    dest + '.json',
    JSON.stringify({ url, downloadedAt: new Date().toISOString() }, null, 2) + '\n'
  )
  console.log(`${(statSync(dest).size / 1e6).toFixed(1)} MB`)
}

/** 取一份原始文件（已经有了就直接返回路径） */
export async function fetchRaw(f: RawFile): Promise<string> {
  mkdirSync(CACHE, { recursive: true })
  const dest = join(CACHE, f.file)
  if (have(dest)) return dest
  if (f.parallel) await fetchParallel(f.url, dest)
  else await fetchSimple(f.url, dest)
  return dest
}

/** 取几份（按键名）；返回 键名 → 本地路径 */
export async function fetchAll(keys: RawKey[]): Promise<Record<RawKey, string>> {
  const out = {} as Record<RawKey, string>
  for (const k of keys) out[k] = await fetchRaw(RAW[k])
  return out
}

export type RawKey = keyof typeof RAW
