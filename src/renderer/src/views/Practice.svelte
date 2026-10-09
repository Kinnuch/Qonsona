<script lang="ts">
  // 练习：选题 → 一组练习 / 一张模拟卷 → 成绩与解析。走到哪一步记在 practice.view 里，离开再回来还在
  import { onMount } from 'svelte'
  import { practice } from '$lib/state/practice.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import PracticeHome from '$lib/practice/PracticeHome.svelte'
  import PracticeSession from '$lib/practice/PracticeSession.svelte'
  import ExamSession from '$lib/practice/ExamSession.svelte'
  import ExamReview from '$lib/practice/ExamReview.svelte'

  onMount(() => void practice.load(packs.active?.id ?? null))

  const v = $derived(practice.view)
  const run = $derived(practice.run)
  const record = $derived(v.page === 'record' ? practice.record(v.id) : null)
</script>

{#if !practice.log}
  <div class="page"><p class="muted">{t('common.loading')}</p></div>
{:else if v.page === 'run' && run?.mode === 'exam'}
  <ExamSession />
{:else if v.page === 'run' && run?.mode === 'practice'}
  <PracticeSession />
{:else if v.page === 'record' && record}
  {#key record.id}
    <ExamReview {record} />
  {/key}
{:else}
  <PracticeHome />
{/if}
