/**
 * 法语维基词典的法语词条（kaikki.org，wiktextract 抽取）→ 按「词头 + 词性」整理：
 * - 法语释义（单语 mono，给中高级）；
 * - 每个义项的译词表：中文（lang_code = zh）与英文（en）按 sense_index 对到义项上——英文译词是把这个义项
 *   对到英文维基词典义项上的桥，中文译词是中文释义的一个来源；
 * - IPA（\ʃa\ 改写成 /ʃa/）、h aspiré（IPA 前标着 ((h aspiré))）、录音（Lingua Libre 很全）、动词的组。
 * 整份 3 GB，大半是变位形式的页面，先按 pos_title 粗筛；只留英文维基词典或 Lexique 里有的词。
 */
import { join } from 'node:path'
import type { AudioRef, PosTag } from '../../../src/shared/lang/types'
import { frKey } from '../../../src/shared/lang/fr/rules'
import { CACHE } from './fetch'
import { DOWNLOADS } from './sources'
import { cached, log, readJsonl } from './io'
import { audioRef, mapPos } from './wikt-en'

interface FxSound {
  ipa?: string
  audio?: string
  mp3_url?: string
  ogg_url?: string
  raw_tags?: string[]
  tags?: string[]
}
interface FxTranslation {
  lang_code?: string
  word?: string
  sense?: string
  sense_index?: number
  traditional_writing?: string
  tags?: string[]
}
interface FxSense {
  glosses?: string[]
  tags?: string[]
  raw_tags?: string[]
  topics?: string[]
  form_of?: unknown[]
  alt_of?: unknown[]
}
interface FxForm {
  form?: string
  tags?: string[]
  ipas?: string[]
}
interface FxEntry {
  word: string
  lang_code: string
  pos: string
  pos_title?: string
  tags?: string[]
  senses?: FxSense[]
  forms?: FxForm[]
  sounds?: FxSound[]
  translations?: FxTranslation[]
  categories?: ({ name: string } | string)[]
}

export interface FrSense {
  /** 法语释义 */
  m: string
  t?: string[]
  en?: string[]
  zh?: string[]
}

export interface FrEntry {
  k: string
  w: string
  p: PosTag
  g?: string
  /** 词首 h 是 h aspiré（不省音、不连诵） */
  h?: 1
  /** 动词的组：1、2、3 */
  grp?: number
  ipa?: string
  /** 变形的读音：{ 词形（frKey）: /IPA/ }（变位表、复数阴性形式的读音） */
  fi?: Record<string, string>
  au?: AudioRef[]
  s: FrSense[]
}

/** 法语维基词典的语体标签里要的（wiktextract 已经换成英文标签词） */
const KEEP_TAGS = new Set([
  'familiar',
  'colloquial',
  'slang',
  'vulgar',
  'very-familiar',
  'pejorative',
  'offensive',
  'formal',
  'literary',
  'poetic',
  'archaic',
  'obsolete',
  'dated',
  'rare',
  'figuratively',
  'childish',
  'ironic',
  'Anglicism',
  'neologism'
])

const MAX_SENSES = 8
const MAX_GLOSS = 220

/** \ʃa\ → /ʃa/；去掉 ((h aspiré)) 之类的说明 */
function ipaOf(sounds: FxSound[]): { ipa?: string; h?: 1 } {
  let h: 1 | undefined
  for (const s of sounds) {
    if (!s.ipa) continue
    if (/h aspiré/.test(s.ipa)) h = 1
    const m = /\\([^\\]+)\\/.exec(s.ipa)
    if (m) return { ipa: `/${m[1].trim()}/`, h }
  }
  return { h }
}

function catNames(e: FxEntry): string[] {
  return (e.categories ?? []).map((c) => (typeof c === 'string' ? c : c.name))
}

const isForm = (e: FxEntry): boolean =>
  /^Forme /.test(e.pos_title ?? '') ||
  (!!e.senses?.length && e.senses.every((s) => s.form_of?.length || s.alt_of?.length))

export async function loadFrWikt(want: Set<string>): Promise<FrEntry[]> {
  const file = join(CACHE, DOWNLOADS.frwikt.file)
  // 词集来自英文维基词典与 Lexique，那两份变了这里也要重算：用词集的大小与一个简单的校验和当版本的一部分
  let sum = 0
  for (const k of want) for (let i = 0; i < k.length; i++) sum = (sum * 31 + k.charCodeAt(i)) >>> 0
  return cached(`frwikt-${want.size}-${sum}`, 5, [file], async () => {
    log('读法语维基词典的法语词条（3 GB，一两分钟）…')
    const out: FrEntry[] = []
    let n = 0
    for await (const e of readJsonl<FxEntry>(
      file,
      (l) => !l.includes('"pos_title": "Forme ') && !l.includes('"pos": "name"')
    )) {
      if (e.lang_code !== 'fr' || isForm(e)) continue
      const k = frKey(e.word)
      if (!want.has(k)) continue
      const p = mapPos(e.pos, e.word)
      if (!p || p === 'propn') continue
      n++
      const tags = e.tags ?? []
      const g =
        p === 'noun'
          ? tags.includes('masculine') && tags.includes('feminine')
            ? 'mf'
            : tags.includes('masculine')
              ? 'm'
              : tags.includes('feminine')
                ? 'f'
                : undefined
          : undefined
      const senses = (e.senses ?? []).filter((s) => s.glosses?.length && !s.form_of && !s.alt_of)
      const tr = e.translations ?? []
      const s: FrSense[] = senses.slice(0, MAX_SENSES).map((x, i) => {
        const gl = x.glosses!.join(' ').replace(/\s+/g, ' ').trim()
        const own = tr.filter((t) => t.sense_index === i + 1 && t.word)
        const en = [...new Set(own.filter((t) => t.lang_code === 'en').map((t) => t.word!))]
        const zh = [...new Set(own.filter((t) => t.lang_code === 'zh').map((t) => t.word!))]
        const t = [...new Set((x.tags ?? []).filter((y) => KEEP_TAGS.has(y)))]
        return {
          m: gl.length > MAX_GLOSS ? gl.slice(0, MAX_GLOSS - 1).replace(/\s+\S*$/, '') + '…' : gl,
          ...(t.length ? { t } : {}),
          ...(en.length ? { en: en.slice(0, 6) } : {}),
          ...(zh.length ? { zh: zh.slice(0, 6) } : {})
        }
      })
      if (!s.length) continue
      // 没写 sense_index 的译词（「待整理的翻译」或整个词条一张表）：单独当一个没有释义的义项，
      // 英文的桥只用它们自己的英文，不借第一个义项的（tableau 的「数组」不能挂到「画」上）
      const loose = tr.filter((t) => !t.sense_index && t.word)
      const looseEn = [...new Set(loose.filter((t) => t.lang_code === 'en').map((t) => t.word!))]
      const looseZh = [...new Set(loose.filter((t) => t.lang_code === 'zh').map((t) => t.word!))]
      if (looseZh.length && looseEn.length)
        s.push({ m: '', en: looseEn.slice(0, 6), zh: looseZh.slice(0, 6) })
      const cats = catNames(e)
      const grp = cats.some((c) => c.startsWith('Verbes du premier groupe'))
        ? 1
        : cats.some((c) => c.startsWith('Verbes du deuxième groupe'))
          ? 2
          : cats.some((c) => c.startsWith('Verbes du troisième groupe'))
            ? 3
            : undefined
      const { ipa, h } = ipaOf(e.sounds ?? [])
      const fi: Record<string, string> = {}
      for (const f of e.forms ?? []) {
        if (!f.form || / /.test(f.form) || !f.ipas?.length) continue
        const m = /\\([^\\]+)\\/.exec(f.ipas[0])
        const fk = frKey(f.form)
        if (m && fk !== k && !fi[fk]) fi[fk] = `/${m[1].trim()}/`
      }
      const au: AudioRef[] = []
      for (const x of e.sounds ?? []) {
        const url = x.mp3_url ?? x.ogg_url
        if (!x.audio || !url || !/^https:\/\/upload\.wikimedia\.org\//.test(url)) continue
        au.push(audioRef(url, x.audio, [...(x.tags ?? []), ...(x.raw_tags ?? [])]))
      }
      out.push({
        k,
        w: e.word,
        p,
        ...(g ? { g } : {}),
        ...(h || cats.some((c) => /h aspiré/.test(c)) ? { h: 1 as const } : {}),
        ...(grp ? { grp } : {}),
        ...(ipa ? { ipa } : {}),
        ...(Object.keys(fi).length ? { fi } : {}),
        ...(au.length ? { au: au.slice(0, 12) } : {}),
        s
      })
    }
    log(`法语维基词典：留下 ${n} 条`)
    return out
  })
}
