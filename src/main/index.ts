import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  nativeTheme,
  protocol,
  screen,
  session
} from 'electron'
import { join, basename, extname } from 'path'
import { promises as fs, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { Speech, type SpeakRequest } from './speech'
import { JapaneseDict } from './dict'
import { JaAnalyzer, type WordLookup } from './ja-analyze'
import { registerUpdater } from './updater'
import grammarExamples from '../../data/ja/grammar-examples.json'
import { JaExams } from './exam'
import { HandwritingIndex } from './handwriting'
import { WiktDict } from './wikt'
import type { PracticeKind } from '../shared/exam'
import { ArticleStore, refreshNhk } from './articles'
import { MediaLibrary, MEDIA_SCHEME } from './media'
import { applyPendingRestore, createBackup, readBackup, scheduleRestore } from './backup'
import { migrateLegacyData } from './migrate'
import { registerLangIpc } from './lang/ipc'
import { analysisClient } from './lang/analysis-client'
import { registerDictionaryDaily } from './daily'
import { articleMutationKey, pendingWrites } from './pending-writes'
import { applyPendingTransfer, registerTransferIpc, setTransferResult } from './transfer'
import { AUDIO_EXT as MEDIA_AUDIO, SUBTITLE_EXT, VIDEO_EXT, type MediaPatch } from '../shared/media'
import { analysisLevel, cleanAozora, type ArticleInput, type NhkStatus } from '../shared/articles'
import type { JaAnalysis } from '../shared/ja/reader'

const APP_ID = 'io.github.kinnuch.qonsona'

/**
 * 数据目录名跟着程序包名走（package.json 的 name，平时是 qonsona）：开发版与打包版用同一个
 * （开发态默认是 %APPDATA%\Electron）；验收增量更新时用另一个包名打的测试版装上去，也碰不到正在用的数据。
 */
function packageName(): string {
  try {
    const { name } = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8'))
    return typeof name === 'string' && /^[a-z0-9][a-z0-9._-]*$/i.test(name) ? name : 'qonsona'
  } catch {
    return 'qonsona'
  }
}

// 视听的本地文件走自己的协议（能按 Range 分段读，拖进度条）；要在 ready 之前登记
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true }
  }
])

// 验收时用 --user-data-dir 另起一份干净的数据，这里不覆盖它
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(app.getPath('appData'), packageName()))
}

interface Prefs {
  locale: 'zh' | 'en'
  theme: 'system' | 'light' | 'dark'
  /** 正在学的语言（学习包 id）；null 表示还没选 */
  activePackId: string | null
  /** 读 IPA 用哪个系统声音；空着自动挑 */
  ipaVoice: string
  /** 朗读语速，-10 … 10 */
  speechRate: number
  /** 阅读页自动取 NHK News Web Easy 的文章（取不到时用内置与自己导入的） */
  nhkEasy: boolean
  /** 复习：每天学几个新词、每天最多复习几个、新词按加入顺序还是打乱、答错的本轮再来一次 */
  newPerDay: number
  reviewCap: number
  studyOrder: 'seq' | 'random'
  relearn: boolean
  /** 自动检查新版本、隔多少分钟查一次、跳过的版本（右下角的提示不再为它弹出） */
  checkUpdates: boolean
  updateCheckMinutes: number
  skippedVersion: string
}
const DEFAULT_PREFS: Prefs = {
  locale: 'zh',
  theme: 'system',
  activePackId: 'ja',
  ipaVoice: '',
  speechRate: 0,
  nhkEasy: true,
  newPerDay: 20,
  reviewCap: 200,
  studyOrder: 'seq',
  relearn: true,
  checkUpdates: true,
  updateCheckMinutes: 20,
  skippedVersion: ''
}

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

const MIN_WIDTH = 900
const MIN_HEIGHT = 600

const userData = (): string => app.getPath('userData')
const prefsFile = (): string => join(userData(), 'prefs.json')
const windowFile = (): string => join(userData(), 'window.json')
/** 学习包目录：一个包一个子目录，里面 manifest.json + 来源数据（千语集项目原文等） */
const packsDir = (): string => join(userData(), 'packs')
/**
 * 用户自己的录音：recordings/<包 id>/<条目键>.<扩展名>。
 * 跟学习包分开放——重新导入会整个换掉包目录，录音不能跟着没了
 */
const recordingsDir = (): string => join(userData(), 'recordings')

/** 合成出来的朗读按内容缓存在这里，删了也没关系 */
const speech = new Speech(join(userData(), 'tts-cache'))

const AUDIO_EXT: Record<string, string> = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac'
}

const RECORDING_KEY = /^[A-Za-z0-9_-]{1,160}$/

/** 条目键（lexeme-<id>、phrase-<id>……）只许字母数字、连字符和下划线 */
function recordingBase(packId: string, key: string): string {
  if (!RECORDING_KEY.test(key)) throw new Error(`录音键不合法：${key}`)
  packDir(packId) // 顺带检查包 id
  return join(recordingsDir(), packId, key)
}

async function findRecording(packId: string, key: string): Promise<string | null> {
  const base = recordingBase(packId, key)
  for (const ext of Object.keys(AUDIO_EXT))
    if (existsSync(`${base}.${ext}`)) return `${base}.${ext}`
  return null
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(readFileSync(file, 'utf8')) }
  } catch {
    return fallback
  }
}

function readPrefs(): Prefs {
  return readJson(prefsFile(), DEFAULT_PREFS)
}

/** 包 id 只许字母数字和连字符，免得拼路径时跑出包目录 */
function packDir(id: string): string {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) throw new Error(`学习包 id 不合法：${id}`)
  return join(packsDir(), id)
}

function readWindowState(): WindowState {
  const def: WindowState = { width: 1280, height: 820, maximized: false }
  const ws = readJson(windowFile(), def)
  // 记下的位置不在任何一块屏幕上（换了显示器）就不用它
  if (ws.x !== undefined && ws.y !== undefined) {
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea
      return (
        ws.x! < a.x + a.width - 100 &&
        ws.x! + 100 > a.x &&
        ws.y! >= a.y &&
        ws.y! < a.y + a.height - 50
      )
    })
    if (!visible) {
      delete ws.x
      delete ws.y
    }
  }
  ws.width = Math.max(MIN_WIDTH, ws.width)
  ws.height = Math.max(MIN_HEIGHT, ws.height)
  return ws
}

/** 主窗口（下载更新时往它推进度） */
let mainWindow: BrowserWindow | null = null
const readyToClose = new WeakSet<BrowserWindow>()
const waitingToClose = new WeakSet<BrowserWindow>()
const finishingClose = new WeakSet<BrowserWindow>()
let quitRequested = false

// A prevented BrowserWindow.close cancels the original app.quit. Preserve that intent
// so a successful renderer/main save handshake also completes Cmd+Q on macOS.
app.on('before-quit', () => {
  quitRequested = true
})

function createWindow(): void {
  const ws = readWindowState()
  const dark =
    readPrefs().theme === 'dark' ||
    (readPrefs().theme === 'system' && nativeTheme.shouldUseDarkColors)
  const win = new BrowserWindow({
    x: ws.x,
    y: ws.y,
    width: ws.width,
    height: ws.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: 'Qonsona',
    backgroundColor: dark ? '#161715' : '#fafaf7',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.on('ready-to-show', () => {
    if (ws.maximized) win.maximize()
    win.show()
  })

  win.on('close', (event) => {
    if (!readyToClose.has(win) && !win.webContents.isDestroyed() && !win.webContents.isLoading()) {
      event.preventDefault()
      if (!waitingToClose.has(win)) {
        waitingToClose.add(win)
        win.webContents.send('app:flush-before-close')
      }
    }
    const b = win.getNormalBounds()
    const state: WindowState = { ...b, maximized: win.isMaximized() }
    try {
      mkdirSync(userData(), { recursive: true })
      writeFileSync(windowFile(), JSON.stringify(state))
    } catch {
      // 记不下窗口位置不影响退出
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ───────────────────────── IPC ─────────────────────────

// 软件内更新：检查、下载（装过的 Windows 版先试增量）、安装
registerUpdater(() => mainWindow, userData)
// 框架里各语言（英、法、韩、西、阿、俄、盖尔）的词典与录音
registerLangIpc()
registerDictionaryDaily(() => ja())
ipcMain.handle('app:close-ready', async (event, saved = true) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || !waitingToClose.has(win)) return
  if (!saved) {
    waitingToClose.delete(win)
    return
  }
  if (finishingClose.has(win)) return
  finishingClose.add(win)
  try {
    await pendingWrites.drain({ retryFailed: true })
    if (win.isDestroyed() || !waitingToClose.has(win)) return
    waitingToClose.delete(win)
    readyToClose.add(win)
    const resumeQuit = quitRequested
    // closed is emitted after this asynchronous IPC handler returns to Electron.
    if (resumeQuit && process.platform === 'darwin')
      win.once('closed', () => {
        if (BrowserWindow.getAllWindows().length === 0) app.quit()
      })
    win.close()
  } catch (error) {
    waitingToClose.delete(win)
    throw error
  } finally {
    finishingClose.delete(win)
  }
})

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  userData: userData(),
  platform: process.platform
}))

ipcMain.handle('app:openDataDir', async () => {
  mkdirSync(userData(), { recursive: true })
  await shell.openPath(userData())
})

ipcMain.handle('prefs:get', () => readPrefs())

ipcMain.handle('prefs:set', async (_e, patch: Partial<Prefs>) => {
  const next = { ...readPrefs(), ...patch }
  await fs.mkdir(userData(), { recursive: true })
  await fs.writeFile(prefsFile(), JSON.stringify(next, null, 2))
  return next
})

ipcMain.handle('theme:set', (_e, theme: Prefs['theme']) => {
  nativeTheme.themeSource = theme
})

/** 装着的学习包：每个子目录的 manifest.json */
ipcMain.handle('packs:list', async () => {
  if (!existsSync(packsDir())) return []
  const out: unknown[] = []
  for (const name of await fs.readdir(packsDir())) {
    try {
      out.push(JSON.parse(await fs.readFile(join(packsDir(), name, 'manifest.json'), 'utf8')))
    } catch {
      // 半截的目录（导入到一半退出）跳过
    }
  }
  return out
})

/** 读包里的一个文件（千语集项目原文等） */
ipcMain.handle('packs:readFile', async (_e, id: string, file: string) => {
  if (!/^[A-Za-z0-9._-]+$/.test(file) || file.startsWith('.')) throw new Error('文件名不合法')
  try {
    return await fs.readFile(join(packDir(id), file), 'utf8')
  } catch {
    return null
  }
})

/**
 * 写一个学习包：先写进临时目录，全部写好再换掉旧的，中途失败不会留下半个包。
 * files 是 文件名 → 文字内容，manifest.json 必须有；audio 是作者录音（条目键 → 字节与扩展名），
 * 写在 audio/<条目键>.<扩展名>。用户自己的录音在 recordings/ 下，不受重新导入影响。
 */
ipcMain.handle(
  'packs:save',
  async (
    _e,
    id: string,
    files: Record<string, string>,
    audio: Record<string, { bytes: Uint8Array; ext: string }> = {}
  ) => {
    if (!files['manifest.json']) throw new Error('缺 manifest.json')
    const dir = packDir(id)
    const tmp = dir + '.tmp'
    await fs.rm(tmp, { recursive: true, force: true })
    await fs.mkdir(tmp, { recursive: true })
    for (const [name, text] of Object.entries(files)) {
      if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith('.')) throw new Error('文件名不合法')
      await fs.writeFile(join(tmp, name), text)
    }
    const entries = Object.entries(audio)
    if (entries.length) await fs.mkdir(join(tmp, 'audio'))
    for (const [key, a] of entries) {
      if (!RECORDING_KEY.test(key)) throw new Error(`录音键不合法：${key}`)
      if (!AUDIO_EXT[a.ext]) throw new Error(`不支持的音频格式：${a.ext}`)
      await fs.writeFile(join(tmp, 'audio', `${key}.${a.ext}`), a.bytes)
    }
    await fs.rm(dir, { recursive: true, force: true })
    await fs.rename(tmp, dir)
  }
)

/** 包里的作者录音：audio/ 下的条目键 */
ipcMain.handle('packs:audioList', async (_e, id: string) => {
  const dir = join(packDir(id), 'audio')
  if (!existsSync(dir)) return []
  return (await fs.readdir(dir))
    .filter((f) => AUDIO_EXT[extname(f).slice(1)])
    .map((f) => f.slice(0, -extname(f).length))
})

ipcMain.handle('packs:audio', async (_e, id: string, key: string) => {
  if (!RECORDING_KEY.test(key)) throw new Error(`录音键不合法：${key}`)
  const base = join(packDir(id), 'audio', key)
  for (const ext of Object.keys(AUDIO_EXT))
    if (existsSync(`${base}.${ext}`))
      return { bytes: new Uint8Array(await fs.readFile(`${base}.${ext}`)), mime: AUDIO_EXT[ext] }
  return null
})

ipcMain.handle('packs:remove', async (_e, id: string) => {
  await fs.rm(packDir(id), { recursive: true, force: true })
})

/** 挑一个千语集项目文件；返回文件名与内容 */
ipcMain.handle('qonlang:pick', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const opts: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: [
      { name: 'Qonlang', extensions: ['json', 'csv'] },
      { name: '*', extensions: ['*'] }
    ]
  }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (r.canceled || !r.filePaths[0]) return null
  const path = r.filePaths[0]
  return { name: basename(path), content: await fs.readFile(path, 'utf8') }
})

// ── 日语词典 ──

/**
 * 词典数据库：打包后放在 resources/data 下（asar 外面，SQLite 读不了 asar 里的文件），
 * 开发时在仓库的 resources/data 下（npm run data:ja 生成）
 */
const jaDictPath = (): string =>
  app.isPackaged
    ? join(process.resourcesPath, 'data/ja/dict.sqlite')
    : join(app.getAppPath(), 'resources/data/ja/dict.sqlite')
let jaDict: JapaneseDict | null = null
function ja(): JapaneseDict | null {
  if (!jaDict && existsSync(jaDictPath())) jaDict = new JapaneseDict(jaDictPath())
  return jaDict
}

ipcMain.handle('ja:available', () => existsSync(jaDictPath()))

/** 手写查字：按笔画认字（参考数据第一次用时从词典里的 KanjiVG 笔画建，一两秒） */
let handwriting: HandwritingIndex | null = null
/** 画板上的笔画：只收数字点，笔数、点数有上限 */
function strokesFrom(raw: unknown): [number, number][][] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 40).map((s) =>
    (Array.isArray(s) ? s : [])
      .slice(0, 2000)
      .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2)
      .map((p) => [Number(p[0]) || 0, Number(p[1]) || 0] as [number, number])
  )
}
/** 打开手写板时先把参考数据建好（第一次约半秒），写第一笔时不用等 */
ipcMain.handle('ja:handwritingLoad', () => {
  if (!existsSync(jaDictPath())) return false
  handwriting ??= new HandwritingIndex(jaDictPath())
  handwriting.load()
  return true
})
ipcMain.handle('ja:handwriting', (_e, strokes: unknown, n?: number) => {
  if (!existsSync(jaDictPath())) return []
  handwriting ??= new HandwritingIndex(jaDictPath())
  const input = strokesFrom(strokes).filter((s) => s.length)
  return input.length ? handwriting.recognize(input, Math.min(50, Number(n) || 20)) : []
})
ipcMain.handle('ja:search', (_e, q: string) => ja()?.search(q) ?? null)
ipcMain.handle('ja:entry', (_e, id: number) => ja()?.entry(id) ?? null)
ipcMain.handle('ja:kanji', (_e, ch: string) => ja()?.kanji(ch) ?? null)
ipcMain.handle('ja:examples', (_e, q: string) => ja()?.examples(q) ?? [])
ipcMain.handle('ja:tags', () => ja()?.tags() ?? {})
ipcMain.handle('ja:sources', () => [
  ...(ja()?.sources() ?? []),
  ...wikt()
    .sources()
    .map(({ name, license, credit, home }) => ({ name, license, credit, home }))
])

/**
 * 维基词典的释义（日语版的日语释义当日日词典、中文版的中文释义）：可选的数据文件，
 * 跟词典数据库放在一起（node scripts/data/wiktionary-ja.mjs 生成）；没有它时两栏不显示
 */
const wiktPath = (): string => join(jaDictPath(), '..', 'wikt.sqlite')
let wiktDict: WiktDict | null = null
const wikt = (): WiktDict => (wiktDict ??= new WiktDict(wiktPath()))
ipcMain.handle('ja:wikt', (_e, id: number) => wikt().definitions(Number(id)))
ipcMain.handle('ja:jlptWords', (_e, level: number) => ja()?.jlptWords(Number(level)) ?? [])
ipcMain.handle('ja:jlptCounts', () => ja()?.jlptCounts() ?? {})
ipcMain.handle('ja:wordItems', (_e, ids: number[]) => ja()?.wordItems(ids.map(Number)) ?? [])
// 五十音课的例词、拼读词；语法课的例句（scripts/data/grammar-examples.ts 挑好的，随程序带着）
ipcMain.handle(
  'ja:kanaStartWords',
  (_e, prefix: string, limit?: number) =>
    ja()?.kanaStartWords(String(prefix), Number(limit) || 3) ?? []
)
ipcMain.handle(
  'ja:kanaSpellWords',
  (_e, allowed: string[], must: string[], limit?: number) =>
    ja()?.kanaSpellWords(allowed.map(String), must.map(String), Number(limit) || 8) ?? []
)
ipcMain.handle('ja:kanaLookup', (_e, texts: string[]) => ja()?.kanaLookup(texts.map(String)) ?? [])
ipcMain.handle('ja:grammarExamples', () => grammarExamples)
ipcMain.handle(
  'ja:conjugables',
  (_e, levels: number[]) => ja()?.conjugables(levels.map(Number)) ?? []
)
// 练习与模拟卷：按等级出题
const exams = new JaExams(ja)
ipcMain.handle('ja:practice', (_e, kind: PracticeKind, level: number, n: number, seed: number) =>
  exams.practice(kind, Number(level), Number(n) || 10, Number(seed) || 1)
)
ipcMain.handle('ja:paper', (_e, level: number, seed: number) =>
  exams.paper(Number(level), Number(seed) || 1)
)
/** 本文练习：用这篇文章的词、语法、句子出一组题 */
ipcMain.handle('ja:articlePractice', async (_e, id: string, seed: number, listen: boolean) => {
  const a = await articles().get(String(id))
  if (!a || !ja()) return []
  const analysis = await analyzer.analyze(a.body, lookup)
  return exams.article(analysis, a.level, Number(seed) || 1, !!listen)
})

// ── 生词本、课程进度、练习记录：每门语言一个文件 userData/<notebook|courses|practice>/<包 id>.json ──

type PackDataDir = 'notebook' | 'courses' | 'practice'
const PACK_DATA: [PackDataDir, string][] = [
  ['notebook', 'notebook'],
  ['courses', 'course'],
  ['practice', 'practice']
]

const packFile = (dir: PackDataDir, packId: string): string => {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(packId)) throw new Error(`学习包 id 不合法：${packId}`)
  return join(userData(), dir, `${packId}.json`)
}

for (const [dir, channel] of PACK_DATA) {
  ipcMain.handle(`${channel}:load`, async (_e, packId: string) => {
    try {
      return await fs.readFile(packFile(dir, packId), 'utf8')
    } catch {
      return null
    }
  })

  /** 先写临时文件再改名：写到一半退出也不会留下半个文件 */
  ipcMain.handle(`${channel}:save`, async (_e, packId: string, content: string) => {
    const file = packFile(dir, packId)
    await fs.mkdir(join(userData(), dir), { recursive: true })
    await fs.writeFile(file + '.tmp', content)
    await fs.rename(file + '.tmp', file)
  })
}

// ── 日语文章：分词、查词、语法点 ──

/** kuromoji 的 IPADIC：开发时在仓库的 node_modules，打包后在 app.asar 里（Electron 能直接读） */
const analyzer = new JaAnalyzer(join(app.getAppPath(), 'node_modules/kuromoji/dict'))
const lookup: WordLookup = (base, reading, inflected) =>
  ja()?.word(base, reading, inflected) ?? null

/** 发给界面的分析结果不带词素（语法点已经算好了） */
const forView = (a: JaAnalysis): JaAnalysis => ({
  ...a,
  sentences: a.sentences.map(({ tokens: _t, ...s }) => ({ ...s, tokens: [] }))
})

ipcMain.handle('ja:analyze', async (_e, text: string) =>
  forView(await analyzer.analyze(String(text), lookup))
)

/** 文章难度：JLPT 词表里的实词的等级 */
async function articleLevel(text: string): Promise<number | null> {
  if (!ja()) return null
  return analysisLevel(await analyzer.analyze(text, lookup))
}

let articleStore: ArticleStore | null = null
const articles = (): ArticleStore =>
  (articleStore ??= new ArticleStore(join(userData(), 'articles'), articleLevel))

ipcMain.handle('articles:list', () => articles().list())
ipcMain.handle('articles:get', (_e, id: string) => articles().get(id))
ipcMain.handle('articles:save', (_e, input: ArticleInput) =>
  pendingWrites.run(articleMutationKey('ja', 'save', input), () =>
    articles().save({ ...input, body: cleanAozora(String(input.body)) })
  )
)
ipcMain.handle('articles:remove', (_e, id: string) =>
  pendingWrites.run(articleMutationKey('ja', 'remove', id), () => articles().remove(id))
)
ipcMain.handle('articles:setTranslation', (_e, id: string, text: string) =>
  pendingWrites.run(articleMutationKey('ja', 'translation', String(id)), () =>
    articles().setTranslation(String(id), String(text ?? ''))
  )
)
ipcMain.handle('articles:markRead', (_e, id: string, read: boolean) =>
  pendingWrites.run(articleMutationKey('ja', 'markRead', id), () => articles().markRead(id, !!read))
)

/** 挑一个文字文件导入：UTF-8 读不通（有替换字符）时按 Shift_JIS 读（青空文库的 txt） */
ipcMain.handle('articles:pickFile', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const opts: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: [{ name: 'Text', extensions: ['txt', 'md'] }]
  }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (r.canceled || !r.filePaths[0]) return null
  const bytes = await fs.readFile(r.filePaths[0])
  let text = new TextDecoder('utf-8').decode(bytes)
  if (text.includes('\uFFFD')) text = new TextDecoder('shift_jis').decode(bytes)
  return { name: basename(r.filePaths[0]).replace(/\.[^.]+$/, ''), content: cleanAozora(text) }
})

ipcMain.handle('nhk:status', () => articles().nhkStatus())
ipcMain.handle('nhk:refresh', async () => {
  const status: NhkStatus = readPrefs().nhkEasy
    ? await refreshNhk(articles())
    : { ok: false, reason: 'off', added: 0, checkedAt: new Date().toISOString() }
  await articles().setNhkStatus(status)
  return status
})

// ── 朗读 ──

ipcMain.handle('speech:voices', () => speech.voices())

ipcMain.handle('speech:speak', async (_e, req: SpeakRequest) => {
  const r = await speech.speak(req)
  return { wav: r.wav ? new Uint8Array(r.wav) : null, dropped: r.dropped, error: r.error }
})

// ── 录音 ──

ipcMain.handle('rec:list', async (_e, packId: string) => {
  const dir = join(recordingsDir(), packId)
  packDir(packId)
  if (!existsSync(dir)) return []
  return (await fs.readdir(dir))
    .filter((f) => AUDIO_EXT[extname(f).slice(1)])
    .map((f) => f.slice(0, -extname(f).length))
})

ipcMain.handle('rec:get', async (_e, packId: string, key: string) => {
  const file = await findRecording(packId, key)
  if (!file) return null
  return { bytes: new Uint8Array(await fs.readFile(file)), mime: AUDIO_EXT[extname(file).slice(1)] }
})

ipcMain.handle(
  'rec:save',
  async (_e, packId: string, key: string, bytes: Uint8Array, ext: string) => {
    if (!AUDIO_EXT[ext]) throw new Error(`不支持的音频格式：${ext}`)
    const base = recordingBase(packId, key)
    const old = await findRecording(packId, key)
    await fs.mkdir(join(recordingsDir(), packId), { recursive: true })
    await fs.writeFile(`${base}.${ext}`, bytes)
    if (old && old !== `${base}.${ext}`) await fs.rm(old, { force: true })
  }
)

ipcMain.handle('rec:delete', async (_e, packId: string, key: string) => {
  const file = await findRecording(packId, key)
  if (file) await fs.rm(file, { force: true })
})

/** 挑一个现成的音频文件当录音 */
ipcMain.handle('rec:pickFile', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const opts: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: Object.keys(AUDIO_EXT) }]
  }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (r.canceled || !r.filePaths[0]) return null
  const path = r.filePaths[0]
  const ext = extname(path).slice(1).toLowerCase()
  if (!AUDIO_EXT[ext]) return null
  return { bytes: new Uint8Array(await fs.readFile(path)), ext }
})

// ── 视听：媒体库与字幕 ──

let mediaLibrary: MediaLibrary | null = null
const media = (): MediaLibrary => (mediaLibrary ??= new MediaLibrary(join(userData(), 'media')))

async function pickFiles(
  e: Electron.IpcMainInvokeEvent,
  filters: Electron.FileFilter[]
): Promise<string[]> {
  const win = BrowserWindow.fromWebContents(e.sender)
  const opts: Electron.OpenDialogOptions = { properties: ['openFile', 'multiSelections'], filters }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  return r.canceled ? [] : r.filePaths
}

/** 一批路径里认得的媒体文件加进库；返回加进去的条目 */
async function addMedia(paths: string[], lang?: string): Promise<unknown[]> {
  const out: unknown[] = []
  const code = typeof lang === 'string' && lang.trim() ? lang.trim().slice(0, 64) : undefined
  for (const p of paths) {
    const it = await media().add(String(p), code)
    if (it) out.push(it)
  }
  return out
}

/** 一批字幕文件加到某一条上；返回最后的条目与没能解析的文件名 */
async function addSubtitles(
  id: string,
  paths: string[]
): Promise<{ item: unknown; failed: string[] }> {
  let item: unknown = null
  const failed: string[] = []
  for (const p of paths) {
    const name = basename(String(p))
    if (!SUBTITLE_EXT.includes(extname(name).slice(1).toLowerCase())) {
      failed.push(name)
      continue
    }
    const r = await media().addSubtitle(id, name, new Uint8Array(await fs.readFile(String(p))))
    if (r) item = r
    else failed.push(name)
  }
  return { item, failed }
}

ipcMain.handle('media:list', () => media().list())
ipcMain.handle('media:pick', async (e, lang?: string) =>
  addMedia(
    await pickFiles(e, [
      { name: 'Video / Audio', extensions: [...VIDEO_EXT, ...MEDIA_AUDIO] },
      { name: 'Video', extensions: VIDEO_EXT },
      { name: 'Audio', extensions: MEDIA_AUDIO }
    ]),
    lang
  )
)
ipcMain.handle('media:addPaths', (_e, paths: string[], lang?: string) => addMedia(paths, lang))
ipcMain.handle('media:pickSubtitle', async (e, id: string) =>
  addSubtitles(id, await pickFiles(e, [{ name: 'Subtitles', extensions: SUBTITLE_EXT }]))
)
ipcMain.handle('media:addSubtitlePaths', (_e, id: string, paths: string[]) =>
  addSubtitles(id, paths)
)
ipcMain.handle('media:update', (_e, id: string, patch: MediaPatch) => media().update(id, patch))
ipcMain.handle('media:remove', (_e, id: string) => media().remove(id))
ipcMain.handle('media:removeSubtitle', (_e, id: string, subId: string) =>
  media().removeSubtitle(id, subId)
)
ipcMain.handle('media:subtitle', (_e, id: string, subId: string) => media().subtitle(id, subId))
ipcMain.handle('media:reveal', async (_e, id: string) => {
  const it = (await media().list()).find((x) => x.id === id)
  if (it?.exists) shell.showItemInFolder(it.path)
})

// ── 统计：学习时长（所有语言一个文件） ──

const statsFile = (): string => join(userData(), 'stats.json')
ipcMain.handle('stats:load', async () => {
  try {
    return await fs.readFile(statsFile(), 'utf8')
  } catch {
    return null
  }
})
ipcMain.handle('stats:save', async (_e, content: string) => {
  await fs.mkdir(userData(), { recursive: true })
  await fs.writeFile(statsFile() + '.tmp', String(content))
  await fs.rename(statsFile() + '.tmp', statsFile())
})

// ── 备份与恢复 ──

/** 上次启动时恢复备份的结果（界面启动后问一次，写一条提示） */
let restoreResult: Awaited<ReturnType<typeof applyPendingRestore>> = null

ipcMain.handle('backup:export', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const opts: Electron.SaveDialogOptions = {
    defaultPath: join(app.getPath('documents'), `qonsona-backup-${stamp}.zip`),
    filters: [{ name: 'Zip', extensions: ['zip'] }]
  }
  const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (r.canceled || !r.filePath) return null
  await pendingWrites.drain()
  const out = await createBackup(userData(), r.filePath, app.getVersion())
  return { path: r.filePath, ...out }
})

ipcMain.handle('backup:pick', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const opts: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: [{ name: 'Zip', extensions: ['zip'] }]
  }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  const path = r.canceled ? null : r.filePaths[0]
  if (!path) return null
  const info = await readBackup(path)
  if (!info.ok) return { ok: false, reason: info.reason }
  return {
    ok: true,
    path,
    createdAt: info.manifest.createdAt,
    appVersion: info.manifest.appVersion,
    files: Object.keys(info.files).length
  }
})

/** 用这个备份恢复：记下来，重新启动，启动时（开窗口之前）换数据 */
ipcMain.handle('backup:restore', async (_e, file: string) => {
  const info = await readBackup(String(file))
  if (!info.ok) throw new Error(info.reason)
  await scheduleRestore(userData(), String(file))
  app.relaunch()
  app.exit(0)
})

ipcMain.handle('backup:restored', () => {
  const r = restoreResult
  restoreResult = null
  return r
})

// ───────────────────────── 启动 ─────────────────────────

app.whenReady().then(async () => {
  electronApp.setAppUserModelId(APP_ID)
  // 改名（原名 Qonlang Study）后第一次启动：把旧数据目录里的学习数据拷过来，旧目录不动
  try {
    const moved = migrateLegacyData(userData())
    if (moved) console.log(`migrated ${moved.entries.join(', ')} from ${moved.from}`)
  } catch (e) {
    console.error('migrating data from the old data folder failed', e)
  }
  // 上次在「设置」里选了用备份恢复：开窗口之前换数据
  restoreResult = await applyPendingRestore(userData()).catch((e) => ({
    ok: false as const,
    reason: String(e)
  }))
  setTransferResult(
    await applyPendingTransfer(userData()).catch((error) => ({ error: String(error) }))
  )
  await registerTransferIpc()
  nativeTheme.themeSource = readPrefs().theme
  protocol.handle(MEDIA_SCHEME, (req) => media().serve(req))

  // 只给麦克风（录音用），摄像头和其他权限一律不给
  const audioOnly = (permission: string, mediaTypes?: string[]): boolean =>
    permission === 'media' && (mediaTypes ?? []).every((t) => t === 'audio')
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) =>
    callback(audioOnly(permission, (details as { mediaTypes?: string[] }).mediaTypes))
  )
  session.defaultSession.setPermissionCheckHandler(
    (_wc, permission, _origin, details) =>
      permission === 'media' && (details as { mediaType?: string }).mediaType !== 'video'
  )

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  analysisClient.dispose()
  speech.dispose()
  jaDict?.close()
})
