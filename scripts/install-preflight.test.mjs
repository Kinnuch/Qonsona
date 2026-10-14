import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { promises as fs } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cache = join(root, '.cache')
const executable = 'QonsonaPreflightFixture.exe'
const powershell =
  process.env.QON_PREFLIGHT_TEST_POWERSHELL ||
  join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  )
const script = join(root, 'build', 'install-preflight.ps1')
const options = { skip: process.platform !== 'win32', timeout: 60000 }

function run(command, args) {
  const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = '',
    stdout = ''
  child.stdout.on('data', (chunk) => {
    output += chunk
    stdout += chunk
  })
  child.stderr.on('data', (chunk) => {
    output += chunk
  })
  return new Promise((resolveResult, reject) => {
    child.on('error', reject)
    child.on('exit', (code) => resolveResult({ code, output, stdout }))
  })
}

async function fixture(callback) {
  await fs.mkdir(cache, { recursive: true })
  const directory = await fs.mkdtemp(join(cache, 'install-preflight-'))
  const logs = []
  const children = []
  try {
    await callback({ directory, logs, children })
  } finally {
    for (const child of children) {
      if (child.exitCode === null) {
        child.kill()
        await once(child, 'exit').catch(() => {})
      }
    }
    for (const log of logs) {
      assert.match(basename(log), /^Qonsona-install-[a-f0-9]{32}\.log$/)
      await fs.rm(log, { force: true })
    }
    const nested = relative(cache, resolve(directory))
    assert.ok(nested && !nested.startsWith('..') && !nested.includes(':'))
    await fs.rm(directory, { recursive: true, force: true })
  }
}

async function inspect(f, target, fields = {}) {
  const request = join(f.directory, 'request.txt')
  const result = join(f.directory, 'result.txt')
  const lines = [
    target,
    executable,
    'Uninstall ' + executable,
    fields.oldUser || '',
    fields.oldAll || '',
    fields.uninstallUser || '',
    fields.uninstallAll || '',
    fields.mode || 'installer',
    String(fields.callerPid || process.pid),
    fields.waitMode || 'reject'
  ]
  await fs.writeFile(request, lines.join('\r\n') + '\r\n', 'utf16le')
  await fs.rm(result, { force: true })
  const runResult = await run(powershell, [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-WindowStyle',
    'Hidden',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    fields.scriptFile || script,
    '-RequestPath',
    request,
    '-ResultPath',
    result
  ])
  const [status, log] = (await fs.readFile(result, 'utf16le'))
    .replace(/^\uFEFF/, '')
    .trim()
    .split('\r\n')
  f.logs.push(log)
  const report = JSON.parse(await fs.readFile(log, 'utf8'))
  assert.equal(Number(status), runResult.code, runResult.output)
  assert.equal(report.code, runResult.code)
  assert.ok(report.elapsedMs < 45000)
  return report
}

async function holdFile(f, path, allowDelete = false) {
  const encodedPath = Buffer.from(path, 'utf16le').toString('base64')
  const sharing = allowDelete
    ? '([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete)'
    : '[IO.FileShare]::ReadWrite'
  const source = `$ErrorActionPreference='Stop'; $p=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encodedPath}')); if($p.Length -gt 259){$s=[string][char]92; $p=$s+$s+'?'+$s+$p}; $f=[IO.File]::Open($p,[IO.FileMode]::Open,[IO.FileAccess]::Read,${sharing}); [Console]::Out.WriteLine('ready'); [Console]::Out.Flush(); Start-Sleep -Seconds 55; $f.Dispose()`
  const child = spawn(
    powershell,
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(source, 'utf16le').toString('base64')
    ],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  f.children.push(child)
  await new Promise((resolveReady, reject) => {
    child.stdout.once('data', (data) =>
      data.toString().includes('ready')
        ? resolveReady()
        : reject(new Error('Unexpected fixture response'))
    )
    child.once('error', reject)
    child.once('exit', () => reject(new Error('File lock fixture stopped early')))
  })
  return child
}

async function runningCopy(f, directory, name = executable, args = ['-t', '127.0.0.1']) {
  await fs.mkdir(directory, { recursive: true })
  const file = join(directory, name)
  await fs.copyFile(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'ping.exe'), file)
  const child = spawn(file, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  f.children.push(child)
  await once(child, 'spawn')
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 300))
  assert.equal(child.exitCode, null)
  return child
}

test('PowerShell 5.1 parses the packaged script', options, async () => {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const source = `$p=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}')); $e=$null; [Management.Automation.Language.Parser]::ParseFile($p,[ref]$null,[ref]$e)|Out-Null; if($e.Count){$e|ForEach-Object{$_.Message};exit 1}`
  assert.equal(
    (
      await run(powershell, [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(source, 'utf16le').toString('base64')
      ])
    ).code,
    0
  )
})

test('fresh and existing directories pass without changing file content', options, async () =>
  fixture(async (f) => {
    const target = join(f.directory, 'application')
    assert.equal((await inspect(f, target)).code, 0)
    await fs.mkdir(target)
    await fs.writeFile(join(target, 'application.dat'), 'synthetic content')
    const report = await inspect(f, target)
    assert.equal(report.code, 0)
    assert.equal(report.checkedFiles, 1)
    assert.equal(await fs.readFile(join(target, 'application.dat'), 'utf8'), 'synthetic content')
  })
)

test('apostrophes, spaces, Chinese and shell metacharacters remain path data', options, async () =>
  fixture(async (f) => {
    const target = join(f.directory, "学习 O'Brien & $(write-host injected); app")
    await fs.mkdir(target)
    assert.equal((await inspect(f, target)).code, 0)
  })
)

test('a helper executable inside the installation blocks without stopping it', options, async () =>
  fixture(async (f) => {
    const target = join(f.directory, 'application')
    const child = await runningCopy(f, target, 'speech-fixture.exe')
    const report = await inspect(f, target)
    assert.equal(report.code, 10)
    assert.ok(
      report.processes.some((process) => process.pid === child.pid && process.withinInstallation)
    )
    assert.equal(child.exitCode, null)
  })
)

test('a sibling-prefix directory does not count as an installation child', options, async () =>
  fixture(async (f) => {
    const target = join(f.directory, 'application')
    await fs.mkdir(target)
    const child = await runningCopy(f, target + '-other', 'speech-fixture.exe')
    assert.equal((await inspect(f, target)).code, 0)
    assert.equal(child.exitCode, null)
  })
)

test(
  'an external same-name copy blocks the legacy uninstaller without stopping it',
  options,
  async () =>
    fixture(async (f) => {
      const target = join(f.directory, 'application')
      await fs.mkdir(target)
      const child = await runningCopy(f, join(f.directory, 'other'))
      const report = await inspect(f, target)
      assert.equal(report.code, 10)
      assert.ok(
        report.processes.some((process) => process.pid === child.pid && !process.withinInstallation)
      )
      assert.equal(child.exitCode, null)
    })
)

test(
  'a DELETE-sharing lock is detected on the registered old directory before a destination change',
  options,
  async () =>
    fixture(async (f) => {
      const old = join(f.directory, 'old-application')
      await fs.mkdir(old)
      const file = join(old, 'application.dat')
      await fs.writeFile(file, 'unchanged')
      const child = await holdFile(f, file)
      const report = await inspect(f, join(f.directory, 'new-application'), {
        uninstallUser: '"' + join(old, 'Uninstall ' + executable) + '"'
      })
      assert.equal(report.code, 12)
      assert.equal(report.files[0].nativeError, 32)
      assert.equal(child.exitCode, null)
      assert.equal(await fs.readFile(file, 'utf8'), 'unchanged')
    })
)

test('drive roots and malformed legacy uninstall commands fail closed', options, async () =>
  fixture(async (f) => {
    assert.equal((await inspect(f, 'C:\\')).code, 20)
    const report = await inspect(f, join(f.directory, 'application'), {
      uninstallUser: 'powershell.exe -Command something'
    })
    assert.equal(report.code, 20)
    assert.equal(report.stage, 'request')
  })
)

test(
  'an in-place uninstaller can inspect its own executable without stopping it',
  options,
  async () =>
    fixture(async (f) => {
      const target = join(f.directory, 'application')
      const child = await runningCopy(f, target, 'Uninstall ' + executable)
      assert.equal(
        (await inspect(f, target, { mode: 'uninstaller', callerPid: child.pid })).code,
        0
      )
      assert.equal(child.exitCode, null)
    })
)

test('an existing file beyond MAX_PATH accepts an active ShareDelete handle', options, async () =>
  fixture(async (f) => {
    const target = join(f.directory, 'application')
    const directory = target
    await fs.mkdir(directory, { recursive: true })
    const file = join(directory, 'long-native-probe-' + 'x'.repeat(200) + '.dll')
    assert.ok(file.length > 260)
    await fs.writeFile(file, 'synthetic long-path content')
    assert.equal((await fs.stat(file)).isFile(), true)
    const child = await holdFile(f, file, true)
    const report = await inspect(f, target)
    assert.equal(report.code, 0, JSON.stringify(report))
    assert.equal(report.checkedFiles, 1)
    assert.equal(child.exitCode, null)
    assert.equal(await fs.readFile(file, 'utf8'), 'synthetic long-path content')
  })
)

test('a file beyond MAX_PATH still rejects a handle without ShareDelete', options, async () =>
  fixture(async (f) => {
    const target = join(f.directory, 'application')
    const directory = target
    await fs.mkdir(directory, { recursive: true })
    const file = join(directory, 'long-native-probe-' + 'x'.repeat(200) + '.dll')
    assert.ok(file.length > 260)
    await fs.writeFile(file, 'synthetic long-path content')
    const child = await holdFile(f, file)
    const report = await inspect(f, target)
    assert.equal(report.code, 12, JSON.stringify(report))
    assert.equal(report.files[0].nativeError, 32)
    assert.equal(report.files[0].file, relative(target, file))
    assert.equal(child.exitCode, null)
    assert.equal(await fs.readFile(file, 'utf8'), 'synthetic long-path content')
  })
)

test('native path conversion supports drive, UNC and already extended paths', options, async () => {
  const separator = String.fromCharCode(92)
  const prefix = separator + separator + '?' + separator
  const values = [
    'C:' + separator + 'fixture',
    separator + separator + 'server' + separator + 'share' + separator + 'fixture',
    prefix + 'C:' + separator + 'fixture'
  ]
  const expected = [prefix + values[0], prefix + 'UNC' + separator + values[1].slice(2), values[2]]
  const encodedScript = Buffer.from(script, 'utf16le').toString('base64')
  const encodedValues = Buffer.from(JSON.stringify(values), 'utf16le').toString('base64')
  const source = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $p=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encodedScript}')); $ast=[Management.Automation.Language.Parser]::ParseFile($p,[ref]$null,[ref]$null); $definition=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-Win32FilePath'},$false); . ([scriptblock]::Create($definition.Extent.Text)); $values=ConvertFrom-Json ([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encodedValues}'))); @($values | ForEach-Object {Get-Win32FilePath $_}) | ConvertTo-Json -Compress`
  const result = await run(powershell, [
    '-NoProfile',
    '-NonInteractive',
    '-EncodedCommand',
    Buffer.from(source, 'utf16le').toString('base64')
  ])
  assert.equal(result.code, 0, result.output)
  assert.deepEqual(JSON.parse(result.stdout), expected)
})

test(
  'a silent update handoff waits for the registered executable to exit naturally',
  options,
  async () =>
    fixture(async (f) => {
      const target = join(f.directory, 'registered-application')
      const child = await runningCopy(f, target, executable, ['-n', '5', '127.0.0.1'])
      const sentinel = join(target, 'saved-content.dat')
      await fs.writeFile(sentinel, 'saved content remains unchanged')
      const report = await inspect(f, target, { oldUser: target, waitMode: 'wait-updated' })
      assert.equal(report.code, 0, JSON.stringify(report))
      assert.ok(report.waitedMs > 0)
      assert.equal(report.processes.length, 0)
      assert.equal(child.exitCode, 0)
      assert.equal(await fs.readFile(sentinel, 'utf8'), 'saved content remains unchanged')
    })
)

test(
  'ordinary installation refuses a registered running executable without waiting',
  options,
  async () =>
    fixture(async (f) => {
      const target = join(f.directory, 'registered-application')
      const child = await runningCopy(f, target)
      const report = await inspect(f, target, { oldUser: target })
      assert.equal(report.code, 10)
      assert.equal(report.waitedMs, 0)
      assert.equal(child.exitCode, null)
    })
)

test(
  'update waiting requires the registered directory, not just the selected destination',
  options,
  async () =>
    fixture(async (f) => {
      const target = join(f.directory, 'unregistered-application')
      const child = await runningCopy(f, target)
      const report = await inspect(f, target, { waitMode: 'wait-updated' })
      assert.equal(report.code, 10)
      assert.equal(report.waitedMs, 0)
      assert.equal(child.exitCode, null)
    })
)

test(
  'an external same-name copy rejects update waiting before the old copy is touched',
  options,
  async () =>
    fixture(async (f) => {
      const target = join(f.directory, 'registered-application')
      const old = await runningCopy(f, target)
      const other = await runningCopy(f, join(f.directory, 'another-application'))
      const sentinel = join(target, 'saved-content.dat')
      await fs.writeFile(sentinel, 'unchanged on external-copy refusal')
      const report = await inspect(f, target, { oldUser: target, waitMode: 'wait-updated' })
      assert.equal(report.code, 10, JSON.stringify(report))
      assert.equal(report.waitedMs, 0)
      assert.ok(report.elapsedMs < 15000)
      assert.ok(
        report.processes.some((process) => process.pid === other.pid && !process.withinInstallation)
      )
      assert.equal(old.exitCode, null)
      assert.equal(other.exitCode, null)
      assert.equal(await fs.readFile(sentinel, 'utf8'), 'unchanged on external-copy refusal')
    })
)

test(
  'a bounded update wait times out safely and preserves the running installation',
  options,
  async () =>
    fixture(async (f) => {
      const target = join(f.directory, 'registered-application')
      const child = await runningCopy(f, target)
      const sentinel = join(target, 'saved-content.dat')
      await fs.writeFile(sentinel, 'unchanged on wait timeout')
      const original = await fs.readFile(script, 'utf8')
      assert.equal(original.split('$maximumWaitMs = 20000').length, 2)
      // Only this disposable test copy has a shorter fixed deadline. Production has no override.
      const boundedScript = join(f.directory, 'short-wait-preflight.ps1')
      await fs.writeFile(
        boundedScript,
        original.replace('$maximumWaitMs = 20000', '$maximumWaitMs = 700')
      )
      const report = await inspect(f, target, {
        oldUser: target,
        waitMode: 'wait-updated',
        scriptFile: boundedScript
      })
      assert.equal(report.code, 10, JSON.stringify(report))
      assert.ok(report.waitedMs >= 650 && report.waitedMs < 5000)
      assert.equal(report.checkedFiles, 0)
      assert.ok(report.processes.some((process) => process.pid === child.pid))
      assert.equal(child.exitCode, null)
      assert.equal(await fs.readFile(sentinel, 'utf8'), 'unchanged on wait timeout')
      assert.equal((await fs.stat(join(target, executable))).isFile(), true)
    })
)
