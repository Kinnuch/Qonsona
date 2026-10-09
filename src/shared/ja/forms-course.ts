/**
 * 日语的变形课：动词的ます形、ない形、て形……与形容词的否定、过去，一个形一张变形表。
 * 表里的词从词典的 N5 / N4 动词、形容词里挑（五段各行、一段、する、来る 都有），
 * 变形与错形都由 conjugate.ts 算；规则说明是手写的。
 */
import type { Course, CourseLesson, FormExample, FormItem, Text } from '../course'
import type { ConjugableWord } from '../dict'
import { conjugate, displayForm, wrongForms, type FormId } from './conjugate'

/** 各个形的名字 */
export const FORM_NAMES: Record<FormId, Text> = {
  masu: { zh: 'ます形', en: 'masu form' },
  masen: { zh: '〜ません', en: '〜ません (negative)' },
  mashita: { zh: '〜ました', en: '〜ました (past)' },
  nai: { zh: 'ない形', en: 'nai form' },
  nakatta: { zh: '〜なかった', en: '〜なかった (past negative)' },
  te: { zh: 'て形', en: 'te form' },
  ta: { zh: 'た形', en: 'ta form' },
  potential: { zh: '可能形', en: 'potential' },
  volitional: { zh: '意向形', en: 'volitional' },
  ba: { zh: '条件形（ば）', en: 'conditional (ba)' },
  imperative: { zh: '命令形', en: 'imperative' },
  passive: { zh: '受身形', en: 'passive' },
  causative: { zh: '使役形', en: 'causative' },
  'adj-neg': { zh: '否定', en: 'negative' },
  'adj-past': { zh: '过去', en: 'past' },
  'adj-negpast': { zh: '过去否定', en: 'past negative' },
  'adj-te': { zh: 'て形', en: 'te form' }
}

type Group = 'v' | 'ai' | 'an'

interface LessonSpec {
  id: string
  title: Text
  group: Group
  forms: FormId[]
  note: Text
}

const VERB_LESSONS: LessonSpec[] = [
  {
    id: 'v-masu',
    title: { zh: 'ます形', en: 'The masu form' },
    group: 'v',
    forms: ['masu', 'masen', 'mashita'],
    note: {
      zh: '五段动词把词尾换成 い 段再加 ます（書く → 書きます）；一段动词去掉 る 加 ます（食べる → 食べます）；する → します，来る → 来ます（きます）。否定是 ません，过去是 ました。',
      en: 'Godan verbs change the last kana to the i-column and add ます (書く → 書きます); ichidan verbs drop る and add ます (食べる → 食べます); する → します, 来る → 来ます (きます). The negative is ません and the past is ました.'
    }
  },
  {
    id: 'v-nai',
    title: { zh: 'ない形', en: 'The nai form' },
    group: 'v',
    forms: ['nai', 'nakatta'],
    note: {
      zh: '五段动词把词尾换成 あ 段加 ない（書く → 書かない；う 结尾的换成 わ：買う → 買わない）；一段动词去掉 る 加 ない；する → しない，来る → 来ない（こない）；ある 的否定是 ない。过去：ない → なかった。',
      en: 'Godan verbs change the last kana to the a-column and add ない (書く → 書かない; a final う becomes わ: 買う → 買わない); ichidan verbs drop る and add ない; する → しない, 来る → 来ない (こない); the negative of ある is ない. Past: ない → なかった.'
    }
  },
  {
    id: 'v-te',
    title: { zh: 'て形与た形', en: 'The te and ta forms' },
    group: 'v',
    forms: ['te', 'ta'],
    note: {
      zh: '五段动词看词尾：う・つ・る → って，む・ぶ・ぬ → んで，く → いて，ぐ → いで，す → して；行く 是例外，变成 行って。一段动词去掉 る 加 て；する → して，来る → 来て（きて）。た形 把 て 换成 た、で 换成 だ。',
      en: 'For godan verbs it depends on the last kana: う, つ, る → って; む, ぶ, ぬ → んで; く → いて; ぐ → いで; す → して; 行く is the exception: 行って. Ichidan verbs drop る and add て; する → して, 来る → 来て (きて). The ta form swaps て for た and で for だ.'
    }
  },
  {
    id: 'v-potential',
    title: { zh: '可能形', en: 'The potential form' },
    group: 'v',
    forms: ['potential'],
    note: {
      zh: '五段动词把词尾换成 え 段加 る（書く → 書ける）；一段动词去掉 る 加 られる（食べる → 食べられる）；する → できる，来る → 来られる（こられる）。',
      en: 'Godan verbs change the last kana to the e-column and add る (書く → 書ける); ichidan verbs drop る and add られる (食べる → 食べられる); する → できる, 来る → 来られる (こられる).'
    }
  },
  {
    id: 'v-volitional',
    title: { zh: '意向形', en: 'The volitional form' },
    group: 'v',
    forms: ['volitional'],
    note: {
      zh: '五段动词把词尾换成 お 段加 う（書く → 書こう）；一段动词去掉 る 加 よう（食べる → 食べよう）；する → しよう，来る → 来よう（こよう）。',
      en: 'Godan verbs change the last kana to the o-column and add う (書く → 書こう); ichidan verbs drop る and add よう (食べる → 食べよう); する → しよう, 来る → 来よう (こよう).'
    }
  },
  {
    id: 'v-ba',
    title: { zh: '条件形（ば）', en: 'The conditional (ba)' },
    group: 'v',
    forms: ['ba'],
    note: {
      zh: '五段动词把词尾换成 え 段加 ば（書く → 書けば）；一段动词去掉 る 加 れば（食べる → 食べれば）；する → すれば，来る → 来れば（くれば）。',
      en: 'Godan verbs change the last kana to the e-column and add ば (書く → 書けば); ichidan verbs drop る and add れば (食べる → 食べれば); する → すれば, 来る → 来れば (くれば).'
    }
  },
  {
    id: 'v-imperative',
    title: { zh: '命令形', en: 'The imperative' },
    group: 'v',
    forms: ['imperative'],
    note: {
      zh: '五段动词把词尾换成 え 段（書く → 書け）；一段动词去掉 る 加 ろ（食べる → 食べろ）；する → しろ，来る → 来い（こい）。语气很冲，日常多用〜てください。',
      en: 'Godan verbs change the last kana to the e-column (書く → 書け); ichidan verbs drop る and add ろ (食べる → 食べろ); する → しろ, 来る → 来い (こい). It sounds blunt; in everyday speech 〜てください is more common.'
    }
  },
  {
    id: 'v-passive',
    title: { zh: '受身形', en: 'The passive' },
    group: 'v',
    forms: ['passive'],
    note: {
      zh: '五段动词把词尾换成 あ 段加 れる（書く → 書かれる；う 结尾的换成 わ：買う → 買われる）；一段动词去掉 る 加 られる；する → される，来る → 来られる（こられる）。',
      en: 'Godan verbs change the last kana to the a-column and add れる (書く → 書かれる; a final う becomes わ: 買う → 買われる); ichidan verbs drop る and add られる; する → される, 来る → 来られる (こられる).'
    }
  },
  {
    id: 'v-causative',
    title: { zh: '使役形', en: 'The causative' },
    group: 'v',
    forms: ['causative'],
    note: {
      zh: '五段动词把词尾换成 あ 段加 せる（書く → 書かせる）；一段动词去掉 る 加 させる（食べる → 食べさせる）；する → させる，来る → 来させる（こさせる）。',
      en: 'Godan verbs change the last kana to the a-column and add せる (書く → 書かせる); ichidan verbs drop る and add させる (食べる → 食べさせる); する → させる, 来る → 来させる (こさせる).'
    }
  }
]

const ADJ_FORMS: FormId[] = ['adj-neg', 'adj-past', 'adj-negpast', 'adj-te']

const ADJ_LESSONS: LessonSpec[] = [
  {
    id: 'a-i',
    title: { zh: 'い形容词', en: 'い-adjectives' },
    group: 'ai',
    forms: ADJ_FORMS,
    note: {
      zh: 'い形容词去掉词尾的 い 再加：否定 くない（高い → 高くない），过去 かった，过去否定 くなかった，て形 くて。いい 要换成 よ：よくない、よかった。',
      en: 'Drop the final い of an い-adjective and add: くない for the negative (高い → 高くない), かった for the past, くなかった for the past negative, くて for the te form. いい becomes よ: よくない, よかった.'
    }
  },
  {
    id: 'a-na',
    title: { zh: 'な形容词', en: 'な-adjectives' },
    group: 'an',
    forms: ADJ_FORMS,
    note: {
      zh: 'な形容词直接加：否定 ではない（口语说 じゃない），过去 だった，过去否定 ではなかった，て形 で（静かで）。',
      en: 'Add these straight to a な-adjective: ではない for the negative (じゃない in speech), だった for the past, ではなかった for the past negative, で for the te form (静かで).'
    }
  }
]

/** 这个形的变法说明（练习题的解析用）：动词看动词的课，形容词分い形容词、な形容词 */
export function formRule(form: FormId, cls: string): Text | null {
  const lessons = form.startsWith('adj-')
    ? ADJ_LESSONS.filter((l) => l.group === (cls === 'adj-na' ? 'an' : 'ai'))
    : VERB_LESSONS
  return lessons.find((l) => l.forms.includes(form))?.note ?? null
}

/** 表里与题里用多少个词 */
const MAX_WORDS = 14

/**
 * 挑词：先保证五段各行（う く ぐ す つ ぬ ぶ む る）、行く、一段、する、带する的名词、来る 各有一个，
 * 再按常用程度补满；形容词按常用程度挑
 */
export function pickVerbs(words: ConjugableWord[]): ConjugableWord[] {
  const verbs = words.filter((w) => !w.cls.startsWith('adj'))
  const bucket = (w: ConjugableWord): string => {
    if (w.cls === 'v5')
      return w.special === 'iku' ? 'iku' : w.special ? '' : `v5${w.reading.slice(-1)}`
    if (w.cls === 'vs') return w.head === 'する' ? 'suru' : 'vs-n'
    return w.special ? '' : w.cls
  }
  const out: ConjugableWord[] = []
  const seen = new Set<string>()
  for (const w of verbs) {
    const b = bucket(w)
    if (!b || seen.has(b)) continue
    seen.add(b)
    out.push(w)
  }
  // 一段动词多放一个（最常见的两类之一）
  for (const w of verbs) {
    if (out.length >= MAX_WORDS) break
    if (!out.includes(w) && !w.special && (w.cls === 'v1' || w.cls === 'v5')) out.push(w)
  }
  return out.slice(0, MAX_WORDS)
}

const pickAdj = (words: ConjugableWord[], cls: 'adj-i' | 'adj-na'): ConjugableWord[] =>
  words.filter((w) => w.cls === cls).slice(0, 8)

function example(w: ConjugableWord, form: FormId): FormExample | null {
  const c = conjugate(w, form)
  if (!c) return null
  const shown = displayForm(w, c)
  return {
    base: w.head,
    ...(w.reading !== w.head && { baseReading: w.reading }),
    meaning: { zh: w.zh, en: w.en },
    form: shown,
    ...(c.reading !== shown && { formReading: c.reading }),
    wrong: wrongForms(w, form).map((x) => displayForm(w, x)),
    say: { text: c.reading, lang: 'ja-JP' }
  }
}

/** 变形这门课；words 是词典给的 N5 / N4 动词与形容词（常用的在前） */
export function jaFormsCourse(words: ConjugableWord[]): Course {
  const pools: Record<Group, ConjugableWord[]> = {
    v: pickVerbs(words),
    ai: pickAdj(words, 'adj-i'),
    an: pickAdj(words, 'adj-na')
  }
  const forms: Record<string, FormItem> = {}
  const lessonOf = (spec: LessonSpec): CourseLesson => {
    const items: string[] = []
    for (const f of spec.forms) {
      const key = `${spec.group}:${f}`
      const examples = pools[spec.group].map((w) => example(w, f)).filter((x) => !!x)
      if (!examples.length) continue
      forms[key] = { key, title: FORM_NAMES[f], examples }
      items.push(key)
    }
    return { id: spec.id, title: spec.title, items, note: spec.note }
  }
  const verbLessons = VERB_LESSONS.map(lessonOf).filter((l) => l.items.length)
  const adjLessons = ADJ_LESSONS.map(lessonOf).filter((l) => l.items.length)
  return {
    id: 'inflection',
    kind: 'forms',
    title: { zh: '变形', en: 'Forms' },
    intro: {
      zh: '动词、形容词的变形，一个形一张变形表：先看规则和表，再做「选出正确的形式」练习；干扰项是学习者常犯的错。',
      en: 'Verb and adjective forms, one table per form: read the rule and the table, then practise picking the right form; the wrong choices are the mistakes learners commonly make.'
    },
    units: [
      ...(verbLessons.length
        ? [
            {
              id: 'verbs',
              title: { zh: '动词', en: 'Verbs' },
              note: {
                zh: '动词分三类：五段动词（書く、読む）、一段动词（食べる、見る：る 前面是 い 段或 え 段的假名；也有长得像的五段动词，比如 帰る、入る）、不规则的 する 与 来る。',
                en: 'Verbs fall into three groups: godan verbs (書く, 読む), ichidan verbs (食べる, 見る: an i- or e-column kana before る, though a few godan verbs look the same, such as 帰る and 入る) and the irregular する and 来る.'
              },
              lessons: verbLessons,
              test: true
            }
          ]
        : []),
      ...(adjLessons.length
        ? [
            {
              id: 'adjectives',
              title: { zh: '形容词', en: 'Adjectives' },
              lessons: adjLessons,
              test: true
            }
          ]
        : [])
    ],
    symbols: {},
    grammar: {},
    docs: {},
    forms
  }
}
