// 增量更新验收的核对工具
//   node check.mjs sha <文件>                 文件的 sha512（base64，跟 latest.yml 同一种写法）
//   node check.mjs yml <latest.yml>            latest.yml 里的版本、文件名、sha512、大小
//   node check.mjs tree <目录A> <目录B>        两个目录逐个文件比 sha256，列出不一样的
//   node check.mjs served <server.log> <文件名> 服务端日志里这个文件一共发出去多少字节、各种状态几次
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const [cmd, a, b] = process.argv.slice(2)
const sha = (file, algo = 'sha512', enc = 'base64') =>
  crypto.createHash(algo).update(fs.readFileSync(file)).digest(enc)

function walk(dir, base = dir, out = new Map()) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, base, out)
    else out.set(path.relative(base, p).split(path.sep).join('/'), p)
  }
  return out
}

if (cmd === 'sha') console.log(sha(a))
else if (cmd === 'yml') {
  const text = fs.readFileSync(a, 'utf8')
  const pick = (k) => (text.match(new RegExp('^\\s*' + k + ':\\s*(.+)$', 'm')) || [])[1]?.trim()
  console.log(
    JSON.stringify({
      version: pick('version'),
      path: pick('path'),
      sha512: pick('sha512'),
      size: pick('size')
    })
  )
} else if (cmd === 'tree') {
  const A = walk(a)
  const B = walk(b)
  const diff = []
  for (const [rel, p] of A) {
    if (!B.has(rel)) diff.push(['only-in-A', rel])
    else if (sha(p, 'sha256', 'hex') !== sha(B.get(rel), 'sha256', 'hex'))
      diff.push(['differs', rel])
  }
  for (const rel of B.keys()) if (!A.has(rel)) diff.push(['only-in-B', rel])
  console.log(JSON.stringify({ filesA: A.size, filesB: B.size, diff }, null, 1))
} else if (cmd === 'served') {
  const lines = fs.existsSync(a)
    ? fs
        .readFileSync(a, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : []
  const mine = lines.filter((l) => l.name === b)
  const byStatus = {}
  for (const l of mine) byStatus[l.status] = (byStatus[l.status] || 0) + 1
  console.log(
    JSON.stringify({
      requests: mine.length,
      bytes: mine.reduce((s, l) => s + l.bytes, 0),
      byStatus
    })
  )
}
