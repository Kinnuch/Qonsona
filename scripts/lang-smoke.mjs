#!/usr/bin/env node
/**
 * 框架语言（英、法、韩、西、阿、俄、盖尔）的冒烟测试：起一个真的 Electron（独立的用户数据目录），
 * 每门有词典数据的语言切过去走一遍——词典（原形、变形）、阅读（内置课文、点词出词卡）、生词本的内置词本、
 * 课程、练习（做一组看词选意思）。先 npx electron-vite build，再：
 *
 *   node scripts/lang-smoke.mjs            全部有数据的语言
 *   node scripts/lang-smoke.mjs fr,ru      只测这几门
 *
 * 截图在 dist/lang-smoke/。断言全程零控制台错误、零未捕获异常。端口默认 9391（LANG_SMOKE_PORT 可换）。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.LANG_SMOKE_PORT) || 9391
const shots = join(root, 'dist/lang-smoke')
mkdirSync(shots, { recursive: true })
const userData = mkdtempSync(join(tmpdir(), 'qonsona-lang-smoke-'))
const electron = join(root, 'node_modules/electron/dist/electron.exe')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 每门语言查哪个词、哪个变形（变形应当找回原形） */
const SAMPLES = {
  en: { word: 'house', form: 'went', lemma: 'go' },
  fr: { word: 'maison', form: 'chevaux', lemma: 'cheval' },
  ko: { word: '집', form: '먹었어요', lemma: '먹다' },
  es: { word: 'casa', form: 'tengo', lemma: 'tener' },
  ar: { word: 'بيت', form: 'والكتاب', lemma: 'كتاب' },
  ru: { word: 'дом', form: 'книги', lemma: 'книга' },
  gd: { word: 'taigh', form: 'thaigh', lemma: 'taigh' }
}

const want = process.argv[2]?.split(',').filter(Boolean)
const codes = Object.keys(SAMPLES).filter(
  (c) => (!want || want.includes(c)) && existsSync(join(root, 'resources/data', c, 'dict.sqlite'))
)

const results = []
const errors = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  ' + detail : ''}`)
}

function launch() {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  return spawn(electron, [root, `--remote-debugging-port=${PORT}`, `--user-data-dir=${userData}`], {
    env,
    stdio: 'ignore'
  })
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
const typeInto = (sel, text) => `
  const el = document.querySelector(${JSON.stringify(sel)})
  el.value = ${JSON.stringify(text)}
  el.dispatchEvent(new Event('input', { bubbles: true }))`
const navIds = `return [...document.querySelectorAll('.nav [data-nav]')].map((b) => b.dataset.nav)`
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

if (!codes.length) {
  console.log('没有可测的语言（resources/data/<代码>/dict.sqlite 都不在）')
  process.exit(1)
}

const app = launch()
try {
  const s = await session()
  check('启动后出现导航', await s.waitFor($('[data-nav="home"]'), 15000))

  for (const code of codes) {
    const sample = SAMPLES[code]
    // 切到这门语言
    await s.evaluate(click('[data-nav="packs"]'))
    const listed = await s.waitFor($(`[data-use="${code}"]`), 5000)
    if (!listed) {
      check(`${code}：语言页里有「开始学」按钮`, false)
      continue
    }
    await s.evaluate(click(`[data-use="${code}"]`))
    await sleep(400)
    const nav = await s.evaluate(navIds)
    check(`${code}：切换后有词典`, nav.includes('dictionary'), nav.join(','))

    // 词典：原形、变形
    await s.evaluate(click('[data-nav="dictionary"]'))
    await s.waitFor($('[data-dict-input]'))
    const nodata = await s.evaluate(`return !!${$('[data-lex-nodata]')}`)
    check(`${code}：词典数据装上了`, !nodata)
    await s.evaluate(typeInto('[data-dict-input]', sample.word))
    const hit = await s.waitFor(
      `document.querySelector('[data-hit]') && document.querySelector('[data-entry] [data-headword]')`,
      8000
    )
    const head = await s.evaluate(
      `return document.querySelector('[data-entry] [data-headword]')?.textContent.trim() ?? ''`
    )
    check(`${code}：查「${sample.word}」出词条`, hit, head)
    await s.shot(`${code}-1-dict`)
    await s.evaluate(typeInto('[data-dict-input]', sample.form))
    // 比较前去掉重音符号、阿拉伯语元音符号（词头显示的是带记号的写法：кни́га、كِتَاب）
    const bare = `((t) => t.normalize('NFD').replace(new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + String.fromCharCode(0x64b) + '-' + String.fromCharCode(0x65f) + String.fromCharCode(0x670) + ']', 'g'), '').normalize('NFC'))`
    const formOk = await s.waitFor(
      `[...document.querySelectorAll('[data-hit]')].slice(0, 3).some((h) => ${bare}(h.textContent).includes(${bare}(${JSON.stringify(sample.lemma)})))`,
      8000
    )
    check(
      `${code}：查变形「${sample.form}」找回「${sample.lemma}」`,
      formOk,
      await s.evaluate(
        `return [...document.querySelectorAll('[data-hit]')].slice(0, 3).map((h) => h.textContent.trim().slice(0, 30)).join(' | ')`
      )
    )

    // 阅读：内置课文
    if (nav.includes('reading')) {
      await s.evaluate(click('[data-nav="reading"]'))
      const arts = await s.waitFor($('[data-lex-library] [data-article]'), 10000)
      check(`${code}：阅读里有文章`, arts)
      if (arts) {
        await s.evaluate(
          `document.querySelector('[data-lex-library] [data-article] button, [data-lex-library] [data-article] a')?.click() ?? document.querySelector('[data-lex-library] [data-article]').click()`
        )
        const words = await s.waitFor(
          `document.querySelectorAll('[data-lex-reader] [data-w]').length >= 10`,
          15000
        )
        check(`${code}：打开一篇，正文切成词`, words)
        if (words) {
          await s.evaluate(
            `[...document.querySelectorAll('[data-lex-reader] [data-w]')].find((e) => e.dataset.lv !== undefined)?.click() ?? document.querySelector('[data-lex-reader] [data-w]').click()`
          )
          check(`${code}：点词出词卡`, await s.waitFor($('[data-word-card]'), 5000))
          await s.shot(`${code}-2-reader`)
          await s.evaluate(`document.body.click()`)
          await s.evaluate(`document.querySelector('[data-lex-reader] [data-back]')?.click()`)
        }
      }
    }

    // 生词本：内置词本（主分级各级）
    await s.evaluate(click('[data-nav="notebook"]'))
    const books = await s.waitFor(`document.querySelectorAll('[data-builtin]').length >= 3`, 8000)
    check(
      `${code}：生词本有内置词本`,
      books,
      String(await s.evaluate(`return document.querySelectorAll('[data-builtin]').length`))
    )
    await s.shot(`${code}-3-notebook`)

    // 课程
    if (nav.includes('courses')) {
      await s.evaluate(click('[data-nav="courses"]'))
      await sleep(500)
      check(`${code}：课程页打开`, await s.waitFor(`document.querySelector('.main h1')`, 5000))
      await s.shot(`${code}-4-courses`)
    }

    // 练习：看词选意思一组
    await s.evaluate(click('[data-nav="practice"]'))
    const kinds = await s.waitFor($('[data-kind="word-meaning"]'), 8000)
    check(
      `${code}：练习里有看词选意思`,
      kinds,
      await s.evaluate(
        `return [...document.querySelectorAll('[data-kind]')].map((e) => e.dataset.kind).join(',')`
      )
    )
    if (kinds) {
      await s.evaluate(click('[data-count="10"]'))
      await s.evaluate(click('[data-kind="word-meaning"]'))
      const score = await s.evaluate(answerPractice)
      check(`${code}：一组看词选意思全答对`, score !== null, String(score))
      await s.shot(`${code}-5-practice`)
      await s.evaluate(`document.querySelector('[data-back-practice]')?.click()`)
    }
  }
  s.ws.close()
} catch (e) {
  check('没有中途出错', false, String(e?.stack ?? e))
} finally {
  app.kill()
  await sleep(800)
  rmSync(userData, { recursive: true, force: true })
}

check('零控制台错误', errors.length === 0, errors.slice(0, 5).join(' | '))
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 通过；截图在 ${shots}`)
process.exit(failed.length ? 1 : 0)
