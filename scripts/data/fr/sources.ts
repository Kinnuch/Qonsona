/**
 * 法语数据的来源：下载地址、许可、署名。换版本只改这里。
 * 许可的核实记录、取了什么、能不能再分发，见 docs/lang/fr.md「资料清单」。
 */
import type { SourceRef } from '../../../src/shared/lang/types'

export interface Download {
  url: string
  /** 存进 .cache/data/fr/ 的文件名 */
  file: string
}

const kaikki = (edition: string, lang: string): string =>
  `https://kaikki.org/${edition}/${encodeURIComponent(lang)}/kaikki.org-dictionary-${encodeURIComponent(lang)}.jsonl.gz`
const tatoeba = (lang: string, file: string): string =>
  `https://downloads.tatoeba.org/exports/per_language/${lang}/${file}`

/** 要下载的原始文件 */
export const DOWNLOADS = {
  /** 英文维基词典的法语词条（英文释义、词性、性、IPA、变位表、录音、例句） */
  enwikt: { url: kaikki('dictionary', 'French'), file: 'kaikki-enwiktionary-French.jsonl.gz' },
  /** 法语维基词典的法语词条（法语释义、译成中文的对照表、IPA、Lingua Libre 录音） */
  frwikt: {
    url: kaikki('frwiktionary', 'Français'),
    file: 'kaikki-frwiktionary-Francais.jsonl.gz'
  },
  /**
   * 英文维基词典的整份原始抽取（2.8 GB）：只用英语词条的翻译表——同一个英文义项下列着法语和汉语（普通话）
   * 的译词，两边对上就是一条法汉对照（比单纯从英文释义转译准）。按语言分好的英语文件把翻译表去掉了，只能下整份
   */
  enwiktRaw: {
    url: 'https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz',
    file: 'kaikki-enwiktionary-raw.jsonl.gz'
  },
  /** 中文维基词典的法语词条（中文释义；简体、繁体两个分类各一份） */
  zhwiktHans: { url: kaikki('zhwiktionary', '法语'), file: 'kaikki-zhwiktionary-fr-hans.jsonl.gz' },
  zhwiktHant: { url: kaikki('zhwiktionary', '法語'), file: 'kaikki-zhwiktionary-fr-hant.jsonl.gz' },
  /** Lexique 3.83：词形、原形、词性、性数、变位信息、音位，电影字幕与书籍两份词频 */
  lexique3: {
    url: 'http://www.lexique.org/databases/Lexique383/Lexique383.zip',
    file: 'Lexique383.zip'
  },
  /** Lexique 4.1（2026-09-29）：字幕语料扩到 3.16 亿词，另有语境多样性（CD） */
  lexique4: {
    url: 'http://www.lexique.org/databases/Lexique410/Lexique4.1.zip',
    file: 'Lexique4.1.zip'
  },
  /** CFDICT 汉法词典（CEDICT 格式：繁体 简体 [拼音] /法语释义/…），反查成法汉 */
  cfdict: { url: 'https://chine.in/assets/cfdict/cfdict.u8', file: 'cfdict.u8' },
  /**
   * CC-CEDICT 汉英词典：把 CFDICT 反查出的中文词按英文意思对到维基词典的英文义项上（三角对照），
   * 也拿来认繁体字（繁简两栏逐字对齐）
   */
  cedict: {
    url: 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz',
    file: 'cedict_1_0_ts_utf-8_mdbg.txt.gz'
  },
  /** 结巴分词的词频表（MIT）：只用来给反查出的几个中文候选词排先后，不进库 */
  jieba: {
    url: 'https://raw.githubusercontent.com/fxsjy/jieba/master/jieba/dict.txt',
    file: 'jieba-dict.txt'
  },
  /** Tatoeba：法语句子、法中与法英对照、中文与英文句子、法语句子的录音清单 */
  tatoebaFra: {
    url: tatoeba('fra', 'fra_sentences.tsv.bz2'),
    file: 'tatoeba-fra_sentences.tsv.bz2'
  },
  tatoebaFraCmn: {
    url: tatoeba('fra', 'fra-cmn_links.tsv.bz2'),
    file: 'tatoeba-fra-cmn_links.tsv.bz2'
  },
  tatoebaFraEng: {
    url: tatoeba('fra', 'fra-eng_links.tsv.bz2'),
    file: 'tatoeba-fra-eng_links.tsv.bz2'
  },
  tatoebaCmn: {
    url: tatoeba('cmn', 'cmn_sentences.tsv.bz2'),
    file: 'tatoeba-cmn_sentences.tsv.bz2'
  },
  tatoebaEng: {
    url: tatoeba('eng', 'eng_sentences.tsv.bz2'),
    file: 'tatoeba-eng_sentences.tsv.bz2'
  },
  tatoebaFraAudio: {
    url: tatoeba('fra', 'fra_sentences_with_audio.tsv.bz2'),
    file: 'tatoeba-fra_sentences_with_audio.tsv.bz2'
  },
  /**
   * FLELex（CEFRLex）：按 FLE 教材与分级读物统计的各级词频。CC BY-NC-SA 4.0，**不进库**，
   * 只拿来核对按词频切的级别（scripts/data/fr/levels-check.ts），见 docs/lang/fr.md「分级」
   */
  flelexCrf: {
    url: 'https://cental.uclouvain.be/cefrlex/static/resources/fr/FleLex_CRF.csv',
    file: 'FleLex_CRF.csv'
  },
  flelexBeacco: {
    url: 'https://cental.uclouvain.be/cefrlex/static/resources/fr/FleLex_TT_Beacco.tsv',
    file: 'FleLex_TT_Beacco.tsv'
  }
} satisfies Record<string, Download>

export type DownloadId = keyof typeof DOWNLOADS

/** 词条、例句里登记的来源（db.source） */
export const SOURCES = {
  wiktionary: {
    id: 'wiktionary',
    name: '英文维基词典的法语词条（kaikki.org 用 wiktextract 抽取）',
    license: 'CC BY-SA 4.0 / GFDL',
    credit: 'Wiktionary 贡献者（en.wiktionary.org）；kaikki.org / wiktextract（Tatu Ylonen）',
    home: 'https://kaikki.org/dictionary/French/',
    note: '词性、性、英文释义、IPA、变位与变格表、录音地址、例句'
  }
} satisfies Record<string, SourceRef>
