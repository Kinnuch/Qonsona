/** IPA → eSpeak NG 显式音素输入，不把 IPA 当英语拼写或字典单词。 */
const PHONES: Record<string, string> = {
  p: 'p',
  b: 'b',
  t: 't',
  d: 'd',
  k: 'k',
  g: 'g',
  ɡ: 'g',
  q: 'q',
  ʔ: '?',
  m: 'm',
  n: 'n',
  ŋ: 'N',
  ɲ: 'n^',
  ɳ: 'n.',
  f: 'f',
  v: 'v',
  θ: 'T',
  ð: 'D',
  s: 's',
  z: 'z',
  ʃ: 'S',
  ʒ: 'Z',
  x: 'x',
  ɣ: 'Q',
  h: 'h',
  ç: 'C',
  l: 'l',
  ɫ: 'L',
  ɬ: 'l#',
  ʎ: 'l^',
  j: 'j',
  w: 'w',
  ʍ: 'w#',
  r: 'R',
  ɹ: 'r',
  ɾ: '*',
  ʀ: 'r"',
  a: 'a',
  ɐ: 'a',
  ɑ: 'A',
  æ: 'a',
  e: 'e',
  ɛ: 'E',
  ə: '@',
  ɜ: '3',
  i: 'i',
  ɪ: 'I',
  o: 'o',
  ɔ: 'O',
  u: 'u',
  ʊ: 'U',
  y: 'y',
  ø: 'Y',
  œ: 'W',
  tʃ: 'tS',
  dʒ: 'dZ',
  ts: 'ts',
  dz: 'dz',
  ˈ: "'",
  ˌ: ',',
  ː: ':',
  ˑ: ':'
}
/** 圆唇元音和开放后元音使用具有这些真实音素的表；r 始终显式指定颤音。 */
export function ipaProfile(input: string): 'en' | 'fr' | 'de' {
  return /[yøœ]/u.test(input) ? 'fr' : /[ɑɜ]/u.test(input) ? 'de' : 'en'
}
export function ipaPhones(input: string): { phones: string; unsupported: string[] } {
  const text = input.normalize('NFC').replace(/[͜͡]/gu, '')
  const profile = ipaProfile(text)
  const result: string[] = []
  const unsupported: string[] = []
  for (let i = 0; i < text.length;) {
    const ch = String.fromCodePoint(text.codePointAt(i)!)
    if (/[\s./\]()‿]/u.test(ch) || ch === '[') {
      result.push(ch === '.' ? '' : ' ')
      i += ch.length
      continue
    }
    const pair = text.slice(i, i + 2)
    const key = PHONES[pair] ? pair : ch
    // 不同音素表会改写近音 r，且法语表没有 A/3；明确拒绝，不能悄悄换音或删音。
    const mismatched =
      (profile !== 'en' && key === 'ɹ') || (profile === 'fr' && ['ɑ', 'ɜ'].includes(key))
    if (PHONES[key] && !mismatched) result.push(PHONES[key])
    else unsupported.push(key)
    i += key.length
  }
  return { phones: result.join(''), unsupported: [...new Set(unsupported)] }
}
