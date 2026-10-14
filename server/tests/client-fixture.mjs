/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain Node test helper. */
import { Service as RealService } from '../service.mjs'
import { hash } from '../store.mjs'

export const CLIENT_VERSION = '0.4.0'
export const releaseFixture = (version = CLIENT_VERSION, extra = {}) => ({
  id: 411811580,
  tag_name: `v${version}`,
  draft: false,
  prerelease: false,
  published_at: '2026-10-13T14:00:00Z',
  html_url: `https://github.com/Kinnuch/Qonsona/releases/tag/v${version}`,
  ...extra
})
export const fixtureFetch = async () => new Response(JSON.stringify(releaseFixture()))

/** Existing domain tests use a current-version test client and never access GitHub.
 * HTTP contexts explicitly include clientVersion, so missing HTTP headers stay missing.
 * Policy/security tests import RealService directly to exercise old or absent headers.
 */
export class Service extends RealService {
  constructor(options = {}) {
    super({ policyFetch: fixtureFetch, ...options })
  }
  handle(method, path, body = {}, context = {}) {
    const headers = { clientVersion: CLIENT_VERSION, ...context }
    if (context.token && !Object.hasOwn(context, 'app')) {
      const session = this.store.db
        .prepare('SELECT app FROM sessions WHERE token_hash=?')
        .get(hash(context.token))
      if (session) headers.app = session.app
    }
    return super.handle(method, path, body, headers)
  }
}
