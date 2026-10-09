/**
 * 读한국어기초사전（国立国语院《韩国语基础词典》）的整本 XML（LMF 格式，「사전 전체 내려받기」，不用登录）。
 * 一个 LexicalEntry 读成一个 KrEntry；外语译文只留中文、英文（另外九种不要）。
 * 文字内容的许可是 CC BY-SA 2.0 KR；录音、图片、视频（multimedia）各有各的许可，这里不取。
 */
import { unzipSync } from 'fflate'
import { readFileSync } from 'node:fs'

export interface KrExample {
  /** 구（短语）、문장（句子）、대화（对话，两句以上） */
  type: string
  text: string[]
}

export interface KrRelation {
  /** 유의어、반대말、참고어、준말、본말、높임말、낮춤말、큰말、작은말、센말、여린말 */
  type: string
  lemma: string
  hom?: number
  id?: number
}

export interface KrSense {
  id: number
  /** 韩语释义 */
  def: string
  zhLemma?: string
  zhDef?: string
  enLemma?: string
  enDef?: string
  /** 用法说明（「주로 구어에서 쓴다.」） */
  note?: string
  /** 句型（「1이 2를 듣다」） */
  pattern?: string
  examples: KrExample[]
  rel: KrRelation[]
  /** 有图、视频（不取，只记个数） */
  media: number
}

export interface KrForm {
  form: string
  pron: string[]
  /** 准말（缩略形）：되어 → 돼 */
  short?: { form: string; pron: string[] }[]
}

export interface KrEntry {
  /** 词典里的号（target_code），网上页面的地址用它 */
  id: number
  /** 同形词编号（0 表示没有同形词） */
  hom: number
  /** 단어、관용구、속담、구、문법‧표현 */
  unit: string
  /** 品词（명사、동사……）；惯用语、俗语没有 */
  pos: string
  w: string
  /** 另一种写法（Lemma@variant） */
  variants: string[]
  /** 原语：汉字（學校）、外来语的原文（bus） */
  origin?: string
  /** 发音（[학꾜]，可能几种；长音记 ː） */
  pron: string[]
  /** 活用（듣다：들어、들으니、듣는……） */
  conj: KrForm[]
  /** 初级、中级、高级、없음 */
  level: string
  /** 意义类别（「교육 > 교육 기관」） */
  sem?: string
  /** 主题（「학교생활」） */
  subj?: string
  /** 派生词、参见 */
  related: { type: string; form: string; id?: number }[]
  note?: string
  senses: KrSense[]
}

/** XML 里的实体：有的值被转义了两次（&amp;quot;），解两遍 */
export function unescapeXml(s: string): string {
  const once = (t: string): string =>
    t
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&amp;/g, '&')
  return once(once(s))
}

const FEAT = /<feat att="([^"]*)" val="([^"]*)"\s*\/>/g

/** 一段里（不进子元素）的 feat；同名的几个都留着 */
function feats(block: string): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const f of block.matchAll(FEAT)) {
    const v = unescapeXml(f[2]).trim()
    const list = m.get(f[1])
    if (list) list.push(v)
    else m.set(f[1], [v])
  }
  return m
}

const first = (m: Map<string, string[]>, k: string): string | undefined => m.get(k)?.[0]

/** 去掉子元素，只剩这一层的 feat */
function own(block: string, children: string[]): string {
  let s = block
  for (const c of children) s = s.replace(new RegExp(`<${c}[\\s>][\\s\\S]*?</${c}>`, 'g'), '')
  return s
}

function parseSense(block: string): KrSense {
  const id = Number(/<Sense att="id" val="(\d+)"/.exec(block)?.[1] ?? 0)
  const top = feats(own(block, ['SenseExample', 'Equivalent', 'SenseRelation', 'Multimedia']))
  const s: KrSense = {
    id,
    def: first(top, 'definition') ?? '',
    note: first(top, 'annotation'),
    pattern: first(top, 'syntacticPattern'),
    examples: [],
    rel: [],
    media: 0
  }
  for (const e of block.matchAll(/<Equivalent>([\s\S]*?)<\/Equivalent>/g)) {
    const f = feats(e[1])
    const lang = first(f, 'language')
    if (lang === '중국어') {
      s.zhLemma = first(f, 'lemma')
      s.zhDef = first(f, 'definition')
    } else if (lang === '영어') {
      s.enLemma = first(f, 'lemma')
      s.enDef = first(f, 'definition')
    }
  }
  for (const e of block.matchAll(/<SenseExample>([\s\S]*?)<\/SenseExample>/g)) {
    const f = feats(e[1])
    const text = (f.get('example') ?? []).filter(Boolean)
    if (text.length) s.examples.push({ type: first(f, 'type') ?? '', text })
  }
  for (const e of block.matchAll(/<SenseRelation>([\s\S]*?)<\/SenseRelation>/g)) {
    const f = feats(e[1])
    const lemma = first(f, 'lemma')
    if (!lemma) continue
    const hom = first(f, 'homonymNumber')
    const rid = first(f, 'id')
    s.rel.push({
      type: first(f, 'type') ?? '',
      lemma,
      hom: hom ? Number(hom) : undefined,
      id: rid ? Number(rid) : undefined
    })
  }
  s.media = (block.match(/<Multimedia>/g) ?? []).length
  return s
}

function parseEntry(block: string): KrEntry {
  const id = Number(/<LexicalEntry att="id" val="(\d+)"/.exec(block)?.[1] ?? 0)
  const top = feats(own(block, ['Lemma', 'WordForm', 'RelatedForm', 'Sense']))
  const lemma = feats(/<Lemma>([\s\S]*?)<\/Lemma>/.exec(block)?.[1] ?? '')
  const e: KrEntry = {
    id,
    hom: Number(first(top, 'homonym_number') ?? 0),
    unit: first(top, 'lexicalUnit') ?? '',
    pos: first(top, 'partOfSpeech') ?? '',
    w: first(lemma, 'writtenForm') ?? '',
    variants: lemma.get('variant') ?? [],
    origin: first(top, 'origin'),
    pron: [],
    conj: [],
    level: first(top, 'vocabularyLevel') ?? '',
    sem: first(top, 'semanticCategory'),
    subj: first(top, 'subjectCategiory'),
    related: [],
    note: first(top, 'annotation'),
    senses: []
  }
  for (const w of block.matchAll(/<WordForm>([\s\S]*?)<\/WordForm>/g)) {
    const inner = w[1]
    const f = feats(own(inner, ['FormRepresentation']))
    const type = first(f, 'type')
    const pron = (f.get('pronunciation') ?? []).filter(Boolean)
    if (type === '발음') e.pron.push(...pron)
    else if (type === '활용') {
      const form = first(f, 'writtenForm')
      if (!form) continue
      const short: KrForm['short'] = []
      for (const r of inner.matchAll(/<FormRepresentation>([\s\S]*?)<\/FormRepresentation>/g)) {
        const rf = feats(r[1])
        const sf = first(rf, 'writtenForm')
        if (sf) short.push({ form: sf, pron: (rf.get('pronunciation') ?? []).filter(Boolean) })
      }
      e.conj.push({ form, pron, short: short.length ? short : undefined })
    }
  }
  for (const r of block.matchAll(/<RelatedForm>([\s\S]*?)<\/RelatedForm>/g)) {
    const f = feats(r[1])
    const form = first(f, 'writtenForm')
    const rid = first(f, 'id')
    if (form) e.related.push({ type: first(f, 'type') ?? '', form, id: rid ? Number(rid) : undefined })
  }
  for (const s of block.matchAll(/<Sense att="id"[\s\S]*?<\/Sense>/g)) e.senses.push(parseSense(s[0]))
  return e
}

/** 读整本词典（XML 的 zip）；十几个文件、五万多条，几十秒 */
export function* readKrdict(zipPath: string): Generator<KrEntry> {
  const files = unzipSync(readFileSync(zipPath))
  const names = Object.keys(files).sort((a, b) => parseInt(a) - parseInt(b))
  for (const name of names) {
    const text = Buffer.from(files[name]).toString('utf8')
    for (const m of text.matchAll(/<LexicalEntry[\s\S]*?<\/LexicalEntry>/g)) yield parseEntry(m[0])
  }
}

/** 发音里的长音记号（ː）去掉；几种读法用 / 隔开的拆开 */
export function cleanPron(p: string): string[] {
  return p
    .split('/')
    .map((x) => x.replace(/[ːˑ:]/g, '').trim())
    .filter(Boolean)
}
