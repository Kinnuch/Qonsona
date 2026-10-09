<script lang="ts">
  // 日语词典：查词（写法、假名、罗马字、变形、中英文释义）、汉字（笔顺、音训、字义）、例句、语法（N5–N1）；
  // 查询框旁边可以打开手写板，按笔画认字
  import { onMount } from 'svelte'
  import { Search, PenTool } from '@lucide/svelte'
  import { platform, type WiktDefinition } from '$lib/platform'
  import { t, i18n } from '$lib/i18n/index.svelte'
  import { dictState, type DictTab } from './state.svelte'
  import { posLabels, tagLabel } from './jaTags'
  import { REASONS } from '$shared/ja/deinflect'
  import { hasKanji } from '$shared/ja/kana'
  import type { EntryView, ExampleView, KanjiView, SearchResult } from '$shared/dict'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import StrokeOrder from '$lib/ui/StrokeOrder.svelte'
  import AddToNotebook from '$lib/notebook/AddToNotebook.svelte'
  import { jaFromEntry, jaKey } from '$lib/notebook/cards'
  import JaGrammarDict from './JaGrammarDict.svelte'
  import HandwritingPad from './HandwritingPad.svelte'

  const PACK = 'ja'
  const memo = dictState.of(PACK)
  const TABS: DictTab[] = ['words', 'characters', 'sentences', 'grammar']

  let available = $state<boolean | null>(null)
  let tags = $state<Record<string, string>>({})
  let result = $state<SearchResult | null>(null)
  let entry = $state<EntryView | null>(null)
  let kanji = $state<KanjiView | null>(null)
  let examples = $state<ExampleView[]>([])
  /** 维基词典的释义（日日词典、中文版）：没有数据文件时是空的 */
  let wikt = $state<WiktDefinition[]>([])
  let input = $state<HTMLInputElement | null>(null)
  /** 手写板开着 */
  let writing = $state(false)

  const recognize = async (strokes: [number, number][][]): Promise<string[]> =>
    (await platform.ja.handwriting(strokes, 24).catch(() => [])).map((c) => c.ch)

  /** 手写认出的字接到查询框里（字的页签上直接看这个字） */
  function pickWritten(ch: string): void {
    memo.query += ch
    if (memo.tab === 'characters') memo.char = ch
    else if (memo.tab !== 'words') memo.tab = 'words'
  }

  onMount(async () => {
    available = await platform.ja.available()
    if (available) tags = await platform.ja.tags()
    input?.focus()
  })

  // 查词：输入停下 150 毫秒再查
  let timer: ReturnType<typeof setTimeout> | undefined
  $effect(() => {
    const q = memo.query
    const tab = memo.tab
    if (!available) return
    clearTimeout(timer)
    timer = setTimeout(async () => {
      if (tab === 'words') {
        const r = await platform.ja.search(q)
        if (memo.query !== q) return
        result = r
        const ids = r?.hits.map((h) => String(h.id)) ?? []
        if (!memo.selected || !ids.includes(memo.selected)) memo.selected = ids[0] ?? null
      } else if (tab === 'sentences') {
        examples = q.trim() ? await platform.ja.examples(q) : []
      } else if (tab === 'characters') {
        const chars = queryChars()
        if (!memo.char || !chars.includes(memo.char)) memo.char = chars[0] ?? null
      }
    }, 150)
  })

  $effect(() => {
    const id = memo.selected
    if (!available || !id) {
      entry = null
      wikt = []
      return
    }
    platform.ja.entry(Number(id)).then((e) => {
      if (memo.selected === id) entry = e
    })
    platform.ja
      .wikt(Number(id))
      .catch(() => [])
      .then((w) => {
        if (memo.selected === id) wikt = w
      })
  })
  const WIKT_SOURCES = ['ja', 'zh'] as const
  /** 维基词典原页（署名、看全文用） */
  const wiktPage = (src: 'ja' | 'zh', word: string): string =>
    `https://${src}.wiktionary.org/wiki/${encodeURIComponent(word)}`

  $effect(() => {
    const ch = memo.char
    if (!available || !ch) {
      kanji = null
      return
    }
    platform.ja.kanji(ch).then((k) => {
      if (memo.char === ch) kanji = k
    })
  })

  /** 「字」页签能看的字：查询里的汉字，没有就是选中词条词头里的汉字 */
  function queryChars(): string[] {
    const from = [...memo.query].filter((c) => hasKanji(c))
    const fallback = entry ? [...entry.head].filter((c) => hasKanji(c)) : []
    return [...new Set(from.length ? from : fallback)]
  }
  const chars = $derived.by(() => {
    void memo.query
    void entry
    return queryChars()
  })

  const hit = $derived(result?.hits.find((h) => String(h.id) === memo.selected) ?? null)
  const reasonText = (reasons: string[]): string =>
    reasons.map((r) => REASONS[r]?.[i18n.locale === 'zh' ? 'zh' : 'en'] ?? r).join(' → ')

  function lookup(text: string): void {
    memo.query = text
    memo.tab = 'words'
    dictState.remember(PACK, text)
  }

  function openChar(ch: string): void {
    memo.char = ch
    memo.tab = 'characters'
  }

  /** 例句里把查的词标出来 */
  function mark(sentence: string, words: string[]): { text: string; hit: boolean }[] {
    const w = words.filter(Boolean).sort((a, b) => b.length - a.length)
    for (const x of w) {
      const i = sentence.indexOf(x)
      if (i >= 0)
        return [
          { text: sentence.slice(0, i), hit: false },
          { text: x, hit: true },
          { text: sentence.slice(i + x.length), hit: false }
        ]
    }
    return [{ text: sentence, hit: false }]
  }
  const L = $derived(i18n.locale)
</script>

{#snippet exampleView(ex: ExampleView, words: string[])}
  <li class="example" data-example={ex.id}>
    <div class="ja-line">
      <span lang="ja" class="ja">
        {#each mark(ex.ja, words) as part, i (i)}
          {#if part.hit}<mark>{part.text}</mark>{:else}{part.text}{/if}
        {/each}
      </span>
      <Pronounce item={{ text: ex.ja, lang: 'ja-JP' }} />
    </div>
    {#if ex.zh}
      <div class="tr">
        {ex.zh}
        {#if ex.zhMachine}<span class="chip tiny">{t('dict.machine')}</span>{/if}
      </div>
    {/if}
    {#if ex.en && (L === 'en' || !ex.zh)}<div class="tr en">{ex.en}</div>{/if}
  </li>
{/snippet}

<div class="dict">
  <header class="bar">
    <label class="search">
      <Search size={16} />
      <input
        bind:this={input}
        data-dict-input
        type="search"
        placeholder={t('dict.placeholder')}
        value={memo.query}
        oninput={(e) => (memo.query = e.currentTarget.value)}
        onkeydown={(e) => e.key === 'Enter' && dictState.remember(PACK, memo.query)}
      />
      <button
        class="pen"
        class:on={writing}
        type="button"
        title={t('dict.handwriting.open')}
        aria-pressed={writing}
        data-handwriting-toggle
        onclick={() => (writing = !writing)}><PenTool size={16} /></button
      >
    </label>
    <div class="seg" role="tablist">
      {#each TABS as tab (tab)}
        <button
          role="tab"
          aria-selected={memo.tab === tab}
          class:on={memo.tab === tab}
          data-dict-tab={tab}
          onclick={() => (memo.tab = tab)}
        >
          {tab === 'characters' ? t('kinds.characters.kanji') : t('dict.tabs.' + tab)}
        </button>
      {/each}
    </div>
  </header>

  {#if writing && available}
    <HandwritingPad
      {recognize}
      onpick={pickWritten}
      onclose={() => (writing = false)}
      onopen={() => void platform.ja.handwritingLoad().catch(() => false)}
    />
  {/if}

  {#if available === false}
    <p class="card note">{t('dict.noData')}</p>
  {:else if memo.tab === 'words'}
    <div class="panes">
      <ul class="list" data-hit-list>
        {#if result?.kana}
          <li class="hint">{t('dict.kanaHint', { kana: result.kana })}</li>
        {/if}
        {#each result?.hits ?? [] as h (h.id)}
          <li>
            <button
              class="hit"
              class:on={String(h.id) === memo.selected}
              data-hit={h.id}
              onclick={() => (memo.selected = String(h.id))}
            >
              <span class="row">
                <strong lang="ja">{h.head}</strong>
                {#if h.reading !== h.head}<span class="muted" lang="ja">{h.reading}</span>{/if}
                {#if h.jlpt}<span class="chip level">N{h.jlpt}</span>{/if}
                {#if h.common}<span class="dot" title={t('dict.common')}></span>{/if}
              </span>
              <span class="gloss">{(L === 'zh' && h.zh) || h.en}</span>
            </button>
          </li>
        {:else}
          {#if memo.query.trim() && result}
            <li class="hint">{t('dict.noResult', { q: memo.query.trim() })}</li>
          {:else if !memo.query.trim()}
            {#if memo.history.length}
              <li class="hint">{t('dict.history')}</li>
              {#each memo.history as q (q)}
                <li><button class="hit" onclick={() => lookup(q)}>{q}</button></li>
              {/each}
            {:else}
              <li class="hint">{t('dict.empty')}</li>
            {/if}
          {/if}
        {/each}
      </ul>

      <article class="detail" data-entry={entry?.id}>
        {#if result?.contrast && memo.query.trim() === result.contrast.cn}
          <section class="card contrast" data-contrast>
            <h3>{t('dict.contrast')}</h3>
            <p>{result.contrast.summary}</p>
            <ul>
              {#each result.contrast.items as it (it.entryId)}
                <li>
                  <button
                    class="link"
                    lang="ja"
                    onclick={() => (memo.selected = String(it.entryId))}
                  >
                    {it.ja}（{it.reading}）
                  </button>
                  <span class="muted">{it.note}</span>
                </li>
              {/each}
            </ul>
          </section>
        {/if}
        {#if entry}
          <header class="head">
            <ruby lang="ja" class="headword"
              >{entry.head}{#if entry.reading !== entry.head}<rt>{entry.reading}</rt>{/if}</ruby
            >
            <Pronounce item={{ key: `entry-${entry.id}`, text: entry.reading, lang: 'ja-JP' }} />
            {#if entry.jlpt}<span class="chip on">JLPT N{entry.jlpt}</span>{/if}
            {#if entry.common}<span class="chip">{t('dict.common')}</span>{/if}
            <span class="head-grow"></span>
            <AddToNotebook key={jaKey(entry.id)} make={() => jaFromEntry(entry!)} />
          </header>
          {#if hit?.match === 'deinflected' && hit.inflected && hit.reasons}
            <p class="note-line" data-deinflected>
              {t('dict.inflected', {
                form: hit.inflected,
                base: entry.head,
                reasons: reasonText(hit.reasons)
              })}
            </p>
          {/if}

          <ol class="senses">
            {#each entry.senses as s, i (i)}
              <li class="sense">
                <div class="tags">
                  {#each posLabels(s.pos, L, tags) as p (p)}<span class="chip pos">{p}</span>{/each}
                  {#each [...s.misc, ...s.field, ...s.dialect] as m (m)}
                    <span class="chip">{tagLabel(m, L, tags)}</span>
                  {/each}
                  {#if s.only.length}<span class="faint">{t('dict.only')}{s.only.join('、')}</span
                    >{/if}
                </div>
                {#if s.zh && L === 'zh'}<p class="zh">{s.zh}</p>{/if}
                <p class="en" class:secondary={!!s.zh && L === 'zh'}>{s.en.join('; ')}</p>
                {#if s.info.length}<p class="faint">{s.info.join('；')}</p>{/if}
                {#if s.xref.length || s.antonym.length}
                  <p class="refs">
                    {#each s.xref as x (x)}
                      <span class="faint">{t('dict.seeAlso')}</span>
                      <button class="link" lang="ja" onclick={() => lookup(x.split('・')[0])}
                        >{x}</button
                      >
                    {/each}
                    {#each s.antonym as x (x)}
                      <span class="faint">{t('dict.antonym')}</span>
                      <button class="link" lang="ja" onclick={() => lookup(x.split('・')[0])}
                        >{x}</button
                      >
                    {/each}
                  </p>
                {/if}
                {#if s.examples.length}
                  <ul class="examples">
                    {#each s.examples.slice(0, 3) as ex (ex.id)}
                      {@render exampleView(
                        ex,
                        [...entry.kanji, ...entry.kana].map((f) => f.text)
                      )}
                    {/each}
                  </ul>
                {/if}
              </li>
            {/each}
          </ol>

          {@const others = [...entry.kanji, ...entry.kana].filter(
            (f) =>
              f.text !== entry!.head &&
              f.text !== entry!.reading &&
              // 只用于检索的写法（JMdict 标 sK / sk）不显示
              !f.tags.includes('sK') &&
              !f.tags.includes('sk')
          )}
          {#if others.length}
            <section class="block">
              <h3>{t('dict.otherForms')}</h3>
              <p lang="ja">
                {others
                  .map(
                    (f) =>
                      f.text +
                      (f.tags.length
                        ? `（${f.tags.map((x) => tagLabel(x, L, tags)).join('、')}）`
                        : '')
                  )
                  .join('　')}
              </p>
            </section>
          {/if}
          {#if entry.pair}
            <section class="block">
              <h3>{t('dict.pair.' + entry.pair.role)}</h3>
              <button
                class="link"
                lang="ja"
                onclick={() => (memo.selected = String(entry!.pair!.id))}
              >
                {entry.pair.head}（{entry.pair.reading}）
              </button>
            </section>
          {/if}
          {#if entry.chars.length}
            <section class="block">
              <h3>{t('kinds.characters.kanji')}</h3>
              <div class="chars">
                {#each entry.chars as c (c.ch)}
                  <button class="char card" data-char={c.ch} onclick={() => openChar(c.ch)}>
                    <span class="big" lang="ja">{c.ch}</span>
                    <span class="muted">{c.on}</span>
                    <span class="faint">{c.zh}</span>
                  </button>
                {/each}
              </div>
            </section>
          {/if}
          {#if entry.zhSource && L === 'zh'}
            <p class="faint source">{t('dict.zhSource.' + entry.zhSource)}</p>
          {/if}
          {#each WIKT_SOURCES as src (src)}
            {@const defs = wikt.filter((d) => d.src === src)}
            {#if defs.length}
              <section class="block wikt" data-wikt={src}>
                <h3>{t(`dict.wikt.${src}`)}</h3>
                <ol class="wikt-list">
                  {#each defs as d, i (i)}
                    <li>
                      {#if d.pos}<span class="chip pos">{d.pos}</span>{/if}
                      <span lang={src === 'ja' ? 'ja' : 'zh'}>{d.text}</span>
                      {#each d.examples as ex, k (k)}<p class="faint ex" lang="ja">{ex}</p>{/each}
                    </li>
                  {/each}
                </ol>
                <p class="faint source">
                  {t('dict.wikt.source')}
                  <a href={wiktPage(src, defs[0].word)} target="_blank" rel="noopener"
                    >{t('dict.wikt.page')}</a
                  >
                </p>
              </section>
            {/if}
          {/each}
        {/if}
      </article>
    </div>
  {:else if memo.tab === 'characters'}
    <div class="panes">
      <ul class="list">
        {#each chars as ch (ch)}
          <li>
            <button
              class="hit char-hit"
              class:on={memo.char === ch}
              onclick={() => (memo.char = ch)}
            >
              <span class="big" lang="ja">{ch}</span>
            </button>
          </li>
        {:else}
          <li class="hint">{t('dict.kanjiHint')}</li>
        {/each}
      </ul>
      <article class="detail" data-kanji={kanji?.ch}>
        {#if kanji}
          <div class="kanji-top">
            {#if kanji.paths.length}
              <StrokeOrder paths={kanji.paths} />
            {:else}
              <span class="huge" lang="ja">{kanji.ch}</span>
            {/if}
            <div class="kanji-info">
              <div class="row">
                {#if kanji.strokes}<span class="chip"
                    >{t('dict.kanji.strokes', { n: kanji.strokes })}</span
                  >{/if}
                {#if kanji.jlpt}<span class="chip on">JLPT N{kanji.jlpt}</span>{/if}
                {#if kanji.grade}<span class="chip"
                    >{t('dict.kanji.grade', { n: kanji.grade })}</span
                  >{/if}
                {#if kanji.freq}<span class="chip">{t('dict.kanji.freq', { n: kanji.freq })}</span
                  >{/if}
                {#if kanji.radical}<span class="chip"
                    >{t('dict.kanji.radical', { n: kanji.radical })}</span
                  >{/if}
              </div>
              {#if kanji.on.length}<p>
                  <span class="label">{t('dict.kanji.on')}</span><span lang="ja"
                    >{kanji.on.join('、')}</span
                  >
                </p>{/if}
              {#if kanji.kun.length}<p>
                  <span class="label">{t('dict.kanji.kun')}</span><span lang="ja"
                    >{kanji.kun.join('、')}</span
                  >
                </p>{/if}
              {#if kanji.nanori.length}<p>
                  <span class="label">{t('dict.kanji.nanori')}</span><span lang="ja"
                    >{kanji.nanori.join('、')}</span
                  >
                </p>{/if}
              {#if kanji.zh.length && L === 'zh'}<p>
                  <span class="label">{t('dict.kanji.meaning')}</span>{kanji.zh.join('；')}
                </p>{/if}
              {#if kanji.en.length}<p class:faint={L === 'zh' && kanji.zh.length}>
                  <span class="label"
                    >{L === 'zh' && kanji.zh.length ? 'English' : t('dict.kanji.meaning')}</span
                  >{kanji.en.join('; ')}
                </p>{/if}
              {#if kanji.pinyin.length}<p>
                  <span class="label">{t('dict.kanji.pinyin')}</span>{kanji.pinyin.join('、')}
                </p>{/if}
            </div>
          </div>
          {#if kanji.words.length}
            <section class="block">
              <h3>{t('dict.kanji.words')}</h3>
              <ul class="words">
                {#each kanji.words as w (w.id)}
                  <li>
                    <button
                      class="link"
                      lang="ja"
                      onclick={() => {
                        memo.tab = 'words'
                        memo.query = w.head
                        memo.selected = String(w.id)
                      }}
                    >
                      {w.head}
                    </button>
                    <span class="muted" lang="ja">{w.reading}</span>
                    {#if w.jlpt}<span class="chip level">N{w.jlpt}</span>{/if}
                    <span class="faint">{(L === 'zh' && w.zh) || w.en}</span>
                  </li>
                {/each}
              </ul>
            </section>
          {/if}
        {/if}
      </article>
    </div>
  {:else if memo.tab === 'grammar'}
    <JaGrammarDict {memo} />
  {:else}
    <ul class="sentences">
      {#each examples as ex (ex.id)}
        {@render exampleView(ex, [memo.query.trim()])}
      {:else}
        <li class="hint">
          {memo.query.trim()
            ? t('dict.noResult', { q: memo.query.trim() })
            : t('dict.sentenceHint')}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .dict {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    padding: 20px 24px;
    min-height: 0;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .search {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--bg-elev);
  }
  .search:focus-within {
    border-color: var(--accent);
    box-shadow: var(--ring);
  }
  .wikt-list {
    margin: 0;
    padding-inline-start: 22px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .wikt-list .ex {
    margin-top: 2px;
  }
  .pen {
    display: inline-flex;
    padding: 4px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-2);
    cursor: pointer;
  }
  .pen:hover,
  .pen.on {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .search input {
    flex: 1;
    border: none;
    background: none;
    padding: 2px 0;
    font-size: 16px;
    outline: none;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .seg button {
    padding: 6px 14px;
    border: none;
    background: var(--bg-elev);
    cursor: pointer;
  }
  .seg button + button {
    border-inline-start: 1px solid var(--border-strong);
  }
  .seg button.on {
    background: var(--accent);
    color: var(--accent-contrast);
  }
  .panes {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(240px, 320px) 1fr;
    gap: 16px;
  }
  .list,
  .sentences {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    min-height: 0;
  }
  .hit {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    text-align: start;
    cursor: pointer;
  }
  .hit:hover {
    background: var(--bg-hover);
  }
  .hit.on {
    background: var(--accent-soft);
  }
  .row {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
  }
  .gloss {
    color: var(--text-2);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    align-self: center;
  }
  .chip.level {
    font-size: 11px;
    padding: 0 6px;
  }
  .chip.tiny {
    font-size: 11px;
    padding: 0 6px;
    margin-inline-start: 4px;
  }
  .hint {
    padding: 8px 10px;
    color: var(--text-3);
    font-size: 13px;
  }
  .detail {
    overflow-y: auto;
    min-height: 0;
    padding: 4px 8px 32px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  .head-grow {
    flex: 1;
  }
  .headword {
    font-size: 32px;
    font-weight: 600;
    ruby-position: over;
  }
  .headword rt {
    font-size: 14px;
    font-weight: 400;
    color: var(--text-2);
  }
  .note-line {
    color: var(--accent-text);
    font-size: 13px;
  }
  .senses {
    margin: 0;
    padding-inline-start: 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .sense::marker {
    color: var(--text-3);
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 4px;
  }
  .chip.pos {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .zh {
    font-size: 16px;
  }
  .en.secondary {
    color: var(--text-2);
    font-size: 13px;
  }
  .refs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: baseline;
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--accent-text);
    cursor: pointer;
    font: inherit;
  }
  .link:hover {
    text-decoration: underline;
  }
  .examples,
  .words {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .example {
    padding: 6px 10px;
    border-inline-start: 2px solid var(--border);
  }
  .sentences .example {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }
  .ja-line {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .ja {
    font-size: 15px;
  }
  mark {
    background: var(--accent-soft);
    color: var(--accent-text);
    border-radius: 3px;
  }
  .tr {
    color: var(--text-2);
    font-size: 13px;
  }
  .tr.en {
    color: var(--text-3);
  }
  .block h3 {
    margin-bottom: 6px;
  }
  .chars {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .char {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 14px;
    cursor: pointer;
    min-width: 72px;
  }
  .char:hover {
    border-color: var(--accent);
  }
  .big {
    font-size: 28px;
    line-height: 1.2;
  }
  .char-hit {
    align-items: center;
  }
  .huge {
    font-size: 120px;
    line-height: 1;
  }
  .kanji-top {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .kanji-info {
    flex: 1;
    min-width: 240px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .label {
    display: inline-block;
    min-width: 48px;
    margin-inline-end: 8px;
    color: var(--text-3);
    font-size: 12px;
  }
  .contrast {
    border-color: var(--accent);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .contrast ul {
    margin: 0;
    padding-inline-start: 18px;
  }
  .note {
    background: var(--bg-sunken);
    color: var(--text-2);
  }
  .source {
    margin-top: 8px;
  }
</style>
