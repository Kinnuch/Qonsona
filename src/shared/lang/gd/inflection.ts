/**
 * 苏格兰盖尔语屈折页的词首变化：区分词典已载形式与有条件的拼写规则。
 * 不生成名词变格/动词过去式；完整句子仅来自词典或下方逐条校对的小例集。
 * 规则参考 LearnGaelic / SpeakGaelic；原创句子不是这些机构的引文。
 */
import type { InflectionAlternation } from '../inflection'
import type { LexExample, SourceRef } from '../types'
import type { LexEntryView } from '../views'
import { canLenite, lenite, looksLenited } from './mutation'
import { gdKey, tokenizeGd } from './rules'

export type GdInflectionEntry = Pick<LexEntryView, 'w' | 'p' | 'g' | 'forms' | 'sources'> &
  Partial<Pick<LexEntryView, 'code' | 'examples' | 'senses'>>
type Example = InflectionAlternation['examples'][number]
export const GD_MUTATION_SOURCES: SourceRef[] = [
  {
    id: 'gd-lg-lenition',
    name: 'LearnGaelic: Lenition',
    credit: 'LearnGaelic',
    license: 'Reference only; explanations paraphrased, examples original',
    home: 'https://learngaelic.scot/grammar_hacks/lenition.jsp'
  },
  {
    id: 'gd-sg-lenition',
    name: 'SpeakGaelic: Lenition and s-cluster exceptions',
    credit: 'SpeakGaelic / MG ALBA',
    license: 'Reference only; explanations paraphrased',
    home: 'https://speakgaelic.scot/level/new-friends/topic/asking-about-other-people/section/seimheachadh'
  },
  {
    id: 'gd-lg-article',
    name: 'LearnGaelic: The definite article',
    credit: 'LearnGaelic',
    license: 'Reference only; explanations paraphrased, examples original',
    home: 'https://learngaelic.scot/littlebylittle/grammar/article/index.jsp'
  },
  {
    id: 'gd-sg-possessive',
    name: 'SpeakGaelic A1 Grammar Cheat Sheets',
    credit: 'SpeakGaelic / MG ALBA',
    license: 'Reference only; no worksheet reproduced',
    home: 'https://speakgaelic.scot/uploads/pdf/SG-A1-Grammar-Cheat-Sheets.pdf'
  },
  {
    id: 'gd-sg-sonorants',
    name: 'SpeakGaelic: Lenition of l, n and r',
    credit: 'SpeakGaelic / MG ALBA',
    license: 'Reference only; no transcript reproduced',
    home: 'https://speakgaelic.scot/level/foghlam/topic/guth-air-gramar/section/fuaimneachadh-tha-mi-a-dol-a-leughadh-sin'
  },
  {
    id: 'gd-lg-fh',
    name: 'LearnGaelic: The sound fh',
    credit: 'LearnGaelic',
    license: 'Reference only; no recording reproduced',
    home: 'https://learngaelic.scot/sounds/fh.jsp'
  },
  {
    id: 'gd-original-mutation',
    name: 'Qonsona original Gaelic mutation examples',
    credit: 'Qonsona',
    license: 'MIT',
    home: 'https://github.com/Kinnuch/Qonsona',
    note: 'Original examples checked against the linked teaching rules; not official quotations.'
  }
]
const source = (id: string): SourceRef => GD_MUTATION_SOURCES.find((s) => s.id === id)!
const ORIGINAL = source('gd-original-mutation')
const example = (text: string, zh: string, en: string): Example => ({
  text,
  translation: { zh, en },
  source: ORIGINAL,
  provenance: 'original'
})

/** 只对这些已核对的单数词头展示冠词。未知词不靠词尾猜性/数。 */
const SINGULAR_GENDER: Record<string, 'm' | 'f'> = {
  bàta: 'm',
  cù: 'm',
  doras: 'm',
  falt: 'm',
  gàrradh: 'm',
  màthair: 'f',
  peann: 'm',
  sùil: 'f',
  sràid: 'f',
  slat: 'f',
  snàthad: 'f',
  taigh: 'm',
  sgian: 'f',
  smùid: 'f',
  sporan: 'm',
  stòr: 'm',
  leabaidh: 'f',
  nead: 'm',
  rathad: 'm',
  athair: 'm',
  uisge: 'm',
  òran: 'm',
  bean: 'f',
  faoileag: 'f',
  deoch: 'f',
  nighean: 'f',
  uinneag: 'f',
  duine: 'm'
}
const LENITION_EXAMPLES: Record<string, Example[]> = {
  bàta: [example('Tha mo bhàta beag.', '我的船很小。', 'My boat is small.')],
  cù: [example('Tha do chù mòr.', '你的狗很大。', 'Your dog is big.')],
  doras: [example('Tha mo dhoras dùinte.', '我的门关着。', 'My door is closed.')],
  falt: [example("Tha m' fhalt goirid.", '我的头发很短。', 'My hair is short.')],
  gàrradh: [example('Tha mo ghàrradh beag.', '我的花园很小。', 'My garden is small.')],
  màthair: [example('Tha mo mhàthair an seo.', '我的母亲在这里。', 'My mother is here.')],
  peann: [example('Tha mo pheann ùr.', '我的笔是新的。', 'My pen is new.')],
  sùil: [example('Tha mo shùil goirt.', '我的眼睛疼。', 'My eye is sore.')],
  sràid: [example('Tha mo shràid sàmhach.', '我的街道很安静。', 'My street is quiet.')],
  slat: [example('Tha mo shlat fada.', '我的杆子很长。', 'My rod is long.')],
  snàthad: [example('Tha mo shnàthad beag.', '我的针很小。', 'My needle is small.')],
  taigh: [example('Tha do thaigh mòr.', '你的房子很大。', 'Your house is big.')],
  sgian: [example('Tha mo sgian geur.', '我的刀很锋利。', 'My knife is sharp.')],
  sporan: [example('Tha mo sporan beag.', '我的钱包很小。', 'My purse is small.')],
  stòr: [example('Tha mo stòr làn.', '我的仓库满了。', 'My storehouse is full.')],
  leabaidh: [example('Tha mo leabaidh beag.', '我的床很小。', 'My bed is small.')],
  nead: [example('Tha mo nead beag.', '我的巢很小。', 'My nest is small.')],
  rathad: [example('Tha mo rathad fada.', '我走的路很长。', 'My road is long.')]
}
const ARTICLE_EXAMPLES: Record<string, Example[]> = {
  bàta: [example('Tha am bàta mòr.', '船很大。', 'The boat is big.')],
  cù: [example('Tha an cù an seo.', '狗在这里。', 'The dog is here.')],
  doras: [example('Tha an doras fosgailte.', '门开着。', 'The door is open.')],
  gàrradh: [example('Tha an gàrradh beag.', '花园很小。', 'The garden is small.')],
  màthair: [example("Tha a' mhàthair an seo.", '母亲在这里。', 'The mother is here.')],
  sùil: [example('Tha an t-sùil goirt.', '眼睛疼。', 'The eye is sore.')],
  sràid: [example('Tha an t-sràid sàmhach.', '街道很安静。', 'The street is quiet.')],
  slat: [example('Tha an t-slat fada.', '杆子很长。', 'The rod is long.')],
  snàthad: [example('Tha an t-snàthad beag.', '针很小。', 'The needle is small.')],
  taigh: [example('Tha an taigh mòr.', '房子很大。', 'The house is big.')],
  sgian: [example('Tha an sgian geur.', '刀很锋利。', 'The knife is sharp.')],
  sporan: [example('Tha an sporan beag.', '钱包很小。', 'The purse is small.')],
  stòr: [example('Tha an stòr làn.', '仓库满了。', 'The storehouse is full.')],
  leabaidh: [example('Tha an leabaidh beag.', '床很小。', 'The bed is small.')],
  nead: [example('Tha an nead beag.', '巢很小。', 'The nest is small.')],
  rathad: [example('Tha an rathad fada.', '路很长。', 'The road is long.')],
  athair: [example('Tha an t-athair an seo.', '父亲在这里。', 'The father is here.')],
  uisge: [example('Tha an t-uisge fuar.', '水很冷。', 'The water is cold.')],
  òran: [example('Tha an t-òran brèagha.', '歌很美。', 'The song is beautiful.')],
  bean: [example("Tha a' bhean an seo.", '女人在这里。', 'The woman is here.')],
  faoileag: [example('Tha an fhaoileag an seo.', '海鸥在这里。', 'The seagull is here.')],
  deoch: [example('Tha an deoch fuar.', '饮料很冷。', 'The drink is cold.')],
  nighean: [example('Tha an nighean an seo.', '女孩在这里。', 'The girl is here.')],
  uinneag: [example('Tha an uinneag fosgailte.', '窗户开着。', 'The window is open.')],
  duine: [example('Tha an duine an seo.', '人在这里。', 'The person is here.')]
}
const VOWEL_EXAMPLES: Record<string, Record<'h' | 'n', Example[]>> = {
  athair: {
    h: [example('Tha a h-athair an seo.', '她的父亲在这里。', 'Her father is here.')],
    n: [example('Tha ar n-athair an seo.', '我们的父亲在这里。', 'Our father is here.')]
  },
  òran: {
    h: [example('Tha a h-òran brèagha.', '她的歌很美。', 'Her song is beautiful.')],
    n: [example('Tha ar n-òran brèagha.', '我们的歌很美。', 'Our song is beautiful.')]
  }
}
const PLURAL_EXAMPLES: Record<string, Example[]> = {
  òrain: [example('Tha na h-òrain brèagha.', '这些歌很美。', 'The songs are beautiful.')],
  athraichean: [example('Tha na h-athraichean an seo.', '父亲们在这里。', 'The fathers are here.')]
}
const plain = (word: string): boolean =>
  /^[A-Za-zÀÈÌÒÙÁÉÍÓÚàèìòùáéíóú]+$/u.test(word) && word.length > 1
const vowelInitial = (word: string): boolean => /^[aeiouàèìòùáéíóú]/i.test(word)
const sTakesMutation = (word: string): boolean => /^s[aeiouàèìòùáéíóúlnr]/i.test(word)
/** 固定词头/原有词形的真实例句，按连续词串匹配，不把别的词条句子换词套用。 */
function containsForm(text: string, form: string): boolean {
  const words = (s: string): string[] =>
    tokenizeGd(s)
      .filter((t) => t.kind === 'word')
      .map((t) => gdKey(t.text))
  const tokens = words(text),
    need = words(form)
  return need.length > 0 && tokens.some((_, at) => need.every((part, i) => tokens[at + i] === part))
}
function attachedExamples(entry: GdInflectionEntry, form: string): Example[] {
  const raw: LexExample[] = [
    ...(entry.examples ?? []),
    ...(entry.senses ?? []).flatMap((s) => s.examples)
  ]
  const seen = new Set<string>()
  return raw
    .filter((ex) => containsForm(ex.text, form) && !seen.has(ex.text) && (seen.add(ex.text), true))
    .slice(0, 3)
    .map((ex) => ({
      text: ex.text,
      ...(ex.zh || ex.en
        ? { translation: { ...(ex.zh ? { zh: ex.zh } : {}), ...(ex.en ? { en: ex.en } : {}) } }
        : {}),
      sourceId: ex.src ?? undefined,
      ...(entry.sources.find((s) => s.id === ex.src)
        ? { source: entry.sources.find((s) => s.id === ex.src) }
        : {}),
      provenance: 'dictionary'
    }))
}
function examplesFor(entry: GdInflectionEntry, form: string, curated: Example[] = []): Example[] {
  const existing = attachedExamples(entry, form)
  return [
    ...existing,
    ...curated.filter(
      (ex) => containsForm(ex.text, form) && !existing.some((old) => old.text === ex.text)
    )
  ].slice(0, 4)
}
function article(word: string, gender: 'm' | 'f'): string {
  if (gender === 'm')
    return vowelInitial(word) ? `an t-${word}` : /^[bfmp]/i.test(word) ? `am ${word}` : `an ${word}`
  if (/^[bcgmp]/i.test(word)) return `a' ${lenite(word)}`
  if (/^f/i.test(word)) return `an ${lenite(word)}`
  if (sTakesMutation(word)) return `an t-${word}`
  return `an ${word}`
}

export function gdInflectionAlternations(entry: GdInflectionEntry): InflectionAlternation[] {
  if (entry.code !== undefined && entry.code !== 'gd') return []
  const word = entry.w.normalize('NFC'),
    key = gdKey(word)
  if (!plain(word) || looksLenited(word) || !/[bcdfglmnrpst]|^[aeiouàèìòùáéíóú]/i.test(word[0]))
    return []
  const noun = entry.p.includes('noun'),
    out: InflectionAlternation[] = []
  const push = (
    id: string,
    title: InflectionAlternation['title'],
    form: string,
    tags: string[],
    notice: InflectionAlternation['notice'],
    refs: SourceRef[],
    curated: Example[] = [],
    dictionaryForm = false
  ): void => {
    out.push({
      id,
      title,
      form,
      tags,
      notice,
      provenance: dictionaryForm ? 'dictionary' : 'rule',
      examples: examplesFor(entry, form, curated),
      sources: [...refs, ...(dictionaryForm ? entry.sources : [])]
    })
  }
  if (!vowelInitial(word)) {
    const changed = canLenite(word),
      form = lenite(word),
      written = entry.forms.some(
        (f) =>
          gdKey(f.form) === gdKey(form) && f.tags.some((t) => ['lenition', 'lenited'].includes(t))
      )
    const blocked = /^s[gmpt]/i.test(word),
      sonorant = /^[lnr]/i.test(word)
    const notice = blocked
      ? {
          zh: 'sg/sm/sp/st 不作常规 s→sh 弱化；需要弱化的语境中也保留这个拼写。不添加爱尔兰语式的辅音掩蔽前缀。',
          en: 'Initial sg/sm/sp/st resist ordinary s→sh lenition and retain this spelling in leniting contexts. No Irish-style consonant eclipsis is generated.'
        }
      : sonorant
        ? {
            zh: 'l/n/r 弱化不加 h，拼写仍是原形；发音可以改变，不能据拼写不变断言没有弱化。这里只显示拼写，不推测统一IPA。',
            en: 'Lenition of l/n/r is not marked by h: spelling stays unchanged, although pronunciation can change. No universal IPA is inferred.'
          }
        : {
            zh: '仅在要求弱化的语境中采用此拼写，例如名词前的 mo/do/a（他的）。这不是属格、复数或动词过去式推导；冠词后有专门规则，d/t 不机械加 h，s 可改用 t-。',
            en: 'Use this spelling only in a leniting context, such as mo/do/a (his) before nouns. It does not derive genitives, plurals or verbal past tenses; articles have separate rules, including unchanged d/t and t- before eligible s.'
          }
    if (changed || blocked || sonorant)
      push(
        'gd-lenition',
        {
          zh: changed ? '弱化拼写' : sonorant ? '弱化时拼写不变' : 's 辅音群不弱化',
          en: changed
            ? 'Lenited spelling'
            : sonorant
              ? 'Lenition without a spelling change'
              : 's-cluster resists lenition'
        },
        form,
        changed ? ['lenition'] : ['unchanged'],
        notice,
        [
          source('gd-lg-lenition'),
          source('gd-sg-lenition'),
          ...(sonorant ? [source('gd-sg-sonorants')] : []),
          ...(/^f/i.test(word) ? [source('gd-lg-fh')] : [])
        ],
        noun ? (LENITION_EXAMPLES[key] ?? []) : [],
        written
      )
  }
  if (noun && (entry.g === 'm' || entry.g === 'f') && SINGULAR_GENDER[key] === entry.g) {
    push(
      'gd-article-nominative-singular',
      { zh: '定冠词：单数主格', en: 'Definite article: nominative singular' },
      article(word, entry.g as 'm' | 'f'),
      ['definite', 'nominative', 'singular', entry.g === 'm' ? 'masculine' : 'feminine'],
      {
        zh: '限这里已核对的单数名词和词典明确标出的性。阴性 b/c/g/m/p 弱化，f 用 an fh-，可变化的 s 用 an t-s-；d/t/l/n/r 及 sg/sm/sp/st 不照套 sh。属格和介词格不由此表推导。',
        en: 'Restricted to checked singular nouns with explicit dictionary gender. Feminine b/c/g/m/p lenite, f takes an fh-, eligible s takes an t-s-; d/t/l/n/r and sg/sm/sp/st do not follow a sh template. Genitive and prepositional-case forms are not inferred.'
      },
      [source('gd-lg-article')],
      ARTICLE_EXAMPLES[key] ?? []
    )
  }
  if (noun && vowelInitial(word)) {
    push(
      'gd-possessive-h',
      { zh: '她的：元音前 h-', en: 'Her: h- before a vowel' },
      `a h-${word}`,
      ['possessive', 'h-prothesis'],
      {
        zh: 'a（她的）在元音开头名词前加 h-；它与 a（他的）引起的辅音弱化不同。不是给任何词任意加 h。',
        en: 'Possessive a (her) adds h- before a vowel-initial noun, unlike a (his) with consonant lenition.'
      },
      [source('gd-sg-possessive')],
      VOWEL_EXAMPLES[key]?.h ?? []
    )
    push(
      'gd-possessive-n',
      { zh: '我们的/你们的：元音前 n-', en: 'Our/your plural: n- before a vowel' },
      `ar n-${word}`,
      ['possessive', 'n-prothesis'],
      {
        zh: '这里只展示 ar（我们的）；ur（你们的）也在元音前加 n-。这是盖尔语元音前 n-，不是爱尔兰语把 b/c/d 等辅音掩蔽成 mb/gc/nd 的规则。',
        en: 'Shown with ar (our); ur (your plural) also takes n- before vowels. This is Gaelic vowel prothesis, not Irish consonant eclipsis such as mb/gc/nd.'
      },
      [source('gd-sg-possessive')],
      VOWEL_EXAMPLES[key]?.n ?? []
    )
  }
  if (noun) {
    const seen = new Set<string>()
    for (const row of entry.forms) {
      const fkey = gdKey(row.form)
      if (
        !row.tags.includes('plural') ||
        row.tags.some((t) =>
          ['genitive', 'dative', 'vocative', 'accusative', 'lenition', 'lenited'].includes(t)
        ) ||
        !plain(row.form) ||
        !vowelInitial(row.form) ||
        seen.has(fkey)
      )
        continue
      seen.add(fkey)
      push(
        `gd-article-plural-${fkey}`,
        {
          zh: '定冠词：已收录的元音开头复数',
          en: 'Definite article: attested vowel-initial plural'
        },
        `na h-${row.form}`,
        ['definite', 'nominative', 'plural', 'h-prothesis'],
        {
          zh: '复数本身来自词典，不从词头猜造；这里只在已收录的普通复数前加 na h-。不拿属格复数或已弱化形式套用。',
          en: 'The plural noun is supplied by the dictionary, not invented from the lemma. Na h- is added only to an attested plain vowel-initial plural, excluding genitive or already lenited forms.'
        },
        [source('gd-lg-article')],
        PLURAL_EXAMPLES[fkey] ?? []
      )
    }
  }
  return out
}
