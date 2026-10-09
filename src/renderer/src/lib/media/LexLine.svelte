<script lang="ts" module>
  import type { LexAnalysis } from '$shared/lang/types'
  import { platform } from '$lib/platform'

  /** 同一句只分析一次（来回复读、字幕列表里点来点去）；按语言分开存 */
  const cache = new Map<string, Promise<LexAnalysis | null>>()
  function analyzeLine(code: string, text: string): Promise<LexAnalysis | null> {
    const key = `${code}\n${text}`
    let p = cache.get(key)
    if (!p) {
      p = platform.lang.analyze(code, text).catch(() => null)
      cache.set(key, p)
      // 一集字幕上千句，只留最近的一些
      if (cache.size > 400) cache.delete(cache.keys().next().value!)
    }
    return p
  }
</script>

<script lang="ts">
  // 框架里的语言（英、法、韩……）的一句字幕：每个词都能点（点了查词）；这门语言注音的（罗马化、IPA）
  // 在词上方注出来。分析好之前先原样显示
  import { LANGS } from '$shared/lang/registry'
  import type { LangCode, LexToken } from '$shared/lang/types'

  let {
    code,
    text,
    onword
  }: { code: string; text: string; onword?: (w: LexToken, el: HTMLElement) => void } = $props()

  const spec = $derived(LANGS[code as LangCode].spec)
  let analysis = $state<LexAnalysis | null>(null)
  $effect(() => {
    const tx = text
    const c = code
    analysis = null
    void analyzeLine(c, tx).then((a) => {
      if (text === tx && code === c) analysis = a
    })
  })

  /** 词与词之间原文里的东西（换行、空格）也留着 */
  const parts = $derived.by(() => {
    const out: ({ gap: string } | { w: LexToken })[] = []
    let pos = 0
    for (const w of analysis?.sentences.flatMap((s) => s.tokens) ?? []) {
      if (w.start < pos) continue
      if (w.start > pos) out.push({ gap: text.slice(pos, w.start) })
      out.push({ w })
      pos = w.end
    }
    if (pos < text.length) out.push({ gap: text.slice(pos) })
    return out
  })
</script>

<span class="lex-line" lang={spec.bcp47} dir="auto" data-line
  >{#if !analysis}{text}{:else}{#each parts as part, i (i)}{#if 'gap' in part}{part.gap}{:else if part.w.kind !== 'word'}<span
          class="punct">{part.w.text}</span
        >{:else}{@const w = part.w}<span
          class="w"
          class:known={!!w.entry}
          role="button"
          tabindex="-1"
          data-word={w.lemma ?? w.text}
          onclick={(e) => onword?.(w, e.currentTarget)}
          onkeydown={(e) => e.key === 'Enter' && onword?.(w, e.currentTarget)}
          >{#if w.ruby && spec.features.ruby}<ruby>{w.text}<rt>{w.ruby}</rt></ruby
            >{:else}{w.text}{/if}</span
        >{/if}{/each}{/if}</span
>

<style>
  .lex-line {
    white-space: pre-wrap;
    unicode-bidi: plaintext;
  }
  .w {
    cursor: pointer;
    border-radius: 3px;
  }
  .w:hover {
    background: var(--accent-soft);
  }
  rt {
    font-size: 0.45em;
    color: var(--text-2);
  }
</style>
