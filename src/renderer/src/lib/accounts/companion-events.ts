export interface Encouragement {
  text: string
  zh: string
  lang: string | null
  source?: string
}

/** Author-written modern phrases; Elvish uses attested expressions, with no invented morphology. */
export const ENCOURAGEMENTS: Record<string, Encouragement> = {
  ja: { text: 'よくできました！', zh: '做得很好！', lang: 'ja-JP' },
  en: { text: 'Well done! Keep going!', zh: '做得好，继续加油！', lang: 'en-US' },
  fr: { text: 'Bravo ! Continue comme ça !', zh: '真棒，继续保持！', lang: 'fr-FR' },
  ko: { text: '잘했어요! 계속 힘내세요!', zh: '做得好，继续加油！', lang: 'ko-KR' },
  es: { text: '¡Muy bien! ¡Sigue así!', zh: '做得很好，继续保持！', lang: 'es-ES' },
  ar: { text: 'أحسنت! واصل التقدم!', zh: '做得好，继续进步！', lang: 'ar-SA' },
  ru: { text: 'Отлично! Продолжай в том же духе!', zh: '太棒了，继续保持！', lang: 'ru-RU' },
  gd: {
    text: 'Glè mhath!',
    zh: '非常好！',
    lang: 'gd-GB',
    source: 'https://www.learngaelic.scot/sounds/e.jsp'
  },
  qya: {
    text: 'Elen síla lúmenn’ omentielvo.',
    zh: '一颗星照耀着我们相遇的时刻。答对了，继续加油！',
    lang: null,
    source: 'https://eldamo.org/content/words/word-2420229959.html'
  },
  sjn: {
    text: 'Ma!',
    zh: '真棒，答对了！',
    lang: null,
    source: 'https://eldamo.org/content/words/word-2354944799.html'
  }
}
export function encouragement(language: string): Encouragement {
  return (
    ENCOURAGEMENTS[language] ?? {
      text: '',
      zh: '回答正确，继续加油！',
      lang: null
    }
  )
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
