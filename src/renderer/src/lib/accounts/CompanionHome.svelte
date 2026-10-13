<script lang="ts">
  import { Home, Plus, RotateCcw, Save, X, Armchair, Paintbrush } from '@lucide/svelte'
  import { account } from '$lib/state/account.svelte'
  import { i18n } from '$lib/i18n/index.svelte'
  import CompanionSprite from './CompanionSprite.svelte'
  import type { CollectionSnapshot } from '$shared/account'

  let { snapshot, online }: { snapshot: CollectionSnapshot; online: boolean } = $props()
  type Placement = { characterId: string; x: number; y: number }
  let placements = $state<Placement[]>([])
  let revision = $state(0)
  let skinId = $state('room-placeholder')
  let dirty = $state(false)
  let conflict = $state(false)
  let loadedUser = $state('')
  let room = $state<HTMLDivElement>()
  let roomWidth = $state(640)
  let roomHeight = $state(400)
  let activeId = $state('')
  let saved = $state(false)
  let editVersion = 0
  let dragging: { id: string; pointer: number; offsetX: number; offsetY: number } | null = null
  const tr = (zh: string, en: string): string => (i18n.locale === 'zh' ? zh : en)
  const available = $derived(
    snapshot.catalog.filter((c) => snapshot.characters.some((owned) => owned.id === c.id))
  )
  const skins = $derived(snapshot.homeSkins ?? [])
  const currentName = $derived(snapshot.catalog.find((c) => c.id === activeId)?.name[i18n.locale])
  const tileWidth = 104
  const tileHeight = 112
  const padding = 10
  const rangeX = $derived(Math.max(1, roomWidth - tileWidth - padding * 2))
  const rangeY = $derived(Math.max(1, roomHeight - tileHeight - padding * 2))
  $effect(() => {
    const home = snapshot.home
    if (!home) return
    if (loadedUser !== snapshot.user.id || !dirty) {
      placements = home.placements.map((p) => ({ ...p }))
      revision = home.revision
      skinId = home.skinId
      loadedUser = snapshot.user.id
      conflict = false
    } else if (home.revision !== revision) conflict = true
  })
  $effect(() => {
    if (!online || account.busy) dragging = null
  })
  $effect(() => {
    if (!room) return
    const observer = new ResizeObserver(() => {
      if (!room) return
      roomWidth = room.clientWidth
      roomHeight = room.clientHeight
    })
    observer.observe(room)
    roomWidth = room.clientWidth
    roomHeight = room.clientHeight
    return () => observer.disconnect()
  })
  function edited(): void {
    dirty = true
    saved = false
    editVersion++
  }
  function add(characterId: string): void {
    if (!online || placements.some((p) => p.characterId === characterId) || placements.length >= 30)
      return
    placements = [
      ...placements,
      {
        characterId,
        x: 0.15 + (placements.length % 4) * 0.22,
        y: 0.68 + (Math.floor(placements.length / 4) % 2) * 0.15
      }
    ]
    activeId = characterId
    edited()
  }
  function remove(characterId: string): void {
    if (!online) return
    placements = placements.filter((p) => p.characterId !== characterId)
    if (activeId === characterId) activeId = ''
    edited()
  }
  const clamp = (value: number): number => Math.max(0, Math.min(1, value))
  function move(characterId: string, x: number, y: number): void {
    if (!online || account.busy) return
    placements = placements.map((p) =>
      p.characterId === characterId ? { ...p, x: clamp(x), y: clamp(y) } : p
    )
    edited()
  }
  function startDrag(event: PointerEvent, p: Placement): void {
    if (!online || event.button !== 0 || !room) return
    const target = event.currentTarget as HTMLButtonElement
    const bounds = target.getBoundingClientRect()
    dragging = {
      id: p.characterId,
      pointer: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top
    }
    target.setPointerCapture(event.pointerId)
    activeId = p.characterId
    event.preventDefault()
  }
  function drag(event: PointerEvent): void {
    if (!online || account.busy || !room || !dragging || dragging.pointer !== event.pointerId)
      return
    const bounds = room.getBoundingClientRect()
    move(
      dragging.id,
      (event.clientX - bounds.left - room.clientLeft - dragging.offsetX - padding) / rangeX,
      (event.clientY - bounds.top - room.clientTop - dragging.offsetY - padding) / rangeY
    )
  }
  function endDrag(event: PointerEvent): void {
    if (dragging?.pointer === event.pointerId) dragging = null
  }
  function reload(): void {
    if (!snapshot.home) return
    placements = snapshot.home.placements.map((p) => ({ ...p }))
    skinId = snapshot.home.skinId
    revision = snapshot.home.revision
    conflict = false
    dirty = false
    saved = false
  }
  async function save(): Promise<void> {
    if (!online || !dirty || conflict) return
    const user = snapshot.user.id
    const version = editVersion
    const ok = await account.saveHome({
      requestId: crypto.randomUUID(),
      expectedRevision: revision,
      skinId,
      placements: placements.map((p) => ({ ...p }))
    })
    if (ok && snapshot.user.id === user && version === editVersion) {
      dirty = false
      saved = true
      conflict = false
    }
  }
</script>

<section class="home-section" data-companion-home>
  <header>
    <div>
      <p class="eyebrow">A PLACE TO COME HOME TO</p>
      <h2>{tr('语言精灵的家园', 'A home for your companions')}</h2>
    </div>
    <span><Home size={14} />{tr('像素室内 · 占位皮肤', 'Pixel interior · placeholder skin')}</span>
  </header>
  <p class="intro">
    {tr(
      '把已经收藏的语言精灵邀请进来，拖动调整位置，再保存到账号。此处先提供室内占位，后续可换上你绘制的皮肤和家具。',
      'Invite collected companions, drag them into place, then save to your account. This room is a placeholder for future hand-drawn skins and furniture.'
    )}
  </p>
  {#if !snapshot.home}<p role="status">
      {tr(
        '家园暂不可用，请刷新账号连接。',
        'Home unavailable. Please refresh your account connection.'
      )}
    </p>
  {:else}
    <div class="layout">
      <div class="room-column">
        <div
          class="room"
          bind:this={room}
          data-home-room
          data-home-skin={skinId}
          aria-label={tr(
            '像素家园，精灵可拖拽或用方向键移动',
            'Pixel home; drag companions or move them with arrow keys'
          )}
        >
          <div class="wall" aria-hidden="true">
            <div class="window"><span></span><span></span><span></span><span></span></div>
            <div class="blank-picture"></div>
            <div class="door"><span></span></div>
            <div class="skirting"></div>
          </div>
          <div class="floor" aria-hidden="true"><div class="rug"></div></div>
          {#each placements as p (p.characterId)}
            {@const character = snapshot.catalog.find((c) => c.id === p.characterId)}
            {#if character}<button
                class="resident"
                class:active={activeId === p.characterId}
                style:left={`${padding + p.x * rangeX}px`}
                style:top={`${padding + p.y * rangeY}px`}
                style:z-index={Math.round(p.y * 100) + 1}
                data-home-resident={p.characterId}
                disabled={!online}
                aria-label={tr(
                  `移动${character.name.zh}，方向键调整位置`,
                  `Move ${character.name.en}; use arrow keys to adjust position`
                )}
                aria-pressed={activeId === p.characterId}
                onpointerdown={(event) => startDrag(event, p)}
                onpointermove={drag}
                onpointerup={endDrag}
                onpointercancel={endDrag}
                onlostpointercapture={() => (dragging = null)}
                onclick={() => (activeId = p.characterId)}
                onkeydown={(event) => {
                  if (
                    !online ||
                    !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
                  )
                    return
                  event.preventDefault()
                  activeId = p.characterId
                  move(
                    p.characterId,
                    p.x +
                      (event.key === 'ArrowRight' ? 0.025 : event.key === 'ArrowLeft' ? -0.025 : 0),
                    p.y + (event.key === 'ArrowDown' ? 0.025 : event.key === 'ArrowUp' ? -0.025 : 0)
                  )
                }}
                ><span class="resident-art"><CompanionSprite {character} width={96} /></span><small
                  >{character.name[i18n.locale]}</small
                ></button
              >{/if}
          {/each}
          {#if !placements.length}<div class="empty-room">
              <Home size={24} strokeWidth={1.2} /><span
                >{tr(
                  '家园已准备好，等待第一位伙伴。',
                  'Your home is ready for its first companion.'
                )}</span
              >
            </div>{/if}
        </div>
        <div class="room-toolbar">
          <span class="status" role="status"
            >{conflict
              ? tr(
                  '另一台设备更新了家园，请重新载入后再布置。',
                  'Another device updated your home. Reload before decorating.'
                )
              : dirty
                ? tr('布置尚未保存', 'Layout not saved')
                : saved
                  ? tr('已保存到账号', 'Saved to your account')
                  : tr('账号同步家园', 'Account-synced home')}</span
          >
          <button class="btn" data-home-reset disabled={account.busy || !dirty} onclick={reload}
            ><RotateCcw size={14} />{tr(
              conflict ? '载入最新布置' : '还原布置',
              conflict ? 'Load latest layout' : 'Restore layout'
            )}</button
          >
          <button
            class="btn primary"
            data-home-save
            disabled={!online || !dirty || conflict}
            onclick={save}><Save size={14} />{tr('保存家园', 'Save home')}</button
          >
        </div>
        {#if activeId && currentName}<div class="selected-resident">
            <span>{currentName}</span><button
              class="btn ghost"
              data-home-remove={activeId}
              disabled={!online}
              onclick={() => remove(activeId)}
              ><X size={13} />{tr('移出家园', 'Remove from home')}</button
            >
          </div>{/if}
      </div>
      <aside class="invite">
        <p class="eyebrow">{tr('邀请语言精灵', 'INVITE COMPANIONS')}</p>
        <h3>{tr('一起住进来', 'Make yourselves at home')}</h3>
        <p class="hint">
          {tr(
            '每种精灵可放置一只；移出不会失去馆藏。',
            'Place one of each companion type. Removing one keeps your collection intact.'
          )}
        </p>
        <div class="invite-list">
          {#each available as character (character.id)}
            {@const placed = placements.some((p) => p.characterId === character.id)}
            <button
              class="invite-item"
              data-home-invite={character.id}
              disabled={!online || placed || placements.length >= 30}
              onclick={() => add(character.id)}
              ><span class="invite-art"><CompanionSprite {character} width={62} /></span><span
                >{character.name[i18n.locale]}<small
                  >{placed ? tr('已在家园', 'At home') : tr('邀请入住', 'Invite to home')}</small
                ></span
              >{#if !placed}<Plus size={14} />{/if}</button
            >
          {:else}<p class="hint">
              {tr(
                '珍藏第一位语言精灵后，即可邀请入住。',
                'Collect your first companion to invite them home.'
              )}
            </p>{/each}
        </div>
      </aside>
    </div>
    <div class="future">
      <section>
        <Paintbrush size={19} />
        <div>
          <h3>{tr('家园皮肤', 'Home skins')}</h3>
          <p>
            {skins.find((skin) => skin.id === skinId)?.name[i18n.locale] ??
              tr('室内占位', 'Placeholder interior')}
          </p>
          <small
            >{tr(
              '皮肤售卖入口预留，等待正式素材。',
              'Skin shop reserved for future artwork.'
            )}</small
          >
        </div>
      </section>
      <section>
        <Armchair size={19} />
        <div>
          <h3>{tr('家具收藏', 'Furniture collection')}</h3>
          <p>{tr('家具暂未上架', 'Furniture is not available yet')}</p>
          <small
            >{tr(
              '余韵留作未来家具兑换，也可在商店兑换寻访笺。',
              'Echoes are reserved for future furniture, or can be exchanged for tickets in the shop.'
            )}</small
          >
        </div>
      </section>
    </div>
  {/if}
</section>

<style>
  header {
    display: flex;
    gap: 20px;
    align-items: center;
    justify-content: space-between;
  }
  header > span {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    color: var(--text-3);
  }
  h2 {
    font-size: 24px;
    margin: 8px 0 0;
  }
  .eyebrow {
    margin: 0;
    font-size: 10px;
    letter-spacing: 0.14em;
    color: var(--gallery-ink);
  }
  .intro {
    max-width: 740px;
    color: var(--text-3);
    line-height: 1.7;
    font-size: 13px;
    margin: 17px 0 23px;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 230px;
    gap: 18px;
  }
  .room-column {
    min-width: 0;
  }
  .room {
    min-height: 340px;
    aspect-ratio: 1.5;
    position: relative;
    overflow: hidden;
    border: 6px solid #655d44;
    box-shadow: inset 0 0 0 4px #b5a47c;
    border-radius: 5px;
    background: #b4b693;
    isolation: isolate;
  }
  .wall {
    position: absolute;
    inset: 0 0 42%;
    background: repeating-linear-gradient(90deg, #9ea685 0 16px, #a4ac8e 16px 32px);
    border-bottom: 8px solid #6b7459;
  }
  .window {
    position: absolute;
    top: 17%;
    left: 12%;
    width: 25%;
    height: 54%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 5px;
    padding: 5px;
    background: #666c50;
    border: 6px solid #e0d3a2;
    box-shadow: 0 5px #716e53;
  }
  .window span {
    background: repeating-linear-gradient(0deg, #aec5bd 0 12px, #b9cfc5 12px 24px);
  }
  .window span:nth-child(1),
  .window span:nth-child(2) {
    background: repeating-linear-gradient(0deg, #c6d6cd 0 12px, #d4ddd0 12px 24px);
  }
  .blank-picture {
    position: absolute;
    top: 26%;
    left: 49%;
    width: 16%;
    height: 31%;
    border: 7px solid #7b7657;
    outline: 3px solid #cfc28f;
    background: #b7bc96;
  }
  .door {
    position: absolute;
    bottom: 0;
    right: 8%;
    width: 17%;
    height: 78%;
    border: 7px solid #71694d;
    background: repeating-linear-gradient(90deg, #948566 0 10px, #9c8e6e 10px 20px);
  }
  .door span {
    position: absolute;
    right: 9%;
    top: 56%;
    width: 7px;
    height: 7px;
    background: #e1d094;
    box-shadow: 0 2px #6f6545;
  }
  .skirting {
    position: absolute;
    left: 0;
    right: 0;
    height: 8px;
    bottom: -8px;
    background: #61664b;
  }
  .floor {
    position: absolute;
    inset: 58% 0 0;
    background:
      repeating-linear-gradient(0deg, #998869 0 35px, #736a50 35px 38px),
      repeating-linear-gradient(90deg, transparent 0 85px, #867856 85px 88px);
  }
  .rug {
    position: absolute;
    left: 20%;
    top: 24%;
    width: 48%;
    height: 50%;
    background: repeating-linear-gradient(90deg, #768a73 0 13px, #7e947c 13px 26px);
    border: 8px solid #485f53;
    outline: 4px solid #c0bd93;
    box-shadow: 5px 5px #5a614744;
  }
  .resident {
    position: absolute;
    width: 104px;
    height: 112px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 7px;
    background: none;
    touch-action: none;
    cursor: grab;
    user-select: none;
  }
  .resident:active {
    cursor: grabbing;
  }
  .resident.active {
    border-color: #efdfaa;
    background: #fff0b01c;
  }
  .resident:focus-visible {
    outline: 2px solid #fff4cd;
    outline-offset: 2px;
  }
  .resident-art {
    height: 88px;
    max-width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .resident small {
    display: block;
    font-size: 10px;
    line-height: 16px;
    color: #f7f2d9;
    background: #344436b3;
    border-radius: 3px;
    padding: 1px 5px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 5px;
  }
  .resident:disabled {
    cursor: default;
  }
  .empty-room {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 13%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: #283b2a;
    font-size: 12px;
    pointer-events: none;
  }
  .room-toolbar {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    margin-top: 13px;
  }
  .status {
    flex: 1;
    min-width: 130px;
    font-size: 11px;
    color: var(--text-3);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid var(--gallery-border);
    background: var(--gallery-paper);
    color: var(--text);
    padding: 9px 11px;
    border-radius: 8px;
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }
  .primary {
    background: var(--gallery-sage);
    color: #253019;
    border-color: var(--gallery-sage);
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .btn:focus-visible,
  .invite-item:focus-visible {
    outline: 2px solid var(--gallery-gold);
    outline-offset: 3px;
  }
  .selected-resident {
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--text-2);
  }
  .ghost {
    background: none;
    border-color: transparent;
  }
  .invite {
    border: 1px solid var(--gallery-border);
    border-radius: 14px;
    padding: 18px;
    background: var(--gallery-paper);
    min-width: 0;
  }
  h3 {
    font-size: 16px;
    margin: 9px 0;
  }
  .hint {
    color: var(--text-3);
    font-size: 11px;
    line-height: 1.7;
  }
  .invite-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
    max-height: 390px;
    overflow: auto;
    scrollbar-width: thin;
    margin-top: 14px;
  }
  .invite-item {
    display: flex;
    align-items: center;
    gap: 9px;
    text-align: left;
    padding: 8px;
    border: 1px solid var(--gallery-border);
    border-radius: 9px;
    background: var(--bg-elev);
    color: var(--text);
    font: inherit;
    font-size: 11px;
    min-height: 65px;
    cursor: pointer;
  }
  .invite-item > span:nth-child(2) {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .invite-item small {
    display: block;
    font-size: 10px;
    color: var(--text-3);
    margin-top: 5px;
  }
  .invite-art {
    display: grid;
    place-items: center;
    width: 63px;
    min-height: 63px;
    background: var(--gallery-mat);
    border-radius: 5px;
    flex-shrink: 0;
  }
  .invite-item:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .future {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    margin-top: 26px;
  }
  .future section {
    display: flex;
    gap: 14px;
    border: 1px dashed var(--gallery-border);
    padding: 20px;
    border-radius: 13px;
    color: var(--text-3);
  }
  .future section > :global(svg) {
    flex-shrink: 0;
    margin-top: 3px;
    color: var(--gallery-ink);
  }
  .future h3 {
    margin: 0 0 9px;
    color: var(--text-2);
    font-size: 14px;
  }
  .future p {
    font-size: 12px;
    margin: 0 0 8px;
  }
  .future small {
    font-size: 11px;
    line-height: 1.7;
  }
  @media (max-width: 1050px) {
    .layout {
      grid-template-columns: 1fr;
    }
    .invite-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      max-height: 280px;
    }
    .invite-item {
      flex-direction: column;
      text-align: center;
    }
    .invite-item > :global(svg) {
      display: none;
    }
  }
  @media (max-width: 736px) {
    header {
      align-items: flex-start;
      flex-direction: column;
      gap: 10px;
    }
    .room {
      min-height: 300px;
      aspect-ratio: 1.3;
    }
    .future {
      grid-template-columns: 1fr;
    }
    .invite-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
