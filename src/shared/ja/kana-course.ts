/**
 * 日语的字母课：五十音。平假名、片假名各分清音、浊音与半浊音、拗音、特殊音几个单元，按行分课。
 * 每个假名带罗马字、对应的另一套假名、笔顺（界面去词典里查 KanjiVG）、长得像的假名（出题时当干扰项）。
 * 促音、长音不是一个个字，那几课只讲说明、练拼读（课里给出词）。
 */
import type { Course, CourseLesson, CourseUnit, SymbolItem, Text } from '../course'
import { kanaToRomaji, romajiToHiragana, toHiragana, toKatakana } from './kana'

interface LessonSpec {
  id: string
  title: Text
  kana: string[]
  note?: Text
  words?: string[]
}

const row = (s: string): string[] => [...s]
const rowTitle = (k: string): Text => ({ zh: `${k}行`, en: `${k} row` })

const BASIC: LessonSpec[] = [
  { id: 'a', title: rowTitle('あ'), kana: row('あいうえお') },
  { id: 'ka', title: rowTitle('か'), kana: row('かきくけこ') },
  { id: 'sa', title: rowTitle('さ'), kana: row('さしすせそ') },
  { id: 'ta', title: rowTitle('た'), kana: row('たちつてと') },
  { id: 'na', title: rowTitle('な'), kana: row('なにぬねの') },
  { id: 'ha', title: rowTitle('は'), kana: row('はひふへほ') },
  { id: 'ma', title: rowTitle('ま'), kana: row('まみむめも') },
  { id: 'ya', title: rowTitle('や'), kana: row('やゆよ') },
  {
    id: 'ra',
    title: rowTitle('ら'),
    kana: row('らりるれろ'),
    note: {
      zh: '这一行的辅音是舌尖轻轻一弹，介于 l 和 d 之间，罗马字写 r。',
      en: 'The consonant of this row is a light tap of the tongue, between l and d; it is romanized r.'
    }
  },
  { id: 'wa', title: { zh: 'わ・を・ん', en: 'わ, を, ん' }, kana: row('わをん') }
]

const VOICED: LessonSpec[] = [
  { id: 'ga', title: rowTitle('が'), kana: row('がぎぐげご') },
  { id: 'za', title: rowTitle('ざ'), kana: row('ざじずぜぞ') },
  { id: 'da', title: rowTitle('だ'), kana: row('だぢづでど') },
  { id: 'ba', title: rowTitle('ば'), kana: row('ばびぶべぼ') },
  { id: 'pa', title: rowTitle('ぱ'), kana: row('ぱぴぷぺぽ') }
]

const yoon = (heads: string): string[] => [...heads].flatMap((h) => [h + 'ゃ', h + 'ゅ', h + 'ょ'])

const YOON: LessonSpec[] = [
  { id: 'kya', title: 'きゃ・しゃ・ちゃ', kana: yoon('きしち') },
  { id: 'nya', title: 'にゃ・ひゃ・みゃ・りゃ', kana: yoon('にひみり') },
  { id: 'gya', title: 'ぎゃ・じゃ・びゃ・ぴゃ', kana: yoon('ぎじびぴ') }
]

const SOKUON_NOTE: Text = {
  zh: '小写的つ叫促音：停顿一拍，让后面的辅音读得更紧；罗马字把下一个辅音写两遍（きって kitte）。',
  en: 'The small つ marks a geminate: pause for one beat before the next consonant; romaji doubles that consonant (きって kitte).'
}

const HIRA_SPECIAL: LessonSpec[] = [
  {
    id: 'sokuon',
    title: { zh: '促音 っ', en: 'Geminate っ' },
    kana: ['っ'],
    note: SOKUON_NOTE,
    words: ['きって', 'がっこう', 'ざっし', 'きっぷ', 'いっしょ', 'もっと', 'ちょっと', 'みっつ']
  },
  {
    id: 'choon',
    title: { zh: '长音', en: 'Long vowels' },
    kana: [],
    note: {
      zh: '把前一个元音拉长一拍：あ段加あ（おかあさん）、い段加い（おにいさん）、う段加う（くうき）、え段一般加い（せんせい）、お段一般加う（おとうさん）。',
      en: 'Stretch the previous vowel by one beat: add あ after an a-column kana (おかあさん), い after i (おにいさん), う after u (くうき), usually い after e (せんせい) and usually う after o (おとうさん).'
    },
    words: [
      'おかあさん',
      'おにいさん',
      'おねえさん',
      'おとうさん',
      'くうき',
      'せんせい',
      'ひこうき',
      'おおきい'
    ]
  }
]

const KATA_SPECIAL: LessonSpec[] = [
  {
    id: 'choon',
    title: { zh: '长音符 ー 与促音 ッ', en: 'Long-vowel bar ー and geminate ッ' },
    kana: ['ー', 'ッ'],
    words: ['コーヒー', 'ケーキ', 'ノート', 'スーパー', 'サッカー', 'チケット', 'ベッド', 'カップ']
  },
  { id: 'fa', title: 'ファ・フィ・フェ・フォ・ヴ', kana: ['ファ', 'フィ', 'フェ', 'フォ', 'ヴ'] },
  {
    id: 'ti',
    title: 'ティ・ディ・トゥ・ドゥ・デュ',
    kana: ['ティ', 'ディ', 'トゥ', 'ドゥ', 'デュ']
  },
  {
    id: 'she',
    title: 'シェ・ジェ・チェ・ウィ・ウェ・ウォ',
    kana: ['シェ', 'ジェ', 'チェ', 'ウィ', 'ウェ', 'ウォ']
  }
]

/** 平假名课改成片假名（外来语的几课本来就是片假名） */
const kata = (l: LessonSpec): LessonSpec => ({
  ...l,
  title:
    typeof l.title === 'string'
      ? toKatakana(l.title)
      : Object.fromEntries(Object.entries(l.title).map(([k, v]) => [k, toKatakana(v)])),
  kana: l.kana.map(toKatakana),
  words: l.words?.map(toKatakana)
})

// ── 每个假名的说明 ──

const ROMAJI_NOTE = (r: string, alt: string): Text => ({
  zh: `罗马字写 ${r}；输入 ${alt} 也算对。`,
  en: `Romanized ${r}; typing ${alt} also counts.`
})

const NOTES: Record<string, Text> = {
  し: ROMAJI_NOTE('shi', 'si'),
  ち: ROMAJI_NOTE('chi', 'ti'),
  つ: ROMAJI_NOTE('tsu', 'tu'),
  ふ: ROMAJI_NOTE('fu', 'hu'),
  じ: ROMAJI_NOTE('ji', 'zi'),
  は: {
    zh: '作助词时读 wa（わたしは）。',
    en: 'Read wa when it is a particle (わたしは).'
  },
  へ: {
    zh: '作助词时读 e（がっこうへ）。',
    en: 'Read e when it is a particle (がっこうへ).'
  },
  を: {
    zh: '读 o，只用作助词（ほんをよむ）；罗马字写 wo。',
    en: 'Pronounced o and used only as a particle (ほんをよむ); romanized wo.'
  },
  ん: {
    zh: '单独成一拍的鼻音，不会出现在词首。',
    en: 'A nasal that is a beat of its own; it never starts a word.'
  },
  ぢ: {
    zh: '读音同 じ，只在少数词里出现（はなぢ）。',
    en: 'Sounds the same as じ; used only in a few words (はなぢ).'
  },
  づ: {
    zh: '读音同 ず，只在少数词里出现（つづく）。',
    en: 'Sounds the same as ず; used only in a few words (つづく).'
  },
  っ: SOKUON_NOTE,
  ー: {
    zh: '片假名的长音符：把前一个音拉长一拍（コーヒー）。',
    en: 'The katakana long-vowel bar: stretch the previous sound by one beat (コーヒー).'
  },
  ッ: {
    zh: '片假名的促音，用法跟 っ 一样（ベッド）。',
    en: 'The katakana geminate, used like っ (ベッド).'
  },
  ヴ: {
    zh: '外来语里写 v 的音；很多人读成 b。',
    en: 'Writes the v sound in loanwords; many speakers say b.'
  }
}

/** 片假名的说明跟平假名一样的（は 读 wa 这种只说平假名） */
const SHARED_NOTES = ['し', 'ち', 'つ', 'ふ', 'じ', 'ぢ', 'づ', 'ん']

// ── 长得像的 ──

const ALIKE: string[][] = [
  ['あ', 'お'],
  ['い', 'り'],
  ['き', 'さ'],
  ['さ', 'ち'],
  ['ぬ', 'め'],
  ['ね', 'れ', 'わ'],
  ['は', 'ほ'],
  ['る', 'ろ'],
  ['こ', 'に'],
  ['た', 'な'],
  ['シ', 'ツ'],
  ['ソ', 'ン'],
  ['ク', 'ケ', 'タ'],
  ['ウ', 'ワ'],
  ['コ', 'ユ'],
  ['チ', 'テ'],
  ['ヌ', 'ス'],
  ['ナ', 'メ'],
  ['マ', 'ア'],
  ['ル', 'レ']
]

/** 浊音、半浊音跟清音长得像：か / が，ば / ぱ */
function voicedAlike(): string[][] {
  const out: string[][] = []
  const plain = 'かきくけこさしすせそたちつてとはひふへほ'
  const voiced = 'がぎぐげござじずぜぞだぢづでどばびぶべぼ'
  const semi = 'ぱぴぷぺぽ'
  for (let i = 0; i < plain.length; i++) out.push([plain[i], voiced[i]])
  for (let i = 0; i < 5; i++) out.push([voiced[15 + i], semi[i]])
  return [...out, ...out.map((g) => g.map(toKatakana))]
}

/** 罗马字：大多照 kanaToRomaji；を 写 wo，ぢ / づ 输入 di / du 也算 */
function readingOf(kana: string): { reading: string; accept?: string[] } {
  const h = toHiragana(kana)
  if (h === 'を') return { reading: 'wo', accept: ['o'] }
  if (h === 'ぢ') return { reading: 'ji', accept: ['di'] }
  if (h === 'づ') return { reading: 'zu', accept: ['du'] }
  if (h === 'ん') return { reading: 'n', accept: ['nn'] }
  return { reading: kanaToRomaji(kana) }
}

/** 输入题：罗马字转成假名跟答案比（shi / si、tsu / tu 都算），也认读音本身和 accept 里的写法 */
export function kanaTyped(item: SymbolItem, input: string): boolean {
  const s = input.trim().toLowerCase()
  if ([item.reading, ...(item.accept ?? [])].includes(s)) return true
  return romajiToHiragana(s) === toHiragana(item.symbol)
}

const LEARN_ONLY = new Set(['っ', 'ー', 'ッ'])

function item(kana: string, alike: Map<string, Set<string>>): SymbolItem {
  const h = toHiragana(kana)
  const isKata = kana !== h
  const learnOnly = LEARN_ONLY.has(kana)
  const note = NOTES[kana] ?? (isKata && SHARED_NOTES.includes(h) ? NOTES[h] : undefined)
  return {
    key: kana,
    symbol: kana,
    ...(learnOnly ? { reading: '' } : readingOf(kana)),
    ...(alike.has(kana) && { alike: [...alike.get(kana)!] }),
    ...(kana !== 'ー' && { pair: isKata ? h : toKatakana(kana) }),
    say: learnOnly ? null : { text: kana, lang: 'ja-JP' },
    ...(learnOnly && { learnOnly }),
    ...(note && { note }),
    strokes: kana.length === 1
  }
}

function unit(
  id: string,
  title: Text,
  note: Text,
  specs: LessonSpec[],
  test = true
): { unit: CourseUnit; kana: string[] } {
  const lessons: CourseLesson[] = specs.map((s) => ({
    id: `${id}-${s.id}`,
    title: s.title,
    items: s.kana,
    ...(s.note && { note: s.note }),
    ...(s.words && { words: s.words })
  }))
  return { unit: { id, title, note, lessons, test }, kana: specs.flatMap((s) => s.kana) }
}

const U = {
  basic: {
    zh: '平假名是日语最基本的文字，一个假名读一拍。先学 46 个清音，按行学：每行按 a、i、u、e、o 的顺序。',
    en: 'Hiragana is the basic Japanese script; each kana is one beat. Start with the 46 basic kana, row by row, each row in the vowel order a, i, u, e, o.'
  },
  voiced: {
    zh: 'か、さ、た、は 行的假名右上角加两点「゛」变成浊音（か → が）；は 行加小圈「゜」变成半浊音（は → ぱ）。',
    en: 'Two dots (゛) at the top right of the k, s, t and h rows make voiced sounds (か → が); a small circle (゜) on the h row makes p sounds (は → ぱ).'
  },
  yoon: {
    zh: 'い段的假名（き、し、ち……）后面跟小写的 ゃ、ゅ、ょ，两个假名合成一拍：き + ゃ → きゃ（kya）。',
    en: 'An i-column kana (き, し, ち …) followed by a small ゃ, ゅ or ょ merges into one beat: き + ゃ → きゃ (kya).'
  },
  special: {
    zh: '促音和长音不是新的假名，是已经学过的假名的特殊用法。',
    en: 'Geminates and long vowels are not new kana but special uses of the kana you have learned.'
  },
  kBasic: {
    zh: '片假名用来写外来语、拟声词和需要强调的词，读音跟平假名一一对应。',
    en: 'Katakana is used for loanwords, onomatopoeia and emphasis; each one sounds the same as its hiragana counterpart.'
  },
  kSpecial: {
    zh: '片假名用长音符「ー」表示长音，还有一些专门拼写外来语的组合（ファ、ティ……）。',
    en: 'Katakana marks long vowels with the bar ー and has extra combinations for loanwords (ファ, ティ …).'
  }
}

/** 五十音这门课 */
export function kanaCourse(): Course {
  const parts = [
    unit('h1', { zh: '平假名 · 清音', en: 'Hiragana · basic' }, U.basic, BASIC),
    unit('h2', { zh: '平假名 · 浊音与半浊音', en: 'Hiragana · voiced' }, U.voiced, VOICED),
    unit('h3', { zh: '平假名 · 拗音', en: 'Hiragana · contracted' }, U.yoon, YOON),
    unit(
      'h4',
      { zh: '平假名 · 促音与长音', en: 'Hiragana · geminates and long vowels' },
      U.special,
      HIRA_SPECIAL,
      false
    ),
    unit('k1', { zh: '片假名 · 清音', en: 'Katakana · basic' }, U.kBasic, BASIC.map(kata)),
    unit(
      'k2',
      { zh: '片假名 · 浊音与半浊音', en: 'Katakana · voiced' },
      U.voiced,
      VOICED.map(kata)
    ),
    unit('k3', { zh: '片假名 · 拗音', en: 'Katakana · contracted' }, U.yoon, YOON.map(kata)),
    unit(
      'k4',
      { zh: '片假名 · 长音与外来语', en: 'Katakana · long vowels and loanwords' },
      U.kSpecial,
      KATA_SPECIAL
    )
  ]
  const alike = new Map<string, Set<string>>()
  for (const g of [...ALIKE, ...voicedAlike()])
    for (const a of g)
      for (const b of g) if (a !== b) (alike.get(a) ?? alike.set(a, new Set()).get(a)!).add(b)
  const symbols: Record<string, SymbolItem> = {}
  for (const p of parts) for (const k of p.kana) symbols[k] = item(k, alike)
  return {
    id: 'alphabet',
    kind: 'symbols',
    title: { zh: '五十音', en: 'Kana' },
    intro: {
      zh: '从平假名的 あ 行学起，每课先认字、听读音、看笔顺，再做练习；每个单元学完做一次测验。',
      en: 'Start with the あ row of hiragana. Each lesson shows the kana with their sound and stroke order, then a short quiz; each unit ends with a test.'
    },
    units: parts.map((p) => p.unit),
    symbols,
    grammar: {},
    docs: {},
    checkTyped: kanaTyped
  }
}
