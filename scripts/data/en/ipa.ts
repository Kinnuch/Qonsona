/**
 * 英式、美式 IPA 的整理：Britfone（英式）、ipa-dict（美式）、ECDICT 的音标（英式后备）、
 * 维基词典的 IPA（两边都可以补）。都是纯函数，tests/lang/en/ 里直接测。
 *
 * 写法照中文学习者熟悉的：英式用国内课本的那一套（ʌ、r、e、eə、əʊ），美式用词典常见的（r、l、ɚ）；
 * 重音符号放在音节开头；单音节词不标重音。
 */

/** Britfone 的元音（重音符号贴在元音上） */
const BF_VOWELS = new Set([
  'aɪ',
  'aʊ',
  'eɪ',
  'i',
  'iː',
  'uː',
  'æ',
  'ɐ',
  'ɑː',
  'ɒ',
  'ɔɪ',
  'ɔː',
  'ə',
  'əʊ',
  'ɛ',
  'ɛə',
  'ɜː',
  'ɪ',
  'ɪə',
  'ʊ',
  'ʊə'
])

/** 英语音节开头能出现的辅音组合（找重音符号该放在哪个辅音前面：首音尽量长） */
const ONSETS = new Set(
  [
    // 单个辅音（ŋ 不在音节开头）
    'p b t d k g f v θ ð s z ʃ ʒ h m n l ɹ w j tʃ dʒ',
    // 两个
    'pɹ bɹ tɹ dɹ kɹ gɹ fɹ θɹ ʃɹ pl bl kl gl fl sl tw dw kw gw sw θw',
    'pj bj tj dj kj gj fj vj mj nj hj lj sj zj θj',
    'sp st sk sm sn sf',
    // 三个
    'spɹ stɹ skɹ spl skw spj stj skj'
  ]
    .join(' ')
    .split(' ')
)

const UK_STYLE: [RegExp, string][] = [
  [/ɐ/g, 'ʌ'],
  [/ɹ/g, 'r'],
  [/ɛ/g, 'e'],
  [/ɡ/g, 'g']
]

/** 去掉单音节词的重音符号 */
function dropMonosyllableStress(ipa: string, vowels: number): string {
  return vowels <= 1 ? ipa.replace(/[ˈˌ]/g, '') : ipa
}

/**
 * Britfone 的一条读音（音位用空格隔开，重音符号贴在元音上）→ 课本写法的英式 IPA。
 * 例：ə b ˈæ n d ə n → /əˈbændən/；k ə n s t ɹ ˈɐ k t → /kənˈstrʌkt/
 */
export function britfoneToIpa(phones: string): string {
  const segs = phones
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => ({
      stress: p.startsWith('ˈ') ? 'ˈ' : p.startsWith('ˌ') ? 'ˌ' : '',
      sym: p.replace(/^[ˈˌ]/, '')
    }))
  const isV = (i: number): boolean => BF_VOWELS.has(segs[i]?.sym ?? '')
  const marks = new Map<number, string>()
  let vowels = 0
  for (let v = 0; v < segs.length; v++) {
    if (!isV(v)) continue
    vowels++
    const st = segs[v].stress
    if (!st) continue
    let j = v
    while (j > 0 && !isV(j - 1)) j--
    let at = j
    if (j > 0) {
      // 前一个元音之后的辅音里，最长的合法首音
      at = v
      for (let k = j; k < v; k++) {
        if (
          ONSETS.has(
            segs
              .slice(k, v)
              .map((s) => s.sym)
              .join('')
          )
        ) {
          at = k
          break
        }
      }
    }
    marks.set(at, st)
  }
  let out = segs.map((s, i) => (marks.get(i) ?? '') + s.sym).join('')
  for (const [re, to] of UK_STYLE) out = out.replace(re, to)
  return `/${dropMonosyllableStress(out, vowels)}/`
}

/** 一条 Britfone 读音有没有重音（没有重音的是功能词的弱读式） */
export const britfoneStressed = (phones: string): boolean => /[ˈˌ]/.test(phones)

/** 美式元音（长的在前），数元音、判断重读用 */
const US_VOWEL = /aɪ|aʊ|ɔɪ|oʊ|eɪ|ɝ|ɚ|i|ɪ|ɛ|e|æ|ɑ|ɔ|ʊ|u|ʌ|ə|o|a/g

/**
 * ipa-dict 的美式 IPA（/ˈskɛdʒuɫ/）→ 词典写法：ɹ → r、ɫ → l、ɛ → e、非重读的 ɝ → ɚ，单音节不标重音
 */
export function usStyle(ipa: string): string {
  let s = ipa.trim().replace(/^\/|\/$/g, '')
  s = s.replace(/ɫ/g, 'l').replace(/ɹ/g, 'r').replace(/ɛ/g, 'e').replace(/ɡ/g, 'g')
  let pending = false
  let vowels = 0
  let out = ''
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === 'ˈ' || ch === 'ˌ') {
      pending = true
      out += ch
      i++
      continue
    }
    US_VOWEL.lastIndex = i
    const m = US_VOWEL.exec(s)
    if (m && m.index === i) {
      vowels++
      let v = m[0]
      if (v === 'ɝ' && !pending) v = 'ɚ'
      // cmudict 的 AH 不分重读：重读的 ə 写成词典里的 ʌ（run /rʌn/、colour /ˈkʌlɚ/）
      if (v === 'ə' && pending) v = 'ʌ'
      pending = false
      out += v
      i += m[0].length
      continue
    }
    out += ch
    i++
  }
  return `/${dropMonosyllableStress(out, vowels)}/`
}

/** ipa-dict 一行里的几种读音：/ˈeɪ/, /ə/ */
export const splitIpaDict = (s: string): string[] =>
  s
    .split(/,\s*/)
    .map((x) => x.trim())
    .filter((x) => x.startsWith('/'))

/** 美式读音有没有重音符号（ipa-dict 里没有重音的是弱读式） */
export const usStressed = (ipa: string): boolean => /[ˈˌ]/.test(ipa)

/**
 * ECDICT 的音标（'betә、әj'kei，旧式英式写法）→ 课本写法的英式 IPA；认不出来时返回 null
 */
export function ecdictPhonetic(p: string): string | null {
  let s = p.trim()
  if (!s || /[A-Z0-9]/.test(s)) return null
  s = s
    .replace(/[әǝ]/g, 'ə')
    .replace(/'/g, 'ˈ')
    .replace(/,/g, 'ˌ')
    .replace(/:/g, 'ː')
    .replace(/ɡ/g, 'g')
    .replace(/əu/g, 'əʊ')
    .replace(/ou/g, 'əʊ')
    .replace(/ei/g, 'eɪ')
    .replace(/ai/g, 'aɪ')
    .replace(/au/g, 'aʊ')
    .replace(/ɔi/g, 'ɔɪ')
    .replace(/iə/g, 'ɪə')
    .replace(/uə/g, 'ʊə')
    .replace(/ɛə/g, 'eə')
    .replace(/ɛ/g, 'e')
    // 旧式写法的单元音：长短靠 ː 分（i / iː、u / uː、ɔ / ɔː、ə: 是 ɜː），换成现在的 ɪ、ʊ、ɒ、ɜː
    .replace(/əː/g, 'ɜː')
    .replace(/i(?!ː)/g, 'ɪ')
    .replace(/u(?!ː)/g, 'ʊ')
    .replace(/ɔ(?![ːɪ])/g, 'ɒ')
    .replace(/\s+/g, ' ')
  // 只收 IPA 里常见的字符
  if (!/^[a-zæɑɒɔəɜɪʊʌθðʃʒŋɡːˈˌ() ]+$/u.test(s)) return null
  const vowels = (s.match(/aɪ|aʊ|ɔɪ|əʊ|eɪ|ɪə|eə|ʊə|iː|uː|ɑː|ɔː|ɜː|[iɪeæɑɒɔʊuʌə]/g) ?? []).length
  if (!vowels) return null
  return `/${dropMonosyllableStress(s, vowels)}/`
}

/**
 * 维基词典的 IPA（/dɒɡ/、/ˈwɔː.tə(ɹ)/）→ 同样的写法；英式（uk）再换成课本写法
 */
export function wiktionaryIpa(ipa: string, variety: 'uk' | 'us'): string | null {
  let s = ipa.trim()
  if (!/^\/.+\/$/.test(s)) return null
  s = s.slice(1, -1).replace(/\./g, '').replace(/ɡ/g, 'g').replace(/ɹ/g, 'r').replace(/ɫ/g, 'l')
  if (variety === 'uk') s = s.replace(/ɐ/g, 'ʌ').replace(/ɛ/g, 'e')
  else s = s.replace(/ɛ/g, 'e')
  if (/[,;]/.test(s) || s.length > 40) return null
  const vowels = (s.match(/aɪ|aʊ|ɔɪ|əʊ|oʊ|eɪ|ɪə|eə|ʊə|[iɪeæɑɒɔʊuʌəɜɝɚ]/g) ?? []).length
  return `/${dropMonosyllableStress(s, vowels)}/`
}

// ───────────────────────── 规则变形的读音 ─────────────────────────

const SIBILANT = /(s|z|ʃ|ʒ|tʃ|dʒ)$/
const VOICELESS = /(p|t|k|f|θ|s|ʃ|tʃ)$/
/** 元音结尾（英式非 r 化：hear /hɪə/ 加元音开头的词尾时读出 r：hearing /ˈhɪərɪŋ/） */
const VOWEL_END = /(ə|ɪə|eə|ʊə|ɑː|ɔː|ɜː|iː|uː|aɪ|eɪ|ɔɪ|aʊ|əʊ|oʊ|ɚ|ɝ|i|u|ɑ|ɔ|æ|e|ɪ|ʊ|ʌ|ɒ)$/
/** IPA 里有几个元音（数音节，判断单音节加词尾后要不要补重音符号） */
const syllables = (ipa: string): number =>
  (ipa.match(/aɪ|aʊ|ɔɪ|əʊ|oʊ|eɪ|ɪə|eə|ʊə|iː|uː|ɑː|ɔː|ɜː|[iɪeæɑɒɔʊuʌəɜɝɚ]/g) ?? []).length

/**
 * 规则变形的读音：从原形的读音按规则推（复数与三单 -s 读 /s/ /z/ /ɪz/，过去式 -ed 读 /t/ /d/ /ɪd/，
 * -ing /ɪŋ/，比较级 -er、最高级 -est）。spelling 是原形的拼写（英式判断要不要读出 r），variety 是英式还是美式。
 * 不是规则变化的（went、children）返回 null。
 */
export function inflectIpa(
  lemmaIpa: string,
  lemma: string,
  form: string,
  tags: string[],
  variety: 'uk' | 'us'
): string | null {
  const ipa = lemmaIpa.replace(/^\/|\/$/g, '')
  if (!ipa || /[()\s,]/.test(ipa)) return null
  const l = lemma.toLowerCase()
  const f = form.toLowerCase()
  // 拼写得是规则的：去 e、y 变 i、双写辅音
  const stems = [l, l.replace(/e$/, ''), l.replace(/y$/, 'i'), l + l.slice(-1), l + 'k']
  const is = (suffixes: string[]): boolean => stems.some((s) => suffixes.some((x) => s + x === f))
  const linkR = variety === 'uk' && /r(e)?$/.test(l) && VOWEL_END.test(ipa) ? 'r' : ''
  let add: string | null = null
  if (tags.includes('plural') || tags.includes('third-person')) {
    if (!is(['s', 'es'])) return null
    add = SIBILANT.test(ipa) ? 'ɪz' : VOICELESS.test(ipa) ? 's' : 'z'
  } else if (tags.includes('past')) {
    if (!is(['ed', 'd'])) return null
    add = /(t|d)$/.test(ipa) ? 'ɪd' : VOICELESS.test(ipa) ? 't' : 'd'
  } else if (tags.includes('present') && tags.includes('participle')) {
    if (!is(['ing']) && !(l.endsWith('ie') && f === l.slice(0, -2) + 'ying')) return null
    add = linkR + 'ɪŋ'
  } else if (tags.includes('comparative')) {
    if (!is(['er', 'r'])) return null
    add = variety === 'uk' ? linkR + 'ə' : 'ɚ'
  } else if (tags.includes('superlative')) {
    if (!is(['est', 'st'])) return null
    add = linkR + 'ɪst'
  }
  if (add === null) return null
  // y 结尾的词（happy /ˈhæpi/）直接接上：happier /ˈhæpiə/、studies /ˈstʌdiz/
  let out = ipa + add
  // 原来是单音节（没标重音），加了一个音节就要标上重音
  if (!/[ˈˌ]/.test(ipa) && syllables(out) > 1) out = 'ˈ' + out
  return `/${out}/`
}
