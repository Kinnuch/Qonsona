import { describe, it, expect } from 'vitest'
// @ts-expect-error Release bundle scripts deliberately remain executable JavaScript.
import { DATA_FILES, makeBundle, verifyBundle } from '../scripts/release/data-bundle.mjs'
const fixture = () =>
  Object.fromEntries(
    (DATA_FILES as string[]).map((path, i) => {
      const bytes = new Uint8Array(4096)
      bytes.set(Buffer.from('SQLite format 3\0'))
      bytes[100] = i
      return [path, bytes]
    })
  )
describe('immutable release dictionary bundle', () => {
  it('covers all eight languages and the second Japanese dictionary with reproducible archive bytes', () => {
    const files = fixture()
    const first = makeBundle(files, '0.2.0'),
      second = makeBundle(files, '0.2.0')
    expect(first.manifest.files).toHaveLength(9)
    expect(first.manifest.sha256).toBe(second.manifest.sha256)
    expect(Object.keys(verifyBundle(first.zip, first.manifest)).sort()).toEqual(
      Object.keys(files).sort()
    )
  })
  it('rejects corruption before exposing any dictionary for writing', () => {
    const { zip, manifest } = makeBundle(fixture(), '0.2.0')
    zip[70] ^= 1
    expect(() => verifyBundle(zip, manifest)).toThrow('archive checksum')
  })
  it('requires exactly the known dictionaries and their per-file checksum', () => {
    const { zip, manifest } = makeBundle(fixture(), '0.2.0')
    expect(() => verifyBundle(zip, { ...manifest, files: manifest.files.slice(1) })).toThrow(
      'manifest'
    )
    const changed = structuredClone(manifest)
    changed.files[0].sha256 = '0'.repeat(64)
    expect(() => verifyBundle(zip, changed)).toThrow('integrity')
  })
})
