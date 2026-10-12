import type { Course } from '../../course'
export function decorateAlphabet(c: Course): void {
  for (const it of Object.values(c.symbols))
    it.note = {
      zh: `${it.symbol} 的主要音值为 [${it.ipa}]。${it.symbol === 'ㅇ' ? '初声无声，终声读 [ŋ]。' : it.symbol === 'ㄹ' ? '元音之间常读 [ɾ]，收音常读 [l]。' : '转写 ' + it.reading + ' 是学习提示，实际音值依音节位置与邻音变化。'}`,
      en: `${it.symbol} has principal value [${it.ipa}]. ${it.symbol === 'ㅇ' ? 'Silent as an onset; [ŋ] as a coda.' : it.symbol === 'ㄹ' ? 'Usually [ɾ] between vowels and [l] in the coda.' : 'The spelling ' + it.reading + ' is a cue; realization depends on position and neighbours.'}`
    }
  const rows = [
    ['밖', '박', 'pak̚', '收音 ㄲ 归并为 [k̚]，末尾无爆破。', 'Final ㄲ becomes unreleased [k̚].'],
    [
      '옷',
      '옫',
      'ot̚',
      '收音 ㅅ 归并为 [t̚]，但接元音助词重新连音。',
      'Final ㅅ becomes [t̚], but liaison occurs before a vowel particle.'
    ],
    ['앞', '압', 'ap̚', '收音 ㅍ 归并为 [p̚]。', 'Final ㅍ becomes [p̚].'],
    ['산', '산', 'san', '收音 ㄴ 保留 [n]。', 'Final ㄴ retains [n].'],
    ['밤', '밤', 'pam', '收音 ㅁ 保留 [m]。', 'Final ㅁ retains [m].'],
    [
      '강',
      '강',
      'kaŋ',
      '收音 ㅇ 读 [ŋ]，与初声的无声不同。',
      'Final ㅇ is [ŋ], unlike silent initial ㅇ.'
    ],
    ['달', '달', 'tal', '收音 ㄹ 为 [l]，不是普通话的 r。', 'Final ㄹ is [l], not Mandarin r.'],
    [
      '국물',
      '궁물',
      'kuŋmul',
      '鼻音化：收音 ㄱ 遇 ㅁ 变 [ŋ]。',
      'Nasalization: final ㄱ becomes [ŋ] before ㅁ.'
    ],
    [
      '같이',
      '가치',
      'katɕʰi',
      '腭化：ㄷ/ㅌ 与特定后缀 이 连读。',
      'Palatalization: ㄷ/ㅌ before suffixal 이.'
    ],
    [
      '학교',
      '학꾜',
      'hak̚k͈jo',
      '紧音化：收音 ㄱ 后的 ㄱ 读紧音。',
      'Tensification: ㄱ becomes tense after final ㄱ.'
    ],
    [
      '옷이',
      '오시',
      'oɕi',
      '连音保留原 ㅅ 并转作后音节初声，不读 옫이。',
      'Liaison carries underlying ㅅ to the following onset.'
    ],
    [
      '읽다',
      '익따',
      'ik̚t͈a',
      '双收音 ㄺ 在此保留 ㄱ，并引发紧音。',
      'Cluster ㄺ retains ㄱ here and triggers tensification.'
    ],
    [
      '읽어',
      '일거',
      'ilɡʌ',
      '元音词尾前双收音分配为 ㄹ 收音与 ㄱ 初声。',
      'Before a vowel ending ㄹ is coda and ㄱ becomes onset.'
    ],
    [
      '좋다',
      '조타',
      'tɕotʰa',
      'ㅎ 与 ㄷ 结合，形成送气 ㅌ。',
      'ㅎ combines with ㄷ to form aspirated ㅌ.'
    ],
    [
      '신라',
      '실라',
      'ɕilla',
      '流音化：ㄴ+ㄹ 常变 ㄹ+ㄹ。',
      'Liquid assimilation: ㄴ+ㄹ commonly becomes ㄹ+ㄹ.'
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
      say: { text: symbol, lang: 'ko' }
    }
  })
  c.units.push({
    id: 'batchim',
    title: { zh: '七种收音、双收音与音变', en: 'Seven codas, clusters and sound changes' },
    test: true,
    lessons: [
      {
        id: 'codas-1',
        title: { zh: '闭塞收音', en: 'Stop codas' },
        items: ['sound-0', 'sound-1', 'sound-2']
      },
      {
        id: 'codas-2',
        title: { zh: '鼻音与流音收音', en: 'Nasal and liquid codas' },
        items: ['sound-3', 'sound-4', 'sound-5', 'sound-6']
      },
      {
        id: 'changes-1',
        title: { zh: '鼻音、腭化与紧音', en: 'Nasalization, palatalization and tensification' },
        items: ['sound-7', 'sound-8', 'sound-9', 'sound-10']
      },
      {
        id: 'changes-2',
        title: { zh: '双收音、送气与流音', en: 'Clusters, aspiration and liquids' },
        items: ['sound-11', 'sound-12', 'sound-13', 'sound-14']
      }
    ]
  })
}
