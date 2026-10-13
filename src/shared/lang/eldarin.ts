/** Shared presentation of the two Eldarin study packs. Content/orthography remain language-specific. */
import type { Course, FormItem, PhraseItem, SymbolItem } from '../course'
import { shuffled } from '../course'
import { lexGrammarCourse } from './course'
import { stripMarks, tidy } from './text'
import type {
  LangModule,
  LangRules,
  LangSpec,
  LexGrammarPoint,
  LexText,
  LocalizedText,
  RawToken,
  SourceRef
} from './types'

export const ELDAMO: SourceRef = {
  id: 'eldamo',
  name: 'Eldamo — An Elvish Lexicon',
  license: 'CC BY 4.0',
  credit:
    'Paul Strack; underlying linguistic material by J. R. R. Tolkien and cited editors/authors',
  home: 'https://eldamo.org/',
  note: 'Adapted lexical XML. Original language periods, reliability marks and references retained. Eldamo is scholarly interpretation, not an official Tolkien Estate dictionary. The XML licence does not license third-party books, fonts or recordings.'
}
export const ORIGINAL_ELDARIN: SourceRef = {
  id: 'qonsona-eldarin',
  name: 'Qonsona original Eldarin learning material',
  license: 'MIT',
  credit: 'Qonsona contributors',
  home: 'https://github.com/Kinnuch/Qonsona',
  note: 'Original short practice compositions; Neo usage, not quotations or texts attested by Tolkien. L1–L3 are internal study stages, not CEFR or official examinations.'
}
export const STUDY_STAGES = ['L1', 'L2', 'L3'] as const
export function eldarinSpec(code: 'qya' | 'sjn'): LangSpec {
  const quenya = code === 'qya'
  return {
    code,
    name: { zh: quenya ? '昆雅语' : '辛达语', en: quenya ? 'Quenya' : 'Sindarin' },
    nativeName: quenya ? 'Quenya' : 'Sindarin',
    bcp47: code,
    color: quenya ? '#718447' : '#53847f',
    direction: 'ltr',
    intro: {
      zh: '托尔金精灵语学习：完整 Eldamo 分期资料词库及原创 Neo 教学。请查看词条的时期、可靠性和原始文献；本课程不代表托尔金官方完整语法。',
      en: 'Tolkien language study with a period-aware Eldamo lexicon and original Neo teaching. Consult each entry’s period, reliability and references; this is not an official or complete Tolkien grammar.'
    },
    levelSystems: [
      {
        id: 'eldarin-study',
        name: { zh: '精灵语内部学习阶段', en: 'Internal Eldarin study stages' },
        kind: 'proficiency',
        primary: true,
        sources: [ORIGINAL_ELDARIN],
        levels: STUDY_STAGES.map((id, index) => ({
          id,
          short: id,
          name: {
            zh: `${id} ${['转写与基础', '词形与短句', '资料与阅读'][index]}`,
            en: `${id} ${['Sounds and basics', 'Forms and short sentences', 'Sources and reading'][index]}`
          },
          desc: {
            zh: '本软件的教学编排；不是官方等级或 CEFR 对照。未列入精选词表的词不自动分级。',
            en: 'An editorial study sequence, without official examination or CEFR equivalence. Unselected lexicon entries remain ungraded.'
          }
        }))
      }
    ],
    features: {
      texts: true,
      lexicon: true,
      alphabet: 'phonics',
      characters: null,
      grammar: true,
      inflection: true,
      phrasebook: true,
      idioms: false,
      stories: true,
      media: true,
      exam: true,
      ruby: null,
      romanization: false,
      speech: code
    }
  }
}
/** Long vowels are distinct; optional Quenya diaereses are not length marks. */
export function eldarinRules(code: 'qya' | 'sjn'): LangRules {
  const key = (text: string): string =>
    tidy(text)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[\u2010\u2011]/g, '-')
      .replace(/[āēīōū]/g, (character) => ({ ā: 'á', ē: 'é', ī: 'í', ō: 'ó', ū: 'ú' })[character]!)
      .replace(code === 'qya' ? /[äëïöü]/g : /$^/g, (c) => stripMarks(c))
      .replace(code === 'qya' ? /k/g : /$^/g, 'c')
      .replace(code === 'sjn' ? /ð/g : /$^/g, 'dh')
      .replace(code === 'sjn' ? /þ/g : /$^/g, 'th')
      .replace(code === 'sjn' ? /^'(?=\p{L})/u : /$^/g, '')
  return {
    key,
    looseKey: (text) => stripMarks(key(text)),
    // Explicit offsets, no dependence on Intl's unsupported qya/sjn locale fallback.
    tokenize(text: string): RawToken[] {
      return [
        ...text.matchAll(
          /['’]?[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*|\p{N}+|\s+|[^\p{L}\p{M}\p{N}\s]/gu
        )
      ].map((match) => ({
        text: match[0],
        start: match.index!,
        end: match.index! + match[0].length,
        kind: /^\s+$/u.test(match[0])
          ? 'space'
          : /^\p{N}+$/u.test(match[0])
            ? 'num'
            : /\p{L}/u.test(match[0])
              ? 'word'
              : 'punct'
      }))
    }
  }
}
export interface EldarinContent {
  sounds: [string, string, string, string][]
  grammar: {
    id: string
    level: string
    name: LocalizedText
    form: LocalizedText
    meaning: LocalizedText
    notes?: LocalizedText
    examples: { text: string; hl: string; zh: string; en: string }[]
  }[]
  forms: FormItem[]
  phrases: PhraseItem[]
}
export function eldarinModule(
  code: 'qya' | 'sjn',
  content: EldarinContent,
  texts: LexText[]
): LangModule {
  const rules = eldarinRules(code)
  const grammar: LexGrammarPoint[] = content.grammar.map((point) => ({
    ...point,
    notes: {
      zh: `${point.notes?.zh ?? ''} 原创 Neo 教学例句；细节参照 Eldamo 对应语法分析，不能据此假造任意不规则词形。`,
      en: `${point.notes?.en ?? ''} Original Neo teaching examples. Consult Eldamo’s analyses; these examples do not authorize inventing arbitrary irregular forms.`
    },
    patterns: point.examples.map((example) =>
      rules.tokenize!(example.hl)
        .filter((token) => token.kind === 'word')
        .map((token) => ({ form: rules.key(token.text) }))
    )
  }))
  const module: LangModule = {
    spec: eldarinSpec(code),
    labels: {
      'documentary-variant': {
        zh: '文献中的实际写法（非推导变形）',
        en: 'Documented spelling (not generated inflection)'
      },
      'eldamo-period:late': { zh: '晚期（1950–1973）', en: 'Late period (1950–1973)' },
      'eldamo-period:middle': { zh: '中期（1930–1950）', en: 'Middle period (1930–1950)' },
      'eldamo-period:early': { zh: '早期（1910–1930）', en: 'Early period (1910–1930)' },
      'eldamo-period:neo': { zh: '后托尔金Neo材料', en: 'Post-Tolkien Neo material' },
      'Neo-Elvish': { zh: 'Neo精灵语', en: 'Neo-Elvish' },
      'fan-neologism': { zh: '爱好者新造词', en: 'Fan neologism' },
      reformulated: { zh: '依早期材料重构', en: 'Reformulated from early material' },
      'derived-unattested': {
        zh: '据词形/复合词推导，未直接见证',
        en: 'Derived, not directly attested'
      },
      reconstructed: { zh: '比较构拟', en: 'Reconstructed' },
      speculative: { zh: '推测形式', en: 'Speculative' },
      'Tolkien-questioned': { zh: '托尔金原文存疑', en: 'Questioned by Tolkien' },
      'Tolkien-referenced': { zh: '有托尔金文献引用', en: 'With Tolkien source references' },
      'unverified-reference': { zh: '未附直接文献，需核对', en: 'No direct reference; verify' },
      'editorially-marked': { zh: '编辑标记，查看原词条', en: 'Editorial mark; consult source' },
      'not-recommended': { zh: 'Eldamo不推荐用于Neo', en: 'Not recommended by Eldamo for Neo' }
    },
    rules,
    grammar,
    news: [],
    exams: STUDY_STAGES.map((level) => ({
      id: `${code}-study-${level}`,
      level,
      title: { zh: `${level} 精灵语学习自测`, en: `${level} Eldarin study check` },
      basis: {
        zh: '原创课程自测；无官方考试、CEFR或口语流利度等价。',
        en: 'Original course review without official exam, CEFR or spoken-fluency equivalence.'
      },
      sections: [
        {
          id: 'grammar',
          title: { zh: '结构与译义', en: 'Structure and meaning' },
          minutes: 12,
          parts: [{ kind: `custom:${code}-structure`, n: 6 }]
        }
      ]
    })),
    practice: [
      {
        id: `${code}-structure`,
        name: { zh: '精灵语结构辨认', en: 'Eldarin structure recognition' },
        section: 'grammar',
        make(db, level, n) {
          const eligible = grammar.filter(
            (point) =>
              !level ||
              STUDY_STAGES.indexOf(point.level as (typeof STUDY_STAGES)[number]) <=
                STUDY_STAGES.indexOf(level as (typeof STUDY_STAGES)[number])
          )
          const pool = eligible.flatMap((point) =>
            point.examples.map((example, index) => ({ point, example, index }))
          )
          return shuffled(pool, db.rand)
            .slice(0, n)
            .map(({ point, example, index }) => {
              const distractors = [
                ...new Set(eligible.flatMap((item) => item.examples.map((ex) => ex.hl!)))
              ].filter((value) => value !== example.hl)
              const choices = shuffled(
                [example.hl!, ...shuffled(distractors, db.rand).slice(0, 3)],
                db.rand
              )
              const start = example.text.indexOf(example.hl!)
              return {
                id: `${code}-${point.id}-${index}`,
                kind: 'custom',
                custom: `${code}-structure`,
                section: 'grammar',
                ask: {
                  zh: '按译义补全原创教学短句。',
                  en: 'Complete this original practice sentence using its translation.'
                },
                prompt: {
                  text: example.text,
                  lang: code,
                  blank: [start, start + example.hl!.length],
                  sub: { zh: example.zh!, en: example.en! }
                },
                choices: choices.map((text) => ({ text, lang: code })),
                answer: choices.indexOf(example.hl!),
                explain: { lines: [point.meaning, point.notes!] }
              }
            })
        }
      }
    ],
    courses(locale): Course[] {
      const result = [
        lexGrammarCourse(module, locale, {
          intro: {
            zh: '原创 Neo 教学；词典保留跨时期材料，不意味着可随意混用。',
            en: 'Original Neo teaching. A lexicon preserving historical forms is not permission to mix periods indiscriminately.'
          }
        })
      ]
      const symbols: Record<string, SymbolItem> = Object.fromEntries(
        content.sounds.map(([symbol, reading, ipa, note], index) => [
          String(index),
          {
            key: String(index),
            symbol,
            reading,
            ipa,
            say: { ipa },
            typeable: false,
            note: {
              zh: note,
              en: `${symbol}: ${reading}, IPA /${ipa}/. ${reading.startsWith('overlong') ? 'Circumflex marks an overlong vowel in monosyllables, distinct from ordinary acute long vowels; this IPA and synthesized audio approximate the duration. ' : ''}This describes the sound unit; whole-word stress and historical/contextual variants require separate attention.`
            }
          }
        ])
      )
      for (const [id, kind, title, items] of [
        [
          'alphabet',
          'symbols',
          { zh: '拉丁转写与拼读', en: 'Latin transcription and pronunciation' },
          symbols
        ],
        [
          'inflection',
          'forms',
          { zh: '核对词形', en: 'Checked forms' },
          Object.fromEntries(
            content.forms.map((item) => [
              item.key,
              {
                ...item,
                examples: item.examples.map((example) => ({
                  ...example,
                  say: { text: example.form, lang: code }
                }))
              }
            ])
          )
        ],
        [
          'phrasebook',
          'phrases',
          { zh: '简短表达（Neo练习）', en: 'Short expressions (Neo practice)' },
          Object.fromEntries(
            content.phrases.map((item) => [
              item.key,
              { ...item, say: { text: item.text, lang: code } }
            ])
          )
        ]
      ] as const) {
        const keys = Object.keys(items)
        const lessons: Course['units'][number]['lessons'] = []
        for (let i = 0; i < keys.length; i += 4)
          lessons.push({
            id: `${id}-${i / 4 + 1}`,
            title: { zh: `第 ${i / 4 + 1} 课`, en: `Lesson ${i / 4 + 1}` },
            items: keys.slice(i, i + 4)
          })
        result.push({
          id,
          kind,
          title,
          units: [{ id: `${id}-core`, title, lessons, test: true }],
          symbols: {},
          grammar: {},
          docs: {},
          [kind]: items
        })
      }
      result.push({
        id: 'stories',
        kind: 'texts',
        title: { zh: '原创短篇阅读（Neo）', en: 'Original short readings (Neo)' },
        symbols: {},
        grammar: {},
        docs: {},
        texts: Object.fromEntries(
          texts.map((text) => [
            text.id,
            { key: text.id, title: text.title, articleId: `b-${text.id}` }
          ])
        ),
        units: texts.map((text) => ({
          id: text.id,
          title: text.level!,
          lessons: [{ id: text.id, title: text.title, items: [text.id] }],
          test: false
        }))
      })
      return result
    }
  }
  return module
}
