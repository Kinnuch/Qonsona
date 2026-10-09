/**
 * 日语词形还原：把变过形的动词、形容词一步步还原成原形，查词典用。
 * 食べさせられなかった → 食べさせられない → 食べさせられる → 食べさせる → 食べる
 *
 * 每条规则：词尾 from 换成 to；这个词尾本身按什么变（in，比如「ない」按い形容词变，
 * 所以「なかった」先还原成「ない」再往下还原）；还原出来的是什么类的词（out）。
 * 最后查到的词条词性要跟 out 对得上（v1 只配一段动词……），不然是误还原。
 */

/** vs-n：带「する」的名词（勉強する → 勉強），JMdict 里标 vs */
export type WordType = 'v1' | 'v5' | 'vk' | 'vs' | 'vs-n' | 'adj-i' | 'masu' | 'te'

export interface Rule {
  from: string
  to: string
  /** 这个词尾自己按哪类变（空表示不再变，只能出现在词的最末尾） */
  in: WordType[]
  out: WordType
  /** 变形名（界面上显示「过去」「否定」……），见 REASONS */
  reason: string
}

export interface Deinflection {
  word: string
  /** null 是用户输入的原样 */
  type: WordType | null
  /** 从原形到输入依次经过的变形 */
  reasons: string[]
}

/** 界面上显示的变形名 */
export const REASONS: Record<string, { zh: string; en: string }> = {
  past: { zh: '过去', en: 'past' },
  te: { zh: 'て形', en: 'te-form' },
  negative: { zh: '否定', en: 'negative' },
  polite: { zh: '礼貌体', en: 'polite' },
  'polite-past': { zh: '礼貌体过去', en: 'polite past' },
  'polite-negative': { zh: '礼貌体否定', en: 'polite negative' },
  'polite-volitional': { zh: '礼貌体意志', en: 'polite volitional' },
  potential: { zh: '可能', en: 'potential' },
  passive: { zh: '被动', en: 'passive' },
  'potential-passive': { zh: '可能 / 被动 / 尊敬', en: 'potential / passive / honorific' },
  causative: { zh: '使役', en: 'causative' },
  volitional: { zh: '意志', en: 'volitional' },
  imperative: { zh: '命令', en: 'imperative' },
  conditional: { zh: '假定（ば）', en: 'conditional (ba)' },
  tara: { zh: '假定（たら）', en: 'conditional (tara)' },
  tari: { zh: '列举（たり）', en: '-tari' },
  want: { zh: '愿望（たい）', en: 'want (tai)' },
  while: { zh: '一边（ながら）', en: 'while (nagara)' },
  looks: { zh: '样态（そう）', en: 'looks like (sou)' },
  too: { zh: '过度（すぎる）', en: 'too much (sugiru)' },
  command: { zh: '命令（なさい）', en: 'command (nasai)' },
  zu: { zh: '否定（ず）', en: 'negative (zu)' },
  adv: { zh: '副词形（く）', en: 'adverbial (ku)' },
  noun: { zh: '名词化（さ）', en: 'noun (sa)' },
  become: { zh: '变化（くなる）', en: 'become (ku naru)' },
  progressive: { zh: '进行 / 状态（ている）', en: 'progressive (te iru)' },
  prepare: { zh: '预先（ておく）', en: 'in advance (te oku)' },
  finish: { zh: '完了（てしまう）', en: 'completely (te shimau)' },
  try: { zh: '尝试（てみる）', en: 'try (te miru)' },
  'without-doing': { zh: '不……就（ないで）', en: 'without doing (naide)' },
  suru: { zh: '＋する', en: '+ suru' }
}

// 五段动词：原形词尾 / あ段 / い段 / え段 / お段 / て形 / た形
const GODAN: [string, string, string, string, string, string, string][] = [
  ['う', 'わ', 'い', 'え', 'お', 'って', 'った'],
  ['く', 'か', 'き', 'け', 'こ', 'いて', 'いた'],
  ['ぐ', 'が', 'ぎ', 'げ', 'ご', 'いで', 'いだ'],
  ['す', 'さ', 'し', 'せ', 'そ', 'して', 'した'],
  ['つ', 'た', 'ち', 'て', 'と', 'って', 'った'],
  ['ぬ', 'な', 'に', 'ね', 'の', 'んで', 'んだ'],
  ['ぶ', 'ば', 'び', 'べ', 'ぼ', 'んで', 'んだ'],
  ['む', 'ま', 'み', 'め', 'も', 'んで', 'んだ'],
  ['る', 'ら', 'り', 'れ', 'ろ', 'って', 'った']
]

function build(): Rule[] {
  const R: Rule[] = []
  const add = (from: string, to: string, inT: WordType[], out: WordType, reason: string): void => {
    R.push({ from, to, in: inT, out, reason })
  }
  /** 一种动词的整套变形：stems 是各个活用形（未然、连用、假定、命令、意志、て、た），out 是动词类 */
  const verb = (
    base: string,
    out: WordType,
    f: {
      neg: string[]
      masu: string[]
      cond: string[]
      imp: string[]
      vol: string[]
      te: string[]
      ta: string[]
      pot: string[]
      pass: string[]
      caus: string[]
    }
  ): void => {
    for (const x of f.neg) {
      add(x + 'ない', base, ['adj-i'], out, 'negative')
      add(x + 'ず', base, [], out, 'zu')
      add(x + 'ないで', base, [], out, 'without-doing')
    }
    for (const x of f.masu) {
      add(x + 'ます', base, ['masu'], out, 'polite')
      add(x + 'たい', base, ['adj-i'], out, 'want')
      add(x + 'ながら', base, [], out, 'while')
      add(x + 'そう', base, [], out, 'looks')
      add(x + 'すぎる', base, ['v1'], out, 'too')
      add(x + 'なさい', base, [], out, 'command')
    }
    for (const x of f.cond) add(x + 'ば', base, [], out, 'conditional')
    for (const x of f.imp) add(x, base, [], out, 'imperative')
    for (const x of f.vol) add(x, base, [], out, 'volitional')
    for (const x of f.te) add(x, base, ['te'], out, 'te')
    for (const x of f.ta) {
      add(x, base, [], out, 'past')
      add(x + 'ら', base, [], out, 'tara')
      add(x + 'り', base, [], out, 'tari')
    }
    for (const x of f.pot) add(x, base, ['v1'], out, 'potential')
    for (const x of f.pass) add(x, base, ['v1'], out, 'passive')
    for (const x of f.caus) add(x, base, ['v1'], out, 'causative')
  }

  // 一段动词
  verb('る', 'v1', {
    neg: [''],
    masu: [''],
    cond: ['れ'],
    imp: ['ろ', 'よ'],
    vol: ['よう'],
    te: ['て'],
    ta: ['た'],
    pot: ['られる', 'れる'], // 后者是「ら抜き」
    pass: [],
    caus: ['させる']
  })
  // 五段动词
  for (const [u, a, i, e, o, te, ta] of GODAN)
    verb(u, 'v5', {
      neg: [a],
      masu: [i],
      cond: [e],
      imp: [e],
      vol: [o + 'う'],
      te: [te],
      ta: [ta],
      pot: [e + 'る'],
      pass: [a + 'れる'],
      caus: [a + 'せる']
    })
  // 行く：て形、た形不规则
  for (const k of ['行', 'い', '逝', '往']) {
    add(k + 'って', k + 'く', ['te'], 'v5', 'te')
    add(k + 'った', k + 'く', [], 'v5', 'past')
    add(k + 'ったら', k + 'く', [], 'v5', 'tara')
    add(k + 'ったり', k + 'く', [], 'v5', 'tari')
  }
  // する
  verb('する', 'vs', {
    neg: ['し'],
    masu: ['し'],
    cond: ['すれ'],
    imp: ['しろ', 'せよ'],
    vol: ['しよう'],
    te: ['して'],
    ta: ['した'],
    pot: ['できる'],
    pass: ['される'],
    caus: ['させる']
  })
  add('せず', 'する', [], 'vs', 'zu')
  // 名词 + する：勉強する → 勉強
  add('する', '', ['vs'], 'vs-n', 'suru')
  // 来る（假名与汉字两种写法）
  for (const [ko, ki, ku] of [
    ['こ', 'き', 'く'],
    ['来', '来', '来']
  ])
    verb(ku + 'る', 'vk', {
      neg: [ko],
      masu: [ki],
      cond: [ku + 'れ'],
      imp: [ko + 'い'],
      vol: [ko + 'よう'],
      te: [ki + 'て'],
      ta: [ki + 'た'],
      pot: [ko + 'られる', ko + 'れる'],
      pass: [],
      caus: [ko + 'させる']
    })

  // い形容词（「ない」「たい」也按它变）
  add('くない', 'い', ['adj-i'], 'adj-i', 'negative')
  add('かった', 'い', [], 'adj-i', 'past')
  add('かったら', 'い', [], 'adj-i', 'tara')
  add('かったり', 'い', [], 'adj-i', 'tari')
  add('くて', 'い', [], 'adj-i', 'te')
  add('く', 'い', [], 'adj-i', 'adv')
  add('ければ', 'い', [], 'adj-i', 'conditional')
  add('さ', 'い', [], 'adj-i', 'noun')
  add('そう', 'い', [], 'adj-i', 'looks')
  add('すぎる', 'い', ['v1'], 'adj-i', 'too')
  add('くなる', 'い', ['v5'], 'adj-i', 'become')

  // ます体
  add('ました', 'ます', [], 'masu', 'polite-past')
  add('ません', 'ます', [], 'masu', 'polite-negative')
  add('ませんでした', 'ます', [], 'masu', 'polite-negative')
  add('ましょう', 'ます', [], 'masu', 'polite-volitional')
  add('まして', 'ます', [], 'masu', 'te')

  // て形接补助动词
  for (const t of ['て', 'で']) {
    add(t + 'いる', t, ['v1'], 'te', 'progressive')
    add(t + 'る', t, ['v1'], 'te', 'progressive') // 口语省略「い」
    add(t + 'おく', t, ['v5'], 'te', 'prepare')
    add(t + 'しまう', t, ['v5'], 'te', 'finish')
    add(t + 'みる', t, ['v1'], 'te', 'try')
  }
  add('とく', 'て', ['v5'], 'te', 'prepare')
  add('どく', 'で', ['v5'], 'te', 'prepare')
  add('ちゃう', 'て', ['v5'], 'te', 'finish')
  add('じゃう', 'で', ['v5'], 'te', 'finish')
  return R
}

export const RULES = build()

/** 长的词尾先试，最多还原这么多步（防止规则转圈） */
const MAX_STEPS = 8
const byLength = [...RULES].sort((a, b) => b.from.length - a.from.length)

export function deinflect(word: string): Deinflection[] {
  const out: Deinflection[] = [{ word, type: null, reasons: [] }]
  const seen = new Set([`${word}|`])
  for (let i = 0; i < out.length; i++) {
    const c = out[i]
    if (c.reasons.length >= MAX_STEPS) continue
    for (const r of byLength) {
      if (!c.word.endsWith(r.from)) continue
      if (c.type !== null && !r.in.includes(c.type)) continue
      const stem = c.word.slice(0, c.word.length - r.from.length)
      // 至少留一个字（「る」本身不是词）
      if (!stem && r.to.length < 2) continue
      const base = stem + r.to
      const key = `${base}|${r.out}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ word: base, type: r.out, reasons: [r.reason, ...c.reasons] })
    }
  }
  return out
}

/** 还原出来的类型跟词典词性对不对得上（JMdict 的词性标记） */
export function typeMatchesPos(type: WordType | null, pos: string[]): boolean {
  if (type === null) return true
  switch (type) {
    case 'v1':
      return pos.some((p) => p === 'v1' || p === 'v1-s')
    case 'v5':
      return pos.some((p) => p.startsWith('v5'))
    case 'vk':
      return pos.includes('vk')
    case 'vs':
      return pos.some((p) => p === 'vs-i' || p === 'vs-s')
    case 'vs-n':
      return pos.some((p) => p === 'vs' || p === 'vs-c')
    case 'adj-i':
      return pos.some((p) => p === 'adj-i' || p === 'adj-ix')
    default:
      // ます体、て形只是中间形，停在这里查不到词
      return false
  }
}
