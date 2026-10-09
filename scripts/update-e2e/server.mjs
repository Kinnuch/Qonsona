// 增量更新验收用的本机更新源：静态文件，只认单段 Range（跟 GitHub 的 Release 下载一样），每个请求记一行。
// 用法：node scripts/update-e2e/server.mjs <目录> <日志文件>
// UT_MODE=corrupt-ranges：206 分段响应里把 .exe 的第一个字节翻转（模拟拼出来的块不对），整包 200 响应不动
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const root = process.argv[2]
const logFile = process.argv[3]
const mode = process.env.UT_MODE || 'normal'

const log = (entry) => fs.appendFileSync(logFile, JSON.stringify(entry) + '\n')

http
  .createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice(1))
    const file = path.join(root, name)
    const entry = {
      t: Date.now(),
      method: req.method,
      name,
      range: req.headers.range || null,
      mode
    }
    if (!name || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404)
      res.end()
      log({ ...entry, status: 404, bytes: 0 })
      return
    }
    const size = fs.statSync(file).size
    const single = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '')
    if (single) {
      const start = Number(single[1])
      const end = single[2] ? Math.min(Number(single[2]), size - 1) : size - 1
      const buf = Buffer.alloc(Math.max(0, end - start + 1))
      const fd = fs.openSync(file, 'r')
      fs.readSync(fd, buf, 0, buf.length, start)
      fs.closeSync(fd)
      if (mode === 'corrupt-ranges' && name.endsWith('.exe') && buf.length) buf[0] ^= 0xff
      res.writeHead(206, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': buf.length,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes'
      })
      res.end(req.method === 'HEAD' ? undefined : buf)
      log({ ...entry, status: 206, bytes: req.method === 'HEAD' ? 0 : buf.length })
      return
    }
    // 没有 Range，或者是多段 Range（不支持，跟很多 CDN 一样给整个文件）
    res.writeHead(200, {
      'Content-Type': name.endsWith('.yml') ? 'text/yaml' : 'application/octet-stream',
      'Content-Length': size,
      'Accept-Ranges': 'bytes'
    })
    if (req.method === 'HEAD') res.end()
    else fs.createReadStream(file).pipe(res)
    log({ ...entry, status: 200, bytes: req.method === 'HEAD' ? 0 : size })
  })
  .listen(8765, '127.0.0.1', () => console.log('listening 8765 mode=' + mode))
