/**
 * 阿拉伯语的规则：查词键（去元音符号、统一字形）、宽松键、切词、剥附着词猜原形、元音符号开关、转写。
 */
import { describe, expect, it } from 'vitest'
import {
  CLITICS,
  arKey,
  arLemmaCandidates,
  arLooseKey,
  arRomanize,
  arTokenize,
  hasVowelMarks,
  rules,
  stripShadda,
  stripVowels
} from '../../../src/shared/lang/ar/rules'
import ar from '../../../src/shared/lang/ar'

describe('查词键', () => {
  it('去掉元音符号、叠音符、延长线，保留 hamza、ة、ى 的写法', () => {
    expect(arKey('كِتَابٌ')).toBe('كتاب')
    expect(arKey('الْكِتَابُ')).toBe('الكتاب')
    expect(arKey('كـتـاب')).toBe('كتاب')
    expect(arKey('مُدَرِّسَةٌ')).toBe('مدرسة')
    expect(arKey('أَكَلَ')).toBe('أكل')
    expect(arKey('إِلَى')).toBe('إلى')
    expect(arKey('مَسْؤُول')).toBe('مسؤول')
    expect(arKey('هٰذَا')).toBe('هذا')
    expect(arKey('ٱلْكِتَاب')).toBe('الكتاب')
  })
  it('连字、波斯语字母、阿拉伯-印度数字、双向控制符', () => {
    expect(arKey('\u{fefb}')).toBe('لا')
    expect(arKey('\u{fdf2}')).toBe('الله')
    expect(arKey('کتاب')).toBe('كتاب')
    expect(arKey('\u{200f}كتاب\u{200e}')).toBe('كتاب')
    expect(arKey('٢٠٢٤')).toBe('2024')
    expect(arKey('۱۲')).toBe('12')
    expect(arKey('Kitāb  AL-ʿArab')).toBe('kitāb al-ʿarab')
  })
  it('键是幂等的', () => {
    for (const w of ['كِتَابٌ', 'وَالْكِتَابُ', 'Kitāb', '٣٫٥', 'ﻻ', 'ٱتَّحِدُوا'])
      expect(arKey(arKey(w))).toBe(arKey(w))
  })
  it('宽松键：alif 的各种写法、ى/ي、ة/ه；转写去掉长音符、点与 ʿ ʾ', () => {
    expect(arLooseKey('أحمد')).toBe('احمد')
    expect(arLooseKey('إِلَى')).toBe('الي')
    expect(arLooseKey('آخر')).toBe('اخر')
    expect(arLooseKey('مدرسة')).toBe('مدرسه')
    expect(arLooseKey('مسؤول')).toBe('مسؤول')
    expect(arLooseKey('kitāb')).toBe('kitab')
    expect(arLooseKey('al-ʿarabiyya')).toBe('alarabiyya')
    expect(arLooseKey('ḍarb')).toBe('darb')
    // 宽松键也要幂等（写库时 key 与 looseKey 一样就不另存）
    for (const w of ['أحمد', 'مدرسة', 'kitāb', 'إلى'])
      expect(arLooseKey(arLooseKey(w))).toBe(arLooseKey(w))
  })
})

describe('切词', () => {
  it('附着词不切开；阿拉伯语标点、阿拉伯-印度数字、字母跟数字连写', () => {
    const text = 'وَالْكِتَابُ، كـتـاب؟ «مرحباً» ٣٫٥ و١٢٣ كوفيد-19؛'
    const t = arTokenize(text)
    expect(t.map((x) => x.text).join('')).toBe(text)
    for (let i = 1; i < t.length; i++) expect(t[i].start).toBe(t[i - 1].end)
    const words = t.filter((x) => x.kind === 'word').map((x) => x.text)
    expect(words).toEqual(['وَالْكِتَابُ', 'كـتـاب', 'مرحباً', 'و', 'كوفيد'])
    expect(t.filter((x) => x.kind === 'num').map((x) => x.text)).toEqual(['٣٫٥', '١٢٣', '19'])
    expect(t.filter((x) => x.kind === 'punct').map((x) => x.text)).toEqual([
      '،',
      '؟',
      '«',
      '»',
      '-',
      '؛'
    ])
  })
})

describe('猜原形（剥附着词）', () => {
  const guess = (w: string): string[] => arLemmaCandidates(w).map((g) => g.lemma)
  const tagsOf = (w: string, lemma: string): string[] | undefined =>
    arLemmaCandidates(w).find((g) => arKey(g.lemma) === lemma)?.tags
  it('连词、介词、冠词（含 لل）', () => {
    expect(guess('والكتاب')).toEqual(expect.arrayContaining(['الكتاب', 'كتاب']))
    expect(tagsOf('والكتاب', 'كتاب')).toEqual(['conj-wa', 'definite'])
    expect(tagsOf('بالكتاب', 'الكتاب')).toEqual(['prep-bi'])
    expect(tagsOf('بالكتاب', 'كتاب')).toEqual(['prep-bi', 'definite'])
    expect(tagsOf('للكتاب', 'كتاب')).toEqual(['prep-li', 'definite'])
    expect(tagsOf('وللكتاب', 'كتاب')).toEqual(['conj-wa', 'prep-li', 'definite'])
    expect(guess('لليل')).toContain('ليل')
    expect(tagsOf('لله', 'الله')).toEqual(['prep-li'])
    expect(tagsOf('فقال', 'قال')).toEqual(['conj-fa'])
    expect(tagsOf('كالبحر', 'بحر')).toEqual(['prep-ka', 'definite'])
  })
  it('将来时 سـ 只加在未完成体前', () => {
    expect(tagsOf('سيكتبون', 'يكتبون')).toEqual(['fut-sa'])
    expect(tagsOf('وسيكتبونها', 'يكتبون')).toEqual(['conj-wa', 'fut-sa', 'pron-3fs'])
    expect(guess('سلام')).not.toContain('لام')
  })
  it('后附代词，并还原词干的写法', () => {
    expect(tagsOf('كتابه', 'كتاب')).toEqual(['pron-3ms'])
    expect(tagsOf('كتابها', 'كتاب')).toEqual(['pron-3fs'])
    expect(tagsOf('كتابهما', 'كتاب')).toEqual(['pron-3d'])
    expect(tagsOf('كتابكم', 'كتاب')).toEqual(['pron-2mp'])
    expect(tagsOf('كتابي', 'كتاب')).toEqual(['pron-1s'])
    expect(tagsOf('مدرستها', 'مدرسة')).toEqual(['pron-3fs'])
    expect(tagsOf('عليه', 'على')).toEqual(['pron-3ms'])
    expect(tagsOf('إليك', 'إلى')).toEqual(['pron-2s'])
    expect(tagsOf('كتبوه', 'كتبوا')).toEqual(['pron-3ms'])
    expect(tagsOf('سماؤه', 'سماء')).toEqual(['pron-3ms'])
    expect(tagsOf('رآه', 'رأى')).toEqual(['pron-3ms'])
    expect(tagsOf('يعطيني', 'يعطي')).toEqual(['pron-1s'])
    expect(tagsOf('وبيته', 'بيت')).toEqual(['conj-wa', 'pron-3ms'])
  })
  it('不定宾格的 alif', () => {
    expect(tagsOf('كتابا', 'كتاب')).toEqual(['accusative'])
    expect(guess('سماءا')).not.toContain('سماء')
  })
  it('剥得少的在前；保留原文的元音符号；太阳字母的同化叠音去掉', () => {
    const g = arLemmaCandidates('وَالْكِتَابُ')
    expect(g[0]).toEqual({ lemma: 'الْكِتَابُ', tags: ['conj-wa'] })
    expect(g).toContainEqual({ lemma: 'كِتَابُ', tags: ['conj-wa', 'definite'] })
    expect(arLemmaCandidates('الشَّمْسُ')).toContainEqual({ lemma: 'شَمْسُ', tags: ['definite'] })
    const costs = arLemmaCandidates('وبكتابهم').map((x) => x.tags.length)
    expect([...costs].sort((a, b) => a - b)).toEqual(costs)
  })
  it('太短的词不猜；每个代号都有说明', () => {
    expect(arLemmaCandidates('من')).toEqual([])
    for (const w of ['وبكتابهم', 'فللمدرسة', 'سيقولونها', 'كتابا', 'لله'])
      for (const g of arLemmaCandidates(w)) for (const t of g.tags) expect(CLITICS[t]).toBeTruthy()
  })
})

describe('元音符号开关', () => {
  it('元音符号与叠音符分开去', () => {
    expect(stripVowels('كَتَبَ')).toBe('كتب')
    expect(stripVowels('مُدَرِّسٌ')).toBe('مدرّس')
    expect(stripShadda(stripVowels('مُدَرِّسٌ'))).toBe('مدرس')
    expect(stripVowels('ٱلْكِتَابُ')).toBe('الكتاب')
    expect(stripVowels('كِتَابًا')).toBe('كتابا')
    expect(hasVowelMarks('كتاب')).toBe(false)
    expect(hasVowelMarks('كِتَاب')).toBe(true)
    expect(ar.rules.marks?.map((m) => m.id)).toEqual(['harakat', 'shadda'])
  })
})

describe('转写', () => {
  const cases: [string, string][] = [
    ['كِتَاب', 'kitāb'],
    ['كَتَبَ', 'kataba'],
    ['يَكْتُبُ', 'yaktubu'],
    ['الْكِتَاب', 'al-kitāb'],
    ['الشَّمْس', 'ash-shams'],
    ['اللُّغَة', 'al-lugha'],
    ['الْأَرْض', 'al-arḍ'],
    ['مَدْرَسَة', 'madrasa'],
    ['مَدْرَسَةٌ', 'madrasatun'],
    ['حَيَاة', 'ḥayāh'],
    ['كَتَبُوا', 'katabū'],
    ['قَوْل', 'qawl'],
    ['بَيْت', 'bayt'],
    ['عَرَبِيّ', 'ʿarabī'],
    ['عَرَبِيَّة', 'ʿarabiyya'],
    ['أَكَلَ', 'akala'],
    ['سَأَلَ', 'saʾala'],
    ['سَمَاءٌ', 'samāʾun'],
    ['كِتَابًا', 'kitāban'],
    ['هٰذَا', 'hādhā'],
    ['اِجْتَمَعَ', 'ijtamaʿa'],
    ['اُكْتُبْ', 'uktub'],
    ['مُعَلِّم', 'muʿallim'],
    ['إِلَى', 'ilā'],
    ['هُدًى', 'hudan'],
    ['وَالْكِتَاب', 'wa-l-kitāb'],
    ['وَالِد', 'wālid'],
    ['لِلْكِتَاب', 'li-l-kitāb'],
    ['بِالشَّمْسِ', 'bi-sh-shamsi'],
    ['مَسْؤُول', 'masʾūl'],
    ['رَئِيس', 'raʾīs'],
    ['شَيْء', 'shayʾ'],
    ['قُرْآن', 'qurʾān'],
    ['آخَر', 'ākhar'],
    ['مُسْتَشْفًى', 'mustashfan'],
    ['يَوْم', 'yawm'],
    ['فِي', 'fī'],
    ['أُمّ', 'umm'],
    ['الَّذِي', 'alladhī'],
    ['تَوَضَّأَ', 'tawaḍḍaʾa'],
    ['ثَلَاثَة', 'thalātha'],
    ['خُبْز', 'khubz'],
    ['ذَهَبَ', 'dhahaba'],
    ['غُرْفَة', 'ghurfa'],
    ['صَدِيق', 'ṣadīq'],
    ['ظُهْر', 'ẓuhr'],
    ['اللّٰه', 'allāh'],
    ['مُوسَىٰ', 'mūsā']
  ]
  it.each(cases)('%s → %s', (ar, rom) => expect(arRomanize(ar)).toBe(rom))
  it('标点、数字、不带元音的词', () => {
    expect(arRomanize('مَرْحَبًا، كَيْفَ حَالُكَ؟')).toBe('marḥaban, kayfa ḥāluka?')
    expect(arRomanize('٢٠٢٤')).toBe('2024')
    expect(arRomanize('كتاب')).toBe('ktāb')
    expect(arRomanize('كبير')).toBe('kbīr')
  })
})

describe('登记', () => {
  it('rules 是同一份', () => {
    expect(ar.rules).toBe(rules)
    expect(ar.spec.direction).toBe('rtl')
  })
})
