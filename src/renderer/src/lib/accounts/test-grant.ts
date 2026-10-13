import { account } from '$lib/state/account.svelte'
import { ui } from '$lib/state/ui.svelte'
import { i18n } from '$lib/i18n/index.svelte'
import { accountError } from './errors'

/** Dead-code eliminated from an ordinary production build. The server independently gates grants. */
export const dictionaryTestGrant: ((query: string) => Promise<void>) | undefined =
  import.meta.env.DEV || import.meta.env.VITE_QON_TEST_MODE === '1'
    ? async (query: string): Promise<void> => {
        if (
          query.trim().toLowerCase() !== 'kinnuch' ||
          !account.session?.user ||
          !account.session.server.testcap
        )
          return
        const ok = await account.mutate('testGrant', {})
        ui.toast(
          ok
            ? i18n.locale === 'zh'
              ? '测试寻访笺已领取（同一账号只发放一次）'
              : 'Test tickets granted (once per account)'
            : (account.error ? accountError(account.error, i18n.locale) : '') ||
                (i18n.locale === 'zh' ? '测试领取不可用' : 'Test grant unavailable'),
          ok ? 'info' : 'error'
        )
      }
    : undefined
