/**
 * 检查更新里不依赖 Electron 的部分：发布在哪、挑安装包、比版本号、读 latest.yml。
 * 做法照千语集（Qonlang 的 src/main/update.ts）；单独放一个文件，测试里能直接引用。
 */

import type { Installer } from '../shared/update'

/**
 * 发布的地方（GitHub Release，2026-10-09 起叫 Qonsona，原名 Qonlang Study）。改仓库名时三处一起改：
 * 这里、electron-builder.yml 的 publish、scripts/pack-win.sh 写的 app-update.yml。
 */
export const RELEASE_OWNER = 'Kinnuch'
export const RELEASE_REPO = 'Qonsona'
export const REPO_URL = `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}`
/** 安装包的文件名前缀（electron-builder.yml 的 artifactName） */
export const ARTIFACT = 'Qonsona'

/** GitHub Release 接口里的一个资产 */
export interface ReleaseAsset {
  name?: string
  browser_download_url?: string
  size?: number
  /** GitHub 给每个资产算的摘要，形如 `sha256:<hex>`；老的 Release 可能没有 */
  digest?: string | null
}

export interface InstallerTarget {
  platform: string
  arch: 'arm64' | 'x64'
}

/** `sha256:ABC…` → 小写十六进制；不是这个格式就当没有 */
export function sha256FromDigest(digest: string | null | undefined): string | null {
  const m = /^sha256:([0-9a-f]{64})$/i.exec((digest ?? '').trim())
  return m ? m[1].toLowerCase() : null
}

/**
 * 从 Release 资产里挑本机的安装包。
 * Windows：-setup.exe（静默安装，装完自动重开）。
 * macOS：本机芯片对应的 dmg，下好打开，让用户自己拖进「应用程序」；Linux 有 AppImage 时同样下好打开。
 */
export function pickInstaller(assets: ReleaseAsset[], target: InstallerTarget): Installer | null {
  const usable = assets.filter((a) => a.name && a.browser_download_url)
  const find = (test: (lower: string) => boolean): ReleaseAsset | undefined =>
    usable.find((a) => test(a.name!.toLowerCase()))
  const make = (a: ReleaseAsset | undefined, auto: boolean): Installer | null =>
    a
      ? {
          url: a.browser_download_url!,
          name: a.name!,
          size: a.size ?? 0,
          sha256: sha256FromDigest(a.digest),
          auto
        }
      : null
  if (target.platform === 'win32')
    return make(
      find((n) => n.endsWith('-setup.exe')),
      true
    )
  if (target.platform === 'darwin')
    return make(
      find((n) => n.endsWith(`-mac-${target.arch}.dmg`)),
      false
    )
  return make(
    find((n) => n.endsWith('.appimage')),
    false
  )
}

/**
 * 不走 GitHub 接口时用：github.com/…/releases/latest 跳转过去的地址里的版本号
 * （…/releases/tag/v0.4.0 → 0.4.0）。接口的匿名额度每个 IP 每小时只有 60 次，这个跳转不占额度。
 */
export function versionFromReleaseUrl(url: string): string | null {
  const m = /\/releases\/tag\/v?([^/?#]+)/.exec(url)
  if (!m) return null
  const v = decodeURIComponent(m[1]).trim()
  return /^\d+(\.\d+)*([.-][0-9A-Za-z.-]+)?$/.test(v) ? v : null
}

/** latest.yml 里的版本号与安装包（只认用得到的几项：url、sha512、size） */
export function parseLatestYml(text: string): {
  version: string | null
  files: { url: string; sha512: string | null; size: number }[]
} {
  const version = /^version:\s*['"]?([^'"\s]+)/m.exec(text)?.[1] ?? null
  const files: { url: string; sha512: string | null; size: number }[] = []
  let cur: { url: string; sha512: string | null; size: number } | null = null
  for (const line of text.split(/\r?\n/)) {
    const url = /^\s*-\s*url:\s*['"]?([^'"]+?)['"]?\s*$/.exec(line)
    if (url) {
      cur = { url: url[1], sha512: null, size: 0 }
      files.push(cur)
      continue
    }
    if (!cur || !/^\s{2,}/.test(line)) {
      if (!/^\s/.test(line)) cur = null
      continue
    }
    const sha = /^\s+sha512:\s*['"]?([^'"\s]+)/.exec(line)
    if (sha) cur.sha512 = sha[1]
    const size = /^\s+size:\s*(\d+)/.exec(line)
    if (size) cur.size = Number(size[1])
  }
  return { version, files }
}

/** 按 Release 的命名规则（electron-builder.yml 的 artifactName），本机该下哪个文件 */
export function installerCandidates(
  version: string,
  target: InstallerTarget
): { name: string; auto: boolean }[] {
  if (target.platform === 'win32') return [{ name: `${ARTIFACT}-${version}-setup.exe`, auto: true }]
  if (target.platform === 'darwin')
    return [{ name: `${ARTIFACT}-${version}-mac-${target.arch}.dmg`, auto: false }]
  return [{ name: `${ARTIFACT}-${version}.AppImage`, auto: false }]
}

/** 「0.4.1」这类版本号比大小；只比数字段（0.4.1-local 不比 0.4.1 新） */
export function newerThan(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).map((x) => Number(x) || 0)
  const pb = b.split(/[.-]/).map((x) => Number(x) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d > 0
  }
  return false
}
