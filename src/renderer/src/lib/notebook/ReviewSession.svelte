<script lang="ts">
  // 一轮复习 / 闪卡：先只看正面，按「不认识 / 有印象 / 认识」自评，然后翻出背面（读音、释义、例句）。
  // 快捷键：1 / 2 / 3 评价，空格或回车下一张，退格撤回上一题，Esc 结束这一轮
  import { X, Undo2, ArrowRight, RotateCcw } from '@lucide/svelte'
  import { notebook } from '$lib/state/notebook.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { platform } from '$lib/platform'
  import { t, pick, i18n } from '$lib/i18n/index.svelte'
  import { isSpot, preview, type Grade } from '$shared/srs'
  import type { EntryView } from '$shared/dict'
  import { lexemeScript, renderScript } from '$qon/script/render'
  import { ensureScriptFont, fontFamilyCss } from '$qon/script/fonts'
  import { jaEntryId, lexEntryId, qonItem } from './cards'
  import { langModule } from '$shared/lang/registry'
  import type { LexEntryView } from '$shared/lang/views'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import ReviewQuestion from './ReviewQuestion.svelte'
  import { reviewExample, type ReviewExample } from '$shared/review-question'
  import { audio } from '$lib/state/audio.svelte'
  import { onDestroy } from 'svelte'
  onDestroy(() => audio.stop())

  const GRADES: { q: Grade; id: 'forgot' | 'unsure' | 'known' }[] = [
    { q: 0, id: 'forgot' },
    { q: 3, id: 'unsure' },
    { q: 5, id: 'known' }
  ]

  const s = $derived(notebook.session)
  const card = $derived(notebook.card)
  const answered = $derived(s?.answered ?? null)
  const answeredId = $derived(GRADES.find((g) => g.q === answered)?.id ?? 'known')
  /** 按词本过闪卡时，排了期还没到期的是抽查：认识不改排期 */
  const spot = $derived(!!card && s?.mode === 'drill' && isSpot(card))
  const hints = $derived(
    card
      ? preview(card, spot, Date.now(), notebook.cardPlan.masterDays, notebook.cardPlan.ladder)
      : null
  )
  const question = $derived(s?.question.question ?? null)

  // 日语：背面的词条详情（例句）
  const entryId = $derived(card ? jaEntryId(card.key) : null)
  let entry = $state<EntryView | null>(null)
  let jaLoading = $state(false)
  let jaEpoch = 0
  $effect(() => {
    const id = entryId
    const epoch = ++jaEpoch
    entry = null
    jaLoading = id !== null
    if (id !== null)
      platform.ja
        .entry(id)
        .then((e) => {
          if (entryId === id && epoch === jaEpoch) entry = e
        })
        .catch(() => {})
        .finally(() => {
          if (entryId === id && epoch === jaEpoch) jaLoading = false
        })
    return () => {
      jaEpoch++
    }
  })
  // 框架语言（英、法、韩……）：背面取词条的例句
  const lang = $derived(packs.active ? langModule(packs.active.id) : null)
  const lexId = $derived(card && lang ? lexEntryId(card.key) : null)
  let lexEntry = $state<LexEntryView | null>(null)
  let lexLoading = $state(false)
  let lexEpoch = 0
  $effect(() => {
    const id = lexId
    const code = lang?.spec.code
    const epoch = ++lexEpoch
    lexEntry = null
    lexLoading = id !== null && !!code
    if (id !== null && code)
      platform.lang
        .entry(code, id)
        .then((e) => {
          if (lexId === id && lang?.spec.code === code && epoch === lexEpoch) lexEntry = e
        })
        .catch(() => {})
        .finally(() => {
          if (lexId === id && lang?.spec.code === code && epoch === lexEpoch) lexLoading = false
        })
    return () => {
      lexEpoch++
    }
  })
  const lexExample = $derived(
    lexEntry
      ? (lexEntry.senses.flatMap((x) => x.examples)[0] ?? lexEntry.examples[0] ?? null)
      : null
  )
  const example = $derived.by(() => {
    const ja = entry?.senses.flatMap((x) => x.examples)[0]
    if (ja) return { text: ja.ja, zh: ja.zh, en: ja.en, lang: 'ja' }
    if (lexExample)
      return {
        text: lexExample.text,
        zh: lexExample.zh ?? null,
        en: lexExample.en ?? null,
        lang: lang?.spec.bcp47
      }
    return null
  })

  // 千语集：词条 / 短语与这门语言的第一套文字
  const project = $derived(packs.project)
  const language = $derived(
    project?.languages.find((l) => l.id === packs.active?.source?.languageId) ?? null
  )
  const item = $derived(card && project ? qonItem(project, card.key) : null)
  const script = $derived(language?.scripts[0] ?? null)
  $effect(() => {
    if (script) ensureScriptFont(script)
  })
  const scriptText = $derived.by(() => {
    if (!language || !script || !item) return ''
    if (item.lexeme) return lexemeScript(language, script, item.lexeme)
    return item.phrase ? renderScript(language, script, item.phrase.text) : ''
  })

  const say = $derived(
    !card
      ? null
      : entryId !== null
        ? { key: `entry-${entryId}`, text: card.reading || card.front, lang: 'ja-JP' }
        : lexId !== null && lang?.spec.features.speech
          ? { key: card.key, text: card.front, lang: lang.spec.features.speech }
          : { key: card.key, ipa: card.reading }
  )

  function ivlLabel(days: number): string {
    if (!days) return t('notebook.session.soon')
    if (days < 30) return t('notebook.days', { n: days })
    if (days < 365) return t('notebook.months', { n: Math.round(days / 30) })
    return t('notebook.years', { n: Math.round((days / 365) * 10) / 10 })
  }

  $effect(() => {
    if (!s || !card || s.done || s.questionPrepared) return
    const tasks = Object.entries(notebook.cardPlan.weights).some(
      ([kind, weight]) => kind !== 'flashcard' && weight > 0
    )
    if (tasks && (jaLoading || lexLoading)) return
    const forms = [
      card.front,
      ...(entry?.kanji.map((f) => f.text) ?? []),
      ...(entry?.kana.map((f) => f.text) ?? []),
      ...(lexEntry?.forms.map((f) => f.form) ?? []),
      ...(lexEntry?.d ? [lexEntry.d] : [])
    ]
    const examples: ReviewExample[] = []
    for (const ex of entry?.senses.flatMap((x) => x.examples) ?? []) {
      const found = reviewExample(
        ex.ja,
        forms,
        (i18n.locale === 'zh' ? ex.zh : ex.en) ?? ex.en ?? undefined
      )
      if (found) examples.push(found)
    }
    for (const ex of lexEntry
      ? [...lexEntry.senses.flatMap((x) => x.examples), ...lexEntry.examples]
      : []) {
      const found = reviewExample(
        ex.text,
        forms,
        (i18n.locale === 'zh' ? ex.zh : ex.en) ?? ex.en ?? undefined
      )
      if (found) examples.push(found)
    }
    if (project && language && item?.lexeme)
      for (const phrase of project.phrasebook.filter((p) => p.languageId === language.id)) {
        const found = reviewExample(phrase.text, forms, pick(phrase.translation))
        if (found) examples.push(found)
      }
    notebook.prepareQuestion({
      locale: i18n.locale,
      canListen: !!say && audio.canSay(say),
      examples,
      forms
    })
  })

  function onkey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, select')) return
    if (!s || s.done) {
      if (e.key === 'Escape') notebook.exit()
      return
    }
    if (answered === null && s.questionPrepared && !question && ['1', '2', '3'].includes(e.key)) {
      e.preventDefault()
      notebook.grade(GRADES[Number(e.key) - 1].q)
    } else if (answered !== null && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault()
      notebook.next()
    } else if (e.key === 'Backspace' && s.undo.length) {
      e.preventDefault()
      notebook.undo()
    } else if (e.key === 'Escape') notebook.exit()
  }

  const title = $derived(
    s?.listId
      ? t('notebook.session.drillOf', { list: notebook.listName(s.listId) })
      : t('notebook.session.review')
  )
  const meaning = (m: Record<string, string>): string =>
    (i18n.locale === 'zh' ? m.zh || m.en : m.en || m.zh) || pick(m)
</script>

<svelte:window onkeydown={onkey} />

{#if s}
  <div class="session" data-session={s.mode}>
    <header class="bar">
      <strong>{title}</strong>
      <span class="faint" data-progress
        >{t('notebook.session.progress', {
          i: Math.min(s.i + 1, s.queue.length),
          n: s.queue.length
        })}</span
      >
      <div class="grow"></div>
      <button
        class="btn ghost"
        data-undo
        disabled={!s.undo.length}
        title={t('notebook.session.undoHint')}
        onclick={() => notebook.undo()}><Undo2 size={16} />{t('notebook.session.undo')}</button
      >
      <button
        class="btn ghost"
        data-exit
        title={t('notebook.session.exit')}
        onclick={() => notebook.exit()}><X size={16} /></button
      >
    </header>
    <div class="track"><div class="fill" style:width="{(s.i / s.queue.length) * 100}%"></div></div>

    {#if s.done}
      <div class="card done" data-session-done>
        <h2>{t('notebook.session.done')}</h2>
        <p class="muted">
          {t('notebook.session.summary', { n: s.undo.length, right: s.right, wrong: s.wrong })}
        </p>
        <div class="row">
          <button class="btn primary" onclick={() => notebook.exit()}
            >{t('notebook.session.back')}</button
          >
          {#if s.mode === 'review' && notebook.counts.due + notebook.counts.fresh > 0}
            <button class="btn" onclick={() => notebook.startReview()}
              ><RotateCcw size={14} />{t('notebook.session.more')}</button
            >
          {/if}
        </div>
      </div>
    {:else if card}
      <div class="card flash" data-card={card.key}>
        {#if question}
          {#key `${card.key}/${s.i}/${s.questionEpoch}`}
            <ReviewQuestion
              {question}
              {say}
              answered={answered !== null}
              onanswer={(correct) => notebook.grade(correct ? 5 : 0, true)}
            />
          {/key}
        {:else if !s.questionPrepared}
          <p class="muted">
            {i18n.locale === 'zh'
              ? '正在准备当前词的复习题…'
              : 'Preparing this word’s review task…'}
          </p>
        {:else}
          {#if spot}<span class="chip spot" title={t('notebook.session.spotHint')}
              >{t('notebook.session.spot')}</span
            >{/if}
          <p class="front" lang={packs.active?.bcp47} class:data={entryId === null}>{card.front}</p>

          {#if answered !== null}
            <div class="back" data-back>
              <div class="row center">
                {#if card.reading && card.reading !== card.front}
                  <span
                    class="reading"
                    class:data={entryId === null}
                    lang={entryId !== null ? 'ja' : undefined}
                    >{entryId === null ? `[${card.reading}]` : card.reading}</span
                  >
                {/if}
                {#if say}<Pronounce item={say} />{/if}
              </div>
              {#if scriptText && script}
                <p class="script" style={fontFamilyCss(script)}>{scriptText}</p>
              {/if}
              <p class="meaning">{meaning(card.meaning)}</p>
              {#if example}
                <div class="example">
                  <p lang={example.lang} dir="auto">{example.text}</p>
                  <p class="muted">
                    {(i18n.locale === 'zh' ? example.zh : example.en) ?? example.en ?? ''}
                  </p>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>

      {#if s.question.fallback && !question}<p class="muted" data-review-fallback>
          {s.question.fallbackReason === 'disabled'
            ? i18n.locale === 'zh'
              ? '全部题型频次为0；本轮使用闪卡，未启用练习题。'
              : 'All task weights are zero. This round uses flashcards; practice tasks remain disabled.'
            : i18n.locale === 'zh'
              ? '所选题型缺少足够释义、读音、可播放音频或当前词真实例句，本词改用闪卡；频次为0的题型仍不出题。'
              : 'Enabled tasks lack sufficient meanings, readings, playable audio or real examples of this word. This word uses a flashcard; zero-weight tasks remain disabled.'}
        </p>{/if}
      {#if answered === null && s.questionPrepared && !question}
        <div class="grades">
          {#each GRADES as g, k (g.q)}
            <button class="btn grade {g.id}" data-grade={g.q} onclick={() => notebook.grade(g.q)}>
              <strong>{t(`notebook.grades.${g.id}`)}</strong>
              <span class="faint">{k + 1} · {hints ? ivlLabel(hints[g.q]) : ''}</span>
            </button>
          {/each}
        </div>
      {:else if answered !== null}
        <div class="grades">
          <span class="chip graded {answeredId}">{t(`notebook.grades.${answeredId}`)}</span>
          <button class="btn primary next" data-next onclick={() => notebook.next()}
            >{t('notebook.session.next')}<ArrowRight size={16} /></button
          >
        </div>
      {/if}
      <p class="faint keys">{t('notebook.session.keys')}</p>
    {/if}
  </div>
{/if}

<style>
  .session {
    max-width: 720px;
    margin: 0 auto;
    padding: 20px 24px 40px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .grow {
    flex: 1;
  }
  .track {
    height: 4px;
    border-radius: 2px;
    background: var(--bg-sunken);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
  }
  .flash {
    position: relative;
    min-height: 260px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 32px 24px;
    text-align: center;
  }
  .spot {
    position: absolute;
    top: 12px;
    inset-inline-end: 12px;
  }
  .front {
    font-size: 42px;
    font-weight: 600;
    line-height: 1.3;
  }
  .data {
    font-family: var(--font-data);
  }
  .back {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    border-top: 1px solid var(--border);
    padding-top: 14px;
    width: 100%;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .center {
    justify-content: center;
  }
  .reading {
    font-size: 20px;
    color: var(--text-2);
  }
  .script {
    font-size: 28px;
  }
  .meaning {
    font-size: 18px;
  }
  .example {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 15px;
  }
  .grades {
    display: flex;
    justify-content: center;
    gap: 12px;
  }
  .grade {
    flex-direction: column;
    gap: 2px;
    min-width: 132px;
    padding: 10px 16px;
  }
  .grade.forgot strong {
    color: var(--danger);
  }
  .grade.unsure strong {
    color: #c98a1b;
  }
  .grade.known strong {
    color: #2f9e63;
  }
  .graded {
    align-self: center;
  }
  .graded.forgot {
    background: var(--danger-soft);
    color: var(--danger);
  }
  .graded.unsure {
    background: color-mix(in srgb, #c98a1b 16%, var(--bg-elev));
    color: #a86f10;
  }
  .graded.known {
    background: color-mix(in srgb, #2f9e63 16%, var(--bg-elev));
    color: #23804f;
  }
  .next {
    padding: 8px 18px;
  }
  .keys {
    text-align: center;
  }
  .done {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px;
  }
</style>
