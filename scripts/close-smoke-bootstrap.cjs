/* eslint-disable @typescript-eslint/no-require-imports -- Test-only Electron launcher. */
/** Invoke BrowserWindow.close() through the native app path, never the CDP renderer-destruction shortcut. */
const { app, BrowserWindow } = require('electron')
const { existsSync, readFileSync, writeFileSync } = require('node:fs')
const { basename, join, resolve, sep } = require('node:path')
const { tmpdir } = require('node:os')
const root = resolve(__dirname, '..')
const profile = resolve(app.commandLine.getSwitchValue('user-data-dir'))
if (
  !profile.startsWith(resolve(tmpdir()) + sep) ||
  !/^qonsona-(save-close|review-feedback|collection)-/.test(basename(profile))
)
  throw new Error('Native close smoke requires its own temporary profile')
app.getAppPath = () => root
const controlFile = join(profile, 'native-close-control.json')
const evidence = join(profile, 'native-close-evidence.json')
let previous = ''
app.whenReady().then(() => {
  const timer = setInterval(() => {
    if (!existsSync(controlFile)) return
    const command = JSON.parse(readFileSync(controlFile, 'utf8'))
    if (command.id === previous) return
    const windows = BrowserWindow.getAllWindows()
    if (!windows.length) return
    previous = command.id
    if (command.focus) {
      for (const win of windows) {
        win.show()
        win.focus()
        win.webContents.focus()
      }
      return
    }
    if (!command.close) return
    let prevented = false
    for (const win of windows) {
      win.once('close', (event) => {
        prevented = event.defaultPrevented
      })
      win.close()
    }
    writeFileSync(evidence, JSON.stringify({ nativeClose: true, prevented, id: previous }))
  }, 30)
  timer.unref()
})
require(join(root, 'out/main/index.js'))
