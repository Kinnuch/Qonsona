/** Isolated Electron UI acceptance; source fixtures only, no user projects or OS control. */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.SMOKE_PORT) || 9487
const profile = mkdtempSync(join(tmpdir(), 'qonsona-reader-quiz-'))
const output = join(root, 'dist/smoke-reader-quiz')
mkdirSync(output, { recursive: true })
writeFileSync(
  join(profile, 'prefs.json'),
  JSON.stringify({ locale: 'zh', checkUpdates: false, nhkEasy: false })
)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(
  process.env.SMOKE_EXE || join(root, 'node_modules/electron/dist/electron.exe'),
  [
    ...(process.env.SMOKE_EXE ? [] : [root]),
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ],
  { env, stdio: ['ignore', 'pipe', 'pipe'] }
)
const errors = [],
  results = [],
  logs = []
child.stdout.on('data', (x) => logs.push(String(x)))
child.stderr.on('data', (x) => logs.push(String(x)))
child.on('error', (error) => errors.push(String(error)))
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let ws, evaluate, shot
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) throw new Error(`${name}: ${JSON.stringify(detail)}`)
}
try {
  let url
  for (let i = 0; i < 150 && !url; i++) {
    try {
      url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (t) => t.type === 'page'
      )?.webSocketDebuggerUrl
    } catch {
      /* starting */
    }
    if (child.exitCode !== null) throw Error(`Electron exited ${child.exitCode}`)
    if (!url) await sleep(200)
  }
  if (!url) throw Error('DevTools did not start')
  ws = new WebSocket(url)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id) {
      pending.get(message.id)?.(message)
      pending.delete(message.id)
    } else if (message.method === 'Runtime.exceptionThrown')
      errors.push(
        message.params.exceptionDetails.exception?.description ??
          message.params.exceptionDetails.text
      )
    else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')
      errors.push(message.params.args.map((a) => a.value ?? a.description).join(' '))
  }
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq,
        timer = setTimeout(() => {
          pending.delete(id)
          reject(Error(`CDP timeout ${method}`))
        }, 30000)
      pending.set(id, (m) => {
        clearTimeout(timer)
        m.error ? reject(Error(JSON.stringify(m.error))) : resolve(m.result)
      })
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression: `(async()=>{${expression}})()`,
      awaitPromise: true,
      returnByValue: true
    })
    if (result.exceptionDetails)
      throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result?.value
  }
  const wait = async (expression, timeout = 30000) => {
    const end = Date.now() + timeout
    do {
      if (await evaluate(`return !!(${expression})`)) return true
      await sleep(100)
    } while (Date.now() < end)
    return false
  }
  const click = (selector) =>
    evaluate(
      `const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.click()`
    )
  const input = (selector, value) =>
    evaluate(
      `const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}))`
    )
  shot = async (name) => {
    const result = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(output, `${name}.png`), Buffer.from(result.data, 'base64'))
  }
  check('app starts', await wait('document.querySelector("[data-nav=reading]")'))
  const sources = {
    ja: '今日は天気がいいです。友達と学校へ行きます。\n\n学校で本を読みます。先生は新しい言葉を教えます。\n\n家に帰ってご飯を食べます。明日も勉強します。',
    en: 'The children go to school. Their teacher reads a book.\n\nThe children eat lunch in the garden. The garden has a green tree.\n\nThey return home in the evening. The parents make dinner.',
    fr: 'Les enfants vont à l’école. Le professeur lit un livre.\n\nLes enfants mangent dans le jardin. Un arbre est grand.\n\nIls rentrent à la maison. Le père prépare le dîner.',
    es: 'Los niños van a la escuela. La profesora lee un libro.\n\nLos niños comen en el jardín. El árbol es grande.\n\nVuelven a casa por la tarde. La madre prepara la cena.',
    ko: '아이들은 학교에 갑니다. 선생님은 책을 읽습니다.\n\n아이들은 정원에서 밥을 먹습니다. 나무는 큽니다.\n\n아이들은 집으로 돌아갑니다. 어머니는 저녁을 만듭니다.',
    ar: 'يذهب الأطفال إلى المدرسة. يقرأ المعلم كتابا.\n\nيأكل الأطفال في الحديقة. الشجرة كبيرة.\n\nيعود الأطفال إلى البيت. الأم تحضر الطعام.',
    ru: 'Дети идут в школу. Учитель читает книгу.\n\nДети едят в саду. Дерево большое.\n\nДети возвращаются домой. Мама готовит ужин.',
    gd: 'Tha am bàta mòr. Tha an athair aig an taigh.\n\nTha a’ chlann anns an sgoil. Tha an leabhar beag.\n\nTha a’ mhàthair anns a’ ghàrradh. Tha an latha math.'
  }
  for (const code of ['qya', 'sjn'])
    sources[code] = JSON.parse(readFileSync(join(root, `data/${code}/texts.json`), 'utf8'))[0].text
  async function exercise(pack, id) {
    check(
      `${pack} completion opens tasks`,
      await wait('document.querySelector("[data-reading-finish]:not([disabled])")')
    )
    await click('[data-reading-finish]')
    check(
      `${pack} generated after reading`,
      await wait(
        'document.querySelector("[data-article-quiz-question] [data-choice][data-correct]:not([disabled])")'
      )
    )
    const counts = await evaluate('return document.querySelector("[data-quiz-counts]").innerText')
    check(
      `${pack} clearly separates vocabulary/reading`,
      /词汇|vocabulary/i.test(counts) && /阅读|reading/i.test(counts),
      counts
    )
    check(`${pack} reading tasks exist`, Number(counts.match(/\d+/g)?.[1]) > 0, counts)
    await click('[data-article-quiz-question] [data-choice][data-correct]:not([disabled])')
    check(
      `${pack} answer reveals evidence`,
      await wait(
        'document.querySelector("[data-article-quiz-next]:not([disabled])") && /原文依据：|Source evidence:|Evidence in the (?:supplied text|source):/.test(document.querySelector("[data-article-quiz] [data-explain]")?.innerText??"")'
      )
    )
    const saved = await evaluate(
      `return await window.qstudy.invoke('articleQuiz:load',${JSON.stringify(pack)},${JSON.stringify(id)})`
    )
    check(`${pack} actual on-disk answer`, saved?.answers.length === 1)
    await click('[data-article-quiz-exit]')
    check(
      `${pack} exits without losing progress`,
      await wait('!document.querySelector("[data-article-quiz]")')
    )
    await click('[data-reading-finish]')
    check(
      `${pack} resume after exit`,
      await wait(
        'document.querySelector("[data-article-quiz-question]") && !document.querySelector("[data-reading-finish]").disabled'
      )
    )
    // Resume starts at the next unanswered question, or preserves the final revealed answer.
    for (let n = 0; n < 15; n++) {
      if (await evaluate('return !!document.querySelector("[data-article-quiz-result]")')) break
      if (
        await evaluate(
          'return !!document.querySelector("[data-article-quiz-question] [data-choice]:not([disabled])")'
        )
      ) {
        await click('[data-article-quiz-question] [data-choice][data-correct]')
        check(
          `${pack} question ${n} saved`,
          await wait('document.querySelector("[data-article-quiz-next]:not([disabled])")')
        )
      }
      await click('[data-article-quiz-next]')
      await sleep(130)
    }
    check(`${pack} finishes`, await wait('document.querySelector("[data-article-quiz-result]")'))
    const completed = await evaluate(
      `return await window.qstudy.invoke('articleQuiz:load',${JSON.stringify(pack)},${JSON.stringify(id)})`
    )
    check(
      `${pack} complete correct answers and history saved`,
      completed?.completed &&
        completed.history.length === 1 &&
        completed.history[0].right === completed.history[0].total
    )
    await shot(`${pack}-result`)
    await click('[data-article-quiz-redo]')
    check(
      `${pack} redo creates empty current attempt`,
      await wait(
        'document.querySelector("[data-article-quiz-question] [data-choice]:not([disabled])")'
      )
    )
    const redo = await evaluate(
      `return await window.qstudy.invoke('articleQuiz:load',${JSON.stringify(pack)},${JSON.stringify(id)})`
    )
    check(
      `${pack} redo preserves previous completion`,
      !redo.completed && redo.answers.length === 0 && redo.history.length === 1
    )
  }
  for (const [code, body] of Object.entries(process.env.SMOKE_QON_ONLY ? {} : sources)) {
    await click('[data-switcher]')
    await click(`[data-pack="${code}"]`)
    await click('[data-nav=reading]')
    check(`${code} reader library ready`, await wait('document.querySelector("[data-paste]")'))
    await click('[data-paste]')
    await input('[data-paste-form] input', `QA ${code} source`)
    await input('[data-paste-body]', body)
    await click(code === 'ja' ? '[data-paste-ok]' : '[data-import]')
    check(
      `${code} fixture opened`,
      await wait('document.querySelector("[data-reader-completion]")')
    )
    const id = await evaluate(
      `return document.querySelector('[data-reading-finish]').closest('article')?.querySelector('[data-article-quiz]')?.dataset.articleQuiz ?? null`
    )
    // Start once to obtain the current reader's material key, then exercise the saved flow.
    await click('[data-reading-finish]')
    check(`${code} material id`, await wait('document.querySelector("[data-article-quiz]")'))
    const materialId =
      id ??
      (await evaluate('return document.querySelector("[data-article-quiz]").dataset.articleQuiz'))
    await click('[data-article-quiz-exit]')
    await exercise(code, materialId)
  }
  // Public repository fixture, never the user's project.
  await click('[data-nav=packs]')
  check(
    'Qon package import page ready',
    await wait('document.querySelector("[data-import]")?.closest(".page[role=region]")')
  )
  const fixture = readFileSync(join(root, 'tests/fixtures/qonlang/Aelith.laim.json'), 'utf8')
  await evaluate(
    `const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(fixture)}],'Aelith.laim.json',{type:'application/json'}));const page=document.querySelector('[data-import]').closest('.page');page.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}))`
  )
  check('Qon fixture importer', await wait('document.querySelector("[data-confirm-import]")'))
  await click('[data-confirm-import]')
  check('Qon fixture imported', await wait('document.querySelector("[data-pack-card^=qon-]")'))
  const qonPack = await evaluate(
    'return [...document.querySelectorAll("[data-pack-card^=qon-]")].find(e=>e.innerText.includes("Aelith")&&!e.innerText.includes("Proto-Aelith"))?.dataset.packCard'
  )
  check('Qon fixture language', !!qonPack)
  await click('[data-switcher]')
  await click(`[data-pack="${qonPack}"]`)
  await click('[data-nav=reading]')
  check('Qon source reading available', await wait('document.querySelector("[data-qon-text]")'))
  const project = JSON.parse(fixture)
  const language = project.languages.find((l) => l.name === 'Aelith')
  const sourceCounts = new Map()
  for (const sentence of project.sentences.filter((s) => s.languageId === language.id))
    sourceCounts.set(sentence.source.trim(), (sourceCounts.get(sentence.source.trim()) ?? 0) + 1)
  const richestSource = [...sourceCounts].sort((a, b) => b[1] - a[1])[0][0]
  await click(`[data-qon-text="source-${richestSource}"]`)
  await click('[data-reading-finish]')
  check('Qon after-reading material', await wait('document.querySelector("[data-article-quiz]")'))
  const qonId = await evaluate(
    'return document.querySelector("[data-article-quiz]").dataset.articleQuiz'
  )
  await click('[data-article-quiz-exit]')
  await exercise(qonPack, qonId)
  check('no renderer exceptions or console errors', !errors.length, errors)
} catch (error) {
  results.push({ name: 'smoke execution', ok: false, detail: String(error.stack ?? error) })
  console.error(error)
  try {
    if (evaluate)
      writeFileSync(
        join(output, 'failure-ui.txt'),
        await evaluate('return document.body.innerText')
      )
    await shot?.('failure')
  } catch {
    /* original error */
  }
} finally {
  ws?.close()
  child.kill()
  writeFileSync(join(output, 'electron.log'), logs.join(''))
  writeFileSync(
    join(output, 'results.json'),
    JSON.stringify(
      { results, errors, profile, port, qonOnly: !!process.env.SMOKE_QON_ONLY },
      null,
      2
    )
  )
}
console.log(`Artifacts: ${output}; isolated profile: ${profile}`)
process.exitCode = results.some((r) => !r.ok) || errors.length ? 1 : 0
