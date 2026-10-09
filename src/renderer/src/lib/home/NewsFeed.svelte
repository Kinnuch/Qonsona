<script lang="ts" module>
  /** 新闻流里的一篇 */
  export interface FeedItem {
    key: string
    /** 小字：来源、分类 */
    kicker: string
    /** 大字标题 */
    title: string
    titleLang?: string
    /** 标题用数据字体（人造语言的句子） */
    titleData?: boolean
    /** 正文开头（导语） */
    lead: string
    leadLang?: string
    leadData?: boolean
    date?: string
    level?: string
    read?: boolean
  }
</script>

<script lang="ts">
  // 首页的新闻：上下滑，一次一篇（不自动滚）。滑到哪一篇，那一篇占满版面，上下露出的一点点虚化。
  // 点击正中那篇即可打开阅读；点击上下虚化的那篇先把它移到正中。
  // 快捷键：↑ ↓（或 PageUp / PageDown、K / J）换一篇，回车打开，Home / End 到头、到尾
  import { onMount, untrack } from 'svelte'
  import { ArrowRight, Check } from '@lucide/svelte'
  import { t } from '$lib/i18n/index.svelte'

  let {
    items,
    heading,
    subheading = '',
    start = null,
    onopen,
    onactive
  }: {
    items: FeedItem[]
    heading: string
    subheading?: string
    /** 一打开停在哪一篇（离开首页再回来还在那一篇） */
    start?: string | null
    onopen: (key: string) => void
    onactive?: (key: string) => void
  } = $props()

  let feed = $state<HTMLElement | null>(null)
  /** 可视区的高（一篇占 84%，上下各露 8%） */
  let height = $state(0)
  /** 每一篇离正中有多远（以篇为单位）：0 是正中这篇 */
  let dist = $state<number[]>([])
  let active = $state(0)
  /**
   * 自己滑过、点过没有。没动过时停在最上面那篇（最新的）：后来又取回了新闻，也还是停在最上面；
   * 动过以后，新闻多了、少了都停在原来那篇（anchor）
   */
  let moved = untrack(() => !!start)
  let anchor: string | null = untrack(() => start)

  const slides = (): HTMLElement[] => [
    ...(feed?.querySelectorAll<HTMLElement>('[data-slide]') ?? [])
  ]

  function update(): void {
    const el = feed
    if (!el) return
    const center = el.scrollTop + el.clientHeight / 2
    let best = 0
    let bestD = Infinity
    dist = slides().map((s, i) => {
      const d = Math.abs(s.offsetTop + s.offsetHeight / 2 - center) / Math.max(1, s.offsetHeight)
      if (d < bestD) {
        bestD = d
        best = i
      }
      return d
    })
    if (moved && items[best]) anchor = items[best].key
    if (best !== active) {
      active = best
      if (items[best]) onactive?.(items[best].key)
    }
  }

  let raf = 0
  function onscroll(): void {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(update)
  }

  /** 把第 i 篇移到正中；离得远（隔了两篇以上）直接跳过去 */
  function go(i: number, smooth = true): void {
    const el = feed
    const to = Math.max(0, Math.min(items.length - 1, i))
    const s = slides()[to]
    if (!el || !s) return
    el.scrollTo({
      top: s.offsetTop + s.offsetHeight / 2 - el.clientHeight / 2,
      behavior: smooth && Math.abs(to - active) <= 2 ? 'smooth' : 'instant'
    })
  }

  /** 自己换了一篇 */
  function move(i: number): void {
    moved = true
    go(i)
  }

  // ── 滚轮：一下（或者触控板滑一下）换一篇 ──
  // 浏览器自己的吸附遇到滚轮一格一百来像素会弹回原处，所以滚轮自己管：连着的一串滚轮事件算一下，
  // 一下只换一篇；一直滚着不停的，每隔一会儿再换一篇（触控板松手后的惯性不会连跳好几篇）
  const GESTURE_GAP = 120
  const REPEAT = 1100
  let lastWheel = 0
  let lastMove = 0
  let acc = 0
  let moveInGesture = false

  function onwheel(e: WheelEvent): void {
    // Ctrl + 滚轮是缩放；左右滚不管
    if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
    e.preventDefault()
    const now = performance.now()
    if (now - lastWheel > GESTURE_GAP) {
      acc = 0
      moveInGesture = false
    }
    lastWheel = now
    acc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY
    if (Math.abs(acc) < 24) return
    if (moveInGesture && now - lastMove < REPEAT) return
    move(active + Math.sign(acc))
    acc = 0
    moveInGesture = true
    lastMove = now
  }

  /** 停回该停的那篇：动过的停在原来那篇，没动过的停在最上面 */
  function reposition(): void {
    const i = moved && anchor ? items.findIndex((x) => x.key === anchor) : 0
    go(Math.max(0, i), false)
    update()
  }

  onMount(() => {
    if (feed) height = feed.clientHeight
    // 要拦下浏览器自己的滚动，不能是被动的监听
    feed?.addEventListener('wheel', onwheel, { passive: false })
    const ro = new ResizeObserver(() => {
      if (!feed) return
      height = feed.clientHeight
      // 高度变了（拉窗口）：正中那篇保持在正中
      requestAnimationFrame(reposition)
    })
    if (feed) ro.observe(feed)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
      feed?.removeEventListener('wheel', onwheel)
    }
  })

  // 第一次显示、新闻多了少了（取回了新的）：停回该停的那篇
  $effect(() => {
    void items.map((x) => x.key).join('|')
    untrack(() => requestAnimationFrame(reposition))
  })

  function onkey(e: KeyboardEvent): void {
    const target = e.target instanceof Element ? e.target : null
    if (target?.closest('input, textarea, select, [role="dialog"], [data-about-panel]')) return
    if (e.ctrlKey || e.metaKey || e.altKey || !items.length) return
    const k = e.key
    if (k === 'ArrowDown' || k === 'PageDown' || k === 'j' || k === 'J') move(active + 1)
    else if (k === 'ArrowUp' || k === 'PageUp' || k === 'k' || k === 'K') move(active - 1)
    else if (k === 'Home') move(0)
    else if (k === 'End') move(items.length - 1)
    else if (k === 'Enter' && !target?.closest('button, a')) onopen(items[active].key)
    else return
    e.preventDefault()
  }

  const pad = (n: number): string => String(n).padStart(2, '0')
</script>

<svelte:window onkeydown={onkey} />

<section class="news" aria-label={heading} data-news>
  <header class="masthead">
    <h1 class="heading">{heading}</h1>
    {#if subheading}<span class="sub">{subheading}</span>{/if}
  </header>

  <div
    class="feed"
    role="feed"
    aria-label={heading}
    bind:this={feed}
    {onscroll}
    ontouchstart={() => (moved = true)}
    style:--h="{height}px"
    data-news-feed
    data-active={active}
  >
    <div class="spacer" aria-hidden="true"></div>
    {#each items as it, i (it.key)}
      {@const d = Math.min(dist[i] ?? (i === active ? 0 : 1), 1.4)}
      <article
        class="slide"
        class:on={i === active}
        style:--d={d}
        data-slide
        data-news-item={it.key}
        aria-current={i === active ? 'true' : undefined}
      >
        <span class="numeral" aria-hidden="true">{pad(i + 1)}</span>
        <div
          class="story"
          role="button"
          tabindex={i === active ? 0 : -1}
          aria-label={it.title}
          onclick={() => (i === active ? onopen(it.key) : move(i))}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              if (i === active) onopen(it.key)
              else move(i)
            }
          }}
        >
          <div class="meta">
            <span class="index">{pad(i + 1)}</span>
            <span class="rule"></span>
            <span class="kicker">{it.kicker}</span>
            <span class="grow"></span>
            {#if it.date}<span class="date">{it.date}</span>{/if}
          </div>
          <h2 class="title" class:data={it.titleData} lang={it.titleLang}>{it.title}</h2>
          <span class="divider" aria-hidden="true"></span>
          {#if it.lead}
            <p class="lead" class:data={it.leadData} lang={it.leadLang}>{it.lead}</p>
          {/if}
          <div class="foot">
            <span class="open">{t('home.news.open')}<ArrowRight size={16} /></span>
            {#if it.level}<span class="lv">{it.level}</span>{/if}
            {#if it.read}<span class="read"><Check size={14} />{t('home.news.read')}</span>{/if}
          </div>
        </div>
      </article>
    {/each}
    <div class="spacer" aria-hidden="true"></div>
  </div>

  <nav class="rail" aria-label={t('home.news.rail')}>
    {#each items as it, i (it.key)}
      <button
        class:on={i === active}
        aria-label={`${i + 1} / ${items.length}`}
        aria-current={i === active ? 'true' : undefined}
        data-rail={i}
        onclick={() => move(i)}
      ></button>
    {/each}
  </nav>
</section>

<style>
  .news {
    position: relative;
    height: 100%;
    min-height: 0;
  }
  .masthead {
    position: absolute;
    z-index: 2;
    top: 14px;
    inset-inline-start: 40px;
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 6px 14px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    backdrop-filter: blur(8px);
    pointer-events: none;
  }
  .heading {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.24em;
    color: var(--accent-text);
  }
  .sub {
    font-size: 12px;
    color: var(--text-3);
    letter-spacing: 0.06em;
  }
  .feed {
    position: relative;
    height: 100%;
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    /* 新闻多了少了由这里自己找回位置，不要浏览器的滚动锚定 */
    overflow-anchor: none;
    scrollbar-width: none;
    overscroll-behavior: contain;
  }
  .feed::-webkit-scrollbar {
    display: none;
  }
  /* 正中这篇占 64%，上下各露 18%：露出来的是上一篇的结尾、下一篇的开头，虚化 */
  .spacer {
    height: calc(var(--h) * 0.18);
  }
  .slide {
    position: relative;
    height: calc(var(--h) * 0.64);
    padding: 0 clamp(40px, 7vw, 120px);
    scroll-snap-align: center;
    scroll-snap-stop: always;
    display: flex;
    align-items: center;
  }
  /* 背景里的大号篇序，只描边 */
  .numeral {
    position: absolute;
    inset-inline-end: clamp(40px, 6vw, 110px);
    bottom: 0;
    font-size: clamp(84px, 11vw, 180px);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.04em;
    color: transparent;
    -webkit-text-stroke: 1.5px color-mix(in srgb, var(--accent) 22%, var(--border));
    font-variant-numeric: tabular-nums;
    pointer-events: none;
    user-select: none;
    filter: blur(calc(var(--d) * 6px));
    opacity: calc(1 - min(var(--d), 1) * 0.7);
  }
  .story {
    position: relative;
    width: 100%;
    max-width: 1080px;
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding: 12px 0;
    cursor: pointer;
    outline: none;
    /* 离正中越远越虚、越淡、越小 */
    filter: blur(calc(var(--d) * 6px));
    opacity: calc(1 - min(var(--d), 1) * 0.62);
    transform: scale(calc(1 - min(var(--d), 1) * 0.04));
    transform-origin: left center;
  }
  .story:focus-visible {
    border-radius: 12px;
    box-shadow: 0 0 0 6px var(--accent-soft);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    letter-spacing: 0.14em;
    color: var(--text-3);
    white-space: nowrap;
  }
  .index {
    font-weight: 700;
    color: var(--accent-text);
    font-variant-numeric: tabular-nums;
  }
  .rule {
    width: 40px;
    height: 1px;
    background: var(--accent);
  }
  .kicker {
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .grow {
    flex: 1;
  }
  .title {
    margin: 0;
    max-width: 24em;
    font-size: clamp(28px, 3.6vw, 54px);
    line-height: 1.32;
    font-weight: 700;
    letter-spacing: 0.02em;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: color 0.2s;
  }
  .slide.on .story:hover .title {
    color: var(--accent-text);
  }
  .divider {
    width: 56px;
    height: 2px;
    border-radius: 1px;
    background: var(--accent);
  }
  .lead {
    margin: 0;
    max-width: 42em;
    font-size: clamp(16px, 1.4vw, 20px);
    line-height: 1.95;
    color: var(--text-2);
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  /* 日文用衬线体，像报纸的标题；人造语言用数据字体 */
  .title:lang(ja),
  .lead:lang(ja) {
    font-family: var(--font-serif-ja);
  }
  .data {
    font-family: var(--font-data);
    letter-spacing: 0.01em;
  }
  .foot {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 13px;
    color: var(--text-3);
  }
  .open {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: var(--accent-text);
    letter-spacing: 0.06em;
  }
  .open :global(svg) {
    transition: transform 0.2s;
  }
  .slide.on .story:hover .open :global(svg) {
    transform: translateX(4px);
  }
  .lv {
    padding: 1px 7px;
    border-radius: 4px;
    background: var(--bg-sunken);
    color: var(--text-2);
  }
  .read {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #23804f;
  }
  .rail {
    position: absolute;
    z-index: 2;
    inset-inline-end: 18px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .rail button {
    width: 6px;
    height: 6px;
    padding: 0;
    border: none;
    border-radius: 3px;
    background: var(--border-strong);
    cursor: pointer;
    transition:
      height 0.2s,
      background 0.2s;
  }
  .rail button.on {
    height: 18px;
    background: var(--accent);
  }
  @media (prefers-reduced-motion: reduce) {
    .rail button,
    .title,
    .open :global(svg) {
      transition: none;
    }
  }
</style>
