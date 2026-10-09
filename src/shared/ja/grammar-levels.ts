/**
 * N3、N2、N1 的语法：每一级分两个文件写（grammar-n3.ts 与 grammar-n3b.ts …，一个文件太长），
 * 这里并成一级；两个文件的课是交错着排的，按课的编号排好。
 */
import { joinLevel, type LevelGrammar } from './grammar-def'
import { N3_GRAMMAR } from './grammar-n3'
import { N3B_GRAMMAR } from './grammar-n3b'
import { N2_GRAMMAR } from './grammar-n2'
import { N2B_GRAMMAR } from './grammar-n2b'
import { N1_GRAMMAR } from './grammar-n1'
import { N1B_GRAMMAR } from './grammar-n1b'

/** 课的编号（n3-12 → 12） */
const lessonNo = (id: string): number => Number(id.split('-')[1])

const level = (...parts: LevelGrammar[]): LevelGrammar => {
  const g = joinLevel(...parts)
  return { ...g, lessons: [...g.lessons].sort((a, b) => lessonNo(a.id) - lessonNo(b.id)) }
}

export const N3 = level(N3_GRAMMAR, N3B_GRAMMAR)
export const N2 = level(N2_GRAMMAR, N2B_GRAMMAR)
export const N1 = level(N1_GRAMMAR, N1B_GRAMMAR)
