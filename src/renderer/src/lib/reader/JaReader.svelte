<script lang="ts">
  // 日语阅读器：振假名 / 罗马音 / 不注音，按 JLPT 等级画下划线，点词查词，逐句朗读并高亮，右边是本文词汇与语法；
  // 双语对照（自己贴的译文，按段落对应），本文练习（用本文的词、语法、句子出题）
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
  import { reading, type RubyMode, type SideTab } from '$lib/state/reading.svelte'
  import { audio } from '$lib/state/audio.svelte'
  import { t, i18n } from '$lib/i18n/index.svelte'
  import { furigana, type JaWord } from '$shared/ja/reader'
  import { kanaToRomaji } from '$shared/ja/kana'
  import { GRAMMAR_BY_ID, type GrammarPoint } from '$shared/ja/grammar'
  import { CONTENT_POS, alignParagraphs } from '$shared/articles'
  import { jaFromListItem } from '$lib/notebook/cards'
  import JaWordCard from './JaWordCard.svelte'
  import { topicLabel } from './topics'
  import { notebook } from '$lib/state/notebook.svelte'
  import { practice } from '$lib/state/practice.svelte'
  import { dictState } from '$lib/dict/state.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { platform } from '$lib/platform'
  import ReaderCompletion from './ReaderCompletion.svelte'
  import { activity } from '$lib/state/activity.svelte'

  const RUBY: RubyMode[] = ['furigana', 'romaji', 'none']
  const SIDE: SideTab[] = ['vocab', 'grammar']
  /** 助词的读法跟写法不一样 */
  const PARTICLE_ROMAJI: Record<string, string> = { は: 'wa', へ: 'e', を: 'o' }

  const article = $derived(reading.article)
  const analysis = $derived(reading.analysis)

  /** 按段落排好的句子 */
  const paragraphs = $derived.by(() => {
    const out: number[][] = []
    analysis?.sentences.forEach((s, i) => {
      ;(out[s.para] ??= []).push(i)
    })
    return out.filter(Boolean)
  })

  // ── 双语对照：译文按段落对应原文；还没有译文时点「双语对照」先贴译文 ──
  const tr = $derived(
    article?.translation ? alignParagraphs(paragraphs.length, article.translation) : null
  )
  /** 正在编辑译文的文章 */
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
    else reading.bilingual = !reading.bilingual
  }

  /** 本文练习：在练习页上做，做完可以回到这篇 */
  async function startPractice(): Promise<void> {
    if (!article) return
    if (speaking) stopReading()
    if (await practice.startArticle(article.id, article.title, { from: reading.backTo }))
      ui.go('practice')
  }
  async function markArticleRead(): Promise<void> {
    const id = article?.id
    if (!id) return
    try {
      await reading.setRead(id, true)
    } catch {
      ui.toast(
        i18n.locale === 'zh'
          ? '保存阅读完成状态失败，请重试'
          : 'Could not save reading completion; please retry',
        'error'
      )
      return
    }
    activity.complete('reading', id, 'ja')
  }

  async function saveTranslation(text: string): Promise<void> {
    if (!article) return
    await reading.setTranslation(article.id, text)
    editingFor = null
  }

  const romaji = (w: JaWord): string =>
    (w.pos === '助詞' && PARTICLE_ROMAJI[w.surface]) || (w.reading ? kanaToRomaji(w.reading) : '')
  const underlined = (w: JaWord): boolean => reading.underline && !!w.jlpt && CONTENT_POS.has(w.pos)

  // ── 本文词汇：同一个词条只列一次；N1 在前、N5 在后，不在 JLPT 词表里的放最后，同级按出现次数 ──
  interface VocabItem {
    key: string
    w: JaWord
    count: number
    at: string
  }
  const vocab = $derived.by(() => {
    const map = new Map<string, VocabItem>()
    analysis?.sentences.forEach((s, si) =>
      s.words.forEach((w, wi) => {
        if (!w.word || !w.entryId || !CONTENT_POS.has(w.pos)) return
        const key = String(w.entryId)
        const hit = map.get(key)
        if (hit) hit.count++
        else map.set(key, { key, w, count: 1, at: `${si}-${wi}` })
      })
    )
    const rank = (v: VocabItem): number => v.w.jlpt ?? 9
    return [...map.values()].sort((a, b) => rank(a) - rank(b) || b.count - a.count)
  })

  // ── 本文语法：同一条只列一次，难的在前；ます、です 这类基础的收在最后 ──
  interface GrammarItem {
    g: GrammarPoint
    count: number
  }
  const grammar = $derived.by(() => {
    const map = new Map<string, GrammarItem>()
    for (const h of analysis?.grammar ?? []) {
      const g = GRAMMAR_BY_ID.get(h.id)
      if (!g) continue
      const hit = map.get(h.id)
      if (hit) hit.count++
      else map.set(h.id, { g, count: 1 })
    }
    return [...map.values()].sort((a, b) => a.g.level - b.g.level)
  })
  const mainGrammar = $derived(grammar.filter((x) => !x.g.basic))
  const basicGrammar = $derived(grammar.filter((x) => x.g.basic))
  let showBasic = $state(false)

  /** 点中的语法点在原文里的范围 */
  const focusRanges = $derived(
    reading.grammarFocus
      ? (analysis?.grammar ?? []).filter((h) => h.id === reading.grammarFocus)
      : []
  )
  const inFocus = (w: JaWord): boolean =>
    focusRanges.some((r) => w.start < r.end && w.end > r.start)

  // ── 点词：词卡 ──
  let pop = $state<{ w: JaWord; x: number; y: number } | null>(null)
  function openWord(w: JaWord, el: HTMLElement): void {
    const r = el.getBoundingClientRect()
    const x = Math.min(r.left, window.innerWidth - 340)
    pop = { w, x: Math.max(8, x), y: r.bottom + 6 }
  }
  function onWindowClick(e: MouseEvent): void {
    const el = e.target as HTMLElement
    if (!el.closest('.pop, .w')) pop = null
  }

  /** 词汇表里点一个词：滚到它第一次出现的地方，打开词卡 */
  async function jumpTo(at: string, w: JaWord): Promise<void> {
    const el = document.querySelector<HTMLElement>(`[data-w="${at}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    await tick()
    el.classList.remove('flash')
    void el.offsetWidth
    el.classList.add('flash')
    openWord(w, el)
  }

  /** 本文词汇一起加进生词本：一篇文章一个词本（再点只补上新的） */
  async function addVocab(): Promise<void> {
    if (!article) return
    const items = await platform.ja.wordItems(vocab.map((v) => v.w.entryId!))
    notebook.addMany(items.map(jaFromListItem), article.title, `article-${article.id}`)
  }

  /** 在词典的「语法」页签里看这个语法点的讲解 */
  function explainGrammar(id: string): void {
    if (speaking) stopReading()
    const memo = dictState.of('ja')
    memo.tab = 'grammar'
    memo.query = ''
    memo.grammarLevel = null
    memo.grammar = id
    ui.go('dictionary')
  }

  async function focusGrammar(id: string): Promise<void> {
    reading.grammarFocus = reading.grammarFocus === id ? null : id
    await tick()
    document.querySelector('.w.gfocus')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  // ── 逐句朗读 ──
  let speaking = $state(false)
  let current = $state<number | null>(null)
  let run = 0
  async function readFrom(i: number): Promise<void> {
    if (!analysis || !article) return
    const my = ++run
    speaking = true
    audio.stop()
    for (let k = i; k < analysis.sentences.length; k++) {
      if (my !== run) return
      current = k
      const s = analysis.sentences[k]
      await audio.say({ text: article.body.slice(s.start, s.end), lang: 'ja-JP' })
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
  const canSpeak = $derived(audio.voicesLoaded && !!audio.textVoice('ja-JP'))

  const levelName = (n: number | null | undefined): string => (n ? `N${n}` : '')
  /** 新闻的发布时间：月日 时:分 */
  const published = (iso: string): string =>
    new Date(iso).toLocaleString(i18n.locale === 'zh' ? 'zh-CN' : 'en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  const gloss = (w: JaWord): string => (i18n.locale === 'zh' ? w.zh || w.en : w.en || w.zh) ?? ''
</script>

<svelte:window onclick={onWindowClick} onkeydown={(e) => e.key === 'Escape' && (pop = null)} />

{#if article}
  <div class="reader" data-reader={article.id}>
    <div class="main">
      <div class="toolbar">
        <button class="btn ghost" data-back onclick={() => reading.back()}
          ><ArrowLeft size={16} />{reading.backTo === 'home'
            ? t('reading.backHome')
            : reading.backTo === 'course'
              ? t('reading.backCourse')
              : t('reading.back')}</button
        >
        <div class="grow"></div>
        <div class="seg" role="group" aria-label={t('reading.rubyMode')}>
          {#each RUBY as m (m)}
            <button class:on={reading.ruby === m} data-ruby={m} onclick={() => (reading.ruby = m)}
              >{t(`reading.ruby.${m}`)}</button
            >
          {/each}
        </div>
        <label class="check"
          ><input type="checkbox" bind:checked={reading.underline} data-underline />{t(
            'reading.underline'
          )}</label
        >
        <button
          class="btn"
          class:on={reading.bilingual && !!article.translation}
          aria-pressed={reading.bilingual && !!article.translation}
          data-bilingual
          title={article.translation ? '' : t('reading.translation.none')}
          onclick={toggleBilingual}><Languages size={14} />{t('reading.bilingual')}</button
        >
        <div class="seg" role="group" aria-label={t('reading.fontSize')}>
          <button
            title={t('reading.smaller')}
            onclick={() => (reading.fontSize = Math.max(14, reading.fontSize - 2))}
            ><Minus size={14} /></button
          >
          <button
            title={t('reading.larger')}
            onclick={() => (reading.fontSize = Math.min(34, reading.fontSize + 2))}
            ><Plus size={14} /></button
          >
        </div>
        {#if speaking}
          <button class="btn" data-stop-reading onclick={stopReading}
            ><Square size={14} />{t('reading.stop')}</button
          >
        {:else}
          <button
            class="btn primary"
            data-read-aloud
            disabled={!analysis || !canSpeak}
            title={canSpeak ? '' : t('reading.noJaVoice')}
            onclick={() => readFrom(0)}><Play size={14} />{t('reading.readAloud')}</button
          >
        {/if}
      </div>

      <article class="text" style:font-size="{reading.fontSize}px" lang="ja">
        <header class="art-head">
          <h1>{article.title}</h1>
          <p class="faint">
            {[
              article.author,
              t(`reading.sources.${article.source}`),
              topicLabel(article.topic),
              article.publishedAt ? published(article.publishedAt) : ''
            ]
              .filter(Boolean)
              .join(' · ')}
            {#if article.level}· <span class="chip">{levelName(article.level)}</span>{/if}
          </p>
        </header>
        {#if editing}
          <div class="card tr-edit" data-translation-editor>
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
              {#each para as si (si)}
                {@const s = analysis.sentences[si]}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <span
                  class="sentence"
                  class:current={current === si}
                  data-s={si}
                  ondblclick={() => readFrom(si)}
                >
                  {#each s.words as w, wi (wi)}
                    {#if !w.word}<span class="punct">{w.surface}</span>{:else}<span
                        class="w"
                        class:ul={underlined(w)}
                        class:gfocus={inFocus(w)}
                        data-jlpt={underlined(w) ? w.jlpt : undefined}
                        data-w="{si}-{wi}"
                        role="button"
                        tabindex="-1"
                        onclick={(e) => openWord(w, e.currentTarget)}
                        >{#if reading.ruby === 'furigana'}{#each furigana(w.surface, w.reading) as p, k (k)}{#if p.ruby}<ruby
                                >{p.text}<rt>{p.ruby}</rt></ruby
                              >{:else}{p.text}{/if}{/each}{:else if reading.ruby === 'romaji'}<ruby
                            >{w.surface}<rt>{romaji(w)}</rt></ruby
                          >{:else}{w.surface}{/if}</span
                      >{/if}
                  {/each}
                </span>
              {/each}
            </p>
            {#if reading.bilingual && tr?.at[pi]}
              <p class="tr" data-tr={pi}>{tr.at[pi]}</p>
            {/if}
          {/each}
          {#if reading.bilingual && tr?.rest.length}
            {#each tr.rest as line, k (k)}<p class="tr" data-tr-rest={k}>{line}</p>{/each}
          {/if}
        {/if}
        {#if article.excerpt}
          <p class="excerpt" data-excerpt-note>
            {t('reading.excerptNote')}
            {#if article.url}<a href={article.url} target="_blank" rel="noopener"
                >{t('reading.original')}</a
              >{/if}
          </p>
        {/if}
        <footer class="art-foot">
          {#if article.readAt}
            <button class="btn" data-mark-read onclick={() => reading.setRead(article.id, false)}
              ><Check size={14} />{t('reading.markUnread')}</button
            >
          {:else}
            <button class="btn primary" data-mark-read onclick={markArticleRead}
              ><Check size={14} />{t('reading.markRead')}</button
            >
          {/if}
          <button class="btn" data-article-practice onclick={startPractice}
            ><PenLine size={14} />{t('reading.practice')}</button
          >
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
          {#if article.colophon}
            <details class="faint colophon">
              <summary>{t('reading.colophon')}</summary>
              <pre>{article.colophon}</pre>
            </details>
          {/if}
        </footer>
        {#key article.id}<ReaderCompletion
            packId="ja"
            material={{
              id: article.id,
              body: article.body,
              translation: article.translation,
              excerpt: article.excerpt,
              lang: 'ja'
            }}
            markRead={() => reading.setRead(article.id, true)}
            loadVocabulary={() => platform.ja.articlePractice(article.id, 1729, false)}
          />{/key}
      </article>
    </div>

    <aside class="side">
      <div class="seg tabs" role="tablist">
        {#each SIDE as s (s)}
          <button
            class:on={reading.side === s}
            role="tab"
            aria-selected={reading.side === s}
            data-side={s}
            onclick={() => (reading.side = s)}
            >{t(`reading.side.${s}`)}<b>{s === 'vocab' ? vocab.length : mainGrammar.length}</b
            ></button
          >
        {/each}
      </div>
      {#if reading.underline}
        <div class="legend">
          {#each [5, 4, 3, 2, 1] as n (n)}<span class="lg" data-jlpt={n}>N{n}</span>{/each}
        </div>
      {/if}
      <div class="side-list">
        {#if reading.side === 'vocab'}
          {#if vocab.length}
            <button class="btn small add-all" data-add-vocab onclick={addVocab}
              ><BookmarkPlus size={14} />{t('reading.addVocab')}</button
            >
          {/if}
          {#each vocab as v (v.key)}
            <button class="row" data-vocab={v.key} onclick={() => jumpTo(v.at, v.w)}>
              <span class="lemma" lang="ja">{v.w.base}</span>
              {#if v.w.jlpt}<span class="lv" data-jlpt={v.w.jlpt}>N{v.w.jlpt}</span>{/if}
              <span class="gloss">{gloss(v.w)}</span>
              {#if v.count > 1}<span class="faint">×{v.count}</span>{/if}
            </button>
          {:else}
            <p class="faint">{t('reading.noVocab')}</p>
          {/each}
        {:else}
          {#snippet grammarRow(x: GrammarItem)}
            <button
              class="row gram"
              class:on={reading.grammarFocus === x.g.id}
              data-grammar={x.g.id}
              onclick={() => focusGrammar(x.g.id)}
            >
              <span class="lemma" lang="ja">{x.g.name}</span>
              <span class="lv" data-jlpt={x.g.level}>N{x.g.level}</span>
              <span class="gloss">{i18n.locale === 'zh' ? x.g.zh : x.g.en}</span>
              {#if x.count > 1}<span class="faint">×{x.count}</span>{/if}
              {#if reading.grammarFocus === x.g.id}
                <span class="example" lang="ja">{x.g.example}</span>
              {/if}
            </button>
            {#if reading.grammarFocus === x.g.id}
              <button
                class="btn ghost small explain"
                data-grammar-explain={x.g.id}
                onclick={() => explainGrammar(x.g.id)}>{t('reading.grammarExplain')}</button
              >
            {/if}
          {/snippet}
          {#each mainGrammar as x (x.g.id)}{@render grammarRow(x)}{:else}
            <p class="faint">{t('reading.noGrammar')}</p>
          {/each}
          {#if basicGrammar.length}
            <button class="btn ghost more" onclick={() => (showBasic = !showBasic)}
              >{t('reading.basicGrammar', { n: basicGrammar.length })}</button
            >
            {#if showBasic}{#each basicGrammar as x (x.g.id)}{@render grammarRow(x)}{/each}{/if}
          {/if}
        {/if}
      </div>
    </aside>

    {#if pop}
      <JaWordCard w={pop.w} x={pop.x} y={pop.y} />
    {/if}
  </div>
{/if}

<style>
  .reader {
    --n5: #2f9e63;
    --n4: #2b8cc4;
    --n3: #7a5cc9;
    --n2: #d08a26;
    --n1: #d64545;
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
    line-height: 2.1;
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
    /* 不能写简写 text-decoration：它会把下面按等级设的颜色重置掉 */
    text-decoration-line: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 0.35em;
  }
  [data-jlpt='5'] {
    text-decoration-color: var(--n5);
    --lv: var(--n5);
  }
  [data-jlpt='4'] {
    text-decoration-color: var(--n4);
    --lv: var(--n4);
  }
  [data-jlpt='3'] {
    text-decoration-color: var(--n3);
    --lv: var(--n3);
  }
  [data-jlpt='2'] {
    text-decoration-color: var(--n2);
    --lv: var(--n2);
  }
  [data-jlpt='1'] {
    text-decoration-color: var(--n1);
    --lv: var(--n1);
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
    /* 注音比汉字宽时别把汉字拉开 */
    ruby-align: center;
  }
  rt {
    font-size: 0.5em;
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
  .colophon {
    width: 100%;
  }
  .colophon pre {
    white-space: pre-wrap;
    font-family: inherit;
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
  .more {
    align-self: flex-start;
    margin-top: 6px;
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
