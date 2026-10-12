/**
 * 分级：把词按词频名次切到 CEFR 各级，再按自编主题词表提级、按语体与地区压级。依据与各级词数见 docs/lang/es.md。
 *
 * 1. 能分级的词：普通词（名词、动词、形容词、副词、虚词、感叹词、短语）；专名、词缀、符号、缩写不分
 *    （专名只在主题词表里出现时按主题给级，比如国名）；全部义项都是已废、古旧、少用、误拼的不分。
 * 2. 按分数（两份词频合起来，见 freq.ts）排名，名次落在哪一段就是哪一级（CUTS，用 ELELex 校准过）。
 * 3. 主题词表（data/es/themes.json）里的词只往易里提：数字、星期、月份、颜色、家人、食物这些初学必会、
 *    在语料里却不算高频的词，提到主题标的那一级。
 * 4. 压级：粗俗、冒犯、俚语义项为主的词最低 B2；只在某些地区用的词（全部义项都标了地区）最低 B2——
 *    字幕语料里墨西哥、西班牙的口语词偏多，不压的话会排进 A2、B1。
 */
import { existsSync, readFileSync } from 'node:fs'
import type { CefrLevel } from '../../../src/shared/lang/types'
import type { WEntry } from './wiktionary'

export const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/**
 * 各级的累计名次（在能分级的词里排）：前 CUTS[0] 个是 A1，再往后到 CUTS[1] 是 A2……超过最后一个不分级。
 * 用 ELELex（教材里各级首次出现的词）校准：两边都有的词上平均级差最小（scripts/data/es/calibrate.ts）。
 */
export const CUTS = [1000, 2500, 4500, 7000, 11000, 18000]

/** 能分级的词性（kaikki 的词性） */
const LEVEL_POS = new Set([
  'noun',
  'verb',
  'adj',
  'adv',
  'pron',
  'det',
  'article',
  'prep',
  'conj',
  'num',
  'intj',
  'phrase',
  'prep_phrase',
  'adv_phrase',
  'contraction',
  'particle',
  'proverb'
])

/** 这些标签的义项不算「常用义」 */
const MARGINAL = new Set([
  'obsolete',
  'archaic',
  'dated',
  'rare',
  'misspelling',
  'nonstandard',
  'proscribed',
  'historical',
  'pronunciation-spelling',
  'abbreviation',
  'initialism',
  'acronym',
  'clipping',
  'eye-dialect',
  'Internet'
])

/** 粗俗、冒犯一类 */
const OFFENSIVE = new Set(['vulgar', 'offensive', 'derogatory', 'slur', 'ethnic'])

/** 西班牙本土的地区标签 */
export const SPAIN = new Set([
  'Spain',
  'Canary-Islands',
  'Andalusia',
  'Aragon',
  'Asturias',
  'Galicia',
  'Valencia',
  'Navarre',
  'Catalonia',
  'Murcia',
  'Extremadura',
  'Seville',
  'Tenerife',
  'Northern'
])

/** 美洲（与其他西语地区）的地区标签 */
export const AMERICAS = new Set([
  'Latin-America',
  'Mexico',
  'Argentina',
  'Rioplatense',
  'Lunfardo',
  'Chile',
  'Colombia',
  'Peru',
  'Venezuela',
  'Cuba',
  'Puerto-Rico',
  'Dominican-Republic',
  'Uruguay',
  'Paraguay',
  'Bolivia',
  'Ecuador',
  'Costa-Rica',
  'Panama',
  'Honduras',
  'Guatemala',
  'El-Salvador',
  'Nicaragua',
  'Central-America',
  'Caribbean',
  'South-America',
  'Antilles',
  'Belize',
  'US',
  'Texas',
  'California',
  'Louisiana'
])

const OTHER_REGIONS = new Set(['Philippines', 'Equatorial-Guinea'])

const isRegion = (t: string): boolean => SPAIN.has(t) || AMERICAS.has(t) || OTHER_REGIONS.has(t)

/** 这个词条的「常用义」（没有边缘标签的义项） */
export function mainSenses(e: WEntry): WEntry['senses'] {
  return e.senses.filter((s) => !s.tags.some((t) => MARGINAL.has(t)))
}

/** 虚词：只由这些词组成的「短语」（de la、lo que、a lo、que su）是碰巧挨着的两个词，不按词频分级 */
const STOPWORDS = new Set(
  (
    'a al de del el la lo los las un una unos unas y e o u ni que en con por para sin sobre se me te le les nos os ' +
    'mi mis tu tus su sus es son era más muy no si ya este esta esto estos estas ese esa eso esos esas aquel aquella ' +
    'uno una ti mí él ella'
  ).split(' ')
)
const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'])

/** 词频分级不收的个别词条：别的语言混进语料的（elle、ox）、拼写变体当了词条的 */
const LEVEL_BLOCK = new Set(['elle', 'ox', 'OK', 'ok', 'okey', 'oká', 'tranquilar'])

/**
 * 字幕语料（警匪片、剧集）里偏多、教材里却不会排进入门的词：最低 B1。
 * 只压级，词典照收；按 ELELex 与常见教材的安排挑的（入门教材不教这些）。
 */
const SUBTITLE_BIAS = new Set(
  (
    'matar asesinar asesinato asesino disparar disparo arma pistola muerte morir muerto cadáver ' +
    'sangre droga drogas cárcel prisión crimen criminal sospechoso detective ataque atacar ' +
    'demonio diablo idiota estúpido maldito infierno sexo violación secuestro secuestrar bomba ' +
    'víctima culpable robar ladrón policía agente capitán sargento teniente coronel soldado ejército guerra'
  ).split(' ')
)

/** 能不能分级 */
export function eligible(e: WEntry): boolean {
  if (!LEVEL_POS.has(e.kpos)) return false
  if (/\d/.test(e.word) || LEVEL_BLOCK.has(e.word)) return false
  if (e.word.includes(' ')) {
    const ws = e.word.toLocaleLowerCase('es').split(/\s+/)
    if (ARTICLES.has(ws[0]) || ws.every((w) => STOPWORDS.has(w))) return false
  }
  return mainSenses(e).length > 0
}

/** 固定短语（副词、介词、连词、感叹词性的，比如 sin embargo、a través de、por favor）：算词频时用 */
export function isFixedPhrase(e: WEntry): boolean {
  return (
    e.word.includes(' ') &&
    ['adv', 'prep', 'conj', 'intj', 'prep_phrase', 'adv_phrase'].includes(e.kpos) &&
    eligible(e)
  )
}

/** 这个词只在哪些地区用：'es-ES'（全部常用义都标了西班牙本土）、'es-419'（都标了美洲），不分地区的 null */
export function regionOf(e: WEntry): 'es-ES' | 'es-419' | null {
  const ss = mainSenses(e)
  if (!ss.length) return null
  const regions = ss.map((s) => s.tags.filter(isRegion))
  if (regions.some((r) => !r.length)) return null
  if (regions.every((r) => r.every((t) => SPAIN.has(t)))) return 'es-ES'
  if (regions.every((r) => r.every((t) => AMERICAS.has(t)))) return 'es-419'
  return null
}

/** 最低几级（压级）：粗俗、冒犯为主的、只在部分地区用的、字幕里偏多的 */
export function floorOf(e: WEntry): CefrLevel | null {
  const ss = mainSenses(e)
  if (!ss.length) return null
  const bad = ss.filter((s) => s.tags.some((t) => OFFENSIVE.has(t))).length
  if (bad === ss.length || (bad && ss[0].tags.some((t) => OFFENSIVE.has(t)))) return 'B2'
  if (ss.every((s) => s.tags.some(isRegion))) return 'B2'
  if (SUBTITLE_BIAS.has(e.word)) return 'B1'
  return null
}

export const levelAt = (rank: number): CefrLevel | null => {
  for (let i = 0; i < CUTS.length; i++) if (rank <= CUTS[i]) return LEVELS[i]
  return null
}

export const harder = (a: CefrLevel, b: CefrLevel): CefrLevel =>
  LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b
export const easier = (a: CefrLevel, b: CefrLevel): CefrLevel =>
  LEVELS.indexOf(a) <= LEVELS.indexOf(b) ? a : b

// ───────────────────────── 主题词表 ─────────────────────────

export interface Theme {
  id: string
  title: { zh: string; en: string }
  /** 这个主题的词默认提到哪一级 */
  level: CefrLevel
  /** 词：「词」或「词|词性」或「词|词性|性」（capital|noun|f），可以在后面写「@A2」改这个词的级 */
  words: string[]
}

export interface ThemeWord {
  word: string
  kpos?: string
  gender?: string
  level: CefrLevel
}

export function loadThemes(file: string): { themes: Theme[]; words: Map<string, ThemeWord[]> } {
  if (!existsSync(file)) return { themes: [], words: new Map() }
  const themes = JSON.parse(readFileSync(file, 'utf8')) as Theme[]
  const words = new Map<string, ThemeWord[]>()
  for (const th of themes) {
    const list: ThemeWord[] = []
    for (const raw of th.words) {
      const [spec, lv] = raw.split('@')
      const [word, kpos, gender] = spec.split('|')
      list.push({
        word: word.trim(),
        kpos: kpos || undefined,
        gender: gender || undefined,
        level: (lv as CefrLevel) || th.level
      })
    }
    words.set(th.id, list)
  }
  return { themes, words }
}
