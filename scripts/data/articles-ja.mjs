#!/usr/bin/env node
/**
 * 内置文章：从青空文库下载几篇公有领域的短篇，转成纯文本，写进 data/ja/articles.json（这份入库）。
 *
 * 青空文库的文字是 Shift_JIS，带注音记号（｜漢字《かんじ》）和注记（［＃…］）：
 * 注音与注记去掉（阅读器自己配振假名），文末的底本与输入、校对信息原样留在 colophon 里。
 *
 * 用法：node scripts/data/articles-ja.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const out = join(root, 'data/ja/articles.json')

/** 作品：青空文库的作家目录、图书卡编号、zip 文件名（图书卡页面上的链接） */
const WORKS = [
  { dir: '000121', card: 628, zip: '628_ruby_649.zip', topic: 'story' },
  { dir: '000121', card: 637, zip: '637_ruby_4095.zip', topic: 'story' },
  { dir: '000081', card: 43754, zip: '43754_ruby_17594.zip', topic: 'story' },
  { dir: '000081', card: 45630, zip: '45630_txt_23610.zip', topic: 'poem' },
  { dir: '000081', card: 473, zip: '473_ruby_467.zip', topic: 'story' },
  { dir: '000879', card: 92, zip: '92_ruby_164.zip', topic: 'story' },
  { dir: '000879', card: 170, zip: '170_ruby_348.zip', topic: 'story' },
  { dir: '000035', card: 1567, zip: '1567_ruby_4948.zip', topic: 'story' }
]

const sjis = new TextDecoder('shift_jis')

/** 用到的外字（JIS X 0213 面-区-点 → 字）：蜘蛛の糸 的「犍陀多」 */
const GAIJI = { '1-87-71': '犍' }

/**
 * 外字注记换成字：认得的按表换；「「蔭」の…に代えて…」这类异体写成原字；别的写成 〓
 */
function gaijiChar(note) {
  const code = note.match(/第[34]水準(\d-\d+-\d+)/)?.[1]
  if (code && GAIJI[code]) return GAIJI[code]
  const variant = note.match(/^※［＃「「(.)」の/)?.[1]
  return variant ?? '〓'
}

/** 青空文库格式 → 标题、作者、正文、文末信息 */
export function parseAozora(raw) {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const title = lines[0].trim()
  const author = lines[1].trim()
  let i = 2
  // 开头的「【テキスト中に現れる記号について】」一段，夹在两行横线之间
  const rule = /^-{20,}\s*$/
  const firstRule = lines.findIndex((l, k) => k >= i && rule.test(l))
  if (firstRule >= 0 && firstRule < 20) {
    const second = lines.findIndex((l, k) => k > firstRule && rule.test(l))
    i = second + 1
  }
  const footerAt = lines.findIndex((l, k) => k >= i && /^底本：/.test(l))
  const bodyLines = lines.slice(i, footerAt < 0 ? undefined : footerAt)
  const colophon = footerAt < 0 ? '' : lines.slice(footerAt).join('\n').trim()
  let gaiji = 0
  const body = bodyLines
    .map((l) =>
      l
        // 外字注记（※［＃「…」、第3水準…］）换成字，见 gaijiChar
        .replace(/※［＃[^］]*］/g, (note) => {
          const ch = gaijiChar(note)
          if (ch === '〓') gaiji++
          return ch
        })
        .replace(/［＃[^］]*］/g, '')
        .replace(/《[^》]*》/g, '')
        .replace(/｜/g, '')
        .replace(/^[\u3000 ]+/, '')
        .trimEnd()
    )
    .join('\n')
    // 连续的空行并成一行
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { title, author, body, colophon, gaiji }
}

async function main() {
  const articles = []
  for (const w of WORKS) {
    const url = `https://www.aozora.gr.jp/cards/${w.dir}/files/${w.zip}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url}: ${res.status}`)
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
    const name = Object.keys(files).find((n) => n.toLowerCase().endsWith('.txt'))
    if (!name) throw new Error(`${url}: zip 里没有 txt`)
    const a = parseAozora(sjis.decode(files[name]))
    articles.push({
      id: `aozora-${w.card}`,
      source: 'aozora',
      topic: w.topic,
      title: a.title,
      author: a.author,
      url: `https://www.aozora.gr.jp/cards/${w.dir}/card${w.card}.html`,
      colophon: a.colophon,
      body: a.body,
      chars: a.body.length
    })
    console.log(
      `${a.title} / ${a.author}：${a.body.length} 字${a.gaiji ? `，外字 ${a.gaiji} 处` : ''}`
    )
  }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(articles, null, 1) + '\n')
  console.log(`写好 ${out}（${articles.length} 篇）`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
