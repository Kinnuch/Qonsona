/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain Node server module. */
import { ApiError, fail } from './domain.mjs'

export const POLICY_TTL = 120000
export const POLICY_TIMEOUT = 4000
export const POLICY_RETRY = 10000
const MAX_RELEASE_BYTES = 512000
const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/
const REPO = 'Kinnuch/Qonsona'
const ENDPOINT = `https://api.github.com/repos/${REPO}/releases/latest`

async function releaseJson(response) {
  if (response.status !== 200 || response.redirected) throw new Error('Release unavailable')
  if (response.url && response.url !== ENDPOINT) throw new Error('Unexpected release origin')
  const declared = response.headers?.get('content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_RELEASE_BYTES))
    throw new Error('Release metadata too large')
  let bytes
  if (response.body?.getReader) {
    const reader = response.body.getReader()
    const chunks = []
    let length = 0
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        length += value.byteLength
        if (length > MAX_RELEASE_BYTES) throw new Error('Release metadata too large')
        chunks.push(Buffer.from(value))
      }
      bytes = Buffer.concat(chunks)
    } finally {
      await reader.cancel().catch(() => {})
    }
  } else {
    bytes = Buffer.from(await response.text())
    if (bytes.byteLength > MAX_RELEASE_BYTES) throw new Error('Release metadata too large')
  }
  const release = JSON.parse(bytes.toString('utf8'))
  const tag = typeof release?.tag_name === 'string' ? release.tag_name : ''
  const version = tag.startsWith('v') ? tag.slice(1) : ''
  if (
    !VERSION.test(version) ||
    release.draft !== false ||
    release.prerelease !== false ||
    !Number.isSafeInteger(release.id) ||
    release.id <= 0 ||
    typeof release.published_at !== 'string' ||
    !Number.isFinite(Date.parse(release.published_at)) ||
    release.html_url !== `https://github.com/${REPO}/releases/tag/${tag}`
  )
    throw new Error('Invalid formal release metadata')
  return { version, releaseUrl: release.html_url }
}

/** Short-lived authoritative latest-version policy, shared across concurrent requests. */
export class ClientPolicy {
  constructor({ now = Date.now, fetch = globalThis.fetch, env = process.env } = {}) {
    this.now = now
    this.fetch = fetch
    this.cached = null
    this.pending = null
    this.retryAt = 0
    this.failures = 0
    this.override = env.NODE_ENV !== 'production' ? env.QON_TEST_CLIENT_VERSION : null
    if (this.override && !VERSION.test(this.override))
      throw new Error('Invalid QON_TEST_CLIENT_VERSION')
  }
  async get(app = 'qonsona') {
    if (!['qonsona', 'qonlang'].includes(app)) fail('INVALID_APP')
    const now = this.now()
    if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(now + POLICY_TTL))
      fail('CLIENT_POLICY_UNAVAILABLE', 503)
    if (app === 'qonlang')
      return Object.freeze({
        app,
        mode: 'legacy-auth-only',
        currentVersion: null,
        source: 'legacy-account-compatibility',
        checkedAt: now,
        serverTime: now,
        validUntil: now + POLICY_TTL,
        releaseUrl: 'https://github.com/Kinnuch/Qonlang/releases/latest'
      })
    if (this.override)
      return Object.freeze({
        app,
        mode: 'exact-latest',
        currentVersion: this.override,
        source: 'test-override',
        checkedAt: now,
        serverTime: now,
        validUntil: now + POLICY_TTL,
        releaseUrl: `https://github.com/${REPO}/releases/tag/v${this.override}`
      })
    if (this.cached && now >= this.cached.checkedAt && now < this.cached.validUntil)
      return this.view(this.cached)
    if (this.pending) return this.view(await this.pending)
    if (now < this.retryAt) fail('CLIENT_POLICY_UNAVAILABLE', 503)
    this.pending = this.refresh()
    try {
      return this.view(await this.pending)
    } finally {
      this.pending = null
    }
  }
  view(policy) {
    const serverTime = this.now()
    if (
      !Number.isSafeInteger(serverTime) ||
      serverTime < policy.checkedAt ||
      serverTime >= policy.validUntil
    )
      fail('CLIENT_POLICY_UNAVAILABLE', 503)
    return Object.freeze({ ...policy, serverTime })
  }
  async refresh() {
    const controller = new AbortController()
    let timer
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error('Release lookup timeout'))
        }, POLICY_TIMEOUT)
      })
      const metadata = await Promise.race([
        Promise.resolve()
          .then(() =>
            this.fetch(ENDPOINT, {
              redirect: 'error',
              signal: controller.signal,
              headers: {
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'qon-account-client-policy'
              }
            })
          )
          .then(releaseJson),
        timeout
      ])
      const checkedAt = this.now()
      if (!Number.isSafeInteger(checkedAt) || !Number.isSafeInteger(checkedAt + POLICY_TTL))
        throw new Error('Invalid policy clock')
      this.cached = Object.freeze({
        app: 'qonsona',
        mode: 'exact-latest',
        currentVersion: metadata.version,
        source: 'github-latest',
        checkedAt,
        validUntil: checkedAt + POLICY_TTL,
        releaseUrl: metadata.releaseUrl
      })
      this.retryAt = 0
      this.failures = 0
      return this.cached
    } catch {
      // Expired successes cannot authorize any operation while GitHub is unavailable.
      this.cached = null
      this.failures++
      this.retryAt =
        this.now() + Math.min(POLICY_TTL, POLICY_RETRY * 2 ** Math.min(this.failures - 1, 4))
      fail('CLIENT_POLICY_UNAVAILABLE', 503)
    } finally {
      clearTimeout(timer)
      controller.abort()
    }
  }
  async require(app, clientVersion) {
    const policy = await this.get(app)
    if (policy.mode === 'exact-latest' && clientVersion !== policy.currentVersion) {
      const error = new ApiError('CLIENT_UPDATE_REQUIRED', 426)
      error.currentVersion = policy.currentVersion
      error.releaseUrl = policy.releaseUrl
      throw error
    }
    return policy
  }
}
