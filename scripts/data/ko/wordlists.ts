/**
 * 国立国语院的两张学习词表：
 * - 2017《国际通用韩国语标准教育课程适用研究（4 阶段）》词汇等级表（xlsx，1–6 级，10,635 词）；
 * - 2003《韩国语学习用词汇目录》（txt，EUC-KR，A/B/C 三级，5,965 词，带 2002 年频度调查的名次）。
 * 两张表的同形词编号是《标准国语大辞典》的（가격02），跟한국어기초사전的编号不一样，
 * 对词条时按「词头 + 品词」，同形词再看汉字、例句里的词（见 build.ts 的 matchListWord）。
 */
import { unzipSync, strFromU8 } from 'fflate'
import { readFileSync } from 'node:fs'

export interface ListWord {
  /** 去掉同形词编号的词头 */
  w: string
  /** 原表里的同形词编号（没有为 0） */
  hom: number
  /** 原表的品词（명사、동사……或 명、동……） */
  pos: string
  /** 等级：1–6 或 A/B/C */
  level: string
  /** 2017：길잡이말（가격이 비싸다）；2003：풀이（價格、~ 차다） */
  hint: string
  /** 2003：频度名次 */
  rank?: number
}

/** xlsx 里一张表的所有行（字符串数组）；只认共享字符串与内联字符串，够用了 */
export function readXlsxSheet(path: string, sheetName: string): string[][] {
  const z = unzipSync(readFileSync(path))
  const wb = strFromU8(z['xl/workbook.xml'])
  const rels = strFromU8(z['xl/_rels/workbook.xml.rels'])
  const sheet = [...wb.matchAll(/<sheet [^>]*name="([^"]*)"[^>]*r:id="([^"]*)"/g)].find(
    (m) => m[1] === sheetName
  )
  if (!sheet) throw new Error(`没有工作表 ${sheetName}`)
  const target =
    new RegExp(`Id="${sheet[2]}"[^>]*Target="([^"]*)"`).exec(rels)?.[1] ??
    new RegExp(`Target="([^"]*)"[^>]*Id="${sheet[2]}"`).exec(rels)?.[1]
  if (!target) throw new Error(`找不到工作表文件 ${sheetName}`)
  const file = 'xl/' + target.replace(/^\/?xl\//, '')
  const unesc = (s: string): string =>
    s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
  const shared = z['xl/sharedStrings.xml']
    ? [...strFromU8(z['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''))
      )
    : []
  const col = (ref: string): number => {
    let n = 0
    for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64)
    return n - 1
  }
  const rows: string[][] = []
  for (const r of strFromU8(z[file]).matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = []
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const t = /t="(\w+)"/.exec(c[2])?.[1]
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? '')?.[1]
      const is = /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[3] ?? '')?.[1]
      row[col(c[1])] = (t === 's' ? shared[Number(v)] : unesc(is ?? v ?? '')).trim()
    }
    rows.push(Array.from(row, (x) => x ?? ''))
  }
  return rows
}

/** 拆开「가격02」：词头与同形词编号 */
export function splitHomonym(s: string): { w: string; hom: number } {
  const m = /^(.*?)(\d+)$/.exec(s.trim())
  return m ? { w: m[1].trim(), hom: Number(m[2]) } : { w: s.trim(), hom: 0 }
}

/** 2017 标准课程词汇等级表 */
export function readStd2017(path: string): ListWord[] {
  const rows = readXlsxSheet(path, '어휘')
  const head = rows[0]
  const iLevel = head.indexOf('등급')
  const iWord = head.indexOf('어휘')
  const iPos = head.indexOf('품사')
  const iHint = head.indexOf('길잡이말')
  const out: ListWord[] = []
  for (const r of rows.slice(1)) {
    if (!r[iWord]) continue
    const { w, hom } = splitHomonym(r[iWord])
    out.push({
      w,
      hom,
      pos: r[iPos] ?? '',
      level: (r[iLevel] ?? '').replace('급', ''),
      hint: r[iHint] ?? ''
    })
  }
  return out
}

/** 2003 学习用词汇目录（EUC-KR 的 txt，制表符分隔：순위 단어 품사 풀이 등급） */
export function readVocab2003(path: string): ListWord[] {
  const text = new TextDecoder('euc-kr').decode(readFileSync(path))
  const out: ListWord[] = []
  for (const line of text.split(/\r?\n/).slice(1)) {
    const [rank, word, pos, hint, level] = line.split('\t').map((x) => (x ?? '').trim())
    if (!word || !level) continue
    const { w, hom } = splitHomonym(word)
    out.push({ w, hom, pos, level, hint: hint ?? '', rank: Number(rank) || undefined })
  }
  return out
}
