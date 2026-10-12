import type { LexGrammarPoint, TokenTest } from '../types'
import { rules } from './rules'
import { extra } from './grammar-extra'
import { meanings } from './meanings'

// Original teaching examples. CEFR levels here are an editorial sequence, not an official grammar syllabus.
export type Row = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string
]
const rows: Row[] = [
  [
    'A1',
    'be',
    'be：身份与状态',
    'subject + am/is/are',
    'be 随主语变化；职业前通常加 a/an。',
    'I am a teacher.',
    'am a teacher',
    '我是一名教师。',
    'She is tired.',
    'is tired',
    '她累了。'
  ],
  [
    'A1',
    'articles',
    'a/an 与 the',
    'a/an + singular count noun; the + known noun',
    'a/an 首次引入可数单数；the 表示双方可识别的对象。an 按发音选择。',
    'I need an umbrella.',
    'an umbrella',
    '我需要一把伞。',
    'Please close the door.',
    'the door',
    '请关门。'
  ],
  [
    'A1',
    'present',
    '一般现在时',
    'subject + verb; third person singular + -s',
    '描述习惯与事实；第三人称单数要标记，疑问句由 do/does 承担变化。',
    'She works here.',
    'works',
    '她在这里工作。',
    'My brother studies French.',
    'studies',
    '我哥哥学习法语。'
  ],
  [
    'A1',
    'questions',
    'do/does 疑问',
    'Do/Does + subject + base verb?',
    '一般现在时实义动词问句用 do/does；动词还原原形。',
    'Do you like tea?',
    'Do you like',
    '你喜欢茶吗？',
    'Does she live here?',
    'Does she live',
    '她住在这里吗？'
  ],
  [
    'A1',
    'there',
    '存在句',
    'there + be + noun',
    '引入某处存在的对象；不可数名词用 is，复数用 are。',
    'There is a park nearby.',
    'There is',
    '附近有一个公园。',
    'There are two chairs.',
    'There are',
    '有两把椅子。'
  ],
  [
    'A1',
    'can',
    'can 表能力',
    'can + base verb',
    'can 后不用 to，所有人称不加 -s。',
    'I can swim.',
    'can swim',
    '我会游泳。',
    'She can help you.',
    'can help',
    '她能帮助你。'
  ],
  [
    'A2',
    'progressive',
    '现在进行时',
    'am/is/are + -ing',
    '表示当前或临时活动；多数状态动词不用进行时。',
    'I am cooking dinner.',
    'am cooking',
    '我正在做晚饭。',
    'They are waiting outside.',
    'are waiting',
    '他们正在外面等。'
  ],
  [
    'A2',
    'past',
    '一般过去时',
    'verb + -ed / irregular past',
    '已结束的过去事件；不规则形式须单独学习。',
    'We visited the museum yesterday.',
    'visited',
    '我们昨天参观了博物馆。',
    'She went home early.',
    'went',
    '她很早就回家了。'
  ],
  [
    'A2',
    'future',
    '计划：going to',
    'be + going to + base verb',
    '已有计划或眼前证据；区别即时决定常用的 will。',
    'I am going to study tonight.',
    'am going to study',
    '我打算今晚学习。',
    'It is going to rain.',
    'is going to rain',
    '快要下雨了。'
  ],
  [
    'A2',
    'comparison',
    '比较级与最高级',
    'comparative + than; the + superlative',
    '短形容词常用 -er/-est，长形容词常用 more/most；有不规则形式。',
    'This bag is cheaper than that one.',
    'cheaper than',
    '这个包比那个便宜。',
    'It is the most useful book here.',
    'the most useful',
    '这是这里最有用的书。'
  ],
  [
    'A2',
    'quantity',
    '可数性与数量',
    'much + uncountable; many + plural',
    'much 不可数，many 可数复数；a little/a few 表少量且仍有。',
    'We do not have much time.',
    'much time',
    '我们没有很多时间。',
    'There are a few apples left.',
    'a few apples',
    '还剩几个苹果。'
  ],
  [
    'A2',
    'obligation',
    '义务与禁止',
    'have to / must / must not',
    'must not 是禁止；do not have to 是不必，不能互换。',
    'You must wear a helmet.',
    'must wear',
    '你必须戴头盔。',
    'You do not have to come.',
    'do not have to come',
    '你不必来。'
  ],
  [
    'B1',
    'perfect',
    '现在完成时',
    'have/has + past participle',
    '连接过去与现在；已结束的明确过去时间通常用一般过去时。',
    'I have lost my keys.',
    'have lost',
    '我把钥匙弄丢了。',
    'She has lived here for years.',
    'has lived',
    '她已在这里住了多年。'
  ],
  [
    'B1',
    'conditional',
    '第一与第二条件句',
    'if + present, will; if + past, would',
    '第一条件句谈可能将来；第二条件句谈假设，与过去时间不必有关。',
    'If it rains, we will stay home.',
    'If it rains',
    '如果下雨，我们会待在家里。',
    'If I had more time, I would travel.',
    'If I had more time',
    '如果我有更多时间，我会去旅行。'
  ],
  [
    'B1',
    'relative',
    '限定性关系从句',
    'noun + who/which/that + clause',
    '修饰并识别名词；作宾语的关系代词有时可以省略。',
    'The woman who lives next door is a doctor.',
    'who lives next door',
    '住在隔壁的女士是一位医生。',
    'This is the book that I bought.',
    'that I bought',
    '这是我买的书。'
  ],
  [
    'B1',
    'passive',
    '被动语态',
    'be + past participle',
    '关注动作接受者；只有及物用法可以形成对应被动。',
    'The bridge was built in 1990.',
    'was built',
    '这座桥建于1990年。',
    'English is spoken here.',
    'is spoken',
    '这里讲英语。'
  ],
  [
    'B1',
    'reported',
    '间接引语',
    'said + clause; asked + embedded question',
    '间接问句用陈述语序；时态与指示词按转述语境调整。',
    'She said that she was busy.',
    'said that she was busy',
    '她说她很忙。',
    'He asked where I lived.',
    'asked where I lived',
    '他问我住在哪里。'
  ],
  [
    'B1',
    'used-to',
    'used to 与习惯',
    'used to + base verb',
    '表示过去常常如此而现在通常已改变；be used to + 名词/-ing 是习惯于。',
    'I used to live by the sea.',
    'used to live',
    '我以前住在海边。',
    'She used to cycle to work.',
    'used to cycle',
    '她过去骑车上班。'
  ],
  [
    'B2',
    'past-perfect',
    '过去完成时',
    'had + past participle',
    '在过去参照点之前完成；不要对所有过去事件机械使用。',
    'The train had left when we arrived.',
    'had left',
    '我们到达时火车已开走。',
    'I had never seen snow before that trip.',
    'had never seen',
    '那次旅行前我从未见过雪。'
  ],
  [
    'B2',
    'third-conditional',
    '第三条件句',
    'if + past perfect, would have + participle',
    '对已发生过去的反事实条件与结果。',
    'If I had known, I would have helped.',
    'If I had known',
    '如果我早知道，我会帮忙的。',
    'If we had left earlier, we would have arrived on time.',
    'If we had left earlier',
    '如果我们早出发，就会准时到达。'
  ],
  [
    'B2',
    'deduction',
    '情态推断',
    'must/might/cannot + infinitive; have + participle',
    '推断的 must 不表示义务；过去推断用 have + 过去分词。',
    'She must have forgotten the meeting.',
    'must have forgotten',
    '她一定忘了会议。',
    'He might be at home.',
    'might be',
    '他可能在家。'
  ],
  [
    'B2',
    'participle',
    '分词状语',
    '-ing / past participle clause',
    '分词逻辑主语通常须与主句主语一致，避免悬垂结构。',
    'Feeling tired, I went home.',
    'Feeling tired',
    '感到疲惫，我回家了。',
    'Built in stone, the house stays cool.',
    'Built in stone',
    '这座石头建的房子保持凉爽。'
  ],
  [
    'B2',
    'gerund',
    '动名词与不定式',
    'stop/remember + -ing / to-infinitive',
    'stop doing 是停止这项动作；stop to do 是停下别的事去做。',
    'She stopped smoking last year.',
    'stopped smoking',
    '她去年戒烟了。',
    'We stopped to buy some water.',
    'stopped to buy',
    '我们停下来买水。'
  ],
  [
    'B2',
    'wish',
    'wish 与非真实愿望',
    'wish + past / past perfect',
    'past 表当前非真实愿望；past perfect 表过去遗憾。',
    'I wish I knew the answer.',
    'wish I knew',
    '我希望自己知道答案。',
    'She wishes she had studied harder.',
    'wishes she had studied',
    '她希望自己当初学习更努力。'
  ],
  [
    'C1',
    'inversion',
    '否定前置倒装',
    'negative adverb + auxiliary + subject',
    '用于正式或强调语体；倒装发生在限定动词的助动词处。',
    'Never have I seen such a view.',
    'Never have I',
    '我从未见过这样的景色。',
    'Rarely does she miss a deadline.',
    'Rarely does she',
    '她极少错过截止日期。'
  ],
  [
    'C1',
    'cleft',
    '分裂句焦点',
    'It is/was X that...; What... is...',
    '把信息焦点突出；不是每个 it + be 句都是分裂句。',
    'It was Anna who solved the problem.',
    'It was Anna who',
    '解决问题的是安娜。',
    'What I need is a quiet room.',
    'What I need is',
    '我需要的是一间安静的房间。'
  ],
  [
    'C1',
    'hedging',
    '学术缓和表达',
    'appear/seem + to; may suggest',
    '根据证据限制结论强度，区分推断与事实。',
    'The results appear to support the claim.',
    'appear to support',
    '结果似乎支持这一论点。',
    'This may suggest a change in behaviour.',
    'may suggest',
    '这可能表明行为发生了变化。'
  ],
  [
    'C1',
    'perfect-progressive',
    '完成进行时',
    'have/had + been + -ing',
    '强调延续的过程；完成时与完成进行时在完成结果和过程焦点上不同。',
    'We have been waiting for an hour.',
    'have been waiting',
    '我们已经等了一个小时。',
    'She had been working all night.',
    'had been working',
    '她此前一直工作了一整夜。'
  ],
  [
    'C1',
    'concession',
    '让步与论证',
    'however + adjective; even if + clause',
    '区分事实让步 even though 与假设让步 even if。',
    'However difficult it is, we must try.',
    'However difficult',
    '无论多难，我们都必须尝试。',
    'Even if the plan fails, we will learn something.',
    'Even if the plan fails',
    '即使计划失败，我们也会有所收获。'
  ],
  [
    'C1',
    'mandative',
    '要求型虚拟式',
    'recommend/insist + that + base verb',
    '正式语体尤其美式英语用原形；英式也常用 should。',
    'I recommend that he be informed.',
    'recommend that he be informed',
    '我建议通知他。',
    'They insisted that she remain silent.',
    'insisted that she remain silent',
    '他们坚持要求她保持沉默。'
  ],
  [
    'C2',
    'conditional-inversion',
    '省略 if 的条件倒装',
    'Had/Were/Should + subject',
    '正式条件句；只适用于特定结构，不能任意把实义动词倒装。',
    'Had I known, I would have acted differently.',
    'Had I known',
    '如果我早知道，就会采取不同的行动。',
    'Were it possible, we would postpone the vote.',
    'Were it possible',
    '如果可能，我们会推迟投票。'
  ],
  [
    'C2',
    'modal-perfect-passive',
    '情态完成被动',
    'modal + have been + participle',
    '叠加情态判断、完成时间与被动视角。',
    'The error could have been avoided.',
    'could have been avoided',
    '这个错误本可以避免。',
    'The documents must have been destroyed.',
    'must have been destroyed',
    '那些文件一定已被销毁。'
  ],
  [
    'C2',
    'ellipsis',
    '省略与替代',
    'auxiliary substitution; so/not',
    '依靠上下文恢复省略内容；保留正确的助动词、时态与极性。',
    'She can speak Arabic, and so can I.',
    'so can I',
    '她会讲阿拉伯语，我也会。',
    'I hoped he would come, but he did not.',
    'he did not',
    '我希望他会来，但他没来。'
  ],
  [
    'C2',
    'fronting',
    '宾语前置',
    'object + subject + verb',
    '强调或衔接已知信息；宾语前置本身通常不要求助动词倒装。',
    'That argument I cannot accept.',
    'That argument I cannot accept',
    '那个论点我无法接受。',
    'This much we can promise.',
    'This much we can promise',
    '这一点我们可以保证。'
  ],
  [
    'C2',
    'counterfactual',
    '混合条件句',
    'if + past perfect, would + base verb',
    '过去条件与现在结果，或现在状态与过去结果须按真实时间关系选择。',
    'If I had accepted the job, I would be abroad now.',
    'If I had accepted the job',
    '如果我接受了那份工作，现在就会在国外。',
    'If she were more careful, she would not have made that mistake.',
    'If she were more careful',
    '如果她更细心，就不会犯那个错误。'
  ],
  [
    'C2',
    'discourse',
    '书面语篇衔接',
    'notwithstanding; insofar as',
    '表达保留、限度与对照；正式语域不应机械替换日常词语。',
    'Notwithstanding these objections, the proposal was approved.',
    'Notwithstanding these objections',
    '尽管有这些异议，提案仍获通过。',
    'The rule applies insofar as it protects privacy.',
    'insofar as it protects privacy',
    '这项规则在保护隐私的范围内适用。'
  ]
]
rows.push(...extra)

/** Fixed exemplars are deliberately conservative; productive morphology patterns below need dictionary tags. */
export const grammar: LexGrammarPoint[] = rows.map(
  ([level, id, name, form, meaning, a, ah, az, b, bh, bz]) => ({
    id: `en-${id}`,
    level,
    name: { zh: name, en: id.replaceAll('-', ' ') },
    form: { zh: form, en: form },
    meaning: { zh: meaning, en: meanings[id] },
    notes: { zh: meaning, en: meanings[id] },
    group: id,
    examples: [
      { text: a, hl: ah, zh: az, en: a },
      { text: b, hl: bh, zh: bz, en: b }
    ],
    patterns: [ah, bh].map((h) =>
      rules.tokenize!(h)
        .filter((t) => t.kind === 'word' || t.kind === 'num')
        .map((t) => ({ form: t.text }))
    )
  })
)
const productive: Record<string, TokenTest[][]> = {
  'en-perfect': [
    [{ form: ['have', 'has'] }, { tags: ['past', 'participle'], pos: 'verb', gap: 1 }]
  ],
  'en-past-perfect': [[{ form: 'had' }, { tags: ['past', 'participle'], pos: 'verb', gap: 1 }]],
  'en-progressive': [
    [{ form: ['am', 'is', 'are'] }, { tags: ['present', 'participle'], pos: 'verb', gap: 1 }]
  ],
  'en-used-to': [[{ form: 'used' }, { form: 'to' }, { pos: 'verb', not: { tags: ['past'] } }]],
  'en-perfect-progressive': [
    [
      { form: ['have', 'has', 'had'] },
      { form: 'been' },
      { tags: ['present', 'participle'], pos: 'verb' }
    ]
  ]
}
for (const point of grammar) if (productive[point.id]) point.patterns!.push(...productive[point.id])
