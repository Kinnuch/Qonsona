<script lang="ts">
  import type { ReviewQuestion } from '$shared/review-question'
  import { reviewAnswerCorrect } from '$shared/review-question'
  import { i18n } from '$lib/i18n/index.svelte'
  import type { Sayable } from '$lib/state/audio.svelte'
  import { audio } from '$lib/state/audio.svelte'
  let {
    question,
    say,
    answered,
    onanswer
  }: {
    question: ReviewQuestion
    say: Sayable | null
    answered: boolean
    onanswer: (correct: boolean) => void
  } = $props()
  let input = $state('')
  let selected = $state('')
  let submitted = $state(false)
  const zh = $derived(i18n.locale === 'zh')
  const labels = {
    'word-meaning': ['选择这个词的意思', 'Choose the meaning'],
    'meaning-word': ['按释义选择当前复习词', 'Choose the word matching the meaning'],
    spelling: ['输入当前复习词的拼写', 'Type the spelling of the review word'],
    reading: ['选择这个词的读音', 'Choose the reading'],
    listening: ['听音，选择当前复习词', 'Listen and choose the review word'],
    context: [
      '用当前复习词的正确词形补全真实例句',
      'Complete the real example with the review word'
    ]
  }
  function submit(value: string): void {
    if (answered || submitted) return
    selected = value
    submitted = true
    onanswer(reviewAnswerCorrect(question, value))
  }
</script>

<section class="question" data-review-question={question.kind}>
  <h3>{labels[question.kind][zh ? 0 : 1]}</h3>
  {#if question.kind === 'listening'}
    <button
      class="btn"
      data-review-listen
      disabled={!say || !audio.canSay(say)}
      onclick={() => say && audio.say(say)}>{zh ? '播放读音' : 'Play audio'}</button
    >
  {:else}<p class="prompt" dir="auto">{question.prompt}</p>{/if}
  {#if question.example?.translation}<p class="muted">{question.example.translation}</p>{/if}
  {#if question.kind === 'spelling'}
    <form
      onsubmit={(e) => {
        e.preventDefault()
        submit(input)
      }}
    >
      <input
        class="input"
        aria-label={zh ? '词语拼写' : 'Word spelling'}
        data-review-input
        autocomplete="off"
        autocapitalize="off"
        spellcheck={false}
        bind:value={input}
        disabled={answered || submitted}
      /><button
        class="btn primary"
        data-review-submit
        disabled={!input.trim() || answered || submitted}>{zh ? '检查答案' : 'Check answer'}</button
      >
    </form>
  {:else}
    <div class="choices">
      {#each question.choices as choice, index (choice)}<button
          class="btn choice"
          data-review-choice={index}
          class:right={answered && choice === question.answer}
          class:wrong={answered && choice === selected && choice !== question.answer}
          disabled={answered || submitted}
          onclick={() => submit(choice)}
          dir="auto">{choice}</button
        >{/each}
    </div>
  {/if}
  {#if answered}<p class="result" data-review-result>
      {reviewAnswerCorrect(question, selected)
        ? zh
          ? '回答正确'
          : 'Correct'
        : (zh ? '正确答案：' : 'Answer: ') + question.answer}
    </p>{/if}
</section>

<style>
  .question {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    text-align: center;
  }
  .prompt {
    font-size: 26px;
    line-height: 1.6;
  }
  .choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .choice {
    white-space: normal;
    justify-content: center;
    min-height: 50px;
    padding: 10px;
  }
  .right {
    outline: 2px solid #2f9e63;
  }
  .wrong {
    outline: 2px solid var(--danger);
  }
  form {
    display: flex;
    gap: 8px;
  }
  .input {
    flex: 1;
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    color: var(--text);
    font: inherit;
  }
  .result {
    font-weight: 600;
  }
</style>
