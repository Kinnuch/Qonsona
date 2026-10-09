import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { describe, expect, it } from 'vitest'
import zh from '$lib/i18n/zh'
import en from '$lib/i18n/en'

/** 把嵌套的文案表拍平成「点号路径 → 文字」 */
function flat(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out[key] = v
    else Object.assign(out, flat(v, key))
  }
  return out
}

const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('界面文案', () => {
  const Z = flat(zh)
  const E = flat(en)

  it('中英两份的键一模一样', () => {
    expect(Object.keys(E).sort()).toEqual(Object.keys(Z).sort())
  })

  it('占位符两边一致', () => {
    for (const k of Object.keys(Z)) expect(placeholders(E[k]), k).toEqual(placeholders(Z[k]))
  })

  it('代码里写死的键都在文案表里', () => {
    const root = resolve(__dirname, '../src/renderer/src')
    const files: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (name === 'vendor' || name === 'i18n') continue
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(svelte|ts)$/.test(name)) files.push(p)
      }
    }
    walk(root)
    const missing: string[] = []
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      // 只查完整写出的键；拼出来的（'nav.' + id）由下面的模块测试兜
      for (const m of text.matchAll(/\bt\('([a-zA-Z][\w-]*(?:\.[\w-]+)*)'\s*[,)]/g)) {
        if (!(m[1] in Z)) missing.push(`${f.slice(root.length)}: ${m[1]}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('每个模块都有导航名和说明', () => {
    const ids = [
      'home',
      'reading',
      'courses',
      'dictionary',
      'notebook',
      'practice',
      'media',
      'stats'
    ]
    for (const id of ids) {
      expect(Z[`nav.${id}`], id).toBeTruthy()
      if (id !== 'home') expect(Z[`modules.${id}.desc`], id).toBeTruthy()
    }
  })
})
