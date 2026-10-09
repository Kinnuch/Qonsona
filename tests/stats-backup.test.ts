/**
 * 统计与备份：学习时长的记录与按天、按模块汇总，连续天数；
 * 备份打包（只收学习数据）、读回来、下次启动时恢复（原来的数据挪到一边），坏文件与别的 zip 不收；
 * 改名（原名 Qonlang Study）之前做的备份照样能恢复。
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import {
  addSeconds,
  emptyActivity,
  lastDays,
  longestStreak,
  normalizeActivity,
  secondsByModule,
  secondsOn,
  streak
} from '$shared/stats'
import { applyPendingRestore, createBackup, readBackup, scheduleRestore } from '../src/main/backup'

describe('学习时长', () => {
  it('按天、语言、模块记，汇总', () => {
    const log = emptyActivity()
    addSeconds(log, '2026-09-20', 'ja', 'reading', 30)
    addSeconds(log, '2026-09-20', 'ja', 'reading', 15)
    addSeconds(log, '2026-09-20', 'ja', 'practice', 60)
    addSeconds(log, '2026-09-20', 'art', 'courses', 100)
    addSeconds(log, '2026-09-21', 'ja', 'media', 0)
    expect(secondsOn(log, '2026-09-20', 'ja')).toBe(105)
    expect(secondsOn(log, '2026-09-20')).toBe(205)
    expect(secondsOn(log, '2026-09-21', 'ja')).toBe(0)
    expect(secondsByModule(log, 'ja', ['2026-09-20', '2026-09-21'])).toEqual({
      reading: 45,
      practice: 60
    })
  })

  it('读回来的记录：坏的丢掉', () => {
    const log = normalizeActivity({
      days: { '2026-09-20': { packs: { ja: { reading: 12, x: -3 } } }, bad: {}, '2026-09-21': null }
    })
    expect(log.days).toEqual({ '2026-09-20': { packs: { ja: { reading: 12 } } } })
    expect(normalizeActivity(null)).toEqual(emptyActivity())
  })

  it('最近几天的日期（跨月）', () => {
    const now = new Date(2026, 9, 2, 9).getTime()
    expect(lastDays(4, now)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
  })

  it('连续天数：今天学了从今天数，没学从昨天数；最长一段', () => {
    const now = new Date(2026, 8, 24, 20).getTime()
    const days = new Set([
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-10',
      '2026-09-11'
    ])
    expect(streak(days, now)).toEqual({ days: 4, today: false })
    days.add('2026-09-24')
    expect(streak(days, now)).toEqual({ days: 5, today: true })
    expect(streak(new Set(['2026-09-20']), now)).toEqual({ days: 0, today: false })
    expect(longestStreak(days)).toBe(5)
    expect(longestStreak(new Set())).toBe(0)
  })
})

describe('备份与恢复', () => {
  const root = mkdtempSync(join(tmpdir(), 'qstudy-backup-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  const put = (base: string, rel: string, text: string): void => {
    const p = join(base, rel)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, text)
  }

  it('打包学习数据（缓存、窗口位置不收），恢复时原来的数据挪到一边', async () => {
    const a = join(root, 'a')
    put(a, 'prefs.json', '{"locale":"en"}')
    put(a, 'notebook/ja.json', '{"cards":1}')
    put(a, 'media/subs/x/1.srt', 'sub')
    put(a, 'packs/p1/manifest.json', '{}')
    put(a, 'tts-cache/abc.wav', 'cache')
    put(a, 'window.json', '{}')
    put(a, 'notebook/ja.json.tmp', 'half')
    const zip = join(root, 'b.zip')
    const r = await createBackup(a, zip, '0.6.0')
    expect(r.files).toBe(4)

    const info = await readBackup(zip)
    expect(info.ok).toBe(true)
    if (!info.ok) return
    expect(Object.keys(info.files).sort()).toEqual([
      'media/subs/x/1.srt',
      'notebook/ja.json',
      'packs/p1/manifest.json',
      'prefs.json'
    ])
    expect(info.manifest.appVersion).toBe('0.6.0')
    expect(info.manifest.app).toBe('qonsona')
    expect(JSON.parse(strFromU8(unzipSync(readFileSync(zip))['qonsona-backup.json'])).app).toBe(
      'qonsona'
    )

    // 另一份数据：恢复前有自己的生词本和课程进度
    const b = join(root, 'b')
    put(b, 'notebook/ja.json', '{"cards":99}')
    put(b, 'courses/ja.json', '{"old":true}')
    put(b, 'tts-cache/keep.wav', 'cache')
    expect(await applyPendingRestore(b)).toBeNull()
    await scheduleRestore(b, zip)
    const done = await applyPendingRestore(b)
    expect(done?.ok).toBe(true)
    expect(readFileSync(join(b, 'notebook/ja.json'), 'utf8')).toBe('{"cards":1}')
    expect(readFileSync(join(b, 'prefs.json'), 'utf8')).toBe('{"locale":"en"}')
    // 备份里没有的课程进度：原来的挪到一边了
    expect(existsSync(join(b, 'courses'))).toBe(false)
    if (done?.ok) {
      expect(readFileSync(join(done.saved, 'courses/ja.json'), 'utf8')).toBe('{"old":true}')
      expect(readFileSync(join(done.saved, 'notebook/ja.json'), 'utf8')).toBe('{"cards":99}')
    }
    // 缓存不动；恢复记录用过就删
    expect(existsSync(join(b, 'tts-cache/keep.wav'))).toBe(true)
    expect(await applyPendingRestore(b)).toBeNull()
  })

  it('别的 zip、坏文件、带 .. 的路径都不收', async () => {
    const other = join(root, 'other.zip')
    writeFileSync(other, zipSync({ 'a.txt': strToU8('x') }))
    expect(await readBackup(other)).toEqual({ ok: false, reason: 'not-backup' })

    const broken = join(root, 'broken.zip')
    writeFileSync(broken, 'not a zip')
    expect(await readBackup(broken)).toEqual({ ok: false, reason: 'unreadable' })

    // 改名之前的备份（清单叫 qonlang-study-backup.json）也认，只是里面不安全的路径照样不收
    const evil = join(root, 'evil.zip')
    writeFileSync(
      evil,
      zipSync({
        'qonlang-study-backup.json': strToU8(
          JSON.stringify({
            app: 'qonlang-study',
            format: 1,
            appVersion: '9',
            createdAt: '',
            files: 3
          })
        ),
        'data/../escape.txt': strToU8('x'),
        'data/secret/x.txt': strToU8('x'),
        'data/notebook/ja.json': strToU8('{}')
      })
    )
    const info = await readBackup(evil)
    expect(info.ok && Object.keys(info.files)).toEqual(['notebook/ja.json'])

    // 恢复一个不认得的文件：什么都不动
    const c = join(root, 'c')
    put(c, 'notebook/ja.json', 'mine')
    await scheduleRestore(c, broken)
    expect(await applyPendingRestore(c)).toEqual({ ok: false, reason: 'unreadable' })
    expect(readFileSync(join(c, 'notebook/ja.json'), 'utf8')).toBe('mine')
  })
})
