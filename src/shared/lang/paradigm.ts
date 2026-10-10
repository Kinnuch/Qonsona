/**
 * 变形表排成网格（词典词条页用）：名词按格 × 数，形容词按格 × 性（单数）/ 复数，动词每个时态、语气一张人称 × 数，
 * 俄语过去时这种只有性数的排成一行。标签一律是 Wiktextract 的标签词，跟语言无关：
 * 格、人称决定行，数（形容词是性 + 复数）决定列，其余的标签（时态、语气、语态……）决定分成哪几张表。
 * 有生 / 无生、尊称这类只是同一格里的两种写法，写成格子里的小注。排不进网格的照旧一行一组标签。
 */

export interface ParadigmForm {
  form: string
  tags: string[]
  ipa?: string
}

export interface ParadigmCell {
  form: string
  ipa?: string
  /** 小注的标签（animate、formal……） */
  note: string[]
}

export interface ParadigmGrid {
  /** 这张表的标签（present indicative……）；没有是空数组 */
  title: string[]
  /** 列：每列的标签（singular / plural，或 masculine / neuter / feminine / plural） */
  cols: string[][]
  /** 行：行的标签（格、人称，带性的人称）与每列的格子（几个写法） */
  rows: { tags: string[]; cells: ParadigmCell[][] }[]
}

const CASES = [
  'nominative',
  'genitive',
  'dative',
  'accusative',
  'instrumental',
  'prepositional',
  'locative',
  'vocative',
  'partitive'
]
const PERSONS = ['first-person', 'second-person', 'third-person']
const NUMBERS = ['singular', 'dual', 'plural']
const GENDERS = ['masculine', 'neuter', 'feminine']
/** 同一格里的两种写法的说明，不另成表 */
const NOTES = new Set(['animate', 'inanimate', 'formal', 'informal', 'vos', 'archaic', 'rare'])

const pickAll = (tags: string[], set: string[]): string[] => set.filter((t) => tags.includes(t))

/** 表名里标签的先后：先语气，再时态、体，再语态与别的（陈述式 · 现在时） */
const TITLE_ORDER = [
  'indicative',
  'subjunctive',
  'conditional',
  'imperative',
  'jussive',
  'optative',
  'present',
  'imperfect',
  'preterite',
  'past',
  'past-historic',
  'aorist',
  'future',
  'perfect',
  'pluperfect',
  'anterior',
  'perfective',
  'imperfective',
  'active',
  'passive',
  'reflexive',
  'negative'
]
const titleRank = (t: string): number => {
  const i = TITLE_ORDER.indexOf(t)
  return i < 0 ? TITLE_ORDER.length : i
}

interface Placed {
  f: ParadigmForm
  cases: string[]
  persons: string[]
  numbers: string[]
  genders: string[]
  note: string[]
}

/**
 * 排网格。lemma 给了时，名词、形容词表里「主格 · 第一列」空着就填原形（词典的变形表里常不重复列原形）。
 * 返回网格与排不进去的变形（照旧显示）
 */
export function paradigm(
  forms: ParadigmForm[],
  lemma?: string
): { grids: ParadigmGrid[]; rest: ParadigmForm[] } {
  // 按「别的标签」分组：时态、语气……一样的进同一张表
  const groups = new Map<string, Placed[]>()
  const rest: ParadigmForm[] = []
  for (const f of forms) {
    const tags = f.tags.filter((t) => t !== 'lemma')
    const p: Placed = {
      f,
      cases: pickAll(tags, CASES),
      persons: pickAll(tags, PERSONS),
      numbers: pickAll(tags, NUMBERS),
      genders: pickAll(tags, GENDERS),
      note: tags.filter((t) => NOTES.has(t))
    }
    if (!p.cases.length && !p.persons.length && !p.numbers.length && !p.genders.length) {
      rest.push(f)
      continue
    }
    const known = new Set([...CASES, ...PERSONS, ...NUMBERS, ...GENDERS, ...NOTES])
    const key = tags
      .filter((t) => !known.has(t))
      .sort((a, b) => titleRank(a) - titleRank(b) || a.localeCompare(b))
      .join(' ')
    const list = groups.get(key) ?? []
    list.push(p)
    groups.set(key, list)
  }

  const grids: ParadigmGrid[] = []
  for (const [key, list] of groups) {
    const hasCase = list.some((p) => p.cases.length)
    const hasPerson = list.some((p) => p.persons.length)
    // 性做列：没有人称、有性又有单数的（形容词、俄语过去时）
    const genderCols =
      !hasPerson && list.some((p) => p.genders.length && !p.numbers.includes('plural'))
    const rowKeys = (p: Placed): string[] => {
      if (hasCase) return p.cases.length ? p.cases : []
      if (hasPerson) {
        if (!p.persons.length) return []
        // 带性的人称（阿拉伯语第二人称阳性 / 阴性）各成一行
        return p.persons.flatMap((x) =>
          p.genders.length ? p.genders.map((g) => `${x} ${g}`) : [x]
        )
      }
      return ['']
    }
    const colKeys = (p: Placed): string[] => {
      if (genderCols) {
        if (p.numbers.includes('plural')) return ['plural']
        return p.genders.length ? p.genders : p.numbers.length ? p.numbers : []
      }
      return p.numbers.length ? p.numbers : ['']
    }
    const cells = new Map<string, ParadigmCell[]>()
    const rowSet = new Set<string>()
    const colSet = new Set<string>()
    const unplaced: ParadigmForm[] = []
    for (const p of list) {
      const rs = rowKeys(p)
      const cs = colKeys(p)
      if (!rs.length || !cs.length) {
        unplaced.push(p.f)
        continue
      }
      for (const r of rs)
        for (const c of cs) {
          rowSet.add(r)
          colSet.add(c)
          const k = `${r}|${c}`
          const cell = cells.get(k) ?? []
          if (!cell.some((x) => x.form === p.f.form && x.note.join() === p.note.join()))
            cell.push({ form: p.f.form, ...(p.f.ipa ? { ipa: p.f.ipa } : {}), note: p.note })
          cells.set(k, cell)
        }
    }
    const rowOrder = (r: string): number => {
      if (!r) return 0
      const [a, g] = r.split(' ')
      const i = hasCase ? CASES.indexOf(a) : PERSONS.indexOf(a)
      return i * 10 + (g ? GENDERS.indexOf(g) + 1 : 0)
    }
    const colOrder = (c: string): number =>
      genderCols
        ? c === 'plural'
          ? 10
          : GENDERS.indexOf(c) >= 0
            ? GENDERS.indexOf(c)
            : 5 + NUMBERS.indexOf(c)
        : NUMBERS.indexOf(c)
    const rows = [...rowSet].sort((a, b) => rowOrder(a) - rowOrder(b))
    const cols = [...colSet].sort((a, b) => colOrder(a) - colOrder(b))
    // 原形填进主格第一列（名词的主格单数、形容词的阳性主格）
    if (lemma && hasCase && rows.includes('nominative') && cols.length) {
      const k = `nominative|${cols[0]}`
      if (!cells.has(k)) cells.set(k, [{ form: lemma, note: [] }])
    }
    // 至少三格、而且不只一格一行，才值得排成表
    if (cells.size < 3 || (rows.length < 2 && cols.length < 2)) {
      rest.push(...list.map((p) => p.f))
      continue
    }
    rest.push(...unplaced)
    grids.push({
      title: key ? key.split(' ') : [],
      cols: cols.map((c) => (c ? [c] : [])),
      rows: rows.map((r) => ({
        tags: r ? r.split(' ') : [],
        cells: cols.map((c) => cells.get(`${r}|${c}`) ?? [])
      }))
    })
  }
  return { grids, rest }
}
