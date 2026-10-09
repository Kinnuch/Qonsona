/**
 * 软件内更新：主进程与界面共用的数据形状（主进程的做法见 src/main/updater.ts）。
 */

export interface Installer {
  url: string
  name: string
  size: number
  /** 下载完按它校验；接口没给就只能不校验 */
  sha256: string | null
  /** 接口问不到时退一步：Windows 安装包按 latest.yml 里的 sha512（base64）校验 */
  sha512?: string | null
  /** 下好之后能不能自动装好并重开（false：打开安装包让用户自己装） */
  auto: boolean
}

export interface UpdateInfo {
  version: string
  url: string
  notes: string
  /** 这台机器能直接装的安装包；没有对应资产时为空，只能去下载页 */
  installer: Installer | null
}

/** 检查更新的结果：失败时写明原因，设置页「立即检查」要显示 */
export interface UpdateCheck {
  status: 'newer' | 'latest' | 'failed'
  /** Release 上的最新版本号 */
  latest?: string
  info?: UpdateInfo
  error?: 'offline' | 'rateLimited' | 'notFound'
}

/**
 * Release 的说明按「## 中文」「## English」两段写（scripts/release-notes.mjs 从两份更新日志里摘）：
 * 提示里只放界面语言那一段，太长就截断（全文在发布页上）。不是这样分段的原样放。
 */
export function notesForLocale(body: string, locale: string, max = 1200): string {
  const zh = /^##\s*中文\s*$/m.exec(body)
  const en = /^##\s*English\s*$/m.exec(body)
  let text = body
  if (zh && en) {
    const [first, second] = zh.index < en.index ? [zh, en] : [en, zh]
    const mine = locale.startsWith('zh') ? zh : en
    text =
      mine === first
        ? body.slice(mine.index + mine[0].length, second.index)
        : body.slice(mine.index + mine[0].length)
  }
  text = text.trim()
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}
