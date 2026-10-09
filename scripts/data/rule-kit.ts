/**
 * 挑语法课例句时的额外条件（规则）用到的类型与小工具。
 * 规则挡掉同形不同义的用法：阅读器的「本文语法」宁多勿漏，课里的例句却不能错。
 * N5、N4 的规则在 examples-ja.ts，N3、N2、N1 的各在 rules-n3.ts、rules-n2.ts、rules-n1.ts；
 * 写规则时用 npm run grammar:probe 看一个语法点在 Tatoeba 例句里认出了哪些、规则放过了哪些。
 */
import type { JaToken } from '../../src/shared/ja/reader'

/** 例句的一个词素（扫描结果里只存这几项） */
export type Tok = Pick<JaToken, 's' | 'b' | 'pos' | 'p1' | 'p2' | 'ct' | 'cf' | 'start' | 'end'>

/** 规则看得到的一句：例句号、原文、词素 */
export interface RuleRow {
  id: number
  ja: string
  tokens: Tok[]
}

/**
 * 一个语法点的额外条件：before 是语法点前面那个词素，span 是语法点本身，after 是后面的全部；
 * 返回 false 的不当例句
 */
export type Rule = (before: Tok | undefined, span: Tok[], after: Tok[], row: RuleRow) => boolean

const PREDICATE = new Set(['動詞', '形容詞', '助動詞'])

/** 动词、形容词、助动词（谓语） */
export const isVerbish = (t: Tok | undefined): boolean => !!t && PREDICATE.has(t.pos)

/** 语法点前面的原文 */
export const textBefore = (row: RuleRow, span: Tok[]): string => row.ja.slice(0, span[0].start)

/** 语法点后面的原文 */
export const textAfter = (row: RuleRow, span: Tok[]): string =>
  row.ja.slice(span[span.length - 1].end)
