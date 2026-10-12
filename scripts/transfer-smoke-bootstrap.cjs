/* eslint-disable @typescript-eslint/no-require-imports -- Electron测试入口先patch dialog再加载CommonJS生产构建。 */
/** 仅供 smoke-transfer.mjs 的隔离Electron进程；生产入口不会加载此脚本。 */
const { app, dialog } = require('electron')
const { readFileSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { tmpdir } = require('node:os')
const root = resolve(__dirname, '..')
const profile = app.commandLine.getSwitchValue('user-data-dir')
if (
  !profile ||
  !resolve(profile).startsWith(resolve(tmpdir()) + require('node:path').sep) ||
  !require('node:path').basename(profile).startsWith('qonsona-transfer-smoke-')
)
  throw new Error('Transfer smoke requires its own temporary profile')
app.getAppPath = () => root
const control = () => {
  const value = JSON.parse(readFileSync(join(profile, 'transfer-smoke-control.json'), 'utf8'))
  for (const path of [value.exportFile, value.importFile])
    if (
      typeof path !== 'string' ||
      !resolve(path).startsWith(resolve(profile) + require('node:path').sep)
    )
      throw new Error('Test dialog paths must stay inside the smoke profile')
  return value
}
dialog.showSaveDialog = async (...args) => {
  const options = args.at(-1)
  if (!options.filters?.some((filter) => filter.name === 'Qonsona learning data'))
    return { canceled: true }
  return { canceled: false, filePath: control().exportFile }
}
dialog.showOpenDialog = async (...args) => {
  const options = args.at(-1)
  if (!options.filters?.some((filter) => filter.name === 'Qonsona learning data'))
    return { canceled: true, filePaths: [] }
  return { canceled: false, filePaths: [control().importFile] }
}
require(join(root, 'out/main/index.js'))
