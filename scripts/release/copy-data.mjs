// 在 GitHub runner 内复制已经核验的旧词库，新增不可变版本资产，不删除或覆盖任何资产。
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DATA_RELEASE, REPO, api, downloadAsset, findRelease, token } from './github.mjs'

const FIXED_REPO = 'Kinnuch/Qonsona'
const API_PREFIX = `/repos/${FIXED_REPO}`
const STORAGE_HOSTS = new Set(['release-assets.githubusercontent.com'])
const VERSION = '(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)'
const ASSET_NAME = new RegExp(`^qonsona-data-(${VERSION})\\.zip$`)
const nativeFetch = globalThis.fetch
let uploadPath = ''

// 共用下载器保留 API 重定向响应；存储跳转在这里逐次检查，绝不携带登录凭据。
globalThis.fetch = async (input, init = {}) => {
  let url
  try {
    url = new URL(input)
  } catch {
    throw new Error('Unexpected network URL')
  }
  const headers = new Headers(init.headers)
  const method = (init.method || 'GET').toUpperCase()
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash)
      throw new Error('Unexpected network URL authority')
    const storage = STORAGE_HOSTS.has(url.hostname)
    if (url.hostname === 'api.github.com') {
      if (!url.pathname.startsWith(`${API_PREFIX}/`) || method !== 'GET')
        throw new Error('Unexpected GitHub API request')
    } else if (url.hostname === 'uploads.github.com') {
      if (!uploadPath || url.pathname !== uploadPath || method !== 'POST')
        throw new Error('Unexpected GitHub upload request')
    } else if (!storage || method !== 'GET') throw new Error('Unexpected download host')
    if (
      storage &&
      ['authorization', 'cookie', 'proxy-authorization'].some((name) => headers.has(name))
    )
      throw new Error('Credentials must not reach storage hosts')
    const res = await nativeFetch(url, {
      ...init,
      headers,
      redirect: 'manual',
      signal: init.signal || AbortSignal.timeout(storage ? 900000 : 120000)
    })
    if (!storage || res.status < 300 || res.status >= 400) return res
    const location = res.headers.get('location')
    await res.body?.cancel()
    if (!location || redirects === 5) throw new Error('Invalid storage redirect')
    url = new URL(location, url)
  }
  throw new Error('Too many storage redirects')
}

function manifest(value) {
  if (
    value?.format !== 1 ||
    !new RegExp(`^${VERSION}$`).test(value.version) ||
    value.asset !== `qonsona-data-${value.version}.zip` ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes <= 0 ||
    !/^[a-f0-9]{64}$/.test(value.sha256) ||
    !Array.isArray(value.files) ||
    !value.files.length
  )
    throw new Error('Invalid dictionary manifest')
  const paths = new Set()
  for (const file of value.files) {
    if (
      !/^[a-z]{2,3}\/[^/]+\.sqlite$/.test(file.path) ||
      file.path.includes('..') ||
      paths.has(file.path) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes <= 0 ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      throw new Error('Invalid dictionary file manifest')
    paths.add(file.path)
  }
  return value
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    )
  return value
}

function payload(value) {
  const content = { ...value }
  delete content.version
  delete content.asset
  return JSON.stringify(canonical(content))
}

function verifyAsset(asset, name, expected) {
  if (
    !Number.isSafeInteger(asset?.id) ||
    asset.id <= 0 ||
    asset.name !== name ||
    asset.state !== 'uploaded' ||
    asset.size !== expected.bytes ||
    asset.digest !== `sha256:${expected.sha256}`
  )
    throw new Error(`Immutable asset is incomplete or differs: ${name}; do not replace it`)
}

async function json(path) {
  const res = await api(path)
  if (!res.ok) throw new Error(`Unexpected GitHub API status: ${res.status}`)
  return res.json()
}

async function assets(releaseId) {
  const found = []
  for (let page = 1; page <= 10; page++) {
    const batch = await json(`${API_PREFIX}/releases/${releaseId}/assets?per_page=100&page=${page}`)
    if (!Array.isArray(batch)) throw new Error('Invalid asset list')
    found.push(...batch)
    if (batch.length < 100) return found
  }
  throw new Error('Asset list exceeds the bounded scan')
}

async function main() {
  if (REPO !== FIXED_REPO || !process.env.GITHUB_TOKEN)
    throw new Error('Run this job for Kinnuch/Qonsona with GITHUB_TOKEN')
  const target = manifest(
    JSON.parse(readFileSync(new URL('../../data/release-data.json', import.meta.url), 'utf8'))
  )
  const sourceName = process.env.SOURCE_ASSET || 'qonsona-data-0.4.0.zip'
  const sourceMatch = ASSET_NAME.exec(sourceName)
  if (!sourceMatch || sourceName === target.asset)
    throw new Error('Invalid prior source asset name')
  const original = await json(
    `${API_PREFIX}/contents/data/release-data.json?ref=${encodeURIComponent(`v${sourceMatch[1]}`)}`
  )
  if (
    original?.type !== 'file' ||
    original.path !== 'data/release-data.json' ||
    original.encoding !== 'base64' ||
    !Number.isSafeInteger(original.size) ||
    original.size <= 0 ||
    original.size > 131072 ||
    typeof original.content !== 'string'
  )
    throw new Error('Invalid source-tag manifest response')
  const sourceManifest = manifest(
    JSON.parse(Buffer.from(original.content, 'base64').toString('utf8'))
  )
  if (
    sourceManifest.asset !== sourceName ||
    sourceManifest.version !== sourceMatch[1] ||
    payload(sourceManifest) !== payload(target)
  )
    throw new Error('Source-tag dictionary contents differ from the target manifest')
  const release = await findRelease(DATA_RELEASE)
  if (
    !release?.draft ||
    release.tag_name !== DATA_RELEASE ||
    !Number.isSafeInteger(release.id) ||
    release.id <= 0
  )
    throw new Error('Expected the existing build-data draft release')
  const list = await assets(release.id)
  const matches = (name) => list.filter((asset) => asset.name === name)
  if (matches(sourceName).length !== 1 || matches(target.asset).length > 1)
    throw new Error('Missing or ambiguous immutable asset')
  const source = matches(sourceName)[0]
  verifyAsset(source, sourceName, target)
  let saved = matches(target.asset)[0]
  let copied = false
  if (saved) verifyAsset(saved, target.asset, target)
  else {
    const bytes = await downloadAsset(source)
    if (
      bytes.byteLength !== target.bytes ||
      createHash('sha256').update(bytes).digest('hex') !== target.sha256
    )
      throw new Error('Downloaded source dictionary bytes or SHA-256 differ')
    const upload = new URL(release.upload_url.replace(/\{.*$/, ''))
    uploadPath = `${API_PREFIX}/releases/${release.id}/assets`
    if (
      upload.origin !== 'https://uploads.github.com' ||
      upload.pathname !== uploadPath ||
      upload.search ||
      upload.hash ||
      upload.username ||
      upload.password
    )
      throw new Error('Unexpected build-data upload URL')
    upload.searchParams.set('name', target.asset)
    const res = await fetch(upload, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/zip',
        'User-Agent': 'qonsona-release'
      },
      body: bytes,
      signal: AbortSignal.timeout(900000)
    })
    if (!res.ok)
      throw new Error(`Dictionary upload failed: ${res.status}; existing assets were retained`)
    saved = await res.json()
    verifyAsset(saved, target.asset, target)
    copied = true
  }
  const readback = await json(`${API_PREFIX}/releases/assets/${saved.id}`)
  verifyAsset(readback, target.asset, target)
  console.log(
    JSON.stringify({
      source: sourceName,
      asset: readback.name,
      state: readback.state,
      bytes: readback.size,
      digest: readback.digest,
      copied,
      verified: true
    })
  )
}

main().catch((error) => {
  const secret = process.env.GITHUB_TOKEN || ''
  const message = String(error?.message || 'Unknown failure')
  console.error(
    'Dictionary copy failed: ' +
      (secret ? message.split(secret).join('[redacted]') : message).slice(0, 500)
  )
  process.exitCode = 1
})
