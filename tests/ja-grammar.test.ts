/**
 * 语法点：每一条都得在自己的例句里认得出来（用真的 kuromoji 分词），语法课里另写的例句也一样。
 */
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { JaAnalyzer } from '../src/main/ja-analyze'
import { GRAMMAR, GRAMMAR_BY_ID, matchAt, matchGrammar } from '$shared/ja/grammar'
import { GRAMMAR_NOTES } from '$shared/ja/grammar-course'

const analyzer = new JaAnalyzer(resolve(__dirname, '../node_modules/kuromoji/dict'))

describe('语法点', () => {
  it('编号不重复，说明齐全', () => {
    expect(GRAMMAR_BY_ID.size).toBe(GRAMMAR.length)
    for (const g of GRAMMAR) {
      expect(g.zh && g.en && g.example && g.name, g.id).toBeTruthy()
      expect(g.alts.length, g.id).toBeGreaterThan(0)
    }
  })

  const examples = GRAMMAR.flatMap((g) => [
    [g.id, g.example] as const,
    ...(GRAMMAR_NOTES[g.id]?.more ?? []).map((m) => [g.id, m.ja] as const)
  ])

  it.each(examples)('%s 认得出例句「%s」', async (id, example) => {
    const tokens = await analyzer.tokens(example)
    const ids = matchGrammar(tokens).map((h) => h.id)
    expect(
      ids,
      tokens.map((t) => `${t.s}/${t.b}/${t.pos},${t.p1},${t.p2}/${t.ct}/${t.cf}`).join(' ')
    ).toContain(id)
  })

  it('长的包住短的：〜ている 里不再单列 〜て，〜ました 里不再单列 〜ます、〜た', async () => {
    const ids = matchGrammar(await analyzer.tokens('雨が降っていました。')).map((h) => h.id)
    expect(ids).toContain('teiru')
    expect(ids).toContain('mashita')
    expect(ids).not.toContain('te')
    expect(ids).not.toContain('masu')
    expect(ids).not.toContain('ta')
  })

  it('只看不算的词素（ctx）：要对得上但不算进那一段；not 的反过来，句首句末算满足', async () => {
    const t = await analyzer.tokens('若いうちに行く。')
    const at = t.findIndex((x) => x.s === 'うち')
    const core = [{ s: 'うち' }, { s: 'に' }]
    expect(matchAt([{ pos: '形容詞', ctx: true }, ...core], t, at)).toEqual([at, at + 2])
    expect(matchAt([{ pos: '動詞', ctx: true }, ...core], t, at)).toBeNull()
    expect(matchAt([{ pos: '動詞', ctx: true, not: true }, ...core], t, at)).toEqual([at, at + 2])
    expect(matchAt([...core, { pos: '動詞', ctx: true }], t, at)).toEqual([at, at + 2])
    // 句首：前面没有词素
    const u = await analyzer.tokens('うちに帰る。')
    expect(matchAt([{ pos: '形容詞', ctx: true }, ...core], u, 0)).toBeNull()
    expect(matchAt([{ pos: '形容詞', ctx: true, not: true }, ...core], u, 0)).toEqual([0, 2])
  })
})
