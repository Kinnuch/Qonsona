<script lang="ts">
  // 回看一道题：题面（听力题显示原文）、选了哪一项与正确答案、解析
  import { Check, X, Minus } from '@lucide/svelte'
  import type { ExamQuestion } from '$shared/exam'
  import { t } from '$lib/i18n/index.svelte'
  import ExamPrompt from './ExamPrompt.svelte'
  import Choices from './Choices.svelte'
  import Explain from './Explain.svelte'

  let { q, given, n }: { q: ExamQuestion; given: number | null; n: number } = $props()
  const verdict = $derived(given === null ? 'blank' : given === q.answer ? 'right' : 'wrong')
</script>

<div class="card item" data-review={verdict} data-review-kind={q.kind}>
  <div class="head">
    <span class="num">{n}</span>
    <span class="verdict {verdict}">
      {#if verdict === 'right'}<Check size={14} />{t(
          'practice.review.right'
        )}{:else if verdict === 'wrong'}<X size={14} />{t('practice.review.wrong')}{:else}<Minus
          size={14}
        />{t('practice.review.blank')}{/if}
    </span>
  </div>
  <ExamPrompt {q} reveal={true} />
  <Choices {q} selected={given} reveal={true} disabled={true} />
  <Explain {q} />
</div>

<style>
  .item {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .num {
    font-weight: 600;
    color: var(--text-2);
  }
  .verdict {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
  }
  .verdict.right {
    color: #23804f;
  }
  .verdict.wrong {
    color: var(--danger);
  }
  .verdict.blank {
    color: var(--text-3);
  }
</style>
