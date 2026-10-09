/**
 * 把各处还没存盘的改动都存掉：关窗前、导出备份前调。
 */
import { notebook } from './notebook.svelte'
import { courses } from './courses.svelte'
import { practice } from './practice.svelte'
import { media } from './media.svelte'
import { activity } from './activity.svelte'

export function flushAll(): void {
  notebook.flush()
  courses.flush()
  practice.flush()
  media.flushPosition()
  activity.tick()
  activity.flush()
}
