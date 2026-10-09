/**
 * 千语集语言的练习：按词库、构形与例句出题，跟日语的一样是自带答案与解析的题。
 * 看词选意思、看意思选词、听音选词（读 IPA）、选出正确的形（干扰项是这个词别的形）、看句子选译文；
 * 有词源与音变规则的，还出音变题（看原始语的形式，选出按音变规律推到这门语言的样子，
 * 干扰项是推导途中只变了一部分的形式）。
 * 可以只出某一级（按词频分的级）的词。全由项目数据推出来，不认识任何一门具体语言。纯函数，测试里直接用。
 */
import type { Language, Lexeme, LocalizedText, Project, RuleSet } from '$qon/core/model'
import { historyChain, type HistoryChain } from '$qon/core/history'
import { splitSourceForm } from '$qon/core/etymology'
import { languageParseOptions } from '$qon/engine/phon'
import {
  parseRuleText,
  revertReplacements,
  runRules,
  stripStress,
  type RuleProgram
} from '$qon/engine/sca'
import { rng, shuffled, type Sound, type Text } from '$shared/course'
import { PRACTICE_SECTION, type Choice, type ExamQuestion, type PracticeKind } from '$shared/exam'
import { spellingIpa, storedIpa } from '$lib/packs/qonlang/pronounce'
import type { LevelAssignment } from '$lib/packs/qonlang/levels'

export interface QonPracticeInput {
  project: Project
  lang: Language
  /** 学习包的语言标记（选项、题面用数据字体） */
  bcp47: string
  hidden: ReadonlySet<string>
  levels: LevelAssignment | null
  /** 只出这一级的词；null 是全部 */
  level: string | null
  gloss: (l: Lexeme) => string
  pick: (t: LocalizedText) => string
}

interface Word {
  l: Lexeme
  gloss: string
  ipa: string
}

/** 词的读音（没录的按正字法现推，一千多个词要一两百毫秒）：同一个项目里算过的记下来 */
const ipaCache = new WeakMap<Project, Map<string, string>>()
function ipaOf(x: QonPracticeInput, l: Lexeme): string {
  let known = ipaCache.get(x.project)
  if (!known) ipaCache.set(x.project, (known = new Map()))
  let ipa = known.get(l.id)
  if (ipa === undefined) {
    ipa = storedIpa(x.lang, l.pronunciations) || spellingIpa(x.lang, l.lemma)
    known.set(l.id, ipa)
  }
  return ipa
}

function wordsOf(x: QonPracticeInput): Word[] {
  return x.project.lexemes
    .filter(
      (l) =>
        l.languageId === x.lang.id &&
        !x.hidden.has(l.id) &&
        l.lemma.trim() &&
        (!x.level || x.levels?.entries[l.id] === x.level)
    )
    .map((l) => ({ l, gloss: x.gloss(l), ipa: ipaOf(x, l) }))
}

/** 有两个以上不同写法的形的词（出变形题） */
const formsOf = (l: Lexeme): [string, string][] =>
  Object.entries(l.forms ?? {})
    .filter(([, f]) => f?.surface?.trim())
    .map(([k, f]) => [k, f.surface])

// ── 音变 ──

/** 一个从原始语推过来、确实变了样的词与它的音变链 */
interface Change {
  w: Word
  chain: HistoryChain
}

/** 比较形式时不管重音记号、星号、大小写 */
const bare = (s: string): string => stripStress(s).replace(/^\*+/, '').trim().toLowerCase()

/** 解析好的音变规则（一套规则解析一次；规则改了重新解析） */
const programs = new WeakMap<RuleSet, { key: string; program: RuleProgram }>()
function programOf(project: Project, rs: RuleSet): RuleProgram {
  const boundId = Object.values(rs.stageLanguages).find((id) => !!id)
  const base = project.languages.find((l) => l.id === boundId) ?? null
  const opts = languageParseOptions(base, project)
  const key = rs.text + '\n' + JSON.stringify(opts)
  const hit = programs.get(rs)
  if (hit?.key === key) return hit.program
  const program = parseRuleText(rs.text, opts)
  programs.set(rs, { key, program })
  return program
}

/**
 * 按音变规则重推一遍，记下每一条音变之后的形式（出干扰项用：只变了一部分的样子；
 * 链上手改过的中间形式不管）
 */
function partialForms(project: Project, chain: HistoryChain): string[] {
  const rs = project.ruleSets.find((r) => r.id === chain.ruleSetId)
  const first = chain.steps[0]
  const last = chain.steps[chain.steps.length - 1]
  if (!rs || !first || !last) return []
  try {
    const program = programOf(project, rs)
    const input = splitSourceForm(project, first.form).join('') || first.form.trim()
    const r = runRules(program, input, {
      startAt: program.markers[0] === first.marker ? undefined : first.marker,
      stopAt: last.marker,
      trace: true
    })
    return r.trace.map((t) => revertReplacements(t.after, program.replacements))
  } catch {
    return []
  }
}

/** 词源推得到这个词、而且确实变了样的（推出来的跟词库的写法对得上） */
function changeOf(x: QonPracticeInput, w: Word): Change | null {
  if (!w.l.etymology?.sources.length) return null
  const chain = historyChain(x.project, w.l)
  if (!chain?.matches || chain.steps.length < 2) return null
  const first = chain.steps[0]
  const last = chain.steps[chain.steps.length - 1]
  if (bare(first.form) === bare(last.form)) return null
  return { w, chain }
}

/** 这门语言能出哪几种题 */
export function qonPracticeKinds(x: QonPracticeInput): PracticeKind[] {
  const words = wordsOf({ ...x, level: null })
  const kinds: PracticeKind[] = []
  if (words.filter((w) => w.gloss).length >= 4) kinds.push('word-meaning', 'meaning-word')
  if (words.filter((w) => w.ipa).length >= 4) kinds.push('listen-word')
  if (words.some((w) => new Set(formsOf(w.l).map(([, s]) => s)).size >= 4)) kinds.push('conjugate')
  const sentences = x.project.sentences.filter(
    (s) => s.languageId === x.lang.id && !x.hidden.has(s.id) && x.pick(s.translation)
  )
  if (sentences.length >= 4) kinds.push('sentence')
  // 音变：至少有两个推得出来、变了样的词（干扰项要从别的词凑）
  let changed = 0
  for (const w of words) if (changeOf(x, w) && ++changed >= 2) break
  if (changed >= 2) kinds.push('sound-change')
  return kinds
}

const q = (
  kind: PracticeKind,
  i: number,
  body: Omit<ExamQuestion, 'id' | 'kind' | 'section'>
): ExamQuestion => ({ id: `${kind}-${i}`, kind, section: PRACTICE_SECTION[kind], ...body })

function arrange(
  right: Choice,
  wrong: Choice[],
  rand: () => number
): { choices: Choice[]; answer: number } {
  const choices = shuffled([right, ...wrong], rand)
  return { choices, answer: choices.indexOf(right) }
}

/** 从 pool 里挑 n 个跟 right 不一样、彼此也不一样的值 */
function distinct<T>(pool: T[], key: (x: T) => string, right: string, n: number): T[] {
  const out: T[] = []
  const seen = new Set([right])
  for (const x of pool) {
    const k = key(x)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(x)
    if (out.length >= n) break
  }
  return out
}

const line = (w: Word): Text => `${w.l.lemma}${w.ipa ? ` /${w.ipa}/` : ''}：${w.gloss}`
/** 词条的朗读（有录音先放录音）与生词本卡片的键 */
const sayWord = (w: Word): Sound => ({ key: `lexeme-${w.l.id}`, ...(w.ipa && { ipa: w.ipa }) })
const card = (w: Word): string => `lexeme-${w.l.id}`

/** 一组练习：某一种题出 n 道 */
export function qonPractice(
  x: QonPracticeInput,
  kind: PracticeKind,
  n: number,
  seed: number
): ExamQuestion[] {
  const rand = rng(seed)
  const all = wordsOf({ ...x, level: null })
  const words = wordsOf(x)
  const data = (text: string): Choice => ({ text, lang: x.bcp47 })
  const out: ExamQuestion[] = []

  if (kind === 'word-meaning' || kind === 'meaning-word') {
    for (const w of shuffled(
      words.filter((y) => y.gloss),
      rand
    )) {
      if (out.length >= n) break
      const wrong = distinct(shuffled(all, rand), (y) => y.gloss, w.gloss, 3).filter(
        (y) => y.l.lemma !== w.l.lemma
      )
      if (wrong.length < 3) continue
      const explain = { lines: [line(w)], say: sayWord(w), card: card(w) }
      out.push(
        kind === 'word-meaning'
          ? q(kind, out.length, {
              ask: { zh: '选出这个词的意思', en: 'Choose the meaning of this word' },
              prompt: { text: w.l.lemma, lang: x.bcp47, ...(w.ipa && { sub: `/${w.ipa}/` }) },
              ...arrange(
                { text: w.gloss },
                wrong.map((y) => ({ text: y.gloss })),
                rand
              ),
              explain
            })
          : q(kind, out.length, {
              ask: { zh: '选出这个意思对应的词', en: 'Choose the word with this meaning' },
              prompt: { text: w.gloss },
              ...arrange(
                data(w.l.lemma),
                wrong.map((y) => data(y.l.lemma)),
                rand
              ),
              explain
            })
      )
    }
  } else if (kind === 'listen-word') {
    for (const w of shuffled(
      words.filter((y) => y.ipa),
      rand
    )) {
      if (out.length >= n) break
      // 读音不同、长短相近的词先上
      const near = shuffled(all, rand).sort(
        (a, b) =>
          Math.abs(a.l.lemma.length - w.l.lemma.length) -
          Math.abs(b.l.lemma.length - w.l.lemma.length)
      )
      const wrong = distinct(near, (y) => (y.ipa === w.ipa ? '' : y.l.lemma), w.l.lemma, 3)
      if (wrong.length < 3) continue
      out.push(
        q(kind, out.length, {
          ask: { zh: '请听，选出听到的词', en: 'Listen and choose the word you hear' },
          prompt: { text: w.l.lemma, lang: x.bcp47, listen: sayWord(w) },
          ...arrange(
            data(w.l.lemma),
            wrong.map((y) => data(y.l.lemma)),
            rand
          ),
          explain: { lines: [line(w)], say: sayWord(w), card: card(w) }
        })
      )
    }
  } else if (kind === 'conjugate') {
    for (const w of shuffled(words, rand)) {
      if (out.length >= n) break
      const forms = formsOf(w.l)
      if (new Set(forms.map(([, s]) => s)).size < 4) continue
      const [slot, right] = shuffled(forms, rand)[0]
      const wrong = distinct(shuffled(forms, rand), ([, s]) => s, right, 3).map(([, s]) => s)
      if (wrong.length < 3) continue
      const label = slot.split('.').join('·')
      const ipa = w.l.forms[slot]?.ipa?.trim() || spellingIpa(x.lang, right)
      out.push(
        q(kind, out.length, {
          ask: { zh: `选出它的「${label}」`, en: `Choose its ${label}` },
          prompt: { text: w.l.lemma, lang: x.bcp47, ...(w.gloss && { sub: w.gloss }) },
          ...arrange(data(right), wrong.map(data), rand),
          explain: {
            lines: [`${w.l.lemma} → ${right}${ipa ? ` /${ipa}/` : ''}（${label}）`],
            ...(ipa && { say: { ipa } }),
            card: card(w)
          }
        })
      )
    }
  } else if (kind === 'sound-change') {
    // 推得出来的词一个个看（链要现算，词多的语言全推一遍要好几秒：凑够题目和后备干扰项就停）；
    // 别的词推出来的形式当后备干扰项
    const mine = new Set(words.map((w) => w.l.id))
    const changes: Change[] = []
    let asked = 0
    for (const w of shuffled(all, rand)) {
      if (asked >= n && changes.length >= n + 8) break
      const c = changeOf(x, w)
      if (!c) continue
      changes.push(c)
      if (mine.has(w.l.id)) asked++
    }
    for (const c of changes) {
      if (out.length >= n) break
      if (!mine.has(c.w.l.id)) continue
      const steps = c.chain.steps
      const first = steps[0]
      const last = steps[steps.length - 1]
      const right = last.form
      // 推导途中只变了一部分的形式（越接近最后的越先用）、链上的中间阶段、没变的原形，再是别的词
      const near = [
        ...partialForms(x.project, c.chain).reverse(),
        ...steps.slice(1, -1).map((s) => s.form),
        first.form.replace(/^\*+/, '')
      ]
      const others = shuffled(
        changes.filter((o) => o !== c),
        rand
      )
        .sort(
          (a, b) =>
            Math.abs(a.chain.steps[a.chain.steps.length - 1].form.length - right.length) -
            Math.abs(b.chain.steps[b.chain.steps.length - 1].form.length - right.length)
        )
        .map((o) => o.chain.steps[o.chain.steps.length - 1].form)
      const wrong = distinct([...near, ...others], bare, bare(right), 3)
      if (wrong.length < 3) continue
      const path = steps.map((s) => `${s.label} ${s.form}`).join(' → ')
      out.push(
        q(kind, out.length, {
          ask: {
            zh: `按音变规律，选出它在${x.lang.name}里的形式`,
            en: `Following the sound changes, choose its form in ${x.lang.name}`
          },
          prompt: {
            text: `*${first.form.replace(/^\*+/, '')}`,
            lang: x.bcp47,
            sub: [first.title, c.w.gloss].filter(Boolean).join(' · ')
          },
          ...arrange(data(right), wrong.map(data), rand),
          explain: {
            lines: [
              path,
              {
                zh: `音变规则：${c.chain.ruleSetName}`,
                en: `Sound changes: ${c.chain.ruleSetName}`
              },
              line(c.w)
            ],
            say: sayWord(c.w),
            card: card(c.w)
          }
        })
      )
    }
  } else if (kind === 'sentence') {
    const sentences = x.project.sentences
      .filter((s) => s.languageId === x.lang.id && !x.hidden.has(s.id))
      .map((s) => ({ s, tr: x.pick(s.translation) }))
      .filter((y) => y.tr)
    for (const y of shuffled(sentences, rand)) {
      if (out.length >= n) break
      const wrong = distinct(shuffled(sentences, rand), (z) => z.tr, y.tr, 3)
      if (wrong.length < 3) continue
      const ipa = spellingIpa(x.lang, y.s.text)
      out.push(
        q(kind, out.length, {
          ask: { zh: '选出这句话的意思', en: 'Choose the meaning of this sentence' },
          prompt: { text: y.s.text, lang: x.bcp47 },
          ...arrange(
            { text: y.tr },
            wrong.map((z) => ({ text: z.tr })),
            rand
          ),
          explain: {
            lines: [y.s.text, y.tr],
            say: { key: `sentence-${y.s.id}`, ...(ipa && { ipa }) }
          }
        })
      )
    }
  }
  return out
}
