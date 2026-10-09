/**
 * 日语阅读器：分句、并词、振假名、罗马音，以及真的 kuromoji + 词典连起来的结果。
 */
import { existsSync } from 'fs'
import { resolve } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import { JaAnalyzer } from '../src/main/ja-analyze'
import { JapaneseDict } from '../src/main/dict'
import { furigana, splitSentences } from '$shared/ja/reader'
import { kanaToRomaji } from '$shared/ja/kana'

const analyzer = new JaAnalyzer(resolve(__dirname, '../node_modules/kuromoji/dict'))
const DB = resolve(__dirname, '../resources/data/ja/dict.sqlite')

describe('分句', () => {
  it('句末标点与换行处断开，空行分段', () => {
    const text = '今日は晴れ。「行こう！」と言った。\n\n二段目です\n三段目？'
    const s = splitSentences(text)
    expect(s.map((x) => text.slice(x.start, x.end))).toEqual([
      '今日は晴れ。',
      '「行こう！」と言った。',
      '二段目です',
      '三段目？'
    ])
    expect(s.map((x) => x.para)).toEqual([0, 0, 1, 2])
  })
})

describe('振假名', () => {
  it('只给汉字注音，送假名照写', () => {
    expect(furigana('食べる', 'たべる')).toEqual([{ text: '食', ruby: 'た' }, { text: 'べる' }])
    expect(furigana('お茶', 'おちゃ')).toEqual([{ text: 'お' }, { text: '茶', ruby: 'ちゃ' }])
    expect(furigana('日本語', 'にほんご')).toEqual([{ text: '日本語', ruby: 'にほんご' }])
    expect(furigana('取り扱い', 'とりあつかい')).toEqual([
      { text: '取', ruby: 'と' },
      { text: 'り' },
      { text: '扱', ruby: 'あつか' },
      { text: 'い' }
    ])
  })
  it('假名词不注音；对不上时整个词注一遍', () => {
    expect(furigana('ケーキ', 'けーき')).toEqual([{ text: 'ケーキ' }])
    expect(furigana('今日', '')).toEqual([{ text: '今日' }])
    expect(furigana('行く', 'くる')).toEqual([{ text: '行く', ruby: 'くる' }])
  })
})

describe('罗马音', () => {
  it('黑本式拼法，长音照假名写', () => {
    expect(kanaToRomaji('たべる')).toBe('taberu')
    expect(kanaToRomaji('しゃしん')).toBe('shashin')
    expect(kanaToRomaji('きっぷ')).toBe('kippu')
    expect(kanaToRomaji('まっちゃ')).toBe('matcha')
    expect(kanaToRomaji('きんえん')).toBe("kin'en")
    expect(kanaToRomaji('けーき')).toBe('keeki')
    expect(kanaToRomaji('とうきょう')).toBe('toukyou')
    expect(kanaToRomaji('ふぁいる')).toBe('fairu')
    expect(kanaToRomaji('ジュース')).toBe('juusu')
  })
})

describe('分析一段日文', () => {
  it('动词连同助动词、て + 非自立动词并成一个词，查词用原形', async () => {
    const a = await analyzer.analyze(
      '毎日日本語を勉強しています。美味しそうなケーキを食べてしまった。'
    )
    const words = a.sentences.flatMap((s) => s.words.filter((w) => w.word))
    const pick = (surface: string): (typeof words)[number] | undefined =>
      words.find((w) => w.surface === surface)
    expect(pick('しています')?.base).toBe('する')
    expect(pick('食べてしまった')?.base).toBe('食べる')
    expect(pick('食べてしまった')?.reading).toBe('たべてしまった')
    expect(pick('美味しそう')?.base).toBe('美味しい')
    expect(pick('ケーキ')).toBeTruthy()
    // 起止位置对得上原文
    for (const w of words) expect(a.text.slice(w.start, w.end)).toBe(w.surface)
  })

  it('语法点带着句子序号与原文位置', async () => {
    const a = await analyzer.analyze('雨が降ったら、行かなければならない。')
    const ids = a.grammar.map((g) => g.id)
    expect(ids).toContain('tara')
    expect(ids).toContain('nakereba')
    // 被 〜なければならない 包住的 〜ない、〜ば 不单列
    expect(ids).not.toContain('ba')
    const g = a.grammar.find((x) => x.id === 'nakereba')!
    expect(a.text.slice(g.start, g.end)).toBe('なければなら')
  })
})

describe.skipIf(!existsSync(DB))('查词典', () => {
  let dict: JapaneseDict
  beforeAll(() => {
    dict = new JapaneseDict(DB)
  })

  it('按读音挑词条，带 JLPT 等级与中文释义', async () => {
    const a = await analyzer.analyze('昨日は友達と映画を見に行きました。', (b, r, i) =>
      dict.word(b, r, i)
    )
    const words = a.sentences[0].words.filter((w) => w.word)
    const eiga = words.find((w) => w.surface === '映画')!
    expect(eiga.jlpt).toBe(5)
    expect(eiga.zh).toBeTruthy()
    const iki = words.find((w) => w.surface === '行きました')!
    expect(iki.base).toBe('行く')
    expect(dict.entry(iki.entryId!)?.kanji.some((f) => f.text === '行く')).toBe(true)
  })

  it('内置词本：每一级 JLPT 的词与数目；按词条号取一批词', () => {
    const counts = dict.jlptCounts()
    expect(Object.keys(counts).sort()).toEqual(['1', '2', '3', '4', '5'])
    const n5 = dict.jlptWords(5)
    expect(n5).toHaveLength(counts[5])
    expect(n5.some((w) => w.head === '子供' && w.reading === 'こども' && w.zh)).toBe(true)
    // 「其れ」这类通常写假名的常用词回到了 N5
    expect(n5.some((w) => w.head === '其れ')).toBe(true)
    const items = dict.wordItems([1307850, 999999999, 1358280])
    expect(items.map((w) => w.head)).toEqual(['子供', '食べる'])
  })

  it('同一个写法按读音分开：日曜日的「日」和「日が昇る」', () => {
    const nichi = dict.word('日', 'にち', false)
    const hi = dict.word('日', 'ひ', false)
    expect(nichi?.entryId).not.toBe(hi?.entryId)
  })
})
