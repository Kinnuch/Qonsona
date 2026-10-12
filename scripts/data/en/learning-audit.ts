/** Read-only audit. Run with --feeds to check network sources; never rebuild the dictionary. */
import { writeFileSync } from 'node:fs'
import { LexDb } from '../../../src/main/lang/lexdb'
import { analyzeLex } from '../../../src/main/lang/analyze'
import { LANGS } from '../../../src/shared/lang/registry'
import { findGrammar } from '../../../src/shared/lang/grammar'
import { segmentWords } from '../../../src/shared/lang/text'
import { parseFeed } from '../../../src/shared/lang/feed'
import { langPaper } from '../../../src/main/lang/practice'
import enTexts from '../../../data/en/texts.json'
import frTexts from '../../../data/fr/texts.json'
const codes = ['en', 'fr'] as const
for (const code of codes) {
  const mod = LANGS[code]
  const db = new LexDb(code, `resources/data/${code}/dict.sqlite`)
  const texts = code === 'en' ? enTexts : frTexts
  let examples = 0,
    exact = 0
  const missed: string[] = []
  for (const g of mod.grammar!)
    for (const e of g.examples) {
      examples++
      const tokens = mod.rules.tokenize?.(e.text) ?? segmentWords(e.text, mod.spec.bcp47)
      const hits = findGrammar(
        [{ start: 0, end: e.text.length, para: 0, tokens }],
        [g],
        mod.rules.key
      )
      const start = e.text.indexOf(e.hl!)
      if (hits.some((h) => h.start === start && h.end === start + e.hl!.length)) exact++
      else missed.push(`${g.id}: ${e.hl}`)
    }
  const textProfiles = texts.map((t) => {
    const a = analyzeLex(db, t.text)
    const w = a.sentences.flatMap((s) => s.tokens).filter((t) => t.kind === 'word')
    return {
      id: t.id,
      editorialLevel: t.level,
      lexicalLevel: a.level,
      wordTokens: w.length,
      unknown: w.filter((t) => !t.entry).length,
      grammarHits: a.grammar.length
    }
  })
  const exams = mod.exams!.map((e) => ({
    id: e.id,
    level: e.level,
    full: langPaper(db, e.id, 42, 'zh') !== null
  }))
  const report: {
    checkedAt: string
    grammar: { points: number; examples: number; exactSpans: number; missed: string[] }
    textProfiles: typeof textProfiles
    exams: typeof exams
    feeds?: unknown[]
  } = {
    checkedAt: new Date().toISOString(),
    grammar: { points: mod.grammar!.length, examples, exactSpans: exact, missed },
    textProfiles,
    exams
  }
  db.close()
  if (process.argv.includes('--feeds')) {
    const feeds = mod.news ?? []
    const results: unknown[] = []
    let cursor = 0
    await Promise.all(
      Array.from({ length: 5 }, async () => {
        while (cursor < feeds.length) {
          const src = feeds[cursor++]
          try {
            const res = await fetch(src.url, {
              signal: AbortSignal.timeout(15000),
              headers: { 'User-Agent': 'Qonsona feed validator' }
            })
            const xml = await res.text()
            const items = res.ok ? parseFeed(xml, src) : []
            results.push({
              id: src.id,
              url: src.url,
              status: res.status,
              entries: items.length,
              license: src.license,
              ok: res.ok && items.length > 0
            })
            console.log(`${code} ${src.id}: ${res.status}, ${items.length}`)
          } catch (error) {
            results.push({ id: src.id, url: src.url, ok: false, error: String(error) })
            console.log(`${code} ${src.id}: ${String(error)}`)
          }
        }
      })
    )
    report.feeds = results
  }
  writeFileSync(`data/${code}/learning-audit.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ code, grammar: report.grammar, textProfiles, exams }))
}
