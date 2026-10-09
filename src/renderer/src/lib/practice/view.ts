/**
 * 练习界面的小工具。
 */
import { audio } from '$lib/state/audio.svelte'
import { sayable } from '$lib/courses/view'
import type { ExamQuestion } from '$shared/exam'

/** 人造语言的文字（art-x-…）用数据字体显示 */
export const isData = (lang: string | undefined): boolean => !!lang?.startsWith('art')

/** 倒计时：分:秒 */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** 用了多久：几分几秒 */
export function duration(seconds: number): { m: number; s: number } {
  return { m: Math.floor(seconds / 60), s: seconds % 60 }
}

/** 听力题放音 */
export function playPrompt(q: ExamQuestion | null | undefined): void {
  const s = sayable(q?.prompt.listen)
  if (s) void audio.say(s)
}

/** 选项里有长的（句子的译文）就排成一列 */
export const longChoices = (
  q: ExamQuestion,
  txt: (x: ExamQuestion['choices'][number]['text']) => string
): boolean => q.choices.some((c) => [...txt(c.text)].length > 14)
