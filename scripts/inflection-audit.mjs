/** Read-only coverage audit of recorded entry.f, not guessed lookup keys. */
import { DatabaseSync } from 'node:sqlite'
import { inflateRawSync } from 'node:zlib'
import { existsSync } from 'node:fs'
const samples = {
  en: ['go', 'child', 'good'],
  fr: ['venir', 'cheval', 'beau'],
  ko: ['듣다', '학교', '춥다'],
  es: ['tener', 'luz', 'bueno'],
  ar: ['كَتَبَ', 'كتاب', 'كبير'],
  ru: ['идти', 'книга', 'хороший'],
  gd: ['bàta', 'fear', 'beag']
}
for (const code of Object.keys(samples)) {
  const file = `resources/data/${code}/dict.sqlite`
  if (!existsSync(file)) continue
  const db = new DatabaseSync(file, { readOnly: true })
  const counts = {
    verb: { entries: 0, withForms: 0, forms: 0 },
    noun: { entries: 0, withForms: 0, forms: 0 },
    adj: { entries: 0, withForms: 0, forms: 0 }
  }
  const examples = []
  for (const row of db
    .prepare('SELECT w,p,data FROM entry WHERE p IN (?,?,?)')
    .iterate('verb', 'noun', 'adj')) {
    const d = JSON.parse(inflateRawSync(row.data).toString('utf8'))
    const f = (d.f ?? []).filter(([form]) => typeof form === 'string' && form.trim())
    const count = counts[row.p]
    count.entries++
    if (f.length) count.withForms++
    count.forms += f.length
    if (samples[code].includes(row.w))
      examples.push({
        word: row.w,
        pos: row.p,
        classes: d.cls ?? [],
        forms: f.length,
        sample: f.slice(0, 8),
        sources: d.src ?? []
      })
  }
  db.close()
  console.log(JSON.stringify({ code, counts, examples }))
}
