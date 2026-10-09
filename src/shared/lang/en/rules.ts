/**
 * 英语的规则：查词的键、切词、猜原形（纯函数；数据管线写 form 表、主进程查词、阅读器切词都用这一份）。
 *
 * 英语变化少而不规则多：变过形的词主要靠 form 表找回原形（ECDICT 的变形与 lemma 表，几万个词形，
 * 由 scripts/data/en/ 写进词典库）；这里的 lemmaCandidates 只在表里查不到时按规则兜底——
 * 规则变化（-s、-es、-ies、-ves、-ed、-ing、-er、-est、双写辅音、去 e、y 变 i）、缩约与所有格。
 * 切词时一个书写词就是一段（don't、John's、mother-in-law 都不拆），说明见 docs/lang/en.md。
 */
import { defaultKey, segmentWords, stripMarks } from '../text'
import type { LangRules, LemmaGuess, RawToken } from '../types'

/** 查词的键：NFC、弯引号换直的、小写、连字符的几种写法统一成 -、空白合成一个空格 */
export function key(text: string): string {
  return defaultKey(text, 'en').replace(/[‐‑]/g, '-').replace(/\s+/g, ' ')
}

/**
 * 宽松的键：再去掉附加符号（café → cafe）、连字符、撇号、点和空格（e-mail → email、o'clock → oclock、
 * U.S. → us、a lot → alot）。严格的键查不到时再用它。
 */
export function looseKey(text: string): string {
  return stripMarks(key(text)).replace(/[-'.\s]/g, '')
}

// ───────────────────────── 切词 ─────────────────────────

const HYPHEN = /^[-‐‑]$/
const APOSTROPHE = /^['’]$/
/** 撇号在前的几个口语缩约：'em、'cause、'til、'tis、'twas、'bout，rock 'n' roll 的 'n' */
const LEADING = new Set(['em', 'cause', 'til', 'tis', 'twas', 'bout', 'n'])
/** 后面的点算在词里的常见缩写（带内部点的 U.S.、e.g.、a.m. 另外判断；No. 只在后面跟数字时算） */
const ABBREVIATIONS = new Set(
  'mr mrs ms dr prof st jr sr vs etc inc ltd corp dept govt approx mt ft jan feb mar apr jun jul aug sep sept oct nov dec'.split(
    ' '
  )
)
const hasLetter = (s: string): boolean => /\p{L}/u.test(s)
const isWord = (x: RawToken | undefined): x is RawToken =>
  !!x && (x.kind === 'word' || x.kind === 'num')
const join = (a: RawToken, b: RawToken): RawToken => ({
  text: a.text + b.text,
  start: a.start,
  end: b.end,
  kind: a.kind
})

/**
 * 切词：Intl.Segmenter 之后按英语再并几处——连字符复合词（well-known、mother-in-law、COVID-19）、
 * 缩写的点（Mr.、U.S.、e.g.、No. 5）、撇号在前的缩约（'em、'cause、'90s）；序数词与年代（21st、1990s）算数字。
 * 缩约（don't、I'm）与所有格（John's）本来就是一段，不拆。
 */
export function tokenize(text: string): RawToken[] {
  const t = segmentWords(text, 'en')
  const out: RawToken[] = []
  for (let i = 0; i < t.length; i++) {
    let cur = t[i]
    // 撇号在前：前面不是词，后面是 'em 'cause 'n' 这几个，或者是年代 '90s
    if (APOSTROPHE.test(cur.text) && !isWord(out[out.length - 1]) && isWord(t[i + 1])) {
      const low = t[i + 1].text.toLowerCase()
      if (LEADING.has(low) || /^\d0s$/.test(low)) {
        cur = { ...join(cur, t[++i]), kind: /^\d/.test(low) ? 'num' : 'word' }
        // rock 'n' roll：'n 后面还有一个撇号
        if (low === 'n' && t[i + 1] && APOSTROPHE.test(t[i + 1].text)) cur = join(cur, t[++i])
      }
    }
    if (isWord(cur)) {
      // 连字符复合词：词-词（至少一边有字母；1990-2000 这种数字范围不并）
      while (
        t[i + 1] &&
        HYPHEN.test(t[i + 1].text) &&
        isWord(t[i + 2]) &&
        (hasLetter(cur.text) || hasLetter(t[i + 2].text))
      ) {
        cur = { ...join(join(cur, t[i + 1]), t[i + 2]), kind: 'word' }
        i += 2
      }
      // 缩写的点
      if (t[i + 1]?.text === '.') {
        const low = cur.text.toLowerCase()
        const isNo = low === 'no' && t[i + 2]?.kind === 'space' && t[i + 3]?.kind === 'num'
        if (cur.text.includes('.') || ABBREVIATIONS.has(low) || isNo) cur = join(cur, t[++i])
      }
      // 序数词、年代
      if (/^\d+(st|nd|rd|th|s)$/i.test(cur.text)) cur = { ...cur, kind: 'num' }
    }
    out.push(cur)
  }
  return out
}

// ───────────────────────── 缩约 ─────────────────────────

/** n't 前面的特殊写法：can't、won't、shan't、ain't */
const NEG_HOSTS: Record<string, string> = { ca: 'can', wo: 'will', sha: 'shall', ai: 'be' }
const BE_FORMS = new Set(['am', 'is', 'are', 'was', 'were', 'be'])
const HAVE_FORMS = new Set(['have', 'has', 'had'])
const DO_FORMS = new Set(['do', 'does', 'did'])
/** 's 在这些词后面多半是 is / has，不是所有格 */
const PRONOUN_HOSTS = new Set(
  'he she it that what who where when how there here this everyone everybody someone somebody nobody everything something nothing'.split(
    ' '
  )
)
/** 撇号在前的缩约 → 完整的词 */
const LEADING_EXPANSIONS: Record<string, string> = {
  "'em": 'them',
  "'cause": 'because',
  "'til": 'until',
  "'tis": 'it is',
  "'twas": 'it was',
  "'bout": 'about',
  "'n'": 'and',
  "'n": 'and'
}
/** 附着成分可能代表的词（原形）与完整写法 */
const CLITICS: Record<string, { lemmas: string[]; full: string }> = {
  "n't": { lemmas: ['not'], full: 'not' },
  "'m": { lemmas: ['be'], full: 'am' },
  "'re": { lemmas: ['be'], full: 'are' },
  "'ve": { lemmas: ['have'], full: 'have' },
  "'ll": { lemmas: ['will'], full: 'will' },
  "'d": { lemmas: ['would', 'have'], full: 'would / had' },
  "'s": { lemmas: ['be', 'have'], full: 'is / has' }
}

const auxLemma = (w: string): string =>
  BE_FORMS.has(w) ? 'be' : HAVE_FORMS.has(w) ? 'have' : DO_FORMS.has(w) ? 'do' : w

export interface Contraction {
  /** 宿主词，原样小写（i、do、ca） */
  host: string
  /** 附着成分：n't、'm、'll、's、'（复数所有格）、not（cannot） */
  clitic: string
  /** 宿主词的原形（is → be、ca → can、wo → will） */
  hostLemma: string
  /** 附着成分可能代表的词（'d → would / have）；所有格是空的 */
  cliticLemmas: string[]
  /** 所有格（dog's、students'） */
  possessive: boolean
}

/**
 * 拆缩约与所有格：don't → do + not、I'm → I + be、won't → will + not、let's → let + us、
 * dog's → dog（所有格）、students' → students（所有格）。不是缩约时返回 null。
 */
export function splitContraction(word: string): Contraction | null {
  const w = key(word)
  if (w === 'cannot')
    return {
      host: 'can',
      clitic: 'not',
      hostLemma: 'can',
      cliticLemmas: ['not'],
      possessive: false
    }
  if (w === "let's")
    return { host: 'let', clitic: "'s", hostLemma: 'let', cliticLemmas: ['us'], possessive: false }
  const m = w.match(/^(.+?)(n't|'m|'re|'ve|'ll|'d|'s)$/)
  if (m && hasLetter(m[1])) {
    const [, host, clitic] = m
    if (clitic === "n't")
      return {
        host,
        clitic,
        hostLemma: NEG_HOSTS[host] ?? auxLemma(host),
        cliticLemmas: ['not'],
        possessive: false
      }
    if (clitic === "'s" && !PRONOUN_HOSTS.has(host))
      return { host, clitic, hostLemma: host, cliticLemmas: [], possessive: true }
    return {
      host,
      clitic,
      hostLemma: auxLemma(host),
      cliticLemmas: CLITICS[clitic].lemmas,
      possessive: false
    }
  }
  // 复数的所有格：students'
  if (/^\p{L}+s'$/u.test(w))
    return {
      host: w.slice(0, -1),
      clitic: "'",
      hostLemma: w.slice(0, -1),
      cliticLemmas: [],
      possessive: true
    }
  return null
}

/** 缩约的完整写法：don't → do not、I'm → I am、won't → will not、'em → them；不是缩约时返回 null */
export function expandContraction(word: string): string | null {
  const w = key(word)
  if (LEADING_EXPANSIONS[w]) return LEADING_EXPANSIONS[w]
  const c = splitContraction(w)
  if (!c || c.possessive) return null
  if (w === "ain't") return 'am not / is not / are not'
  if (w === "let's") return 'let us'
  const host = c.host === 'i' ? 'I' : c.clitic === "n't" ? (NEG_HOSTS[c.host] ?? c.host) : c.host
  return `${host} ${c.clitic === 'not' ? 'not' : CLITICS[c.clitic].full}`
}

// ───────────────────────── 猜原形 ─────────────────────────

/** 辅音 + 元音 + 辅音结尾：hop、mak（hoped → hope、making → make 先试加 e） */
const CVC = /[^aeiou][aeiou][^aeiouwxy]$/

/** 去掉词尾之后可能的原形，按可能性排：去掉双写的辅音、i 变回 y、原样或加 e */
function stems(stem: string): string[] {
  const out: string[] = []
  // 双写的辅音（stopped → stop）；ll 多半本来就是两个 l（tall、fell），放到后面
  const doubled = /([bdgkmnprtvz])\1$/.test(stem)
  if (doubled) out.push(stem.slice(0, -1))
  if (stem.endsWith('i')) out.push(stem.slice(0, -1) + 'y')
  if (!doubled && CVC.test(stem)) out.push(stem + 'e', stem)
  else out.push(stem, stem + 'e')
  if (stem.endsWith('ll') || stem.endsWith('ck')) out.push(stem.slice(0, -1))
  return out.filter((s) => s.length >= 2)
}

/**
 * form 表查不到时猜原形，按可能性排；拿去查 form 表，查到的才算。tags 用 Wiktextract 的标签词：
 * plural、third-person singular present、past、past participle、present participle、comparative、
 * superlative；另有 possessive、contraction、negative、alternative（连字符的另一种写法）、
 * compound（复合词的中心词）、adverb（-ly 副词猜回形容词）。
 */
export function lemmaCandidates(surface: string): LemmaGuess[] {
  const w = key(surface)
  const out: LemmaGuess[] = []
  const seen = new Set<string>()
  const add = (lemma: string, tags: string[]): void => {
    const k = `${lemma}|${tags.join(' ')}`
    if (!lemma || lemma === w || seen.has(k)) return
    seen.add(k)
    out.push({ lemma, tags })
  }
  if (!w) return out

  // 撇号在前的缩约（'em → them）
  if (LEADING_EXPANSIONS[w]) {
    for (const l of LEADING_EXPANSIONS[w].split(' '))
      add(l === 'is' || l === 'was' ? 'be' : l, ['contraction'])
    return out
  }
  // 缩约与所有格：先给宿主词，再给附着成分；所有格的宿主词本身也可能变过形（students'）
  const c = splitContraction(w)
  if (c) {
    if (c.possessive) {
      add(c.hostLemma, ['possessive'])
      for (const g of lemmaCandidates(c.hostLemma)) add(g.lemma, [...g.tags, 'possessive'])
    } else {
      const neg = c.clitic === "n't" || c.clitic === 'not'
      add(c.hostLemma, neg ? ['negative', 'contraction'] : ['contraction'])
      for (const l of c.cliticLemmas) add(l, ['contraction'])
    }
    return out
  }
  // 连字符：去掉连字符、换成空格，最后是复合词的中心词（最后一段）
  if (w.includes('-')) {
    add(w.replace(/-/g, ''), ['alternative'])
    add(w.replace(/-/g, ' '), ['alternative'])
    const parts = w.split('-').filter(Boolean)
    if (parts.length > 1) add(parts[parts.length - 1], ['compound'])
    return out
  }
  if (!/^[a-z]+$/.test(w) || w.length < 3) return out

  const PL = ['plural']
  const S3 = ['third-person', 'singular', 'present']
  const PAST = ['past']
  const PP = ['past', 'participle']
  const ING = ['present', 'participle']
  // -ies / -ves / -es / -s
  if (w.endsWith('ies') && w.length > 4) {
    add(w.slice(0, -3) + 'y', PL)
    add(w.slice(0, -3) + 'y', S3)
  }
  if (w.endsWith('ves') && w.length > 4) {
    add(w.slice(0, -3) + 'f', PL)
    add(w.slice(0, -3) + 'fe', PL)
  }
  if (/(s|x|z|ch|sh|o)es$/.test(w)) {
    add(w.slice(0, -2), PL)
    add(w.slice(0, -2), S3)
  }
  if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) {
    add(w.slice(0, -1), PL)
    add(w.slice(0, -1), S3)
  }
  // -ed
  if (w.endsWith('ed') && w.length > 4)
    for (const s of stems(w.slice(0, -2))) {
      add(s, PAST)
      add(s, PP)
    }
  // -ing（dying → die）
  if (w.endsWith('ing') && w.length > 4) {
    const stem = w.slice(0, -3)
    if (stem.endsWith('y')) add(stem.slice(0, -1) + 'ie', ING)
    for (const s of stems(stem)) add(s, ING)
  }
  // -est / -er
  if (w.endsWith('est') && w.length > 4)
    for (const s of stems(w.slice(0, -3))) add(s, ['superlative'])
  if (w.endsWith('er') && w.length > 3)
    for (const s of stems(w.slice(0, -2))) add(s, ['comparative'])
  // -ly 副词 → 形容词（happily → happy、basically → basic、gently → gentle、quickly → quick）
  if (w.endsWith('ly') && w.length > 4) {
    const stem = w.slice(0, -2)
    if (stem.endsWith('i')) add(stem.slice(0, -1) + 'y', ['adverb'])
    if (stem.endsWith('al')) add(stem.slice(0, -2), ['adverb'])
    if (/[^aeiou]$/.test(stem) && !stem.endsWith('l')) add(stem + 'le', ['adverb'])
    add(stem, ['adverb'])
  }
  return out
}

export const rules: LangRules = {
  key,
  looseKey,
  tokenize,
  lemmaCandidates
}
