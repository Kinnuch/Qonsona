/**
 * 分级数据：CEFR-J 1.6（A1–B2）、Octanove（C1–C2）、NGSL 系列；词频补级的切点。
 */
import { readFileSync } from 'node:fs'
import type { CefrLevel, PosTag } from '../../../src/shared/lang/types'
import { CEFR_LEVELS } from '../../../src/shared/lang/types'
import { readXlsx } from './xlsx'

/** CEFR-J / Octanove 的词性 → UPOS */
const PROFILE_POS: Record<string, PosTag> = {
  noun: 'noun',
  verb: 'verb',
  vern: 'verb',
  'be-verb': 'verb',
  'do-verb': 'verb',
  'have-verb': 'verb',
  'modal auxiliary': 'aux',
  adjective: 'adj',
  adverb: 'adv',
  preposition: 'adp',
  conjunction: 'cconj',
  pronoun: 'pron',
  determiner: 'det',
  interjection: 'intj',
  number: 'num',
  'infinitive-to': 'part'
}

export interface ProfileItem {
  /** 写法（并列写法拆开后的一种） */
  w: string
  pos: PosTag | null
  level: CefrLevel
  /** CEFR-J 的主题：Core Inventory 的大类、Threshold 的类 */
  themes: string[]
  src: 'cefrj' | 'octanove'
  /** 原表里并列的几种写法（color/colour） */
  group: string[]
}

/** 「color/colour」「a.m./A.M./am/AM」这种并列写法拆开 */
export const splitVariants = (head: string): string[] =>
  head
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)

export function loadCefrj(path: string): ProfileItem[] {
  const sheet = readXlsx(path).ALL
  if (!sheet) throw new Error('CEFR-J 词表里没有 ALL 工作表')
  const head = sheet[0].map((h) => h.trim())
  const c = {
    w: head.indexOf('headword'),
    pos: head.indexOf('pos'),
    lv: head.indexOf('CEFR'),
    ci1: head.indexOf('CoreInventory 1'),
    th: head.indexOf('Threshold')
  }
  const out: ProfileItem[] = []
  for (const r of sheet.slice(1)) {
    const level = (r[c.lv] ?? '').trim() as CefrLevel
    if (!r[c.w] || !CEFR_LEVELS.includes(level)) continue
    const themes = [r[c.ci1], r[c.th]].map((t) => (t ?? '').trim()).filter(Boolean)
    const group = splitVariants(r[c.w])
    for (const w of group)
      out.push({
        w,
        pos: PROFILE_POS[(r[c.pos] ?? '').trim()] ?? null,
        level,
        themes,
        src: 'cefrj',
        group
      })
  }
  return out
}

export function loadOctanove(path: string): ProfileItem[] {
  const out: ProfileItem[] = []
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).slice(1)
  for (const line of lines) {
    // headword,pos,CEFR,notes（notes 可能带引号与逗号，只取前三列）
    const [w, pos, level] = line.split(',')
    if (!w || !CEFR_LEVELS.includes(level as CefrLevel)) continue
    const group = splitVariants(w)
    for (const v of group)
      out.push({
        w: v,
        pos: PROFILE_POS[(pos ?? '').trim()] ?? null,
        level: level as CefrLevel,
        themes: [],
        src: 'octanove',
        group
      })
  }
  return out
}

/** NGSL 系列的「lemmatized for teaching」：每行第一个是词头，后面是它的变形 */
export function loadNgslList(path: string): string[] {
  return readFileSync(path, 'utf8')
    .replace(/^\s+/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split(',')[0].trim())
    .filter(Boolean)
}

export const levelIndex = (l: string): number => CEFR_LEVELS.indexOf(l as CefrLevel)
export const easier = (a: CefrLevel | undefined, b: CefrLevel): CefrLevel =>
  !a || levelIndex(b) < levelIndex(a) ? b : a

/**
 * 词频补级的切点：已分级的词在词频名次上的中位数，相邻两级的几何平均当分界。
 * 返回 5 个名次：名次 ≤ cuts[0] 是 A1，≤ cuts[1] 是 A2……，再往后是 C2
 */
export function frequencyCuts(ranked: { rank: number; level: CefrLevel }[]): number[] {
  const medians = CEFR_LEVELS.map((l) => {
    const rs = ranked
      .filter((r) => r.level === l && r.rank > 0)
      .map((r) => r.rank)
      .sort((a, b) => a - b)
    return rs.length ? rs[Math.floor(rs.length / 2)] : 0
  })
  const cuts: number[] = []
  for (let i = 0; i < 5; i++) {
    const a = medians[i] || 1
    const b = medians[i + 1] || a * 2
    cuts.push(Math.round(Math.sqrt(a * Math.max(a, b))))
  }
  // 保证递增
  for (let i = 1; i < cuts.length; i++) cuts[i] = Math.max(cuts[i], cuts[i - 1] + 1)
  return cuts
}

export function levelByRank(rank: number, cuts: number[]): CefrLevel {
  for (let i = 0; i < cuts.length; i++) if (rank <= cuts[i]) return CEFR_LEVELS[i]
  return 'C2'
}

/** CEFR-J 的主题类 → 主题词本（id、中英名字）；没列的类不做词本 */
export const THEMES: Record<string, { id: string; zh: string; en: string }> = {
  'Personal identification': { id: 'personal', zh: '个人信息', en: 'Personal information' },
  'Personal information': { id: 'personal', zh: '个人信息', en: 'Personal information' },
  'House and home, environment': { id: 'home', zh: '住房与环境', en: 'House and home' },
  'Objects and rooms': { id: 'objects', zh: '物品与房间', en: 'Objects and rooms' },
  'Daily life': { id: 'daily', zh: '日常生活', en: 'Daily life' },
  'Free time, entertainment': { id: 'free-time', zh: '休闲娱乐', en: 'Free time' },
  'Hobbies and pastimes': { id: 'hobbies', zh: '爱好', en: 'Hobbies and pastimes' },
  'Leisure activities': { id: 'hobbies', zh: '爱好', en: 'Hobbies and pastimes' },
  'Hobbies and lifestyles': { id: 'hobbies', zh: '爱好', en: 'Hobbies and pastimes' },
  Travel: { id: 'travel', zh: '旅行', en: 'Travel' },
  'Ways of travelling': { id: 'travel', zh: '旅行', en: 'Travel' },
  'Travel and services vocab': { id: 'travel', zh: '旅行', en: 'Travel' },
  Holidays: { id: 'travel', zh: '旅行', en: 'Travel' },
  'Relations with other people': { id: 'relations', zh: '人际关系', en: 'Relationships' },
  'Family life': { id: 'family', zh: '家庭生活', en: 'Family life' },
  'Health and body care': { id: 'health', zh: '健康与身体', en: 'Health and the body' },
  Education: { id: 'education', zh: '教育', en: 'Education' },
  Shopping: { id: 'shopping', zh: '购物', en: 'Shopping' },
  'Things in the town, shops and shopping': { id: 'town', zh: '城镇与商店', en: 'In town' },
  'Food and drink': { id: 'food', zh: '饮食', en: 'Food and drink' },
  Services: { id: 'services', zh: '服务', en: 'Services' },
  Places: { id: 'places', zh: '地点', en: 'Places' },
  Language: { id: 'language', zh: '语言', en: 'Language' },
  Weather: { id: 'weather', zh: '天气', en: 'Weather' },
  'Work and jobs': { id: 'work', zh: '工作与职业', en: 'Work and jobs' },
  'News, lifestyles and current affairs': {
    id: 'news',
    zh: '新闻与时事',
    en: 'News and current affairs'
  },
  Media: { id: 'media', zh: '媒体', en: 'Media' },
  'Books and literature': { id: 'books', zh: '书与文学', en: 'Books and literature' },
  Arts: { id: 'arts', zh: '艺术', en: 'Arts' },
  Film: { id: 'arts', zh: '艺术', en: 'Arts' },
  Clothes: { id: 'clothes', zh: '服装', en: 'Clothes' },
  Colours: { id: 'colours', zh: '颜色', en: 'Colours' },
  'Nationalities and countries': {
    id: 'countries',
    zh: '国家与国籍',
    en: 'Countries and nationalities'
  },
  'Technical and legal language': { id: 'technical', zh: '技术与法律', en: 'Technical and legal' },
  'Scientific development': { id: 'science', zh: '科学', en: 'Science' }
}
