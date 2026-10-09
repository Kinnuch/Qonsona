<script lang="ts">
  // 词典的「语法」页签：N5 到 N1 的语法点，按名字（〜たびに、たびに）、意思（中英文）查，可按等级筛；
  // 输入一句日语时，句中认出的语法点排在最前。右边是讲解（意思、接续、例句）、意思相近的几个，
  // 以及跳到语法课里那一课
  import { onMount } from 'svelte'
  import { GraduationCap } from '@lucide/svelte'
  import { platform } from '$lib/platform'
  import { t, i18n } from '$lib/i18n/index.svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { GRAMMAR, GRAMMAR_BY_ID, type GrammarPoint } from '$shared/ja/grammar'
  import { GRAMMAR_NOTES, jaGrammarCourse } from '$shared/ja/grammar-course'
  import { allLessons } from '$shared/course'
  import GrammarPointCard from '$lib/courses/GrammarPointCard.svelte'
  import { txt } from '$lib/courses/view'
  import type { DictMemo } from './state.svelte'

  let { memo }: { memo: DictMemo } = $props()

  const LEVELS = [5, 4, 3, 2, 1]

  onMount(async () => {
    if (!courses.grammarData)
      courses.grammarData = await platform.ja.grammarExamples().catch(() => null)
  })
  const course = $derived(jaGrammarCourse(courses.grammarData))

  // 输入里有日文、四个字以上：当作一句话分析，句中认出的语法点排在最前
  let inSentence = $state<string[]>([])
  let timer: ReturnType<typeof setTimeout> | undefined
  $effect(() => {
    const q = memo.query.trim()
    clearTimeout(timer)
    if (!/[぀-ヿ一-鿿]/.test(q) || [...q].length < 4) {
      inSentence = []
      return
    }
    timer = setTimeout(async () => {
      const a = await platform.ja.analyze(q).catch(() => null)
      if (memo.query.trim() === q) inSentence = [...new Set(a?.grammar.map((h) => h.id) ?? [])]
    }, 250)
  })

  /** 比较名字时去掉 〜、括号、斜线、空白 */
  const bare = (s: string): string => s.replace(/[〜～~\s（）()／/・]/g, '')
  const matches = (g: GrammarPoint, q: string): boolean => {
    if (!q) return true
    const b = bare(q)
    return (
      (!!b && bare(g.name).includes(b)) ||
      g.zh.includes(q) ||
      g.en.toLowerCase().includes(q.toLowerCase()) ||
      g.id === q.toLowerCase()
    )
  }
  const inLevel = (g: GrammarPoint): boolean =>
    memo.grammarLevel === null || g.level === memo.grammarLevel

  const list = $derived.by(() => {
    const q = memo.query.trim()
    const found = inSentence
      .map((id) => GRAMMAR_BY_ID.get(id))
      .filter((g): g is GrammarPoint => !!g && !g.basic && inLevel(g))
    const rest = GRAMMAR.filter((g) => inLevel(g) && !inSentence.includes(g.id) && matches(g, q))
    return { found, rest }
  })

  // 选中的不在列表里时选第一个
  $effect(() => {
    const ids = [...list.found, ...list.rest].map((g) => g.id)
    if (!memo.grammar || !ids.includes(memo.grammar)) memo.grammar = ids[0] ?? null
  })

  const point = $derived(memo.grammar ? (GRAMMAR_BY_ID.get(memo.grammar) ?? null) : null)
  const item = $derived(point ? (course.grammar[point.id] ?? null) : null)
  /** 意思相近的（同一组） */
  const near = $derived.by(() => {
    const group = point ? GRAMMAR_NOTES[point.id]?.group : undefined
    return group
      ? GRAMMAR.filter((g) => g.id !== point!.id && GRAMMAR_NOTES[g.id]?.group === group)
      : []
  })
  const lessonOf = $derived(
    point ? allLessons(course).find((r) => r.lesson.items.includes(point.id)) : undefined
  )

  async function openLesson(): Promise<void> {
    if (!lessonOf) return
    await courses.load('ja')
    courses.openLesson(course.id, lessonOf.lesson.id)
    ui.go('courses')
  }

  const meaning = (g: GrammarPoint): string => (i18n.locale === 'zh' ? g.zh : g.en)
  const lessonTitle = (): string =>
    lessonOf ? `${txt(lessonOf.unit.title)} · ${txt(lessonOf.lesson.title)}` : ''
</script>

{#snippet row(g: GrammarPoint)}
  <li>
    <button
      class="hit"
      class:on={memo.grammar === g.id}
      data-grammar-hit={g.id}
      onclick={() => (memo.grammar = g.id)}
    >
      <span class="row">
        <strong lang="ja">{g.name}</strong>
        <span class="chip level">N{g.level}</span>
      </span>
      <span class="gloss">{meaning(g)}</span>
    </button>
  </li>
{/snippet}

<div class="grammar-tab">
  <div class="seg levels" role="group" aria-label={t('dict.grammar.level')}>
    <button
      class:on={memo.grammarLevel === null}
      data-grammar-level=""
      onclick={() => (memo.grammarLevel = null)}>{t('dict.grammar.all')}</button
    >
    {#each LEVELS as n (n)}
      <button
        class:on={memo.grammarLevel === n}
        data-grammar-level={n}
        onclick={() => (memo.grammarLevel = n)}>N{n}</button
      >
    {/each}
  </div>
  <div class="panes">
    <ul class="list" data-grammar-list>
      {#if list.found.length}
        <li class="hint">{t('dict.grammar.inSentence')}</li>
        {#each list.found as g (g.id)}{@render row(g)}{/each}
        {#if list.rest.length}<li class="hint">{t('dict.grammar.others')}</li>{/if}
      {/if}
      {#each list.rest as g (g.id)}{@render row(g)}{:else}
        {#if !list.found.length}
          <li class="hint">{t('dict.noResult', { q: memo.query.trim() })}</li>
        {/if}
      {/each}
    </ul>
    <div class="detail" data-grammar-detail={point?.id}>
      {#if point && item}
        <GrammarPointCard g={item} level={point.level}>
          {#snippet actions()}
            {#if lessonOf}
              <button class="btn" data-grammar-lesson onclick={openLesson}
                ><GraduationCap size={14} />{t('dict.grammar.openLesson')}</button
              >
              <span class="faint">{lessonTitle()}</span>
            {/if}
          {/snippet}
        </GrammarPointCard>
        {#if near.length}
          <section class="near">
            <h3>{t('dict.grammar.near')}</h3>
            <div class="chips">
              {#each near as g (g.id)}
                <button class="chip" data-grammar-near={g.id} onclick={() => (memo.grammar = g.id)}
                  ><span lang="ja">{g.name}</span><span class="faint">N{g.level}</span></button
                >
              {/each}
            </div>
          </section>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .grammar-tab {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    flex: 1;
  }
  .levels {
    align-self: flex-start;
  }
  .panes {
    display: grid;
    grid-template-columns: minmax(220px, 300px) 1fr;
    gap: 16px;
    min-height: 0;
    flex: 1;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    border-inline-end: 1px solid var(--border);
    padding-inline-end: 8px;
  }
  .hint {
    padding: 6px 10px;
    color: var(--text-3);
    font-size: 13px;
  }
  .hit {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    text-align: start;
    cursor: pointer;
  }
  .hit:hover {
    background: var(--bg-sunken);
  }
  .hit.on {
    background: var(--accent-soft);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .gloss {
    color: var(--text-2);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .near h3 {
    font-size: 14px;
    color: var(--text-2);
    margin-bottom: 6px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chips .chip {
    border: none;
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    padding: 3px 10px;
    gap: 6px;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .seg button {
    padding: 4px 10px;
    border: none;
    background: var(--bg-elev);
    cursor: pointer;
  }
  .seg button + button {
    border-inline-start: 1px solid var(--border);
  }
  .seg button.on {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
</style>
