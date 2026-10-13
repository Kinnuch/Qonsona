import { createHash } from 'node:crypto'
import { unzipSync, zipSync } from 'fflate'
export const DATA_FILES = [
  'ja/dict.sqlite',
  'ja/wikt.sqlite',
  ...['en', 'fr', 'ko', 'es', 'ar', 'ru', 'gd', 'qya', 'sjn'].map((code) => `${code}/dict.sqlite`)
]
// Published 0.2.0 is immutable: eight languages, including two Japanese databases.
export const LEGACY_020_DATA_FILES = [
  'ja/dict.sqlite',
  'ja/wikt.sqlite',
  ...['en', 'fr', 'ko', 'es', 'ar', 'ru', 'gd'].map((code) => `${code}/dict.sqlite`)
]
export function dataFilesForManifest(manifest) {
  if (
    manifest?.format !== 1 ||
    typeof manifest.version !== 'string' ||
    !/^[\w.-]+$/.test(manifest.version) ||
    manifest.asset !== `qonsona-data-${manifest.version}.zip` ||
    !Array.isArray(manifest.files)
  )
    throw new Error('Invalid dictionary manifest')
  const exact = (paths) =>
    manifest.files.length === paths.length &&
    new Set(manifest.files.map((file) => file?.path)).size === paths.length &&
    paths.every((path) => manifest.files.some((file) => file?.path === path))
  if (exact(DATA_FILES)) return DATA_FILES
  if (manifest.version === '0.2.0' && exact(LEGACY_020_DATA_FILES)) return LEGACY_020_DATA_FILES
  throw new Error(
    'Dictionary manifest has missing or extra files; new bundles require all eleven databases'
  )
}
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
  const paths = dataFilesForManifest(manifest)
  if (zip.length !== manifest.bytes || digest(zip) !== manifest.sha256)
    throw new Error('Dictionary archive checksum mismatch')
  const expected = new Map(manifest.files.map((file) => [file.path, file]))
  if (expected.size !== paths.length || paths.some((path) => !expected.has(path)))
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
