/** Isolated real API + built desktop smoke. Set VITE_QON_TEST_MODE=1 at build and QON_TEST_MODE=1 at launch. */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const profile = mkdtempSync(join(tmpdir(), 'qonsona-collection-accounts-'))
const output = join(root, 'dist/smoke-accounts')
mkdirSync(output, { recursive: true })
const port = Number(process.env.SMOKE_PORT) || 9492
const apiPort = Number(process.env.SMOKE_API_PORT) || 18787
const apiBase = process.env.SMOKE_API_BASE || `http://127.0.0.1:${apiPort}/v1`
if (!['127.0.0.1', 'localhost'].includes(new URL(apiBase).hostname))
  throw new Error('Smoke only accepts its own local API or an explicit localhost tunnel')
const results = [],
  errors = [],
  diagnostics = []
let server,
  child,
  ws,
  seq = 0
const pending = new Map(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) throw new Error(name)
}
const prefs = {
  activePackId: 'en',
  locale: 'en',
  theme: 'light',
  nhkEasy: false,
  checkUpdates: false,
  relearn: false
}
writeFileSync(join(profile, 'prefs.json'), JSON.stringify(prefs))
writeFileSync(
  join(profile, 'stats.json'),
  JSON.stringify({
    version: 1,
    days: {},
    rewards: {
      version: 1,
      startedAt: Date.now() - 86400000,
      days: {
        '2026-10-12': {
          seconds: 300,
          claimed: [5],
          completions: [
            {
              kind: 'reading',
              id: 'earlier-article',
              packId: 'en',
              at: Date.parse('2026-10-12T12:00:00+08:00')
            }
          ]
        }
      },
      unlocked: {
        'companion-1': {
          day: '2026-10-12',
          at: Date.parse('2026-10-12T12:00:00+08:00'),
          minutes: 5
        }
      }
    }
  })
)
const env = { ...process.env, QON_TEST_MODE: '1', QON_ACCOUNT_API_BASE: apiBase }
delete env.ELECTRON_RUN_AS_NODE
function launch() {
  writeFileSync(join(profile, 'native-close-control.json'), JSON.stringify({ close: false }))
  child = spawn(
    process.env.SMOKE_EXE || join(root, 'node_modules/electron/dist/electron.exe'),
    [
      ...(process.env.SMOKE_EXE ? [] : [join(root, 'scripts/close-smoke-bootstrap.cjs')]),
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${port}`
    ],
    { cwd: root, env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }
  )
  child.stderr.on('data', (d) => diagnostics.push(String(d)))
  child.on('error', (e) => diagnostics.push(String(e)))
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq,
      timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('CDP timeout ' + method))
      }, 20000)
    pending.set(id, (m) => {
      clearTimeout(timer)
      m.error ? reject(new Error(m.error.message)) : resolve(m.result)
    })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function connect() {
  let url
  for (let i = 0; i < 150 && !url; i++) {
    try {
      url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (t) => t.type === 'page'
      )?.webSocketDebuggerUrl
    } catch {
      /* The isolated app is still starting. */
    }
    if (!url) await sleep(100)
  }
  if (!url) throw new Error('No isolated DevTools page')
  ws = new WebSocket(url)
  await new Promise((r, j) => {
    ws.onopen = r
    ws.onerror = j
  })
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id) {
      pending.get(m.id)?.(m)
      pending.delete(m.id)
    } else if (m.method === 'Runtime.exceptionThrown')
      errors.push(
        m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text
      )
  }
  await send('Runtime.enable')
  await send('Page.enable')
}
async function evaluate(code) {
  const r = await send('Runtime.evaluate', {
    expression: `(async()=>{${code}})()`,
    returnByValue: true,
    awaitPromise: true
  })
  if (r.exceptionDetails)
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result?.value
}
async function wait(expr, ms = 20000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await evaluate(`return !!(${expr})`)) return true
    await sleep(80)
  }
  return false
}
const click = (selector) =>
  evaluate(
    `const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing ${selector}');el.click()`
  )
const input = (selector, value) =>
  evaluate(
    `const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing input');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))`
  )
const snapshot = () =>
  evaluate(`return await window.qstudy.invoke('account:request','collection',{})`)
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(output, name + '.png'), Buffer.from(r.data, 'base64'))
}
async function close() {
  if (!child || child.exitCode !== null) return
  const done = new Promise((r) => child.once('exit', () => r(true)))
  if (process.env.SMOKE_EXE) await evaluate('window.close()').catch(() => {})
  else
    writeFileSync(
      join(profile, 'native-close-control.json'),
      JSON.stringify({ close: true, id: String(Date.now()) })
    )
  check(
    'isolated native close completes',
    await Promise.race([done, sleep(12000).then(() => false)])
  )
  ws?.close()
  ws = null
}
try {
  if (!process.env.SMOKE_API_BASE) {
    server = spawn(process.execPath, [join(root, 'server/index.mjs')], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        QON_DB: join(profile, 'api.sqlite'),
        QON_HOST: '127.0.0.1',
        QON_PORT: String(apiPort),
        QON_TEST_GRANTS: '1'
      },
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    })
    server.stderr.on('data', (d) => diagnostics.push(String(d)))
  }
  let ready = false
  for (let i = 0; i < 100 && !ready; i++) {
    try {
      ready = (await (await fetch(apiBase + '/health')).json()).testing.grantsEnabled
    } catch {
      /* The isolated API is still starting. */
    }
    if (!ready) await sleep(100)
  }
  check('real test API grants capability', ready)
  launch()
  await connect()
  check(
    'app has collection navigation',
    await wait('document.querySelector("[data-nav=collection]")')
  )
  await click('[data-nav=collection]')
  check(
    'guest collection requires login',
    await wait(
      'document.querySelector("[data-account-panel]") && !document.querySelector("[data-wallet]")'
    )
  )
  await click('[data-account-mode=register]')
  const username = 'qa_' + Date.now().toString(36),
    password = 'Isolated-QA-' + crypto.randomUUID()
  await input('[data-account-username]', username)
  await input('[data-account-register-nickname]', 'QA Reader')
  await input('[data-account-password]', password)
  await evaluate('document.querySelector("[data-account-submit]").closest("form").requestSubmit()')
  check('UI registers on real server', await wait('document.querySelector("[data-wallet]")'))
  const session = await evaluate(`return await window.qstudy.invoke('account:session')`)
  check(
    'session exposes identity and test capability but no bearer',
    !!session.user && session.server.testcap && !('token' in session) && !('token' in session.user)
  )
  const before = await snapshot()
  check(
    'fresh account wallet starts empty',
    before.balances.points === 0 && before.balances.tickets.learning === 0
  )
  check(
    'new account joins global rankings by default',
    before.user.publicCollection &&
      before.user.publicTime &&
      before.user.rankVisibility === 'global'
  )
  check(
    'twenty ordinary companions and separate month reward',
    before.catalog.filter((c) => !c.special).length === 20 &&
      before.catalog.some((c) => c.special === 'monthly')
  )
  for (const id of ['gallery', 'tasks', 'shop', 'draw', 'bag']) {
    await click(`[data-collection-tab=${id}]`)
    check(
      'collection tab ' + id,
      await evaluate(
        `return document.querySelector('[data-collection-tab=${id}]').getAttribute('aria-current')==='page'`
      )
    )
  }
  await click('[data-collection-tab=tasks]')
  check(
    'three server task-plan cards',
    await evaluate(`return document.querySelectorAll('[data-task]').length===3`)
  )
  await click('[data-nav=dictionary]')
  check('real dictionary search field', await wait('document.querySelector("input[type=search]")'))
  await input('input[type=search]', 'kinnuch')
  await evaluate(
    `document.querySelector('input[type=search]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`
  )
  check(
    'dictionary test command grants 100 learning tickets',
    await wait(`document.body.textContent.includes('100 test tickets granted')`)
  )
  let grant = await snapshot()
  check('server grant exactly 100', grant.balances.tickets.learning === 100)
  await evaluate(
    `document.querySelector('input[type=search]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`
  )
  await sleep(300)
  check(
    'repeat dictionary command grants another 100 tickets',
    (await snapshot()).balances.tickets.learning === 200
  )
  await click('[data-nav=collection]')
  await click('[data-collection-tab=draw]')
  await click('[data-draw-ten]')
  check(
    'draw opens spending confirmation',
    await wait('document.querySelector("[data-transaction-confirm]")')
  )
  await click('[data-transaction-cancel]')
  check('cancel leaves tickets untouched', (await snapshot()).balances.tickets.learning === 200)
  await click('[data-draw-ten]')
  await click('[data-transaction-confirm]')
  check(
    'UI shows ten genuine server outcomes',
    await wait('document.querySelectorAll("[data-draw-result]").length===10')
  )
  const after = await snapshot()
  check('ten draw debits exactly ten tickets', after.balances.tickets.learning === 190)
  check(
    'display wallet equals server',
    await evaluate(
      `return Number(document.querySelector('[data-learning-tickets]').textContent)===190`
    )
  )
  await sleep(4300)
  await evaluate(`document.querySelector('[data-draw-results]').scrollIntoView({block:'start'})`)
  await shot('draw-results')
  await click('[data-collection-tab=gallery]')
  await evaluate(`document.querySelector('[data-collection]').scrollIntoView({block:'start'})`)
  await shot('gallery-wide')
  await evaluate(`document.querySelector('.memorial').open=true`)
  check(
    'local memorial import action available',
    await wait(
      'document.querySelector("[data-legacy-sync]") && !document.querySelector("[data-legacy-sync]").disabled'
    )
  )
  await click('[data-legacy-sync]')
  await click('[data-transaction-confirm]')
  check(
    'legacy sync is recorded',
    await wait('document.querySelector(".memorial").textContent.includes("2026-10-12")')
  )
  const legacy = await snapshot()
  check(
    'legacy does not mint currency or current collection',
    legacy.legacy.length === 1 &&
      legacy.balances.points === after.balances.points &&
      legacy.balances.tickets.learning === 190 &&
      legacy.characters.length === after.characters.length
  )
  for (const [dot, type] of [
    [1, 'discount'],
    [2, 'popular'],
    [0, 'new']
  ]) {
    await click(`[data-gallery-dot="${dot}"]`)
    check(
      'gallery manual slide ' + type,
      await wait(`document.querySelector('[data-gallery-type="${type}"]')`)
    )
  }
  check(
    'month calendar has genuine required day count',
    (legacy.monthly?.requiredDays ?? 0) >= 28 && !legacy.monthly?.claimed
  )
  await click('[data-collection-tab=shop]')
  check(
    'direct redemption starts with tier entries',
    await wait(`document.querySelectorAll('[data-shop-tier]').length===2`)
  )
  await click('[data-shop-tier=A]')
  check(
    'tier shop cards include actual companion pictures',
    await wait(
      `Array.from(document.querySelectorAll('[data-shop-item^="character:"]')).every(e=>e.closest('.shop-product').querySelector('[data-companion-sprite]')) && document.querySelector('[data-shop-item^="character:"]')`
    )
  )
  check(
    'one authoritative A/R offer is half price',
    legacy.shop.filter((item) => item.discount === 0.5 && item.price === item.originalPrice / 2)
      .length === 1
  )
  await click('[data-collection-tab=gallery]')
  const ownedId = legacy.characters[0].id
  const ownedCharacter = legacy.catalog.find((c) => c.id === ownedId)
  await click(`[data-species="${ownedCharacter.speciesId}"]`)
  check(
    'species opens individual entries',
    await wait(`document.querySelector('[data-entry="${ownedId}"]')`)
  )
  await click(`[data-entry="${ownedId}"]`)
  check(
    'biography remains three blank author fields',
    await evaluate(
      `return document.querySelector('[data-companion-biography]').textContent.match(/Not written yet/g)?.length===3`
    )
  )
  check(
    'experience has five book markers',
    await evaluate(`return document.querySelectorAll('[data-companion-milestone]').length===5`)
  )
  await click(`[data-companion-select="${ownedId}"]`)
  check(
    'owned companion appears in reserved sidebar space',
    await wait(`document.querySelector('[data-companion-dock="${ownedId}"]')`)
  )
  check(
    'default companion does not cover settings',
    await evaluate(
      `return document.querySelector('[data-nav=settings]').getBoundingClientRect().bottom <= document.querySelector('[data-companion-space]').getBoundingClientRect().top+1`
    )
  )
  await click('[data-nav=practice]')
  check(
    'actual practice choices available',
    await wait(`document.querySelector('[data-kind]:not(:disabled)')`)
  )
  await evaluate(
    `const choices=Array.from(document.querySelectorAll('[data-kind]:not(:disabled)'));(choices.find(e=>/vocab|meaning/.test(e.dataset.kind))??choices[0]).click()`
  )
  check(
    'real objective practice question',
    await wait(`document.querySelector('[data-choice][data-correct]')`)
  )
  await click('[data-choice][data-correct]')
  check(
    'correct question displays English and Chinese encouragement',
    await wait(
      `document.querySelector('[data-companion-message=answer]')?.textContent.includes('Well done') && document.querySelector('[data-companion-message=answer]')?.textContent.includes('做得好')`
    )
  )
  check(
    'first objective correct answer adds five XP',
    await wait(
      `document.querySelector('[data-companion-message=answer]')?.textContent.includes('+5 XP')`
    )
  )
  let growth = await snapshot()
  check(
    'cloud XP binds to selected companion',
    growth.companion.currentId === ownedId &&
      growth.companion.progress.find((p) => p.characterId === ownedId).xp === 5
  )
  await shot('real-question-encouragement')
  await evaluate(
    `document.querySelector('[data-companion-drag]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`
  )
  check(
    'companion position can be moved with keyboard',
    await evaluate(
      `return document.querySelector('[data-companion-dock]').classList.contains('floating')`
    )
  )
  await click('[data-companion-options]')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 800,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false
  })
  await sleep(200)
  check(
    'expanded floating companion remains inside viewport',
    await evaluate(
      `const r=document.querySelector('[data-companion-dock]').getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight`
    )
  )
  await send('Emulation.clearDeviceMetricsOverride')
  await click('[data-companion-options]')
  await click('[data-nav=leaderboards]')
  check(
    'ranking displays current companion',
    await wait(
      `document.querySelector('[data-ranking-row="${session.user.publicId}"] [data-ranking-companion="${ownedId}"]')`
    )
  )
  const buddyUsername = 'friend_' + Date.now().toString(36)
  const buddyResponse = await fetch(apiBase + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: buddyUsername,
      password: 'QA-only-' + crypto.randomUUID(),
      nickname: 'QA Friend'
    })
  })
  const buddy = await buddyResponse.json()
  if (!buddy.token) throw new Error('Buddy fixture registration ' + buddy.error?.code)
  const buddyCall = async (path, body) => {
    const r = await fetch(apiBase + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + buddy.token },
      body: JSON.stringify(body)
    })
    const value = await r.json()
    if (!r.ok) throw new Error(value.error?.code)
    return value
  }
  await buddyCall('/test/grant', { requestId: crypto.randomUUID() })
  await buddyCall('/draw', { requestId: crypto.randomUUID(), source: 'learning', count: 1 })
  await buddyCall('/friends/request', {
    requestId: crypto.randomUUID(),
    publicId: session.user.publicId
  })
  await click('[data-community-tab=friends]')
  check(
    'UI receives invitation from ordinary QA friend',
    await wait(`document.querySelector('[data-friend-incoming]')`)
  )
  await click('[data-friend-accept]')
  check(
    'UI accepts mutual friendship',
    await wait(`document.querySelector('[data-friend-row="${buddy.user.publicId}"]')`)
  )
  await click('[data-community-tab=rankings]')
  await click('[data-ranking-scope=friends]')
  check(
    'friends leaderboard contains accepted friend',
    await wait(`document.querySelector('[data-ranking-row="${buddy.user.publicId}"]')`)
  )
  check(
    'friends leaderboard excludes unrelated users',
    await evaluate(
      `return Array.from(document.querySelectorAll('[data-ranking-row]')).every(e=>${JSON.stringify([session.user.publicId, buddy.user.publicId])}.includes(e.dataset.rankingRow))`
    )
  )
  await input('[data-ranking-visibility]', 'friends')
  await sleep(300)
  check(
    'only-friends participation saves on server',
    (await snapshot()).user.rankVisibility === 'friends'
  )
  await click('[data-ranking-scope=global]')
  await sleep(300)
  check(
    'only-friends profile is absent from global board',
    await evaluate(
      `return !document.querySelector('[data-ranking-row="${session.user.publicId}"]')`
    )
  )
  await input('[data-ranking-visibility]', 'global')
  await click('[data-community-tab=friends]')
  check(
    'friend list reload completes before removal',
    await wait(`document.querySelector('[data-friend-remove="${buddy.user.publicId}"]')`)
  )
  await click(`[data-friend-remove="${buddy.user.publicId}"]`)
  check(
    'friend removal asks for confirmation',
    await wait(`document.querySelector('[role=dialog] .btn.primary')`)
  )
  await click('[role=dialog] .btn.primary')
  check(
    'UI removes mutual friendship',
    await wait(`!document.querySelector('[data-friend-row="${buddy.user.publicId}"]')`)
  )
  await buddyCall('/auth/logout', {})
  await click('[data-nav=settings]')
  check(
    'account profile controls',
    await wait('document.querySelector("[data-account-public-collection]")')
  )
  await evaluate(
    `for(const selector of ['[data-account-public-collection]','[data-account-public-time]']){const e=document.querySelector(selector);if(!e.checked)e.click()}`
  )
  await input('[data-account-nickname]', 'QA Library')
  await click('[data-account-profile-save]')
  check(
    'public opt-in and nickname saved',
    await wait(
      'document.querySelector("[data-account-profile-save]") && !document.querySelector("[data-account-profile-save]").disabled'
    )
  )
  await click('[data-nav=leaderboards]')
  check(
    'collection leaderboard lists opted-in account',
    await wait(
      'document.querySelector("[data-ranking-row]") && document.body.textContent.includes("QA Library")'
    )
  )
  await click('[data-ranking-kind=time]')
  check('time language selector', await wait('document.querySelector("[data-ranking-language]")'))
  await input('[data-ranking-language]', 'sjn')
  check('per-language ranking renders', await wait('document.querySelector("table")'))
  await send('Emulation.setDeviceMetricsOverride', {
    width: 736,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false
  })
  await shot('rankings-736')
  check(
    'narrow UI avoids document overflow',
    await evaluate('return document.documentElement.scrollWidth<=innerWidth+2')
  )
  await close()
  launch()
  await connect()
  check(
    'restart retains main-owned login',
    await wait('document.querySelector("[data-nav=collection]")')
  )
  await click('[data-nav=collection]')
  check(
    'restart wallet restored from real server',
    await wait('document.querySelector("[data-learning-tickets]")?.textContent.trim()==="190"')
  )
  await click('[data-nav=settings]')
  await click('[data-account-logout]')
  check(
    'logout returns guest and clears collection access',
    await wait('document.querySelector("[data-account-submit]")')
  )
  await click('[data-nav=collection]')
  check(
    'signed-out wallet is hidden',
    await evaluate('return !document.querySelector("[data-wallet]")')
  )
  check('no renderer exceptions', errors.length === 0, errors.join('\n'))
  await close()
} catch (error) {
  errors.push(String(error))
  try {
    await shot('failure')
    writeFileSync(join(output, 'failure-ui.txt'), await evaluate('return document.body.innerText'))
  } catch {
    /* Preserve the original failure if screenshot capture is unavailable. */
  }
  process.exitCode = 1
} finally {
  ws?.close()
  if (child?.exitCode === null) child.kill()
  if (server?.exitCode === null) server.kill()
  writeFileSync(
    join(output, 'results.json'),
    JSON.stringify({ profile, apiBase, results, errors, diagnostics }, null, 2)
  )
  console.log('Evidence: ' + output)
}
