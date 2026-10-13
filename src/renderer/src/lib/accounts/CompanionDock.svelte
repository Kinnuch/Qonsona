<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { BookOpen, Grip, Home, MessageCircle, Volume2, X } from '@lucide/svelte'
  import { account } from '$lib/state/account.svelte'
  import { companion } from '$lib/state/companion.svelte'
  import { audio } from '$lib/state/audio.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { i18n, pick } from '$lib/i18n/index.svelte'
  import { clampDock } from './companion-events'
  import CompanionSprite from './CompanionSprite.svelte'

  let options = $state(false)
  let dock = $state<HTMLDivElement>()
  let drag: { id: number; dx: number; dy: number } | null = null
  const character = $derived(
    account.snapshot?.catalog.find((c) => c.id === account.snapshot?.companion?.currentId)
  )
  const progress = $derived(
    account.snapshot?.companion?.progress.find((p) => p.characterId === character?.id)
  )
  const moved = $derived(companion.preferences.position)
  const message = $derived(companion.message)
  const tr = (zh: string, en: string): string => (i18n.locale === 'zh' ? zh : en)
  $effect(() => {
    const id = account.session?.user?.id ?? ''
    untrack(() => companion.connectUser(id))
  })
  function clamp(): void {
    const position = companion.preferences.position
    if (!position || !dock) return
    const next = clampDock(
      position,
      { width: window.innerWidth, height: window.innerHeight },
      dock.getBoundingClientRect()
    )
    if (next.x !== position.x || next.y !== position.y) companion.configure({ position: next })
  }
  $effect(() => {
    const element = dock
    if (!element) return
    const observer = new ResizeObserver(() => clamp())
    observer.observe(element)
    queueMicrotask(() => clamp())
    return () => observer.disconnect()
  })
  onMount(() => {
    clamp()
  })
  function startDrag(e: PointerEvent): void {
    if (e.button !== 0) return
    const rect = dock!.getBoundingClientRect()
    drag = { id: e.pointerId, dx: e.clientX - rect.x, dy: e.clientY - rect.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  function moveDrag(e: PointerEvent): void {
    if (!drag || drag.id !== e.pointerId) return
    companion.configure({
      position: clampDock(
        { x: e.clientX - drag.dx, y: e.clientY - drag.dy },
        { width: window.innerWidth, height: window.innerHeight },
        dock!.getBoundingClientRect()
      )
    })
  }
  function stopDrag(e: PointerEvent): void {
    if (drag?.id === e.pointerId) drag = null
  }
  function moveKey(e: KeyboardEvent): void {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-12, 0],
      ArrowRight: [12, 0],
      ArrowUp: [0, -12],
      ArrowDown: [0, 12]
    }
    if (!delta[e.key]) return
    e.preventDefault()
    const rect = dock!.getBoundingClientRect(),
      [x, y] = delta[e.key]
    companion.configure({
      position: clampDock(
        { x: rect.x + x, y: rect.y + y },
        { width: window.innerWidth, height: window.innerHeight },
        rect
      )
    })
  }
</script>

<svelte:window onresize={clamp} />
{#if account.session?.user && character}
  <div class="dock-space" data-companion-space>
    <div
      bind:this={dock}
      class="companion-dock"
      class:floating={!!moved}
      style:left={moved ? `${moved.x}px` : undefined}
      style:top={moved ? `${moved.y}px` : undefined}
      data-companion-dock={character.id}
    >
      {#if message && companion.preferences.bubbles}
        <div class="bubble" role="status" data-companion-message={message.kind}>
          <button
            class="dismiss"
            aria-label={tr('收起鼓励', 'Dismiss encouragement')}
            onclick={() => companion.dismiss()}><X size={12} /></button
          >
          {#if message.text}<p dir="auto" lang={message.lang ?? undefined}>{message.text}</p>{/if}
          <p lang="zh-CN">{message.zh}</p>
          {#if message.xp > 0}<small>+{message.xp} XP</small>{/if}
          {#if message.gifts.length}<small
              >{tr('收到了新的精灵收藏品！', 'A new companion keepsake arrived!')}</small
            >{/if}
          {#if !message.lang || (audio.voicesLoaded && !audio.textVoice(message.lang))}<small
              class="muted"
              >{tr('这门语言暂以文字鼓励', 'Text encouragement for this language')}</small
            >{/if}
          {#if message.source}<a href={message.source} target="_blank" rel="noreferrer"
              >{tr('语句来源', 'Phrase source')}</a
            >{/if}
        </div>
      {/if}
      <button
        class="drag-handle"
        data-companion-drag
        aria-label={tr('拖动精灵；也可用方向键移动', 'Drag companion; arrow keys also move it')}
        title={tr('拖动或按方向键移动', 'Drag or use arrow keys')}
        onpointerdown={startDrag}
        onpointermove={moveDrag}
        onpointerup={stopDrag}
        onpointercancel={stopDrag}
        onkeydown={moveKey}><Grip size={12} /></button
      >
      <button
        class="portrait"
        data-companion-options
        aria-expanded={options}
        onclick={() => (options = !options)}
        title={tr('语言精灵设置', 'Companion settings')}
        ><CompanionSprite {character} width={82} /></button
      >
      <div class="caption">
        <strong>{pick(character.name)}</strong><span>{progress?.xp ?? 0} XP</span>
      </div>
      {#if options}
        <div class="options" data-companion-settings>
          <label
            ><MessageCircle size={13} /><input
              type="checkbox"
              checked={companion.preferences.bubbles}
              onchange={(e) => companion.configure({ bubbles: e.currentTarget.checked })}
            />{tr('鼓励气泡', 'Encouragement bubble')}</label
          >
          <label
            ><Volume2 size={13} /><input
              type="checkbox"
              checked={companion.preferences.speech}
              onchange={(e) => companion.configure({ speech: e.currentTarget.checked })}
            />{tr('双语朗读', 'Bilingual speech')}</label
          >
          <p>
            {tr(
              '朗读仅使用匹配的语言音色；没有音色时显示文字。播放题目音频时不会插播鼓励。',
              'Speech uses matching voices. Missing voices stay as text. Encouragement does not interrupt question audio.'
            )}
          </p>
          {#if message && !companion.preferences.bubbles}<p class="last-message" role="status">
              {message.text}
              {message.zh}
            </p>{/if}
          <button
            onclick={() => {
              companion.configure({ position: null })
              options = false
            }}><Home size={13} />{tr('放回左下角', 'Return to sidebar')}</button
          >
          <button
            onclick={() => {
              options = false
              ui.go('collection')
            }}><BookOpen size={13} />{tr('查看精灵图鉴', 'Open collection')}</button
          >
        </div>
      {/if}
      <span class="sr-only" aria-live="polite" aria-atomic="true"
        >{!companion.preferences.bubbles && message ? `${message.text} ${message.zh}` : ''}</span
      >
    </div>
  </div>
{/if}

<style>
  .dock-space {
    min-height: 123px;
    flex-shrink: 0;
    position: relative;
    display: flex;
    justify-content: center;
    border-top: 1px solid var(--border);
    padding-top: 8px;
  }
  .companion-dock {
    width: 124px;
    position: relative;
    text-align: center;
    color: var(--text);
  }
  .floating {
    position: fixed;
    z-index: 65;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--bg-elev);
    box-shadow: var(--shadow-lg);
    padding: 8px 0;
    max-height: calc(100vh - 16px);
    overflow-y: auto;
  }
  .portrait {
    display: flex;
    margin: 0 auto;
    align-items: center;
    justify-content: center;
    width: 90px;
    height: 81px;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .drag-handle {
    position: absolute;
    top: 0;
    right: 3px;
    border: 0;
    border-radius: 6px;
    background: var(--bg-hover);
    color: var(--text-3);
    padding: 3px;
    touch-action: none;
    cursor: grab;
  }
  .drag-handle:active {
    cursor: grabbing;
  }
  .caption {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 0 8px 5px;
    font-size: 11px;
  }
  .caption span {
    font-family: var(--font-data);
    color: var(--text-3);
    font-size: 10px;
  }
  .bubble {
    position: relative;
    margin-bottom: 8px;
    padding: 12px 9px 9px;
    text-align: start;
    border: 1px solid var(--border-strong);
    border-radius: 13px 13px 13px 3px;
    background: var(--bg-elev);
    box-shadow: var(--shadow);
    width: 100%;
    overflow-wrap: anywhere;
    font-size: 11px;
  }
  .bubble p {
    margin: 0 0 5px;
    line-height: 1.6;
  }
  .bubble small,
  .bubble a {
    display: block;
    font-size: 9px;
    line-height: 1.5;
  }
  .dismiss {
    position: absolute;
    top: 2px;
    right: 2px;
    padding: 2px;
    border: 0;
    background: transparent;
    cursor: pointer;
    color: var(--text-3);
  }
  .muted {
    color: var(--text-3);
  }
  .options {
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    background: var(--bg-elev);
    padding: 10px;
    text-align: start;
    font-size: 11px;
    margin: 7px 0;
  }
  .options label {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-bottom: 7px;
  }
  .options p {
    font-size: 10px;
    color: var(--text-3);
    line-height: 1.6;
  }
  .options button {
    display: flex;
    gap: 5px;
    padding: 6px 0;
    font-size: 10px;
    border: 0;
    background: none;
    color: var(--text);
    cursor: pointer;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (max-height: 620px) {
    .dock-space {
      min-height: 105px;
    }
    .portrait {
      height: 65px;
    }
  }
</style>
