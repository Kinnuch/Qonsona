<script lang="ts">
  // 千语集语言的阅读：课文（学习包的课，或按出处、分类、文档分好的几篇），逐词对照、自造文字、IPA、译文，
  // 点词看释义，逐句朗读（先放录音，没有就读 IPA）
  import { onDestroy, untrack } from 'svelte'
  import { ArrowLeft, BookOpen, Play, Square, BookMarked, BookmarkPlus } from '@lucide/svelte'
  import type { Language, Project } from '$qon/core/model'
  import { sentenceScript, renderScript } from '$qon/script/render'
  import { ensureScriptFont, fontFamilyCss } from '$qon/script/fonts'
  import { mdToHtml } from '$qon/core/markdown'
  import { packs } from '$lib/state/packs.svelte'
  import { reading } from '$lib/state/reading.svelte'
  import { audio } from '$lib/state/audio.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { dictState } from '$lib/dict/state.svelte'
  import { t, pick } from '$lib/i18n/index.svelte'
  import {
    docLinkResolver,
    glossTitle,
    interlinear,
    qonTexts,
    type GlossPiece,
    type QonText
  } from '$lib/packs/qonlang/reading'
  import { firstGloss, posLabel } from '$lib/packs/qonlang/lexicon'
  import { spellingIpa, storedIpa } from '$lib/packs/qonlang/pronounce'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import AddToNotebook from '$lib/notebook/AddToNotebook.svelte'
  import { qonFromLexeme } from '$lib/notebook/cards'
  import { notebook } from '$lib/state/notebook.svelte'
  import ReaderCompletion from './ReaderCompletion.svelte'
  import { articleVocabulary } from '$shared/article-quiz'

  let { project, language }: { project: Project; language: Language } = $props()

  // Shell 按语言重建整页，这里取一次即可（第一次会新建状态，不能放进 $derived）
  const packId = packs.active!.id
  const display = packs.study?.display
  const memo = reading.qon(packId, {
    showIpa: display?.showIpa ?? true,
    showScript: !!(display?.scriptId ?? untrack(() => language.scripts[0]?.id))
  })
  /** 显示哪套文字：作者定的，不然第一套 */
  const script = $derived(
    language.scripts.find((s) => s.id === display?.scriptId) ?? language.scripts[0] ?? null
  )
  $effect(() => {
    if (script) ensureScriptFont(script)
  })

  const texts = $derived(
    qonTexts(project, language.id, packs.study, packs.hidden, {
      ungrouped: t('reading.qon.ungrouped'),
      phrases: (c) => (c ? t('reading.qon.phrasesOf', { c }) : t('reading.qon.phrases'))
    })
  )
  const text = $derived(texts.find((x) => x.key === memo.text) ?? null)

  /** 「返回」：从首页的课文点进来的回首页，不然回课文列表 */
  function back(): void {
    memo.text = null
    if (reading.backTo === 'home') {
      reading.backTo = null
      ui.go('home')
    }
  }

  /** 一篇里要读的句子：例句在前，短语在后 */
  interface Line {
    key: string
    text: string
    ipa: string
    script: string
    translation: string
    pieces: GlossPiece[]
  }
  function linesOf(x: QonText): Line[] {
    const out: Line[] = []
    for (const id of x.sentenceIds) {
      const s = project.sentences.find((y) => y.id === id)
      if (!s) continue
      out.push({
        key: `sentence-${s.id}`,
        text: s.text,
        ipa: spellingIpa(language, s.text),
        script: script ? sentenceScript(language, script, s) : '',
        translation: pick(s.translation),
        pieces: interlinear(project, s, pick)
      })
    }
    for (const id of x.phraseIds) {
      const p = project.phrasebook.find((y) => y.id === id)
      if (!p) continue
      out.push({
        key: `phrase-${p.id}`,
        text: p.text,
        ipa: storedIpa(language, p.pronunciations) || spellingIpa(language, p.text),
        script: script ? renderScript(language, script, p.text) : '',
        translation: pick(p.translation),
        pieces: interlinear(project, p, pick)
      })
    }
    return out
  }
  const lines = $derived(text ? linesOf(text) : [])
  const doc = $derived(text?.docId ? project.docs.find((d) => d.id === text.docId) : undefined)
  const docText = $derived.by(() => {
    if (!doc?.markdown) return ''
    const html = mdToHtml(doc.markdown, { resolve: docLinkResolver(project) })
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    return [...parsed.body.children]
      .map((e) => e.textContent?.trim() ?? '')
      .filter(Boolean)
      .join('\n\n')
  })
  const newWords = $derived(
    (text?.lexemeIds ?? []).map((id) => project.lexemes.find((l) => l.id === id)).filter((l) => !!l)
  )
  const quizVocabulary = $derived.by(() => {
    const pool = project.lexemes
      .filter((l) => l.languageId === language.id && !packs.hidden.has(l.id))
      .map((l) => ({
        id: l.id,
        word: l.lemma,
        meaning: l.senses.find((s) => Object.values(s.definition).some(Boolean))?.definition ?? {},
        evidence: ''
      }))
    const byId = new Map(pool.map((w) => [w.id, w]))
    const source = lines.flatMap((line) =>
      line.pieces.flatMap((piece) => {
        const w = byId.get(piece.lexemeId ?? '')
        return w ? [{ ...w, evidence: line.text }] : []
      })
    )
    return articleVocabulary(source, pool)
  })

  // ── 点词：词卡 ──
  let pop = $state<{ lexemeId: string | null; surface: string; x: number; y: number } | null>(null)
  const popLex = $derived(
    pop?.lexemeId ? project.lexemes.find((l) => l.id === pop!.lexemeId) : undefined
  )
  function openWord(lexemeId: string | null, surface: string, el: HTMLElement): void {
    const r = el.getBoundingClientRect()
    pop = {
      lexemeId,
      surface,
      x: Math.max(8, Math.min(r.left, window.innerWidth - 330)),
      y: r.bottom + 6
    }
  }
  function openInDictionary(): void {
    if (!pop) return
    const m = dictState.of(packId)
    m.tab = 'words'
    m.query = popLex?.lemma ?? pop.surface
    m.selected = popLex?.id ?? null
    ui.go('dictionary')
  }
  const levelName = (id: string | undefined): string =>
    id ? pick(packs.levels?.system.levels.find((l) => l.id === id)?.name) : ''

  // ── 逐句朗读 ──
  let speaking = $state(false)
  let current = $state<string | null>(null)
  let run = 0
  async function readFrom(i: number): Promise<void> {
    const my = ++run
    speaking = true
    audio.stop()
    for (let k = i; k < lines.length; k++) {
      if (my !== run) return
      current = lines[k].key
      if (audio.canSay({ key: lines[k].key, ipa: lines[k].ipa }))
        await audio.say({ key: lines[k].key, ipa: lines[k].ipa })
    }
    if (my === run) {
      speaking = false
      current = null
    }
  }
  function stopReading(): void {
    run++
    speaking = false
    current = null
    audio.stop()
  }
  onDestroy(() => {
    if (speaking) stopReading()
  })

  const KIND_ORDER: QonText['kind'][] = ['lesson', 'source', 'phrases', 'doc']
</script>

<svelte:window
  onclick={(e) => {
    if (!(e.target as HTMLElement).closest('.pop, .qw, .nw, a[data-kind]')) pop = null
  }}
  onkeydown={(e) => e.key === 'Escape' && (pop = null)}
/>

<div class="page">
  {#if !text}
    <header class="page-head">
      <BookOpen size={22} strokeWidth={1.8} />
      <h1>{t('nav.reading')}</h1>
    </header>
    <p class="muted">
      {packs.study?.lessons.length ? t('reading.qon.introLessons') : t('reading.qon.intro')}
    </p>
    {#each KIND_ORDER as kind (kind)}
      {@const group = texts.filter((x) => x.kind === kind)}
      {#if group.length}
        <section class="group">
          <h3>{t(`reading.qon.kinds.${kind}`)}</h3>
          {#each group as x, i (x.key)}
            <button
              class="card item"
              data-qon-text={x.key}
              onclick={() => {
                reading.backTo = null
                memo.text = x.key
              }}
            >
              {#if kind === 'lesson'}<span class="num">{i + 1}</span>{/if}
              <strong class="data">{x.title}</strong>
              <span class="faint">
                {[
                  x.sentenceIds.length && t('reading.qon.nSentences', { n: x.sentenceIds.length }),
                  x.phraseIds.length && t('reading.qon.nPhrases', { n: x.phraseIds.length }),
                  x.lexemeIds.length && t('reading.qon.nWords', { n: x.lexemeIds.length })
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
          {/each}
        </section>
      {/if}
    {:else}
      <p class="card muted">{t('reading.qon.empty')}</p>
    {/each}
  {:else}
    <div class="toolbar">
      <button class="btn ghost" data-back onclick={back}
        ><ArrowLeft size={16} />{reading.backTo === 'home'
          ? t('reading.backHome')
          : t('reading.qon.back')}</button
      >
      <div class="grow"></div>
      {#if script}
        <label class="check"
          ><input type="checkbox" bind:checked={memo.showScript} />{script.name}</label
        >
      {/if}
      <label class="check"
        ><input type="checkbox" bind:checked={memo.showIpa} data-toggle-ipa />{t(
          'reading.qon.ipa'
        )}</label
      >
      <label class="check"
        ><input type="checkbox" bind:checked={memo.showGloss} data-toggle-gloss />{t(
          'reading.qon.gloss'
        )}</label
      >
      <label class="check"
        ><input type="checkbox" bind:checked={memo.showTranslation} />{t(
          'reading.qon.translation'
        )}</label
      >
      {#if lines.length}
        {#if speaking}
          <button class="btn" onclick={stopReading}><Square size={14} />{t('reading.stop')}</button>
        {:else}
          <button class="btn primary" data-read-aloud onclick={() => readFrom(0)}
            ><Play size={14} />{t('reading.readAloud')}</button
          >
        {/if}
      {/if}
    </div>

    <h1 class="data">{text.title}</h1>

    {#if newWords.length}
      <section class="card">
        <div class="nw-head">
          <h3>{t('reading.qon.newWords')}</h3>
          <button
            class="btn small"
            data-add-lesson
            onclick={() =>
              notebook.addMany(
                newWords.map((l) => qonFromLexeme(language, l)),
                text.title,
                text.kind === 'lesson' ? text.key : undefined
              )}><BookmarkPlus size={14} />{t('reading.qon.addNewWords')}</button
          >
        </div>
        <div class="new-words">
          {#each newWords as l (l.id)}
            <button class="nw" onclick={(e) => openWord(l.id, l.lemma, e.currentTarget)}>
              <span class="data">{l.lemma}</span>
              <span class="faint">{firstGloss(l, pick)}</span>
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if doc?.markdown.trim()}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <section
        class="card md"
        data-lesson-doc
        onclick={(e) => {
          // 文档里链到词条的 [[…]]：点了出词卡
          const a = (e.target as HTMLElement).closest<HTMLElement>('a[data-kind="lexeme"]')
          if (!a) return
          e.preventDefault()
          openWord(a.dataset.id ?? null, a.textContent ?? '', a)
        }}
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- mdToHtml 已转义原文，链接只认 http(s) -->
        {@html mdToHtml(doc.markdown, { resolve: docLinkResolver(project) })}
      </section>
    {/if}

    <div class="lines">
      {#each lines as line, i (line.key)}
        <div class="line" class:current={current === line.key} data-line={line.key}>
          <div class="words" lang={packs.active?.bcp47}>
            {#each line.pieces as p, k (k)}
              {#if p.word}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <span
                  class="qw"
                  data-lex={p.lexemeId ?? ''}
                  onclick={(e) => openWord(p.lexemeId, p.text, e.currentTarget)}
                >
                  <span class="data surface">{p.text}</span>
                  {#if memo.showGloss}<span class="g" title={glossTitle(project, p.gloss, pick)}
                      >{p.gloss || '?'}</span
                    >{/if}
                </span>
              {:else if p.text.trim()}
                <span class="data punct">{p.text}</span>
              {/if}
            {/each}
            <Pronounce item={{ key: line.key, ipa: line.ipa }} />
            <button
              class="btn ghost from"
              title={t('reading.qon.readFromHere')}
              onclick={() => readFrom(i)}><Play size={12} /></button
            >
          </div>
          {#if memo.showScript && script && line.script}
            <p class="script" style={fontFamilyCss(script)}>{line.script}</p>
          {/if}
          {#if memo.showIpa && line.ipa}<p class="ipa data">[{line.ipa}]</p>{/if}
          {#if memo.showTranslation && line.translation}<p class="muted">{line.translation}</p>{/if}
        </div>
      {:else}
        {#if !doc?.markdown.trim()}<p class="card muted">{t('reading.qon.noLines')}</p>{/if}
      {/each}
    </div>
    {#key text.key}<ReaderCompletion
        {packId}
        material={{
          id: text.key,
          body: lines.length ? lines.map((l) => l.text).join('\n\n') : docText,
          translation:
            lines.length && lines.every((l) => l.translation.trim())
              ? lines.map((l) => l.translation).join('\n\n')
              : undefined,
          lang: packs.active?.bcp47
        }}
        vocabulary={quizVocabulary}
      />{/key}
  {/if}
</div>

{#if pop}
  <div class="pop card" style:left="{pop.x}px" style:top="{pop.y}px" data-word-card>
    <div class="pop-head">
      <span class="data pop-word">{popLex?.lemma ?? pop.surface}</span>
      {#if popLex && posLabel(project, popLex.posId, pick)}<span class="chip"
          >{posLabel(project, popLex.posId, pick)}</span
        >{/if}
      {#if popLex && packs.levels?.entries[popLex.id]}<span class="chip on"
          >{levelName(packs.levels.entries[popLex.id])}</span
        >{/if}
      {#if popLex}<Pronounce
          item={{
            key: `lexeme-${popLex.id}`,
            ipa: storedIpa(language, popLex.pronunciations) || spellingIpa(language, popLex.lemma)
          }}
        />{/if}
    </div>
    {#if popLex}
      <p>{firstGloss(popLex, pick)}</p>
      <div class="pop-actions">
        <button class="btn" onclick={openInDictionary}
          ><BookMarked size={14} />{t('reading.openInDict')}</button
        >
        <AddToNotebook key={`lexeme-${popLex.id}`} make={() => qonFromLexeme(language, popLex!)} />
      </div>
    {:else}
      <p class="muted">{t('reading.noEntry')}</p>
    {/if}
  </div>
{/if}

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 12px 16px;
    text-align: start;
    cursor: pointer;
  }
  .item:hover strong {
    color: var(--accent-text);
  }
  .num {
    min-width: 22px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
  }
  .data {
    font-family: var(--font-data);
  }
  .toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  .grow {
    flex: 1;
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .new-words {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }
  .nw {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 3px 10px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--bg-elev);
    cursor: pointer;
  }
  .md :global(h2),
  .md :global(h3) {
    margin: 0.6em 0 0.3em;
  }
  .md :global(p) {
    margin: 0 0 0.6em;
  }
  .md :global(.wl) {
    color: inherit;
  }
  .md :global(a.wl) {
    color: var(--accent-text);
    text-decoration: underline dotted;
    cursor: pointer;
  }
  .md :global(.wl.data) {
    font-family: var(--font-data);
  }
  .lines {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .line {
    padding: 10px 12px;
    border-radius: var(--radius);
    border: 1px solid transparent;
  }
  .line.current {
    background: var(--accent-soft);
  }
  .words {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 4px 10px;
  }
  .qw {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    cursor: pointer;
    border-radius: 4px;
    padding: 0 2px;
  }
  .qw:hover {
    background: var(--bg-hover);
  }
  .surface {
    font-size: 20px;
  }
  .punct {
    font-size: 20px;
    /* 标点贴着前一个词（抵掉词与词之间的间距） */
    margin-inline-start: -10px;
  }
  .g {
    font-size: 11px;
    color: var(--text-2);
    font-variant: small-caps;
    letter-spacing: 0.02em;
  }
  .from {
    padding: 2px 6px;
    opacity: 0.5;
  }
  .from:hover {
    opacity: 1;
  }
  .script {
    font-size: 22px;
    margin-top: 4px;
  }
  .ipa {
    color: var(--text-2);
    margin-top: 2px;
  }
  .pop {
    position: fixed;
    z-index: 50;
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    box-shadow: var(--shadow-lg);
  }
  .pop-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .pop-word {
    font-size: 20px;
    font-weight: 600;
  }
  .pop-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .nw-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .small {
    padding: 3px 10px;
    font-size: 13px;
  }
</style>
