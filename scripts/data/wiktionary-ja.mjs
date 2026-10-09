#!/usr/bin/env node
/**
 * 生成 resources/data/ja/wikt.sqlite（不入库）：维基词典里人写的释义，对到 JMdict 词条上，词典里分两栏显示——
 *   「日日词典」：日语维基词典（ja.wiktionary.org）「日本語」词条的日语释义；
 *   「维基词典（中文）」：中文维基词典（zh.wiktionary.org）「日语 / 日語」词条的中文释义。
 *
 * 来源与许可：维基词典的文字按 CC BY-SA 发布（现行 4.0，早先的修订是 3.0），署名「Wiktionary 贡献者」；
 * 机器可读的数据由 kaikki.org 用 wiktextract（Tatu Ylonen）从维基词典的 dump 抽取，许可跟原文一样。
 * 用的是 kaikki.org 上按语言分好的 JSONL（日本語 / 日语 / 日語，合计四十来 MB）；kaikki 说这几份以后要下架，
 * 下架了就改下整份的 raw-wiktextract-data.jsonl.gz（日文版 65 MB、中文版 234 MB），按 lang_code = ja 筛。
 * 下载的文件放 .cache/data/kaikki-*（不入库），已经下好的跳过；要换新版，删掉它们再跑。
 * kaikki.org 从国内连接很慢，所以分段并行下载，断了重跑会接着下。
 *
 * 对词（对到 dict.sqlite 的 JMdict 词条，对不上的不收）：
 *   汉字词头：写法在 form 表里、读音在这个词条的假名写法里的算对上；对上几个时先看词性合不合，再取 score 高的。
 *     没写读音的，写法只对上一个词条（或者只有一个常用词条）才算。单字页按「（ゆえ）」这样的读音注分段对。
 *   假名词头：列了汉字写法的按汉字写法对；日文版常用词的释义多写在假名页（とる、たつ），汉字页只写
 *     「とるの漢字表記」，就拿这些汉字页当候选，再按词性、释义里提到的汉字分给各个同音词（见 Matcher）；
 *     都没有的按假名本身对（同音词多时只认平常写假名的词条）。
 * 清理：去掉模板、链接、粗斜体等维基标记残留；转引（「〜の異体字」「を見よ」「…的舊字體形式」）、
 *   只有读音或写法的条目不当释义；中文版从日汉辞典导入的条目（「詞【よみ】⏎名·他サ⏎1. …」）拆出读音、
 *   词性、义项和例句。语体标记（俗語、古語……）加在释义前面。
 *
 * 用法：node scripts/data/wiktionary-ja.mjs
 * （要先有 resources/data/ja/dict.sqlite：npm run data:ja）
 */
import {
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { createGunzip, inflateRawSync } from 'node:zlib'
import { DatabaseSync } from 'node:sqlite'
import { cacheDir, root } from './sources.mjs'

const DICT = join(root, 'resources/data/ja/dict.sqlite')
const OUT = join(root, 'resources/data/ja/wikt.sqlite')

/** 每个义项最多带几句例句、例句最长多少字（太长的文学引文不适合学习者） */
const MAX_EXAMPLES = 2
const MAX_EXAMPLE_LEN = 80
/** 同一个词条、同一个来源最多收多少条释义 */
const MAX_SENSES = 40

// ───────────────────────── 来源 ─────────────────────────

const kaikkiLang = (edition, lang) =>
  `https://kaikki.org/${edition}/${encodeURIComponent(lang)}/kaikki.org-dictionary-${encodeURIComponent(lang)}.jsonl.gz`

export const EDITIONS = {
  ja: {
    edition: 'jawiktionary',
    name: '日日词典：日语维基词典「日本語」词条的释义（kaikki.org 用 wiktextract 抽取）',
    license: 'CC BY-SA 4.0 / 3.0',
    credit: 'Wiktionary 贡献者（ja.wiktionary.org）；kaikki.org / wiktextract（Tatu Ylonen）',
    home: 'https://ja.wiktionary.org/',
    page: 'https://kaikki.org/jawiktionary/rawdata.html',
    parts: [{ url: kaikkiLang('jawiktionary', '日本語'), file: 'kaikki-jawiktionary-ja.jsonl.gz' }],
    raw: {
      url: 'https://kaikki.org/jawiktionary/raw-wiktextract-data.jsonl.gz',
      file: 'kaikki-jawiktionary-raw.jsonl.gz'
    }
  },
  zh: {
    edition: 'zhwiktionary',
    name: '维基词典（中文）：中文维基词典「日语」词条的释义（kaikki.org 用 wiktextract 抽取）',
    license: 'CC BY-SA 4.0 / 3.0',
    credit: 'Wiktionary 贡献者（zh.wiktionary.org）；kaikki.org / wiktextract（Tatu Ylonen）',
    home: 'https://zh.wiktionary.org/',
    page: 'https://kaikki.org/zhwiktionary/rawdata.html',
    parts: [
      { url: kaikkiLang('zhwiktionary', '日语'), file: 'kaikki-zhwiktionary-ja-hans.jsonl.gz' },
      { url: kaikkiLang('zhwiktionary', '日語'), file: 'kaikki-zhwiktionary-ja-hant.jsonl.gz' }
    ],
    raw: {
      url: 'https://kaikki.org/zhwiktionary/raw-wiktextract-data.jsonl.gz',
      file: 'kaikki-zhwiktionary-raw.jsonl.gz'
    }
  }
}

// ───────────────────────── 下载 ─────────────────────────

/** 同时开几个连接、每段多大、多久没收到数据就重连 */
const PARALLEL = 16
const CHUNK = 1 << 20
const STALL = 30_000

const downloaded = (path) => existsSync(path) && statSync(path).size > 0

/** 下一段 [start, end]：收到的先写进 .tmp，断了从断处接着要，收齐了改名 */
async function fetchRange(url, start, end, path, etag, onBytes) {
  const tmp = path + '.tmp'
  for (let attempt = 1; ; attempt++) {
    const have = existsSync(tmp) ? statSync(tmp).size : 0
    if (start + have > end) break
    const ctrl = new AbortController()
    let timer
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => ctrl.abort(), STALL)
    }
    const out = createWriteStream(tmp, { flags: 'a' })
    try {
      arm()
      const res = await fetch(url, {
        headers: { Range: `bytes=${start + have}-${end}`, ...(etag && { 'If-Range': etag }) },
        signal: ctrl.signal
      })
      if (res.status === 200 || (etag && res.headers.get('etag') !== etag)) {
        await res.body?.cancel()
        throw Object.assign(new Error('服务器上的文件刚更新过，重跑一次即可（会从头下新版）'), {
          fatal: true
        })
      }
      if (res.status !== 206) throw new Error(`HTTP ${res.status}`)
      for await (const c of res.body) {
        arm()
        out.write(c)
        onBytes(c.length)
      }
    } catch (e) {
      if (e.fatal || attempt >= 30) throw e
      await sleep(Math.min(attempt, 5) * 2000)
    } finally {
      clearTimeout(timer)
      await new Promise((r) => out.end(r))
    }
  }
  if (statSync(tmp).size !== end - start + 1) throw new Error(`${path} 大小不对`)
  renameSync(tmp, path)
}

/** 分段并行下载到 .cache/data/<file>，旁边写一份 <file>.json 记下载地址、dump 日期 */
async function download(url, file, info) {
  mkdirSync(cacheDir, { recursive: true })
  const dest = join(cacheDir, file)
  if (downloaded(dest)) return dest
  const head = await fetch(url, { method: 'HEAD', redirect: 'follow' })
  if (!head.ok)
    throw Object.assign(new Error(`${url} → HTTP ${head.status}`), { status: head.status })
  const total = Number(head.headers.get('content-length'))
  const etag = head.headers.get('etag') ?? ''
  // 没下完的分段放 <file>.parts/；服务器上的文件换了（etag 不同）或分段大小改了就作废重下
  const parts = dest + '.parts'
  const tagFile = join(parts, 'etag')
  const tag = `${etag} ${CHUNK}`
  if (existsSync(parts) && (!existsSync(tagFile) || readFileSync(tagFile, 'utf8') !== tag))
    rmSync(parts, { recursive: true })
  mkdirSync(parts, { recursive: true })
  writeFileSync(tagFile, tag)
  const n = Math.ceil(total / CHUNK)
  const todo = []
  let got = 0
  for (let i = 0; i < n; i++) {
    const p = join(parts, String(i))
    if (existsSync(p)) got += statSync(p).size
    else {
      if (existsSync(p + '.tmp')) got += statSync(p + '.tmp').size
      todo.push(i)
    }
  }
  process.stdout.write(`下载 ${file}（${(total / 1e6).toFixed(1)} MB）… `)
  const t0 = Date.now()
  const got0 = got
  let shown = got
  const onBytes = (b) => {
    got += b
    if (got - shown >= total / 10) {
      shown = got
      const kbps = ((got - got0) / 1024 / ((Date.now() - t0) / 1000)).toFixed(0)
      process.stdout.write(`${Math.round((got / total) * 100)}%(${kbps} KB/s) `)
    }
  }
  const worker = async () => {
    while (todo.length) {
      const i = todo.shift()
      const end = Math.min(total, (i + 1) * CHUNK) - 1
      await fetchRange(url, i * CHUNK, end, join(parts, String(i)), etag, onBytes)
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker))
  const fd = openSync(dest + '.part', 'w')
  for (let i = 0; i < n; i++) writeSync(fd, readFileSync(join(parts, String(i))))
  closeSync(fd)
  if (statSync(dest + '.part').size !== total) throw new Error(`${file} 拼起来大小不对`)
  renameSync(dest + '.part', dest)
  rmSync(parts, { recursive: true })
  const side = {
    url,
    ...info,
    etag,
    lastModified: head.headers.get('last-modified'),
    downloadedAt: new Date().toISOString()
  }
  writeFileSync(sidecar(dest), JSON.stringify(side, null, 2) + '\n')
  console.log('完成')
  return dest
}

const sidecar = (path) => path.replace(/\.jsonl\.gz$/, '.json')

/** kaikki 说明页上写的 dump 日期、抽取日期 */
async function dumpInfo(page) {
  try {
    const html = await (await fetch(page)).text()
    return {
      dump: /dump<\/a>\s*dated (\d{4}-\d{2}-\d{2})/.exec(html)?.[1] ?? null,
      extracted: /extracted on (\d{4}-\d{2}-\d{2})/.exec(html)?.[1] ?? null
    }
  } catch {
    return {}
  }
}

/** 一个版本的数据文件：先用按语言分好的，没有了（404）再下整份 */
async function fetchEdition(ed) {
  const parts = ed.parts.map((p) => join(cacheDir, p.file))
  if (parts.every(downloaded)) return parts
  const rawFile = join(cacheDir, ed.raw.file)
  if (downloaded(rawFile)) return [rawFile]
  const info = await dumpInfo(ed.page)
  try {
    for (const p of ed.parts) await download(p.url, p.file, info)
    return parts
  } catch (e) {
    if (e.status !== 404) throw e
    console.log(`kaikki.org 上按语言分好的文件没有了，改下 ${ed.edition} 的整份数据（大得多）`)
    await download(ed.raw.url, ed.raw.file, info)
    return [rawFile]
  }
}

/** 一行一个词条的 JSONL（.gz 或不压缩），只给日语（lang_code = ja）的 */
export async function* readRecords(files) {
  for (const file of files) {
    let stream = createReadStream(file)
    if (file.endsWith('.gz')) stream = stream.pipe(createGunzip())
    for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
      // 整份数据里大半是别的语言，先粗筛再解析
      if (!line.includes('"lang_code": "ja"') && !line.includes('"lang_code":"ja"')) continue
      let o
      try {
        o = JSON.parse(line)
      } catch {
        continue
      }
      if (o.lang_code === 'ja') yield o
    }
  }
}

// ───────────────────────── 文字 ─────────────────────────

const KANA_WORD = /^[\u3041-\u3096ゝゞ\u30a1-\u30faーヽヾ・]+$/
const isKana = (s) => KANA_WORD.test(s)
const hasKana = (s) => /[\u3041-\u3096\u30a1-\u30fa]/.test(s)
const hasHan = (s) => /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々〆ヶ\u{20000}-\u{3134f}]/u.test(s)
const toHira = (s) =>
  s.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
/** 读音：去掉送假名分隔（あお-い）、空格、点，剩下全是假名才算 */
const asReading = (s) => {
  const r = String(s ?? '').replace(/[\s\-‐.．・]/g, '')
  return r && isKana(r) ? r : null
}
/** 记一个读音。名词的サ变动词段读音写成「けんさくする」，去掉「する」的也算 */
function addReading(set, word, r) {
  if (!r) return
  set.add(r)
  if (r.length > 2 && r.endsWith('する') && !word.endsWith('する')) set.add(r.slice(0, -2))
}

/** 记汉字写法：「虫干し・虫干」拆开；「飲（み）逃げ」带不带括号里的都算；「一通りする」去掉「する」 */
function addWritings(set, word, form) {
  for (const part of String(form ?? '').split(/[・、,，]/)) {
    const w = part.trim()
    if (!hasHan(w)) continue
    const paren = /[（(]([^）)]*)[）)]/g
    for (const v of paren.test(w) ? [w.replace(paren, '$1'), w.replace(paren, '')] : [w]) {
      set.add(v)
      if (v.length > 2 && v.endsWith('する') && !word.endsWith('する')) set.add(v.slice(0, -2))
    }
  }
}

/** 去掉日文里的引号内容（「」『』【】里的假名不算句子本身的） */
const unquoted = (s) => s.replace(/「[^」]*」|『[^』]*』|【[^】]*】/g, '')

/** 维基的标记残留：模板、链接、粗斜体、HTML、维基百科链接角标（⁽ʷᵖ⁾） */
function tidy(s) {
  return String(s ?? '')
    .replace(/⁽[^⁾]*⁾/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[\s\u3000]+/g, ' ')
    .replace(/ ?([、。，．：；！？」』）】]) ?/g, '$1')
    .replace(/ ?([「『（【]) /g, ' $1')
    .trim()
}

/** 词头后面的罗马字注音：補助動詞 (hojo dōshi) → 補助動詞；後唐 (Kōtō，“后唐”) → 後唐（后唐） */
const ROMAJI =
  /(?<=[\u3041-\u30ff\u3400-\u9fff々])\s?\(([A-Za-z\u00c0-\u024f'’\- ]+?)(?:，“([^”]*)”)?\)/g

function cleanZh(s) {
  return tidy(
    String(s ?? '')
      .replace(/={2,}\s*日[语語]\s*={2,}/g, ' ')
      .replace(/[(（]\s*可否[驗验][證证]此[條条][釋释]義?[?？]?\s*[)）]/g, '')
  )
    .replace(ROMAJI, (_, _r, g) => (g ? `（${g}）` : ''))
    .trim()
}

const cleanJa = (s) => tidy(s)

/** 几个 gloss（上级义项 + 本义项）接成一句 */
function joinGlosses(gs) {
  let out = ''
  for (const g of gs) {
    if (!g) continue
    if (!out) out = g
    else if (!out.endsWith(g)) out += (/[。．：:；;！？!?）)」』】]$/.test(out) ? '' : '：') + g
  }
  return out
}

/**
 * 下级义项的 glosses 是 [上级, …, 本级]：上级第一次出现时接在一起（属格助词：表示所有），
 * 同一条记录里已经出现过的上级不再重复，只留本级
 */
function senseText(gs, shown) {
  const parent = joinGlosses(gs.slice(0, -1))
  const text = gs.length > 1 && shown.has(parent) ? gs.at(-1) : joinGlosses(gs)
  shown.add(gs.length > 1 ? parent : gs[0])
  return text
}

/** 义项开头的读音注：（ゆえ）、（ホン、ボン、ポン）、(にっぽん、にほん) */
const READING_NOTE = /^[（(]([\u3041-\u30faー、・,，\s]+)[）)]\s*/

/** 只是转去别的词条的义项（异体字、旧字体、「見よ」……），不是释义 */
const JA_REDIRECT =
  /^(?:[→⇒☞＝=]|(?:「[^」]+」|[^、。]{1,20})?を(?:参照|見よ))|(?:の(?:異体字|旧字体|新字体|俗字|略字|本字|古字|正字|別表記|異表記|別字|別体|表記揺れ|表記ゆれ|誤記|誤字|漢字表記|仮名表記|ひらがな表記|カタカナ表記|旧表記|歴史的仮名遣い|旧仮名遣い|異形|活用形|連用形|未然形|終止形|連体形|已然形|仮定形|命令形|音便形?|語幹)(?:の一つ)?|に同じ|を(?:参照|見よ)|参照)[。．]?$/
const ZH_REDIRECT =
  /^(?:[→⇒☞]|(?:参见|參見|参看|參看)|(?:见|見)\s*[「“『\u3041-\u30ff]|同上[。.]?$|【[^】]*】[。.]?$)|的(?:舊字體|旧字体|新字體|新字体|異體字|异体字|異體|异体|另一種寫法|另一种写法|另一種拼寫|另一种拼写|另一種形式|另一种形式|罗马字转写|羅馬字轉寫|罗马化|羅馬化|假名寫法|假名写法|平假名寫法|平假名写法|片假名寫法|片假名写法|漢字寫法|汉字写法|(?:不规则|不規則)?(?:读音|讀音|读法|讀法))(?:形式)?[。.]?$/

/** 义项的语体等标记（wiktextract 的 tags）→ 日文版、中文版里的说法，加在释义前面：〔俗語〕… */
const LABELS = {
  slang: ['俗語', '俚语'],
  vulgar: ['卑語', '粗俗'],
  offensive: ['侮蔑語', '冒犯'],
  derogatory: ['軽蔑', '贬义'],
  dated: ['古風', '旧时'],
  archaic: ['古語', '古语'],
  obsolete: ['廃語', '已废弃'],
  historical: ['歴史', '历史'],
  literary: ['文語', '书面语'],
  poetic: ['雅語', '诗歌用语'],
  figuratively: ['比喩', '比喻'],
  Internet: ['ネット用語', '网络用语'],
  colloquial: ['口語', '口语'],
  informal: ['くだけた言い方', '非正式'],
  dialectal: ['方言', '方言'],
  childish: ['幼児語', '儿语'],
  humorous: ['おどけて', '幽默'],
  euphemistic: ['婉曲', '委婉'],
  rare: ['まれ', '罕用'],
  uncommon: ['まれ', '不常用'],
  honorific: ['尊敬語', '敬语'],
  humble: ['謙譲語', '谦让语'],
  polite: ['丁寧語', '礼貌语'],
  transitive: ['他動詞', '他动词'],
  intransitive: ['自動詞', '自动词']
}
/**
 * 释义前的标记。中文版的 raw_tags 是页面上括号里的说明（化學、延伸、古典日語……），一并加上；
 * 日文版的 raw_tags 多是分类（職業、夏の季語……），不加
 */
function labelOf(s, src) {
  const out = new Set((s.tags ?? []).map((t) => LABELS[t]?.[src === 'ja' ? 0 : 1]).filter(Boolean))
  if (src === 'zh')
    for (const t of s.raw_tags ?? []) {
      const c = String(t).replace(/[；;，,。、\s]+$/, '')
      if (c && c.length <= 8 && out.size < 3) out.add(c)
    }
  return out.size ? `〔${[...out].join(src === 'ja' ? '・' : '、')}〕` : ''
}

/** 专有名词里只说「姓氏」「女性人名」「地名」的义项：对到普通词上没意思 */
const NAME_ONLY =
  /^(?:日本人?の)?(?:姓|苗字|名字|人名|地名|男性の名|女性の名|男性名|女性名|日本の地名|姓氏|人名|地名|男性人名|女性人名|男性用名|女性用名|地名用字|日本姓氏)(?:の一つ|之一)?[。.]?$/

// ───────────────────────── 词性 ─────────────────────────

/** wiktextract 的词性 → JMdict 的哪些词性算合得上（对词时优先选词性合得上的词条） */
const POS_FITS = {
  noun: (p) => p === 'n' || p.startsWith('n-') || p === 'pn' || p === 'adj-no' || p === 'vs',
  name: (p) => p === 'n' || p.startsWith('n-'),
  verb: (p) => p.startsWith('v') || p.startsWith('aux'),
  adj: (p) => /^adj-(?:i|ix|ku|shiku)$/.test(p),
  adj_noun: (p) => /^adj-(?:na|nari|t)$/.test(p),
  adv: (p) => p.startsWith('adv'),
  adnominal: (p) => p === 'adj-pn' || p === 'adj-f',
  particle: (p) => p === 'prt',
  conj: (p) => p === 'conj',
  intj: (p) => p === 'int',
  pron: (p) => p === 'pn',
  prefix: (p) => p === 'pref' || p === 'n-pref',
  suffix: (p) => p === 'suf' || p === 'n-suf' || p === 'ctr',
  counter: (p) => p === 'ctr',
  classifier: (p) => p === 'ctr',
  num: (p) => p === 'num',
  phrase: (p) => p === 'exp',
  proverb: (p) => p === 'exp',
  idiom: (p) => p === 'exp'
}

/** 中文版的词性名：wiktextract 的代码 → 简体 */
const ZH_POS = {
  noun: '名词',
  verb: '动词',
  adj: '形容词',
  adj_noun: '形容动词',
  adv: '副词',
  pron: '代词',
  name: '专有名词',
  intj: '感叹词',
  particle: '助词',
  conj: '连词',
  classifier: '量词',
  counter: '量词',
  num: '数词',
  suffix: '后缀',
  prefix: '前缀',
  affix: '词缀',
  phrase: '短语',
  proverb: '谚语',
  idiom: '成语',
  adnominal: '连体词',
  contraction: '缩约形',
  abbrev: '缩写'
}
/** 词性名里常见的繁体字 → 简体（只为词性名，释义本身不转） */
const T2S = Object.fromEntries(
  ['詞词', '動动', '專专', '嘆叹', '歎叹', '連连', '數数', '後后', '綴缀', '語语', '諺谚', '慣惯']
    .concat([
      '體体',
      '擬拟',
      '聲声',
      '縮缩',
      '寫写',
      '頭头',
      '結结',
      '構构',
      '類类',
      '屬属',
      '稱称'
    ])
    .concat([
      '輔辅',
      '單单',
      '複复',
      '變变',
      '態态',
      '縮缩',
      '簡简',
      '異异',
      '號号',
      '標标',
      '點点'
    ])
    .map((p) => [p[0], p[1]])
)
const simplify = (s) => [...s].map((c) => T2S[c] ?? c).join('')

/**
 * 日汉辞典式的词性标记（名·他サ、自五、形动……），在导入的条目开头。
 * 原文里「·」有时坏成了「?」，一并改回来
 */
const POS_TOKEN =
  '(?:名|代|副|形動|形动|形容|形|連体|连体|接頭|接头|接尾|接続|接续|接|感|慣|惯|助動|助动|助|(?:自他|自|他) ?(?:五|サ|カ|上一|下一|一)|補動五|补动五)'
const POS_SEQ = `${POS_TOKEN}(?: ?[·・?？、] ?${POS_TOKEN})*`
const POS_BRACKETED = new RegExp(`^[\\[［(（] ?[·・?？]? ?(${POS_SEQ}) ?[\\]］)）] ?`)
const POS_BARE = new RegExp(`^[·・?？]?(${POS_SEQ})(?: |$)`)

function takePosLabel(s) {
  const m = POS_BRACKETED.exec(s) ?? POS_BARE.exec(s)
  if (!m) return null
  return {
    pos: m[1].replace(/ /g, '').replace(/[?？、・]/g, '·'),
    rest: s.slice(m[0].length).trim()
  }
}

// ───────────────────────── 例句 ─────────────────────────

/**
 * 导入的条目把例句里的「～」换成了整个词头，变形的地方就坏了（倒れるれた、見込むまれた）。
 * 词头后面紧跟着本该接在词干上的活用词尾的，认作坏句子
 */
const KANA_ROWS = [
  'あいうえお',
  'かきくけこ',
  'がぎぐげご',
  'さしすせそ',
  'ざじずぜぞ',
  'たちつてと'
]
  .concat(['だぢづでど', 'なにぬねの', 'はひふへほ', 'ばびぶべぼ', 'ぱぴぷぺぽ', 'まみむめも'])
  .concat(['らりるれろ', 'わいうえお'])
const ENDING = /^(?:ない|なかっ|なけれ|ず|ぬ|れ|せ|さ|ま[すしせ]|た|だ|て|で|ば|う|よう|ろ|る)/
function brokenSubstitution(word, ja) {
  const okuri = /[\u3041-\u3096]+$/.exec(word)?.[0]
  if (!okuri || !hasHan(word)) return false
  const row = KANA_ROWS.filter((r) => r.includes(okuri.at(-1))).join('')
  for (let at = ja.indexOf(word); at >= 0; at = ja.indexOf(word, at + 1)) {
    const x = ja.slice(at + word.length)
    if (
      okuri.length >= 2 &&
      okuri.endsWith('る') &&
      x.startsWith(okuri.slice(0, -1)) &&
      ENDING.test(x.slice(okuri.length - 1))
    )
      return true
    if (x && row.includes(x[0]) && ENDING.test(x.slice(1))) return true
  }
  return false
}

/** 词干（送假名前的汉字部分），判断一行是不是日文例句时用 */
const stemOf = (word) => (hasHan(word) ? word.replace(/[\u3041-\u3096]+$/, '') : '')
const looksJapanese = (line, word) =>
  hasKana(unquoted(line)) || (!!stemOf(word) && line.includes(stemOf(word)))
/** 中文版里不能用的日文例句：词头替换坏了的、夹着罗马字的（Tabe, uru, eta…） */
const badExample = (word, ja) => brokenSubstitution(word, ja) || /[a-z]{3,}/.test(ja)

const keepExamples = (list) =>
  list.filter((t) => t && t.length <= MAX_EXAMPLE_LEN).slice(0, MAX_EXAMPLES)

/** 日文版的例句：「例文 — 说明」；出处（作者『作品』）短的接在后面；「用法:」之类的说明不算例句 */
function examplesJa(list, word) {
  const out = []
  for (const e of list ?? []) {
    let t = cleanJa(e.text ?? e.translation ?? '').replace(/^例文?\s*[:：]\s*/, '')
    if (!t || /^(?:用法|語法|注意?|備考|参考|類義語|対義語)\s*[:：]/.test(t)) continue
    if (!looksJapanese(t, word)) continue
    t = t.replace(/([。．」』）!?！？])\s*(?:—|–|-{1,2})\s*/, '$1 — ')
    const ref = cleanJa(e.ref ?? '')
    if (ref && ref.length <= 40 && /^[（(]/.test(ref)) t += ref
    out.push(t)
  }
  return keepExamples(out)
}

/** 中文版的例句：「日文 — 中文翻译」；只有中文、没有日文原句的不要 */
function examplesZh(list, word) {
  const out = []
  for (const e of list ?? []) {
    const ja = cleanZh(e.text ?? '')
    const zh = cleanZh(e.translation ?? '')
    // 有翻译的，原句是日文；没翻译的要有假名才认（不然多半是只剩中文翻译）
    if (!ja || !(zh ? hasKana(ja) || hasHan(ja) : hasKana(unquoted(ja)))) continue
    if (badExample(word, ja)) continue
    out.push(zh ? `${ja} — ${zh}` : ja)
  }
  return keepExamples(out)
}

// ───────────────────────── 日语维基词典 ─────────────────────────

/** 不收的词性：和語の漢字表記（只是转引）、记号、音节、罗马字…… */
const SKIP_POS = new Set(['character', 'symbol', 'romanization', 'syllable', 'soft-redirect'])

/**
 * 一条记录（一页里的一个词性段）整理成：
 * { word, readings, writings（假名词条的汉字写法）, pos（显示用）, posCode, senses: [{ text, examples, writings? }] }
 */
export function fromJa(o) {
  if (SKIP_POS.has(o.pos)) return null
  const word = String(o.word ?? '').trim()
  if (!word || !(hasKana(word) || hasHan(word)) || /[～〜~]/.test(word)) return null
  if (o.pos === 'name' && isKana(word)) return null
  const readings = new Set()
  const writings = new Set()
  for (const f of o.forms ?? []) {
    const tags = f.tags ?? []
    if (tags.includes('transliteration')) addReading(readings, word, asReading(f.form))
    else if (tags.includes('kanji')) addWritings(writings, word, f.form)
  }
  const senses = []
  const shown = new Set()
  for (const s of o.senses ?? []) {
    if (s.form_of || s.alt_of || (s.tags ?? []).includes('no-gloss')) continue
    const gs = (s.glosses ?? []).map(cleanJa).filter(Boolean)
    if (!gs.length) continue
    let text = senseText(gs, shown)
    const sense = {}
    if (hasHan(word)) {
      // 单字词条按读音分组：上级义项是「（ゆえ）」，下面是这个读音的释义（也有直接写在释义前的：
      // （ゲン）（数学）…）。这样的义项按注明的读音单独对词；只有一个读音时显示的文字去掉读音注
      const m = READING_NOTE.exec(joinGlosses(gs))
      const rs = m
        ? m[1]
            .split(/[、・,，\s]+/)
            .map(asReading)
            .filter(Boolean)
        : []
      if (rs.length) {
        sense.readings = rs
        if (rs.length === 1) text = text.replace(READING_NOTE, '')
      }
      if (!text.replace(READING_NOTE, '')) continue // 只有读音注的分组标题
    } else {
      // 假名词条里注明汉字写法的义项：【青・蒼】顔色が悪いこと、（盗る）正当な理由なく…：
      // 按那个写法单独对词（对不上就算整条的；「（比喩）」这样的标注自然对不上）
      const m = /^【([^】]{1,24})】\s*(.+)$/.exec(text)
      const ws = m ? writingList(m[1]) : []
      const p = /^[（(]([^）)]{1,24})[）)]/.exec(gs.at(-1))
      if (ws.length) {
        sense.writings = ws
        text = m[2]
      } else if (p && writingList(p[1]).length) {
        sense.writings = writingList(p[1])
        // 按这个写法对上时，显示的文字不用再带着它
        if (text.startsWith(p[0])) sense.bare = text.slice(p[0].length).trim()
      }
    }
    const bare = text.replace(READING_NOTE, '')
    if (JA_REDIRECT.test(bare) || (o.pos === 'name' && NAME_ONLY.test(bare))) continue
    if (sense.bare) sense.bare = labelOf(s, 'ja') + sense.bare
    senses.push({ ...sense, text: labelOf(s, 'ja') + text, examples: examplesJa(s.examples, word) })
  }
  if (!senses.length) return null
  return {
    word,
    readings: [...readings],
    writings: [...writings],
    pos: String(o.pos_title ?? '').trim(),
    posCode: o.pos,
    senses
  }
}

// ───────────────────────── 中文维基词典 ─────────────────────────

/** 词头加注音（ruby）→ 读音：行く + [行, い] → いく */
function rubyReading(form, ruby) {
  let out = ''
  let i = 0
  for (const [base, rt] of ruby ?? []) {
    const at = form.indexOf(base, i)
    if (at < 0) return null
    out += form.slice(i, at) + rt
    i = at + base.length
  }
  return asReading(out + form.slice(i))
}

/** 写法提示里能出现的字：汉字、假名、分隔符 */
const WRITING_LIST = /^[\u3041-\u3096\u30a1-\u30faー\u3400-\u9fff々〆ヶ，,、・•／/ ]+$/
const writingList = (s) =>
  WRITING_LIST.test(s)
    ? s.split(/[，,、・•／/ ]+/).filter((w) => w && hasHan(w) && w.length <= 8)
    : []

/** 「詞【よみ】」开头、释义和例句挤在一个 gloss 里的条目（从日汉辞典批量导入的） */
const IMPORTED = /^[^\n【]{1,40}【[^】\n]*】/

/**
 * 导入的条目：「整理【せいり】⏎名·他サ⏎1. 整理，收拾。⏎人員整理⏎精简人员。⏎2. …」
 * → 读音、词性、义项（每个义项后面是一对对「日文例句⏎中文翻译」）
 */
export function parseImported(word, gloss) {
  const out = { reading: null, pos: '', senses: [] }
  const lines = []
  for (let line of String(gloss)
    .replace(/={2,}\s*日[语語]\s*={2,}/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[\s\u3000]+/g, ' ').trim())
    .filter(Boolean)) {
    // 词头行（「==日语==」前后可能各有一行）：【】里是读音就记下；是用法说明就留着
    const h = /^([^【]{1,40})【([^】]*)】\s*(.*)$/.exec(line)
    if (h && h[1].replace(/ /g, '') === word) {
      if (!hasHan(h[2]) && !/[，、。；「」]/.test(h[2])) {
        out.reading ??= asReading(h[2])
        if (!h[3]) continue
        line = h[3]
      } else line = `【${h[2]}】${h[3]}`
    }
    if (!lines.includes(line)) lines.push(line)
  }
  const first = lines.length ? takePosLabel(lines[0]) : null
  if (first) {
    out.pos = first.pos
    if (first.rest) lines[0] = first.rest
    else lines.shift()
  }
  // 分义项：「1. …」起一个新义项；没有编号时第一行是释义；中途换词性的（补动五 给予。）也另起
  const blocks = []
  for (const line of lines) {
    const num = /^(?:\d{1,2}[.．]|[\u2460-\u2473])\s*(.+)$/.exec(line)
    const label = blocks.length && !num ? takePosLabel(line) : null
    if (num) blocks.push([num[1]])
    else if (!blocks.length) blocks.push([line])
    else if (label?.rest && !hasKana(unquoted(label.rest))) blocks.push([label.rest])
    else blocks.at(-1).push(line)
  }
  for (const [def, ...rest] of blocks) {
    // 「～さ ～げ」这样只列派生词的不算义项
    if (/^(?:[～〜]\S*\s*)+$/.test(def)) continue
    const text = cleanZh(def)
    if (!text || ZH_REDIRECT.test(text)) continue
    // 义项后面是一对对「日文例句⏎中文翻译」。只有汉字的日文例句（人員整理）要后面跟着翻译才认
    const examples = []
    const stem = stemOf(word)
    for (let i = 0; i < rest.length; i++) {
      const ja = rest[i]
      const zh = rest[i + 1]
      const paired = zh !== undefined && !hasKana(unquoted(zh)) && !/^\d{1,2}[.．]/.test(zh)
      if (!hasKana(unquoted(ja)) && !(stem && ja.includes(stem) && paired)) continue
      if (paired) i++
      if (badExample(word, ja)) continue
      examples.push(paired ? `${cleanZh(ja)} — ${cleanZh(zh)}` : cleanZh(ja))
    }
    out.senses.push({ text, examples: keepExamples(examples) })
  }
  return out
}

export function fromZh(o) {
  if (SKIP_POS.has(o.pos)) return null
  const word = String(o.word ?? '').trim()
  if (!word || !(hasKana(word) || hasHan(word)) || /[～〜~]/.test(word)) return null
  if (o.pos === 'name' && isKana(word)) return null
  const readings = new Set()
  const writings = new Set()
  for (const f of o.forms ?? []) {
    const tags = f.tags ?? []
    if (f.ruby && tags.includes('canonical'))
      addReading(readings, word, rubyReading(f.form, f.ruby))
    else if (tags.includes('kanji')) addWritings(writings, word, f.form)
  }
  // 音调标注里的假名（长音写成ー的对不上也无妨）
  if (hasHan(word)) for (const s of o.sounds ?? []) addReading(readings, word, asReading(s.other))
  // 词性：wiktextract 认出来的用它；认不出的（unknown）看释义开头的日汉辞典式标记
  let pos =
    o.pos !== 'unknown' ? simplify(String(o.pos_title ?? '').trim()) || ZH_POS[o.pos] || '' : ''
  const senses = []
  const shown = new Set()
  for (const s of o.senses ?? []) {
    if (s.form_of || s.alt_of || (s.tags ?? []).includes('no-gloss')) continue
    const raw = (s.glosses ?? []).filter(Boolean)
    if (!raw.length) continue
    if (o.pos === 'unknown' && raw.length === 1 && IMPORTED.test(raw[0])) {
      const p = parseImported(word, raw[0])
      if (hasHan(word)) addReading(readings, word, p.reading)
      if (!pos) pos = p.pos
      senses.push(...p.senses)
      continue
    }
    const gs = raw.map(cleanZh).filter(Boolean)
    if (!gs.length) continue
    let text = senseText(gs, shown)
    // 「今日(きょう)あって明日(あす)ない身(み)…」：把含这个词的谚语列表当成了释义
    if ((text.match(/[\u3400-\u9fff々][(（][\u3041-\u3096]+[)）]/g) ?? []).length >= 2) continue
    // 开头重复了词头的（えっ [形容]哎）、带日汉辞典式词性标记的（[接] 因此，所以。）
    if (text.startsWith(word + ' ')) text = text.slice(word.length + 1)
    const label = takePosLabel(text)
    if (label) {
      text = label.rest
      if (!pos) pos = label.pos
    }
    const sense = {}
    if (isKana(word)) {
      // 假名词条里注明是哪个汉字写法的义项（熱い：热的；【伯父•叔父】伯父……）：按那个写法单独对词
      const m =
        /^【([^】]{1,24})】\s*(.*)$/.exec(text) ?? /^([^：:]{1,24})\s*[：:]\s*(.*)$/.exec(text)
      const ws = m ? writingList(m[1]) : []
      if (ws.length) {
        sense.writings = ws
        text = m[2].trim()
      } else if (WRITING_LIST.test(text) && hasHan(text)) continue // 「嫁」「夜目」：只列了写法
    } else {
      // 单字词条注明读音的义项（（す）正気。）：跟日文版一样按这个读音单独对词
      const m = READING_NOTE.exec(joinGlosses(gs))
      const rs = m
        ? m[1]
            .split(/[、・,，\s]+/)
            .map(asReading)
            .filter(Boolean)
        : []
      if (rs.length) {
        sense.readings = rs
        if (rs.length === 1) text = text.replace(READING_NOTE, '')
      }
    }
    if (!text || ZH_REDIRECT.test(text) || (o.pos === 'name' && NAME_ONLY.test(text))) continue
    senses.push({ ...sense, text: labelOf(s, 'zh') + text, examples: examplesZh(s.examples, word) })
  }
  if (!senses.length) return null
  return {
    word,
    readings: [...readings],
    writings: [...writings],
    pos,
    posCode: o.pos,
    senses
  }
}

/**
 * 一条汉字页的记录指向哪些假名页：form_of；「和語の漢字表記」页上的读音和
 * 「「さむい」を参照」「でる 参照」「とるの漢字表記」这样的说明
 */
function linksOf(o) {
  const out = new Set()
  for (const s of o.senses ?? []) {
    for (const f of [...(s.form_of ?? []), ...(s.alt_of ?? [])])
      out.add(String(f.word ?? '').trim())
    if (o.pos !== 'character') continue
    for (const g of s.glosses ?? []) {
      const m =
        /^「?([\u3041-\u3096\u30a1-\u30faー]+)」?\s*(?:を)?\s*参照|^([\u3041-\u3096\u30a1-\u30faー]+)の漢字表記/.exec(
          g
        )
      if (m) out.add(m[1] ?? m[2])
    }
  }
  if (o.pos === 'character')
    for (const f of o.forms ?? [])
      if ((f.tags ?? []).includes('transliteration')) out.add(asReading(f.form))
  return [...out].filter((k) => k && isKana(k))
}

// ───────────────────────── 对词 ─────────────────────────

/** 太常见、拿来比对没意义的汉字 */
const ZH_COMMON = new Set(
  '的了是一不个之其等或与和及也都把被对从到为以某些此这那种时地得着过上下中大小多少去来出入用物事人'
)

/** 逐项比大小 */
const compareRank = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

export class Matcher {
  #db
  #zdict
  #form
  #entry
  /** 词条号 → 假名写法（平假名）；form 表没有按词条的索引，一次读进来 */
  #kana = new Map()
  #info = new Map()

  constructor(path) {
    this.#db = new DatabaseSync(path, { readOnly: true })
    const meta = this.#db.prepare("SELECT value FROM meta WHERE key = 'zdict'").get()
    this.#zdict = Buffer.from(String(meta.value), 'base64')
    this.#form = this.#db.prepare('SELECT DISTINCT entry FROM form WHERE text = ?')
    this.#entry = this.#db.prepare(
      'SELECT head, reading, common, jlpt, score, data FROM entry WHERE id = ?'
    )
    for (const r of this.#db.prepare('SELECT entry, text FROM form WHERE kana = 1').iterate()) {
      const id = Number(r.entry)
      let set = this.#kana.get(id)
      if (!set) this.#kana.set(id, (set = new Set()))
      set.add(toHira(String(r.text)))
    }
  }

  /** 词条的词头、读音、假名写法（平假名）、词性、JLPT、排序分 */
  info(id) {
    let e = this.#info.get(id)
    if (!e) {
      const r = this.#entry.get(id)
      const raw = JSON.parse(inflateRawSync(r.data, { dictionary: this.#zdict }).toString())
      e = {
        head: String(r.head),
        reading: String(r.reading),
        common: !!r.common,
        jlpt: r.jlpt ?? null,
        score: Number(r.score),
        kana: this.#kana.get(id) ?? new Set(),
        pos: [...new Set(raw.s.flatMap((s) => s.p ?? []))],
        // 平常写假名的词：没有汉字写法，或者第一个义项标着 uk
        kanaWord: !raw.k?.length || !!raw.s[0]?.m?.includes('uk'),
        // 中文释义里的汉字（太常见的虚字不算），辨认同音词时用
        zh: new Set([...(raw.z ?? []).join('')].filter((c) => hasHan(c) && !ZH_COMMON.has(c)))
      }
      this.#info.set(id, e)
    }
    return e
  }

  /**
   * 写法 + 读音 → 词条号；对不上时 { fail: 原因 }。几个都对得上时先看词性合不合，再取 score 高的。
   * 写法是假名的，假名本身就是读音，但同音词多（もと：元、本、基……），对上几个时只认平常写假名的词条；
   * 没写读音的，写法只对上一个词条、或者只有一个常用词条才算
   */
  match(writing, readings, posCode) {
    let ids = this.#form.all(writing).map((r) => Number(r.entry))
    // 叠字：再再来年 → 再々来年
    const repeat = /(\p{Script=Han})\1/gu
    if (!ids.length && repeat.test(writing))
      ids = this.#form.all(writing.replace(repeat, '$1々')).map((r) => Number(r.entry))
    if (!ids.length) return { fail: 'noForm' }
    let ok
    if (isKana(writing)) ok = ids
    else if (readings.length) {
      const want = readings.map(toHira)
      ok = ids.filter((id) => want.some((r) => this.info(id).kana.has(r)))
      if (!ok.length) return { fail: 'reading' }
    } else {
      const common = ids.filter((id) => this.info(id).common)
      ok = ids.length === 1 ? ids : common.length === 1 ? common : []
      if (!ok.length) return { fail: 'ambiguous' }
    }
    if (isKana(writing) && ok.length > 1) {
      // 同音的几个里只认平常写假名、词性合得上、主读音就是这个假名的（でる 不落到「てる」上）
      const fits = POS_FITS[posCode]
      ok = ok.filter((id) => {
        const e = this.info(id)
        return e.kanaWord && (!fits || e.pos.some(fits)) && toHira(e.reading) === toHira(writing)
      })
      if (!ok.length) return { fail: 'homophone' }
    }
    return { id: this.#best(ok, writing, posCode) }
  }

  /**
   * 几个词条里挑一个：词性合得上的在前；按假名对的，主读音就是这个假名的在前（いる 先挑 居る、要る，
   * 不挑主读音是 はいる 的 入る）；再看 score，一样时平常写假名的在前
   */
  #best(ids, kana, posCode) {
    const fits = POS_FITS[posCode]
    const hira = isKana(kana) ? toHira(kana) : null
    const rank = (id) => {
      const e = this.info(id)
      return [
        fits && e.pos.some(fits) ? 1 : 0,
        hira && toHira(e.reading) === hira ? 1 : 0,
        e.score,
        hira && e.kanaWord ? 1 : 0,
        -id
      ]
    }
    return [...ids].sort((a, b) => compareRank(rank(b), rank(a)))[0]
  }

  /**
   * 一页的几条记录（一个词性一段）一起对。汉字词头按写法 + 读音对。假名词头：
   *   1. 列了汉字写法的按汉字写法对（は【歯】）；
   *   2. 没列的（とる、たつ），看哪些汉字页写着「〜の漢字表記」指到这一页（linked），这些写法就是候选，
   *      只看词性合得上的，再看释义跟哪个候选沾边（#clue）：分得出来就是它；
   *      分不出来的段，每个词性里义项最多的一段从这一页还没被认领的候选里挑排在最前的，其余几段不收
   *      （やすい 页「容易」那段认了 易い，剩下的主段就归 安い；でる 页第二段「でいる」不收）；
   *   3. 汉字页没指过来的，按假名本身对（同音词多时只认平常写假名的词条）
   */
  matchPage(recs, linkedOf) {
    const res = recs.map((rec) => this.#matchRecord(rec, linkedOf(rec.word)))
    const claimed = new Set(res.filter((r) => r.id).map((r) => r.id))
    const main = new Map()
    recs.forEach((rec, i) => {
      if (!res[i].open) return
      const cur = main.get(rec.posCode)
      if (cur === undefined || rec.senses.length > recs[cur].senses.length) main.set(rec.posCode, i)
    })
    for (const i of main.values()) {
      const { open, clue } = res[i]
      const free = open.filter((id) => !claimed.has(id))
      if (!free.length) continue
      const top = Math.max(...free.map((id) => clue.get(id)))
      const id = this.#best(
        free.filter((x) => clue.get(x) === top),
        recs[i].word,
        recs[i].posCode
      )
      res[i] = { id }
      claimed.add(id)
    }
    return res.map((r) => (r.open ? { fail: 'homophone' } : r))
  }

  #matchRecord(rec, linked) {
    if (!isKana(rec.word)) return this.match(rec.word, rec.readings, rec.posCode)
    for (const w of rec.writings) {
      const m = this.match(w, [rec.word], rec.posCode)
      if (m.id) return m
    }
    if (!rec.writings.length && linked?.size) {
      const m = this.#matchLinked(rec, linked)
      if (m.id || m.open) return m
    }
    const m = this.match(rec.word, [], rec.posCode)
    return m.id ? m : { fail: rec.writings.length ? 'kanjiForm' : m.fail }
  }

  #matchLinked(rec, linked) {
    const byId = new Map()
    for (const w of linked) {
      const id = this.match(w, [rec.word], rec.posCode).id
      if (id) byId.set(id, [...(byId.get(id) ?? []), w])
    }
    if (!byId.size) return { fail: 'noForm' }
    const fits = POS_FITS[rec.posCode]
    const ids = [...byId.keys()].filter((id) => !fits || this.info(id).pos.some(fits))
    if (!ids.length) return { fail: 'noFit' }
    const text = new Set([...rec.senses.map((s) => s.text).join('')].filter(hasHan))
    const clue = new Map(ids.map((id) => [id, this.#clue(id, byId.get(id), text)]))
    const sorted = ids.sort((a, b) => clue.get(b) - clue.get(a))
    const top = clue.get(sorted[0])
    if (top >= 2 && (sorted.length === 1 || top > clue.get(sorted[1]))) return { id: sorted[0] }
    return { open: sorted, clue }
  }

  /**
   * 一段释义跟一个候选词条沾边多少：释义里出现了这个写法的汉字（「建造物が造られる」→ 建つ）算 2；
   * 再加上释义跟这个词条的中文释义共用的汉字数（「衣服などを身に付ける」跟 着る 的「穿（衣服）」共用 衣、服）
   */
  #clue(id, writings, text) {
    const named = writings.some((w) => [...w].some((c) => hasHan(c) && text.has(c)))
    let shared = 0
    for (const c of this.info(id).zh) if (text.has(c)) shared++
    return (named ? 2 : 0) + shared
  }

  /** dict.sqlite 用的 JMdict 版本（写进 meta，对词用的是哪一版） */
  jmdict() {
    return String(
      this.#db.prepare("SELECT value FROM meta WHERE key = 'jmdict'").get()?.value ?? ''
    )
  }

  close() {
    this.#db.close()
  }
}

// ───────────────────────── 生成 ─────────────────────────

/**
 * 读两份数据、对词、写库。files: { ja: [文件], zh: [文件] }；info: 写进 meta 的来源说明。
 * 返回统计（report 打印）
 */
export async function build(files, out, info = {}) {
  const t0 = Date.now()
  const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`)
  const matcher = new Matcher(DICT)
  /** `${entry} ${src}` → [{ rank（排序用）, word, pos, text, examples }] */
  const found = new Map()
  const stats = {}
  let order = 0
  for (const src of ['ja', 'zh']) {
    const st = (stats[src] = {
      records: 0,
      kept: 0,
      senses: 0,
      matched: 0,
      fail: {},
      entries: 0,
      jlpt: {},
      defs: 0
    })
    // 先过一遍：汉字页上「〜の漢字表記」「「さむい」を参照」「…的漢字寫法」指向哪个假名页
    // （取る → とる、寒い → さむい），对假名词条时用
    const linked = new Map()
    for await (const o of readRecords(files[src] ?? [])) {
      const w = String(o.word ?? '').trim()
      if (!hasHan(w)) continue
      for (const k of linksOf(o)) {
        let set = linked.get(k)
        if (!set) linked.set(k, (set = new Set()))
        set.add(w)
      }
    }
    const addRecord = (rec, m) => {
      if (m.id) st.matched++
      else st.fail[m.fail] = (st.fail[m.fail] ?? 0) + 1
      for (const s of rec.senses) {
        // 义项自己注明了写法的按写法单独对（对不上算整条的）；注明了读音的按读音对（对不上就不要，
        // 多半是冷僻的读法）
        let id = m.id
        let text = s.text
        if (s.writings) {
          for (const w of s.writings) {
            const sid = matcher.match(w, [rec.word], rec.posCode).id
            if (sid) {
              id = sid
              text = s.bare || s.text
              break
            }
          }
        } else if (s.readings) id = matcher.match(rec.word, s.readings, rec.posCode).id
        if (!id) continue
        const e = matcher.info(id)
        // 排序：读音是词条主读音的记录在前（今日的「きょう」页先于「こんにち」），再看词性合不合
        // （きれい 的形容動詞先于名詞）、页名是不是词头、义项多的词性段在前（日本 的固有名詞先于
        // 只有一个拓扑学义项的名詞），最后按原来的先后
        const readings = (s.readings ?? rec.readings).map(toHira)
        const main = rec.word === e.reading || readings.includes(toHira(e.reading)) ? 0 : 1
        const fits = POS_FITS[rec.posCode]
        const key = `${id} ${src}`
        let list = found.get(key)
        if (!list) found.set(key, (list = []))
        list.push({
          rank: [
            main,
            fits && !e.pos.some(fits) ? 1 : 0,
            rec.word === e.head ? 0 : 1,
            -rec.senses.length,
            order++
          ],
          word: rec.word,
          pos: rec.pos,
          text,
          examples: s.examples
        })
      }
    }
    // 同一页的记录挨在一起（分语言的文件按词排序，整份的按页面顺序），一页一页地对（见 matchPage）
    let page = []
    const flush = () => {
      const res = matcher.matchPage(page, (word) => linked.get(word))
      page.forEach((rec, i) => addRecord(rec, res[i]))
      page = []
    }
    for await (const o of readRecords(files[src] ?? [])) {
      st.records++
      const rec = src === 'ja' ? fromJa(o) : fromZh(o)
      if (!rec) continue
      st.kept++
      st.senses += rec.senses.length
      if (page.length && page[0].word !== rec.word) flush()
      page.push(rec)
    }
    flush()
    log(`${src}：读到 ${st.records} 条日语记录，有释义的 ${st.kept} 条（${st.senses} 个义项）`)
  }
  if (existsSync(out)) rmSync(out)
  const db = new DatabaseSync(out)
  db.exec(`
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- 释义：entry 是 JMdict 词条号；src 是来源（ja 日语维基词典 / zh 中文维基词典）；
-- sense 是同一词条、同一来源里的顺序（从 0 数）；word 是出自维基词典的哪一页（署名、链接用）；
-- ex 是例句（JSON 字符串数组，「例句 — 翻译或说明」），没有时为 NULL
CREATE TABLE def (
  entry INTEGER NOT NULL,
  src TEXT NOT NULL,
  sense INTEGER NOT NULL,
  pos TEXT NOT NULL,
  text TEXT NOT NULL,
  ex TEXT,
  word TEXT NOT NULL
);
`)
  const ins = db.prepare('INSERT INTO def VALUES (?, ?, ?, ?, ?, ?, ?)')
  db.exec('BEGIN')
  for (const key of [...found.keys()].sort((a, b) => parseInt(a) - parseInt(b))) {
    const [id, src] = key.split(' ')
    // 同一个释义从几页来（歯 页和 は 页）只留一条：比较时不管标点、空格和开头的读音注
    const seen = new Set()
    const same = (t) =>
      t
        .replace(/^[（(][\u3041-\u30faー、・,，\s]+[）)]/, '')
        .replace(/[\s、。，．・,.「」（）()]/g, '')
    const list = found
      .get(key)
      .sort((a, b) => compareRank(a.rank, b.rank))
      .filter((d) => !seen.has(same(d.text)) && seen.add(same(d.text)))
      .slice(0, MAX_SENSES)
    list.forEach((d, i) =>
      ins.run(
        Number(id),
        src,
        i,
        d.pos,
        d.text,
        d.examples.length ? JSON.stringify(d.examples) : null,
        d.word
      )
    )
    const st = stats[src]
    st.entries++
    st.defs += list.length
    const jlpt = matcher.info(Number(id)).jlpt
    if (jlpt) st.jlpt[`N${jlpt}`] = (st.jlpt[`N${jlpt}`] ?? 0) + 1
  }
  db.exec('COMMIT')
  db.exec('CREATE INDEX def_entry ON def (entry, src, sense);')
  const insMeta = db.prepare('INSERT INTO meta VALUES (?, ?)')
  insMeta.run('builtAt', new Date().toISOString())
  insMeta.run(
    'sources',
    JSON.stringify(
      Object.entries(EDITIONS).map(([key, ed]) => ({
        key,
        name: ed.name,
        license: ed.license,
        credit: ed.credit,
        home: ed.home,
        ...info[key]
      }))
    )
  )
  insMeta.run(
    'counts',
    JSON.stringify(
      Object.fromEntries(
        Object.entries(stats).map(([k, s]) => [k, { entries: s.entries, defs: s.defs }])
      )
    )
  )
  insMeta.run('jmdict', matcher.jmdict())
  db.exec('ANALYZE; VACUUM;')
  db.close()
  matcher.close()
  log(`写好 ${out}：${(statSync(out).size / 1e6).toFixed(1)} MB`)
  return stats
}

// ───────────────────────── 命令行 ─────────────────────────

async function main() {
  if (!existsSync(DICT)) throw new Error(`没有 ${DICT}，先跑 npm run data:ja`)
  const files = {}
  const info = {}
  for (const [key, ed] of Object.entries(EDITIONS)) {
    files[key] = await fetchEdition(ed)
    const side = files[key].map(sidecar).find((p) => existsSync(p))
    const s = side ? JSON.parse(readFileSync(side, 'utf8')) : {}
    info[key] = {
      files: files[key].map((f) => f.split(/[\\/]/).pop()),
      dump: s.dump ?? null,
      extracted: s.extracted ?? null
    }
  }
  report(await build(files, OUT, info), OUT)
}

const FAILS = {
  noForm: 'JMdict 里没有这个写法',
  reading: '读音对不上',
  ambiguous: '没写读音、写法对上几个词条',
  homophone: '假名页分不清是哪个同音词',
  kanjiForm: '列的汉字写法都对不上',
  noFit: '词性对不上'
}
const NAMES = { ja: '日日词典（ja.wiktionary）', zh: '维基词典（中文，zh.wiktionary）' }
/** 抽样看几个常用词：食べる 学校 綺麗 今日 取る 先生 */
const SAMPLES = [1358280, 1206730, 1591900, 1579110, 1326980, 1387990]

/** 打印统计：各抽出多少条、对上多少个 JMdict 词条、多少个是 JLPT 词，再抽几个词看看 */
export function report(stats, out) {
  const db = new DatabaseSync(out, { readOnly: true })
  db.exec(`ATTACH DATABASE '${DICT.replace(/'/g, "''")}' AS jm`)
  const levels = Object.fromEntries(
    db
      .prepare('SELECT jlpt, COUNT(*) AS n FROM jm.entry WHERE jlpt IS NOT NULL GROUP BY jlpt')
      .all()
      .map((r) => [`N${r.jlpt}`, Number(r.n)])
  )
  for (const [src, s] of Object.entries(stats)) {
    const fails = Object.entries(s.fail)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${FAILS[k] ?? k} ${n}`)
      .join('，')
    const jlpt = ['N5', 'N4', 'N3', 'N2', 'N1']
      .map((l) => `${l} ${s.jlpt[l] ?? 0}/${levels[l] ?? 0}`)
      .join('，')
    const total = Object.values(s.jlpt).reduce((a, b) => a + b, 0)
    console.log(`\n${NAMES[src]}`)
    console.log(`  读到日语记录 ${s.records} 条，有释义的 ${s.kept} 条（${s.senses} 个义项）`)
    console.log(`  对上 JMdict 的记录 ${s.matched} 条；没对上的：${fails}`)
    console.log(`  写入 ${s.entries} 个 JMdict 词条、${s.defs} 条释义`)
    console.log(`  其中 JLPT 词 ${total} 个（有释义的/该级总数）：${jlpt}`)
  }
  const count = (sql) => Number(db.prepare(sql).get().n)
  const any = count('SELECT COUNT(DISTINCT entry) AS n FROM def')
  const both = count(
    'SELECT COUNT(*) AS n FROM (SELECT entry FROM def GROUP BY entry HAVING COUNT(DISTINCT src) = 2)'
  )
  console.log(`\n至少有一栏释义的词条 ${any} 个，两栏都有的 ${both} 个`)
  for (const id of SAMPLES) {
    const e = db.prepare('SELECT head, reading FROM jm.entry WHERE id = ?').get(id)
    if (!e) continue
    console.log(`\n■ ${e.head}【${e.reading}】`)
    for (const src of ['ja', 'zh'])
      for (const r of db
        .prepare('SELECT pos, text, ex FROM def WHERE entry = ? AND src = ? ORDER BY sense LIMIT 2')
        .all(id, src)) {
        const ex = r.ex ? ` 例：${JSON.parse(r.ex)[0]}` : ''
        console.log(`  [${src}] ${r.pos ? `〈${r.pos}〉` : ''}${r.text}${ex}`)
      }
  }
  db.close()
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
