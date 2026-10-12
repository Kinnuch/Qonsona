import { additional } from './additional'
import type { LexGrammarPoint } from '../types'
import { rules } from './rules'
import { meanings } from './meanings'
export const grammar: LexGrammarPoint[] = [
  {
    id: 'es-ser',
    level: 'A1',
    name: {
      zh: '身份与来源 ser',
      en: 'Identity and origin'
    },
    form: {
      zh: '身份与来源 ser',
      en: 'Identity and origin'
    },
    meaning: {
      zh: 'ser 表身份和来源，位置一般用 estar。',
      en: 'Identity and origin'
    },
    examples: [
      {
        text: 'Soy profesora.',
        hl: 'Soy',
        zh: '我是老师。',
        en: 'I am a teacher.'
      },
      {
        text: 'Somos de Madrid.',
        hl: 'Somos',
        zh: '我们来自马德里。',
        en: 'We are from Madrid.'
      }
    ],
    group: 'ser'
  },
  {
    id: 'es-estar',
    level: 'A1',
    name: {
      zh: '位置 estar',
      en: 'Location'
    },
    form: {
      zh: '位置 estar',
      en: 'Location'
    },
    meaning: {
      zh: 'estar 表位置与状态；事件举行地点用 ser。',
      en: 'Location'
    },
    examples: [
      {
        text: 'El libro está en la mesa.',
        hl: 'está',
        zh: '书在桌上。',
        en: 'The book is on the table.'
      },
      {
        text: 'Estamos en casa.',
        hl: 'Estamos',
        zh: '我们在家。',
        en: 'We are at home.'
      }
    ],
    group: 'estar'
  },
  {
    id: 'es-present',
    level: 'A1',
    name: {
      zh: '现在时',
      en: 'Present tense'
    },
    form: {
      zh: '现在时',
      en: 'Present tense'
    },
    meaning: {
      zh: '规则动词按人称变位，代词常省略。',
      en: 'Present tense'
    },
    examples: [
      {
        text: 'Hablo español.',
        hl: 'Hablo',
        zh: '我说西班牙语。',
        en: 'I speak Spanish.'
      },
      {
        text: 'Vivimos en Sevilla.',
        hl: 'Vivimos',
        zh: '我们住在塞维利亚。',
        en: 'We live in Seville.'
      }
    ],
    group: 'present'
  },
  {
    id: 'es-preterite',
    level: 'A2',
    name: {
      zh: '简单过去时',
      en: 'Preterite'
    },
    form: {
      zh: '简单过去时',
      en: 'Preterite'
    },
    meaning: {
      zh: '呈现已完成事件。',
      en: 'Preterite'
    },
    examples: [
      {
        text: 'Ayer compré pan.',
        hl: 'compré',
        zh: '昨天我买了面包。',
        en: 'Yesterday I bought bread.'
      },
      {
        text: 'El lunes visitamos el museo.',
        hl: 'visitamos',
        zh: '星期一我们参观了博物馆。',
        en: 'On Monday we visited the museum.'
      }
    ],
    group: 'preterite'
  },
  {
    id: 'es-imperfect',
    level: 'A2',
    name: {
      zh: '过去未完成时',
      en: 'Imperfect'
    },
    form: {
      zh: '过去未完成时',
      en: 'Imperfect'
    },
    meaning: {
      zh: '描写过去习惯和背景。',
      en: 'Imperfect'
    },
    examples: [
      {
        text: 'De niño jugaba en el parque.',
        hl: 'jugaba',
        zh: '小时候我常在公园玩。',
        en: 'As a child I used to play in the park.'
      },
      {
        text: 'Antes vivíamos cerca del río.',
        hl: 'vivíamos',
        zh: '以前我们住在河边。',
        en: 'We used to live near the river.'
      }
    ],
    group: 'imperfect'
  },
  {
    id: 'es-obligation',
    level: 'A2',
    name: {
      zh: '义务',
      en: 'Obligation'
    },
    form: {
      zh: '义务',
      en: 'Obligation'
    },
    meaning: {
      zh: 'tener que 加不定式。',
      en: 'Obligation'
    },
    examples: [
      {
        text: 'Tengo que estudiar.',
        hl: 'Tengo que estudiar',
        zh: '我必须学习。',
        en: 'I have to study.'
      },
      {
        text: 'Tenemos que salir temprano.',
        hl: 'Tenemos que salir',
        zh: '我们得早出发。',
        en: 'We have to leave early.'
      }
    ],
    group: 'obligation'
  },
  {
    id: 'es-wish',
    level: 'B1',
    name: {
      zh: '愿望虚拟式',
      en: 'Subjunctive wishes'
    },
    form: {
      zh: '愿望虚拟式',
      en: 'Subjunctive wishes'
    },
    meaning: {
      zh: '愿望主句与从句主语不同，que 后用虚拟式。',
      en: 'Subjunctive wishes'
    },
    examples: [
      {
        text: 'Espero que vengas mañana.',
        hl: 'Espero que vengas',
        zh: '我希望你明天来。',
        en: 'I hope you come tomorrow.'
      },
      {
        text: 'Quiero que estudies más.',
        hl: 'Quiero que estudies',
        zh: '我希望你多学习。',
        en: 'I want you to study more.'
      }
    ],
    group: 'wish'
  },
  {
    id: 'es-perfect',
    level: 'B1',
    name: {
      zh: '现在完成时',
      en: 'Present perfect'
    },
    form: {
      zh: '现在完成时',
      en: 'Present perfect'
    },
    meaning: {
      zh: 'haber 加不变过去分词；使用有地域差异。',
      en: 'Present perfect'
    },
    examples: [
      {
        text: 'Hoy he leído dos páginas.',
        hl: 'he leído',
        zh: '今天我读了两页。',
        en: 'Today I have read two pages.'
      },
      {
        text: 'Ya hemos terminado.',
        hl: 'hemos terminado',
        zh: '我们已完成。',
        en: 'We have already finished.'
      }
    ],
    group: 'perfect'
  },
  {
    id: 'es-future',
    level: 'B1',
    name: {
      zh: '将来时',
      en: 'Future tense'
    },
    form: {
      zh: '将来时',
      en: 'Future tense'
    },
    meaning: {
      zh: '未来计划或推测，注意不规则词干。',
      en: 'Future tense'
    },
    examples: [
      {
        text: 'Mañana hablaré con Ana.',
        hl: 'hablaré',
        zh: '明天我会和安娜谈话。',
        en: 'Tomorrow I will talk to Ana.'
      },
      {
        text: 'Tendremos más tiempo.',
        hl: 'Tendremos',
        zh: '我们将有更多时间。',
        en: 'We will have more time.'
      }
    ],
    group: 'future'
  },
  {
    id: 'es-hypothesis',
    level: 'B2',
    name: {
      zh: '非现实条件',
      en: 'Unreal conditions'
    },
    form: {
      zh: '非现实条件',
      en: 'Unreal conditions'
    },
    meaning: {
      zh: 'si 加未完成虚拟式，主句条件式。',
      en: 'Unreal conditions'
    },
    examples: [
      {
        text: 'Si tuviera tiempo, viajaría más.',
        hl: 'Si tuviera tiempo',
        zh: '如果有时间，我会多旅行。',
        en: 'If I had time, I would travel more.'
      },
      {
        text: 'Si fuera rico, compraría una casa.',
        hl: 'Si fuera rico',
        zh: '如果富有，我会买房。',
        en: 'If I were rich, I would buy a house.'
      }
    ],
    group: 'hypothesis'
  },
  {
    id: 'es-purpose',
    level: 'B2',
    name: {
      zh: '目的从句',
      en: 'Purpose clauses'
    },
    form: {
      zh: '目的从句',
      en: 'Purpose clauses'
    },
    meaning: {
      zh: 'para que 加虚拟式表达另一主语的目的。',
      en: 'Purpose clauses'
    },
    examples: [
      {
        text: 'Te llamo para que vengas.',
        hl: 'para que vengas',
        zh: '我打电话让你过来。',
        en: 'I am calling you so that you come.'
      },
      {
        text: 'Hablo despacio para que me entiendas.',
        hl: 'para que me entiendas',
        zh: '我慢慢说让你明白。',
        en: 'I speak slowly so that you understand me.'
      }
    ],
    group: 'purpose'
  },
  {
    id: 'es-passive',
    level: 'B2',
    name: {
      zh: '被动 ser',
      en: 'Passive'
    },
    form: {
      zh: '被动 ser',
      en: 'Passive'
    },
    meaning: {
      zh: 'ser 加性数配合的过去分词。',
      en: 'Passive'
    },
    examples: [
      {
        text: 'La carta fue escrita por Ana.',
        hl: 'fue escrita',
        zh: '信由安娜写成。',
        en: 'The letter was written by Ana.'
      },
      {
        text: 'Los premios fueron entregados ayer.',
        hl: 'fueron entregados',
        zh: '奖项昨天颁发了。',
        en: 'The prizes were awarded yesterday.'
      }
    ],
    group: 'passive'
  },
  {
    id: 'es-counterfactual',
    level: 'C1',
    name: {
      zh: '过去反事实',
      en: 'Past counterfactuals'
    },
    form: {
      zh: '过去反事实',
      en: 'Past counterfactuals'
    },
    meaning: {
      zh: 'si 加过去完成虚拟式，主句复合条件式。',
      en: 'Past counterfactuals'
    },
    examples: [
      {
        text: 'Si hubiera estudiado, habría aprobado.',
        hl: 'Si hubiera estudiado',
        zh: '如果学习了，我就会通过。',
        en: 'If I had studied, I would have passed.'
      },
      {
        text: 'Si hubieras venido, te habrías divertido.',
        hl: 'Si hubieras venido',
        zh: '如果来了，你会玩得开心。',
        en: 'If you had come, you would have enjoyed yourself.'
      }
    ],
    group: 'counterfactual'
  },
  {
    id: 'es-probability',
    level: 'C1',
    name: {
      zh: '推测将来时',
      en: 'Future of probability'
    },
    form: {
      zh: '推测将来时',
      en: 'Future of probability'
    },
    meaning: {
      zh: '将来时可对现在推测。',
      en: 'Future of probability'
    },
    examples: [
      {
        text: 'Serán las ocho.',
        hl: 'Serán',
        zh: '大概八点了。',
        en: 'It must be about eight.'
      },
      {
        text: 'Estará en casa.',
        hl: 'Estará',
        zh: '他大概在家。',
        en: 'He is probably at home.'
      }
    ],
    group: 'probability'
  },
  {
    id: 'es-evaluation',
    level: 'C1',
    name: {
      zh: '否定评价',
      en: 'Negative evaluation'
    },
    form: {
      zh: '否定评价',
      en: 'Negative evaluation'
    },
    meaning: {
      zh: 'no es que 加虚拟式否定一种解释。',
      en: 'Negative evaluation'
    },
    examples: [
      {
        text: 'No es que no quiera ayudarte.',
        hl: 'No es que no quiera',
        zh: '不是我不想帮你。',
        en: 'It is not that I do not want to help you.'
      },
      {
        text: 'No es que sea imposible.',
        hl: 'No es que sea',
        zh: '并不是说这不可能。',
        en: 'It is not that it is impossible.'
      }
    ],
    group: 'evaluation'
  },
  {
    id: 'es-free-choice',
    level: 'C2',
    name: {
      zh: '泛指让步',
      en: 'Free-choice concession'
    },
    form: {
      zh: '泛指让步',
      en: 'Free-choice concession'
    },
    meaning: {
      zh: '重复虚拟式表达无论，训练语境立场。',
      en: 'Free-choice concession'
    },
    examples: [
      {
        text: 'Pase lo que pase, seguiremos.',
        hl: 'Pase lo que pase',
        zh: '无论发生什么，我们继续。',
        en: 'Whatever happens, we will continue.'
      },
      {
        text: 'Diga lo que diga, no cambiaré de opinión.',
        hl: 'Diga lo que diga',
        zh: '无论他说什么，我不会改观点。',
        en: 'Whatever he says, I will not change my mind.'
      }
    ],
    group: 'free-choice'
  },
  {
    id: 'es-literary',
    level: 'C2',
    name: {
      zh: '文学过去完成',
      en: 'Literary anterior tense'
    },
    form: {
      zh: '文学过去完成',
      en: 'Literary anterior tense'
    },
    meaning: {
      zh: 'hubo 加分词在文学时间从句表紧接另一过去事件前完成。',
      en: 'Literary anterior tense'
    },
    examples: [
      {
        text: 'Cuando hubo terminado, salió.',
        hl: 'hubo terminado',
        zh: '他一完成就出去了。',
        en: 'When he had finished, he went out.'
      },
      {
        text: 'Apenas hubo llegado, empezó a llover.',
        hl: 'hubo llegado',
        zh: '他刚到就下雨了。',
        en: 'Hardly had he arrived when it began to rain.'
      }
    ],
    group: 'literary'
  },
  {
    id: 'es-reportative',
    level: 'C2',
    name: {
      zh: '报道条件式',
      en: 'Reportative conditional'
    },
    form: {
      zh: '报道条件式',
      en: 'Reportative conditional'
    },
    meaning: {
      zh: '条件式报道标示未经确认，不能据此确认事实。',
      en: 'Reportative conditional'
    },
    examples: [
      {
        text: 'Según la prensa, el ministro habría dimitido.',
        hl: 'habría dimitido',
        zh: '据媒体报道，部长可能已辞职。',
        en: 'According to the press, the minister reportedly resigned.'
      },
      {
        text: 'El acuerdo se firmaría mañana, según fuentes oficiales.',
        hl: 'se firmaría',
        zh: '据官方消息，协议可能明天签署。',
        en: 'The agreement would reportedly be signed tomorrow, according to official sources.'
      }
    ],
    group: 'reportative'
  }
]
grammar.push(...additional)
for (const point of grammar) {
  const meaning = meanings[point.id.slice(3)]
  if (meaning) point.meaning.en = meaning
}
for (const point of grammar)
  point.patterns = point.examples.map((ex) =>
    rules.tokenize!(ex.hl!)
      .filter((t) => t.kind === 'word')
      .map((t) => ({ form: t.text }))
  )
