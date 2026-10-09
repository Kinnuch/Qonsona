/**
 * 维基词典的韩语词条（kaikki.org 用 wiktextract 抽取）：
 * - 英文维基词典：IPA、汉字、录音、英文释义（한국어기초사전没收的词也从这里补）；
 * - 中文维基词典「朝鲜语」：人写的中文释义。
 */
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

export interface KaikkiSense {
  glosses: string[]
  tags: string[]
}

export interface KaikkiEntry {
  word: string
  pos: string
  ipa: string[]
  hanja: string[]
  audio: { url: string; label?: string }[]
  senses: KaikkiSense[]
  /** 这一条只是别的词的异体、变形（form_of / alt_of） */
  formOf: boolean
  /** 谓词的活用形（词头模板给的 들어、들으니 与活用表的第一块），定活用类别用 */
  conj: string[]
}

interface Raw {
  word: string
  pos: string
  lang_code?: string
  forms?: { form: string; tags?: string[]; source?: string }[]
  sounds?: { ipa?: string; ogg_url?: string; mp3_url?: string; tags?: string[] }[]
  senses?: {
    glosses?: string[]
    raw_glosses?: string[]
    tags?: string[]
    form_of?: unknown[]
    alt_of?: unknown[]
  }[]
}

const SKIP_FORM = new Set(['romanization', 'hanja', 'table-tags', 'inflection-template', 'class'])

/** 活用形：词头模板给的（infinitive、sequential）与活用表的第一块（第二块是敬语） */
function conjForms(forms: { form: string; tags?: string[]; source?: string }[]): string[] {
  const out: string[] = []
  let blocks = 0
  for (const f of forms) {
    const tags = f.tags ?? []
    if (tags.includes('inflection-template')) blocks++
    if (blocks > 1) break
    if (tags.some((t) => SKIP_FORM.has(t)) || !/^[가-힣]+$/.test(f.form)) continue
    out.push(f.form.normalize('NFC'))
  }
  return [...new Set(out)]
}

/** 读一份 kaikki 的 JSONL.gz；只留韩语（lang_code ko）的 */
export function readKaikki(path: string): KaikkiEntry[] {
  const out: KaikkiEntry[] = []
  for (const line of gunzipSync(readFileSync(path)).toString('utf8').split('\n')) {
    if (!line) continue
    const o = JSON.parse(line) as Raw
    if (o.lang_code && o.lang_code !== 'ko') continue
    const senses: KaikkiSense[] = []
    let formOf = false
    for (const s of o.senses ?? []) {
      if (s.form_of?.length || s.alt_of?.length) formOf = true
      const g = (s.glosses ?? []).filter(Boolean)
      if (g.length) senses.push({ glosses: g, tags: s.tags ?? [] })
    }
    out.push({
      word: o.word.normalize('NFC'),
      pos: o.pos,
      ipa: (o.sounds ?? []).filter((x) => x.ipa).map((x) => x.ipa!),
      hanja: (o.forms ?? [])
        .filter((f) => f.tags?.includes('hanja'))
        .map((f) => f.form.normalize('NFC')),
      audio: (o.sounds ?? [])
        .filter((x) => x.ogg_url || x.mp3_url)
        .map((x) => ({ url: (x.mp3_url ?? x.ogg_url)!, label: x.tags?.join(' ') || undefined })),
      senses,
      formOf: formOf && senses.length <= 1,
      conj: conjForms(o.forms ?? [])
    })
  }
  return out
}
