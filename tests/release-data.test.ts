import { describe, it, expect } from 'vitest'
import { zipSync } from 'fflate'
import { LANG_CODES } from '../src/shared/lang/types'
// @ts-expect-error Release bundle scripts deliberately remain executable JavaScript.
import {
  DATA_FILES,
  LEGACY_020_DATA_FILES,
  digest,
  dataFilesForManifest,
  makeBundle,
  verifyBundle
} from '../scripts/release/data-bundle.mjs'
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
  it('covers every registered language plus Japanese and its second dictionary reproducibly', () => {
    expect(DATA_FILES).toEqual([
      'ja/dict.sqlite',
      'ja/wikt.sqlite',
      ...LANG_CODES.map((code) => `${code}/dict.sqlite`)
    ])
    const files = fixture()
    const first = makeBundle(files, '0.2.0'),
      second = makeBundle(files, '0.2.0')
    expect(first.manifest.files).toHaveLength(11)
    expect(first.manifest.sha256).toBe(second.manifest.sha256)
    expect(Object.keys(verifyBundle(first.zip, first.manifest)).sort()).toEqual(
      Object.keys(files).sort()
    )
  })
  it('verifies the historical exact nine-file 0.2.0 bundle without manufacturing new-language data', () => {
    const all = fixture()
    const old = Object.fromEntries(
      (LEGACY_020_DATA_FILES as string[]).map((path) => [path, all[path]])
    )
    const zip = zipSync(old)
    const manifest = {
      format: 1,
      version: '0.2.0',
      asset: 'qonsona-data-0.2.0.zip',
      bytes: zip.length,
      sha256: digest(zip),
      files: Object.entries(old).map(([path, bytes]) => ({
        path,
        bytes: bytes.length,
        sha256: digest(bytes)
      }))
    }
    expect(dataFilesForManifest(manifest)).toEqual(LEGACY_020_DATA_FILES)
    expect(Object.keys(verifyBundle(zip, manifest)).sort()).toEqual(Object.keys(old).sort())
    expect(() =>
      verifyBundle(zip, { ...manifest, version: 'next-test', asset: 'qonsona-data-next-test.zip' })
    ).toThrow('eleven')
    expect(() => makeBundle(old, 'next-test')).toThrow('qya/dict.sqlite')
  })
  it('rejects duplicates, path substitutions and mismatched version/asset names', () => {
    const { zip, manifest } = makeBundle(fixture(), 'next-test')
    expect(() =>
      verifyBundle(zip, { ...manifest, files: [...manifest.files, manifest.files[0]] })
    ).toThrow('manifest')
    expect(() =>
      verifyBundle(zip, {
        ...manifest,
        files: manifest.files.map((file: { path: string }) =>
          file.path === 'qya/dict.sqlite' ? { ...file, path: '../qya/dict.sqlite' } : file
        )
      })
    ).toThrow('manifest')
    expect(() => verifyBundle(zip, { ...manifest, asset: 'qonsona-data-0.2.0.zip' })).toThrow(
      'Invalid dictionary manifest'
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
