/**
 * 按规则推西班牙语动词的变位表（纯函数）。
 *
 * 词典库里给分了级的、不规则的、词干变化的、有拼写变化的动词存了维基词典的变位表；没分级的规则动词不存
 * （省体积，见 docs/lang/es.md），它们的变位表用这里按规则现推。以后的变位练习、课程也可以拿它给任何动词出题。
 *
 * 出来的形式与标签跟词典库里的变位表一模一样：同样的格子、同样的标签词、同样的顺序。会的变化：
 * - 三种规则变位（-ar、-er、-ir / -ír），含 vos 的形式、-ra / -se 两套虚拟式过去时、虚拟式将来时、肯定命令式；
 * - 拼写变化：c → qu、g → gu、gu → gü、z → c（e 前）；c → z、g → j、gu → g、qu → c（a、o 前）；
 *   元音结尾的词干（leer、creer）的 i → y（leyó、leyendo）与重音符（leí、leíste、leído）；
 *   -uir 在 a、e、o 前插 y（construyo、construya）；ñ、ll 后面的 ió、ie 去掉 i（gruñó、bulleron）；
 * - 维基词典标出的变位类别（classes）：e-ie、o-ue、u-ue、i-ie、o-hue、e-i、e-ie-i、o-ue-u、c-zc、c-z、
 *   i-í、u-ú、e-í（reír）。
 * 不会的：真正不规则的动词（ser、ir、tener、hacer……），它们在词典库里都有现成的变位表。
 */

import { stripAcute, syllables } from './phonology'

export type FormRow = [string, ...string[]]

const ACUTE: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }

const PERSON_TAGS: string[][] = [
  ['first-person', 'singular'],
  ['second-person', 'singular'],
  ['singular', 'third-person'],
  ['first-person', 'plural'],
  ['plural', 'second-person'],
  ['plural', 'third-person']
]

/** 词干变化 */
interface Change {
  /** 重读时：最后一个 from 换成 to（e → ie、o → ue……） */
  stressed?: [string, string]
  /** -ir 动词不重读、后面是 a 或 ió / ie 的格子（虚拟式 nos / vos、过去时第三人称、副动词）：e → i、o → u */
  weak?: [string, string]
  /** a、o 前 c → zc（conocer → conozco） */
  zc?: boolean
  /** 重读时 i → í、u → ú（enviar → envío、actuar → actúo） */
  acute?: 'i' | 'u'
  /** reír 一类：重读 e → í，不重读的 i 开头词尾前去掉 e（rió），a 开头的前 e → i（riamos） */
  rei?: boolean
}

function changeOf(classes: string[]): Change {
  const c: Change = {}
  for (const k of classes) {
    if (k === 'e-ie' || k === 'e-ye') c.stressed = ['e', 'ie']
    else if (k === 'o-ue') c.stressed = ['o', 'ue']
    else if (k === 'u-ue') c.stressed = ['u', 'ue']
    else if (k === 'i-ie') c.stressed = ['i', 'ie']
    else if (k === 'o-hue') c.stressed = ['o', 'hue']
    else if (k === 'e-i') {
      c.stressed = ['e', 'i']
      c.weak = ['e', 'i']
    } else if (k === 'e-ie-i' || k === 'e-ye-i') {
      c.stressed = ['e', 'ie']
      c.weak = ['e', 'i']
    } else if (k === 'o-ue-u') {
      c.stressed = ['o', 'ue']
      c.weak = ['o', 'u']
    } else if (k === 'c-zc') c.zc = true
    else if (k === 'i-í') c.acute = 'i'
    else if (k === 'u-ú') c.acute = 'u'
    else if (k === 'e-í') c.rei = true
  }
  return c
}

/**
 * 正字法上只有一个音节的形式不写重音符（2010 年起：lie、lio、hui、rio、guion）。
 * 只在去掉重音符后那两个元音算二合元音时才去：重读的是 a、e、o（lié → lie、rió → rio），
 * 或者 í、ú 挨着另一个闭元音（huí → hui）；í、ú 挨着 a、e、o 是分读，重音符要留（leí、lío、leía）。
 * 区分同形词的单音节重音（dé、sé）只出现在不规则动词里，不经过这里。
 */
function monosyllable(f: string): string {
  const m = /[áéíóú]/.exec(f)
  if (!m) return f
  const c = m[0]
  if (c === 'í' || c === 'ú') {
    const other = c === 'í' ? 'u' : 'i'
    const prev = f[m.index - 1] ?? ''
    const next = f[m.index + 1] ?? ''
    // 挨着 a、e、o 是分读（huía、leía）；只挨着另一个闭元音才是二合元音（huí → hui）
    if (/[aeo]/.test(prev) || /[aeo]/.test(next)) return f
    if (prev !== other && next !== other) return f
  }
  const plain = stripAcute(f)
  return syllables(plain).length === 1 ? plain : f
}

/** 把词干里最后一处 from 换成 to */
function replaceLast(stem: string, from: string, to: string): string {
  const i = stem.lastIndexOf(from)
  return i < 0 ? stem : stem.slice(0, i) + to + stem.slice(i + from.length)
}

/**
 * 推变位表。infinitive 是不定式（带 -se 的按不带的推：lavarse → lavar）；classes 是维基词典的变位类别。
 * 认不出动词词尾的返回空表。
 */
export function conjugate(infinitive: string, classes: string[] = []): FormRow[] {
  const inf = infinitive.toLocaleLowerCase('es').replace(/(?<=r)se$/, '')
  const m = /^(.+?)(ar|er|ir|ír)$/.exec(inf)
  if (!m) return []
  const conj = m[2] === 'ar' ? 'ar' : m[2] === 'er' ? 'er' : 'ir'
  const stem = m[1]
  const ch = changeOf(classes)
  const vowelStem = conj !== 'ar' && /[aeo]$/.test(stem)
  // -uir（construir），以及 -güir（argüir → arguyo：插 y 时 ü 去掉两点）
  const uir = conj === 'ir' && /([^gq]u|gü)$/.test(stem)
  const palatal = /(ñ|ll)$/.test(stem)
  const weakIr = conj === 'ir' && (!!ch.weak || !!ch.rei)

  /** 词干 + 词尾：词干变化、拼写变化、i 与 y 的交替 */
  function form(end: string, o: { stressed?: boolean; weak?: boolean } = {}): string {
    let s = stem
    let e = end
    if (ch.rei && o.stressed) s = replaceLast(s, 'e', 'í')
    else if (ch.rei && o.weak) s = /^i/.test(e) ? s.slice(0, -1) : replaceLast(s, 'e', 'i')
    else {
      if (o.stressed && ch.stressed) {
        s = replaceLast(s, ch.stressed[0], ch.stressed[1])
        // g 后面的 ue 要写 ü（avergonzar → avergüenzo、agorar → agüero）
        if (ch.stressed[1] === 'ue') s = s.replace(/gue(?=[^e]*$)/, 'güe')
      }
      if (o.weak && ch.weak) s = replaceLast(s, ch.weak[0], ch.weak[1])
      if (o.stressed && ch.acute) s = replaceLast(s, ch.acute, ACUTE[ch.acute])
    }
    if (conj === 'ar') {
      if (/^[eé]/.test(e)) {
        if (s.endsWith('c')) s = s.slice(0, -1) + 'qu'
        else if (s.endsWith('gu')) s = s.slice(0, -2) + 'gü'
        else if (s.endsWith('g')) s = s + 'u'
        else if (s.endsWith('z')) s = s.slice(0, -1) + 'c'
      }
    } else if (/^[aoáó]/.test(e)) {
      if (ch.zc && s.endsWith('c')) s = s.slice(0, -1) + 'zc'
      else if (s.endsWith('c')) s = s.slice(0, -1) + 'z'
      else if (s.endsWith('qu')) s = s.slice(0, -2) + 'c'
      else if (s.endsWith('gu')) s = s.slice(0, -2) + 'g'
      else if (s.endsWith('g')) s = s.slice(0, -1) + 'j'
    }
    // -uir：a、e、o 前插 y（construyo、construyes、construya）
    if (uir && /^[aeoáéó]/.test(e)) s = s.replace(/gü$/, 'gu') + 'y'
    // 元音结尾（含 -uir）的词干 + 不重读的 ie、ió：i → y（leyó、leyendo、construyeron）
    if ((vowelStem || uir) && !(ch.rei && o.weak) && /^i[aeoóé]/.test(e)) {
      e = 'y' + e.slice(1)
      s = s.replace(/gü$/, 'gu')
    }
    // ñ、ll 后面的 ió、ie 去掉 i（gruñó、bulleron、gruñendo）
    if (palatal && /^i[aeoóé]/.test(e)) e = e.slice(1)
    // 元音结尾的词干后面的 i 自成音节、要写重音（leí、leíste、leímos、leído、reímos）
    if (vowelStem && /^i/.test(e) && !/^i[aeoóé]/.test(e)) e = 'í' + e.slice(1)
    return monosyllable(s + e)
  }

  const rows: FormRow[] = []
  const add = (f: string, tags: string[]): void => void rows.push([f, ...[...tags].sort()])
  /** 六个人称：stressed 是重读词干的人称，weak 是弱化（-ir 词干变化）的人称 */
  const six = (ends: string[], tags: string[], stressed: number[], weak: number[]): void =>
    ends.forEach((e, p) =>
      add(form(e, { stressed: stressed.includes(p), weak: weak.includes(p) }), [
        ...PERSON_TAGS[p],
        ...tags
      ])
    )
  const ALL = [0, 1, 2, 3, 4, 5]

  // 副动词、过去分词
  add(form(conj === 'ar' ? 'ando' : 'iendo', { weak: weakIr }), ['gerund'])
  const part = conj === 'ar' ? 'ad' : 'id'
  for (const [end, g, n] of [
    ['o', 'masculine', 'singular'],
    ['a', 'feminine', 'singular'],
    ['os', 'masculine', 'plural'],
    ['as', 'feminine', 'plural']
  ])
    add(form(part + end), [g, 'participle', 'past', n])

  // 陈述式现在时（tú 后面插一格 vos）
  const pres =
    conj === 'ar'
      ? ['o', 'as', 'a', 'amos', 'áis', 'an']
      : conj === 'er'
        ? ['o', 'es', 'e', 'emos', 'éis', 'en']
        : ['o', 'es', 'e', 'imos', 'ís', 'en']
  const vosPres = conj === 'ar' ? 'ás' : conj === 'er' ? 'és' : 'ís'
  add(form(pres[0], { stressed: true }), [...PERSON_TAGS[0], 'indicative', 'present'])
  add(form(pres[1], { stressed: true }), [...PERSON_TAGS[1], 'indicative', 'informal', 'present'])
  add(form(vosPres), [...PERSON_TAGS[1], 'indicative', 'informal', 'present', 'vos-form'])
  add(form(pres[2], { stressed: true }), [...PERSON_TAGS[2], 'indicative', 'present'])
  add(form(pres[3]), [...PERSON_TAGS[3], 'indicative', 'present'])
  add(form(pres[4]), [...PERSON_TAGS[4], 'indicative', 'present'])
  add(form(pres[5], { stressed: true }), [...PERSON_TAGS[5], 'indicative', 'present'])

  // 过去未完成时、简单过去时
  six(
    conj === 'ar'
      ? ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban']
      : ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
    ['imperfect', 'indicative'],
    [],
    []
  )
  six(
    conj === 'ar'
      ? ['é', 'aste', 'ó', 'amos', 'asteis', 'aron']
      : ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
    ['indicative', 'preterite'],
    [],
    weakIr ? [2, 5] : []
  )

  // 将来时、条件式：不定式（reír 去掉重音）+ 词尾
  const base = inf.replace(/ír$/, 'ir')
  for (const [ends, tags] of [
    [
      ['é', 'ás', 'á', 'emos', 'éis', 'án'],
      ['future', 'indicative']
    ],
    [
      ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
      ['conditional', 'indicative']
    ]
  ] as [string[], string[]][])
    ends.forEach((e, p) => add(base + e, [...PERSON_TAGS[p], ...tags]))

  // 虚拟式现在时（tú 后面插一格 vos）
  const subj =
    conj === 'ar' ? ['e', 'es', 'e', 'emos', 'éis', 'en'] : ['a', 'as', 'a', 'amos', 'áis', 'an']
  const vosSubj = conj === 'ar' ? 'és' : 'ás'
  add(form(subj[0], { stressed: true }), [...PERSON_TAGS[0], 'present', 'subjunctive'])
  add(form(subj[1], { stressed: true }), [...PERSON_TAGS[1], 'informal', 'present', 'subjunctive'])
  add(form(vosSubj, { weak: weakIr }), [
    ...PERSON_TAGS[1],
    'informal',
    'present',
    'subjunctive',
    'vos-form'
  ])
  add(form(subj[2], { stressed: true }), [...PERSON_TAGS[2], 'present', 'subjunctive'])
  add(form(subj[3], { weak: weakIr }), [...PERSON_TAGS[3], 'present', 'subjunctive'])
  add(form(subj[4], { weak: weakIr }), [...PERSON_TAGS[4], 'present', 'subjunctive'])
  add(form(subj[5], { stressed: true }), [...PERSON_TAGS[5], 'present', 'subjunctive'])

  // 虚拟式过去时（-ra、-se）与将来时
  const pastSubj: [string[], string[]][] =
    conj === 'ar'
      ? [
          [
            ['ara', 'aras', 'ara', 'áramos', 'arais', 'aran'],
            ['imperfect', 'subjunctive']
          ],
          [
            ['ase', 'ases', 'ase', 'ásemos', 'aseis', 'asen'],
            ['imperfect', 'imperfect-se', 'subjunctive']
          ],
          [
            ['are', 'ares', 'are', 'áremos', 'areis', 'aren'],
            ['future', 'subjunctive']
          ]
        ]
      : [
          [
            ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'],
            ['imperfect', 'subjunctive']
          ],
          [
            ['iese', 'ieses', 'iese', 'iésemos', 'ieseis', 'iesen'],
            ['imperfect', 'imperfect-se', 'subjunctive']
          ],
          [
            ['iere', 'ieres', 'iere', 'iéremos', 'iereis', 'ieren'],
            ['future', 'subjunctive']
          ]
        ]
  for (const [ends, tags] of pastSubj) six(ends, tags, [], weakIr ? ALL : [])

  // 肯定命令式：tú、vos、usted、nosotros、vosotros、ustedes
  add(form(pres[2], { stressed: true }), ['imperative', 'informal', 'second-person', 'singular'])
  add(form(conj === 'ar' ? 'á' : conj === 'er' ? 'é' : 'í'), [
    'imperative',
    'informal',
    'second-person',
    'singular',
    'vos-form'
  ])
  add(form(subj[2], { stressed: true }), ['formal', 'imperative', 'singular', 'third-person'])
  add(form(subj[3], { weak: weakIr }), ['first-person', 'imperative', 'plural'])
  add(form(conj === 'ar' ? 'ad' : conj === 'er' ? 'ed' : 'id'), [
    'imperative',
    'plural',
    'second-person'
  ])
  add(form(subj[5], { stressed: true }), ['formal', 'imperative', 'plural', 'third-person'])
  return rows
}
