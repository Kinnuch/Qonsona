<script lang="ts">
  import { CalendarDays, Coffee, Ticket } from '@lucide/svelte'
  import { i18n } from '$lib/i18n/index.svelte'
  import CompanionSprite from './CompanionSprite.svelte'
  import type { AccountCharacter, AccountShopItem, CollectionSnapshot } from '$shared/account'

  let {
    items,
    snapshot,
    online,
    guest = false,
    starterAvailable = false,
    busy = false,
    redeem,
    support,
    supportEntry = false,
    supportOpen = false
  }: {
    items: AccountShopItem[]
    snapshot: Omit<CollectionSnapshot, 'user'>
    online: boolean
    guest?: boolean
    starterAvailable?: boolean
    busy?: boolean
    redeem: (item: AccountShopItem) => void
    support?: () => void
    supportEntry?: boolean
    supportOpen?: boolean
  } = $props()
  const tr = (zh: string, en: string): string => (i18n.locale === 'zh' ? zh : en)
  const name = (c: AccountCharacter): string => c.name[i18n.locale]
  const payments = $derived(snapshot.payments)
  function itemName(item: AccountShopItem): string {
    const character = snapshot.catalog.find((c) => c.id === item.characterId)
    if (character) return name(character)
    if (item.currency === 'echoes' && item.type === 'ticket')
      return tr('余韵兑换 · 学习寻访笺', 'Echo exchange · learning ticket')
    return item.type === 'ticket'
      ? tr('学习寻访笺', 'Learning discovery ticket')
      : tr('续页笺', 'Makeup slip')
  }
</script>

<div class="products" class:supplies={supportEntry} data-shop-products>
  {#each items as item (item.id)}
    {@const balance =
      item.currency === 'points' ? snapshot.balances.points : snapshot.balances.echoes}
    {@const already =
      item.type === 'character' && snapshot.characters.some((c) => c.id === item.characterId)}
    {@const character = snapshot.catalog.find((c) => c.id === item.characterId)}
    {@const freeStarter =
      guest &&
      starterAvailable &&
      item.type === 'character' &&
      character?.tier === 'A' &&
      !character.special}
    {@const showSupport =
      !!support &&
      item.currency === 'points' &&
      (item.type === 'ticket' || item.type === 'makeup') &&
      balance < item.price}
    <section class="product" data-shop-product={item.id}>
      <div class="art">
        {#if character}<CompanionSprite {character} width={106} />
        {:else if item.type === 'ticket'}<Ticket size={40} strokeWidth={1.2} />
        {:else}<CalendarDays size={40} strokeWidth={1.2} />{/if}
        {#if !guest && item.discount}<span class="discount">−50%</span>{/if}
      </div>
      <h3>{itemName(item)}</h3>
      <p class="price">
        {#if freeStarter}<strong>{tr('免费', 'Free')}</strong><small
            >{tr('本机任选一只 · 限一次', 'Choose one on this device · once')}</small
          >
        {:else}
          {#if !guest && item.originalPrice && item.originalPrice !== item.price}<del
              >{item.originalPrice}</del
            >{/if}
          <strong>{item.price}</strong><small
            >{item.currency === 'points' ? tr('灵墨', 'Ink') : tr('余韵', 'Echoes')}</small
          >
        {/if}
      </p>
      <p class="description">
        {freeStarter
          ? tr(
              '迎接第一位初识伙伴，无需登录、不消耗灵墨，保存在本机。',
              'Welcome your first Acquaintance companion without signing in or spending Ink. Saved on this device.'
            )
          : item.type === 'character'
            ? tr('直接珍藏这一位语言伙伴。', 'Collect this language companion directly.')
            : item.type === 'ticket'
              ? tr(
                  '兑换一张学习寻访笺，用于一次寻访。',
                  'Redeem one learning ticket for one discovery.'
                )
              : tr(
                  '补记过去七天未签到的一天，不补学习奖励或月度任务进度。',
                  'Make up one missed check-in in the last seven days; no study rewards or monthly task progress.'
                )}
      </p>
      <div class="product-actions">
        <button
          class="redeem"
          data-shop-item={item.id}
          disabled={busy || (!guest && (!online || already || balance < item.price))}
          onclick={() => redeem(item)}
        >
          {freeStarter
            ? tr('免费领取', 'Claim for free')
            : guest
              ? tr('登录后兑换', 'Sign in to redeem')
              : already
                ? tr('已拥有', 'Owned')
                : balance < item.price
                  ? tr('余额不足', 'Insufficient balance')
                  : tr('兑换', 'Redeem')}
        </button>
        {#if showSupport}<button
            class="support-link"
            data-shop-support-shortfall={item.id}
            disabled={busy}
            aria-controls={!guest ? 'collection-support-panel' : undefined}
            aria-expanded={!guest ? supportOpen : undefined}
            onclick={support}>{tr('购买支持开发', 'Purchase to support development')}</button
          ><small class="support-note"
            >{tr(
              '获取支持寻访笺，不增加灵墨或续页笺。',
              'Grants support tickets, not Ink or makeup slips.'
            )}</small
          >{/if}
      </div>
    </section>
  {/each}
  {#if supportEntry && support}<section class="product support-product" data-shop-support-card>
      <div class="art"><Coffee size={40} strokeWidth={1.2} /></div>
      <h3>{tr('支持开发', 'Support development')}</h3>
      <p class="support-kind">{tr('支持寻访笺', 'Support discovery tickets')}</p>
      <p class="description">
        {tr(
          '支持开发可获取支持寻访笺，不增加灵墨或续页笺。',
          'Support development to receive support tickets, not Ink or makeup slips.'
        )}
        {payments?.enabled && payments.mode === 'live'
          ? payments.eligible
            ? tr('微信扫码，到账后发放。', 'Scan with WeChat; tickets follow verified payment.')
            : tr('当前账号付款暂不可用。', 'Checkout is currently unavailable for this account.')
          : payments?.enabled && payments.mode === 'simulation'
            ? tr('测试订单，请勿付款。', 'Test orders; do not make a payment.')
            : tr('在线付款暂未开放。', 'Online checkout is not available yet.')}
      </p>
      <div class="product-actions">
        <button
          class="redeem"
          data-shop-support-entry
          disabled={busy}
          aria-controls={!guest ? 'collection-support-panel' : undefined}
          aria-expanded={!guest ? supportOpen : undefined}
          onclick={support}>{tr('购买支持开发', 'Purchase to support development')}</button
        >
      </div>
    </section>{/if}
</div>

<style>
  .products {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 15px;
  }
  .products.supplies {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .product {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 20px;
    border: 1px solid var(--gallery-border, var(--border));
    border-radius: 16px;
    background: color-mix(in srgb, var(--gallery-paper, var(--bg-elev)) 25%, var(--bg-elev));
  }
  .art {
    display: grid;
    place-items: center;
    min-height: 126px;
    position: relative;
    border-radius: 11px;
    margin-bottom: 18px;
    background: var(--gallery-mat, #2d332b);
    color: var(--gallery-mat-ink, #cbc4a9);
  }
  h3 {
    font-size: 16px;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .price {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 7px;
    margin: 16px 0 10px;
  }
  .price strong {
    font-size: 27px;
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }
  .price del,
  small {
    color: var(--text-3);
    font-size: 12px;
  }
  .description {
    color: var(--text-3);
    font-size: 12px;
    line-height: 1.6;
    margin: 0 0 20px;
  }
  .support-kind {
    margin: 18px 0 14px;
    font-size: 20px;
    line-height: 1.4;
    color: var(--text);
  }
  .product-actions {
    display: flex;
    flex-direction: column;
    gap: 9px;
    margin-top: auto;
  }
  .support-note {
    line-height: 1.5;
  }
  .discount {
    position: absolute;
    top: 10px;
    right: 10px;
    background: #b7553d;
    color: white;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 6px;
  }
  .redeem {
    width: 100%;
    padding: 10px 15px;
    border: 1px solid var(--gallery-sage, #bccba4);
    border-radius: 10px;
    background: var(--gallery-sage, #bccba4);
    color: #253019;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .redeem:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .redeem:focus-visible {
    outline: 2px solid var(--gallery-gold, #bbaa7c);
    outline-offset: 3px;
  }
  .support-link {
    padding: 9px 12px;
    border: 1px solid var(--gallery-border, var(--border));
    border-radius: 10px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .support-link:hover:not(:disabled) {
    background: color-mix(in srgb, var(--gallery-sage, #bccba4) 12%, transparent);
  }
  .support-link:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .support-link:focus-visible {
    outline: 2px solid var(--gallery-gold, #bbaa7c);
    outline-offset: 3px;
  }
  @media (max-width: 1050px) {
    .products {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (max-width: 736px) {
    .products,
    .products.supplies {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .product {
      padding: 15px;
    }
  }
  @media (max-width: 420px) {
    .products,
    .products.supplies {
      grid-template-columns: 1fr;
    }
  }
</style>
