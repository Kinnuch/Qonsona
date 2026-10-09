/**
 * 假名与罗马字：平假名 ↔ 片假名、罗马字 → 假名（查词时输入 taberu 也能查到 食べる）。
 * 认黑本式、训令式和打字习惯的写法（shi / si、tsu / tu、nn / n'、xtu / ltu 小っ）。
 */

const HIRA_START = 0x3041
const HIRA_END = 0x3096
const OFFSET = 0x60

export function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖゝゞ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + OFFSET))
}

export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶヽヾ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - OFFSET))
}

export const isKana = (s: string): boolean => /^[぀-ヿー]+$/.test(s)
export const hasKanji = (s: string): boolean => /[㐀-鿿豈-﫿]/.test(s)
export const isHiraganaChar = (c: string): boolean => {
  const n = c.charCodeAt(0)
  return n >= HIRA_START && n <= HIRA_END
}

/** 像罗马字（拉丁字母、长音符号、撇号、连字符） */
export const isRomaji = (s: string): boolean => /^[a-zA-Zāīūēōâîûêô' -]+$/.test(s.trim())

/** 小写的 ゃゅょ 与小写元音：跟前一个假名合成一拍 */
const SMALL = /^[ゃゅょぁぃぅぇぉャュョァィゥェォ]$/

/** 按拍切开：きゃ、ファ 算一拍，っ、ー、ん 各算一拍（五十音课挑「只用学过的假名写成的词」用） */
export function kanaUnits(s: string): string[] {
  const out: string[] = []
  for (const c of s) {
    if (SMALL.test(c) && out.length && !SMALL.test(out[out.length - 1].slice(-1)))
      out[out.length - 1] += c
    else out.push(c)
  }
  return out
}

// 罗马字 → 平假名：按最长匹配
const TABLE: Record<string, string> = {
  a: 'あ',
  i: 'い',
  u: 'う',
  e: 'え',
  o: 'お',
  ka: 'か',
  ki: 'き',
  ku: 'く',
  ke: 'け',
  ko: 'こ',
  ga: 'が',
  gi: 'ぎ',
  gu: 'ぐ',
  ge: 'げ',
  go: 'ご',
  sa: 'さ',
  si: 'し',
  shi: 'し',
  su: 'す',
  se: 'せ',
  so: 'そ',
  za: 'ざ',
  zi: 'じ',
  ji: 'じ',
  zu: 'ず',
  ze: 'ぜ',
  zo: 'ぞ',
  ta: 'た',
  ti: 'ち',
  chi: 'ち',
  tu: 'つ',
  tsu: 'つ',
  te: 'て',
  to: 'と',
  da: 'だ',
  di: 'ぢ',
  du: 'づ',
  dzu: 'づ',
  de: 'で',
  do: 'ど',
  na: 'な',
  ni: 'に',
  nu: 'ぬ',
  ne: 'ね',
  no: 'の',
  ha: 'は',
  hi: 'ひ',
  hu: 'ふ',
  fu: 'ふ',
  he: 'へ',
  ho: 'ほ',
  ba: 'ば',
  bi: 'び',
  bu: 'ぶ',
  be: 'べ',
  bo: 'ぼ',
  pa: 'ぱ',
  pi: 'ぴ',
  pu: 'ぷ',
  pe: 'ぺ',
  po: 'ぽ',
  ma: 'ま',
  mi: 'み',
  mu: 'む',
  me: 'め',
  mo: 'も',
  ya: 'や',
  yu: 'ゆ',
  yo: 'よ',
  ra: 'ら',
  ri: 'り',
  ru: 'る',
  re: 'れ',
  ro: 'ろ',
  la: 'ら',
  li: 'り',
  lu: 'る',
  le: 'れ',
  lo: 'ろ',
  wa: 'わ',
  wi: 'ゐ',
  we: 'ゑ',
  wo: 'を',
  kya: 'きゃ',
  kyu: 'きゅ',
  kyo: 'きょ',
  gya: 'ぎゃ',
  gyu: 'ぎゅ',
  gyo: 'ぎょ',
  sha: 'しゃ',
  shu: 'しゅ',
  sho: 'しょ',
  she: 'しぇ',
  sya: 'しゃ',
  syu: 'しゅ',
  syo: 'しょ',
  ja: 'じゃ',
  ju: 'じゅ',
  jo: 'じょ',
  je: 'じぇ',
  zya: 'じゃ',
  zyu: 'じゅ',
  zyo: 'じょ',
  jya: 'じゃ',
  jyu: 'じゅ',
  jyo: 'じょ',
  cha: 'ちゃ',
  chu: 'ちゅ',
  cho: 'ちょ',
  che: 'ちぇ',
  tya: 'ちゃ',
  tyu: 'ちゅ',
  tyo: 'ちょ',
  cya: 'ちゃ',
  cyu: 'ちゅ',
  cyo: 'ちょ',
  dya: 'ぢゃ',
  dyu: 'ぢゅ',
  dyo: 'ぢょ',
  nya: 'にゃ',
  nyu: 'にゅ',
  nyo: 'にょ',
  hya: 'ひゃ',
  hyu: 'ひゅ',
  hyo: 'ひょ',
  bya: 'びゃ',
  byu: 'びゅ',
  byo: 'びょ',
  pya: 'ぴゃ',
  pyu: 'ぴゅ',
  pyo: 'ぴょ',
  mya: 'みゃ',
  myu: 'みゅ',
  myo: 'みょ',
  rya: 'りゃ',
  ryu: 'りゅ',
  ryo: 'りょ',
  fa: 'ふぁ',
  fi: 'ふぃ',
  fe: 'ふぇ',
  fo: 'ふぉ',
  fyu: 'ふゅ',
  va: 'ゔぁ',
  vi: 'ゔぃ',
  vu: 'ゔ',
  ve: 'ゔぇ',
  vo: 'ゔぉ',
  tsa: 'つぁ',
  tsi: 'つぃ',
  tse: 'つぇ',
  tso: 'つぉ',
  thi: 'てぃ',
  dhi: 'でぃ',
  twu: 'とぅ',
  dwu: 'どぅ',
  wha: 'うぁ',
  whi: 'うぃ',
  whe: 'うぇ',
  who: 'うぉ',
  ye: 'いぇ',
  xa: 'ぁ',
  xi: 'ぃ',
  xu: 'ぅ',
  xe: 'ぇ',
  xo: 'ぉ',
  xya: 'ゃ',
  xyu: 'ゅ',
  xyo: 'ょ',
  xtu: 'っ',
  xtsu: 'っ',
  xwa: 'ゎ',
  ltu: 'っ',
  ltsu: 'っ',
  lya: 'ゃ',
  lyu: 'ゅ',
  lyo: 'ょ',
  '-': 'ー'
}
const MAX = 4
/** 带长音符号的元音：黑本式 ō 多半是 おう，ū 是 うう */
const MACRON: Record<string, string> = {
  ā: 'aa',
  ī: 'ii',
  ū: 'uu',
  ē: 'ee',
  ō: 'ou',
  â: 'aa',
  î: 'ii',
  û: 'uu',
  ê: 'ee',
  ô: 'ou'
}

/** 罗马字转平假名；转不了的字母原样留着（调用方看结果里还有没有拉丁字母） */
export function romajiToHiragana(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[āīūēōâîûêô]/g, (c) => MACRON[c])
    .replace(/\s+/g, '')
  let out = ''
  let i = 0
  while (i < s.length) {
    const c = s[i]
    // 撇号：n' 明确是ん
    if (c === "'") {
      i++
      continue
    }
    // 促音：同一个辅音写两遍（kk、tt、tch），n 除外
    if (i + 1 < s.length && c === s[i + 1] && /[bcdfghjklmpqrstvwxyz]/.test(c) && c !== 'n') {
      out += 'っ'
      i++
      continue
    }
    if (c === 't' && s.startsWith('tch', i)) {
      out += 'っ'
      i++
      continue
    }
    // ん：n'，或者 n 后面不是元音 / y；按黑本式，nn 后面跟元音时是「ん + な行」（onna = おんな），
    // 不跟元音时 nn 才整个是「ん」（打字习惯，shinnbun）
    if (c === 'n') {
      const next = s[i + 1]
      if (next === 'n') {
        const after = s[i + 2]
        out += 'ん'
        i += after !== undefined && /[aiueoy]/.test(after) ? 1 : 2
        continue
      }
      if (next === undefined || next === "'" || !/[aiueoy]/.test(next)) {
        out += 'ん'
        i++
        continue
      }
    }
    let hit = ''
    for (let len = Math.min(MAX, s.length - i); len > 0; len--) {
      const k = s.slice(i, i + len)
      if (TABLE[k]) {
        hit = k
        break
      }
    }
    if (hit) {
      out += TABLE[hit]
      i += hit.length
    } else {
      out += c
      i++
    }
  }
  return out
}

// 假名 → 罗马字（阅读器的「罗马音」注音）：黑本式拼法，长音照假名写（とうきょう → toukyou，
// けーき → keeki），跟输入法打字的写法一致，学习者照着就能打出来
const ROMA: Record<string, string> = {
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  き: 'ki',
  く: 'ku',
  け: 'ke',
  こ: 'ko',
  が: 'ga',
  ぎ: 'gi',
  ぐ: 'gu',
  げ: 'ge',
  ご: 'go',
  さ: 'sa',
  し: 'shi',
  す: 'su',
  せ: 'se',
  そ: 'so',
  ざ: 'za',
  じ: 'ji',
  ず: 'zu',
  ぜ: 'ze',
  ぞ: 'zo',
  た: 'ta',
  ち: 'chi',
  つ: 'tsu',
  て: 'te',
  と: 'to',
  だ: 'da',
  ぢ: 'ji',
  づ: 'zu',
  で: 'de',
  ど: 'do',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
  ね: 'ne',
  の: 'no',
  は: 'ha',
  ひ: 'hi',
  ふ: 'fu',
  へ: 'he',
  ほ: 'ho',
  ば: 'ba',
  び: 'bi',
  ぶ: 'bu',
  べ: 'be',
  ぼ: 'bo',
  ぱ: 'pa',
  ぴ: 'pi',
  ぷ: 'pu',
  ぺ: 'pe',
  ぽ: 'po',
  ま: 'ma',
  み: 'mi',
  む: 'mu',
  め: 'me',
  も: 'mo',
  や: 'ya',
  ゆ: 'yu',
  よ: 'yo',
  ら: 'ra',
  り: 'ri',
  る: 'ru',
  れ: 're',
  ろ: 'ro',
  わ: 'wa',
  ゐ: 'i',
  ゑ: 'e',
  を: 'o',
  ん: 'n',
  ゔ: 'vu',
  ぁ: 'a',
  ぃ: 'i',
  ぅ: 'u',
  ぇ: 'e',
  ぉ: 'o',
  ゃ: 'ya',
  ゅ: 'yu',
  ょ: 'yo',
  ゎ: 'wa'
}
/** い段 + 小ゃゅょ：きゃ → kya，しゃ → sha，ちゃ → cha，じゃ → ja */
const YOON_HEAD: Record<string, string> = { し: 'sh', ち: 'ch', じ: 'j', ぢ: 'j' }
/** 小写元音跟在前一个假名后面：ふぁ → fa，てぃ → ti，うぃ → wi，ゔぁ → va */
const SMALL_VOWEL: Record<string, string> = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' }

export function kanaToRomaji(kana: string): string {
  const s = toHiragana(kana)
  const out: string[] = []
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const next = s[i + 1]
    if (c === 'っ') {
      // 促音：下一个音的辅音写两遍（ch 写成 tch）
      const rest = kanaToRomaji(s.slice(i + 1, i + 3))
      out.push(rest.startsWith('ch') ? 't' : /^[bcdfghjkmprstvwz]/.test(rest) ? rest[0] : '')
      continue
    }
    if (c === 'ー') {
      // 长音：重复前一个元音
      const prev = out.join('').match(/[aiueo](?=[^aiueo]*$)/)?.[0] ?? ''
      out.push(prev)
      continue
    }
    if (c === 'ん') {
      // 后面是元音或 y 时写成 n'（きんえん kin'en）
      out.push(next && /^[aiueoy]/.test(ROMA[next] ?? '') ? "n'" : 'n')
      continue
    }
    const base = ROMA[c]
    if (base === undefined) {
      out.push(c)
      continue
    }
    if (next && 'ゃゅょ'.includes(next) && base.endsWith('i') && base.length > 1) {
      const head = YOON_HEAD[c] ?? base.slice(0, -1) + 'y'
      out.push(head + ROMA[next].slice(-1))
      i++
      continue
    }
    // 外来语的 てゅ、でゅ、ふゅ、ゔゅ：tyu、dyu、fyu、vyu
    if (next && 'ゃゅょ'.includes(next) && 'てでふゔ'.includes(c)) {
      const cons = c === 'ふ' ? 'f' : c === 'ゔ' ? 'v' : base[0]
      out.push(cons + ROMA[next])
      i++
      continue
    }
    if (next && SMALL_VOWEL[next] && base.length > 1) {
      const cons =
        c === 'ふ'
          ? 'f'
          : c === 'ゔ'
            ? 'v'
            : c === 'う'
              ? 'w'
              : base.replace(/[aiueo]$/, '').replace(/^(ch|sh|j|ts)$/, '$1')
      out.push(cons + SMALL_VOWEL[next])
      i++
      continue
    }
    if (c === 'う' && next && SMALL_VOWEL[next]) {
      out.push('w' + SMALL_VOWEL[next])
      i++
      continue
    }
    out.push(base)
  }
  return out.join('')
}
