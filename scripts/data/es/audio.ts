/**
 * Lingua Libre 的西班牙语录音（维基共享资源「Lingua Libre pronunciation-spa」分类，一万九千多个文件，
 * 文件名是「LL-Q1321 (spa)-<录音者>-<词>.wav」；Lingua Libre 的录音按 CC BY-SA 4.0 发布）。
 * 用维基共享资源的 API 列出分类里的文件名（五百个一页，四十来页），存进 .cache/data/es/lingualibre-spa.json，
 * 以后直接读缓存；播放地址用维基共享资源转好的 mp3（路径里的两级目录是文件名 md5 的前一位、前两位）。
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const API = 'https://commons.wikimedia.org/w/api.php'
const CATEGORY = 'Category:Lingua Libre pronunciation-spa'
const UA = 'Qonsona data pipeline (https://github.com/Kinnuch/Qonsona; language-learning app)'

/** 分类里全部文件名（不带 File: 前缀）；有缓存读缓存 */
export async function lingualibreFiles(cacheFile: string): Promise<string[]> {
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8')) as string[]
  const out: string[] = []
  let cont: string | undefined
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: CATEGORY,
      cmtype: 'file',
      cmlimit: '500',
      format: 'json',
      maxlag: '5',
      ...(cont ? { cmcontinue: cont } : {})
    })
    let data: {
      query?: { categorymembers: { title: string }[] }
      continue?: { cmcontinue: string }
    } | null = null
    for (let attempt = 1; attempt <= 8 && !data; attempt++) {
      try {
        const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } })
        const text = await res.text()
        if (!res.ok || !text.startsWith('{'))
          throw new Error(`HTTP ${res.status} ${text.slice(0, 60)}`)
        data = JSON.parse(text)
      } catch (e) {
        process.stdout.write(`（第 ${page} 页：${String(e).slice(0, 60)}，重试）`)
        await sleep(attempt * 3000)
      }
    }
    if (!data?.query) throw new Error('维基共享资源的分类列表取不到')
    for (const m of data.query.categorymembers) out.push(m.title.replace(/^File:/, ''))
    cont = data.continue?.cmcontinue
    if (!cont) break
    await sleep(400)
  }
  writeFileSync(cacheFile, JSON.stringify(out))
  return out
}

/** 维基共享资源转码好的 mp3 地址 */
export function commonsMp3(file: string): string {
  const name = file.replace(/ /g, '_')
  const h = createHash('md5').update(name).digest('hex')
  const enc = encodeURIComponent(name)
  return `https://upload.wikimedia.org/wikipedia/commons/transcoded/${h[0]}/${h.slice(0, 2)}/${enc}/${enc}.mp3`
}

export interface LlRecording {
  file: string
  speaker: string
  word: string
  /** 文件名里标的口音（American Spanish / European Spanish） */
  accent?: string
}

/**
 * 从文件名拆出录音者与词：「LL-Q1321 (spa)-Millars-gato.wav」→ Millars / gato。
 * 录音者的名字里也可能有连字符（Wikipedian-walker），所以从左往右试每个连字符，取后半截是词典里的词的那种拆法。
 * 词前面的「(American Spanish) 」是口音，词后面的「 (nombre)」是区分同形词的注，都去掉再比。
 */
export function parseLlName(file: string, known: (w: string) => boolean): LlRecording | null {
  const m = /^LL-Q1321 \(spa\)-(.+)\.(wav|ogg|flac|mp3)$/i.exec(file)
  if (!m) return null
  const rest = m[1]
  for (let i = rest.indexOf('-'); i > 0; i = rest.indexOf('-', i + 1)) {
    let word = rest
      .slice(i + 1)
      .replace(/_/g, ' ')
      .normalize('NFC')
    const acc = /^\(([^)]+)\)\s*/.exec(word)
    if (acc) word = word.slice(acc[0].length)
    word = word.replace(/\s*\([^)]*\)$/, '').trim()
    if (word && known(word)) return { file, speaker: rest.slice(0, i), word, accent: acc?.[1] }
  }
  return null
}
