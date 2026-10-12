import type { Course, FormItem, PhraseItem, SymbolItem } from '../../course'
import { grammar } from './grammar'
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const phonics = [
  ['a', 'a', '/a/', 'chat, papa, sac', '元音 /a/；字母名与词中发音分开练。'],
  ['i', 'i', '/i/', 'lit, midi, vite', '/i/ 常较稳定。'],
  ['ou', 'ou', '/u/', 'vous, rouge, jour', '与 u /y/ 对比。'],
  ['u', 'u', '/y/', 'tu, rue, lune', '舌位接近 /i/ 但圆唇，不是 ou /u/。'],
  ['eau', 'eau', '/o/', 'eau, beau, bateau', 'eau 通常 /o/；au 同类，但逐词核对。'],
  ['oi', 'oi', '/wa/', 'moi, trois, soir', '不是分别读 o 和 i。'],
  ['ai', 'ai', '/ɛ/', 'lait, mais, maison', '有口音与形态差异；j’ai 常读 /e/。'],
  ['eu', 'eu', '/ø/', 'deux, feu, peu', '开音节常 /ø/；peur 的 eu 是 /œ/。'],
  ['an', 'an', '/ɑ̃/', 'dans, sans, grand', '鼻元音；不要机械加 /n/，后接元音或双写辅音时不同。'],
  ['on', 'on', '/ɔ̃/', 'bon, nom, pont', '鼻元音，与 an 的舌位和圆唇区分。'],
  ['in', 'in', '/ɛ̃/', 'vin, pain, matin', 'in/ain/ein 可能同音；不是口元音加 /n/。'],
  ['ch', 'ch', '/ʃ/', 'chat, chercher, chocolat', '通常 /ʃ/，技术外来词有例外。'],
  ['gn', 'gn', '/ɲ/', 'montagne, ligne, gagner', '腭鼻音；不要分别读 g+n。'],
  ['é', 'é', '/e/', 'été, café, bébé', '重音符号参与拼写；与 è /ɛ/ 对比。'],
  ['è', 'è', '/ɛ/', 'père, mère, très', '开 /ɛ/，重音符号不能随意省略。'],
  [
    'liaison',
    's‿',
    '/z/',
    'les amis, vous avez, deux enfants',
    '连诵依词法句法而定；嘘音 h 前禁止。仅用整组词录音练习。'
  ],
  ['elision', 'l’', '/l/', 'l’école, l’ami, l’eau', '元音或哑音 h 前省音；嘘音 h 前通常不省音。'],
  [
    'ending',
    '-ent',
    'silent',
    'parlent, aiment, regardent',
    '第三人称复数动词词尾 -ent 不发音；不能推广到 lent 等词。'
  ]
]
type FormRow = [string, string, string, string, string, string[]][]
const rows: FormRow = [
  ['A1', 'er-nous', '直陈式现在时，nous', 'parler', 'parlons', ['parlez', 'parlent', 'parlont']],
  ['A1', 'er-nous', '直陈式现在时，nous', 'aimer', 'aimons', ['aimez', 'aiment', 'aimont']],
  [
    'A1',
    'er-nous',
    '直陈式现在时，nous',
    'regarder',
    'regardons',
    ['regardez', 'regardent', 'regardont']
  ],
  ['A1', 'feminine', '形容词阴性单数', 'petit', 'petite', ['petit', 'petites', 'petits']],
  ['A1', 'feminine', '形容词阴性单数', 'grand', 'grande', ['grand', 'grandes', 'grands']],
  ['A1', 'feminine', '形容词阴性单数', 'heureux', 'heureuse', ['heureuxe', 'heureuses', 'heureux']],
  [
    'A2',
    'passe',
    '复合过去时，elle',
    'arriver',
    'est arrivée',
    ['a arrivé', 'est arrivé', 'est arriver']
  ],
  [
    'A2',
    'passe',
    '复合过去时，elle',
    'partir',
    'est partie',
    ['a parti', 'est parti', 'est partir']
  ],
  ['A2', 'passe', '复合过去时，elle', 'finir', 'a fini', ['est fini', 'a finir', 'a finit']],
  [
    'A2',
    'imparfait',
    '未完成过去时，nous',
    'parler',
    'parlions',
    ['parlons', 'parliez', 'parlais']
  ],
  ['A2', 'imparfait', '未完成过去时，nous', 'être', 'étions', ['sommes', 'étaient', 'étiez']],
  ['A2', 'imparfait', '未完成过去时，nous', 'avoir', 'avions', ['avons', 'avaient', 'aviez']],
  ['B1', 'future', '简单将来时，je', 'aller', 'irai', ['allerai', 'vais', 'irais']],
  ['B1', 'future', '简单将来时，je', 'être', 'serai', ['êtreai', 'suis', 'serais']],
  ['B1', 'future', '简单将来时，je', 'avoir', 'aurai', ['avoirai', 'ai', 'aurais']],
  ['B1', 'subjunctive', '虚拟式现在时，il', 'être', 'soit', ['est', 'sera', 'sois']],
  ['B1', 'subjunctive', '虚拟式现在时，il', 'avoir', 'ait', ['a', 'aura', 'aie']],
  ['B1', 'subjunctive', '虚拟式现在时，il', 'venir', 'vienne', ['vient', 'viendra', 'viennes']],
  [
    'B2',
    'conditionnel-passe',
    '条件式过去时，elle',
    'venir',
    'serait venue',
    ['aurait venu', 'serait venu', 'serait venir']
  ],
  [
    'B2',
    'conditionnel-passe',
    '条件式过去时，elle',
    'partir',
    'serait partie',
    ['aurait parti', 'serait parti', 'serait partir']
  ],
  [
    'B2',
    'conditionnel-passe',
    '条件式过去时，elle',
    'faire',
    'aurait fait',
    ['serait fait', 'aurait fais', 'aurait faire']
  ],
  [
    'B2',
    'preceding-cod',
    'avoir 过去分词，前置宾语 les lettres',
    'écrire',
    'écrites',
    ['écrit', 'écrits', 'écrite']
  ],
  [
    'B2',
    'preceding-cod',
    'avoir 过去分词，前置宾语 les chansons',
    'entendre',
    'entendues',
    ['entendu', 'entendus', 'entendue']
  ],
  [
    'B2',
    'preceding-cod',
    'avoir 过去分词，前置宾语 les histoires',
    'raconter',
    'racontées',
    ['raconté', 'racontés', 'racontée']
  ],
  ['C1', 'passe-simple', '简单过去时，il', 'ouvrir', 'ouvrit', ['ouvre', 'ouvra', 'ouvrait']],
  ['C1', 'passe-simple', '简单过去时，il', 'prendre', 'prit', ['prend', 'prena', 'prenait']],
  ['C1', 'passe-simple', '简单过去时，il', 'venir', 'vint', ['vient', 'vena', 'venait']],
  [
    'C1',
    'subj-past',
    '虚拟式过去时，elle',
    'réussir',
    'ait réussi',
    ['a réussi', 'soit réussi', 'ait réussie']
  ],
  [
    'C1',
    'subj-past',
    '虚拟式过去时，elle',
    'partir',
    'soit partie',
    ['ait parti', 'soit parti', 'est partie']
  ],
  [
    'C1',
    'subj-past',
    '虚拟式过去时，elle',
    'arriver',
    'soit arrivée',
    ['ait arrivé', 'soit arrivé', 'est arrivée']
  ],
  ['C2', 'subj-imperfect', '文学虚拟式未完成过去时，il', 'être', 'fût', ['fut', 'soit', 'était']],
  [
    'C2',
    'subj-imperfect',
    '文学虚拟式未完成过去时，il',
    'venir',
    'vînt',
    ['vint', 'vienne', 'venait']
  ],
  ['C2', 'subj-imperfect', '文学虚拟式未完成过去时，il', 'avoir', 'eût', ['eut', 'ait', 'avait']],
  [
    'C2',
    'subj-pluperfect',
    '文学虚拟式愈过去时，elle',
    'partir',
    'fût partie',
    ['fut partie', 'eût parti', 'fût parti']
  ],
  [
    'C2',
    'subj-pluperfect',
    '文学虚拟式愈过去时，elle',
    'venir',
    'fût venue',
    ['fut venue', 'eût venu', 'fût venu']
  ],
  [
    'C2',
    'subj-pluperfect',
    '文学虚拟式愈过去时，elle',
    'finir',
    'eût fini',
    ['eut fini', 'fût fini', 'eût finir']
  ]
]
export const forms: Record<string, FormItem> = {}
export const formLevels: Record<string, string> = {}
for (const [level, id, title, base, form, wrong] of rows) {
  const key = `fr-${id}`
  forms[key] ??= { key, title: { zh: title, en: `${id}: ${title}` }, examples: [] }
  forms[key].examples.push({ base, form, wrong, say: { text: form, lang: 'fr-FR' } })
  formLevels[key] = level
}
const phraseRows = [
  ['A1', 'Bonjour, je m’appelle Mei.', '你好，我叫梅。', 'Hello, my name is Mei.'],
  [
    'A1',
    'Pouvez-vous répéter, s’il vous plaît ?',
    '请再说一遍好吗？',
    'Could you repeat that, please?'
  ],
  ['A1', 'Combien ça coûte ?', '这个多少钱？', 'How much does it cost?'],
  ['A1', 'Où est la gare ?', '车站在哪里？', 'Where is the station?'],
  ['A2', 'Je voudrais une table pour deux.', '我想要一张两人桌。', 'I would like a table for two.'],
  ['A2', 'L’addition, s’il vous plaît.', '请给我账单。', 'The bill, please.'],
  ['A2', 'J’ai réservé au nom de Chen.', '我以陈这个名字预订了。', 'I booked under the name Chen.'],
  [
    'A2',
    'J’ai mal à la tête depuis hier.',
    '从昨天起我就头疼。',
    'I have had a headache since yesterday.'
  ],
  [
    'B1',
    'Pourriez-vous m’indiquer le chemin de la bibliothèque ?',
    '您能告诉我怎么去图书馆吗？',
    'Could you tell me the way to the library?'
  ],
  [
    'B1',
    'Je voudrais déplacer mon rendez-vous.',
    '我想更改预约。',
    'I would like to reschedule my appointment.'
  ],
  [
    'B1',
    'Si j’étais vous, je demanderais de l’aide.',
    '如果我是您，我会求助。',
    'If I were you, I would ask for help.'
  ],
  [
    'B1',
    'Pouvez-vous parler un peu plus lentement ?',
    '您能说慢一点吗？',
    'Could you speak a little more slowly?'
  ],
  [
    'B2',
    'Je comprends votre point de vue, mais j’ai des réserves.',
    '我理解您的观点，但有所保留。',
    'I understand your view, but I have reservations.'
  ],
  [
    'B2',
    'Pourriez-vous préciser ce que vous entendez par là ?',
    '您能解释一下这是什么意思吗？',
    'Could you clarify what you mean by that?'
  ],
  [
    'B2',
    'Je souhaite faire une réclamation.',
    '我想提出投诉。',
    'I would like to make a complaint.'
  ],
  [
    'B2',
    'Examinons les avantages et les inconvénients.',
    '让我们考察利弊。',
    'Let us examine the advantages and drawbacks.'
  ],
  [
    'C1',
    'Ces résultats doivent être interprétés avec prudence.',
    '应谨慎解释这些结果。',
    'These results must be interpreted with caution.'
  ],
  [
    'C1',
    'Vos remarques sur cette proposition seraient les bienvenues.',
    '欢迎您对这项提议提出意见。',
    'Your comments on this proposal would be welcome.'
  ],
  [
    'C1',
    'Permettez-moi de résumer les points d’accord.',
    '请允许我总结共识。',
    'Allow me to summarise the points of agreement.'
  ],
  [
    'C1',
    'Cette conclusion repose sur une hypothèse non vérifiée.',
    '这一结论基于未经验证的假设。',
    'This conclusion rests on an untested assumption.'
  ],
  [
    'C2',
    'Cette distinction mérite toutefois d’être nuancée.',
    '不过，这一区别值得进一步细化。',
    'This distinction nevertheless needs qualification.'
  ],
  [
    'C2',
    'Sauf votre respect, cela ne découle pas des faits.',
    '恕我直言，这无法由事实推出。',
    'With respect, that does not follow from the facts.'
  ],
  [
    'C2',
    'Gardons-nous de confondre corrélation et causalité.',
    '我们应避免混淆相关与因果。',
    'Let us avoid confusing correlation and causation.'
  ],
  [
    'C2',
    'Revenons au postulat avant d’en discuter les conséquences.',
    '讨论其后果前，让我们重新审视前提。',
    'Let us revisit the premise before discussing its consequences.'
  ]
]
const idiomRows = [
  ['A1', 'À bientôt !', '回头见！', 'See you soon!'],
  ['A1', 'Bien sûr.', '当然。', 'Of course.'],
  ['A2', 'Ça marche.', '行，没问题。', 'That works.'],
  ['A2', 'Prenez votre temps.', '慢慢来。', 'Take your time.'],
  ['B1', 'Cela vaut le coup.', '这值得。', 'It is worth it.'],
  [
    'B1',
    'J’ai un coup de main à vous demander.',
    '我有件事想请您帮忙。',
    'I need to ask you for a hand.'
  ],
  [
    'B2',
    'Nous sommes sur la même longueur d’onde.',
    '我们的想法一致。',
    'We are on the same wavelength.'
  ],
  ['B2', 'Mettons les choses au clair.', '让我们把事情说清楚。', 'Let us clear things up.'],
  [
    'C1',
    'Il faut prendre cette affirmation avec des pincettes.',
    '对这一说法应持保留态度。',
    'That claim should be treated cautiously.'
  ],
  ['C1', 'Le projet est encore en suspens.', '项目仍悬而未决。', 'The project is still pending.'],
  ['C2', 'L’accord ne tient qu’à un fil.', '协议岌岌可危。', 'The agreement hangs by a thread.'],
  [
    'C2',
    'Il cherche midi à quatorze heures.',
    '他把简单的事情复杂化。',
    'He is making things unnecessarily complicated.'
  ]
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
    zh: '法语拼读、鼻元音与连诵',
    en: 'French spelling, nasal vowels and liaison'
  })
  alphabet.intro = {
    zh: '重音符号、鼻元音、静音词尾与连诵分别学；先听整词录音，孤立字母 TTS 不作为音位示范。',
    en: 'Learn accents, nasal vowels, silent endings and liaison in context; isolated-letter TTS is not a phoneme model.'
  }
  alphabet.units = [
    {
      id: 'phonics',
      title: { zh: '字音规律', en: 'Spelling and sound' },
      test: true,
      lessons: phonics.map(([key, symbol, reading, words, note]) => {
        const item: SymbolItem = {
          key,
          symbol,
          reading,
          ipa: reading === 'silent' ? undefined : reading,
          typeable: false,
          learnOnly: false,
          say: null,
          note: {
            zh: note,
            en: `Examples: ${words}. Check dictionary IPA and recordings; account for exceptions.`
          }
        }
        alphabet.symbols[key] = item
        return { id: key, title: symbol, items: [key], words: words.split(', '), note: item.note }
      })
    }
  ]
  const gc = empty('grammar', 'grammar', { zh: '法语分级语法', en: 'French grammar by level' })
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
    zh: '法语变位与性数配合',
    en: 'French conjugation and agreement'
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
        .map(([, text, zh, en], i) => {
          const key = `fr-${id}-${level}-${i}`
          const p: PhraseItem = { key, text, meaning: { zh, en }, say: { text, lang: 'fr-FR' } }
          c.phrases![key] = p
          return { id: key, title: text, items: [key] }
        })
    }))
    return c
  }
  const stories = empty('stories', 'texts', { zh: '法语分级阅读', en: 'French graded reading' })
  stories.texts = {}
  stories.units = LEVELS.map((level) => {
    const key = `fr-reading-${level}`
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
            zh: '自编短文，教学分级尚待实库词频复核。',
            en: 'Original graded text; editorial placement pending lexical profiling.'
          }
        }
      ]
    }
  })
  return prepareCourses([
    alphabet,
    gc,
    inf,
    phrases('phrasebook', { zh: '法语会话', en: 'French conversations' }, phraseRows),
    phrases('idioms', { zh: '法语惯用表达', en: 'French idiomatic expressions' }, idiomRows),
    stories
  ])
}
export const readingTitles: Record<string, string> = {
  A1: 'Une journée à la maison',
  A2: 'Un changement de programme',
  B1: 'Une bibliothèque pour tous',
  B2: 'Repenser les trajets quotidiens',
  C1: 'Les preuves et les décisions publiques',
  C2: 'Les limites d’une métaphore utile'
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
