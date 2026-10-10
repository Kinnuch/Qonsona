/**
 * 俄语的资料来源（界面「数据来源与许可」、分级依据、数据管线 db.source() 共用一份）。
 * 每份是什么、取了哪些、许可怎么核实的见 docs/lang/ru.md「资料清单」。
 */
import type { SourceRef } from '../types'

export const RU_SOURCES = {
  wiktionary: {
    id: 'wiktionary',
    name: '英文维基词典的俄语词条（kaikki.org 用 wiktextract 抽取）',
    license: 'CC BY-SA 4.0 / 3.0',
    credit: 'Wiktionary 贡献者（en.wiktionary.org）；kaikki.org / wiktextract（Tatu Ylonen）',
    home: 'https://kaikki.org/dictionary/Russian/',
    note: '词头与重音、词性、英文释义、IPA、变格变位表、体的配对、录音地址'
  },
  wiktZh: {
    id: 'wikt-zh',
    name: '维基词典里的中文：俄文维基词典（Викисловарь）译文表的中文对应词、中文维基词典俄语词条的中文释义（kaikki.org 用 wiktextract 抽取）',
    license: 'CC BY-SA 4.0 / 3.0',
    credit:
      'Участники Викисловаря（ru.wiktionary.org）；Wiktionary 贡献者（zh.wiktionary.org）；kaikki.org / wiktextract（Tatu Ylonen）',
    home: 'https://ru.wiktionary.org/',
    note: '人写的中文：俄文维基词典译文表里第一个义项的中文（排在前面），再接中文维基词典正式词条的释义；中文维基词典 2010 年机器人批量建的光杆条目来源不明，不收；繁体按 OpenCC 转简体'
  },
  openrussian: {
    id: 'openrussian',
    name: 'OpenRussian.org 词典数据（2021-04-20 的整库导出）',
    license: 'CC BY-SA 4.0',
    credit: 'OpenRussian.org（Badestrand）及其用户',
    home: 'https://en.openrussian.org/',
    note: '词的排名与 CEFR 标注、英文译文、体的配对、带重音的变格变位表'
  },
  tatoeba: {
    id: 'tatoeba',
    name: 'Tatoeba 例句（俄中、俄英对照）',
    license: 'CC BY 2.0 FR',
    credit: 'Tatoeba contributors',
    home: 'https://tatoeba.org/'
  },
  freqSubs: {
    id: 'freq-subs',
    name: '词频：OpenSubtitles 2018 俄语字幕（hermitdave/FrequencyWords）',
    license: 'CC BY-SA 4.0',
    credit: 'Hermit Dave；OpenSubtitles.org / OPUS',
    home: 'https://github.com/hermitdave/FrequencyWords'
  },
  freqWiki: {
    id: 'freq-wiki',
    name: '词频：俄语维基百科（IlyaSemenov/wikipedia-word-frequency，2022-08-29）',
    license: 'MIT（统计结果）；原文 CC BY-SA',
    credit: 'Ilya Semenov；维基百科贡献者',
    home: 'https://github.com/IlyaSemenov/wikipedia-word-frequency'
  },
  commons: {
    id: 'commons',
    name: '发音录音：维基共享资源（Wikimedia Commons，含 Lingua Libre）',
    license: '各文件分别授权（多为 CC BY-SA、CC BY、CC0）',
    credit: '各录音的上传者',
    home: 'https://commons.wikimedia.org/wiki/Category:Russian_pronunciation'
  },
  torfl: {
    id: 'torfl',
    name: '俄语对外等级考试 ТРКИ（TORFL）与各级官方词汇大纲的词汇量',
    license: '考试体系（等级说明为本软件概括；官方大纲有版权，没有收录其词表）',
    credit:
      'Российская государственная система тестирования по русскому языку как иностранному；Андрюшина Н. П. и др.《Лексический минимум по русскому языку как иностранному》（Златоуст）',
    home: 'https://ru.wikipedia.org/wiki/Тест_по_русскому_языку_как_иностранному'
  }
} satisfies Record<string, SourceRef>
