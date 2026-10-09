import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      $lib: resolve(__dirname, 'src/renderer/src/lib'),
      $qon: resolve(__dirname, 'src/renderer/src/vendor/qonlang'),
      $shared: resolve(__dirname, 'src/shared')
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
})
