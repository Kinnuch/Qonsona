/** 个人数据导入导出；合并在重启开窗前进行，避免旧缓存随后覆盖导入内容。 */
import { promises as fs } from 'node:fs'
import { join, basename } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { pendingWrites } from './pending-writes'
import { emptyNotebook } from '../shared/notebook'
import { emptyProgress } from '../shared/course'
import { emptyPracticeLog } from '../shared/exam'
import { emptyActivity } from '../shared/stats'
import {
  mergeTransferFile,
  transferPath,
  validateTransfer,
  validTransferId,
  TRANSFER_MAX_BYTES,
  type TransferBundle,
  type TransferCount,
  type TransferPack,
  type TransferPreview,
  type TransferScope,
  type TransferResult
} from '../shared/transfer'

let transferResult: TransferResult | { error: string } | null = null
export function setTransferResult(result: TransferResult | { error: string } | null): void {
  transferResult = result
}
const PENDING = 'transfer-pending.json'
const BUILTIN = ['ja', 'en', 'fr', 'ko', 'es', 'ar', 'ru', 'gd']
async function read(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw e
  }
}
async function list(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isFile() && !e.name.endsWith('.tmp'))
      .map((e) => e.name)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}
async function atomic(file: string, content: string): Promise<void> {
  await fs.mkdir(join(file, '..'), { recursive: true })
  const tmp = `${file}.${randomUUID()}.tmp`
  try {
    await fs.writeFile(tmp, content)
    await fs.rename(tmp, file)
  } finally {
    await fs.rm(tmp, { force: true })
  }
}
function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

async function packsAt(dir: string, ids: Set<string>): Promise<TransferPack[]> {
  const packs: TransferPack[] = []
  for (const id of [...ids].sort()) {
    if (!validTransferId(id)) throw new Error(`Invalid language id: ${id}`)
    if (BUILTIN.includes(id)) {
      packs.push({ id, name: id, kind: 'builtin' })
      continue
    }
    const manifest = (await read(join(dir, 'packs', id, 'manifest.json'))) as
      { name?: string | Record<string, string> } | undefined
    const name =
      typeof manifest?.name === 'string'
        ? manifest.name
        : (manifest?.name?.en ?? manifest?.name?.zh ?? id)
    packs.push({ id, name, kind: 'qonlang' })
  }
  return packs
}
/** 仅读取实际学习记录，不导出个人偏好、窗口位置、新闻缓存或外部媒体文件。 */
export async function buildTransfer(
  userData: string,
  scope: TransferScope,
  appVersion: string,
  packId?: string,
  listId?: string
): Promise<TransferBundle> {
  if (
    !['notebook', 'personal'].includes(scope) ||
    (scope === 'notebook' && !validTransferId(packId))
  )
    throw new Error('Invalid export scope/language')
  const files: TransferBundle['files'] = []
  const ids = new Set<string>()
  let collectedBytes = 0
  async function include(path: string): Promise<void> {
    const p = transferPath(path)
    if (!p) return
    const full = join(userData, ...path.split('/'))
    let stat
    try {
      stat = await fs.stat(full)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    if (!stat.isFile() || stat.size > TRANSFER_MAX_BYTES)
      throw new Error('Personal data file exceeds transfer limits; use a full backup')
    const content = path.endsWith('.txt') ? await fs.readFile(full, 'utf8') : await read(full)
    if (content === undefined) return
    if (p.kind === 'article' && (content as { source?: string }).source !== 'user') return
    collectedBytes += stat.size
    if (collectedBytes > TRANSFER_MAX_BYTES)
      throw new Error('Personal data exceeds 32 MiB; use a full backup')
    files.push({ path, content })
    if (p.pack !== '*') ids.add(p.pack)
  }
  if (scope === 'notebook') {
    await include(`notebook/${packId}.json`)
    ids.add(packId!)
    if (listId !== undefined) {
      const file = files[0]
      if (!file) throw new Error('No notebook data')
      const nb = file.content as import('../shared/notebook').Notebook
      const selected = nb.lists.find((l) => l.id === listId)
      if (!selected) throw new Error('Unknown vocabulary list')
      const keys = new Set(selected.keys)
      nb.cards = Object.fromEntries(Object.entries(nb.cards).filter(([key]) => keys.has(key)))
      nb.lists =
        selected.id === 'mine'
          ? [selected]
          : [{ id: 'mine', name: '', keys: [], createdAt: selected.createdAt }, selected]
      if (nb.review) {
        delete nb.review.language
        nb.review.lists = Object.fromEntries(
          Object.entries(nb.review.lists).filter(([key]) => key === listId)
        )
      }
      // 单词本导出不能把整门语言的每日总量冒充该词本的学习量。
      nb.days = structuredClone(nb.reviewDays?.[`list:${listId}`] ?? {})
      if (nb.reviewDays)
        nb.reviewDays = Object.fromEntries(
          Object.entries(nb.reviewDays).filter(([key]) => key === `list:${listId}`)
        )
    }
  } else {
    for (const category of ['notebook', 'courses', 'practice', 'article-quizzes'])
      for (const name of await list(join(userData, category)))
        if (name.endsWith('.json')) await include(`${category}/${name}`)
    await include('stats.json')
    for (const name of await list(join(userData, 'articles')))
      if (name.endsWith('.json') && name !== 'state.json') await include(`articles/${name}`)
    await include('articles/state.json')
    for (const name of await list(join(userData, 'articles', 'translations')))
      if (name.endsWith('.txt')) await include(`articles/translations/${name}`)
    for (const code of BUILTIN.filter((c) => c !== 'ja')) {
      await include(`articles/${code}/state.json`)
      for (const name of await list(join(userData, 'articles', code, 'user')))
        if (name.endsWith('.json')) await include(`articles/${code}/user/${name}`)
      for (const name of await list(join(userData, 'articles', code, 'translations')))
        if (name.endsWith('.txt')) await include(`articles/${code}/translations/${name}`)
    }
    const stats = files.find((f) => f.path === 'stats.json')?.content as
      { days?: Record<string, { packs: Record<string, unknown> }> } | undefined
    const rewardDays = (
      files.find((f) => f.path === 'stats.json')?.content as
        { rewards?: { days: Record<string, { completions: { packId: string }[] }> } } | undefined
    )?.rewards?.days
    for (const day of Object.values(rewardDays ?? {}))
      for (const event of day.completions) ids.add(event.packId)
    for (const day of Object.values(stats?.days ?? {}))
      for (const id of Object.keys(day.packs)) ids.add(id)
  }
  return validateTransfer({
    app: 'qonsona-transfer',
    format: 1,
    scope,
    appVersion,
    createdAt: new Date().toISOString(),
    packs: await packsAt(userData, ids),
    files
  })
}
export async function exportTransfer(
  userData: string,
  file: string,
  scope: TransferScope,
  appVersion: string,
  packId?: string,
  listId?: string
): Promise<{ files: number; bytes: number }> {
  const bundle = await buildTransfer(userData, scope, appVersion, packId, listId)
  const content = JSON.stringify(bundle, null, 1)
  const bytes = Buffer.byteLength(content)
  if (bytes > TRANSFER_MAX_BYTES)
    throw new Error('Transfer exceeds 32 MiB; use a full backup instead')
  await atomic(file, content)
  return { files: bundle.files.length, bytes }
}
export async function readTransfer(
  file: string
): Promise<{ bundle: TransferBundle; hash: string }> {
  const stat = await fs.stat(file)
  if (!stat.isFile() || stat.size > TRANSFER_MAX_BYTES)
    throw new Error('Invalid transfer file size')
  const bytes = await fs.readFile(file)
  if (bytes.length > TRANSFER_MAX_BYTES) throw new Error('Transfer exceeds 32 MiB')
  return {
    bundle: validateTransfer(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))),
    hash: createHash('sha256').update(bytes).digest('hex')
  }
}
async function localFile(userData: string, path: string): Promise<unknown | undefined> {
  if (path.endsWith('.txt'))
    try {
      return await fs.readFile(join(userData, ...path.split('/')), 'utf8')
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw e
    }
  return read(join(userData, ...path.split('/')))
}
function empty(kind: string): unknown {
  if (kind === 'notebook') return emptyNotebook()
  if (kind === 'courses') return emptyProgress()
  if (kind === 'practice') return emptyPracticeLog()
  if (kind === 'stats') return emptyActivity()
  if (kind === 'article-quizzes') return {}
  return undefined
}
/** 验证现有文件后合并；不能让损坏的本机文件被静默覆盖。 */
async function plan(
  userData: string,
  bundle: TransferBundle
): Promise<{ path: string; content: unknown; old: unknown; conflict: boolean }[]> {
  const out: { path: string; content: unknown; old: unknown; conflict: boolean }[] = []
  for (const file of bundle.files) {
    const p = transferPath(file.path)!
    const old = await localFile(userData, file.path)
    let packs = bundle.packs
    if (old !== undefined) {
      if (p.kind === 'stats') {
        const ids = new Set(packs.map((pack) => pack.id))
        const rewardDays = (
          old as { rewards?: { days: Record<string, { completions: { packId: string }[] }> } }
        ).rewards?.days
        for (const d of Object.values(rewardDays ?? {}))
          for (const c of d.completions) ids.add(c.packId)
        const days = (old as { days?: Record<string, { packs: Record<string, unknown> }> }).days
        for (const day of Object.values(days ?? {}))
          for (const id of Object.keys(day.packs)) ids.add(id)
        packs = await packsAt(userData, ids)
      }
      validateTransfer({ ...bundle, packs, files: [{ path: file.path, content: old }] })
    }
    const content = mergeTransferFile(
      file.path,
      old === undefined ? empty(p.kind) : old,
      file.content
    )
    validateTransfer({ ...bundle, packs, files: [{ path: file.path, content }] })
    const conflict =
      old !== undefined && !equal(old, file.content) && ['article', 'translation'].includes(p.kind)
    out.push({ path: file.path, content, old, conflict })
  }
  return out
}
export async function previewTransfer(
  userData: string,
  bundle: TransferBundle,
  token: string,
  fileName: string
): Promise<TransferPreview> {
  const rows = await plan(userData, bundle)
  const counts = new Map<string, TransferCount>()
  for (const file of bundle.files) {
    const p = transferPath(file.path)!
    if (p.pack === '*') continue
    const c = counts.get(p.pack) ?? {
      pack: p.pack,
      cards: 0,
      lists: 0,
      courses: 0,
      exams: 0,
      articles: 0
    }
    counts.set(p.pack, c)
    const value = file.content as Record<string, unknown>
    if (p.kind === 'notebook') {
      c.cards += Object.keys(value.cards as object).length
      c.lists += (value.lists as unknown[]).length
    }
    if (p.kind === 'courses') c.courses += Object.keys(value.lessons as object).length
    if (p.kind === 'practice') c.exams += (value.exams as unknown[]).length
    if (p.kind === 'article') c.articles++
  }
  const missingPacks: string[] = []
  for (const pack of bundle.packs)
    if (
      pack.kind === 'qonlang' &&
      (await read(join(userData, 'packs', pack.id, 'manifest.json'))) === undefined
    )
      missingPacks.push(pack.id)
  return {
    token,
    scope: bundle.scope,
    createdAt: bundle.createdAt,
    fileName,
    files: rows.length,
    added: rows.filter((r) => r.old === undefined).length,
    updated: rows.filter((r) => r.old !== undefined && !equal(r.old, r.content)).length,
    unchanged: rows.filter((r) => r.old !== undefined && equal(r.old, r.content)).length,
    conflicts: rows.filter((r) => r.conflict).length,
    counts: [...counts.values()],
    missingPacks
  }
}
export async function scheduleTransfer(userData: string, bundle: TransferBundle): Promise<void> {
  validateTransfer(bundle)
  const content = JSON.stringify(bundle)
  if (Buffer.byteLength(content) > TRANSFER_MAX_BYTES) throw new Error('Transfer exceeds 32 MiB')
  await atomic(join(userData, PENDING), content)
}
/** 开窗前调用；备份每个受影响的旧文件，失败时回滚已写文件。 */
export async function applyPendingTransfer(userData: string): Promise<TransferResult | null> {
  const pending = join(userData, PENDING)
  try {
    const stat = await fs.stat(pending)
    if (!stat.isFile() || stat.size > TRANSFER_MAX_BYTES)
      throw new Error('Invalid pending transfer size')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
  const raw = await read(pending)
  if (raw === undefined) return null
  const bundle = validateTransfer(raw)
  const rows = await plan(userData, bundle)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const saved = join(userData, `backup-before-import-${stamp}-${randomUUID().slice(0, 8)}`)
  const changed = rows.filter((r) => !equal(r.old, r.content))
  const written: typeof rows = []
  await fs.mkdir(saved, { recursive: true })
  try {
    for (const row of changed) {
      if (row.old !== undefined)
        await atomic(
          join(saved, ...row.path.split('/')),
          row.path.endsWith('.txt') ? (row.old as string) : JSON.stringify(row.old)
        )
      await atomic(
        join(userData, ...row.path.split('/')),
        row.path.endsWith('.txt') ? (row.content as string) : JSON.stringify(row.content)
      )
      written.push(row)
    }
    await atomic(
      join(saved, 'import-result.json'),
      JSON.stringify({
        createdAt: new Date().toISOString(),
        files: changed.map((r) => ({ path: r.path, wasNew: r.old === undefined }))
      })
    )
    await fs.rm(pending)
    return { files: changed.length, saved }
  } catch (error) {
    for (const row of written.reverse()) {
      const file = join(userData, ...row.path.split('/'))
      if (row.old === undefined) await fs.rm(file, { force: true })
      else
        await atomic(
          file,
          row.path.endsWith('.txt') ? (row.old as string) : JSON.stringify(row.old)
        )
    }
    throw error
  }
}

/** Electron仅在注册时载入，纯文件函数可在node测试。预览token绑定窗口与文件hash。 */
export async function registerTransferIpc(): Promise<void> {
  const { app, ipcMain, dialog, BrowserWindow } = await import('electron')
  const sessions = new Map<
    string,
    { file: string; hash: string; sender: number; at: number; pack?: string; scope: TransferScope }
  >()

  ipcMain.handle(
    'transfer:export',
    async (e, scope: TransferScope, pack?: string, listId?: string) => {
      if (
        !['notebook', 'personal'].includes(scope) ||
        (scope === 'notebook' && !validTransferId(pack))
      )
        throw new Error('Invalid scope')
      const win = BrowserWindow.fromWebContents(e.sender)
      const options = {
        defaultPath: join(
          app.getPath('documents'),
          `qonsona-${scope}-${scope === 'notebook' ? pack + '-' : ''}${new Date().toISOString().slice(0, 10)}.json`
        ),
        filters: [{ name: 'Qonsona learning data', extensions: ['json'] }]
      }
      const picked = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options)
      if (picked.canceled || !picked.filePath) return null
      await pendingWrites.drain()
      return {
        path: picked.filePath,
        ...(await exportTransfer(
          app.getPath('userData'),
          picked.filePath,
          scope,
          app.getVersion(),
          pack,
          listId
        ))
      }
    }
  )
  ipcMain.handle('transfer:pick', async (e, scope: TransferScope, pack?: string) => {
    if (
      !['notebook', 'personal'].includes(scope) ||
      (scope === 'notebook' && !validTransferId(pack))
    )
      throw new Error('Invalid scope')
    const win = BrowserWindow.fromWebContents(e.sender)
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'Qonsona learning data', extensions: ['json'] }]
    }
    const picked = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (picked.canceled || !picked.filePaths[0]) return null
    await pendingWrites.drain()
    const file = picked.filePaths[0]
    const { bundle, hash } = await readTransfer(file)
    if (
      scope === 'notebook' &&
      (bundle.scope !== 'notebook' || bundle.packs.length !== 1 || bundle.packs[0].id !== pack)
    )
      throw new Error('Import language differs from the active notebook')
    const token = randomUUID()
    sessions.set(token, { file, hash, sender: e.sender.id, at: Date.now(), scope, pack })
    for (const [k, v] of sessions) if (Date.now() - v.at > 1800000) sessions.delete(k)
    return previewTransfer(app.getPath('userData'), bundle, token, basename(file))
  })
  ipcMain.handle('transfer:cancel', (_e, token: string) => {
    sessions.delete(String(token))
  })
  ipcMain.handle('transfer:apply', async (e, token: string) => {
    const session = sessions.get(String(token))
    if (!session || session.sender !== e.sender.id || Date.now() - session.at > 1800000)
      throw new Error('Preview expired; select the file again')
    const { bundle, hash } = await readTransfer(session.file)
    if (hash !== session.hash) throw new Error('Import file changed; preview it again')
    if (
      session.scope === 'notebook' &&
      (bundle.scope !== 'notebook' ||
        bundle.packs.length !== 1 ||
        bundle.packs[0].id !== session.pack)
    )
      throw new Error('Import language changed')
    await pendingWrites.drain()
    await scheduleTransfer(app.getPath('userData'), bundle)
    sessions.delete(token)
    app.relaunch()
    app.exit(0)
  })
  ipcMain.handle('transfer:result', () => {
    const r = transferResult
    transferResult = null
    return r
  })
  // applyPendingTransfer由启动流程在开窗前调用；供主线把结果交给renderer显示。
}
