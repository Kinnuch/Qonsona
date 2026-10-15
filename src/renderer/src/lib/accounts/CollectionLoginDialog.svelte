<script lang="ts">
  import { X, UserRound } from '@lucide/svelte'
  import { account } from '$lib/state/account.svelte'
  import { i18n } from '$lib/i18n/index.svelte'
  import AccountPanel from './AccountPanel.svelte'

  let {
    reason,
    close
  }: {
    reason: 'browse' | 'purchase' | 'draw' | 'support'
    close: () => void
  } = $props()
  const tr = (zh: string, en: string): string => (i18n.locale === 'zh' ? zh : en)
  const explanation = $derived(
    reason === 'draw'
      ? tr(
          '登录后即可使用寻访笺，与更多语言伙伴相遇。',
          'Sign in to use discovery tickets and meet more companions.'
        )
      : reason === 'support'
        ? tr(
            '点券与支持订单需要账号，以便保存和核验订单。',
            'Tickets and support orders require an account to save and verify orders.'
          )
        : reason === 'purchase'
          ? tr(
              '本机可免费领取一位初识伙伴。兑换更多伙伴或学习补给，需要先登录。',
              'You can claim one Acquaintance companion on this device for free. Sign in to redeem more companions or study supplies.'
            )
          : tr(
              '登录后可同步馆藏、获得灵墨，并参与每日任务。',
              'Sign in to sync your collection, earn Ink and take part in daily tasks.'
            )
  )
  $effect(() => {
    if (account.session?.user) close()
  })
  function focusDialog(node: HTMLElement): { destroy: () => void } {
    const previous = document.activeElement as HTMLElement | null
    const focusable = (): HTMLElement[] =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'
        )
      ).filter((element) => element.getClientRects().length > 0)
    node.focus()
    queueMicrotask(() => {
      if (node.isConnected)
        (
          node.querySelector<HTMLElement>('[data-account-username]') ??
          focusable()[0] ??
          node
        ).focus()
    })
    const keydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable(),
        first = items[0],
        last = items.at(-1)
      if (!first) {
        event.preventDefault()
        node.focus()
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === node)
      ) {
        event.preventDefault()
        last?.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === node)
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    node.addEventListener('keydown', keydown)
    return {
      destroy: () => {
        node.removeEventListener('keydown', keydown)
        if (previous?.isConnected) previous.focus()
      }
    }
  }
</script>

<div class="login-overlay" data-collection-login-dialog data-login-reason={reason}>
  <button
    class="scrim"
    aria-label={tr('关闭登录界面', 'Close sign-in')}
    tabindex="-1"
    onclick={close}
  ></button>
  <div
    class="login-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="collection-login-title"
    aria-describedby="collection-login-description"
    tabindex="-1"
    use:focusDialog
  >
    <header>
      <div class="title">
        <UserRound size={20} />
        <h2 id="collection-login-title">{tr('登录以继续', 'Sign in to continue')}</h2>
      </div>
      <button
        class="close"
        data-collection-login-close
        aria-label={tr('关闭登录界面', 'Close sign-in')}
        onclick={close}><X size={20} /></button
      >
    </header>
    <p id="collection-login-description">{explanation}</p>
    <p class="hint">
      {tr(
        '首次伙伴保存在本机，登录后可同步一次；每个账号限一位。关闭窗口不会进行兑换、寻访或创建订单。',
        'Your first companion stays on this device and can be synced after signing in, once per account. Closing this window does not redeem, draw or create an order.'
      )}
    </p>
    <AccountPanel />
  </div>
</div>

<style>
  .login-overlay {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: grid;
    place-items: center;
    padding: 24px;
  }
  .scrim {
    position: absolute;
    inset: 0;
    border: 0;
    background: #0d120ba8;
    backdrop-filter: blur(6px);
    cursor: default;
  }
  .login-dialog {
    position: relative;
    width: min(100%, 580px);
    max-height: calc(100dvh - 48px);
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 22px;
    padding: 27px;
    color: var(--text);
    background: var(--bg-elev);
    box-shadow: 0 20px 80px #0005;
    outline: none;
  }
  header,
  .title {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  header {
    justify-content: space-between;
  }
  h2 {
    margin: 0;
    font-size: 22px;
  }
  p {
    font-size: 14px;
    line-height: 1.7;
    margin: 17px 0 0;
  }
  .hint {
    color: var(--text-3);
    font-size: 12px;
    margin-top: 9px;
  }
  .close {
    display: grid;
    place-items: center;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 9px;
    color: var(--text-2);
    cursor: pointer;
  }
  .close:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .login-dialog :global(.account-panel) {
    max-width: none;
    border: 0;
    padding: 0;
    margin: 23px 0 0;
    border-radius: 0;
    background: transparent;
  }
  @media (max-width: 600px) {
    .login-overlay {
      padding: 12px;
    }
    .login-dialog {
      max-height: calc(100dvh - 24px);
      padding: 20px;
    }
  }
</style>
