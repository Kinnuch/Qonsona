<script lang="ts">
  import { Download, Upload, X } from '@lucide/svelte'
  import { platform } from '$lib/platform'
  import { notebook } from '$lib/state/notebook.svelte'
  import { flushAll } from '$lib/state/persist'
  import { ui } from '$lib/state/ui.svelte'
  import { i18n } from '$lib/i18n/index.svelte'
  import type { TransferPreview, TransferScope } from '$shared/transfer'

  let { scope = 'notebook' }: { scope?: TransferScope } = $props()
  let busy = $state(false)
  let preview = $state<TransferPreview | null>(null)
  let exported = $state('')
  let selectedOnly = $state(false)
  const zh = $derived(i18n.locale === 'zh')
  const pack = $derived(scope === 'notebook' ? (notebook.packId ?? undefined) : undefined)
  const tr = (cn: string, en: string): string => (zh ? cn : en)
  const disabled = $derived(busy || (scope === 'notebook' && !pack))

  async function exportData(): Promise<void> {
    busy = true
    try {
      await flushAll()
      const result = await platform.transfer.export(
        scope,
        pack,
        scope === 'notebook' && selectedOnly ? notebook.view.list : undefined
      )
      if (result)
        exported = tr(
          `已导出 ${result.files} 个文件：${result.path}`,
          `Exported ${result.files} files: ${result.path}`
        )
    } catch (error) {
      ui.toast(String(error), 'error', 10000)
    } finally {
      busy = false
    }
  }
  async function pickImport(): Promise<void> {
    busy = true
    try {
      await flushAll()
      if (preview) await platform.transfer.cancel(preview.token)
      preview = null
      preview = await platform.transfer.pick(scope, pack)
    } catch (error) {
      ui.toast(
        tr('文件未通过检查：', 'The file failed validation: ') + String(error),
        'error',
        10000
      )
    } finally {
      busy = false
    }
  }
  async function cancel(): Promise<void> {
    if (preview) await platform.transfer.cancel(preview.token).catch(() => {})
    preview = null
  }
  async function apply(): Promise<void> {
    if (!preview) return
    busy = true
    try {
      await flushAll()
      await platform.transfer.apply(preview.token)
    } catch (error) {
      ui.toast(String(error), 'error', 10000)
      busy = false
    }
  }
</script>

<div class="transfer" data-transfer-scope={scope}>
  <h3>
    {scope === 'personal'
      ? tr('跨电脑导入导出个人学习数据', 'Transfer personal learning data between computers')
      : tr('导入导出生词本', 'Import and export vocabulary notebooks')}
  </h3>
  <div class="actions">
    {#if scope === 'notebook'}
      <label class="choice"
        ><input type="checkbox" bind:checked={selectedOnly} disabled={busy} />{tr(
          '仅导出当前词本',
          'Export the selected list only'
        )}</label
      >
    {/if}
    <button class="btn" data-transfer-export {disabled} onclick={exportData}
      ><Download size={16} />{tr('导出', 'Export')}</button
    >
    <button class="btn" data-transfer-import {disabled} onclick={pickImport}
      ><Upload size={16} />{tr('选择导入文件并预览', 'Choose a file and preview')}</button
    >
  </div>
  {#if exported}<p class="muted path-note" role="status" data-transfer-result>{exported}</p>{/if}
  <p class="faint">
    {scope === 'personal'
      ? tr(
          '包含所有语言的生词本、复习排期与词本设置、课程进度、练习历史、学习时长、自定义阅读和译文。',
          'Includes notebooks for all languages, review schedules and list settings, course progress, practice history, study time, custom readings and translations.'
        )
      : tr(
          '保留词卡、词本、复习排期和词本设置。导入文件必须与当前语言一致。',
          'Preserves cards, lists, review schedules and list settings. An import must match the active language.'
        )}
  </p>
  <p class="faint">
    {tr(
      '学习包和录音不包含在此JSON中；另一台电脑需安装同一学习包和词典版本，或使用下方完整备份携带包和录音。本地音视频文件需自行复制并在视听重新添加，原电脑路径不能直接跨机播放。',
      'Learning packages and recordings are not included in this JSON. Install the same packages and dictionary versions on the other computer, or use a full backup to carry packages and recordings. Copy local audio/video separately and add them again in Media; original computer paths do not travel.'
    )}
  </p>
  {#if preview}
    <section class="preview" data-transfer-preview aria-label={tr('导入预览', 'Import preview')}>
      <div class="preview-head">
        <h4>{tr('导入预览', 'Import preview')}</h4>
        <button
          class="btn icon"
          disabled={busy}
          aria-label={tr('关闭预览', 'Close preview')}
          onclick={cancel}><X size={16} /></button
        >
      </div>
      <p class="path-note">
        {preview.fileName} · {new Date(preview.createdAt).toLocaleString(zh ? 'zh-CN' : 'en')}
      </p>
      <p>
        {tr(
          `新增 ${preview.added} 个文件，合并更新 ${preview.updated} 个，不变 ${preview.unchanged} 个。`,
          `Add ${preview.added} files, merge ${preview.updated}, leave ${preview.unchanged} unchanged.`
        )}
      </p>
      <div class="table-scroll">
        <table>
          <thead
            ><tr
              ><th>{tr('语言', 'Language')}</th><th>{tr('词卡', 'Cards')}</th><th
                >{tr('词本', 'Lists')}</th
              ><th>{tr('课程记录', 'Lessons')}</th><th>{tr('试卷', 'Exams')}</th><th
                >{tr('文章', 'Articles')}</th
              ></tr
            ></thead
          ><tbody
            >{#each preview.counts as count (count.pack)}<tr
                ><td>{count.pack}</td><td>{count.cards}</td><td>{count.lists}</td><td
                  >{count.courses}</td
                ><td>{count.exams}</td><td>{count.articles}</td></tr
              >{/each}</tbody
          >
        </table>
      </div>
      {#if preview.missingPacks.length}<p class="notice">
          {tr('未安装的学习包：', 'Packages not installed: ')}{preview.missingPacks.join(', ')}. {tr(
            '记录会保留，安装相同包ID后可使用。',
            'Records are retained and become available after installing the same package IDs.'
          )}
        </p>{/if}
      {#if preview.conflicts}<p class="notice">
          {tr(
            `${preview.conflicts} 篇文章或译文存在同ID内容冲突，保留本机版本。`,
            `${preview.conflicts} article or translation files conflict at the same ID; the local versions will be retained.`
          )}
        </p>{/if}
      <p class="faint">
        {tr(
          '默认合并，不删除本机记录。同词排期采用最后复习时间较新的记录，相同时间保留本机；计数取较大值而不相加，因此重复导入不会累加，同日两台电脑独立学习的总数可能低估。历史试卷按ID去重，文章与译文冲突保留本机。导入前自动保留受影响旧文件副本。',
          'Merge by default without deleting local records. For the same card, the latest review schedule wins; ties keep the local schedule. Counters use the larger value instead of adding, so repeated imports do not inflate counts, but independent same-day work on two computers may be undercounted. Exam history is deduplicated by ID; text conflicts keep the local version. A copy of affected local files is saved first.'
        )}
      </p>
      <p>
        <strong
          >{tr(
            '确认后将重启，在打开界面前完成合并。',
            'Confirmation restarts the app and merges before opening the interface.'
          )}</strong
        >
      </p>
      <div class="actions">
        <button class="btn" disabled={busy} onclick={cancel}>{tr('取消', 'Cancel')}</button><button
          class="btn primary"
          data-transfer-confirm
          disabled={busy}
          onclick={apply}>{tr('合并并重启', 'Merge and restart')}</button
        >
      </div>
    </section>
  {/if}
</div>

<style>
  .transfer {
    display: grid;
    gap: 10px;
    margin: 16px 0;
  }
  h3,
  h4,
  p {
    margin: 0;
  }
  .actions,
  .choice,
  .preview-head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .preview-head {
    justify-content: space-between;
  }
  .preview {
    display: grid;
    gap: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
  }
  .path-note {
    overflow-wrap: anywhere;
  }
  .table-scroll {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    text-align: start;
    padding: 8px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .notice {
    color: var(--accent);
  }
</style>
