<script lang="ts">
  // 一道题的题面：题干、句子（日语注振假名，标出或挖掉一段）、词、听力题的放音按钮、题面下的小字。
  // reveal：答完了（练习看解析、回看卷子）——听力题这时才显示原文，标出的那一段这时才注音
  import { Volume2 } from '@lucide/svelte'
  import type { ExamQuestion } from '$shared/exam'
  import JaSentence from '$lib/courses/JaSentence.svelte'
  import { scriptCss, txt } from '$lib/courses/view'
  import { t } from '$lib/i18n/index.svelte'
  import { isData, playPrompt } from './view'

  let { q, reveal }: { q: ExamQuestion; reveal: boolean } = $props()

  const p = $derived(q.prompt)
  const range = $derived(p.mark ?? p.blank ?? null)
  const hidden = $derived(!!p.listen && !reveal)
  const sentence = $derived(p.lang === 'ja' && (!!p.ruby || !!range))
  const long = $derived([...p.text].length > 10)
</script>

<div class="prompt" data-exam-prompt={q.kind}>
  <p class="ask muted">{txt(q.ask)}</p>
  {#if hidden}
    <button
      class="btn listen"
      data-replay
      title={t('practice.replay')}
      onclick={() => playPrompt(q)}><Volume2 size={28} /></button
    >
  {:else if sentence}
    <p class="sentence" data-prompt>
      <JaSentence
        text={p.text}
        start={range?.[0] ?? 0}
        end={range?.[1] ?? 0}
        mode={p.blank && !reveal ? 'blank' : 'mark'}
        ruby={!!p.ruby}
        markRuby={reveal}
      />
    </p>
  {:else if range}
    <!-- 别的语言的句子：标出的一段加下划线，挖掉的一段答完之前换成空格 -->
    <p class="sentence plain" lang={p.lang} dir="auto" data-prompt>
      {p.text.slice(0, range[0])}{#if p.blank && !reveal}<span class="blank"
          >{'　'.repeat(Math.max(2, Math.min(8, range[1] - range[0])))}</span
        >{:else}<mark class:filled={!!p.blank}>{p.text.slice(range[0], range[1])}</mark
        >{/if}{p.text.slice(range[1])}
    </p>
  {:else}
    <p
      class="word"
      class:long
      class:data={isData(p.lang)}
      lang={p.lang}
      style={scriptCss(p.scriptId)}
      data-prompt
    >
      {p.text}
    </p>
  {/if}
  {#if p.sub && !hidden}<p class="sub muted">{txt(p.sub)}</p>{/if}
  {#if p.listen && reveal}
    <button class="btn ghost again" title={t('practice.replay')} onclick={() => playPrompt(q)}
      ><Volume2 size={16} /></button
    >
  {/if}
</div>

<style>
  .prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }
  .word {
    font-size: 40px;
    line-height: 1.25;
  }
  .word.long {
    font-size: 24px;
  }
  .sentence {
    font-size: 22px;
  }
  /* 考题里标出的一段画下划线（题干说的是「下划线」） */
  .sentence :global(mark) {
    background: none;
    text-decoration: underline 2px var(--accent);
    text-underline-offset: 6px;
  }
  .sentence.plain {
    line-height: 1.7;
  }
  .blank {
    display: inline-block;
    border-bottom: 2px solid var(--text-2);
    margin: 0 4px;
  }
  .sentence :global(mark.filled) {
    text-decoration-color: var(--ok, #2f9e63);
  }
  .data {
    font-family: var(--font-data);
  }
  .listen {
    padding: 18px 22px;
    border-radius: 999px;
  }
  .again {
    padding: 4px 8px;
  }
</style>
