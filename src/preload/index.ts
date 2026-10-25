import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC_EVENT_CHANNELS, IPC_INVOKE_CHANNELS } from '../shared/ipc-security'

/** 渲染层只拿到这几个入口；具体通道见 src/main/index.ts */
const bridge = {
  /** 拖进窗口的文件在磁盘上的路径（视听把视频、字幕拖进来用） */
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> =>
    IPC_INVOKE_CHANNELS.has(channel)
      ? ipcRenderer.invoke(channel, ...args)
      : Promise.reject(new Error('INVALID_IPC_CHANNEL')),
  on: (channel: string, cb: (...args: unknown[]) => void): void => {
    if (!IPC_EVENT_CHANNELS.has(channel)) throw new Error('INVALID_IPC_CHANNEL')
    ipcRenderer.on(channel, (_e, ...args) => cb(...args))
  }
}

if (process.isMainFrame && process.contextIsolated) {
  contextBridge.exposeInMainWorld('qstudy', bridge)
}
