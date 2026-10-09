/**
 * 框架语言的中文释义补译：开放的中文来源没有的常用词，开发时由英文释义批量翻译成中文
 * （做法同日语，规范见 scripts/lang/mt-guide.md），存进 data/<代码>/zh-mt.jsonl 入库。
 * 一行一个义项：{ w: 词头, p: 词性, en: 英文释义（几条用「; 」连起来）, zh: 中文 }。
 * 写库时 LexDbWriter 按「词头 + 词性 + 英文释义」对上就补进没有中文的义项（zs 记 mt-en，界面标「译自英文」）；
 * 英文释义改了（来源更新）就对不上，那一条不补——宁可没有中文也不放过时的译文。
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LangCode, SourceRef } from '../../src/shared/lang/types'

export interface MtRecord {
  w: string
  p: string
  en: string
  zh: string
}

/** 机器翻译的来源（写库时用到了就自动登记） */
export const MT_SOURCE: SourceRef = {
  id: 'mt-en',
  name: '由英文释义翻译的中文释义',
  license: '同英文释义的来源',
  credit: 'Qonsona',
  home: 'https://github.com/Kinnuch/Qonsona',
  note: '开放的中文词典没有收的常用词，开发时由英文释义批量翻译，界面上标「译自英文」'
}

/** 对译文用的键 */
export const mtKey = (w: string, p: string, en: string[] | string): string =>
  `${w}\t${p}\t${Array.isArray(en) ? en.join('; ') : en}`

export const mtFile = (root: string, code: LangCode): string =>
  join(root, 'data', code, 'zh-mt.jsonl')

/** 读一门语言的译文（没有文件时是空的） */
export function loadMt(root: string, code: LangCode): Map<string, string> {
  const out = new Map<string, string>()
  const file = mtFile(root, code)
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const r = JSON.parse(line) as MtRecord
    if (r.w && r.p && r.en && r.zh) out.set(mtKey(r.w, r.p, r.en), r.zh)
  }
  return out
}
