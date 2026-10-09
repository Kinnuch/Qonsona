declare global {
  interface Window {
    qstudy?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      on: (channel: string, cb: (...args: unknown[]) => void) => void
      pathForFile: (file: File) => string
    }
  }
}

export {}
