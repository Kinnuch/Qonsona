/**
 * 语法点的写法：类型、写语法点用的 P 和几个常用的词素条件。
 * N5、N4 的语法点在 grammar.ts，N3、N2、N1 各在 grammar-n3.ts、grammar-n2.ts、grammar-n1.ts，
 * 后三个文件里连语法课用的接续、例句翻译、分课也一起写着（N5、N4 的在 grammar-course.ts）。
 */
import type { Text } from '../course'

/** 一个词素的条件：给了的每一项都要对上；数组表示其中之一 */
export interface TokenSpec {
  s?: string | string[]
  b?: string | string[]
  pos?: string | string[]
  p1?: string | string[]
  p2?: string | string[]
  ct?: string | string[]
  cf?: string | string[]
  /**
   * 只看不算：语法点前后的这个词素要对得上，但不算进语法点那一段（高亮、填空都不含它）。
   * 只能放在一串的开头或结尾；那个位置没有词素（句首、句末）时算对不上
   */
  ctx?: boolean
  /** 跟 ctx 一起用，反过来：那个位置的词素不能是这样的（没有词素时算满足） */
  not?: boolean
}

/**
 * 整句的条件：词素串对上之后再看整句（隔着几个词的上下文），返回 false 的不算。
 * tokens 是这一句的词素，[from, to) 是语法点那一段
 */
export type GrammarCheck = (
  tokens: readonly Pick<TokenSpecTarget, 's' | 'b' | 'pos' | 'p1' | 'p2' | 'ct' | 'cf'>[],
  from: number,
  to: number
) => boolean

/** 条件对照的词素的几项（跟 JaToken 同名） */
interface TokenSpecTarget {
  s: string
  b: string
  pos: string
  p1: string
  p2: string
  ct: string
  cf: string
}

export interface GrammarPoint {
  id: string
  /** JLPT 等级：5 = N5 … 1 = N1 */
  level: 5 | 4 | 3 | 2 | 1
  /** 显示的名字（〜ている） */
  name: string
  zh: string
  en: string
  example: string
  /** 几种写法，对上其中一种就算 */
  alts: TokenSpec[][]
  /** 几乎每句都有的（ます、です、た……）：本文语法里默认收起 */
  basic?: boolean
  /** 整句的条件（阅读器、挑例句都用） */
  check?: GrammarCheck
}

/** て形的て、で */
export const TE: TokenSpec = { pos: '助詞', p1: '接続助詞', b: ['て', 'で'] }
/** いい、よい */
export const II: TokenSpec = { b: ['いい', 'よい', '良い'] }

/** 给语法点加上整句的条件 */
export const checked = (g: GrammarPoint, check: GrammarCheck): GrammarPoint => ({ ...g, check })

export const P = (
  id: string,
  level: GrammarPoint['level'],
  name: string,
  zh: string,
  en: string,
  example: string,
  alts: TokenSpec[][],
  basic = false
): GrammarPoint => ({ id, level, name, zh, en, example, alts, ...(basic && { basic }) })

/** 自己写的一句例句与它的中英翻译 */
export interface NoteExample {
  ja: string
  zh: string
  en: string
}

/** 语法课里一个语法点的接续、自带例句的中英翻译、意思相近的一组，另写的例句 */
export interface GrammarNote {
  form: string
  zh: string
  en: string
  /** 意思相近的一组：出题时同组的不互相当干扰项 */
  group?: string
  /**
   * 另外自己写的例句（N3 起每个语法点至少一句：Tatoeba 里难一些的语法点例句很少，
   * 光靠自带的那一句，练习的选意思、填空总是同一句）
   */
  more?: NoteExample[]
}

export interface LessonSpec {
  id: string
  title: Text
  items: string[]
}

/** 一级的语法：语法点、语法课的说明（按语法点）、分课 */
export interface LevelGrammar {
  points: GrammarPoint[]
  notes: Record<string, GrammarNote>
  lessons: LessonSpec[]
}

/** 几份并成一份（同一级分开写的） */
export const joinLevel = (...parts: LevelGrammar[]): LevelGrammar => ({
  points: parts.flatMap((p) => p.points),
  notes: Object.assign({}, ...parts.map((p) => p.notes)),
  lessons: parts.flatMap((p) => p.lessons)
})
