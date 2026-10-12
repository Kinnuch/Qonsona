/** Snapshot content and real dictionaries; --feeds additionally checks public RSS without importing it. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { LANG_CODES } from '../../src/shared/lang/types'
import { LANGS } from '../../src/shared/lang/registry'
import { LANG_TEXTS } from '../../src/main/lang/texts'
import { primarySystem } from '../../src/shared/lang/levels'
import { segmentWords } from '../../src/shared/lang/text'
import { findGrammar } from '../../src/shared/lang/grammar'
import { parseFeed } from '../../src/shared/lang/feed'
import { LexDb } from '../../src/main/lang/lexdb'
import { analyzeLex } from '../../src/main/lang/analyze'
import { langPaper } from '../../src/main/lang/practice'
import { allLessons } from '../../src/shared/course'

const checkedAt = new Date().toISOString()
const requested = process.argv
  .slice(2)
  .filter((c) => LANG_CODES.includes(c as (typeof LANG_CODES)[number]))
for (const code of LANG_CODES.filter((c) => !requested.length || requested.includes(c))) {
  const mod = LANGS[code]
  const file = `resources/data/${code}/dict.sqlite`
  const raw = new DatabaseSync(file, { readOnly: true })
  const entries = Number(raw.prepare('SELECT count(*) AS n FROM entry').get()!.n)
  const examples = Number(raw.prepare('SELECT count(*) AS n FROM example').get()!.n)
  raw.close()
  const db = new LexDb(code, file)
  try {
    const grammar = mod.grammar ?? []
    // Isolate each point here: the reader deliberately hides shorter, overlapping hits.
    const missed: string[] = []
    for (const g of grammar)
      for (const e of g.examples) {
        const tokens = (mod.rules.tokenize?.(e.text) ?? segmentWords(e.text, mod.spec.bcp47)).map(
          (t) => {
            const hit = t.kind === 'word' ? db.lookup(t.text) : null
            return hit ? { ...t, lemma: hit.lemma, pos: hit.pos, tags: hit.tags } : t
          }
        )
        const hits = findGrammar(
          [{ start: 0, end: e.text.length, para: 0, tokens }],
          [g],
          mod.rules.key
        )
        const start = e.text.indexOf(e.hl!)
        if (!hits.some((h) => h.start === start && h.end === start + e.hl!.length))
          missed.push(`${g.id}: ${e.hl}`)
      }
    const textProfiles = LANG_TEXTS[code].map((t) => {
      const a = analyzeLex(db, t.text)
      const words = a.sentences.flatMap((s) => s.tokens).filter((t) => t.kind === 'word')
      return {
        id: t.id,
        editorialLevel: t.level,
        lexicalLevel: a.level,
        wordTokens: words.length,
        unknown: words.filter((t) => !t.entry).length,
        grammarHits: a.grammar.length
      }
    })
    const previousFile = `data/${code}/learning-audit.json`
    const previous = existsSync(previousFile)
      ? JSON.parse(readFileSync(previousFile, 'utf8'))
      : null
    const checkFeeds = process.argv.includes('--feeds')
    const report = {
      checkedAt,
      code,
      dictionary: { entries, examples, levels: db.levelCounts(), lists: db.lists().length },
      grammar: {
        points: grammar.length,
        examples: grammar.reduce((n, g) => n + g.examples.length, 0),
        missed
      },
      courses: (mod.courses?.('zh') ?? []).map((c) => ({
        id: c.id,
        units: c.units.length,
        lessons: allLessons(c).length
      })),
      texts: { count: textProfiles.length, profiles: textProfiles },
      exams: (mod.exams ?? []).map((e) => ({
        id: e.id,
        level: e.level,
        full: langPaper(db, e.id, 42, 'zh') !== null
      })),
      primaryLevels: primarySystem(mod.spec.levelSystems).levels.map((l) => l.id),
      feedsCheckedAt: checkFeeds
        ? checkedAt
        : (previous?.feedsCheckedAt ?? previous?.checkedAt ?? null),
      feeds: (checkFeeds ? [] : (previous?.feeds ?? [])) as {
        id: string
        url: string
        ok: boolean
        status?: number
        entries?: number
        latest?: string | null
        error?: string
      }[]
    }
    if (checkFeeds) {
      const sources = mod.news ?? []
      let cursor = 0
      await Promise.all(
        Array.from({ length: Math.min(8, sources.length) }, async () => {
          while (cursor < sources.length) {
            const src = sources[cursor++]
            try {
              const res = await fetch(src.url, {
                signal: AbortSignal.timeout(10_000),
                headers: { 'User-Agent': 'Qonsona RSS audit' }
              })
              const xml = await res.text()
              const items = res.ok ? parseFeed(xml, src) : []
              report.feeds.push({
                id: src.id,
                url: src.url,
                ok: res.ok && items.length > 0,
                status: res.status,
                entries: items.length,
                latest: items[0]?.publishedAt ?? null
              })
            } catch (e) {
              report.feeds.push({ id: src.id, url: src.url, ok: false, error: String(e) })
            }
          }
        })
      )
      report.feeds.sort(
        (a, b) => sources.findIndex((s) => s.id === a.id) - sources.findIndex((s) => s.id === b.id)
      )
    }
    writeFileSync(`data/${code}/learning-audit.json`, JSON.stringify(report, null, 2) + '\n')
    console.log(
      JSON.stringify({
        code,
        entries,
        dictionaryExamples: examples,
        grammar: report.grammar,
        texts: report.texts.count,
        courses: report.courses,
        fullPapers: report.exams.filter((e) => e.full).length,
        feeds: `${report.feeds.filter((f) => f.ok).length}/${report.feeds.length}`
      })
    )
  } finally {
    db.close()
  }
}
