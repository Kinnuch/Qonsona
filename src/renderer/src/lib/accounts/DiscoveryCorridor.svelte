<script lang="ts">
  import { ArrowLeft, ArrowRight, Sparkles } from '@lucide/svelte'
  import { i18n } from '$lib/i18n/index.svelte'
  import CompanionSprite from './CompanionSprite.svelte'
  import type { AccountCharacter, CollectionSnapshot } from '$shared/account'

  let {
    catalog,
    pool
  }: { catalog: AccountCharacter[]; pool: NonNullable<CollectionSnapshot['drawPool']> } = $props()
  let hallway = $state<HTMLDivElement>()
  let focusedId = $state('')
  const tr = (zh: string, en: string): string => (i18n.locale === 'zh' ? zh : en)
  const tier = (t: string): string =>
    ({
      A: tr('初识', 'Acquaintance'),
      R: tr('相知', 'Affinity'),
      SR: tr('珍遇', 'Rare encounter'),
      SSR: tr('传颂', 'Legend')
    })[t] ?? t
  const entries = $derived.by(() => {
    const characters = pool.characterIds
      .map((id) => catalog.find((c) => c.id === id))
      .filter((c): c is AccountCharacter => !!c)
    const regular = characters.filter((c) => !pool.ssrIds.includes(c.id))
    const featured = characters.filter((c) => pool.ssrIds.includes(c.id))
    const middle = Math.ceil(regular.length / 2)
    return [...regular.slice(0, middle), ...featured, ...regular.slice(middle)]
  })
  const focusCharacter = $derived(
    pool.characterIds.includes(focusedId) ? catalog.find((c) => c.id === focusedId) : undefined
  )
  const date = (value: number): string =>
    new Intl.DateTimeFormat(i18n.locale === 'zh' ? 'zh-CN' : 'en-GB', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit'
    }).format(value)
  $effect(() => {
    const poolId = pool.id
    if (!hallway || !poolId) return
    const viewport = hallway
    let frame = 0
    const centerFeatured = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const featured = viewport.querySelector<HTMLElement>('[data-pool-featured="true"]')
        if (featured)
          viewport.scrollLeft =
            featured.offsetLeft + featured.offsetWidth / 2 - viewport.clientWidth / 2
      })
    }
    centerFeatured()
    const observer = new ResizeObserver(centerFeatured)
    observer.observe(viewport)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  })
  function scroll(direction: -1 | 1): void {
    if (!hallway) return
    hallway.scrollBy({
      left: direction * Math.max(240, hallway.clientWidth * 0.7),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    })
  }
</script>

<section class="corridor" data-discovery-corridor data-pool-id={pool.id}>
  <div class="heading">
    <div>
      <p class="eyebrow">THE SEVEN-DAY EXHIBITION</p>
      <h2>{tr('本期寻访长廊', 'This week’s discovery gallery')}</h2>
    </div>
    <span class="dates" data-pool-dates
      >{date(pool.startAt)} — {date(pool.endAt - 1)}<small
        >{tr('北京时间 · 每7天焕新', 'Shanghai time · refreshes every 7 days')}</small
      ></span
    >
  </div>
  <p class="intro">
    {tr(
      '本期所有可相遇的语言伙伴都陈列于此。中央聚光展位为本期传颂伙伴，传颂轮完一整轮后再重新随机排序。',
      'Every companion available in this pool is exhibited here. The central spotlight presents this week’s Legend; all Legends appear once before the next shuffled cycle.'
    )}
  </p>
  <div class="hall-shell">
    <div class="cornice" aria-hidden="true"></div>
    <!-- A labelled scroll region must be focusable for its explicit arrow/Home/End navigation. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="hallway"
      bind:this={hallway}
      tabindex="0"
      role="region"
      aria-label={tr(
        '本期全部语言伙伴，左右滚动浏览',
        'All companions in this pool; scroll left and right'
      )}
      onkeydown={(event) => {
        if (event.target !== hallway) return
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          scroll(event.key === 'ArrowLeft' ? -1 : 1)
        }
        if (event.key === 'Home') {
          event.preventDefault()
          hallway.scrollTo({ left: 0 })
        }
        if (event.key === 'End') {
          event.preventDefault()
          hallway.scrollTo({ left: hallway.scrollWidth })
        }
      }}
    >
      <div class="exhibits">
        {#each entries as character (character.id)}
          {@const featured = pool.ssrIds.includes(character.id)}
          <button
            class="exhibit"
            class:featured
            data-pool-character={character.id}
            data-pool-featured={featured}
            aria-pressed={focusedId === character.id}
            onclick={() => (focusedId = focusedId === character.id ? '' : character.id)}
          >
            {#if featured}<div class="spotlight" aria-hidden="true"></div>
              <span class="spotlight-label"
                ><Sparkles size={12} />{tr('本期传颂', 'Featured Legend')}</span
              >{/if}
            <div class="frame">
              <div class="mat"><CompanionSprite {character} width={featured ? 154 : 106} /></div>
            </div>
            <span class="caption"
              ><strong>{character.name[i18n.locale]}</strong><small>{tier(character.tier)}</small
              ></span
            >
          </button>
        {/each}
      </div>
    </div>
    <div class="floor" aria-hidden="true"></div>
  </div>
  <div class="browse">
    <button
      aria-label={tr('向左浏览长廊', 'Browse corridor left')}
      data-corridor-left
      onclick={() => scroll(-1)}><ArrowLeft size={17} /></button
    >
    <span
      >{entries.length}
      {tr(
        '位本期伙伴 · 左右滑动或使用方向键',
        'companions this week · swipe or use arrow keys'
      )}</span
    >
    <button
      aria-label={tr('向右浏览长廊', 'Browse corridor right')}
      data-corridor-right
      onclick={() => scroll(1)}><ArrowRight size={17} /></button
    >
  </div>
  {#if focusCharacter}<div class="selected" data-pool-selection>
      <strong>{focusCharacter.name[i18n.locale]}</strong><span>{tier(focusCharacter.tier)}</span>
      <p>
        {focusCharacter.biography?.introduction ||
          tr('介绍尚未撰写。', 'Introduction has not been written yet.')}
      </p>
    </div>{/if}
</section>

<style>
  .corridor {
    margin-bottom: 25px;
    min-width: 0;
  }
  .heading {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: center;
  }
  h2 {
    font-size: 24px;
    margin: 7px 0 0;
  }
  .eyebrow {
    font-size: 10px;
    letter-spacing: 0.14em;
    color: var(--gallery-ink);
    margin: 0;
  }
  .dates {
    font-size: 14px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .dates small {
    display: block;
    color: var(--text-3);
    font-size: 11px;
    margin-top: 5px;
  }
  .intro {
    font-size: 13px;
    color: var(--text-3);
    max-width: 760px;
    line-height: 1.7;
    margin: 16px 0 23px;
  }
  .hall-shell {
    border-radius: 17px;
    border: 1px solid var(--gallery-border);
    overflow: hidden;
    background: var(--gallery-paper);
    position: relative;
  }
  .cornice {
    height: 12px;
    border-bottom: 1px solid var(--gallery-border);
    background: linear-gradient(var(--gallery-border), transparent);
  }
  .hallway {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--gallery-gold) var(--gallery-paper);
    position: relative;
  }
  .hallway:focus-visible {
    outline: 2px solid var(--gallery-gold);
    outline-offset: -3px;
  }
  .exhibits {
    width: max-content;
    display: flex;
    align-items: flex-end;
    gap: 34px;
    padding: 52px 50px 24px;
    min-height: 333px;
  }
  .exhibit {
    width: 150px;
    min-height: 245px;
    position: relative;
    border: 0;
    padding: 0;
    background: none;
    text-align: center;
    color: var(--text);
    cursor: pointer;
  }
  .exhibit.featured {
    width: 208px;
    min-height: 277px;
    margin-inline: 12px;
  }
  .exhibit:focus-visible {
    outline: 2px solid var(--gallery-gold);
    outline-offset: 5px;
    border-radius: 2px;
  }
  .frame {
    position: relative;
    border: 7px solid #a89768;
    padding: 6px;
    box-shadow:
      0 4px 8px #0002,
      inset 0 0 0 1px #e0d2a273;
    background: #504b32;
    height: 186px;
    z-index: 1;
  }
  .featured .frame {
    height: 226px;
    border-color: #c7b57d;
    box-shadow:
      0 5px 20px #b9a86721,
      0 0 0 1px #dbc6934d;
  }
  .mat {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    background: var(--gallery-mat);
    border: 1px solid #d8c38a12;
    overflow: hidden;
  }
  .spotlight {
    position: absolute;
    pointer-events: none;
    top: -60px;
    left: 50%;
    transform: translateX(-50%);
    width: 294px;
    height: 290px;
    background: linear-gradient(#f3dc9a41, #f3dc9a08);
    clip-path: polygon(44% 0, 56% 0, 100% 100%, 0 100%);
  }
  .spotlight-label {
    position: absolute;
    top: -32px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--gallery-ink);
    font-size: 10px;
    white-space: nowrap;
    letter-spacing: 0.08em;
  }
  .caption {
    display: block;
    padding-top: 16px;
  }
  .caption strong {
    display: block;
    font-size: 13px;
    font-weight: 500;
  }
  .caption small {
    display: block;
    color: var(--gallery-ink);
    font-size: 10px;
    margin-top: 5px;
    letter-spacing: 0.04em;
  }
  .floor {
    height: 22px;
    border-top: 1px solid var(--gallery-border);
    background:
      repeating-linear-gradient(
        90deg,
        transparent 0 135px,
        color-mix(in srgb, var(--gallery-gold) 16%, transparent) 135px 136px
      ),
      linear-gradient(var(--gallery-border), transparent);
  }
  .browse {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    margin-top: 13px;
  }
  .browse span {
    color: var(--text-3);
    font-size: 11px;
    text-align: center;
  }
  .browse button {
    display: grid;
    place-items: center;
    background: var(--gallery-paper);
    color: var(--text);
    border: 1px solid var(--gallery-border);
    border-radius: 50%;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    cursor: pointer;
  }
  .selected {
    margin-top: 17px;
    padding: 16px 19px;
    border-left: 2px solid var(--gallery-gold);
    background: var(--gallery-paper);
    border-radius: 0 10px 10px 0;
    font-size: 13px;
  }
  .selected span {
    margin-left: 12px;
    color: var(--gallery-ink);
    font-size: 11px;
  }
  .selected p {
    margin: 8px 0 0;
    color: var(--text-3);
    font-size: 12px;
  }
  @media (max-width: 736px) {
    .heading {
      align-items: flex-start;
      flex-direction: column;
      gap: 12px;
    }
    .dates {
      text-align: left;
    }
    h2 {
      font-size: 22px;
    }
    .exhibits {
      padding-inline: 30px;
      gap: 25px;
    }
  }
</style>
