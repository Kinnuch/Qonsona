<script lang="ts">
  // 一道题的解析：几行说明、朗读、加进生词本（日语按词条号取词条，千语集语言按词条 id）
  import type { ExamQuestion } from '$shared/exam'
  import type { CardInput } from '$shared/notebook'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import AddToNotebook from '$lib/notebook/AddToNotebook.svelte'
  import { jaEntryId, jaFromEntry, qonFromLexeme, qonItem } from '$lib/notebook/cards'
  import { platform } from '$lib/platform'
  import { packs } from '$lib/state/packs.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { sayable, txt } from '$lib/courses/view'

  let { q }: { q: ExamQuestion } = $props()

  const say = $derived(sayable(q.explain.say))
  const card = $derived(q.explain.card)

  async function make(): Promise<CardInput> {
    const key = card!
    const id = jaEntryId(key)
    if (id !== null) {
      const e = await platform.ja.entry(id)
      if (!e) throw new Error(t('practice.noEntry'))
      return jaFromEntry(e)
    }
    const project = packs.project
    const lang = project?.languages.find((l) => l.id === packs.active?.source?.languageId)
    const lexeme = project ? qonItem(project, key)?.lexeme : undefined
    if (!lang || !lexeme) throw new Error(t('practice.noEntry'))
    return qonFromLexeme(lang, lexeme)
  }
</script>

<div class="explain" data-explain>
  {#each q.explain.lines as line, i (i)}
    <p class:head={i === 0}>{txt(line)}</p>
  {/each}
  {#if say || card}
    <div class="tools">
      {#if say}<Pronounce item={say} />{/if}
      {#if card}<AddToNotebook key={card} {make} />{/if}
    </div>
  {/if}
</div>

<style>
  .explain {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
  }
  .head {
    font-weight: 600;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
</style>
