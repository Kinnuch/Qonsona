import type { Course } from '../../course'
import type { LangModule } from '../types'
import { lexGrammarCourse } from '../course'
import { texts } from './texts'
const content = {
  symbols: {
    '0': {
      key: '0',
      symbol: 'a',
      reading: 'broad a',
      ipa: 'a',
      typeable: false,
      say: null,
      note: {
        zh: '宽元音 a/o/u 与窄元音 e/i 决定相邻辅音类型；此音标为常见宽音读法，存在方言与环境变化。',
        en: 'Broad a/o/u versus slender e/i determines consonant quality; pronunciation varies by dialect and context.'
      }
    },
    '1': {
      key: '1',
      symbol: 'i',
      reading: 'slender i',
      ipa: 'i',
      typeable: false,
      say: null,
      note: {
        zh: '宽元音 a/o/u 与窄元音 e/i 决定相邻辅音类型；此音标为常见宽音读法，存在方言与环境变化。',
        en: 'Broad a/o/u versus slender e/i determines consonant quality; pronunciation varies by dialect and context.'
      }
    },
    '2': {
      key: '2',
      symbol: 'à',
      reading: 'long à',
      ipa: 'aː',
      typeable: false,
      say: null,
      note: {
        zh: '宽元音 a/o/u 与窄元音 e/i 决定相邻辅音类型；此音标为常见宽音读法，存在方言与环境变化。',
        en: 'Broad a/o/u versus slender e/i determines consonant quality; pronunciation varies by dialect and context.'
      }
    },
    '3': {
      key: '3',
      symbol: 'ì',
      reading: 'long ì',
      ipa: 'iː',
      typeable: false,
      say: null,
      note: {
        zh: '宽元音 a/o/u 与窄元音 e/i 决定相邻辅音类型；此音标为常见宽音读法，存在方言与环境变化。',
        en: 'Broad a/o/u versus slender e/i determines consonant quality; pronunciation varies by dialect and context.'
      }
    },
    '4': {
      key: '4',
      symbol: 'ò',
      reading: 'long ò',
      ipa: 'ɔː',
      typeable: false,
      say: null,
      note: {
        zh: '宽元音 a/o/u 与窄元音 e/i 决定相邻辅音类型；此音标为常见宽音读法，存在方言与环境变化。',
        en: 'Broad a/o/u versus slender e/i determines consonant quality; pronunciation varies by dialect and context.'
      }
    },
    '5': {
      key: '5',
      symbol: 'ù',
      reading: 'long ù',
      ipa: 'uː',
      typeable: false,
      say: null,
      note: {
        zh: '宽元音 a/o/u 与窄元音 e/i 决定相邻辅音类型；此音标为常见宽音读法，存在方言与环境变化。',
        en: 'Broad a/o/u versus slender e/i determines consonant quality; pronunciation varies by dialect and context.'
      }
    },
    '6': {
      key: '6',
      symbol: 'bh',
      reading: 'lenited b',
      ipa: 'v',
      typeable: false,
      say: null,
      note: {
        zh: '宽元音 a/o/u 与窄元音 e/i 决定相邻辅音类型；此音标为常见宽音读法，存在方言与环境变化。',
        en: 'Broad a/o/u versus slender e/i determines consonant quality; pronunciation varies by dialect and context.'
      }
    },
    '7': {
      key: '7',
      symbol: 'mh',
      reading: 'lenited m',
      ipa: 'v',
      typeable: false,
      say: null,
      note: {
        zh: '宽元音 a/o/u 与窄元音 e/i 决定相邻辅音类型；此音标为常见宽音读法，存在方言与环境变化。',
        en: 'Broad a/o/u versus slender e/i determines consonant quality; pronunciation varies by dialect and context.'
      }
    },
    '8': {
      key: '8',
      symbol: 'ch',
      reading: 'broad ch',
      ipa: 'x',
      typeable: false,
      say: null,
      note: {
        zh: '宽元音 a/o/u 与窄元音 e/i 决定相邻辅音类型；此音标为常见宽音读法，存在方言与环境变化。',
        en: 'Broad a/o/u versus slender e/i determines consonant quality; pronunciation varies by dialect and context.'
      }
    },
    '9': {
      key: '9',
      symbol: 'th',
      reading: 'lenited t',
      ipa: 'h',
      typeable: false,
      say: null,
      note: {
        zh: '宽元音 a/o/u 与窄元音 e/i 决定相邻辅音类型；此音标为常见宽音读法，存在方言与环境变化。',
        en: 'Broad a/o/u versus slender e/i determines consonant quality; pronunciation varies by dialect and context.'
      }
    },
    '10': {
      key: '10',
      symbol: 'ph',
      reading: 'lenited p',
      ipa: 'f',
      typeable: false,
      say: null,
      note: {
        zh: '宽元音 a/o/u 与窄元音 e/i 决定相邻辅音类型；此音标为常见宽音读法，存在方言与环境变化。',
        en: 'Broad a/o/u versus slender e/i determines consonant quality; pronunciation varies by dialect and context.'
      }
    },
    '11': {
      key: '11',
      symbol: 'fh',
      reading: 'silent fh',
      ipa: '',
      typeable: false,
      say: null,
      note: {
        zh: '宽元音 a/o/u 与窄元音 e/i 决定相邻辅音类型；此音标为常见宽音读法，存在方言与环境变化。',
        en: 'Broad a/o/u versus slender e/i determines consonant quality; pronunciation varies by dialect and context.'
      }
    }
  },
  forms: {
    '0': {
      key: '0',
      title: {
        zh: 'mo 后的弱化',
        en: 'Lenition after mo'
      },
      examples: [
        {
          base: 'bàta',
          form: 'bhàta',
          wrong: ['bàta', 'bàtha', 'bàtan']
        }
      ]
    },
    '1': {
      key: '1',
      title: {
        zh: 'do 后的弱化',
        en: 'Lenition after do'
      },
      examples: [
        {
          base: 'cù',
          form: 'chù',
          wrong: ['cù', 'cùh', 'cùth']
        }
      ]
    },
    '2': {
      key: '2',
      title: {
        zh: 'sg 不弱化',
        en: 'sg resists lenition'
      },
      examples: [
        {
          base: 'sgian',
          form: 'sgian',
          wrong: ['shgian', 'sghian', 'sgìan']
        }
      ]
    },
    '3': {
      key: '3',
      title: {
        zh: '复数（本词）',
        en: 'Plural of this noun'
      },
      examples: [
        {
          base: 'cat',
          form: 'cait',
          wrong: ['cat', 'chait', 'càth']
        }
      ]
    },
    '4': {
      key: '4',
      title: {
        zh: '属格单数',
        en: 'Genitive singular'
      },
      examples: [
        {
          base: 'taigh',
          form: 'taighe',
          wrong: ['taigh', 'thaigh', 'taighean']
        }
      ]
    },
    '5': {
      key: '5',
      title: {
        zh: 'an 疑问后的从属式',
        en: 'Dependent after an'
      },
      examples: [
        {
          base: 'tha',
          form: 'bheil',
          wrong: ['tha', 'bidh', 'bha']
        }
      ]
    },
    '6': {
      key: '6',
      title: {
        zh: 'chan 否定后的形式',
        en: 'Form after chan'
      },
      examples: [
        {
          base: 'tha',
          form: 'eil',
          wrong: ['tha', 'bheil', 'bha']
        }
      ]
    },
    '7': {
      key: '7',
      title: {
        zh: 'an 疑问后的从属式',
        en: 'Dependent after an'
      },
      examples: [
        {
          base: 'bidh',
          form: 'bi',
          wrong: ['bidh', 'bha', 'tha']
        }
      ]
    },
    '8': {
      key: '8',
      title: {
        zh: '第一单数介词代词',
        en: 'First singular prepositional pronoun'
      },
      examples: [
        {
          base: 'aig + mi',
          form: 'agam',
          wrong: ['agad', 'aige', 'againn']
        }
      ]
    },
    '9': {
      key: '9',
      title: {
        zh: '第二单数介词代词',
        en: 'Second singular prepositional pronoun'
      },
      examples: [
        {
          base: 'aig + thu',
          form: 'agad',
          wrong: ['agam', 'aige', 'agaibh']
        }
      ]
    },
    '10': {
      key: '10',
      title: {
        zh: '第一单数介词代词',
        en: 'First singular prepositional pronoun'
      },
      examples: [
        {
          base: 'le + mi',
          form: 'leam',
          wrong: ['leat', 'leis', 'leinn']
        }
      ]
    },
    '11': {
      key: '11',
      title: {
        zh: '第三单数阴性介词代词',
        en: 'Third singular feminine prepositional pronoun'
      },
      examples: [
        {
          base: 'le + i',
          form: 'leatha',
          wrong: ['leis', 'leat', 'leam']
        }
      ]
    }
  },
  phrases: {
    '0': {
      key: '0',
      text: 'Madainn mhath.',
      meaning: {
        zh: '早上好。',
        en: 'Good morning.'
      },
      say: null
    },
    '1': {
      key: '1',
      text: 'Feasgar math.',
      meaning: {
        zh: '下午好。',
        en: 'Good afternoon.'
      },
      say: null
    },
    '2': {
      key: '2',
      text: 'Ciamar a tha thu?',
      meaning: {
        zh: '你好吗？',
        en: 'How are you?'
      },
      say: null
    },
    '3': {
      key: '3',
      text: 'Tha mi gu math.',
      meaning: {
        zh: '我很好。',
        en: 'I am well.'
      },
      say: null
    },
    '4': {
      key: '4',
      text: 'Dè an t-ainm a th’ ort?',
      meaning: {
        zh: '你叫什么名字？',
        en: 'What is your name?'
      },
      say: null
    },
    '5': {
      key: '5',
      text: 'Is mise Màiri.',
      meaning: {
        zh: '我是玛丽。',
        en: 'I am Mary.'
      },
      say: null
    },
    '6': {
      key: '6',
      text: 'Tapadh leat.',
      meaning: {
        zh: '谢谢你。',
        en: 'Thank you.'
      },
      say: null
    },
    '7': {
      key: '7',
      text: 'Chan eil mi a’ tuigsinn.',
      meaning: {
        zh: '我不明白。',
        en: 'I do not understand.'
      },
      say: null
    },
    '8': {
      key: '8',
      text: 'Bruidhinn nas slaodaiche, mas e do thoil e.',
      meaning: {
        zh: '请说慢点。',
        en: 'Speak more slowly, please.'
      },
      say: null
    },
    '9': {
      key: '9',
      text: 'Càit a bheil an stèisean?',
      meaning: {
        zh: '车站在哪里？',
        en: 'Where is the station?'
      },
      say: null
    },
    '10': {
      key: '10',
      text: 'Tha mi ag ionnsachadh Gàidhlig.',
      meaning: {
        zh: '我在学习盖尔语。',
        en: 'I am learning Gaelic.'
      },
      say: null
    },
    '11': {
      key: '11',
      text: 'Mar sin leat.',
      meaning: {
        zh: '再见。',
        en: 'Goodbye.'
      },
      say: null
    }
  },
  idioms: {
    '0': {
      key: '0',
      text: 'Is toil leam ceòl.',
      meaning: {
        zh: '我喜欢音乐。',
        en: 'I like music.'
      },
      say: null
    },
    '1': {
      key: '1',
      text: 'Tha an t-acras orm.',
      meaning: {
        zh: '我饿了。',
        en: 'I am hungry.'
      },
      say: null
    },
    '2': {
      key: '2',
      text: 'Tha am pathadh orm.',
      meaning: {
        zh: '我渴了。',
        en: 'I am thirsty.'
      },
      say: null
    },
    '3': {
      key: '3',
      text: 'Tha eagal orm.',
      meaning: {
        zh: '我害怕。',
        en: 'I am afraid.'
      },
      say: null
    },
    '4': {
      key: '4',
      text: 'Tha mi duilich.',
      meaning: {
        zh: '对不起。',
        en: 'I am sorry.'
      },
      say: null
    },
    '5': {
      key: '5',
      text: 'Is fheàrr an t-slàinte na an t-airgead.',
      meaning: {
        zh: '健康胜于金钱。',
        en: 'Health is better than money.'
      },
      say: null
    }
  }
}
export function courses(mod: LangModule, locale: string): Course[] {
  const result: Course[] = [lexGrammarCourse(mod, locale)]
  for (const [id, kind, title, items] of [
    ['alphabet', 'symbols', { zh: '拼读与拼写', en: 'Phonics and spelling' }, content.symbols],
    [
      'inflection',
      'forms',
      { zh: '变形与易错形式', en: 'Inflection and common errors' },
      content.forms
    ],
    ['phrasebook', 'phrases', { zh: '日常会话', en: 'Everyday conversation' }, content.phrases],
    ['idioms', 'phrases', { zh: '惯用表达', en: 'Idiomatic expressions' }, content.idioms]
  ] as const) {
    const keys = Object.keys(items)
    const lessons: Course['units'][number]['lessons'] = []
    for (let i = 0; i < keys.length; i += 3)
      lessons.push({
        id: `${id}-${i / 3 + 1}`,
        title: { zh: `第 ${i / 3 + 1} 课`, en: `Lesson ${i / 3 + 1}` },
        items: keys.slice(i, i + 3)
      })
    const course: Course = {
      id,
      kind,
      title,
      units: [{ id: `${id}-core`, title, lessons, test: true }],
      symbols: {},
      grammar: {},
      docs: {}
    }
    if (kind === 'symbols') course.symbols = content.symbols
    if (kind === 'forms') course.forms = content.forms
    if (kind === 'phrases') course.phrases = id === 'idioms' ? content.idioms : content.phrases
    result.push(course)
  }
  const stories = Object.fromEntries(
    texts.map((t) => [t.id, { key: t.id, title: t.title, articleId: `b-${t.id}` }])
  )
  result.push({
    id: 'stories',
    kind: 'texts',
    title: { zh: '分级阅读', en: 'Graded reading' },
    symbols: {},
    grammar: {},
    docs: {},
    texts: stories,
    units: texts.map((t) => ({
      id: t.level!,
      title: t.level!,
      lessons: [{ id: t.id, title: t.title, items: [t.id] }],
      test: false
    }))
  })
  return result
}
