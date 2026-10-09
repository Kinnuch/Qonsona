/**
 * 法语规则：查词键、宽松键、切词（省音、连字符挂的代词、复合词、数字）、猜原形。
 */
import { describe, expect, it } from 'vitest'
import { frKey, frLooseKey, lemmaCandidates, tokenize } from '../../../src/shared/lang/fr/rules'
import fr from '../../../src/shared/lang/fr'

/** 只看词（去掉空白），标点照留 */
const words = (text: string): string[] =>
  tokenize(text)
    .filter((t) => t.kind !== 'space')
    .map((t) => t.text)

const lemmas = (w: string): string[] => lemmaCandidates(w).map((g) => g.lemma)

describe('查词键', () => {
  it('小写、NFC、撇号与连字符统一', () => {
    expect(frKey('L’Été')).toBe("l'été")
    expect(frKey('Cafe\u0301')).toBe('café')
    expect(frKey('porte\u2011monnaie')).toBe('porte-monnaie')
    expect(frKey('  ŒUVRE ')).toBe('œuvre')
    expect(frKey('quatre\u00a0cents')).toBe('quatre cents')
    expect(frKey('dé\u00adjà')).toBe('déjà')
  })
  it('宽松键去重音、拆 œ æ、连字符当空格', () => {
    expect(frLooseKey('Élève')).toBe('eleve')
    expect(frLooseKey('cœur')).toBe('coeur')
    expect(frLooseKey('Lætitia')).toBe('laetitia')
    expect(frLooseKey('garçon')).toBe('garcon')
    expect(frLooseKey('porte-monnaie')).toBe('porte monnaie')
    expect(frLooseKey('est-ce que')).toBe('est ce que')
    expect(frLooseKey('-ment')).toBe('-ment')
    expect(frLooseKey("aujourd'hui")).toBe("aujourd'hui")
  })
  it('规则对象用的就是这两个函数', () => {
    expect(fr.rules.key('Été')).toBe('été')
    expect(fr.rules.looseKey?.('Été')).toBe('ete')
    expect(fr.rules.tokenize).toBeTypeOf('function')
  })
})

describe('切词', () => {
  it('各段首尾相接覆盖全文', () => {
    const text =
      "« L'homme qu'on voit là-bas, dit-il, n'est-ce pas ? » — Peut-être…\n3 000 €, le 1er mai."
    const t = tokenize(text)
    expect(t.map((x) => x.text).join('')).toBe(text)
    for (let i = 0; i < t.length; i++) {
      expect(t[i].end - t[i].start).toBe(t[i].text.length)
      expect(text.slice(t[i].start, t[i].end)).toBe(t[i].text)
      if (i) expect(t[i].start).toBe(t[i - 1].end)
    }
  })
  it('省音拆开', () => {
    expect(words("l'homme")).toEqual(["l'", 'homme'])
    expect(words('L’Europe')).toEqual(['L’', 'Europe'])
    expect(words("qu'il s'en va")).toEqual(["qu'", 'il', "s'", 'en', 'va'])
    expect(words("j'ai")).toEqual(["j'", 'ai'])
    expect(words("lorsqu'elle")).toEqual(["lorsqu'", 'elle'])
    expect(words("d'aujourd'hui")).toEqual(["d'", "aujourd'hui"])
    expect(words("c'est")).toEqual(["c'", 'est'])
  })
  it('整个是一个词的不拆', () => {
    expect(words("aujourd'hui")).toEqual(["aujourd'hui"])
    expect(words("jusqu'à demain")).toEqual(["jusqu'à", 'demain'])
    expect(words('jusqu’au bout')).toEqual(['jusqu’au', 'bout'])
    expect(words("quelqu'un")).toEqual(["quelqu'un"])
    expect(words("presqu'île")).toEqual(["presqu'île"])
    expect(words("prud'hommes")).toEqual(["prud'hommes"])
    expect(words("c'est-à-dire")).toEqual(["c'est-à-dire"])
    expect(words("un chef-d'œuvre")).toEqual(['un', "chef-d'œuvre"])
    expect(words('rendez-vous')).toEqual(['rendez-vous'])
    expect(words("rock'n'roll")).toEqual(["rock'n'roll"])
  })
  it('倒装、命令式挂的代词拆开，复合词不拆', () => {
    expect(words('dit-il')).toEqual(['dit', '-', 'il'])
    expect(words('a-t-il')).toEqual(['a', '-t-', 'il'])
    expect(words('Y a-t-il')).toEqual(['Y', 'a', '-t-', 'il'])
    expect(words('est-ce que')).toEqual(['est', '-', 'ce', 'que'])
    expect(words("Qu'est-ce que c'est")).toEqual(["Qu'", 'est', '-', 'ce', 'que', "c'", 'est'])
    expect(words('donne-le-moi')).toEqual(['donne', '-', 'le', '-', 'moi'])
    expect(words("va-t'en")).toEqual(['va', '-', "t'", 'en'])
    expect(words('allez-y')).toEqual(['allez', '-', 'y'])
    expect(words('ce jour-là')).toEqual(['ce', 'jour', '-', 'là'])
    expect(words('celui-ci')).toEqual(['celui-ci'])
    expect(words('jusque-là')).toEqual(['jusque-là'])
    expect(words('peut-être')).toEqual(['peut-être'])
    expect(words('après-midi')).toEqual(['après-midi'])
    expect(words('porte-monnaie')).toEqual(['porte-monnaie'])
    expect(words('arc-en-ciel')).toEqual(['arc-en-ciel'])
    expect(words('vingt-deux')).toEqual(['vingt-deux'])
    expect(words('moi-même')).toEqual(['moi-même'])
    expect(words('là-bas')).toEqual(['là-bas'])
    expect(words('COVID-19')).toEqual(['COVID-19'])
  })
  it('数字、序数、标点', () => {
    const t = tokenize('3 000 €, 3,5 %, le 1er mai, le XXIe siècle, 2e…')
    expect(t.filter((x) => x.kind === 'num').map((x) => x.text)).toEqual([
      '3 000',
      '3,5',
      '1er',
      '2e'
    ])
    expect(t.filter((x) => x.kind === 'word').map((x) => x.text)).toEqual([
      'le',
      'mai',
      'le',
      'XXIe',
      'siècle'
    ])
    expect(words('Quoi ?!')).toEqual(['Quoi', '?!'])
    expect(words('Bon...')).toEqual(['Bon', '...'])
    expect(words("'Salut'")).toEqual(["'", 'Salut', "'"])
  })
})

describe('猜原形', () => {
  it('省音、缩合、挂着的代词', () => {
    expect(lemmas("l'")).toEqual(['le', 'la'])
    expect(lemmas("qu'")).toEqual(['que'])
    expect(lemmas('L’homme')[0]).toBe('homme')
    expect(lemmas('au')).toEqual(['à', 'le'])
    expect(lemmas('dit-il')).toContain('dit')
    expect(lemmas('dit-il')).toContain('dire')
    expect(lemmas('donne-le-moi')[0]).toBe('donne')
    expect(lemmas('donne-le-moi')).toContain('donner')
  })
  it('复数与阴性', () => {
    expect(lemmas('chevaux')).toContain('cheval')
    expect(lemmas('travaux')).toContain('travail')
    expect(lemmas('bijoux')).toContain('bijou')
    expect(lemmas('yeux')).toEqual(['œil'])
    expect(lemmas('heureuse')).toContain('heureux')
    expect(lemmas('danseuses')).toContain('danseur')
    expect(lemmas('actrice')).toContain('acteur')
    expect(lemmas('active')).toContain('actif')
    expect(lemmas('anciennes')).toContain('ancien')
    expect(lemmas('première')).toContain('premier')
    expect(lemmas('belle')).toContain('beau')
    expect(lemmas('grandes')).toContain('grand')
  })
  it('动词变位（含第一组的拼写变化）', () => {
    expect(lemmas('parlons')).toContain('parler')
    expect(lemmas('parlerions')).toContain('parler')
    expect(lemmas('finissaient')).toContain('finir')
    expect(lemmas('vendu')).toContain('vendre')
    expect(lemmas('plaçons')).toContain('placer')
    expect(lemmas('mangeait')).toContain('manger')
    expect(lemmas('lève')).toContain('lever')
    expect(lemmas('cède')).toContain('céder')
    expect(lemmas('appelle')).toContain('appeler')
    expect(lemmas('jettent')).toContain('jeter')
    expect(lemmas('paie')).toContain('payer')
    expect(lemmas('emploient')).toContain('employer')
    expect(lemmas('googlé')).toContain('googler')
  })
  it('-ment 副词', () => {
    expect(lemmas('rapidement')).toContain('rapide')
    expect(lemmas('heureusement')).toContain('heureux')
    expect(lemmas('couramment')).toContain('courant')
    expect(lemmas('évidemment')).toContain('évident')
    expect(lemmas('vraiment')).toContain('vrai')
    expect(lemmas('absolument')).toContain('absolu')
  })
  it('不会把原词当候选，也不出空串', () => {
    for (const w of ['parler', 'chat', 'x', '', "aujourd'hui", '1er'])
      for (const g of lemmaCandidates(w)) {
        expect(g.lemma).not.toBe(frKey(w))
        expect(g.lemma.length).toBeGreaterThan(0)
      }
  })
})
