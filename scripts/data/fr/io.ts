/**
 * 读原始文件的小工具：按行读（.gz 边解压边读）、读 zip 里的一个文件、读 bz2、中间结果缓存。
 *
 * 按行读不用 node:readline：它把单独的 \r 也当换行，kaikki 的 JSONL 里有些释义带 \r，会把一行拆坏。
 */
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { createGunzip } from 'node:zlib'
import { unzipSync, strFromU8 } from 'fflate'
import Bunzip from 'seek-bzip'
import { CACHE } from './fetch'

/** 一行一行读（.gz 自动解压）；只按 \n 分行 */
export async function* readLines(file: string): AsyncGenerator<string> {
  let stream: NodeJS.ReadableStream = createReadStream(file, { highWaterMark: 1 << 20 })
  if (file.endsWith('.gz')) stream = stream.pipe(createGunzip({ chunkSize: 1 << 20 }))
  const dec = new StringDecoder('utf8')
  let rest = ''
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    const text = rest + dec.write(chunk)
    let start = 0
    let i: number
    while ((i = text.indexOf('\n', start)) !== -1) {
      yield text.slice(start, i)
      start = i + 1
    }
    rest = text.slice(start)
  }
  rest += dec.end()
  if (rest) yield rest
}

/** JSONL：每行一个对象；先用 keep 粗筛原文再解析（整份数据里大半用不上） */
export async function* readJsonl<T>(
  file: string,
  keep?: (line: string) => boolean
): AsyncGenerator<T> {
  for await (const line of readLines(file)) {
    if (!line || (keep && !keep(line))) continue
    try {
      yield JSON.parse(line) as T
    } catch {
      // 坏行跳过
    }
  }
}

/** zip 里名字以 suffix 结尾的那个文件的文字 */
export function readZipEntry(zip: string, suffix: string): string {
  const files = unzipSync(readFileSync(zip), {
    filter: (f) => f.name.endsWith(suffix) && !f.name.startsWith('__MACOSX')
  })
  const name = Object.keys(files)[0]
  if (!name) throw new Error(`${zip} 里没有 *${suffix}`)
  return strFromU8(files[name])
}

export function readBz2Text(file: string): string {
  return (Bunzip.decode(readFileSync(file)) as Buffer).toString('utf8')
}

/** 中间结果放 .cache/data/fr/work/ */
export const WORK = join(CACHE, 'work')

/**
 * 中间结果的缓存：输入文件都没变（大小、修改时间）就直接读上次的结果；
 * 改了处理代码要重算时，把 VERSION 加一或删掉 work/ 下的文件
 */
export async function cached<T>(
  name: string,
  version: number,
  inputs: string[],
  make: () => Promise<T>
): Promise<T> {
  mkdirSync(WORK, { recursive: true })
  const file = join(WORK, name + '.json')
  const stamp = JSON.stringify({
    version,
    inputs: inputs.map((f) => (existsSync(f) ? [f, statSync(f).size, statSync(f).mtimeMs] : [f]))
  })
  if (existsSync(file)) {
    try {
      const saved = JSON.parse(readFileSync(file, 'utf8')) as { stamp: string; data: T }
      if (saved.stamp === stamp) return saved.data
    } catch {
      // 坏了就重算
    }
  }
  const data = await make()
  writeFileSync(file, JSON.stringify({ stamp, data }))
  return data
}

const t0 = Date.now()
/** 带耗时的日志 */
export function log(msg: string): void {
  console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s] ${msg}`)
}
