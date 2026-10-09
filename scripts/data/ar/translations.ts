/**
 * 维基词典的翻译表：一个义项下列着各种语言的译词。这里抽出阿拉伯语与汉语普通话同在一张表里的，
 * 当作「阿拉伯语词 ↔ 汉语词」的对照（中文释义的第二、第三个来源，见 build.ts）：
 *   - 英文维基词典的英语词条：同一个英语义项下的阿拉伯语（只要标准语，不要方言）与汉语普通话译词，
 *     对到阿拉伯语词条上时，再看这个英语词是不是这个阿拉伯语词条某个义项的英文释义——是才挂到那个义项上；
 *   - 中文维基词典的汉语词条：汉语词本身就是阿拉伯语译词的中文意思。
 * 英语词条的文件有五百多 MB，抽出来的小文件存在 .cache/data/ar/，下次直接用。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'

export interface EnPivot {
  /** 英语词头、词性、义项（翻译表的标题） */
  en: string
  pos: string
  sense: string
  /** 阿拉伯语标准语译词（带元音的写法） */
  ar: string[]
  /** 汉语普通话译词（简体，没有简体的照原样） */
  zh: string[]
}

export interface ZhTranslation {
  /** 汉语词头（中文维基的页面标题，可能是繁体） */
  zh: string
  pos: string
  sense: string
  ar: string[]
}

interface RawTr {
  lang?: string
  lang_code?: string
  word?: string
  sense?: string
  tags?: string[]
}

/** 「書 /书」→ 书；「電腦 /电脑, 計算機 /计算机」这种一项里只有一组 */
export function simplifiedOf(word: string): string {
  const parts = word.split('/').map((s) => s.trim())
  return parts.length === 2 && parts[1] ? parts[1] : word.trim()
}

/** 方言、古典等标签：这类阿拉伯语译词不要 */
const DIALECT = /Arabic$|Hassaniya|Maltese|Classical|Juba|Nubi/

async function* lines(file: string): AsyncGenerator<string> {
  const input = createReadStream(file).pipe(createGunzip())
  yield* createInterface({ input, crlfDelay: Infinity })
}

/** 英文维基词典英语词条的翻译表 → 阿汉对照（结果缓存在 cache 文件） */
export async function englishPivot(file: string, cache: string): Promise<EnPivot[]> {
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8')) as EnPivot[]
  const out: EnPivot[] = []
  let n = 0
  for await (const line of lines(file)) {
    if (++n % 200_000 === 0) process.stdout.write(`${n / 1000}k `)
    if (!line.includes('"Arabic"') || !line.includes('Chinese Mandarin')) continue
    const o = JSON.parse(line) as {
      word: string
      pos: string
      lang_code: string
      senses?: { translations?: RawTr[] }[]
      translations?: RawTr[]
    }
    if (o.lang_code !== 'en') continue
    const groups = new Map<string, RawTr[]>()
    const all = [
      ...(o.translations ?? []),
      ...(o.senses ?? []).flatMap((s) => s.translations ?? [])
    ]
    for (const t of all) {
      if (!t.word || !t.sense) continue
      const g = groups.get(t.sense)
      if (g) g.push(t)
      else groups.set(t.sense, [t])
    }
    for (const [sense, items] of groups) {
      const ar = [
        ...new Set(
          items
            .filter((t) => t.lang === 'Arabic' && !(t.tags ?? []).some((x) => DIALECT.test(x)))
            .map((t) => t.word!.trim())
        )
      ]
      const zh = [
        ...new Set(
          items
            .filter((t) => t.lang === 'Chinese Mandarin' || t.lang_code === 'cmn')
            .flatMap((t) => t.word!.split(/[,，]/))
            .map(simplifiedOf)
            .filter((w) => /\p{Script=Han}/u.test(w))
        )
      ]
      if (ar.length && zh.length) out.push({ en: o.word, pos: o.pos, sense, ar, zh })
    }
  }
  console.log(`\n英语词条的翻译表：${out.length} 个义项同时有阿拉伯语与汉语译词`)
  writeFileSync(cache, JSON.stringify(out))
  return out
}

/** 中文维基词典汉语词条的翻译表 → 汉阿对照 */
export async function chineseTranslations(
  files: string[],
  cache: string
): Promise<ZhTranslation[]> {
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8')) as ZhTranslation[]
  const out: ZhTranslation[] = []
  for (const file of files)
    for await (const line of lines(file)) {
      if (!line.includes('"lang_code": "ar"')) continue
      const o = JSON.parse(line) as {
        word: string
        pos: string
        lang_code: string
        translations?: RawTr[]
        senses?: { translations?: RawTr[] }[]
      }
      if (o.lang_code !== 'zh') continue
      const all = [
        ...(o.translations ?? []),
        ...(o.senses ?? []).flatMap((s) => s.translations ?? [])
      ]
      const groups = new Map<string, string[]>()
      for (const t of all) {
        if (t.lang_code !== 'ar' || !t.word) continue
        if ((t.tags ?? []).some((x) => DIALECT.test(x))) continue
        const k = t.sense ?? ''
        groups.set(k, [...(groups.get(k) ?? []), t.word.trim()])
      }
      for (const [sense, ar] of groups)
        out.push({ zh: o.word, pos: o.pos, sense, ar: [...new Set(ar)] })
    }
  console.log(`中文维基词典汉语词条的翻译表：${out.length} 组阿拉伯语译词`)
  writeFileSync(cache, JSON.stringify(out))
  return out
}
