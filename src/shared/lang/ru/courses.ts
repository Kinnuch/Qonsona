import type { Course, SymbolItem } from '../../course'
import type { LangModule } from '../types'
import { lexGrammarCourse } from '../course'
import { content } from './content'
import { decorateAlphabet } from './alphabet'
import texts from '../../../../data/ru/texts.json'

// 课程结构共用，内容与发音说明由各语言分别编写。
export function courses(mod: LangModule, locale: string): Course[] {
  const base = (id: string, kind: Course['kind'], zh: string, en: string): Course => ({
    id,
    kind,
    title: { zh, en },
    units: [],
    symbols: {},
    grammar: {},
    docs: {}
  })
  const alphabet = base('alphabet', 'symbols', '字母与发音', 'Letters and pronunciation')
  alphabet.intro = content.note
  alphabet.symbols = Object.fromEntries(
    content.letters.map(([symbol, reading, ipa], i): [string, SymbolItem] => [
      String(i),
      {
        key: String(i),
        symbol,
        reading,
        ipa,
        say: { text: symbol, lang: mod.spec.bcp47 },
        learnOnly: ['separator', 'palatalization', 'no vowel', 'gemination'].includes(ipa),
        note: content.note,
        ...(mod.spec.code === 'ru'
          ? { pair: symbol.toUpperCase(), pairLabel: { zh: '大写', en: 'Uppercase' } }
          : {})
      }
    ])
  )
  alphabet.units = [
    {
      id: 'letters',
      title: alphabet.title,
      test: true,
      note: content.note,
      lessons: Array.from({ length: Math.ceil(content.letters.length / 5) }, (_, i) => ({
        id: `letters-${i}`,
        title: { zh: `字母与发音 ${i + 1}`, en: `Letters and pronunciation ${i + 1}` },
        items: content.letters.slice(i * 5, i * 5 + 5).map((_, j) => String(i * 5 + j)),
        words: content.words
      }))
    }
  ]
  decorateAlphabet(alphabet)
  const inflection = base('inflection', 'forms', '变形与易错点', 'Inflection and common errors')
  inflection.forms = Object.fromEntries(
    content.forms.map(([zh, en, word, form, wrong], i) => [
      String(i),
      {
        key: String(i),
        title: { zh, en },
        examples: [
          { base: word, form, wrong: wrong.split(','), say: { text: form, lang: mod.spec.bcp47 } }
        ]
      }
    ])
  )
  inflection.units = [
    {
      id: 'forms',
      title: inflection.title,
      test: true,
      lessons: content.forms.map(([zh, en], i) => ({
        id: `form-${i}`,
        title: { zh, en },
        items: [String(i)]
      }))
    }
  ]
  const phrases = (id: string, zh: string, en: string, rows: string[][]): Course => {
    const c = base(id, 'phrases', zh, en)
    c.phrases = Object.fromEntries(
      rows.map(([text, zh, en], i) => [
        String(i),
        {
          key: String(i),
          text,
          meaning: { zh, en },
          say: { text, lang: mod.spec.bcp47 },
          reading: mod.rules.romanize?.(text)
        }
      ])
    )
    c.units = Array.from({ length: Math.ceil(rows.length / 4) }, (_, i) => ({
      id: `${id}-scene-${i}`,
      title: id === 'phrasebook' ? { zh: content.scenes[i][0], en: content.scenes[i][1] } : c.title,
      test: true,
      lessons: [
        {
          id: `${id}-${i}`,
          title:
            id === 'phrasebook'
              ? { zh: content.scenes[i][0], en: content.scenes[i][1] }
              : { zh: `${zh} ${i + 1}`, en: `${en} ${i + 1}` },
          items: rows.slice(i * 4, i * 4 + 4).map((_, j) => String(i * 4 + j))
        }
      ]
    }))
    return c
  }
  const stories = base('stories', 'texts', '分级阅读', 'Graded reading')
  stories.texts = Object.fromEntries(
    texts.map((t) => [
      t.id,
      { key: t.id, title: t.title, articleId: `b-${t.id}`, author: t.author }
    ])
  )
  stories.units = texts.map((t) => ({
    id: t.level,
    title: t.title,
    test: false,
    lessons: [{ id: t.id, title: t.title, items: [t.id] }]
  }))
  return [
    alphabet,
    lexGrammarCourse(mod, locale, { perLesson: 3 }),
    inflection,
    phrases('phrasebook', '日常会话', 'Everyday conversation', content.phrases),
    phrases('idioms', '惯用语与搭配', 'Idioms and expressions', content.idioms),
    stories
  ]
}
