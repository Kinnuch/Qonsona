export interface Encouragement {
  text: string
  zh: string
  lang: string | null
  source?: string
}

function phrases(lang: string, entries: [string, string][], source?: string): Encouragement[] {
  return entries.map(([text, zh]) => ({ text, zh, lang, ...(source ? { source } : {}) }))
}
/** Modern phrases vary by language. Elvish uses cited short expressions, never new morphology. */
export const ENCOURAGEMENT_POOLS: Record<string, Encouragement[]> = {
  ja: phrases('ja-JP', [
    ['よくできました！', '做得很好！'],
    ['その調子です！', '继续保持！'],
    ['正解です！', '回答正确！'],
    ['素晴らしいです！', '太棒了！'],
    ['一歩前進ですね！', '又向前迈了一步！'],
    ['落ち着いて、続けましょう！', '稳稳来，继续学习吧！']
  ]),
  en: phrases('en-US', [
    ['Well done! Keep going!', '做得好，继续加油！'],
    ['You got it right!', '你答对了！'],
    ['Nice work!', '做得不错！'],
    ['One step at a time. You are making progress!', '一步一步来，你正在进步！'],
    ['That was a good answer!', '这个回答很棒！'],
    ['Keep it up!', '继续保持！']
  ]),
  fr: phrases('fr-FR', [
    ['Bravo ! Continue comme ça !', '真棒，继续保持！'],
    ['Bonne réponse !', '回答正确！'],
    ['Très bien !', '非常好！'],
    ['Tu progresses !', '你正在进步！'],
    ['Excellent travail !', '做得出色！'],
    ['Pas à pas, tu avances !', '一步一步，你正在前进！']
  ]),
  ko: phrases('ko-KR', [
    ['잘했어요! 계속 힘내세요!', '做得好，继续加油！'],
    ['정답이에요!', '回答正确！'],
    ['아주 좋아요!', '非常好！'],
    ['조금씩 나아지고 있어요!', '正在一点点进步！'],
    ['차근차근 해봐요!', '一步一步来吧！'],
    ['훌륭해요!', '太棒了！']
  ]),
  es: phrases('es-ES', [
    ['¡Muy bien! ¡Sigue así!', '做得很好，继续保持！'],
    ['¡Respuesta correcta!', '回答正确！'],
    ['¡Buen trabajo!', '做得不错！'],
    ['¡Vas progresando!', '你正在进步！'],
    ['¡Excelente!', '太棒了！'],
    ['¡Paso a paso!', '一步一步来！']
  ]),
  ar: phrases('ar-SA', [
    ['أحسنت! واصل التقدم!', '做得好，继续进步！'],
    ['إجابة صحيحة!', '回答正确！'],
    ['ممتاز!', '太棒了！'],
    ['عمل رائع!', '做得出色！'],
    ['خطوة بخطوة!', '一步一步来！'],
    ['استمر!', '继续加油！']
  ]),
  ru: phrases('ru-RU', [
    ['Отлично! Продолжай в том же духе!', '太棒了，继续保持！'],
    ['Правильный ответ!', '回答正确！'],
    ['Хорошая работа!', '做得不错！'],
    ['Ты делаешь успехи!', '你正在进步！'],
    ['Шаг за шагом!', '一步一步来！'],
    ['Так держать!', '继续保持！']
  ]),
  gd: phrases(
    'gd-GB',
    [
      ['Glè mhath!', '非常好！'],
      ['Sgoinneil!', '太棒了！'],
      ['Math dha-rìribh!', '出色极了！']
    ],
    'https://www.learngaelic.scot/litir/litir.jsp?l=597'
  ),
  qya: [
    {
      text: 'Mára ná!',
      zh: '这很好！',
      lang: null,
      source: 'https://eldamo.org/content/words/word-2202508353.html'
    },
    {
      text: 'Maira!',
      zh: '出色！',
      lang: null,
      source: 'https://eldamo.org/content/words/word-1243468823.html'
    }
  ],
  sjn: [
    {
      text: 'Ma!',
      zh: '真棒，答对了！',
      lang: null,
      source: 'https://eldamo.org/content/words/word-2354944799.html'
    },
    {
      text: 'Mae!',
      zh: '出色！',
      lang: null,
      source: 'https://eldamo.org/content/words/word-3420722951.html'
    },
    {
      text: 'Maer!',
      zh: '太棒了！',
      lang: null,
      source: 'https://eldamo.org/content/words/word-3652402261.html'
    }
  ]
}
export const ENCOURAGEMENTS: Record<string, Encouragement> = Object.fromEntries(
  Object.entries(ENCOURAGEMENT_POOLS).map(([language, pool]) => [language, pool[0]])
)
const fallback: Encouragement[] = [
  '回答正确，继续加油！',
  '做得很好，又积累了一点！',
  '稳稳来，你正在进步！',
  '这道题答对了！',
  '又向前迈了一步！',
  '继续保持，按自己的节奏来！'
].map((zh) => ({ text: '', zh, lang: null }))
export function encouragement(language: string): Encouragement {
  return ENCOURAGEMENTS[language] ?? fallback[0]
}

/** One shuffle bag per learner/language: every phrase appears before another cycle starts. */
export class EncouragementCycle {
  #cycles = new Map<string, { remaining: number[]; last: string }>()
  constructor(private readonly random: () => number = Math.random) {}
  next(language: string): Encouragement {
    const pool = ENCOURAGEMENT_POOLS[language] ?? fallback
    let cycle = this.#cycles.get(language)
    if (!cycle) {
      cycle = { remaining: [], last: '' }
      this.#cycles.set(language, cycle)
    }
    if (!cycle.remaining.length) {
      cycle.remaining = pool.map((_, i) => i)
      for (let i = cycle.remaining.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1))
        ;[cycle.remaining[i], cycle.remaining[j]] = [cycle.remaining[j], cycle.remaining[i]]
      }
      const key = (i: number): string => pool[i].text || pool[i].zh
      if (key(cycle.remaining[0]) === cycle.last && pool.length > 1) {
        const index = cycle.remaining.findIndex((i) => key(i) !== cycle!.last)
        ;[cycle.remaining[0], cycle.remaining[index]] = [cycle.remaining[index], cycle.remaining[0]]
      }
    }
    const phrase = pool[cycle.remaining.shift()!]
    cycle.last = phrase.text || phrase.zh
    return phrase
  }
  reset(): void {
    this.#cycles.clear()
  }
}

export interface DockPosition {
  x: number
  y: number
}
export function clampDock(
  position: DockPosition,
  viewport: { width: number; height: number },
  size: { width: number; height: number } = { width: 124, height: 124 }
): DockPosition {
  return {
    x: Math.max(8, Math.min(position.x, Math.max(8, viewport.width - size.width - 8))),
    y: Math.max(8, Math.min(position.y, Math.max(8, viewport.height - size.height - 8)))
  }
}

/** A gap is wall time without accepted foreground learning, never a timer on an open page. */
export class BreakReminder {
  seconds = 0
  lastEnd: number | null = null
  reminded = false
  record(start: number, end: number): boolean {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false
    if (this.lastEnd !== null && start - this.lastEnd >= 600_000) {
      this.seconds = 0
      this.reminded = false
    }
    const from = Math.max(start, this.lastEnd ?? start)
    this.seconds += Math.max(0, end - from) / 1000
    this.lastEnd = Math.max(this.lastEnd ?? end, end)
    if (this.seconds < 45 * 60 || this.reminded) return false
    this.reminded = true
    return true
  }
  reset(): void {
    this.seconds = 0
    this.lastEnd = null
    this.reminded = false
  }
}
