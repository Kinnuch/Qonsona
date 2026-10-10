<script lang="ts">
  // 框架里各语言（英、法、韩、西、阿、俄、苏格兰盖尔）的词典：查词（词头、变形、去掉变音符号、猜原形、
  // 中英文释义）与例句。数据在主进程的 SQLite（src/main/lang/lexdb.ts），各语言的规则在 src/shared/lang/<代码>/
  import { onMount } from 'svelte'
  import { Search, Volume2 } from '@lucide/svelte'
  import { platform } from '$lib/platform'
  import { t, i18n, pick } from '$lib/i18n/index.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { dictState, type DictTab } from './state.svelte'
  import { LANGS } from '$shared/lang/registry'
  import type { LangCode, LexExample } from '$shared/lang/types'
  import type { LexEntryView, LexHit, LexSearchResult } from '$shared/lang/views'
  import { genderLabel, posLabel, tagLabel, tagsLabel } from '$shared/lang/tags'
  import { foldWithMap } from '$shared/lang/text'
  import { paradigm } from '$shared/lang/paradigm'
  import { primarySystem } from '$shared/lang/levels'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import AddToNotebook from '$lib/notebook/AddToNotebook.svelte'
  import { lexFromEntry, lexKey } from '$lib/notebook/cards'
  import { playRemote } from '$lib/lang/remoteAudio'
  import LexGrammarDict from './LexGrammarDict.svelte'

  let { code }: { code: string } = $props()

  const spec = $derived(LANGS[code as LangCode].spec)
  const memo = $derived(dictState.of(code))
  const TABS = $derived<DictTab[]>(
    LANGS[code as LangCode].grammar?.length
      ? ['words', 'sentences', 'grammar']
      : ['words', 'sentences']
  )
  /** 正文的书写方向与语言标记（阿拉伯语从右往左） */
  const dir = $derived(spec.direction)
  const lang = $derived(spec.bcp47)
  const speech = $derived(spec.features.speech)

  let available = $state<boolean | null>(null)
  let result = $state<LexSearchResult | null>(null)
  let entry = $state<LexEntryView | null>(null)
  let examples = $state<LexExample[]>([])
  let input = $state<HTMLInputElement | null>(null)
  /** 变形表展开了没有 */
  let formsOpen = $state(false)

  onMount(async () => {
    const [s] = await platform.lang.status([code]).catch(() => [])
    available = !!s?.available
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
        const r = await platform.lang.search(code, q)
        if (memo.query !== q) return
        result = r
        const ids = r?.hits.map((h) => String(h.id)) ?? []
        if (!memo.selected || !ids.includes(memo.selected)) memo.selected = ids[0] ?? null
      } else if (tab === 'sentences') {
        examples = q.trim() ? await platform.lang.examples(code, q) : []
      }
    }, 150)
  })

  $effect(() => {
    const id = memo.selected
    formsOpen = false
    if (!available || !id) {
      entry = null
      return
    }
    platform.lang.entry(code, Number(id)).then((e) => {
      if (memo.selected === id) entry = e
    })
  })

  const hit = $derived(result?.hits.find((h) => String(h.id) === memo.selected) ?? null)
  const L = $derived(i18n.locale)
  const shown = (x: { w: string; d?: string }): string => x.d || x.w

  function lookup(text: string): void {
    memo.query = text
    memo.tab = 'words'
    dictState.remember(code, text)
  }

  /** 这个词怎么对上的：「chats」是「chat」的复数 */
  function viaText(h: LexHit, head: string): string {
    if (h.match === 'form' || h.match === 'guess') {
      const tags = tagsLabel(h.via?.tags ?? [], L)
      return t(h.match === 'form' ? 'dict.lex.via.form' : 'dict.lex.via.guess', {
        form: h.via?.form ?? '',
        base: head,
        tags: tags || t('dict.lex.via.variant')
      })
    }
    if (h.match === 'loose') return t('dict.lex.via.loose')
    if (h.match === 'latin') {
      const tags = tagsLabel(h.via?.tags ?? [], L)
      return t(tags ? 'dict.lex.via.latinForm' : 'dict.lex.via.latin', {
        form: h.via?.form ?? '',
        base: head,
        tags
      })
    }
    if (h.match === 'gloss') return t('dict.lex.via.gloss')
    return ''
  }

  async function play(url: string): Promise<void> {
    if (!(await playRemote(url))) ui.toast(t('dict.lex.audioFail'), 'error')
  }

  /** 变形表：格 × 数、人称 × 数……排成网格；排不进去的同一组标签的几个写法并在一行 */
  const para = $derived(entry ? paradigm(entry.forms, entry.d || entry.w) : { grids: [], rest: [] })
  const formRows = $derived.by(() => {
    const rows = new Map<string, { form: string; ipa?: string }[]>()
    for (const f of para.rest) {
      const k = tagsLabel(f.tags, L) || t('dict.lex.variant')
      const list = rows.get(k) ?? []
      if (!list.some((x) => x.form === f.form)) list.push({ form: f.form, ipa: f.ipa })
      rows.set(k, list)
    }
    return [...rows.entries()]
  })

  /** 语言特有的信息：认得的键用说明，不认得的照原样 */
  const extras = $derived(
    Object.entries(entry?.x ?? {}).filter(
      ([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)
    )
  )
  const extraLabel = (k: string): string => {
    const key = `dict.lex.extra.${k}`
    const s = t(key)
    return s === key ? k : s
  }
  /** 字段的说明（悬停看）：没有的是空的 */
  const extraHelp = (k: string): string => {
    const key = `dict.lex.extraHelp.${k}`
    const s = t(key)
    return s === key ? '' : s
  }
  /** 数组连起来；对象写成「键: 值」（值是数组的用斜线连） */
  const extraText = (v: unknown): string => {
    const sep = L === 'zh' ? '、' : ', '
    if (Array.isArray(v)) return v.map((x) => extraText(x)).join(sep)
    if (v && typeof v === 'object')
      return Object.entries(v as Record<string, unknown>)
        .map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join(' / ') : String(x)}`)
        .join(L === 'zh' ? '；' : '; ')
    return String(v)
  }

  /** 主分级里一级的短名（列表上用 A1 这样的，不用 id） */
  const levelShort = (id: string): string =>
    primarySystem(spec.levelSystems).levels.find((l) => l.id === id)?.short ?? id

  /**
   * 例句里把查的词标出来：不分大小写，也不管重音、元音符号这些记号（词典的写法带重音，例句多半不带）
   */
  function mark(sentence: string, words: string[]): { text: string; hit: boolean }[] {
    const { folded, map } = foldWithMap(sentence, lang)
    for (const x of words.filter(Boolean).sort((a, b) => b.length - a.length)) {
      const fx = foldWithMap(x, lang).folded
      const i = fx ? folded.indexOf(fx) : -1
      if (i < 0) continue
      const s = map[i]
      let e = map[i + fx.length]
      // 词尾后面跟着的记号（重音符）也算进去
      while (e < sentence.length && /\p{M}/u.test(sentence[e])) e++
      return [
        { text: sentence.slice(0, s), hit: false },
        { text: sentence.slice(s, e), hit: true },
        { text: sentence.slice(e), hit: false }
      ]
    }
    return [{ text: sentence, hit: false }]
  }
  const entryWords = $derived(
    entry ? [entry.w, ...(entry.d ? [entry.d] : []), ...entry.forms.map((f) => f.form)] : []
  )
</script>

{#snippet refs(kind: 'syn' | 'ant' | 'see', words: string[])}
  {#if words.length}
    <span class="faint">{t('dict.lex.' + kind)}</span>
    {#each words as x (x)}
      <button class="link" {lang} onclick={() => lookup(x)}>{x}</button>
    {/each}
  {/if}
{/snippet}

{#snippet exampleView(ex: LexExample, words: string[])}
  <li class="example" data-example={ex.id}>
    <div class="ex-line" {dir}>
      <span {lang} class="ex-text">
        {#each mark(ex.text, words) as part, i (i)}
          {#if part.hit}<mark>{part.text}</mark>{:else}{part.text}{/if}
        {/each}
      </span>
      {#if speech}<Pronounce item={{ text: ex.text, lang: speech }} />{/if}
    </div>
    {#if ex.zh && L === 'zh'}
      <div class="tr">
        {ex.zh}
        {#if ex.zs?.startsWith('mt-')}<span class="chip tiny">{t('dict.machine')}</span>{/if}
      </div>
    {/if}
    {#if ex.en && (L !== 'zh' || !ex.zh)}<div class="tr en">{ex.en}</div>{/if}
  </li>
{/snippet}

<div class="dict" data-lex-dict={code}>
  <header class="bar">
    <label class="search">
      <Search size={16} />
      <input
        bind:this={input}
        data-dict-input
        type="search"
        dir="auto"
        placeholder={t('dict.lex.placeholder', { lang: pick(spec.name) })}
        value={memo.query}
        oninput={(e) => (memo.query = e.currentTarget.value)}
        onkeydown={(e) => e.key === 'Enter' && dictState.remember(code, memo.query)}
      />
    </label>
    <div class="seg" role="tablist">
      {#each TABS as tab (tab)}
        <button
          role="tab"
          aria-selected={memo.tab === tab}
          class:on={memo.tab === tab}
          data-dict-tab={tab}
          onclick={() => (memo.tab = tab)}>{t('dict.tabs.' + tab)}</button
        >
      {/each}
    </div>
  </header>

  {#if available === false}
    <p class="card note" data-lex-nodata>
      {t('dict.lex.noData', { lang: pick(spec.name), code })}
    </p>
  {:else if memo.tab === 'words'}
    <div class="panes">
      <ul class="list" data-hit-list>
        {#each result?.hits ?? [] as h (h.id)}
          <li>
            <button
              class="hit"
              class:on={String(h.id) === memo.selected}
              data-hit={h.id}
              onclick={() => (memo.selected = String(h.id))}
            >
              <span class="row">
                <strong {lang} {dir}>{shown(h)}</strong>
                {#if h.p[0]}<span class="faint small">{posLabel(h.p[0], L)}</span>{/if}
                {#if h.g}<span class="faint small">{genderLabel(h.g, L)}</span>{/if}
                {#if h.lv}<span class="chip level">{levelShort(h.lv)}</span>{/if}
              </span>
              <span class="gloss">{(L === 'zh' && h.zh) || h.en || h.zh}</span>
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
        {#if entry}
          <header class="head">
            <span class="headword" {lang} {dir} data-headword>{shown(entry)}</span>
            {#if speech}
              <Pronounce item={{ key: lexKey(entry.id), text: entry.w, lang: speech }} />
            {/if}
            {#each entry.au.slice(0, 4) as a (a.url)}
              <button
                class="btn ghost small audio"
                title={[a.credit, a.license].filter(Boolean).join(' · ')}
                data-audio={a.url}
                onclick={() => play(a.url)}
                ><Volume2 size={14} />{a.label ?? t('dict.lex.audio')}</button
              >
            {/each}
            <span class="head-grow"></span>
            <AddToNotebook key={lexKey(entry.id)} make={() => lexFromEntry(entry!)} />
          </header>
          <div class="sub">
            {#if entry.d && entry.d !== entry.w}<span class="faint" {lang} {dir}>{entry.w}</span
              >{/if}
            {#each entry.ipa as p (p)}<span class="ipa"
                >{p.startsWith('/') || p.startsWith('[') ? p : `/${p}/`}</span
              >{/each}
            {#if entry.rom}<span class="rom">{entry.rom}</span>{/if}
          </div>
          {#if hit && hit.id === entry.id && viaText(hit, entry.w)}
            <p class="note-line" data-via>{viaText(hit, entry.w)}</p>
          {/if}
          <div class="tags">
            {#each entry.p as p (p)}<span class="chip pos">{posLabel(p, L)}</span>{/each}
            {#if entry.g}<span class="chip">{genderLabel(entry.g, L)}</span>{/if}
            {#each entry.levels as lv (lv.system)}
              <span
                class="chip"
                class:on={lv.primary}
                title={pick(lv.systemName)}
                data-level={lv.system}
                >{lv.levels.map((l) => (lv.primary ? l.short : pick(l.name))).join(' · ')}</span
              >
            {/each}
            {#each entry.cls as c (c)}<span class="chip">{tagLabel(c, L)}</span>{/each}
            {#if entry.freq}<span class="faint small">{t('dict.lex.freq', { n: entry.freq })}</span
              >{/if}
          </div>

          <ol class="senses">
            {#each entry.senses as s, i (i)}
              <li class="sense">
                {#if s.p.length || s.tags.length || s.dom.length}
                  <div class="tags">
                    {#each s.p as p (p)}<span class="chip pos">{posLabel(p, L)}</span>{/each}
                    {#each [...s.tags, ...s.dom] as m (m)}<span class="chip">{tagLabel(m, L)}</span
                      >{/each}
                  </div>
                {/if}
                {#if s.zh.length && L === 'zh'}
                  <p class="zh">
                    {s.zh.join('；')}
                    {#if s.zhSource?.machine}<span class="chip tiny">{t('dict.machine')}</span>{/if}
                  </p>
                {/if}
                {#if s.en.length}
                  <p class="en" class:secondary={!!s.zh.length && L === 'zh'}>{s.en.join('; ')}</p>
                {/if}
                {#each s.mono as m (m)}<p class="mono" {lang} {dir}>{m}</p>{/each}
                {#if s.syn.length || s.ant.length || s.see.length}
                  <p class="refs">
                    {@render refs('syn', s.syn)}
                    {@render refs('ant', s.ant)}
                    {@render refs('see', s.see)}
                  </p>
                {/if}
                {#if s.examples.length}
                  <ul class="examples">
                    {#each s.examples.slice(0, 3) as ex (ex.id)}{@render exampleView(
                        ex,
                        entryWords
                      )}{/each}
                  </ul>
                {/if}
              </li>
            {/each}
          </ol>

          {#if entry.examples.length}
            <section class="block">
              <h3>{t('dict.lex.examples')}</h3>
              <ul class="examples">
                {#each entry.examples as ex (ex.id)}{@render exampleView(ex, entryWords)}{/each}
              </ul>
            </section>
          {/if}

          {#if formRows.length || para.grids.length}
            <section class="block" data-forms>
              <button class="link" onclick={() => (formsOpen = !formsOpen)}
                >{t('dict.lex.forms', { n: entry.forms.length })}{formsOpen ? ' ▴' : ' ▾'}</button
              >
              {#if formsOpen || (formRows.length <= 6 && para.grids.length <= 1)}
                {#each para.grids as g, gi (gi)}
                  <table class="forms grid" data-paradigm>
                    {#if g.title.length}<caption>{tagsLabel(g.title, L)}</caption>{/if}
                    {#if g.cols.some((c) => c.length)}
                      <thead>
                        <tr>
                          <th></th>
                          {#each g.cols as c, ci (ci)}<th class="col">{tagsLabel(c, L)}</th>{/each}
                        </tr>
                      </thead>
                    {/if}
                    <tbody>
                      {#each g.rows as r, ri (ri)}
                        <tr>
                          <th>{tagsLabel(r.tags, L)}</th>
                          {#each r.cells as cell, ci (ci)}
                            <td {lang} {dir}
                              >{#each cell as x, xi (xi)}{#if xi}<br
                                  />{/if}{x.form}{#if x.note.length}<span class="faint form-ipa"
                                    >（{tagsLabel(x.note, L)}）</span
                                  >{/if}{#if x.ipa}<span class="faint form-ipa">{x.ipa}</span
                                  >{/if}{/each}</td
                            >
                          {/each}
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {/each}
                {#if formRows.length}<table class="forms">
                    <tbody>
                      {#each formRows as [label, forms] (label)}
                        <tr>
                          <th>{label}</th>
                          <td {lang} {dir}
                            >{#each forms as f, i (f.form)}{#if i}{L === 'zh'
                                  ? '、'
                                  : ', '}{/if}{f.form}{#if f.ipa}<span class="faint form-ipa"
                                  >{f.ipa}</span
                                >{/if}{/each}</td
                          >
                        </tr>
                      {/each}
                    </tbody>
                  </table>{/if}
              {/if}
            </section>
          {/if}

          {#if extras.length}
            <section class="block" data-extras>
              {#each extras as [k, v] (k)}
                <p>
                  <span class="faint" title={extraHelp(k) || undefined}>{extraLabel(k)}</span>
                  <span {lang}>{extraText(v)}</span>
                </p>
              {/each}
            </section>
          {/if}

          {#if entry.sources.length}
            <p class="faint source">
              {t('dict.lex.sources')}{entry.sources
                .map((s) => `${s.name}（${s.license}）`)
                .join('；')}
            </p>
          {/if}
        {:else if result?.hits.length === 0 && memo.query.trim()}
          <p class="faint">{t('dict.noResult', { q: memo.query.trim() })}</p>
        {/if}
      </article>
    </div>
  {:else if memo.tab === 'grammar'}
    <LexGrammarDict {code} query={memo.query} />
  {:else}
    <ul class="sentences" data-sentences>
      {#each examples as ex (ex.id)}
        {@render exampleView(ex, [memo.query.trim()])}
      {:else}
        <li class="hint">
          {memo.query.trim()
            ? t('dict.noResult', { q: memo.query.trim() })
            : t('dict.lex.sentenceHint')}
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
  .small {
    font-size: 12px;
  }
  .gloss {
    color: var(--text-2);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    gap: 10px;
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
  }
  .sub {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: baseline;
    color: var(--text-2);
  }
  .ipa {
    font-family: var(--font-ipa, inherit);
  }
  .rom {
    font-style: italic;
  }
  .audio {
    gap: 4px;
  }
  .note-line {
    color: var(--accent-text);
    font-size: 13px;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }
  .chip.pos {
    background: var(--accent-soft);
    color: var(--accent-text);
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
  .zh {
    font-size: 16px;
  }
  .en.secondary {
    color: var(--text-2);
    font-size: 13px;
  }
  .mono {
    color: var(--text-2);
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
  .examples {
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
  .ex-line {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .ex-text {
    font-size: 15px;
  }
  .tr {
    color: var(--text-2);
    font-size: 13px;
  }
  mark {
    background: var(--accent-soft);
    color: var(--accent-text);
    border-radius: 3px;
  }
  .block h3 {
    font-size: 13px;
    color: var(--text-2);
    margin: 0 0 6px;
  }
  .forms {
    border-collapse: collapse;
    margin-top: 6px;
    font-size: 14px;
  }
  .forms th {
    text-align: start;
    font-weight: 400;
    color: var(--text-2);
    padding: 3px 14px 3px 0;
    white-space: nowrap;
    vertical-align: top;
  }
  .forms td {
    padding: 3px 0;
  }
  .form-ipa {
    margin-inline-start: 4px;
    font-size: 12px;
  }
  .forms.grid {
    margin-bottom: 8px;
  }
  .forms.grid caption {
    text-align: start;
    font-size: 13px;
    color: var(--text-2);
    padding: 2px 0;
  }
  .forms.grid td {
    padding: 3px 14px 3px 0;
    vertical-align: top;
  }
  .forms.grid .col {
    font-size: 12px;
  }
  .source {
    font-size: 12px;
  }
</style>
