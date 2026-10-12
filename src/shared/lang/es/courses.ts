import type { Course } from '../../course'
import type { LangModule } from '../types'
import { lexGrammarCourse } from '../course'
import { texts } from './texts'
const content = {
  symbols: {
    '0': {
      key: '0',
      symbol: 'a',
      reading: 'a',
      ipa: 'a',
      typeable: false,
      say: {
        text: 'casa',
        lang: 'es'
      },
      note: {
        zh: '读法因地区和语音环境而异；ll 可为 /ʝ/、/ʎ/、/ʃ/ 或 /ʒ/。',
        en: 'Pronunciation varies by region and context; ll may be /ʝ/, /ʎ/, /ʃ/ or /ʒ/.'
      }
    },
    '1': {
      key: '1',
      symbol: 'e',
      reading: 'e',
      ipa: 'e',
      typeable: false,
      say: {
        text: 'mesa',
        lang: 'es'
      },
      note: {
        zh: '读法因地区和语音环境而异；ll 可为 /ʝ/、/ʎ/、/ʃ/ 或 /ʒ/。',
        en: 'Pronunciation varies by region and context; ll may be /ʝ/, /ʎ/, /ʃ/ or /ʒ/.'
      }
    },
    '2': {
      key: '2',
      symbol: 'i',
      reading: 'i',
      ipa: 'i',
      typeable: false,
      say: {
        text: 'libro',
        lang: 'es'
      },
      note: {
        zh: '读法因地区和语音环境而异；ll 可为 /ʝ/、/ʎ/、/ʃ/ 或 /ʒ/。',
        en: 'Pronunciation varies by region and context; ll may be /ʝ/, /ʎ/, /ʃ/ or /ʒ/.'
      }
    },
    '3': {
      key: '3',
      symbol: 'o',
      reading: 'o',
      ipa: 'o',
      typeable: false,
      say: {
        text: 'ocho',
        lang: 'es'
      },
      note: {
        zh: '读法因地区和语音环境而异；ll 可为 /ʝ/、/ʎ/、/ʃ/ 或 /ʒ/。',
        en: 'Pronunciation varies by region and context; ll may be /ʝ/, /ʎ/, /ʃ/ or /ʒ/.'
      }
    },
    '4': {
      key: '4',
      symbol: 'u',
      reading: 'u',
      ipa: 'u',
      typeable: false,
      say: {
        text: 'uno',
        lang: 'es'
      },
      note: {
        zh: '读法因地区和语音环境而异；ll 可为 /ʝ/、/ʎ/、/ʃ/ 或 /ʒ/。',
        en: 'Pronunciation varies by region and context; ll may be /ʝ/, /ʎ/, /ʃ/ or /ʒ/.'
      }
    },
    '5': {
      key: '5',
      symbol: 'ñ',
      reading: 'ñe',
      ipa: 'ɲ',
      typeable: false,
      say: {
        text: 'niño',
        lang: 'es'
      },
      note: {
        zh: '读法因地区和语音环境而异；ll 可为 /ʝ/、/ʎ/、/ʃ/ 或 /ʒ/。',
        en: 'Pronunciation varies by region and context; ll may be /ʝ/, /ʎ/, /ʃ/ or /ʒ/.'
      }
    },
    '6': {
      key: '6',
      symbol: 'j',
      reading: 'jota',
      ipa: 'x',
      typeable: false,
      say: {
        text: 'joven',
        lang: 'es'
      },
      note: {
        zh: '读法因地区和语音环境而异；ll 可为 /ʝ/、/ʎ/、/ʃ/ 或 /ʒ/。',
        en: 'Pronunciation varies by region and context; ll may be /ʝ/, /ʎ/, /ʃ/ or /ʒ/.'
      }
    },
    '7': {
      key: '7',
      symbol: 'rr',
      reading: 'erre doble',
      ipa: 'r',
      typeable: false,
      say: {
        text: 'perro',
        lang: 'es'
      },
      note: {
        zh: '读法因地区和语音环境而异；ll 可为 /ʝ/、/ʎ/、/ʃ/ 或 /ʒ/。',
        en: 'Pronunciation varies by region and context; ll may be /ʝ/, /ʎ/, /ʃ/ or /ʒ/.'
      }
    },
    '8': {
      key: '8',
      symbol: 'ch',
      reading: 'che',
      ipa: 'tʃ',
      typeable: false,
      say: {
        text: 'chico',
        lang: 'es'
      },
      note: {
        zh: '读法因地区和语音环境而异；ll 可为 /ʝ/、/ʎ/、/ʃ/ 或 /ʒ/。',
        en: 'Pronunciation varies by region and context; ll may be /ʝ/, /ʎ/, /ʃ/ or /ʒ/.'
      }
    },
    '9': {
      key: '9',
      symbol: 'll',
      reading: 'elle',
      ipa: 'ʝ',
      typeable: false,
      say: {
        text: 'llave',
        lang: 'es'
      },
      note: {
        zh: '读法因地区和语音环境而异；ll 可为 /ʝ/、/ʎ/、/ʃ/ 或 /ʒ/。',
        en: 'Pronunciation varies by region and context; ll may be /ʝ/, /ʎ/, /ʃ/ or /ʒ/.'
      }
    },
    '10': {
      key: '10',
      symbol: 'qu',
      reading: 'cu',
      ipa: 'k',
      typeable: false,
      say: {
        text: 'queso',
        lang: 'es'
      },
      note: {
        zh: '读法因地区和语音环境而异；ll 可为 /ʝ/、/ʎ/、/ʃ/ 或 /ʒ/。',
        en: 'Pronunciation varies by region and context; ll may be /ʝ/, /ʎ/, /ʃ/ or /ʒ/.'
      }
    },
    '11': {
      key: '11',
      symbol: 'gu',
      reading: 'gu',
      ipa: 'ɡ',
      typeable: false,
      say: {
        text: 'guerra',
        lang: 'es'
      },
      note: {
        zh: '读法因地区和语音环境而异；ll 可为 /ʝ/、/ʎ/、/ʃ/ 或 /ʒ/。',
        en: 'Pronunciation varies by region and context; ll may be /ʝ/, /ʎ/, /ʃ/ or /ʒ/.'
      }
    }
  },
  forms: {
    '0': {
      key: '0',
      title: {
        zh: '现在时第一人称',
        en: 'Present first person'
      },
      examples: [
        {
          base: 'hablar',
          form: 'hablo',
          wrong: ['habla', 'hablas', 'hablamos']
        }
      ]
    },
    '1': {
      key: '1',
      title: {
        zh: '简单过去第一人称',
        en: 'Preterite first person'
      },
      examples: [
        {
          base: 'comer',
          form: 'comí',
          wrong: ['comió', 'comía', 'come']
        }
      ]
    },
    '2': {
      key: '2',
      title: {
        zh: '未完成第一人称',
        en: 'Imperfect first person'
      },
      examples: [
        {
          base: 'vivir',
          form: 'vivía',
          wrong: ['viví', 'vivió', 'vive']
        }
      ]
    },
    '3': {
      key: '3',
      title: {
        zh: 'ser 现在第一人称',
        en: 'ser present first person'
      },
      examples: [
        {
          base: 'ser',
          form: 'soy',
          wrong: ['eres', 'es', 'estoy']
        }
      ]
    },
    '4': {
      key: '4',
      title: {
        zh: 'estar 现在第一人称',
        en: 'estar present first person'
      },
      examples: [
        {
          base: 'estar',
          form: 'estoy',
          wrong: ['soy', 'está', 'estás']
        }
      ]
    },
    '5': {
      key: '5',
      title: {
        zh: '虚拟式第一/第三单数',
        en: 'Subjunctive first/third singular'
      },
      examples: [
        {
          base: 'ser',
          form: 'sea',
          wrong: ['es', 'soy', 'era']
        }
      ]
    },
    '6': {
      key: '6',
      title: {
        zh: '虚拟式第一/第三单数',
        en: 'Subjunctive first/third singular'
      },
      examples: [
        {
          base: 'estar',
          form: 'esté',
          wrong: ['está', 'estoy', 'estaba']
        }
      ]
    },
    '7': {
      key: '7',
      title: {
        zh: '过去未完成虚拟式',
        en: 'Imperfect subjunctive'
      },
      examples: [
        {
          base: 'tener',
          form: 'tuviera',
          wrong: ['tuvo', 'tendría', 'tiene']
        }
      ]
    },
    '8': {
      key: '8',
      title: {
        zh: '过去分词',
        en: 'Past participle'
      },
      examples: [
        {
          base: 'hacer',
          form: 'hecho',
          wrong: ['hacido', 'hizo', 'hago']
        }
      ]
    },
    '9': {
      key: '9',
      title: {
        zh: '简单过去第一人称',
        en: 'Preterite first person'
      },
      examples: [
        {
          base: 'ir',
          form: 'fui',
          wrong: ['iba', 'voy', 'va']
        }
      ]
    },
    '10': {
      key: '10',
      title: {
        zh: '将来第一人称',
        en: 'Future first person'
      },
      examples: [
        {
          base: 'hablar',
          form: 'hablaré',
          wrong: ['hablaría', 'hablaba', 'hablé']
        }
      ]
    },
    '11': {
      key: '11',
      title: {
        zh: '过去分词',
        en: 'Past participle'
      },
      examples: [
        {
          base: 'leer',
          form: 'leído',
          wrong: ['leido', 'leyó', 'lee']
        }
      ]
    }
  },
  phrases: {
    '0': {
      key: '0',
      text: 'Hola, ¿qué tal?',
      meaning: {
        zh: '你好，怎么样？',
        en: 'Hello, how are things?'
      },
      say: {
        text: 'Hola, ¿qué tal?',
        lang: 'es'
      }
    },
    '1': {
      key: '1',
      text: 'Me llamo Ana.',
      meaning: {
        zh: '我叫安娜。',
        en: 'My name is Ana.'
      },
      say: {
        text: 'Me llamo Ana.',
        lang: 'es'
      }
    },
    '2': {
      key: '2',
      text: '¿Cuánto cuesta?',
      meaning: {
        zh: '多少钱？',
        en: 'How much does it cost?'
      },
      say: {
        text: '¿Cuánto cuesta?',
        lang: 'es'
      }
    },
    '3': {
      key: '3',
      text: 'Quisiera un café, por favor.',
      meaning: {
        zh: '请给我一杯咖啡。',
        en: 'I would like a coffee, please.'
      },
      say: {
        text: 'Quisiera un café, por favor.',
        lang: 'es'
      }
    },
    '4': {
      key: '4',
      text: '¿Dónde está la estación?',
      meaning: {
        zh: '车站在哪里？',
        en: 'Where is the station?'
      },
      say: {
        text: '¿Dónde está la estación?',
        lang: 'es'
      }
    },
    '5': {
      key: '5',
      text: 'No entiendo.',
      meaning: {
        zh: '我不明白。',
        en: 'I do not understand.'
      },
      say: {
        text: 'No entiendo.',
        lang: 'es'
      }
    },
    '6': {
      key: '6',
      text: '¿Puede hablar más despacio?',
      meaning: {
        zh: '您能说慢点吗？',
        en: 'Could you speak more slowly?'
      },
      say: {
        text: '¿Puede hablar más despacio?',
        lang: 'es'
      }
    },
    '7': {
      key: '7',
      text: 'Necesito ayuda.',
      meaning: {
        zh: '我需要帮助。',
        en: 'I need help.'
      },
      say: {
        text: 'Necesito ayuda.',
        lang: 'es'
      }
    },
    '8': {
      key: '8',
      text: 'Tengo una reserva.',
      meaning: {
        zh: '我有预订。',
        en: 'I have a reservation.'
      },
      say: {
        text: 'Tengo una reserva.',
        lang: 'es'
      }
    },
    '9': {
      key: '9',
      text: '¿A qué hora sale el tren?',
      meaning: {
        zh: '火车几点出发？',
        en: 'What time does the train leave?'
      },
      say: {
        text: '¿A qué hora sale el tren?',
        lang: 'es'
      }
    },
    '10': {
      key: '10',
      text: 'Me duele la cabeza.',
      meaning: {
        zh: '我头痛。',
        en: 'My head hurts.'
      },
      say: {
        text: 'Me duele la cabeza.',
        lang: 'es'
      }
    },
    '11': {
      key: '11',
      text: 'Muchas gracias.',
      meaning: {
        zh: '非常感谢。',
        en: 'Thank you very much.'
      },
      say: {
        text: 'Muchas gracias.',
        lang: 'es'
      }
    }
  },
  idioms: {
    '0': {
      key: '0',
      text: 'estar en las nubes',
      meaning: {
        zh: '心不在焉',
        en: 'to have your head in the clouds'
      },
      say: {
        text: 'estar en las nubes',
        lang: 'es'
      }
    },
    '1': {
      key: '1',
      text: 'echar una mano',
      meaning: {
        zh: '帮一把',
        en: 'to lend a hand'
      },
      say: {
        text: 'echar una mano',
        lang: 'es'
      }
    },
    '2': {
      key: '2',
      text: 'costar un ojo de la cara',
      meaning: {
        zh: '非常昂贵',
        en: 'to cost an arm and a leg'
      },
      say: {
        text: 'costar un ojo de la cara',
        lang: 'es'
      }
    },
    '3': {
      key: '3',
      text: 'meter la pata',
      meaning: {
        zh: '犯错，说错话',
        en: 'to put your foot in it'
      },
      say: {
        text: 'meter la pata',
        lang: 'es'
      }
    },
    '4': {
      key: '4',
      text: 'dar en el clavo',
      meaning: {
        zh: '说中要点',
        en: 'to hit the nail on the head'
      },
      say: {
        text: 'dar en el clavo',
        lang: 'es'
      }
    },
    '5': {
      key: '5',
      text: 'poco a poco',
      meaning: {
        zh: '渐渐地',
        en: 'little by little'
      },
      say: {
        text: 'poco a poco',
        lang: 'es'
      }
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
