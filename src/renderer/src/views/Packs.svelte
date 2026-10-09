<script lang="ts">
  import { Upload, Trash2, Check } from '@lucide/svelte'
  import { ui } from '$lib/state/ui.svelte'
  import { packs } from '$lib/state/packs.svelte'
  import { t, pick, i18n } from '$lib/i18n/index.svelte'
  import { platform } from '$lib/platform'
  import {
    ENGINE_VERSION,
    inspectQonlang,
    qonlangPackId,
    type LanguageSummary
  } from '$lib/packs/qonlang/convert'
  import type { Project } from '$qon/core/model'
  import type { StudyPackFile } from '$qon/core/studyPack'
  import type { PackManifest, PackStats } from '$lib/packs/types'

  /** 挑好文件、还没确认导入时的状态 */
  let pending = $state.raw<{
    project: Project
    fileName: string
    languages: LanguageSummary[]
    /** 千语集导出的学习包：带着作者的学习设置与录音 */
    pack?: StudyPackFile
  } | null>(null)
  let chosen = $state<string[]>([])
  let busy = $state(false)

  const builtin = $derived(packs.all.filter((p) => p.kind === 'builtin'))
  const imported = $derived(packs.all.filter((p) => p.kind === 'qonlang'))
  const installedIds = $derived(new Set(packs.installed.map((p) => p.id)))

  const SUMMARY_KEYS: (keyof PackStats)[] = ['lexemes', 'sentences', 'phrases', 'docs', 'paradigms']

  function summary(s: PackStats | null): string {
    if (!s) return ''
    return SUMMARY_KEYS.filter((k) => s[k])
      .map((k) => `${t('stats.' + k)} ${s[k]}`)
      .join(' · ')
  }

  /** 选一个文件；拖进来的文件直接给内容 */
  async function openFile(file?: { name: string; content: string }): Promise<void> {
    const f = file ?? (await platform.pickQonlang())
    if (!f) return
    const r = inspectQonlang(f.content)
    if (!r.ok) {
      ui.toast(
        t('packs.reasons.' + r.reason, { engine: ENGINE_VERSION, detail: r.detail ?? '' }),
        'error',
        8000
      )
      return
    }
    pending = { project: r.project, fileName: f.name, languages: r.languages, pack: r.pack }
    // 学习包里作者没勾导出的语言默认不勾
    chosen = r.languages.filter((l) => !l.empty && l.include !== false).map((l) => l.id)
  }

  async function confirmImport(): Promise<void> {
    if (!pending || !chosen.length) return
    busy = true
    try {
      const ids = [...chosen]
      await packs.importQonlang(pending.project, pending.fileName, ids, pending.pack)
      // 还没在学任何语言时，直接学刚导入的第一门
      if (!packs.active) await packs.activate(qonlangPackId(pending.project.meta.id, ids[0]))
      ui.toast(t('packs.importedToast', { n: ids.length }))
      pending = null
    } catch (e) {
      ui.toast(String(e instanceof Error ? e.message : e), 'error', 8000)
    } finally {
      busy = false
    }
  }

  async function remove(p: PackManifest): Promise<void> {
    const ok = await ui.confirm(
      t('packs.removeTitle', { name: pick(p.name) }),
      t('packs.removeBody'),
      t('common.remove'),
      true
    )
    if (ok) await packs.remove(p.id)
  }

  function toggle(id: string): void {
    chosen = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]
  }

  /** 学习包带来的东西：作者、课程、作者录音、藏起来的条数 */
  function studySummary(s: NonNullable<PackManifest['study']>): string {
    return [
      s.author && t('packs.study.author', { name: s.author }),
      s.lessons && t('packs.study.lessons', { n: s.lessons }),
      s.audio && t('packs.study.audio', { n: s.audio }),
      s.hidden && t('packs.study.hidden', { n: s.hidden })
    ]
      .filter(Boolean)
      .join(' · ')
  }

  const date = (iso: string): string =>
    new Date(iso).toLocaleString(i18n.locale === 'zh' ? 'zh-CN' : 'en')

  let dragging = $state(false)

  async function ondrop(e: DragEvent): Promise<void> {
    e.preventDefault()
    dragging = false
    const file = e.dataTransfer?.files[0]
    if (file) await openFile({ name: file.name, content: await file.text() })
  }
</script>

{#snippet packCard(p: PackManifest)}
  <div class="card pack" class:current={p.id === packs.active?.id} data-pack-card={p.id}>
    <span class="dot" style:background={p.color}></span>
    <div class="info">
      <div class="row">
        <strong>{pick(p.name)}</strong>
        {#if p.nativeName !== pick(p.name)}<span class="muted">{p.nativeName}</span>{/if}
        {#if p.levels}<span class="chip">{pick(p.levels.name)}</span>{/if}
      </div>
      {#if p.source}
        <span class="faint"
          >{t('packs.source', { name: p.source.projectName, file: p.source.fileName })}</span
        >
        <span class="faint"
          >{date(p.source.importedAt)} · {t('packs.engine', { v: p.source.engineVersion })}</span
        >
      {/if}
      {#if p.stats}<span class="faint">{summary(p.stats)}</span>{/if}
      {#if p.study}<span class="faint" data-pack-study>{studySummary(p.study)}</span>{/if}
    </div>
    <div class="actions">
      {#if p.id === packs.active?.id}
        <span class="chip on"><Check size={12} />{t('packs.current')}</span>
      {:else}
        <button class="btn" data-use={p.id} onclick={() => packs.activate(p.id)}
          >{t('packs.use')}</button
        >
      {/if}
      {#if p.kind === 'qonlang'}
        <button class="btn ghost danger" title={t('common.remove')} onclick={() => remove(p)}>
          <Trash2 size={16} />
        </button>
      {/if}
    </div>
  </div>
{/snippet}

<div
  class="page"
  class:dragging
  role="region"
  aria-label={t('packs.title')}
  ondragover={(e) => {
    e.preventDefault()
    dragging = true
  }}
  ondragleave={(e) => {
    if (e.currentTarget === e.target) dragging = false
  }}
  {ondrop}
>
  <header class="page-head"><h1>{t('packs.title')}</h1></header>
  <p class="muted">{t('packs.intro')}</p>

  <section class="stack">
    <h3>{t('packs.builtin')}</h3>
    {#each builtin as p (p.id)}{@render packCard(p)}{/each}
  </section>

  <section class="stack">
    <div class="row between">
      <h3>{t('packs.imported')}</h3>
      <button class="btn" data-import onclick={() => openFile()} title={t('packs.importHelp')}>
        <Upload size={16} />{t('packs.import')}
      </button>
    </div>
    <p class="faint">{t('packs.importHelp')}</p>

    {#if pending}
      <div class="card importer" data-importer>
        <strong>{pending.project.meta.name}</strong>
        <span class="faint">{pending.fileName}</span>
        {#if pending.pack}
          <p class="study-note" data-study-note>
            {t('packs.study.note', {
              name: pending.pack.study.author || pending.project.meta.name,
              version: pending.pack.qonlangVersion
            })}
          </p>
        {/if}
        <h3>{t('packs.pickLanguages')}</h3>
        {#each pending.languages as l (l.id)}
          <label class="lang" class:dim={l.empty}>
            <input
              type="checkbox"
              checked={chosen.includes(l.id)}
              disabled={l.empty}
              onchange={() => toggle(l.id)}
            />
            <span class="dot" style:background={l.color}></span>
            <span>{l.name}</span>
            <span class="faint">{l.empty ? t('packs.emptyLanguage') : summary(l.stats)}</span>
            {#if installedIds.has(qonlangPackId(pending.project.meta.id, l.id))}
              <span class="chip">{t('packs.alreadyImported')}</span>
            {/if}
          </label>
        {/each}
        <div class="row end">
          <button class="btn" onclick={() => (pending = null)}>{t('common.cancel')}</button>
          <button
            class="btn primary"
            data-confirm-import
            disabled={busy || !chosen.length}
            onclick={confirmImport}
          >
            {t('packs.confirmImport')}
          </button>
        </div>
      </div>
    {/if}

    {#each imported as p (p.id)}{@render packCard(p)}{:else}
      {#if !pending}<p class="card empty muted">{t('packs.noImported')}</p>{/if}
    {/each}
  </section>
</div>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .between {
    justify-content: space-between;
  }
  .end {
    justify-content: flex-end;
  }
  .pack {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .pack.current {
    border-color: var(--accent);
  }
  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .importer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-color: var(--accent);
  }
  .study-note {
    margin: 0;
    padding: 8px 10px;
    border-radius: var(--radius-sm, 6px);
    background: var(--accent-soft);
  }
  .lang {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  .lang.dim {
    opacity: 0.6;
    cursor: default;
  }
  .empty {
    background: var(--bg-sunken);
  }
  .page.dragging {
    outline: 2px dashed var(--accent);
    outline-offset: -8px;
    border-radius: var(--radius);
  }
</style>
