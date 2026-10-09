// 在测试版里调一次 app:downloadUpdate（跟右下角「下载并安装」走同一条路），记下下好的路径给 install.js 用
;(async () => {
  const t0 = Date.now()
  const progress = []
  window.qstudy.on('update:progress', (p) => progress.push(p))
  const r = await window.qstudy.invoke(
    'app:downloadUpdate',
    'http://127.0.0.1:8765/QonsonaUpdateTest-9.0.1-setup.exe',
    'QonsonaUpdateTest-9.0.1-setup.exe',
    '9.0.1'
  )
  if (r && r.path) window.__utPath = r.path
  const last = progress[progress.length - 1] ?? null
  return JSON.stringify({
    r,
    ms: Date.now() - t0,
    progressEvents: progress.length,
    lastProgress: last
  })
})()
