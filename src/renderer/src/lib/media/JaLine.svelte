<script lang="ts" module>
  import type { JaAnalysis } from '$shared/ja/reader'
  import { platform } from '$lib/platform'

  /** 同一句只分析一次（来回复读、字幕列表里点来点去） */
  const cache = new Map<string, Promise<JaAnalysis | null>>()
  export function analyzeLine(text: string): Promise<JaAnalysis | null> {
    let p = cache.get(text)
    if (!p) {
      p = platform.ja.analyze(text).catch(() => null)
      cache.set(text, p)
      // 一集字幕上千句，只留最近的一些
      if (cache.size > 400) cache.delete(cache.keys().next().value!)
    }
    return p
  }
</script>

<script lang="ts">
  // 一句日语字幕：汉字上注振假名，每个词都能点（点了查词）。分析好之前先原样显示
  import { furigana, type JaWord } from '$shared/ja/reader'

  let {
    text,
    ruby = true,
    onword
  }: { text: string; ruby?: boolean; onword?: (w: JaWord, el: HTMLElement) => void } = $props()

  let analysis = $state<JaAnalysis | null>(null)
  $effect(() => {
    const tx = text
    analysis = null
    void analyzeLine(tx).then((a) => {
      if (text === tx) analysis = a
    })
  })

  /** 词与词之间原文里的东西（换行、空格）也留着 */
  const parts = $derived.by(() => {
    const out: ({ gap: string } | { w: JaWord })[] = []
    let pos = 0
    for (const w of analysis?.sentences.flatMap((s) => s.words) ?? []) {
      if (w.start > pos) out.push({ gap: text.slice(pos, w.start) })
      out.push({ w })
      pos = Math.max(pos, w.end)
    }
    if (pos < text.length) out.push({ gap: text.slice(pos) })
    return out
  })
</script>

<span class="ja-line" lang="ja" data-line
  >{#if !analysis}{text}{:else}{#each parts as part, i (i)}{#if 'gap' in part}{part.gap}{:else if !part.w.word}<span
          class="punct">{part.w.surface}</span
        >{:else}{@const w = part.w}<span
          class="w"
          role="button"
          tabindex="-1"
          data-word={w.base}
          onclick={(e) => onword?.(w, e.currentTarget)}
          onkeydown={(e) => e.key === 'Enter' && onword?.(w, e.currentTarget)}
          >{#if ruby}{#each furigana(w.surface, w.reading) as p, k (k)}{#if p.ruby}<ruby
                  >{p.text}<rt>{p.ruby}</rt></ruby
                >{:else}{p.text}{/if}{/each}{:else}{w.surface}{/if}</span
        >{/if}{/each}{/if}</span
>

<style>
  .ja-line {
    white-space: pre-wrap;
  }
  .w {
    cursor: pointer;
    border-radius: 3px;
  }
  .w:hover {
    background: var(--accent-soft);
  }
  rt {
    font-size: 0.5em;
    color: var(--text-2);
  }
</style>
