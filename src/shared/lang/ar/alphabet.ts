import type { Course } from '../../course'
export function decorateAlphabet(c: Course): void {
  const nonJoining = 'ادذرزو'
  const sun = 'تثدذرزسشصضطظلن'
  for (const it of Object.values(c.symbols)) {
    const s = it.symbol
    if (/^[ابتثجحخدذرزسشصضطظعغفقكلمنهوي]$/u.test(s)) {
      const joins = !nonJoining.includes(s)
      const forms = [s, joins ? s + 'ـ' : s, 'ـ' + s + (joins ? 'ـ' : ''), 'ـ' + s]
      it.pair = forms.join(' / ')
      it.pairLabel = { zh: '独立 / 起首 / 居中 / 末尾', en: 'Isolated / initial / medial / final' }
      it.note = {
        zh: `${s}：${forms.join(' / ')}。${joins ? '可连接前后字母。' : '不与后一个字母相连。'}${sun.includes(s) ? '太阳字母：定冠词 l 在发音中同化，例如 الشَّمْس。' : '月亮字母：定冠词 l 保留发音，例如 القَمَر。'}字母名 ${it.reading}，词中的主要音值 [${it.ipa}]。`,
        en: `${s}: ${forms.join(' / ')}. ${joins ? 'Joins on both sides.' : 'Does not join the following letter.'} ${sun.includes(s) ? 'Sun letter: the article l assimilates.' : 'Moon letter: article l is retained.'} Letter name ${it.reading}; principal sound [${it.ipa}].`
      }
    } else if (s === 'ء')
      it.note = {
        zh: 'hamza [ʔ] 为辅音；依元音环境写 أ إ ؤ ئ 或独立 ء。وصل 的 ا 连读时可不读，区别 قطع。',
        en: 'Hamza [ʔ] is a consonant written on أ إ ؤ ئ or independently as ء. Hamzat al-waṣl may disappear in liaison; hamzat al-qaṭʿ remains.'
      }
    else if (s === 'ة')
      it.note = {
        zh: 'ة 常标阴性。停顿常读 -a，连读格尾或接代词时 t 显现：مدرسة / مدرستي。不要与 ه 混写。',
        en: 'ة commonly marks feminine nouns. In pause it often sounds -a; t appears with case vowels or suffixes: مدرسة / مدرستي. Distinguish ه.'
      }
    else if (s === 'ى')
      it.note = {
        zh: 'ى 表长元音 /aː/，区别 ي /j, iː/；例如 فتى。',
        en: 'ى represents long /aː/, unlike ي /j, iː/: فتى.'
      }
    else
      it.note = {
        zh: `${it.reading}：附加于字母的记号，不能作为独立辅音。具体组合见下一单元。`,
        en: `${it.reading}: a mark attached to a letter, not an independent consonant. See the following examples.`
      }
  }
  const rows = [
    [
      'بَ',
      'ba',
      'ba',
      'َ 开口符为短 /a/，对比 با /baː/。',
      'Fatḥa gives short /a/; compare با /baː/.'
    ],
    [
      'بِ',
      'bi',
      'bi',
      'ِ 齐齿符为短 /i/，对比 بي /biː/。',
      'Kasra gives short /i/; compare بي /biː/.'
    ],
    [
      'بُ',
      'bu',
      'bu',
      'ُ 合口符为短 /u/，对比 بو /buː/。',
      'Ḍamma gives short /u/; compare بو /buː/.'
    ],
    [
      'بْ',
      'b',
      'b',
      'ْ 静音符表示该辅音后无元音。',
      'Sukūn indicates no vowel after the consonant.'
    ],
    [
      'رَبّ',
      'rabb',
      'rabb',
      'ّ 叠音符表示辅音长一倍，不是额外元音。',
      'Shadda doubles a consonant, not a vowel.'
    ],
    [
      'كِتَابٌ',
      'kitābun',
      'kitaːbun',
      'ٌ 不定主格鼻音尾 -un，停顿时通常省略。',
      'Nominative tanwīn -un is normally dropped in pause.'
    ],
    [
      'كِتَابًا',
      'kitāban',
      'kitaːban',
      'ً 不定宾格 -an 常写支持 alif；停顿规则不同。',
      'Accusative tanwīn -an often has a supporting alif; pause differs.'
    ],
    [
      'كِتَابٍ',
      'kitābin',
      'kitaːbin',
      'ٍ 不定属格鼻音尾 -in，停顿时通常省略。',
      'Genitive tanwīn -in is normally dropped in pause.'
    ],
    [
      'الشَّمْس',
      'ash-shams',
      'aʃʃams',
      '太阳字母 ش 同化定冠词 l，书写 ال 保留。',
      'Sun-letter ش assimilates article l; written ال remains.'
    ],
    [
      'القَمَر',
      'al-qamar',
      'alqamar',
      '月亮字母 ق 不同化定冠词 l。',
      'Moon-letter ق does not assimilate article l.'
    ],
    [
      'سَأَلَ',
      'saʾala',
      'saʔala',
      'hamza 保持声门塞音；不是长 alif。',
      'Hamza retains its glottal stop; it is not long alif.'
    ],
    [
      'لَا',
      'lā',
      'laː',
      'لام 与 ألف 连写成 لا；不增添新音位。',
      'Lām and alif combine as لا without adding a phoneme.'
    ]
  ]
  rows.forEach(([symbol, reading, ipa, zh, en], i) => {
    const key = `sound-${i}`
    c.symbols[key] = {
      key,
      symbol,
      reading,
      ipa,
      note: { zh, en },
      say: { text: symbol, lang: 'ar' }
    }
  })
  c.units.push({
    id: 'joining-and-marks',
    title: { zh: '连写、元音、鼻音与冠词', en: 'Joining, vowels, tanwīn and the article' },
    test: true,
    lessons: [
      {
        id: 'short-vowels',
        title: { zh: '短元音与长元音', en: 'Short and long vowels' },
        items: ['sound-0', 'sound-1', 'sound-2', 'sound-3']
      },
      {
        id: 'shadda-tanwin',
        title: { zh: '叠音与不定格尾', en: 'Gemination and tanwīn' },
        items: ['sound-4', 'sound-5', 'sound-6', 'sound-7']
      },
      {
        id: 'article-hamza',
        title: { zh: '太阳月亮字母、hamza 与连写', en: 'Sun/moon letters, hamza and joining' },
        items: ['sound-8', 'sound-9', 'sound-10', 'sound-11']
      }
    ]
  })
}
