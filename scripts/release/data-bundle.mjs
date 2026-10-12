import { createHash } from 'node:crypto'
import { unzipSync, zipSync } from 'fflate'
export const DATA_FILES = [
  'ja/dict.sqlite',
  'ja/wikt.sqlite',
  ...['en', 'fr', 'ko', 'es', 'ar', 'ru', 'gd'].map((code) => `${code}/dict.sqlite`)
]
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
export function makeBundle(files, version) {
  const entries = Object.fromEntries(
    DATA_FILES.map((path) => {
      if (!files[path]?.length) throw new Error('Missing dictionary: ' + path)
      return [path, [files[path], { level: 6, mtime: new Date('2000-01-01T00:00:00Z') }]]
    })
  )
  const zip = zipSync(entries)
  const manifest = {
    format: 1,
    version,
    asset: `qonsona-data-${version}.zip`,
    bytes: zip.length,
    sha256: digest(zip),
    files: DATA_FILES.map((path) => ({
      path,
      bytes: files[path].length,
      sha256: digest(files[path])
    }))
  }
  return { zip, manifest }
}
export function verifyBundle(zip, manifest) {
  if (
    manifest.format !== 1 ||
    !/^qonsona-data-[\w.-]+\.zip$/.test(manifest.asset) ||
    !Array.isArray(manifest.files)
  )
    throw new Error('Invalid dictionary manifest')
  if (zip.length !== manifest.bytes || digest(zip) !== manifest.sha256)
    throw new Error('Dictionary archive checksum mismatch')
  const expected = new Map(manifest.files.map((file) => [file.path, file]))
  if (expected.size !== DATA_FILES.length || DATA_FILES.some((path) => !expected.has(path)))
    throw new Error('Dictionary manifest has missing or extra files')
  const files = unzipSync(zip)
  if (Object.keys(files).length !== expected.size)
    throw new Error('Dictionary archive has missing or extra files')
  for (const [path, bytes] of Object.entries(files)) {
    const info = expected.get(path)
    if (
      !info ||
      bytes.length !== info.bytes ||
      digest(bytes) !== info.sha256 ||
      Buffer.from(bytes.subarray(0, 16)).toString() !== 'SQLite format 3\0'
    )
      throw new Error('Dictionary integrity check failed: ' + path)
  }
  return files
}
