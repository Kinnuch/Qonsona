/**
 * 英语用到的资料：词典库的 meta.sources、分级体系的依据都从这里取（许可与取舍见 docs/lang/en.md）。
 */
import type { SourceRef } from '../types'

export const ECDICT: SourceRef = {
  id: 'ecdict',
  name: 'ECDICT 英汉双解词典（基础版）',
  license: 'MIT',
  credit: 'Linwei（skywind3000）及贡献者',
  home: 'https://github.com/skywind3000/ECDICT',
  note: '词头、中文释义、英式音标（作后备）、变形（exchange）、BNC 与当代语料库的词频名次、考试标签、柯林斯星级'
}

export const WORDNET: SourceRef = {
  id: 'wordnet',
  name: 'WordNet 3.0（英文释义，经 ECDICT 收录）',
  license: 'WordNet 3.0 License（可自由使用、修改、再分发，保留版权声明）',
  credit: 'Princeton University',
  home: 'https://wordnet.princeton.edu/',
  note: '少数英文释义出自 1913 年版韦氏词典（公有领域）'
}

export const ECDICT_LEMMA: SourceRef = {
  id: 'ecdict-lemma',
  name: 'ECDICT lemma.en.txt（词形 → 原形）',
  license: '研究与教育用途免费使用（文件头声明）',
  credit: 'Linwei（skywind3000）；参照 BNC、NodeBox Linguistics 与染谷泰正的 lemma 表',
  home: 'https://github.com/skywind3000/ECDICT',
  note: '补 ECDICT 变形字段里没有的规则词形'
}

export const CEFRJ: SourceRef = {
  id: 'cefrj',
  name: 'CEFR-J Wordlist Version 1.6（A1–B2）',
  license: '免费用于研究、教育与商用，须注明出处',
  credit:
    'The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies（东京外国语大学投野由紀夫研究室）',
  home: 'http://www.cefr-j.org/download.html',
  note: '按词性给的等级（7,801 项）与主题分类；词条取各词性里最低的一级'
}

export const OCTANOVE: SourceRef = {
  id: 'octanove',
  name: 'Octanove Vocabulary Profile C1/C2 1.0',
  license: 'CC BY-SA 4.0',
  credit: 'Octanove Labs（Open Language Profiles）',
  home: 'https://github.com/openlanguageprofiles/olp-en-cefrj',
  note: 'C1、C2 两级（2,136 项）'
}

export const NGSL: SourceRef = {
  id: 'ngsl',
  name: 'NGSL 系列词表（NGSL 1.2、NGSL-Spoken 1.2、NAWL 1.2、TSL 1.2、BSL 1.20、NDL 1.1）',
  license: 'CC BY-SA 4.0',
  credit: 'Charles Browne, Brent Culligan, Joseph Phillips',
  home: 'https://www.newgeneralservicelist.com/'
}

export const IPADICT: SourceRef = {
  id: 'ipadict',
  name: 'ipa-dict（美式 IPA，en_US）',
  license: 'MIT（数据出自 cmudict-ipa / CMU Pronouncing Dictionary，BSD）',
  credit: 'open-dict-data；lingz（cmudict-ipa）；Carnegie Mellon University',
  home: 'https://github.com/open-dict-data/ipa-dict',
  note: '换成词典常用的写法：r、l、非重读的 ɚ，单音节词不标重音'
}

export const BRITFONE: SourceRef = {
  id: 'britfone',
  name: 'Britfone（英式 IPA）',
  license: 'MIT',
  credit: 'Jose Llarena',
  home: 'https://github.com/JoseLlarena/Britfone',
  note: '换成国内课本的写法：ʌ、r、e、eə，重音符号挪到音节开头'
}

export const TATOEBA: SourceRef = {
  id: 'tatoeba',
  name: 'Tatoeba 例句（英中对照）',
  license: 'CC BY 2.0 FR',
  credit: 'Tatoeba contributors',
  home: 'https://tatoeba.org/',
  note: '中文翻译是人工的；繁体句换成 Tatoeba 自带的简体转写'
}

export const WIKTIONARY: SourceRef = {
  id: 'wiktionary',
  name: '英语维基词典（kaikki.org / wiktextract）',
  license: 'CC BY-SA 4.0',
  credit: 'Wiktionary contributors; Tatu Ylonen（wiktextract）',
  home: 'https://kaikki.org/dictionary/English/',
  note: '补英式、美式 IPA，义项的语体标签，录音文件的地址'
}

export const COMMONS_AUDIO: SourceRef = {
  id: 'commons',
  name: '维基共享资源的发音录音',
  license: '各文件不同（CC BY-SA、CC BY、CC0、公有领域），见文件页',
  credit: 'Wikimedia Commons contributors',
  home: 'https://commons.wikimedia.org/wiki/Category:English_pronunciation',
  note: '联网时点击播放；中国大陆可能连不上 upload.wikimedia.org，这时用系统语音'
}

/** 本软件整理的说明（缩约的完整形式这类，由数据管线按规则生成） */
export const QONSONA: SourceRef = {
  id: 'qonsona',
  name: 'Qonsona 整理',
  license: 'MIT',
  credit: 'Qonsona',
  home: 'https://github.com/Kinnuch/Qonsona'
}
