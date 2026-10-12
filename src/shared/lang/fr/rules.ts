/**
 * 法语的规则：查词的键、切词、猜原形（纯函数；数据管线写 form 表、主进程查词、阅读器切词都用这一份）。
 *
 * 跟日语不一样的地方：
 * - 拉丁字母、词间有空格，但省音把两个词粘在一起（l'homme、qu'il、s'il），倒装和肯定命令式用连字符挂代词
 *   （dit-il、a-t-il、donne-le-moi、va-t'en）；复合词也用连字符（porte-monnaie、après-midi、peut-être），
 *   所以连字符不能一律拆、也不能一律不拆：只把末尾挂着的代词（及 -ci、-là）拆下来。
 *   aujourd'hui、jusqu'à、quelqu'un、presqu'île 这类整个是一个词，不拆。
 * - 查词键：NFC、小写、弯撇号换直撇号、各种连字符换成 -、不换行空格（法语在 ; : ! ? 前用窄空格）换成普通空格。
 *   宽松键再去掉重音（é → e、ç → c）、把连写字母拆开（œ → oe、æ → ae）、词中的连字符当空格：
 *   键盘打不出重音、写成 coeur、porte monnaie 都查得到。
 * - 猜原形（form 表里查不到时才用；词典的变形表已经很全，这里兜底生僻词、新词、打错的）：
 *   省音、缩合（au、du）、倒装挂的代词、名词形容词的复数与阴性、动词变位（-er 的拼写变化：ç、ge、è/é、
 *   双写辅音、y/i）、-ment 副词。
 */
import { defaultKey, stripMarks } from '../text'
import type { LangRules, LemmaGuess, RawToken } from '../types'

// ───────────────────────── 查词键 ─────────────────────────

/** 严格键：NFC、小写、统一撇号、连字符、空格 */
export function frKey(text: string): string {
  return defaultKey(
    text
      .replace(/\u00ad/g, '')
      .replace(/[\u2010\u2011]/g, '-')
      .replace(/[\s\u00a0\u202f\u2007\u2009]+/g, ' '),
    'fr'
  )
}

/**
 * 宽松键：再去掉重音与变音符号、拆开 œ æ、词中的连字符当空格。
 * 带空格的多词说法不去重音：a jamais ≠ à jamais、ou bien ≠ où bien——阅读器拿连着的几个词去查多词词条，
 * 去了重音会把「il n'a jamais」并成 à jamais
 */
export function frLooseKey(text: string): string {
  const k = frKey(text)
  if (/\s/.test(k)) return k
  return stripMarks(k)
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/(?<=\S)-(?=\S)/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
}

// ───────────────────────── 切词 ─────────────────────────

/** 可以省音、后面跟撇号的词（l' d' j' m' t' s' c' n' qu' ç' 和几个以 -que 结尾的连词、副词） */
const ELIDED = 'l|d|j|m|t|s|c|n|qu|ç|lorsqu|puisqu|quoiqu|jusqu|presqu|quelqu'
const ELISION_PREFIX = new RegExp(`^(?:${ELIDED})'(?=[\\p{L}\\p{N}])`, 'iu')
const ELIDED_WORD = new RegExp(`^(?:${ELIDED})'$`, 'iu')
const ELIDED_STEM = new RegExp(`^(?:${ELIDED})$`, 'iu')

/** 带撇号或连字符、但整个是一个词的（不拆）；比较时用 frKey */
const LEXICALIZED = new Set([
  "aujourd'hui",
  "jusqu'à",
  "jusqu'au",
  "jusqu'aux",
  "jusqu'ici",
  "jusqu'où",
  "jusqu'alors",
  "quelqu'un",
  "quelqu'une",
  "presqu'île",
  "presqu'îles",
  "prud'homme",
  "prud'hommes",
  "prud'homal",
  "prud'homale",
  "prud'homie",
  "entr'acte",
  "c'est-à-dire",
  "main-d'œuvre",
  "mains-d'œuvre",
  "chef-d'œuvre",
  "chefs-d'œuvre",
  "hors-d'œuvre",
  "m'as-tu-vu",
  "qu'en-dira-t-on",
  'rendez-vous',
  'sauve-qui-peut',
  'va-t-en-guerre',
  'chez-moi',
  'chez-soi',
  'chez-toi',
  'jusque-là',
  'par-ci',
  'par-là',
  'de-ci',
  'de-là'
])

/** 末尾可以用连字符挂上去的：主语与宾语代词（倒装、肯定命令式）、指示的 -ci / -là，以及 m'en、t'y 这类 */
const CLITIC =
  /^(?:je|tu|il|elle|on|nous|vous|ils|elles|ce|le|la|les|lui|leur|moi|toi|y|en|t|ci|là|[mtl]'(?:en|y))$/iu
/** 这些后面的 -ci / -là 不拆（celui-ci 是一个代词） */
const DEMONSTRATIVE_BASE = /^(?:celui|celle|ceux|celles)$/iu

const LETTER = /[\p{L}\p{M}]/u
const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u
const HYPHEN = /[-\u2010\u2011]/
const APOS = /['\u2019]/

type Piece = [text: string, kind: RawToken['kind']]

const straight = (s: string): string => s.replace(/\u2019/g, "'")

/** 一个由字母、撇号、连字符连成的片段拆成几个词（见文件开头的说明） */
export function splitRun(run: string): Piece[] {
  if (LEXICALIZED.has(frKey(run))) return [[run, 'word']]
  // 开头的省音：qu'il → qu' + il；qu'aujourd'hui → qu' + aujourd'hui
  const m = ELISION_PREFIX.exec(straight(run))
  if (m) return [[run.slice(0, m[0].length), 'word'], ...splitRun(run.slice(m[0].length))]
  if (!HYPHEN.test(run)) return [[run, kindOf(run)]]
  // 连字符：只把末尾一串挂着的代词拆下来
  const parts: { text: string; start: number }[] = []
  let start = 0
  for (let i = 0; i <= run.length; i++) {
    if (i === run.length || HYPHEN.test(run[i])) {
      parts.push({ text: run.slice(start, i), start })
      start = i + 1
    }
  }
  if (parts.some((p) => !p.text)) return [[run, kindOf(run)]]
  let k = parts.length
  while (k > 1 && CLITIC.test(straight(parts[k - 1].text))) k--
  if (k === parts.length) return [[run, kindOf(run)]]
  const base = run.slice(0, parts[k].start - 1)
  const tail = parts.slice(k).map((p) => p.text.toLowerCase())
  // celui-ci、celles-là：整个是一个代词
  if (tail.every((t) => t === 'ci' || t === 'là') && DEMONSTRATIVE_BASE.test(base))
    return [[run, 'word']]
  const out: Piece[] = [...splitRun(base)]
  let hyphenDone = false
  for (let i = k; i < parts.length; i++) {
    const p = parts[i]
    const hyphen = run[p.start - 1]
    if (p.text.toLowerCase() === 't' && i < parts.length - 1) {
      // 读音上加的 t：a-t-il 的 -t- 整个当标点
      out.push([hyphen + p.text + run[p.start + p.text.length], 'punct'])
      hyphenDone = true
      continue
    }
    if (!hyphenDone) out.push([hyphen, 'punct'])
    hyphenDone = false
    out.push(...splitRun(p.text))
  }
  return out
}

function kindOf(text: string): RawToken['kind'] {
  return LETTER.test(text) ? 'word' : 'num'
}

/** 一个片段末尾的撇号算不算这个词的一部分（jusqu' 后面换了行、l' 后面多打了空格） */
function keepsTrailingApostrophe(run: string): boolean {
  return ELIDED_STEM.test(run.split(HYPHEN).pop() ?? '')
}

/** 数字：1 000 000（千位用空格、不换行空格隔开）、3,14；1er、2e、XXIe 之类的序数后缀算在一起 */
const NUMBER = /\d{1,3}(?:[ \u00a0\u202f]\d{3}(?!\d))+(?:,\d+)?|\d+(?:[.,]\d+)*/y
const ORDINAL_SUFFIX = /(?:ères?|ers?|res?|èmes?|es?|ᵉʳ|ʳᵉ|ᵉ)(?![\p{L}\p{M}\p{N}])/uy
/** 钟点：16h00、8h、8h30（h 后面跟着分钟）；连着写的时间当一个数 */
const CLOCK = /h(?:\d{2})?(?![\p{L}\p{M}\p{N}])/uy

/**
 * 切词：词、数字、标点、空白各成一段，首尾相接覆盖全文。
 * 省音拆开（l' + homme），倒装与命令式挂的代词拆开（dit + - + il、a + -t- + il），复合词不拆。
 */
export function tokenize(text: string): RawToken[] {
  const out: RawToken[] = []
  const push = (t: string, kind: RawToken['kind'], at: number): void => {
    out.push({ text: t, start: at, end: at + t.length, kind })
  }
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (/\s/u.test(ch)) {
      let j = i + 1
      while (j < text.length && /\s/u.test(text[j])) j++
      push(text.slice(i, j), 'space', i)
      i = j
      continue
    }
    if (/\d/.test(ch)) {
      NUMBER.lastIndex = i
      const m = NUMBER.exec(text)!
      let j = i + m[0].length
      ORDINAL_SUFFIX.lastIndex = j
      CLOCK.lastIndex = j
      const suf = ORDINAL_SUFFIX.exec(text) ?? (/^\d{1,2}$/.test(m[0]) ? CLOCK.exec(text) : null)
      if (suf) j += suf[0].length
      else if (j < text.length && LETTER.test(text[j])) {
        // 数字后面直接连着字母的（3D、4x4、MP3 以外的）当一个词
        let k = j
        while (k < text.length && WORD_CHAR.test(text[k])) k++
        push(text.slice(i, k), 'word', i)
        i = k
        continue
      }
      push(text.slice(i, j), 'num', i)
      i = j
      continue
    }
    if (WORD_CHAR.test(ch)) {
      // 一个片段：字母数字，中间可以夹单个撇号或连字符
      let j = i + 1
      for (;;) {
        while (j < text.length && WORD_CHAR.test(text[j])) j++
        if (
          j + 1 < text.length &&
          (APOS.test(text[j]) || HYPHEN.test(text[j])) &&
          WORD_CHAR.test(text[j + 1])
        ) {
          j += 1
          continue
        }
        break
      }
      if (j < text.length && APOS.test(text[j]) && keepsTrailingApostrophe(text.slice(i, j))) j++
      let at = i
      for (const [t, kind] of splitRun(text.slice(i, j))) {
        push(t, kind, at)
        at += t.length
      }
      i = j
      continue
    }
    // 标点：省略号、连着的 ?! 算一段，其余一个字符一段（代理对算一个字符）
    let j = i + 1
    if (ch === '.' || ch === '!' || ch === '?') while (j < text.length && /[.!?]/.test(text[j])) j++
    else if (text.codePointAt(i)! > 0xffff) j = i + 2
    push(text.slice(i, j), 'punct', i)
    i = j
  }
  return out
}

// ───────────────────────── 猜原形 ─────────────────────────

/** 省音的词 → 原来的词 */
const ELISION: Record<string, string[]> = {
  "l'": ['le', 'la'],
  "d'": ['de'],
  "j'": ['je'],
  "m'": ['me'],
  "t'": ['te'],
  "s'": ['se', 'si'],
  "c'": ['ce'],
  "n'": ['ne'],
  "qu'": ['que'],
  "ç'": ['ça'],
  "lorsqu'": ['lorsque'],
  "puisqu'": ['puisque'],
  "quoiqu'": ['quoique'],
  "jusqu'": ['jusque'],
  "presqu'": ['presque'],
  "quelqu'": ['quelque']
}

/** 缩合：介词 + 冠词 */
const CONTRACTION: Record<string, [string, string][]> = {
  au: [
    ['à', 'contraction'],
    ['le', 'contraction']
  ],
  aux: [
    ['à', 'contraction'],
    ['le', 'contraction']
  ],
  du: [
    ['de', 'contraction'],
    ['le', 'contraction']
  ],
  des: [
    ['de', 'contraction'],
    ['un', 'plural']
  ],
  ès: [
    ['en', 'contraction'],
    ['le', 'contraction']
  ]
}

/** 不规则的：复数、阴性、元音前的形式、限定词 */
const IRREGULAR: Record<string, [string, string]> = {
  yeux: ['œil', 'plural'],
  cieux: ['ciel', 'plural'],
  aïeux: ['aïeul', 'plural'],
  messieurs: ['monsieur', 'plural'],
  mesdames: ['madame', 'plural'],
  mesdemoiselles: ['mademoiselle', 'plural'],
  bonshommes: ['bonhomme', 'plural'],
  gentilshommes: ['gentilhomme', 'plural'],
  belle: ['beau', 'feminine'],
  belles: ['beau', 'feminine'],
  bel: ['beau', 'before-vowel'],
  nouvelle: ['nouveau', 'feminine'],
  nouvelles: ['nouveau', 'feminine'],
  nouvel: ['nouveau', 'before-vowel'],
  vieille: ['vieux', 'feminine'],
  vieilles: ['vieux', 'feminine'],
  vieil: ['vieux', 'before-vowel'],
  folle: ['fou', 'feminine'],
  folles: ['fou', 'feminine'],
  fol: ['fou', 'before-vowel'],
  molle: ['mou', 'feminine'],
  mol: ['mou', 'before-vowel'],
  fraîche: ['frais', 'feminine'],
  fraiche: ['frais', 'feminine'],
  sèche: ['sec', 'feminine'],
  douce: ['doux', 'feminine'],
  rousse: ['roux', 'feminine'],
  fausse: ['faux', 'feminine'],
  grecque: ['grec', 'feminine'],
  turque: ['turc', 'feminine'],
  bénigne: ['bénin', 'feminine'],
  maligne: ['malin', 'feminine'],
  gentille: ['gentil', 'feminine'],
  favorite: ['favori', 'feminine'],
  longue: ['long', 'feminine'],
  blanche: ['blanc', 'feminine'],
  franche: ['franc', 'feminine'],
  publique: ['public', 'feminine'],
  cette: ['ce', 'feminine'],
  cet: ['ce', 'before-vowel'],
  ces: ['ce', 'plural'],
  une: ['un', 'feminine'],
  la: ['le', 'feminine'],
  les: ['le', 'plural'],
  ma: ['mon', 'feminine'],
  mes: ['mon', 'plural'],
  ta: ['ton', 'feminine'],
  tes: ['ton', 'plural'],
  sa: ['son', 'feminine'],
  ses: ['son', 'plural'],
  nos: ['notre', 'plural'],
  vos: ['votre', 'plural'],
  leurs: ['leur', 'plural'],
  quelle: ['quel', 'feminine'],
  quels: ['quel', 'plural'],
  quelles: ['quel', 'feminine'],
  toute: ['tout', 'feminine'],
  tous: ['tout', 'plural'],
  toutes: ['tout', 'feminine'],
  aucune: ['aucun', 'feminine']
}

/** 阴性 → 阳性（形容词、表人的名词）：[阴性词尾, 阳性词尾] */
const FEMININE: [string, string][] = [
  ['euse', 'eux'],
  ['euse', 'eur'],
  ['rice', 'eur'],
  ['eresse', 'eur'],
  ['ière', 'ier'],
  ['ère', 'er'],
  ['ive', 'if'],
  ['ve', 'f'],
  ['elle', 'el'],
  ['eille', 'eil'],
  ['ille', 'il'],
  ['enne', 'en'],
  ['onne', 'on'],
  ['ette', 'et'],
  ['ète', 'et'],
  ['esse', 'e'],
  ['sse', 's'],
  ['che', 'c'],
  ['que', 'c'],
  ['gue', 'g'],
  ['ouce', 'oux'],
  ['ousse', 'oux'],
  ['ausse', 'aux'],
  ['ée', 'é'],
  ['e', '']
]

/** 复数 → 单数：[复数词尾, 单数词尾] */
const PLURAL: [string, string][] = [
  ['aux', 'al'],
  ['aux', 'ail'],
  ['eaux', 'eau'],
  ['eux', 'eu'],
  ['oux', 'ou'],
  ['s', ''],
  ['x', '']
]

/**
 * 动词词尾 → 不定式词尾。长的先试；同一个词尾可以对几种不定式（-er 动词最多，先列）。
 * 第三组的不规则动词词典里都有完整的变位表，这里只管规则的变化。
 */
const VERB: [ending: string, infinitives: string[], tag: string][] = [
  ['issaient', ['ir'], 'imperfect'],
  ['issions', ['ir'], 'present'],
  ['eraient', ['er'], 'conditional'],
  ['iraient', ['ir'], 'conditional'],
  ['assions', ['er'], 'subjunctive'],
  ['assiez', ['er'], 'subjunctive'],
  ['issiez', ['ir'], 'present'],
  ['issent', ['ir'], 'present'],
  ['issons', ['ir'], 'present'],
  ['issais', ['ir'], 'imperfect'],
  ['issait', ['ir'], 'imperfect'],
  ['issant', ['ir'], 'participle'],
  ['assent', ['er'], 'subjunctive'],
  ['erions', ['er'], 'conditional'],
  ['irions', ['ir'], 'conditional'],
  ['eriez', ['er'], 'conditional'],
  ['iriez', ['ir'], 'conditional'],
  ['erais', ['er'], 'conditional'],
  ['erait', ['er'], 'conditional'],
  ['irais', ['ir'], 'conditional'],
  ['irait', ['ir'], 'conditional'],
  ['erons', ['er'], 'future'],
  ['eront', ['er'], 'future'],
  ['irons', ['ir'], 'future'],
  ['iront', ['ir'], 'future'],
  ['raient', ['re'], 'conditional'],
  ['èrent', ['er'], 'past'],
  ['irent', ['ir', 're'], 'past'],
  ['aient', ['er', 're', 'ir'], 'imperfect'],
  ['asses', ['er'], 'subjunctive'],
  ['isses', ['ir'], 'subjunctive'],
  ['issez', ['ir'], 'present'],
  ['erez', ['er'], 'future'],
  ['irez', ['ir'], 'future'],
  ['erai', ['er'], 'future'],
  ['eras', ['er'], 'future'],
  ['irai', ['ir'], 'future'],
  ['iras', ['ir'], 'future'],
  ['rons', ['re'], 'future'],
  ['ront', ['re'], 'future'],
  ['rais', ['re'], 'conditional'],
  ['rait', ['re'], 'conditional'],
  ['âmes', ['er'], 'past'],
  ['âtes', ['er'], 'past'],
  ['îmes', ['ir', 're'], 'past'],
  ['îtes', ['ir', 're'], 'past'],
  ['asse', ['er'], 'subjunctive'],
  ['isse', ['ir'], 'subjunctive'],
  ['ions', ['er', 're', 'ir'], 'imperfect'],
  ['era', ['er'], 'future'],
  ['ira', ['ir'], 'future'],
  ['rez', ['re'], 'future'],
  ['rai', ['re'], 'future'],
  ['ras', ['re'], 'future'],
  ['ées', ['er'], 'participle'],
  ['ies', ['ir'], 'participle'],
  ['ues', ['re'], 'participle'],
  ['ais', ['er', 're', 'ir'], 'imperfect'],
  ['ait', ['er', 're', 'ir'], 'imperfect'],
  ['iez', ['er', 're', 'ir'], 'imperfect'],
  ['ant', ['er', 're', 'ir'], 'participle'],
  ['ons', ['er', 're', 'ir'], 'present'],
  ['ent', ['er', 're', 'ir'], 'present'],
  ['ez', ['er', 're', 'ir'], 'present'],
  ['ât', ['er'], 'subjunctive'],
  ['ît', ['ir', 're'], 'subjunctive'],
  ['ée', ['er'], 'participle'],
  ['és', ['er'], 'participle'],
  ['ie', ['ir'], 'participle'],
  ['is', ['ir', 're'], 'present'],
  ['it', ['ir', 're'], 'present'],
  ['ue', ['re'], 'participle'],
  ['us', ['re'], 'participle'],
  ['ra', ['re'], 'future'],
  ['es', ['er'], 'present'],
  ['ai', ['er'], 'past'],
  ['as', ['er'], 'past'],
  ['é', ['er'], 'participle'],
  ['e', ['er'], 'present'],
  ['a', ['er'], 'past'],
  ['i', ['ir'], 'participle'],
  ['u', ['re'], 'participle'],
  ['s', ['re', 'ir'], 'present'],
  ['t', ['re', 'ir'], 'present']
]

/** 第一组动词的词干在变位里会变：把变过的词干还原（可能几种） */
function erStems(stem: string, ending: string): string[] {
  const out = [stem]
  const soft = /^[aoâ]/.test(ending)
  if (soft && stem.endsWith('ç')) out.push(stem.slice(0, -1) + 'c') // plaçons → placer
  if (soft && stem.endsWith('ge')) out.push(stem.slice(0, -1)) // mangeons → manger
  // lève → lever、cède → céder：词干最后一个 è 还原成 e 或 é
  const e = stem.lastIndexOf('è')
  if (e >= 0 && e >= stem.length - 4) {
    out.push(stem.slice(0, e) + 'e' + stem.slice(e + 1))
    out.push(stem.slice(0, e) + 'é' + stem.slice(e + 1))
  }
  // appelle → appeler、jette → jeter
  if (/e(ll|tt)$/.test(stem)) out.push(stem.slice(0, -1))
  // paie → payer、emploie → employer、essuie → essuyer
  if (/[aou]i$/.test(stem)) out.push(stem.slice(0, -1) + 'y')
  return out
}

/** form 表里查不到时猜原形：越可能的越靠前，不含原词 */
export function lemmaCandidates(surface: string): LemmaGuess[] {
  const word = frKey(surface)
  const out: LemmaGuess[] = []
  const seen = new Set([word])
  const add = (lemma: string, tags: string[]): void => {
    if (!lemma || seen.has(lemma)) return
    seen.add(lemma)
    out.push({ lemma, tags })
  }
  if (!word) return out

  // 省音：l' → le / la
  if (ELIDED_WORD.test(word)) for (const l of ELISION[word] ?? []) add(l, ['elision'])
  // 没切开的省音：l'homme → homme
  const el = LEXICALIZED.has(word) ? null : ELISION_PREFIX.exec(word)
  if (el) {
    const rest = word.slice(el[0].length)
    add(rest, ['elision'])
    for (const g of lemmaCandidates(rest)) add(g.lemma, ['elision', ...g.tags])
  }
  // 挂着代词的：dit-il → dit，donne-le-moi → donne
  const hy =
    /^(.+?)(?:-t)?(?:-(?:je|tu|il|elle|on|nous|vous|ils|elles|ce|le|la|les|lui|leur|moi|toi|y|en|ci|là|[mtl]'(?:en|y)))+$/u.exec(
      word
    )
  if (hy && !LEXICALIZED.has(word)) {
    add(hy[1], ['clitic'])
    for (const g of lemmaCandidates(hy[1])) add(g.lemma, ['clitic', ...g.tags])
  }
  for (const [l, tag] of CONTRACTION[word] ?? []) add(l, [tag])
  const irr = IRREGULAR[word]
  if (irr) {
    add(irr[0], [irr[1]])
    return out
  }
  // 连字符复合词（词典里没有整个词时）
  if (!hy && !LEXICALIZED.has(word)) for (const g of compoundCandidates(word)) add(g.lemma, g.tags)
  // 只对像法语词的（全是字母）再往下猜
  if (!/^[\p{L}\p{M}]+$/u.test(word) || word.length < 3) return out

  // 复数、阴性
  const nominal = (w: string, tags: string[]): void => {
    for (const [fem, masc] of FEMININE)
      if (w.endsWith(fem) && w.length > fem.length + 1)
        add(w.slice(0, -fem.length) + masc, [...tags, 'feminine'])
  }
  for (const [pl, sg] of PLURAL)
    if (word.endsWith(pl) && word.length > pl.length + 1) {
      const s = word.slice(0, -pl.length) + sg
      add(s, ['plural'])
      if (pl === 's') nominal(s, ['plural'])
    }
  nominal(word, [])

  // 动词变位
  for (const [ending, infs, tag] of VERB) {
    if (!word.endsWith(ending) || word.length < ending.length + 2) continue
    const stem = word.slice(0, -ending.length)
    for (const inf of infs) {
      const stems = inf === 'er' ? erStems(stem, ending) : [stem]
      for (const s of stems) add(s + inf, ['verb', tag])
    }
  }

  // -ment 副词 → 形容词
  const adv = /^(.+?)(amment|emment|ément|iment|ument|ement|ment)$/u.exec(word)
  if (adv) {
    const [, base, suf] = adv
    const adj: Record<string, string> = {
      amment: 'ant',
      emment: 'ent',
      ément: 'é',
      iment: 'i',
      ument: 'u',
      ement: 'e',
      ment: ''
    }
    const stem = base + adj[suf]
    add(stem, ['adverb'])
    nominal(stem, ['adverb'])
  }

  // 连写的构词前缀（postélectorale、superaliment、ultraviolence）：去掉前缀再猜，放在最后
  const pre = GLUED_PREFIX.exec(word)
  if (pre) {
    add(pre[2], ['prefix'])
    for (const g of lemmaCandidates(pre[2])) add(g.lemma, ['prefix', ...g.tags])
  }
  return out
}

/** 新闻里常见、词典收不全的构词前缀（连字符的 ex-、co-、anti- 见 HYPHEN_PREFIX） */
const GLUED_PREFIX =
  /^(post|pré|anti|super|hyper|ultra|micro|macro|multi|mini|méga|néo|auto|extra|inter|intra|contre|pseudo|quasi|semi|sur|sous|télé|vidéo|cyber|éco|bio)(\p{L}{4,})$/u
const HYPHEN_PREFIX =
  /^(ex|co|anti|post|pré|pro|non|néo|semi|demi|mi|mini|maxi|super|hyper|ultra|extra|inter|intra|multi|micro|macro|méga|auto|bio|éco|euro|vice|sous|contre|pseudo|quasi|centre|grand|petit|arrière|avant|après|nord|sud)-(.+)$/u

/**
 * 词典里没有的连字符复合词：ex-président → président、co-pilote → copilote / pilote、ville-clé → ville、
 * bleu-blanc-rouge → bleu
 */
function compoundCandidates(word: string): LemmaGuess[] {
  const out: LemmaGuess[] = []
  if (!/^[\p{L}\p{M}'-]+$/u.test(word) || !word.includes('-')) return out
  const parts = word.split('-').filter(Boolean)
  if (parts.length < 2) return out
  const pre = HYPHEN_PREFIX.exec(word)
  if (pre) {
    out.push({ lemma: pre[1] + pre[2], tags: ['compound'] })
    out.push({ lemma: pre[2], tags: ['compound'] })
    for (const g of lemmaCandidates(pre[2]))
      out.push({ lemma: g.lemma, tags: ['compound', ...g.tags] })
  }
  out.push({ lemma: parts[0], tags: ['compound'] })
  for (const g of lemmaCandidates(parts[0]))
    out.push({ lemma: g.lemma, tags: ['compound', ...g.tags] })
  return out
}

// ───────────────────────── 分句 ─────────────────────────

/**
 * 句末是这些缩写时不断开（Intl.Segmenter 在缩写的点后面、下一个词大写或是数字时会断）：
 * 称呼（M.、MM.、Mme、Mlle、Dr、Me……）、av. / apr. J.-C.、p. 12、chap.、n°、单个大写字母的缩写（J. K. Rowling）。
 * etc.、ex. 不在里面：它们后面跟着大写字母时多半真是句子结束
 */
const ABBREVIATIONS = [
  'M',
  'MM',
  'Mme',
  'Mmes',
  'Mlle',
  'Mlles',
  'Mgr',
  'Me',
  'Dr',
  'Pr',
  'St',
  'Ste',
  'Sts',
  'Stes',
  'av',
  'apr',
  'cf',
  'Cf',
  'chap',
  'vol',
  'fig',
  'p',
  'pp',
  'art',
  'éd',
  'coll',
  'env',
  'n°',
  'no',
  'tél',
  'réf',
  '\\p{Lu}'
]

/**
 * 不在这里断句：句末是缩写的点；或者对话里引号还没合上就遇到 ! ? …（« Viens ! » dit-il. 要算一句，
 * Intl.Segmenter 会把后引号切到下一句开头）
 */
export const noBreakAfter = new RegExp(
  `(?:(?:^|[\\s(«"'’\\-])(?:${ABBREVIATIONS.join('|')})\\.|«[^»]*[!?…])$`,
  'u'
)

export const rules: LangRules = {
  key: frKey,
  looseKey: frLooseKey,
  tokenize,
  lemmaCandidates,
  noBreakAfter
}
