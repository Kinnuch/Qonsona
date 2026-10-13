import { isNotebookReviewSettings } from './review-settings'
import { LANG_CODES } from './lang/types'
/** 可携带的个人学习数据：只收学习记录和文字，不接受任意磁盘路径。 */
import type { Notebook } from './notebook'
import type { CourseProgress } from './course'
import type { PracticeLog } from './exam'
import type { ActivityLog } from './stats'
import { isRewards, mergeRewards } from './rewards'
import {
  isArticleQuizProgress,
  mergeArticleQuizProgress,
  type ArticleQuizProgress
} from './article-quiz'

export type TransferScope = 'notebook' | 'personal'
export interface TransferPack {
  id: string
  name: string
  kind: 'builtin' | 'qonlang'
}
export interface TransferFile {
  path: string
  content: unknown
}
export interface TransferBundle {
  app: 'qonsona-transfer'
  format: 1
  scope: TransferScope
  appVersion: string
  createdAt: string
  packs: TransferPack[]
  files: TransferFile[]
}
export interface TransferCount {
  pack: string
  cards: number
  lists: number
  courses: number
  exams: number
  articles: number
}
export interface TransferPreview {
  token: string
  scope: TransferScope
  createdAt: string
  fileName: string
  files: number
  added: number
  updated: number
  unchanged: number
  conflicts: number
  counts: TransferCount[]
  missingPacks: string[]
}
export interface TransferResult {
  files: number
  saved: string
}
export const TRANSFER_MAX_BYTES = 32 * 1024 * 1024
/** Same language list as the registry, without importing language content into transfer validators. */
export const BUILTIN_TRANSFER_IDS: readonly string[] = ['ja', ...LANG_CODES]
const BUILTIN = new Set(BUILTIN_TRANSFER_IDS)
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
export function validTransferId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(id) && !RESERVED.test(id)
}
function fail(message: string): never {
  throw new Error(`Invalid learning transfer: ${message}`)
}
function object(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) fail('expected object')
  return x as Record<string, unknown>
}
function text(x: unknown, max = 1000000): asserts x is string {
  if (typeof x !== 'string' || x.length > max) fail('invalid text')
}
function number(x: unknown, max = 1e15): asserts x is number {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > max)
    fail('invalid nonnegative number')
}
function bool(x: unknown): void {
  if (typeof x !== 'boolean') fail('invalid boolean')
}
function localized(x: unknown): void {
  if (typeof x === 'string') return text(x)
  const translations = object(x)
  if (!Object.keys(translations).length) fail('empty localized text')
  for (const [lang, value] of Object.entries(translations)) {
    if (!/^[A-Za-z][A-Za-z0-9-]{0,34}$/.test(lang)) fail('invalid text language')
    text(value)
  }
}
function date(x: unknown): void {
  text(x, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x) || new Date(x + 'T12:00:00Z').toISOString().slice(0, 10) !== x)
    fail('invalid day')
}
/** 防止原型键、过深结构、非有限数字与资源耗尽；扩展字段也必须通过。 */
export function validateJson(value: unknown): void {
  let nodes = 0
  function visit(x: unknown, depth: number): void {
    if (++nodes > 2000000 || depth > 35) fail('data too complex')
    if (x === null || typeof x === 'boolean') return
    if (typeof x === 'string') {
      text(x)
      return
    }
    if (typeof x === 'number') {
      if (!Number.isFinite(x)) fail('nonfinite number')
      return
    }
    if (Array.isArray(x)) {
      if (x.length > 100000) fail('array too large')
      for (const v of x) visit(v, depth + 1)
      return
    }
    const r = object(x)
    for (const [key, v] of Object.entries(r)) {
      if (
        ['__proto__', 'prototype', 'constructor'].includes(key) ||
        key.length > 256 ||
        [...key].some((char) => char.charCodeAt(0) < 32)
      )
        fail('unsafe key')
      visit(v, depth + 1)
    }
  }
  visit(value, 0)
}
function recordKey(key: string): void {
  if (
    !key ||
    key.length > 200 ||
    [...key].some((char) => char.charCodeAt(0) < 32) ||
    key.includes('\\') ||
    key.split('/').some((p) => p === '.' || p === '..')
  )
    fail('invalid record key')
}
function version(r: Record<string, unknown>): void {
  if (r.version !== 1) fail('unsupported document version')
}
function validateNotebook(x: unknown, pack: string): void {
  const r = object(x)
  version(r)
  const cards = object(r.cards)
  if (Object.keys(cards).length > 100000) fail('too many cards')
  for (const [key, value] of Object.entries(cards)) {
    const c = object(value)
    recordKey(key)
    if (c.key !== key) fail('card key mismatch')
    if (BUILTIN.has(pack) && !(pack === 'ja' ? /^ja-[1-9]\d*$/ : /^lex-[1-9]\d*$/).test(key))
      fail('card key does not match language')
    if (BUILTIN.has(pack)) {
      const entry = Number(key.slice(key.indexOf('-') + 1))
      if (!Number.isSafeInteger(entry) || entry <= 0) fail('invalid dictionary entry id')
    }
    if (!BUILTIN.has(pack) && !/^(lexeme|phrase)-[A-Za-z0-9_-]+$/.test(key))
      fail('invalid custom-pack card key')
    text(c.front)
    text(c.reading)
    for (const v of Object.values(object(c.meaning))) text(v)
    for (const field of ['due', 'ivl', 'ease', 'reps', 'lapses', 'last', 'seen', 'added', 'order'])
      number(c[field])
    if ((c.ease as number) <= 0 || (c.ease as number) > 10) fail('invalid ease factor')
    for (const field of ['reps', 'lapses', 'seen', 'order'])
      if (!Number.isSafeInteger(c[field])) fail('invalid card counter')
    if (![0, 1, 2, 3].includes(c.state as number)) fail('invalid card state')
    if (!Array.isArray(c.hist) || c.hist.length > 40) fail('invalid review history')
    for (const h of c.hist) {
      if (!Array.isArray(h) || h.length !== 2 || ![0, 3, 5].includes(h[1])) fail('invalid grade')
      number(h[0])
    }
  }
  if (!Array.isArray(r.lists) || r.lists.length > 10000) fail('invalid lists')
  const ids = new Set<string>()
  const member = new Set<string>()
  for (const v of r.lists) {
    const l = object(v)
    text(l.id, 200)
    recordKey(l.id)
    if (ids.has(l.id)) fail('duplicate list')
    ids.add(l.id)
    text(l.name)
    number(l.createdAt)
    if (l.source !== undefined) text(l.source, 200)
    if (!Array.isArray(l.keys) || new Set(l.keys).size !== l.keys.length) fail('invalid list keys')
    for (const key of l.keys) {
      if (typeof key !== 'string' || !Object.hasOwn(cards, key)) fail('dangling list card')
      member.add(key)
    }
  }
  if (!ids.has('mine') || Object.keys(cards).some((k) => !member.has(k)))
    fail('missing default list or orphan card')
  for (const [day, value] of Object.entries(object(r.days))) {
    date(day)
    const d = object(value)
    for (const k of ['learned', 'reviewed', 'total', 'correct']) number(d[k])
    if ((d.correct as number) > (d.total as number)) fail('invalid daily score')
  }
  number(r.seq)
  if (r.review !== undefined) {
    if (!isNotebookReviewSettings(r.review)) fail('invalid review settings')
    for (const key of Object.keys(r.review.lists)) {
      recordKey(key)
      if (!ids.has(key)) fail('review settings refer to missing list')
    }
  }
  if (r.reviewDays !== undefined)
    for (const [scope, days] of Object.entries(object(r.reviewDays))) {
      if (scope !== 'language' && !scope.startsWith('list:')) fail('invalid review scope')
      if (scope.startsWith('list:')) recordKey(scope.slice(5))
      for (const [day, value] of Object.entries(object(days))) {
        date(day)
        const d = object(value)
        for (const k of ['learned', 'reviewed', 'total', 'correct']) number(d[k])
        if ((d.correct as number) > (d.total as number)) fail('invalid review daily score')
      }
    }
}
function validateCourses(x: unknown): void {
  const r = object(x)
  version(r)
  for (const category of ['lessons', 'tests'])
    for (const [key, value] of Object.entries(object(r[category]))) {
      recordKey(key)
      const v = object(value)
      number(v.best, 1)
      number(v.tries)
      number(v.at)
      bool(v.passed)
      if (category === 'lessons') bool(v.learned)
    }
  for (const [key, value] of Object.entries(object(r.items))) {
    recordKey(key)
    const v = object(value)
    number(v.right)
    number(v.wrong)
  }
  if (r.last !== null) {
    const last = object(r.last)
    text(last.course, 200)
    text(last.lesson, 200)
    recordKey(last.course)
    recordKey(last.lesson)
  }
}
function validatePractice(x: unknown): void {
  const r = object(x)
  version(r)
  if (!Array.isArray(r.exams) || r.exams.length > 10000) fail('invalid exam history')
  const seen = new Set<string>()
  for (const value of r.exams) {
    const e = object(value)
    text(e.id, 200)
    recordKey(e.id)
    if (seen.has(e.id)) fail('duplicate exam id')
    seen.add(e.id)
    text(e.level, 100)
    number(e.at)
    number(e.seconds)
    const paper = object(e.paper)
    text(paper.id, 200)
    text(paper.level, 100)
    localized(paper.title)
    if (paper.scoring !== null) text(paper.scoring, 100)
    if (paper.rule !== undefined) {
      const rule = object(paper.rule)
      number(rule.pass)
      if (!Array.isArray(rule.parts)) fail('invalid scoring rule parts')
      for (const value of rule.parts) {
        const part = object(value)
        localized(part.name)
        number(part.max)
        number(part.min, part.max)
        if (
          !Array.isArray(part.sections) ||
          !part.sections.every((id) => ['vocab', 'grammar', 'reading', 'listening'].includes(id))
        )
          fail('invalid scoring rule sections')
      }
    }
    if (
      !Array.isArray(paper.sections) ||
      !Array.isArray(e.answers) ||
      paper.sections.length !== e.answers.length
    )
      fail('invalid exam sections')
    for (let i = 0; i < paper.sections.length; i++) {
      const section = object(paper.sections[i])
      if (!['vocab', 'grammar', 'reading', 'listening'].includes(String(section.id)))
        fail('invalid exam section')
      localized(section.title)
      number(section.minutes, 1440)
      if (
        !Array.isArray(section.questions) ||
        !Array.isArray(e.answers[i]) ||
        section.questions.length !== e.answers[i].length
      )
        fail('invalid exam answers')
      for (let j = 0; j < section.questions.length; j++) {
        const q = object(section.questions[j])
        text(q.id, 200)
        if (
          ![
            'kanji-reading',
            'orthography',
            'word-meaning',
            'meaning-word',
            'context',
            'grammar-fill',
            'grammar-meaning',
            'conjugate',
            'sentence',
            'listen-sentence',
            'listen-word',
            'sound-change',
            'gender',
            'spelling',
            'custom'
          ].includes(String(q.kind))
        )
          fail('invalid question kind')
        if (q.section !== section.id) fail('question section mismatch')
        localized(q.ask)
        if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 20)
          fail('invalid question choices')
        for (const value of q.choices) localized(object(value).text)
        number(q.answer, q.choices.length - 1)
        if (!Number.isInteger(q.answer)) fail('invalid answer')
        const prompt = object(q.prompt)
        text(prompt.text)
        if (prompt.sub !== undefined) localized(prompt.sub)
        for (const name of ['blank', 'mark'])
          if (prompt[name] !== undefined) {
            const span = prompt[name]
            if (!Array.isArray(span) || span.length !== 2 || !span.every(Number.isInteger))
              fail('invalid question span')
            if (span[0] < 0 || span[1] < span[0] || span[1] > prompt.text.length)
              fail('question span outside text')
          }
        const explain = object(q.explain)
        if (!Array.isArray(explain.lines)) fail('invalid explanation')
        for (const line of explain.lines) localized(line)
        const a = e.answers[i][j]
        if (a !== null) {
          number(a, q.choices.length - 1)
          if (!Number.isInteger(a)) fail('invalid given answer')
        }
      }
    }
    const outcome = object(e.outcome)
    number(outcome.right)
    number(outcome.total)
    if ((outcome.right as number) > (outcome.total as number) || !Array.isArray(outcome.sections))
      fail('invalid exam outcome')
    for (const value of outcome.sections) {
      const section = object(value)
      if (!['vocab', 'grammar', 'reading', 'listening'].includes(String(section.id)))
        fail('invalid outcome section')
      number(section.total)
      number(section.right, section.total)
    }
    for (const field of ['scaled', 'pass']) if (outcome[field] !== null) number(outcome[field])
    if (outcome.passed !== null) bool(outcome.passed)
    if (outcome.parts !== null) {
      if (!Array.isArray(outcome.parts)) fail('invalid scored parts')
      for (const value of outcome.parts) {
        const part = object(value)
        localized(part.name)
        number(part.max)
        number(part.min, part.max)
        number(part.score, part.max)
        bool(part.ok)
      }
    }
  }
  for (const [day, value] of Object.entries(object(r.days))) {
    date(day)
    const d = object(value)
    number(d.answered)
    number(d.right)
    if ((d.right as number) > (d.answered as number)) fail('invalid practice score')
  }
}
function validateStats(x: unknown, packs: Set<string>): void {
  const r = object(x)
  version(r)
  if (r.rewards !== undefined) {
    if (!isRewards(r.rewards)) fail('invalid collection progress')
    for (const d of Object.values(r.rewards.days))
      for (const c of d.completions) if (!packs.has(c.packId)) fail('collection language missing')
  }
  for (const [day, value] of Object.entries(object(r.days))) {
    date(day)
    for (const [pack, mods] of Object.entries(object(object(value).packs))) {
      if (!packs.has(pack)) fail('statistics language missing')
      for (const [module, seconds] of Object.entries(object(mods))) {
        recordKey(module)
        number(seconds, 86400)
      }
    }
  }
}
export function transferPath(path: string): { kind: string; pack: string; id?: string } | null {
  if (path === 'stats.json') return { kind: 'stats', pack: '*' }
  let m = /^(notebook|courses|practice|article-quizzes)\/([A-Za-z0-9_-]+)\.json$/.exec(path)
  if (m && validTransferId(m[2])) return { kind: m[1], pack: m[2] }
  m = /^articles\/(?:([a-z]+)\/)?state\.json$/.exec(path)
  if (m && (!m[1] || (BUILTIN.has(m[1]) && m[1] !== 'ja')))
    return { kind: 'article-state', pack: m[1] ?? 'ja' }
  m = /^articles\/(?:([a-z]+)\/user\/)?([A-Za-z0-9_-]+)\.json$/.exec(path)
  if (
    m &&
    validTransferId(m[2]) &&
    (m[1] || m[2].toLowerCase() !== 'state') &&
    (!m[1] || (BUILTIN.has(m[1]) && m[1] !== 'ja'))
  )
    return { kind: 'article', pack: m[1] ?? 'ja', id: m[2] }
  m = /^articles\/(?:([a-z]+)\/)?translations\/([A-Za-z0-9_-]+)\.txt$/.exec(path)
  if (m && validTransferId(m[2]) && (!m[1] || (BUILTIN.has(m[1]) && m[1] !== 'ja')))
    return { kind: 'translation', pack: m[1] ?? 'ja', id: m[2] }
  return null
}
export function validateTransfer(raw: unknown): TransferBundle {
  validateJson(raw)
  const r = object(raw)
  if (
    r.app !== 'qonsona-transfer' ||
    r.format !== 1 ||
    !['notebook', 'personal'].includes(String(r.scope))
  )
    fail('unsupported format')
  text(r.appVersion, 80)
  text(r.createdAt, 80)
  if (!Number.isFinite(Date.parse(r.createdAt))) fail('invalid creation date')
  if (
    !Array.isArray(r.packs) ||
    r.packs.length > 1000 ||
    !Array.isArray(r.files) ||
    r.files.length > 5000
  )
    fail('invalid files or languages')
  const packs = new Set<string>()
  const packNames = new Set<string>()
  for (const value of r.packs) {
    const p = object(value)
    if (!validTransferId(p.id) || packNames.has(p.id.toLowerCase()))
      fail('invalid or duplicate language')
    if (BUILTIN.has(p.id.toLowerCase()) && !BUILTIN.has(p.id))
      fail('builtin language id must use lowercase')
    text(p.name, 300)
    if (
      !['builtin', 'qonlang'].includes(String(p.kind)) ||
      (p.kind === 'builtin') !== BUILTIN.has(p.id)
    )
      fail('language kind mismatch')
    packs.add(p.id)
    packNames.add(p.id.toLowerCase())
  }
  const paths = new Set<string>()
  for (const value of r.files) {
    const f = object(value)
    text(f.path, 250)
    const p = transferPath(f.path)
    if (!p || paths.has(f.path.toLowerCase()) || (p.pack !== '*' && !packs.has(p.pack)))
      fail('unsafe, duplicate or undeclared file')
    paths.add(f.path.toLowerCase())
    if (r.scope === 'notebook' && p.kind !== 'notebook')
      fail('notebook transfer contains other data')
    if (p.kind === 'notebook') validateNotebook(f.content, p.pack)
    else if (p.kind === 'courses') validateCourses(f.content)
    else if (p.kind === 'practice') validatePractice(f.content)
    else if (p.kind === 'stats') validateStats(f.content, packs)
    else if (p.kind === 'article-quizzes') {
      for (const [id, progress] of Object.entries(object(f.content))) {
        recordKey(id)
        if (!isArticleQuizProgress(progress)) fail('invalid article quiz progress')
      }
    } else if (p.kind === 'translation') text(f.content)
    else if (p.kind === 'article-state') {
      const state = object(f.content)
      for (const [id, at] of Object.entries(object(state.read))) {
        recordKey(id)
        text(at, 80)
        if (!Number.isFinite(Date.parse(at))) fail('invalid read date')
      }
      for (const [id, level] of Object.entries(object(state.levels))) {
        recordKey(id)
        if (level !== null && typeof level !== 'string' && typeof level !== 'number')
          fail('invalid reading level')
      }
    } else {
      const a = object(f.content)
      if (a.id !== p.id || a.source !== 'user' || (p.pack !== 'ja' && a.code !== p.pack))
        fail('article language or id mismatch')
      text(a.title)
      text(a.body)
      for (const key of ['author', 'topic', 'origin', 'license', 'colophon', 'translation'])
        if (a[key] !== undefined) text(a[key])
      if (a.url !== undefined && a.url !== '') {
        text(a.url, 4000)
        let protocol = ''
        try {
          protocol = new URL(a.url).protocol
        } catch {
          fail('invalid article URL')
        }
        if (!['https:', 'http:'].includes(protocol)) fail('unsupported article URL protocol')
      }
      number(a.chars)
      if (a.chars !== (a.body as string).length) fail('article length mismatch')
    }
  }
  return r as unknown as TransferBundle
}

/** 冲突合并不相加累计值，避免重复导入膨胀；两个设备同日独立学习会保守取较大值。 */
function maxMap(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v)
  return out
}
function mergeCounters(
  a: Record<string, Record<string, number>>,
  b: Record<string, Record<string, number>>
): Record<string, Record<string, number>> {
  const out = structuredClone(a)
  for (const [k, v] of Object.entries(b)) out[k] = maxMap(out[k] ?? {}, v)
  return out
}
export function mergeNotebook(local: Notebook, incoming: Notebook): Notebook {
  const out = structuredClone(local)
  for (const [key, c] of Object.entries(incoming.cards)) {
    const old = out.cards[key]
    if (!old) {
      out.cards[key] = { ...structuredClone(c), order: out.seq++ }
      continue
    }
    const chosen = c.last > old.last ? structuredClone(c) : old
    chosen.hist = [...new Map([...old.hist, ...c.hist].map((h) => [`${h[0]}:${h[1]}`, h])).values()]
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .slice(-40)
    chosen.added = Math.min(old.added, c.added)
    chosen.order = old.order
    chosen.seen = Math.max(old.seen, c.seen)
    chosen.lapses = Math.max(old.lapses, c.lapses)
    out.cards[key] = chosen
  }
  for (const list of incoming.lists) {
    const old = out.lists.find((l) => l.id === list.id)
    if (old) old.keys = [...new Set([...old.keys, ...list.keys])]
    else out.lists.push(structuredClone(list))
  }
  out.days = mergeCounters(
    out.days as unknown as Record<string, Record<string, number>>,
    incoming.days as unknown as Record<string, Record<string, number>>
  ) as unknown as Notebook['days']
  out.seq = Math.max(out.seq, incoming.seq, ...Object.values(out.cards).map((c) => c.order + 1))
  const l = local as Notebook & {
    review?: { language: unknown; lists: Record<string, unknown>; updatedAt: number }
  }
  const i = incoming as typeof l
  if (i.review) {
    const latest = !l.review || i.review.updatedAt > l.review.updatedAt ? i.review : l.review
    ;(out as typeof l).review = {
      ...structuredClone(latest),
      ...(!latest.language && (l.review?.language || i.review.language)
        ? { language: structuredClone(l.review?.language ?? i.review.language) }
        : {}),
      lists: { ...structuredClone(l.review?.lists ?? {}), ...structuredClone(i.review.lists) }
    }
    if (l.review && l.review.updatedAt >= i.review.updatedAt)
      (out as typeof l).review!.lists = {
        ...structuredClone(i.review.lists),
        ...structuredClone(l.review.lists)
      }
  }
  const localDays = local.reviewDays ?? {},
    incomingDays = incoming.reviewDays ?? {}
  out.reviewDays = structuredClone(localDays)
  for (const [scope, days] of Object.entries(incomingDays))
    out.reviewDays[scope] = mergeCounters(
      (out.reviewDays[scope] as unknown as Record<string, Record<string, number>>) ?? {},
      days as unknown as Record<string, Record<string, number>>
    ) as unknown as Notebook['days']
  return out
}
export function mergeCourses(a: CourseProgress, b: CourseProgress): CourseProgress {
  const out = structuredClone(a)
  for (const key of ['lessons', 'tests'] as const)
    for (const [id, v] of Object.entries(b[key])) {
      const old = out[key][id]
      out[key][id] = old
        ? {
            ...old,
            ...(v.at > old.at ? v : {}),
            best: Math.max(old.best, v.best),
            tries: Math.max(old.tries, v.tries),
            at: Math.max(old.at, v.at),
            passed: old.passed || v.passed,
            ...(key === 'lessons'
              ? { learned: ('learned' in old && old.learned) || ('learned' in v && v.learned) }
              : {})
          }
        : (structuredClone(v) as never)
    }
  out.items = mergeCounters(a.items, b.items) as CourseProgress['items']
  const latestAt = (p: CourseProgress): number =>
    p.last ? (p.lessons[`${p.last.course}/${p.last.lesson}`]?.at ?? 0) : 0
  if (latestAt(b) > latestAt(a)) out.last = structuredClone(b.last)
  return out
}
export function mergePractice(a: PracticeLog, b: PracticeLog): PracticeLog {
  const exams = new Map(a.exams.map((e) => [e.id, structuredClone(e)]))
  for (const e of b.exams) if (!exams.has(e.id)) exams.set(e.id, structuredClone(e))
  return {
    version: 1,
    exams: [...exams.values()].sort((x, y) => x.at - y.at || x.id.localeCompare(y.id)),
    days: mergeCounters(a.days, b.days) as PracticeLog['days']
  }
}
export function mergeStats(a: ActivityLog, b: ActivityLog): ActivityLog {
  const out = structuredClone(a)
  if (a.rewards && b.rewards) out.rewards = mergeRewards(a.rewards, b.rewards)
  else if (b.rewards) out.rewards = structuredClone(b.rewards)
  for (const [day, data] of Object.entries(b.days)) {
    const old = (out.days[day] ??= { packs: {} })
    for (const [pack, mods] of Object.entries(data.packs))
      old.packs[pack] = maxMap(old.packs[pack] ?? {}, mods)
  }
  return out
}
export function mergeTransferFile(path: string, local: unknown, incoming: unknown): unknown {
  if (local === undefined) return structuredClone(incoming)
  const kind = transferPath(path)!.kind
  if (kind === 'notebook') return mergeNotebook(local as Notebook, incoming as Notebook)
  if (kind === 'courses') return mergeCourses(local as CourseProgress, incoming as CourseProgress)
  if (kind === 'practice') return mergePractice(local as PracticeLog, incoming as PracticeLog)
  if (kind === 'stats') return mergeStats(local as ActivityLog, incoming as ActivityLog)
  if (kind === 'article-quizzes') {
    const out = structuredClone(local) as Record<string, ArticleQuizProgress>
    for (const [id, p] of Object.entries(incoming as Record<string, ArticleQuizProgress>))
      out[id] = out[id] ? mergeArticleQuizProgress(out[id], p) : structuredClone(p)
    return out
  }
  if (kind === 'article-state') {
    const a = local as { read: Record<string, string>; levels: Record<string, unknown> }
    const b = incoming as typeof a
    const read = { ...a.read }
    for (const [id, at] of Object.entries(b.read))
      if (!read[id] || Date.parse(at) > Date.parse(read[id])) read[id] = at
    return { ...a, read, levels: { ...b.levels, ...a.levels } }
  }
  // 同一文章/译文 id 内容冲突保留本机；预览列明冲突，不覆写文字。
  return structuredClone(local)
}
