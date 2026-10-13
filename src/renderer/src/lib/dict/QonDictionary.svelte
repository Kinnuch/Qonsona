<script lang="ts">
  // 千语集语言的词典：词条（自造文字、读音、义项、屈折形、词源、例句）、语素、例句。
  // 词形、读音、文字写法都用千语集自己的引擎算，跟作者在千语集里看到的一样。
  import { onMount } from 'svelte'
  import { dictionaryTestGrant } from '$lib/accounts/test-grant'
  import { Search } from '@lucide/svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { qonDailyPool } from './daily-qonlang'
  import DictionaryDaily from './DictionaryDaily.svelte'
  import type { DailyWord, DailySentence, DailyGrammar } from '$shared/dictionary-daily'
  import { courses } from '$lib/state/courses.svelte'

  import { packs } from '$lib/state/packs.svelte'
  import { t, pick, i18n } from '$lib/i18n/index.svelte'
  import { dictState, type DictTab } from './state.svelte'
  import {
    firstGloss,
    posLabel,
    searchLexicon,
    searchMorphemes,
    searchSentences,
    slotLabel
  } from '$lib/packs/qonlang/lexicon'
  import { spellingIpa, storedIpa } from '$lib/packs/qonlang/pronounce'
  import type { Language, Lexeme, Project, Script } from '$qon/core/model'
  import { lexemeScript, sentenceScript } from '$qon/script/render'
  import { ensureScriptFont, fontFamilyCss } from '$qon/script/fonts'
  import { findExamples, markParts } from '$qon/core/examples'
  import qonZh from '$qon/i18n/zh'
  import qonEn from '$qon/i18n/en'
  import type { LocalizedText } from '$lib/packs/types'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import AddToNotebook from '$lib/notebook/AddToNotebook.svelte'
  import { qonFromLexeme } from '$lib/notebook/cards'

  let { project, language }: { project: Project; language: Language } = $props()

  // 换语言时整页会重建（Shell 按语言 key），这里取一次即可；
  // 不能放进 $derived：dictState.of 第一次会新建状态，派生值里不许改状态
  const packId = packs.active!.id
  const memo = dictState.of(packId)
  const features = $derived(packs.active!.features)
  const TABS: DictTab[] = ['words', 'characters', 'sentences']
  const tabs = $derived(TABS.filter((x) => x !== 'characters' || features.characters))
  const levels = $derived(packs.levels?.entries ?? {})
  const levelName = (id: string | null): string =>
    id ? pick(packs.levels?.system.levels.find((l) => l.id === id)?.name) : ''
  const L = $derived(i18n.locale)
  const qonI18n = $derived(L === 'zh' ? qonZh : qonEn)

  let input = $state<HTMLInputElement | null>(null)
  onMount(() => input?.focus())

  // 文字的字体（内嵌字体要先注册）
  $effect(() => {
    for (const sc of language.scripts) ensureScriptFont(sc)
  })

  const hits = $derived(searchLexicon(project, language.id, memo.query, pick, levels, packs.hidden))
  $effect(() => {
    if (memo.tab !== 'words') return
    const ids = hits.map((h) => h.id)
    if (!memo.selected || !ids.includes(memo.selected)) memo.selected = ids[0] ?? null
  })
  $effect(() => {
    void memo.selected
    memo.inflection = false
  })
  const dailyPool = $derived(qonDailyPool(project, language, packs.hidden, packs.levels))
  const lexeme = $derived(project.lexemes.find((l) => l.id === memo.selected) ?? null)
  const hit = $derived(hits.find((h) => h.id === memo.selected) ?? null)

  const morphemes = $derived(searchMorphemes(project, language.id, memo.query))
  $effect(() => {
    if (memo.tab !== 'characters' || features.characters !== 'morphemes') return
    const ids = morphemes.map((m) => m.id)
    if (!memo.char || !ids.includes(memo.char)) memo.char = ids[0] ?? null
  })
  const morpheme = $derived(project.morphemes.find((m) => m.id === memo.char) ?? null)
  const sentences = $derived(searchSentences(project, language.id, memo.query, packs.hidden))

  const glossLangs = $derived([L, ...project.settings.glossLanguages])
  const pickText = (text: LocalizedText | undefined): string => pick(text)

  function scriptLines(l: Lexeme): { sc: Script; text: string }[] {
    return language.scripts.map((sc) => ({ sc, text: lexemeScript(language, sc, l) }))
  }
  const ipaOf = (l: Lexeme): string =>
    storedIpa(language, l.pronunciations) || spellingIpa(language, l.lemma)

  /** 词源来源一条写成文字 */
  function sourceText(s: Lexeme['etymology']['sources'][number]): { text: string; id?: string } {
    if (s.kind === 'lexeme') {
      const x = project.lexemes.find((l) => l.id === s.id)
      return x
        ? {
            text: `${x.lemma}「${firstGloss(x, pick)}」`,
            id: x.languageId === language.id ? x.id : undefined
          }
        : { text: '?' }
    }
    if (s.kind === 'morpheme') {
      const m = project.morphemes.find((x) => x.id === s.id)
      return { text: m ? `${m.form}「${m.gloss || pick(m.meaning)}」` : '?' }
    }
    return { text: [s.language, s.form, s.meaning && `「${s.meaning}」`].filter(Boolean).join(' ') }
  }
  const etyType = (type: string): string =>
    (qonI18n.lexicon.etyTypes as Record<string, string>)[type] ?? type

  const customFields = $derived(
    project.customFields.filter((f) => !f.languageIds.length || f.languageIds.includes(language.id))
  )

  function lookup(id: string): void {
    const target = project.lexemes.find(
      (l) => l.id === id && l.languageId === language.id && !packs.hidden.has(l.id)
    )
    if (!target) return
    memo.query = target.lemma
    memo.tab = 'words'
    memo.selected = id
    dictState.remember(packId, target.lemma)
  }
  function onword(word: DailyWord): void {
    memo.tab = 'words'
    memo.query = word.front
    memo.selected = word.id
    dictState.remember(packId, word.front)
  }
  function onsentence(sentence: DailySentence): void {
    memo.query = sentence.text
    memo.tab = 'sentences'
  }
  function ongrammar(grammar: DailyGrammar): void {
    oncourse(grammar)
  }
  function oncourse(grammar: DailyGrammar): void {
    if (grammar.lessonId) {
      courses.openLesson('grammar', grammar.lessonId)
      ui.go('courses')
    }
  }
</script>

<div class="dict">
  <header class="bar">
    <label class="search">
      <Search size={16} />
      <input
        bind:this={input}
        data-dict-input
        type="search"
        placeholder={t('dict.placeholderQon')}
        value={memo.query}
        oninput={(e) => (memo.query = e.currentTarget.value)}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            dictState.remember(packId, memo.query)
            void dictionaryTestGrant?.(memo.query)
          }
        }}
      />
    </label>
    <div class="seg" role="tablist">
      {#each tabs as tab (tab)}
        <button
          role="tab"
          aria-selected={memo.tab === tab}
          class:on={memo.tab === tab}
          data-dict-tab={tab}
          onclick={() => (memo.tab = tab)}
        >
          {tab === 'characters' && features.characters
            ? t('kinds.characters.' + features.characters)
            : t('dict.tabs.' + tab)}
        </button>
      {/each}
    </div>
  </header>

  {#if memo.tab === 'words' && !memo.query.trim()}
    <div class="discoveries">
      <DictionaryDaily
        {packId}
        localPool={dailyPool}
        {onword}
        {onsentence}
        {ongrammar}
        {oncourse}
      />
      {#if memo.history.length}<section class="daily-history">
          <h3>{t('dict.history')}</h3>
          <div>
            {#each memo.history as q (q)}<button
                class="chip"
                onclick={() => {
                  memo.query = q
                  memo.tab = 'words'
                }}>{q}</button
              >{/each}
          </div>
        </section>{/if}
    </div>
  {:else if memo.tab === 'words'}
    <div class="panes">
      <ul class="list" data-hit-list>
        {#each hits as h (h.id)}
          <li>
            <button
              class="hit"
              class:on={h.id === memo.selected}
              data-hit={h.id}
              onclick={() => (memo.selected = h.id)}
            >
              <span class="row">
                <strong class="data">{h.lemma}</strong>
                {#if h.pos}<span class="muted">{h.pos}</span>{/if}
                {#if h.level}<span class="chip level">{levelName(h.level)}</span>{/if}
              </span>
              <span class="gloss">
                {#if h.match === 'form'}<span class="data">{h.form}</span> · {h.slot} ·
                {/if}{h.gloss}
              </span>
            </button>
          </li>
        {:else}
          <li class="hint">{t('dict.noResult', { q: memo.query.trim() })}</li>
        {/each}
      </ul>

      <article class="detail" data-entry={lexeme?.id}>
        {#if lexeme}
          {@const ipa = ipaOf(lexeme)}
          <header class="head">
            <span class="headword data">{lexeme.lemma}</span>
            <Pronounce item={{ key: `lexeme-${lexeme.id}`, ipa }} />
            <button
              class="btn small"
              data-inflection-toggle
              aria-expanded={memo.inflection}
              onclick={() => (memo.inflection = !memo.inflection)}
              >{memo.inflection ? t('dict.hideInflection') : t('dict.inflection')}</button
            >
            <AddToNotebook
              key={`lexeme-${lexeme.id}`}
              make={() => qonFromLexeme(language, lexeme!)}
            />
            {#if levels[lexeme.id]}<span class="chip on">{levelName(levels[lexeme.id])}</span>{/if}
            {#if posLabel(project, lexeme.posId, pick)}<span class="chip pos"
                >{posLabel(project, lexeme.posId, pick)}</span
              >{/if}
          </header>
          {#if hit?.match === 'form' && hit.form}
            <p class="note-line">
              {t('dict.formOf', { form: hit.form, base: lexeme.lemma, slot: hit.slot ?? '' })}
            </p>
          {/if}
          {#if ipa}<p class="ipa">[{ipa}]</p>{/if}
          {#each scriptLines(lexeme) as line (line.sc.id)}
            {#if line.text}<p class="script" style={fontFamilyCss(line.sc)} title={line.sc.name}>
                {line.text}
              </p>{/if}
          {/each}

          {#if memo.inflection}
            <section class="block" data-inflection-panel data-forms>
              <h3>{t('dict.inflection')}</h3>
              {#if Object.values(lexeme.forms).some((f) => f.surface)}
                <div class="table-scroll" data-dict-forms-scroll>
                  <table class="forms">
                    <tbody>
                      {#each Object.entries(lexeme.forms).filter(([, f]) => f.surface) as [slot, f] (slot)}
                        <tr>
                          <th>{slotLabel(slot)}</th>
                          <td class="data">{f.surface}</td>
                          <td
                            ><Pronounce
                              item={{ ipa: f.ipa || spellingIpa(language, f.surface) }}
                            /></td
                          >
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else}<p class="muted">{t('dict.inflectionEmpty')}</p>{/if}
            </section>
          {/if}

          <ol class="senses">
            {#each lexeme.senses as s (s.id)}
              <li>
                <div class="tags">
                  {#if s.posId && s.posId !== lexeme.posId}<span class="chip pos"
                      >{posLabel(project, s.posId, pick)}</span
                    >{/if}
                  {#each s.registers as r (r)}<span class="chip">{r}</span>{/each}
                  {#each s.tags as tg (tg)}<span class="chip">{tg}</span>{/each}
                </div>
                <p class="def">{pick(s.definition)}</p>
                {#each Object.entries(s.definition).filter(([k, v]) => v && v !== pick(s.definition) && k !== L) as [k, v] (k)}
                  <p class="faint">{v}</p>
                {/each}
              </li>
            {/each}
          </ol>

          {#if lexeme.etymology.sources.length || lexeme.etymology.stages.length || lexeme.etymology.notes}
            <section class="block">
              <h3>{t('dict.qon.etymology')}</h3>
              <p>
                {#if lexeme.etymology.type}<span class="chip">{etyType(lexeme.etymology.type)}</span
                  >{/if}
                {#each lexeme.etymology.sources as s, i (i)}
                  {@const src = sourceText(s)}
                  {#if src.id}
                    <button class="link data" onclick={() => lookup(src.id!)}>{src.text}</button>
                  {:else}
                    <span class="data">{src.text}</span>
                  {/if}
                  {#if i < lexeme.etymology.sources.length - 1}＋{/if}
                {/each}
              </p>
              {#if lexeme.etymology.stages.length}
                <p class="data stages">
                  {lexeme.etymology.stages.map((s) => s.form).join(' → ')} → {lexeme.lemma}
                </p>
              {/if}
              {#if lexeme.etymology.notes}<p class="faint">{lexeme.etymology.notes}</p>{/if}
            </section>
          {/if}

          {#if lexeme.relations.length}
            <section class="block">
              <h3>{t('dict.qon.relations')}</h3>
              <p class="refs">
                {#each lexeme.relations as r, i (i)}
                  {@const x = project.lexemes.find((l) => l.id === r.lexemeId)}
                  {#if x}
                    <span class="faint">{r.kind}</span>
                    <button class="link data" onclick={() => lookup(x.id)}>{x.lemma}</button>
                  {/if}
                {/each}
              </p>
            </section>
          {/if}

          {@const exs = findExamples(project, lexeme, glossLangs, 6, pickText)}
          {#if exs.length}
            <section class="block">
              <h3>{t('dict.qon.examples')}</h3>
              <ul class="examples">
                {#each exs as ex (ex.kind + ex.id + ex.text)}
                  <li class="example">
                    <div class="line">
                      <span class="data">
                        {#each markParts(ex.text, ex.spans) as part, i (i)}
                          {#if part.mark}<mark>{part.text}</mark>{:else}{part.text}{/if}
                        {/each}
                      </span>
                      <Pronounce
                        item={{ key: `${ex.kind}-${ex.id}`, ipa: spellingIpa(language, ex.text) }}
                      />
                    </div>
                    {#if ex.translation}<div class="tr">{ex.translation}</div>{/if}
                    {#if ex.where}<div class="faint">{ex.where}</div>{/if}
                  </li>
                {/each}
              </ul>
            </section>
          {/if}

          {#each customFields as f (f.id)}
            {#if lexeme.custom?.[f.id]}
              <section class="block">
                <h3>{pick(f.name)}</h3>
                <p
                  style={f.scriptId
                    ? fontFamilyCss(
                        language.scripts.find((s) => s.id === f.scriptId) ?? language.scripts[0]
                      )
                    : ''}
                >
                  {lexeme.custom[f.id]}
                </p>
              </section>
            {/if}
          {/each}

          {#each lexeme.images as img (img.id)}
            <figure class="image">
              <img src={img.dataUrl} alt={img.caption} />{#if img.caption}<figcaption class="faint">
                  {img.caption}
                </figcaption>{/if}
            </figure>
          {/each}

          {#if lexeme.notes}
            <section class="block">
              <h3>{t('dict.qon.notes')}</h3>
              <p class="notes">{lexeme.notes}</p>
            </section>
          {/if}
        {/if}
      </article>
    </div>
  {:else if memo.tab === 'characters' && features.characters === 'morphemes'}
    <div class="panes">
      <ul class="list">
        {#each morphemes as m (m.id)}
          <li>
            <button
              class="hit"
              class:on={m.id === memo.char}
              data-morpheme={m.id}
              onclick={() => (memo.char = m.id)}
            >
              <span class="row">
                <strong class="data">{m.form}{m.form2 ? `…${m.form2}` : ''}</strong>
                <span class="muted"
                  >{(qonI18n.morphemes.types as Record<string, string>)[m.type] ?? m.type}</span
                >
              </span>
              <span class="gloss">{m.gloss}{pick(m.meaning) ? ` · ${pick(m.meaning)}` : ''}</span>
            </button>
          </li>
        {:else}
          <li class="hint">{t('dict.qon.morphemeHint')}</li>
        {/each}
      </ul>
      <article class="detail">
        {#if morpheme}
          <header class="head">
            <span class="headword data"
              >{morpheme.form}{morpheme.form2 ? `…${morpheme.form2}` : ''}</span
            >
            <Pronounce
              item={{
                key: `morpheme-${morpheme.id}`,
                ipa: spellingIpa(language, morpheme.form.replace(/^[-=]+|[-=]+$/g, ''))
              }}
            />
            <span class="chip pos"
              >{(qonI18n.morphemes.types as Record<string, string>)[morpheme.type] ??
                morpheme.type}</span
            >
          </header>
          {#if morpheme.gloss}<p class="gloss-line">{morpheme.gloss}</p>{/if}
          {#if pick(morpheme.meaning)}<p class="def">{pick(morpheme.meaning)}</p>{/if}
          {#if morpheme.allomorphs.length}
            <section class="block">
              <h3>{t('dict.qon.allomorphs')}</h3>
              <div class="table-scroll" data-dict-forms-scroll>
                <table class="forms">
                  <tbody>
                    {#each morpheme.allomorphs as a, i (i)}
                      <tr
                        ><td class="data">{a.form}</td><td class="faint mono">{a.environment}</td
                        ></tr
                      >
                    {/each}
                  </tbody>
                </table>
              </div>
            </section>
          {/if}
          {#if morpheme.notes}<p class="notes">{morpheme.notes}</p>{/if}
          <section class="block">
            <h3>{t('dict.tabs.words')}</h3>
            <p class="refs">
              {#each project.lexemes.filter((l) => l.languageId === language.id && l.etymology.sources.some((s) => s.kind === 'morpheme' && s.id === morpheme!.id)) as l (l.id)}
                <button class="link data" onclick={() => lookup(l.id)}>{l.lemma}</button>
              {/each}
            </p>
          </section>
        {/if}
      </article>
    </div>
  {:else if memo.tab === 'characters'}
    <div class="glyphs">
      {#each language.scripts.filter((s) => s.glyphs.length) as sc (sc.id)}
        <section class="block">
          <h3>{sc.name}</h3>
          <div class="glyph-grid">
            {#each sc.glyphs.filter((g) => !memo.query.trim() || g.value.includes(memo.query.trim()) || g.name.includes(memo.query.trim())) as g (g.id)}
              <div class="card glyph">
                <span class="big" style={fontFamilyCss(sc)}>{g.char}</span>
                <span class="data">{g.value}</span>
                {#if g.name}<span class="faint">{g.name}</span>{/if}
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {:else}
    <ul class="sentences">
      {#each sentences as s (s.id)}
        <li class="example" data-sentence={s.id}>
          <div class="line">
            <span class="data big-line">{s.text}</span>
            <Pronounce item={{ key: `sentence-${s.id}`, ipa: spellingIpa(language, s.text) }} />
          </div>
          {#each language.scripts as sc (sc.id)}
            <div class="script small" style={fontFamilyCss(sc)}>
              {sentenceScript(language, sc, s)}
            </div>
          {/each}
          <div class="tr">{pick(s.translation)}</div>
          {#if s.source}<div class="faint">{s.source}</div>{/if}
        </li>
      {:else}
        <li class="hint">{t('dict.noResult', { q: memo.query.trim() })}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .discoveries {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .daily-history {
    padding-block: 18px;
  }
  .daily-history div {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

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
  .gloss {
    color: var(--text-2);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .data {
    font-family: var(--font-data);
  }
  .mono {
    font-family: var(--font-mono);
  }
  .chip.level {
    font-size: 11px;
    padding: 0 6px;
  }
  .chip.pos {
    background: var(--accent-soft);
    color: var(--accent-text);
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
  .headword {
    font-size: 32px;
    font-weight: 600;
  }
  .ipa {
    font-family: var(--font-data);
    color: var(--text-2);
  }
  .script {
    font-size: 30px;
    line-height: 1.3;
  }
  .script.small {
    font-size: 20px;
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
    gap: 10px;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .def {
    font-size: 16px;
  }
  .gloss-line {
    font-family: var(--font-mono);
    color: var(--text-2);
  }
  .block h3 {
    margin-bottom: 6px;
  }
  .forms {
    border-collapse: collapse;
  }
  .forms th {
    text-align: start;
    font-weight: 400;
    color: var(--text-2);
    padding: 3px 16px 3px 0;
  }
  .forms td {
    padding: 3px 8px 3px 0;
  }
  .forms tr + tr {
    border-top: 1px solid var(--border);
  }
  .stages {
    color: var(--text-2);
  }
  .refs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
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
    margin: 0;
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
    border-inline-start: none;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .big-line {
    font-size: 17px;
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
  .notes {
    white-space: pre-wrap;
  }
  .image img {
    max-width: 240px;
    border-radius: var(--radius);
  }
  .image {
    margin: 0;
  }
  .glyphs {
    overflow-y: auto;
  }
  .glyph-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 8px;
  }
  .glyph {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px;
  }
  .big {
    font-size: 32px;
    line-height: 1.2;
  }
</style>
