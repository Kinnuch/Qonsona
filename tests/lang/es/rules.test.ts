/**
 * 西班牙语的规则：查词键、切词、猜原形。
 * 猜原形按阅读器的用法测：候选按顺序去「变形表」里找，第一个找得到的算数——
 * 这里用一张小变形表（词形 → 原形）代替词典。
 */
import { describe, expect, it } from 'vitest'
import { rules } from '../../../src/shared/lang/es/rules'
import es from '../../../src/shared/lang/es'

/** 小变形表：原形 → 它的几个词形（原形自己也算） */
const TABLE: Record<string, string[]> = {
  dar: ['da', 'dé', 'di', 'dando', 'dad'],
  decir: ['di', 'diga', 'digan', 'diciendo', 'decí', 'decid'],
  ir: ['ve', 'vamos', 'id', 'yendo'],
  hacer: ['haz', 'haga', 'haciendo'],
  poner: ['pon', 'ponga', 'poniendo'],
  sentar: ['sienta', 'siente', 'sentad', 'sentemos', 'sentando'],
  sentir: ['siente', 'sienta', 'sintiendo', 'sentid'],
  contar: ['cuenta', 'cuente', 'contá', 'contando'],
  cuenta: [],
  comer: ['come', 'coma', 'comiendo', 'comed'],
  callar: ['calla', 'calle', 'callad'],
  levantar: ['levanta', 'levante'],
  acordar: ['acuerda', 'acuerde'],
  vestir: ['viste', 'vista', 'vestid', 'vistiendo'],
  leer: ['lee', 'leyendo'],
  dormir: ['duerme', 'durmiendo'],
  pedir: ['pide', 'pidiendo'],
  oír: ['oye', 'oyendo'],
  a: [],
  el: [],
  de: [],
  para: [],
  canción: [],
  examen: [],
  lápiz: [],
  país: [],
  bueno: [],
  profesor: [],
  alemán: [],
  francés: [],
  casa: [],
  perro: [],
  poco: [],
  café: [],
  luz: [],
  rico: [],
  rápido: ['rápida'],
  fácil: [],
  amable: [],
  hablar: [],
  buscar: [],
  vencer: [],
  coger: [],
  construir: [],
  llegar: [],
  empezar: [],
  vivir: [],
  conocer: [],
  te: [],
  joven: [],
  ver: ['viste', 've', 'vea'],
  vista: [],
  seguir: ['sigue', 'siga'],
  traer: ['trae', 'traiga']
}
/** 跟词典里一样难的情况：一个形式既是某个词的原形（cuenta 名词）又是别的词的变形时，原形优先 */
const FORMS = new Map<string, string>()
for (const lemma of Object.keys(TABLE)) FORMS.set(lemma, lemma)
for (const [lemma, forms] of Object.entries(TABLE))
  for (const f of forms) if (!FORMS.has(f)) FORMS.set(f, lemma)

/** 阅读器的做法：按顺序试候选，第一个在变形表里的 */
function guess(surface: string): string | undefined {
  for (const g of rules.lemmaCandidates!(surface)) {
    const hit = FORMS.get(rules.key(g.lemma))
    if (hit) return hit
  }
  return undefined
}

describe('查词键', () => {
  it('小写、NFC、统一撇号，重音符与 ñ 留着', () => {
    expect(rules.key('  Árbol ')).toBe('árbol')
    expect(rules.key('Árbol')).toBe('árbol')
    expect(rules.key('AÑO')).toBe('año')
    expect(rules.key('pa’l')).toBe("pa'l")
    expect(rules.key('sí')).not.toBe(rules.key('si'))
  })
  it('宽松键去掉重音符、ñ、ü 的记号', () => {
    expect(rules.looseKey!('Canción')).toBe('cancion')
    expect(rules.looseKey!('año')).toBe('ano')
    expect(rules.looseKey!('pingüino')).toBe('pinguino')
  })
})

describe('切词', () => {
  const words = (t: string) =>
    rules.tokenize!(t)
      .filter((x) => x.kind !== 'space')
      .map((x) => `${x.kind}:${x.text}`)
  it('¿ ¡ 单独成标点，附着代词的动词是一个词', () => {
    expect(words('¿Qué tal? ¡Dámelo ya!')).toEqual([
      'punct:¿',
      'word:Qué',
      'word:tal',
      'punct:?',
      'punct:¡',
      'word:Dámelo',
      'word:ya',
      'punct:!'
    ])
  })
  it('序数词并成一个数字', () => {
    expect(words('el 1.º de mayo, la 2.ª vez, el 3er piso y el 20.º')).toEqual([
      'word:el',
      'num:1.º',
      'word:de',
      'word:mayo',
      'punct:,',
      'word:la',
      'num:2.ª',
      'word:vez',
      'punct:,',
      'word:el',
      'num:3er',
      'word:piso',
      'word:y',
      'word:el',
      'num:20.º'
    ])
  })
  it('al、del 不拆；段首尾相接覆盖全文', () => {
    const text = 'Voy al mercado del barrio: cuesta 3,50 €.'
    const t = rules.tokenize!(text)
    expect(t.map((x) => x.text).join('')).toBe(text)
    expect(t.filter((x) => x.kind === 'word').map((x) => x.text)).toContain('al')
    expect(t.filter((x) => x.kind === 'num').map((x) => x.text)).toEqual(['3,50'])
  })
})

describe('猜原形', () => {
  it('缩合', () => {
    expect(rules.lemmaCandidates!('al').map((g) => g.lemma)).toEqual(['a', 'el'])
    expect(rules.lemmaCandidates!('del')[0]).toMatchObject({ lemma: 'de', tags: ['contraction'] })
    expect(guess("pa'l")).toBe('para')
  })
  it('附着代词：命令式、不定式、副动词', () => {
    expect(guess('dámelo')).toBe('dar')
    expect(guess('Dímelo')).toBe('decir')
    expect(guess('dígamelo')).toBe('decir')
    expect(guess('diciéndole')).toBe('decir')
    expect(guess('hazlo')).toBe('hacer')
    expect(guess('ponte')).toBe('poner')
    expect(guess('vete')).toBe('ir')
    expect(guess('cuéntame')).toBe('contar')
    expect(guess('cómelo')).toBe('comer')
    expect(guess('cállate')).toBe('callar')
    expect(guess('acuérdate')).toBe('acordar')
    expect(guess('levantarse')).toBe('levantar')
    expect(guess('dárselo')).toBe('dar')
    expect(guess('dándoselo')).toBe('dar')
    expect(guess('leyéndolo')).toBe('leer')
    expect(guess('oírlo')).toBe('oír')
    // 命令式的词干跟名词、别的动词的变形同形时，先认动词的不定式
    expect(guess('vístete')).toBe('vestir')
    expect(guess('síguelo')).toBe('seguir')
    expect(guess('tráelo')).toBe('traer')
  })
  it('附着代词：vosotros、nosotros、usted、voseo', () => {
    expect(guess('sentaos')).toBe('sentar')
    expect(guess('vestíos')).toBe('vestir')
    expect(guess('vámonos')).toBe('ir')
    expect(guess('sentémonos')).toBe('sentar')
    expect(guess('siéntese')).toBe('sentar')
    expect(guess('decime')).toBe('decir')
    expect(guess('contame')).toBe('contar')
  })
  it('附着代词的候选带上标签', () => {
    const g = rules.lemmaCandidates!('dámelo').find((x) => x.lemma === 'da')
    expect(g?.tags).toEqual(['imperative', 'combined-form'])
    const inf = rules.lemmaCandidates!('hacerlo').find((x) => x.lemma === 'hacer')
    expect(inf?.tags).toEqual(['infinitive', 'combined-form'])
  })
  it('复数、阴性、重音符的增减', () => {
    expect(guess('canciones')).toBe('canción')
    expect(guess('exámenes')).toBe('examen')
    expect(guess('jóvenes')).toBe('joven')
    expect(guess('lápices')).toBe('lápiz')
    expect(guess('países')).toBe('país')
    expect(guess('cafés')).toBe('café')
    expect(guess('buenas')).toBe('bueno')
    expect(guess('profesoras')).toBe('profesor')
    expect(guess('alemana')).toBe('alemán')
    expect(guess('francesas')).toBe('francés')
  })
  it('指小词、绝对最高级、-mente', () => {
    expect(guess('casita')).toBe('casa')
    expect(guess('perritos')).toBe('perro')
    expect(guess('poquito')).toBe('poco')
    expect(guess('cafecito')).toBe('café')
    expect(guess('lucecita')).toBe('luz')
    expect(guess('riquísimo')).toBe('rico')
    expect(guess('facilísimo')).toBe('fácil')
    expect(guess('amabilísima')).toBe('amable')
    expect(guess('rápidamente')).toBe('rápido')
  })
  it('规则动词的变位倒推（词典里没有变位表的词）', () => {
    expect(guess('hablábamos')).toBe('hablar')
    expect(guess('hablaron')).toBe('hablar')
    expect(guess('hablaríamos')).toBe('hablar')
    expect(guess('busqué')).toBe('buscar')
    expect(guess('llegué')).toBe('llegar')
    expect(guess('empecé')).toBe('empezar')
    expect(guess('venzo')).toBe('vencer')
    expect(guess('cojo')).toBe('coger')
    expect(guess('conozco')).toBe('conocer')
    expect(guess('construyeron')).toBe('construir')
    expect(guess('vivieran')).toBe('vivir')
    expect(guess('vivíamos')).toBe('vivir')
  })
  it('认不出的不乱猜成虚词；跟对象原型上的名字同形的词不出错', () => {
    expect(guess('tele')).not.toBe('te')
    for (const w of ['constructor', 'toString', '__proto__', 'hasOwnProperty'])
      expect(() => rules.lemmaCandidates!(w)).not.toThrow()
    expect(rules.lemmaCandidates!('Madrid de los Austrias')).toEqual([])
  })
})

describe('学习包的说明', () => {
  it('学习模块已接入；主分级是 CEFR', () => {
    const f = es.spec.features
    expect(f.lexicon).toBe(true)
    expect([
      f.texts,
      f.grammar,
      f.inflection,
      f.phrasebook,
      f.idioms,
      f.stories,
      f.media,
      f.exam
    ]).toEqual(Array(8).fill(true))
    const primary = es.spec.levelSystems.filter((s) => s.primary)
    expect(primary).toHaveLength(1)
    expect(primary[0].id).toBe('cefr')
    expect(primary[0].levels.map((l) => l.id)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
    for (const l of primary[0].levels) expect(l.desc?.zh).toMatch(/DELE/)
  })
})
