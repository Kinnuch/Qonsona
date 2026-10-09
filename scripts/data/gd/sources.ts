/**
 * 苏格兰盖尔语数据的来源：下载地址、缓存文件名、许可与署名（写进词典库的 meta，设置里列出）。
 * 下载的原始文件放 .cache/data/gd/（不入库）；换版本只改这里。
 *
 * 从这台电脑连国外站点时断时续，所以用 curl 续传（-C -）并重试；没有 curl 时退回 fetch。
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import type { SourceRef } from '../../../src/shared/lang/types'
import { cacheDir, download } from '../../lang/lexdb-writer'

export const CACHE = cacheDir('gd')

const KAIKKI_ZH_LANG = encodeURIComponent('蘇格蘭蓋爾語')
const tatoeba = (lang: string, file: string): string =>
  `https://downloads.tatoeba.org/exports/per_language/${lang}/${file}`
const omw = (path: string): string =>
  `https://raw.githubusercontent.com/omwn/omw-data/main/wns/${path}`
const ud = (file: string): string =>
  `https://raw.githubusercontent.com/UniversalDependencies/UD_Scottish_Gaelic-ARCOSG/master/${file}`

/** 要下载的文件：键 → 地址与缓存文件名 */
export const FILES = {
  kaikki: {
    url: 'https://kaikki.org/dictionary/Scottish%20Gaelic/kaikki.org-dictionary-ScottishGaelic.jsonl',
    file: 'kaikki-gd.jsonl'
  },
  kaikkiZh: {
    url: `https://kaikki.org/zhwiktionary/${KAIKKI_ZH_LANG}/kaikki.org-dictionary-${KAIKKI_ZH_LANG}.jsonl`,
    file: 'kaikki-zhwikt-gd.jsonl'
  },
  usgw: {
    url: 'http://ukc.disi.unitn.it/wp-content/uploads/2019/12/usgw_v0.9.zip',
    file: 'usgw_v0.9.zip'
  },
  wiktGla: { url: omw('wikt/wn-wikt-gla.tab'), file: 'omw-wikt-gla.tab' },
  cow: { url: omw('cow/wn-data-cmn.tab'), file: 'omw-cow-wn-data-cmn.tab' },
  pwn: { url: omw('eng/wn-data-eng.tab'), file: 'omw-eng-wn-data-eng.tab' },
  /** 普林斯顿 WordNet 2.1 → 3.0 的义项对照（USGW 用的是 2.1 的编号） */
  sensemap: {
    url: 'https://wordnetcode.princeton.edu/3.0/WNsnsmap-3.0.tar.gz',
    file: 'WNsnsmap-3.0.tar.gz'
  },
  udTrain: { url: ud('gd_arcosg-ud-train.conllu'), file: 'ud-gd_arcosg-ud-train.conllu' },
  udDev: { url: ud('gd_arcosg-ud-dev.conllu'), file: 'ud-gd_arcosg-ud-dev.conllu' },
  udTest: { url: ud('gd_arcosg-ud-test.conllu'), file: 'ud-gd_arcosg-ud-test.conllu' },
  freqLearnGaelic: {
    url: 'https://raw.githubusercontent.com/innesmck/GaelicFrequencyLists/main/output/combined/frequency.csv',
    file: 'freq-innesmck-combined.csv'
  },
  gdwiki: {
    url: 'https://dumps.wikimedia.org/gdwiki/latest/gdwiki-latest-pages-articles.xml.bz2',
    file: 'gdwiki-latest-pages-articles.xml.bz2'
  },
  tatoebaGla: {
    url: tatoeba('gla', 'gla_sentences_detailed.tsv.bz2'),
    file: 'tatoeba-gla_sentences_detailed.tsv.bz2'
  },
  tatoebaGlaEng: {
    url: tatoeba('gla', 'gla-eng_links.tsv.bz2'),
    file: 'tatoeba-gla-eng_links.tsv.bz2'
  },
  tatoebaEng: {
    url: tatoeba('eng', 'eng_sentences.tsv.bz2'),
    file: 'tatoeba-eng_sentences.tsv.bz2'
  },
  tatoebaEngCmn: {
    url: tatoeba('eng', 'eng-cmn_links.tsv.bz2'),
    file: 'tatoeba-eng-cmn_links.tsv.bz2'
  },
  tatoebaCmn: {
    url: tatoeba('cmn', 'cmn_sentences.tsv.bz2'),
    file: 'tatoeba-cmn_sentences.tsv.bz2'
  },
  openccChars: {
    url: 'https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSCharacters.txt',
    file: 'opencc-TSCharacters.txt'
  },
  openccPhrases: {
    url: 'https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSPhrases.txt',
    file: 'opencc-TSPhrases.txt'
  }
} as const

export type FileKey = keyof typeof FILES

/** 用 curl 续传下载（断了重跑会接着下）；已经下好的跳过 */
async function fetchFile(url: string, file: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true })
  const out = join(CACHE, file)
  if (existsSync(out) && statSync(out).size > 0) return out
  process.stdout.write(`下载 ${file} … `)
  const part = out + '.part'
  for (let attempt = 1; attempt <= 6; attempt++) {
    const r = spawnSync(
      'curl',
      ['-L', '-C', '-', '--retry', '5', '--retry-all-errors', '-sS', '-o', part, url],
      { stdio: ['ignore', 'inherit', 'inherit'] }
    )
    if (r.error) {
      // 没有 curl：退回 Node 的 fetch（不能续传）
      const p = await download('gd', url, file)
      console.log('完成')
      return p
    }
    if (r.status === 0) {
      const { renameSync } = await import('node:fs')
      renameSync(part, out)
      console.log(`${(statSync(out).size / 1e6).toFixed(1)} MB`)
      return out
    }
    console.log(`（第 ${attempt} 次中断，接着下）`)
  }
  throw new Error(`下载失败：${url}`)
}

export async function fetchAll(): Promise<Record<FileKey, string>> {
  const out = {} as Record<FileKey, string>
  for (const key of Object.keys(FILES) as FileKey[])
    out[key] = await fetchFile(FILES[key].url, FILES[key].file)
  return out
}

/** 从 .tar.gz 里取几个文件的文字内容（只认普通文件；按文件名结尾对） */
export function untarGz(file: string, names: string[]): Map<string, string> {
  const buf = gunzipSync(readFileSync(file))
  const out = new Map<string, string>()
  for (let pos = 0; pos + 512 <= buf.length;) {
    const header = buf.subarray(pos, pos + 512)
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '')
    if (!name) break
    const size = parseInt(
      header.subarray(124, 136).toString('utf8').replace(/\0.*$/s, '').trim() || '0',
      8
    )
    const body = pos + 512
    const want = names.find((n) => name.endsWith(n))
    if (want) out.set(want, buf.subarray(body, body + size).toString('utf8'))
    pos = body + Math.ceil(size / 512) * 512
  }
  return out
}

/**
 * Lingua Libre 的盖尔语录音（维基共享资源分类里的文件）：词 → 转码后的 mp3 地址。
 * 结果缓存在 .cache；连不上时返回空的（录音可有可无）
 */
export async function linguaLibre(): Promise<{ word: string; url: string; speaker: string }[]> {
  const cache = join(CACHE, 'lingualibre-gla.json')
  let names: string[] = []
  if (existsSync(cache)) names = JSON.parse(readFileSync(cache, 'utf8'))
  else {
    try {
      const api =
        'https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&format=json&cmlimit=500&cmtitle=' +
        encodeURIComponent('Category:Lingua Libre pronunciation-gla')
      const res = await fetch(api, { headers: { 'User-Agent': 'Qonsona data pipeline' } })
      const j = (await res.json()) as { query: { categorymembers: { title: string }[] } }
      names = j.query.categorymembers.map((m) => m.title.replace(/^File:/, ''))
      writeFileSync(cache, JSON.stringify(names))
    } catch {
      return []
    }
  }
  const out: { word: string; url: string; speaker: string }[] = []
  for (const name of names) {
    // LL-Q9314 (gla)-说话人-词.wav
    const m = /^LL-Q9314 \(gla\)-([^-]+)-(.+)\.(wav|ogg|flac)$/.exec(name)
    if (!m || /\s/.test(m[2])) continue
    const file = name.replace(/ /g, '_')
    const md5 = createHash('md5').update(file).digest('hex')
    const enc = encodeURIComponent(file)
    out.push({
      word: m[2],
      speaker: m[1],
      url: `https://upload.wikimedia.org/wikipedia/commons/transcoded/${md5[0]}/${md5.slice(0, 2)}/${enc}/${enc}.mp3`
    })
  }
  return out
}

// ───────────────────────── 来源登记（词典库 meta.sources） ─────────────────────────

export const SRC: Record<string, SourceRef> = {
  wiktionary: {
    id: 'wiktionary',
    name: '英文维基词典的苏格兰盖尔语词条（kaikki.org 用 wiktextract 抽取）：词条、英文释义、IPA、变格变位与弱化形、例句',
    license: 'CC BY-SA 4.0',
    credit: 'Wiktionary contributors; Tatu Ylonen（wiktextract / kaikki.org）',
    home: 'https://kaikki.org/dictionary/Scottish%20Gaelic/',
    note: 'enwiktionary 2026-09-02 的 dump；释义未改动，变形表去掉了维基模板残留、拆出了单词形'
  },
  zhwikt: {
    id: 'zhwikt',
    name: '中文维基词典「苏格兰盖尔语」词条的中文释义（kaikki.org 抽取）',
    license: 'CC BY-SA 4.0',
    credit: '维基词典贡献者（zh.wiktionary.org）；Tatu Ylonen（wiktextract / kaikki.org）',
    home: 'https://zh.wiktionary.org/',
    note: '原文多为繁体，按 OpenCC 的繁简对照表转成简体'
  },
  usgw: {
    id: 'usgw',
    name: 'Unified Scottish Gaelic Wordnet v0.9：盖尔语词的同义词集与盖尔语释义',
    license: 'CC BY-SA 3.0',
    credit:
      'Gábor Bella, Fiona McNeill, Rody Gorman, Caoimhín Ó Donnaíle, Kirsty MacDonald et al.（Heriot-Watt University; University of Trento）',
    home: 'http://ukc.disi.unitn.it/index.php/gaelic/'
  },
  'wn-zh': {
    id: 'wn-zh',
    name: '中文释义：按 WordNet 同义词集对照得出（盖尔语词所在的同义词集 × 中文开放词网里同一个同义词集的中文词）',
    license: 'CC BY-SA 3.0（USGW）；Chinese Open Wordnet 许可；WordNet 3.0 许可',
    credit:
      'USGW（Bella et al.）；Chinese Open Wordnet（Francis Bond, Shan Wang）；Princeton WordNet 3.0；对照由 Qonsona 做',
    home: 'https://github.com/omwn/omw-data',
    note: '两边都是人工编的词网，但配对是程序按同义词集做的，不是逐词人工翻译；同义词集里的英文词要跟维基词典义项的英文释义对得上才用'
  },
  arcosg: {
    id: 'arcosg',
    name: 'UD Scottish Gaelic ARCOSG 树库（8.6 万词，人工标注原形）：词频与歧义词形的分配',
    license: 'CC BY-SA 4.0',
    credit:
      'Colin Batchelor；ARCOSG：William Lamb, Sharon Arbuthnot, Susanna Naismith, Samuel Danso（University of Edinburgh）',
    home: 'https://github.com/UniversalDependencies/UD_Scottish_Gaelic-ARCOSG'
  },
  'learngaelic-freq': {
    id: 'learngaelic-freq',
    name: '盖尔语词频表（LearnGaelic 的《Litir do Luchd-ionnsachaidh》与 Watch Gaelic 字幕统计）：词频',
    license: 'MIT（只用词频，不含原文）',
    credit: 'innesmck（GaelicFrequencyLists）',
    home: 'https://github.com/innesmck/GaelicFrequencyLists'
  },
  uicipeid: {
    id: 'uicipeid',
    name: '盖尔语维基百科（Uicipeid）2026-10-01 的条目全文：词频',
    license: 'CC BY-SA 4.0',
    credit: 'Uicipeid contributors',
    home: 'https://gd.wikipedia.org/'
  },
  tatoeba: {
    id: 'tatoeba',
    name: 'Tatoeba 例句（盖尔语原句与英文翻译；只收几位可靠贡献者的句子）',
    license: 'CC BY 2.0 FR',
    credit: 'Tatoeba contributors',
    home: 'https://tatoeba.org/'
  },
  'tatoeba-via-en': {
    id: 'tatoeba-via-en',
    name: 'Tatoeba 例句的中文翻译（经英文译文转接：盖尔语 → 英文 → 中文，都是人工翻译）',
    license: 'CC BY 2.0 FR',
    credit: 'Tatoeba contributors',
    home: 'https://tatoeba.org/',
    note: '间接翻译，意思一般对得上，细节可能有出入'
  },
  commons: {
    id: 'commons',
    name: '发音录音：维基共享资源（Lingua Libre、维基词典上传的录音）',
    license: '各录音的许可见词条（多为 CC BY-SA 4.0）',
    credit: 'Wikimedia Commons contributors; Lingua Libre',
    home: 'https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-gla'
  },
  opencc: {
    id: 'opencc',
    name: 'OpenCC 繁简对照表（把中文维基词典的繁体释义转成简体）',
    license: 'Apache 2.0',
    credit: 'BYVoid（Carbo Kuo）and OpenCC contributors',
    home: 'https://github.com/BYVoid/OpenCC'
  },
  'omw-wikt': {
    id: 'omw-wikt',
    name: '由英文维基词典翻译表导出的盖尔语词网（Open Multilingual Wordnet 的 wikt 数据）',
    license: 'CC BY-SA',
    credit:
      'Francis Bond, Ryan Foster（Extended Open Multilingual Wordnet）；Wiktionary contributors',
    home: 'https://github.com/omwn/omw-data'
  },
  'gd-supplement': {
    id: 'gd-supplement',
    name: '补充词条（本软件手写，data/gd/supplement.tsv）：维基词典与词网都没收、语料里常见的词',
    license: 'CC0',
    credit: 'Qonsona',
    home: 'https://github.com/Kinnuch/Qonsona'
  },
  'gd-core': {
    id: 'gd-core',
    name: 'A1 基础词表（本软件按 CLAG A1 清单与入门课常见主题手挑，data/gd/core-a1.txt）',
    license: 'CC0',
    credit: 'Qonsona',
    home: 'https://github.com/Kinnuch/Qonsona'
  }
}
