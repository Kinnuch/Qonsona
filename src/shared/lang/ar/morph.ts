/**
 * 阿拉伯语的构词：词根的类型、动词十种派生式的词型、按词根推出一个带元音的词的词型（وَزْن）。
 * 词典按词根看词族、以后的词型课与变形练习都用这些（纯函数）。
 *
 * 用语：这里的「词根」指根字母（جَذْر，كتب 的 ك ت ب）；中文教材常把动名词（مَصْدَر）也叫「词根」，
 * 本软件把 مَصْدَر 叫「动名词」，免得混。
 */
import { arKey, clusters, type Cluster } from './rules'

// ───────────────────────── 词根 ─────────────────────────

const WEAK = new Set(['و', 'ي'])
const HAMZA = new Set(['ء', 'أ', 'إ', 'ؤ', 'ئ', 'آ'])

/** 「ك ت ب」→ ['ك', 'ت', 'ب'] */
export const rootLetters = (root: string): string[] => root.split(/\s+/).filter(Boolean)

/**
 * 词根的类型（一个词根可以有几种）：sound 健全、hamzated 带 hamza、geminate 叠音（第二、三个字母相同）、
 * assimilated 首弱（و / ي 打头）、hollow 中弱、defective 尾弱、doubly-weak 双弱；四个字母的另加 quadriliteral。
 */
export function rootTypes(root: string): string[] {
  const r = rootLetters(root)
  const out: string[] = []
  if (r.length === 4) out.push('quadriliteral')
  if (r.some((c) => HAMZA.has(c))) out.push('hamzated')
  if (r.length === 3 && r[1] === r[2]) out.push('geminate')
  const weak = r.map((c) => WEAK.has(c))
  if (r.length === 3) {
    if (weak.filter(Boolean).length >= 2) out.push('doubly-weak')
    else if (weak[0]) out.push('assimilated')
    else if (weak[1]) out.push('hollow')
    else if (weak[2]) out.push('defective')
  }
  if (!out.length || (out.length === 1 && out[0] === 'quadriliteral')) out.push('sound')
  return out
}

// ───────────────────────── 动词的派生式 ─────────────────────────

export interface VerbFormDef {
  /** 过去式（第三人称阳性单数）的词型 */
  past: string
  /** 现在式的词型 */
  nonPast: string
  /** 动名词的词型（第一式没有固定的） */
  masdar: string[]
  /** 主动名词、被动名词的词型 */
  act?: string
  pass?: string
  zh: string
  en: string
}

/** 第一式按过去式元音分 فَعَلَ / فَعِلَ / فَعُلَ，现在式元音分 يَفْعُلُ / يَفْعِلُ / يَفْعَلُ */
export const FORM_I_PAST: Record<string, string> = { a: 'فَعَلَ', i: 'فَعِلَ', u: 'فَعُلَ' }
export const FORM_I_NONPAST: Record<string, string> = {
  a: 'يَفْعَلُ',
  i: 'يَفْعِلُ',
  u: 'يَفْعُلُ'
}

export const VERB_FORMS: Record<string, VerbFormDef> = {
  I: {
    past: 'فَعَلَ',
    nonPast: 'يَفْعُلُ',
    masdar: [],
    act: 'فَاعِل',
    pass: 'مَفْعُول',
    zh: '原形（三母原形动词）：基本意思；过去式、现在式的元音要逐个记',
    en: 'Basic form; the past and non-past vowels must be learned for each verb'
  },
  II: {
    past: 'فَعَّلَ',
    nonPast: 'يُفَعِّلُ',
    masdar: ['تَفْعِيل', 'تَفْعِلَة'],
    act: 'مُفَعِّل',
    pass: 'مُفَعَّل',
    zh: '使动、加强、由名词派生（教 ← 学）',
    en: 'Causative, intensive or denominative'
  },
  III: {
    past: 'فَاعَلَ',
    nonPast: 'يُفَاعِلُ',
    masdar: ['مُفَاعَلَة', 'فِعَال'],
    act: 'مُفَاعِل',
    pass: 'مُفَاعَل',
    zh: '对某人做、跟某人一起做、尝试做',
    en: 'Doing something to or with someone; attempting'
  },
  IV: {
    past: 'أَفْعَلَ',
    nonPast: 'يُفْعِلُ',
    masdar: ['إِفْعَال'],
    act: 'مُفْعِل',
    pass: 'مُفْعَل',
    zh: '使动（使……）',
    en: 'Causative'
  },
  V: {
    past: 'تَفَعَّلَ',
    nonPast: 'يَتَفَعَّلُ',
    masdar: ['تَفَعُّل'],
    act: 'مُتَفَعِّل',
    pass: 'مُتَفَعَّل',
    zh: '第二式的反身、结果（学 ← 教）',
    en: 'Reflexive or resultative of Form II'
  },
  VI: {
    past: 'تَفَاعَلَ',
    nonPast: 'يَتَفَاعَلُ',
    masdar: ['تَفَاعُل'],
    act: 'مُتَفَاعِل',
    pass: 'مُتَفَاعَل',
    zh: '相互、假装（第三式的反身）',
    en: 'Reciprocal or pretending (reflexive of Form III)'
  },
  VII: {
    past: 'اِنْفَعَلَ',
    nonPast: 'يَنْفَعِلُ',
    masdar: ['اِنْفِعَال'],
    act: 'مُنْفَعِل',
    pass: 'مُنْفَعَل',
    zh: '第一式的被动、自动（被打破 ← 打破）',
    en: 'Passive or middle of Form I'
  },
  VIII: {
    past: 'اِفْتَعَلَ',
    nonPast: 'يَفْتَعِلُ',
    masdar: ['اِفْتِعَال'],
    act: 'مُفْتَعِل',
    pass: 'مُفْتَعَل',
    zh: '第一式的反身、为自己做',
    en: 'Reflexive or middle of Form I'
  },
  IX: {
    past: 'اِفْعَلَّ',
    nonPast: 'يَفْعَلُّ',
    masdar: ['اِفْعِلَال'],
    act: 'مُفْعَلّ',
    zh: '变成某种颜色、有某种缺陷（变红）',
    en: 'Becoming a colour or acquiring a defect'
  },
  X: {
    past: 'اِسْتَفْعَلَ',
    nonPast: 'يَسْتَفْعِلُ',
    masdar: ['اِسْتِفْعَال'],
    act: 'مُسْتَفْعِل',
    pass: 'مُسْتَفْعَل',
    zh: '请求、要求、认为是……（请求帮助、认为好）',
    en: 'Seeking or asking for; considering something to be'
  },
  XI: {
    past: 'اِفْعَالَّ',
    nonPast: 'يَفْعَالُّ',
    masdar: ['اِفْعِيلَال'],
    zh: '颜色、缺陷（少见，第九式的加强）',
    en: 'Colours and defects (rare; intensive of Form IX)'
  },
  XII: {
    past: 'اِفْعَوْعَلَ',
    nonPast: 'يَفْعَوْعِلُ',
    masdar: ['اِفْعِيعَال'],
    zh: '加强（少见）',
    en: 'Intensive (rare)'
  },
  XIII: {
    past: 'اِفْعَوَّلَ',
    nonPast: 'يَفْعَوِّلُ',
    masdar: ['اِفْعِوَّال'],
    zh: '少见',
    en: 'Rare'
  },
  XIV: {
    past: 'اِفْعَنْلَلَ',
    nonPast: 'يَفْعَنْلِلُ',
    masdar: ['اِفْعِنْلَال'],
    zh: '少见',
    en: 'Rare'
  },
  XV: {
    past: 'اِفْعَنْلَى',
    nonPast: 'يَفْعَنْلِي',
    masdar: ['اِفْعِنْلَاء'],
    zh: '少见',
    en: 'Rare'
  },
  Iq: {
    past: 'فَعْلَلَ',
    nonPast: 'يُفَعْلِلُ',
    masdar: ['فَعْلَلَة'],
    act: 'مُفَعْلِل',
    pass: 'مُفَعْلَل',
    zh: '四母原形动词（翻译 تَرْجَمَ）',
    en: 'Basic quadriliteral form'
  },
  IIq: {
    past: 'تَفَعْلَلَ',
    nonPast: 'يَتَفَعْلَلُ',
    masdar: ['تَفَعْلُل'],
    act: 'مُتَفَعْلِل',
    pass: 'مُتَفَعْلَل',
    zh: '四母第二式：反身（第一式的结果）',
    en: 'Reflexive of the basic quadriliteral'
  },
  IIIq: {
    past: 'اِفْعَنْلَلَ',
    nonPast: 'يَفْعَنْلِلُ',
    masdar: ['اِفْعِنْلَال'],
    act: 'مُفْعَنْلِل',
    zh: '四母第三式（少见）',
    en: 'Quadriliteral Form III (rare)'
  },
  IVq: {
    past: 'اِفْعَلَلَّ',
    nonPast: 'يَفْعَلِلُّ',
    masdar: ['اِفْعِلَّال'],
    act: 'مُفْعَلِلّ',
    zh: '四母第四式：状态、感受（安心 اِطْمَأَنَّ）',
    en: 'Quadriliteral Form IV: states and feelings'
  }
}

/** 动词词型：第一式按元音，别的按派生式 */
export function verbPattern(form: string, vowels?: string): string | undefined {
  if (form === 'I') return FORM_I_PAST[vowels?.[0] ?? ''] ?? undefined
  return VERB_FORMS[form]?.past
}

// ───────────────────────── 名词、形容词的词型 ─────────────────────────

/** 增加字母（حروف الزيادة：سألتمونيها）连同 hamza 的各种写法、ة ى：词型里不是根字母的只能是这些 */
const AUGMENT = new Set([...'سألتمونيهاءإآؤئةى'])
const FA = 'ف'
const AIN = 'ع'
const LAM = 'ل'
const MARKS_RE = /[\u{64b}-\u{652}\u{670}]/u
const vowelMarks = (c: Cluster): string => c.r.slice(c.b.length)

const matches = (letter: string, radical: string): boolean =>
  letter === radical || (radical === 'ء' && HAMZA.has(letter))

/**
 * 按词根推带元音的词的词型（وَزْن）：根字母换成 ف ع ل（四个字母的第四个也是 ل），别的字母与元音照抄。
 * كِتَاب + ك ت ب → فِعَال；مَكْتَبَة → مَفْعَلَة；اِسْتِخْدَام + خ د م → اِسْتِفْعَال。
 * 推不准的不给：根字母在词里找不全（قَالَ、قَائِل 这类弱字母变了的）、弱字母在词里当长元音用（مَقُول）、
 * 叠音的第二、三个根字母写成一个（مَدّ）、剩下的字母不全是增加字母。几种对法都行时取根字母最靠后的
 * （تَتَبَّعَ 的第一个 ت 是前缀：تَفَعَّلَ）。
 */
export function wazn(vocalized: string, root: string): string | undefined {
  const r = rootLetters(root)
  if (r.length < 3 || r.length > 4) return undefined
  // آ 拆成 hamza + 长 alif（آكِل → أَاكِل → فَاعِل）
  const cs: Cluster[] = []
  for (const c of clusters(vocalized)) {
    if (c.b === 'آ') cs.push({ b: 'أ', r: 'أ\u{64e}' }, { b: 'ا', r: 'ا' + vowelMarks(c) })
    else cs.push(c)
  }
  if (cs.some((c) => c.b === ' ')) return undefined
  const n = cs.length
  let best: number[] | undefined
  // 枚举根字母的位置（递增），留下最靠后的合格对法
  const pick = (k: number, from: number, acc: number[]): void => {
    if (k === r.length) {
      if (valid(acc) && (!best || later(acc, best))) best = [...acc]
      return
    }
    for (let i = from; i < n; i++) if (matches(cs[i].b, r[k])) pick(k + 1, i + 1, [...acc, i])
  }
  const later = (a: number[], b: number[]): boolean => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]
    return false
  }
  const valid = (pos: number[]): boolean => {
    const set = new Set(pos)
    for (let i = 0; i < n; i++) if (!set.has(i) && !AUGMENT.has(cs[i].b)) return false
    for (let k = 0; k < pos.length; k++) {
      const c = cs[pos[k]]
      // 弱根字母当长元音用的（前一个字母带同类短元音、自己不带符号）不算根字母
      if (WEAK.has(r[k]) && !MARKS_RE.test(vowelMarks(c)) && pos[k] > 0) {
        const prev = vowelMarks(cs[pos[k] - 1])
        if ((c.b === 'و' && prev.includes('\u{64f}')) || (c.b === 'ي' && prev.includes('\u{650}')))
          return false
      }
    }
    return true
  }
  pick(0, 0, [])
  if (!best) return undefined
  const sub = [FA, AIN, LAM, LAM]
  const out = cs.map((c, i) => {
    const k = best!.indexOf(i)
    return k >= 0 ? sub[k] + vowelMarks(c) : c.r
  })
  return out.join('').normalize('NFC')
}

/** 两个词型一样吗（比较时去掉词尾的格尾元音、鼻音符） */
export function samePattern(a: string, b: string): boolean {
  const trim = (s: string): string => s.normalize('NFC').replace(/[\u{64b}-\u{650}\u{652}]+$/u, '')
  return trim(a) === trim(b)
}

// ───────────────────────── 变形类别的名称 ─────────────────────────

/** 词条 cls 里的代号 → 界面上的名称 */
export const CLS_NAMES: Record<string, { zh: string; en: string }> = {
  'form-i': { zh: '第一式 فَعَلَ', en: 'Form I' },
  'form-ii': { zh: '第二式 فَعَّلَ', en: 'Form II' },
  'form-iii': { zh: '第三式 فَاعَلَ', en: 'Form III' },
  'form-iv': { zh: '第四式 أَفْعَلَ', en: 'Form IV' },
  'form-v': { zh: '第五式 تَفَعَّلَ', en: 'Form V' },
  'form-vi': { zh: '第六式 تَفَاعَلَ', en: 'Form VI' },
  'form-vii': { zh: '第七式 اِنْفَعَلَ', en: 'Form VII' },
  'form-viii': { zh: '第八式 اِفْتَعَلَ', en: 'Form VIII' },
  'form-ix': { zh: '第九式 اِفْعَلَّ', en: 'Form IX' },
  'form-x': { zh: '第十式 اِسْتَفْعَلَ', en: 'Form X' },
  'form-xi': { zh: '第十一式 اِفْعَالَّ', en: 'Form XI' },
  'form-xii': { zh: '第十二式 اِفْعَوْعَلَ', en: 'Form XII' },
  'form-xiii': { zh: '第十三式 اِفْعَوَّلَ', en: 'Form XIII' },
  'form-xiv': { zh: '第十四式 اِفْعَنْلَلَ', en: 'Form XIV' },
  'form-xv': { zh: '第十五式 اِفْعَنْلَى', en: 'Form XV' },
  'form-iq': { zh: '四母第一式 فَعْلَلَ', en: 'Form Iq' },
  'form-iiq': { zh: '四母第二式 تَفَعْلَلَ', en: 'Form IIq' },
  'form-iiiq': { zh: '四母第三式 اِفْعَنْلَلَ', en: 'Form IIIq' },
  'form-ivq': { zh: '四母第四式 اِفْعَلَلَّ', en: 'Form IVq' },
  sound: { zh: '健全', en: 'sound' },
  hamzated: { zh: '带 hamza', en: 'hamzated' },
  geminate: { zh: '叠音', en: 'geminate' },
  assimilated: { zh: '首弱（و / ي 打头）', en: 'assimilated' },
  hollow: { zh: '中弱', en: 'hollow' },
  defective: { zh: '尾弱', en: 'defective' },
  'doubly-weak': { zh: '双弱', en: 'doubly weak' },
  quadriliteral: { zh: '四母词根', en: 'quadriliteral' },
  triptote: { zh: '全变尾（三种格尾，带鼻音）', en: 'triptote' },
  diptote: { zh: '半变尾（不加鼻音，属格同宾格）', en: 'diptote' },
  invariable: { zh: '不变尾', en: 'invariable' },
  'broken-plural': { zh: '破碎式复数', en: 'broken plural' },
  'sound-plural': { zh: '规则复数', en: 'sound plural' },
  'verbal-noun': { zh: '动名词（مَصْدَر）', en: 'verbal noun (maṣdar)' },
  'active-participle': { zh: '主动名词（اِسْم الْفَاعِل）', en: 'active participle' },
  'passive-participle': { zh: '被动名词（اِسْم الْمَفْعُول）', en: 'passive participle' },
  'noun-of-place': { zh: '时空名词（اِسْم الْمَكَان）', en: 'noun of place' },
  'instance-noun': { zh: '次数名词（اِسْم الْمَرَّة）', en: 'instance noun' },
  elative: { zh: '比较级（اِسْم التَّفْضِيل）', en: 'elative' },
  'tool-noun': { zh: '工具名词（اِسْم الْآلَة）', en: 'noun of instrument' },
  'occupational-noun': { zh: '职业名词', en: 'occupational noun' },
  'color-defect-adjective': { zh: '颜色、缺陷形容词', en: 'colour or defect adjective' },
  nisba: { zh: '从属名词 / 关系形容词（ـِيّ）', en: 'nisba (relative adjective)' },
  collective: { zh: '集合名词', en: 'collective noun' }
}

/** 一个词条属于哪个词根（给按词根看词族用）：键是 arKey 规整过的「ك ت ب」 */
export const rootKey = (root: string): string => rootLetters(arKey(root)).join(' ')
