<script lang="ts">
  // 笔顺动画：KanjiVG 的笔画路径（viewBox 0 0 109 109）一笔一笔描出来，底下垫一层浅色的整字
  import { RotateCcw } from '@lucide/svelte'
  import { t } from '$lib/i18n/index.svelte'

  let { paths, size = 200 }: { paths: string[]; size?: number } = $props()

  /** 每一笔画多久（秒），笔与笔之间停一下 */
  const STROKE = 0.55
  const GAP = 0.12
  let run = $state(0)
  let svg = $state<SVGSVGElement | null>(null)

  // 路径长度要等画出来才量得到：量好后写进 --len，动画从「整条虚线偏移」描到 0
  $effect(() => {
    void run
    void paths
    if (!svg) return
    for (const p of svg.querySelectorAll<SVGPathElement>('path.stroke')) {
      const len = Math.ceil(p.getTotalLength())
      p.style.setProperty('--len', String(len))
    }
  })
</script>

<div class="stroke-order" data-stroke-order style:width="{size}px">
  {#key run}
    <svg bind:this={svg} viewBox="0 0 109 109" width={size} height={size} aria-hidden="true">
      <line class="guide" x1="54.5" y1="0" x2="54.5" y2="109" />
      <line class="guide" x1="0" y1="54.5" x2="109" y2="54.5" />
      {#each paths as d, i (i)}
        <path class="ghost" {d} />
      {/each}
      {#each paths as d, i (i)}
        <path
          class="stroke"
          {d}
          style:animation-delay="{i * (STROKE + GAP)}s"
          style:--dur="{STROKE}s"
        />
      {/each}
    </svg>
  {/key}
  <button class="btn ghost replay" onclick={() => run++} title={t('dict.replay')}>
    <RotateCcw size={14} />{t('dict.replay')}
  </button>
</div>

<style>
  .stroke-order {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  svg {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .guide {
    stroke: var(--border);
    stroke-width: 0.5;
    stroke-dasharray: 2 2;
  }
  path {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 4;
  }
  .ghost {
    stroke: var(--border);
  }
  .stroke {
    stroke: var(--text);
    stroke-dasharray: var(--len, 200);
    stroke-dashoffset: var(--len, 200);
    animation: draw var(--dur) ease-in-out forwards;
  }
  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .stroke {
      animation: none;
      stroke-dashoffset: 0;
    }
  }
  .replay {
    font-size: 12px;
    padding: 2px 8px;
  }
</style>
