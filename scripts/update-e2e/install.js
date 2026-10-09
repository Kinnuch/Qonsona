// 装上一轮 download.js 下好的安装包：程序会退出、静默安装、装好后自己重开
;(() => {
  const p = window.__utPath
  setTimeout(() => window.qstudy.invoke('app:installUpdate', p), 200)
  return 'install scheduled: ' + p
})()
