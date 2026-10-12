/**
 * 阿拉伯语在界面上的叫法：变形表与义项的标签、类别代号（cls）、猜原形时的附着词代号、x 字段。
 * 界面先查这里（LangModule.labels），再查通用的 src/shared/lang/tags.ts。
 * 字段的键写 'x.<键名>'。
 */
import type { LocalizedText } from '../types'
import { CLS_NAMES } from './morph'
import { CLITICS } from './rules'

/** 附着词代号 → 「وَ（和）」这样的叫法；宾格不在这里（表里的「宾格」通用的就对） */
const clitics: Record<string, LocalizedText> = Object.fromEntries(
  Object.entries(CLITICS)
    .filter(([k]) => k !== 'accusative')
    .map(([k, c]) => [k, { zh: `${c.ar}（${c.zh}）`, en: `${c.ar} (${c.en})` }])
)

/** 变形表、义项里用到、通用表里没有或要换个说法的标签 */
const tags: Record<string, LocalizedText> = {
  // 动词：国内教材叫过去式、现在式，现在式的三种语气按格的名称叫主格、宾格、切格
  past: { zh: '过去式', en: 'past' },
  'non-past': { zh: '现在式', en: 'non-past' },
  indicative: { zh: '陈述式（主格）', en: 'indicative' },
  subjunctive: { zh: '虚拟式（宾格）', en: 'subjunctive' },
  jussive: { zh: '祈使式（切格）', en: 'jussive' },
  participle: { zh: '分词（主动名词）', en: 'participle' },
  // 名词
  definite: { zh: '定指（الْ）', en: 'definite (al-)' },
  construct: { zh: '正次（属构）', en: 'construct state' },
  'long-construct': { zh: '正次（长形）', en: 'long construct' },
  collective: { zh: '集合名词', en: 'collective' },
  singulative: { zh: '单个名词', en: 'singulative' },
  paucal: { zh: '少数复数', en: 'paucal' },
  oblique: { zh: '宾格属格', en: 'oblique' },
  common: { zh: '通性', en: 'common gender' },
  enclitic: { zh: '后附形', en: 'enclitic' },
  'in-plural': { zh: '多用复数', en: 'in the plural' },
  'plural-normally': { zh: '一般用复数', en: 'usually plural' },
  letter: { zh: '字母', en: 'letter' },
  // 动词的用法
  ditransitive: { zh: '双宾语', en: 'ditransitive' },
  ambitransitive: { zh: '及物 / 不及物', en: 'ambitransitive' },
  reciprocal: { zh: '相互', en: 'reciprocal' },
  causative: { zh: '使动', en: 'causative' },
  stative: { zh: '状态', en: 'stative' },
  copulative: { zh: '系动词', en: 'copulative' },
  'imperative-only': { zh: '只用命令式', en: 'imperative only' },
  // 语域、频度
  Classical: { zh: '古典阿语', en: 'Classical Arabic' },
  'post-Classical': { zh: '后古典', en: 'post-Classical' },
  Modern: { zh: '现代', en: 'Modern' },
  Standard: { zh: '标准语', en: 'Standard' },
  uncommon: { zh: '不常用', en: 'uncommon' },
  neologism: { zh: '新词', en: 'neologism' },
  literally: { zh: '字面义', en: 'literally' },
  usually: { zh: '通常', en: 'usually' },
  often: { zh: '常', en: 'often' },
  sometimes: { zh: '有时', en: 'sometimes' },
  broadly: { zh: '泛指', en: 'broadly' },
  especially: { zh: '尤指', en: 'especially' },
  metonymically: { zh: '借代', en: 'metonymically' },
  rhetoric: { zh: '修辞', en: 'rhetoric' },
  slur: { zh: '蔑称', en: 'slur' },
  ethnic: { zh: '民族', en: 'ethnic' },
  relational: { zh: '关系形容词', en: 'relational' },
  // 地区与宗教
  Egypt: { zh: '埃及', en: 'Egypt' },
  Egyptian: { zh: '埃及', en: 'Egyptian' },
  Levantine: { zh: '黎凡特', en: 'Levantine' },
  Gulf: { zh: '海湾', en: 'Gulf' },
  Iraq: { zh: '伊拉克', en: 'Iraq' },
  Morocco: { zh: '摩洛哥', en: 'Morocco' },
  Yemen: { zh: '也门', en: 'Yemen' },
  Kuwait: { zh: '科威特', en: 'Kuwait' },
  Palestine: { zh: '巴勒斯坦', en: 'Palestine' },
  Mauritania: { zh: '毛里塔尼亚', en: 'Mauritania' },
  'al-Andalus': { zh: '安达卢斯', en: 'al-Andalus' },
  Judaism: { zh: '犹太教', en: 'Judaism' },
  Shia: { zh: '什叶派', en: 'Shia' },
  Sunni: { zh: '逊尼派', en: 'Sunni' }
}

/** x 字段（词根、词型叫法通用表里已经有） */
const fields: Record<string, LocalizedText> = {
  'x.form': { zh: '派生式', en: 'Verb form' },
  'x.vowels': { zh: '第一式的元音（过去式 ~ 现在式）', en: 'Form I vowels (past ~ non-past)' }
}

export const AR_LABELS: Record<string, LocalizedText> = {
  ...CLS_NAMES,
  ...clitics,
  ...tags,
  ...fields
}
