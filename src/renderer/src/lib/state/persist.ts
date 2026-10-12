/**
 * 把各处还没存盘的改动都存掉：关窗前、导出备份前调。
 */
import { notebook } from './notebook.svelte'
import { courses } from './courses.svelte'
import { practice } from './practice.svelte'
import { media } from './media.svelte'
import { activity } from './activity.svelte'
import { serializedWrites } from './persistence'
import { audio } from './audio.svelte'

export async function flushAll(): Promise<void> {
  await audio.flushRecording()
  activity.tick()
  await Promise.all([
    notebook.flush(),
    courses.flush(),
    practice.flush(),
    media.flushPosition(),
    activity.flush()
  ])
  await serializedWrites.drain()
}
