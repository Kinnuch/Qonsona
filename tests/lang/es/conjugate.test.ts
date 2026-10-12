/**
 * 按规则推变位表：拿维基词典变位表里的格子核对（全表的核对见 scripts/data/es/check-conjugate.ts，
 * 词典库里四千多个规则与有变位类别的动词，整表全对 98% 以上；错的多是一个词有两套变位、维基词典并在一张表里的）。
 */
import { describe, expect, it } from 'vitest'
import { conjugate } from '../../../src/shared/lang/es/conjugate'

/** 取某一格：标签按字母排好的写法 */
function cell(verb: string, classes: string[], tags: string): string | undefined {
  const want = tags.split(' ').sort().join(' ')
  return conjugate(verb, classes).find(([, ...t]) => t.join(' ') === want)?.[0]
}

const P1 = 'first-person indicative present singular'
const P3 = 'indicative present singular third-person'
const P4 = 'first-person indicative plural present'
const PRET1 = 'first-person indicative preterite singular'
const PRET3 = 'indicative preterite singular third-person'
const S1 = 'first-person present singular subjunctive'
const S4 = 'first-person plural present subjunctive'

describe('规则动词', () => {
  it('-ar 全表跟维基词典一样（hablar）', () => {
    const t = conjugate('hablar')
    expect(t).toHaveLength(67)
    expect(t[0]).toEqual(['hablando', 'gerund'])
    expect(t.map(([f]) => f).slice(5, 12)).toEqual([
      'hablo',
      'hablas',
      'hablás',
      'habla',
      'hablamos',
      'habláis',
      'hablan'
    ])
    expect(cell('hablar', [], 'first-person imperfect indicative plural')).toBe('hablábamos')
    expect(cell('hablar', [], PRET1)).toBe('hablé')
    expect(cell('hablar', [], 'first-person future plural subjunctive')).toBe('habláremos')
    expect(cell('hablar', [], 'first-person imperfect imperfect-se plural subjunctive')).toBe(
      'hablásemos'
    )
    expect(cell('hablar', [], 'formal imperative plural third-person')).toBe('hablen')
    expect(cell('hablar', [], 'imperative informal second-person singular vos-form')).toBe('hablá')
  })
  it('-er、-ir', () => {
    expect(cell('comer', [], 'indicative informal present second-person singular vos-form')).toBe(
      'comés'
    )
    expect(cell('comer', [], 'first-person imperfect plural subjunctive')).toBe('comiéramos')
    expect(cell('vivir', [], P4)).toBe('vivimos')
    expect(cell('vivir', [], 'imperative plural second-person')).toBe('vivid')
    expect(cell('vivir', [], 'imperative informal second-person singular vos-form')).toBe('viví')
  })
  it('-se 的代词式按不带代词的推', () => {
    expect(cell('lavarse', [], P1)).toBe('lavo')
  })
})

describe('拼写变化', () => {
  it('e 前：c → qu、g → gu、gu → gü、z → c', () => {
    expect(cell('buscar', ['c-qu'], PRET1)).toBe('busqué')
    expect(cell('buscar', ['c-qu'], S1)).toBe('busque')
    expect(cell('llegar', ['g-gu'], PRET1)).toBe('llegué')
    expect(cell('averiguar', ['gu-gü'], S1)).toBe('averigüe')
    expect(cell('cruzar', ['z-c'], PRET1)).toBe('crucé')
  })
  it('a、o 前：c → z、g → j、gu → g、qu → c、c → zc', () => {
    expect(cell('vencer', ['c-z'], P1)).toBe('venzo')
    expect(cell('coger', ['g-j'], S1)).toBe('coja')
    expect(cell('distinguir', ['g-gu'], P1)).toBe('distingo')
    expect(cell('delinquir', ['c-qu'], P1)).toBe('delinco')
    expect(cell('conocer', ['c-zc'], P1)).toBe('conozco')
    expect(cell('conocer', ['c-zc'], S4)).toBe('conozcamos')
  })
  it('元音结尾的词干：y 与重音符', () => {
    expect(cell('leer', [], PRET1)).toBe('leí')
    expect(cell('leer', [], 'indicative preterite second-person singular')).toBe('leíste')
    expect(cell('leer', [], PRET3)).toBe('leyó')
    expect(cell('leer', [], 'gerund')).toBe('leyendo')
    expect(cell('leer', [], 'masculine participle past singular')).toBe('leído')
    expect(cell('leer', [], 'first-person imperfect indicative singular')).toBe('leía')
  })
  it('-uir 插 y；-güir 插 y 时去掉两点', () => {
    expect(cell('construir', [], P1)).toBe('construyo')
    expect(cell('construir', [], P4)).toBe('construimos')
    expect(cell('construir', [], S4)).toBe('construyamos')
    expect(cell('construir', [], PRET3)).toBe('construyó')
    expect(cell('construir', [], 'gerund')).toBe('construyendo')
    expect(cell('argüir', ['gu-gü'], P1)).toBe('arguyo')
  })
  it('ñ、ll 后面去掉 i；单音节不写重音（hui、lie、rio），分读的留着（huía）', () => {
    expect(cell('gruñir', [], PRET3)).toBe('gruñó')
    expect(cell('gruñir', [], 'gerund')).toBe('gruñendo')
    expect(cell('huir', [], PRET1)).toBe('hui')
    expect(cell('huir', [], 'first-person imperfect indicative singular')).toBe('huía')
    expect(cell('liar', ['i-í'], PRET1)).toBe('lie')
    expect(cell('liar', ['i-í'], P1)).toBe('lío')
  })
})

describe('词干变化', () => {
  it('e-ie、o-ue、u-ue（重读时变）', () => {
    expect(cell('pensar', ['e-ie'], P1)).toBe('pienso')
    expect(cell('pensar', ['e-ie'], P4)).toBe('pensamos')
    expect(
      cell('pensar', ['e-ie'], 'indicative informal present second-person singular vos-form')
    ).toBe('pensás')
    expect(cell('contar', ['o-ue'], S1)).toBe('cuente')
    expect(cell('jugar', ['u-ue', 'g-gu'], S1)).toBe('juegue')
    expect(cell('avergonzar', ['o-ue', 'c-z'], P1)).toBe('avergüenzo')
    expect(cell('oler', ['o-hue'], P1)).toBe('huelo')
  })
  it('e-i、e-ie-i、o-ue-u（-ir 动词不重读的格子也变）', () => {
    expect(cell('pedir', ['e-i'], P1)).toBe('pido')
    expect(cell('pedir', ['e-i'], PRET3)).toBe('pidió')
    expect(cell('pedir', ['e-i'], 'gerund')).toBe('pidiendo')
    expect(cell('pedir', ['e-i'], S4)).toBe('pidamos')
    expect(cell('sentir', ['e-ie-i'], P1)).toBe('siento')
    expect(cell('sentir', ['e-ie-i'], PRET3)).toBe('sintió')
    expect(cell('dormir', ['o-ue-u'], P1)).toBe('duermo')
    expect(cell('dormir', ['o-ue-u'], 'first-person imperfect singular subjunctive')).toBe(
      'durmiera'
    )
  })
  it('i-í、u-ú、e-í', () => {
    expect(cell('enviar', ['i-í'], P1)).toBe('envío')
    expect(cell('enviar', ['i-í'], P4)).toBe('enviamos')
    expect(cell('actuar', ['u-ú'], P3)).toBe('actúa')
    expect(cell('reír', ['e-í'], P1)).toBe('río')
    expect(cell('reír', ['e-í'], PRET3)).toBe('rio')
    expect(cell('reír', ['e-í'], P4)).toBe('reímos')
    expect(cell('reír', ['e-í'], S4)).toBe('riamos')
    expect(cell('reír', ['e-í'], 'gerund')).toBe('riendo')
  })
  it('认不出的不出表', () => {
    expect(conjugate('casa')).toEqual([])
  })
})
