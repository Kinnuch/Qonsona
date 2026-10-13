import { readFileSync } from 'node:fs'
import { transform } from 'esbuild'
import { expect, it, vi } from 'vitest'
async function compiled(enabled: boolean) {
  const account = {
    session: null as null | { user: object; server: { testcap: boolean } },
    error: '',
    mutate: vi.fn(async () => true)
  }
  const toast = vi.fn(),
    source = readFileSync('src/renderer/src/lib/accounts/test-grant.ts', 'utf8')
  const js = await transform(source, {
    loader: 'ts',
    format: 'cjs',
    minify: true,
    define: {
      'import.meta.env.DEV': 'false',
      'import.meta.env.VITE_QON_TEST_MODE': JSON.stringify(enabled ? '1' : '')
    }
  })
  const module = { exports: {} as { dictionaryTestGrant?: (query: string) => Promise<void> } }
  new Function('require', 'module', 'exports', js.code)(
    (id: string) =>
      id.includes('account.svelte')
        ? { account }
        : id.includes('ui.svelte')
          ? { ui: { toast } }
          : id.includes('i18n')
            ? { i18n: { locale: 'en' } }
            : { accountError: () => '' },
    module,
    module.exports
  )
  return { account, toast, handler: module.exports.dictionaryTestGrant, code: js.code }
}
it('ordinary production build removes the command and grant call', async () => {
  const f = await compiled(false)
  expect(f.handler).toBeUndefined()
  expect(f.code).not.toContain('kinnuch')
  expect(f.code).not.toContain('testGrant')
})
it('test build command requires a logged-in server-authorized session and the exact query', async () => {
  const f = await compiled(true)
  await f.handler!('kinnuch')
  expect(f.account.mutate).not.toHaveBeenCalled()
  f.account.session = { user: { id: 'a' }, server: { testcap: false } }
  await f.handler!('kinnuch')
  expect(f.account.mutate).not.toHaveBeenCalled()
  f.account.session.server.testcap = true
  await f.handler!('kinnuch-other')
  expect(f.account.mutate).not.toHaveBeenCalled()
  await f.handler!(' KINNUCH ')
  expect(f.account.mutate).toHaveBeenCalledExactlyOnceWith('testGrant', {})
})
