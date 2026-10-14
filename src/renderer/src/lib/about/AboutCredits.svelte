<script lang="ts">
  import { ExternalLink, HeartHandshake, User } from '@lucide/svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { CREDITS, DEV } from './credits'

  let section = $state<'developer' | 'credits'>('developer')
</script>

<div class="about-people" data-about-people>
  <div class="people-switch" role="group" aria-label={t('settings.people')}>
    <button
      class="btn"
      class:active={section === 'developer'}
      aria-pressed={section === 'developer'}
      data-about-developer
      onclick={() => (section = 'developer')}
    >
      <User size={16} />{t('settings.developer')}
    </button>
    <button
      class="btn"
      class:active={section === 'credits'}
      aria-pressed={section === 'credits'}
      data-about-credits
      onclick={() => (section = 'credits')}
    >
      <HeartHandshake size={16} />{t('settings.credits')}
    </button>
  </div>

  {#if section === 'developer'}
    <section class="people-content developer" aria-label={t('settings.developer')} data-developer>
      <h4>{DEV.name}</h4>
      <div class="developer-links">
        <a href={DEV.site} target="_blank" rel="noreferrer">
          <span>{DEV.site}</span><ExternalLink size={14} aria-hidden="true" />
        </a>
        <a href={DEV.github} target="_blank" rel="noreferrer">
          <span>{DEV.github}</span><ExternalLink size={14} aria-hidden="true" />
        </a>
        <a href={DEV.bilibili} target="_blank" rel="noreferrer">
          <span>Bilibili · {DEV.bilibiliName}</span><ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
      <p class="muted">{DEV.email}</p>
    </section>
  {:else}
    <section class="people-content credits" aria-label={t('settings.credits')} data-credits>
      {#each CREDITS as credit (credit.role)}
        <div class="credit-group" data-credit-role={credit.role}>
          <h4>{t(`settings.creditRoles.${credit.role}`)}</h4>
          <div class="credit-names">
            {#each credit.names as person (person.name)}
              <span class="credit-name">
                {#if person.icon}
                  <img
                    class:pixel={person.art === 'pixel'}
                    class:logo-art={person.art === 'logo'}
                    src={person.icon}
                    alt={person.name}
                    width="49"
                    height={person.art === 'pixel' ? 58 : 49}
                  />
                {/if}
                <strong>{person.name}</strong>
              </span>
            {/each}
          </div>
        </div>
      {/each}
    </section>
  {/if}
</div>

<style>
  .about-people {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-block-start: 4px;
    padding-block-start: 16px;
    border-block-start: 1px solid var(--border);
    min-width: 0;
  }
  .people-switch {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .people-switch .active {
    color: var(--accent-text);
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .people-content {
    min-width: 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
  }
  h4 {
    margin: 0;
    font-size: 14px;
  }
  .developer,
  .developer-links,
  .credits {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .developer p {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .developer-links a {
    display: flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    max-width: 100%;
    color: var(--accent-text);
    text-decoration: none;
  }
  .developer-links a span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .developer-links a:hover span {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .developer-links :global(svg) {
    flex-shrink: 0;
  }
  .credit-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .credit-group + .credit-group {
    padding-block-start: 14px;
    border-block-start: 1px solid var(--border);
  }
  .credit-group h4 {
    color: var(--text-2);
    font-weight: 500;
    font-size: 13px;
  }
  .credit-names {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 24px;
  }
  .credit-name {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    max-width: 100%;
  }
  .credit-name strong {
    overflow-wrap: anywhere;
  }
  .credit-name img {
    flex-shrink: 0;
    object-fit: contain;
    max-width: 100%;
  }
  /* scarps 原图为 49×58，保持原像素大小；只有窄于原图时才缩小。 */
  .credit-name .pixel {
    width: auto;
    height: auto;
    image-rendering: pixelated;
  }
  .credit-name .logo-art {
    width: 49px;
    height: 49px;
  }
</style>
