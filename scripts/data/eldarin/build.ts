/** Full lexical import. Run: node scripts/data/run-ts.mjs scripts/data/eldarin/build.ts [--download] */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { LexDbWriter } from '../../lang/lexdb-writer'
import { parseEldamo, type EldamoDocumentaryAlias } from './parse'
import { validateCoreBindings, type CoreBinding } from './core'
import { ELDAMO, ORIGINAL_ELDARIN } from '../../../src/shared/lang/eldarin'
import { LANGS } from '../../../src/shared/lang/registry'
import type { LexText } from '../../../src/shared/lang/types'

const root = resolve('.')
const cache = join(root, '.cache/data/eldarin')
const file = join(cache, 'eldamo-data.xml')
const url = 'https://eldamo.org/content/data-model/eldamo-data.xml'
mkdirSync(cache, { recursive: true })
if (process.argv.includes('--download') || !existsSync(file)) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Qonsona Eldamo data importer' },
    signal: AbortSignal.timeout(120000)
  })
  if (!response.ok) throw new Error(`Eldamo download HTTP ${response.status}`)
  writeFileSync(file, Buffer.from(await response.arrayBuffer()))
}
const xml = readFileSync(file, 'utf8')
const digest = createHash('sha256').update(xml).digest('hex')
const parsed = parseEldamo(xml)
const output = []
for (const code of ['qya', 'sjn'] as const) {
  const core: { w: string; zh: string; level: string }[] = JSON.parse(
    readFileSync(join(root, 'data', code, 'core.json'), 'utf8')
  )
  const mod = LANGS[code]
  const byHead = new Map(core.map((word) => [mod.rules.key(word.w), word]))
  const bindings: CoreBinding[] = JSON.parse(
    readFileSync(join(root, 'data', code, 'core-bindings.json'), 'utf8')
  )
  const reviewed = validateCoreBindings(
    parsed.records.filter((record) => record.code === code),
    bindings,
    mod.rules.key
  )
  const db = new LexDbWriter(code, { mt: false })
  db.source({ ...ELDAMO, note: `${ELDAMO.note} Adapted XML ${parsed.version}; SHA256 ${digest}.` })
  db.source(ORIGINAL_ELDARIN)
  db.meta('eldamo-version', parsed.version)
  db.meta('eldamo-sha256', digest)
  db.meta('eldamo-url', url)
  db.meta('lists_info', [
    {
      name: 'x:eldamo-period:late',
      title: { zh: '晚期托尔金材料（1950–1973）', en: 'Late Tolkien material (1950–1973)' }
    },
    {
      name: 'x:eldamo-period:middle',
      title: {
        zh: '中期材料（1930–1950，比较用）',
        en: 'Middle-period material (1930–1950, comparative)'
      }
    },
    {
      name: 'x:eldamo-period:early',
      title: { zh: '早期材料（1910–1930，比较用）', en: 'Early material (1910–1930, comparative)' }
    },
    {
      name: 'x:eldamo-period:neo',
      title: {
        zh: 'Neo构拟与创作（可靠性逐条查看）',
        en: 'Neo reconstructions/compositions (check reliability)'
      }
    }
  ])
  const idsByWord = new Map<string, number[]>()
  const matched = new Set<string>()
  const counts: Record<string, number> = {}
  let documentaryAliases = 0
  let entriesWithDocumentaryAliases = 0
  const order: Record<string, number> = { late: 0, neo: 1, middle: 2, early: 3 }
  const records = parsed.records
    .filter((record) => record.code === code)
    .sort((a, b) => {
      const ap = (a.data.x!.eldamo as { period: string }).period
      const bp = (b.data.x!.eldamo as { period: string }).period
      return order[ap] - order[bp] || a.data.w.localeCompare(b.data.w) || a.id.localeCompare(b.id)
    })
  for (const record of records) {
    const provenance = record.data.x!.eldamo as { period: string; status: string[] }
    counts[provenance.period] = (counts[provenance.period] ?? 0) + 1
    const key = mod.rules.key(record.data.w)
    const binding = reviewed.get(record.id)
    const selected = binding && byHead.get(mod.rules.key(binding.w))
    // Historical/Neo records retain their actual period and uncertainty tags.
    // Translation and learning stage attach only to a reviewed source identity.
    if (selected) {
      record.data.s[0].zh = [selected.zh]
      record.data.s[0].zs = ORIGINAL_ELDARIN.id
      record.data.lv = { 'eldarin-study': selected.level }
      matched.add(key)
    }
    const id = db.entry(record.data)
    const aliases = (record.data.x!.eldamo as { aliases: EldamoDocumentaryAlias[] }).aliases
    const indexed = new Set([key, ...(record.data.f ?? []).map(([form]) => mod.rules.key(form))])
    let aliasCount = 0
    for (const alias of aliases) {
      const aliasKey = mod.rules.key(alias.form)
      if (indexed.has(aliasKey)) continue
      db.form(id, alias.form, ['documentary-variant'])
      indexed.add(aliasKey)
      const aliasEntries = idsByWord.get(aliasKey) ?? []
      aliasEntries.push(id)
      idsByWord.set(aliasKey, aliasEntries)
      aliasCount++
    }
    documentaryAliases += aliasCount
    if (aliasCount) entriesWithDocumentaryAliases++
    const list = idsByWord.get(key) ?? []
    list.push(id)
    idsByWord.set(key, list)
    db.list(`x:eldamo-period:${provenance.period}`, id)
    // The raw semantic category stays in x.eldamo, not hundreds of opaque UI lists.
  }
  const examples = new Map<string, { text: string; zh?: string; en?: string; lv: string }>()
  for (const point of mod.grammar ?? [])
    for (const ex of point.examples) examples.set(ex.text, { ...ex, lv: point.level })
  for (const phrase of mod.courses!('en').find((course) => course.id === 'phrasebook')?.phrases
    ? Object.values(mod.courses!('en').find((course) => course.id === 'phrasebook')!.phrases!)
    : []) {
    const meaning = phrase.meaning as Record<string, string>
    if (!examples.has(phrase.text))
      examples.set(phrase.text, { text: phrase.text, zh: meaning.zh, en: meaning.en, lv: 'L1' })
  }
  for (const ex of examples.values()) {
    const links = [
      ...new Set(
        mod.rules.tokenize!(ex.text)
          .filter((token) => token.kind === 'word')
          .flatMap((token) => (idsByWord.get(mod.rules.key(token.text)) ?? []).slice(0, 1))
      )
    ]
    db.example({ ...ex, src: ORIGINAL_ELDARIN.id, zs: ORIGINAL_ELDARIN.id }, links)
  }
  const texts: LexText[] = JSON.parse(readFileSync(join(root, 'data', code, 'texts.json'), 'utf8'))
  for (const text of texts)
    if (!text.source.includes('original'))
      throw new Error(`Unexpected non-original learning text: ${text.id}`)
  const stats = db.finish()
  const report = {
    code,
    source: url,
    license: 'CC BY 4.0',
    version: parsed.version,
    sha256: digest,
    counts,
    documentaryAliases,
    entriesWithDocumentaryAliases,
    stats: { ...stats, file: `resources/data/${code}/dict.sqlite` },
    curatedRequested: core.length,
    curatedMatched: matched.size,
    unmatchedCore: core.filter((word) => !matched.has(mod.rules.key(word.w))).map((word) => word.w),
    originalExamples: examples.size,
    texts: texts.length
  }
  writeFileSync(
    join(root, 'data', code, 'import-report.json'),
    JSON.stringify(report, null, 2) + '\n'
  )
  output.push(report)
}
console.log(JSON.stringify(output, null, 2))
