<script lang="ts">
  import { notebook } from '$lib/state/notebook.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { audio } from '$lib/state/audio.svelte'
  import { platform } from '$lib/platform'
  import { i18n } from '$lib/i18n/index.svelte'
  import { onMount, untrack } from 'svelte'
  import {
    defaultReviewSettings,
    isReviewSettings,
    REVIEW_KINDS,
    type ReviewSettings
  } from '$shared/review-settings'
  import { dayKey } from '$shared/srs'
  import { reviewCapabilities, reviewExample } from '$shared/review-question'
  import { jaEntryId, lexEntryId, qonItem } from './cards'
  import { langModule } from '$shared/lang/registry'
  let { listId, onclose }: { listId: string | null; onclose: () => void } = $props()
  let scope = $state('language')
  let draft = $state<ReviewSettings>(defaultReviewSettings())
  let ladderText = $state('1, 2, 4, 7, 15')
  let date = $state(dayKey())
  let mode = $state<'due' | 'scheduled'>('due')
  let message = $state('')
  let error = $state('')
  let contextAvailable = $state(false)
  let contextChecking = $state(false)
  let dialog = $state<HTMLDialogElement>()
  onMount(() => dialog?.showModal())
  const zh = $derived(i18n.locale === 'zh')
  const selected = $derived(scope === 'list' ? listId : null)
  const labels = {
    flashcard: ['闪卡自评', 'Flashcard self-rating'],
    'word-meaning': ['看词选义', 'Word → meaning'],
    'meaning-word': ['由义选词', 'Meaning → word'],
    spelling: ['拼写输入', 'Spelling input'],
    reading: ['读音选择', 'Reading choice'],
    listening: ['听音选词', 'Listen → word'],
    context: ['真实例句填空', 'Real-example context']
  }
  const pool = $derived.by(() => {
    if (!notebook.nb) return []
    if (!selected) return Object.values(notebook.nb.cards)
    const keys = notebook.nb.lists.find((l) => l.id === selected)?.keys ?? []
    return keys.map((key) => notebook.nb!.cards[key]).filter(Boolean)
  })
  const caps = $derived.by(() => {
    const all = new Set<string>(['flashcard'])
    for (const card of pool.slice(0, 30)) {
      const speech = packs.active?.features.speech
      const ja = jaEntryId(card.key)
      const say = speech
        ? { key: ja !== null ? `entry-${ja}` : card.key, text: card.front, lang: speech }
        : { key: card.key, ipa: card.reading }
      for (const k of reviewCapabilities(card, pool, {
        locale: i18n.locale,
        canListen: audio.canSay(say),
        examples: []
      }))
        all.add(k)
    }
    if (contextAvailable) all.add('context')
    return all
  })
  $effect(() => {
    const scopeId = selected
    // 只在切换设置范围时填入草稿；重排触发的 notebook 更新不能抹掉成功提示或未保存编辑。
    const next = untrack(() => notebook.reviewSettings(scopeId))
    draft = structuredClone(next)
    ladderText = next.ladder.join(', ')
    error = ''
    message = ''
  })
  $effect(() => {
    const cards = pool.slice(0, 12)
    const packId = packs.active?.id
    let active = true
    contextAvailable = false
    contextChecking = cards.length > 0
    void (async () => {
      for (const card of cards) {
        if (!active) break
        const ja = jaEntryId(card.key)
        const lex = lexEntryId(card.key)
        const lang = packId ? langModule(packId) : null
        let found = false
        if (ja !== null) {
          const e = await platform.ja.entry(ja).catch(() => null)
          found = !!e?.senses.some((s) =>
            s.examples.some((x) =>
              reviewExample(x.ja, [
                card.front,
                ...e.kanji.map((f) => f.text),
                ...e.kana.map((f) => f.text)
              ])
            )
          )
        } else if (lex !== null && lang) {
          const e = await platform.lang.entry(lang.spec.code, lex).catch(() => null)
          found =
            !!e &&
            [...e.senses.flatMap((s) => s.examples), ...e.examples].some((x) =>
              reviewExample(x.text, [card.front, e.d ?? '', ...e.forms.map((f) => f.form)])
            )
        } else if (packs.project) {
          const item = qonItem(packs.project, card.key)
          found =
            !!item?.lexeme &&
            packs.project.phrasebook.some(
              (p) => p.languageId === item.lexeme!.languageId && reviewExample(p.text, [card.front])
            )
        }
        if (found) {
          if (active) contextAvailable = true
          break
        }
      }
      if (active) contextChecking = false
    })()
    return () => {
      active = false
    }
  })
  function value(): ReviewSettings | null {
    const next = {
      ...draft,
      ladder: ladderText
        .split(/[,，\s]+/u)
        .filter(Boolean)
        .map(Number),
      weights: { ...draft.weights }
    }
    if (!isReviewSettings(next)) {
      error = zh
        ? '请使用非负整数每日额度、至少两个递增的整数间隔（1–3650天）、有效掌握阈值（1–36500天）与0–100题型权重。'
        : 'Use non-negative integer daily limits, at least two increasing integer intervals (1–3650 days), a valid mastery threshold (1–36500 days), and task weights from 0 to 100.'
      return null
    }
    return next
  }
  function save(): void {
    const next = value()
    if (!next) return
    notebook.setReviewSettings(selected, next)
    onclose()
  }
  function replan(): void {
    try {
      const n = notebook.reschedule(selected, date, mode)
      message = zh
        ? `已重排 ${n} 张卡的到期日期，作答历史与熟练度保持。`
        : `Rescheduled ${n} cards; answer history and ease were preserved.`
      error = ''
    } catch {
      error = zh ? '请选择有效日期。' : 'Choose a valid date.'
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="settings card"
  aria-labelledby="review-settings-title"
  data-review-settings
  oncancel={(e) => {
    e.preventDefault()
    onclose()
  }}
>
  <header>
    <h2 id="review-settings-title">{zh ? '复习计划与题型' : 'Review plan and tasks'}</h2>
    <button class="btn ghost" aria-label={zh ? '关闭' : 'Close'} onclick={onclose}>×</button>
  </header>
  <label
    >{zh ? '设置范围' : 'Scope'}<select bind:value={scope} data-review-scope
      ><option value="language">{zh ? '当前语言' : 'Current language'}</option>{#if listId}<option
          value="list">{zh ? '当前词本：' : 'Current list: '}{notebook.listName(listId)}</option
        >{/if}</select
    ></label
  >
  <p class="muted">
    {zh
      ? '词本设置覆盖语言计划。同一词属于多个专属词本时，整门语言复习使用最早建立的词本计划；按指定词本复习则使用该词本计划。'
      : 'List settings override the language plan. For cards in several configured lists, whole-language review uses the oldest list; a list-specific review uses that list.'}
  </p>
  <div class="fields">
    <label
      >{zh ? '每日新词（0禁用）' : 'Daily new words (0 disables)'}<input
        data-review-new
        type="number"
        min="0"
        max="10000"
        step="1"
        bind:value={draft.newPerDay}
      /></label
    >
    <label
      >{zh ? '每日复习上限（0禁用）' : 'Daily review limit (0 disables)'}<input
        data-review-cap
        type="number"
        min="0"
        max="10000"
        step="1"
        bind:value={draft.reviewCap}
      /></label
    >
    <label
      >{zh ? '记住后的间隔阶梯（天）' : 'Remembered interval ladder (days)'}<input
        data-review-ladder
        bind:value={ladderText}
      /></label
    >
    <label
      >{zh ? '掌握阈值（天）' : 'Mastery threshold (days)'}<input
        data-review-master
        type="number"
        min="1"
        max="36500"
        bind:value={draft.masterDays}
      /></label
    >
    <label
      >{zh ? '新词与提问顺序' : 'New word / question order'}<select bind:value={draft.order}
        ><option value="seq">{zh ? '按加入顺序' : 'Added order'}</option><option value="random"
          >{zh ? '随机' : 'Random'}</option
        ></select
      ></label
    >
  </div>
  <h3>{zh ? '每种题型独立频次／权重' : 'Independent task frequency / weight'}</h3>
  <p class="muted">
    {zh
      ? '例如词义3、拼写1，约每4题有3题词义和1题拼写。0禁用；只有当前词的数据足够才出题，所有启用题型不可用时明确退回闪卡。选择题需要另外3个不同的干扰项。'
      : 'For example, meaning 3 and spelling 1 yields about three meaning tasks per spelling task. Zero disables a task. Tasks require data for the current card; unavailable tasks fall back to a flashcard. Choices require three distinct distractors.'}
  </p>
  <div class="weights">
    {#each REVIEW_KINDS as kind (kind)}<label
        >{labels[kind][zh ? 0 : 1]}<input
          type="number"
          min="0"
          max="100"
          step="1"
          data-review-weight={kind}
          data-review-capable={caps.has(kind)}
          bind:value={draft.weights[kind]}
        />{#if !caps.has(kind)}<span class="muted"
            >{kind === 'context' && contextChecking
              ? zh
                ? '检查真实例句…'
                : 'Checking real examples…'
              : zh
                ? '当前样本未发现所需数据；仍可配置频次，复习时逐词检查，缺数据的词改用闪卡。'
                : 'Data were not found in this sample. You may set a weight; each card is checked during review and uses a flashcard when data are missing.'}</span
          >{/if}</label
      >{/each}
  </div>
  <div class="actions">
    <button class="btn primary" data-review-save onclick={save}
      >{zh ? '保存计划' : 'Save plan'}</button
    ><button
      class="btn"
      data-review-inherit
      onclick={() => {
        notebook.resetReviewSettings(selected)
        onclose()
      }}
      >{selected
        ? zh
          ? '使用语言设置'
          : 'Use language settings'
        : zh
          ? '恢复原全局默认'
          : 'Use original global defaults'}</button
    ><button class="btn" onclick={onclose}>{zh ? '取消' : 'Cancel'}</button>
  </div>
  <h3>{zh ? '重排到期日期' : 'Reschedule due dates'}</h3>
  <p class="muted">
    {zh
      ? '仅移动已学习卡的到期日期；不清空历史、新词状态、间隔或熟练度。按已保存的每日上限分散到不同日期。保存计划本身不会重排日期。'
      : 'Moves due dates of studied cards only, preserving history, new status, interval and ease. Spreads cards by the saved daily limit. Saving a plan does not itself move due dates.'}
  </p>
  <div class="actions">
    <select aria-label={zh ? '重排范围' : 'Reschedule scope'} bind:value={mode}
      ><option value="due">{zh ? '仅今天到期／逾期' : 'Due today / overdue only'}</option><option
        value="scheduled">{zh ? '全部已学习卡' : 'All studied cards'}</option
      ></select
    ><input
      type="date"
      aria-label={zh ? '起始日期' : 'Start date'}
      bind:value={date}
      data-review-date
    /><button class="btn" data-review-reschedule onclick={replan}
      >{zh ? '从指定日期重排' : 'Reschedule from date'}</button
    >
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}{#if message}<p
      data-review-settings-message
      role="status"
    >
      {message}
    </p>{/if}
</dialog>

<style>
  .settings::backdrop {
    background: #0006;
  }
  .settings {
    border: 1px solid var(--border);
    color: var(--text);
    max-width: 840px;
    width: calc(100% - 48px);
    max-height: 90vh;
    overflow: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  header,
  .actions {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  header h2 {
    flex: 1;
  }
  .fields,
  .weights {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .weights label {
    display: grid;
    grid-template-columns: 1fr 84px;
    align-items: center;
  }
  .weights span {
    grid-column: 1/-1;
    font-size: 12px;
  }
  input,
  select {
    font: inherit;
    color: inherit;
    background: var(--bg-elev);
    padding: 7px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    min-width: 0;
  }
  .error {
    color: var(--danger);
  }
  @media (max-width: 650px) {
    .fields,
    .weights {
      grid-template-columns: 1fr;
    }
  }
</style>
