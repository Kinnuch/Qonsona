<script lang="ts">
  import { ChevronDown, Check } from '@lucide/svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { t, pick } from '$lib/i18n/index.svelte'
  import { SYSTEM_MODULES, moduleVisible, visibleModules } from '$lib/packs/modules'
  import { MODULE_ICONS } from '$lib/ui/icons'
  import type { ModuleId } from '$lib/packs/types'
  import Home from './Home.svelte'
  import Packs from './Packs.svelte'
  import Settings from './Settings.svelte'
  import Dictionary from './Dictionary.svelte'
  import Reading from './Reading.svelte'
  import Notebook from './Notebook.svelte'
  import Courses from './Courses.svelte'
  import Practice from './Practice.svelte'
  import Media from './Media.svelte'
  import Stats from './Stats.svelte'
  import Collection from './Collection.svelte'
  import Leaderboards from './Leaderboards.svelte'

  const learn = $derived(visibleModules(packs.active))
  /** 有说明的模块（鼠标移到导航上显示） */
  const DESCRIBED = new Set<ModuleId>([
    'reading',
    'courses',
    'dictionary',
    'notebook',
    'practice',
    'media',
    'stats'
  ])
  let switcherOpen = $state(false)

  // 换了语言后当前模块不存在了（比如从日语的「视听」换到人造语言），回到首页
  $effect(() => {
    if (!moduleVisible(ui.section, packs.active)) ui.go('home')
  })

  async function choose(id: string): Promise<void> {
    switcherOpen = false
    await packs.activate(id)
  }

  function onwindowpointerdown(e: PointerEvent): void {
    if (switcherOpen && !(e.target as Element).closest('.switcher')) switcherOpen = false
  }
</script>

<svelte:window
  onpointerdown={onwindowpointerdown}
  onkeydown={(e) => e.key === 'Escape' && (switcherOpen = false)}
/>

{#snippet navItem(id: ModuleId)}
  {@const Icon = MODULE_ICONS[id]}
  <button
    class="nav-item"
    class:on={ui.section === id}
    data-nav={id}
    title={DESCRIBED.has(id) ? t(`modules.${id}.desc`) : undefined}
    aria-current={ui.section === id ? 'page' : undefined}
    onclick={() => ui.go(id)}
  >
    <Icon size={18} strokeWidth={1.8} />
    <span>{t('nav.' + id)}</span>
  </button>
{/snippet}

<div class="shell">
  <nav class="nav">
    <div class="switcher">
      <button
        class="current"
        data-switcher
        aria-haspopup="menu"
        aria-expanded={switcherOpen}
        onclick={() => (switcherOpen = !switcherOpen)}
      >
        <span class="dot" style:background={packs.active?.color ?? 'var(--border-strong)'}></span>
        <span class="names">
          <span class="label">{t('switcher.label')}</span>
          <span class="name">{packs.active ? pick(packs.active.name) : t('switcher.none')}</span>
        </span>
        <ChevronDown size={16} />
      </button>
      {#if switcherOpen}
        <div class="menu" role="menu">
          {#each packs.all as p (p.id)}
            <button class="menu-item" role="menuitem" data-pack={p.id} onclick={() => choose(p.id)}>
              <span class="dot" style:background={p.color}></span>
              <span class="grow">{pick(p.name)}</span>
              {#if p.nativeName && p.nativeName !== pick(p.name)}
                <span class="faint">{p.nativeName}</span>
              {/if}
              {#if p.id === packs.active?.id}<Check size={14} />{/if}
            </button>
          {/each}
          <div class="sep"></div>
          <button
            class="menu-item"
            role="menuitem"
            onclick={() => {
              switcherOpen = false
              ui.go('packs')
            }}
          >
            {t('switcher.manage')}
          </button>
        </div>
      {/if}
    </div>

    <div class="nav-sections" data-nav-scroll>
      <div class="group">
        {#each learn as id (id)}
          {@render navItem(id)}
        {/each}
      </div>
      <div class="grow"></div>
      <div class="group">
        {#each SYSTEM_MODULES as id (id)}
          {@render navItem(id)}
        {/each}
      </div>
    </div>
  </nav>

  <main class="main" data-main-scroll>
    <!-- 页面出错时显示错误卡片，同时打到控制台（冒烟测试靠它发现崩溃） -->
    <svelte:boundary onerror={(e) => console.error(e)}>
      {#key ui.section + '|' + (ui.section === 'collection' || ui.section === 'leaderboards' ? 'account' : (packs.active?.id ?? ''))}
        {#if ui.section === 'home'}
          <Home />
        {:else if ui.section === 'packs'}
          <Packs />
        {:else if ui.section === 'settings'}
          <Settings />
        {:else if ui.section === 'dictionary'}
          <Dictionary />
        {:else if ui.section === 'reading'}
          <Reading />
        {:else if ui.section === 'notebook'}
          <Notebook />
        {:else if ui.section === 'courses'}
          <Courses />
        {:else if ui.section === 'practice'}
          <Practice />
        {:else if ui.section === 'media'}
          <Media />
        {:else if ui.section === 'collection'}
          <Collection />
        {:else if ui.section === 'leaderboards'}
          <Leaderboards />
        {:else if ui.section === 'stats'}
          <Stats />
        {/if}
      {/key}
      {#snippet failed(error, reset)}
        <div class="page">
          <div class="card crash">
            <h2>{String((error as Error)?.message ?? error)}</h2>
            <button class="btn" onclick={reset}>{t('common.close')}</button>
          </div>
        </div>
      {/snippet}
    </svelte:boundary>
  </main>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: var(--nav-w) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .nav {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 10px;
    background: var(--bg-sunken);
    border-inline-end: 1px solid var(--border);
    min-height: 0;
    min-width: 0;
  }
  .nav-sections {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior-y: contain;
  }
  .nav-sections > .group {
    flex-shrink: 0;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .grow {
    flex: 1;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-2);
    cursor: pointer;
    text-align: start;
  }
  .nav-item:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
  .nav-item.on {
    background: var(--accent-soft);
    color: var(--accent-text);
    font-weight: 600;
  }
  .switcher {
    position: relative;
    flex-shrink: 0;
  }
  .current {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-elev);
    cursor: pointer;
    text-align: start;
  }
  .current:hover {
    border-color: var(--border-strong);
  }
  .names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .label {
    font-size: 11px;
    color: var(--text-3);
  }
  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    inset-inline: 0;
    min-width: 220px;
    max-height: min(70vh, 480px);
    overflow-y: auto;
    padding: 4px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    z-index: 50;
  }
  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    cursor: pointer;
    text-align: start;
  }
  .menu-item:hover {
    background: var(--bg-hover);
  }
  .sep {
    height: 1px;
    margin: 4px 0;
    background: var(--border);
  }
  .main {
    overflow: auto;
    min-width: 0;
    min-height: 0;
    scrollbar-gutter: stable;
    overscroll-behavior: contain;
  }
  .crash {
    border-color: var(--danger);
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  @media (max-width: 800px) {
    .shell {
      grid-template-columns: 176px minmax(0, 1fr);
    }
    .nav {
      padding-inline: 8px;
    }
  }
  @media (max-width: 600px) {
    .shell {
      grid-template-columns: 160px minmax(0, 1fr);
    }
    .nav-item {
      gap: 8px;
      padding-inline: 8px;
    }
  }
</style>
