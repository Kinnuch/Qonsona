// 在装好的测试版窗口里跑一段脚本（测试版要带 --remote-debugging-port 起）：
//   node scripts/update-e2e/cdp.mjs <脚本文件>        端口用 UT_PORT，默认 9351
import { readFileSync } from 'node:fs'

const port = process.env.UT_PORT || 9351
const expression = readFileSync(process.argv[2], 'utf8')
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
if (!page) throw new Error(`端口 ${port} 上没有页面`)
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
ws.send(
  JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression, awaitPromise: true, returnByValue: true }
  })
)
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data)
  if (d.id !== 1) return
  console.log(JSON.stringify(d.result?.result?.value ?? d.result))
  ws.close()
  process.exit(0)
})
