/**
 * 韩语词典数据：下载（缓存在 .cache/data/ko/）→ 解析 → 写 resources/data/ko/dict.sqlite。
 *   node scripts/data/run-ts.mjs scripts/data/ko/build.ts
 * 跑完用 node scripts/data/run-ts.mjs scripts/lang/validate.ts ko 检查。说明见 docs/lang/ko.md。
 *
 * 步骤：
 *   1. 한국어기초사전整本（词头、汉字、发音、活用、等级、韩语释义、中英文译文、例句）
 *   2. 维基词典（kaikki）：IPA、录音、汉字补充；기초사전没收的词另立词条（英文释义）
 *   3. 谓词定活用类别、生成变形表
 *   4. 词频：OpenSubtitles 字幕的语节频度按还原规则归到词条
 *   5. 分级：标准课程（2017）、2003 学习用词汇、기초사전等级 → TOPIK 1–6
 *   6. 写库：词条、汉字写法、例句（기초사전 + Tatoeba 中英对照）、主题词本
 *   7. data/ko/zh-todo.txt：没有中文释义的常用词
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import Bunzip from 'seek-bzip'
import { LexDbWriter, cacheDir, download } from '../../lang/lexdb-writer'
import type { LexEntryData, LexSense, PosTag, SourceRef } from '../../../src/shared/lang/types'
import { classify, conjugate, type PredClass } from '../../../src/shared/lang/ko/conjugate'
import { chainTags, deinflectPredicate } from '../../../src/shared/lang/ko/deinflect'
import { decompose } from '../../../src/shared/lang/ko/hangul'
import { analyses } from '../../../src/shared/lang/ko/lemma'
import { PRONOUN_FORMS } from '../../../src/shared/lang/ko/particles'
import {
  pronounce,
  romanize,
  romanizeFromPronunciation
} from '../../../src/shared/lang/ko/pronounce'
import { key, tokenize } from '../../../src/shared/lang/ko/rules'
import {
  FREQ_SUBTITLES,
  KRDICT,
  NIKL_STD2017,
  NIKL_VOCAB2003,
  TOPIK_SOURCE
} from '../../../src/shared/lang/ko/spec'
import { cleanPron, readKrdict, type KrEntry, type KrSense } from './krdict'
import { readKaikki, type KaikkiEntry } from './kaikki'
import { THEME_BY_KO, THEMES } from './themes'
import { readStd2017, readVocab2003, type ListWord } from './wordlists'

const CACHE = cacheDir('ko')
const t0 = Date.now()
const log = (...a: unknown[]): void =>
  console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, ...a)

// ───────────────────────── 来源 ─────────────────────────

const WIKTIONARY: SourceRef = {
  id: 'wiktionary',
  name: '维基词典（英文版）的韩语词条（kaikki.org / wiktextract 抽取）：IPA、录音、汉字、英文释义',
  license: 'CC BY-SA 4.0 / GFDL',
  credit: 'Wiktionary 贡献者；kaikki.org / wiktextract（Tatu Ylonen）',
  home: 'https://kaikki.org/dictionary/Korean/'
}
const TATOEBA: SourceRef = {
  id: 'tatoeba',
  name: 'Tatoeba 例句（韩中、韩英对照）',
  license: 'CC BY 2.0 FR',
  credit: 'Tatoeba 贡献者',
  home: 'https://tatoeba.org/'
}
const OPENCC: SourceRef = {
  id: 'opencc',
  name: '汉字繁简对照（宽松查词：输入简体字也能查到汉字词）',
  license: 'Apache 2.0',
  credit: 'OpenCC（BYVoid）',
  home: 'https://github.com/BYVoid/OpenCC'
}
const UNIHAN: SourceRef = {
  id: 'unihan',
  name: 'Unihan 异体字数据（宽松查词的繁简、异体对照）',
  license: 'Unicode License v3',
  credit: 'Unicode Consortium',
  home: 'https://www.unicode.org/charts/unihan.html'
}
const KRDICT_SRC: SourceRef = {
  ...KRDICT,
  note: '整本 XML（「사전 전체 내려받기」，不用登录）：词头、汉字、发音、活用、词汇等级、韩语释义、中英文译文、例句、主题；录音、图片另有许可，没有收'
}

// ───────────────────────── 下载 ─────────────────────────

const UA = { 'User-Agent': 'Qonsona data pipeline (https://github.com/Kinnuch/Qonsona)' }

/** 한국어기초사전整本 XML：缓存里有就用最新的一份，没有就从「사전 전체 내려받기」页面找下载号 */
async function krdictZip(): Promise<string> {
  mkdirSync(CACHE, { recursive: true })
  const have = readdirSync(CACHE)
    .filter((f) => /^krdict-xml-\d{8}\.zip$/.test(f))
    .sort()
  if (have.length) return join(CACHE, have[have.length - 1])
  const page = await (
    await fetch('https://krdict.korean.go.kr/download/downloadPopup', { headers: UA })
  ).text()
  const seqs = [...page.matchAll(/batchDownload\('(\d+)'\)/g)].map((m) => m[1])
  if (seqs.length < 2) throw new Error('找不到한국어기초사전的下载号（页面改了？）')
  const url = `https://krdict.korean.go.kr/dicBatchDownload?seq=${seqs[1]}` // 第二个按钮是 XML
  const res = await fetch(url, { headers: UA })
  const disp = decodeURIComponent(res.headers.get('content-disposition') ?? '')
  const date =
    /(\d{8})\.zip/.exec(disp)?.[1] ?? new Date().toISOString().slice(0, 10).replace(/-/g, '')
  if (!res.ok || !res.body) throw new Error(`下载한국어기초사전失败 ${res.status}`)
  const file = join(CACHE, `krdict-xml-${date}.zip`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  return file
}

const TATOEBA_URL = (f: string): string => `https://downloads.tatoeba.org/exports/per_language/${f}`

async function fetchAll(): Promise<Record<string, string>> {
  const nikl = 'https://www.korean.go.kr/common/download.do?file_path='
  return {
    krdict: await krdictZip(),
    kaikki: await download(
      'ko',
      'https://kaikki.org/dictionary/Korean/kaikki.org-dictionary-Korean.jsonl.gz',
      'kaikki-en-ko.jsonl.gz'
    ),
    std2017: await download(
      'ko',
      nikl +
        'reportData&c_file_name=157339df-1904-443a-b1a9-d6d34578ba93.xlsx&o_file_name=' +
        encodeURIComponent(
          '2017년 국제 통용 한국어 표준 교육과정 적용 연구(4단계) 어휘, 문법 등급 목록.xlsx'
        ),
      'nikl-standard-vocab-grammar-2017.xlsx'
    ),
    vocab2003: await download(
      'ko',
      nikl +
        'etcData&c_file_name=b73a8438-4713-4436-8481-ec26fd0dce2a_0.txt&o_file_name=' +
        encodeURIComponent('한국어 학습용 어휘 목록.txt'),
      'nikl-learner-vocab-2003.txt'
    ),
    freq: await download(
      'ko',
      'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ko/ko_full.txt',
      'freqwords-ko_full.txt'
    ),
    korSentences: await download(
      'ko',
      TATOEBA_URL('kor/kor_sentences.tsv.bz2'),
      'tatoeba-kor_sentences.tsv.bz2'
    ),
    korCmn: await download(
      'ko',
      TATOEBA_URL('kor/kor-cmn_links.tsv.bz2'),
      'tatoeba-kor-cmn_links.tsv.bz2'
    ),
    korEng: await download(
      'ko',
      TATOEBA_URL('kor/kor-eng_links.tsv.bz2'),
      'tatoeba-kor-eng_links.tsv.bz2'
    ),
    cmnSentences: await download(
      'ko',
      TATOEBA_URL('cmn/cmn_sentences.tsv.bz2'),
      'tatoeba-cmn_sentences.tsv.bz2'
    ),
    engSentences: await download(
      'ko',
      TATOEBA_URL('eng/eng_sentences.tsv.bz2'),
      'tatoeba-eng_sentences.tsv.bz2'
    )
  }
}

// ───────────────────────── 词条（内存里） ─────────────────────────

interface Item {
  /** 写库的顺序号（内存里的下标） */
  i: number
  w: string
  p: PosTag[]
  kr?: KrEntry
  kk: KaikkiEntry[]
  /** 谓词：活用类别 */
  cls?: PredClass
  /** 谓词：动词式（-는다、-는）还是形容词式；있다/없다 类 */
  conj?: 'v' | 'a' | 've'
  /** 完整的变形表（算词频用）；写库时按常用程度删减 */
  forms: [string, ...string[]][]
  score: number
  fr?: number
  lv: Record<string, string>
  /** 汉字写法（學校）、外来语原文（bus） */
  hanja?: string
  origin?: string
}

const KR_POS: Record<string, PosTag> = {
  명사: 'noun',
  '의존 명사': 'noun',
  대명사: 'pron',
  수사: 'num',
  동사: 'verb',
  형용사: 'adj',
  '보조 동사': 'aux',
  '보조 형용사': 'aux',
  부사: 'adv',
  관형사: 'det',
  감탄사: 'intj',
  조사: 'adp',
  어미: 'affix',
  접사: 'affix'
}
const UNIT_POS: Record<string, PosTag> = {
  관용구: 'idiom',
  속담: 'proverb',
  구: 'phrase',
  '문법‧표현': 'phrase'
}
const KK_POS: Record<string, PosTag> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adj',
  adv: 'adv',
  intj: 'intj',
  pron: 'pron',
  num: 'num',
  det: 'det',
  particle: 'adp',
  postp: 'adp',
  suffix: 'affix',
  prefix: 'affix',
  affix: 'affix',
  interfix: 'affix',
  phrase: 'phrase',
  proverb: 'proverb',
  name: 'propn',
  counter: 'noun',
  conj: 'cconj'
}

const isHan = (s: string): boolean => /\p{Script=Han}/u.test(s)

/** 体词后面常见的助词：[接有收音的, 接没有收音的, 标签]；不收「하고」（공부하고 几乎都是 공부하다 + -고） */
const NOUN_PARTICLES: [string, string, string][] = [
  ['은', '는', '은/는'],
  ['이', '가', '이/가'],
  ['을', '를', '을/를'],
  ['과', '와', '와/과'],
  ['으로', '로', '(으)로'],
  ['이나', '나', '(이)나'],
  ['이랑', '랑', '(이)랑'],
  ['의', '의', '의'],
  ['에', '에', '에'],
  ['에서', '에서', '에서'],
  ['도', '도', '도'],
  ['만', '만', '만'],
  ['까지', '까지', '까지'],
  ['부터', '부터', '부터'],
  ['에게', '에게', '에게'],
  ['한테', '한테', '한테'],
  ['보다', '보다', '보다'],
  ['처럼', '처럼', '처럼']
]

/** 格助词 */
const CASE_PARTICLES = new Set(['이/가', '은/는', '을/를'])

/** 维基词典里只是别的词的变形、方言、旧写法的义项（학괴「학교 的方言」、몰라요「모르다 的活用」） */
const NOT_A_WORD =
  /\b(?:form|forms) of\b|marked form|adnominal of|declarative of|interrogative of|imperative of|propositive of|conjunctive of|dialect|alternative (?:form|spelling)|obsolete (?:form|spelling)|Middle Korean|abbreviation of|contraction of|eye dialect|misspelling|North Korean (?:spelling|form|standard)|romanization of/i

// 变形表：动词、形容词各一套（词尾序列，空格隔开先语末与语末）；core 每个谓词都收，ext 只收常用的
const VERB_CORE = 'hae|haeyo|seumnida|neunda|past da|past haeyo|go|aseo|myeon|neun|n|l|ji'.split(
  '|'
)
const VERB_EXT = (
  'past hae|past seumnida|fut seumnida|fut haeyo|seyo|hon past haeyo|sipsio|ara|ja|psida|lkkayo|' +
  'lgeyo|llaeyo|nikka|jiman|neunde|ado|aya|reo|ryeogo|myeonseo|daga|deon|gi|m|ge|neyo|jyo|' +
  'neunji|nayo|janayo|seumnikka'
).split('|')
const ADJ_CORE = 'hae|haeyo|seumnida|da|past da|past haeyo|go|aseo|myeon|n|l|ji'.split('|')
const ADJ_EXT = (
  'past hae|past seumnida|fut haeyo|seyo|nikka|jiman|nde|ado|aya|myeonseo|deon|gi|m|ge|neyo|' +
  'jyo|nji|nayo|gunyo|seumnikka|ngayo'
).split('|')
/** 있다、없다 类：形容词，但冠形词尾等用 -는（있는、없는데） */
const VE_SWAP: Record<string, string> = { n: 'neun', nde: 'neunde', nji: 'neunji', ngayo: '' }

/** 一个谓词的变形表：[写法, ...标签]；核心形式连也对的另一种写法（돼요 / 되어요）一起收，其余只收通行写法 */
function table(it: Item, ext: boolean): [string, ...string[]][] {
  const core = it.conj === 'v' ? VERB_CORE : ADJ_CORE
  const chains = [...core, ...(ext ? (it.conj === 'v' ? VERB_EXT : ADJ_EXT) : [])]
  const out: [string, ...string[]][] = []
  for (const c of chains) {
    const chain = c
      .split(' ')
      .map((x) => (it.conj === 've' ? (VE_SWAP[x] ?? x) : x))
      .filter(Boolean)
    if (!chain.length) continue
    const forms = conjugate(it.w, it.cls ?? 'reg', chain)
    const tags = chainTags(chain)
    for (const f of forms.slice(0, core.includes(c) ? 2 : 1)) out.push([f, ...tags])
  }
  return out
}

/** 谓词的活用类别标签（词典里显示成小标签） */
function clsLabels(it: Item): string[] {
  const out: string[] = []
  const stem = it.w.slice(0, -1)
  const last = decompose(stem.slice(-1))
  switch (it.cls) {
    case 'p':
    case 'po':
      out.push('ㅂ 불규칙')
      break
    case 't':
      out.push('ㄷ 불규칙')
      break
    case 's':
      out.push('ㅅ 불규칙')
      break
    case 'reu':
      out.push('르 불규칙')
      break
    case 'reo':
      out.push('러 불규칙')
      break
    case 'h':
      out.push('ㅎ 불규칙')
      break
    case 'u':
      out.push('우 불규칙')
      break
    default:
      if (stem.endsWith('하')) out.push('여 불규칙')
      else if (last?.t === 'ㄹ') out.push('ㄹ 탈락')
      else if (last && !last.t && last.v === 'ㅡ') out.push('으 탈락')
  }
  return out
}

// ───────────────────────── 释义 ─────────────────────────

const NO_ZH = /无对应|無對應|^\(?\s*-\s*\)?$/
const NO_EN = /no equivalent|^n\/?a$/i

function splitList(s: string, sep: RegExp): string[] {
  return s
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean)
}

/** 用法说明里能对上 Wiktextract 标签的 */
function noteTags(note?: string): string[] {
  if (!note) return []
  const t: string[] = []
  if (/구어/.test(note)) t.push('colloquial')
  if (/문어/.test(note)) t.push('literary')
  if (/낮잡아|낮추어/.test(note)) t.push('derogatory')
  if (/속되게/.test(note)) t.push('vulgar')
  if (/높이/.test(note) && /말/.test(note)) t.push('honorific')
  return t
}

const REL: Record<string, 'syn' | 'ant' | 'see'> = {
  유의어: 'syn',
  반대말: 'ant',
  참고어: 'see',
  준말: 'see',
  본말: 'see',
  높임말: 'see',
  낮춤말: 'see',
  큰말: 'see',
  작은말: 'see',
  센말: 'see',
  여린말: 'see'
}

// ───────────────────────── 主流程 ─────────────────────────

async function main(): Promise<void> {
  const files = await fetchAll()
  log('下载齐了', files.krdict)

  // 1. 한국어기초사전
  const items: Item[] = []
  for (const kr of readKrdict(files.krdict)) {
    // 「가까우-」「가까워-」这类词干参见条（品词没有、以连字符结尾）不收：还原规则能直接找到原形
    if (kr.unit === '단어' && kr.pos === '품사 없음' && /-$/.test(kr.w)) continue
    if (!kr.senses.length) continue
    const p: PosTag = KR_POS[kr.pos] ?? UNIT_POS[kr.unit] ?? 'other'
    const hanja = kr.origin && isHan(kr.origin) ? kr.origin.normalize('NFC') : undefined
    const origin = kr.origin && !hanja ? kr.origin : undefined
    items.push({
      i: items.length,
      w: kr.w.normalize('NFC'),
      p: [p],
      kr,
      kk: [],
      forms: [],
      score: 0,
      lv: {},
      hanja,
      origin
    })
  }
  log(`한국어기초사전 ${items.length} 条`)

  // 2. 维基词典
  const kaikki = readKaikki(files.kaikki)
  const kkByWord = new Map<string, KaikkiEntry[]>()
  for (const k of kaikki) {
    const list = kkByWord.get(k.word) ?? []
    list.push(k)
    kkByWord.set(k.word, list)
  }
  const krWords = new Set(items.map((it) => key(it.w)))
  for (const it of items) {
    const cands = (kkByWord.get(it.w) ?? []).filter((k) => KK_POS[k.pos] && !k.formOf)
    // 同形词：汉字对得上的优先，其次词性对得上的
    const same = cands.filter((k) => it.hanja && k.hanja.some((h) => it.hanja!.includes(h)))
    const pos = cands.filter((k) => KK_POS[k.pos] === it.p[0])
    it.kk = same.length ? same : pos.length ? pos : cands.slice(0, 1)
  }
  let kkOnly = 0
  for (const [word, list] of kkByWord) {
    if (krWords.has(key(word)) || !/^[가-힣]+(?: [가-힣]+)*$/.test(word)) continue
    const good = list
      .filter((k) => KK_POS[k.pos] && !k.formOf)
      .map((k) => ({ ...k, senses: k.senses.filter((x) => !NOT_A_WORD.test(x.glosses.join(' '))) }))
      .filter((k) => k.senses.length)
    if (!good.length) continue
    // 别的词的活用形（몰라요）、体词加助词或缩约（나는、이젠、뭔지）不另立词条：还原规则能找到原形。
    // 动词、形容词、代词只要还原得出기초사전的词就不要；其余（名词等）没有汉字、而且是常见的分析才不要；专名都留着
    const found = analyses(word).filter((a) => krWords.has(key(a.lemma)))
    const predLike = good.every((k) => k.pos === 'verb' || k.pos === 'adj' || k.pos === 'pron')
    const hasHanja = good.some((k) => k.hanja.length)
    const isName = good.every((k) => k.pos === 'name')
    if (
      !isName &&
      ((predLike && found.length > 0) || (!hasHanja && found.some((a) => a.score < 0.8)))
    )
      continue
    const p = [...new Set(good.map((k) => KK_POS[k.pos]))]
    items.push({
      i: items.length,
      w: word,
      p,
      kk: good,
      forms: [],
      score: 0,
      lv: {},
      hanja: good.flatMap((k) => k.hanja)[0]
    })
    kkOnly++
  }
  log(`维基词典 ${kaikki.length} 条，기초사전没有的另立 ${kkOnly} 条`)

  // 3. 活用
  let preds = 0
  const clsCount = new Map<string, number>()
  for (const it of items) {
    const p = it.p[0]
    // 이다（叙述格助词）的活用由 lemma.ts 另外认（학생이에요），不在这里生成变形表
    if (
      !(p === 'verb' || p === 'adj' || p === 'aux') ||
      !it.w.endsWith('다') ||
      /\s/.test(it.w) ||
      it.w === '이다'
    )
      continue
    const kr = it.kr
    // 定类别：기초사전给的活用形（들어、들으니、듣는）；没有的用维基词典活用表
    const attested = kr?.conj.flatMap((c) => [c.form, ...(c.short?.map((s) => s.form) ?? [])]) ?? []
    it.cls = classify(it.w, attested.length ? attested : it.kk.flatMap((k) => k.conj))
    const adjLike = p === 'adj' || (p === 'aux' && kr?.pos === '보조 형용사')
    it.conj = /(?:있|없)다$/.test(it.w) && adjLike ? 've' : adjLike ? 'a' : 'v'
    it.forms = table(it, true)
    // 词典给的活用形、缩略形也收（表里没有的按还原结果标）
    for (const a of attested) {
      if (it.forms.some((f) => f[0] === a)) continue
      const an = deinflectPredicate(a).find((x) => x.lemma === it.w)
      it.forms.push([a, ...(an ? chainTags(an.chain) : ['krdict'])])
    }
    preds++
    clsCount.set(it.cls, (clsCount.get(it.cls) ?? 0) + 1)
  }
  log(`谓词 ${preds} 个，类别：${[...clsCount].map(([k, v]) => `${k} ${v}`).join('，')}`)

  // 4. 词频
  /** 先验：기초사전等级越低（越基础）越常见；维基词典另立的词条打折扣 */
  const prior = (it: Item): number => {
    const lv = it.kr?.level
    return (lv === '초급' ? 8 : lv === '중급' ? 4 : lv === '고급' ? 1 : 0.5) * (it.kr ? 1 : 0.05)
  }
  const lemmaIndex = new Map<string, number[]>()
  for (const it of items) {
    const k = key(it.w)
    const list = lemmaIndex.get(k)
    if (list) list.push(it.i)
    else lemmaIndex.set(k, [it.i])
  }
  /**
   * 一个语节可能是哪些词条、各占多少：整词是词头的算一种分析（分数 0），还原出来的按 lemma.ts 的分数；
   * 权重 = e^(−3 × 分数) × 先验。나는 大半算「나」，가는 大半算「가다」
   */
  const resolveWeighted = (word: string): [number, number][] => {
    const out = new Map<number, number>()
    const add = (ids: number[] | undefined, score: number): void => {
      for (const i of ids ?? []) {
        const w = Math.exp(-3 * score) * prior(items[i])
        if (w > (out.get(i) ?? 0)) out.set(i, w)
      }
    }
    // 整词就是词头的也只算一种分析（分数 0.2，跟最常见的谓词分析相当）：가 这类单音节词不会把
    // 「가!」（가다的命令）「가」（助词）的次数全吞掉
    add(lemmaIndex.get(key(word)), 0.2)
    for (const a of analyses(word)) add(lemmaIndex.get(key(a.lemma)), a.score)
    return [...out]
  }
  /** 一个语节最可能是哪个词条（Tatoeba 例句挂词条用） */
  const resolve = (word: string): number[] => {
    const hits = resolveWeighted(word)
    return hits.length ? [hits.sort((a, b) => b[1] - a[1])[0][0]] : []
  }
  let freqTypes = 0
  for (const line of readFileSync(files.freq, 'utf8').split('\n')) {
    const sp = line.lastIndexOf(' ')
    const count = Number(line.slice(sp + 1))
    if (!(count >= 3)) continue
    const word = line.slice(0, sp)
    if (!/^[가-힣]+$/.test(word)) continue
    const hits = resolveWeighted(word)
    if (!hits.length) continue
    freqTypes++
    const total = hits.reduce((s, [, w]) => s + w, 0)
    for (const [i, w] of hits) items[i].score += (count * w) / total
  }
  const ranked = items.filter((it) => it.score > 0).sort((a, b) => b.score - a.score)
  ranked.forEach((it, n) => (it.fr = n + 1))
  log(`词频：${freqTypes} 个语节对上了词条，${ranked.length} 个词条有词频`)

  // 同形的几种处理（阅读器先在 form 表里对整词，同一个键对上几个词条时按词频挑）：
  // 1. 谓词的变形跟别的词的原形同形（그런데 / 그렇다、하지만 / 하다、아니 / 알다、높임 / 높이다）：
  //    这个写法更可能是哪个：那个词按「整词就是它」（分数 0.1）、谓词按这个变形的还原分数，各乘先验比一比；
  //    那个词占上风时，这个变形不进谓词的变形表（还原规则照样认得出），整词对上的就是那个词
  const isPredItem = (it: Item): boolean => !!it.conj
  const rankOf = (it: Item): number => it.fr ?? 1e6
  let lexicalized = 0
  for (const it of items) {
    if (!isPredItem(it)) continue
    it.forms = it.forms.filter(([form]) => {
      const other = (lemmaIndex.get(key(form)) ?? [])
        .map((i) => items[i])
        .filter((o) => o !== it && !isPredItem(o) && o.p[0] !== 'affix')
      if (!other.length) return true
      const wOther = Math.max(...other.map((o) => Math.exp(-0.3) * prior(o)))
      const mine = analyses(form)
        .filter((a) => a.lemma === it.w)
        .map((a) => a.score)
      const s = mine.length ? Math.min(...mine) : 0.2
      const keep = Math.exp(-3 * s) * prior(it) > wOther
      if (!keep) lexicalized++
      return keep
    })
  }
  log(`谓词变形跟别的词同形、让给那个词的 ${lexicalized} 个`)
  // 2. 体词加助词跟谓词的变形同形（우리는 / 우리다、나는 / 나다）：常用的体词（초급、중급或标准课程里的）
  //    把这个写法也收进自己的变形表，按词频跟谓词比；本身是别的词头的（가만、파도）不加
  // 3. 体词加助词跟别的词头同形（수가 / 수가、개가 / 개가 凯歌）：体词常用得多（词频名次差五倍以上）才加
  const predForms = new Set<string>()
  for (const it of items) if (it.conj) for (const f of it.forms) predForms.add(key(f[0]))
  let clash = 0
  for (const it of items) {
    if (!['noun', 'pron', 'num', 'propn'].includes(it.p[0]) || /[\s-]/.test(it.w)) continue
    const common = it.kr?.level === '초급' || it.kr?.level === '중급' || !!it.lv.kstd
    if (!common || it.w === '내' || it.w === '제' || it.w === '네') continue
    const coda = !!decompose(it.w.slice(-1))?.t
    for (const [c, v, label] of NOUN_PARTICLES) {
      // 나、저、너 的主格是 내가、제가、네가，「나가」是 나가다
      if (!coda && v === '가' && (it.w === '나' || it.w === '저' || it.w === '너')) continue
      const form = it.w + (coda ? c : v)
      const k = key(form)
      const others = lemmaIndex.get(k)
      // 跟别的词头同形的只看格助词（이/가、은/는、을/를）：그만、때로、모처럼 这些副词不拆
      const add = others
        ? CASE_PARTICLES.has(label) && others.every((i) => rankOf(items[i]) >= rankOf(it) * 5)
        : predForms.has(k)
      if (add) {
        it.forms.push([form, label])
        clash++
      }
    }
  }
  // 代词的特殊写法（내가、제가、누가、뭘……）也进代词的变形表：整词对上时跟 내가다 这类动词按词频比
  for (const [form, [base, tags]] of Object.entries(PRONOUN_FORMS)) {
    if (/\s/.test(base) || !tags.length) continue
    for (const i of lemmaIndex.get(key(base)) ?? [])
      if (['pron', 'noun'].includes(items[i].p[0])) {
        items[i].forms.push([form, ...tags])
        clash++
        break
      }
  }
  log(`体词加助词跟别的写法同形、收进体词变形表的 ${clash} 个`)

  // 5. 分级
  const byWord = new Map<string, Item[]>()
  for (const it of items) {
    const list = byWord.get(it.w) ?? []
    list.push(it)
    byWord.set(it.w, list)
  }
  const matchList = (lw: ListWord, posMap: Record<string, PosTag[]>): Item | null => {
    const words = lw.w
      .split(/[∙·‧・/\n\r]+/)
      .map((s) => s.replace(/\d+$/, '').trim())
      .filter(Boolean)
    const want = lw.pos.split(/[∙·‧・./]+/).flatMap((x) => posMap[x.trim()] ?? [])
    let cands: Item[] = []
    for (const w of new Set(words)) cands.push(...(byWord.get(w) ?? []).filter((it) => it.kr))
    if (!cands.length) return null
    if (want.length) {
      const c = cands.filter((it) => want.includes(it.p[0]))
      if (c.length) cands = c
    }
    if (cands.length === 1) return cands[0]
    // 同形词：汉字对得上的、提示词在例句里出现得多的、기초사전等级低的、常用的优先
    const hintWords = lw.hint.split(/[\s,~]+/).filter((x) => x && !words.includes(x))
    const score = (it: Item): number => {
      let s = 0
      if (isHan(lw.hint) && it.hanja?.includes(lw.hint.replace(/[^\p{Script=Han}]/gu, ''))) s += 100
      const text = it
        .kr!.senses.flatMap((x) => [x.def, ...x.examples.flatMap((e) => e.text)])
        .join(' ')
      for (const h of hintWords) if (text.includes(h.slice(0, 2))) s += 5
      s +=
        it.kr!.level === '초급' ? 3 : it.kr!.level === '중급' ? 2 : it.kr!.level === '고급' ? 1 : 0
      s -= (it.fr ?? 1e6) / 1e6
      return s
    }
    return cands.sort((a, b) => score(b) - score(a))[0]
  }
  const POS17: Record<string, PosTag[]> = {
    명사: ['noun'],
    의존명사: ['noun'],
    대명사: ['pron'],
    수사: ['num'],
    동사: ['verb', 'aux'],
    형용사: ['adj', 'aux'],
    부사: ['adv'],
    관형사: ['det'],
    감탄사: ['intj'],
    접사: ['affix'],
    줄어든말: []
  }
  const POS03: Record<string, PosTag[]> = {
    명: ['noun'],
    의: ['noun'],
    대: ['pron'],
    수: ['num'],
    동: ['verb'],
    형: ['adj'],
    보: ['aux', 'verb', 'adj'],
    부: ['adv'],
    관: ['det'],
    감: ['intj'],
    고: ['noun', 'propn'],
    불: []
  }
  let std = 0
  const stdMiss: string[] = []
  for (const lw of readStd2017(files.std2017)) {
    const it = matchList(lw, POS17)
    if (!it) {
      stdMiss.push(lw.w)
      continue
    }
    if (!it.lv.kstd || Number(lw.level) < Number(it.lv.kstd)) it.lv.kstd = lw.level
    std++
  }
  let v03 = 0
  const v03Miss: string[] = []
  for (const lw of readVocab2003(files.vocab2003)) {
    const it = matchList(lw, POS03)
    if (!it) {
      v03Miss.push(lw.w)
      continue
    }
    if (!it.lv.nikl2003 || lw.level < it.lv.nikl2003) it.lv.nikl2003 = lw.level
    v03++
  }
  log(`标准课程词表对上 ${std} 个（没对上 ${stdMiss.length}：${stdMiss.slice(0, 30).join('、')}）`)
  log(
    `2003 学习用词汇对上 ${v03} 个（没对上 ${v03Miss.length}：${v03Miss.slice(0, 30).join('、')}）`
  )
  const KR_LV: Record<string, string> = { 초급: '1', 중급: '2', 고급: '3' }
  for (const it of items) if (it.kr && KR_LV[it.kr.level]) it.lv.krdict = KR_LV[it.kr.level]
  // TOPIK：标准课程有的照它；没有的按기초사전等级定级段、段内按词频切
  const band = (lv: string, levels: [string, string], share: number, maxRank: number): void => {
    const group = items
      .filter((it) => !it.lv.kstd && it.lv.krdict === lv && (it.fr ?? Infinity) <= maxRank)
      .sort((a, b) => (a.fr ?? Infinity) - (b.fr ?? Infinity))
    const cut = Math.round(group.length * share)
    group.forEach((it, n) => (it.lv.topik = n < cut ? levels[0] : levels[1]))
  }
  for (const it of items) if (it.lv.kstd) it.lv.topik = it.lv.kstd
  band('1', ['1', '2'], 0.3, Infinity)
  band('2', ['3', '4'], 0.43, Infinity)
  band('3', ['5', '6'], 0.48, 30000)
  const topikCount = new Map<string, number>()
  for (const it of items)
    if (it.lv.topik) topikCount.set(it.lv.topik, (topikCount.get(it.lv.topik) ?? 0) + 1)
  log(
    `TOPIK：${[...topikCount]
      .sort()
      .map(([k, v]) => `${k}급 ${v}`)
      .join('，')}`
  )

  // 6. 写库
  const db = new LexDbWriter('ko')
  for (const s of [
    KRDICT_SRC,
    WIKTIONARY,
    TATOEBA,
    NIKL_STD2017,
    NIKL_VOCAB2003,
    TOPIK_SOURCE,
    FREQ_SUBTITLES,
    OPENCC,
    UNIHAN
  ])
    db.source(s)
  db.meta(
    'themes',
    THEMES.map((t) => ({ id: t.id, title: { zh: t.zh, en: t.en, ko: t.ko } }))
  )

  const ids = new Map<number, number>()
  let examples = 0
  let withZh = 0
  const zhTodo: { fr: number; line: string }[] = []
  // 常用的先写（词条号小的常用，读库时省事）
  const order = [...items].sort((a, b) => (a.fr ?? Infinity) - (b.fr ?? Infinity) || a.i - b.i)
  for (const it of order) {
    // 常用的（TOPIK 1–4 级、기초사전初中级、词频前五千）多收例句、收全变形表
    const rich = !!(
      (it.lv.topik && Number(it.lv.topik) <= 4) ||
      it.lv.krdict === '1' ||
      it.lv.krdict === '2' ||
      (it.fr ?? Infinity) <= 5000
    )
    const senses: LexSense[] = []
    if (it.kr) {
      for (const s of it.kr.senses) senses.push(krSense(db, s, rich, () => examples++))
    } else {
      for (const k of it.kk)
        for (const s of k.senses.slice(0, 8)) {
          const sense: LexSense = { en: s.glosses.slice(0, 3) }
          const t = s.tags.filter((x) =>
            /^(archaic|obsolete|dated|colloquial|slang|formal|literary|honorific|humble|vulgar|rare|dialectal|North-Korea)$/.test(
              x
            )
          )
          if (t.length) sense.t = t
          if (KK_POS[k.pos] && it.p.length > 1) sense.p = [KK_POS[k.pos]]
          senses.push(sense)
        }
    }
    if (!senses.length || senses.every((s) => !s.en?.length && !s.zh?.length && !s.mono?.length))
      continue
    const pron = (it.kr?.pron ?? []).flatMap(cleanPron)
    // 读音：第一项是기초사전的标准发音（韩文写，带长音记号：[학꾜]、[사ː람]），后面是维基词典的 IPA
    const krPron = [
      ...new Set((it.kr?.pron ?? []).flatMap((p) => p.split('/')).map((p) => p.trim()))
    ]
      .filter(Boolean)
      .map((p) => `[${p}]`)
    const ipa = [...krPron.slice(0, 2), ...new Set(it.kk.flatMap((k) => k.ipa))].slice(0, 3)
    const au = it.kk.flatMap((k) => k.audio).slice(0, 2)
    const isPred = !!it.conj
    const stemEnd = isPred ? [...it.w].length - 2 : undefined
    const sinoLen = it.hanja ? (/^\p{Script=Han}+/u.exec(it.hanja)?.[0].length ?? 0) : 0
    const rom = /\s|-/.test(it.w)
      ? romanize(it.w)
      : pron[0]
        ? romanizeFromPronunciation(it.w, pron[0], { noun: it.p[0] === 'noun' })
        : romanize(it.w, { stemEnd, sino: sinoLen, noun: it.p[0] === 'noun' })
    const x: Record<string, unknown> = {}
    if (it.hanja) x.hanja = it.hanja
    if (it.origin) x.origin = it.origin
    if (it.kr) x.krdict = it.kr.id
    const cls = [...clsLabels(it)]
    if (it.kr?.pos === '의존 명사' || it.kr?.pos === '보조 동사' || it.kr?.pos === '보조 형용사')
      cls.push(it.kr.pos)
    const forms = isPred ? trimForms(it, rich) : it.forms
    // 变形的读音：写法跟读法不一样的才写（먹었어요 [머거써요]、먹고 [먹꼬]、먹는 [멍는]）
    const fi: Record<string, string> = {}
    if (isPred)
      for (const [form] of forms ?? []) {
        const p = pronounce(form, { stemEnd, sino: sinoLen })
        if (p !== form) fi[form] = `[${p}]`
      }
    const src = [
      it.kr ? 'krdict' : null,
      it.kk.length ? 'wiktionary' : null,
      it.lv.kstd ? 'nikl-std2017' : null,
      it.lv.nikl2003 ? 'nikl-vocab2003' : null
    ].filter((s): s is string => !!s)
    const data: LexEntryData = {
      w: it.w,
      p: it.p,
      ...(ipa.length ? { ipa } : {}),
      ...(rom && rom !== it.w ? { rom } : {}),
      ...(au.length
        ? {
            au: au.map((a) => ({ url: a.url, label: a.label, license: 'CC BY-SA（维基共享资源）' }))
          }
        : {}),
      s: senses,
      ...(forms?.length ? { f: forms } : {}),
      ...(Object.keys(fi).length ? { fi } : {}),
      ...(cls.length ? { cls } : {}),
      ...(Object.keys(it.lv).length ? { lv: it.lv } : {}),
      // 词缀、词尾不算词频（-점、큰- 不跟名词「점」、形容词「크다」抢）
      ...(it.fr && it.p[0] !== 'affix' ? { fr: it.fr } : {}),
      ...(Object.keys(x).length ? { x } : {}),
      src
    }
    const id = db.entry(data)
    ids.set(it.i, id)
    for (const s of senses) for (const e of s.ex ?? []) db.link(e, id)
    if (it.hanja) for (const h of it.hanja.split('/')) if (h !== it.w) db.form(id, h, ['hanja'])
    for (const v of it.kr?.variants ?? []) db.form(id, v, ['alternative'])
    const subj = it.kr?.subj ? THEME_BY_KO.get(it.kr.subj) : undefined
    if (subj) db.list(`theme:${subj.id}`, id, it.fr)
    if (senses.some((s) => s.zh?.length)) withZh++
    else if (it.fr)
      zhTodo.push({
        fr: it.fr,
        line: [
          it.w,
          it.p.join(','),
          senses
            .flatMap((s) => s.en ?? [])
            .slice(0, 3)
            .join('; ')
        ].join('\t')
      })
  }
  log(`词条 ${ids.size}（有中文 ${withZh}），기초사전例句 ${examples}`)

  // Tatoeba：只收每个语节都对得上词条的句子（拼错的不要），挂到句中的词条上
  const tat = tatoeba(files)
  let tatN = 0
  for (const s of tat) {
    const words = tokenize(s.text).filter((t) => t.kind === 'word')
    const hits = words.map((w) => resolve(w.text))
    // 对不上的语节最多一个（人名之类）；拼错的句子一般不止一处，丢掉
    if (!words.length || hits.filter((h) => !h.length).length > 1) continue
    const entries = [
      ...new Set(
        hits
          .filter((h) => h.length)
          .map((h) => ids.get(h[0]))
          .filter((x): x is number => !!x)
      )
    ]
    db.example(
      {
        text: s.text,
        zh: s.zh ?? null,
        en: s.en ?? null,
        zs: s.zh ? 'tatoeba' : null,
        src: 'tatoeba'
      },
      entries
    )
    tatN++
  }
  log(`Tatoeba 例句 ${tatN}（共 ${tat.length} 句有中文或英文翻译）`)

  const stats = db.finish()
  log(
    `写好 ${stats.file}：${(stats.bytes / 1048576).toFixed(1)} MB，词条 ${stats.entries}，查词键 ${stats.forms}，例句 ${stats.examples}`
  )
  log(
    `词表：${Object.entries(stats.lists)
      .filter(([k]) => !k.startsWith('theme:'))
      .map(([k, v]) => `${k} ${v}`)
      .join(
        '，'
      )}；主题 ${Object.keys(stats.lists).filter((k) => k.startsWith('theme:')).length} 个`
  )

  // 7. 需要补中文的常用词
  mkdirSync('data/ko', { recursive: true })
  const todo = zhTodo.sort((a, b) => a.fr - b.fr).slice(0, 8000)
  writeFileSync(
    'data/ko/zh-todo.txt',
    '# 没有中文释义的常用词（按词频）：词头\t词性\t英文释义。由 scripts/data/ko/build.ts 生成\n' +
      todo.map((t) => t.line).join('\n') +
      '\n'
  )
  log(`data/ko/zh-todo.txt：${todo.length} 个`)
}

/** 变形表写库前删减：常用的谓词收全表，其余只收核心形式与词典给的活用形 */
function trimForms(it: Item, rich: boolean): [string, ...string[]][] {
  if (rich) return it.forms
  const core = new Set(
    (it.conj === 'v' ? VERB_CORE : ADJ_CORE).map((c) =>
      chainTags(c.split(' ').map((x) => (it.conj === 've' ? (VE_SWAP[x] ?? x) : x))).join(' ')
    )
  )
  return it.forms.filter((f) => core.has(f.slice(1).join(' ')) || f[1] === 'krdict')
}

/** 기초사전的一个义项：中英文译文、韩语释义、例句（常用词多收几句） */
function krSense(db: LexDbWriter, s: KrSense, rich: boolean, count: () => void): LexSense {
  const out: LexSense = {}
  const en: string[] = []
  if (s.enLemma && !NO_EN.test(s.enLemma)) en.push(...splitList(s.enLemma, /;/))
  // 英文的解释句只在没有对应词时收（助词、词尾这类）：反查只认对应词，解释句进反查表白占地方
  if (s.enDef && !en.length) en.push(s.enDef)
  if (en.length) out.en = en
  const zh: string[] = []
  if (s.zhLemma && !NO_ZH.test(s.zhLemma)) zh.push(s.zhLemma.replace(/\s+/g, ''))
  if (s.zhDef) zh.push(s.zhDef.trim())
  if (zh.length) {
    out.zh = zh
    out.zs = 'krdict'
  }
  const mono = [s.def]
  if (s.note) mono.push(s.note)
  if (s.pattern) mono.push(`문형: ${s.pattern.trim()}`)
  out.mono = mono.filter(Boolean)
  const t = noteTags(s.note)
  if (t.length) out.t = t
  // 例句：短语（구）、句子（문장）、对话（대화）
  const take = rich ? { 구: 2, 문장: 2, 대화: 1 } : { 구: 0, 문장: 1, 대화: 0 }
  const used: Record<string, number> = {}
  const ex: number[] = []
  for (const e of s.examples) {
    const kind = e.type === '구' || e.type === '문장' || e.type === '대화' ? e.type : '문장'
    if ((used[kind] ?? 0) >= take[kind]) continue
    used[kind] = (used[kind] ?? 0) + 1
    const text =
      kind === '대화'
        ? e.text.map((line, i) => `${i % 2 ? '나' : '가'}: ${line}`).join('\n')
        : e.text.join(' ')
    ex.push(db.example({ text, src: 'krdict' }))
    count()
  }
  if (ex.length) out.ex = ex
  for (const r of s.rel) {
    const k = REL[r.type]
    if (!k) continue
    const list = (out[k] ??= [])
    if (!list.includes(r.lemma)) list.push(r.lemma)
  }
  return out
}

/** Tatoeba：有中文或英文翻译的韩语句子 */
function tatoeba(files: Record<string, string>): { text: string; zh?: string; en?: string }[] {
  const bz = (p: string): string[] =>
    Bunzip.decode(readFileSync(p)).toString('utf8').split('\n').filter(Boolean)
  const kor = new Map<string, string>()
  for (const l of bz(files.korSentences)) {
    const [id, , text] = l.split('\t')
    kor.set(id, text)
  }
  const links = (p: string): Map<string, string[]> => {
    const m = new Map<string, string[]>()
    for (const l of bz(p)) {
      const [a, b] = l.split('\t')
      const list = m.get(a) ?? []
      list.push(b)
      m.set(a, list)
    }
    return m
  }
  const toCmn = links(files.korCmn)
  const toEng = links(files.korEng)
  const need = new Set([...toCmn.values(), ...toEng.values()].flat())
  const other = new Map<string, string>()
  for (const p of [files.cmnSentences, files.engSentences])
    for (const l of bz(p)) {
      const tab = l.indexOf('\t')
      const id = l.slice(0, tab)
      if (need.has(id)) other.set(id, l.slice(l.indexOf('\t', tab + 1) + 1))
    }
  const out: { text: string; zh?: string; en?: string }[] = []
  for (const [id, text] of kor) {
    const zh = toCmn
      .get(id)
      ?.map((x) => other.get(x))
      .find(Boolean)
    const en = toEng
      .get(id)
      ?.map((x) => other.get(x))
      .find(Boolean)
    if (zh || en) out.push({ text: text.normalize('NFC'), zh, en })
  }
  return out
}

if (!existsSync('scripts/data/run-ts.mjs')) throw new Error('要在仓库根目录运行')
await main()
