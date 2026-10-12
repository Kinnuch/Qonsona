import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          'analysis-worker': resolve(__dirname, 'src/main/lang/analysis-worker.ts')
        }
      }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        $lib: resolve(__dirname, 'src/renderer/src/lib'),
        // 千语集引擎快照（scripts/sync-qonlang.mjs 拷过来的，别手改）
        $qon: resolve(__dirname, 'src/renderer/src/vendor/qonlang'),
        // 主进程与界面共用的代码（日语词形还原、词典数据形状）
        $shared: resolve(__dirname, 'src/shared')
      }
    },
    plugins: [svelte()]
  }
})
