/**
 * 检查更新里不依赖 Electron 的部分：挑安装包、比版本号、从跳转地址取版本号、读 latest.yml、
 * 更新说明按界面语言挑一段（照千语集的测试）。
 */
import { describe, expect, it } from 'vitest'
import {
  REPO_URL,
  installerCandidates,
  newerThan,
  parseLatestYml,
  pickInstaller,
  sha256FromDigest,
  versionFromReleaseUrl,
  type ReleaseAsset
} from '../src/main/update'
import { notesForLocale } from '../src/shared/update'

const HEX = 'c064d9827405bc09a27173dbaf35024db0e4e9d031893ffb9a52c22288107280'
const asset = (name: string, digest: string | null = `sha256:${HEX}`): ReleaseAsset => ({
  name,
  browser_download_url: `https://example.invalid/${name}`,
  size: 100,
  digest
})
const RELEASE = [
  asset('latest.yml'),
  asset('Qonsona-0.5.0-setup.exe'),
  asset('Qonsona-0.5.0-setup.exe.blockmap'),
  asset('Qonsona-0.5.0-mac-arm64.dmg')
]

describe('挑安装包', () => {
  it('Windows 挑 -setup.exe（不挑 blockmap），能自动装，带 sha256', () => {
    const x = pickInstaller(RELEASE, { platform: 'win32', arch: 'x64' })
    expect(x).toMatchObject({ name: 'Qonsona-0.5.0-setup.exe', auto: true, sha256: HEX })
  })
  it('macOS 有 dmg 就下好让用户自己装；没有本机的包是 null', () => {
    expect(pickInstaller(RELEASE, { platform: 'darwin', arch: 'arm64' })).toMatchObject({
      name: 'Qonsona-0.5.0-mac-arm64.dmg',
      auto: false
    })
    expect(pickInstaller(RELEASE, { platform: 'darwin', arch: 'x64' })).toBeNull()
    expect(pickInstaller(RELEASE, { platform: 'linux', arch: 'x64' })).toBeNull()
  })
  it('没有摘要或摘要不是 sha256 时不校验', () => {
    const x = pickInstaller([asset('Qonsona-0.5.0-setup.exe', null)], {
      platform: 'win32',
      arch: 'x64'
    })
    expect(x?.sha256).toBeNull()
    expect(sha256FromDigest('md5:abc')).toBeNull()
    expect(sha256FromDigest(`sha256:${HEX.toUpperCase()}`)).toBe(HEX)
  })
  it('Linux 只选本机架构的 AppImage，不下载其它架构或不认识的系统包', () => {
    const files = [
      asset('Qonsona-0.5.0-linux-arm64.AppImage'),
      asset('Qonsona-0.5.0-linux-x64.AppImage'),
      asset('Qonsona-0.5.0-linux-x64.deb')
    ]
    expect(pickInstaller(files, { platform: 'linux', arch: 'x64' })).toMatchObject({
      name: 'Qonsona-0.5.0-linux-x64.AppImage',
      auto: false
    })
    expect(pickInstaller(files, { platform: 'linux', arch: 'arm64' })?.name).toBe(
      'Qonsona-0.5.0-linux-arm64.AppImage'
    )
    expect(pickInstaller(files.slice(0, 1), { platform: 'linux', arch: 'x64' })).toBeNull()
    expect(pickInstaller(files, { platform: 'unknown', arch: 'x64' })).toBeNull()
  })
  it('历史无架构 AppImage 仅作为 x64 的兼容候选', () => {
    const files = [asset('Qonsona-0.5.0.AppImage')]
    expect(pickInstaller(files, { platform: 'linux', arch: 'x64' })?.name).toBe(
      'Qonsona-0.5.0.AppImage'
    )
    expect(pickInstaller(files, { platform: 'linux', arch: 'arm64' })).toBeNull()
  })
})

describe('版本号', () => {
  it('按数字段比，本地版不比同号正式版新', () => {
    expect(newerThan('0.5.0', '0.4.9')).toBe(true)
    expect(newerThan('0.10.0', '0.9.9')).toBe(true)
    expect(newerThan('0.4.0', '0.4.0')).toBe(false)
    expect(newerThan('0.4.1', '0.4.1-local')).toBe(false)
  })
  it('从 releases/latest 跳转地址里取版本号', () => {
    expect(versionFromReleaseUrl(`${REPO_URL}/releases/tag/v0.5.0`)).toBe('0.5.0')
    expect(versionFromReleaseUrl(`${REPO_URL}/releases/tag/1.0.0`)).toBe('1.0.0')
    expect(versionFromReleaseUrl(`${REPO_URL}/releases`)).toBeNull()
    expect(versionFromReleaseUrl('https://github.com/login?return_to=x')).toBeNull()
  })
})

describe('接口问不到时', () => {
  it('读 latest.yml 的版本与安装包', () => {
    const yml = [
      'version: 0.5.0',
      'files:',
      '  - url: Qonsona-0.5.0-setup.exe',
      '    sha512: b1xZvy8uJ14CzwVNioXsy5IGugar6fplifRbOgEBhgliY3+2momAwwQg4liYUm07f+dIlzPHRgqSEpZUS+r/lw==',
      '    size: 137558359',
      'path: Qonsona-0.5.0-setup.exe',
      "releaseDate: '2026-09-24T05:07:50.355Z'"
    ].join('\r\n')
    expect(parseLatestYml(yml)).toEqual({
      version: '0.5.0',
      files: [
        {
          url: 'Qonsona-0.5.0-setup.exe',
          sha512:
            'b1xZvy8uJ14CzwVNioXsy5IGugar6fplifRbOgEBhgliY3+2momAwwQg4liYUm07f+dIlzPHRgqSEpZUS+r/lw==',
          size: 137558359
        }
      ]
    })
  })
  it('按命名规则猜本机的安装包', () => {
    expect(installerCandidates('1.2.3', { platform: 'win32', arch: 'x64' })).toEqual([
      { name: 'Qonsona-1.2.3-setup.exe', auto: true }
    ])
    expect(installerCandidates('1.2.3', { platform: 'darwin', arch: 'arm64' })).toEqual([
      { name: 'Qonsona-1.2.3-mac-arm64.dmg', auto: false }
    ])
    expect(installerCandidates('1.2.3', { platform: 'linux', arch: 'x64' })).toEqual([
      { name: 'Qonsona-1.2.3-linux-x64.AppImage', auto: false },
      { name: 'Qonsona-1.2.3.AppImage', auto: false }
    ])
    expect(installerCandidates('1.2.3', { platform: 'linux', arch: 'arm64' })).toEqual([
      { name: 'Qonsona-1.2.3-linux-arm64.AppImage', auto: false }
    ])
  })
})

describe('更新说明', () => {
  const body =
    '## 中文\r\n\r\n- 第一条\r\n- 第二条\r\n\r\n## English\r\n\r\n- First\r\n- Second\r\n'
  it('按界面语言只给一段', () => {
    expect(notesForLocale(body, 'zh')).toBe('- 第一条\r\n- 第二条')
    expect(notesForLocale(body, 'en')).toBe('- First\r\n- Second')
  })
  it('不分段的原样给，太长就截断', () => {
    expect(notesForLocale('  只有一段  ', 'en')).toBe('只有一段')
    expect(notesForLocale('x'.repeat(50), 'zh', 10)).toBe('x'.repeat(10) + '…')
  })
})
