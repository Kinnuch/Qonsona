/**
 * 日语阅读器用的纯函数：分句、把分词结果并成学习者眼里的「词」、给汉字配振假名。
 * 分词本身（kuromoji + IPADIC）在主进程（src/main/ja-analyze.ts），这里只处理它的结果，测试里直接用。
 */
import { hasKanji, toHiragana } from './kana'

/** kuromoji 的一个词素，只留阅读器要用的 */
export interface JaToken {
  /** 原文里的写法 */
  s: string
  /** 原形（kuromoji 没有时同写法） */
  b: string
  /** 读音（平假名；没有读音的未知词为空串） */
  r: string
  /** 词性，如「動詞」「助動詞」 */
  pos: string
  /** 词性细分一、二（「自立」「非自立」「接続助詞」……） */
  p1: string
  p2: string
  /** 活用型（「一段」「特殊・タ」）与活用形（「連用形」「基本形」），不活用的为 '*' */
  ct: string
  cf: string
  /** 在整篇原文里的起止位置（码元下标） */
  start: number
  end: number
}

/** 阅读器上的一个词（一个或几个词素） */
export interface JaWord {
  surface: string
  start: number
  end: number
  /** 是不是词（标点、空白为 false） */
  word: boolean
  /** 整个词的读音（平假名），配振假名用 */
  reading: string
  /** 查词用的形式：打头那个词素的原形 */
  base: string
  /** 打头那个词素的词性 */
  pos: string
  /** 词典里对上的词条 */
  entryId?: number
  /** JLPT 等级：5 = N5 … 1 = N1 */
  jlpt?: number | null
  /** 一句释义（中文、英文） */
  zh?: string | null
  en?: string
}

export interface JaSentence {
  start: number
  end: number
  /** 第几段（从 0 起；空行、换行分段） */
  para: number
  words: JaWord[]
  /** 这一句的词素（语法匹配用） */
  tokens: JaToken[]
}

export interface GrammarHit {
  id: string
  /** 第几句 */
  sentence: number
  /** 在原文里的起止位置 */
  start: number
  end: number
}

export interface JaAnalysis {
  text: string
  sentences: JaSentence[]
  grammar: GrammarHit[]
}

/** 句末：。！？!? 以及紧跟着的收尾括号引号 */
const SENTENCE_END = /[。！？!?]+[」』）)】〉》"'’”]*/g

/** 分句：句末标点处断开，换行也断开（记下是第几段） */
export function splitSentences(text: string): { start: number; end: number; para: number }[] {
  const out: { start: number; end: number; para: number }[] = []
  let para = 0
  let pos = 0
  const lines = text.split('\n')
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const lineStart = pos
    pos += line.length + 1
    if (!line.trim()) {
      // 空行：下一段
      if (out.length && out[out.length - 1].para === para) para++
      continue
    }
    let from = 0
    SENTENCE_END.lastIndex = 0
    for (let m = SENTENCE_END.exec(line); m; m = SENTENCE_END.exec(line)) {
      const to = m.index + m[0].length
      // 「行こう！」と言った：引号里的感叹号后面接「と」「って」时，这一句还没完
      if (/^[とっ]/.test(line.slice(to))) continue
      pushTrimmed(out, line, lineStart, from, to, para)
      from = to
    }
    pushTrimmed(out, line, lineStart, from, line.length, para)
    // 每一行是一段（日文文章里换行一般就是分段）
    if (out.length && out[out.length - 1].para === para) para++
  }
  return out
}

function pushTrimmed(
  out: { start: number; end: number; para: number }[],
  line: string,
  offset: number,
  from: number,
  to: number,
  para: number
): void {
  let a = from
  let b = to
  while (a < b && /\s/.test(line[a])) a++
  while (b > a && /\s/.test(line[b - 1])) b--
  if (b > a) out.push({ start: offset + a, end: offset + b, para })
}

/** 不算词的：标点、符号、空白 */
const isWordToken = (t: JaToken): boolean => t.pos !== '記号' && !!t.s.trim()

/** 接在动词、形容词后面、并进同一个词的助动词（だ、です 这类接名词的另算一个词） */
function attachesAux(t: JaToken): boolean {
  return t.pos === '助動詞' && t.ct !== '特殊・ダ' && t.ct !== '特殊・デス'
}

/** 「て」「で」后面接这些非自立动词时并成一个词（食べている、食べてしまった） */
const AFTER_TE = new Set([
  'いる',
  'てる',
  'しまう',
  'ちゃう',
  'じゃう',
  'おく',
  'とく',
  'みる',
  'いく',
  'くる',
  'ある',
  'あげる',
  'くれる',
  'もらう',
  'くださる',
  'いただく',
  'やる',
  // 写汉字的（やって来る、見て置く……）
  '居る',
  '仕舞う',
  '置く',
  '見る',
  '行く',
  '来る',
  '有る',
  '上げる',
  '呉れる',
  '貰う',
  '下さる',
  '頂く',
  '遣る'
])

/**
 * 把词素并成词：动词、形容词连同后面的助动词、「て + 非自立动词」、「ば」、接尾的「そう」算一个词，
 * 查词时用打头那个词素的原形（食べてしまった → 食べる）。
 */
export function groupWords(tokens: JaToken[]): JaWord[] {
  const words: JaWord[] = []
  let i = 0
  while (i < tokens.length) {
    const head = tokens[i]
    let j = i + 1
    const inflecting = head.pos === '動詞' || head.pos === '形容詞'
    if (inflecting && isWordToken(head)) {
      for (;;) {
        const t = tokens[j]
        if (!t) break
        const prev = tokens[j - 1]
        if (attachesAux(t)) j++
        else if (t.pos === '動詞' && (t.p1 === '非自立' || t.p1 === '接尾') && prev.pos !== '助詞')
          j++
        else if (t.pos === '形容詞' && t.p1 === '非自立' && prev.pos === '動詞') j++
        else if (t.pos === '名詞' && t.p1 === '接尾' && t.p2 === '助動詞語幹') j++
        else if (t.pos === '助詞' && t.p1 === '接続助詞' && t.b === 'ば') j++
        else if (
          t.pos === '助詞' &&
          t.p1 === '接続助詞' &&
          (t.b === 'て' || t.b === 'で') &&
          tokens[j + 1]?.pos === '動詞' &&
          tokens[j + 1].p1 === '非自立' &&
          AFTER_TE.has(tokens[j + 1].b)
        )
          j += 2
        else break
      }
    }
    const part = tokens.slice(i, j)
    words.push({
      surface: part.map((t) => t.s).join(''),
      start: head.start,
      end: part[part.length - 1].end,
      word: isWordToken(head),
      reading: part.every((t) => t.r) ? part.map((t) => t.r).join('') : '',
      base: head.b && head.b !== '*' ? head.b : head.s,
      pos: head.pos
    })
    i = j
  }
  return words
}

/** 振假名的一段：ruby 为空的不用注音（假名、符号） */
export interface RubyPart {
  text: string
  ruby?: string
}

const KANA = /[぀-ゟ゠-ヿー]/

/**
 * 给一个词配振假名：假名部分照写，只给汉字（和数字、字母这类要读的）上面注音。
 * 对不上（读音里找不到写法里的假名）就整个词注一遍。
 */
export function furigana(surface: string, reading: string): RubyPart[] {
  if (!reading || !hasKanji(surface) || toHiragana(surface) === reading) return [{ text: surface }]
  // 切成「要注音」与「假名」交替的几段
  const runs: { text: string; kana: boolean }[] = []
  for (const ch of surface) {
    const kana = KANA.test(ch)
    const last = runs[runs.length - 1]
    if (last && last.kana === kana) last.text += ch
    else runs.push({ text: ch, kana })
  }
  const pattern = runs.map((r) => (r.kana ? escapeRe(toHiragana(r.text)) : '(.+?)')).join('')
  const m = new RegExp(`^${pattern}$`).exec(reading)
  if (!m) return [{ text: surface, ruby: reading }]
  let g = 1
  return runs.map((r) => (r.kana ? { text: r.text } : { text: r.text, ruby: m[g++] }))
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** kuromoji 给的片假名读音转成平假名（长音符照留） */
export const readingOf = (katakana: string | undefined): string =>
  katakana && katakana !== '*' ? toHiragana(katakana) : ''
