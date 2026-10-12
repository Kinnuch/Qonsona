// Upload an immutable versioned dictionary bundle; retain earlier releases' build data.
import { DATA_RELEASE, REPO, api, findRelease, token } from './github.mjs'
import { prepareData } from './prepare-data.mjs'
const { zip, manifest } = prepareData()
let rel = await findRelease(DATA_RELEASE)
if (!rel)
  rel = await (
    await api(`/repos/${REPO}/releases`, {
      method: 'POST',
      body: {
        tag_name: DATA_RELEASE,
        name: DATA_RELEASE,
        draft: true,
        body: 'Dictionary data for CI builds — not a user release.'
      }
    })
  ).json()
const existing = rel.assets.find((asset) => asset.name === manifest.asset)
if (existing) {
  if (existing.digest !== `sha256:${manifest.sha256}` || existing.size !== manifest.bytes)
    throw new Error('Existing immutable dictionary asset differs; do not replace it')
  console.log('Verified existing immutable asset: ' + manifest.asset)
} else {
  const upload = rel.upload_url.replace(/\{.*$/, '') + `?name=${encodeURIComponent(manifest.asset)}`
  if (new URL(upload).hostname !== 'uploads.github.com') throw new Error('Unexpected upload host')
  const res = await fetch(upload, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/zip',
      'User-Agent': 'qonsona-release'
    },
    body: zip
  })
  if (!res.ok) throw new Error(`Dictionary upload failed: ${res.status} ${await res.text()}`)
  const saved = await res.json()
  if (saved.size !== manifest.bytes || saved.digest !== `sha256:${manifest.sha256}`)
    throw new Error('Uploaded dictionary checksum mismatch')
  console.log(JSON.stringify({ asset: saved.name, bytes: saved.size, digest: saved.digest }))
}
