/**
 * 词性、性、变形标签（Wiktextract 的标签词）在界面上怎么叫。
 * 各语言共用；没收的标签原样显示。要加新的请在阶段汇报里提，由主线加进来。
 */
import type { PosTag } from './types'

type Label = { zh: string; en: string }

export const POS_LABELS: Record<PosTag, Label> = {
  noun: { zh: '名词', en: 'noun' },
  propn: { zh: '专名', en: 'proper noun' },
  verb: { zh: '动词', en: 'verb' },
  aux: { zh: '助动词', en: 'auxiliary' },
  adj: { zh: '形容词', en: 'adjective' },
  adv: { zh: '副词', en: 'adverb' },
  pron: { zh: '代词', en: 'pronoun' },
  det: { zh: '限定词', en: 'determiner' },
  adp: { zh: '介词', en: 'adposition' },
  cconj: { zh: '并列连词', en: 'conjunction' },
  sconj: { zh: '从属连词', en: 'subordinator' },
  num: { zh: '数词', en: 'numeral' },
  part: { zh: '小品词', en: 'particle' },
  intj: { zh: '感叹词', en: 'interjection' },
  phrase: { zh: '短语', en: 'phrase' },
  idiom: { zh: '习语', en: 'idiom' },
  proverb: { zh: '谚语', en: 'proverb' },
  affix: { zh: '词缀', en: 'affix' },
  abbr: { zh: '缩写', en: 'abbreviation' },
  symbol: { zh: '符号', en: 'symbol' },
  other: { zh: '其他', en: 'other' }
}

export const GENDER_LABELS: Record<string, Label> = {
  m: { zh: '阳性', en: 'masculine' },
  f: { zh: '阴性', en: 'feminine' },
  n: { zh: '中性', en: 'neuter' },
  c: { zh: '通性', en: 'common' },
  mf: { zh: '阴阳同形', en: 'masculine or feminine' }
}

/** Wiktextract 常见的标签词 */
export const TAG_LABELS: Record<string, Label> = {
  lemma: { zh: '原形', en: 'lemma' },
  // 数、性、格
  singular: { zh: '单数', en: 'singular' },
  plural: { zh: '复数', en: 'plural' },
  dual: { zh: '双数', en: 'dual' },
  masculine: { zh: '阳性', en: 'masculine' },
  feminine: { zh: '阴性', en: 'feminine' },
  neuter: { zh: '中性', en: 'neuter' },
  animate: { zh: '有生', en: 'animate' },
  inanimate: { zh: '无生', en: 'inanimate' },
  nominative: { zh: '主格', en: 'nominative' },
  genitive: { zh: '属格', en: 'genitive' },
  dative: { zh: '与格', en: 'dative' },
  accusative: { zh: '宾格', en: 'accusative' },
  instrumental: { zh: '工具格', en: 'instrumental' },
  prepositional: { zh: '前置格', en: 'prepositional' },
  locative: { zh: '位格', en: 'locative' },
  vocative: { zh: '呼格', en: 'vocative' },
  partitive: { zh: '部分格', en: 'partitive' },
  definite: { zh: '定指', en: 'definite' },
  indefinite: { zh: '不定指', en: 'indefinite' },
  construct: { zh: '属构', en: 'construct' },
  informal: { zh: '非正式', en: 'informal' },
  // 人称
  'first-person': { zh: '第一人称', en: 'first person' },
  'second-person': { zh: '第二人称', en: 'second person' },
  'third-person': { zh: '第三人称', en: 'third person' },
  impersonal: { zh: '无人称', en: 'impersonal' },
  // 时、体、式
  present: { zh: '现在时', en: 'present' },
  past: { zh: '过去时', en: 'past' },
  future: { zh: '将来时', en: 'future' },
  imperfect: { zh: '未完成过去时', en: 'imperfect' },
  preterite: { zh: '简单过去时', en: 'preterite' },
  perfect: { zh: '完成时', en: 'perfect' },
  pluperfect: { zh: '过去完成时', en: 'pluperfect' },
  'past-historic': { zh: '简单过去时', en: 'past historic' },
  anterior: { zh: '先过去时', en: 'anterior' },
  progressive: { zh: '进行体', en: 'progressive' },
  perfective: { zh: '完成体', en: 'perfective' },
  imperfective: { zh: '未完成体', en: 'imperfective' },
  indicative: { zh: '陈述式', en: 'indicative' },
  subjunctive: { zh: '虚拟式', en: 'subjunctive' },
  conditional: { zh: '条件式', en: 'conditional' },
  imperative: { zh: '命令式', en: 'imperative' },
  jussive: { zh: '祈使式', en: 'jussive' },
  infinitive: { zh: '不定式', en: 'infinitive' },
  participle: { zh: '分词', en: 'participle' },
  gerund: { zh: '副动词', en: 'gerund' },
  'verbal-noun': { zh: '动名词', en: 'verbal noun' },
  active: { zh: '主动', en: 'active' },
  passive: { zh: '被动', en: 'passive' },
  reflexive: { zh: '反身', en: 'reflexive' },
  negative: { zh: '否定', en: 'negative' },
  interrogative: { zh: '疑问', en: 'interrogative' },
  dependent: { zh: '从属式', en: 'dependent' },
  independent: { zh: '独立式', en: 'independent' },
  relative: { zh: '关系式', en: 'relative' },
  habitual: { zh: '惯常', en: 'habitual' },
  // 形容词、副词
  positive: { zh: '原级', en: 'positive' },
  comparative: { zh: '比较级', en: 'comparative' },
  superlative: { zh: '最高级', en: 'superlative' },
  short: { zh: '短尾', en: 'short form' },
  // 音变、写法
  lenition: { zh: '弱化', en: 'lenition' },
  lenited: { zh: '弱化形', en: 'lenited' },
  eclipsis: { zh: '鼻化', en: 'eclipsis' },
  'h-prothesis': { zh: '加 h', en: 'h-prothesis' },
  't-prothesis': { zh: '加 t-', en: 't-prothesis' },
  romanization: { zh: '转写', en: 'romanization' },
  alternative: { zh: '异体', en: 'alternative' },
  abbreviation: { zh: '缩写', en: 'abbreviation' },
  contraction: { zh: '缩约', en: 'contraction' },
  archaic: { zh: '古旧', en: 'archaic' },
  obsolete: { zh: '已废', en: 'obsolete' },
  dated: { zh: '过时', en: 'dated' },
  rare: { zh: '少用', en: 'rare' },
  colloquial: { zh: '口语', en: 'colloquial' },
  formal: { zh: '正式', en: 'formal' },
  slang: { zh: '俚语', en: 'slang' },
  literary: { zh: '书面', en: 'literary' },
  figuratively: { zh: '比喻', en: 'figurative' },
  honorific: { zh: '敬语', en: 'honorific' },
  humble: { zh: '谦语', en: 'humble' },
  polite: { zh: '礼貌', en: 'polite' },
  vulgar: { zh: '粗俗', en: 'vulgar' },
  regional: { zh: '地区', en: 'regional' },
  transitive: { zh: '及物', en: 'transitive' },
  intransitive: { zh: '不及物', en: 'intransitive' },
  countable: { zh: '可数', en: 'countable' },
  uncountable: { zh: '不可数', en: 'uncountable' },
  irregular: { zh: '不规则', en: 'irregular' },
  UK: { zh: '英式', en: 'UK' },
  US: { zh: '美式', en: 'US' }
}

const pick = (l: Label | undefined, locale: string, raw: string): string =>
  l ? (locale.startsWith('zh') ? l.zh : l.en) : raw

export const posLabel = (p: string, locale: string): string =>
  pick(POS_LABELS[p as PosTag], locale, p)

export const genderLabel = (g: string, locale: string): string => pick(GENDER_LABELS[g], locale, g)

export const tagLabel = (t: string, locale: string): string => pick(TAG_LABELS[t], locale, t)

/** 一组标签合成一个说明：「复数 · 属格」 */
export function tagsLabel(tags: string[], locale: string): string {
  return tags
    .filter((t) => t !== 'lemma')
    .map((t) => tagLabel(t, locale))
    .join(locale.startsWith('zh') ? ' · ' : ', ')
}
