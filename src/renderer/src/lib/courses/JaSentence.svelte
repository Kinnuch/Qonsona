<script lang="ts" module>
  import type { JaAnalysis } from '$shared/ja/reader'
  import { platform } from '$lib/platform'

  /** 同一句只分析一次（语法课的例句来回看） */
  const cache = new Map<string, Promise<JaAnalysis | null>>()
  function analyze(text: string): Promise<JaAnalysis | null> {
    let p = cache.get(text)
    if (!p) {
      p = platform.ja.analyze(text).catch(() => null)
      cache.set(text, p)
    }
    return p
  }
</script>

<script lang="ts">
  // 日语例句：汉字上注振假名；start–end 那一段在讲解里高亮，在填空题里挖成空。
  // markRuby 为 false 时高亮的那一段不注音（读法题答完之前）；ruby 为 false 时整句都不注音
  import { furigana } from '$shared/ja/reader'

  let {
    text,
    start = 0,
    end = 0,
    mode = 'mark',
    ruby = true,
    markRuby = true
  }: {
    text: string
    start?: number
    end?: number
    mode?: 'mark' | 'blank'
    ruby?: boolean
    markRuby?: boolean
  } = $props()

  let analysis = $state<JaAnalysis | null>(null)
  $effect(() => {
    const tx = text
    analysis = null
    void analyze(tx).then((a) => {
      if (text === tx) analysis = a
    })
  })

  interface Seg {
    text: string
    ruby?: string
    mark: boolean
  }

  /** 按词切开注音，再在高亮的边界上切开（注音跨过边界的那一段不注音） */
  const segs = $derived.by(() => {
    const out: Seg[] = []
    const marked = end > start
    const push = (s: string, from: number, rt?: string): void => {
      const to = from + s.length
      const cuts = [from, to]
      if (marked && start > from && start < to) cuts.push(start)
      if (marked && end > from && end < to) cuts.push(end)
      cuts.sort((a, b) => a - b)
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i]
        const b = cuts[i + 1]
        const mark = marked && a >= start && b <= end
        out.push({
          text: s.slice(a - from, b - from),
          ...(cuts.length === 2 && rt && ruby && (markRuby || !mark) && { ruby: rt }),
          mark
        })
      }
    }
    let pos = 0
    for (const w of analysis?.sentences.flatMap((se) => se.words) ?? []) {
      if (w.start > pos) push(text.slice(pos, w.start), pos)
      if (w.word && w.reading) {
        let at = w.start
        for (const p of furigana(w.surface, w.reading)) {
          push(p.text, at, p.ruby)
          at += p.text.length
        }
      } else push(w.surface, w.start)
      pos = w.end
    }
    if (pos < text.length) push(text.slice(pos), pos)
    return out
  })

  /** 连着的高亮段并成一组（一个 mark / 一个空） */
  const groups = $derived.by(() => {
    const out: { mark: boolean; segs: Seg[] }[] = []
    for (const s of segs) {
      const last = out[out.length - 1]
      if (last && last.mark === s.mark) last.segs.push(s)
      else out.push({ mark: s.mark, segs: [s] })
    }
    return out
  })
</script>

{#snippet seg(s: Seg)}{#if s.ruby}<ruby>{s.text}<rt>{s.ruby}</rt></ruby
    >{:else}{s.text}{/if}{/snippet}

<span class="ja-sentence" lang="ja"
  >{#each groups as g, i (i)}{#if g.mark && mode === 'blank'}<span class="blank" data-blank
      ></span>{:else if g.mark}<mark data-grammar-mark
        >{#each g.segs as s, k (k)}{@render seg(s)}{/each}</mark
      >{:else}{#each g.segs as s, k (k)}{@render seg(s)}{/each}{/if}{/each}</span
>

<style>
  .ja-sentence {
    line-height: 2.1;
  }
  mark {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    color: inherit;
    border-radius: 3px;
    padding: 0 1px;
  }
  .blank {
    display: inline-block;
    min-width: 3.2em;
    border-bottom: 2px solid var(--accent);
    margin: 0 2px;
    vertical-align: baseline;
  }
  rt {
    font-size: 0.55em;
    color: var(--text-2);
  }
</style>
