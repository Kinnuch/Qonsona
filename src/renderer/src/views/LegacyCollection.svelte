<script lang="ts">
  import { activity } from '$lib/state/activity.svelte'
  import { i18n } from '$lib/i18n/index.svelte'
  import { COLLECTIBLES } from '$shared/rewards'
  import dawn from '../assets/collection/companions-dawn.png'
  import journey from '../assets/collection/companions-journey.png'
  const sheets = [dawn, journey]
  const owned = $derived(COLLECTIBLES.filter((c) => activity.log?.rewards?.unlocked[c.id]))
</script>

<section data-local-memorial>
  <h3>
    {i18n.locale === 'zh' ? '本机保留的旧纪念' : 'Earlier memorials stored on this device'} ({owned.length}/12)
  </h3>
  <p class="muted">
    {i18n.locale === 'zh'
      ? '旧纪念已冻结，不再按旧版时间门槛发放伙伴。未取得的新伙伴请通过账号商店或寻访获得。'
      : 'Earlier memorials are frozen. The old time thresholds no longer grant companions. Obtain new companions through the account shop or discovery.'}
  </p>
  <div class="grid">
    {#each owned as c (c.id)}{@const u = activity.log?.rewards?.unlocked[c.id]}
      <div class="card">
        <span
          class="sprite"
          style:background-image={`url("${sheets[c.sheet]}")`}
          style:background-position={`${(c.cell % 3) * 50}% ${Math.floor(c.cell / 3) * 100}%`}
        ></span><strong>{c.name[i18n.locale]}</strong><small
          >{u?.day} · {u?.minutes} {i18n.locale === 'zh' ? '分钟' : 'minutes'}</small
        >
      </div>{:else}<p class="muted">
        {i18n.locale === 'zh' ? '本机没有旧纪念。' : 'No earlier memorials on this device.'}
      </p>{/each}
  </div>
</section>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
    gap: 12px;
    margin-top: 20px;
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 15px;
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  .sprite {
    width: 126px;
    max-width: 100%;
    aspect-ratio: 42/39;
    display: block;
    background-size: 300% 200%;
    background-repeat: no-repeat;
    image-rendering: pixelated;
  }
  small {
    font-size: 12px;
    color: var(--text-3);
  }
  .muted {
    line-height: 1.8;
    font-size: 13px;
  }
</style>
