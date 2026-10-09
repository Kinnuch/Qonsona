/**
 * 俄语规则：查词键、宽松键、切词、猜原形、记号、转写、拉丁字母输入。
 */
import { describe, expect, it } from 'vitest'
import {
  key,
  latinToCyrillic,
  lemmaCandidates,
  looseKey,
  marks,
  romanize,
  stripStress,
  stripYo,
  tokenize
} from '../../../src/shared/lang/ru/rules'
import ru from '../../../src/shared/lang/ru'
import { primarySystem } from '../../../src/shared/lang/levels'

const ACUTE = String.fromCharCode(0x301)
const GRAVE = String.fromCharCode(0x300)

describe('查词键', () => {
  it('小写、去掉重音符号，保留 ё 与 й', () => {
    expect(key('Молоко' + ACUTE)).toBe('молоко')
    expect(key('молоко' + ACUTE)).toBe('молоко')
    expect(key('ЕЩЁ')).toBe('ещё')
    expect(key('ещё' + ACUTE)).toBe('ещё')
    expect(key('Мой')).toBe('мой')
    expect(key('двухэта' + GRAVE + 'жный')).toBe('двухэтажный')
    // 次重音写成预组合的 ѐ、ѝ 也去掉
    expect(key('ѝ')).toBe('и')
  })
  it('俄语词里混进的拉丁形近字母换成西里尔字母', () => {
    // молокó：最后一个是拉丁字母 ó（有人这样标重音）
    expect(key('молок' + 'ó')).toBe('молоко')
    // 整个词混了拉丁 a、o、e
    expect(key('мaмa')).toBe('мама')
    expect(key('eщë')).toBe('ещё')
    // 纯拉丁字母的词不动
    expect(key('Moscow')).toBe('moscow')
  })
  it('连字符统一，软连字符去掉', () => {
    expect(key('кто\u{2011}то')).toBe('кто-то')
    expect(key('кто\u{2010}то')).toBe('кто-то')
    expect(key('учи\u{AD}тель')).toBe('учитель')
  })
})

describe('宽松键', () => {
  it('ё → е，重音去掉', () => {
    expect(looseKey('ещё')).toBe('еще')
    expect(looseKey('Ёлка' + ACUTE)).toBe('елка')
    expect(looseKey('всё')).toBe('все')
  })
  it('й 不动', () => {
    expect(looseKey('мой')).toBe('мой')
    expect(looseKey('мой')).not.toBe(looseKey('мои'))
  })
  it('旧正字法对到今天的写法', () => {
    expect(looseKey('сѣверъ')).toBe('север')
    expect(looseKey('Россія')).toBe('россия')
    expect(looseKey('миръ')).toBe('мир')
    // 词中的 ъ 不动
    expect(looseKey('объём')).toBe('объем')
  })
})

describe('切词', () => {
  const words = (s: string): string[] =>
    tokenize(s)
      .filter((t) => t.kind === 'word')
      .map((t) => t.text)
  it('连字符连着的词并成一个', () => {
    expect(words('Кто-то сказал что-нибудь по-русски.')).toEqual([
      'Кто-то',
      'сказал',
      'что-нибудь',
      'по-русски'
    ])
    expect(words('Из-за дождя мы поехали в Ростов-на-Дону.')).toContain('Ростов-на-Дону')
    expect(words('Из-за дождя')).toEqual(['Из-за', 'дождя'])
  })
  it('前后有空格的破折号不并', () => {
    expect(words('Москва - столица')).toEqual(['Москва', 'столица'])
    expect(words('Москва — столица России')).toEqual(['Москва', 'столица', 'России'])
  })
  it('重音符号留在词里，切出的段首尾相接', () => {
    const text = 'Я пью молоко' + ACUTE + ', а ты — чай?'
    const t = tokenize(text)
    expect(t.map((x) => x.text).join('')).toBe(text)
    expect(t.find((x) => x.text.startsWith('молоко'))?.text).toBe('молоко' + ACUTE)
    for (let i = 1; i < t.length; i++) expect(t[i].start).toBe(t[i - 1].end)
  })
  it('数字与序数词尾', () => {
    const t = tokenize('Это 1-й урок, 2024 год.')
    expect(t.find((x) => x.text === '1-й')).toBeTruthy()
    expect(t.find((x) => x.text === '2024')?.kind).toBe('num')
  })
})

describe('猜原形', () => {
  const lemmas = (s: string): string[] => lemmaCandidates(s).map((g) => g.lemma)
  it('形动词、形容词的各格 → 阳性单数一格', () => {
    expect(lemmas('говорящая')).toContain('говорящий')
    expect(lemmas('прочитанной')).toContain('прочитанный')
    expect(lemmas('красивого')).toContain('красивый')
    expect(lemmas('русскому')).toContain('русский')
    expect(lemmas('большие')).toContain('большой')
  })
  it('反身形动词补回 -ся', () => {
    expect(lemmas('улыбающаяся')).toContain('улыбающийся')
  })
  it('短尾被动形动词', () => {
    expect(lemmas('сделана')).toContain('сделанный')
    expect(lemmas('открыт')).toContain('открытый')
    expect(lemmas('решён')).toContain('решённый')
  })
  it('比较级、最高级', () => {
    expect(lemmas('побольше')).toContain('больше')
    expect(lemmas('наилучший')).toContain('лучший')
    expect(lemmas('интереснейший')).toContain('интересный')
  })
  it('连字符后的语气词', () => {
    const g = lemmaCandidates('сказал-то')
    expect(g[0]).toEqual({ lemma: 'сказал', tags: ['particle'] })
    expect(lemmas('кое-кого')).toContain('кого')
  })
  it('动词与名词的规则变化', () => {
    expect(lemmas('читаешь')).toContain('читать')
    expect(lemmas('рисуют')).toContain('рисовать')
    expect(lemmas('говорили')).toContain('говорить')
    expect(lemmas('улыбалась')).toContain('улыбаться')
    expect(lemmas('книгами')).toContain('книга')
    expect(lemmas('столов')).toContain('стол')
    expect(lemmas('зданиях')).not.toContain('зданиях')
  })
  it('不猜自己、不猜拉丁字母的词，数量有上限', () => {
    expect(lemmas('стол')).not.toContain('стол')
    expect(lemmaCandidates('table')).toEqual([])
    expect(lemmaCandidates('переговорившимися').length).toBeLessThanOrEqual(40)
  })
})

describe('记号', () => {
  it('重音符号、ё 的两点都能去掉', () => {
    expect(marks.map((m) => m.id)).toEqual(['stress', 'yo'])
    expect(stripStress('Молоко' + ACUTE + ' и мёд')).toBe('Молоко и мёд')
    expect(stripYo('Ёлка и ещё')).toBe('Елка и еще')
    // 去重音不碰 й 与 ё
    expect(stripStress('ещё мой')).toBe('ещё мой')
  })
})

describe('转写', () => {
  it('学术转写，重音带到拉丁字母上', () => {
    expect(romanize('молоко' + ACUTE)).toBe('molokó')
    expect(romanize('щука')).toBe('ščuka')
    expect(romanize('жёлтый')).toBe('žëltyj')
    expect(romanize('объём')).toBe('obʺëm')
    expect(romanize('съесть')).toBe('sʺestʹ')
    expect(romanize('это')).toBe('èto')
    expect(romanize('юла и яма')).toBe('jula i jama')
    expect(romanize('хорошо')).toBe('xorošo')
    expect(romanize('цирк')).toBe('cirk')
  })
  it('大小写', () => {
    expect(romanize('Щука')).toBe('Ščuka')
    expect(romanize('СССР')).toBe('SSSR')
    expect(romanize('ЩИ')).toBe('ŠČI')
    expect(romanize('Я')).toBe('Ja')
    expect(romanize('Москва, 2024!')).toBe('Moskva, 2024!')
  })
})

describe('拉丁字母输入', () => {
  it('常见的拼法都能转回西里尔字母', () => {
    expect(latinToCyrillic('privet')).toEqual(['привет'])
    expect(latinToCyrillic('spasibo')).toEqual(['спасибо'])
    expect(latinToCyrillic('khorosho')[0]).toBe('хорошо')
    expect(latinToCyrillic('horosho')[0]).toBe('хорошо')
    expect(latinToCyrillic('zdravstvuyte')[0]).toBe('здравствуйте')
    expect(latinToCyrillic('novyy')[0]).toBe('новый')
    expect(latinToCyrillic('moy')[0]).toBe('мой')
    expect(latinToCyrillic('shchi')[0]).toBe('щи')
    expect(latinToCyrillic('ščuka')[0]).toBe('щука')
    expect(latinToCyrillic("ochen'")[0]).toBe('очень')
    expect(latinToCyrillic("schast'ye")[0]).toBe('счастье')
    expect(latinToCyrillic('yolka')[0]).toBe('ёлка')
  })
  it('词首的 e 另给 э', () => {
    expect(latinToCyrillic('eto')).toEqual(['ето', 'это'])
  })
  it('不是拉丁字母拼的给空', () => {
    expect(latinToCyrillic('привет')).toEqual([])
    expect(latinToCyrillic('2024')).toEqual([])
  })
})

describe('学习包的描述', () => {
  it('主分级是 ТРКИ 六级，对着 CEFR', () => {
    const p = primarySystem(ru.spec.levelSystems)
    expect(p.id).toBe('torfl')
    expect(p.levels.map((l) => l.id)).toEqual(['teu', 'tbu', 'trki1', 'trki2', 'trki3', 'trki4'])
    expect(Object.values(p.cefr ?? {})).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
    for (const l of p.levels) expect(l.desc?.zh && l.desc.en).toBeTruthy()
  })
  it('阶段一只开词典', () => {
    const f = ru.spec.features
    expect(f.lexicon).toBe(true)
    expect(f.texts || f.grammar || f.inflection || f.exam || f.romanization).toBe(false)
    expect(ru.rules.key).toBe(key)
  })
})
