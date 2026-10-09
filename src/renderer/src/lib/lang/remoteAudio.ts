/**
 * 放词条上的真人录音（维基共享资源、Lingua Libre……）：主进程下载并缓存，这里拿到字节放出来。
 * 界面的 CSP 不许直接放外网音频，所以不能把地址直接交给 <audio>。
 */
import { platform } from '$lib/platform'

let current: HTMLAudioElement | null = null

/** 放一段录音；下载不到（没联网、地址不在白名单）时返回 false */
export async function playRemote(url: string): Promise<boolean> {
  const r = await platform.lang.audio(url).catch(() => null)
  if (!r) return false
  current?.pause()
  const src = URL.createObjectURL(new Blob([r.bytes as BlobPart], { type: r.mime }))
  const a = new Audio(src)
  current = a
  a.onended = () => URL.revokeObjectURL(src)
  try {
    await a.play()
    return true
  } catch {
    URL.revokeObjectURL(src)
    return false
  }
}
