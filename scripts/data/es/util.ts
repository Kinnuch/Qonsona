/**
 * 西班牙语数据管线的小工具：按行读压缩文件、可续传的下载、msgpack 解码（wordfreq 的数据格式）。
 */
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync
} from 'node:fs'
import { dirname } from 'node:path'
import { createInterface } from 'node:readline'
import { setTimeout as sleep } from 'node:timers/promises'
import { createGunzip, gunzipSync } from 'node:zlib'
import Bunzip from 'seek-bzip'

/** 一行一行读：.gz 边读边解压；.bz2 整个解开再切（seek-bzip 只能整块解） */
export async function* readLines(file: string): AsyncGenerator<string> {
  if (file.endsWith('.bz2')) {
    const text = (Bunzip.decode(readFileSync(file)) as Buffer).toString('utf8')
    let start = 0
    for (;;) {
      const nl = text.indexOf('\n', start)
      if (nl < 0) {
        if (start < text.length) yield text.slice(start)
        return
      }
      yield text.slice(start, nl).replace(/\r$/, '')
      start = nl + 1
    }
  }
  let stream: NodeJS.ReadableStream = createReadStream(file)
  if (file.endsWith('.gz')) stream = stream.pipe(createGunzip())
  for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) yield line
}

/** 读一个 TSV（.bz2 / .gz / 不压缩）的每一行，按 \t 切开 */
export async function* readTsv(file: string): AsyncGenerator<string[]> {
  for await (const line of readLines(file)) if (line) yield line.split('\t')
}

/**
 * 下载到 dest（已经有了就跳过）：先写 dest.part，断了从断处接着要（Range），重试几次；
 * 从这台电脑连 kaikki.org 偶尔会断，95 MB 的文件要能续传。
 */
export async function fetchFile(url: string, dest: string, tries = 12): Promise<string> {
  if (existsSync(dest) && statSync(dest).size > 0) return dest
  mkdirSync(dirname(dest), { recursive: true })
  const part = dest + '.part'
  for (let attempt = 1; ; attempt++) {
    const have = existsSync(part) ? statSync(part).size : 0
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Qonsona data pipeline (https://github.com/Kinnuch/Qonsona)',
          ...(have ? { Range: `bytes=${have}-` } : {})
        },
        redirect: 'follow'
      })
      if (res.status === 416) break // 已经下完了
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      // 服务器不认 Range 时从头写
      const append = have > 0 && res.status === 206
      const out = createWriteStream(part, { flags: append ? 'a' : 'w' })
      const reader = res.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (!out.write(value)) await new Promise((r) => out.once('drain', r))
      }
      await new Promise((r) => out.end(r))
      break
    } catch (e) {
      if (attempt >= tries) throw new Error(`下载失败（${url}）：${e}`)
      process.stdout.write(`（${String(e).slice(0, 60)}，${attempt} 次，续传）`)
      await sleep(Math.min(attempt, 6) * 2000)
    }
  }
  renameSync(part, dest)
  return dest
}

// ───────────────────────── msgpack（只解 wordfreq 用到的几种） ─────────────────────────

/** 解一份 msgpack；wordfreq 的 .msgpack.gz 是 [表头, [这一档的词…], …] */
export function decodeMsgpack(buf: Uint8Array): unknown {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const dec = new TextDecoder()
  let p = 0
  const str = (n: number): string => {
    const s = dec.decode(buf.subarray(p, p + n))
    p += n
    return s
  }
  const arr = (n: number): unknown[] => {
    const out = new Array(n)
    for (let i = 0; i < n; i++) out[i] = read()
    return out
  }
  const map = (n: number): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (let i = 0; i < n; i++) {
      const k = String(read())
      out[k] = read()
    }
    return out
  }
  function read(): unknown {
    const b = buf[p++]
    if (b <= 0x7f) return b
    if (b >= 0xe0) return b - 0x100
    if ((b & 0xf0) === 0x80) return map(b & 0x0f)
    if ((b & 0xf0) === 0x90) return arr(b & 0x0f)
    if ((b & 0xe0) === 0xa0) return str(b & 0x1f)
    switch (b) {
      case 0xc0:
        return null
      case 0xc2:
        return false
      case 0xc3:
        return true
      case 0xc4: {
        const n = buf[p++]
        p += n
        return null
      }
      case 0xca: {
        const v = view.getFloat32(p)
        p += 4
        return v
      }
      case 0xcb: {
        const v = view.getFloat64(p)
        p += 8
        return v
      }
      case 0xcc:
        return buf[p++]
      case 0xcd: {
        const v = view.getUint16(p)
        p += 2
        return v
      }
      case 0xce: {
        const v = view.getUint32(p)
        p += 4
        return v
      }
      case 0xd0:
        return view.getInt8(p++)
      case 0xd1: {
        const v = view.getInt16(p)
        p += 2
        return v
      }
      case 0xd2: {
        const v = view.getInt32(p)
        p += 4
        return v
      }
      case 0xd9:
        return str(buf[p++])
      case 0xda: {
        const n = view.getUint16(p)
        p += 2
        return str(n)
      }
      case 0xdb: {
        const n = view.getUint32(p)
        p += 4
        return str(n)
      }
      case 0xdc: {
        const n = view.getUint16(p)
        p += 2
        return arr(n)
      }
      case 0xdd: {
        const n = view.getUint32(p)
        p += 4
        return arr(n)
      }
      case 0xde: {
        const n = view.getUint16(p)
        p += 2
        return map(n)
      }
      case 0xdf: {
        const n = view.getUint32(p)
        p += 4
        return map(n)
      }
      default:
        throw new Error(`msgpack：不认识的类型 0x${b.toString(16)}（位置 ${p - 1}）`)
    }
  }
  return read()
}

/** wordfreq 的 cBpack：第 i 档（从 0 数）的词，频率是 10^(-i/100)（占全部词次的比例） */
export function readWordfreq(file: string): Map<string, number> {
  const data = decodeMsgpack(gunzipSync(readFileSync(file))) as unknown[]
  const header = data[0] as { format?: string }
  if (header?.format !== 'cB') throw new Error(`${file} 不是 wordfreq 的 cBpack`)
  const out = new Map<string, number>()
  for (let i = 1; i < data.length; i++) {
    const f = Math.pow(10, -(i - 1) / 100)
    for (const w of data[i] as string[]) if (!out.has(w)) out.set(w, f)
  }
  return out
}
