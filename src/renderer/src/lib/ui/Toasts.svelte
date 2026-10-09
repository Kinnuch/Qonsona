<script lang="ts">
  import { ui } from '$lib/state/ui.svelte'
</script>

<div class="toasts" aria-live="polite">
  {#each ui.toasts as toast (toast.id)}
    <div class="toast" class:error={toast.kind === 'error'}>{toast.text}</div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    z-index: 200;
    pointer-events: none;
  }
  .toast {
    max-width: 560px;
    padding: 8px 14px;
    border-radius: var(--radius);
    background: var(--text);
    color: var(--bg);
    box-shadow: var(--shadow-lg);
  }
  .toast.error {
    background: var(--danger);
    color: #fff;
  }
</style>
