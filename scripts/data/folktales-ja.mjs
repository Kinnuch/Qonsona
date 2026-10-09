#!/usr/bin/env node
/**
 * 民间故事课的课文：从青空文库下载楠山正雄整理的日本昔話（桃太郎、浦島太郎……十四篇），转成纯文本，
 * 写进 data/ja/folktales.json（这份入库）。课程界面另外做，这里只出数据。
 *
 * 为什么是公有领域：这几篇都是楠山正雄（1884–1950）写的。他 1950 年 11 月 26 日去世，按当时日本著作权法
 * 「死后 50 年，算到那年年底」，2000 年底著作权就消灭了；2018 年 12 月 30 日改成「死后 70 年」，只延长当时
 * 还在保护期内的（1968 年以后去世的作者），已经消灭的不会恢复。青空文库的图书卡上也没有「＊著作権存続＊」
 * （还在保护期的作品有这一行红字），作品目录里著作权一栏是「なし」。故事本身是民间流传的昔話。
 *
 * 只收「新字新仮名」的版本（旧仮名的不要），篇幅 1,000～8,000 字左右（「鉢かつぎ」八千八百多字，没收）。
 * 青空文库没有公有领域的新字新仮名「鶴の恩返し」（林芙美子的「鶴の笛」是创作童话，不是这个故事），也没收。
 * 「かちかち山」（图书卡 18377）有狸杀了老婆婆、做成「ばばあ汁」给老爷爷吃的情节，对学习软件太重，不收。
 *
 * 清理跟内置文章一样，用 articles-ja.mjs 的 parseAozora（import 它不会跑那边的下载）：注音（《》、｜）与
 * 注记（［＃…］）去掉，外字照那边的表换成字，认不得的写成 〓 并在最后报出来；文末的底本与输入、校对信息
 * 原样留在 colophon 里；chars 跟内置文章一个算法，是正文的长度（换行也算）。
 *
 * 用法：node scripts/data/folktales-ja.mjs
 * 之后跑 npm run data:levels，把每篇的难度（level：5 = N5 … 1 = N1）写进去。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import { parseAozora } from './articles-ja.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const out = join(root, 'data/ja/folktales.json')

/** 楠山正雄：作家目录与作者名（文本第二行写的就是这样） */
const KUSUYAMA = { dir: '000329', author: '楠山正雄' }

/**
 * 作品：青空文库的作家目录、图书卡编号、zip 文件名、标题、作者。2026-10-08 逐篇打开图书卡
 * （https://www.aozora.gr.jp/cards/<dir>/card<card>.html）核对过：
 * - 作者都是楠山正雄（作家目录 000329，生年 1884-11-04，没年 1950-11-26）；
 * - 图书卡上都没有「＊著作権存続＊」，著作权已消灭；
 * - 文字遣い種別都是「新字新仮名」；
 * - zip 是「テキストファイル(ルビあり)」那一个（这几篇都只有这一个 zip）。
 * 下载后核对标题与作者，对不上就停下。
 */
const WORKS = [
  { ...KUSUYAMA, card: 18376, zip: '18376_ruby_12074.zip', title: '桃太郎' },
  { ...KUSUYAMA, card: 3390, zip: '3390_ruby_6090.zip', title: '浦島太郎' },
  { ...KUSUYAMA, card: 43457, zip: '43457_ruby_23696.zip', title: '一寸法師' },
  { ...KUSUYAMA, card: 18337, zip: '18337_ruby_11924.zip', title: '金太郎' },
  { ...KUSUYAMA, card: 18334, zip: '18334_ruby_11929.zip', title: '猿かに合戦' },
  { ...KUSUYAMA, card: 18378, zip: '18378_ruby_12072.zip', title: '舌切りすずめ' },
  { ...KUSUYAMA, card: 3391, zip: '3391_ruby.zip', title: '花咲かじじい' },
  // こぶとりじいさん
  { ...KUSUYAMA, card: 43461, zip: '43461_ruby_23698.zip', title: '瘤とり' },
  { ...KUSUYAMA, card: 18336, zip: '18336_ruby_11922.zip', title: '文福茶がま' },
  { ...KUSUYAMA, card: 18335, zip: '18335_ruby_11926.zip', title: 'ねずみの嫁入り' },
  // わらしべ長者
  { ...KUSUYAMA, card: 43458, zip: '43458_ruby_23697.zip', title: '一本のわら' },
  // くらげ骨なし（猿の生き肝）
  { ...KUSUYAMA, card: 18379, zip: '18379_ruby_12073.zip', title: 'くらげのお使い' },
  // 大工と鬼六
  { ...KUSUYAMA, card: 18389, zip: '18389_ruby_11927.zip', title: '鬼六' },
  { ...KUSUYAMA, card: 33214, zip: '33214_ruby_14592.zip', title: '松山鏡' }
]

const sjis = new TextDecoder('shift_jis')

/** 清理之后不该再有的青空文库记号：注音、注记、くの字点（／＼、／″＼）；有就是清理规则要补 */
const LEFTOVER = /[《》｜［］＃]|／″?＼/

/** 下载一个文件：每次最多等一分钟，连不上重试两次；HTTP 出错（多半是 zip 改了名）不重试 */
async function download(url) {
  for (let tries = 1; ; tries++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { final: true })
      return new Uint8Array(await res.arrayBuffer())
    } catch (e) {
      if (e.final || tries >= 3) throw new Error(`${url}：${e.message}（zip 改名的话看图书卡）`)
      console.warn(`${url}：${e.message}，重试`)
    }
  }
}

/** 本地日期 YYYY-MM-DD */
function today() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function main() {
  const tales = []
  const problems = []
  for (const w of WORKS) {
    const url = `https://www.aozora.gr.jp/cards/${w.dir}/files/${w.zip}`
    const files = unzipSync(await download(url))
    const name = Object.keys(files).find((n) => n.toLowerCase().endsWith('.txt'))
    if (!name) throw new Error(`${url}：zip 里没有 txt`)
    const raw = sjis.decode(files[name])
    const t = parseAozora(raw)
    if (t.title !== w.title || t.author !== w.author)
      throw new Error(
        `${url}：下载到的是「${t.title}」${t.author}，作品表里写的是「${w.title}」${w.author}`
      )
    const left = t.body.match(LEFTOVER)
    if (left) throw new Error(`「${t.title}」正文里还留着「${left[0]}」：清理规则要补`)
    if (t.gaiji) {
      // 认不得的外字写成了 〓：报出原来的注记，好补进 articles-ja.mjs 的外字表
      const notes = raw.match(/※［＃[^］]*］/g) ?? []
      problems.push(`「${t.title}」有 ${t.gaiji} 处外字认不得，写成了 〓：${notes.join(' ')}`)
    }
    if (t.body.length < 1000 || t.body.length > 8000)
      problems.push(`「${t.title}」${t.body.length} 字，不在 1,000～8,000 字之间`)
    tales.push({
      id: `aozora-${w.card}`,
      title: t.title,
      author: t.author,
      url: `https://www.aozora.gr.jp/cards/${w.dir}/card${w.card}.html`,
      colophon: t.colophon,
      body: t.body,
      chars: t.body.length
    })
    console.log(`${t.title} / ${t.author}：${t.body.length} 字`)
  }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify({ generated: today(), tales }, null, 1) + '\n')
  console.log(`写好 ${out}（${tales.length} 篇）；接着跑 npm run data:levels 算难度`)
  for (const p of problems) console.warn(`注意：${p}`)
}

await main()
