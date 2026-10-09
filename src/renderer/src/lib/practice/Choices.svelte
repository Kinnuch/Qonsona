<script lang="ts">
  // 选项：练习时选了马上标出对错（reveal）；模拟卷上只标出选了哪一项，交卷后回看时再标对错
  import type { ExamQuestion } from '$shared/exam'
  import { scriptCss, txt } from '$lib/courses/view'
  import { isData, longChoices } from './view'

  let {
    q,
    selected,
    reveal,
    disabled = false,
    onchoose
  }: {
    q: ExamQuestion
    selected: number | null
    reveal: boolean
    disabled?: boolean
    onchoose?: (i: number) => void
  } = $props()
</script>

<div class="choices" class:column={longChoices(q, txt)}>
  {#each q.choices as c, i (i)}
    {@const right = i === q.answer}
    <button
      class="btn choice"
      class:picked={!reveal && selected === i}
      class:right={reveal && right}
      class:wrong={reveal && selected === i && !right}
      class:dim={reveal && !right && selected !== i}
      data-choice={i}
      data-correct={right ? '' : undefined}
      data-picked={selected === i ? '' : undefined}
      {disabled}
      onclick={() => onchoose?.(i)}
    >
      <span class="n faint">{i + 1}</span>
      <span class="label" class:data={isData(c.lang)} lang={c.lang} style={scriptCss(c.scriptId)}
        >{txt(c.text)}</span
      >
    </button>
  {/each}
</div>

<style>
  .choices {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    width: 100%;
  }
  .choices.column {
    grid-template-columns: minmax(0, 1fr);
  }
  .choice {
    justify-content: flex-start;
    gap: 10px;
    padding: 11px 14px;
    white-space: normal;
    text-align: start;
  }
  .choice:disabled {
    opacity: 1;
    cursor: default;
  }
  .label {
    font-size: 17px;
  }
  .data {
    font-family: var(--font-data);
  }
  .n {
    min-width: 12px;
  }
  .choice.picked {
    border-color: var(--accent);
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .choice.right {
    border-color: #2f9e63;
    background: color-mix(in srgb, #2f9e63 14%, var(--bg-elev));
  }
  .choice.wrong {
    border-color: var(--danger);
    background: var(--danger-soft);
  }
  .choice.dim {
    opacity: 0.55;
  }
</style>
