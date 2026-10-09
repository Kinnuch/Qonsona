import {
  House,
  BookOpenText,
  GraduationCap,
  BookA,
  NotebookPen,
  ListChecks,
  Clapperboard,
  ChartColumn,
  Languages,
  Settings
} from '@lucide/svelte'
import type { ModuleId } from '$lib/packs/types'

/** 每个模块在左侧导航上的图标 */
export const MODULE_ICONS: Record<ModuleId, typeof House> = {
  home: House,
  reading: BookOpenText,
  courses: GraduationCap,
  dictionary: BookA,
  notebook: NotebookPen,
  practice: ListChecks,
  media: Clapperboard,
  stats: ChartColumn,
  packs: Languages,
  settings: Settings
}
