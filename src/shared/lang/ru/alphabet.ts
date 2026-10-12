import type { Course } from '../../course'
export function decorateAlphabet(c: Course): void {
  for (const it of Object.values(c.symbols))
    it.note = {
      zh: `${it.symbol}/${it.pair}：字母名称 ${it.reading}，主要音值 [${it.ipa}]。${'еёюя'.includes(it.symbol) ? '辅音后通常标软化；词首、元音后或 ь/ъ 后通常有 [j]。' : 'ьъ'.includes(it.symbol) ? '无独立音值；详见软硬音符单元。' : '字母不直接标记重音，词中读法依重音和相邻音变化。'}`,
      en: `${it.symbol}/${it.pair}: letter name ${it.reading}; principal value [${it.ipa}]. ${'еёюя'.includes(it.symbol) ? 'Normally palatalizes a preceding consonant; has [j] initially, after a vowel or after ь/ъ.' : 'ьъ'.includes(it.symbol) ? 'No independent sound; see the sign lesson.' : 'Stress is not encoded by the letter; realization varies with stress and neighbours.'}`
    }
  const rows = [
    ['лук', 'luk', 'luk', '硬 л；与 люк 的软 л 对比。', 'Hard л, contrasted with soft л in люк.'],
    [
      'люк',
      'lyuk',
      'lʲuk',
      'ю 在此标前辅音软化，而非插入完整 [j]。',
      'ю marks palatalization here, without a separate [j].'
    ],
    ['брат', 'brat', 'brat', '硬 т；与 брать 的软 т 对比。', 'Hard т; contrast soft т in брать.'],
    [
      'брать',
      'bratʹ',
      'bratʲ',
      'ь 标示 т 软化，不读作额外元音。',
      'ь softens т without an extra vowel.'
    ],
    [
      'съезд',
      'sʺyezd',
      'sjest',
      'ъ 分隔辅音与带 [j] 的 е；末 д 清化为 [t]。',
      'ъ separates the consonant from [j]е; final д devoices to [t].'
    ],
    [
      'вода́',
      'vodá',
      'vɐˈda',
      'о 在重读音节前弱化为 [ɐ]。',
      'о reduces to [ɐ] before the stressed syllable.'
    ],
    [
      'во́ды',
      'vódy',
      'ˈvodɨ',
      '同一词变格时重音移到 о，恢复 [o]。',
      'Inflection moves stress to о, restoring [o].'
    ],
    ['за́мок', 'zámok', 'ˈzamək', '重音在首音节：城堡。', 'First-syllable stress: castle.'],
    ['замо́к', 'zamók', 'zɐˈmok', '重音在末音节：锁。', 'Final-syllable stress: lock.'],
    [
      'всё',
      'vsyo',
      'fsʲo',
      'ё 保留；区别 все，词首 в 在清辅音前清化。',
      'Preserve ё, distinct from все; в devoices before a voiceless consonant.'
    ],
    [
      'друг',
      'drug',
      'druk',
      '词末浊辅音 г 清化，不改变字母拼写。',
      'Final г devoices without changing the spelling.'
    ],
    [
      'молоко́',
      'molokó',
      'məɫɐˈko',
      '两个非重读 о 弱化程度不同。',
      'The two unstressed о vowels have different reduction degrees.'
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
      say: { text: symbol, lang: 'ru-RU' }
    }
  })
  c.units.push({
    id: 'stress-softness',
    title: { zh: '软硬、重音移动与弱化', en: 'Palatalization, shifting stress and reduction' },
    test: true,
    lessons: [
      {
        id: 'soft-hard',
        title: { zh: '硬软辅音与分隔符', en: 'Hard and soft consonants and separators' },
        items: ['sound-0', 'sound-1', 'sound-2', 'sound-3', 'sound-4']
      },
      {
        id: 'stress',
        title: { zh: '重音与意义、词形', en: 'Stress, meaning and inflection' },
        items: ['sound-5', 'sound-6', 'sound-7', 'sound-8']
      },
      {
        id: 'reduction',
        title: { zh: 'ё、清化与弱化', en: 'ё, devoicing and reduction' },
        items: ['sound-9', 'sound-10', 'sound-11']
      }
    ]
  })
}
