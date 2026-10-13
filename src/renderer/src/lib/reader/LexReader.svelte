<script lang="ts">
  // 框架语言的阅读器：按主分级给词画下划线，点词出词卡，注音（罗马化 / IPA）与可开关的记号
  // （俄语重音、阿拉伯语元音符号），从右往左的语言整篇 RTL；逐句朗读并高亮；右边是本文词汇与语法；
  // 双语对照（自己贴的译文，按段落对应）
  import { onDestroy, tick } from 'svelte'
  import {
    ArrowLeft,
    Play,
    Square,
    Check,
    Minus,
    Plus,
    BookmarkPlus,
    Languages,
    PenLine
  } from '@lucide/svelte'
  import { langReading, type LangSideTab } from '$lib/state/langReading.svelte'
  import { practice } from '$lib/state/practice.svelte'
  import { audio } from '$lib/state/audio.svelte'
  import { notebook } from '$lib/state/notebook.svelte'
  import { dictState } from '$lib/dict/state.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { t, i18n, pick } from '$lib/i18n/index.svelte'
  import { platform } from '$lib/platform'
  import { lexFromItem } from '$lib/notebook/cards'
  import { LANGS } from '$shared/lang/registry'
  import { primarySystem } from '$shared/lang/levels'
  import { alignParagraphs } from '$shared/articles'
  import type { LangCode, LexGrammarPoint, LexToken } from '$shared/lang/types'
  import LexWordCard from './LexWordCard.svelte'
  import ReaderCompletion from './ReaderCompletion.svelte'
  import { activity } from '$lib/state/activity.svelte'

  let { code }: { code: string } = $props()

  const mod = $derived(LANGS[code as LangCode])
  const spec = $derived(mod.spec)
  const levelOrder = $derived(primarySystem(spec.levelSystems).levels)
  const SIDE: LangSideTab[] = ['vocab', 'grammar']

  const article = $derived(langReading.article)
  const analysis = $derived(langReading.analysis)
  const L = $derived(i18n.locale)
  async function markArticleRead(): Promise<void> {
    const id = article?.id,
      ownerCode = code
    if (!id) return
    try {
      await langReading.setRead(id, true)
    } catch {
      ui.toast(
        L === 'zh'
          ? '保存阅读完成状态失败，请重试'
          : 'Could not save reading completion; please retry',
        'error'
      )
      return
    }
    activity.complete('reading', id, ownerCode)
  }

  /** 按段落排好的句子 */
  const paragraphs = $derived.by(() => {
    const out: number[][] = []
    analysis?.sentences.forEach((s, i) => {
      ;(out[s.para] ??= []).push(i)
    })
    return out.filter(Boolean)
  })

  /** 等级在主分级里排第几（0 最容易），下划线按它上色 */
  const levelIndex = (lv: string | null | undefined): number =>
    lv ? levelOrder.findIndex((l) => l.id === lv) : -1
  const levelShort = (lv: string | null | undefined): string =>
    levelOrder.find((l) => l.id === lv)?.short ?? lv ?? ''
  /** 不画下划线的：专名、数词、符号 */
  const underlined = (w: LexToken): boolean =>
    langReading.underline && !!w.lv && w.pos !== 'propn' && w.pos !== 'num'

  /** 正文显示：关掉的记号去掉 */
  const display = (s: string): string => {
    let out = s
    for (const m of mod.rules.marks ?? []) if (langReading.hiddenMarks[m.id]) out = m.strip(out)
    return out
  }

  // ── 双语对照 ──
  const tr = $derived(
    article?.translation ? alignParagraphs(paragraphs.length, article.translation) : null
  )
  let editingFor = $state<string | null>(null)
  let trDraft = $state('')
  const editing = $derived(!!article && editingFor === article.id)
  function editTranslation(): void {
    if (!article) return
    trDraft = article.translation ?? ''
    editingFor = article.id
  }
  function toggleBilingual(): void {
    if (!article?.translation) editTranslation()
    else langReading.bilingual = !langReading.bilingual
  }
  async function saveTranslation(text: string): Promise<void> {
    if (!article) return
    await langReading.setTranslation(article.id, text)
    editingFor = null
  }

  // ── 本文词汇：同一个词条只列一次，难的在前，同级按出现次数 ──
  interface VocabItem {
    entry: number
    w: LexToken
    count: number
    at: string
  }
  const vocab = $derived.by(() => {
    const map = new Map<number, VocabItem>()
    analysis?.sentences.forEach((s, si) =>
      s.tokens.forEach((w, wi) => {
        if (w.kind !== 'word' || !w.entry || w.pos === 'propn' || w.pos === 'num') return
        const hit = map.get(w.entry)
        if (hit) hit.count++
        else map.set(w.entry, { entry: w.entry, w, count: 1, at: `${si}-${wi}` })
      })
    )
    return [...map.values()].sort(
      (a, b) => levelIndex(b.w.lv) - levelIndex(a.w.lv) || b.count - a.count
    )
  })

  // ── 本文语法 ──
  const points = $derived(new Map((mod.grammar ?? []).map((g) => [g.id, g])))
  const grammar = $derived.by(() => {
    const map = new Map<string, { g: LexGrammarPoint; count: number }>()
    for (const h of analysis?.grammar ?? []) {
      const g = points.get(h.id)
      if (!g) continue
      const hit = map.get(h.id)
      if (hit) hit.count++
      else map.set(h.id, { g, count: 1 })
    }
    return [...map.values()].sort((a, b) => levelIndex(b.g.level) - levelIndex(a.g.level))
  })
  const focusRanges = $derived(
    langReading.grammarFocus
      ? (analysis?.grammar ?? []).filter((h) => h.id === langReading.grammarFocus)
      : []
  )
  const inFocus = (w: LexToken): boolean =>
    focusRanges.some((r) => w.start < r.end && w.end > r.start)
  async function focusGrammar(id: string): Promise<void> {
    langReading.grammarFocus = langReading.grammarFocus === id ? null : id
    await tick()
    document.querySelector('.w.gfocus')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  // ── 点词：词卡 ──
  let pop = $state<{ w: LexToken; x: number; y: number } | null>(null)
  function openWord(w: LexToken, el: HTMLElement): void {
    const r = el.getBoundingClientRect()
    const x = Math.min(r.left, window.innerWidth - 340)
    pop = { w, x: Math.max(8, x), y: r.bottom + 6 }
  }
  function onWindowClick(e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest('.pop, .w')) pop = null
  }
  async function jumpTo(at: string, w: LexToken): Promise<void> {
    const el = document.querySelector<HTMLElement>(`[data-w="${at}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    await tick()
    el.classList.remove('flash')
    void el.offsetWidth
    el.classList.add('flash')
    openWord(w, el)
  }

  /** 本文词汇一起加进生词本：一篇文章一个词本 */
  async function addVocab(): Promise<void> {
    if (!article) return
    const items = await platform.lang.items(
      code,
      vocab.map((v) => v.entry)
    )
    notebook.addMany(items.map(lexFromItem), article.title, `article-${article.id}`)
  }

  // ── 逐句朗读（这门语言有系统语音时） ──
  const voice = $derived(spec.features.speech)
  const canSpeak = $derived(!!voice && audio.voicesLoaded && !!audio.textVoice(voice))
  let speaking = $state(false)
  let current = $state<number | null>(null)
  let run = 0
  async function readFrom(i: number): Promise<void> {
    if (!analysis || !article || !voice || !canSpeak) return
    const my = ++run
    speaking = true
    audio.stop()
    for (let k = i; k < analysis.sentences.length; k++) {
      if (my !== run) return
      current = k
      const s = analysis.sentences[k]
      await audio.say({ text: article.body.slice(s.start, s.end), lang: voice })
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

  function explainGrammar(id: string): void {
    const memo = dictState.of(code)
    memo.tab = 'grammar'
    memo.query = ''
    memo.grammar = id
    if (speaking) stopReading()
    ui.go('dictionary')
  }
  const gloss = (w: LexToken): string => (L === 'zh' ? w.zh || w.en : w.en || w.zh) ?? ''
  const published = (iso: string): string =>
    new Date(iso).toLocaleString(L === 'zh' ? 'zh-CN' : 'en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  const topicName = (tp: string): string => {
    const k = `langReading.topics.${tp}`
    const s = t(k)
    return s === k ? tp : s
  }
</script>

<svelte:window onclick={onWindowClick} onkeydown={(e) => e.key === 'Escape' && (pop = null)} />

{#if article}
  <div class="reader" data-lex-reader={article.id}>
    <div class="main">
      <div class="toolbar">
        <button class="btn ghost" data-back onclick={() => langReading.back()}
          ><ArrowLeft size={16} />{langReading.backTo === 'home'
            ? t('reading.backHome')
            : langReading.backTo === 'course'
              ? t('reading.backCourse')
              : t('reading.back')}</button
        >
        <div class="grow"></div>
        {#if spec.features.ruby}
          <label class="check"
            ><input type="checkbox" bind:checked={langReading.ruby} data-ruby-toggle />{t(
              `kinds.ruby.${spec.features.ruby}`
            )}</label
          >
        {/if}
        {#each mod.rules.marks ?? [] as m (m.id)}
          <label class="check"
            ><input
              type="checkbox"
              data-mark={m.id}
              checked={!langReading.hiddenMarks[m.id]}
              onchange={(e) => (langReading.hiddenMarks[m.id] = !e.currentTarget.checked)}
            />{pick(m.name)}</label
          >
        {/each}
        <label class="check"
          ><input type="checkbox" bind:checked={langReading.underline} data-underline />{t(
            'langReading.underline'
          )}</label
        >
        <button
          class="btn"
          class:on={langReading.bilingual && !!article.translation}
          data-bilingual
          title={article.translation ? '' : t('reading.translation.none')}
          onclick={toggleBilingual}><Languages size={14} />{t('reading.bilingual')}</button
        >
        <div class="seg" role="group" aria-label={t('reading.fontSize')}>
          <button
            title={t('reading.smaller')}
            onclick={() => (langReading.fontSize = Math.max(14, langReading.fontSize - 2))}
            ><Minus size={14} /></button
          >
          <button
            title={t('reading.larger')}
            onclick={() => (langReading.fontSize = Math.min(34, langReading.fontSize + 2))}
            ><Plus size={14} /></button
          >
        </div>
        <button
          class="btn"
          data-article-practice
          disabled={!analysis || practice.busy}
          onclick={async () => {
            if (
              article &&
              (await practice.startArticle(article.id, article.title, { from: langReading.backTo }))
            )
              ui.go('practice')
          }}><PenLine size={14} />{t('courses.text.practice')}</button
        >
        {#if speaking}
          <button class="btn" data-stop-reading onclick={stopReading}
            ><Square size={14} />{t('reading.stop')}</button
          >
        {:else}
          <button
            class="btn primary"
            data-read-aloud
            disabled={!analysis || !canSpeak}
            title={canSpeak ? '' : t('langReading.noVoice', { lang: pick(spec.name) })}
            onclick={() => readFrom(0)}><Play size={14} />{t('reading.readAloud')}</button
          >
        {/if}
      </div>

      <article
        class="text"
        style:font-size="{langReading.fontSize}px"
        lang={spec.bcp47}
        dir={spec.direction}
      >
        <header class="art-head" dir="auto">
          <h1>{display(article.title)}</h1>
          <p class="faint" dir="ltr">
            {[
              article.author,
              article.origin ?? t(`langReading.sources.${article.source}`),
              article.topic ? topicName(article.topic) : '',
              article.publishedAt ? published(article.publishedAt) : '',
              article.license ? t('langReading.license', { license: article.license }) : ''
            ]
              .filter(Boolean)
              .join(' · ')}
            {#if article.level}· <span class="chip">{levelShort(article.level)}</span>{/if}
          </p>
        </header>
        {#if editing}
          <div class="card tr-edit" dir="ltr" data-translation-editor>
            <strong>{t('reading.translation.title')}</strong>
            <p class="faint">{t('reading.translation.hint')}</p>
            <textarea class="input" rows="8" bind:value={trDraft} data-translation-input></textarea>
            <div class="tr-actions">
              {#if article.translation}
                <button class="btn ghost danger" onclick={() => saveTranslation('')}
                  >{t('reading.translation.remove')}</button
                >
              {/if}
              <div class="grow"></div>
              <button class="btn" onclick={() => (editingFor = null)}>{t('common.cancel')}</button>
              <button
                class="btn primary"
                disabled={!trDraft.trim()}
                data-translation-save
                onclick={() => saveTranslation(trDraft)}>{t('reading.translation.save')}</button
              >
            </div>
          </div>
        {/if}
        {#if !analysis}
          <p class="muted analyzing">{t('reading.analyzing')}</p>
        {:else}
          {#each paragraphs as para, pi (pi)}
            <p class="para">
              {#each para as si, sentenceIndex (si)}
                {@const s = analysis.sentences[si]}
                {#if sentenceIndex > 0}{display(
                    analysis.text.slice(analysis.sentences[para[sentenceIndex - 1]].end, s.start)
                  )}{/if}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <span
                  class="sentence"
                  class:current={current === si}
                  data-s={si}
                  ondblclick={() => readFrom(si)}
                >
                  {#each s.tokens as w, wi (wi)}
                    {#if w.kind !== 'word'}<span class="punct">{display(w.text)}</span>{:else}<span
                        class="w"
                        class:ul={underlined(w)}
                        class:gfocus={inFocus(w)}
                        data-lv={underlined(w) ? levelIndex(w.lv) : undefined}
                        data-w="{si}-{wi}"
                        role="button"
                        tabindex="-1"
                        onclick={(e) => openWord(w, e.currentTarget)}
                        >{#if langReading.ruby && w.ruby}<ruby
                            title={code === 'ar' && w.ruby !== w.text
                              ? L === 'zh'
                                ? '词典推定读音；不带元音的文本可能有多种读法'
                                : 'Dictionary-inferred reading; unvocalized text may have multiple readings'
                              : undefined}>{display(w.text)}<rt>{w.ruby}</rt></ruby
                          >{:else}{display(w.text)}{/if}</span
                      >{/if}
                  {/each}
                </span>
              {/each}
            </p>
            {#if langReading.bilingual && tr?.at[pi]}
              <p class="tr" dir="auto" data-tr={pi}>{tr.at[pi]}</p>
            {/if}
          {/each}
          {#if langReading.bilingual && tr?.rest.length}
            {#each tr.rest as line, k (k)}<p class="tr" dir="auto">{line}</p>{/each}
          {/if}
        {/if}
        {#if article.excerpt}
          <p class="excerpt" dir="ltr" data-excerpt-note>
            {t('langReading.excerptNote', { source: article.origin ?? '' })}
            {#if article.url}<a href={article.url} target="_blank" rel="noopener"
                >{t('reading.original')}</a
              >{/if}
          </p>
        {/if}
        <footer class="art-foot" dir="ltr">
          {#if article.readAt}
            <button
              class="btn"
              data-mark-read
              onclick={() => langReading.setRead(article.id, false)}
              ><Check size={14} />{t('reading.markUnread')}</button
            >
          {:else}
            <button class="btn primary" data-mark-read onclick={markArticleRead}
              ><Check size={14} />{t('reading.markRead')}</button
            >
          {/if}
          {#if article.translation && !editing}
            <button class="btn ghost" data-edit-translation onclick={editTranslation}
              ><Languages size={14} />{t('reading.translation.edit')}</button
            >
          {/if}
          {#if article.url && !article.excerpt}
            <a class="faint" href={article.url} target="_blank" rel="noopener"
              >{t('reading.original')}</a
            >
          {/if}
        </footer>
        {#key article.id}<ReaderCompletion
            packId={code}
            material={{
              id: article.id,
              body: article.body,
              translation: article.translation,
              excerpt: article.excerpt,
              lang: spec.bcp47
            }}
            markRead={() => langReading.setRead(article.id, true)}
            loadVocabulary={() => platform.lang.articlePractice(code, article.id, 1729, L)}
          />{/key}
      </article>
    </div>

    <aside class="side">
      <div class="seg tabs" role="tablist">
        {#each SIDE as s (s)}
          <button
            class:on={langReading.side === s}
            role="tab"
            aria-selected={langReading.side === s}
            data-side={s}
            onclick={() => (langReading.side = s)}
            >{t(`reading.side.${s}`)}<b>{s === 'vocab' ? vocab.length : grammar.length}</b></button
          >
        {/each}
      </div>
      {#if langReading.underline}
        <div class="legend">
          {#each levelOrder as l, i (l.id)}<span class="lg" data-lv={i} title={pick(l.name)}
              >{l.short}</span
            >{/each}
        </div>
      {/if}
      <div class="side-list">
        {#if langReading.side === 'vocab'}
          {#if vocab.length}
            <button class="btn small add-all" data-add-vocab onclick={addVocab}
              ><BookmarkPlus size={14} />{t('reading.addVocab')}</button
            >
          {/if}
          {#each vocab as v (v.entry)}
            <button class="row" data-vocab={v.entry} onclick={() => jumpTo(v.at, v.w)}>
              <span class="lemma" lang={spec.bcp47} dir="auto"
                >{display(v.w.lemma ?? v.w.text)}</span
              >
              {#if v.w.lv}<span class="lv" data-lv={levelIndex(v.w.lv)}>{levelShort(v.w.lv)}</span
                >{/if}
              <span class="gloss">{gloss(v.w)}</span>
              {#if v.count > 1}<span class="faint">×{v.count}</span>{/if}
            </button>
          {:else}
            <p class="faint">{t('reading.noVocab')}</p>
          {/each}
        {:else}
          {#each grammar as x (x.g.id)}
            <button
              class="row gram"
              class:on={langReading.grammarFocus === x.g.id}
              data-grammar={x.g.id}
              onclick={() => focusGrammar(x.g.id)}
            >
              <span class="lemma">{pick(x.g.name)}</span>
              <span class="lv" data-lv={levelIndex(x.g.level)}>{levelShort(x.g.level)}</span>
              <span class="gloss">{pick(x.g.meaning)}</span>
              {#if x.count > 1}<span class="faint">×{x.count}</span>{/if}
              {#if langReading.grammarFocus === x.g.id}
                <span class="example">{pick(x.g.form)}</span>
                {#if x.g.examples[0]}
                  <span class="example" lang={spec.bcp47} dir="auto">{x.g.examples[0].text}</span>
                {/if}
              {/if}
            </button>
            {#if langReading.grammarFocus === x.g.id}
              <button
                class="btn ghost small"
                data-grammar-explain={x.g.id}
                onclick={() => explainGrammar(x.g.id)}>{t('reading.grammarExplain')}</button
              >
            {/if}
          {:else}
            <p class="faint">{t('reading.noGrammar')}</p>
          {/each}
        {/if}
      </div>
    </aside>
  </div>
  {#if pop}
    <LexWordCard {code} token={pop.w} x={pop.x} y={pop.y} onclose={() => (pop = null)} />
  {/if}
{/if}

<style>
  .reader {
    --lv0: #2f9e63;
    --lv1: #2b8cc4;
    --lv2: #7a5cc9;
    --lv3: #d08a26;
    --lv4: #d64545;
    --lv5: #8f2d56;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    height: 100%;
    overflow: hidden;
  }
  .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }
  .toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elev);
  }
  .grow {
    flex: 1;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .seg button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
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
  .check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .text {
    flex: 1;
    overflow-y: auto;
    padding: 28px max(32px, calc((100% - 760px) / 2)) 60px;
    line-height: 2;
  }
  .art-head {
    margin-bottom: 18px;
    line-height: 1.4;
  }
  .art-head h1 {
    font-size: 1.3em;
  }
  .art-head p {
    font-size: 13px;
    margin-top: 4px;
  }
  .para {
    margin: 0 0 0.9em;
  }
  .tr {
    margin: -0.5em 0 1.1em;
    padding-inline-start: 12px;
    border-inline-start: 3px solid var(--border-strong);
    color: var(--text-2);
    font-size: 0.78em;
    line-height: 1.7;
  }
  .tr-edit {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 18px;
    font-size: 14px;
    line-height: 1.5;
  }
  .tr-edit .input {
    width: 100%;
    padding: 7px 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    font: inherit;
    color: inherit;
    resize: vertical;
  }
  .tr-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btn.on {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .sentence {
    border-radius: 4px;
    transition: background 0.2s;
  }
  .sentence.current {
    background: var(--accent-soft);
  }
  .w {
    cursor: pointer;
    border-radius: 3px;
  }
  .w:hover {
    background: var(--bg-hover);
  }
  .w.ul {
    text-decoration-line: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 0.3em;
  }
  [data-lv='0'] {
    text-decoration-color: var(--lv0);
    --lv: var(--lv0);
  }
  [data-lv='1'] {
    text-decoration-color: var(--lv1);
    --lv: var(--lv1);
  }
  [data-lv='2'] {
    text-decoration-color: var(--lv2);
    --lv: var(--lv2);
  }
  [data-lv='3'] {
    text-decoration-color: var(--lv3);
    --lv: var(--lv3);
  }
  [data-lv='4'] {
    text-decoration-color: var(--lv4);
    --lv: var(--lv4);
  }
  [data-lv='5'] {
    text-decoration-color: var(--lv5);
    --lv: var(--lv5);
  }
  .w.gfocus {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
  }
  :global(.w.flash) {
    animation: flash 1.2s ease-out;
  }
  @keyframes flash {
    0% {
      background: color-mix(in srgb, var(--accent) 40%, transparent);
    }
  }
  ruby {
    ruby-align: center;
  }
  rt {
    font-size: 0.48em;
    color: var(--text-2);
  }
  .excerpt {
    margin-top: 1.2em;
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    background: var(--bg-sunken);
    color: var(--text-2);
    font-size: 14px;
    line-height: 1.6;
  }
  .excerpt a {
    color: var(--accent-text);
    margin-inline-start: 6px;
  }
  .art-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-top: 28px;
    font-size: 14px;
    line-height: 1.5;
  }
  .analyzing {
    font-size: 14px;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-inline-start: 1px solid var(--border);
    background: var(--bg-elev);
    overflow: hidden;
  }
  .tabs {
    align-self: stretch;
  }
  .tabs button {
    flex: 1;
    justify-content: center;
  }
  .tabs b {
    font-weight: 500;
    color: var(--text-3);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 12px;
  }
  .lg {
    border-bottom: 2px solid var(--lv);
    line-height: 1.4;
  }
  .side-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    padding: 6px 8px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    text-align: start;
    cursor: pointer;
  }
  .row:hover,
  .row.on {
    background: var(--bg-hover);
  }
  .lemma {
    font-size: 15px;
    font-weight: 500;
  }
  .lv {
    font-size: 11px;
    padding: 0 5px;
    border-radius: 4px;
    color: #fff;
    background: var(--lv, var(--text-3));
  }
  .gloss {
    flex-basis: 100%;
    font-size: 12px;
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row.on .gloss {
    white-space: normal;
  }
  .example {
    flex-basis: 100%;
    font-size: 13px;
    color: var(--text-2);
  }
  .add-all {
    align-self: flex-start;
    margin-bottom: 4px;
  }
  .small {
    padding: 3px 10px;
    font-size: 13px;
  }
</style>
