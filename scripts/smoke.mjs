#!/usr/bin/env node
/**
 * 冒烟测试：起一个真的 Electron（独立的用户数据目录），用 DevTools 协议把界面走一遍。
 * 先 npx electron-vite build，再 node scripts/smoke.mjs。截图放在 dist/smoke/。
 *
 * 断言全程零控制台错误、零未捕获异常。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { recordScript, fixWebmDuration, JA_SRT, ZH_SRT } from './smoke-media.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** 调试端口：被别的程序占着时用 SMOKE_PORT 换一个 */
const PORT = Number(process.env.SMOKE_PORT) || 9361
const shots = join(root, 'dist/smoke')
mkdirSync(shots, { recursive: true })
const userData = mkdtempSync(join(tmpdir(), 'qstudy-smoke-'))
// SMOKE_EXE=dist/win-unpacked/Qonsona.exe 时测打包好的程序，否则用开发构建（out/）
const exe = process.env.SMOKE_EXE ? resolve(root, process.env.SMOKE_EXE) : null
const electron = exe ?? join(root, 'node_modules/electron/dist/electron.exe')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const errors = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  ' + detail : ''}`)
}

function launch() {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  // 假麦克风（一直响的提示音）+ 不弹权限框，录音也能测
  const flags = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userData}`,
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream'
  ]
  return spawn(electron, exe ? flags : [root, ...flags], { env, stdio: 'ignore' })
}

async function connect() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {
      // 还没起来
    }
    await sleep(200)
  }
  throw new Error('连不上 DevTools 端口')
}

async function session() {
  const ws = new WebSocket(await connect())
  await new Promise((r, j) => {
    ws.onopen = r
    ws.onerror = j
  })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(
        msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text
      )
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
    }
  }
  const send = (method, params = {}) =>
    new Promise((r) => {
      const id = ++seq
      pending.set(id, r)
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', {
      expression: `(async () => { ${expr} })()`,
      awaitPromise: true,
      returnByValue: true
    })
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails))
    return r.result?.result?.value
  }
  const waitFor = async (expr, ms = 5000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (await evaluate(`return !!(${expr})`)) return true
      await sleep(100)
    }
    return false
  }
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(shots, name + '.png'), Buffer.from(r.result.data, 'base64'))
  }
  return { ws, evaluate, waitFor, shot }
}

const $ = (sel) => `document.querySelector(${JSON.stringify(sel)})`
const click = (sel) => `${$(sel)}.click()`
const navIds = `return [...document.querySelectorAll('.nav [data-nav]')].map((b) => b.dataset.nav)`

/** 把正在做的一轮练习 / 测验全答对（选择题点标着正确的那个，输入题填读音），返回成绩 */
const answerQuiz = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let n = 0; n < 200; n++) {
    await sleep(40)
    if (document.querySelector('[data-quiz-result]')) break
    const q = document.querySelector('[data-question]')
    if (!q) continue
    if (q.dataset.question === 'type') {
      const input = document.querySelector('[data-typed]')
      input.value = input.dataset.expect
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(20)
      document.querySelector('[data-check]').click()
    } else document.querySelector('[data-choice][data-correct]').click()
    await sleep(30)
    document.querySelector('[data-quiz-next]').click()
  }
  await sleep(100)
  const r = document.querySelector('[data-quiz-result]')
  return r ? { passed: r.dataset.passed !== undefined, score: r.querySelector('[data-score]')?.dataset.score } : null`

/** 把正在做的一组练习全答对（点标着正确的那一项，再点「下一题」），返回得分 */
const answerPractice = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let n = 0; n < 200; n++) {
    await sleep(40)
    if (document.querySelector('[data-practice-result]')) break
    const next = document.querySelector('[data-practice-next]')
    if (next) next.click()
    else document.querySelector('[data-choice][data-correct]')?.click()
  }
  await sleep(100)
  return document.querySelector('[data-practice-result] [data-score]')?.dataset.score ?? null`

/** 做一张模拟卷：每节逐题点对的那一项（听解最后 blank 道留空），一节一节交，最后交卷；返回成绩 */
const answerExam = (blank) => `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let k = 0; k < 8 && !document.querySelector('[data-exam-record]'); k++) {
    const section = document.querySelector('[data-exam]')?.dataset.examSection
    const n = document.querySelectorAll('[data-goto]').length
    for (let i = 0; i < n; i++) {
      document.querySelector('[data-goto="' + i + '"]').click()
      await sleep(30)
      if (!(section === 'listening' && i >= n - ${blank}))
        document.querySelector('[data-choice][data-correct]').click()
      await sleep(20)
    }
    document.querySelector('[data-finish-section]').click()
    await sleep(200)
    // 有没答的题会弹确认框
    const ok = document.querySelector('[role="dialog"] .actions .btn:last-child')
    if (ok) {
      ok.click()
      await sleep(200)
    }
  }
  await sleep(300)
  if (!document.querySelector('[data-exam-record]')) return null
  return {
    scaled: document.querySelector('[data-scaled]')?.dataset.scaled,
    passed: !!document.querySelector('[data-outcome][data-passed]'),
    review: document.querySelectorAll('[data-review]').length
  }`

/** 一段 440 Hz 的正弦波 wav（base64）：学习包里的作者录音 */
function tone(seconds) {
  const rate = 8000
  const n = Math.round(rate * seconds)
  const b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 2, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++)
    b.writeInt16LE(Math.round(6000 * Math.sin((i / rate) * 440 * 2 * Math.PI)), 44 + i * 2)
  return b.toString('base64')
}

/** 在「语言」页上模拟把文件拖进来 */
const dropFile = (name, content) => `
  const dt = new DataTransfer()
  dt.items.add(new File([${JSON.stringify(content)}], ${JSON.stringify(name)}))
  document.querySelector('.page').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))`

let app = launch()
try {
  let s = await session()
  check('启动后出现导航', await s.waitFor($('[data-nav="home"]'), 15000))

  // ── 默认是日语：八个学习模块都在 ──
  const jaNav = await s.evaluate(navIds)
  check(
    '日语：导航八个学习模块 + 语言 + 设置',
    JSON.stringify(jaNav) ===
      JSON.stringify([
        'home',
        'reading',
        'courses',
        'dictionary',
        'notebook',
        'practice',
        'media',
        'stats',
        'packs',
        'settings'
      ]),
    jaNav.join(',')
  )
  await s.shot('01-home-ja')

  // ── 首页只放新闻：上下一篇一篇滑，正中那篇占满版面、上下虚化；点击打开，返回回到这一篇；功能在底栏 ──
  check(
    '首页：新闻流里有文章（取不到 NHK 时是内置的文章），停在第一篇',
    await s.waitFor(
      `document.querySelectorAll('[data-news-feed] [data-news-item]').length >= 8 && document.querySelector('[data-news-feed]')?.dataset.active === '0'`,
      15000
    )
  )
  await s.evaluate(
    `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))`
  )
  check(
    '首页：按 ↓ 换到下一篇，上一篇虚化',
    await s.waitFor(
      `document.querySelector('[data-news-feed]')?.dataset.active === '1' && getComputedStyle(document.querySelectorAll('[data-slide]')[0].querySelector('.story')).filter.includes('blur')`,
      5000
    )
  )
  const feedKey = await s.evaluate(
    `return document.querySelector('[data-slide][aria-current]')?.dataset.newsItem`
  )
  await s.evaluate(`document.querySelector('[data-slide][aria-current] .story').click()`)
  check(
    '首页：点击正中这篇即可打开阅读',
    await s.waitFor(`document.querySelector('[data-reader="${feedKey}"]')`, 10000)
  )
  await s.evaluate(click('[data-back]'))
  check(
    '阅读器里点「返回首页」回到刚才那一篇',
    await s.waitFor(
      `document.querySelector('[data-slide][aria-current]')?.dataset.newsItem === ${JSON.stringify(feedKey)}`,
      5000
    )
  )
  check(
    '首页底栏：今日复习、下一课、练习、全部文章',
    await s.evaluate(
      `return !!(document.querySelector('[data-home-dock] [data-home-review]') && document.querySelector('[data-home-course]') && document.querySelector('[data-home-practice]') && document.querySelector('[data-news-all]'))`
    )
  )

  for (const id of jaNav) {
    await s.evaluate(click(`[data-nav="${id}"]`))
    await sleep(120)
    // 词典页没有标题，看搜索框
    const h1 = await s.evaluate(
      `return document.querySelector('.main h1')?.textContent ?? (document.querySelector('.main [data-dict-input]') ? '（搜索框）' : '')`
    )
    check(`日语：打开「${id}」`, !!h1, h1)
  }

  // ── 日语词典：变形、罗马字、汉字笔顺、例句 ──
  const typeInto = (sel, text) => `
    const el = document.querySelector(${JSON.stringify(sel)})
    el.value = ${JSON.stringify(text)}
    el.dispatchEvent(new Event('input', { bubbles: true }))`
  const firstHit = `return document.querySelector('[data-hit]')?.textContent.trim() ?? ''`
  await s.evaluate(click('[data-nav="dictionary"]'))
  await s.waitFor($('[data-dict-input]'))
  await s.evaluate(typeInto('[data-dict-input]', '食べた'))
  check(
    '查「食べた」出「食べる」并说明是过去形',
    (await s.waitFor(
      `document.querySelector('[data-entry="1358280"] [data-deinflected]')`,
      8000
    )) && (await s.evaluate(firstHit)).startsWith('食べる'),
    await s.evaluate(`return document.querySelector('[data-deinflected]')?.textContent ?? ''`)
  )
  await s.evaluate(typeInto('[data-dict-input]', 'taberu'))
  check(
    '查「taberu」出「食べる」',
    await s.waitFor(
      `document.querySelector('[data-hit]')?.textContent.trim().startsWith('食べる')`,
      8000
    )
  )
  await s.evaluate(typeInto('[data-dict-input]', 'たべる'))
  check(
    '查「たべる」出「食べる」',
    await s.waitFor(
      `document.querySelector('[data-hit]')?.textContent.trim().startsWith('食べる') && document.querySelector('[data-entry="1358280"]')`,
      8000
    )
  )
  await s.evaluate(click('[data-entry="1358280"] .head [data-pronounce]'))
  check(
    '日语词条用系统日语语音朗读',
    await s.waitFor(`document.querySelector('[data-entry="1358280"] .head [data-playing]')`, 10000)
  )
  await sleep(300)
  await s.shot('02-dict-ja')
  await s.evaluate(click('.char[data-char="食"]'))
  check(
    '点汉字看笔顺动画（9 画）',
    await s.waitFor(
      `document.querySelectorAll('[data-stroke-order] path.stroke').length === 9`,
      8000
    )
  )
  await sleep(1500)
  await s.shot('03-kanji')
  await s.evaluate(click('[data-dict-tab="sentences"]'))
  await s.evaluate(typeInto('[data-dict-input]', '食べ'))
  check(
    '例句页签列出含「食べ」的句子',
    await s.waitFor(`document.querySelectorAll('[data-example]').length > 0`, 8000)
  )
  await s.evaluate(click('[data-dict-tab="words"]'))
  await s.evaluate(click('[data-nav="courses"]'))
  await sleep(100)
  await s.waitFor($('[data-course]'), 10000)
  const jaSections = await s.evaluate(
    `return [...document.querySelectorAll('[data-course], [data-section]')].map((e) => e.dataset.course ?? e.dataset.section)`
  )
  check(
    '日语课程六块（五十音、语法、变形、会话、惯用语、民间故事）',
    jaSections.join(',') === 'alphabet,grammar,inflection,phrasebook,idioms,stories',
    jaSections.join(',')
  )

  // ── 日语阅读：文章库与难度、NHK 取不到时写明原因、振假名与下划线、点词、语法、朗读、粘贴导入 ──
  await s.evaluate(click('[data-nav="reading"]'))
  check(
    '阅读：内置 22 篇青空文库文章（8 篇短篇、14 篇民间故事），都有难度',
    await s.waitFor(
      `document.querySelectorAll('[data-article^="aozora-"]').length === 22 && [...document.querySelectorAll('[data-article^="aozora-"] .level')].every((e) => /^N[1-5]$/.test(e.textContent.trim()))`,
      60000
    ),
    await s.evaluate(
      `return [...document.querySelectorAll('[data-article] .level')].map((e) => e.textContent.trim()).join(' ')`
    )
  )
  // NHK Easy：取到了就有 NHK 的文章，取不到要写明原因（2025 年起要登录 NHK ONE，一般是后者）
  check(
    '阅读：NHK Easy 取到文章，或写明取不到的原因',
    await s.waitFor(
      `document.querySelector('[data-nhk-note]') || document.querySelector('[data-article^="nhk-"]')`,
      20000
    ),
    await s.evaluate(
      `return document.querySelector('[data-nhk-note]')?.textContent.trim().slice(0, 30) ?? 'NHK 可用'`
    )
  )
  await s.evaluate(click('[data-article="aozora-637"] .open'))
  check(
    '阅读：文章带振假名与 JLPT 下划线',
    await s.waitFor(
      `document.querySelectorAll('.w rt').length > 50 && document.querySelectorAll('.w.ul[data-jlpt]').length > 50`,
      20000
    )
  )
  await s.evaluate(`
    const w = [...document.querySelectorAll('.w')].find((e) => e.textContent.startsWith('子供'))
    w.dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
  check(
    '阅读：点词出词卡（原形、JLPT、释义）',
    await s.waitFor(`document.querySelector('[data-word-card]')?.textContent.includes('N5')`),
    await s.evaluate(
      `return document.querySelector('[data-word-card]')?.innerText.replace(/\\n+/g, ' ') ?? ''`
    )
  )
  await s.shot('10-reader-ja')
  await s.evaluate(click('[data-word-card] [data-open-dict]'))
  check(
    '阅读：从词卡跳到词典，查的就是这个词',
    await s.waitFor(
      `document.querySelector('[data-dict-input]')?.value === '子供' && document.querySelector('[data-entry="1307850"]')`,
      8000
    )
  )
  await s.evaluate(click('[data-nav="reading"]'))
  check('阅读：回来还在这篇文章', await s.waitFor($('[data-reader="aozora-637"]')))
  await s.evaluate(click('[data-ruby="romaji"]'))
  check(
    '阅读：罗马音注音',
    await s.waitFor(
      `[...document.querySelectorAll('.w rt')].some((r) => r.textContent === 'kitsune')`
    )
  )
  await s.evaluate(click('[data-ruby="furigana"]'))
  await s.evaluate(click('[data-side="grammar"]'))
  const grammarCount = await s.evaluate(`return document.querySelectorAll('[data-grammar]').length`)
  await s.evaluate(click('[data-grammar]'))
  check(
    '阅读：本文语法列出语法点，点一条原文高亮',
    grammarCount > 3 && (await s.waitFor($('.w.gfocus'))),
    `${grammarCount} 条`
  )
  await s.evaluate(click('[data-read-aloud]'))
  check('阅读：逐句朗读并高亮当前句', await s.waitFor($('.sentence.current'), 15000))
  await s.evaluate(click('[data-stop-reading]'))
  await s.evaluate(click('[data-mark-read]'))
  await s.evaluate(click('[data-back]'))
  check('阅读：读完的文章带标记', await s.waitFor($('[data-article="aozora-637"] .chip.on')))
  await s.evaluate(click('[data-paste]'))
  await s.evaluate(
    typeInto('[data-paste-body]', '私は毎日学校に行きます。学校で友達と日本語を勉強しています。')
  )
  await s.evaluate(click('[data-paste-ok]'))
  check(
    '阅读：粘贴的文章估为 N5，标题取第一句',
    await s.waitFor(
      `document.querySelector('[data-reader^="user-"] .art-head h1')?.textContent === '私は毎日学校に行きます。' && document.querySelector('.art-head .chip')?.textContent === 'N5'`,
      15000
    )
  )
  await s.evaluate(click('[data-back]'))

  // ── 生词本（日语）：词典里加入、内置 JLPT 词表、首页的今日复习、复习一张、答错再问、撤回 ──
  await s.evaluate(click('[data-nav="dictionary"]'))
  await s.waitFor($('[data-dict-input]'))
  await s.evaluate(typeInto('[data-dict-input]', '子供'))
  await s.waitFor($('[data-entry="1307850"] [data-add-notebook]'), 8000)
  await s.evaluate(click('[data-entry="1307850"] [data-add-notebook]'))
  check(
    '生词本：词典里点「加入生词本」',
    await s.waitFor($('[data-entry="1307850"] [data-in-notebook]'))
  )
  await s.evaluate(click('[data-nav="notebook"]'))
  check('生词本：「我的生词」里有这个词', await s.waitFor($('[data-card-row="ja-1307850"]')))
  check(
    '生词本：内置 JLPT N5–N1 词表写着词数',
    await s.waitFor(
      `document.querySelectorAll('[data-builtin^="jlpt-"]').length === 5 && /\\d{3}/.test(document.querySelector('[data-builtin="jlpt-5"]')?.textContent ?? '')`
    )
  )
  await s.evaluate(click('[data-add-builtin="jlpt-5"]'))
  check(
    '生词本：加入 N5 词表',
    await s.waitFor(`document.querySelectorAll('[data-card-row]').length >= 300`, 15000)
  )
  await s.evaluate(click('[data-nav="home"]'))
  await s.waitFor($('[data-home-review]'))
  const homeReview = await s.evaluate(
    `const b = document.querySelector('[data-home-review]'); return (b?.dataset.fresh ?? '') + ' | ' + (b?.title ?? '')`
  )
  check('首页底栏显示今天要复习多少', /^20 \| .*新词 20 个/.test(homeReview), homeReview)
  await s.evaluate(click('[data-home-start-review]'))
  check(
    '从首页开始今日复习，先问先加进来的词',
    await s.waitFor(`document.querySelector('[data-card] .front')?.textContent === '子供'`)
  )
  await s.evaluate(click('[data-grade="5"]'))
  check(
    '答完翻出背面：读音、释义、例句',
    await s.waitFor(
      `document.querySelector('[data-back]')?.textContent.includes('こども') && document.querySelector('[data-back] .example')`,
      8000
    )
  )
  await s.shot('13-review-ja')
  await s.evaluate(click('[data-next]'))
  await s.evaluate(click('[data-grade="0"]'))
  const progress = await s.evaluate(`return document.querySelector('[data-progress]').textContent`)
  check('答「不认识」的这一轮过几张再问一次', progress === '2 / 21', progress)
  await s.evaluate(click('[data-undo]'))
  check(
    '撤回上一题：回到没答的样子，重问的那张也拿掉',
    await s.waitFor(
      `document.querySelector('[data-progress]')?.textContent === '2 / 20' && !document.querySelector('[data-back]')`
    )
  )
  await s.evaluate(click('[data-exit]'))
  check(
    '结束后今天的新词名额少了一个',
    await s.waitFor(`/新词 19 个/.test(document.querySelector('[data-today]')?.textContent ?? '')`)
  )
  await s.evaluate(click('[data-nav="reading"]'))
  await s.waitFor($('[data-article="aozora-637"]'))
  await s.evaluate(click('[data-article="aozora-637"] .open'))
  await s.waitFor($('[data-side="vocab"]'), 20000)
  await s.evaluate(click('[data-side="vocab"]'))
  await s.waitFor($('[data-add-vocab]'))
  await s.evaluate(click('[data-add-vocab]'))
  await sleep(500)
  await s.evaluate(click('[data-back]'))
  await s.evaluate(click('[data-nav="notebook"]'))
  check(
    '阅读：本文词汇一起加进以文章为名的词本',
    await s.waitFor(
      `[...document.querySelectorAll('[data-list]')].some((e) => e.textContent.includes('手袋を買いに') && /\\d{3}/.test(e.textContent))`
    )
  )

  // ── 课程（日语）：五十音从 あ 行学起、做练习、平假名清音的单元测验；语法课 ──
  await s.evaluate(click('[data-nav="courses"]'))
  check(
    '课程：五十音、语法、变形、会话四门课都在',
    await s.waitFor(
      `${$('[data-course="alphabet"]')} && ${$('[data-course="grammar"]')} && ${$('[data-course="inflection"]')} && ${$('[data-course="phrasebook"]')}`,
      10000
    )
  )
  await s.shot('13-courses-ja')
  await s.evaluate(click('[data-course="alphabet"] [data-continue]'))
  check(
    '五十音：从 あ 行学起，五个假名加「读一读」',
    await s.waitFor(
      `document.querySelector('[data-lesson-page]')?.dataset.lessonPage === 'h1-a' && document.querySelectorAll('[data-step]').length === 6`,
      10000
    )
  )
  check(
    '五十音：认字有笔顺动画和词典里的例词',
    await s.waitFor(
      `${$('[data-stroke-order]')} && document.querySelectorAll('[data-word]').length > 0`,
      10000
    )
  )
  await s.shot('14-kana-lesson')
  await s.evaluate(click('[data-step="5"]'))
  check(
    '五十音：「读一读」的词只用 あいうえお，看完算学过',
    await s.waitFor(
      `(() => { const w = [...document.querySelectorAll('[data-read-along] [data-word]')].map((e) => e.dataset.word); return w.length > 2 && w.every((x) => /^[あいうえお]+$/.test(x)) && document.querySelector('[data-lesson-state]')?.dataset.lessonState === 'learned' })()`,
      10000
    )
  )
  await s.evaluate(click('[data-quiz-here]'))
  await s.waitFor($('[data-question]'), 10000)
  await s.shot('15-kana-quiz')
  const kanaQuiz = await s.evaluate(answerQuiz)
  check('五十音：あ 行的练习全答对，过关', kanaQuiz?.passed === true, JSON.stringify(kanaQuiz))
  // 过关后点「下一课」直接进 か 行（原来会报 Cannot read properties of null），再从课里回到课程页
  await s.evaluate(click('[data-next-lesson]'))
  check(
    '五十音：过关后点「下一课」进到 か 行，没有报错',
    await s.waitFor(
      `document.querySelector('[data-lesson-page]')?.dataset.lessonPage === 'h1-ka' && !document.querySelector('[data-quiz]')`,
      10000
    )
  )
  await s.evaluate(click('[data-lesson-page] [data-back]'))
  check(
    '五十音：课程页上 あ 行已过关，下一课是 か 行',
    await s.waitFor(
      `document.querySelector('[data-lesson="h1-a"]')?.dataset.state === 'passed' && document.querySelector('[data-continue]')?.textContent.includes('か行')`
    )
  )
  await s.evaluate(click('[data-test="h1"]'))
  await s.waitFor($('[data-question]'), 10000)
  const n1 = await s.evaluate(`return document.querySelector('[data-quiz-progress]')?.textContent`)
  const kanaTest = await s.evaluate(answerQuiz)
  check('五十音：平假名清音的单元测验（46 个）做完，通过', kanaTest?.passed === true, n1)
  await s.evaluate(click('[data-back-course]'))
  check(
    '五十音：单元测验记为通过',
    await s.waitFor(`document.querySelector('[data-test="h1"]')?.classList.contains('passed')`)
  )
  await s.evaluate(click('[data-back]'))
  await s.evaluate(click('[data-course="grammar"] [data-continue]'))
  check(
    '语法：第一课五个语法点，例句注振假名、标出语法点',
    await s.waitFor(
      `document.querySelectorAll('[data-point]').length === 5 && document.querySelectorAll('[data-grammar-mark]').length >= 5 && document.querySelector('[data-point] ruby')`,
      15000
    )
  )
  await s.shot('16-grammar-lesson')
  await s.evaluate(click('[data-quiz-here]'))
  await s.waitFor($('[data-question]'), 10000)
  const grammarQuiz = await s.evaluate(answerQuiz)
  check(
    '语法：第一课的练习（选意思、填空）全答对，过关',
    grammarQuiz?.passed === true,
    JSON.stringify(grammarQuiz)
  )
  await s.evaluate(click('[data-back-course]'))
  await s.evaluate(click('[data-nav="home"]'))
  check(
    '首页：课程卡片写着下一课',
    await s.waitFor(`document.querySelector('[data-home-course]')?.textContent.includes('か行')`)
  )

  // ── 练习（日语）：N5 汉字读法一组全答对；N5 模拟卷限时做完、出分、看解析；时间到了自动进下一节 ──
  await s.evaluate(click('[data-nav="practice"]'))
  check(
    '练习：N5 的各种题都能选，另有 N5 到 N1 的模拟卷',
    await s.waitFor(
      `document.querySelectorAll('[data-kind]').length >= 11 && [...document.querySelectorAll('[data-start-exam]')].map((e) => e.dataset.startExam).join() === 'N5,N4,N3,N2,N1'`,
      10000
    )
  )
  await s.shot('17-practice')
  await s.evaluate(click('[data-kind="kanji-reading"]'))
  await s.waitFor($('[data-question="kanji-reading"]'), 15000)
  const kanjiSet = await s.evaluate(answerPractice)
  check('练习：N5 汉字读法一组 10 题全答对', kanjiSet === '100', kanjiSet)
  await s.evaluate(click('[data-back-practice]'))
  check(
    '练习：今天做了几题记上了',
    await s.waitFor(`/10/.test(document.querySelector('[data-today]')?.textContent ?? '')`)
  )
  await s.evaluate(click('[data-start-exam="N5"]'))
  check(
    'N5 模拟卷：四节，第一节倒计时 15 分钟',
    await s.waitFor(
      `document.querySelector('[data-exam]')?.dataset.examSection === 'vocab' && /^1[45]:\\d\\d$/.test(document.querySelector('[data-timer]')?.textContent.trim() ?? '')`,
      15000
    )
  )
  await s.shot('18-exam')
  const exam = await s.evaluate(answerExam(2))
  check(
    'N5 模拟卷：听解留两道空，交卷出分 167、合格，默认只列没答的两道',
    exam?.scaled === '167' && exam.passed && exam.review === 2,
    JSON.stringify(exam)
  )
  await s.evaluate(click('[data-show-all]'))
  check(
    'N5 模拟卷：切到全部，54 道题都有解析',
    await s.waitFor(
      `document.querySelectorAll('[data-review]').length === 54 && document.querySelectorAll('[data-review] [data-explain]').length === 54`,
      5000
    )
  )
  await s.shot('19-exam-record')
  await s.evaluate(click('[data-back-practice]'))
  check(
    '做过的卷子列在练习页上',
    await s.waitFor(`document.querySelectorAll('[data-record]').length === 1`)
  )
  await s.evaluate(click('[data-start-exam="N4"]'))
  await s.waitFor(`document.querySelector('[data-exam]')?.dataset.examSection === 'vocab'`, 15000)
  // 时间快进 16 分钟：这一节时间到了，自动进下一节
  await s.evaluate(
    `const real = Date.now; Date.now = () => real() + 16 * 60 * 1000; window.__realNow = real`
  )
  check(
    'N4 模拟卷：时间到了自动进下一节',
    await s.waitFor(
      `document.querySelector('[data-exam]')?.dataset.examSection === 'grammar'`,
      5000
    )
  )
  await s.evaluate(`Date.now = window.__realNow`)
  await s.evaluate(click('[data-exam-quit]'))
  await s.waitFor($('[role="dialog"]'))
  await s.evaluate(click('[role="dialog"] .btn.danger'))
  check(
    'N4 模拟卷：中途退出不留成绩',
    await s.waitFor(
      `${$('[data-start-exam="N4"]')} && document.querySelectorAll('[data-record]').length === 1`
    )
  )

  // ── 文章库的主题、双语对照、本文练习；语法课 N5–N1；故事课；词典的「语法」页签；主题词本 ──
  await s.evaluate(click('[data-nav="reading"]'))
  await s.waitFor($('[data-topics]'), 10000)
  await s.evaluate(click('[data-topic="folktale"]'))
  check(
    '文章库：按主题筛出 14 篇民间故事',
    await s.waitFor(
      `document.querySelectorAll('[data-article]').length === 14 && [...document.querySelectorAll('[data-article]')].every((e) => e.dataset.article.startsWith('aozora-'))`,
      5000
    )
  )
  await s.evaluate(click('[data-topic=""]'))
  await s.waitFor($('[data-article^="user-"] .open'), 5000)
  await s.evaluate(click('[data-article^="user-"] .open'))
  await s.waitFor($('[data-reader^="user-"] .para'), 15000)
  await s.evaluate(click('[data-bilingual]'))
  await s.waitFor($('[data-translation-editor]'), 5000)
  await s.evaluate(typeInto('[data-translation-input]', '我每天去学校。和朋友一起在学校学日语。'))
  await s.evaluate(click('[data-translation-save]'))
  check(
    '阅读：贴上译文后双语对照，每段原文下面是译文',
    await s.waitFor(
      `document.querySelector('[data-tr="0"]')?.textContent.startsWith('我每天去学校') && document.querySelector('[data-bilingual]').getAttribute('aria-pressed') === 'true'`,
      5000
    )
  )
  await s.evaluate(click('[data-bilingual]'))
  check('阅读：再点一下收起译文', await s.waitFor(`!document.querySelector('[data-tr]')`, 3000))
  await s.evaluate(click('[data-back]'))
  check(
    '文章库：加了译文的文章标着「有译文」',
    await s.waitFor($('[data-article^="user-"] [data-translated]'), 5000)
  )

  await s.evaluate(click('[data-nav="courses"]'))
  // 课程页记着上次停在哪一课：先一步步退回课程列表
  await s.evaluate(`
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    for (let n = 0; n < 4 && document.querySelector('[data-course-page], [data-lesson-page]'); n++) {
      document.querySelector('[data-back]')?.click()
      await sleep(150)
    }`)
  await s.waitFor($('[data-course="grammar"] [data-open-course]'), 10000)
  await s.evaluate(click('[data-course="grammar"] [data-open-course]'))
  check(
    '语法课：N5 到 N1 五个单元，每个单元都有课',
    await s.waitFor(
      `[...document.querySelectorAll('[data-unit]')].map((e) => e.dataset.unit).join() === 'n5,n4,n3,n2,n1' && [...document.querySelectorAll('[data-unit]')].every((u) => u.querySelectorAll('[data-lesson]').length > 0)`,
      5000
    )
  )
  await s.evaluate(click('[data-unit="n1"] [data-lesson]'))
  check(
    '语法课：N1 的一课有讲解与例句',
    await s.waitFor(
      `document.querySelectorAll('[data-point]').length >= 3 && document.querySelectorAll('[data-point] [data-example]').length >= 9`,
      8000
    )
  )
  await s.evaluate(click('[data-back]'))
  await s.evaluate(click('[data-back]'))
  await s.waitFor($('[data-course="stories"] [data-open-course]'), 5000)
  await s.evaluate(click('[data-course="stories"] [data-open-course]'))
  check(
    '故事课：14 课，一课一篇民间故事',
    await s.waitFor(`document.querySelectorAll('[data-lesson]').length === 14`, 5000)
  )
  await s.evaluate(click('[data-lesson="tale-18335"]'))
  await s.waitFor($('[data-read-text]'), 5000)
  await s.evaluate(click('[data-read-text]'))
  check(
    '故事课：点击「阅读这一篇」在阅读器里打开，返回键写着「返回课程」',
    await s.waitFor(
      `document.querySelector('[data-reader="aozora-18335"] .para') && /课程/.test(document.querySelector('[data-back]')?.textContent ?? '')`,
      15000
    )
  )
  await s.evaluate(click('[data-back]'))
  check(
    '故事课：从阅读器回到这一课',
    await s.waitFor($('[data-lesson-page="tale-18335"] [data-practice-text]'), 5000)
  )
  await s.evaluate(click('[data-practice-text]'))
  await s.waitFor($('[data-practice-run="article"] [data-question]'), 20000)
  const tale = await s.evaluate(answerPractice)
  check('故事课：本文练习 10 题全答对', tale === '100', tale)
  await s.evaluate(click('[data-back-course]'))
  check(
    '故事课：本文练习过关，这一课记为过关',
    await s.waitFor(
      `document.querySelector('[data-lesson-page="tale-18335"] [data-lesson-state]')?.dataset.lessonState === 'passed'`,
      5000
    )
  )
  await s.evaluate(click('[data-back]'))
  await s.evaluate(click('[data-back]'))
  await s.waitFor($('[data-course="idioms"] [data-open-course]'), 5000)
  await s.evaluate(click('[data-course="idioms"] [data-open-course]'))
  await s.waitFor($('[data-lesson]'), 5000)
  await s.evaluate(click('[data-lesson]'))
  check(
    '惯用语课：一课五到七条，带读音与意思',
    await s.waitFor(
      `document.querySelectorAll('[data-phrase]').length >= 5 && [...document.querySelectorAll('[data-phrase]')].every((e) => e.querySelector('.reading') && e.querySelector('.meaning')?.textContent.trim())`,
      5000
    )
  )
  await s.evaluate(click('[data-back]'))
  await s.evaluate(click('[data-back]'))

  await s.evaluate(click('[data-nav="dictionary"]'))
  await s.waitFor($('[data-dict-tab="grammar"]'))
  await s.evaluate(click('[data-dict-tab="grammar"]'))
  await s.evaluate(typeInto('[data-dict-input]', 'たびに'))
  check(
    '词典「语法」页签：查「たびに」出 N3 的〜たびに，讲解里有例句',
    await s.waitFor(
      `document.querySelector('[data-grammar-hit="tabini"]') && document.querySelectorAll('[data-grammar-detail="tabini"] [data-example]').length >= 3`,
      8000
    )
  )
  await s.evaluate(typeInto('[data-dict-input]', '若いうちに旅行したほうがいいと思う。'))
  check(
    '词典「语法」页签：输入一句日语，列出句中的语法',
    await s.waitFor(
      `['uchini', 'hougaii', 'toomou'].every((id) => document.querySelector('[data-grammar-hit="' + id + '"]'))`,
      8000
    )
  )
  await s.evaluate(click('[data-grammar-hit="uchini"]'))
  await s.waitFor($('[data-grammar-detail="uchini"] [data-grammar-lesson]'), 5000)
  await s.evaluate(click('[data-grammar-detail="uchini"] [data-grammar-lesson]'))
  check(
    '词典「语法」页签：点击「在语法课里学」跳到那一课',
    await s.waitFor($('[data-lesson-page] [data-point="uchini"]'), 8000)
  )
  await s.evaluate(click('[data-nav="dictionary"]'))
  await s.waitFor($('[data-dict-tab="words"]'))
  await s.evaluate(typeInto('[data-dict-input]', ''))
  await s.evaluate(click('[data-dict-tab="words"]'))

  // 日日词典与中文维基词典：有 wikt.sqlite（node scripts/data/wiktionary-ja.mjs 生成）时词条下面有这两栏
  if (existsSync(join(root, 'resources/data/ja/wikt.sqlite'))) {
    await s.evaluate(typeInto('[data-dict-input]', '食べる'))
    check(
      '词典：「食べる」下面有日日词典（日语释义）与中文维基词典两栏，带原页链接',
      await s.waitFor(
        `document.querySelector('[data-entry="1358280"] [data-wikt="ja"] li') && document.querySelector('[data-entry="1358280"] [data-wikt="zh"] li') && document.querySelector('[data-wikt="ja"] a[href^="https://ja.wiktionary.org/wiki/"]')`,
        8000
      )
    )
    await s.evaluate(typeInto('[data-dict-input]', ''))
  }

  // 手写查字：在画板上横着画一笔，候选里有「一」，点击它接到查询框里
  await s.evaluate(click('[data-handwriting-toggle]'))
  await s.waitFor($('[data-handwriting-canvas]'), 5000)
  await s.evaluate(`
    const c = document.querySelector('[data-handwriting-canvas]')
    const r = c.getBoundingClientRect()
    const fire = (type, x, y) =>
      c.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX: r.left + x, clientY: r.top + y }))
    fire('pointerdown', 40, 132)
    for (let x = 50; x <= 220; x += 10) fire('pointermove', x, 130 + (x % 3))
    fire('pointerup', 220, 131)`)
  check(
    '手写查字：横着画一笔，候选的前五个里有「一」',
    await s.waitFor(
      `[...document.querySelectorAll('[data-candidate]')].slice(0, 5).some((b) => b.dataset.candidate === '一')`,
      10000
    ),
    await s.evaluate(
      `return [...document.querySelectorAll('[data-candidate]')].slice(0, 8).map((b) => b.dataset.candidate).join('')`
    )
  )
  await s.evaluate(click('[data-candidate="一"]'))
  check(
    '手写查字：点击候选字接到查询框里，画板清空',
    await s.waitFor(
      `document.querySelector('[data-dict-input]')?.value === '一' && !document.querySelector('[data-candidate]')`,
      5000
    )
  )
  await s.evaluate(click('[data-handwriting-toggle]'))
  await s.evaluate(typeInto('[data-dict-input]', ''))

  await s.evaluate(click('[data-nav="notebook"]'))
  check(
    '生词本：主题词本（动物、天气……）写着词数',
    await s.waitFor(
      `document.querySelectorAll('[data-builtin^="theme-"]').length >= 20 && /[0-9]/.test(document.querySelector('[data-builtin="theme-animals"]')?.textContent ?? '')`,
      5000
    )
  )
  await s.evaluate(click('[data-add-builtin="theme-animals"]'))
  check(
    '生词本：加入「动物」主题词本',
    await s.waitFor(`document.querySelectorAll('[data-card-row]').length >= 30`, 10000)
  )

  // ── 视听（日语）：录一段测试视频配两份字幕；当前句注振假名、译文对齐，下一句、每句后暂停、点词查词 ──
  const clip = await s.evaluate(recordScript(12))
  const mediaDir = join(userData, 'smoke-media')
  mkdirSync(mediaDir, { recursive: true })
  const videoPath = join(mediaDir, 'テスト動画.webm')
  writeFileSync(videoPath, fixWebmDuration(Buffer.from(clip, 'base64'), 12000))
  writeFileSync(join(mediaDir, 'ep.ja.srt'), JA_SRT)
  writeFileSync(join(mediaDir, 'ep.zh.srt'), ZH_SRT)
  const [clipItem] = await s.evaluate(
    `return await window.qstudy.invoke('media:addPaths', ${JSON.stringify([videoPath])})`
  )
  const clipSubs = await s.evaluate(
    `return await window.qstudy.invoke('media:addSubtitlePaths', ${JSON.stringify(clipItem?.id)}, ${JSON.stringify([join(mediaDir, 'ep.ja.srt'), join(mediaDir, 'ep.zh.srt')])})`
  )
  check(
    '视听：视频加进媒体库，两份字幕各 4 句',
    clipSubs?.item?.subtitles.map((x) => x.cues).join() === '4,4',
    JSON.stringify(clipSubs?.failed)
  )
  await s.evaluate(click('[data-nav="media"]'))
  await s.waitFor($(`[data-open-media="${clipItem?.id}"]`), 5000)
  await s.evaluate(click(`[data-open-media="${clipItem?.id}"]`))
  check(
    '视听：播放器读到视频时长 12 秒',
    await s.waitFor(`Math.round(document.querySelector('[data-video]')?.duration) === 12`, 10000)
  )
  await s.evaluate(click('[data-play]'))
  check(
    '视听：放到第一句，字幕注振假名，译文对齐',
    await s.waitFor(
      `document.querySelector('[data-current-cue]')?.dataset.currentCue === '0' && document.querySelector('[data-line] ruby') && document.querySelector('[data-line2]')?.textContent === '今天天气真好啊。'`,
      8000
    )
  )
  await s.shot('20-player')
  await s.evaluate(click('[data-next-cue]'))
  check(
    '视听：「下一句」跳到第二句',
    await s.waitFor(
      `document.querySelector('[data-current-cue]')?.dataset.currentCue === '1'`,
      3000
    )
  )
  await s.evaluate(click('[data-auto-pause]'))
  check(
    '视听：每句后暂停，停在第二句末尾',
    await s.waitFor(
      `document.querySelector('[data-video]').paused && document.querySelector('[data-video]').currentTime > 5 && document.querySelector('[data-current-cue]')?.dataset.currentCue === '1'`,
      6000
    )
  )
  await s.evaluate(click('[data-auto-pause]'))
  await s.evaluate(`document.querySelector('[data-line] [data-word]').click()`)
  check('视听：点字幕里的词出词卡', await s.waitFor($('[data-word-card]'), 5000))
  await s.evaluate(`document.body.click()`)
  await s.evaluate(click('[data-back-library]'))
  check(
    '视听：媒体库记下看到哪里',
    await s.waitFor($(`[data-media-item="${clipItem?.id}"] .bar span`), 5000)
  )

  // ── 统计：今天学过（连续 1 天）、练习题数、学过的语法点、最近 30 天的图 ──
  await s.evaluate(click('[data-nav="stats"]'))
  check(
    '统计：连续 1 天，练习 74 题（含本文练习 10 题），语法点 5 个，30 天的图',
    await s.waitFor(
      `document.querySelector('[data-tile="streak"] .num')?.textContent.trim() === '1 天' && document.querySelector('[data-tile="practice"] .num')?.textContent.trim() === '74' && document.querySelector('[data-tile="grammar"] .num')?.textContent.trim() === '5' && document.querySelectorAll('[data-chart] [data-day]').length === 30`,
      5000
    ),
    await s.evaluate(
      `return [...document.querySelectorAll('[data-tile] .num')].map((e) => e.textContent.trim()).join(' | ')`
    )
  )
  await s.shot('21-stats')

  // ── 拖进千语集示例项目 Aelith ──
  await s.evaluate(click('[data-nav="packs"]'))
  await sleep(100)
  const aelith = readFileSync(join(root, 'tests/fixtures/qonlang/Aelith.laim.json'), 'utf8')
  await s.evaluate(dropFile('Aelith.laim.json', aelith))
  check('拖入后出现导入面板', await s.waitFor($('[data-importer]')))
  const langs = await s.evaluate(
    `return [...document.querySelectorAll('[data-importer] .lang')].map((l) => l.textContent.trim().split(/\\s+/)[0])`
  )
  check('列出项目里的三门语言', langs.join(',') === 'Proto-Aelith,Aelith,Merun', langs.join(','))
  await s.shot('02-import-panel')
  await s.evaluate(click('[data-confirm-import]'))
  const imported = await s.waitFor(
    `document.querySelectorAll('[data-pack-card^="qon-"]').length === 3`
  )
  check('三门语言各成一个学习包', imported)

  // 学 Aelith
  await s.evaluate(`
    const card = [...document.querySelectorAll('[data-pack-card^="qon-"]')]
      .find((c) => c.querySelector('strong')?.textContent === 'Aelith')
    card.querySelector('[data-use]').click()`)
  await sleep(300)
  const aeNav = await s.evaluate(navIds)
  check(
    'Aelith：没有视听模块',
    !aeNav.includes('media') && aeNav.includes('courses'),
    aeNav.join(',')
  )

  await s.evaluate(click('[data-nav="home"]'))
  await s.waitFor($('[data-about]'))
  await s.evaluate(click('[data-about]'))
  check('首页「关于这门语言」里有样例', await s.waitFor($('[data-about-panel] [data-sample]')))
  const sample = await s.evaluate(
    `return [...document.querySelectorAll('[data-sample] .script-line')].map((e) => e.textContent)`
  )
  check(
    '样例用自造文字写了一遍',
    sample.length > 0 && [...sample[0]].some((ch) => ch.codePointAt(0) > 0x7f),
    sample.join(' | ')
  )
  const stats = await s.evaluate(
    `return [...document.querySelectorAll('[data-stat]')].map((e) => e.dataset.stat)`
  )
  check(
    '「关于这门语言」列出词条、例句、短语等数目',
    stats.includes('lexemes') && stats.includes('phrases'),
    stats.join(',')
  )
  await sleep(300)
  await s.shot('03-home-aelith')

  // ── 按词频分级 ──
  const levels = await s.evaluate(
    `return [...document.querySelectorAll('[data-level]')].map((e) => e.textContent.replace(/\\s+/g, ''))`
  )
  check('「关于这门语言」列出按词频分的几级与词数', levels.length === 3, levels.join(' '))

  // ── 发音：系统语音读 IPA → 录音 → 录音优先 ──
  await s.evaluate(click('[data-sample] [data-pronounce]'))
  check(
    '点喇叭用系统语音读出 IPA',
    await s.waitFor($('[data-sample] [data-pronounce][data-playing]'), 10000)
  )
  // 原文里的撇号、引号带进音标也能读（以前系统语音报「音素“'”无效」，整句读不出来）
  const apostrophe = await s.evaluate(`
    const voices = await window.qstudy.invoke('speech:voices')
    const voice = voices.find((v) => v.culture.startsWith('en'))?.name ?? ''
    const r = await window.qstudy.invoke('speech:speak', { content: "ˈkin'en ‘kaso’, sen?", ipa: true, voice, rate: 0 })
    return { ok: !!r.wav, dropped: r.dropped, error: r.error ?? '' }`)
  check(
    '音标里有撇号、引号、问号也读得出，不提示读不出',
    apostrophe.ok && apostrophe.dropped.length === 0,
    JSON.stringify(apostrophe)
  )
  await s.evaluate(click('[data-sample] [data-record]'))
  check('点话筒开始录音', await s.waitFor($('[data-sample] [data-record].rec')))
  await sleep(1200)
  await s.evaluate(click('[data-sample] [data-record]'))
  check('再点一下停止并存下录音', await s.waitFor($('[data-sample] [data-has-recording]'), 5000))
  const source = await s.evaluate(
    `return document.querySelector('[data-sample] [data-pronounce]').dataset.source`
  )
  check('有录音后喇叭先放录音', source === 'recording', source)
  // 等系统语音那一段放完，不然这一下是「停止」
  await s.waitFor(`!document.querySelector('[data-sample] [data-pronounce][data-playing]')`, 10000)
  await s.evaluate(click('[data-sample] [data-pronounce]'))
  check('放得出录音', await s.waitFor($('[data-sample] [data-pronounce][data-playing]'), 5000))

  await s.evaluate(click('[data-nav="courses"]'))
  await sleep(100)
  await s.waitFor($('[data-course]'), 10000)
  const project = JSON.parse(aelith)
  const ae = project.languages.find((l) => l.abbr === 'ae')
  const aeDocs = project.docs.filter((d) => d.languageId === ae.id || d.languageId === null).length
  const aeSections = await s.evaluate(
    `return [...document.querySelectorAll('[data-course], [data-section]')].map((e) => (e.dataset.course ?? e.dataset.section) + ':' + (e.querySelector('[data-course-progress]')?.textContent.trim() ?? ''))`
  )
  check(
    'Aelith 课程：字母、文档（语法）、变形、会话四门课',
    aeSections.length === 4 &&
      aeSections[0].startsWith('alphabet:') &&
      aeSections[1] === `grammar:已过关 0 / ${aeDocs} 课` &&
      /^inflection:已过关 0 \/ \d+ 课$/.test(aeSections[2]) &&
      /^phrasebook:已过关 0 \/ \d+ 课$/.test(aeSections[3]),
    aeSections.join(' / ')
  )
  await s.shot('04-courses-aelith')

  // ── Aelith 的词典：按屈折形查到原词、自造文字、语素 ──
  await s.evaluate(click('[data-nav="dictionary"]'))
  await s.waitFor($('[data-dict-input]'))
  const kaso = project.lexemes.find((l) => l.lemma === 'kaso')
  const kasoForm = Object.values(kaso.forms).find((f) => f.surface && f.surface !== 'kaso').surface
  await s.evaluate(typeInto('[data-dict-input]', kasoForm))
  check(
    `Aelith：查屈折形「${kasoForm}」出「kaso」`,
    await s.waitFor(`document.querySelector('[data-entry="${kaso.id}"]')`, 5000),
    await s.evaluate(`return document.querySelector('.note-line')?.textContent ?? ''`)
  )
  check(
    'Aelith：词条上有自造文字与词形变化表',
    await s.waitFor(
      `document.querySelector('[data-entry] .script') && document.querySelector('[data-entry] .forms')`
    )
  )
  await sleep(300)
  await s.shot('05-dict-aelith')
  await s.evaluate(click('[data-dict-tab="characters"]'))
  await s.evaluate(typeInto('[data-dict-input]', ''))
  check(
    'Aelith：「语素」页签列出语素',
    await s.waitFor(`document.querySelectorAll('[data-morpheme]').length > 0`)
  )
  await s.evaluate(click('[data-dict-tab="words"]'))

  // ── Aelith 的阅读：例句按出处分篇，逐词对照、自造文字、IPA，点词出词卡 ──
  await s.evaluate(click('[data-nav="reading"]'))
  check(
    'Aelith 阅读：例句按出处分篇',
    await s.waitFor(`document.querySelectorAll('[data-qon-text^="source-"]').length > 1`)
  )
  await s.evaluate(click('[data-qon-text^="source-"]'))
  check(
    'Aelith 阅读：逐词对照带 gloss，下面有自造文字与 IPA',
    await s.waitFor(
      `document.querySelector('[data-line] .qw .g') && document.querySelector('[data-line] .script') && document.querySelector('[data-line] .ipa')`
    ),
    await s.evaluate(
      `return document.querySelector('[data-line]')?.innerText.replace(/\\n+/g, ' / ') ?? ''`
    )
  )
  await s.evaluate(
    `document.querySelector('[data-line] .qw[data-lex]:not([data-lex=""])').dispatchEvent(new MouseEvent('click', { bubbles: true }))`
  )
  check('Aelith 阅读：点词出词卡', await s.waitFor($('[data-word-card]')))
  await s.shot('11-reader-aelith')
  await s.evaluate(click('[data-back]'))

  // ── 生词本（Aelith）：按词频分的几级是内置词本；闪卡 ──
  await s.evaluate(click('[data-nav="notebook"]'))
  check(
    'Aelith 生词本：按词频分的级是内置词本',
    await s.waitFor(`document.querySelectorAll('[data-builtin^="level-"]').length === 3`)
  )
  await s.evaluate(click('[data-add-builtin="level-L1"]'))
  check(
    'Aelith 生词本：加入一级（7 个词）',
    await s.waitFor(`document.querySelectorAll('[data-card-row]').length === 7`)
  )
  await s.evaluate(click('[data-drill]'))
  await s.waitFor($('[data-card]'))
  await s.evaluate(click('[data-grade="5"]'))
  check(
    'Aelith 闪卡：背面有 IPA、自造文字与释义',
    await s.waitFor(
      `document.querySelector('[data-back] .reading')?.textContent.startsWith('[') && document.querySelector('[data-back] .script')`
    )
  )
  await s.evaluate(click('[data-exit]'))

  // ── 课程（Aelith）：字母与发音、刻文两个单元，作者的文档做语法课 ──
  await s.evaluate(click('[data-nav="courses"]'))
  await s.waitFor($('[data-course="alphabet"]'), 10000)
  check('Aelith 课程：文档成了语法课', await s.waitFor($('[data-course="grammar"]')))
  await s.evaluate(click('[data-course="alphabet"] [data-open-course]'))
  check(
    'Aelith 课程：字母与发音、刻文两个单元',
    await s.waitFor(
      `document.querySelector('[data-unit="letters"]') && document.querySelectorAll('[data-unit^="script-"]').length === 1`
    )
  )
  await s.evaluate(`document.querySelector('[data-unit^="script-"] [data-lesson]').click()`)
  check(
    'Aelith 刻文：认字显示符文与转写',
    await s.waitFor(
      `document.querySelector('[data-step="0"]')?.textContent === 'ᚨ' && document.querySelector('[data-reading]')?.textContent === 'a'`,
      10000
    )
  )
  await s.evaluate(click('[data-start-quiz]'))
  await s.waitFor($('[data-question]'), 10000)
  const runeQuiz = await s.evaluate(answerQuiz)
  check('Aelith 刻文：第一课练习全答对，过关', runeQuiz?.passed === true, JSON.stringify(runeQuiz))
  await s.evaluate(click('[data-back-course]'))

  // ── 练习（Aelith）：按词库、构形、例句出题；按词频分的级可选，没有模拟卷 ──
  await s.evaluate(click('[data-nav="practice"]'))
  check(
    'Aelith 练习：有变形题、句子题，级别是「全部」加三级，没有模拟卷',
    await s.waitFor(
      `${$('[data-kind="conjugate"]')} && ${$('[data-kind="sentence"]')} && document.querySelectorAll('[data-level]').length === 4 && !document.querySelector('[data-exams]')`,
      10000
    )
  )
  await s.evaluate(click('[data-kind="meaning-word"]'))
  await s.waitFor($('[data-question="meaning-word"]'), 5000)
  const aeSet = await s.evaluate(answerPractice)
  check('Aelith 练习：由义选词一组全答对', aeSet === '100', aeSet)
  await s.evaluate(click('[data-back-practice]'))
  await s.waitFor($('[data-kind="sound-change"]'), 5000)
  await s.evaluate(click('[data-kind="sound-change"]'))
  check(
    'Aelith 练习：音变题，题面是原始语的形式（*kasu 这样），选项是推到 Aelith 的形式',
    await s.waitFor(
      `document.querySelector('[data-question="sound-change"] [data-prompt]')?.textContent.trim().startsWith('*') && document.querySelectorAll('[data-question="sound-change"] [data-choice]').length === 4`,
      5000
    )
  )
  // 不答就退出（不计入今天做的题）
  await s.evaluate(click('[data-practice-exit]'))

  // ── 换到 Merun：强调色跟着换，琥珀色底上用深字 ──
  const usePack = (name) => `
    const card = [...document.querySelectorAll('[data-pack-card^="qon-"]')]
      .find((c) => c.querySelector('strong')?.textContent === ${JSON.stringify(name)})
    card.querySelector('[data-use]').click()`
  const cssVar = (v) => `return document.documentElement.style.getPropertyValue('${v}').trim()`
  await s.evaluate(click('[data-nav="packs"]'))
  await sleep(100)
  await s.evaluate(usePack('Merun'))
  await sleep(300)
  const mr = project.languages.find((l) => l.abbr === 'mr')
  const accent = await s.evaluate(cssVar('--accent'))
  check(
    '强调色换成语言的颜色',
    accent.toLowerCase() === mr.color.toLowerCase(),
    `${accent} / ${mr.color}`
  )
  const contrast = await s.evaluate(cssVar('--accent-contrast'))
  check('琥珀色按钮上用深色字', contrast === '#1f1f1f', contrast)
  await s.shot('05-packs-merun')
  await s.evaluate(usePack('Aelith'))
  await sleep(300)

  // ── 纯欣赏副本、坏文件给出说明 ──
  await s.evaluate(dropFile('x.laim.json', 'QONLANG-VIEW:1:AAAA'))
  check(
    '纯欣赏副本给出说明',
    await s.waitFor(`document.querySelector('.toast.error')?.textContent.includes('纯欣赏')`)
  )

  // ── 移除 Merun（走确认框） ──
  await s.evaluate(`
    const card = [...document.querySelectorAll('[data-pack-card^="qon-"]')]
      .find((c) => c.querySelector('strong')?.textContent === 'Merun')
    card.querySelector('.btn.danger').click()`)
  check('移除前弹确认框', await s.waitFor($('[role="dialog"]')))
  await s.evaluate(click('[role="dialog"] .btn.danger'))
  check(
    '移除后剩两个',
    await s.waitFor(`document.querySelectorAll('[data-pack-card^="qon-"]').length === 2`)
  )

  // ── 界面语言、明暗 ──
  await s.evaluate(click('[data-nav="settings"]'))
  await sleep(100)
  await s.evaluate(`
    const sel = document.querySelector('[data-setting="locale"]')
    sel.value = 'en'
    sel.dispatchEvent(new Event('change', { bubbles: true }))`)
  check(
    '切到英文界面',
    await s.waitFor(`document.querySelector('[data-nav="home"]')?.textContent.trim() === 'Home'`)
  )
  await s.evaluate(click('[data-theme-option="dark"]'))
  check('切到深色', await s.waitFor(`document.documentElement.dataset.theme === 'dark'`))
  await s.evaluate(click('[data-nav="home"]'))
  await sleep(300)
  await s.shot('06-home-aelith-en-dark')

  // ── 重启：偏好和学习包都还在 ──
  s.ws.close()
  app.kill()
  await sleep(1500)
  app = launch()
  s = await session()
  check('重启后出现导航', await s.waitFor($('[data-nav="home"]'), 15000))
  check(
    '重启后仍是英文',
    await s.waitFor(`document.querySelector('[data-nav="home"]')?.textContent.trim() === 'Home'`)
  )
  check('重启后仍是深色', await s.waitFor(`document.documentElement.dataset.theme === 'dark'`))
  const name = await s.evaluate(
    `return document.querySelector('[data-switcher] .name')?.textContent`
  )
  check('重启后仍在学 Aelith', name === 'Aelith', name)
  check(
    '重启后生词本还在，首页照样显示今日复习',
    // 这时界面已经换成英文了
    await s.waitFor(`document.querySelector('[data-home-review]')?.dataset.fresh === '6'`)
  )
  await s.evaluate(click('[data-about]'))
  check('重启后首页样例还在', await s.waitFor($('[data-sample]')))
  check(
    '重启后课程进度还在（Aelith 刻文第一课过关）',
    (await s.waitFor(
      `/^Next lesson/.test(document.querySelector('[data-home-course]')?.textContent.trim() ?? '')`
    )) &&
      (await (async () => {
        await s.evaluate(click('[data-nav="courses"]'))
        return s.waitFor(
          `/^1 of \\d+ lessons passed/.test(document.querySelector('[data-course="alphabet"] [data-course-progress]')?.textContent.trim() ?? '')`,
          10000
        )
      })())
  )
  await s.evaluate(click('[data-nav="practice"]'))
  check(
    '重启后练习记录还在（Aelith 今天做了 10 题）',
    await s.waitFor(
      `/\\b10 answered/.test(document.querySelector('[data-today]')?.textContent ?? '')`,
      5000
    )
  )
  await s.evaluate(click('[data-nav="home"]'))
  await s.waitFor($('[data-about]'))
  await s.evaluate(click('[data-about]'))
  check('重启后录音还在', await s.waitFor($('[data-sample] [data-has-recording]')))
  await s.evaluate(click('[data-sample] [data-remove-recording]'))
  await s.waitFor($('[role="dialog"]'))
  await s.evaluate(click('[role="dialog"] .btn.danger'))
  check(
    '删除录音后改回系统语音',
    await s.waitFor(
      `document.querySelector('[data-sample] [data-pronounce]')?.dataset.source === 'tts'`
    )
  )
  // ── 千语集「导出学习包」出的 .qstudy.json：作者没勾的语言、介绍、藏起来的词、作者录音 ──
  const aeLang = project.languages.find((l) => l.abbr === 'ae')
  const teli = project.lexemes.find((l) => l.lemma === 'teli')
  const firstPhrase = project.phrasebook.find((p) => p.languageId === aeLang.id && p.text.trim())
  const isAe = (l) => l.id === aeLang.id
  const aeDoc = project.docs.find((d) => d.languageId === aeLang.id)
  const aeSentence = project.sentences.find((x) => x.languageId === aeLang.id)
  const lesson = {
    id: 'smoke-l1',
    title: 'Lesson one',
    docId: aeDoc.id,
    lexemeIds: [kaso.id],
    sentenceIds: [aeSentence.id],
    phraseIds: [firstPhrase.id]
  }
  const studyPack = {
    format: 'qonlang-study-pack',
    version: 1,
    exportedAt: new Date().toISOString(),
    qonlangVersion: '0.12.4',
    study: {
      projectId: project.meta.id,
      author: 'Smoke Author',
      updatedAt: new Date().toISOString(),
      languages: project.languages.map((l) => ({
        languageId: l.id,
        include: isAe(l),
        title: '',
        intro: isAe(l) ? '# Hello\n\nWelcome to **Aelith**.' : '',
        lessons: isAe(l) ? [lesson] : [],
        hidden: { lexemeIds: isAe(l) ? [teli.id] : [], sentenceIds: [], phraseIds: [], docIds: [] },
        levels: {},
        display: { orthographyId: null, scriptId: null, showIpa: true },
        audio: isAe(l)
          ? {
              [`phrase-${firstPhrase.id}`]: {
                dataUrl: 'data:audio/wav;base64,' + tone(0.6),
                name: 'a.wav'
              }
            }
          : {}
      }))
    },
    project
  }
  await s.evaluate(click('[data-nav="packs"]'))
  await sleep(200)
  await s.evaluate(dropFile('Aelith.qstudy.json', JSON.stringify(studyPack)))
  check('学习包：导入面板写明是学习包', await s.waitFor($('[data-study-note]')))
  const ticked = await s.evaluate(
    `return [...document.querySelectorAll('[data-importer] .lang input')].map((i) => i.checked)`
  )
  check(
    '学习包：作者没勾的语言默认不勾',
    JSON.stringify(ticked) === '[false,true,false]',
    JSON.stringify(ticked)
  )
  await s.shot('08-import-study-pack')
  await s.evaluate(click('[data-confirm-import]'))
  check(
    '学习包：卡片写着作者、录音与隐藏',
    await s.waitFor(
      `[...document.querySelectorAll('[data-pack-study]')].some((e) => e.textContent.includes('Smoke Author') && /1/.test(e.textContent))`
    )
  )
  await s.evaluate(click('[data-nav="home"]'))
  await s.waitFor($('[data-about]'))
  await s.evaluate(click('[data-about]'))
  check(
    '学习包：首页「关于这门语言」里有作者写的介绍',
    await s.waitFor(`document.querySelector('[data-intro] h2')?.textContent === 'Hello'`)
  )
  check(
    '学习包：样例放作者录音',
    await s.waitFor(
      `document.querySelector('[data-sample] [data-pronounce]')?.dataset.source === 'author' && document.querySelector('[data-sample] [data-author-audio]')`
    )
  )
  await s.evaluate(click('[data-sample] [data-pronounce]'))
  check(
    '学习包：作者录音放得出来',
    await s.waitFor(`document.querySelector('[data-sample] [data-pronounce][data-playing]')`, 3000)
  )
  await s.shot('09-home-study-pack')
  await s.evaluate(click('[data-nav="dictionary"]'))
  await s.waitFor($('[data-dict-input]'))
  await s.evaluate(click('[data-dict-tab="words"]'))
  await s.evaluate(typeInto('[data-dict-input]', 'teli'))
  await sleep(500)
  const teliShown = await s.evaluate(
    `return !!document.querySelector('[data-hit="${teli.id}"], [data-entry="${teli.id}"]')`
  )
  const others = await s.evaluate(`return document.querySelectorAll('[data-hit]').length`)
  check('学习包：藏起来的词查不到', !teliShown && others > 0, `其余命中 ${others} 条`)
  await s.evaluate(click('[data-nav="reading"]'))
  check(
    '学习包：阅读按作者排的课',
    await s.waitFor(
      `document.querySelector('[data-qon-text="lesson-smoke-l1"]')?.textContent.includes('Lesson one')`
    )
  )
  await s.evaluate(click('[data-qon-text="lesson-smoke-l1"]'))
  check(
    '学习包：课文带文档、本课新词、例句与短语',
    await s.waitFor(
      `document.querySelector('[data-lesson-doc]') && document.querySelectorAll('[data-line]').length === 2 && document.querySelector('.nw')`
    )
  )
  await s.shot('12-lesson-study-pack')
  await s.evaluate(click('[data-add-lesson]'))
  await sleep(300)
  await s.evaluate(click('[data-back]'))
  await s.evaluate(click('[data-nav="notebook"]'))
  check(
    '学习包：本课新词加进生词本，跟内置词本里的那一课是同一个',
    await s.waitFor(
      `[...document.querySelectorAll('[data-list]')].some((e) => e.textContent.includes('Lesson one')) && document.querySelector('[data-builtin="lesson-smoke-l1"]') && !document.querySelector('[data-add-builtin="lesson-smoke-l1"]')`
    )
  )

  await s.evaluate(click('[data-nav="settings"]'))
  await s.waitFor($('[data-setting="ipaVoice"]'), 10000)
  const voices = await s.evaluate(
    `return document.querySelectorAll('[data-setting="ipaVoice"] option').length`
  )
  check('设置里能挑读 IPA 的声音', voices > 1, `${voices - 1} 个声音`)
  check(
    '设置里有导出备份、从备份恢复',
    await s.evaluate(
      `return !!document.querySelector('[data-backup-export]') && !!document.querySelector('[data-backup-restore]')`
    )
  )
  // 检查更新：默认开着、20 分钟一次；「立即检查更新」点了要写出结果（连不上、仓库还没有发布也算，只要不卡在「检查中」）
  check(
    '检查更新默认开着、每 20 分钟',
    await s.evaluate(
      `return document.querySelector('[data-setting="checkUpdates"]')?.checked === true && document.querySelector('[data-setting="updateCheckMinutes"]')?.value === '20'`
    )
  )
  await s.evaluate(click('[data-check-update]'))
  check(
    '立即检查更新写出结果',
    await s.waitFor(
      `(() => { const t = document.querySelector('[data-update-result]')?.textContent.trim() ?? ''; return t !== '' && !/^Checking/.test(t) })()`,
      30000
    ),
    await s.evaluate(`return document.querySelector('[data-update-result]')?.textContent.trim()`)
  )
  await s.shot('07-settings')
  s.ws.close()
} catch (e) {
  check('没有中途出错', false, String(e?.stack ?? e))
} finally {
  app.kill()
  await sleep(800)
  rmSync(userData, { recursive: true, force: true })
}

check('零控制台错误', errors.length === 0, errors.join(' | '))
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 通过；截图在 ${shots}`)
process.exit(failed.length ? 1 : 0)
