// 发布脚本共用：调 GitHub 接口。本机没有 gh：令牌在 CI 里是 GITHUB_TOKEN，本机从 git 的凭据管理器取
// （git credential fill，跟 git push 用的是同一份），不打印出来。
import { execFileSync } from 'node:child_process'

export const REPO = process.env.GITHUB_REPOSITORY || 'Kinnuch/Qonsona'
/** 词典数据放在这个草稿 Release 里（草稿不显示在发布页上，也不算「最新版本」） */
export const DATA_RELEASE = 'build-data'

let cached = ''
export function token() {
  if (cached) return cached
  cached = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
  if (!cached) {
    const out = execFileSync('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    })
    cached = /^password=(.+)$/m.exec(out)?.[1]?.trim() ?? ''
  }
  if (!cached)
    throw new Error('没有 GitHub 令牌：CI 里设 GITHUB_TOKEN，本机先用 git 登录过 github.com')
  return cached
}

const headers = (extra = {}) => ({
  Authorization: `Bearer ${token()}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'qonsona-release',
  ...extra
})

/** 调接口；不是 2xx 就抛出（带上 GitHub 的说明） */
export async function api(path, { method = 'GET', body, accept, raw } = {}) {
  const url = path.startsWith('https://') ? path : `https://api.github.com${path}`
  const res = await fetch(url, {
    method,
    headers: headers({
      ...(accept ? { Accept: accept } : {}),
      ...(body && !raw ? { 'Content-Type': 'application/json' } : {})
    }),
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
    redirect: 'manual'
  })
  if (res.status >= 300 && res.status < 400) return res
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${await res.text()}`)
  return res
}

/** 草稿也算在内（要有推送权限的令牌才看得到草稿） */
export async function findRelease(tag) {
  for (let page = 1; page <= 10; page++) {
    const list = await (await api(`/repos/${REPO}/releases?per_page=100&page=${page}`)).json()
    const hit = list.find((r) => r.tag_name === tag || r.name === tag)
    if (hit || list.length < 100) return hit ?? null
  }
  return null
}

/** 下载一个 Release 资产（草稿里的也行）：接口回 302 到存储地址，那边不能再带令牌 */
export async function downloadAsset(asset) {
  const res = await api(`/repos/${REPO}/releases/assets/${asset.id}`, {
    accept: 'application/octet-stream'
  })
  const location = res.headers.get('location')
  const file = location ? await fetch(location) : res
  if (!file.ok) throw new Error(`下载 ${asset.name} 失败：${file.status}`)
  return new Uint8Array(await file.arrayBuffer())
}
