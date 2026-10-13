<script lang="ts">
  import { onMount } from 'svelte'
  import { LockKeyhole, Sparkles, Check, ArrowUpRight, CalendarDays, X } from '@lucide/svelte'
  import { activity } from '$lib/state/activity.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { i18n, t } from '$lib/i18n/index.svelte'
  import { COLLECTIBLES, REWARD_MINUTES } from '$shared/rewards'
  import { dayKey } from '$shared/srs'
  import dawn from '../assets/collection/companions-dawn.png'
  import journey from '../assets/collection/companions-journey.png'
  const sheets = [dawn, journey]
  let today = $state(dayKey())
  let selected = $state('')
  const rewards = $derived(activity.log?.rewards)
  const day = $derived(rewards?.days[today])
  const count = $derived(Object.keys(rewards?.unlocked ?? {}).length)
  const checked = $derived(!!day?.completions.length)
  const seconds = $derived(day?.seconds ?? 0)
  const minutes = $derived(Math.floor(seconds / 60))
  const chosen = $derived(COLLECTIBLES.find((c) => c.id === selected) ?? COLLECTIBLES[0])
  const unlocked = $derived(rewards?.unlocked[selected])
  const next = $derived(REWARD_MINUTES.find((n) => !day?.claimed.includes(n)) ?? null)
  const dates = $derived(
    Object.entries(rewards?.days ?? {})
      .filter(([, d]) => d.completions.length)
      .sort(([a], [b]) => b.localeCompare(a))
  )
  const name = (c: typeof chosen): string => c.name[i18n.locale]
  const series = (sheet: number): string => (sheet ? t('collection.journey') : t('collection.dawn'))
  const pos = (cell: number): string => `${(cell % 3) * 50}% ${Math.floor(cell / 3) * 100}%`
  onMount(() => {
    const timer = setInterval(() => (today = dayKey()), 1000)
    return () => clearInterval(timer)
  })
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape') selected = ''
  }}
/>
<div class="page collection" data-collection>
  <header class="page-head">
    <div>
      <p class="eyebrow"><Sparkles size={14} />{t('collection.eyebrow')}</p>
      <h1>{t('collection.title')}</h1>
    </div>
    <span class="edition">01 — 12</span>
  </header>
  <section class="hero" aria-label={t('collection.today')}>
    <div class="hero-copy">
      <span class="date"><CalendarDays size={14} />{today}</span>
      <h2>{checked ? t('collection.checked') : t('collection.invitation')}</h2>
      <p>{t('collection.subtitle')}</p>
      <button class="btn study" onclick={() => ui.go('courses')}
        >{t('collection.start')}<ArrowUpRight size={16} /></button
      >
    </div>
    <div class="today-panel">
      <div class="checkin" class:done={checked}>
        {#if checked}<Check size={17} />{:else}<CalendarDays size={17} />{/if}<span
          >{checked ? t('collection.todayDone') : t('collection.todayPending')}</span
        >
      </div>
      <p class="minutes" data-reward-seconds={seconds}>
        {minutes}<span> / 30 {t('collection.minutes')}</span>
      </p>
      <div class="milestones">
        {#each REWARD_MINUTES as n (n)}<div class:reached={day?.claimed.includes(n)}>
            <div class="track">
              <span style:width={`${Math.min(100, (seconds / (n * 60)) * 100)}%`}></span>
            </div>
            <span>{n} {t('collection.minutes')}</span>{#if day?.claimed.includes(n)}<Check
                size={13}
              />{/if}
          </div>{/each}
      </div>
      <p class="hint">
        {!checked
          ? t('collection.completeFirst')
          : next
            ? t('collection.remaining', { n: Math.max(0, Math.ceil((next * 60 - seconds) / 60)) })
            : t('collection.dayComplete')}
      </p>
    </div>
  </section>
  <section class="gallery" aria-label={t('collection.gallery')}>
    <div class="section-head">
      <div>
        <p class="eyebrow">{t('collection.gallery')}</p>
        <h2>{t('collection.companions')}</h2>
      </div>
      <p class="counter" data-collection-count>{count}<span> / 12</span></p>
    </div>
    <div class="collection-grid">
      {#each COLLECTIBLES as c, i (c.id)}{@const owned = !!rewards?.unlocked[c.id]}<button
          class="collectible"
          class:owned
          class:selected={selected === c.id}
          class:new={activity.recentUnlocks.includes(c.id)}
          data-collectible={c.id}
          data-unlocked={owned ? 'true' : 'false'}
          aria-pressed={selected === c.id}
          onclick={() => (selected = c.id)}
          ><span class="serial">{String(i + 1).padStart(2, '0')}</span><span
            class="sprite"
            class:locked={!owned}
            aria-hidden="true"
            style:background-image={`url("${sheets[c.sheet]}")`}
            style:background-position={pos(c.cell)}
          ></span><span class="card-name">{name(c)}</span><span class="card-series"
            >{series(c.sheet)}</span
          ><span class="seal"
            >{#if owned}<Sparkles size={13} />{t('collection.collected')}{:else}<LockKeyhole
                size={13}
              />{t('collection.locked')}{/if}</span
          ></button
        >{/each}
    </div>
  </section>
  {#if selected}<section class="detail" data-collection-detail={selected} aria-live="polite">
      <button
        class="btn ghost detail-close"
        aria-label={t('common.close')}
        data-collection-detail-close
        onclick={() => (selected = '')}><X size={16} /></button
      >
      <div class="portrait" class:locked={!unlocked}>
        <span
          class="sprite large"
          aria-hidden="true"
          style:background-image={`url("${sheets[chosen.sheet]}")`}
          style:background-position={pos(chosen.cell)}
        ></span>
      </div>
      <div class="detail-copy">
        <p class="eyebrow">
          {series(chosen.sheet)} · {String(COLLECTIBLES.indexOf(chosen) + 1).padStart(2, '0')}
        </p>
        <h2>{name(chosen)}</h2>
        {#if unlocked}<p>
            {t('collection.unlockedAt', { day: unlocked.day, n: unlocked.minutes })}
          </p>
          <span class="detail-seal"><Sparkles size={14} />{t('collection.permanent')}</span
          >{:else}<p>
            {t('collection.goal')}
          </p>
          <p class="hint">
            {t('collection.sequence', { n: Math.max(1, COLLECTIBLES.indexOf(chosen) + 1 - count) })}
          </p>{/if}
      </div>
    </section>
  {/if}
  <section class="journal">
    <div>
      <h2>{t('collection.journal')}</h2>
      <p class="muted">{t('collection.rules')}</p>
    </div>
    <div class="days">
      {#each dates.slice(0, 31) as [date, d] (date)}<span class="day-stamp"
          ><Check size={12} />{date}<span
            >{Math.floor(d.seconds / 60)} {t('collection.minutes')}</span
          ></span
        >{:else}<p class="muted">{t('collection.noDays')}</p>{/each}
    </div>
    {#if dates.length > 31}<p class="muted">
        {t('collection.daysTotal', { n: dates.length })}
      </p>{/if}
  </section>
</div>

<style>
  .collection {
    max-width: 1240px;
    padding-bottom: 50px;
  }
  .eyebrow {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 600;
  }
  .edition {
    color: var(--text-3);
    font-family: var(--font-data);
    letter-spacing: 0.2em;
    font-size: 12px;
  }
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(240px, 1fr);
    gap: 35px;
    position: relative;
    isolation: isolate;
    padding: 36px;
    border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
    border-radius: 22px;
    background:
      radial-gradient(
        ellipse at 90% 0%,
        color-mix(in srgb, var(--accent) 13%, transparent),
        transparent 70%
      ),
      linear-gradient(145deg, var(--bg-elev), var(--bg-sunken));
    box-shadow: 0 15px 50px color-mix(in srgb, var(--accent) 6%, transparent);
    overflow: hidden;
  }
  .hero:after {
    content: '';
    position: absolute;
    width: 300px;
    height: 300px;
    border: 1px solid color-mix(in srgb, var(--accent) 13%, transparent);
    border-radius: 50%;
    inset-inline-end: -130px;
    top: -165px;
    z-index: -1;
  }
  .date {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-3);
    font-size: 12px;
  }
  .hero h2 {
    font-size: 28px;
    line-height: 1.4;
    margin: 20px 0 10px;
    letter-spacing: -0.04em;
  }
  .hero-copy > p {
    font-size: 14px;
    line-height: 1.8;
    color: var(--text-2);
    max-width: 45ch;
  }
  .study {
    margin-top: 23px;
    gap: 10px;
    background: var(--accent);
    color: var(--accent-contrast);
    border-color: transparent;
    padding: 10px 16px;
  }
  .today-panel {
    border-inline-start: 1px solid var(--border);
    padding-inline-start: 30px;
    min-width: 0;
  }
  .checkin {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-3);
  }
  .checkin.done {
    color: var(--accent);
  }
  .minutes {
    font-size: 54px;
    letter-spacing: -0.06em;
    line-height: 1.3;
    margin: 14px 0 17px;
    font-variant-numeric: tabular-nums;
  }
  .minutes > span {
    font-size: 13px;
    letter-spacing: 0;
    color: var(--text-3);
  }
  .milestones {
    display: flex;
    gap: 13px;
  }
  .milestones > div {
    flex: 1;
    min-width: 0;
    font-size: 11px;
    color: var(--text-3);
  }
  .milestones .reached {
    color: var(--accent);
  }
  .track {
    height: 4px;
    border-radius: 9px;
    background: var(--border);
    margin-bottom: 8px;
    overflow: hidden;
  }
  .track > span {
    height: 100%;
    display: block;
    background: var(--accent);
    border-radius: inherit;
  }
  .hint {
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.8;
    margin-top: 13px;
  }
  .gallery {
    margin-top: 37px;
  }
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 22px;
  }
  .section-head h2 {
    font-size: 23px;
    margin-top: 6px;
  }
  .counter {
    font-size: 28px;
    letter-spacing: -0.04em;
  }
  .counter > span {
    font-size: 13px;
    color: var(--text-3);
  }
  .collection-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 15px;
  }
  .collectible {
    position: relative;
    text-align: center;
    display: flex;
    align-items: center;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: 15px;
    background: var(--bg-elev);
    padding: 23px 12px 17px;
    min-width: 0;
    cursor: pointer;
    color: var(--text);
    transition:
      transform 0.2s,
      border-color 0.2s,
      box-shadow 0.2s;
  }
  .collectible:hover {
    transform: translateY(-3px);
    box-shadow: 0 9px 25px color-mix(in srgb, var(--accent) 9%, transparent);
  }
  .collectible.selected {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .collectible.owned {
    background: linear-gradient(
      155deg,
      var(--bg-elev),
      color-mix(in srgb, var(--accent) 8%, var(--bg-elev))
    );
    border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
  }
  .serial {
    position: absolute;
    top: 14px;
    inset-inline-start: 15px;
    font-size: 10px;
    letter-spacing: 0.12em;
    color: var(--text-3);
  }
  .sprite {
    display: block;
    width: 126px;
    height: auto;
    aspect-ratio: 42 / 39;
    max-width: 100%;
    background-size: 300% 200%;
    background-repeat: no-repeat;
    image-rendering: pixelated;
    filter: drop-shadow(0 5px 6px #31475322);
  }
  .sprite.locked {
    filter: grayscale(1) brightness(0.7);
    opacity: 0.35;
  }
  .card-name {
    font-size: 15px;
    font-weight: 600;
    margin: 5px 0;
  }
  .card-series {
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--text-3);
  }
  .seal {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 15px;
    font-size: 11px;
    color: var(--text-3);
  }
  .owned .seal {
    color: var(--accent);
  }
  .detail-close {
    position: absolute;
    top: 12px;
    inset-inline-end: 12px;
    padding: 4px;
  }
  .detail {
    position: relative;
    margin-top: 32px;
    padding: 27px;
    display: flex;
    align-items: center;
    gap: 30px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--bg-elev);
  }
  .portrait {
    border-radius: 15px;
    background: radial-gradient(
      ellipse,
      color-mix(in srgb, var(--accent) 20%, var(--bg-sunken)),
      var(--bg-sunken)
    );
    min-width: 168px;
    display: grid;
    place-items: center;
  }
  .large {
    width: 168px;
    height: auto;
  }
  .portrait.locked .sprite {
    filter: grayscale(1);
    opacity: 0.4;
  }
  .detail h2 {
    font-size: 26px;
    margin: 9px 0;
  }
  .detail-copy p {
    line-height: 1.8;
    color: var(--text-2);
  }
  .detail-seal {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--accent);
    margin-top: 12px;
  }
  .journal {
    padding-top: 32px;
  }
  .journal h2 {
    font-size: 19px;
    margin-bottom: 8px;
  }
  .journal > div > p {
    font-size: 12px;
    line-height: 1.9;
    max-width: 90ch;
  }
  .days {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }
  .day-stamp {
    display: flex;
    gap: 7px;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 7px 9px;
    font-size: 11px;
    color: var(--text-2);
  }
  .day-stamp :global(svg) {
    color: var(--accent);
  }
  .day-stamp > span {
    color: var(--text-3);
    font-size: 10px;
  }
  .new {
    animation: arrival 0.65s ease-out both;
  }
  @keyframes arrival {
    from {
      transform: translateY(8px) scale(0.96);
      box-shadow: 0 0 0 7px color-mix(in srgb, var(--accent) 20%, transparent);
    }
    to {
      transform: none;
      box-shadow: 0 0 0 0 transparent;
    }
  }
  @media (max-width: 1050px) {
    .collection-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .hero {
      padding: 25px;
      gap: 22px;
    }
    .today-panel {
      padding-inline-start: 22px;
    }
  }
  @media (max-width: 800px) {
    .hero {
      grid-template-columns: minmax(0, 1fr);
    }
    .today-panel {
      border-inline-start: 0;
      border-top: 1px solid var(--border);
      padding: 20px 0 0;
    }
    .collection-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .detail-close {
      position: absolute;
      top: 12px;
      inset-inline-end: 12px;
      padding: 4px;
    }
    .detail {
      position: relative;
      gap: 16px;
      padding: 20px;
      flex-wrap: wrap;
    }
    .portrait {
      min-width: 126px;
    }
    .large {
      width: 126px;
      height: auto;
    }
    .hero h2 {
      font-size: 24px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .new {
      animation: none;
    }
    .collectible {
      transition: none;
    }
    .collectible:hover {
      transform: none;
    }
  }
</style>
