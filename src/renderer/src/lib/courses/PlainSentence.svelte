<script lang="ts">
  // 日语以外的例句：start–end 那一段在讲解里高亮，在填空题里挖成空，答完填回去（filled）。
  // 不注音；从右往左的文字（阿拉伯语）按 dir=auto 排
  let {
    text,
    start = 0,
    end = 0,
    mode = 'mark',
    lang
  }: {
    text: string
    start?: number
    end?: number
    mode?: 'mark' | 'blank' | 'filled'
    lang?: string
  } = $props()

  const marked = $derived(end > start)
</script>

<span class="plain-sentence" {lang} dir="auto"
  >{marked ? text.slice(0, start) : text}{#if marked}{#if mode === 'blank'}<span
        class="blank"
        data-blank
      ></span>{:else}<mark class:filled={mode === 'filled'} data-grammar-mark
        >{text.slice(start, end)}</mark
      >{/if}{text.slice(end)}{/if}</span
>

<style>
  .plain-sentence {
    line-height: 1.8;
    unicode-bidi: plaintext;
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
</style>
