/**
 * 千语集语言的课：字母课（字母表里的字母与读音、每套自造文字的字形）和作者写的文档。
 * 全由项目数据推出来，不认识任何一门具体语言；标题这些界面文字由调用方给。纯函数，测试里直接用。
 *
 * - 字母与发音：字母按这门语言的字母表（没有字母表时从词条的拼写里收集），读音用主正字法的规则现转成 IPA；
 *   元音在前、辅音在后，每课不超过 6 个。
 * - 每套自造文字（意音文字除外，那是词典里「字」一栏的事）一个单元：字形 → 转写。
 *   音节文字按辅音分行（像五十音），其他按字形表的分类（元音、辅音……）分课。
 * - 文档：作者写的每篇文档一课，读完就算学过。
 * - 变形：词条存着的各个形（kaso 的 单数·宾格 kasom），按构形分单元、按第一个维度（单数 / 复数）分课；
 *   选择题的干扰项是这个词别的形。
 * - 会话：短语本里的短语按分类分课，读音按正字法规则转成 IPA。
 */
import type { Glyph, Language, LocalizedText, Lexeme, Project, Script } from '$qon/core/model'
import { glyphValues, lexemeScript, renderScript } from '$qon/script/render'
import { paradigmsFor } from '$qon/engine/morph'
import { spellingIpa, storedIpa } from '$lib/packs/qonlang/pronounce'
import type {
  Course,
  CourseLesson,
  CourseUnit,
  DocItem,
  FormItem,
  PhraseItem,
  SpellWord,
  SymbolItem
} from '$shared/course'

export interface QonCourseLabels {
  /** 字母课的名字（按这门语言有没有自造文字：文字 / 字母与发音） */
  alphabet: string
  alphabetIntro: string
  letters: string
  lettersNote: string
  script: (name: string) => string
  scriptNote: string
  docs: string
  docsIntro: string
  docsUnit: string
  forms: string
  formsIntro: string
  phrases: string
  phrasesIntro: string
  phrasesUnit: string
  /** 没写分类的短语 */
  uncategorized: string
}

/** 字形表里不用学的分类：标点、空格、数字、其他 */
const SKIP_CATEGORIES = new Set(['punct', 'space', 'number', 'other'])
/** 只有标点、符号的转写值（消音符 ° 这种）不出题 */
const SYMBOL_ONLY = /^[\p{P}\p{S}\s]+$/u
/** 词条拼写里的分隔符：不算字母 */
const SEPARATOR = /[\s'’\-·.]/

const IPA_VOWEL = /^[aeiouyɑɐɒæɛɜəɘɵɤɔœɶøɪʏʊʉɨɯʌɞ]/

/** 这个 IPA 是不是元音：先看音位表里的特征，没有再看 IPA 字母本身 */
function isVowel(lang: Language, ipa: string): boolean {
  const bare = ipa.replace(/[/[\]]/g, '')
  const ph =
    lang.phonemes.find((p) => p.symbol === bare) ??
    lang.phonemes.find((p) => p.symbol && bare.startsWith(p.symbol))
  const f = ph?.features ?? {}
  if (f.type) return f.type === 'vowel'
  if (f.syllabic) return f.syllabic === 'yes'
  return IPA_VOWEL.test(bare)
}

/** 平均分成每份不超过 max 个（16 个分成 6、5、5） */
export function chunks<T>(list: T[], max = 6): T[][] {
  if (!list.length) return []
  const n = Math.ceil(list.length / max)
  const base = Math.floor(list.length / n)
  const extra = list.length % n
  const out: T[][] = []
  let at = 0
  for (let i = 0; i < n; i++) {
    const size = base + (i < extra ? 1 : 0)
    out.push(list.slice(at, at + size))
    at += size
  }
  return out
}

/** 这门语言的字母：字母表；没有时从词条拼写里按出现顺序收集 */
export function lettersOf(project: Project, lang: Language): string[] {
  if (lang.alphabet.length) return lang.alphabet.filter((x) => x.trim())
  const seen = new Set<string>()
  for (const l of project.lexemes)
    if (l.languageId === lang.id)
      for (const c of l.lemma.normalize('NFC').toLowerCase())
        if (/\p{L}/u.test(c) && !seen.has(c)) seen.add(c)
  return [...seen].sort((a, b) => a.localeCompare(b))
}

/** 按字母切开（最长匹配，ng 算一个）；分隔符跳过，不认识的字符单独成一段 */
export function segmenter(letters: string[]): (text: string) => string[] {
  const sorted = [...new Set(letters.map((l) => l.normalize('NFC').toLowerCase()))].sort(
    (a, b) => b.length - a.length
  )
  return (text) => {
    const s = text.normalize('NFC').toLowerCase()
    const out: string[] = []
    let i = 0
    while (i < s.length) {
      if (SEPARATOR.test(s[i])) {
        i++
        continue
      }
      const hit = sorted.find((l) => s.startsWith(l, i))
      out.push(hit ?? s[i])
      i += hit ? hit.length : 1
    }
    return out
  }
}

/** 一个字母、一个字形的读音：单独转写时规则会给它加重音号、音节点，去掉（整个词的读音保留） */
const unitIpa = (lang: Language, text: string): string =>
  spellingIpa(lang, text).replace(/[ˈˌ.]/g, '').trim()

const letterKey = (letter: string): string => `l:${letter}`
const glyphKey = (script: Script, g: Glyph): string => `g:${script.id}:${g.id}`

function lettersUnit(
  project: Project,
  lang: Language,
  labels: QonCourseLabels,
  symbols: Record<string, SymbolItem>
): CourseUnit | null {
  const items: SymbolItem[] = []
  for (const letter of lettersOf(project, lang)) {
    const ipa = unitIpa(lang, letter)
    // 没有正字法规则、转不出读音的字母没东西可学
    if (!ipa) continue
    items.push({
      key: letterKey(letter),
      symbol: letter,
      reading: `/${ipa}/`,
      ipa,
      say: { ipa },
      typeable: false
    })
  }
  if (!items.length) return null
  const vowels = items.filter((x) => isVowel(lang, x.ipa!))
  const consonants = items.filter((x) => !isVowel(lang, x.ipa!))
  const lessons: CourseLesson[] = [...chunks(vowels), ...chunks(consonants)].map((group, i) => ({
    id: `letters-${i + 1}`,
    title: group.map((x) => x.symbol).join(' · '),
    items: group.map((x) => x.key)
  }))
  for (const x of items) symbols[x.key] = x
  return { id: 'letters', title: labels.letters, note: labels.lettersNote, lessons, test: true }
}

/** 音节文字按辅音分行：转写去掉末尾的元音字母就是这一行的辅音（a、i 这种单独成一行） */
function syllableRows(glyphs: { g: Glyph; value: string }[], vowelLetters: string[]): Glyph[][] {
  const tails = [...vowelLetters].sort((a, b) => b.length - a.length)
  const onset = (v: string): string => {
    let s = v.toLowerCase()
    for (let changed = true; changed;) {
      changed = false
      for (const t of tails)
        if (t && s.length > t.length - 1 && s.endsWith(t)) {
          s = s.slice(0, -t.length)
          changed = true
          break
        }
    }
    return s
  }
  const rows = new Map<string, Glyph[]>()
  for (const { g, value } of glyphs) {
    const k = onset(value)
    rows.set(k, [...(rows.get(k) ?? []), g])
  }
  return [...rows.values()].flatMap((r) => chunks(r))
}

function scriptUnit(
  lang: Language,
  script: Script,
  labels: QonCourseLabels,
  symbols: Record<string, SymbolItem>,
  vowelLetters: string[]
): CourseUnit | null {
  const learnable = script.glyphs
    .map((g) => ({ g, value: glyphValues(g)[0] ?? '' }))
    .filter(
      ({ g, value }) =>
        g.char && value && !SYMBOL_ONLY.test(value) && !SKIP_CATEGORIES.has(g.category)
    )
  if (!learnable.length) return null
  for (const { g, value } of learnable) {
    const ipa = unitIpa(lang, value)
    const others = glyphValues(g).slice(1)
    symbols[glyphKey(script, g)] = {
      key: glyphKey(script, g),
      symbol: g.char,
      reading: value,
      ...(others.length && { accept: others }),
      ...(ipa && { ipa }),
      say: ipa ? { ipa } : null,
      scriptId: script.id,
      ...(g.name && { note: g.name })
    }
  }
  const syllabic =
    script.type === 'syllabary' ||
    learnable.filter(({ g }) => g.category === 'syllable').length > learnable.length / 2
  let groups: Glyph[][]
  if (syllabic && vowelLetters.length) groups = syllableRows(learnable, vowelLetters)
  else {
    // 按字形表的分类（元音、辅音……），分类按第一次出现的先后排
    const byCat = new Map<string, Glyph[]>()
    for (const { g } of learnable) byCat.set(g.category, [...(byCat.get(g.category) ?? []), g])
    groups = [...byCat.values()].flatMap((list) => chunks(list))
  }
  const lessons: CourseLesson[] = groups.map((group, i) => ({
    id: `script-${script.id}-${i + 1}`,
    title: group.map((g) => symbols[glyphKey(script, g)].reading).join(' · '),
    items: group.map((g) => glyphKey(script, g))
  }))
  return {
    id: `script-${script.id}`,
    title: labels.script(script.name),
    note: labels.scriptNote,
    lessons,
    test: true
  }
}

/** 字母课：字母与发音 + 每套（非意音）自造文字 */
export function qonAlphabetCourse(
  project: Project,
  lang: Language,
  labels: QonCourseLabels
): Course {
  const symbols: Record<string, SymbolItem> = {}
  const units: CourseUnit[] = []
  const letters = lettersUnit(project, lang, labels, symbols)
  if (letters) units.push(letters)
  const vowelLetters = letters
    ? letters.lessons
        .flatMap((l) => l.items)
        .map((k) => symbols[k])
        .filter((x) => isVowel(lang, x.ipa!))
        .map((x) => x.symbol)
    : ['a', 'e', 'i', 'o', 'u']
  for (const script of lang.scripts) {
    if (script.type === 'logographic') continue
    const u = scriptUnit(lang, script, labels, symbols, vowelLetters)
    if (u) units.push(u)
  }
  return {
    id: 'alphabet',
    kind: 'symbols',
    title: labels.alphabet,
    intro: labels.alphabetIntro,
    units,
    symbols,
    grammar: {},
    docs: {}
  }
}

/** 文档课：没指定语言的文档（项目说明之类）也算，作者藏起来的不算 */
export function qonDocsCourse(
  project: Project,
  lang: Language,
  hidden: ReadonlySet<string>,
  labels: QonCourseLabels
): Course {
  const docs = project.docs.filter(
    (d) => (d.languageId === lang.id || d.languageId === null) && !hidden.has(d.id)
  )
  const items: Record<string, DocItem> = {}
  for (const d of docs) items[`d:${d.id}`] = { key: `d:${d.id}`, title: d.title, docId: d.id }
  return {
    id: 'grammar',
    kind: 'docs',
    title: labels.docs,
    intro: labels.docsIntro,
    units: docs.length
      ? [
          {
            id: 'docs',
            title: labels.docsUnit,
            lessons: docs.map((d) => ({ id: `doc-${d.id}`, title: d.title, items: [`d:${d.id}`] })),
            test: false
          }
        ]
      : [],
    symbols: {},
    grammar: {},
    docs: items
  }
}

/**
 * 拼读用的词：只用学过的字母（字形）写成、又用到这一课的字的词条。
 * 字母课的词给拼写、问读音（IPA）；自造文字的词给文字写法、问转写
 */
export function qonSpellWords(
  project: Project,
  lang: Language,
  course: Course,
  allowed: readonly string[],
  must: readonly string[],
  opts: {
    gloss: (l: Lexeme) => string
    hidden: ReadonlySet<string>
    limit?: number
  }
): SpellWord[] {
  const first = must[0] ?? allowed[0]
  if (!first) return []
  const limit = opts.limit ?? 8
  const lexemes = project.lexemes.filter(
    (l) => l.languageId === lang.id && !opts.hidden.has(l.id) && l.lemma.trim()
  )
  const ipaOf = (l: Lexeme): string =>
    storedIpa(lang, l.pronunciations) || spellingIpa(lang, l.lemma)
  const out: SpellWord[] = []
  if (first.startsWith('l:')) {
    const ok = new Set(allowed.filter((k) => k.startsWith('l:')).map((k) => k.slice(2)))
    const need = new Set(must.map((k) => k.slice(2)))
    const split = segmenter(lettersOf(project, lang))
    for (const l of lexemes) {
      if (out.length >= limit) break
      const parts = split(l.lemma)
      if (parts.length < 2 || parts.length > 8 || !parts.every((p) => ok.has(p))) continue
      if (need.size && !parts.some((p) => need.has(p))) continue
      const ipa = ipaOf(l)
      if (!ipa) continue
      out.push({ text: l.lemma, reading: `/${ipa}/`, meaning: opts.gloss(l), say: { ipa } })
    }
    return out
  }
  // g:<文字 id>:<字形 id>
  const scriptId = first.split(':')[1]
  const script = lang.scripts.find((s) => s.id === scriptId)
  if (!script) return []
  const chars = (keys: readonly string[]): string[] =>
    keys.map((k) => course.symbols[k]?.symbol).filter((c): c is string => !!c)
  const ok = new Set(chars(allowed.filter((k) => k.startsWith(`g:${scriptId}:`))))
  const need = new Set(chars(must))
  for (const l of lexemes) {
    if (out.length >= limit) break
    const written = lexemeScript(lang, script, l).trim()
    const glyphs = [...written].filter((c) => !/\s/.test(c))
    if (glyphs.length < 2 || glyphs.length > 8 || !glyphs.every((c) => ok.has(c))) continue
    if (need.size && !glyphs.some((c) => need.has(c))) continue
    const ipa = ipaOf(l)
    out.push({
      text: written,
      reading: l.lemma,
      meaning: opts.gloss(l),
      say: ipa ? { ipa } : null,
      scriptId
    })
  }
  return out
}

/** 认字时的例词：这个字母（字形）开头的词条，最多 n 个 */
export function qonStartWords(
  project: Project,
  lang: Language,
  course: Course,
  key: string,
  opts: { gloss: (l: Lexeme) => string; hidden: ReadonlySet<string>; limit?: number }
): SpellWord[] {
  const item = course.symbols[key]
  if (!item) return []
  const limit = opts.limit ?? 3
  const lexemes = project.lexemes.filter(
    (l) => l.languageId === lang.id && !opts.hidden.has(l.id) && l.lemma.trim()
  )
  const out: SpellWord[] = []
  if (key.startsWith('l:')) {
    const split = segmenter(lettersOf(project, lang))
    for (const l of lexemes) {
      if (out.length >= limit) break
      if (split(l.lemma)[0] !== item.symbol.normalize('NFC').toLowerCase()) continue
      const ipa = storedIpa(lang, l.pronunciations) || spellingIpa(lang, l.lemma)
      out.push({
        text: l.lemma,
        reading: ipa ? `/${ipa}/` : '',
        meaning: opts.gloss(l),
        say: ipa ? { ipa } : null
      })
    }
    return out
  }
  const script = lang.scripts.find((s) => s.id === item.scriptId)
  if (!script) return []
  for (const l of lexemes) {
    if (out.length >= limit) break
    const written = lexemeScript(lang, script, l).trim()
    if (!written.startsWith(item.symbol)) continue
    const ipa = storedIpa(lang, l.pronunciations) || spellingIpa(lang, l.lemma)
    out.push({
      text: written,
      reading: l.lemma,
      meaning: opts.gloss(l),
      say: ipa ? { ipa } : null,
      scriptId: script.id
    })
  }
  return out
}

// ───────────────────────── 变形 ─────────────────────────

/** 词条存着的、有写法的形：槽位 → 写法与 IPA（顺序按项目里存的） */
function storedForms(l: Lexeme): [string, { surface: string; ipa: string }][] {
  return Object.entries(l.forms ?? {}).filter(([, f]) => f?.surface?.trim()) as [
    string,
    { surface: string; ipa: string }
  ][]
}

/**
 * 变形课：有两个以上形的词条按构形（没有构形的按词类）分单元；一个单元里按槽位的第一个维度分课
 * （单数 / 复数），一课里一个槽位一个形。每个形的例子是这个构形下的词条
 */
export function qonFormsCourse(
  project: Project,
  lang: Language,
  hidden: ReadonlySet<string>,
  labels: QonCourseLabels,
  opts: { gloss: (l: Lexeme) => string; pick: (t: LocalizedText) => string }
): Course {
  const groups = new Map<string, { title: string; lexemes: Lexeme[] }>()
  for (const l of project.lexemes) {
    if (l.languageId !== lang.id || hidden.has(l.id)) continue
    if (new Set(storedForms(l).map(([, f]) => f.surface)).size < 2) continue
    const lp = paradigmsFor(project, l)[0]
    const id = lp ? `p:${lp.paradigm.id}` : `pos:${l.posId ?? ''}`
    const title = lp
      ? opts.pick(lp.paradigm.name)
      : opts.pick(project.posList.find((x) => x.id === l.posId)?.name ?? {}) || labels.forms
    const g = groups.get(id) ?? groups.set(id, { title, lexemes: [] }).get(id)!
    g.lexemes.push(l)
  }
  const forms: Record<string, FormItem> = {}
  const units: CourseUnit[] = []
  let n = 0
  for (const [gid, g] of groups) {
    n++
    // 槽位：按第一次出现的顺序；第一个维度相同的放一课
    const slots: string[] = []
    for (const l of g.lexemes)
      for (const [k] of storedForms(l)) if (!slots.includes(k)) slots.push(k)
    const byFirst = new Map<string, string[]>()
    for (const k of slots) {
      const first = k.includes('.') ? k.split('.')[0] : ''
      byFirst.set(first, [...(byFirst.get(first) ?? []), k])
    }
    const lessons: CourseLesson[] = []
    for (const [first, keys] of byFirst)
      for (const [i, chunk] of chunks(keys, 4).entries()) {
        const items: string[] = []
        for (const slot of chunk) {
          const key = `${gid}:${slot}`
          const examples = g.lexemes.flatMap((l) => {
            const all = storedForms(l)
            const f = all.find(([k]) => k === slot)?.[1]
            if (!f) return []
            // 干扰项：这个词别的形，同一课的先上
            const others = [...new Set(all.map(([, x]) => x.surface))].filter(
              (x) => x !== f.surface
            )
            const near = chunk
              .map((k) => all.find(([kk]) => kk === k)?.[1].surface)
              .filter((x): x is string => !!x && x !== f.surface)
            const ipa = f.ipa?.trim() || spellingIpa(lang, f.surface)
            return [
              {
                base: l.lemma,
                meaning: opts.gloss(l),
                form: f.surface,
                ...(ipa && { formReading: `/${ipa}/` }),
                wrong: [...new Set([...near, ...others])].slice(0, 3),
                say: ipa ? { ipa } : null
              }
            ]
          })
          if (!examples.length) continue
          forms[key] = { key, title: slot.split('.').join('·'), examples }
          items.push(key)
        }
        if (items.length)
          lessons.push({
            id: `forms-${n}-${lessons.length + 1}`,
            title: (first || g.title) + (chunks(keys, 4).length > 1 ? ` ${i + 1}` : ''),
            items
          })
      }
    if (lessons.length) units.push({ id: `forms-${n}`, title: g.title, lessons, test: true })
  }
  return {
    id: 'inflection',
    kind: 'forms',
    title: labels.forms,
    intro: labels.formsIntro,
    units,
    symbols: {},
    grammar: {},
    docs: {},
    forms
  }
}

// ───────────────────────── 会话 ─────────────────────────

/** 会话课：短语按分类分课（一课不超过 6 句），一个单元；作者藏起来的不要 */
export function qonPhrasesCourse(
  project: Project,
  lang: Language,
  hidden: ReadonlySet<string>,
  labels: QonCourseLabels,
  opts: { pick: (t: LocalizedText) => string }
): Course {
  const script = lang.scripts.find((sc) => sc.type !== 'logographic' && sc.glyphs.length) ?? null
  const list = project.phrasebook.filter((ph) => ph.languageId === lang.id && !hidden.has(ph.id))
  const phrases: Record<string, PhraseItem> = {}
  const byCat = new Map<string, string[]>()
  for (const ph of list) {
    const ipa = storedIpa(lang, ph.pronunciations) || spellingIpa(lang, ph.text)
    const written = script ? renderScript(lang, script, ph.text).trim() : ''
    const key = `ph:${ph.id}`
    phrases[key] = {
      key,
      text: ph.text,
      ...(ipa && { reading: `/${ipa}/` }),
      meaning: opts.pick(ph.translation),
      say: ipa ? { ipa } : null,
      ...(written && written !== ph.text && script && { script: written, scriptId: script.id })
    }
    const cat = ph.category.trim()
    byCat.set(cat, [...(byCat.get(cat) ?? []), key])
  }
  const lessons: CourseLesson[] = []
  for (const [cat, keys] of byCat)
    for (const [i, chunk] of chunks(keys).entries())
      lessons.push({
        id: `phrases-${lessons.length + 1}`,
        title: (cat || labels.uncategorized) + (chunks(keys).length > 1 ? ` ${i + 1}` : ''),
        items: chunk
      })
  return {
    id: 'phrasebook',
    kind: 'phrases',
    title: labels.phrases,
    intro: labels.phrasesIntro,
    units: lessons.length
      ? [{ id: 'phrases', title: labels.phrasesUnit, lessons, test: lessons.length > 1 }]
      : [],
    symbols: {},
    grammar: {},
    docs: {},
    phrases
  }
}
