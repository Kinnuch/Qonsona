/**
 * 西班牙语的拼读：音节、重音、推出来的 IPA。
 * 期望值取自英文维基词典 {{es-pr}} 给的音位标音（同一套写法），能对上就说明规则可以替没有 IPA 的词补上。
 */
import { describe, expect, it } from 'vitest'
import {
  ipaVariants,
  needsAcute,
  stressedSyllable,
  syllables,
  toIpa
} from '../../../src/shared/lang/es/phonology'

describe('音节与重音', () => {
  it('切音节：二合元音不拆，两个强元音、带重音符的 í ú 拆开', () => {
    expect(syllables('casa')).toEqual(['ca', 'sa'])
    expect(syllables('ciudad')).toEqual(['ciu', 'dad'])
    expect(syllables('país')).toEqual(['pa', 'ís'])
    expect(syllables('construir')).toEqual(['cons', 'truir'])
    expect(syllables('perro')).toEqual(['pe', 'rro'])
    expect(syllables('calle')).toEqual(['ca', 'lle'])
    expect(syllables('atleta')).toEqual(['at', 'le', 'ta'])
    expect(syllables('leer')).toEqual(['le', 'er'])
    expect(syllables('guitarra')).toEqual(['gui', 'ta', 'rra'])
  })
  it('重音：写了重音符的；元音、n、s 结尾在倒数第二个；别的在最后', () => {
    expect(stressedSyllable('casa')).toBe(0)
    expect(stressedSyllable('hablan')).toBe(0)
    expect(stressedSyllable('reloj')).toBe(1)
    expect(stressedSyllable('canción')).toBe(1)
    expect(stressedSyllable('rápido')).toBe(0)
    expect(stressedSyllable('estoy')).toBe(1)
  })
  it('要不要写重音符', () => {
    expect(needsAcute('dame', 0)).toBe(false)
    expect(needsAcute('damelo', 0)).toBe(true)
    expect(needsAcute('cancion', 1)).toBe(true)
  })
})

describe('IPA（跟维基词典的音位标音一致）', () => {
  const cases: [string, string, string?][] = [
    // [词, distinción, seseo（不同时才写）]
    ['casa', '/ˈkasa/'],
    ['zapato', '/θaˈpato/', '/saˈpato/'],
    ['cielo', '/ˈθjelo/', '/ˈsjelo/'],
    ['hacer', '/aˈθeɾ/', '/aˈseɾ/'],
    ['ciudad', '/θjuˈdad/', '/sjuˈdad/'],
    ['noche', '/ˈnot͡ʃe/'],
    ['guerra', '/ˈɡera/'],
    ['guitarra', '/ɡiˈtara/'],
    ['agüero', '/aˈɡweɾo/'],
    ['carro', '/ˈkaro/'],
    ['honra', '/ˈonra/'],
    ['alrededor', '/alredeˈdoɾ/'],
    ['enrique', '/enˈrike/'],
    ['israelí', '/israeˈli/'],
    ['reloj', '/reˈlox/'],
    ['examen', '/eɡˈsamen/'],
    ['taxi', '/ˈtaɡsi/'],
    ['éxito', '/ˈeɡsito/'],
    ['méxico', '/ˈmexiko/'],
    ['pingüino', '/pinˈɡwino/'],
    ['cuidar', '/kwiˈdaɾ/'],
    ['búho', '/ˈbuo/'],
    ['ahí', '/aˈi/'],
    ['leer', '/leˈeɾ/'],
    ['muy', '/ˈmwi/'],
    ['hoy', '/ˈoi/'],
    ['rey', '/ˈrei/'],
    ['aire', '/ˈaiɾe/'],
    ['causa', '/ˈkausa/'],
    ['buey', '/ˈbwei/'],
    ['ahumar', '/auˈmaɾ/'],
    ['prohibir', '/pɾoiˈbiɾ/'],
    ['apto', '/ˈabto/'],
    ['ritmo', '/ˈridmo/'],
    ['técnico', '/ˈteɡniko/'],
    ['concepto', '/konˈθebto/', '/konˈsebto/'],
    ['objeto', '/obˈxeto/'],
    ['absoluto', '/absoˈluto/'],
    ['adquirir', '/adkiˈɾiɾ/'],
    ['admirar', '/admiˈɾaɾ/'],
    ['enviar', '/emˈbjaɾ/'],
    ['hambre', '/ˈambɾe/'],
    ['himno', '/ˈimno/'],
    ['robot', '/roˈbot/'],
    ['club', '/ˈklub/'],
    ['bíceps', '/ˈbiθebs/', '/ˈbisebs/'],
    ['psicología', '/sikoloˈxia/'],
    ['gnomo', '/ˈnomo/'],
    ['digno', '/ˈdiɡno/'],
    ['instante', '/insˈtante/'],
    ['obstáculo', '/obsˈtakulo/'],
    ['perspectiva', '/peɾspeɡˈtiba/'],
    ['transporte', '/tɾansˈpoɾte/'],
    ['problema', '/pɾoˈblema/'],
    ['rápidamente', '/ˌrapidaˈmente/'],
    ['de nada', '/de ˈnada/'],
    ['buenos días', '/ˌbwenos ˈdias/'],
    ['piscina', '/pisˈθina/', '/piˈsina/'],
    ['excelente', '/eɡsθeˈlente/', '/eɡseˈlente/'],
    ['hielo', '/ˈʝelo/'],
    ['hueso', '/ˈw̝eso/'],
    ['yo', '/ˈʝo/'],
    ['mayo', '/ˈmaʝo/']
  ]
  for (const [word, dist, ses] of cases)
    it(word, () => {
      expect(toIpa(word)).toBe(dist)
      expect(toIpa(word, { seseo: true })).toBe(ses ?? dist)
    })
  it('ll：yeísmo 读 ʝ，lleísmo 读 ʎ', () => {
    expect(toIpa('llave')).toBe('/ˈʝabe/')
    expect(toIpa('llave', { lleismo: true })).toBe('/ˈʎabe/')
    expect(ipaVariants('cebolla').map((v) => v.ipa)).toEqual([
      '/θeˈboʝa/',
      '/seˈboʝa/',
      '/θeˈboʎa/',
      '/seˈboʎa/'
    ])
    expect(ipaVariants('casa')).toEqual([{ ipa: '/ˈkasa/', v: '' }])
  })
})
