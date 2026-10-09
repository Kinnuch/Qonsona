/**
 * 日语数据的来源：下载地址、许可、缓存。
 * 下载的原始文件放在 .cache/data/（不入库）；换版本只改这里的地址。
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { unzipSync, gunzipSync, strFromU8 } from 'fflate'
import Bunzip from 'seek-bzip'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const cacheDir = join(root, '.cache/data')

const JMDICT = '3.6.2+20260921173324'
const gh = (repo, tag, file) =>
  `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(file)}`
const raw = (repo, path) => `https://raw.githubusercontent.com/${repo}/${path}`

/** 每份数据：从哪来、什么许可、界面上怎么署名 */
export const SOURCES = {
  jmdict: {
    url: gh('scriptin/jmdict-simplified', JMDICT, `jmdict-examples-eng-${JMDICT}.json.zip`),
    file: `jmdict-examples-eng-${JMDICT}.json.zip`,
    name: 'JMdict（jmdict-simplified 整理的 JSON 版）',
    license: 'CC BY-SA 4.0',
    credit: 'Electronic Dictionary Research and Development Group (EDRDG)',
    home: 'https://www.edrdg.org/jmdict/j_jmdict.html'
  },
  kanjidic: {
    url: gh('scriptin/jmdict-simplified', JMDICT, `kanjidic2-en-${JMDICT}.json.zip`),
    file: `kanjidic2-en-${JMDICT}.json.zip`,
    name: 'KANJIDIC2',
    license: 'CC BY-SA 4.0',
    credit: 'EDRDG',
    home: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project'
  },
  kanjivg: {
    url: 'https://github.com/KanjiVG/kanjivg/releases/download/r20250816/kanjivg-20250816.xml.gz',
    file: 'kanjivg-20250816.xml.gz',
    name: 'KanjiVG',
    license: 'CC BY-SA 3.0',
    credit: 'Ulrich Apel',
    home: 'https://kanjivg.tagaini.net/'
  },
  jlpt: {
    urls: ['n5', 'n4', 'n3', 'n2', 'n1'].map((n) =>
      raw('stephenmk/yomitan-jlpt-vocab', `main/original_data/${n}.csv`)
    ),
    files: ['n5', 'n4', 'n3', 'n2', 'n1'].map((n) => `jlpt-vocab-${n}.csv`),
    name: 'JLPT 词汇分级（Jonathan Waller 的 JLPT 表，stephenmk 对到 JMdict 词条）',
    license: 'CC BY（原表）/ CC BY-SA 4.0（对照）',
    credit: 'Jonathan Waller; stephenmk',
    home: 'https://www.tanos.co.uk/jlpt/'
  },
  kanjiLevels: {
    url: raw('davidluzgouveia/kanji-data', 'master/kanji.json'),
    file: 'kanji-data.json',
    name: '汉字的新 JLPT 等级（kanji-data）',
    license: 'MIT（数据出自 KANJIDIC 与 Jonathan Waller 的 JLPT 表）',
    credit: 'David Gouveia',
    home: 'https://github.com/davidluzgouveia/kanji-data'
  },
  tatoebaLinks: {
    url: 'https://downloads.tatoeba.org/exports/per_language/jpn/jpn-cmn_links.tsv.bz2',
    file: 'tatoeba-jpn-cmn_links.tsv.bz2',
    name: 'Tatoeba 例句（日中对照）',
    license: 'CC BY 2.0 FR',
    credit: 'Tatoeba contributors',
    home: 'https://tatoeba.org/'
  },
  tatoebaCmn: {
    url: 'https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2',
    file: 'tatoeba-cmn_sentences.tsv.bz2'
  },
  tomoshi: {
    url: 'https://github.com/tomoshi-app/tomoshi-dict-data/releases/download/v2026-09-02/tomoshi-dict-open.db.zst',
    file: 'tomoshi-dict-open-v2026-09-02.db.zst',
    name: 'Tomoshi 开放数据：中文释义、例句中文翻译、中日同形词对照、汉字中文字义、自他动词配对（机器翻译后经模型复核）',
    license: 'CC BY-SA 4.0',
    credit: 'Y1Z（tomoshi-app/tomoshi-dict-data）',
    home: 'https://github.com/tomoshi-app/tomoshi-dict-data'
  },
  // 下面两份不在这里下载（kuromoji 是 npm 依赖，文章由 articles-ja.mjs 取），只为在「关于」里署名
  kuromoji: {
    name: '阅读器的分词与读音：kuromoji.js 及其附带的 IPADIC 词典',
    license: 'Apache 2.0（kuromoji.js）；IPADIC 许可（词典）',
    credit: 'Takuya Asano; NAIST（IPADIC）',
    home: 'https://github.com/takuyaa/kuromoji.js'
  },
  aozora: {
    name: '内置文章：青空文库的公有领域作品（文末附底本与输入、校对者信息）',
    license: '公有领域',
    credit: '青空文库及各篇的输入、校对者',
    home: 'https://www.aozora.gr.jp/'
  }
}

/** zstd 压缩的 SQLite 解到缓存目录（Node 22.15 起自带 zstd） */
export async function unzstd(path) {
  const out = path.replace(/\.zst$/, '')
  if (existsSync(out) && statSync(out).size > 0) return out
  const { createZstdDecompress } = await import('node:zlib')
  const { createReadStream } = await import('node:fs')
  process.stdout.write(`解压 ${path.split(/[\\/]/).pop()} … `)
  await pipeline(createReadStream(path), createZstdDecompress(), createWriteStream(out + '.part'))
  renameSync(out + '.part', out)
  console.log(`${(statSync(out).size / 1e6).toFixed(0)} MB`)
  return out
}

export async function download(url, file) {
  mkdirSync(cacheDir, { recursive: true })
  const dest = join(cacheDir, file)
  if (existsSync(dest) && statSync(dest).size > 0) return dest
  process.stdout.write(`下载 ${file} … `)
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest + '.part'))
  renameSync(dest + '.part', dest)
  console.log(`${(statSync(dest).size / 1e6).toFixed(1)} MB`)
  return dest
}

/** zip 里唯一（或第一个）文件的文字内容 */
export function readZipText(path) {
  const files = unzipSync(readFileSync(path))
  const name = Object.keys(files)[0]
  return strFromU8(files[name])
}

export function readGzipText(path) {
  return strFromU8(gunzipSync(readFileSync(path)))
}

export function readBz2Text(path) {
  return Bunzip.decode(readFileSync(path)).toString('utf8')
}

export async function fetchAll() {
  const s = SOURCES
  const out = {}
  for (const key of ['jmdict', 'kanjidic', 'kanjivg', 'kanjiLevels', 'tatoebaLinks', 'tatoebaCmn'])
    out[key] = await download(s[key].url, s[key].file)
  out.tomoshi = await unzstd(await download(s.tomoshi.url, s.tomoshi.file))
  out.jlpt = []
  for (let i = 0; i < s.jlpt.urls.length; i++)
    out.jlpt.push(await download(s.jlpt.urls[i], s.jlpt.files[i]))
  return out
}
