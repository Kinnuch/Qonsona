import { additional } from './additional'
import type { LexGrammarPoint } from '../types'
import { rules } from './rules'
import { meanings } from './meanings'
export const grammar: LexGrammarPoint[] = [
  {
    id: 'gd-vso',
    level: 'A1',
    name: {
      zh: '动词首位',
      en: 'Verb-first order'
    },
    form: {
      zh: '动词首位',
      en: 'Verb-first order'
    },
    meaning: {
      zh: '基本陈述是动词、主语、补语。',
      en: 'Verb-first order'
    },
    examples: [
      {
        text: 'Tha Màiri anns an sgoil.',
        hl: 'Tha Màiri',
        zh: '玛丽在学校。',
        en: 'Mary is at school.'
      },
      {
        text: 'Tha Iain aig an taigh.',
        hl: 'Tha Iain',
        zh: '伊恩在家。',
        en: 'John is at home.'
      }
    ],
    group: 'vso'
  },
  {
    id: 'gd-possession',
    level: 'A1',
    name: {
      zh: '拥有与介词代词',
      en: 'Possession with aig'
    },
    form: {
      zh: '拥有与介词代词',
      en: 'Possession with aig'
    },
    meaning: {
      zh: 'tha 加事物加 aig 人称形式表达拥有。',
      en: 'Possession with aig'
    },
    examples: [
      {
        text: 'Tha cù agam.',
        hl: 'agam',
        zh: '我有狗。',
        en: 'I have a dog.'
      },
      {
        text: 'Tha cat agad.',
        hl: 'agad',
        zh: '你有猫。',
        en: 'You have a cat.'
      }
    ],
    group: 'possession'
  },
  {
    id: 'gd-progressive',
    level: 'A1',
    name: {
      zh: '动名词进行体',
      en: 'Progressive'
    },
    form: {
      zh: '动名词进行体',
      en: 'Progressive'
    },
    meaning: {
      zh: 'tha 加主语加 a’ 或 ag 加动名词，元音前用 ag。',
      en: 'Progressive'
    },
    examples: [
      {
        text: 'Tha mi a’ bruidhinn.',
        hl: 'a’ bruidhinn',
        zh: '我正在说话。',
        en: 'I am speaking.'
      },
      {
        text: 'Tha i ag obair.',
        hl: 'ag obair',
        zh: '她正在工作。',
        en: 'She is working.'
      }
    ],
    group: 'progressive'
  },
  {
    id: 'gd-lenition',
    level: 'A2',
    name: {
      zh: '领属弱化',
      en: 'Possessive lenition'
    },
    form: {
      zh: '领属弱化',
      en: 'Possessive lenition'
    },
    meaning: {
      zh: 'mo 和 do 使可弱化辅音弱化，sg、sm、sp、st 不机械弱化。',
      en: 'Possessive lenition'
    },
    examples: [
      {
        text: 'Tha mo bhàta beag.',
        hl: 'mo bhàta',
        zh: '我的船很小。',
        en: 'My boat is small.'
      },
      {
        text: 'Tha do chù mòr.',
        hl: 'do chù',
        zh: '你的狗很大。',
        en: 'Your dog is big.'
      }
    ],
    group: 'lenition'
  },
  {
    id: 'gd-past',
    level: 'A2',
    name: {
      zh: '过去肯定与否定',
      en: 'Past forms'
    },
    form: {
      zh: '过去肯定与否定',
      en: 'Past forms'
    },
    meaning: {
      zh: 'tha 过去肯定 bha，否定 cha robh。',
      en: 'Past forms'
    },
    examples: [
      {
        text: 'Bha mi anns a’ bhaile.',
        hl: 'Bha mi',
        zh: '我当时在镇上。',
        en: 'I was in town.'
      },
      {
        text: 'Cha robh i aig an taigh.',
        hl: 'Cha robh',
        zh: '她当时不在家。',
        en: 'She was not at home.'
      }
    ],
    group: 'past'
  },
  {
    id: 'gd-question',
    level: 'A2',
    name: {
      zh: '疑问从属式',
      en: 'Dependent questions'
    },
    form: {
      zh: '疑问从属式',
      en: 'Dependent questions'
    },
    meaning: {
      zh: 'tha 疑问粒子后用 bheil，否定疑问用 nach eil。',
      en: 'Dependent questions'
    },
    examples: [
      {
        text: 'A bheil thu deiseil?',
        hl: 'A bheil',
        zh: '你准备好了吗？',
        en: 'Are you ready?'
      },
      {
        text: 'Nach eil e brèagha?',
        hl: 'Nach eil',
        zh: '它不是很漂亮吗？',
        en: 'Is it not beautiful?'
      }
    ],
    group: 'question'
  },
  {
    id: 'gd-future',
    level: 'B1',
    name: {
      zh: '将来独立从属式',
      en: 'Independent/dependent future'
    },
    form: {
      zh: '将来独立从属式',
      en: 'Independent/dependent future'
    },
    meaning: {
      zh: '独立 bidh，对应疑问和否定从属 bi。',
      en: 'Independent/dependent future'
    },
    examples: [
      {
        text: 'Bidh mi ann a-màireach.',
        hl: 'Bidh mi',
        zh: '我明天会在那里。',
        en: 'I will be there tomorrow.'
      },
      {
        text: 'Cha bhi mi fadalach.',
        hl: 'Cha bhi',
        zh: '我不会迟到。',
        en: 'I will not be late.'
      }
    ],
    group: 'future'
  },
  {
    id: 'gd-reported',
    level: 'B1',
    name: {
      zh: 'gu bheil 从句',
      en: 'Reported clauses'
    },
    form: {
      zh: 'gu bheil 从句',
      en: 'Reported clauses'
    },
    meaning: {
      zh: 'tha 在 gu 后用 bheil，否定从句用 nach eil。',
      en: 'Reported clauses'
    },
    examples: [
      {
        text: 'Tha mi a’ smaoineachadh gu bheil e ceart.',
        hl: 'gu bheil',
        zh: '我认为他是对的。',
        en: 'I think he is right.'
      },
      {
        text: 'Tha fios agam nach eil i an seo.',
        hl: 'nach eil',
        zh: '我知道她不在这里。',
        en: 'I know she is not here.'
      }
    ],
    group: 'reported'
  },
  {
    id: 'gd-comparison',
    level: 'B1',
    name: {
      zh: '比较级',
      en: 'Comparatives'
    },
    form: {
      zh: '比较级',
      en: 'Comparatives'
    },
    meaning: {
      zh: 'nas 加比较形式，math 与 mòr 有不规则形式。',
      en: 'Comparatives'
    },
    examples: [
      {
        text: 'Tha an taigh seo nas motha.',
        hl: 'nas motha',
        zh: '这房子更大。',
        en: 'This house is bigger.'
      },
      {
        text: 'Tha an leabhar seo nas fheàrr.',
        hl: 'nas fheàrr',
        zh: '这本书更好。',
        en: 'This book is better.'
      }
    ],
    group: 'comparison'
  },
  {
    id: 'gd-relative',
    level: 'B2',
    name: {
      zh: '关系从句',
      en: 'Relative clauses'
    },
    form: {
      zh: '关系从句',
      en: 'Relative clauses'
    },
    meaning: {
      zh: '直接关系形式 a tha 修饰名词，不能总用 gu bheil。',
      en: 'Relative clauses'
    },
    examples: [
      {
        text: 'An duine a tha aig an doras.',
        hl: 'a tha',
        zh: '在门边的人。',
        en: 'The person who is at the door.'
      },
      {
        text: 'An leabhar a tha air a’ bhòrd.',
        hl: 'a tha',
        zh: '桌上的书。',
        en: 'The book that is on the table.'
      }
    ],
    group: 'relative'
  },
  {
    id: 'gd-unless',
    level: 'B2',
    name: {
      zh: '除非 mura',
      en: 'Unless'
    },
    form: {
      zh: '除非 mura',
      en: 'Unless'
    },
    meaning: {
      zh: '否定条件 mura 与从属动词配合。',
      en: 'Unless'
    },
    examples: [
      {
        text: 'Mura bi e fliuch, thèid sinn a-mach.',
        hl: 'Mura bi',
        zh: '如果不下雨，我们出门。',
        en: 'Unless it is wet, we will go out.'
      },
      {
        text: 'Mura bi thu deiseil, fanaidh mi.',
        hl: 'Mura bi',
        zh: '如果你没准备好，我会等。',
        en: 'Unless you are ready, I will wait.'
      }
    ],
    group: 'unless'
  },
  {
    id: 'gd-perfect',
    level: 'B2',
    name: {
      zh: '完成 air',
      en: 'Perfect'
    },
    form: {
      zh: '完成 air',
      en: 'Perfect'
    },
    meaning: {
      zh: 'tha 加主语加 air 加动名词表达完成状态。',
      en: 'Perfect'
    },
    examples: [
      {
        text: 'Tha mi air ithe.',
        hl: 'air ithe',
        zh: '我已经吃过。',
        en: 'I have eaten.'
      },
      {
        text: 'Tha iad air falbh.',
        hl: 'air falbh',
        zh: '他们已经离开。',
        en: 'They have gone.'
      }
    ],
    group: 'perfect'
  },
  {
    id: 'gd-impersonal',
    level: 'C1',
    name: {
      zh: '无人称过去',
      en: 'Impersonal past'
    },
    form: {
      zh: '无人称过去',
      en: 'Impersonal past'
    },
    meaning: {
      zh: '结构突出事件，不必指明执行者。',
      en: 'Impersonal past'
    },
    examples: [
      {
        text: 'Chaidh an doras fhosgladh.',
        hl: 'Chaidh an doras fhosgladh',
        zh: '门被打开。',
        en: 'The door was opened.'
      },
      {
        text: 'Chaidh an taigh a thogail.',
        hl: 'Chaidh an taigh a thogail',
        zh: '房子建了起来。',
        en: 'The house was built.'
      }
    ],
    group: 'impersonal'
  },
  {
    id: 'gd-genitive',
    level: 'C1',
    name: {
      zh: '属格结构',
      en: 'Genitive'
    },
    form: {
      zh: '属格结构',
      en: 'Genitive'
    },
    meaning: {
      zh: '属格修饰名词；具体变形与冠词逐词核对。',
      en: 'Genitive'
    },
    examples: [
      {
        text: 'Tha doras na sgoile fosgailte.',
        hl: 'doras na sgoile',
        zh: '学校的门开着。',
        en: 'The school door is open.'
      },
      {
        text: 'Tha mullach an taighe ùr.',
        hl: 'mullach an taighe',
        zh: '屋顶是新的。',
        en: 'The roof of the house is new.'
      }
    ],
    group: 'genitive'
  },
  {
    id: 'gd-cleft',
    level: 'C1',
    name: {
      zh: '分裂句强调',
      en: 'Cleft emphasis'
    },
    form: {
      zh: '分裂句强调',
      en: 'Cleft emphasis'
    },
    meaning: {
      zh: '’s e ... a ... 突显信息。',
      en: 'Cleft emphasis'
    },
    examples: [
      {
        text: '’S e Màiri a tha an seo.',
        hl: '’S e Màiri',
        zh: '在这里的是玛丽。',
        en: 'It is Mary who is here.'
      },
      {
        text: '’S e Iain a tha aig an doras.',
        hl: '’S e Iain',
        zh: '门边的是伊恩。',
        en: 'It is John who is at the door.'
      }
    ],
    group: 'cleft'
  },
  {
    id: 'gd-consequence',
    level: 'C2',
    name: {
      zh: '篇章因果',
      en: 'Discourse consequence'
    },
    form: {
      zh: '篇章因果',
      en: 'Discourse consequence'
    },
    meaning: {
      zh: 'mar sin 连接结论；高级任务是长篇论证，不是短语罕见。',
      en: 'Discourse consequence'
    },
    examples: [
      {
        text: 'Bha e fliuch, mar sin, dh’fhuirich sinn a-staigh.',
        hl: 'mar sin',
        zh: '下雨了，因此我们留在室内。',
        en: 'It was wet, therefore, we stayed indoors.'
      },
      {
        text: 'Cha robh ùine againn, mar sin, dh’fhalbh sinn.',
        hl: 'mar sin',
        zh: '我们没时间，因此离开了。',
        en: 'We had no time, therefore, we left.'
      }
    ],
    group: 'consequence'
  },
  {
    id: 'gd-qualification',
    level: 'C2',
    name: {
      zh: '篇章对比',
      en: 'Argument qualification'
    },
    form: {
      zh: '篇章对比',
      en: 'Argument qualification'
    },
    meaning: {
      zh: 'air an làimh eile 提出另一面论点；训练篇章衔接。',
      en: 'Argument qualification'
    },
    examples: [
      {
        text: 'Tha e daor, air an làimh eile, tha e math.',
        hl: 'air an làimh eile',
        zh: '它贵，另一方面，它很好。',
        en: 'It is expensive, on the other hand, it is good.'
      },
      {
        text: 'Tha e beag, air an làimh eile, tha e brèagha.',
        hl: 'air an làimh eile',
        zh: '它小，另一方面，它漂亮。',
        en: 'It is small, on the other hand, it is beautiful.'
      }
    ],
    group: 'qualification'
  },
  {
    id: 'gd-focus',
    level: 'C2',
    name: {
      zh: '篇章对比焦点',
      en: 'Contrastive focus'
    },
    form: {
      zh: '篇章对比焦点',
      en: 'Contrastive focus'
    },
    meaning: {
      zh: 'mise/thusa 对比强调；形式可初级学，高级任务是篇章焦点。',
      en: 'Contrastive focus'
    },
    examples: [
      {
        text: 'Tha mise deiseil, ach chan eil esan deiseil.',
        hl: 'mise',
        zh: '我准备好了，但他没有。',
        en: 'I am ready, but he is not ready.'
      },
      {
        text: 'Tha thusa ceart, ach tha mise ceàrr.',
        hl: 'thusa',
        zh: '你对了，我错了。',
        en: 'You are right, but I am wrong.'
      }
    ],
    group: 'focus'
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
