/**
 * 西班牙语的规则：查词的键、切词、猜原形（纯函数；数据管线写 form 表、主进程查词都用这一份）。
 *
 * - key：NFC、统一撇号、小写（重音符、ñ、ü 都留着：año 跟 ano、sí 跟 si 是不同的词）。
 * - looseKey：再去掉重音符与 ñ、ü 上的记号（没装西语键盘的人打 espanol、manana、pinguino 也能查到）。
 * - tokenize：Intl.Segmenter 切词，再把序数词（1.º、2.ª、3.er、1ra）并成一个数字；¿ ¡ 本来就单独成标点。
 *   al、del 不拆：它们在正文里是一个词，词典里也各有词条（a + el、de + el 的缩合）。
 * - lemmaCandidates：词典的变形表里找不到时猜原形，按可能性排，阅读器取第一个查得到的：
 *   1. 缩合：al → a、el；del → de、el；pa'l → para、el。
 *   2. 附着代词：动词不定式、副动词、肯定命令式后面连写的 me te se nos os lo la los las le les（最多三个）：
 *      dámelo → da → dar，diciéndole → diciendo → decir，sentaos → sentad → sentar，vámonos → vamos → ir；
 *      加代词时为保持重音多写的重音符去掉（dá → da），单音节的先试原样（démelo → dé）。
 *   3. 名词、形容词的复数与阴性：canciones → canción，exámenes → examen，lápices → lápiz，buena → bueno，
 *      profesora → profesor，alemana → alemán；指小词、绝对最高级、-mente 副词：casita → casa，
 *      poquito → poco，riquísimo → rico，rápidamente → rápida → rápido。
 *   4. 规则动词的变位倒推（词典里没收变位表的少见动词）：hablábamos → hablar，busqué → buscar，
 *      venzo → vencer，leyeron → leer；再试词干元音变化的还原（ie → e、ue → o、i → e、u → o）。
 */
import { defaultKey, segmentWords, stripMarks } from '../text'
import type { LangRules, LemmaGuess, RawToken } from '../types'
import { acuteLastVowel, stressedSyllable, stripAcute, syllables } from './phonology'

const key = (text: string): string => defaultKey(text, 'es')
const looseKey = (text: string): string => stripMarks(key(text))

// ───────────────────────── 切词 ─────────────────────────

/** 数字后面的序数词尾：1.º 2.ª 3.er 1ra 2do 20.º */
const ORD_SUFFIX = /^(º|ª|o|a|os|as|er|era|ero|eros|eras|ro|ra|do|da|to|ta|vo|va|no|na|mo|ma)$/
const ORD_WORD = /^\d+(º|ª|o|a|os|as|er|era|ero|ro|ra|do|da|to|ta|vo|va|no|na|mo|ma)$/

function tokenize(text: string): RawToken[] {
  const raw = segmentWords(text, 'es')
  const out: RawToken[] = []
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i]
    // 1.º、2.ª、3.er：数字 + 点 + 词尾（中间不隔空白）→ 一个数字
    const dot = raw[i + 1]
    const suf = raw[i + 2]
    if (
      t.kind === 'num' &&
      dot?.text === '.' &&
      suf &&
      ORD_SUFFIX.test(suf.text) &&
      dot.start === t.end &&
      suf.start === dot.end
    ) {
      out.push({ text: text.slice(t.start, suf.end), start: t.start, end: suf.end, kind: 'num' })
      i += 2
      continue
    }
    if (t.kind === 'word' && ORD_WORD.test(t.text)) {
      out.push({ ...t, kind: 'num' })
      continue
    }
    out.push(t)
  }
  return out
}

// ───────────────────────── 重音符的增减 ─────────────────────────

const ACUTE: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }
const VOWELS = /[aeiouáéíóúü]/

/** 把第 n 个元音字母（从 0 数）换成带重音符的 */
function acuteAt(word: string, vowelIndex: number): string {
  let k = 0
  for (let i = 0; i < word.length; i++) {
    if (!VOWELS.test(word[i])) continue
    if (k++ === vowelIndex)
      return word.slice(0, i) + (ACUTE[word[i]] ?? word[i]) + word.slice(i + 1)
  }
  return word
}

/** 重读音节的主元音是全词第几个元音字母（从 0 数）；算不出来时 -1 */
function stressedVowel(word: string): number {
  const syl = syllables(word)
  const s = stressedSyllable(word)
  let before = 0
  for (let i = 0; i < s; i++) before += (syl[i].match(/[aeiouáéíóúü]/g) ?? []).length
  const vs = [...(syl[s] ?? '')].filter((c) => VOWELS.test(c))
  // 音节里带重音符的元音；没有时取强元音（a e o）；都是弱元音取后一个
  let k = vs.findIndex((c) => /[áéíóú]/.test(c))
  if (k < 0) k = vs.findIndex((c) => /[aeo]/.test(c))
  if (k < 0) k = vs.length - 1
  return k < 0 ? -1 : before + k
}

/**
 * 换了词尾以后重音符要不要变：原词重读的那个元音还在的话，给出「不带重音符」与「在那个元音上带重音符」两种，
 * 查词时哪个查得到用哪个（canciones → cancion / canción，exámenes → examen / exámen）。
 */
function accentVariants(original: string, stem: string, ending: string): string[] {
  const base = stripAcute(stem) + ending
  const v = stressedVowel(original)
  const out = [base]
  const n = (base.match(/[aeiouü]/g) ?? []).length
  if (v >= 0 && v < n) out.push(acuteAt(base, v))
  return out
}

/** 在每个元音上各试一次重音符（音节不多的词）：rapido → rápido、rapído、rapidó */
function everyAccent(word: string): string[] {
  const out = [word]
  const n = (word.match(/[aeiou]/g) ?? []).length
  if (n > 4 || /[áéíóú]/.test(word)) return out
  for (let i = 0; i < n; i++) out.push(acuteAt(word, i))
  return out
}

// ───────────────────────── 缩合 ─────────────────────────

const CONTRACTIONS = new Map<string, string[]>([
  ['al', ['a', 'el']],
  ['del', ['de', 'el']],
  ["pa'l", ['para', 'el']],
  ["pa'", ['para']],
  ["p'", ['para']]
])

// ───────────────────────── 附着代词 ─────────────────────────

const CLITICS = ['los', 'las', 'les', 'nos', 'lo', 'la', 'le', 'me', 'te', 'se', 'os']

/** 不规则的 tú 命令式（和 vosotros 的 id）→ 不定式 */
const IRREGULAR_IMPERATIVE = new Map<string, string>([
  ['di', 'decir'],
  ['haz', 'hacer'],
  ['ve', 'ir'],
  ['pon', 'poner'],
  ['sal', 'salir'],
  ['sé', 'ser'],
  ['ten', 'tener'],
  ['ven', 'venir'],
  ['oye', 'oír'],
  ['da', 'dar'],
  ['dé', 'dar'],
  ['id', 'ir'],
  ['rehaz', 'rehacer'],
  ['deshaz', 'deshacer'],
  ['satisfaz', 'satisfacer'],
  ['supón', 'suponer'],
  ['propón', 'proponer'],
  ['dispón', 'disponer'],
  ['compón', 'componer'],
  ['expón', 'exponer'],
  ['mantén', 'mantener'],
  ['obtén', 'obtener'],
  ['detén', 'detener'],
  ['contén', 'contener'],
  ['retén', 'retener'],
  ['sostén', 'sostener'],
  ['entretén', 'entretener'],
  ['convén', 'convenir'],
  ['prevén', 'prevenir'],
  ['intervén', 'intervenir']
])

/** 把词尾的代词一个个剥下来（最多三个），给出各种剥法（剥得少的在前） */
function peelClitics(w: string): { base: string; clitics: string[] }[] {
  const out: { base: string; clitics: string[] }[] = []
  let layer: { base: string; clitics: string[] }[] = [{ base: w, clitics: [] }]
  for (let depth = 0; depth < 3; depth++) {
    const next: { base: string; clitics: string[] }[] = []
    for (const { base: rest, clitics: got } of layer)
      for (const c of CLITICS) {
        if (!rest.endsWith(c) || rest.length - c.length < 2) continue
        next.push({ base: rest.slice(0, -c.length), clitics: [c, ...got] })
      }
    out.push(...next)
    layer = next
  }
  return out
}

/** 剥掉代词以后的词干可能是什么：不定式、副动词、肯定命令式（tú、usted、nosotros、vosotros、vos） */
function verbBases(
  base: string,
  clitics: string[],
  surfaceAccented: boolean
): { form: string; tags: string[] }[] {
  const out: { form: string; tags: string[] }[] = []
  const plain = stripAcute(base)
  const accented = base !== plain
  const forms: string[] = []
  if (accented) {
    // 加代词时多写的重音符（dámelo、diciéndole、háganlo）去掉；单音节的先试原样（démelo → dé）
    if (syllables(plain).length === 1) forms.push(base, plain)
    else forms.push(plain, base)
  } else forms.push(base)
  for (const f of forms) {
    if (/r$/.test(f)) {
      out.push({ form: f, tags: ['infinitive', 'combined-form'] })
      continue
    }
    if (/ndo$/.test(f)) {
      out.push({ form: f, tags: ['gerund', 'combined-form'] })
      continue
    }
    const first = clitics[0]
    // vosotros 命令式在 os 前去掉 -d：sentaos → sentad；vestíos → vestid
    if (first === 'os' && /[aei]$/.test(stripAcute(f)))
      out.push({
        form: stripAcute(f) + 'd',
        tags: ['imperative', 'second-person', 'plural', 'combined-form']
      })
    // nosotros 命令式在 nos 前去掉 -s：sentémonos → sentemos；vámonos → vamos
    if (first === 'nos' && /mo$/.test(f))
      out.push({
        form: stripAcute(f) + 's',
        tags: ['imperative', 'first-person', 'plural', 'combined-form']
      })
    if (!/[aeiouáéíóúdnzl]$/.test(f) && !IRREGULAR_IMPERATIVE.has(f)) continue
    // 单音节的命令式只有那几个不规则的（da、di、ve、haz、pon……）；tele 不是 te + le
    if (syllables(stripAcute(f)).length === 1 && !IRREGULAR_IMPERATIVE.has(f)) continue
    // 两个音节以上的命令式加了代词，重音落到倒数第三个音节以前，照规矩要写重音符（cuéntame、dígame）；
    // 整个词一个重音符都没有的，多半是 voseo 命令式（decime ← decí、contame ← contá）
    if (!surfaceAccented && syllables(f).length >= 2 && /[aeiou]$/.test(f)) {
      out.push({ form: acuteLastVowel(f), tags: ['imperative', 'vos-form', 'combined-form'] })
      continue
    }
    out.push({ form: f, tags: ['imperative', 'combined-form'] })
  }
  return out
}

// ───────────────────────── 规则动词的变位倒推 ─────────────────────────

type Conj = 'ar' | 'er' | 'ir' | 'eir'

/** [词尾, 哪类动词（eir 是 -er 或 -ir）, 标签]：长的在前 */
const ENDINGS: [string, Conj, string[]][] = (
  [
    ['ando', 'ar', 'gerund'],
    ['iendo', 'eir', 'gerund'],
    ['yendo', 'eir', 'gerund'],
    ['ados', 'ar', 'participle past masculine plural'],
    ['adas', 'ar', 'participle past feminine plural'],
    ['ado', 'ar', 'participle past'],
    ['ada', 'ar', 'participle past feminine singular'],
    ['idos', 'eir', 'participle past masculine plural'],
    ['idas', 'eir', 'participle past feminine plural'],
    ['ido', 'eir', 'participle past'],
    ['ida', 'eir', 'participle past feminine singular'],
    ['aríamos', 'ar', 'conditional first-person plural'],
    ['eríamos', 'er', 'conditional first-person plural'],
    ['iríamos', 'ir', 'conditional first-person plural'],
    ['aríais', 'ar', 'conditional second-person plural'],
    ['eríais', 'er', 'conditional second-person plural'],
    ['iríais', 'ir', 'conditional second-person plural'],
    ['arían', 'ar', 'conditional third-person plural'],
    ['erían', 'er', 'conditional third-person plural'],
    ['irían', 'ir', 'conditional third-person plural'],
    ['arías', 'ar', 'conditional second-person singular'],
    ['erías', 'er', 'conditional second-person singular'],
    ['irías', 'ir', 'conditional second-person singular'],
    ['aría', 'ar', 'conditional singular'],
    ['ería', 'er', 'conditional singular'],
    ['iría', 'ir', 'conditional singular'],
    ['aremos', 'ar', 'future first-person plural'],
    ['eremos', 'er', 'future first-person plural'],
    ['iremos', 'ir', 'future first-person plural'],
    ['aréis', 'ar', 'future second-person plural'],
    ['eréis', 'er', 'future second-person plural'],
    ['iréis', 'ir', 'future second-person plural'],
    ['arán', 'ar', 'future third-person plural'],
    ['erán', 'er', 'future third-person plural'],
    ['irán', 'ir', 'future third-person plural'],
    ['arás', 'ar', 'future second-person singular'],
    ['erás', 'er', 'future second-person singular'],
    ['irás', 'ir', 'future second-person singular'],
    ['ará', 'ar', 'future third-person singular'],
    ['erá', 'er', 'future third-person singular'],
    ['irá', 'ir', 'future third-person singular'],
    ['aré', 'ar', 'future first-person singular'],
    ['eré', 'er', 'future first-person singular'],
    ['iré', 'ir', 'future first-person singular'],
    ['áramos', 'ar', 'imperfect subjunctive first-person plural'],
    ['iéramos', 'eir', 'imperfect subjunctive first-person plural'],
    ['ásemos', 'ar', 'imperfect subjunctive first-person plural'],
    ['iésemos', 'eir', 'imperfect subjunctive first-person plural'],
    ['arais', 'ar', 'imperfect subjunctive second-person plural'],
    ['ierais', 'eir', 'imperfect subjunctive second-person plural'],
    ['aseis', 'ar', 'imperfect subjunctive second-person plural'],
    ['ieseis', 'eir', 'imperfect subjunctive second-person plural'],
    ['aran', 'ar', 'imperfect subjunctive third-person plural'],
    ['ieran', 'eir', 'imperfect subjunctive third-person plural'],
    ['yeran', 'eir', 'imperfect subjunctive third-person plural'],
    ['asen', 'ar', 'imperfect subjunctive third-person plural'],
    ['iesen', 'eir', 'imperfect subjunctive third-person plural'],
    ['aras', 'ar', 'imperfect subjunctive second-person singular'],
    ['ieras', 'eir', 'imperfect subjunctive second-person singular'],
    ['ases', 'ar', 'imperfect subjunctive second-person singular'],
    ['ieses', 'eir', 'imperfect subjunctive second-person singular'],
    ['ara', 'ar', 'imperfect subjunctive singular'],
    ['iera', 'eir', 'imperfect subjunctive singular'],
    ['yera', 'eir', 'imperfect subjunctive singular'],
    ['ase', 'ar', 'imperfect subjunctive singular'],
    ['iese', 'eir', 'imperfect subjunctive singular'],
    ['ábamos', 'ar', 'imperfect indicative first-person plural'],
    ['abais', 'ar', 'imperfect indicative second-person plural'],
    ['aban', 'ar', 'imperfect indicative third-person plural'],
    ['abas', 'ar', 'imperfect indicative second-person singular'],
    ['aba', 'ar', 'imperfect indicative singular'],
    ['íamos', 'eir', 'imperfect indicative first-person plural'],
    ['íais', 'eir', 'imperfect indicative second-person plural'],
    ['ían', 'eir', 'imperfect indicative third-person plural'],
    ['ías', 'eir', 'imperfect indicative second-person singular'],
    ['ía', 'eir', 'imperfect indicative singular'],
    ['asteis', 'ar', 'preterite second-person plural'],
    ['isteis', 'eir', 'preterite second-person plural'],
    ['aron', 'ar', 'preterite third-person plural'],
    ['ieron', 'eir', 'preterite third-person plural'],
    ['yeron', 'eir', 'preterite third-person plural'],
    ['aste', 'ar', 'preterite second-person singular'],
    ['iste', 'eir', 'preterite second-person singular'],
    ['imos', 'eir', 'first-person plural'],
    ['amos', 'ar', 'first-person plural'],
    ['amos', 'eir', 'present subjunctive first-person plural'],
    ['emos', 'er', 'present first-person plural'],
    ['emos', 'ar', 'present subjunctive first-person plural'],
    ['ió', 'eir', 'preterite third-person singular'],
    ['yó', 'eir', 'preterite third-person singular'],
    ['é', 'ar', 'preterite first-person singular'],
    ['í', 'eir', 'preterite first-person singular'],
    ['ó', 'ar', 'preterite third-person singular'],
    ['áis', 'ar', 'present second-person plural'],
    ['áis', 'eir', 'present subjunctive second-person plural'],
    ['éis', 'er', 'present second-person plural'],
    ['éis', 'ar', 'present subjunctive second-person plural'],
    ['ís', 'ir', 'present second-person plural'],
    ['ad', 'ar', 'imperative second-person plural'],
    ['ed', 'er', 'imperative second-person plural'],
    ['id', 'ir', 'imperative second-person plural'],
    ['an', 'ar', 'present third-person plural'],
    ['en', 'eir', 'present third-person plural'],
    ['en', 'ar', 'present subjunctive third-person plural'],
    ['an', 'eir', 'present subjunctive third-person plural'],
    ['ás', 'ar', 'present second-person singular vos-form'],
    ['és', 'er', 'present second-person singular vos-form'],
    ['as', 'ar', 'present second-person singular'],
    ['es', 'eir', 'present second-person singular'],
    ['es', 'ar', 'present subjunctive second-person singular'],
    ['as', 'eir', 'present subjunctive second-person singular'],
    ['á', 'ar', 'imperative second-person singular vos-form'],
    ['o', 'ar', 'present first-person singular'],
    ['o', 'eir', 'present first-person singular'],
    ['a', 'ar', 'present third-person singular'],
    ['e', 'eir', 'present third-person singular'],
    ['e', 'ar', 'present subjunctive singular'],
    ['a', 'eir', 'present subjunctive singular']
  ] as [string, Conj, string][]
).map(([e, c, t]) => [e, c, t.split(' ')])

/** 词干末尾的拼写还原与词干元音变化的还原 */
function stemVariants(stem: string, ending: string, conj: Conj): string[] {
  const out = [stem]
  const front = /^[eéií]/.test(ending)
  if (conj === 'ar' && front) {
    // busqu-é → busc-ar，llegu-é → lleg-ar，averigü-é → averigu-ar，empec-é → empez-ar
    if (stem.endsWith('qu')) out.push(stem.slice(0, -2) + 'c')
    if (stem.endsWith('gu')) out.push(stem.slice(0, -2) + 'g')
    if (stem.endsWith('gü')) out.push(stem.slice(0, -2) + 'gu')
    if (stem.endsWith('c')) out.push(stem.slice(0, -1) + 'z')
  }
  if (conj !== 'ar' && !front) {
    // venz-o → venc-er，coj-o → cog-er，sig-o → segu-ir，conozc-o → conoc-er
    if (stem.endsWith('zc')) out.push(stem.slice(0, -2) + 'c')
    else if (stem.endsWith('z')) out.push(stem.slice(0, -1) + 'c')
    if (stem.endsWith('j')) out.push(stem.slice(0, -1) + 'g')
    if (stem.endsWith('g')) out.push(stem.slice(0, -1) + 'gu')
  }
  // -uir 动词：construy-o → constru-ir
  if (conj !== 'ar' && stem.endsWith('uy')) out.push(stem.slice(0, -1))
  // 词干元音变化：最后一处 ie → e、ue → o（jugar 的 ue → u）、i → e、u → o
  const more: string[] = []
  for (const s of out) {
    const swap = (from: string, to: string): void => {
      const i = s.lastIndexOf(from)
      if (i >= 0) more.push(s.slice(0, i) + to + s.slice(i + from.length))
    }
    swap('ie', 'e')
    swap('ue', 'o')
    swap('ue', 'u')
    if (conj !== 'ar') {
      swap('i', 'e')
      swap('u', 'o')
    }
  }
  return [...out, ...more]
}

/** 肯定命令式可能有的词尾：tú（-a、-e）、usted / ustedes（虚拟式 -e、-a、-en、-an）、vosotros（-ad、-ed、-id）、
 * nosotros（-emos、-amos）、vos（-á、-é、-í） */
const IMPERATIVE_ENDINGS = new Set([
  'a',
  'e',
  'á',
  'é',
  'í',
  'an',
  'en',
  'ad',
  'ed',
  'id',
  'amos',
  'emos'
])
const GERUND_ENDINGS = new Set(['ando', 'iendo', 'yendo'])

function deconjugate(w: string, only?: Set<string>): LemmaGuess[] {
  const out: LemmaGuess[] = []
  for (const [ending, conj, tags] of ENDINGS) {
    if (only && !only.has(ending)) continue
    // 词干至少两个字母：ver、dar、ser、ir 这些短动词都不规则、都在变形表里，不用倒推（vamos 不是 v + -amos）
    if (!w.endsWith(ending) || w.length - ending.length < 2) continue
    const stem = w.slice(0, -ending.length)
    const infs: string[] = conj === 'eir' ? ['er', 'ir'] : [conj]
    for (const s of stemVariants(stem, ending, conj))
      for (const inf of infs) {
        out.push({ lemma: s + inf, tags })
        // le-yeron → le-er 已经有了；o-yó → o-ír、re-ía → re-ír（带重音的 -ír）
        if (inf === 'ir' && /[aeo]$/.test(s)) out.push({ lemma: s + 'ír', tags })
      }
  }
  return out
}

// ───────────────────────── 名词、形容词 ─────────────────────────

function nominal(w: string): LemmaGuess[] {
  const out: LemmaGuess[] = []
  const add = (forms: string[], tags: string[]): void => {
    for (const lemma of forms) out.push({ lemma, tags })
  }
  // 复数：-ces → -z，-es、-s 去掉（重音符随重读元音增减）
  if (w.endsWith('ces')) add(accentVariants(w, w.slice(0, -3), 'z'), ['plural'])
  if (w.endsWith('es') && w.length > 3) add(accentVariants(w, w.slice(0, -2), ''), ['plural'])
  if (w.endsWith('s') && w.length > 2) add(accentVariants(w, w.slice(0, -1), ''), ['plural'])
  // 阴性（单复数）：-a → -o；-ora → -or、-ona → -ón、-ana → -án、-esa → -és、-ina → -ín
  const fem = w.endsWith('as') ? w.slice(0, -1) : w
  const ftags = fem !== w ? ['feminine', 'plural'] : ['feminine']
  if (fem.endsWith('a') && fem.length > 2) {
    add([fem.slice(0, -1) + 'o'], ftags)
    if (/(or|on|an|es|in|ol|ul)a$/.test(stripAcute(fem)))
      add(accentVariants(fem, fem.slice(0, -1), ''), ftags)
  }
  // 指小词（casita、cafecito、chiquillo）、绝对最高级（riquísimo、amabilísimo）
  const sufx: [RegExp, string[]][] = [
    [/(?:ecit|cit|it|ill|ic)([oa]s?)$/, ['diminutive']],
    [/ísim([oa]s?)$/, ['superlative']]
  ]
  for (const [re, tags] of sufx) {
    const m = re.exec(w)
    if (!m) continue
    const stem = w.slice(0, m.index)
    if (stem.length < 2) continue
    const gend = m[1].startsWith('a') ? 'a' : 'o'
    const stems = [stem]
    if (stem.endsWith('qu')) stems.push(stem.slice(0, -2) + 'c')
    if (stem.endsWith('gu')) stems.push(stem.slice(0, -2) + 'g')
    if (stem.endsWith('c')) stems.push(stem.slice(0, -1) + 'z')
    if (stem.endsWith('bil')) stems.push(stem.slice(0, -3) + 'bl')
    for (const s of stems) for (const end of [gend, 'o', 'e', '']) add(everyAccent(s + end), tags)
  }
  // -mente 副词：rápidamente → rápida → rápido
  if (w.endsWith('mente') && w.length > 7) {
    const adj = w.slice(0, -5)
    add([adj], ['adverb'])
    if (adj.endsWith('a')) add([adj.slice(0, -1) + 'o'], ['adverb'])
  }
  return out
}

// ───────────────────────── 合起来 ─────────────────────────

function lemmaCandidates(surface: string): LemmaGuess[] {
  const w = key(surface)
  if (!w || /\s/.test(w)) return []
  const out: LemmaGuess[] = []
  const seen = new Set<string>([w])
  const push = (g: LemmaGuess): void => {
    if (!g.lemma || seen.has(g.lemma)) return
    seen.add(g.lemma)
    out.push(g)
  }
  for (const l of CONTRACTIONS.get(w) ?? []) push({ lemma: l, tags: ['contraction'] })

  // 附着代词：不规则命令式表 → 词干本身（变形表里有就对上）→ 倒推出的不定式
  if (w.length >= 4) {
    const accented = /[áéíóú]/.test(w)
    for (const { base, clitics } of peelClitics(w)) {
      // 只带一个 se 的（siéntese、cállense）多半是 usted / ustedes 命令式，用的是虚拟式：-e 结尾的是 -ar 动词
      const usted = clitics.length === 1 && clitics[0] === 'se'
      for (const b of verbBases(base, clitics, accented)) {
        const imperative = b.tags.includes('imperative')
        const irr = IRREGULAR_IMPERATIVE.get(b.form)
        if (irr) push({ lemma: irr, tags: b.tags })
        // 只按这种形式可能有的词尾倒推（命令式不会是 -iste：vístete 是 vestir 不是 ver）
        const guesses = deconjugate(b.form, imperative ? IMPERATIVE_ENDINGS : GERUND_ENDINGS).map(
          (g) => ({ lemma: g.lemma, tags: b.tags })
        )
        if (usted && /en?$/.test(b.form))
          for (const g of guesses) if (g.lemma.endsWith('ar')) push(g)
        // 命令式的词干常跟名词同形（cuéntame 的 cuenta、vístete 的 viste），先试倒推出的不定式；
        // 副动词、不定式本身没有这种问题，先查原样（不规则的 pudiendo、yendo 在变形表里）
        if (imperative) for (const g of guesses) push(g)
        push({ lemma: b.form, tags: b.tags })
        for (const g of guesses) push(g)
      }
    }
  }
  for (const g of nominal(w)) push(g)
  for (const g of deconjugate(w)) push(g)
  return out
}

export const rules: LangRules = {
  key,
  looseKey,
  tokenize,
  lemmaCandidates
}
