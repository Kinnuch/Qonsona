<script lang="ts">
  // 统计：正在学的这门语言连续学了几天、学了多久（每天的时长图、各模块用时）、
  // 生词本里学过几个词、课程过了几课（语法点几个）、练习做了多少题、模拟考最好成绩
  import {
    ChartColumn,
    Flame,
    Clock,
    BookA,
    GraduationCap,
    ListChecks,
    CalendarDays
  } from '@lucide/svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { notebook } from '$lib/state/notebook.svelte'
  import { courses } from '$lib/state/courses.svelte'
  import { practice } from '$lib/state/practice.svelte'
  import { activity } from '$lib/state/activity.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { txt } from '$lib/courses/view'
  import { countStatuses, type CardStatus } from '$shared/notebook'
  import { allLessons, courseSummary, lessonState } from '$shared/course'
  import { dayKey } from '$shared/srs'
  import {
    MIN_SECONDS,
    lastDays,
    longestStreak,
    secondsByModule,
    secondsOn,
    streak
  } from '$shared/stats'
  import { visibleModules } from '$lib/packs/modules'
  import type { ModuleId } from '$lib/packs/types'

  const packId = $derived(packs.active?.id ?? '')
  const log = $derived(activity.log)
  const days30 = $derived(lastDays(30))
  const today = $derived(dayKey())

  /** 学过的日子：学满一分钟，或者复习过、做过题、学过课 */
  const studied = $derived.by(() => {
    const out = new Set<string>()
    if (log)
      for (const day of Object.keys(log.days))
        if (secondsOn(log, day, packId) >= MIN_SECONDS) out.add(day)
    for (const [day, d] of Object.entries(notebook.nb?.days ?? {})) if (d.total > 0) out.add(day)
    for (const [day, d] of Object.entries(practice.log?.days ?? {}))
      if (d.answered > 0) out.add(day)
    for (const r of Object.values(courses.progress?.lessons ?? {})) if (r.at) out.add(dayKey(r.at))
    return out
  })
  const run = $derived(streak(studied))
  const longest = $derived(longestStreak(studied))

  const minutes = (s: number): number => Math.round(s / 60)
  const todaySec = $derived(log ? secondsOn(log, today, packId) : 0)
  const weekSec = $derived(log ? lastDays(7).reduce((n, d) => n + secondsOn(log, d, packId), 0) : 0)
  const totalSec = $derived(
    log ? Object.keys(log.days).reduce((n, d) => n + secondsOn(log, d, packId), 0) : 0
  )
  /** 累计时长：不到一小时写分钟，十小时以内留一位小数 */
  const long = (s: number): string =>
    s < 3600
      ? t('statsPage.minutes', { n: minutes(s) })
      : t('statsPage.hours', { n: (s / 3600).toFixed(s < 36000 ? 1 : 0) })

  // ── 每天的时长（最近 30 天） ──
  const bars = $derived(
    days30.map((day) => ({
      day,
      sec: log ? secondsOn(log, day, packId) : 0,
      answered: practice.log?.days[day]?.answered ?? 0,
      reviewed: notebook.nb?.days[day]?.total ?? 0
    }))
  )
  const maxSec = $derived(Math.max(60 * 10, ...bars.map((b) => b.sec)))
  /** 图下的日期：月/日 */
  const short = (day: string): string => {
    const [, m, d] = day.split('-').map(Number)
    return `${m}/${d}`
  }
  const barTitle = (b: (typeof bars)[number]): string =>
    t('statsPage.barTitle', { day: b.day, m: minutes(b.sec), q: b.answered, r: b.reviewed })

  // ── 各模块用时（最近 30 天） ──
  const byModule = $derived.by(() => {
    if (!log) return []
    const m = secondsByModule(log, packId, days30)
    const known = new Set<string>(visibleModules(packs.active))
    return Object.entries(m)
      .filter(([k, s]) => known.has(k) && s >= 30)
      .sort((a, b) => b[1] - a[1])
      .map(([k, s]) => ({ id: k as ModuleId, sec: s }))
  })
  const maxModule = $derived(Math.max(1, ...byModule.map((x) => x.sec)))

  // ── 生词本 ──
  const cards = $derived(Object.values(notebook.nb?.cards ?? {}))
  const statuses = $derived(countStatuses(cards))
  const learnedWords = $derived(cards.length - statuses.new)
  const STATUS_ORDER: CardStatus[] = ['known', 'unsure', 'forgot', 'new']

  // ── 课程：每门课过了几课；语法课过了的课里有几个语法点 ──
  const courseRows = $derived(
    courses.progress ? courses.list.map((c) => ({ c, s: courseSummary(c, courses.progress!) })) : []
  )
  const grammar = $derived.by(() => {
    const p = courses.progress
    let done = 0
    let total = 0
    if (!p) return { done, total }
    for (const c of courses.list.filter((x) => x.kind === 'grammar'))
      for (const r of allLessons(c)) {
        total += r.lesson.items.length
        if (lessonState(p, c, r.lesson.id) === 'passed') done += r.lesson.items.length
      }
    return { done, total }
  })

  // ── 练习与模拟考 ──
  const practiced = $derived(
    Object.values(practice.log?.days ?? {}).reduce(
      (a, d) => ({ n: a.n + d.answered, right: a.right + d.right }),
      { n: 0, right: 0 }
    )
  )
  const exams = $derived.by(() => {
    const by = new Map<
      string,
      { best: number | null; right: number; total: number; n: number; passed: number }
    >()
    for (const e of practice.log?.exams ?? []) {
      const x = by.get(e.level) ?? { best: null, right: 0, total: 0, n: 0, passed: 0 }
      x.n++
      if (e.outcome.passed) x.passed++
      if (e.outcome.scaled !== null) x.best = Math.max(x.best ?? 0, e.outcome.scaled)
      else if (e.outcome.right / e.outcome.total > x.right / (x.total || 1)) {
        x.right = e.outcome.right
        x.total = e.outcome.total
      }
      by.set(e.level, x)
    }
    return [...by.entries()]
  })
</script>

<div class="page" data-stats>
  <header class="page-head">
    <ChartColumn size={22} strokeWidth={1.8} />
    <h1>{t('nav.stats')}</h1>
  </header>

  <div class="tiles">
    <div class="card tile" data-tile="streak">
      <span class="label muted"><Flame size={15} />{t('statsPage.streak')}</span>
      <span class="num">{t('statsPage.days', { n: run.days })}</span>
      <span class="faint"
        >{run.today || !run.days
          ? t('statsPage.longest', { n: longest })
          : t('statsPage.keepGoing')}</span
      >
    </div>
    <div class="card tile" data-tile="today">
      <span class="label muted"><Clock size={15} />{t('statsPage.today')}</span>
      <span class="num">{t('statsPage.minutes', { n: minutes(todaySec) })}</span>
      <span class="faint">{t('statsPage.week', { n: minutes(weekSec) })}</span>
    </div>
    <div class="card tile" data-tile="total">
      <span class="label muted"><CalendarDays size={15} />{t('statsPage.total')}</span>
      <span class="num">{long(totalSec)}</span>
      <span class="faint">{t('statsPage.studyDays', { n: studied.size })}</span>
    </div>
    {#if notebook.nb}
      <div class="card tile" data-tile="words">
        <span class="label muted"><BookA size={15} />{t('statsPage.words')}</span>
        <span class="num">{learnedWords}</span>
        <span class="faint"
          >{t('statsPage.wordsKnown', { n: statuses.known, total: cards.length })}</span
        >
      </div>
    {/if}
    {#if grammar.total}
      <div class="card tile" data-tile="grammar">
        <span class="label muted"><GraduationCap size={15} />{t('statsPage.grammar')}</span>
        <span class="num">{grammar.done}</span>
        <span class="faint">{t('statsPage.ofTotal', { total: grammar.total })}</span>
      </div>
    {/if}
    {#if practice.log}
      <div class="card tile" data-tile="practice">
        <span class="label muted"><ListChecks size={15} />{t('statsPage.practice')}</span>
        <span class="num">{practiced.n}</span>
        <span class="faint"
          >{practiced.n
            ? t('statsPage.accuracy', { pct: Math.round((practiced.right / practiced.n) * 100) })
            : t('statsPage.noPractice')}</span
        >
      </div>
    {/if}
  </div>

  <section class="card chart-card">
    <h3>{t('statsPage.last30')}</h3>
    <div class="chart" role="img" aria-label={t('statsPage.last30')} data-chart>
      {#each bars as b, i (b.day)}
        <div class="col" title={barTitle(b)} data-day={b.day}>
          <div
            class="bar"
            class:today={b.day === today}
            style:height="{(b.sec / maxSec) * 100}%"
          ></div>
          <span class="tick faint">{i % 5 === 4 || i === bars.length - 1 ? short(b.day) : ''}</span>
        </div>
      {/each}
    </div>
    {#if !totalSec}<p class="faint">{t('statsPage.noTime')}</p>{/if}
  </section>

  <div class="grid">
    {#if byModule.length}
      <section class="card">
        <h3>{t('statsPage.byModule')}</h3>
        <ul class="hbars">
          {#each byModule as m (m.id)}
            <li>
              <button class="link" onclick={() => ui.go(m.id)}>{t('nav.' + m.id)}</button>
              <span class="track"><span style:width="{(m.sec / maxModule) * 100}%"></span></span>
              <span class="faint">{t('statsPage.minutes', { n: minutes(m.sec) })}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if courseRows.length}
      <section class="card" data-stats-courses>
        <h3>{t('statsPage.courses')}</h3>
        <ul class="hbars">
          {#each courseRows as r (r.c.id)}
            <li>
              <span class="name">{txt(r.c.title)}</span>
              <span class="track"
                ><span style:width="{r.s.lessons ? (r.s.passed / r.s.lessons) * 100 : 0}%"
                ></span></span
              >
              <span class="faint">{r.s.passed} / {r.s.lessons}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if cards.length}
      <section class="card">
        <h3>{t('statsPage.notebook')}</h3>
        <div class="stack-bar">
          {#each STATUS_ORDER as st (st)}
            {#if statuses[st]}
              <span
                class="seg {st}"
                style:flex={statuses[st]}
                title="{t(`notebook.status.${st}`)} {statuses[st]}"
              ></span>
            {/if}
          {/each}
        </div>
        <ul class="legend">
          {#each STATUS_ORDER as st (st)}
            <li>
              <span class="dot {st}"></span>{t(`notebook.status.${st}`)} <b>{statuses[st]}</b>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if exams.length}
      <section class="card">
        <h3>{t('statsPage.exams')}</h3>
        <ul class="exams">
          {#each exams as [level, x] (level)}
            <li>
              <strong>{level}</strong>
              <span>{t('statsPage.examBest', { n: x.best ?? `${x.right}/${x.total}` })}</span>
              <span class="faint">{t('statsPage.examTimes', { n: x.n, passed: x.passed })}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>
</div>

<style>
  .page-head :global(svg) {
    color: var(--accent-text);
    align-self: center;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 10px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .label :global(svg) {
    color: var(--accent-text);
  }
  .num {
    font-size: 26px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .chart-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .chart {
    height: 150px;
    display: flex;
    align-items: stretch;
    gap: 3px;
  }
  .col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 4px;
  }
  .bar {
    width: 100%;
    min-height: 2px;
    border-radius: 3px 3px 0 0;
    background: color-mix(in srgb, var(--accent) 60%, var(--bg-sunken));
  }
  .bar.today {
    background: var(--accent);
  }
  .tick {
    height: 14px;
    font-size: 10px;
    text-align: center;
    white-space: nowrap;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 12px;
  }
  .grid > .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .hbars,
  .legend,
  .exams {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hbars li {
    display: grid;
    grid-template-columns: minmax(70px, 110px) 1fr auto;
    align-items: center;
    gap: 10px;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    text-align: start;
    cursor: pointer;
    color: inherit;
  }
  .link:hover {
    color: var(--accent-text);
  }
  .track {
    height: 8px;
    border-radius: 4px;
    background: var(--bg-sunken);
    overflow: hidden;
  }
  .track span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
  .stack-bar {
    display: flex;
    height: 12px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-sunken);
  }
  .seg.known,
  .dot.known {
    background: #2f9e63;
  }
  .seg.unsure,
  .dot.unsure {
    background: #d08a26;
  }
  .seg.forgot,
  .dot.forgot {
    background: var(--danger);
  }
  .seg.new,
  .dot.new {
    background: var(--border-strong);
  }
  .legend {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px 16px;
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .exams li {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
</style>
