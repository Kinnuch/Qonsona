import { contextBridge, ipcRenderer, webUtils } from 'electron'

/** 渲染层只拿到这几个入口；具体通道见 src/main/index.ts */
const bridge = {
  /** 拖进窗口的文件在磁盘上的路径（视听把视频、字幕拖进来用） */
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel: string, cb: (...args: unknown[]) => void): void => {
    ipcRenderer.on(channel, (_e, ...args) => cb(...args))
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('qstudy', bridge)
} else {
  // @ts-ignore 非隔离模式（仅开发）
  window.qstudy = bridge
}
