/**
 * 苏格兰盖尔语的规则：查词的键、切词、猜原形（纯函数；数据管线写 form 表、主进程查词都用这一份）。
 *
 * - 查词键：小写；旧拼写（《盖尔语正字法》GOC 之前的书刊）的锐音符 á é í ó ú 统一成重音符 à è ì ò ù。
 * - 宽松键：再去掉重音符、连字符和撇号（Gaidhlig、an-diugh）；空格留着，免得几个词连起来的短语撞上单词。
 * - 切词：撇号、连字符留在词里——a'（冠词 / 进行体小品词）、dh'fhalbh、's、m' 是一个词，
 *   an t-uisge 切成 an + t-uisge；句末的单引号、成对的引号不算进词。
 * - 猜原形：去掉 t- / h- / n-、省音的 dh' m' b'、弱化的 h、带连字符的强调后缀、动词与名词的词尾，
 *   再查 form 表（form 表里有维基词典的弱化形、属格、复数与变位，猜不到的才走这里）。
 *
 * 说明见 docs/lang/gd.md。改了 key / looseKey 要重建词典库（scripts/data/gd/build.ts）。
 */
import { stripMarks, tidy } from '../text'
import type { LangRules, LemmaGuess, RawToken } from '../types'
import {
  broadenings,
  delenite,
  looksLenited,
  stripElision,
  stripEmphatic,
  stripProthesis
} from './mutation'

const ACUTE_TO_GRAVE: Record<string, string> = {
  á: 'à',
  é: 'è',
  í: 'ì',
  ó: 'ò',
  ú: 'ù'
}

/** 查词键：tidy、小写、锐音符换成重音符、各种撇号与连字符统一、连续空白并成一个 */
export function gdKey(text: string): string {
  return tidy(text.replace(/[`\u00b4\u02bb]/g, "'"))
    .toLocaleLowerCase('gd')
    .replace(/[áéíóú]/g, (c) => ACUTE_TO_GRAVE[c])
    .replace(/[\u2010\u2011]/g, '-')
    .replace(/\s+/g, ' ')
}

/**
 * 宽松键：去掉重音符、连字符（Gaidhlig、an-diugh / andiugh）。
 * 撇号留着：省音的撇号是有意义的，去了 m'athair（我父亲）会撞上 màthair（母亲）、dhol 撞上 dh'òl。
 * 空格也留着：阅读器拿几个连着的词去对短语，去了空格 anns a' 会撞上 annsa、Is e 撞上 ise。
 * 旧拼写分写的 an diugh 另作为词形收进词典
 */
export function gdLooseKey(text: string): string {
  return stripMarks(gdKey(text)).replace(/-/g, '')
}

// ───────────────────────── 切词 ─────────────────────────

const APOS = "'\u2019\u2018\u02bc"
const isApos = (ch: string | undefined): boolean => !!ch && APOS.includes(ch)
const isLetter = (ch: string | undefined): boolean => !!ch && /[\p{L}\p{M}]/u.test(ch)
const isHyphen = (ch: string | undefined): boolean =>
  ch === '-' || ch === '\u2010' || ch === '\u2011'

/** 词尾带撇号的省音形（a' dh' m' d' b' th' bh' ars'……）：撇号算进词里 */
const TRAILING_ELISIONS = new Set([
  'a',
  'dh',
  'm',
  'd',
  'b',
  'th',
  'bh',
  'ars',
  'o',
  'do',
  'ri',
  'le'
])
/** 词首带撇号的省音形（'s 'n 'na 'nam 'ga 'sa 'nuair……）：撇号算进词里 */
const LEADING_ELISIONS = new Set([
  's',
  'n',
  'na',
  'nam',
  'nan',
  'nad',
  'nar',
  'nur',
  'ga',
  'gam',
  'gan',
  'gad',
  'gar',
  'gur',
  'sa',
  'san',
  'sna',
  'nuair',
  'ic',
  'ille',
  'eil'
])

/**
 * 切词：词（字母，中间可以有撇号、连字符）、数字、标点、空白，首尾相接覆盖全文。
 * a' chaileag → a' | chaileag；an t-uisge → an | t-uisge；'S e → 'S | e；dh'fhalbh 是一个词。
 */
export function tokenizeGd(text: string): RawToken[] {
  const out: RawToken[] = []
  const n = text.length
  let i = 0
  const push = (start: number, end: number, kind: RawToken['kind']): void => {
    out.push({ text: text.slice(start, end), start, end, kind })
  }
  while (i < n) {
    const ch = text[i]
    if (/\s/u.test(ch)) {
      let j = i + 1
      while (j < n && /\s/u.test(text[j])) j++
      push(i, j, 'space')
      i = j
      continue
    }
    // 数字：21、3.5、1,000；序数与年代的后缀（1d、2na、3s、4mh、1990an）算在数字里
    if (/\p{N}/u.test(ch)) {
      let j = i + 1
      while (
        j < n &&
        (/\p{N}/u.test(text[j]) || (/[.,]/.test(text[j]) && /\p{N}/u.test(text[j + 1] ?? '')))
      )
        j++
      const suffix = /^(mh|na|an|d|s)(?![\p{L}])/u.exec(text.slice(j, j + 3))
      if (suffix) j += suffix[1].length
      push(i, j, 'num')
      i = j
      continue
    }
    // 词首撇号：'s 'n 'na 'ga……（前面是开头、空白或标点，后面是已知的省音形）
    if (isApos(ch) && isLetter(text[i + 1]) && (i === 0 || !isLetter(text[i - 1]))) {
      let j = i + 1
      while (j < n && isLetter(text[j])) j++
      if (LEADING_ELISIONS.has(text.slice(i + 1, j).toLowerCase())) {
        const end = scanWord(text, i + 1)
        push(i, end, 'word')
        i = end
        continue
      }
    }
    if (isLetter(ch)) {
      const end = scanWord(text, i)
      push(i, end, 'word')
      i = end
      continue
    }
    push(i, i + 1, 'punct')
    i++
  }
  return out
}

/** 从 start 往后读一个词：字母、词中的撇号与连字符；词尾的撇号只在省音形（a' dh'）后面算进来 */
function scanWord(text: string, start: number): number {
  const n = text.length
  let j = start
  while (j < n) {
    if (isLetter(text[j])) {
      j++
      continue
    }
    // 词中的撇号（dh'fhalbh）；撇号后接连字符（bàt'-aiseig）
    if (isApos(text[j]) && isLetter(text[j + 1])) {
      j++
      continue
    }
    if (isApos(text[j]) && isHyphen(text[j + 1]) && isLetter(text[j + 2])) {
      j += 2
      continue
    }
    // 词中的连字符（t-uisge、a-nis、Dùn-Èideann）
    if (isHyphen(text[j]) && isLetter(text[j + 1])) {
      j++
      continue
    }
    // 词尾的撇号：只跟在 a' dh' m' b' 这类省音形后面
    if (isApos(text[j]) && !isLetter(text[j + 1])) {
      const last =
        text
          .slice(start, j)
          .split(/[-'\u2019\u2018\u02bc]/)
          .pop() ?? ''
      if (TRAILING_ELISIONS.has(last.toLowerCase())) j++
    }
    break
  }
  return j
}

// ───────────────────────── 猜原形 ─────────────────────────

/** 整个词就是省音形、form 表里可能没有的：对到全写 */
const CLITICS: Record<string, [string, string[]][]> = {
  "'n": [['an', ['elision']]],
  "'s": [
    ['is', ['elision']],
    ['agus', ['elision']]
  ],
  "a'": [
    ['an', ['elision']],
    ['ag', ['elision']]
  ],
  "dh'": [['do', ['elision']]],
  "m'": [['mo', ['elision']]],
  "d'": [['do', ['elision']]],
  "b'": [['bu', ['elision']]],
  "th'": [['tha', ['elision']]],
  "bh'": [['bha', ['elision']]],
  "o'n": [['bhon', ['elision']]],
  "do'n": [['dhan', ['elision']]]
}

/** 动词词尾：去掉后剩下词根（òlaidh → òl、chuireadh → chuir → cuir）；[词尾, 标签] */
const VERB_ENDINGS: [string, string[]][] = [
  ['eamaid', ['first-person', 'plural']],
  ['amaid', ['first-person', 'plural']],
  ['teadh', ['conditional', 'impersonal']],
  ['tadh', ['conditional', 'impersonal']],
  ['eadh', ['conditional']],
  ['adh', ['conditional']],
  ['ainn', ['conditional', 'first-person', 'singular']],
  ['inn', ['conditional', 'first-person', 'singular']],
  ['aidh', ['future']],
  ['idh', ['future']],
  ['eas', ['future', 'relative']],
  ['as', ['future', 'relative']],
  ['tear', ['future', 'impersonal']],
  ['tar', ['future', 'impersonal']],
  ['ear', ['future', 'impersonal']],
  ['ar', ['future', 'impersonal']],
  ['aibh', ['imperative', 'plural']],
  ['ibh', ['imperative', 'plural']],
  ['eam', ['imperative', 'first-person', 'singular']],
  ['am', ['imperative', 'first-person', 'singular']],
  ['te', ['participle', 'past']],
  ['ta', ['participle', 'past']]
]

/** 名词、形容词词尾：复数、属格（bàtaichean → bàta、sràide → sràid） */
const NOUN_ENDINGS: [string, string[]][] = [
  ['aichean', ['plural']],
  ['ichean', ['plural']],
  ['eachan', ['plural']],
  ['achan', ['plural']],
  ['eannan', ['plural']],
  ['annan', ['plural']],
  ['tean', ['plural']],
  ['ean', ['plural']],
  ['an', ['plural']],
  ['e', ['genitive']],
  ['a', ['genitive']]
]

interface Base {
  word: string
  tags: string[]
}

/** 词首加的字母用维基词典（与界面）的标签词：t- / h- 是 prothesis，n- 在元音前是鼻化（eclipsis）留下的 */
export const PROTHESIS_TAG: Record<'t' | 'h' | 'n', string> = {
  t: 't-prothesis',
  h: 'h-prothesis',
  n: 'eclipsis'
}

/**
 * form 表查不到时，猜原形。按把握从大到小排：整词省音形 → 去词首加的 t- h- n- 与省音 →
 * 去带连字符的强调后缀 → 去弱化 → 去词尾（动词、名词）→ 去窄化。同一个原形只留第一种猜法。
 * 带空格的（阅读器拿几个连着的词去对短语）不猜：短语只认词典里原样有的，免得 na h-òrain 被猜成一个词
 */
export function lemmaCandidatesGd(surface: string): LemmaGuess[] {
  const out: LemmaGuess[] = []
  const start = gdKey(surface)
  if (!start || /\s/.test(start)) return out
  const seen = new Set<string>([start])
  const add = (lemma: string, tags: string[]): void => {
    const k = gdKey(lemma)
    if (!k || seen.has(k)) return
    seen.add(k)
    out.push({ lemma: k, tags })
  }
  for (const [lemma, tags] of CLITICS[start] ?? []) add(lemma, tags)

  // 第一步：词首、词尾附加的东西（可能叠在一起：'s → s；dh'fhalbh → fhalbh）
  const bases: Base[] = [{ word: start, tags: [] }]
  const lead = /^'(\p{L}.*)$/u.exec(start)
  if (lead) {
    if (lead[1] === 'n') add('an', ['elision'])
    bases.push({ word: lead[1], tags: ['elision'] })
  }
  for (const b of [...bases]) {
    const pro = stripProthesis(b.word)
    if (pro) bases.push({ word: pro.rest, tags: [...b.tags, PROTHESIS_TAG[pro.prefix]] })
    const eli = stripElision(b.word)
    if (eli) bases.push({ word: eli.rest, tags: [...b.tags, 'elision'] })
  }
  for (const b of [...bases]) {
    const emp = stripEmphatic(b.word)
    if (emp) bases.push({ word: emp, tags: [...b.tags, 'emphatic'] })
  }
  // 带前缀的复合词（ro-mhath、neo-àbhaisteach、ath-sgrìobhadh）：连字符后的部分也试
  for (const b of [...bases]) {
    const parts = b.word.split('-')
    if (parts.length === 2 && parts[0].length <= 4 && parts[1].length >= 2)
      bases.push({ word: parts[1], tags: b.tags })
  }
  // 复合词后一半在属格里常弱化（deireadh-sheachdain ← deireadh-seachdain、sgoil-shamhraidh）：去掉再试
  for (const b of [...bases]) {
    const parts = b.word.split('-')
    if (parts.length < 2) continue
    const d = parts.map((p, i) => (i > 0 ? (delenite(p) ?? p) : p)).join('-')
    if (d !== b.word) bases.push({ word: d, tags: [...b.tags, 'lenition'] })
  }
  // luchd-X 是 neach-X 的复数（luchd-teagaisg「老师们」← neach-teagaisg）
  for (const b of [...bases])
    if (b.word.startsWith('luchd-'))
      bases.push({ word: 'neach-' + b.word.slice(6), tags: [...b.tags, 'plural'] })
  for (const b of bases) add(b.word, b.tags)

  // 第二步：去弱化
  const withLen: Base[] = [...bases]
  for (const b of bases) {
    const d = delenite(b.word)
    if (d) {
      withLen.push({ word: d, tags: [...b.tags, 'lenition'] })
      add(d, [...b.tags, 'lenition'])
    }
  }

  // 第三步：词尾（动词、名词），在原形和去弱化的形式上都试
  const suffixed: Base[] = []
  for (const b of withLen) {
    const w = b.word
    if (w.length < 4) continue
    for (const [end, tags] of VERB_ENDINGS)
      if (w.length > end.length + 1 && w.endsWith(end))
        suffixed.push({ word: w.slice(0, -end.length), tags: [...b.tags, ...tags] })
    for (const [end, tags] of NOUN_ENDINGS)
      if (w.length > end.length + 2 && w.endsWith(end))
        suffixed.push({ word: w.slice(0, -end.length), tags: [...b.tags, ...tags] })
  }
  for (const s of suffixed) add(s.word, s.tags)

  // 第四步：去窄化（balaich → balach、cait → cat、eilein → eilean；属格、复数）
  for (const b of [...withLen, ...suffixed]) for (const w of broadenings(b.word)) add(w, b.tags)
  // 最后：词尾元音省掉、撇号又没跟上的（Fàilt' ort 的 fàilt、duin' eile 的 duin）
  for (const b of withLen)
    if (/[^aeiouàèìòù]$/.test(b.word) && b.word.length >= 3)
      for (const v of ['e', 'a']) add(b.word + v, [...b.tags, 'elision'])
  // 实在查不到的连字符复合词，给前一半（中心词）：seisean-fiosrachaidh「说明会」→ seisean「会」
  const head = /^([^-]{3,})-[^-]{3,}/.exec(start)
  if (head) {
    add(head[1], ['compound'])
    const d = delenite(head[1])
    if (d) add(d, ['compound', 'lenition'])
  }
  return out.slice(0, 40)
}

/** 词首是不是弱化了（给阅读器标记、练习用） */
export const isLenitedForm = looksLenited

export const rules: LangRules = {
  key: gdKey,
  looseKey: gdLooseKey,
  tokenize: tokenizeGd,
  lemmaCandidates: lemmaCandidatesGd
}
