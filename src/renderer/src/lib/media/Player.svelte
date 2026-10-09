<script lang="ts">
  // 播放器：视频（音频也用 <video> 放，只是不显示画面）、当前这句字幕（注振假名，点词查词）与第二字幕（译文）、
  // 逐句跳转、复读、单句循环、每句后暂停、倍速；右边是整集字幕，点一句跳过去。
  // 快捷键：空格 播放 / 暂停，← → 上一句 / 下一句，R 复读这一句，L 单句循环，P 每句后暂停，
  // - = 调慢 / 调快，S 显示 / 隐藏字幕，F 全屏，Esc 关掉词卡
  import { onDestroy, onMount, untrack } from 'svelte'
  import {
    ArrowLeft,
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Repeat,
    Repeat1,
    CirclePause,
    Maximize,
    Minimize,
    Volume2,
    VolumeX,
    Captions,
    Plus,
    Eye,
    EyeOff,
    Music,
    X,
    Trash2,
    FolderOpen
  } from '@lucide/svelte'
  import { media, RATES } from '$lib/state/media.svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import { platform } from '$lib/platform'
  import { cueAt, formatTime, lastStarted, overlapping } from '$shared/media'
  import type { JaWord } from '$shared/ja/reader'
  import JaLine from './JaLine.svelte'
  import JaWordCard from '$lib/reader/JaWordCard.svelte'

  const item = $derived(media.current!)
  /** 这个播放器放的是哪一条（换一条会整个重建）；关掉时 media.current 已经没了，存进度用它 */
  const itemId = media.current!.id
  const cues = $derived(media.primary)
  const subs2 = $derived(media.secondary)
  const offset = $derived(item.offset)

  let video = $state<HTMLVideoElement | null>(null)
  let stage = $state<HTMLElement | null>(null)
  let listEl = $state<HTMLElement | null>(null)
  let time = $state(0)
  let duration = $state(0)
  let paused = $state(true)
  let volume = $state(1)
  let muted = $state(false)
  let failed = $state(false)
  let fullscreen = $state(false)
  let settingsOpen = $state(false)
  /** 字幕藏起来时偷看这一句 */
  let peek = $state(false)

  /** 正在放的这句（两句之间是 -1）与开始了的最后一句 */
  const idx = $derived(cueAt(cues, time, offset))
  const near = $derived(lastStarted(cues, time, offset))
  /** 显示的这句：暂停在两句之间时留着刚放完的那句 */
  const shown = $derived(idx >= 0 ? idx : paused && near >= 0 ? near : -1)
  /** 每一句对应的第二字幕 */
  const aligned = $derived(
    cues.map((c) => {
      const k = overlapping(subs2, c.start, c.end)
      return k >= 0 ? subs2[k].text : ''
    })
  )
  /** 第二字幕这一行：跟主字幕对齐；没有主字幕时按时间找 */
  const line2 = $derived.by(() => {
    if (shown >= 0) return aligned[shown]
    if (cues.length) return ''
    const k = cueAt(subs2, time, offset)
    return k >= 0 ? subs2[k].text : ''
  })

  // ── 逐句 ──

  /** 单句循环的是哪一句 */
  let loopIdx = -1
  /** 上一帧在哪一句里：每句后暂停靠它知道「这一句刚放完」 */
  let inCue = -1
  /** 在这一句的末尾停过：接着放时不再停 */
  let guard = -1
  let raf = 0

  /**
   * 每一帧（窗口在后台不画的时候靠 timeupdate，一秒四次）：更新时间，处理单句循环与每句后暂停
   */
  function tick(): void {
    const v = video
    if (!v) return
    time = v.currentTime
    const cur = cueAt(cues, time, offset)
    if (media.loop && loopIdx >= 0 && loopIdx < cues.length) {
      const c = cues[loopIdx]
      if (time >= c.end + offset) {
        v.currentTime = Math.max(0, c.start + offset)
        time = v.currentTime
      }
    } else if (media.autoPause && inCue >= 0 && cur !== inCue && time >= cues[inCue].end + offset) {
      if (guard === inCue) guard = -1
      else {
        // 停在这句的末尾（字幕还显示这一句），接着放时从这里往下
        v.pause()
        v.currentTime = Math.max(0, cues[inCue].end + offset - 0.05)
        time = v.currentTime
        guard = inCue
        return
      }
    }
    inCue = cur
    if (!v.paused) media.savePosition(itemId, time, duration)
  }

  function frame(): void {
    tick()
    if (video && !video.paused) raf = requestAnimationFrame(frame)
  }

  function onplay(): void {
    paused = false
    media.playing = true
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(frame)
  }

  function onpause(): void {
    paused = true
    media.playing = false
    cancelAnimationFrame(raf)
    if (video) media.savePosition(itemId, video.currentTime, duration)
    media.flushPosition()
  }

  function toggle(): void {
    if (!video) return
    if (video.paused) void video.play().catch(() => {})
    else video.pause()
  }

  /** 跳到某一句的开头放 */
  function go(k: number): void {
    const v = video
    if (!v || k < 0 || k >= cues.length) return
    v.currentTime = Math.max(0, cues[k].start + offset)
    time = v.currentTime
    inCue = -1
    guard = -1
    loopIdx = k
    peek = false
    void v.play().catch(() => {})
  }

  const prev = (): void => go(idx >= 0 ? Math.max(0, idx - 1) : Math.max(0, near))
  const next = (): void => go(idx >= 0 ? idx + 1 : near + 1)
  const repeat = (): void => go(idx >= 0 ? idx : Math.max(0, near))

  function seek(tm: number): void {
    const v = video
    if (!v) return
    v.currentTime = Math.max(0, Math.min(tm, duration || tm))
    time = v.currentTime
    inCue = -1
    guard = -1
    loopIdx = lastStarted(cues, time, offset)
  }

  function toggleLoop(): void {
    media.loop = !media.loop
    loopIdx = idx >= 0 ? idx : near
  }

  function setRate(dir: number): void {
    const i = RATES.indexOf(media.rate)
    media.rate =
      RATES[Math.max(0, Math.min(RATES.length - 1, (i < 0 ? RATES.indexOf(1) : i) + dir))]
  }

  $effect(() => {
    if (video) video.playbackRate = media.rate
  })
  $effect(() => {
    if (video) {
      video.volume = volume
      video.muted = muted
    }
  })

  function onloaded(): void {
    const v = video
    if (!v) return
    duration = Number.isFinite(v.duration) ? v.duration : 0
    v.playbackRate = media.rate
    // 接着上次看到的地方
    if (item.position > 1 && item.position < duration - 3) v.currentTime = item.position
    time = v.currentTime
    if (duration && Math.abs(duration - item.duration) > 1)
      media.savePosition(itemId, v.currentTime, duration)
  }

  // 换句时字幕列表跟着滚，偷看收起
  $effect(() => {
    const k = near
    untrack(() => {
      peek = false
      listEl?.querySelector(`[data-cue="${k}"]`)?.scrollIntoView({ block: 'nearest' })
    })
  })

  // ── 查词 ──
  let pop = $state<{ w: JaWord; x: number; y: number } | null>(null)
  function openWord(w: JaWord, el: HTMLElement): void {
    video?.pause()
    const r = el.getBoundingClientRect()
    pop = {
      w,
      x: Math.max(8, Math.min(r.left, window.innerWidth - 340)),
      // 下面放不下就放到上面
      y: r.bottom + 240 > window.innerHeight ? Math.max(8, r.top - 250) : r.bottom + 6
    }
  }
  function onWindowClick(e: MouseEvent): void {
    if (pop && !(e.target as HTMLElement).closest('.pop, .w')) pop = null
  }

  // ── 全屏 ──
  function toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void stage?.requestFullscreen()
  }
  onMount(() => {
    const onfs = (): void => void (fullscreen = !!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onfs)
    return () => document.removeEventListener('fullscreenchange', onfs)
  })
  onDestroy(() => {
    cancelAnimationFrame(raf)
    media.playing = false
    if (video) media.savePosition(itemId, video.currentTime, duration)
    media.flushPosition()
    if (document.fullscreenElement) void document.exitFullscreen()
  })

  function onkey(e: KeyboardEvent): void {
    if (ui.confirmRequest || (e.target as HTMLElement).closest('input, textarea, select')) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
    const acts: Record<string, () => void> = {
      ' ': toggle,
      ArrowLeft: prev,
      ArrowRight: next,
      r: repeat,
      l: toggleLoop,
      p: () => (media.autoPause = !media.autoPause),
      s: () => (media.showPrimary = !media.showPrimary),
      '-': () => setRate(-1),
      '=': () => setRate(1),
      f: toggleFullscreen,
      Escape: () => (pop = null)
    }
    const act = acts[k]
    if (!act) return
    e.preventDefault()
    act()
  }

  function ondrop(e: DragEvent): void {
    e.preventDefault()
    const files = [...(e.dataTransfer?.files ?? [])]
    if (files.length) void media.drop(files)
  }

  async function removeSub(id: string, name: string): Promise<void> {
    const ok = await ui.confirm(
      t('media.subs.removeTitle'),
      t('media.subs.removeBody', { name }),
      t('common.remove'),
      true
    )
    if (ok) await media.removeSubtitle(id)
  }

  async function removeItem(): Promise<void> {
    const ok = await ui.confirm(
      t('media.removeTitle'),
      t('media.removeBody', { title: item.title }),
      t('common.remove'),
      true
    )
    if (ok) await media.remove(item.id)
  }
</script>

<svelte:window onkeydown={onkey} onclick={onWindowClick} />

<div
  class="player"
  data-player={item.id}
  role="region"
  aria-label={item.title}
  ondragover={(e) => e.preventDefault()}
  {ondrop}
>
  <div class="main">
    <div class="toolbar">
      <button class="btn ghost" data-back-library onclick={() => media.library()}
        ><ArrowLeft size={16} />{t('media.back')}</button
      >
      <strong class="title">{item.title}</strong>
      <div class="grow"></div>
      <span class="faint keys">{t('media.keys')}</span>
    </div>

    <div class="stage" class:fs={fullscreen} bind:this={stage}>
      {#if item.exists === false}
        <div class="missing card">
          <p>{t('media.missing')}</p>
          <p class="faint path">{item.path}</p>
          <button class="btn danger" onclick={removeItem}
            ><Trash2 size={14} />{t('media.remove')}</button
          >
        </div>
      {:else}
        <div class="screen" class:audio={item.kind === 'audio'}>
          <video
            bind:this={video}
            src={platform.media.url(item.id)}
            preload="metadata"
            data-video
            onloadedmetadata={onloaded}
            ondurationchange={() =>
              video && Number.isFinite(video.duration) && (duration = video.duration)}
            {onplay}
            {onpause}
            ontimeupdate={tick}
            onended={() => (paused = true)}
            onerror={() => (failed = true)}
            onclick={toggle}
          >
            <!-- 字幕由下面的字幕区显示，这里只占个位 -->
            <track kind="captions" />
          </video>
          {#if item.kind === 'audio'}
            <div class="audio-face">
              <Music size={48} strokeWidth={1.4} /><span>{item.title}</span>
            </div>
          {/if}
          {#if failed}<p class="fail card">{t('media.cannotPlay')}</p>{/if}
        </div>

        <div class="lines" data-lines>
          {#if !cues.length && !subs2.length}
            <p class="faint">{t('media.noSubtitles')}</p>
          {:else if media.showPrimary || peek}
            {#if shown >= 0}
              <p class="line1" data-current-cue={shown}>
                <JaLine text={cues[shown].text} onword={openWord} />
              </p>
            {:else}
              <p class="line1 faint">…</p>
            {/if}
            {#if media.showSecondary && line2}<p class="line2" data-line2>{line2}</p>{/if}
          {:else}
            <button class="btn ghost" data-peek onclick={() => (peek = true)}
              ><Eye size={14} />{t('media.peek')}</button
            >
          {/if}
        </div>

        <div class="controls">
          <input
            class="seek"
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={time}
            data-seek
            aria-label={t('media.seek')}
            oninput={(e) => seek(Number(e.currentTarget.value))}
          />
          <div class="buttons">
            <button class="icon" title={t('media.prev')} data-prev-cue onclick={prev}
              ><SkipBack size={18} /></button
            >
            <button class="icon play" title={t('media.play')} data-play onclick={toggle}
              >{#if paused}<Play size={20} />{:else}<Pause size={20} />{/if}</button
            >
            <button class="icon" title={t('media.next')} data-next-cue onclick={next}
              ><SkipForward size={18} /></button
            >
            <button class="icon" title={t('media.repeat')} data-repeat onclick={repeat}
              ><Repeat size={18} /></button
            >
            <span class="time">{formatTime(time)} / {formatTime(duration)}</span>
            <div class="grow"></div>
            <button
              class="toggle"
              class:on={media.loop}
              data-loop
              aria-pressed={media.loop}
              title={t('media.loopHint')}
              onclick={toggleLoop}><Repeat1 size={16} />{t('media.loop')}</button
            >
            <button
              class="toggle"
              class:on={media.autoPause}
              data-auto-pause
              aria-pressed={media.autoPause}
              title={t('media.autoPauseHint')}
              onclick={() => (media.autoPause = !media.autoPause)}
              ><CirclePause size={16} />{t('media.autoPause')}</button
            >
            <select
              class="rate"
              data-rate
              aria-label={t('media.rate')}
              value={media.rate}
              onchange={(e) => (media.rate = Number(e.currentTarget.value))}
            >
              {#each RATES as r (r)}<option value={r}>{r}×</option>{/each}
            </select>
            <button
              class="toggle"
              class:on={media.showPrimary}
              data-show-subs
              aria-pressed={media.showPrimary}
              title={t('media.showSubsHint')}
              onclick={() => (media.showPrimary = !media.showPrimary)}
              >{#if media.showPrimary}<Eye size={16} />{:else}<EyeOff size={16} />{/if}{t(
                'media.subtitle'
              )}</button
            >
            {#if subs2.length}
              <button
                class="toggle"
                class:on={media.showSecondary}
                data-show-subs2
                aria-pressed={media.showSecondary}
                onclick={() => (media.showSecondary = !media.showSecondary)}
                >{t('media.translation')}</button
              >
            {/if}
            <button class="icon" title={t('media.mute')} onclick={() => (muted = !muted)}
              >{#if muted || volume === 0}<VolumeX size={18} />{:else}<Volume2
                  size={18}
                />{/if}</button
            >
            <input
              class="volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              bind:value={volume}
              aria-label={t('media.volume')}
            />
            <button
              class="icon"
              title={t('media.fullscreen')}
              data-fullscreen
              onclick={toggleFullscreen}
              >{#if fullscreen}<Minimize size={18} />{:else}<Maximize size={18} />{/if}</button
            >
          </div>
        </div>
      {/if}
    </div>
  </div>

  <aside class="side">
    <div class="side-head">
      <Captions size={16} />
      <strong>{t('media.subs.title')}</strong>
      <span class="faint">{t('media.subs.count', { n: cues.length })}</span>
      <div class="grow"></div>
      <button
        class="btn small"
        class:on={settingsOpen}
        data-subs-settings
        onclick={() => (settingsOpen = !settingsOpen)}>{t('media.subs.settings')}</button
      >
    </div>
    {#if settingsOpen || !item.subtitles.length}
      <div class="settings" data-subs-panel>
        {#if item.subtitles.length}
          <label class="field">
            <span class="muted">{t('media.subs.primary')}</span>
            <select
              data-track="primary"
              value={item.primary ?? ''}
              onchange={(e) => media.setTrack('primary', e.currentTarget.value || null)}
            >
              <option value="">{t('media.subs.none')}</option>
              {#each item.subtitles as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
            </select>
          </label>
          <label class="field">
            <span class="muted">{t('media.subs.secondary')}</span>
            <select
              data-track="secondary"
              value={item.secondary ?? ''}
              onchange={(e) => media.setTrack('secondary', e.currentTarget.value || null)}
            >
              <option value="">{t('media.subs.none')}</option>
              {#each item.subtitles as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
            </select>
          </label>
          <div class="field">
            <span class="muted">{t('media.subs.offset')}</span>
            <div class="offset">
              <button
                class="btn small"
                data-offset="-"
                onclick={() => media.setOffset(offset - 0.5)}>−0.5</button
              >
              <span data-offset-value
                >{t('media.subs.seconds', { n: offset > 0 ? `+${offset}` : offset })}</span
              >
              <button
                class="btn small"
                data-offset="+"
                onclick={() => media.setOffset(offset + 0.5)}>+0.5</button
              >
            </div>
          </div>
          <ul class="files">
            {#each item.subtitles as s (s.id)}
              <li>
                <span class="fname" title={s.name}>{s.name}</span>
                <span class="faint">{t('media.subs.count', { n: s.cues })}</span>
                <button
                  class="icon"
                  title={t('media.subs.remove')}
                  onclick={() => removeSub(s.id, s.name)}><X size={14} /></button
                >
              </li>
            {/each}
          </ul>
        {:else}
          <p class="muted">{t('media.subs.empty')}</p>
        {/if}
        <div class="row">
          <button class="btn" data-add-subtitle onclick={() => media.addSubtitle()}
            ><Plus size={14} />{t('media.subs.add')}</button
          >
          {#if item.exists !== false}
            <button class="btn ghost" onclick={() => platform.media.reveal(item.id)}
              ><FolderOpen size={14} />{t('media.reveal')}</button
            >
          {/if}
        </div>
        <p class="faint">{t('media.subs.hint')}</p>
      </div>
    {/if}
    <div class="list" class:blur={!media.showPrimary} bind:this={listEl} data-cue-list>
      {#each cues as c, k (k)}
        <button class="cue" class:on={k === near} data-cue={k} onclick={() => go(k)}>
          <span class="at faint">{formatTime(c.start + offset)}</span>
          <span class="texts">
            <span class="t1" lang="ja">{c.text}</span>
            {#if media.showSecondary && aligned[k]}<span class="t2">{aligned[k]}</span>{/if}
          </span>
        </button>
      {/each}
    </div>
  </aside>

  {#if pop}
    <JaWordCard w={pop.w} x={pop.x} y={pop.y} />
  {/if}
</div>

<style>
  .player {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    height: 100%;
    overflow: hidden;
  }
  .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-y: auto;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elev);
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .grow {
    flex: 1;
  }
  .keys {
    white-space: nowrap;
  }
  .stage {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 20px 24px;
    background: var(--bg);
  }
  .stage.fs {
    height: 100vh;
    padding: 16px 24px;
  }
  .screen {
    position: relative;
    background: #000;
    border-radius: var(--radius);
    overflow: hidden;
    display: flex;
    justify-content: center;
  }
  .screen video {
    width: 100%;
    max-height: 56vh;
    display: block;
  }
  .stage.fs .screen {
    flex: 1;
    min-height: 0;
  }
  .stage.fs .screen video {
    max-height: none;
    height: 100%;
  }
  .screen.audio {
    background: var(--bg-sunken);
    min-height: 180px;
    align-items: center;
  }
  .screen.audio video {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .audio-face {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: var(--text-2);
  }
  .fail {
    position: absolute;
    inset: auto 12px 12px;
    color: var(--danger);
  }
  .missing {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .path {
    word-break: break-all;
  }
  .lines {
    min-height: 96px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-align: center;
  }
  .line1 {
    font-size: 26px;
    line-height: 2;
  }
  .stage.fs .line1 {
    font-size: 34px;
  }
  .line2 {
    font-size: 16px;
    color: var(--text-2);
    white-space: pre-wrap;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .seek {
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    accent-color: var(--accent);
  }
  .buttons {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    cursor: pointer;
    color: var(--text-2);
  }
  .icon:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
  .icon.play {
    background: var(--accent);
    color: var(--accent-contrast);
    border-radius: 999px;
    padding: 8px;
  }
  .time {
    font-variant-numeric: tabular-nums;
    color: var(--text-2);
    margin-inline-start: 6px;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 9px;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: var(--bg-elev);
    cursor: pointer;
    font-size: 13px;
  }
  .toggle.on {
    background: var(--accent-soft);
    border-color: transparent;
    color: var(--accent-text);
  }
  .rate {
    padding: 3px 6px;
  }
  .volume {
    width: 80px;
    padding: 0;
    border: none;
    background: none;
    accent-color: var(--accent);
  }
  .side {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-inline-start: 1px solid var(--border);
    background: var(--bg-elev);
  }
  .side-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
  }
  .small {
    padding: 3px 10px;
    font-size: 13px;
  }
  .btn.on {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .settings {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-sunken);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .offset {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .files {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .files li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .fname {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
  }
  .cue {
    width: 100%;
    display: flex;
    gap: 10px;
    padding: 7px 8px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    cursor: pointer;
    text-align: start;
  }
  .cue:hover {
    background: var(--bg-hover);
  }
  .cue.on {
    background: var(--accent-soft);
  }
  .at {
    min-width: 42px;
    font-variant-numeric: tabular-nums;
    padding-top: 2px;
  }
  .texts {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .t1 {
    font-size: 15px;
    white-space: pre-wrap;
  }
  .t2 {
    font-size: 12px;
    color: var(--text-2);
    white-space: pre-wrap;
  }
  /* 听力练习：字幕藏起来，鼠标移上去才看得清 */
  .list.blur .texts {
    filter: blur(5px);
    transition: filter 0.15s;
  }
  .list.blur .cue:hover .texts {
    filter: none;
  }
</style>
