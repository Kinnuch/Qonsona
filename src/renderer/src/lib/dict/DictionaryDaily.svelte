<script lang="ts">
  import { onMount } from 'svelte'
  import { platform } from '$lib/platform'
  import { i18n, pick } from '$lib/i18n/index.svelte'
  import AddToNotebook from '$lib/notebook/AddToNotebook.svelte'
  import Pronounce from '$lib/ui/Pronounce.svelte'
  import {
    dailyDate,
    dailyOrdinal,
    makeDaily,
    DailyRequestGate,
    type DailyPool,
    type DailyWord,
    type DailySentence,
    type DailyGrammar,
    type DictionaryDaily
  } from '$shared/dictionary-daily'
  import { langModule } from '$shared/lang/registry'
  let {
    packId,
    query = '',
    visible = true,
    localPool = null,
    bcp47,
    load = defaultLoad,
    onword,
    onsentence,
    ongrammar,
    oncourse
  }: {
    packId: string
    query?: string
    visible?: boolean
    localPool?: DailyPool | null
    bcp47?: string
    load?: (packId: string, date: string) => Promise<DictionaryDaily>
    onword: (word: DailyWord) => void
    onsentence: (sentence: DailySentence) => void
    ongrammar: (grammar: DailyGrammar) => void
    oncourse?: (grammar: DailyGrammar) => void
  } = $props()
  function defaultLoad(id: string, date: string): Promise<DictionaryDaily> {
    return platform.dictionary.daily(id, date)
  }
  let today = $state(dailyDate())
  let date = $state(dailyDate())
  let currentDay = $state(true)
  let bundle = $state.raw<DictionaryDaily | null>(null)
  let loading = $state(false)
  let error = $state('')
  const gate = new DailyRequestGate()
  const zh = $derived(i18n.locale === 'zh')
  const textLang = $derived(
    bcp47 ?? langModule(packId)?.spec.bcp47 ?? (packId === 'ja' ? 'ja' : undefined)
  )
  $effect(() => {
    const id = packId
    const day = date
    const pool = localPool
    const enabled = visible && !query.trim()
    const token = gate.begin(id, day)
    bundle = null
    error = ''
    loading = enabled
    if (!enabled) return
    try {
      dailyOrdinal(day)
    } catch {
      error = 'invalid-date'
      loading = false
      return
    }
    if (pool) {
      try {
        bundle = makeDaily(id, day, pool)
      } catch (err) {
        error = String(err instanceof Error ? err.message : err)
      }
      loading = false
    } else
      void load(id, day)
        .then((result) => {
          if (gate.accepts(token, result)) bundle = result
        })
        .catch((err) => {
          if (gate.current(token)) error = String(err instanceof Error ? err.message : err)
        })
        .finally(() => {
          if (gate.current(token)) loading = false
        })
    return () => {
      gate.cancel()
    }
  })
  onMount(() => {
    const timer = setInterval(() => {
      const next = dailyDate()
      if (next !== today) {
        today = next
        if (currentDay) date = next
      }
    }, 60000)
    return () => clearInterval(timer)
  })
  function level(id: string | null): string {
    return id ? pick(bundle?.levels[id]) || id : zh ? '未分级' : 'Unrated'
  }
  function empty(section: 'words' | 'sentences' | 'grammar'): string {
    return bundle?.empty[section] === 'missing-db'
      ? zh
        ? '此语言的词典数据尚未安装。'
        : 'Dictionary data for this language are not installed.'
      : section === 'sentences'
        ? zh
          ? '当前资料没有可用的真实例句。'
          : 'No real example sentences are available in the current data.'
        : section === 'grammar'
          ? zh
            ? '当前学习包没有语法讲解。'
            : 'This learning package has no grammar explanations.'
          : zh
            ? '当前资料没有带释义的词条。'
            : 'No entries with meanings are available in the current data.'
  }
</script>

{#if visible && !query.trim()}
  <section
    class="daily"
    data-dictionary-daily={packId}
    data-daily-date={date}
    aria-label={zh ? '词典每日推荐' : 'Daily dictionary discoveries'}
  >
    <header>
      <div>
        <span class="eyebrow">{zh ? '每日探索' : 'DAILY DISCOVERIES'}</span>
        <h2>{zh ? '今天学一点新知识' : 'Something new to learn today'}</h2>
      </div>
      <div class="date">
        <label
          >{zh ? '推荐日期' : 'Recommendation date'}<input
            type="date"
            max={today}
            bind:value={date}
            data-daily-date-input
            onchange={() => (currentDay = date === today)}
          /></label
        >{#if date !== today}<button
            class="btn ghost"
            data-daily-today
            onclick={() => {
              date = today
              currentDay = true
            }}>{zh ? '回到今天' : 'Today'}</button
          >{/if}
      </div>
    </header>
    <p class="intro muted">
      {zh
        ? '每天从本语言的真实资料中挑选词汇、句子和语法。可查看过去日期，查词后推荐自动收起；项目内容始终留在本机。'
        : 'Words, sentences and grammar from this language’s real materials. Browse earlier dates; recommendations recede when you search. Project content stays on this device.'}
    </p>
    {#if loading}<p class="muted" role="status" data-daily-loading>
        {zh
          ? '正在准备推荐，仍可直接输入查词…'
          : 'Preparing recommendations; you can still type to search…'}
      </p>{:else if error}<p class="muted" role="status" data-daily-error>
        {zh
          ? '推荐暂不可用，不影响词典检索：'
          : 'Recommendations are unavailable; dictionary search still works: '}{error ===
        'invalid-date'
          ? zh
            ? '请选择有效的推荐日期。'
            : 'Choose a valid recommendation date.'
          : error}
      </p>{:else if bundle}
      <div class="blocks">
        <section class="block words" data-daily-block="words">
          <h3><span class="number">01</span>{zh ? '今日词汇' : 'Words'}</h3>
          {#each bundle.words as word (word.id)}<article class="word" data-daily-word={word.id}>
              <div class="item-head">
                <span class="level">{level(word.level)}</span><AddToNotebook
                  key={word.card.key}
                  make={() => word.card}
                />
              </div>
              <button
                class="headword"
                data-daily-open-word
                onclick={() => onword(word)}
                lang={textLang}
                dir="auto">{word.front}</button
              >{#if word.reading && word.reading !== word.front}<p
                  class="reading"
                  lang={textLang}
                  dir="auto"
                >
                  {word.reading}
                </p>{/if}
              <p class="meaning">{pick(word.meaning)}</p>
            </article>{:else}<p class="empty muted" data-daily-empty="words">
              {empty('words')}
            </p>{/each}
        </section>
        <section class="block sentences" data-daily-block="sentences">
          <h3><span class="number">02</span>{zh ? '今日句子' : 'Sentences'}</h3>
          {#each bundle.sentences as sentence (sentence.id)}<article
              class="sentence"
              data-daily-sentence={sentence.id}
            >
              <div class="item-head">
                <span class="level">{level(sentence.level)}</span
                >{#if sentence.lang || sentence.audioKey}<Pronounce
                    item={sentence.lang
                      ? { text: sentence.text, lang: sentence.lang, key: sentence.audioKey }
                      : { key: sentence.audioKey }}
                  />{/if}
              </div>
              <p class="sentence-text" lang={sentence.lang ?? textLang} dir="auto">
                {sentence.text}
              </p>
              <p class="muted">{pick(sentence.meaning)}</p>
              <button
                class="btn ghost small"
                data-daily-query-sentence
                onclick={() => onsentence(sentence)}
                >{zh ? '查询这句话' : 'Explore this sentence'}</button
              >
            </article>{:else}<p class="empty muted" data-daily-empty="sentences">
              {empty('sentences')}
            </p>{/each}
        </section>
        <section class="block grammar" data-daily-block="grammar">
          <h3><span class="number">03</span>{zh ? '今日语法' : 'Grammar'}</h3>
          {#each bundle.grammar as grammar (grammar.id)}<article data-daily-grammar={grammar.id}>
              <span class="level">{level(grammar.level)}</span><button
                class="grammar-name"
                data-daily-open-grammar
                onclick={() => ongrammar(grammar)}>{pick(grammar.title)}</button
              >
              <p class="meaning">{pick(grammar.meaning)}</p>
              {#if grammar.example}<p class="grammar-example" lang={textLang} dir="auto">
                  {grammar.example}
                </p>{/if}
              <div class="grammar-actions">
                <button class="btn" data-daily-explain onclick={() => ongrammar(grammar)}
                  >{zh ? '查看讲解' : 'Explanation'}</button
                >{#if grammar.lessonId && oncourse}<button
                    class="btn ghost"
                    data-daily-course
                    onclick={() => oncourse?.(grammar)}
                    >{zh ? '进入对应课程' : 'Related lesson'}</button
                  >{/if}
              </div>
            </article>{:else}<p class="empty muted" data-daily-empty="grammar">
              {empty('grammar')}
            </p>{/each}
        </section>
      </div>
    {/if}
  </section>
{/if}

<style>
  .daily {
    width: 100%;
    min-width: 0;
    padding: 24px 0 8px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    flex-wrap: wrap;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.15em;
    font-weight: 650;
    color: var(--accent);
  }
  h2 {
    font-size: 23px;
    line-height: 1.4;
    margin-top: 5px;
  }
  .date {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 12px;
    color: var(--text-2);
  }
  input {
    padding: 6px 9px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    color: inherit;
    font: inherit;
  }
  .intro {
    max-width: 80ch;
    font-size: 13px;
    line-height: 1.6;
    margin: 12px 0 20px;
  }
  .blocks {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }
  .block {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px;
    background: var(--bg-elev);
    min-width: 0;
  }
  .block h3 {
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 15px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  .number {
    font-size: 12px;
    color: var(--accent);
    font-family: var(--font-data);
  }
  article {
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
    overflow-wrap: anywhere;
  }
  article:last-child {
    border-bottom: none;
  }
  .item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .level {
    display: inline-block;
    font-size: 11px;
    padding: 3px 7px;
    border-radius: 4px;
    background: var(--bg-sunken);
    color: var(--text-2);
  }
  .headword,
  .grammar-name {
    background: none;
    border: none;
    padding: 9px 0 4px;
    text-align: start;
    cursor: pointer;
    font: inherit;
    color: var(--text);
    font-weight: 600;
    display: block;
    width: 100%;
    overflow-wrap: anywhere;
  }
  .headword {
    font-size: 25px;
  }
  .grammar-name {
    font-size: 19px;
  }
  .headword:hover,
  .grammar-name:hover {
    color: var(--accent);
  }
  .reading {
    font-size: 13px;
    color: var(--text-3);
  }
  .meaning {
    font-size: 14px;
    line-height: 1.65;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .sentence-text {
    font-size: 18px;
    line-height: 1.8;
    margin: 10px 0 5px;
  }
  .sentence .muted {
    font-size: 13px;
    line-height: 1.65;
  }
  .small {
    font-size: 12px;
    margin-top: 10px;
    padding: 4px 0;
  }
  .grammar-example {
    font-size: 16px;
    line-height: 1.7;
    padding: 12px;
    background: var(--bg-sunken);
    border-radius: var(--radius-sm);
    margin: 14px 0;
  }
  .grammar-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
  .empty {
    font-size: 13px;
    line-height: 1.7;
    padding: 12px 0;
  }
  @media (max-width: 1100px) {
    .blocks {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .grammar {
      grid-column: 1/-1;
    }
  }
  @media (max-width: 700px) {
    .blocks {
      grid-template-columns: minmax(0, 1fr);
    }
    .grammar {
      grid-column: auto;
    }
    .daily {
      padding-top: 14px;
    }
  }
</style>
