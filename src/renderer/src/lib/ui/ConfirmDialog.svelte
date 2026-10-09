<script lang="ts">
  import { ui } from '$lib/state/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'

  const req = $derived(ui.confirmRequest)

  function onkeydown(e: KeyboardEvent): void {
    if (!req) return
    if (e.key === 'Escape') ui.answerConfirm(false)
    if (e.key === 'Enter') ui.answerConfirm(true)
  }
</script>

<svelte:window {onkeydown} />

{#if req}
  <div class="backdrop" role="presentation" onclick={() => ui.answerConfirm(false)}>
    <div
      class="dialog card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <h2 id="confirm-title">{req.title}</h2>
      <p class="muted">{req.body}</p>
      <div class="actions">
        <button class="btn" onclick={() => ui.answerConfirm(false)}>{t('common.cancel')}</button>
        <button
          class="btn"
          class:primary={!req.danger}
          class:danger={req.danger}
          onclick={() => ui.answerConfirm(true)}
        >
          {req.ok}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    display: grid;
    place-items: center;
    z-index: 100;
  }
  .dialog {
    width: min(420px, calc(100vw - 32px));
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: var(--shadow-lg);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
