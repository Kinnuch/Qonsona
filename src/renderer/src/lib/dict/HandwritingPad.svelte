<script lang="ts">
  // 手写查字的画板：用鼠标（或触控笔）一笔一笔写一个汉字，每写完一笔就按笔画认一次，下面列出最像的字；
  // 点击候选字即可把它接到查询框里（画板清空，可以接着写下一个字）。撤销一笔、清除
  import { onMount } from 'svelte'
  import { Undo2, Eraser, X } from '@lucide/svelte'
  import { t } from '$lib/i18n/index.svelte'

  let {
    recognize,
    onpick,
    onclose,
    onopen
  }: {
    /** 按笔画认字：每笔是画板坐标的点列；返回候选字（最像的在前） */
    recognize: (strokes: [number, number][][]) => Promise<string[]>
    onpick: (ch: string) => void
    onclose: () => void
    /** 画板打开时（先把参考数据建好） */
    onopen?: () => void
  } = $props()

  const SIZE = 260

  let canvas = $state<HTMLCanvasElement | null>(null)
  let strokes = $state.raw<[number, number][][]>([])
  let current: [number, number][] | null = null
  let candidates = $state<string[]>([])
  let busy = $state(false)
  let run = 0

  function point(e: PointerEvent): [number, number] {
    const r = canvas!.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * SIZE, ((e.clientY - r.top) / r.height) * SIZE]
  }

  function draw(): void {
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    const css = getComputedStyle(canvas)
    const ratio = window.devicePixelRatio || 1
    if (canvas.width !== SIZE * ratio) {
      canvas.width = SIZE * ratio
      canvas.height = SIZE * ratio
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, SIZE, SIZE)
    // 米字格的十字线
    ctx.strokeStyle = css.getPropertyValue('--border').trim() || '#ddd'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(SIZE / 2, 0)
    ctx.lineTo(SIZE / 2, SIZE)
    ctx.moveTo(0, SIZE / 2)
    ctx.lineTo(SIZE, SIZE / 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = css.getPropertyValue('--text').trim() || '#222'
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of current ? [...strokes, current] : strokes) {
      if (!s.length) continue
      ctx.beginPath()
      ctx.moveTo(s[0][0], s[0][1])
      for (const [x, y] of s.slice(1)) ctx.lineTo(x, y)
      if (s.length === 1) ctx.lineTo(s[0][0] + 0.1, s[0][1] + 0.1)
      ctx.stroke()
    }
  }

  async function update(): Promise<void> {
    const my = ++run
    if (!strokes.length) {
      candidates = []
      return
    }
    busy = true
    try {
      const got = await recognize(strokes)
      if (my === run) candidates = got
    } finally {
      if (my === run) busy = false
    }
  }

  function down(e: PointerEvent): void {
    if (e.button !== 0) return
    try {
      canvas?.setPointerCapture(e.pointerId)
    } catch {
      // 合成的事件（测试脚本）没有真的指针，抓不住也照样画
    }
    current = [point(e)]
    draw()
  }
  function move(e: PointerEvent): void {
    if (!current) return
    const p = point(e)
    const last = current[current.length - 1]
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.5) return
    current.push(p)
    draw()
  }
  function up(): void {
    if (!current) return
    strokes = [...strokes, current]
    current = null
    draw()
    void update()
  }

  function undo(): void {
    strokes = strokes.slice(0, -1)
    draw()
    void update()
  }
  function clear(): void {
    strokes = []
    draw()
    void update()
  }
  function pick(ch: string): void {
    onpick(ch)
    clear()
  }

  onMount(() => {
    draw()
    onopen?.()
  })
</script>

<div class="card pad" data-handwriting>
  <div class="board">
    <canvas
      bind:this={canvas}
      class="canvas"
      style:width="{SIZE}px"
      style:height="{SIZE}px"
      aria-label={t('dict.handwriting.board')}
      data-handwriting-canvas
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
    ></canvas>
    <div class="tools">
      <button
        class="btn ghost"
        title={t('dict.handwriting.undo')}
        disabled={!strokes.length}
        onclick={undo}><Undo2 size={16} /></button
      >
      <button
        class="btn ghost"
        title={t('dict.handwriting.clear')}
        disabled={!strokes.length}
        onclick={clear}><Eraser size={16} /></button
      >
      <button class="btn ghost" title={t('common.close')} onclick={onclose}><X size={16} /></button>
    </div>
  </div>
  <div class="side">
    <p class="faint">
      {strokes.length
        ? t('dict.handwriting.strokes', { n: strokes.length })
        : t('dict.handwriting.hint')}
    </p>
    <div class="cands" data-handwriting-candidates aria-busy={busy}>
      {#each candidates as ch (ch)}
        <button class="cand" lang="ja" data-candidate={ch} onclick={() => pick(ch)}>{ch}</button>
      {/each}
    </div>
  </div>
</div>

<style>
  .pad {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .board {
    display: flex;
    gap: 6px;
  }
  .canvas {
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    touch-action: none;
    cursor: crosshair;
  }
  .tools {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .side {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .cands {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .cand {
    width: 48px;
    height: 48px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    font-size: 26px;
    font-family: var(--font-serif-ja);
    cursor: pointer;
  }
  .cand:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
</style>
