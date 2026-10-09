/**
 * 改名之后第一次启动搬数据：从同一个上级目录里的 qonlang-study 拷到 qonsona，旧目录不动；
 * 新目录已经有学习数据、搬过一次、别的数据目录名（测试身份）都不搬；Chromium 的缓存不拷。
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { migrateLegacyData } from '../src/main/migrate'

const root = mkdtempSync(join(tmpdir(), 'qonsona-migrate-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const put = (base: string, rel: string, text: string): void => {
  const p = join(base, rel)
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, text)
}

/** 一个装过旧版的「AppData\Roaming」：旧目录里有学习数据，也有 Chromium 自己的东西 */
function appData(name: string): { base: string; old: string; now: string } {
  const base = join(root, name)
  const old = join(base, 'qonlang-study')
  put(old, 'prefs.json', '{"locale":"en"}')
  put(old, 'window.json', '{"width":1200}')
  put(old, 'packs/ja/manifest.json', '{"id":"ja"}')
  put(old, 'recordings/qon-1/entry-2.webm', 'rec')
  put(old, 'Local State', '{}')
  put(old, 'GPUCache/data_0', 'gpu')
  put(old, 'tts-cache/a.wav', 'wav')
  return { base, old, now: join(base, 'qonsona') }
}

describe('改名后搬数据', () => {
  it('新目录里没有学习数据时拷过来，旧目录不动，只搬一次', () => {
    const { old, now } = appData('first')
    // Electron 启动时已经在新目录里建了自己的东西
    put(now, 'Local State', '{"new":true}')
    const r = migrateLegacyData(now, new Date('2026-10-09T03:00:00Z'))
    expect(r?.from).toBe(old)
    expect(r?.entries).toEqual(['prefs.json', 'packs', 'recordings', 'window.json'])
    expect(readFileSync(join(now, 'prefs.json'), 'utf8')).toBe('{"locale":"en"}')
    expect(readFileSync(join(now, 'packs/ja/manifest.json'), 'utf8')).toBe('{"id":"ja"}')
    expect(readFileSync(join(now, 'recordings/qon-1/entry-2.webm'), 'utf8')).toBe('rec')
    expect(readFileSync(join(now, 'window.json'), 'utf8')).toBe('{"width":1200}')
    // Chromium 的、缓存不拷；新目录自己的不盖
    expect(existsSync(join(now, 'GPUCache'))).toBe(false)
    expect(existsSync(join(now, 'tts-cache'))).toBe(false)
    expect(readFileSync(join(now, 'Local State'), 'utf8')).toBe('{"new":true}')
    expect(existsSync(join(now, '.migrate-staging'))).toBe(false)
    // 旧目录原样留着
    expect(readdirSync(old).sort()).toEqual(
      [
        'GPUCache',
        'Local State',
        'packs',
        'prefs.json',
        'recordings',
        'tts-cache',
        'window.json'
      ].sort()
    )
    expect(JSON.parse(readFileSync(join(now, 'migrated-from.json'), 'utf8'))).toMatchObject({
      from: old,
      at: '2026-10-09T03:00:00.000Z'
    })

    // 在新版里把数据清空了也不再搬
    rmSync(join(now, 'packs'), { recursive: true })
    rmSync(join(now, 'prefs.json'))
    expect(migrateLegacyData(now)).toBeNull()
    expect(existsSync(join(now, 'packs'))).toBe(false)
  })

  it('新目录里已经有学习数据：不拿旧的盖', () => {
    const { now } = appData('second')
    put(now, 'notebook/ja.json', '{"cards":3}')
    expect(migrateLegacyData(now)).toBeNull()
    expect(existsSync(join(now, 'prefs.json'))).toBe(false)
    expect(readFileSync(join(now, 'notebook/ja.json'), 'utf8')).toBe('{"cards":3}')
  })

  it('没有旧目录、旧目录里没有学习数据、别的数据目录名：不搬', () => {
    expect(migrateLegacyData(join(root, 'fresh', 'qonsona'))).toBeNull()
    const empty = join(root, 'empty')
    put(join(empty, 'qonlang-study'), 'GPUCache/data_0', 'gpu')
    expect(migrateLegacyData(join(empty, 'qonsona'))).toBeNull()
    expect(existsSync(join(empty, 'qonsona'))).toBe(false)
    // 验收增量更新的测试身份、自己指定的 --user-data-dir
    const { base } = appData('other')
    expect(migrateLegacyData(join(base, 'qonsona-updatetest'))).toBeNull()
    expect(migrateLegacyData(join(base, 'smoke-ud'))).toBeNull()
  })
})
