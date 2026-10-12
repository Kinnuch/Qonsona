<script lang="ts">
  // 首页只放新闻：中间是上下滑的新闻（日语是 NHK 新闻、自己导入的与内置的文章；千语集语言是它的课文），
  // 滑到哪篇那篇占满版面，点击即可阅读。功能放在底栏（今日复习、下一课、练习、全部文章），
  // 这门语言的介绍、样例与内容在右边拉出来的「关于」一栏
  import { onMount, untrack } from 'svelte'
  import {
    Info,
    NotebookPen,
    GraduationCap,
    ListChecks,
    RefreshCw,
    BookOpenText
  } from '@lucide/svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { notebook } from '$lib/state/notebook.svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { reading } from '$lib/state/reading.svelte'
  import { t, pick, i18n } from '$lib/i18n/index.svelte'
  import { visibleModules } from '$lib/packs/modules'
  import { nextLesson } from '$shared/course'
  import { txt } from '$lib/courses/view'
  import { qonTexts, type QonText } from '$lib/packs/qonlang/reading'
  import { topicLabel } from '$lib/reader/topics'
  import type { ArticleMeta, ArticleSource } from '$shared/articles'
  import NewsFeed, { type FeedItem } from '$lib/home/NewsFeed.svelte'
  import LanguageAbout from '$lib/home/LanguageAbout.svelte'
  import { langReading } from '$lib/state/langReading.svelte'
  import { langModule } from '$shared/lang/registry'
  import { primarySystem } from '$shared/lang/levels'

  const pack = $derived(packs.active)
  const project = $derived(packs.project)
  const langId = $derived(pack?.source?.languageId ?? '')
  const modules = $derived(visibleModules(pack))
  const loc = $derived(i18n.locale === 'zh' ? 'zh-CN' : 'en')

  let aboutOpen = $state(false)

  // 日语：首页一打开就读文章列表（隔了一阵也顺便取一次 NHK 的新闻）
  onMount(() => {
    if (packs.active?.id === 'ja' && packs.active.features.texts) reading.ensure()
  })

  /** 框架里的语言（英、法、韩……）：首页一打开就读文章列表，顺便取一次新闻 */
  const lang = $derived(pack ? langModule(pack.id) : null)
  $effect(() => {
    const code = lang?.spec.code
    if (code && pack?.features.texts)
      untrack(() => {
        void langReading.ensure(code)
      })
  })

  // ── 新闻 ──

  /** 首页最多放几篇 */
  const FEED_MAX = 30
  /** NHK 的新闻在前，再是自己导入的，最后是内置的；同一来源新的在前 */
  const RANK: Record<ArticleSource, number> = { nhk: 0, user: 1, aozora: 2 }

  /** 时间：今天的写几点几分，别的写几月几日 */
  function when(iso: string): string {
    const d = new Date(iso)
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(loc, { month: 'short', day: 'numeric' })
  }

  const jaItems = $derived.by<FeedItem[]>(() => {
    if (pack?.id !== 'ja' || !reading.loaded) return []
    const at = (a: ArticleMeta): string => a.publishedAt ?? a.addedAt ?? ''
    return [...reading.articles]
      .sort((a, b) => RANK[a.source] - RANK[b.source] || at(b).localeCompare(at(a)))
      .slice(0, FEED_MAX)
      .map((a) => ({
        key: a.id,
        kicker: [t(`reading.sources.${a.source}`), a.author, topicLabel(a.topic)]
          .filter(Boolean)
          .join(' · '),
        title: a.title,
        titleLang: 'ja',
        lead: a.preview ?? '',
        leadLang: 'ja',
        date: a.publishedAt ? when(a.publishedAt) : '',
        level: a.level ? `N${a.level}` : '',
        read: !!a.readAt
      }))
  })

  /** 一篇课文拿什么当标题和导语：开头的例句或短语（这门语言）配译文；只有文档的用文档标题和第一行 */
  function qonItem(x: QonText): FeedItem {
    const kind = t(`reading.qon.kinds.${x.kind}`)
    const s = project?.sentences.find((y) => y.id === x.sentenceIds[0])
    const line = s ?? project?.phrasebook.find((y) => y.id === x.phraseIds[0])
    if (line)
      return {
        key: x.key,
        kicker: `${kind} · ${x.title}`,
        title: line.text,
        titleLang: pack?.bcp47,
        titleData: true,
        lead: pick(line.translation)
      }
    const doc = project?.docs.find((d) => d.id === x.docId)
    const first = doc?.markdown
      .split('\n')
      .map((l) => l.replace(/^[#>*\-\s]+/, '').trim())
      .find(Boolean)
    return { key: x.key, kicker: kind, title: x.title, lead: first ?? '' }
  }

  const qonItems = $derived.by<FeedItem[]>(() => {
    if (pack?.kind !== 'qonlang' || !project || !langId || !pack.features.texts) return []
    return qonTexts(project, langId, packs.study, packs.hidden, {
      ungrouped: t('reading.qon.ungrouped'),
      phrases: (c) => (c ? t('reading.qon.phrasesOf', { c }) : t('reading.qon.phrases'))
    })
      .slice(0, FEED_MAX)
      .map(qonItem)
  })

  /** 框架语言：新闻在前（新的在前），再是自己导入的、内置课文 */
  const langItems = $derived.by<FeedItem[]>(() => {
    if (!lang || langReading.code !== lang.spec.code || !langReading.loaded) return []
    const levels = primarySystem(lang.spec.levelSystems).levels
    return langReading.articles.slice(0, FEED_MAX).map((a) => ({
      key: a.id,
      kicker: [a.origin ?? t(`langReading.sources.${a.source}`), a.author]
        .filter(Boolean)
        .join(' · '),
      title: a.title,
      titleLang: lang.spec.bcp47,
      lead: a.preview ?? '',
      leadLang: lang.spec.bcp47,
      date: a.publishedAt ? when(a.publishedAt) : '',
      level: a.level ? (levels.find((l) => l.id === a.level)?.short ?? a.level) : '',
      read: !!a.readAt
    }))
  })

  const items = $derived(pack?.kind === 'qonlang' ? qonItems : lang ? langItems : jaItems)
  const hasNews = $derived(
    lang
      ? langReading.articles.some((a) => a.source === 'news')
      : reading.articles.some((a) => a.source === 'nhk')
  )
  const heading = $derived(
    pack?.kind === 'qonlang'
      ? t('home.news.texts')
      : hasNews
        ? t('home.news.title')
        : t('home.news.articles')
  )
  const subheading = $derived(
    new Date().toLocaleDateString(loc, { month: 'long', day: 'numeric', weekday: 'long' })
  )
  const loading = $derived(
    modules.includes('reading') &&
      ((pack?.id === 'ja' && !reading.loaded) || (!!lang && !langReading.loaded))
  )

  /** 点了一篇：打开那篇文章 / 课文；阅读器里点「返回」回到首页的这一篇 */
  function open(key: string): void {
    if (!pack) return
    // A background news refresh may replace the item at the same active index.
    reading.newsAt[pack.id] = key
    if (pack.kind === 'qonlang') {
      const lang = project?.languages.find((l) => l.id === langId)
      if (!lang) return
      const display = packs.study?.display
      // 默认显示方式跟阅读页第一次打开时一样
      const memo = reading.qon(pack.id, {
        showIpa: display?.showIpa ?? true,
        showScript: !!(display?.scriptId ?? lang.scripts[0]?.id)
      })
      memo.text = key
      reading.backTo = 'home'
    } else if (lang) void langReading.open(key, 'home')
    else void reading.open(key, 'home')
    ui.go('reading')
  }

  // ── 底栏 ──

  /** 下一课：第一门还有课没过关的课 */
  const courseNext = $derived.by(() => {
    const p = courses.progress
    if (!p || !modules.includes('courses')) return null
    for (const c of courses.list) {
      const next = nextLesson(c, p)
      if (next) return { course: c, next }
    }
    return courses.list.length ? { course: courses.list[0], next: null } : null
  })
  const courseText = $derived(
    !courseNext
      ? ''
      : courseNext.next
        ? t('home.course.next', {
            course: txt(courseNext.course.title),
            lesson: txt(courseNext.next.lesson.title)
          })
        : t('home.course.done', { course: txt(courseNext.course.title) })
  )

  function continueCourse(): void {
    const n = courseNext
    if (!n) return
    if (n.next) courses.openLesson(n.course.id, n.next.lesson.id)
    else courses.open(n.course.id)
    ui.go('courses')
  }

  const toReview = $derived(notebook.counts.due + notebook.counts.fresh)
  const reviewText = $derived(
    !notebook.nb
      ? ''
      : toReview
        ? t('home.review.counts', { due: notebook.counts.due, fresh: notebook.counts.fresh })
        : Object.keys(notebook.nb.cards).length
          ? t('home.review.done')
          : t('home.review.empty')
  )
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && aboutOpen && (aboutOpen = false)} />

{#if !pack}
  <div class="page">
    <div class="card empty">
      <h1>{t('home.noPack')}</h1>
      <p class="muted">{t('home.noPackHint')}</p>
      <div>
        <button class="btn primary" onclick={() => ui.go('packs')}>{t('home.goPacks')}</button>
      </div>
    </div>
  </div>
{:else}
  <div class="home" data-home>
    <div class="stage">
      {#if items.length}
        {#key pack.id}
          <NewsFeed
            {items}
            {heading}
            {subheading}
            start={reading.newsAt[pack.id] ?? null}
            onopen={open}
            onactive={(key) => (reading.newsAt[pack.id] = key)}
          />
        {/key}
      {:else}
        <div class="placeholder" data-news-empty>
          <h1 class="sr-only">{heading}</h1>
          <p class="muted">
            {loading
              ? t('reading.loading')
              : modules.includes('reading')
                ? t('home.news.empty')
                : t('home.news.noTexts')}
          </p>
        </div>
      {/if}
    </div>

    <footer class="dock" data-home-dock>
      <button
        class="lang"
        data-about
        aria-expanded={aboutOpen}
        title={t('home.dock.about')}
        onclick={() => (aboutOpen = !aboutOpen)}
      >
        <span class="dot" style:background={pack.color}></span>
        <span class="names">
          <strong>{pick(pack.name)}</strong>
          {#if pack.nativeName !== pick(pack.name)}
            <span class="faint" lang={pack.bcp47}>{pack.nativeName}</span>
          {/if}
        </span>
        <Info size={15} />
      </button>
      <span class="sep"></span>
      {#if modules.includes('notebook') && notebook.nb}
        <button
          class="act"
          data-home-review
          data-home-start-review
          data-due={notebook.counts.due}
          data-fresh={notebook.counts.fresh}
          title={reviewText}
          disabled={!toReview}
          onclick={() => {
            if (notebook.startReview()) ui.go('notebook')
          }}
        >
          <NotebookPen size={16} />
          <span class="label">{t('home.review.title')}</span>
          {#if toReview}<b class="badge">{toReview}</b>{/if}
        </button>
      {/if}
      {#if courseNext}
        <button
          class="act wide"
          data-home-course
          data-home-continue
          title={courseText}
          onclick={continueCourse}
        >
          <GraduationCap size={16} />
          <span class="label">{courseText}</span>
        </button>
      {/if}
      {#if modules.includes('practice')}
        <button class="act" data-home-practice onclick={() => ui.go('practice')}>
          <ListChecks size={16} />
          <span class="label">{t('nav.practice')}</span>
        </button>
      {/if}
      <span class="grow"></span>
      {#if pack.id === 'ja' && modules.includes('reading') && ui.prefs.nhkEasy}
        <button
          class="act icon"
          data-news-refresh
          title={t('reading.nhk.refresh')}
          aria-label={t('reading.nhk.refresh')}
          disabled={reading.refreshing}
          onclick={() => reading.refreshNhk()}
        >
          <span class="turn" class:spin={reading.refreshing}><RefreshCw size={16} /></span>
        </button>
      {/if}
      {#if modules.includes('reading')}
        <button class="act" data-news-all onclick={() => ui.go('reading')}>
          <BookOpenText size={16} />
          <span class="label">{t('home.news.all')}</span>
        </button>
      {/if}
    </footer>

    {#if aboutOpen}
      <button
        class="scrim"
        aria-label={t('common.close')}
        tabindex="-1"
        onclick={() => (aboutOpen = false)}
      ></button>
      <div class="drawer">
        <LanguageAbout {pack} onclose={() => (aboutOpen = false)} />
      </div>
    {/if}
  </div>
{/if}

<style>
  .empty {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 28px;
  }
  .home {
    position: relative;
    height: 100%;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    overflow: hidden;
  }
  .stage {
    min-height: 0;
    position: relative;
  }
  .placeholder {
    height: 100%;
    display: grid;
    place-items: center;
    padding: 24px;
    text-align: center;
  }
  .dock {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    border-top: 1px solid var(--border);
    background: color-mix(in srgb, var(--bg-elev) 90%, transparent);
    backdrop-filter: blur(12px);
    min-width: 0;
  }
  .lang {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    cursor: pointer;
    color: var(--text-2);
    min-width: 0;
  }
  .lang:hover,
  .lang[aria-expanded='true'] {
    background: var(--bg-hover);
    color: var(--text);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .names {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    white-space: nowrap;
  }
  .names strong {
    color: var(--text);
  }
  .sep {
    width: 1px;
    height: 22px;
    margin: 0 6px;
    background: var(--border);
  }
  .grow {
    flex: 1;
  }
  .act {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    padding: 7px 12px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: none;
    color: var(--text-2);
    cursor: pointer;
    white-space: nowrap;
  }
  .act:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text);
  }
  .act:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .act :global(svg) {
    flex-shrink: 0;
    color: var(--accent-text);
  }
  .act.wide {
    max-width: 340px;
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .badge {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-contrast);
    font-size: 12px;
    font-weight: 600;
    line-height: 20px;
    text-align: center;
  }
  .icon {
    padding: 7px;
  }
  .turn {
    display: inline-flex;
  }
  .spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .scrim {
    position: absolute;
    inset: 0;
    z-index: 4;
    border: none;
    padding: 0;
    background: color-mix(in srgb, var(--bg) 35%, transparent);
    cursor: default;
  }
  .drawer {
    position: absolute;
    z-index: 5;
    inset-block: 0;
    inset-inline-end: 0;
    width: min(440px, 92%);
    animation: slide-in 0.2s ease-out;
  }
  @keyframes slide-in {
    from {
      transform: translateX(24px);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spin,
    .drawer {
      animation: none;
    }
  }
  @media (max-width: 1100px) {
    .act .label {
      max-width: 9em;
    }
  }
</style>
