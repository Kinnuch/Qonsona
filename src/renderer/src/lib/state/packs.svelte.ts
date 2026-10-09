/**
 * 学习包：内置的 + 从千语集导入的，以及正在学的那一门。
 */
import { platform } from '$lib/platform'
import { BUILTIN_PACKS } from '$lib/packs/builtin'
import type { PackManifest } from '$lib/packs/types'
import { buildQonlangPack, inspectQonlang, PACK_FILES } from '$lib/packs/qonlang/convert'
import type { Project } from '$qon/core/model'
import type { LevelAssignment } from '$lib/packs/qonlang/levels'
import { hiddenIds, type PackStudy } from '$lib/packs/qonlang/study'
import { serializeProject } from '$qon/core/serialize'
import type { StudyPackFile } from '$qon/core/studyPack'
import { ui } from './ui.svelte'

class Packs {
  installed = $state.raw<PackManifest[]>([])
  /** 正在学的包如果来自千语集，这是它的项目（只读，别做深层响应式） */
  project = $state.raw<Project | null>(null)
  /** 正在学的千语集语言按词频分的级（levels.json） */
  levels = $state.raw<LevelAssignment | null>(null)
  /** 从学习包导入的：作者给的设置（study.json）；从项目文件导入的为 null */
  study = $state.raw<PackStudy | null>(null)
  /** 作者藏起来的词条、例句、短语、文档：处处都不给学习者看 */
  hidden = $derived(hiddenIds(this.study))
  loaded = $state(false)

  all = $derived<PackManifest[]>([...BUILTIN_PACKS, ...this.installed])
  active = $derived<PackManifest | null>(
    this.all.find((p) => p.id === ui.prefs.activePackId) ?? null
  )

  async load(): Promise<void> {
    try {
      const list = await platform.listPacks()
      this.installed = list.sort((a, b) =>
        (a.source?.importedAt ?? '').localeCompare(b.source?.importedAt ?? '')
      )
    } catch {
      this.installed = []
    }
    this.loaded = true
    await this.loadProject()
  }

  async activate(id: string): Promise<void> {
    await ui.setPrefs({ activePackId: id })
    await this.loadProject()
  }

  /** 正在学的是千语集来的语言时，把项目读进来（文字字体、样例都要用） */
  async loadProject(): Promise<void> {
    const pack = this.active
    if (pack?.kind !== 'qonlang') {
      this.project = null
      this.levels = null
      this.study = null
      return
    }
    const [text, levels, study] = await Promise.all([
      platform.readPackFile(pack.id, PACK_FILES.source),
      platform.readPackFile(pack.id, PACK_FILES.levels),
      platform.readPackFile(pack.id, PACK_FILES.study)
    ])
    const r = text ? inspectQonlang(text) : null
    this.project = r?.ok ? r.project : null
    this.levels = levels ? (JSON.parse(levels) as LevelAssignment) : null
    this.study = study ? (JSON.parse(study) as PackStudy) : null
  }

  /**
   * 把项目里的几门语言各存成一个学习包；同一个项目同一门语言再导入就覆盖。
   * 从学习包（.qstudy.json）导入时带上 pack：作者的设置写进 study.json，作者录音写进 audio/
   */
  async importQonlang(
    project: Project,
    fileName: string,
    languageIds: string[],
    pack?: StudyPackFile
  ): Promise<void> {
    const source = serializeProject(project)
    const now = new Date().toISOString()
    for (const lid of languageIds) {
      const { manifest, files, audio } = buildQonlangPack(project, lid, fileName, source, now, pack)
      await platform.savePack(manifest.id, files, audio)
    }
    await this.load()
  }

  async remove(id: string): Promise<void> {
    await platform.removePack(id)
    if (ui.prefs.activePackId === id) await ui.setPrefs({ activePackId: null })
    await this.load()
  }
}

export const packs = new Packs()
