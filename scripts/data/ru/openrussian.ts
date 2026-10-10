/**
 * OpenRussian.org 的整库导出（MySQL，2021-04-20）→ 每个词的排名、CEFR 标注、英文译文、体的配对、变格变位表。
 * 重音写法：元音后面的撇号（челове'к）→ 组合重音符号（челове́к）。
 */
import type { PosTag } from '../../../src/shared/lang/types'
import { mysqlRows, zipEntryText } from './read'
import { mergeCells, sortTags, type Cell } from './wiktionary'

export interface OrWord {
  id: number
  bare: string
  /** 带重音（组合符号） */
  accented: string
  rank: number | null
  level: string | null
  type: string | null
  pos: PosTag | null
  en: string[]
  /** 体：perfective / imperfective / both */
  aspect?: string
  partners: string[]
  gender?: string
  animate?: boolean
  indeclinable?: boolean
  pluralOnly?: boolean
  cells: Cell[]
  synonyms: number[]
  antonyms: number[]
}

const ACUTE = String.fromCharCode(0x301)
const accent = (s: string): string => s.replace(/'/g, ACUTE).normalize('NFC')

const TYPE_POS: Record<string, PosTag> = {
  noun: 'noun',
  verb: 'verb',
  adjective: 'adj',
  adverb: 'adv',
  expression: 'phrase'
}

const CASES = ['nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'prepositional']

export function readOpenRussian(zipFile: string): Map<number, OrWord> {
  const sql = zipEntryText(zipFile, 'openrussian.sql')
  const words = new Map<number, OrWord>()
  for (const r of mysqlRows(sql, 'words')) {
    const [id, , bare, accented, , rank, disabled, , , , , type, level] = r as [
      number,
      number,
      string,
      string,
      number | null,
      number | null,
      number,
      string | null,
      string | null,
      string | null,
      number | null,
      string | null,
      string | null
    ]
    if (disabled || !bare) continue
    words.set(id, {
      id,
      bare: bare.normalize('NFC'),
      accented: accent(accented || bare),
      rank,
      level,
      type,
      pos: type ? (TYPE_POS[type] ?? null) : null,
      en: [],
      partners: [],
      cells: [],
      synonyms: [],
      antonyms: []
    })
  }
  // 英文译文（按 position 排）
  const tls = new Map<number, [number, string][]>()
  for (const [, lang, wordId, position, tl] of mysqlRows(sql, 'translations') as [
    number,
    string,
    number,
    number,
    string
  ][]) {
    if (lang !== 'en' || !words.has(wordId) || !tl?.trim()) continue
    const list = tls.get(wordId) ?? []
    list.push([position, tl.trim()])
    tls.set(wordId, list)
  }
  for (const [id, list] of tls)
    words.get(id)!.en = list.sort((a, b) => a[0] - b[0]).map(([, t]) => t)

  // 变格（名词、形容词共用 declensions 表）
  const decl = new Map<number, string[]>()
  for (const [id, , nom, gen, dat, acc, inst, prep] of mysqlRows(sql, 'declensions') as [
    number,
    number,
    ...(string | null)[]
  ][])
    decl.set(
      id,
      [nom, gen, dat, acc, inst, prep].map((x) => (x ?? '').trim())
    )
  const declCells = (declId: number | null, extra: string[]): Cell[] => {
    const d = declId ? decl.get(declId) : undefined
    if (!d) return []
    const out: Cell[] = []
    d.forEach((v, i) => {
      for (const f of v.split(/[,;/]/).map((x) => x.trim()))
        if (f && !/[a-z()]/i.test(f)) out.push([accent(f), ...sortTags([CASES[i], ...extra])])
    })
    return out
  }

  for (const [
    wordId,
    gender,
    partner,
    animate,
    indeclinable,
    sgOnly,
    plOnly,
    sgId,
    plId
  ] of mysqlRows(sql, 'nouns') as [
    number,
    string | null,
    string | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null
  ][]) {
    const w = words.get(wordId)
    if (!w) continue
    if (gender && gender !== 'pl') w.gender = gender === 'both' ? 'c' : gender
    w.animate = animate === 1
    w.indeclinable = indeclinable === 1
    w.pluralOnly = plOnly === 1 || gender === 'pl'
    if (partner)
      w.partners = partner
        .split(/[;,]/)
        .map((x) => x.replace(/'/g, '').trim())
        .filter(Boolean)
    if (!sgOnly || plOnly) w.cells.push(...declCells(plId, ['plural']))
    if (!plOnly) w.cells.push(...declCells(sgId, ['singular']))
  }

  for (const [wordId, , comparative, superlative, sm, sf, sn, spl, dm, df, dn, dpl] of mysqlRows(
    sql,
    'adjectives'
  ) as [number, number | null, ...(string | number | null)[]][]) {
    const w = words.get(wordId)
    if (!w) continue
    const add = (v: unknown, ...tags: string[]): void => {
      for (const f of String(v ?? '')
        .split(/[,;/]/)
        .map((x) => x.trim()))
        if (f && !/[a-z()]/i.test(f)) w.cells.push([accent(f), ...sortTags(tags)])
    }
    add(comparative, 'comparative')
    void superlative
    add(sm, 'short-form', 'masculine', 'singular')
    add(sf, 'short-form', 'feminine', 'singular')
    add(sn, 'short-form', 'neuter', 'singular')
    add(spl, 'short-form', 'plural')
    w.cells.push(...declCells(dm as number | null, ['masculine', 'singular']))
    w.cells.push(...declCells(df as number | null, ['feminine', 'singular']))
    w.cells.push(...declCells(dn as number | null, ['neuter', 'singular']))
    w.cells.push(...declCells(dpl as number | null, ['plural']))
  }

  // 变位
  const conj = new Map<number, string[]>()
  for (const [id, , ...p] of mysqlRows(sql, 'conjugations') as [number, number, ...string[]][])
    conj.set(
      id,
      p.map((x) => (x ?? '').trim())
    )
  const PERSON: [string, string][] = [
    ['first-person', 'singular'],
    ['second-person', 'singular'],
    ['third-person', 'singular'],
    ['first-person', 'plural'],
    ['second-person', 'plural'],
    ['third-person', 'plural']
  ]
  for (const [wordId, aspect, partner, impSg, impPl, pm, pf, pn, ppl, conjId] of mysqlRows(
    sql,
    'verbs'
  ) as [
    number,
    string | null,
    string | null,
    string,
    string,
    string,
    string,
    string,
    string,
    number | null
  ][]) {
    const w = words.get(wordId)
    if (!w) continue
    if (aspect) w.aspect = aspect
    if (partner)
      w.partners = partner
        .split(/[;,]/)
        .map((x) => x.replace(/'/g, '').trim())
        .filter(Boolean)
    const tense = aspect === 'perfective' ? 'future' : 'present'
    const add = (v: string, ...tags: string[]): void => {
      for (const f of (v ?? '').split(/[,;/]/).map((x) => x.trim()))
        if (f && !/[a-z()]/i.test(f)) w.cells.push([accent(f), ...sortTags(tags)])
    }
    add(impSg, 'imperative', 'second-person', 'singular')
    add(impPl, 'imperative', 'second-person', 'plural')
    add(pm, 'past', 'masculine', 'singular')
    add(pf, 'past', 'feminine', 'singular')
    add(pn, 'past', 'neuter', 'singular')
    add(ppl, 'past', 'plural')
    const c = conjId ? conj.get(conjId) : undefined
    if (c) c.forEach((v, i) => add(v, tense, ...PERSON[i]))
  }
  for (const w of words.values()) if (w.cells.length) w.cells = mergeCells(w.cells)

  // 近义、反义
  for (const [, wordId, relId, relation] of mysqlRows(sql, 'words_rels') as [
    number,
    number,
    number,
    string
  ][]) {
    const w = words.get(wordId)
    if (!w || !words.has(relId)) continue
    if (relation === 'synonym') w.synonyms.push(relId)
    else if (relation === 'antonym') w.antonyms.push(relId)
  }
  return words
}
