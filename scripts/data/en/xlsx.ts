/**
 * 最小的 .xlsx 读取：解开 zip，读共享字符串与各工作表的单元格（只要文字与数字）。
 * CEFR-J 词表只发 xlsx，用不着为它加依赖。
 */
import { readFileSync } from 'node:fs'
import { strFromU8, unzipSync } from 'fflate'

const unescape = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

/** 读一个 xlsx（或者装着一个 xlsx 的 zip）：工作表名 → 行 → 单元格文字 */
export function readXlsx(path: string): Record<string, string[][]> {
  let z = unzipSync(readFileSync(path))
  const inner = Object.keys(z).find((n) => n.toLowerCase().endsWith('.xlsx'))
  if (inner) z = unzipSync(z[inner])
  const text = (p: string): string => (z[p] ? strFromU8(z[p]) : '')
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    unescape([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))
  )
  const rels = new Map(
    [
      ...text('xl/_rels/workbook.xml.rels').matchAll(
        /<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g
      )
    ].map((m) => [m[1], m[2]])
  )
  const out: Record<string, string[][]> = {}
  for (const m of text('xl/workbook.xml').matchAll(
    /<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g
  )) {
    const target = rels.get(m[2])
    if (!target) continue
    const xml = text('xl/' + target.replace(/^\/?xl\//, ''))
    const rows: string[][] = []
    for (const r of xml.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
      const row: string[] = []
      for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const col = [...c[1]].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1
        const v = c[3]?.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        const inline = c[3]?.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1]
        row[col] =
          v === undefined ? unescape(inline ?? '') : /t="s"/.test(c[2]) ? shared[+v] : unescape(v)
      }
      rows.push(Array.from(row, (x) => x ?? ''))
    }
    out[unescape(m[1])] = rows
  }
  return out
}
