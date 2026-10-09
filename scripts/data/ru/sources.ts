/**
 * 俄语数据的来源：下载地址（RAW）与写进词典库的来源说明（SOURCE，设置里「数据来源与许可」逐条列出）。
 * 调研过程、许可核实、放弃了哪些见 docs/lang/ru.md「资料清单」。换版本只改这里的地址。
 */
export interface RawFile {
  url: string
  /** 存进 .cache/data/ru/ 的文件名 */
  file: string
  /** 分段并行下载（kaikki.org 从国内很慢） */
  parallel?: boolean
}

const kaikki = (edition: string, lang: string): string =>
  `https://kaikki.org/${edition}/${encodeURIComponent(lang)}/kaikki.org-dictionary-${encodeURIComponent(lang)}.jsonl.gz`
const tatoeba = (path: string): string =>
  `https://downloads.tatoeba.org/exports/per_language/${path}`
const gh = (repo: string, path: string): string =>
  `https://raw.githubusercontent.com/${repo}/${path}`

export const RAW = {
  /** 英文维基词典的俄语词条（kaikki.org / wiktextract）：词条主干 */
  kaikkiEn: {
    url: kaikki('dictionary', 'Russian'),
    file: 'kaikki-en-russian.jsonl.gz',
    parallel: true
  },
  /** 中文维基词典的俄语词条：人写的中文释义（简体分类「俄语」、繁体分类「俄語」两份） */
  kaikkiZhHans: {
    url: kaikki('zhwiktionary', '俄语'),
    file: 'kaikki-zh-russian-hans.jsonl.gz',
    parallel: true
  },
  kaikkiZhHant: {
    url: kaikki('zhwiktionary', '俄語'),
    file: 'kaikki-zh-russian-hant.jsonl.gz',
    parallel: true
  },
  /** 俄文维基词典的俄语词条：俄语释义（单语）、扎利兹尼亚克变格类型、译文表里的中文 */
  kaikkiRu: {
    url: kaikki('ruwiktionary', 'Русский'),
    file: 'kaikki-ru-russian.jsonl.gz',
    parallel: true
  },
  /**
   * OpenRussian.org 官方发布的整库 SQL（2021-04-20）：words 表有 CEFR 等级（level）、排名（rank），另有例句、译文。
   * 官方地址 api.openrussian.org/downloads/openrussian-sql.zip 已经 404；openrussian-cli 把这一份收进了仓库
   * （git.fmsbw.de/openrussian-cli，从国内下到一半就断、又不支持续传），这里用它在 GitHub 上的分支，同一个文件
   */
  orSql: {
    url: gh('saidjons/openrussian-cli', 'master/openrussian-sql.zip'),
    file: 'openrussian-sql-2021-04-20.zip'
  },
  /** OpenRussian.org 的公开备份（2022）：带重音的变格变位表、英德译文、体的配对 */
  orNouns: {
    url: gh('Badestrand/russian-dictionary', 'master/nouns.csv'),
    file: 'openrussian-nouns.csv'
  },
  orVerbs: {
    url: gh('Badestrand/russian-dictionary', 'master/verbs.csv'),
    file: 'openrussian-verbs.csv'
  },
  orAdjectives: {
    url: gh('Badestrand/russian-dictionary', 'master/adjectives.csv'),
    file: 'openrussian-adjectives.csv'
  },
  orOthers: {
    url: gh('Badestrand/russian-dictionary', 'master/others.csv'),
    file: 'openrussian-others.csv'
  },
  /** Tatoeba：俄语句子、俄中 / 俄英对照、中文与英文句子 */
  tatoebaRus: { url: tatoeba('rus/rus_sentences.tsv.bz2'), file: 'tatoeba-rus_sentences.tsv.bz2' },
  tatoebaRusCmn: {
    url: tatoeba('rus/rus-cmn_links.tsv.bz2'),
    file: 'tatoeba-rus-cmn_links.tsv.bz2'
  },
  tatoebaRusEng: {
    url: tatoeba('rus/rus-eng_links.tsv.bz2'),
    file: 'tatoeba-rus-eng_links.tsv.bz2'
  },
  tatoebaCmn: { url: tatoeba('cmn/cmn_sentences.tsv.bz2'), file: 'tatoeba-cmn_sentences.tsv.bz2' },
  tatoebaEng: { url: tatoeba('eng/eng_sentences.tsv.bz2'), file: 'tatoeba-eng_sentences.tsv.bz2' },
  /** 词频：OpenSubtitles 2018（口语）与俄语维基百科（书面） */
  freqSubs: {
    url: gh('hermitdave/FrequencyWords', 'master/content/2018/ru/ru_50k.txt'),
    file: 'freq-opensubtitles2018-ru_50k.txt'
  },
  freqWiki: {
    url: gh('IlyaSemenov/wikipedia-word-frequency', 'master/results/ruwiki-2022-08-29.txt'),
    file: 'freq-ruwiki-2022-08-29.txt'
  }
} satisfies Record<string, RawFile>

// 写进词典库的来源说明（SourceRef）跟界面、分级共用 src/shared/lang/ru/sources.ts
export { RU_SOURCES as SOURCE } from '../../../src/shared/lang/ru/sources'
