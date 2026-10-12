/** 七门新增语言的真实 Electron 验收，使用独立用户数据目录，不操作已安装实例。 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.SMOKE_PORT) || 9461
const userData = mkdtempSync(join(tmpdir(), 'qonsona-languages-'))
const shots = join(root, 'dist/smoke-languages')
mkdirSync(shots, { recursive: true })
writeFileSync(join(userData, 'prefs.json'), JSON.stringify({ checkUpdates: false, nhkEasy: false }))
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const wav = Buffer.alloc(44 + 8000 * 8 * 2)
wav.write('RIFF', 0)
wav.writeUInt32LE(wav.length - 8, 4)
wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(8000, 24)
wav.writeUInt32LE(16000, 28)
wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(wav.length - 44, 40)
const wavFile = join(userData, 'qa-silence.wav')
writeFileSync(wavFile, wav)
const child = spawn(
  join(root, 'node_modules/electron/dist/electron.exe'),
  [
    root,
    `--user-data-dir=${userData}`,
    `--remote-debugging-port=${port}`,
    // Keep automated timers and rendering active when Codex takes focus between checks.
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream'
  ],
  { env, stdio: 'ignore' }
)
const sleep = (n) => new Promise((r) => setTimeout(r, n))
const results = []
const errors = []
let ws
let capture
let inspect
function check(name, value, detail = '') {
  results.push({ name, ok: !!value, detail })
  console.log(`${value ? '✓' : '✗'} ${name}${detail ? ': ' + detail : ''}`)
  if (!value) throw new Error(`${name}: ${detail}`)
}
try {
  let url
  for (let i = 0; i < 100 && !url; i++) {
    try {
      url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (t) => t.type === 'page'
      )?.webSocketDebuggerUrl
    } catch {
      /* 启动中 */
    }
    if (!url) await sleep(200)
  }
  if (!url) throw new Error('Electron DevTools 未启动')
  ws = new WebSocket(url)
  await new Promise((r, j) => {
    ws.onopen = r
    ws.onerror = j
  })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id) {
      pending.get(msg.id)?.(msg)
      pending.delete(msg.id)
    } else if (msg.method === 'Runtime.exceptionThrown')
      errors.push(
        msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text
      )
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
  }
  const send = (method, params = {}) =>
    new Promise((r) => {
      const id = ++seq
      pending.set(id, r)
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', {
      expression: `(async () => { ${expr} })()`,
      awaitPromise: true,
      returnByValue: true
    })
    if (res.result?.exceptionDetails)
      throw new Error(
        res.result.exceptionDetails.exception?.description ?? res.result.exceptionDetails.text
      )
    return res.result?.result?.value
  }
  inspect = evaluate
  const waitFor = async (expr, ms = 15000) => {
    const end = Date.now() + ms
    do {
      if (await evaluate(`return !!(${expr})`)) return true
      await sleep(100)
    } while (Date.now() < end)
    return false
  }
  const click = (selector) =>
    evaluate(
      `const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('missing '+${JSON.stringify(selector)}); el.click()`
    )
  const shot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(shots, `${name}.png`), Buffer.from(res.result.data, 'base64'))
  }
  capture = shot
  check('程序启动', await waitFor('document.querySelector("[data-nav=home]")'))
  for (const code of ['en', 'fr', 'ko', 'es', 'ar', 'ru', 'gd']) {
    await click('[data-switcher]')
    await click(`[data-pack="${code}"]`)
    check(
      `${code} 学习模块`,
      await waitFor(
        'document.querySelector("[data-nav=courses]") && document.querySelector("[data-nav=reading]") && document.querySelector("[data-nav=media]")'
      )
    )
    await click('[data-nav=dictionary]')
    check(
      `${code} 词典初次打开`,
      await waitFor(`document.querySelector('[data-lex-dict="${code}"] [data-dict-input]')`)
    )
    const query = {
      en: 'house',
      fr: 'chat',
      ko: '학교',
      es: 'libro',
      ar: 'كتاب',
      ru: 'книга',
      gd: 'bhàta'
    }[code]
    await evaluate(
      `const el=document.querySelector('[data-dict-input]'); el.value=${JSON.stringify(query)}; el.dispatchEvent(new Event('input',{bubbles:true}))`
    )
    check(
      `${code} 词典查词及详情`,
      await waitFor(
        'document.querySelector("[data-hit]") && document.querySelector("[data-headword]")'
      )
    )
    await evaluate(
      `const el=document.querySelector('[data-dict-input]'); el.value=''; el.dispatchEvent(new Event('input',{bubbles:true}))`
    )
    await click('[data-dict-tab=grammar]')
    check(
      `${code} 语法词典`,
      await waitFor('document.querySelector("[data-lex-grammar] [data-grammar-point]")')
    )
    await click('[data-nav=reading]')
    check(
      `${code} 分级文章库`,
      await waitFor(
        `document.querySelector('[data-lex-library="${code}"] [data-article^="b-"] .open')`
      )
    )
    await click(`[data-lex-library="${code}"] [data-article^="b-"] .open`)
    check(
      `${code} 正文查词分析`,
      await waitFor('document.querySelector("[data-lex-reader] [data-w]")')
    )
    await shot(`${code}-reader`)
    check(
      `${code} 正文保留原文词间和句间空白`,
      await evaluate(`
      const reader=document.querySelector('[data-lex-reader]');
      const a=await window.qstudy.invoke('langArticles:get',${JSON.stringify(code)},reader.dataset.lexReader);
      const shown=Array.from(reader.querySelectorAll('.para')).map(p=>{const c=p.cloneNode(true); c.querySelectorAll('rt').forEach(x=>x.remove()); return c.textContent}).join(' ');
      return shown.replace(/\\s+/g,' ').trim()===a.body.replace(/\\s+/g,' ').trim()
    `)
    )
    await click('[data-article-practice]')
    check(
      `${code} 本文练习`,
      await waitFor('document.querySelector("[data-practice-run=article] [data-choice]")')
    )
    await click('[data-nav=courses]')
    check(
      `${code} 六类课程`,
      await waitFor('document.querySelectorAll("[data-course]").length >= 5')
    )
    await click('[data-course=grammar] [data-continue]')
    check(
      `${code} 语法讲解`,
      await waitFor('document.querySelector("[data-lesson-page] [data-point] [data-example]")')
    )
    await click('[data-start-quiz]')
    check(
      `${code} 课程测验`,
      await waitFor('document.querySelector("[data-question] [data-choice]")')
    )
    const passed = await evaluate(
      `for(let i=0;i<100;i++){ if(document.querySelector('[data-quiz-result]')) break; document.querySelector('[data-choice][data-correct]')?.click(); await new Promise(r=>setTimeout(r,30)); document.querySelector('[data-quiz-next]')?.click(); await new Promise(r=>setTimeout(r,30)); } return !!document.querySelector('[data-quiz-result][data-passed]')`
    )
    check(`${code} 课程答题及格`, passed)
    await click('[data-next-lesson]')
    check(
      `${code} 下一课无崩溃`,
      await waitFor(
        'document.querySelector("[data-lesson-page]") && !document.querySelector("[data-quiz]")'
      )
    )
    await click('[data-nav=courses]')
    // 当前停在下一课，先回课程目录再回列表。
    await click('[data-lesson-page] [data-back]')
    await click('[data-course-page] [data-back]')
    await click('[data-course=stories] [data-continue]')
    check(`${code} 故事课`, await waitFor('document.querySelector("[data-text] [data-read-text]")'))
    const storyId = await evaluate('return document.querySelector("[data-text]").dataset.text')
    await click('[data-read-text]')
    check(
      `${code} 故事打开对应阅读`,
      await waitFor(`document.querySelector('[data-lex-reader="${storyId}"] [data-w]')`)
    )
    await click('[data-lex-reader] [data-back]')
    check(
      `${code} 阅读返回课程`,
      await waitFor('document.querySelector("[data-text] [data-read-text]")')
    )
    await click('[data-nav=practice]')
    await evaluate('document.querySelector("[data-practice-exit]")?.click()')
    check(
      `${code} 六级训练卷`,
      await waitFor('document.querySelectorAll("[data-start-exam]").length >= 6')
    )
    await click('[data-start-exam]')
    check(
      `${code} 可开始限时训练卷`,
      await waitFor('document.querySelector("[data-exam] [data-choice]")')
    )
    await shot(`${code}-exam`)
    const sample = await evaluate(
      `const items=await window.qstudy.invoke('langArticles:list',${JSON.stringify(code)}); const a=await window.qstudy.invoke('langArticles:get',${JSON.stringify(code)},items.find(x=>x.source==='builtin').id); return a.body.split(String.fromCharCode(10))[0]`
    )
    const srtFile = join(userData, `${code}.srt`)
    writeFileSync(
      srtFile,
      `1\n00:00:00,000 --> 00:00:04,000\n${sample}\n\n2\n00:00:04,000 --> 00:00:08,000\n${sample}\n`
    )
    const mediaId = await evaluate(
      `const items=await window.qstudy.invoke('media:addPaths',[${JSON.stringify(wavFile)}],${JSON.stringify(code)}); const item=items[0]; await window.qstudy.invoke('media:addSubtitlePaths',item.id,[${JSON.stringify(srtFile)}]); return item.id`
    )
    await click('[data-nav=media]')
    check(
      `${code} 独立媒体库`,
      await waitFor(`document.querySelector('[data-open-media="${mediaId}"]')`)
    )
    await click(`[data-open-media="${mediaId}"]`)
    check(
      `${code} 字幕逐词分析`,
      await waitFor('document.querySelector("[data-lines] [data-word]")')
    )
    await click('[data-lines] [data-word]')
    check(`${code} 字幕词卡`, await waitFor('document.querySelector("[data-word-card]")'))
    await shot(`${code}-media`)
    await evaluate('document.querySelector("[data-video]").pause()')
    await click('[data-nav=stats]')
    check(`${code} 统计`, await waitFor('document.querySelector("[data-stats]")'))
  }
  await click('[data-switcher]')
  await click('[data-pack=en]')
  await click('[data-nav=reading]')
  await waitFor('document.querySelector("[data-article^=b-] .open")')
  await click('[data-article^=b-] .open')
  await waitFor('document.querySelector("[data-vocab]")')
  const recordedKey = await evaluate(
    'return "lex-"+document.querySelector("[data-vocab]").dataset.vocab'
  )
  await click('[data-vocab]')
  await waitFor('document.querySelector("[data-word-card] [data-record]")')
  await click('[data-word-card] [data-record]')
  check('隔离假麦克风开始录音', await waitFor('document.querySelector("[data-record].rec")'))
  await sleep(400)
  await click('[data-switcher]')
  await click('[data-pack=fr]')
  check(
    '切换语言将录音保存在原语言',
    await waitFor(
      `(await window.qstudy.invoke('rec:list','en')).includes(${JSON.stringify(recordedKey)})`
    )
  )
  check(
    '录音没有串到法语',
    !(await evaluate(
      `return (await window.qstudy.invoke('rec:list','fr')).includes(${JSON.stringify(recordedKey)})`
    ))
  )
  check('零控制台错误', errors.length === 0, errors.join(' | '))
} catch (e) {
  if (capture) await capture('failure').catch(() => {})
  if (inspect)
    writeFileSync(
      join(shots, 'failure-ui.txt'),
      String(await inspect('return document.body.innerText').catch(() => ''))
    )
  console.error(e.stack ?? e)
  results.push({ name: '验收完成', ok: false, detail: String(e) })
} finally {
  ws?.close()
  child.kill()
  writeFileSync(join(shots, 'results.json'), JSON.stringify({ results, errors, userData }, null, 2))
}
const failed = results.filter((r) => !r.ok)
console.log(`${results.length - failed.length}/${results.length} 通过；截图 ${shots}`)
process.exit(failed.length ? 1 : 0)
