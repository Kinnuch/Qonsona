import type { Course, FormItem, PhraseItem, SymbolItem } from '../../course'
import { grammar } from './grammar'

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
// Distinguish letter names from sounds; these are spelling patterns, not a one-to-one alphabet.
const phonics = [
  ['short-a', 'a', '/æ/', 'cat, bag, map', '短元音 /æ/；与 /e/ 对比，嘴张得更开。'],
  ['short-e', 'e', '/e/', 'bed, pen, red', '本课用英式 /e/，部分字典标 /ɛ/。'],
  ['short-i', 'i', '/ɪ/', 'sit, fish, milk', '不是字母名 /aɪ/；注意与长 /iː/ 的对比。'],
  ['short-o', 'o', '/ɒ/', 'hot, dog, shop', '英式 /ɒ/；许多美式口音用 /ɑː/。'],
  ['short-u', 'u', '/ʌ/', 'cup, bus, sun', '重读 /ʌ/ 不等于非重读 schwa。'],
  [
    'silent-e',
    'a_e',
    '/eɪ/',
    'name, late, cake',
    '分离双字母示例；have 等为例外，不能仅凭末尾 e 推断。'
  ],
  ['ee', 'ee', '/iː/', 'see, green, sleep', '对比短元音 /ɪ/，词形仍逐词确认。'],
  ['ea', 'ea', '/iː/', 'sea, tea, read', '通常 /iː/；bread /e/、过去式 read /red/ 是例外。'],
  ['oa', 'oa', '/əʊ/', 'boat, road, coat', '英式 /əʊ/；美式常 /oʊ/。'],
  ['oo', 'oo', '/uː/', 'moon, food, school', 'book、good 的 oo 是 /ʊ/，本课只教长音一组。'],
  ['th-voiceless', 'th', '/θ/', 'think, three, bath', '无声齿擦音；不是 /s/ 或 /t/。'],
  ['th-voiced', 'th', '/ð/', 'this, that, mother', '有声齿擦音；同一拼写有两类音，不能一一对应。'],
  ['sh', 'sh', '/ʃ/', 'ship, wish, shop', '双字母对应一个辅音。'],
  ['ch', 'ch', '/tʃ/', 'chair, cheese, much', 'school /k/ 和 machine /ʃ/ 是重要例外。'],
  ['ng', 'ng', '/ŋ/', 'sing, long, ring', '不要在 sing 词末另加 /g/；finger 的组合不同。'],
  [
    'schwa',
    'ə',
    '/ə/',
    'about, sofa, support',
    '非重读弱读，不能从一个字母唯一预测；先听整词重音。'
  ]
]
type FormRow = [string, string, string, string, string, string[]][]
const formRows: FormRow = [
  ['A1', 'third-person', '第三人称单数', 'work', 'works', ['work', 'working', 'workes']],
  ['A1', 'third-person', '第三人称单数', 'study', 'studies', ['studys', 'study', 'studied']],
  ['A1', 'third-person', '第三人称单数', 'go', 'goes', ['go', 'gos', 'gone']],
  ['A1', 'plural', '名词复数', 'book', 'books', ['book', 'bookes', 'bookies']],
  ['A1', 'plural', '名词复数', 'city', 'cities', ['citys', 'city', 'cityes']],
  ['A1', 'plural', '名词复数', 'child', 'children', ['childs', 'childes', 'child']],
  ['A2', 'past', '一般过去式', 'visit', 'visited', ['visitted', 'visit', 'visiting']],
  ['A2', 'past', '一般过去式', 'go', 'went', ['goed', 'gone', 'go']],
  ['A2', 'past', '一般过去式', 'buy', 'bought', ['buyed', 'buy', 'buying']],
  ['A2', 'comparative', '比较级', 'big', 'bigger', ['biger', 'biggest', 'more bigger']],
  ['A2', 'comparative', '比较级', 'good', 'better', ['gooder', 'best', 'more good']],
  ['A2', 'comparative', '比较级', 'happy', 'happier', ['happyer', 'happiest', 'happily']],
  ['B1', 'participle', '过去分词', 'write', 'written', ['wrote', 'writed', 'writing']],
  ['B1', 'participle', '过去分词', 'see', 'seen', ['saw', 'seed', 'seeing']],
  ['B1', 'participle', '过去分词', 'take', 'taken', ['took', 'taked', 'taking']],
  ['B1', 'ing', '-ing 分词', 'run', 'running', ['runing', 'ran', 'runned']],
  ['B1', 'ing', '-ing 分词', 'lie', 'lying', ['lieing', 'lied', 'lain']],
  ['B1', 'ing', '-ing 分词', 'make', 'making', ['makeing', 'made', 'makes']],
  [
    'B2',
    'past-perfect',
    '过去完成时，主语 I',
    'leave',
    'had left',
    ['have left', 'had leave', 'had leaved']
  ],
  [
    'B2',
    'past-perfect',
    '过去完成时，主语 I',
    'know',
    'had known',
    ['had knew', 'have known', 'had knowed']
  ],
  [
    'B2',
    'past-perfect',
    '过去完成时，主语 I',
    'eat',
    'had eaten',
    ['had ate', 'have eaten', 'had eated']
  ],
  [
    'B2',
    'modal-perfect',
    '过去推断 must，主语 she',
    'forget',
    'must have forgotten',
    ['must forgot', 'must has forgotten', 'must have forgot']
  ],
  [
    'B2',
    'modal-perfect',
    '过去推断 must，主语 she',
    'leave',
    'must have left',
    ['must left', 'must has left', 'must have leave']
  ],
  [
    'B2',
    'modal-perfect',
    '过去推断 must，主语 she',
    'take',
    'must have taken',
    ['must took', 'must has taken', 'must have took']
  ],
  [
    'C1',
    'perfect-progressive',
    '现在完成进行时，主语 we',
    'wait',
    'have been waiting',
    ['has been waiting', 'have waiting', 'have been wait']
  ],
  [
    'C1',
    'perfect-progressive',
    '现在完成进行时，主语 we',
    'study',
    'have been studying',
    ['has been studying', 'have studying', 'have been studied']
  ],
  [
    'C1',
    'perfect-progressive',
    '现在完成进行时，主语 we',
    'work',
    'have been working',
    ['has been working', 'have working', 'have been work']
  ],
  ['C1', 'mandative', '建议 that he 后的原形虚拟式', 'be', 'be', ['is', 'was', 'being']],
  [
    'C1',
    'mandative',
    '建议 that he 后的原形虚拟式',
    'remain',
    'remain',
    ['remains', 'remained', 'remaining']
  ],
  [
    'C1',
    'mandative',
    '建议 that he 后的原形虚拟式',
    'attend',
    'attend',
    ['attends', 'attended', 'attending']
  ],
  [
    'C2',
    'modal-passive',
    'could 的完成被动，主语 it',
    'avoid',
    'could have been avoided',
    ['could have avoided', 'could has been avoided', 'could have been avoid']
  ],
  [
    'C2',
    'modal-passive',
    'could 的完成被动，主语 it',
    'prevent',
    'could have been prevented',
    ['could have prevented', 'could has been prevented', 'could have been prevent']
  ],
  [
    'C2',
    'modal-passive',
    'could 的完成被动，主语 it',
    'repair',
    'could have been repaired',
    ['could have repaired', 'could has been repaired', 'could have been repair']
  ],
  [
    'C2',
    'perfect-infinitive',
    '完成不定式（主动）',
    'leave',
    'to have left',
    ['to have leave', 'to has left', 'to left']
  ],
  [
    'C2',
    'perfect-infinitive',
    '完成不定式（主动）',
    'write',
    'to have written',
    ['to have wrote', 'to has written', 'to written']
  ],
  [
    'C2',
    'perfect-infinitive',
    '完成不定式（主动）',
    'see',
    'to have seen',
    ['to have saw', 'to has seen', 'to seen']
  ]
]
export const forms: Record<string, FormItem> = {}
export const formLevels: Record<string, string> = {}
for (const [level, id, title, base, form, wrong] of formRows) {
  const key = `en-${id}`
  forms[key] ??= { key, title: { zh: title, en: id.replaceAll('-', ' ') }, examples: [] }
  forms[key].examples.push({ base, form, wrong, say: { text: form, lang: 'en-US' } })
  formLevels[key] = level
}
const phraseRows = [
  ['A1', 'Hello. My name is Mei.', '你好，我叫梅。'],
  ['A1', 'Could you repeat that, please?', '请再说一遍好吗？'],
  ['A1', 'How much is this?', '这个多少钱？'],
  ['A1', 'Where is the station?', '车站在哪里？'],
  ['A2', 'I would like a table for two.', '我想要一张两人桌。'],
  ['A2', 'Could I have the bill, please?', '请给我账单好吗？'],
  ['A2', 'I have a reservation under the name Chen.', '我以陈这个名字预订了。'],
  ['A2', 'I have had a headache since yesterday.', '从昨天起我就头疼。'],
  ['B1', 'Could you tell me how to get to the library?', '您能告诉我怎么去图书馆吗？'],
  ['B1', 'I am sorry, but I need to change my appointment.', '抱歉，我需要更改预约。'],
  ['B1', 'Would you mind speaking a little more slowly?', '您介意说慢一点吗？'],
  ['B1', 'If I were you, I would ask for help.', '如果我是你，我会求助。'],
  ['B2', 'I see your point, but I have some reservations.', '我理解您的观点，但有所保留。'],
  ['B2', 'Could we clarify what you mean by that?', '我们能澄清一下您的意思吗？'],
  ['B2', 'I would like to make a complaint about the service.', '我想投诉这项服务。'],
  ['B2', 'Let us weigh the advantages against the drawbacks.', '让我们权衡利弊。'],
  ['C1', 'The evidence should be interpreted with caution.', '应谨慎解释这些证据。'],
  ['C1', 'I would welcome your feedback on the proposal.', '我欢迎您对提案提出意见。'],
  ['C1', 'May I briefly summarise the points of agreement?', '我能简短总结一下共识吗？'],
  ['C1', 'That conclusion rests on an untested assumption.', '该结论基于一个未经验证的假设。'],
  [
    'C2',
    'I take your point, though the distinction is more nuanced.',
    '我理解您的观点，但这一区别更为细微。'
  ],
  [
    'C2',
    'With due respect, that does not follow from the evidence.',
    '恕我直言，这无法由证据推出。'
  ],
  ['C2', 'We should not conflate correlation with causation.', '我们不应混淆相关与因果。'],
  [
    'C2',
    'Let us revisit the premise before debating its implications.',
    '在讨论影响前，让我们重新审视前提。'
  ]
]
const idiomRows = [
  ['A1', 'See you later.', '回头见。'],
  ['A1', 'Of course.', '当然。'],
  ['A2', 'No problem.', '没问题。'],
  ['A2', 'Take your time.', '慢慢来。'],
  ['B1', 'It is up to you.', '由你决定。'],
  ['B1', 'Keep an eye on the bag.', '留意这个包。'],
  ['B2', 'We are on the same page.', '我们看法一致。'],
  ['B2', 'Let us get the ball rolling.', '让我们开始吧。'],
  ['C1', 'Take that claim with a grain of salt.', '对那个说法应持保留态度。'],
  ['C1', 'The proposal is still up in the air.', '提案仍未定。'],
  ['C2', 'The agreement hangs by a thread.', '协议岌岌可危。'],
  ['C2', 'That argument begs the question.', '那个论证把待证结论当作前提。']
]
const empty = (id: string, kind: Course['kind'], title: { zh: string; en: string }): Course => ({
  id,
  kind,
  title,
  units: [],
  symbols: {},
  grammar: {},
  docs: {}
})
export function courses(locale: string): Course[] {
  const pick = (v: Record<string, string>): string =>
    locale.startsWith('zh') ? (v.zh ?? v.en ?? '') : (v.en ?? v.zh ?? '')
  const alphabet = empty('alphabet', 'symbols', {
    zh: '英语拼读与弱读',
    en: 'English spelling and sounds'
  })
  alphabet.intro = {
    zh: '拼写与语音不是一一对应；逐组练习，例外逐词核对。先听整词，不用孤立字母 TTS 代替音位。',
    en: 'Spelling patterns have exceptions. Listen to whole words; isolated-letter TTS is not a phoneme model.'
  }
  alphabet.units = [
    {
      id: 'phonics',
      title: { zh: '元音、辅音与弱读', en: 'Vowels, consonants and weak forms' },
      test: true,
      lessons: phonics.map(([key, symbol, reading, words, note]) => {
        const item: SymbolItem = {
          key,
          symbol,
          reading,
          ipa: reading,
          typeable: false,
          learnOnly: false,
          say: null,
          note: {
            zh: note,
            en: `Examples: ${words}. Check dictionary IPA and audio; spelling alone is not conclusive.`
          }
        }
        alphabet.symbols[key] = item
        return { id: key, title: symbol, items: [key], words: words.split(', '), note: item.note }
      })
    }
  ]
  const gc = empty('grammar', 'grammar', { zh: '英语分级语法', en: 'English grammar by level' })
  gc.units = LEVELS.map((level) => ({
    id: level,
    title: level,
    test: true,
    lessons: grammar
      .filter((g) => g.level === level)
      .map((g) => {
        gc.grammar[g.id] = {
          key: g.id,
          name: pick(g.name),
          form: pick(g.form),
          meaning: g.meaning,
          notes: g.notes,
          group: g.group,
          examples: g.examples.map((e) => ({
            ja: e.text,
            zh: e.zh ?? null,
            en: e.en ?? null,
            start: e.text.indexOf(e.hl!),
            end: e.text.indexOf(e.hl!) + e.hl!.length,
            source: 'builtin'
          }))
        }
        return { id: g.id, title: g.name, items: [g.id], note: g.meaning }
      })
  }))
  const inf = empty('inflection', 'forms', {
    zh: '英语变形与时态构成',
    en: 'Inflection and tense formation'
  })
  inf.forms = forms
  inf.units = LEVELS.map((level) => ({
    id: level,
    title: level,
    test: true,
    lessons: Object.values(forms)
      .filter((f) => formLevels[f.key] === level)
      .map((f) => ({ id: f.key, title: f.title, items: [f.key] }))
  }))
  const phrases = (id: string, title: { zh: string; en: string }, rows: string[][]): Course => {
    const c = empty(id, 'phrases', title)
    c.phrases = {}
    c.units = LEVELS.map((level) => ({
      id: level,
      title: level,
      test: true,
      lessons: rows
        .filter((r) => r[0] === level)
        .map(([, text, zh], i) => {
          const key = `en-${id}-${level}-${i}`
          const p: PhraseItem = {
            key,
            text,
            meaning: { zh, en: text },
            say: { text, lang: 'en-US' }
          }
          c.phrases![key] = p
          return { id: key, title: text, items: [key] }
        })
    }))
    return c
  }
  const stories = empty('stories', 'texts', { zh: '英语分级阅读', en: 'English graded reading' })
  stories.texts = {}
  stories.units = LEVELS.map((level) => {
    const key = `en-reading-${level}`
    stories.texts![key] = {
      key,
      title: `${level} · ${readingTitles[level]}`,
      author: 'Qonsona',
      articleId: `b-${key}`
    }
    return {
      id: level,
      title: level,
      test: true,
      lessons: [
        {
          id: key,
          title: readingTitles[level],
          items: [key],
          note: {
            zh: '自编分级短文；等级为教学安排，并非官方认证。',
            en: 'Original graded text; editorial level, not an official certification.'
          }
        }
      ]
    }
  })
  return prepareCourses([
    alphabet,
    gc,
    inf,
    phrases('phrasebook', { zh: '英语会话', en: 'English conversations' }, phraseRows),
    phrases('idioms', { zh: '英语惯用表达', en: 'English idiomatic expressions' }, idiomRows),
    stories
  ])
}
export const readingTitles: Record<string, string> = {
  A1: 'A day at home',
  A2: 'A change of plan',
  B1: 'A library for everyone',
  B2: 'Rethinking the daily journey',
  C1: 'Evidence and public decisions',
  C2: 'The limits of a useful metaphor'
}

// Introduce at least two contrasts in the first lesson so multiple-choice questions can be generated.
function prepareCourses(list: Course[]): Course[] {
  for (const c of list) {
    if (c.kind === 'symbols' || c.kind === 'grammar' || c.kind === 'phrases') {
      const first = c.units[0]?.lessons
      if (first && first.length > 1) {
        const a = first[0],
          b = first[1]
        a.items.push(...b.items)
        a.title = { zh: '入门对照：两组表达', en: 'Introductory contrasts' }
        if (b.words) a.words = [...(a.words ?? []), ...b.words]
        a.note = {
          zh: '两组表达的形式与用途对照；下列条目分别保留详细说明。',
          en: 'Compare the forms and uses of both groups; item notes provide detail.'
        }
        first.splice(1, 1)
      }
    }
  }
  return list
}
