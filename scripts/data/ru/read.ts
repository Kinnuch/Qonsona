/**
 * 读原始数据：JSONL（.gz）、bz2 压缩的 TSV、MySQL 导出、OpenCC 的繁简表。
 */
import { createReadStream, readFileSync } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { unzipSync, strFromU8 } from 'fflate'
import Bunzip from 'seek-bzip'

/** 一行一个 JSON 的文件（可以是 .gz）；只按 \n 分行（词条里可能有单独的 \r） */
export async function* jsonl<T>(file: string): AsyncGenerator<T> {
  const raw = createReadStream(file)
  const stream = file.endsWith('.gz') ? raw.pipe(createGunzip()) : raw
  // 按字符解码：多字节的字被数据块切开时也不会坏
  stream.setEncoding('utf8')
  let rest = ''
  for await (const chunk of stream as AsyncIterable<string>) {
    const lines = (rest + chunk).split('\n')
    rest = lines.pop() ?? ''
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as T
  }
  if (rest.trim()) yield JSON.parse(rest) as T
}

/** bz2 压缩的文本整个解开 */
export function bz2Text(file: string): string {
  return Bunzip.decode(readFileSync(file)).toString('utf8')
}

/** Tatoeba 的 TSV：每行按制表符拆开 */
export function* tsvRows(text: string): Generator<string[]> {
  let start = 0
  while (start < text.length) {
    let end = text.indexOf('\n', start)
    if (end < 0) end = text.length
    const line = text.slice(start, end)
    start = end + 1
    if (line) yield line.split('\t')
  }
}

/** zip 里的一个文件 */
export function zipEntryText(file: string, name: string): string {
  const files = unzipSync(readFileSync(file), { filter: (f) => f.name === name })
  if (!files[name]) throw new Error(`${file} 里没有 ${name}`)
  return strFromU8(files[name])
}

const BACKSLASH = String.fromCharCode(92)
const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', '0': '\0', Z: '\x1a' }

/** MySQL 导出里一张表的每一行（INSERT INTO `t` VALUES (...),(...);） */
export function* mysqlRows(sql: string, table: string): Generator<(string | number | null)[]> {
  const head = 'INSERT INTO `' + table + '` VALUES '
  let i = 0
  while ((i = sql.indexOf(head, i)) >= 0) {
    i += head.length
    while (sql[i] === '(') {
      i++
      const row: (string | number | null)[] = []
      for (;;) {
        if (sql[i] === "'") {
          i++
          let s = ''
          for (;;) {
            const c = sql[i]
            if (c === BACKSLASH) {
              const n = sql[i + 1]
              s += ESCAPES[n] ?? n
              i += 2
            } else if (c === "'") {
              if (sql[i + 1] === "'") {
                s += "'"
                i += 2
              } else {
                i++
                break
              }
            } else {
              s += c
              i++
            }
          }
          row.push(s)
        } else {
          let j = i
          while (sql[j] !== ',' && sql[j] !== ')') j++
          const t = sql.slice(i, j)
          row.push(t === 'NULL' ? null : Number(t))
          i = j
        }
        if (sql[i] === ',') {
          i++
          continue
        }
        if (sql[i] === ')') {
          i++
          break
        }
        throw new Error(`${table} 解析出错：${sql.slice(i - 40, i + 40)}`)
      }
      yield row
      if (sql[i] === ',') i++
      else break
    }
  }
}

/** OpenCC 的繁→简：先按词（长的优先）再按字 */
export class ToSimplified {
  #chars = new Map<string, string>()
  #phrases = new Map<string, string>()
  #maxPhrase = 1

  constructor(charsFile: string, phrasesFile: string) {
    for (const [file, map] of [
      [charsFile, this.#chars],
      [phrasesFile, this.#phrases]
    ] as const)
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line || line.startsWith('#')) continue
        const [k, v] = line.split('\t')
        if (k && v) {
          map.set(k, v.split(' ')[0])
          if (map === this.#phrases) this.#maxPhrase = Math.max(this.#maxPhrase, [...k].length)
        }
      }
  }

  convert(text: string): string {
    const cs = [...text]
    let out = ''
    for (let i = 0; i < cs.length;) {
      let done = false
      for (let n = Math.min(this.#maxPhrase, cs.length - i); n >= 2; n--) {
        const v = this.#phrases.get(cs.slice(i, i + n).join(''))
        if (v) {
          out += v
          i += n
          done = true
          break
        }
      }
      if (done) continue
      out += this.#chars.get(cs[i]) ?? cs[i]
      i++
    }
    return out
  }
}
