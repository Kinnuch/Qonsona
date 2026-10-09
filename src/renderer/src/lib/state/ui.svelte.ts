/**
 * 界面状态：偏好、当前模块、明暗、提示条、确认框。
 */
import { platform, DEFAULT_PREFS, type Prefs } from '$lib/platform'
import { i18n } from '$lib/i18n/index.svelte'
import type { ModuleId } from '$lib/packs/types'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error'
}

interface ConfirmRequest {
  title: string
  body: string
  ok: string
  danger: boolean
  resolve: (ok: boolean) => void
}

const darkQuery = (): MediaQueryList => window.matchMedia('(prefers-color-scheme: dark)')

class Ui {
  prefs = $state<Prefs>({ ...DEFAULT_PREFS })
  section = $state<ModuleId>('home')
  toasts = $state<Toast[]>([])
  confirmRequest = $state<ConfirmRequest | null>(null)
  #toastSeq = 0

  async load(): Promise<void> {
    try {
      this.prefs = { ...DEFAULT_PREFS, ...(await platform.getPrefs()) }
    } catch {
      // 没有主进程（单测、网页预览）时用默认偏好
    }
    i18n.set(this.prefs.locale)
    this.applyTheme()
    darkQuery().addEventListener('change', () => this.applyTheme())
  }

  async setPrefs(patch: Partial<Prefs>): Promise<void> {
    Object.assign(this.prefs, patch)
    if (patch.locale) i18n.set(patch.locale)
    if (patch.theme) {
      this.applyTheme()
      void platform.setTheme(patch.theme)
    }
    await platform.setPrefs(patch)
  }

  applyTheme(): void {
    const t = this.prefs.theme
    const dark = t === 'dark' || (t === 'system' && darkQuery().matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }

  go(section: ModuleId): void {
    this.section = section
  }

  toast(text: string, kind: Toast['kind'] = 'info', ms = 4000): void {
    const id = ++this.#toastSeq
    this.toasts.push({ id, text, kind })
    setTimeout(() => (this.toasts = this.toasts.filter((x) => x.id !== id)), ms)
  }

  /** 应用内的确认框（Electron 里不用 window.confirm） */
  confirm(title: string, body: string, ok: string, danger = false): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmRequest = { title, body, ok, danger, resolve }
    })
  }

  answerConfirm(ok: boolean): void {
    this.confirmRequest?.resolve(ok)
    this.confirmRequest = null
  }
}

export const ui = new Ui()
